package models

import (
	"time"

	"github.com/google/uuid"
)

type Project struct {
	ID          uuid.UUID `json:"id"`
	OwnerID     string    `json:"owner_id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Endpoint struct {
	ID        uuid.UUID `json:"id"`
	ProjectID uuid.UUID `json:"project_id"`
	Path      string    `json:"path"`
	Method    string    `json:"method"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Schemas   []Schema  `json:"schemas,omitempty"`
}

type Schema struct {
	ID         uuid.UUID              `json:"id"`
	EndpointID uuid.UUID              `json:"endpoint_id"`
	Source     string                 `json:"source"`
	SchemaData map[string]interface{} `json:"schema_data"`
	Version    int                    `json:"version"`
	CreatedAt  time.Time              `json:"created_at"`
	UpdatedAt  time.Time              `json:"updated_at"`
}

type Diff struct {
	ID              uuid.UUID              `json:"id"`
	EndpointID      uuid.UUID              `json:"endpoint_id"`
	DiffData        map[string]interface{} `json:"diff_data"`
	SourcesCompared string                 `json:"sources_compared"`
	CreatedAt       time.Time              `json:"created_at"`
}

type UserSettings struct {
	ID           uuid.UUID `json:"id"`
	ClerkUserID  string    `json:"clerk_user_id"`
	GeminiAPIKey string    `json:"gemini_api_key"`
	GeminiModel  string    `json:"gemini_model"`
	GitHubToken  string    `json:"github_token"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type GitHubInstallation struct {
	ID                 uuid.UUID `json:"id"`
	ClerkUserID        string    `json:"clerk_user_id"`
	InstallationID     int64     `json:"installation_id"`
	GitHubAccountLogin string    `json:"github_account_login"`
	GitHubAccountType  string    `json:"github_account_type"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}
