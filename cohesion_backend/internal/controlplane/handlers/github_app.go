package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/cohesion-api/cohesion_backend/internal/auth"
	"github.com/go-chi/chi/v5"
)

func (h *Handlers) GitHubAppStatus(w http.ResponseWriter, r *http.Request) {
	configured := h.githubAppAuth.IsConfigured()
	resp := map[string]interface{}{
		"configured": configured,
	}
	if configured && h.githubAppSlug != "" {
		resp["install_url"] = fmt.Sprintf("https://github.com/apps/%s/installations/new", h.githubAppSlug)
	}
	respondJSON(w, http.StatusOK, resp)
}

type SaveInstallationRequest struct {
	InstallationID int64 `json:"installation_id"`
}

func (h *Handlers) SaveGitHubInstallation(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	if userID == "" {
		respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	var req SaveInstallationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.InstallationID == 0 {
		respondError(w, http.StatusBadRequest, "installation_id is required")
		return
	}

	if !h.githubAppAuth.IsConfigured() {
		respondError(w, http.StatusBadRequest, "GitHub App is not configured")
		return
	}

	// Verify the installation exists via the GitHub API
	appClient, err := h.githubAppAuth.AppClient()
	if err != nil {
		log.Printf("Failed to create GitHub App client: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to verify installation")
		return
	}

	installation, _, err := appClient.Apps.GetInstallation(r.Context(), req.InstallationID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid installation — make sure you completed the GitHub App install flow")
		return
	}

	accountLogin := installation.GetAccount().GetLogin()
	accountType := installation.GetAccount().GetType()

	if err := h.ghInstallService.SaveInstallation(r.Context(), userID, req.InstallationID, accountLogin, accountType); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to save installation")
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"message":              "Installation saved",
		"installation_id":      req.InstallationID,
		"github_account_login": accountLogin,
		"github_account_type":  accountType,
	})
}

func (h *Handlers) ListGitHubInstallations(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	if userID == "" {
		respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	installations, err := h.ghInstallService.List(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list installations")
		return
	}

	respondJSON(w, http.StatusOK, installations)
}

func (h *Handlers) RemoveGitHubInstallation(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	if userID == "" {
		respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	installationID, err := strconv.ParseInt(chi.URLParam(r, "installationID"), 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid installation ID")
		return
	}

	if err := h.ghInstallService.Remove(r.Context(), userID, installationID); err != nil {
		respondError(w, http.StatusNotFound, "Installation not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
