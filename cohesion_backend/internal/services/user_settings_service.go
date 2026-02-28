package services

import (
	"context"

	"github.com/cohesion-api/cohesion_backend/internal/models"
	"github.com/cohesion-api/cohesion_backend/internal/repository"
)

type UserSettingsService struct {
	repo *repository.UserSettingsRepository
}

func NewUserSettingsService(repo *repository.UserSettingsRepository) *UserSettingsService {
	return &UserSettingsService{repo: repo}
}

func (s *UserSettingsService) Get(ctx context.Context, clerkUserID string) (*models.UserSettings, error) {
	settings, err := s.repo.GetByClerkUserID(ctx, clerkUserID)
	if err != nil {
		return nil, err
	}
	if settings == nil {
		return &models.UserSettings{
			ClerkUserID: clerkUserID,
		}, nil
	}
	return settings, nil
}

func (s *UserSettingsService) Save(ctx context.Context, clerkUserID, geminiAPIKey, geminiModel, githubToken string) error {
	existing, err := s.repo.GetByClerkUserID(ctx, clerkUserID)
	if err != nil {
		return err
	}

	settings := &models.UserSettings{
		ClerkUserID:  clerkUserID,
		GeminiAPIKey: geminiAPIKey,
		GeminiModel:  geminiModel,
		GitHubToken:  githubToken,
	}
	if existing != nil {
		settings.ID = existing.ID
		settings.CreatedAt = existing.CreatedAt
	}

	return s.repo.Upsert(ctx, settings)
}
