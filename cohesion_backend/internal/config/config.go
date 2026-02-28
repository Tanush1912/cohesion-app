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
}

func Load() *Config {
	godotenv.Load()

	port, _ := strconv.Atoi(getEnv("PORT", "8080"))

	return &Config{
		DatabaseURL:  getEnv("DATABASE_URL", ""),
		Port:         port,
		Environment:  getEnv("ENVIRONMENT", "development"),
		GeminiAPIKey: getEnv("GEMINI_API_KEY", ""),
		GeminiModel:  getEnv("GEMINI_MODEL", "gemini-2.0-flash"),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
