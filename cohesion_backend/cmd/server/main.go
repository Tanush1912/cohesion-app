package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cohesion-api/cohesion_backend/internal/config"
	"github.com/cohesion-api/cohesion_backend/internal/controlplane"
	"github.com/cohesion-api/cohesion_backend/internal/repository"
	"github.com/cohesion-api/cohesion_backend/internal/services"
	"github.com/cohesion-api/cohesion_backend/pkg/analyzer"
	geminianalyzer "github.com/cohesion-api/cohesion_backend/pkg/analyzer/gemini"
	ghpkg "github.com/cohesion-api/cohesion_backend/pkg/github"
)

func main() {
	cfg := config.Load()

	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err := repository.NewDB(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	projectRepo := repository.NewProjectRepository(db)
	endpointRepo := repository.NewEndpointRepository(db)
	schemaRepo := repository.NewSchemaRepository(db)
	diffRepo := repository.NewDiffRepository(db)
	userSettingsRepo := repository.NewUserSettingsRepository(db)
	ghInstallRepo := repository.NewGitHubInstallationRepository(db)

	projectService := services.NewProjectService(projectRepo, endpointRepo)
	endpointService := services.NewEndpointService(endpointRepo, schemaRepo)
	schemaService := services.NewSchemaService(schemaRepo, endpointRepo)
	diffService := services.NewDiffService(diffRepo, schemaRepo, endpointRepo)
	liveService := services.NewLiveService()
	userSettingsService := services.NewUserSettingsService(userSettingsRepo)
	ghInstallService := services.NewGitHubInstallationService(ghInstallRepo)
	var codeAnalyzer analyzer.Analyzer
	if cfg.GeminiAPIKey != "" {
		codeAnalyzer = geminianalyzer.New(cfg.GeminiAPIKey, cfg.GeminiModel)
	}

	ghAppAuth := ghpkg.NewAppAuth(cfg.GitHubAppID, cfg.GitHubAppPrivateKey)

	svc := &controlplane.Services{
		ProjectService:            projectService,
		EndpointService:           endpointService,
		SchemaService:             schemaService,
		DiffService:               diffService,
		LiveService:               liveService,
		UserSettingsService:       userSettingsService,
		GitHubInstallationService: ghInstallService,
		Analyzer:                  codeAnalyzer,
		GitHubAppAuth:             ghAppAuth,
		GitHubAppSlug:             cfg.GitHubAppSlug,
		FrontendURL:               cfg.FrontendURL,
	}

	router := controlplane.NewRouter(svc)

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("Server starting on port %d", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	ctx, cancel = context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited gracefully")
}
