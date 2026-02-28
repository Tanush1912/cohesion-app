package runtime

import "github.com/cohesion-api/cohesion_backend/pkg/schemair"

func InferSchema(requests []CapturedRequest) []*schemair.SchemaIR {
	endpointMap := make(map[string]*schemair.SchemaIR)
	endpointHits := make(map[string]int)

	for _, req := range requests {
		key := req.Method + ":" + req.Path
		endpointHits[key] += req.ObservationCount

		if _, exists := endpointMap[key]; !exists {
			endpointMap[key] = &schemair.SchemaIR{
				Endpoint: req.Path,
				Method:   req.Method,
				Source:   schemair.SourceRuntime,
				Response: make(map[int]*schemair.ObjectSchema),
			}
		}

		schema := endpointMap[key]

		if req.RequestBody != nil {
			if schema.Request == nil {
				schema.Request = inferObjectSchema(req.RequestBody, req.ObservationCount)
			} else {
				mergeObjectSchema(schema.Request, req.RequestBody, req.ObservationCount)
			}
		}

		if req.Response != nil {
			if _, exists := schema.Response[req.StatusCode]; !exists {
				schema.Response[req.StatusCode] = inferObjectSchema(req.Response, req.ObservationCount)
			} else {
				mergeObjectSchema(schema.Response[req.StatusCode], req.Response, req.ObservationCount)
			}
		}
	}

	result := make([]*schemair.SchemaIR, 0, len(endpointMap))
	for key, schema := range endpointMap {
		totalHits := endpointHits[key]
		if schema.Request != nil {
			normalizeConfidence(schema.Request, totalHits)
		}
		for _, res := range schema.Response {
			normalizeConfidence(res, totalHits)
		}
		result = append(result, schema)
	}

	return result
}

func inferObjectSchema(data map[string]interface{}, hits int) *schemair.ObjectSchema {
	schema := &schemair.ObjectSchema{
		Type:   "object",
		Fields: make(map[string]*schemair.Field),
	}

	for key, value := range data {
		field := &schemair.Field{
			Type:       inferType(value),
			Required:   true,
			Confidence: float64(hits),
			SourceTag:  schemair.SourceRuntime,
		}

		if nested, ok := value.(map[string]interface{}); ok {
			field.Nested = inferObjectSchema(nested, hits)
		}

		schema.Fields[key] = field
	}

	return schema
}

func mergeObjectSchema(schema *schemair.ObjectSchema, data map[string]interface{}, hits int) {
	if schema == nil || schema.Fields == nil {
		return
	}

	for key, value := range data {
		if field, exists := schema.Fields[key]; exists {
			field.Confidence += float64(hits)
			if nested, ok := value.(map[string]interface{}); ok && field.Nested != nil {
				mergeObjectSchema(field.Nested, nested, hits)
			}
		} else {
			schema.Fields[key] = &schemair.Field{
				Type:       inferType(value),
				Required:   false,
				Confidence: float64(hits),
				SourceTag:  schemair.SourceRuntime,
			}
			if nested, ok := value.(map[string]interface{}); ok {
				schema.Fields[key].Nested = inferObjectSchema(nested, hits)
			}
		}
	}
}

func normalizeConfidence(schema *schemair.ObjectSchema, totalHits int) {
	if schema == nil || schema.Fields == nil || totalHits == 0 {
		return
	}

	for _, field := range schema.Fields {
		field.Confidence = field.Confidence / float64(totalHits)
		if field.Confidence < 1.0 {
			field.Required = false
		}
		if field.Nested != nil {
			normalizeConfidence(field.Nested, totalHits)
		}
	}
}

func inferType(value interface{}) string {
	switch value.(type) {
	case string:
		return "string"
	case float64, float32, int, int64, int32:
		return "number"
	case bool:
		return "boolean"
	case []interface{}:
		return "array"
	case map[string]interface{}:
		return "object"
	case nil:
		return "null"
	default:
		return "any"
	}
}
