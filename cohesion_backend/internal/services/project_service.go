package services

import (
	"context"

	"github.com/cohesion-api/cohesion_backend/internal/models"
	"github.com/cohesion-api/cohesion_backend/internal/repository"
	"github.com/google/uuid"
)

type ProjectService struct {
	projectRepo  *repository.ProjectRepository
	endpointRepo *repository.EndpointRepository
}

func NewProjectService(projectRepo *repository.ProjectRepository, endpointRepo *repository.EndpointRepository) *ProjectService {
	return &ProjectService{
		projectRepo:  projectRepo,
		endpointRepo: endpointRepo,
	}
}

func (s *ProjectService) Create(ctx context.Context, ownerID, name, description string) (*models.Project, error) {
	project := &models.Project{
		OwnerID:     ownerID,
		Name:        name,
		Description: description,
	}

	if err := s.projectRepo.Create(ctx, project); err != nil {
		return nil, err
	}

	return project, nil
}

func (s *ProjectService) GetByID(ctx context.Context, id uuid.UUID, ownerID string) (*models.Project, error) {
	return s.projectRepo.GetByID(ctx, id, ownerID)
}

func (s *ProjectService) List(ctx context.Context, ownerID string) ([]models.Project, error) {
	return s.projectRepo.List(ctx, ownerID)
}

func (s *ProjectService) Delete(ctx context.Context, id uuid.UUID, ownerID string) error {
	return s.projectRepo.Delete(ctx, id, ownerID)
}
