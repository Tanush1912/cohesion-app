package github

import (
	"context"
	"encoding/base64"
	"fmt"
	"path/filepath"
	"strings"

	gh "github.com/google/go-github/v68/github"

	"github.com/cohesion-api/cohesion_backend/pkg/analyzer/gemini"
)

var skipDirs = map[string]bool{
	"vendor": true, ".git": true, "node_modules": true, "__pycache__": true,
	".venv": true, "venv": true, "dist": true, "build": true, "target": true,
	".idea": true, ".vscode": true, ".next": true, ".nuxt": true,
}

var sourceExtensions = map[string]bool{
	".go": true, ".py": true, ".ts": true, ".js": true, ".java": true,
	".rb": true, ".rs": true, ".php": true, ".cs": true, ".kt": true,
	".ex": true, ".exs": true, ".scala": true, ".swift": true,
}

var languageHints = map[string]string{
	".go": "Go", ".py": "Python", ".ts": "TypeScript", ".js": "JavaScript",
	".java": "Java", ".rb": "Ruby", ".rs": "Rust", ".php": "PHP",
	".cs": "C#", ".kt": "Kotlin", ".ex": "Elixir", ".exs": "Elixir",
	".scala": "Scala", ".swift": "Swift",
}

const maxTotalBytes = 900_000 * 4
const maxFileBytes = 100 * 1024

func isTestFile(path string) bool {
	lower := strings.ToLower(path)
	return strings.HasSuffix(lower, "_test.go") ||
		strings.HasPrefix(filepath.Base(lower), "test_") ||
		strings.HasSuffix(lower, "_test.py") ||
		strings.HasSuffix(lower, ".test.ts") ||
		strings.HasSuffix(lower, ".test.js") ||
		strings.HasSuffix(lower, ".spec.ts") ||
		strings.HasSuffix(lower, ".spec.js") ||
		strings.Contains(lower, "/test/") ||
		strings.Contains(lower, "/tests/") ||
		strings.Contains(lower, "/__tests__/")
}

func inSkippedDir(path string) bool {
	for _, part := range strings.Split(path, "/") {
		if skipDirs[part] {
			return true
		}
	}
	return false
}

func ParseRepoURL(input string) (owner, repo string, err error) {
	input = strings.TrimSpace(input)
	input = strings.TrimSuffix(input, ".git")
	input = strings.TrimSuffix(input, "/")

	if strings.HasPrefix(input, "https://github.com/") || strings.HasPrefix(input, "http://github.com/") {
		parts := strings.Split(strings.TrimPrefix(strings.TrimPrefix(input, "https://"), "http://"), "/")
		if len(parts) >= 3 {
			return parts[1], parts[2], nil
		}
		return "", "", fmt.Errorf("invalid GitHub URL: %s", input)
	}

	if strings.Contains(input, "/") && !strings.Contains(input, "://") {
		parts := strings.SplitN(input, "/", 2)
		if parts[0] != "" && parts[1] != "" {
			return parts[0], parts[1], nil
		}
	}

	return "", "", fmt.Errorf("cannot parse repo from: %s (use owner/repo or https://github.com/owner/repo)", input)
}

func FetchRepoFiles(ctx context.Context, token, owner, repo, branch, subPath string) ([]gemini.SourceFile, string, error) {
	client := gh.NewClient(nil)
	if token != "" {
		client = client.WithAuthToken(token)
	}

	if branch == "" {
		branch = "main"
	}

	ref, _, err := client.Git.GetRef(ctx, owner, repo, "refs/heads/"+branch)
	if err != nil {
		return nil, "", fmt.Errorf("failed to resolve branch %q: %w", branch, err)
	}
	sha := ref.GetObject().GetSHA()

	tree, _, err := client.Git.GetTree(ctx, owner, repo, sha, true)
	if err != nil {
		return nil, "", fmt.Errorf("failed to get repo tree: %w", err)
	}

	subPath = strings.TrimPrefix(strings.TrimSuffix(subPath, "/"), "/")

	type candidate struct {
		path    string
		blobSHA string
		size    int
	}
	var candidates []candidate
	extCount := make(map[string]int)

	for _, entry := range tree.Entries {
		if entry.GetType() != "blob" {
			continue
		}

		path := entry.GetPath()

		if subPath != "" && !strings.HasPrefix(path, subPath+"/") {
			continue
		}

		if inSkippedDir(path) {
			continue
		}

		ext := strings.ToLower(filepath.Ext(path))
		if !sourceExtensions[ext] {
			continue
		}

		if isTestFile(path) {
			continue
		}

		size := entry.GetSize()
		if size > maxFileBytes {
			continue
		}

		extCount[ext]++
		candidates = append(candidates, candidate{
			path:    path,
			blobSHA: entry.GetSHA(),
			size:    size,
		})
	}

	if len(candidates) == 0 {
		return nil, "", fmt.Errorf("no source files found in %s/%s", owner, repo)
	}

	var files []gemini.SourceFile
	totalBytes := 0

	for _, c := range candidates {
		if totalBytes+c.size > maxTotalBytes {
			break
		}

		blob, _, err := client.Git.GetBlob(ctx, owner, repo, c.blobSHA)
		if err != nil {
			continue
		}

		var content string
		switch blob.GetEncoding() {
		case "base64":
			decoded, err := base64.StdEncoding.DecodeString(blob.GetContent())
			if err != nil {
				continue
			}
			content = string(decoded)
		case "utf-8", "":
			content = blob.GetContent()
		default:
			continue
		}

		relPath := c.path
		if subPath != "" {
			relPath = strings.TrimPrefix(c.path, subPath+"/")
		}

		files = append(files, gemini.SourceFile{
			Path:    relPath,
			Content: content,
		})
		totalBytes += len(content)
	}

	language := ""
	maxCount := 0
	for ext, count := range extCount {
		if count > maxCount {
			maxCount = count
			language = languageHints[ext]
		}
	}

	return files, language, nil
}
