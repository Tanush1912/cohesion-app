package gemini

import (
	"context"
	"fmt"

	"github.com/cohesion-api/cohesion_backend/pkg/schemair"
)

type GeminiAnalyzer struct {
	apiKey    string
	modelName string
}

func New(apiKey, modelName string) *GeminiAnalyzer {
	return &GeminiAnalyzer{
		apiKey:    apiKey,
		modelName: modelName,
	}
}

func (a *GeminiAnalyzer) Language() string  { return "any" }
func (a *GeminiAnalyzer) Framework() string { return "any" }

func (a *GeminiAnalyzer) Analyze(ctx context.Context, sourcePath string) ([]*schemair.SchemaIR, error) {
	files, language := DiscoverFiles(sourcePath)
	if len(files) == 0 {
		return nil, fmt.Errorf("no source files found in %s", sourcePath)
	}
	return a.AnalyzeFiles(ctx, files, language, ScanModeBackend)
}

func (a *GeminiAnalyzer) AnalyzeFiles(ctx context.Context, files []SourceFile, language string, mode ScanMode) ([]*schemair.SchemaIR, error) {
	if a.apiKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY is not configured")
	}
	if len(files) == 0 {
		return nil, fmt.Errorf("no source files provided")
	}

	prompt := BuildPromptForMode(files, language, mode)

	client, err := NewClient(ctx, a.apiKey, a.modelName)
	if err != nil {
		return nil, fmt.Errorf("failed to create Gemini client: %w", err)
	}
	defer client.Close()

	rawJSON, err := client.Generate(ctx, prompt)
	if err != nil {
		return nil, fmt.Errorf("Gemini analysis failed: %w", err)
	}

	source := schemair.SourceBackendStatic
	if mode == ScanModeFrontend {
		source = schemair.SourceFrontendStatic
	}

	schemas, err := ParseResponse(rawJSON, source)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Gemini response: %w", err)
	}

	return schemas, nil
}
