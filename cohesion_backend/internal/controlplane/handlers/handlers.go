package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"

	"github.com/cohesion-api/cohesion_backend/internal/auth"
	"github.com/cohesion-api/cohesion_backend/internal/models"
	"github.com/cohesion-api/cohesion_backend/internal/repository"
	"github.com/cohesion-api/cohesion_backend/internal/services"
	"github.com/cohesion-api/cohesion_backend/pkg/analyzer"
	"github.com/cohesion-api/cohesion_backend/pkg/analyzer/gemini"
	ghpkg "github.com/cohesion-api/cohesion_backend/pkg/github"
	"github.com/cohesion-api/cohesion_backend/pkg/schemair"
	"github.com/go-chi/chi/v5"
	gh "github.com/google/go-github/v68/github"
	"github.com/google/uuid"
)

// ProxyTarget holds a configured proxy destination.
type ProxyTarget struct {
	Label      string   `json:"label"`
	TargetURL  *url.URL `json:"-"`
	RawURL     string   `json:"target_url"`
	ResolvedIP string   `json:"-"`
}

type Handlers struct {
	projectService      *services.ProjectService
	endpointService     *services.EndpointService
	schemaService       *services.SchemaService
	diffService         *services.DiffService
	liveService         *services.LiveService
	userSettingsService *services.UserSettingsService
	ghInstallService    *services.GitHubInstallationService
	analyzer            analyzer.Analyzer
	githubAppAuth       *ghpkg.AppAuth
	githubAppSlug       string

	proxyMu      sync.RWMutex
	proxyTargets map[string]map[string]*ProxyTarget // projectID → label → target
}

func New(
	projectService *services.ProjectService,
	endpointService *services.EndpointService,
	schemaService *services.SchemaService,
	diffService *services.DiffService,
	liveService *services.LiveService,
	userSettingsService *services.UserSettingsService,
	ghInstallService *services.GitHubInstallationService,
	a analyzer.Analyzer,
	githubAppAuth *ghpkg.AppAuth,
	githubAppSlug string,
) *Handlers {
	return &Handlers{
		projectService:      projectService,
		endpointService:     endpointService,
		schemaService:       schemaService,
		diffService:         diffService,
		liveService:         liveService,
		userSettingsService: userSettingsService,
		ghInstallService:    ghInstallService,
		analyzer:            a,
		githubAppAuth:       githubAppAuth,
		githubAppSlug:       githubAppSlug,
		proxyTargets:        make(map[string]map[string]*ProxyTarget),
	}
}

func (h *Handlers) Health(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]string{"status": "healthy"})
}

type CreateProjectRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

func (h *Handlers) CreateProject(w http.ResponseWriter, r *http.Request) {
	var req CreateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "Name is required")
		return
	}

	userID := auth.UserID(r.Context())
	project, err := h.projectService.Create(r.Context(), userID, req.Name, req.Description)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create project")
		return
	}

	respondJSON(w, http.StatusCreated, project)
}

func (h *Handlers) GetProject(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(chi.URLParam(r, "projectID"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}

	userID := auth.UserID(r.Context())
	project, err := h.projectService.GetByID(r.Context(), projectID, userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get project")
		return
	}

	if project == nil {
		respondError(w, http.StatusNotFound, "Project not found")
		return
	}

	respondJSON(w, http.StatusOK, project)
}

func (h *Handlers) ListProjects(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	projects, err := h.projectService.List(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list projects")
		return
	}

	if projects == nil {
		projects = []models.Project{}
	}

	respondJSON(w, http.StatusOK, projects)
}

func (h *Handlers) DeleteProject(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(chi.URLParam(r, "projectID"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}

	userID := auth.UserID(r.Context())
	if err := h.projectService.Delete(r.Context(), projectID, userID); err != nil {
		if err == repository.ErrNotFound {
			respondError(w, http.StatusNotFound, "Project not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to delete project")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type UploadSchemasRequest struct {
	ProjectID string              `json:"project_id"`
	Schemas   []schemair.SchemaIR `json:"schemas"`
}

func (h *Handlers) UploadBackendSchemas(w http.ResponseWriter, r *http.Request) {
	h.uploadSchemas(w, r, schemair.SourceBackendStatic)
}

func (h *Handlers) UploadFrontendSchemas(w http.ResponseWriter, r *http.Request) {
	h.uploadSchemas(w, r, schemair.SourceFrontendStatic)
}

func (h *Handlers) UploadRuntimeSchemas(w http.ResponseWriter, r *http.Request) {
	h.uploadSchemas(w, r, schemair.SourceRuntime)
}

func (h *Handlers) uploadSchemas(w http.ResponseWriter, r *http.Request, source schemair.SchemaSource) {
	var req UploadSchemasRequest
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

	for i := range req.Schemas {
		req.Schemas[i].Source = source
	}

	if err := h.schemaService.UploadSchemas(r.Context(), projectID, req.Schemas); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to upload schemas")
		return
	}

	respondJSON(w, http.StatusCreated, map[string]string{
		"message": "Schemas uploaded successfully",
		"count":   strconv.Itoa(len(req.Schemas)),
	})
}

type ScanCodebaseRequest struct {
	ProjectID string         `json:"project_id"`
	DirPath   string         `json:"dir_path,omitempty"`
	Files     []UploadedFile `json:"files,omitempty"`
	ScanType  string         `json:"scan_type"`
	Language  string         `json:"language,omitempty"`
}

type UploadedFile struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

func (h *Handlers) ScanCodebase(w http.ResponseWriter, r *http.Request) {
	var req ScanCodebaseRequest
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

	var mode gemini.ScanMode
	var source schemair.SchemaSource
	switch req.ScanType {
	case "frontend":
		mode = gemini.ScanModeFrontend
		source = schemair.SourceFrontendStatic
	case "backend", "":
		mode = gemini.ScanModeBackend
		source = schemair.SourceBackendStatic
	default:
		respondError(w, http.StatusBadRequest, "Invalid scan_type: must be 'backend' or 'frontend'")
		return
	}

	var ga *gemini.GeminiAnalyzer
	userID := auth.UserID(r.Context())
	if userID != "" {
		settings, err := h.userSettingsService.Get(r.Context(), userID)
		if err == nil && settings.GeminiAPIKey != "" {
			model := settings.GeminiModel
			if model == "" {
				model = "gemini-2.5-flash"
			}
			ga = gemini.New(settings.GeminiAPIKey, model)
		}
	}
	if ga == nil {
		var ok bool
		ga, ok = h.analyzer.(*gemini.GeminiAnalyzer)
		if !ok {
			respondError(w, http.StatusBadRequest, "No Gemini API key configured. Add one in Settings.")
			return
		}
	}

	var schemas []*schemair.SchemaIR

	if len(req.Files) > 0 {
		sourceFiles := make([]gemini.SourceFile, len(req.Files))
		for i, f := range req.Files {
			sourceFiles[i] = gemini.SourceFile{Path: f.Path, Content: f.Content}
		}

		language := req.Language
		if language == "" {
			language = gemini.DetectLanguage(sourceFiles)
		}

		schemas, err = ga.AnalyzeFiles(r.Context(), sourceFiles, language, mode)
	} else if req.DirPath != "" {
		respondError(w, http.StatusBadRequest, "dir_path is not supported for security reasons. Upload files directly using the 'files' field instead.")
		return
	} else {
		respondError(w, http.StatusBadRequest, "Either 'files' or 'dir_path' must be provided")
		return
	}

	if err != nil {
		respondError(w, http.StatusInternalServerError, "Analysis failed: "+err.Error())
		return
	}

	valSchemas := make([]schemair.SchemaIR, len(schemas))
	for i, s := range schemas {
		s.Source = source
		valSchemas[i] = *s
	}

	if err := h.schemaService.UploadSchemas(r.Context(), projectID, valSchemas); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to upload analyzed schemas")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Analysis successful and schemas uploaded",
		"count":   len(schemas),
	})
}

type ScanGitHubRequest struct {
	ProjectID string `json:"project_id"`
	RepoURL   string `json:"repo_url"`
	Branch    string `json:"branch,omitempty"`
	Path      string `json:"path,omitempty"`
	ScanType  string `json:"scan_type"`
}

func (h *Handlers) ScanGitHubRepo(w http.ResponseWriter, r *http.Request) {
	var req ScanGitHubRequest
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

	owner, repo, err := ghpkg.ParseRepoURL(req.RepoURL)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	var mode gemini.ScanMode
	var source schemair.SchemaSource
	switch req.ScanType {
	case "frontend":
		mode = gemini.ScanModeFrontend
		source = schemair.SourceFrontendStatic
	case "backend", "":
		mode = gemini.ScanModeBackend
		source = schemair.SourceBackendStatic
	default:
		respondError(w, http.StatusBadRequest, "Invalid scan_type: must be 'backend' or 'frontend'")
		return
	}

	userID := auth.UserID(r.Context())
	if userID == "" {
		respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	settings, err := h.userSettingsService.Get(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to load user settings")
		return
	}

	var ghClient *gh.Client
	if h.githubAppAuth.IsConfigured() {
		installations, err := h.ghInstallService.List(r.Context(), userID)
		if err == nil {
			for _, inst := range installations {
				client, err := h.githubAppAuth.InstallationClient(inst.InstallationID)
				if err != nil {
					continue
				}

				_, _, err = client.Repositories.Get(r.Context(), owner, repo)
				if err == nil {
					ghClient = client
					break
				}
			}
		}
	}
	if ghClient == nil && settings.GitHubToken != "" {
		ghClient = gh.NewClient(nil).WithAuthToken(settings.GitHubToken)
	}
	if ghClient == nil {
		respondError(w, http.StatusBadRequest, "Connect a GitHub App or add a Personal Access Token in Settings")
		return
	}

	files, language, err := ghpkg.FetchRepoFilesWithClient(r.Context(), ghClient, owner, repo, req.Branch, req.Path)
	if err != nil {
		respondError(w, http.StatusBadRequest, "GitHub fetch failed: "+err.Error())
		return
	}

	var ga *gemini.GeminiAnalyzer
	if settings.GeminiAPIKey != "" {
		model := settings.GeminiModel
		if model == "" {
			model = "gemini-2.5-flash"
		}
		ga = gemini.New(settings.GeminiAPIKey, model)
	}
	if ga == nil {
		var ok bool
		ga, ok = h.analyzer.(*gemini.GeminiAnalyzer)
		if !ok {
			respondError(w, http.StatusBadRequest, "No Gemini API key configured. Add one in Settings.")
			return
		}
	}

	schemas, err := ga.AnalyzeFiles(r.Context(), files, language, mode)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Analysis failed: "+err.Error())
		return
	}

	valSchemas := make([]schemair.SchemaIR, len(schemas))
	for i, s := range schemas {
		s.Source = source
		valSchemas[i] = *s
	}

	if err := h.schemaService.UploadSchemas(r.Context(), projectID, valSchemas); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to upload analyzed schemas")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": fmt.Sprintf("Scanned %s/%s — %d endpoints found", owner, repo, len(schemas)),
		"count":   len(schemas),
	})
}

func (h *Handlers) ListEndpoints(w http.ResponseWriter, r *http.Request) {
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

	endpoints, err := h.endpointService.ListByProject(r.Context(), projectID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list endpoints")
		return
	}

	if endpoints == nil {
		endpoints = []models.Endpoint{}
	}

	respondJSON(w, http.StatusOK, endpoints)
}

func (h *Handlers) GetEndpoint(w http.ResponseWriter, r *http.Request) {
	endpointID, err := uuid.Parse(chi.URLParam(r, "endpointID"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid endpoint ID")
		return
	}

	endpoint := h.requireEndpointAccess(w, r, endpointID)
	if endpoint == nil {
		return
	}

	respondJSON(w, http.StatusOK, endpoint)
}

func (h *Handlers) ComputeDiff(w http.ResponseWriter, r *http.Request) {
	endpointID, err := uuid.Parse(chi.URLParam(r, "endpointID"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid endpoint ID")
		return
	}

	if h.requireEndpointAccess(w, r, endpointID) == nil {
		return
	}

	diff, err := h.diffService.ComputeDiff(r.Context(), endpointID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to compute diff")
		return
	}

	respondJSON(w, http.StatusOK, diff)
}

func (h *Handlers) GetStats(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	projects, err := h.projectService.List(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list projects")
		return
	}

	projectIDs := make([]uuid.UUID, len(projects))
	for i, p := range projects {
		projectIDs[i] = p.ID
	}

	stats, err := h.diffService.ComputeStats(r.Context(), projectIDs)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to compute stats")
		return
	}

	respondJSON(w, http.StatusOK, stats)
}

func (h *Handlers) GetUserSettings(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	if userID == "" {
		respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	settings, err := h.userSettingsService.Get(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get settings")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"gemini_api_key": maskSecret(settings.GeminiAPIKey),
		"gemini_model":   settings.GeminiModel,
		"github_token":   maskSecret(settings.GitHubToken),
	})
}

type SaveUserSettingsRequest struct {
	GeminiAPIKey string `json:"gemini_api_key"`
	GeminiModel  string `json:"gemini_model"`
	GitHubToken  string `json:"github_token"`
}

func (h *Handlers) SaveUserSettings(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	if userID == "" {
		respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	var req SaveUserSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	existing, err := h.userSettingsService.Get(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to retrieve existing settings")
		return
	}
	if existing != nil {
		if strings.HasPrefix(req.GeminiAPIKey, "••") && existing.GeminiAPIKey != "" {
			req.GeminiAPIKey = existing.GeminiAPIKey
		}
		if strings.HasPrefix(req.GitHubToken, "••") && existing.GitHubToken != "" {
			req.GitHubToken = existing.GitHubToken
		}
	}

	if err := h.userSettingsService.Save(r.Context(), userID, req.GeminiAPIKey, req.GeminiModel, req.GitHubToken); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to save settings")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Settings saved"})
}

func (h *Handlers) requireProjectAccess(w http.ResponseWriter, r *http.Request, projectID uuid.UUID) *models.Project {
	userID := auth.UserID(r.Context())
	project, err := h.projectService.GetByID(r.Context(), projectID, userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to verify project access")
		return nil
	}
	if project == nil {
		respondError(w, http.StatusNotFound, "Project not found")
		return nil
	}
	return project
}

func (h *Handlers) requireEndpointAccess(w http.ResponseWriter, r *http.Request, endpointID uuid.UUID) *models.Endpoint {
	endpoint, err := h.endpointService.GetByID(r.Context(), endpointID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get endpoint")
		return nil
	}
	if endpoint == nil {
		respondError(w, http.StatusNotFound, "Endpoint not found")
		return nil
	}
	if h.requireProjectAccess(w, r, endpoint.ProjectID) == nil {
		return nil
	}
	return endpoint
}

func maskSecret(s string) string {
	if len(s) > 4 {
		return "••••••••" + s[len(s)-4:]
	}
	if len(s) > 0 {
		return "••••••••"
	}
	return ""
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("ERROR: failed to encode JSON response: %v", err)
	}
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}
