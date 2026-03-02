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
	data    []LiveRequest
	maxSize int
	head    int
	count   int
}

func (b *projectBuffer) add(req LiveRequest) {
	if b.count < b.maxSize {
		b.data = append(b.data, req)
		b.count++
		b.head = b.count % b.maxSize
	} else {
		b.data[b.head] = req
		b.head = (b.head + 1) % b.maxSize
	}
}

func (b *projectBuffer) all() []LiveRequest {
	if b.count < b.maxSize {
		result := make([]LiveRequest, b.count)
		copy(result, b.data[:b.count])
		return result
	}
	result := make([]LiveRequest, b.maxSize)
	copy(result, b.data[b.head:])
	copy(result[b.maxSize-b.head:], b.data[:b.head])
	return result
}

func (b *projectBuffer) clear() {
	b.data = b.data[:0]
	b.head = 0
	b.count = 0
}

type captureEntry struct {
	ownerID string
}

type LiveService struct {
	mu          sync.RWMutex
	buffers     map[uuid.UUID]*projectBuffer
	subscribers map[uuid.UUID]map[chan LiveEvent]struct{}
	maxPerProj  int
	captures    map[uuid.UUID]captureEntry
}

func NewLiveService() *LiveService {
	return &LiveService{
		buffers:     make(map[uuid.UUID]*projectBuffer),
		subscribers: make(map[uuid.UUID]map[chan LiveEvent]struct{}),
		captures:    make(map[uuid.UUID]captureEntry),
		maxPerProj:  200,
	}
}

func (s *LiveService) StartCapture(projectID uuid.UUID, ownerID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.captures[projectID] = captureEntry{ownerID: ownerID}
}

func (s *LiveService) StopCapture(projectID uuid.UUID) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.captures, projectID)
}

func (s *LiveService) IsCapturingForUser(userID string) (bool, uuid.UUID) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for projectID, entry := range s.captures {
		if entry.ownerID == userID {
			return true, projectID
		}
	}
	return false, uuid.Nil
}

func (s *LiveService) IsProjectCapturing(projectID uuid.UUID) (bool, string) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	entry, ok := s.captures[projectID]
	if !ok {
		return false, ""
	}
	return true, entry.ownerID
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

func (s *LiveService) SelfCaptureMiddleware(userIDFunc func(r *http.Request) string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID := userIDFunc(r)
			if userID == "" {
				next.ServeHTTP(w, r)
				return
			}

			active, projectID := s.IsCapturingForUser(userID)
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

func (s *LiveService) IngestRequests(projectID uuid.UUID, requests []LiveRequest) {
	s.mu.Lock()
	defer s.mu.Unlock()

	buf, ok := s.buffers[projectID]
	if !ok {
		buf = &projectBuffer{
			data:    make([]LiveRequest, 0, s.maxPerProj),
			maxSize: s.maxPerProj,
		}
		s.buffers[projectID] = buf
	}

	for i := range requests {
		req := &requests[i]
		if req.ID == "" {
			req.ID = uuid.New().String()
		}
		if req.Timestamp.IsZero() {
			req.Timestamp = time.Now()
		}
		buf.add(*req)

		s.broadcast(projectID, LiveEvent{
			Type:    "request",
			Payload: *req,
			Source:  req.Source,
		})
	}
}

func (s *LiveService) GetRecentRequests(projectID uuid.UUID) []LiveRequest {
	s.mu.RLock()
	defer s.mu.RUnlock()

	buf, ok := s.buffers[projectID]
	if !ok {
		return []LiveRequest{}
	}

	return buf.all()
}

func (s *LiveService) GetBufferedAsCaptured(projectID uuid.UUID) []runtime.CapturedRequest {
	s.mu.RLock()
	defer s.mu.RUnlock()

	buf, ok := s.buffers[projectID]
	if !ok {
		return nil
	}

	requests := buf.all()
	result := make([]runtime.CapturedRequest, len(requests))
	for i, req := range requests {
		result[i] = runtime.CapturedRequest{
			Path:             req.Path,
			Method:           req.Method,
			RequestBody:      req.RequestBody,
			StatusCode:       req.StatusCode,
			Response:         req.ResponseBody,
			ObservationCount: 1,
		}
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
	for _, req := range buf.all() {
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
	for _, req := range buf.all() {
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
	for _, req := range buf.all() {
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

	delete(s.buffers, projectID)

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
	for ch := range subs {
		select {
		case ch <- event:
		default:
		}
	}
}
