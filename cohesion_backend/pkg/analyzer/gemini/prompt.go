package gemini

import (
	"fmt"
	"strings"
)

// ScanMode determines whether we extract endpoints a server serves (backend)
// or API calls a client makes (frontend).
type ScanMode string

const (
	ScanModeBackend  ScanMode = "backend"
	ScanModeFrontend ScanMode = "frontend"
)

// BuildPrompt builds a backend scan prompt (kept for backwards compatibility).
func BuildPrompt(files []SourceFile, language string) string {
	return BuildPromptForMode(files, language, ScanModeBackend)
}

// BuildPromptForMode dispatches to the appropriate prompt builder based on mode.
func BuildPromptForMode(files []SourceFile, language string, mode ScanMode) string {
	switch mode {
	case ScanModeFrontend:
		return buildFrontendPrompt(files, language)
	default:
		return buildBackendPrompt(files, language)
	}
}

func buildBackendPrompt(files []SourceFile, language string) string {
	var sb strings.Builder

	sb.WriteString(`You are an expert backend code analyzer. Extract ALL HTTP/REST API endpoints from the source code below.

For each endpoint, provide:
- "endpoint": The URL path (use {param} for path parameters, e.g. /users/{id})
- "method": HTTP method in uppercase (GET, POST, PUT, PATCH, DELETE)
- "request": Request body schema (null if no body, e.g. GET requests)
- "response": Response body schemas keyed by status code as strings

For request/response schemas, use this structure:
{
  "type": "object",
  "fields": {
    "field_name": {
      "type": "<type>",
      "required": true/false,
      "confidence": 0.0-1.0
    }
  }
}

For arrays: { "type": "array", "items": { "type": "object", "fields": {...} } }

Valid types: "string", "int", "float", "bool", "object", "array", "any", "uuid", "time"

For nested objects, add a "nested" field:
{
  "type": "object",
  "required": true,
  "confidence": 0.9,
  "nested": { "type": "object", "fields": { ... } }
}

Rules:
- Only extract endpoints that actually exist in the code - do not invent or guess
- Use {param} syntax for path parameters (not :param or <param>)
- Set confidence to 1.0 for fields explicitly defined in code, 0.7-0.9 for inferred fields
- Response keys must be status code strings like "200", "201", "404"
- If you cannot determine the response schema, use {"type": "object"} with no fields
- Include all middleware-injected or framework-standard response patterns you can identify

`)

	if language != "" {
		sb.WriteString(fmt.Sprintf("The primary language is %s.\n\n", language))
	}

	sb.WriteString(`Output a JSON array of endpoint objects. Example:
[
  {
    "endpoint": "/api/users/{id}",
    "method": "GET",
    "request": null,
    "response": {
      "200": {
        "type": "object",
        "fields": {
          "id": {"type": "uuid", "required": true, "confidence": 1.0},
          "name": {"type": "string", "required": true, "confidence": 1.0}
        }
      }
    }
  }
]

Source code files:

`)

	appendFiles(&sb, files)
	return sb.String()
}

func buildFrontendPrompt(files []SourceFile, language string) string {
	var sb strings.Builder

	sb.WriteString(`You are an expert frontend code analyzer. Extract ALL HTTP/REST API calls that this client-side code makes to a backend server.

Look for API calls made via:
- fetch() / Request
- axios.get(), axios.post(), axios.put(), axios.patch(), axios.delete()
- React Query hooks (useQuery, useMutation) that wrap HTTP calls
- SWR hooks (useSWR) that wrap HTTP calls
- Custom API wrapper functions that ultimately call fetch/axios
- Any other HTTP client libraries (ky, got, superagent, etc.)

For each API call, provide:
- "endpoint": The URL path (strip any base URL/domain, convert template literals like ${id} to {id})
- "method": HTTP method in uppercase (GET, POST, PUT, PATCH, DELETE)
- "request": Request body schema (null if no body, e.g. GET requests)
- "response": Response body schemas keyed by status code as strings (use "200" if status is unclear)

For request/response schemas, use this structure:
{
  "type": "object",
  "fields": {
    "field_name": {
      "type": "<type>",
      "required": true/false,
      "confidence": 0.0-1.0
    }
  }
}

For arrays: { "type": "array", "items": { "type": "object", "fields": {...} } }

Valid types: "string", "int", "float", "bool", "object", "array", "any", "uuid", "time"

For nested objects, add a "nested" field:
{
  "type": "object",
  "required": true,
  "confidence": 0.9,
  "nested": { "type": "object", "fields": { ... } }
}

Rules:
- Only extract API calls that actually exist in the code - do not invent or guess
- Strip base URLs and domains (e.g. "https://api.example.com/users" becomes "/users")
- Convert JavaScript template literals to path params: ` + "`" + `/users/${id}` + "`" + ` becomes "/users/{id}"
- Convert string concatenation to path params: "/users/" + id becomes "/users/{id}"
- Use {param} syntax for path parameters
- Set confidence to 1.0 for fields explicitly defined in code, 0.7-0.9 for inferred fields
- Response keys must be status code strings like "200", "201", "404"
- If response type is parsed via .json() but structure is unclear, use {"type": "object"} with no fields
- Deduplicate: if the same endpoint+method is called in multiple places, merge their schemas

`)

	if language != "" {
		sb.WriteString(fmt.Sprintf("The primary language is %s.\n\n", language))
	}

	sb.WriteString(`Output a JSON array of endpoint objects. Example:
[
  {
    "endpoint": "/api/users/{id}",
    "method": "GET",
    "request": null,
    "response": {
      "200": {
        "type": "object",
        "fields": {
          "id": {"type": "uuid", "required": true, "confidence": 1.0},
          "name": {"type": "string", "required": true, "confidence": 0.8}
        }
      }
    }
  }
]

Source code files:

`)

	appendFiles(&sb, files)
	return sb.String()
}

func appendFiles(sb *strings.Builder, files []SourceFile) {
	for _, f := range files {
		sb.WriteString(fmt.Sprintf("=== File: %s ===\n", f.Path))
		sb.WriteString(f.Content)
		sb.WriteString("\n\n")
	}
}
