package services

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/cohesion-api/cohesion_backend/pkg/runtime"
	"github.com/cohesion-api/cohesion_backend/pkg/schemair"
	"github.com/google/uuid"
)

type LiveRequest struct {
	ID           string                 `json:"id"`
	Timestamp    time.Time              `json:"timestamp"`
	Path         string                 `json:"path"`
	Method       string                 `json:"method"`
	StatusCode   int                    `json:"status_code"`
	DurationMs   float64                `json:"duration_ms"`
	RequestBody  map[string]interface{} `json:"request_body,omitempty"`
	ResponseBody map[string]interface{} `json:"response_body,omitempty"`
	Source       string                 `json:"source,omitempty"`
}

type LiveEvent struct {
	Type    string      `json:"type"` // "request" or "clear"
	Payload interface{} `json:"payload,omitempty"`
	Source  string      `json:"source,omitempty"`
}

type projectBuffer struct {
	requests []LiveRequest
	maxSize  int
}

func (b *projectBuffer) add(req LiveRequest) {
	if len(b.requests) >= b.maxSize {
		b.requests = b.requests[1:]
	}
	b.requests = append(b.requests, req)
}

type LiveService struct {
	mu               sync.RWMutex
	buffers          map[uuid.UUID]*projectBuffer
	subscribers      map[uuid.UUID]map[chan LiveEvent]struct{}
	maxPerProj       int
	captureProjectID uuid.UUID
}

func NewLiveService() *LiveService {
	return &LiveService{
		buffers:     make(map[uuid.UUID]*projectBuffer),
		subscribers: make(map[uuid.UUID]map[chan LiveEvent]struct{}),
		maxPerProj:  200,
	}
}

func (s *LiveService) StartCapture(projectID uuid.UUID) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.captureProjectID = projectID
}

func (s *LiveService) StopCapture() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.captureProjectID = uuid.Nil
}

func (s *LiveService) IsCapturing() (bool, uuid.UUID) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.captureProjectID != uuid.Nil, s.captureProjectID
}

type captureResponseWriter struct {
	http.ResponseWriter
	statusCode int
	body       *bytes.Buffer
}

func (w *captureResponseWriter) WriteHeader(code int) {
	w.statusCode = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *captureResponseWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

func (s *LiveService) SelfCaptureMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			active, projectID := s.IsCapturing()
			if !active {
				next.ServeHTTP(w, r)
				return
			}

			if strings.HasPrefix(r.URL.Path, "/api/live/") {
				next.ServeHTTP(w, r)
				return
			}

			var reqBody map[string]interface{}
			if r.Body != nil && r.ContentLength != 0 {
				bodyBytes, _ := io.ReadAll(r.Body)
				r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
				json.Unmarshal(bodyBytes, &reqBody)
			}

			start := time.Now()

			crw := &captureResponseWriter{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
				body:           &bytes.Buffer{},
			}

			next.ServeHTTP(crw, r)

			duration := time.Since(start)

			var respBody map[string]interface{}
			json.Unmarshal(crw.body.Bytes(), &respBody)

			capture := LiveRequest{
				ID:           uuid.New().String(),
				Timestamp:    start,
				Path:         r.URL.Path,
				Method:       r.Method,
				StatusCode:   crw.statusCode,
				DurationMs:   float64(duration.Milliseconds()),
				RequestBody:  reqBody,
				ResponseBody: respBody,
				Source:       "self",
			}

			s.IngestRequests(projectID, []LiveRequest{capture})
		})
	}
}

func (s *LiveService) IngestRequests(projectID uuid.UUID, requests []LiveRequest) []runtime.CapturedRequest {
	s.mu.Lock()
	defer s.mu.Unlock()

	buf, ok := s.buffers[projectID]
	if !ok {
		buf = &projectBuffer{
			requests: make([]LiveRequest, 0, s.maxPerProj),
			maxSize:  s.maxPerProj,
		}
		s.buffers[projectID] = buf
	}

	var captured []runtime.CapturedRequest
	for i := range requests {
		req := &requests[i]
		if req.ID == "" {
			req.ID = uuid.New().String()
		}
		if req.Timestamp.IsZero() {
			req.Timestamp = time.Now()
		}
		buf.add(*req)

		captured = append(captured, runtime.CapturedRequest{
			Path:             req.Path,
			Method:           req.Method,
			RequestBody:      req.RequestBody,
			StatusCode:       req.StatusCode,
			Response:         req.ResponseBody,
			ObservationCount: 1,
		})

		s.broadcast(projectID, LiveEvent{
			Type:    "request",
			Payload: *req,
			Source:  req.Source,
		})
	}

	return captured
}

func (s *LiveService) GetRecentRequests(projectID uuid.UUID) []LiveRequest {
	s.mu.RLock()
	defer s.mu.RUnlock()

	buf, ok := s.buffers[projectID]
	if !ok {
		return []LiveRequest{}
	}

	result := make([]LiveRequest, len(buf.requests))
	copy(result, buf.requests)
	return result
}

func (s *LiveService) GetBufferedAsCaptured(projectID uuid.UUID) []runtime.CapturedRequest {
	s.mu.RLock()
	defer s.mu.RUnlock()

	buf, ok := s.buffers[projectID]
	if !ok {
		return nil
	}

	var result []runtime.CapturedRequest
	for _, req := range buf.requests {
		result = append(result, runtime.CapturedRequest{
			Path:             req.Path,
			Method:           req.Method,
			RequestBody:      req.RequestBody,
			StatusCode:       req.StatusCode,
			Response:         req.ResponseBody,
			ObservationCount: 1,
		})
	}
	return result
}

func (s *LiveService) InferFromBuffer(projectID uuid.UUID) []*schemair.SchemaIR {
	captured := s.GetBufferedAsCaptured(projectID)
	if len(captured) == 0 {
		return nil
	}
	return runtime.InferSchema(captured)
}

func (s *LiveService) GetBufferedBySource(projectID uuid.UUID, source string) []LiveRequest {
	s.mu.RLock()
	defer s.mu.RUnlock()

	buf, ok := s.buffers[projectID]
	if !ok {
		return nil
	}

	var result []LiveRequest
	for _, req := range buf.requests {
		if req.Source == source {
			result = append(result, req)
		}
	}
	return result
}

func (s *LiveService) GetBufferedAsCapturedBySource(projectID uuid.UUID, source string) []runtime.CapturedRequest {
	s.mu.RLock()
	defer s.mu.RUnlock()

	buf, ok := s.buffers[projectID]
	if !ok {
		return nil
	}

	var result []runtime.CapturedRequest
	for _, req := range buf.requests {
		if req.Source == source {
			result = append(result, runtime.CapturedRequest{
				Path:             req.Path,
				Method:           req.Method,
				RequestBody:      req.RequestBody,
				StatusCode:       req.StatusCode,
				Response:         req.ResponseBody,
				ObservationCount: 1,
			})
		}
	}
	return result
}

func (s *LiveService) InferFromBufferBySource(projectID uuid.UUID, source string) []*schemair.SchemaIR {
	captured := s.GetBufferedAsCapturedBySource(projectID, source)
	if len(captured) == 0 {
		return nil
	}
	return runtime.InferSchema(captured)
}

func (s *LiveService) GetDistinctSources(projectID uuid.UUID) []string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	buf, ok := s.buffers[projectID]
	if !ok {
		return nil
	}

	seen := make(map[string]struct{})
	for _, req := range buf.requests {
		if req.Source != "" {
			seen[req.Source] = struct{}{}
		}
	}

	sources := make([]string, 0, len(seen))
	for s := range seen {
		sources = append(sources, s)
	}
	return sources
}

func (s *LiveService) ClearBuffer(projectID uuid.UUID) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if buf, ok := s.buffers[projectID]; ok {
		buf.requests = buf.requests[:0]
	}

	s.broadcast(projectID, LiveEvent{Type: "clear"})
}

func (s *LiveService) Subscribe(projectID uuid.UUID) chan LiveEvent {
	s.mu.Lock()
	defer s.mu.Unlock()

	ch := make(chan LiveEvent, 32)
	if s.subscribers[projectID] == nil {
		s.subscribers[projectID] = make(map[chan LiveEvent]struct{})
	}
	s.subscribers[projectID][ch] = struct{}{}
	return ch
}

func (s *LiveService) Unsubscribe(projectID uuid.UUID, ch chan LiveEvent) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if subs, ok := s.subscribers[projectID]; ok {
		delete(subs, ch)
		close(ch)
	}
}

func (s *LiveService) broadcast(projectID uuid.UUID, event LiveEvent) {
	subs, ok := s.subscribers[projectID]
	if !ok {
		return
	}
	data, err := json.Marshal(event)
	if err != nil {
		return
	}
	var evt LiveEvent
	json.Unmarshal(data, &evt)

	for ch := range subs {
		select {
		case ch <- event:
		default:
		}
	}
}
