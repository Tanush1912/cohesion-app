package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/clerk/clerk-sdk-go/v2"
	clerkuser "github.com/clerk/clerk-sdk-go/v2/user"
	"github.com/cohesion-api/cohesion_backend/internal/repository"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

const (
	demoEmail = "demo@cohesion.dev"
	demoName  = "demo cohesion"
	projectName = "acme-api"
)

func main() {
	godotenv.Load()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is required")
	}
	clerkKey := os.Getenv("CLERK_SECRET_KEY")
	if clerkKey == "" {
		log.Fatal("CLERK_SECRET_KEY is required")
	}
	clerk.SetKey(clerkKey)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	ownerID, err := ensureDemoUser(ctx)
	if err != nil {
		log.Fatalf("Failed to ensure demo user: %v", err)
	}
	log.Printf("Demo user ready: %s", ownerID)

	db, err := repository.NewDB(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	projectID, err := ensureDemoProject(ctx, db, ownerID)
	if err != nil {
		log.Fatalf("Failed to ensure demo project: %v", err)
	}
	log.Printf("Demo project ready: %s", projectID)

	if err := seedEndpointsAndSchemas(ctx, db, projectID); err != nil {
		log.Fatalf("Failed to seed endpoints: %v", err)
	}

	log.Println("Demo seed complete.")
}

func ensureDemoUser(ctx context.Context) (string, error) {
	// Try by email first
	list, err := clerkuser.List(ctx, &clerkuser.ListParams{
		EmailAddresses: []string{demoEmail},
	})
	if err != nil {
		return "", fmt.Errorf("list users by email: %w", err)
	}
	if list != nil && len(list.Users) > 0 {
		return list.Users[0].ID, nil
	}

	// Fallback: search by name (for GitHub-only auth where user has no email)
	query := demoName
	list, err = clerkuser.List(ctx, &clerkuser.ListParams{
		Query: &query,
	})
	if err != nil {
		return "", fmt.Errorf("list users by name: %w", err)
	}
	if list != nil && len(list.Users) > 0 {
		return list.Users[0].ID, nil
	}

	// If DEMO_USER_ID is provided directly, use that
	if id := os.Getenv("DEMO_USER_ID"); id != "" {
		return id, nil
	}

	return "", fmt.Errorf("demo user not found — create a user named %q in the Clerk dashboard, or set DEMO_USER_ID", demoName)
}

func ensureDemoProject(ctx context.Context, db *repository.DB, ownerID string) (uuid.UUID, error) {
	var id uuid.UUID
	err := db.Pool.QueryRow(ctx,
		`SELECT id FROM projects WHERE owner_id = $1 AND name = $2`, ownerID, projectName,
	).Scan(&id)
	if err == nil {
		return id, nil
	}

	id = uuid.New()
	now := time.Now()
	_, err = db.Pool.Exec(ctx,
		`INSERT INTO projects (id, owner_id, name, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
		id, ownerID, projectName, "Demo project — a REST API with intentional contract mismatches", now, now,
	)
	return id, err
}

type endpointSeed struct {
	path     string
	method   string
	backend  map[string]interface{}
	frontend map[string]interface{}
}

func seedEndpointsAndSchemas(ctx context.Context, db *repository.DB, projectID uuid.UUID) error {
	seeds := allEndpoints()

	for _, s := range seeds {
		epID, err := upsertEndpoint(ctx, db, projectID, s.path, s.method)
		if err != nil {
			return fmt.Errorf("upsert endpoint %s %s: %w", s.method, s.path, err)
		}

		if err := upsertSchema(ctx, db, epID, "backend-static", s.backend); err != nil {
			return fmt.Errorf("upsert backend schema for %s %s: %w", s.method, s.path, err)
		}

		if s.frontend != nil {
			if err := upsertSchema(ctx, db, epID, "frontend-static", s.frontend); err != nil {
				return fmt.Errorf("upsert frontend schema for %s %s: %w", s.method, s.path, err)
			}
		}
	}
	return nil
}

func upsertEndpoint(ctx context.Context, db *repository.DB, projectID uuid.UUID, path, method string) (uuid.UUID, error) {
	var id uuid.UUID
	now := time.Now()
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO endpoints (id, project_id, path, method, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (project_id, path, method)
		DO UPDATE SET updated_at = EXCLUDED.updated_at
		RETURNING id
	`, uuid.New(), projectID, path, method, now, now).Scan(&id)
	return id, err
}

func upsertSchema(ctx context.Context, db *repository.DB, endpointID uuid.UUID, source string, data map[string]interface{}) error {
	now := time.Now()
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO schemas (id, endpoint_id, source, schema_data, version, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 1, $5, $6)
		ON CONFLICT (endpoint_id, source, version)
		DO UPDATE SET schema_data = EXCLUDED.schema_data, updated_at = EXCLUDED.updated_at
	`, uuid.New(), endpointID, source, data, now, now)
	return err
}

func allEndpoints() []endpointSeed {
	return []endpointSeed{
		// ── Users CRUD ──────────────────────────────────────────

		// 1. POST /api/users — optionality mismatch on "role"
		{
			path:   "/api/users",
			method: "POST",
			backend: sd("/api/users", "POST", "backend-static",
				obj(F{
					"name":  f("string", true),
					"email": f("string", true),
					"role":  f("string", false),
					"phone": f("string", false),
				}),
				obj(F{
					"id":         f("uuid", true),
					"name":       f("string", true),
					"email":      f("string", true),
					"role":       f("string", true),
					"phone":      f("string", false),
					"created_at": f("datetime", true),
				}),
			),
			frontend: sd("/api/users", "POST", "frontend-static",
				obj(F{
					"name":  f("string", true),
					"email": f("string", true),
					"role":  f("string", true),
				}),
				obj(F{
					"id":         f("uuid", true),
					"name":       f("string", true),
					"email":      f("string", true),
					"role":       f("string", true),
					"created_at": f("datetime", true),
				}),
			),
		},

		// 2. GET /api/users — matched, large response
		{
			path:   "/api/users",
			method: "GET",
			backend: sd("/api/users", "GET", "backend-static", nil,
				obj(F{
					"users": f("array", true),
					"total": f("integer", true),
					"page":  f("integer", true),
					"limit": f("integer", true),
				}),
			),
			frontend: sd("/api/users", "GET", "frontend-static", nil,
				obj(F{
					"users": f("array", true),
					"total": f("integer", true),
					"page":  f("integer", true),
					"limit": f("integer", true),
				}),
			),
		},

		// 3. GET /api/users/:id — type mismatch on avatar_url (string vs object), missing bio in frontend
		{
			path:   "/api/users/{}",
			method: "GET",
			backend: sd("/api/users/{}", "GET", "backend-static", nil,
				obj(F{
					"id":         f("uuid", true),
					"name":       f("string", true),
					"email":      f("string", true),
					"avatar_url": f("string", false),
					"bio":        f("string", false),
					"role":       f("string", true),
					"phone":      f("string", false),
					"verified":   f("boolean", true),
					"created_at": f("datetime", true),
					"updated_at": f("datetime", true),
				}),
			),
			frontend: sd("/api/users/{}", "GET", "frontend-static", nil,
				obj(F{
					"id":         f("string", true),
					"name":       f("string", true),
					"email":      f("string", true),
					"avatar_url": f("object", true),
					"role":       f("string", true),
					"verified":   f("boolean", true),
					"created_at": f("string", true),
					"updated_at": f("string", true),
				}),
			),
		},

		// 4. PATCH /api/users/:id — optionality differences
		{
			path:   "/api/users/{}",
			method: "PATCH",
			backend: sd("/api/users/{}", "PATCH", "backend-static",
				obj(F{
					"name":  f("string", false),
					"email": f("string", false),
					"role":  f("string", false),
					"phone": f("string", false),
					"bio":   f("string", false),
				}),
				obj(F{
					"id":         f("uuid", true),
					"name":       f("string", true),
					"email":      f("string", true),
					"role":       f("string", true),
					"updated_at": f("datetime", true),
				}),
			),
			frontend: sd("/api/users/{}", "PATCH", "frontend-static",
				obj(F{
					"name":  f("string", true),
					"email": f("string", true),
					"role":  f("string", false),
					"bio":   f("string", false),
				}),
				obj(F{
					"id":         f("uuid", true),
					"name":       f("string", true),
					"email":      f("string", true),
					"role":       f("string", true),
					"updated_at": f("datetime", true),
				}),
			),
		},

		// 5. DELETE /api/users/:id — matched, minimal
		{
			path:   "/api/users/{}",
			method: "DELETE",
			backend: sd("/api/users/{}", "DELETE", "backend-static", nil,
				obj(F{"message": f("string", true)}),
			),
			frontend: sd("/api/users/{}", "DELETE", "frontend-static", nil,
				obj(F{"message": f("string", true)}),
			),
		},

		// ── Auth ────────────────────────────────────────────────

		// 6. POST /api/auth/login — type mismatch on expires_in (integer vs string)
		{
			path:   "/api/auth/login",
			method: "POST",
			backend: sd("/api/auth/login", "POST", "backend-static",
				obj(F{
					"email":    f("string", true),
					"password": f("string", true),
				}),
				obj(F{
					"access_token":  f("string", true),
					"refresh_token": f("string", true),
					"expires_in":    f("integer", true),
					"token_type":    f("string", true),
					"user_id":       f("uuid", true),
				}),
			),
			frontend: sd("/api/auth/login", "POST", "frontend-static",
				obj(F{
					"email":    f("string", true),
					"password": f("string", true),
				}),
				obj(F{
					"access_token":  f("string", true),
					"refresh_token": f("string", true),
					"expires_in":    f("string", true),
					"token_type":    f("string", true),
					"user_id":       f("string", true),
				}),
			),
		},

		// 7. POST /api/auth/register — matched, large body
		{
			path:   "/api/auth/register",
			method: "POST",
			backend: sd("/api/auth/register", "POST", "backend-static",
				obj(F{
					"email":      f("string", true),
					"password":   f("string", true),
					"first_name": f("string", true),
					"last_name":  f("string", true),
					"org_name":   f("string", false),
				}),
				obj(F{
					"id":            f("uuid", true),
					"email":         f("string", true),
					"first_name":    f("string", true),
					"last_name":     f("string", true),
					"access_token":  f("string", true),
					"refresh_token": f("string", true),
				}),
			),
			frontend: sd("/api/auth/register", "POST", "frontend-static",
				obj(F{
					"email":      f("string", true),
					"password":   f("string", true),
					"first_name": f("string", true),
					"last_name":  f("string", true),
					"org_name":   f("string", false),
				}),
				obj(F{
					"id":            f("uuid", true),
					"email":         f("string", true),
					"first_name":    f("string", true),
					"last_name":     f("string", true),
					"access_token":  f("string", true),
					"refresh_token": f("string", true),
				}),
			),
		},

		// 8. POST /api/auth/refresh — matched
		{
			path:   "/api/auth/refresh",
			method: "POST",
			backend: sd("/api/auth/refresh", "POST", "backend-static",
				obj(F{"refresh_token": f("string", true)}),
				obj(F{
					"access_token":  f("string", true),
					"refresh_token": f("string", true),
					"expires_in":    f("integer", true),
				}),
			),
			frontend: sd("/api/auth/refresh", "POST", "frontend-static",
				obj(F{"refresh_token": f("string", true)}),
				obj(F{
					"access_token":  f("string", true),
					"refresh_token": f("string", true),
					"expires_in":    f("integer", true),
				}),
			),
		},

		// ── Organizations ───────────────────────────────────────

		// 9. POST /api/orgs — missing fields in frontend response
		{
			path:   "/api/orgs",
			method: "POST",
			backend: sd("/api/orgs", "POST", "backend-static",
				obj(F{
					"name":    f("string", true),
					"slug":    f("string", false),
					"plan":    f("string", false),
					"billing": f("object", false),
				}),
				obj(F{
					"id":         f("uuid", true),
					"name":       f("string", true),
					"slug":       f("string", true),
					"plan":       f("string", true),
					"owner_id":   f("uuid", true),
					"created_at": f("datetime", true),
					"seat_count": f("integer", true),
					"max_seats":  f("integer", true),
				}),
			),
			frontend: sd("/api/orgs", "POST", "frontend-static",
				obj(F{
					"name": f("string", true),
					"slug": f("string", false),
				}),
				obj(F{
					"id":         f("uuid", true),
					"name":       f("string", true),
					"slug":       f("string", true),
					"plan":       f("string", true),
					"created_at": f("datetime", true),
				}),
			),
		},

		// 10. GET /api/orgs/:id/members — type mismatch on joined_at
		{
			path:   "/api/orgs/{}/members",
			method: "GET",
			backend: sd("/api/orgs/{}/members", "GET", "backend-static", nil,
				obj(F{
					"members":    f("array", true),
					"total":      f("integer", true),
					"org_id":     f("uuid", true),
					"has_more":   f("boolean", true),
					"next_cursor": f("string", false),
				}),
			),
			frontend: sd("/api/orgs/{}/members", "GET", "frontend-static", nil,
				obj(F{
					"members":  f("array", true),
					"total":    f("string", true),
					"org_id":   f("string", true),
					"has_more": f("boolean", true),
				}),
			),
		},

		// ── Settings ────────────────────────────────────────────

		// 11. PUT /api/settings — fully matched
		{
			path:   "/api/settings",
			method: "PUT",
			backend: sd("/api/settings", "PUT", "backend-static",
				obj(F{
					"theme":              f("string", true),
					"notifications":      f("boolean", true),
					"language":           f("string", true),
					"timezone":           f("string", false),
					"email_digest":       f("boolean", false),
					"two_factor_enabled": f("boolean", false),
				}),
				obj(F{
					"theme":              f("string", true),
					"notifications":      f("boolean", true),
					"language":           f("string", true),
					"timezone":           f("string", true),
					"email_digest":       f("boolean", true),
					"two_factor_enabled": f("boolean", true),
					"updated_at":         f("datetime", true),
				}),
			),
			frontend: sd("/api/settings", "PUT", "frontend-static",
				obj(F{
					"theme":              f("string", true),
					"notifications":      f("boolean", true),
					"language":           f("string", true),
					"timezone":           f("string", false),
					"email_digest":       f("boolean", false),
					"two_factor_enabled": f("boolean", false),
				}),
				obj(F{
					"theme":              f("string", true),
					"notifications":      f("boolean", true),
					"language":           f("string", true),
					"timezone":           f("string", true),
					"email_digest":       f("boolean", true),
					"two_factor_enabled": f("boolean", true),
					"updated_at":         f("datetime", true),
				}),
			),
		},

		// 12. GET /api/settings — matched
		{
			path:   "/api/settings",
			method: "GET",
			backend: sd("/api/settings", "GET", "backend-static", nil,
				obj(F{
					"theme":              f("string", true),
					"notifications":      f("boolean", true),
					"language":           f("string", true),
					"timezone":           f("string", true),
					"email_digest":       f("boolean", true),
					"two_factor_enabled": f("boolean", true),
				}),
			),
			frontend: sd("/api/settings", "GET", "frontend-static", nil,
				obj(F{
					"theme":              f("string", true),
					"notifications":      f("boolean", true),
					"language":           f("string", true),
					"timezone":           f("string", true),
					"email_digest":       f("boolean", true),
					"two_factor_enabled": f("boolean", true),
				}),
			),
		},

		// ── Sessions ────────────────────────────────────────────

		// 13. DELETE /api/sessions — backend only (missing from frontend)
		{
			path:   "/api/sessions",
			method: "DELETE",
			backend: sd("/api/sessions", "DELETE", "backend-static", nil,
				obj(F{"message": f("string", true), "revoked_count": f("integer", true)}),
			),
			frontend: nil,
		},

		// 14. GET /api/sessions — backend only
		{
			path:   "/api/sessions",
			method: "GET",
			backend: sd("/api/sessions", "GET", "backend-static", nil,
				obj(F{
					"sessions":   f("array", true),
					"active":     f("integer", true),
					"last_login": f("datetime", false),
				}),
			),
			frontend: nil,
		},

		// ── Webhooks ────────────────────────────────────────────

		// 15. POST /api/webhooks — large request, type mismatches
		{
			path:   "/api/webhooks",
			method: "POST",
			backend: sd("/api/webhooks", "POST", "backend-static",
				obj(F{
					"url":         f("string", true),
					"events":      f("array", true),
					"secret":      f("string", false),
					"active":      f("boolean", true),
					"description": f("string", false),
					"headers":     f("object", false),
					"retry_count": f("integer", false),
				}),
				obj(F{
					"id":          f("uuid", true),
					"url":         f("string", true),
					"events":      f("array", true),
					"active":      f("boolean", true),
					"secret_hint": f("string", true),
					"created_at":  f("datetime", true),
				}),
			),
			frontend: sd("/api/webhooks", "POST", "frontend-static",
				obj(F{
					"url":         f("string", true),
					"events":      f("array", true),
					"secret":      f("string", false),
					"active":      f("string", true),
					"description": f("string", false),
				}),
				obj(F{
					"id":          f("string", true),
					"url":         f("string", true),
					"events":      f("array", true),
					"active":      f("boolean", true),
					"created_at":  f("string", true),
				}),
			),
		},

		// 16. GET /api/webhooks/{}/deliveries — matched, deep response
		{
			path:   "/api/webhooks/{}/deliveries",
			method: "GET",
			backend: sd("/api/webhooks/{}/deliveries", "GET", "backend-static", nil,
				obj(F{
					"deliveries":    f("array", true),
					"total":         f("integer", true),
					"success_rate":  f("float", true),
					"webhook_id":    f("uuid", true),
					"last_delivery": f("datetime", false),
				}),
			),
			frontend: sd("/api/webhooks/{}/deliveries", "GET", "frontend-static", nil,
				obj(F{
					"deliveries":    f("array", true),
					"total":         f("integer", true),
					"success_rate":  f("float", true),
					"webhook_id":    f("uuid", true),
					"last_delivery": f("datetime", false),
				}),
			),
		},

		// ── Audit Log ───────────────────────────────────────────

		// 17. GET /api/audit-log — missing fields in frontend
		{
			path:   "/api/audit-log",
			method: "GET",
			backend: sd("/api/audit-log", "GET", "backend-static", nil,
				obj(F{
					"entries":    f("array", true),
					"total":      f("integer", true),
					"page":       f("integer", true),
					"per_page":   f("integer", true),
					"has_more":   f("boolean", true),
					"actor_type": f("string", false),
					"ip_address": f("string", false),
				}),
			),
			frontend: sd("/api/audit-log", "GET", "frontend-static", nil,
				obj(F{
					"entries":  f("array", true),
					"total":    f("integer", true),
					"page":     f("integer", true),
					"per_page": f("integer", true),
					"has_more": f("boolean", true),
				}),
			),
		},

		// ── Invitations ─────────────────────────────────────────

		// 18. POST /api/invitations — optionality + missing fields
		{
			path:   "/api/invitations",
			method: "POST",
			backend: sd("/api/invitations", "POST", "backend-static",
				obj(F{
					"email":      f("string", true),
					"role":       f("string", true),
					"org_id":     f("uuid", true),
					"message":    f("string", false),
					"expires_at": f("datetime", false),
				}),
				obj(F{
					"id":         f("uuid", true),
					"email":      f("string", true),
					"role":       f("string", true),
					"org_id":     f("uuid", true),
					"status":     f("string", true),
					"invited_by": f("uuid", true),
					"created_at": f("datetime", true),
					"expires_at": f("datetime", true),
					"token":      f("string", true),
				}),
			),
			frontend: sd("/api/invitations", "POST", "frontend-static",
				obj(F{
					"email":   f("string", true),
					"role":    f("string", false),
					"org_id":  f("string", true),
					"message": f("string", false),
				}),
				obj(F{
					"id":         f("uuid", true),
					"email":      f("string", true),
					"role":       f("string", true),
					"status":     f("string", true),
					"created_at": f("datetime", true),
				}),
			),
		},

		// 19. DELETE /api/invitations/:id — matched, tiny
		{
			path:   "/api/invitations/{}",
			method: "DELETE",
			backend: sd("/api/invitations/{}", "DELETE", "backend-static", nil,
				obj(F{"deleted": f("boolean", true)}),
			),
			frontend: sd("/api/invitations/{}", "DELETE", "frontend-static", nil,
				obj(F{"deleted": f("boolean", true)}),
			),
		},

		// ── File uploads ────────────────────────────────────────

		// 20. POST /api/uploads — type mismatch on size (integer vs string), missing fields
		{
			path:   "/api/uploads",
			method: "POST",
			backend: sd("/api/uploads", "POST", "backend-static",
				obj(F{
					"filename":     f("string", true),
					"content_type": f("string", true),
					"size":         f("integer", true),
					"checksum":     f("string", false),
				}),
				obj(F{
					"id":           f("uuid", true),
					"filename":     f("string", true),
					"content_type": f("string", true),
					"size":         f("integer", true),
					"url":          f("string", true),
					"cdn_url":      f("string", true),
					"thumbnail_url": f("string", false),
					"created_at":   f("datetime", true),
					"expires_at":   f("datetime", false),
					"checksum":     f("string", true),
				}),
			),
			frontend: sd("/api/uploads", "POST", "frontend-static",
				obj(F{
					"filename":     f("string", true),
					"content_type": f("string", true),
					"size":         f("string", true),
				}),
				obj(F{
					"id":           f("string", true),
					"filename":     f("string", true),
					"content_type": f("string", true),
					"size":         f("string", true),
					"url":          f("string", true),
					"created_at":   f("string", true),
				}),
			),
		},
	}
}

// ── helpers ─────────────────────────────────────────────────────

type F map[string]map[string]interface{}

func f(typ string, required bool) map[string]interface{} {
	return map[string]interface{}{
		"type":     typ,
		"required": required,
	}
}

func obj(fields F) map[string]interface{} {
	return map[string]interface{}{
		"type":   "object",
		"fields": fields,
	}
}

func sd(endpoint, method, source string, request, response map[string]interface{}) map[string]interface{} {
	data := map[string]interface{}{
		"endpoint": endpoint,
		"method":   method,
		"source":   source,
	}
	if request != nil {
		data["request"] = request
	}
	if response != nil {
		data["response"] = map[string]interface{}{
			"200": response,
		}
	}
	return data
}
