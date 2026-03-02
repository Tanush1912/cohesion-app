package diff

import "github.com/cohesion-api/cohesion_backend/pkg/schemair"

type MismatchType string

const (
	MismatchMissing     MismatchType = "missing"
	MismatchTypeDiff    MismatchType = "type_mismatch"
	MismatchOptionality MismatchType = "optionality_mismatch"
	MismatchExtra       MismatchType = "extra_field"
)

type Severity string

const (
	SeverityCritical Severity = "critical"
	SeverityWarning  Severity = "warning"
	SeverityInfo     Severity = "info"
)

type Mismatch struct {
	Path        string                  `json:"path"`
	Type        MismatchType            `json:"type"`
	Description string                  `json:"description"`
	InSources   []schemair.SchemaSource `json:"in_sources"`
	Expected    interface{}             `json:"expected,omitempty"`
	Actual      interface{}             `json:"actual,omitempty"`
	Severity    Severity                `json:"severity"`
	Suggestion  string                  `json:"suggestion,omitempty"`
}

type Result struct {
	Endpoint        string                  `json:"endpoint"`
	Method          string                  `json:"method"`
	SourcesCompared []schemair.SchemaSource `json:"sources_compared"`
	Mismatches      []Mismatch              `json:"mismatches"`
	Status          schemair.MatchStatus    `json:"status"`
	Confidence      *EndpointConfidence     `json:"confidence,omitempty"`
}

type EndpointConfidence struct {
	Score   float64  `json:"score"`
	Factors []string `json:"factors"`
}
