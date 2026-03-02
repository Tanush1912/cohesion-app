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
	if len(schemas) == 0 {
		return nil
	}

	type epKey struct{ path, method string }
	epMap := make(map[epKey]*models.Endpoint)
	var uniqueEndpoints []*models.Endpoint

	for _, schema := range schemas {
		normalizedPath := s.normalizePath(schema.Endpoint)
		key := epKey{normalizedPath, schema.Method}
		if _, exists := epMap[key]; !exists {
			ep := &models.Endpoint{
				ProjectID: projectID,
				Path:      normalizedPath,
				Method:    schema.Method,
			}
			epMap[key] = ep
			uniqueEndpoints = append(uniqueEndpoints, ep)
		}
	}

	if err := s.endpointRepo.UpsertBatch(ctx, uniqueEndpoints); err != nil {
		return err
	}

	dbSchemas := make([]models.Schema, 0, len(schemas))
	for _, schema := range schemas {
		normalizedPath := s.normalizePath(schema.Endpoint)
		key := epKey{normalizedPath, schema.Method}
		endpoint := epMap[key]

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

	return s.schemaRepo.UpsertBatch(ctx, dbSchemas)
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

func (s *SchemaService) GetByEndpoint(ctx context.Context, endpointID uuid.UUID) ([]models.Schema, error) {
	return s.schemaRepo.GetByEndpointID(ctx, endpointID)
}
