package repository

import (
	"context"
	"time"

	"github.com/cohesion-api/cohesion_backend/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type DiffRepository struct {
	db *DB
}

func NewDiffRepository(db *DB) *DiffRepository {
	return &DiffRepository{db: db}
}

const maxDiffsPerEndpoint = 10

func (r *DiffRepository) Create(ctx context.Context, diff *models.Diff) error {
	diff.ID = uuid.New()
	diff.CreatedAt = time.Now()

	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO diffs (id, endpoint_id, diff_data, sources_compared, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`, diff.ID, diff.EndpointID, diff.DiffData, diff.SourcesCompared, diff.CreatedAt)
	if err != nil {
		return err
	}
	_, _ = r.db.Pool.Exec(ctx, `
		DELETE FROM diffs WHERE id IN (
			SELECT id FROM diffs WHERE endpoint_id = $1
			ORDER BY created_at DESC
			OFFSET $2
		)
	`, diff.EndpointID, maxDiffsPerEndpoint)

	return nil
}

func (r *DiffRepository) GetByEndpointID(ctx context.Context, endpointID uuid.UUID) ([]models.Diff, error) {
	rows, err := r.db.Pool.Query(ctx, `
		SELECT id, endpoint_id, diff_data, sources_compared, created_at
		FROM diffs WHERE endpoint_id = $1 ORDER BY created_at DESC
	`, endpointID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var diffs []models.Diff
	for rows.Next() {
		var d models.Diff
		if err := rows.Scan(&d.ID, &d.EndpointID, &d.DiffData, &d.SourcesCompared, &d.CreatedAt); err != nil {
			return nil, err
		}
		diffs = append(diffs, d)
	}
	return diffs, rows.Err()
}

func (r *DiffRepository) GetLatestByEndpoint(ctx context.Context, endpointID uuid.UUID) (*models.Diff, error) {
	var diff models.Diff
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, endpoint_id, diff_data, sources_compared, created_at
		FROM diffs WHERE endpoint_id = $1 ORDER BY created_at DESC LIMIT 1
	`, endpointID).Scan(&diff.ID, &diff.EndpointID, &diff.DiffData, &diff.SourcesCompared, &diff.CreatedAt)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &diff, err
}

func (r *DiffRepository) GetLatestByEndpointIDs(ctx context.Context, endpointIDs []uuid.UUID) (map[uuid.UUID]*models.Diff, error) {
	if len(endpointIDs) == 0 {
		return make(map[uuid.UUID]*models.Diff), nil
	}

	rows, err := r.db.Pool.Query(ctx, `
		SELECT DISTINCT ON (endpoint_id) id, endpoint_id, diff_data, sources_compared, created_at
		FROM diffs WHERE endpoint_id = ANY($1) ORDER BY endpoint_id, created_at DESC
	`, endpointIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[uuid.UUID]*models.Diff)
	for rows.Next() {
		var d models.Diff
		if err := rows.Scan(&d.ID, &d.EndpointID, &d.DiffData, &d.SourcesCompared, &d.CreatedAt); err != nil {
			return nil, err
		}
		result[d.EndpointID] = &d
	}
	return result, rows.Err()
}
