package gemini

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"

	"github.com/cohesion-api/cohesion_backend/pkg/schemair"
)

type rawEndpoint struct {
	Endpoint string                        `json:"endpoint"`
	Method   string                        `json:"method"`
	Request  *schemair.ObjectSchema        `json:"request"`
	Response map[string]*schemair.ObjectSchema `json:"response"`
}

var validMethods = map[string]bool{
	"GET": true, "POST": true, "PUT": true, "PATCH": true,
	"DELETE": true, "HEAD": true, "OPTIONS": true,
}

var validTypes = map[string]bool{
	"string": true, "int": true, "float": true, "bool": true,
	"object": true, "array": true, "any": true, "uuid": true, "time": true,
}

func ParseResponse(raw string, source schemair.SchemaSource) ([]*schemair.SchemaIR, error) {
	cleaned := stripCodeFences(raw)

	var endpoints []rawEndpoint
	if err := json.Unmarshal([]byte(cleaned), &endpoints); err != nil {
		return nil, fmt.Errorf("failed to parse Gemini response as JSON: %w", err)
	}

	seen := make(map[string]bool)
	var schemas []*schemair.SchemaIR

	for _, ep := range endpoints {
		ep.Method = strings.ToUpper(strings.TrimSpace(ep.Method))
		ep.Endpoint = strings.TrimSpace(ep.Endpoint)

		if !validateEndpoint(ep) {
			log.Printf("[gemini-parser] dropping invalid endpoint: %s %s", ep.Method, ep.Endpoint)
			continue
		}

		key := ep.Method + ":" + ep.Endpoint
		if seen[key] {
			continue
		}
		seen[key] = true

		schema := &schemair.SchemaIR{
			Endpoint: ep.Endpoint,
			Method:   ep.Method,
			Source:   source,
			Request:  ep.Request,
		}

		if ep.Response != nil {
			schema.Response = make(map[int]*schemair.ObjectSchema)
			for statusStr, obj := range ep.Response {
				code, err := strconv.Atoi(statusStr)
				if err != nil {
					log.Printf("[gemini-parser] invalid status code %q for %s %s, skipping", statusStr, ep.Method, ep.Endpoint)
					continue
				}
				schema.Response[code] = obj
			}
		}

		validateSchema(schema, source)
		schemas = append(schemas, schema)
	}

	if len(schemas) == 0 && len(endpoints) > 0 {
		return nil, fmt.Errorf("all %d extracted endpoints failed validation", len(endpoints))
	}

	return schemas, nil
}

func stripCodeFences(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```json") {
		s = strings.TrimPrefix(s, "```json")
	} else if strings.HasPrefix(s, "```") {
		s = strings.TrimPrefix(s, "```")
	}
	if strings.HasSuffix(s, "```") {
		s = strings.TrimSuffix(s, "```")
	}
	return strings.TrimSpace(s)
}

func validateEndpoint(ep rawEndpoint) bool {
	if ep.Endpoint == "" || !strings.HasPrefix(ep.Endpoint, "/") {
		return false
	}
	if !validMethods[ep.Method] {
		return false
	}
	return true
}

func validateSchema(schema *schemair.SchemaIR, source schemair.SchemaSource) {
	if schema.Request != nil {
		validateObjectSchema(schema.Request, source)
	}
	for _, obj := range schema.Response {
		if obj != nil {
			validateObjectSchema(obj, source)
		}
	}
}

func validateObjectSchema(obj *schemair.ObjectSchema, source schemair.SchemaSource) {
	if obj.Type == "" {
		obj.Type = "object"
	}
	if !validTypes[obj.Type] {
		obj.Type = "object"
	}
	for _, field := range obj.Fields {
		if field.Type == "" {
			field.Type = "any"
		}
		if !validTypes[field.Type] {
			field.Type = "any"
		}
		if field.Confidence == 0 {
			field.Confidence = 0.8
		}
		field.SourceTag = source
		if field.Nested != nil {
			validateObjectSchema(field.Nested, source)
		}
	}
	if obj.Items != nil {
		validateObjectSchema(obj.Items, source)
	}
}
