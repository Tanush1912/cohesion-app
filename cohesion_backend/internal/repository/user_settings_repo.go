package repository

import (
	"context"
	"time"

	"github.com/cohesion-api/cohesion_backend/internal/crypto"
	"github.com/cohesion-api/cohesion_backend/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type UserSettingsRepository struct {
	db *DB
}

func NewUserSettingsRepository(db *DB) *UserSettingsRepository {
	return &UserSettingsRepository{db: db}
}

func (r *UserSettingsRepository) GetByClerkUserID(ctx context.Context, clerkUserID string) (*models.UserSettings, error) {
	var s models.UserSettings
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, clerk_user_id, gemini_api_key, gemini_model, github_token, created_at, updated_at
		FROM user_settings WHERE clerk_user_id = $1
	`, clerkUserID).Scan(&s.ID, &s.ClerkUserID, &s.GeminiAPIKey, &s.GeminiModel, &s.GitHubToken, &s.CreatedAt, &s.UpdatedAt)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if decrypted, err := crypto.Decrypt(s.GeminiAPIKey); err == nil {
		s.GeminiAPIKey = decrypted
	}
	if decrypted, err := crypto.Decrypt(s.GitHubToken); err == nil {
		s.GitHubToken = decrypted
	}

	return &s, nil
}

func (r *UserSettingsRepository) Upsert(ctx context.Context, settings *models.UserSettings) error {
	now := time.Now()
	settings.UpdatedAt = now

	if settings.ID == uuid.Nil {
		settings.ID = uuid.New()
		settings.CreatedAt = now
	}

	encGemini, err := crypto.Encrypt(settings.GeminiAPIKey)
	if err != nil {
		return err
	}
	encGitHub, err := crypto.Encrypt(settings.GitHubToken)
	if err != nil {
		return err
	}

	_, err = r.db.Pool.Exec(ctx, `
		INSERT INTO user_settings (id, clerk_user_id, gemini_api_key, gemini_model, github_token, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (clerk_user_id) DO UPDATE SET
			gemini_api_key = EXCLUDED.gemini_api_key,
			gemini_model = EXCLUDED.gemini_model,
			github_token = EXCLUDED.github_token,
			updated_at = EXCLUDED.updated_at
	`, settings.ID, settings.ClerkUserID, encGemini, settings.GeminiModel, encGitHub, settings.CreatedAt, settings.UpdatedAt)

	return err
}
