package repository

import (
	"context"
	"time"

	"github.com/cohesion-api/cohesion_backend/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type SchemaRepository struct {
	db *DB
}

func NewSchemaRepository(db *DB) *SchemaRepository {
	return &SchemaRepository{db: db}
}

func (r *SchemaRepository) Upsert(ctx context.Context, schema *models.Schema) error {
	if schema.ID == uuid.Nil {
		schema.ID = uuid.New()
	}
	schema.CreatedAt = time.Now()
	schema.UpdatedAt = time.Now()
	if schema.Version == 0 {
		schema.Version = 1
	}

	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO schemas (id, endpoint_id, source, schema_data, version, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (endpoint_id, source, version) 
		DO UPDATE SET schema_data = EXCLUDED.schema_data, updated_at = EXCLUDED.updated_at
	`, schema.ID, schema.EndpointID, schema.Source, schema.SchemaData, schema.Version, schema.CreatedAt, schema.UpdatedAt)

	return err
}

func (r *SchemaRepository) UpsertBatch(ctx context.Context, schemas []models.Schema) error {
	batch := &pgx.Batch{}

	for i := range schemas {
		if schemas[i].ID == uuid.Nil {
			schemas[i].ID = uuid.New()
		}
		schemas[i].CreatedAt = time.Now()
		schemas[i].UpdatedAt = time.Now()
		if schemas[i].Version == 0 {
			schemas[i].Version = 1
		}

		batch.Queue(`
			INSERT INTO schemas (id, endpoint_id, source, schema_data, version, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (endpoint_id, source, version) 
			DO UPDATE SET schema_data = EXCLUDED.schema_data, updated_at = EXCLUDED.updated_at
		`, schemas[i].ID, schemas[i].EndpointID, schemas[i].Source, schemas[i].SchemaData, schemas[i].Version, schemas[i].CreatedAt, schemas[i].UpdatedAt)
	}

	results := r.db.Pool.SendBatch(ctx, batch)
	defer results.Close()

	for range schemas {
		if _, err := results.Exec(); err != nil {
			return err
		}
	}

	return nil
}

func (r *SchemaRepository) GetByEndpointID(ctx context.Context, endpointID uuid.UUID) ([]models.Schema, error) {
	rows, err := r.db.Pool.Query(ctx, `
		SELECT id, endpoint_id, source, schema_data, version, created_at, updated_at
		FROM schemas WHERE endpoint_id = $1 ORDER BY source, version DESC
	`, endpointID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schemas []models.Schema
	for rows.Next() {
		var s models.Schema
		if err := rows.Scan(&s.ID, &s.EndpointID, &s.Source, &s.SchemaData, &s.Version, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		schemas = append(schemas, s)
	}
	return schemas, rows.Err()
}

func (r *SchemaRepository) GetByEndpointIDs(ctx context.Context, endpointIDs []uuid.UUID) (map[uuid.UUID][]models.Schema, error) {
	if len(endpointIDs) == 0 {
		return make(map[uuid.UUID][]models.Schema), nil
	}

	rows, err := r.db.Pool.Query(ctx, `
		SELECT id, endpoint_id, source, schema_data, version, created_at, updated_at
		FROM schemas WHERE endpoint_id = ANY($1) ORDER BY endpoint_id, source, version DESC
	`, endpointIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[uuid.UUID][]models.Schema)
	for rows.Next() {
		var s models.Schema
		if err := rows.Scan(&s.ID, &s.EndpointID, &s.Source, &s.SchemaData, &s.Version, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		result[s.EndpointID] = append(result[s.EndpointID], s)
	}
	return result, rows.Err()
}

func (r *SchemaRepository) GetByEndpointAndSource(ctx context.Context, endpointID uuid.UUID, source string) (*models.Schema, error) {
	var schema models.Schema
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, endpoint_id, source, schema_data, version, created_at, updated_at
		FROM schemas WHERE endpoint_id = $1 AND source = $2 ORDER BY version DESC LIMIT 1
	`, endpointID, source).Scan(&schema.ID, &schema.EndpointID, &schema.Source, &schema.SchemaData, &schema.Version, &schema.CreatedAt, &schema.UpdatedAt)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &schema, err
}
