package diff

import (
	"testing"

	"github.com/cohesion-api/cohesion_backend/pkg/schemair"
)

func TestEngine_Compare(t *testing.T) {
	engine := NewEngine()

	t.Run("Perfect Match", func(t *testing.T) {
		schemas := []schemair.SchemaIR{
			{
				Source:   schemair.SourceBackendStatic,
				Endpoint: "/api/test",
				Method:   "GET",
				Response: map[int]*schemair.ObjectSchema{
					200: {
						Type: "object",
						Fields: map[string]*schemair.Field{
							"id": {Type: "string", Required: true},
						},
					},
				},
			},
			{
				Source:   schemair.SourceFrontendStatic,
				Endpoint: "/api/test",
				Method:   "GET",
				Response: map[int]*schemair.ObjectSchema{
					200: {
						Type: "object",
						Fields: map[string]*schemair.Field{
							"id": {Type: "string", Required: true},
						},
					},
				},
			},
		}

		result := engine.Compare("/api/test", "GET", schemas)
		if result.Status != schemair.StatusMatch {
			t.Errorf("Expected Match, got %v", result.Status)
		}
		if len(result.Mismatches) != 0 {
			t.Errorf("Expected 0 mismatches, got %d", len(result.Mismatches))
		}
		if result.Confidence.Score < 40 {
			t.Errorf("Expected high confidence for 2 sources, got %f", result.Confidence.Score)
		}
	})

	t.Run("Type Mismatch (Critical)", func(t *testing.T) {
		schemas := []schemair.SchemaIR{
			{
				Source: schemair.SourceBackendStatic,
				Response: map[int]*schemair.ObjectSchema{
					200: {Fields: map[string]*schemair.Field{"id": {Type: "string"}}},
				},
			},
			{
				Source: schemair.SourceFrontendStatic,
				Response: map[int]*schemair.ObjectSchema{
					200: {Fields: map[string]*schemair.Field{"id": {Type: "number"}}},
				},
			},
		}

		result := engine.Compare("/api/test", "GET", schemas)
		if result.Status != schemair.StatusViolation {
			t.Errorf("Expected Violation, got %v", result.Status)
		}
		if result.Mismatches[0].Severity != SeverityCritical {
			t.Errorf("Expected Critical severity, got %v", result.Mismatches[0].Severity)
		}
	})
}
