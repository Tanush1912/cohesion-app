package diff

import (
	"fmt"
	"strings"
	"unicode"

	"github.com/cohesion-api/cohesion_backend/pkg/schemair"
)

type Engine struct{}

func NewEngine() *Engine {
	return &Engine{}
}

var typeCompatGroups = [][]string{
	{"int", "integer", "number", "float"},
	{"bool", "boolean"},
	{"string", "str"},
	{"object", "map"},
	{"array", "list"},
}

var typeCanonical map[string]string

func init() {
	typeCanonical = make(map[string]string)
	for _, group := range typeCompatGroups {
		canon := group[0]
		for _, t := range group {
			typeCanonical[strings.ToLower(t)] = canon
		}
	}
}

func canonicalType(t string) string {
	lower := strings.ToLower(strings.TrimSpace(t))
	if canon, ok := typeCanonical[lower]; ok {
		return canon
	}
	return lower
}

func normalizeFieldName(name string) string {
	name = strings.ReplaceAll(name, "-", "_")

	var result []rune
	runes := []rune(name)
	for i, r := range runes {
		if i > 0 && unicode.IsUpper(r) {
			prev := runes[i-1]
			if unicode.IsLower(prev) || unicode.IsDigit(prev) {
				result = append(result, '_')
			} else if i+1 < len(runes) && unicode.IsLower(runes[i+1]) {
				result = append(result, '_')
			}
		}
		result = append(result, unicode.ToLower(r))
	}
	return string(result)
}

func (e *Engine) Compare(endpoint, method string, schemas []schemair.SchemaIR) *Result {
	result := &Result{
		Endpoint:        endpoint,
		Method:          method,
		SourcesCompared: make([]schemair.SchemaSource, 0, len(schemas)),
		Mismatches:      []Mismatch{},
		Status:          schemair.StatusMatch,
	}

	for _, s := range schemas {
		result.SourcesCompared = append(result.SourcesCompared, s.Source)
	}

	if len(schemas) < 2 {
		result.Confidence = e.calculateConfidence(schemas, nil)
		return result
	}

	result.Mismatches = e.compareSchemas(method, schemas)

	if len(result.Mismatches) == 0 {
		result.Status = schemair.StatusMatch
	} else if e.hasViolations(result.Mismatches) {
		result.Status = schemair.StatusViolation
	} else {
		result.Status = schemair.StatusPartial
	}

	result.Confidence = e.calculateConfidence(schemas, result.Mismatches)

	return result
}

func methodHasRequestBody(method string) bool {
	switch strings.ToUpper(strings.TrimSpace(method)) {
	case "GET", "HEAD", "DELETE", "OPTIONS":
		return false
	default:
		return true
	}
}

func (e *Engine) compareSchemas(method string, schemas []schemair.SchemaIR) []Mismatch {
	var mismatches []Mismatch

	if methodHasRequestBody(method) {
		requestMismatches := e.compareRequests(schemas)
		mismatches = append(mismatches, requestMismatches...)
	}

	responseMismatches := e.compareResponses(schemas)
	mismatches = append(mismatches, responseMismatches...)

	return mismatches
}

type fieldInfo struct {
	originalName string
	typ          string
	required     bool
}

func collectFields(obj *schemair.ObjectSchema, prefix string, source schemair.SchemaSource,
	fieldPresence map[string]map[schemair.SchemaSource]fieldInfo,
) {
	if obj == nil || obj.Fields == nil {
		return
	}
	for fieldName, field := range obj.Fields {
		normalName := normalizeFieldName(fieldName)
		path := prefix + normalName

		if fieldPresence[path] == nil {
			fieldPresence[path] = make(map[schemair.SchemaSource]fieldInfo)
		}
		fieldPresence[path][source] = fieldInfo{
			originalName: fieldName,
			typ:          field.Type,
			required:     field.Required,
		}

		if field.Nested != nil {
			collectFields(field.Nested, path+".", source, fieldPresence)
		}
	}

	if obj.Items != nil {
		collectFields(obj.Items, prefix+"[].", source, fieldPresence)
	}
}

func (e *Engine) compareRequests(schemas []schemair.SchemaIR) []Mismatch {
	fieldPresence := make(map[string]map[schemair.SchemaSource]fieldInfo)

	sourcesWithRequest := 0
	for _, schema := range schemas {
		if schema.Request != nil && schema.Request.Fields != nil {
			sourcesWithRequest++
			collectFields(schema.Request, "request.", schema.Source, fieldPresence)
		}
	}

	if sourcesWithRequest < 2 {
		return nil
	}

	return e.detectMismatches(fieldPresence, schemas, "request")
}

func (e *Engine) compareResponses(schemas []schemair.SchemaIR) []Mismatch {
	var mismatches []Mismatch

	statusCodes := make(map[int]bool)
	for _, schema := range schemas {
		if schema.Response == nil {
			continue
		}
		for code := range schema.Response {
			statusCodes[code] = true
		}
	}

	for code := range statusCodes {
		fieldPresence := make(map[string]map[schemair.SchemaSource]fieldInfo)

		sourcesWithCode := 0
		for _, schema := range schemas {
			if schema.Response == nil {
				continue
			}
			resp, ok := schema.Response[code]
			if !ok || resp == nil {
				continue
			}
			sourcesWithCode++
			prefix := fmt.Sprintf("response.%d.", code)
			collectFields(resp, prefix, schema.Source, fieldPresence)
		}

		if sourcesWithCode < 2 {
			continue
		}

		mismatches = append(mismatches, e.detectMismatches(fieldPresence, schemas, "response")...)
	}

	return mismatches
}

func (e *Engine) detectMismatches(fieldPresence map[string]map[schemair.SchemaSource]fieldInfo, schemas []schemair.SchemaIR, section string) []Mismatch {
	var mismatches []Mismatch

	allSources := make(map[schemair.SchemaSource]bool)
	for _, s := range schemas {
		allSources[s.Source] = true
	}

	for path, sourceMap := range fieldPresence {
		presentSources := make([]schemair.SchemaSource, 0, len(sourceMap))
		for src := range sourceMap {
			presentSources = append(presentSources, src)
		}

		if len(sourceMap) < len(allSources) {
			missingSources := make([]schemair.SchemaSource, 0)
			for source := range allSources {
				if _, ok := sourceMap[source]; !ok {
					missingSources = append(missingSources, source)
				}
			}

			severity := e.missingFieldSeverity(presentSources, missingSources, section)

			mismatches = append(mismatches, Mismatch{
				Path:        path,
				Type:        MismatchMissing,
				Description: fmt.Sprintf("Field missing in: %v (present in: %v)", missingSources, presentSources),
				InSources:   presentSources,
				Severity:    severity,
				Suggestion:  e.missingSuggestion(presentSources, missingSources, section),
			})
		}

		if len(sourceMap) >= 2 {
			var firstCanon string
			var firstSource schemair.SchemaSource
			isFirst := true

			for source, info := range sourceMap {
				canon := canonicalType(info.typ)
				if isFirst {
					firstCanon = canon
					firstSource = source
					isFirst = false
					continue
				}

				if canon != firstCanon {
					mismatches = append(mismatches, Mismatch{
						Path:        path,
						Type:        MismatchTypeDiff,
						Description: fmt.Sprintf("Type mismatch: %s has '%s', %s has '%s'", firstSource, sourceMap[firstSource].typ, source, info.typ),
						Expected:    sourceMap[firstSource].typ,
						Actual:      info.typ,
						InSources:   presentSources,
						Severity:    SeverityCritical,
						Suggestion:  fmt.Sprintf("Align type to '%s' across all sources", sourceMap[firstSource].typ),
					})
				}
			}
		}

		if len(sourceMap) >= 2 {
			var firstReq bool
			var firstSource schemair.SchemaSource
			isFirst := true

			for source, info := range sourceMap {
				if isFirst {
					firstReq = info.required
					firstSource = source
					isFirst = false
					continue
				}

				if info.required != firstReq {
					mismatches = append(mismatches, Mismatch{
						Path:        path,
						Type:        MismatchOptionality,
						Description: fmt.Sprintf("Optionality mismatch: %s=%v, %s=%v", firstSource, firstReq, source, info.required),
						Expected:    firstReq,
						Actual:      info.required,
						InSources:   presentSources,
						Severity:    SeverityWarning,
						Suggestion:  "Consider aligning optionality across sources",
					})
				}
			}
		}
	}

	return mismatches
}

func (e *Engine) missingFieldSeverity(presentIn, missingFrom []schemair.SchemaSource, section string) Severity {
	hasBE := sourceIn(presentIn, schemair.SourceBackendStatic)
	hasFE := sourceIn(presentIn, schemair.SourceFrontendStatic)
	missingBE := sourceIn(missingFrom, schemair.SourceBackendStatic)
	missingFE := sourceIn(missingFrom, schemair.SourceFrontendStatic)

	if section == "response" {
		if hasBE && missingFE {
			return SeverityInfo
		}
		if hasFE && missingBE {
			return SeverityCritical
		}
	}

	if section == "request" {
		if hasFE && missingBE {
			return SeverityInfo
		}
		if hasBE && missingFE {
			return SeverityWarning
		}
	}

	return SeverityWarning
}

func (e *Engine) missingSuggestion(presentIn, missingFrom []schemair.SchemaSource, section string) string {
	sev := e.missingFieldSeverity(presentIn, missingFrom, section)
	switch sev {
	case SeverityInfo:
		return "Extra field — safe to ignore unless you want strict contracts"
	case SeverityWarning:
		return "Field may be expected — verify both sides agree"
	default:
		return "Field is expected but not provided — likely a bug"
	}
}

func sourceIn(sources []schemair.SchemaSource, target schemair.SchemaSource) bool {
	for _, s := range sources {
		if s == target {
			return true
		}
	}
	return false
}

func (e *Engine) hasViolations(mismatches []Mismatch) bool {
	for _, m := range mismatches {
		if m.Severity == SeverityCritical {
			return true
		}
	}
	return false
}

func (e *Engine) calculateConfidence(schemas []schemair.SchemaIR, mismatches []Mismatch) *EndpointConfidence {
	conf := &EndpointConfidence{
		Score:     0,
		Breakdown: make(map[string]float64),
		Factors:   []string{},
	}

	var score float64 = 0
	sources := make(map[schemair.SchemaSource]bool)
	for _, s := range schemas {
		sources[s.Source] = true
	}

	if sources[schemair.SourceBackendStatic] {
		score += 20
		conf.Factors = append(conf.Factors, "Backend static analysis present (+20)")
	}
	if sources[schemair.SourceFrontendStatic] {
		score += 20
		conf.Factors = append(conf.Factors, "Frontend static analysis present (+20)")
	}
	if sources[schemair.SourceRuntime] {
		score += 20
		conf.Factors = append(conf.Factors, "Runtime observation present (+20)")
	}

	for _, m := range mismatches {
		switch m.Severity {
		case SeverityCritical:
			score -= 10
			conf.Factors = append(conf.Factors, fmt.Sprintf("Critical: %s (-10)", m.Path))
		case SeverityWarning:
			score -= 3
			conf.Factors = append(conf.Factors, fmt.Sprintf("Warning: %s (-3)", m.Path))
		}
	}

	if len(schemas) >= 3 {
		score += 20
		conf.Factors = append(conf.Factors, "Triple-source verification active (+20)")
	}

	if score > 100 {
		score = 100
	}
	if score < 0 {
		score = 0
	}

	conf.Score = score
	return conf
}
