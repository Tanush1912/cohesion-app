package runtime

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"io"
	"math/big"
	"net/http"
	"sync"
)

type CapturedRequest struct {
	Path             string                 `json:"path"`
	Method           string                 `json:"method"`
	RequestBody      map[string]interface{} `json:"request_body,omitempty"`
	StatusCode       int                    `json:"status_code"`
	Response         map[string]interface{} `json:"response,omitempty"`
	ObservationCount int                    `json:"observation_count"`
}

type Collector struct {
	mu           sync.RWMutex
	captured     []CapturedRequest
	maxSize      int
	SamplingRate float64
	MaxBodySize  int64
}

func NewCollector(maxSize int) *Collector {
	return &Collector{
		captured:     make([]CapturedRequest, 0, maxSize),
		maxSize:      maxSize,
		SamplingRate: 1.0,
		MaxBodySize:  1024 * 1024,
	}
}

func (c *Collector) Add(req CapturedRequest) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if len(c.captured) >= c.maxSize {
		c.captured = c.captured[1:]
	}
	c.captured = append(c.captured, req)
}

func (c *Collector) GetAll() []CapturedRequest {
	c.mu.RLock()
	defer c.mu.RUnlock()

	result := make([]CapturedRequest, len(c.captured))
	copy(result, c.captured)
	return result
}

func (c *Collector) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.captured = c.captured[:0]
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
	body       *bytes.Buffer
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	rw.body.Write(b)
	return rw.ResponseWriter.Write(b)
}

func CaptureMiddleware(collector *Collector) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if collector.SamplingRate < 1.0 {
				n, _ := rand.Int(rand.Reader, big.NewInt(100))
				if float64(n.Int64()) > collector.SamplingRate*100 {
					next.ServeHTTP(w, r)
					return
				}
			}

			var reqBody map[string]interface{}
			if r.Body != nil {
				if r.ContentLength > 0 && r.ContentLength > collector.MaxBodySize {
					next.ServeHTTP(w, r)
					return
				}

				bodyBytes, _ := io.ReadAll(r.Body)
				r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
				json.Unmarshal(bodyBytes, &reqBody)
			}

			rw := &responseWriter{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
				body:           &bytes.Buffer{},
			}

			next.ServeHTTP(rw, r)

			if int64(rw.body.Len()) > collector.MaxBodySize {
				return
			}

			var respBody map[string]interface{}
			json.Unmarshal(rw.body.Bytes(), &respBody)

			captured := CapturedRequest{
				Path:             r.URL.Path,
				Method:           r.Method,
				RequestBody:      reqBody,
				StatusCode:       rw.statusCode,
				Response:         respBody,
				ObservationCount: 1,
			}

			collector.Add(captured)
		})
	}
}
