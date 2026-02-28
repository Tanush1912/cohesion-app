package services

import (
	"context"
	"regexp"

	"github.com/cohesion-api/cohesion_backend/internal/models"
	"github.com/cohesion-api/cohesion_backend/internal/repository"
	"github.com/cohesion-api/cohesion_backend/pkg/schemair"
	"github.com/google/uuid"
)

var pathParamRegex = regexp.MustCompile(`\{[^}]+\}`)

type SchemaService struct {
	schemaRepo   *repository.SchemaRepository
	endpointRepo *repository.EndpointRepository
}

func NewSchemaService(schemaRepo *repository.SchemaRepository, endpointRepo *repository.EndpointRepository) *SchemaService {
	return &SchemaService{
		schemaRepo:   schemaRepo,
		endpointRepo: endpointRepo,
	}
}

type SchemaUploadRequest struct {
	ProjectID uuid.UUID           `json:"project_id"`
	Schemas   []schemair.SchemaIR `json:"schemas"`
}

func (s *SchemaService) UploadSchemas(ctx context.Context, projectID uuid.UUID, schemas []schemair.SchemaIR) error {
	var dbSchemas []models.Schema

	for _, schema := range schemas {
		normalizedPath := s.normalizePath(schema.Endpoint)
		endpoint, err := s.getOrCreateEndpoint(ctx, projectID, normalizedPath, schema.Method)
		if err != nil {
			return err
		}

		schemaData := map[string]interface{}{
			"endpoint": normalizedPath,
			"method":   schema.Method,
			"source":   schema.Source,
			"request":  schema.Request,
			"response": schema.Response,
		}

		dbSchemas = append(dbSchemas, models.Schema{
			EndpointID: endpoint.ID,
			Source:     string(schema.Source),
			SchemaData: schemaData,
		})
	}

	if len(dbSchemas) > 0 {
		return s.schemaRepo.UpsertBatch(ctx, dbSchemas)
	}

	return nil
}

func (s *SchemaService) normalizePath(path string) string {
	if len(path) > 0 && path[0] != '/' {
		path = "/" + path
	}
	if len(path) > 1 && path[len(path)-1] == '/' {
		path = path[:len(path)-1]
	}
	if path == "" {
		path = "/"
	}
	path = pathParamRegex.ReplaceAllString(path, "{}")
	return path
}

func (s *SchemaService) getOrCreateEndpoint(ctx context.Context, projectID uuid.UUID, path, method string) (*models.Endpoint, error) {
	existing, err := s.endpointRepo.GetByPathAndMethod(ctx, projectID, path, method)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}

	endpoint := &models.Endpoint{
		ProjectID: projectID,
		Path:      path,
		Method:    method,
	}

	if err := s.endpointRepo.Upsert(ctx, endpoint); err != nil {
		return nil, err
	}

	return s.endpointRepo.GetByPathAndMethod(ctx, projectID, path, method)
}

func (s *SchemaService) GetByEndpoint(ctx context.Context, endpointID uuid.UUID) ([]models.Schema, error) {
	return s.schemaRepo.GetByEndpointID(ctx, endpointID)
}
