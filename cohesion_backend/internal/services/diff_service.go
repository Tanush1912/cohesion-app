package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

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

func schemasToIR(schemas []models.Schema) ([]schemair.SchemaIR, []string) {
	seen := make(map[string]bool)
	var deduped []models.Schema
	for _, schema := range schemas {
		if seen[schema.Source] {
			continue
		}
		seen[schema.Source] = true
		deduped = append(deduped, schema)
	}

	var warnings []string
	result := make([]schemair.SchemaIR, 0, len(deduped))
	for _, schema := range deduped {
		var ir schemair.SchemaIR
		data, err := json.Marshal(schema.SchemaData)
		if err != nil {
			log.Printf("WARNING: failed to marshal schema %s (source=%s): %v", schema.ID, schema.Source, err)
			warnings = append(warnings, fmt.Sprintf("Skipped corrupt schema from %s", schema.Source))
			continue
		}
		if err := json.Unmarshal(data, &ir); err != nil {
			log.Printf("WARNING: failed to unmarshal schema %s (source=%s): %v", schema.ID, schema.Source, err)
			warnings = append(warnings, fmt.Sprintf("Skipped unparseable schema from %s", schema.Source))
			continue
		}
		if ir.Source == "" {
			ir.Source = schemair.SchemaSource(schema.Source)
		}
		result = append(result, ir)
	}
	return result, warnings
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

	// Always go through the engine so we get a proper Confidence object
	schemaIRs, _ := schemasToIR(schemas)
	result := s.diffEngine.Compare(endpoint.Path, endpoint.Method, schemaIRs)

	if len(schemaIRs) >= 2 {
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

	if len(projectIDs) == 0 {
		return stats, nil
	}

	endpoints, err := s.endpointRepo.GetByProjectIDsWithSchemas(ctx, projectIDs)
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

		schemaIRs, _ := schemasToIR(endpoint.Schemas)
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
