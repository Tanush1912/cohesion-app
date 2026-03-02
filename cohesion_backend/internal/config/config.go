package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL  string
	Port         int
	Environment  string
	GeminiAPIKey string
	GeminiModel  string

	GitHubAppID           int64
	GitHubAppPrivateKey   []byte
	GitHubAppClientID     string
	GitHubAppClientSecret string
	GitHubAppSlug         string
	FrontendURL           string
}

func Load() *Config {
	godotenv.Load()

	port, _ := strconv.Atoi(getEnv("PORT", "8080"))
	appID, _ := strconv.ParseInt(getEnv("GITHUB_APP_ID", "0"), 10, 64)

	var privateKey []byte
	if path := getEnv("GITHUB_APP_PRIVATE_KEY_PATH", ""); path != "" {
		privateKey, _ = os.ReadFile(path)
	}

	return &Config{
		DatabaseURL:  getEnv("DATABASE_URL", ""),
		Port:         port,
		Environment:  getEnv("ENVIRONMENT", "development"),
		GeminiAPIKey: getEnv("GEMINI_API_KEY", ""),
		GeminiModel:  getEnv("GEMINI_MODEL", "gemini-2.0-flash"),

		GitHubAppID:           appID,
		GitHubAppPrivateKey:   privateKey,
		GitHubAppClientID:     getEnv("GITHUB_APP_CLIENT_ID", ""),
		GitHubAppClientSecret: getEnv("GITHUB_APP_CLIENT_SECRET", ""),
		GitHubAppSlug:         getEnv("GITHUB_APP_SLUG", ""),
		FrontendURL:           getEnv("FRONTEND_URL", "http://localhost:3000"),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
