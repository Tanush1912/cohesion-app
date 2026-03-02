package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/cohesion-api/cohesion_backend/internal/auth"
	"github.com/cohesion-api/cohesion_backend/internal/services"
	"github.com/cohesion-api/cohesion_backend/pkg/diff"
	"github.com/cohesion-api/cohesion_backend/pkg/schemair"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type IngestRequest struct {
	ProjectID string                 `json:"project_id"`
	Requests  []services.LiveRequest `json:"requests"`
}

func (h *Handlers) IngestRuntimeCaptures(w http.ResponseWriter, r *http.Request) {
	var req IngestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	projectID, err := uuid.Parse(req.ProjectID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}

	if h.requireProjectAccess(w, r, projectID) == nil {
		return
	}

	if len(req.Requests) == 0 {
		respondError(w, http.StatusBadRequest, "No requests provided")
		return
	}

	h.liveService.IngestRequests(projectID, req.Requests)

	respondJSON(w, http.StatusCreated, map[string]string{
		"message": "Requests ingested",
		"count":   strconv.Itoa(len(req.Requests)),
	})
}

func (h *Handlers) LiveStream(w http.ResponseWriter, r *http.Request) {
	projectIDStr := r.URL.Query().Get("project_id")
	if projectIDStr == "" {
		respondError(w, http.StatusBadRequest, "project_id query parameter is required")
		return
	}

	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}

	if h.requireProjectAccess(w, r, projectID) == nil {
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		respondError(w, http.StatusInternalServerError, "Streaming not supported")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	ch := h.liveService.Subscribe(projectID)
	defer h.liveService.Unsubscribe(projectID, ch)

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-ch:
			if !ok {
				return
			}
			data, err := json.Marshal(event)
			if err != nil {
				continue
			}
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}

func (h *Handlers) GetLiveRequests(w http.ResponseWriter, r *http.Request) {
	projectIDStr := r.URL.Query().Get("project_id")
	if projectIDStr == "" {
		respondError(w, http.StatusBadRequest, "project_id query parameter is required")
		return
	}

	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}

	if h.requireProjectAccess(w, r, projectID) == nil {
		return
	}

	requests := h.liveService.GetRecentRequests(projectID)
	respondJSON(w, http.StatusOK, requests)
}

func (h *Handlers) InferFromLiveBuffer(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ProjectID string `json:"project_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	projectID, err := uuid.Parse(req.ProjectID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}

	if h.requireProjectAccess(w, r, projectID) == nil {
		return
	}

	schemas := h.liveService.InferFromBuffer(projectID)
	if len(schemas) == 0 {
		respondError(w, http.StatusBadRequest, "No buffered requests to infer from")
		return
	}

	valSchemas := make([]schemair.SchemaIR, len(schemas))
	for i, s := range schemas {
		valSchemas[i] = *s
	}

	if err := h.schemaService.UploadSchemas(r.Context(), projectID, valSchemas); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to upload inferred schemas: "+err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Schema inference complete",
		"count":   len(schemas),
	})
}

func (h *Handlers) StartCapture(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ProjectID string `json:"project_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	projectID, err := uuid.Parse(req.ProjectID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}

	if h.requireProjectAccess(w, r, projectID) == nil {
		return
	}

	userID := auth.UserID(r.Context())
	h.liveService.StartCapture(projectID, userID)
	respondJSON(w, http.StatusOK, map[string]string{"message": "Self-capture started"})
}

func (h *Handlers) StopCapture(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	active, projectID := h.liveService.IsCapturingForUser(userID)
	if !active {
		respondJSON(w, http.StatusOK, map[string]string{"message": "No active capture"})
		return
	}

	h.liveService.StopCapture(projectID)
	respondJSON(w, http.StatusOK, map[string]string{"message": "Self-capture stopped"})
}

func (h *Handlers) ClearLiveBuffer(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ProjectID string `json:"project_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	projectID, err := uuid.Parse(req.ProjectID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}

	if h.requireProjectAccess(w, r, projectID) == nil {
		return
	}

	h.liveService.ClearBuffer(projectID)
	respondJSON(w, http.StatusOK, map[string]string{"message": "Buffer cleared"})
}

func isPrivateIP(ip net.IP) bool {
	privateRanges := []string{
		"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
		"127.0.0.0/8",
		"169.254.0.0/16",
		"::1/128", "fc00::/7", "fe80::/10",
	}
	for _, cidr := range privateRanges {
		_, network, _ := net.ParseCIDR(cidr)
		if network.Contains(ip) {
			return true
		}
	}
	return false
}

func validateProxyTarget(targetURL *url.URL) (string, error) {
	host := targetURL.Hostname()
	if host == "" {
		return "", fmt.Errorf("empty host")
	}

	if host == "localhost" || host == "0.0.0.0" || host == "[::1]" {
		return "", fmt.Errorf("localhost targets are not allowed")
	}

	if targetURL.Scheme != "http" && targetURL.Scheme != "https" {
		return "", fmt.Errorf("only http and https schemes are allowed")
	}

	ips, err := net.LookupIP(host)
	if err != nil {
		return "", fmt.Errorf("cannot resolve host: %w", err)
	}
	var resolvedIP string
	for _, ip := range ips {
		if isPrivateIP(ip) {
			return "", fmt.Errorf("target resolves to a private/reserved IP address")
		}
		if resolvedIP == "" {
			resolvedIP = ip.String()
		}
	}
	return resolvedIP, nil
}

// ConfigureProxy sets up a proxy target for a given project and label.
func (h *Handlers) ConfigureProxy(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ProjectID string `json:"project_id"`
		Label     string `json:"label"`
		TargetURL string `json:"target_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	projectID, err := uuid.Parse(req.ProjectID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}

	if h.requireProjectAccess(w, r, projectID) == nil {
		return
	}

	if req.Label == "" {
		respondError(w, http.StatusBadRequest, "Label is required")
		return
	}

	targetURL, err := url.Parse(req.TargetURL)
	if err != nil || targetURL.Host == "" {
		respondError(w, http.StatusBadRequest, "Invalid target URL")
		return
	}

	resolvedIP, err := validateProxyTarget(targetURL)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Proxy target not allowed: "+err.Error())
		return
	}

	h.proxyMu.Lock()
	if h.proxyTargets[req.ProjectID] == nil {
		h.proxyTargets[req.ProjectID] = make(map[string]*ProxyTarget)
	}
	h.proxyTargets[req.ProjectID][req.Label] = &ProxyTarget{
		Label:      req.Label,
		TargetURL:  targetURL,
		RawURL:     req.TargetURL,
		ResolvedIP: resolvedIP,
	}
	h.proxyMu.Unlock()

	respondJSON(w, http.StatusOK, map[string]string{
		"message":   "Proxy configured",
		"label":     req.Label,
		"target":    req.TargetURL,
		"proxy_url": fmt.Sprintf("/api/live/proxy/%s/%s", req.ProjectID, req.Label),
	})
}

// ProxyHandler forwards requests to the configured target and captures traffic.
func (h *Handlers) ProxyHandler(w http.ResponseWriter, r *http.Request) {
	projectIDStr := chi.URLParam(r, "projectID")
	label := chi.URLParam(r, "label")

	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}

	if h.requireProjectAccess(w, r, projectID) == nil {
		return
	}

	h.proxyMu.RLock()
	projectTargets, ok := h.proxyTargets[projectIDStr]
	if !ok {
		h.proxyMu.RUnlock()
		respondError(w, http.StatusNotFound, "No proxy configured for this project")
		return
	}
	target, ok := projectTargets[label]
	if !ok {
		h.proxyMu.RUnlock()
		respondError(w, http.StatusNotFound, fmt.Sprintf("No proxy target for label %q", label))
		return
	}
	h.proxyMu.RUnlock()

	// Read and buffer request body
	var reqBody map[string]interface{}
	var reqBodyBytes []byte
	if r.Body != nil && r.ContentLength != 0 {
		reqBodyBytes, _ = io.ReadAll(r.Body)
		r.Body = io.NopCloser(bytes.NewBuffer(reqBodyBytes))
		json.Unmarshal(reqBodyBytes, &reqBody)
	}

	// Extract the downstream path: everything after /api/live/proxy/{projectID}/{label}
	prefix := fmt.Sprintf("/api/live/proxy/%s/%s", projectIDStr, label)
	downstreamPath := strings.TrimPrefix(r.URL.Path, prefix)
	if downstreamPath == "" {
		downstreamPath = "/"
	}

	start := time.Now()

	proxy := &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			req.URL.Scheme = target.TargetURL.Scheme
			req.URL.Host = target.TargetURL.Host
			req.URL.Path = downstreamPath
			req.URL.RawQuery = r.URL.RawQuery
			req.Host = target.TargetURL.Host
		},
		Transport: &http.Transport{
			DialContext: (&net.Dialer{}).DialContext,
			Proxy:       http.ProxyFromEnvironment,
		},
	}
	if target.ResolvedIP != "" {
		pinnedIP := target.ResolvedIP
		port := target.TargetURL.Port()
		if port == "" {
			if target.TargetURL.Scheme == "https" {
				port = "443"
			} else {
				port = "80"
			}
		}
		proxy.Transport = &http.Transport{
			DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
				return (&net.Dialer{}).DialContext(ctx, network, net.JoinHostPort(pinnedIP, port))
			},
		}
	}

	// Capture response
	var respBodyBuf bytes.Buffer
	var respStatusCode int

	proxy.ModifyResponse = func(resp *http.Response) error {
		respStatusCode = resp.StatusCode
		respBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			return err
		}
		respBodyBuf.Write(respBytes)
		resp.Body = io.NopCloser(bytes.NewBuffer(respBytes))
		return nil
	}

	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		respondError(w, http.StatusBadGateway, fmt.Sprintf("Proxy error: %v", err))
	}

	proxy.ServeHTTP(w, r)

	duration := time.Since(start)

	var respBody map[string]interface{}
	json.Unmarshal(respBodyBuf.Bytes(), &respBody)

	capture := services.LiveRequest{
		ID:           uuid.New().String(),
		Timestamp:    start,
		Source:       label,
		Path:         downstreamPath,
		Method:       r.Method,
		StatusCode:   respStatusCode,
		DurationMs:   float64(duration.Milliseconds()),
		RequestBody:  reqBody,
		ResponseBody: respBody,
	}

	h.liveService.IngestRequests(projectID, []services.LiveRequest{capture})
}

// LiveDiff computes a diff between two source labels in the live buffer.
func (h *Handlers) LiveDiff(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ProjectID string `json:"project_id"`
		SourceA   string `json:"source_a"`
		SourceB   string `json:"source_b"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	projectID, err := uuid.Parse(req.ProjectID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}

	if h.requireProjectAccess(w, r, projectID) == nil {
		return
	}

	if req.SourceA == "" || req.SourceB == "" {
		respondError(w, http.StatusBadRequest, "Both source_a and source_b are required")
		return
	}

	schemasA := h.liveService.InferFromBufferBySource(projectID, req.SourceA)
	schemasB := h.liveService.InferFromBufferBySource(projectID, req.SourceB)

	if len(schemasA) == 0 && len(schemasB) == 0 {
		respondError(w, http.StatusBadRequest, "No buffered requests for either source")
		return
	}

	// Re-tag schemas so the diff engine's severity logic works correctly
	for _, s := range schemasA {
		s.Source = schemair.SourceBackendStatic
	}
	for _, s := range schemasB {
		s.Source = schemair.SourceFrontendStatic
	}

	// Build endpoint-keyed map
	type endpointKey struct {
		endpoint string
		method   string
	}
	schemaMap := make(map[endpointKey][]schemair.SchemaIR)

	for _, s := range schemasA {
		k := endpointKey{s.Endpoint, s.Method}
		schemaMap[k] = append(schemaMap[k], *s)
	}
	for _, s := range schemasB {
		k := endpointKey{s.Endpoint, s.Method}
		schemaMap[k] = append(schemaMap[k], *s)
	}

	engine := diff.NewEngine()
	var results []diff.Result

	for k, schemas := range schemaMap {
		result := engine.Compare(k.endpoint, k.method, schemas)
		if result != nil {
			results = append(results, *result)
		}
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"results":        results,
		"source_a":       req.SourceA,
		"source_b":       req.SourceB,
		"endpoint_count": len(schemaMap),
	})
}

func (h *Handlers) GetLiveSchemas(w http.ResponseWriter, r *http.Request) {
	projectIDStr := r.URL.Query().Get("project_id")
	if projectIDStr == "" {
		respondError(w, http.StatusBadRequest, "project_id query parameter is required")
		return
	}

	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}

	if h.requireProjectAccess(w, r, projectID) == nil {
		return
	}

	source := r.URL.Query().Get("source")
	if source == "" {
		respondError(w, http.StatusBadRequest, "source query parameter is required")
		return
	}

	schemas := h.liveService.InferFromBufferBySource(projectID, source)
	if schemas == nil {
		schemas = []*schemair.SchemaIR{}
	}

	respondJSON(w, http.StatusOK, schemas)
}

// GetLiveSources returns the distinct source labels in the buffer.
func (h *Handlers) GetLiveSources(w http.ResponseWriter, r *http.Request) {
	projectIDStr := r.URL.Query().Get("project_id")
	if projectIDStr == "" {
		respondError(w, http.StatusBadRequest, "project_id query parameter is required")
		return
	}

	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}

	if h.requireProjectAccess(w, r, projectID) == nil {
		return
	}

	sources := h.liveService.GetDistinctSources(projectID)
	if sources == nil {
		sources = []string{}
	}
	respondJSON(w, http.StatusOK, sources)
}
