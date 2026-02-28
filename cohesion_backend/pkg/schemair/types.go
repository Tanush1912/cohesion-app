package schemair

type SchemaSource string

const (
	SourceBackendStatic  SchemaSource = "backend-static"
	SourceFrontendStatic SchemaSource = "frontend-static"
	SourceRuntime        SchemaSource = "runtime-observed"
)

type SchemaIR struct {
	Endpoint string                `json:"endpoint"`
	Method   string                `json:"method"`
	Source   SchemaSource          `json:"source"`
	Request  *ObjectSchema         `json:"request,omitempty"`
	Response map[int]*ObjectSchema `json:"response,omitempty"`
}

type ObjectSchema struct {
	Type   string            `json:"type"`
	Fields map[string]*Field `json:"fields,omitempty"`
	Items  *ObjectSchema     `json:"items,omitempty"`
}

type Field struct {
	Type       string        `json:"type"`
	Required   bool          `json:"required"`
	Nested     *ObjectSchema `json:"nested,omitempty"`
	Confidence float64       `json:"confidence,omitempty"`
	SourceTag  SchemaSource  `json:"source_tag,omitempty"`
}

type MatchStatus string

const (
	StatusMatch     MatchStatus = "match"
	StatusPartial   MatchStatus = "partial"
	StatusViolation MatchStatus = "violation"
)
