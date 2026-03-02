package services

import (
	"context"

	"github.com/cohesion-api/cohesion_backend/internal/models"
	"github.com/cohesion-api/cohesion_backend/internal/repository"
)

type GitHubInstallationService struct {
	repo *repository.GitHubInstallationRepository
}

func NewGitHubInstallationService(repo *repository.GitHubInstallationRepository) *GitHubInstallationService {
	return &GitHubInstallationService{repo: repo}
}

func (s *GitHubInstallationService) List(ctx context.Context, clerkUserID string) ([]models.GitHubInstallation, error) {
	installations, err := s.repo.ListByClerkUserID(ctx, clerkUserID)
	if err != nil {
		return nil, err
	}
	if installations == nil {
		return []models.GitHubInstallation{}, nil
	}
	return installations, nil
}

func (s *GitHubInstallationService) SaveInstallation(ctx context.Context, clerkUserID string, installationID int64, accountLogin, accountType string) error {
	inst := &models.GitHubInstallation{
		ClerkUserID:        clerkUserID,
		InstallationID:     installationID,
		GitHubAccountLogin: accountLogin,
		GitHubAccountType:  accountType,
	}
	return s.repo.Upsert(ctx, inst)
}

func (s *GitHubInstallationService) Remove(ctx context.Context, clerkUserID string, installationID int64) error {
	return s.repo.DeleteByInstallationID(ctx, clerkUserID, installationID)
}
