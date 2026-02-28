package services

import (
	"context"

	"github.com/cohesion-api/cohesion_backend/internal/models"
	"github.com/cohesion-api/cohesion_backend/internal/repository"
	"github.com/google/uuid"
)

type EndpointService struct {
	endpointRepo *repository.EndpointRepository
	schemaRepo   *repository.SchemaRepository
}

func NewEndpointService(endpointRepo *repository.EndpointRepository, schemaRepo *repository.SchemaRepository) *EndpointService {
	return &EndpointService{
		endpointRepo: endpointRepo,
		schemaRepo:   schemaRepo,
	}
}

func (s *EndpointService) GetByID(ctx context.Context, id uuid.UUID) (*models.Endpoint, error) {
	endpoint, err := s.endpointRepo.GetByID(ctx, id)
	if err != nil || endpoint == nil {
		return endpoint, err
	}

	schemas, err := s.schemaRepo.GetByEndpointID(ctx, id)
	if err != nil {
		return nil, err
	}
	endpoint.Schemas = schemas

	return endpoint, nil
}

func (s *EndpointService) ListByProject(ctx context.Context, projectID uuid.UUID) ([]models.Endpoint, error) {
	return s.endpointRepo.GetByProjectWithSchemas(ctx, projectID)
}

func (s *EndpointService) GetOrCreate(ctx context.Context, projectID uuid.UUID, path, method string) (*models.Endpoint, error) {
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

	return endpoint, nil
}
