package repository

import (
	"context"
	"time"

	"github.com/cohesion-api/cohesion_backend/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type EndpointRepository struct {
	db *DB
}

func NewEndpointRepository(db *DB) *EndpointRepository {
	return &EndpointRepository{db: db}
}

func (r *EndpointRepository) Upsert(ctx context.Context, endpoint *models.Endpoint) error {
	if endpoint.ID == uuid.Nil {
		endpoint.ID = uuid.New()
	}
	now := time.Now()
	endpoint.UpdatedAt = now

	var returnedID uuid.UUID
	err := r.db.Pool.QueryRow(ctx, `
		INSERT INTO endpoints (id, project_id, path, method, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (project_id, path, method)
		DO UPDATE SET updated_at = EXCLUDED.updated_at
		RETURNING id
	`, endpoint.ID, endpoint.ProjectID, endpoint.Path, endpoint.Method, now, now).Scan(&returnedID)
	if err != nil {
		return err
	}
	endpoint.ID = returnedID
	return nil
}

func (r *EndpointRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Endpoint, error) {
	var endpoint models.Endpoint
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, project_id, path, method, created_at, updated_at
		FROM endpoints WHERE id = $1
	`, id).Scan(&endpoint.ID, &endpoint.ProjectID, &endpoint.Path, &endpoint.Method, &endpoint.CreatedAt, &endpoint.UpdatedAt)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &endpoint, err
}

func (r *EndpointRepository) GetByProjectID(ctx context.Context, projectID uuid.UUID) ([]models.Endpoint, error) {
	rows, err := r.db.Pool.Query(ctx, `
		SELECT id, project_id, path, method, created_at, updated_at
		FROM endpoints WHERE project_id = $1 ORDER BY path, method
	`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var endpoints []models.Endpoint
	for rows.Next() {
		var e models.Endpoint
		if err := rows.Scan(&e.ID, &e.ProjectID, &e.Path, &e.Method, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		endpoints = append(endpoints, e)
	}
	return endpoints, rows.Err()
}

func (r *EndpointRepository) GetByProjectWithSchemas(ctx context.Context, projectID uuid.UUID) ([]models.Endpoint, error) {
	rows, err := r.db.Pool.Query(ctx, `
		SELECT e.id, e.project_id, e.path, e.method, e.created_at, e.updated_at,
		       s.id, s.source, s.schema_data, s.version, s.created_at, s.updated_at
		FROM endpoints e
		LEFT JOIN schemas s ON s.endpoint_id = e.id
		WHERE e.project_id = $1
		ORDER BY e.path, e.method, s.source
	`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	endpointMap := make(map[uuid.UUID]*models.Endpoint)
	var orderedIDs []uuid.UUID

	for rows.Next() {
		var e models.Endpoint
		var schemaID, schemaSource *string
		var schemaData *map[string]interface{}
		var schemaVersion *int
		var schemaCreatedAt, schemaUpdatedAt *time.Time

		if err := rows.Scan(
			&e.ID, &e.ProjectID, &e.Path, &e.Method, &e.CreatedAt, &e.UpdatedAt,
			&schemaID, &schemaSource, &schemaData, &schemaVersion, &schemaCreatedAt, &schemaUpdatedAt,
		); err != nil {
			return nil, err
		}

		if _, exists := endpointMap[e.ID]; !exists {
			e.Schemas = []models.Schema{}
			endpointMap[e.ID] = &e
			orderedIDs = append(orderedIDs, e.ID)
		}

		if schemaID != nil {
			schema := models.Schema{
				ID:         uuid.MustParse(*schemaID),
				EndpointID: e.ID,
				Source:     *schemaSource,
				SchemaData: *schemaData,
				Version:    *schemaVersion,
				CreatedAt:  *schemaCreatedAt,
				UpdatedAt:  *schemaUpdatedAt,
			}
			endpointMap[e.ID].Schemas = append(endpointMap[e.ID].Schemas, schema)
		}
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	endpoints := make([]models.Endpoint, 0, len(orderedIDs))
	for _, id := range orderedIDs {
		endpoints = append(endpoints, *endpointMap[id])
	}

	return endpoints, nil
}

func (r *EndpointRepository) GetByProjectIDsWithSchemas(ctx context.Context, projectIDs []uuid.UUID) ([]models.Endpoint, error) {
	if len(projectIDs) == 0 {
		return nil, nil
	}

	rows, err := r.db.Pool.Query(ctx, `
		SELECT e.id, e.project_id, e.path, e.method, e.created_at, e.updated_at,
		       s.id, s.source, s.schema_data, s.version, s.created_at, s.updated_at
		FROM endpoints e
		LEFT JOIN schemas s ON s.endpoint_id = e.id
		WHERE e.project_id = ANY($1)
		ORDER BY e.path, e.method, s.source
	`, projectIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	endpointMap := make(map[uuid.UUID]*models.Endpoint)
	var orderedIDs []uuid.UUID

	for rows.Next() {
		var e models.Endpoint
		var schemaID, schemaSource *string
		var schemaData *map[string]interface{}
		var schemaVersion *int
		var schemaCreatedAt, schemaUpdatedAt *time.Time

		if err := rows.Scan(
			&e.ID, &e.ProjectID, &e.Path, &e.Method, &e.CreatedAt, &e.UpdatedAt,
			&schemaID, &schemaSource, &schemaData, &schemaVersion, &schemaCreatedAt, &schemaUpdatedAt,
		); err != nil {
			return nil, err
		}

		if _, exists := endpointMap[e.ID]; !exists {
			e.Schemas = []models.Schema{}
			endpointMap[e.ID] = &e
			orderedIDs = append(orderedIDs, e.ID)
		}

		if schemaID != nil {
			schema := models.Schema{
				ID:         uuid.MustParse(*schemaID),
				EndpointID: e.ID,
				Source:     *schemaSource,
				SchemaData: *schemaData,
				Version:    *schemaVersion,
				CreatedAt:  *schemaCreatedAt,
				UpdatedAt:  *schemaUpdatedAt,
			}
			endpointMap[e.ID].Schemas = append(endpointMap[e.ID].Schemas, schema)
		}
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	endpoints := make([]models.Endpoint, 0, len(orderedIDs))
	for _, id := range orderedIDs {
		endpoints = append(endpoints, *endpointMap[id])
	}

	return endpoints, nil
}

func (r *EndpointRepository) UpsertBatch(ctx context.Context, endpoints []*models.Endpoint) error {
	if len(endpoints) == 0 {
		return nil
	}

	now := time.Now()
	batch := &pgx.Batch{}

	for _, ep := range endpoints {
		if ep.ID == uuid.Nil {
			ep.ID = uuid.New()
		}
		ep.UpdatedAt = now
		batch.Queue(`
			INSERT INTO endpoints (id, project_id, path, method, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (project_id, path, method)
			DO UPDATE SET updated_at = EXCLUDED.updated_at
			RETURNING id
		`, ep.ID, ep.ProjectID, ep.Path, ep.Method, now, now)
	}

	br := r.db.Pool.SendBatch(ctx, batch)
	defer br.Close()

	for _, ep := range endpoints {
		var returnedID uuid.UUID
		if err := br.QueryRow().Scan(&returnedID); err != nil {
			return err
		}
		ep.ID = returnedID
	}
	return nil
}

func (r *EndpointRepository) GetByPathAndMethod(ctx context.Context, projectID uuid.UUID, path, method string) (*models.Endpoint, error) {
	var endpoint models.Endpoint
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, project_id, path, method, created_at, updated_at
		FROM endpoints WHERE project_id = $1 AND path = $2 AND method = $3
	`, projectID, path, method).Scan(&endpoint.ID, &endpoint.ProjectID, &endpoint.Path, &endpoint.Method, &endpoint.CreatedAt, &endpoint.UpdatedAt)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &endpoint, err
}
