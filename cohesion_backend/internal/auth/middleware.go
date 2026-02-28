package auth

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/jwt"
)

type contextKey string

const userIDKey contextKey = "clerk_user_id"

var clerkInitOnce sync.Once

func initClerk() {
	clerkInitOnce.Do(func() {
		secretKey := os.Getenv("CLERK_SECRET_KEY")
		if secretKey != "" {
			clerk.SetKey(secretKey)
		}
	})
}

func Middleware() func(http.Handler) http.Handler {
	initClerk()
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var token string

			authHeader := r.Header.Get("Authorization")
			if authHeader != "" {
				token = strings.TrimPrefix(authHeader, "Bearer ")
				if token == authHeader {
					if os.Getenv("ENVIRONMENT") == "development" {
						log.Printf("[auth] invalid auth format (no Bearer prefix) for %s %s", r.Method, r.URL.Path)
					}
					http.Error(w, `{"error":"invalid authorization format"}`, http.StatusUnauthorized)
					return
				}
			} else if qToken := r.URL.Query().Get("token"); qToken != "" {
				token = qToken
			} else {
				if os.Getenv("ENVIRONMENT") == "development" {
					log.Printf("[auth] missing Authorization header for %s %s", r.Method, r.URL.Path)
				}
				http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
				return
			}

			claims, err := jwt.Verify(r.Context(), &jwt.VerifyParams{
				Token: token,
			})
			if err != nil {
				if os.Getenv("ENVIRONMENT") == "development" {
					log.Printf("[auth] jwt.Verify failed: %v", err)
				}
				http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), userIDKey, claims.Subject)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func UserID(ctx context.Context) string {
	if id, ok := ctx.Value(userIDKey).(string); ok {
		return id
	}
	return ""
}
