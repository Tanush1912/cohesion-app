package controlplane

import (
	"net/http"

	"github.com/cohesion-api/cohesion_backend/internal/auth"
	"github.com/cohesion-api/cohesion_backend/internal/controlplane/handlers"
	"github.com/cohesion-api/cohesion_backend/internal/services"
	"github.com/cohesion-api/cohesion_backend/pkg/analyzer"
	ghpkg "github.com/cohesion-api/cohesion_backend/pkg/github"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

type Services struct {
	ProjectService            *services.ProjectService
	EndpointService           *services.EndpointService
	SchemaService             *services.SchemaService
	DiffService               *services.DiffService
	LiveService               *services.LiveService
	UserSettingsService       *services.UserSettingsService
	GitHubInstallationService *services.GitHubInstallationService
	Analyzer                  analyzer.Analyzer
	GitHubAppAuth             *ghpkg.AppAuth
	GitHubAppSlug             string
	FrontendURL               string
}

func NewRouter(svc *Services) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	h := handlers.New(
		svc.ProjectService, svc.EndpointService, svc.SchemaService,
		svc.DiffService, svc.LiveService, svc.UserSettingsService,
		svc.GitHubInstallationService, svc.Analyzer,
		svc.GitHubAppAuth, svc.GitHubAppSlug,
	)

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", h.Health)
		r.Group(func(r chi.Router) {
			r.Use(auth.Middleware())
			r.Use(svc.LiveService.SelfCaptureMiddleware(func(r *http.Request) string {
				return auth.UserID(r.Context())
			}))

			r.Route("/projects", func(r chi.Router) {
				r.Post("/", h.CreateProject)
				r.Get("/", h.ListProjects)
				r.Get("/{projectID}", h.GetProject)
				r.Delete("/{projectID}", h.DeleteProject)
			})

			r.Route("/analyze", func(r chi.Router) {
				r.Post("/backend", h.UploadBackendSchemas)
				r.Post("/frontend", h.UploadFrontendSchemas)
				r.Post("/runtime", h.UploadRuntimeSchemas)
				r.Post("/scan", h.ScanCodebase)
				r.Post("/github", h.ScanGitHubRepo)
			})

			r.Route("/endpoints", func(r chi.Router) {
				r.Get("/", h.ListEndpoints)
				r.Get("/{endpointID}", h.GetEndpoint)
			})

			r.Post("/diff/{endpointID}", h.ComputeDiff)
			r.Get("/stats", h.GetStats)

			r.Route("/user", func(r chi.Router) {
				r.Get("/settings", h.GetUserSettings)
				r.Put("/settings", h.SaveUserSettings)
			})

			r.Route("/github", func(r chi.Router) {
				r.Get("/status", h.GitHubAppStatus)
				r.Post("/installations", h.SaveGitHubInstallation)
				r.Get("/installations", h.ListGitHubInstallations)
				r.Delete("/installations/{installationID}", h.RemoveGitHubInstallation)
			})

			r.Route("/live", func(r chi.Router) {
				r.Post("/ingest", h.IngestRuntimeCaptures)
				r.Get("/stream", h.LiveStream)
				r.Get("/requests", h.GetLiveRequests)
				r.Post("/infer", h.InferFromLiveBuffer)
				r.Post("/clear", h.ClearLiveBuffer)
				r.Post("/capture/start", h.StartCapture)
				r.Post("/capture/stop", h.StopCapture)
				r.Post("/diff", h.LiveDiff)
				r.Get("/schemas", h.GetLiveSchemas)
				r.Get("/sources", h.GetLiveSources)
				r.Post("/proxy/configure", h.ConfigureProxy)
				r.HandleFunc("/proxy/{projectID}/{label}/*", h.ProxyHandler)
			})
		})
	})

	return r
}
