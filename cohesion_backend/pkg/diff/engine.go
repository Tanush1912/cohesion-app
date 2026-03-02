package diff

import (
	"fmt"
	"sort"
	"strings"
	"unicode"

	"github.com/cohesion-api/cohesion_backend/pkg/schemair"
)

type Engine struct{}

func NewEngine() *Engine {
	return &Engine{}
}

var typeCompatGroups = [][]string{
	{"int", "integer"},
	{"float", "double"},
	{"bool", "boolean"},
	{"string", "str"},
	{"object", "map"},
	{"array", "list"},
}

var typeSubtypes = map[string]string{
	"uuid":      "string",
	"date":      "string",
	"datetime":  "string",
	"date-time": "string",
	"uri":       "string",
	"email":     "string",
	"time":      "string",
	"timestamp": "string",

	"int":     "number",
	"integer": "number",
	"int32":   "int",
	"int64":   "int",
	"float":   "number",
	"float64": "float",
	"float32": "float",
	"double":  "number",
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

func wireType(t string) string {
	lower := strings.ToLower(strings.TrimSpace(t))
	if parent, ok := typeSubtypes[lower]; ok {
		return wireType(parent)
	}
	return canonicalType(lower)
}

func numericGroup(t string) string {
	lower := strings.ToLower(strings.TrimSpace(t))
	if canon, ok := typeCanonical[lower]; ok {
		if canon == "int" || canon == "float" {
			return canon
		}
	}
	if parent, ok := typeSubtypes[lower]; ok {
		return numericGroup(parent)
	}
	return ""
}

func areSubtypeCompatible(typeA, typeB string) bool {
	a := strings.ToLower(strings.TrimSpace(typeA))
	b := strings.ToLower(strings.TrimSpace(typeB))
	groupA, groupB := numericGroup(a), numericGroup(b)
	if groupA != "" && groupB != "" && groupA != groupB {
		return false
	}

	_, aIsSub := typeSubtypes[a]
	_, bIsSub := typeSubtypes[b]
	if !aIsSub && !bIsSub {
		return false
	}
	return wireType(a) == wireType(b)
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

func sortedSources(m map[schemair.SchemaSource]fieldInfo) []schemair.SchemaSource {
	keys := make([]schemair.SchemaSource, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool { return string(keys[i]) < string(keys[j]) })
	return keys
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
	if obj == nil {
		return
	}

	for fieldName, field := range obj.Fields {
		if field == nil {
			continue
		}
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

	var contributingSources []schemair.SchemaSource
	for _, schema := range schemas {
		if schema.Request != nil && (schema.Request.Fields != nil || schema.Request.Items != nil) {
			contributingSources = append(contributingSources, schema.Source)
			collectFields(schema.Request, "request.", schema.Source, fieldPresence)
		}
	}

	if len(contributingSources) < 2 {
		return nil
	}

	return e.detectMismatches(fieldPresence, contributingSources, "request")
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

		var contributingSources []schemair.SchemaSource
		for _, schema := range schemas {
			if schema.Response == nil {
				continue
			}
			resp, ok := schema.Response[code]
			if !ok || resp == nil {
				continue
			}
			contributingSources = append(contributingSources, schema.Source)
			prefix := fmt.Sprintf("response.%d.", code)
			collectFields(resp, prefix, schema.Source, fieldPresence)
		}

		if len(contributingSources) < 2 {
			continue
		}

		mismatches = append(mismatches, e.detectMismatches(fieldPresence, contributingSources, "response")...)
	}

	return mismatches
}

func (e *Engine) detectMismatches(fieldPresence map[string]map[schemair.SchemaSource]fieldInfo, contributingSources []schemair.SchemaSource, section string) []Mismatch {
	var mismatches []Mismatch

	allSources := make(map[schemair.SchemaSource]bool, len(contributingSources))
	for _, s := range contributingSources {
		allSources[s] = true
	}

	paths := make([]string, 0, len(fieldPresence))
	for p := range fieldPresence {
		paths = append(paths, p)
	}
	sort.Strings(paths)

	for _, path := range paths {
		sourceMap := fieldPresence[path]
		presentSources := sortedSources(sourceMap)

		if len(sourceMap) < len(allSources) {
			missingSources := make([]schemair.SchemaSource, 0)
			for _, source := range contributingSources {
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
			sources := sortedSources(sourceMap)
			seen := make(map[string]bool)
			for i := 0; i < len(sources); i++ {
				for j := i + 1; j < len(sources); j++ {
					srcA, srcB := sources[i], sources[j]
					infoA, infoB := sourceMap[srcA], sourceMap[srcB]
					canonA, canonB := canonicalType(infoA.typ), canonicalType(infoB.typ)

					if canonA == canonB {
						continue
					}

					pairKey := canonA + ":" + canonB
					if canonA > canonB {
						pairKey = canonB + ":" + canonA
					}
					if seen[pairKey] {
						continue
					}
					seen[pairKey] = true

					severity := SeverityCritical
					suggestion := fmt.Sprintf("Align type to '%s' across all sources", infoA.typ)

					if areSubtypeCompatible(infoA.typ, infoB.typ) {
						severity = SeverityInfo
						suggestion = fmt.Sprintf("'%s' and '%s' are wire-compatible (both serialize as %s in JSON)", infoA.typ, infoB.typ, wireType(infoA.typ))
					}

					mismatches = append(mismatches, Mismatch{
						Path:        path,
						Type:        MismatchTypeDiff,
						Description: fmt.Sprintf("Type mismatch: %s has '%s', %s has '%s'", srcA, infoA.typ, srcB, infoB.typ),
						Expected:    infoA.typ,
						Actual:      infoB.typ,
						InSources:   presentSources,
						Severity:    severity,
						Suggestion:  suggestion,
					})
				}
			}
		}

		if len(sourceMap) >= 2 {
			sources := sortedSources(sourceMap)
			refSource := sources[0]
			refReq := sourceMap[refSource].required

			for _, src := range sources[1:] {
				if sourceMap[src].required != refReq {
					mismatches = append(mismatches, Mismatch{
						Path:        path,
						Type:        MismatchOptionality,
						Description: fmt.Sprintf("Optionality mismatch: %s=%v, %s=%v", refSource, refReq, src, sourceMap[src].required),
						Expected:    refReq,
						Actual:      sourceMap[src].required,
						InSources:   presentSources,
						Severity:    SeverityWarning,
						Suggestion:  "Consider aligning optionality across sources",
					})
					break
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
		Score:   0,
		Factors: []string{},
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
