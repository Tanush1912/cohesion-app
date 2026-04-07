package services

import (
	"context"
	"fmt"
	"regexp"

	"github.com/cohesion-api/cohesion_backend/internal/models"
	"github.com/cohesion-api/cohesion_backend/internal/repository"
	"github.com/cohesion-api/cohesion_backend/pkg/schemair"
	"github.com/google/uuid"
)

var pathParamRegex = regexp.MustCompile(`\{[^}]+\}`)

type SchemaService struct {
	db           *repository.DB
	schemaRepo   *repository.SchemaRepository
	endpointRepo *repository.EndpointRepository
}

func NewSchemaService(db *repository.DB, schemaRepo *repository.SchemaRepository, endpointRepo *repository.EndpointRepository) *SchemaService {
	return &SchemaService{
		db:           db,
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

	tx, err := s.db.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	if err := s.endpointRepo.UpsertBatchTx(ctx, tx, uniqueEndpoints); err != nil {
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

	if err := s.schemaRepo.UpsertBatchTx(ctx, tx, dbSchemas); err != nil {
		return err
	}

	return tx.Commit(ctx)
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
