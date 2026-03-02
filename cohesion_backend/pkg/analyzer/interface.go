package analyzer

import (
	"context"

	"github.com/cohesion-api/cohesion_backend/pkg/schemair"
)

type Analyzer interface {
	Language() string
	Framework() string
	Analyze(ctx context.Context, sourcePath string) ([]*schemair.SchemaIR, error)
}
