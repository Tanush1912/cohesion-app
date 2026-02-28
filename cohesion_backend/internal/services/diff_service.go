package services

import (
	"context"
	"encoding/json"

	"github.com/cohesion-api/cohesion_backend/internal/models"
	"github.com/cohesion-api/cohesion_backend/internal/repository"
	"github.com/cohesion-api/cohesion_backend/pkg/diff"
	"github.com/cohesion-api/cohesion_backend/pkg/schemair"
	"github.com/google/uuid"
)

type DiffService struct {
	diffRepo     *repository.DiffRepository
	schemaRepo   *repository.SchemaRepository
	endpointRepo *repository.EndpointRepository
	diffEngine   *diff.Engine
}

func NewDiffService(diffRepo *repository.DiffRepository, schemaRepo *repository.SchemaRepository, endpointRepo *repository.EndpointRepository) *DiffService {
	return &DiffService{
		diffRepo:     diffRepo,
		schemaRepo:   schemaRepo,
		endpointRepo: endpointRepo,
		diffEngine:   diff.NewEngine(),
	}
}

func schemasToIR(schemas []models.Schema) []schemair.SchemaIR {
	seen := make(map[string]bool)
	var deduped []models.Schema
	for _, schema := range schemas {
		if seen[schema.Source] {
			continue
		}
		seen[schema.Source] = true
		deduped = append(deduped, schema)
	}

	result := make([]schemair.SchemaIR, 0, len(deduped))
	for _, schema := range deduped {
		var ir schemair.SchemaIR
		data, err := json.Marshal(schema.SchemaData)
		if err != nil {
			continue
		}
		if err := json.Unmarshal(data, &ir); err != nil {
			continue
		}
		if ir.Source == "" {
			ir.Source = schemair.SchemaSource(schema.Source)
		}
		result = append(result, ir)
	}
	return result
}

func (s *DiffService) ComputeDiff(ctx context.Context, endpointID uuid.UUID) (*diff.Result, error) {
	schemas, err := s.schemaRepo.GetByEndpointID(ctx, endpointID)
	if err != nil {
		return nil, err
	}

	endpoint, err := s.endpointRepo.GetByID(ctx, endpointID)
	if err != nil {
		return nil, err
	}

	if len(schemas) < 2 {
		return &diff.Result{
			Endpoint:   endpoint.Path,
			Method:     endpoint.Method,
			Status:     schemair.StatusMatch,
			Mismatches: []diff.Mismatch{},
		}, nil
	}

	schemaIRs := schemasToIR(schemas)
	result := s.diffEngine.Compare(endpoint.Path, endpoint.Method, schemaIRs)

	diffData := map[string]interface{}{
		"endpoint":         result.Endpoint,
		"method":           result.Method,
		"status":           result.Status,
		"mismatches":       result.Mismatches,
		"sources_compared": result.SourcesCompared,
	}

	diffModel := &models.Diff{
		EndpointID:      endpointID,
		DiffData:        diffData,
		SourcesCompared: formatSources(result.SourcesCompared),
	}

	if err := s.diffRepo.Create(ctx, diffModel); err != nil {
		return nil, err
	}

	return result, nil
}

type DiffStats struct {
	Matched    int `json:"matched"`
	Partial    int `json:"partial"`
	Violations int `json:"violations"`
}

func (s *DiffService) ComputeStats(ctx context.Context, projectIDs []uuid.UUID) (*DiffStats, error) {
	stats := &DiffStats{}

	for _, projectID := range projectIDs {
		endpoints, err := s.endpointRepo.GetByProjectWithSchemas(ctx, projectID)
		if err != nil {
			return nil, err
		}

		for _, endpoint := range endpoints {
			sources := make(map[string]bool)
			for _, schema := range endpoint.Schemas {
				sources[schema.Source] = true
			}
			if len(sources) < 2 {
				continue
			}

			schemaIRs := schemasToIR(endpoint.Schemas)
			if len(schemaIRs) < 2 {
				continue
			}

			result := s.diffEngine.Compare(endpoint.Path, endpoint.Method, schemaIRs)
			switch result.Status {
			case schemair.StatusMatch:
				stats.Matched++
			case schemair.StatusPartial:
				stats.Partial++
			case schemair.StatusViolation:
				stats.Violations++
			}
		}
	}
	return stats, nil
}

func (s *DiffService) GetLatestDiff(ctx context.Context, endpointID uuid.UUID) (*models.Diff, error) {
	return s.diffRepo.GetLatestByEndpoint(ctx, endpointID)
}

func formatSources(sources []schemair.SchemaSource) string {
	if len(sources) == 0 {
		return ""
	}
	result := string(sources[0])
	for i := 1; i < len(sources); i++ {
		result += ":" + string(sources[i])
	}
	return result
}
