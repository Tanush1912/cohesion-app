package repository

import (
	"context"
	"time"

	"github.com/cohesion-api/cohesion_backend/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type GitHubInstallationRepository struct {
	db *DB
}

func NewGitHubInstallationRepository(db *DB) *GitHubInstallationRepository {
	return &GitHubInstallationRepository{db: db}
}

func (r *GitHubInstallationRepository) ListByClerkUserID(ctx context.Context, clerkUserID string) ([]models.GitHubInstallation, error) {
	rows, err := r.db.Pool.Query(ctx, `
		SELECT id, clerk_user_id, installation_id, github_account_login, github_account_type, created_at, updated_at
		FROM github_installations WHERE clerk_user_id = $1 ORDER BY created_at
	`, clerkUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var installations []models.GitHubInstallation
	for rows.Next() {
		var i models.GitHubInstallation
		if err := rows.Scan(&i.ID, &i.ClerkUserID, &i.InstallationID, &i.GitHubAccountLogin, &i.GitHubAccountType, &i.CreatedAt, &i.UpdatedAt); err != nil {
			return nil, err
		}
		installations = append(installations, i)
	}
	return installations, rows.Err()
}

func (r *GitHubInstallationRepository) Upsert(ctx context.Context, inst *models.GitHubInstallation) error {
	now := time.Now()
	inst.UpdatedAt = now

	if inst.ID == uuid.Nil {
		inst.ID = uuid.New()
		inst.CreatedAt = now
	}

	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO github_installations (id, clerk_user_id, installation_id, github_account_login, github_account_type, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (clerk_user_id, installation_id) DO UPDATE SET
			github_account_login = EXCLUDED.github_account_login,
			github_account_type = EXCLUDED.github_account_type,
			updated_at = EXCLUDED.updated_at
	`, inst.ID, inst.ClerkUserID, inst.InstallationID, inst.GitHubAccountLogin, inst.GitHubAccountType, inst.CreatedAt, inst.UpdatedAt)

	return err
}

func (r *GitHubInstallationRepository) DeleteByInstallationID(ctx context.Context, clerkUserID string, installationID int64) error {
	result, err := r.db.Pool.Exec(ctx, `
		DELETE FROM github_installations WHERE clerk_user_id = $1 AND installation_id = $2
	`, clerkUserID, installationID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
