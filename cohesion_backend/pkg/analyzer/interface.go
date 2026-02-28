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

type Registry struct {
	analyzers map[string]Analyzer
}

func NewRegistry() *Registry {
	return &Registry{
		analyzers: make(map[string]Analyzer),
	}
}

func (r *Registry) Register(a Analyzer) {
	key := a.Language() + ":" + a.Framework()
	r.analyzers[key] = a
}

func (r *Registry) Get(language, framework string) (Analyzer, bool) {
	a, ok := r.analyzers[language+":"+framework]
	return a, ok
}

func (r *Registry) List() []Analyzer {
	result := make([]Analyzer, 0, len(r.analyzers))
	for _, a := range r.analyzers {
		result = append(result, a)
	}
	return result
}
