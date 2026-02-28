package repository

import (
	"context"
	"time"

	"github.com/cohesion-api/cohesion_backend/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type ProjectRepository struct {
	db *DB
}

func NewProjectRepository(db *DB) *ProjectRepository {
	return &ProjectRepository{db: db}
}

func (r *ProjectRepository) Create(ctx context.Context, project *models.Project) error {
	project.ID = uuid.New()
	project.CreatedAt = time.Now()
	project.UpdatedAt = time.Now()

	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO projects (id, owner_id, name, description, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, project.ID, project.OwnerID, project.Name, project.Description, project.CreatedAt, project.UpdatedAt)

	return err
}

func (r *ProjectRepository) GetByID(ctx context.Context, id uuid.UUID, ownerID string) (*models.Project, error) {
	var project models.Project
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, owner_id, name, description, created_at, updated_at
		FROM projects WHERE id = $1 AND owner_id = $2
	`, id, ownerID).Scan(&project.ID, &project.OwnerID, &project.Name, &project.Description, &project.CreatedAt, &project.UpdatedAt)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &project, err
}

func (r *ProjectRepository) List(ctx context.Context, ownerID string) ([]models.Project, error) {
	rows, err := r.db.Pool.Query(ctx, `
		SELECT id, owner_id, name, description, created_at, updated_at
		FROM projects WHERE owner_id = $1 ORDER BY created_at DESC
	`, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []models.Project
	for rows.Next() {
		var p models.Project
		if err := rows.Scan(&p.ID, &p.OwnerID, &p.Name, &p.Description, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}
	return projects, rows.Err()
}

func (r *ProjectRepository) Delete(ctx context.Context, id uuid.UUID, ownerID string) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM projects WHERE id = $1 AND owner_id = $2`, id, ownerID)
	return err
}
