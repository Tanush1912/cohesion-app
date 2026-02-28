package gemini

import (
	"os"
	"path/filepath"
	"sort"
	"strings"

	ignore "github.com/sabhiram/go-gitignore"
)

type SourceFile struct {
	Path    string
	Content string
}

var skipDirs = map[string]bool{
	"vendor":       true,
	".git":         true,
	"node_modules": true,
	"__pycache__":  true,
	".venv":        true,
	"venv":         true,
	"dist":         true,
	"build":        true,
	"target":       true,
	".idea":        true,
	".vscode":      true,
	".next":        true,
	".nuxt":        true,
}

var sourceExtensions = map[string]bool{
	".go":    true,
	".py":    true,
	".ts":    true,
	".js":    true,
	".java":  true,
	".rb":    true,
	".rs":    true,
	".php":   true,
	".cs":    true,
	".kt":    true,
	".ex":    true,
	".exs":   true,
	".scala": true,
	".swift": true,
}

var languageHints = map[string]string{
	".go":    "Go",
	".py":    "Python",
	".ts":    "TypeScript",
	".js":    "JavaScript",
	".java":  "Java",
	".rb":    "Ruby",
	".rs":    "Rust",
	".php":   "PHP",
	".cs":    "C#",
	".kt":    "Kotlin",
	".ex":    "Elixir",
	".exs":   "Elixir",
	".scala": "Scala",
	".swift": "Swift",
}

const maxTokenBudget = 900_000
const bytesPerToken = 4

func filePriority(name string) int {
	lower := strings.ToLower(name)

	p1 := []string{"route", "router", "urls", "api", "endpoint", "path"}
	for _, kw := range p1 {
		if strings.Contains(lower, kw) {
			return 1
		}
	}

	p2 := []string{"handler", "controller", "view", "resource", "middleware"}
	for _, kw := range p2 {
		if strings.Contains(lower, kw) {
			return 2
		}
	}

	p3 := []string{"model", "schema", "dto", "type", "entity", "struct"}
	for _, kw := range p3 {
		if strings.Contains(lower, kw) {
			return 3
		}
	}

	return 4
}

func isTestFile(name string) bool {
	lower := strings.ToLower(name)
	return strings.HasSuffix(lower, "_test.go") ||
		strings.HasPrefix(lower, "test_") ||
		strings.HasSuffix(lower, "_test.py") ||
		strings.HasSuffix(lower, ".test.ts") ||
		strings.HasSuffix(lower, ".test.js") ||
		strings.HasSuffix(lower, ".spec.ts") ||
		strings.HasSuffix(lower, ".spec.js") ||
		strings.Contains(lower, "/test/") ||
		strings.Contains(lower, "/tests/") ||
		strings.Contains(lower, "/__tests__/")
}

type fileEntry struct {
	path     string
	relPath  string
	priority int
}

func rewriteGitIgnoreLineForDir(line, relDir string) string {
	line = strings.TrimRight(line, "\r")
	if relDir == "." || relDir == "" {
		return line
	}

	trimmed := strings.TrimSpace(line)
	if trimmed == "" || strings.HasPrefix(trimmed, "#") {
		return line
	}

	negated := false
	body := line
	if strings.HasPrefix(body, "!") && !strings.HasPrefix(body, `\!`) {
		negated = true
		body = body[1:]
	}

	if body == "" {
		if negated {
			return "!"
		}
		return line
	}

	anchored := strings.HasPrefix(body, "/")
	bodyNoLeadingSlash := strings.TrimPrefix(body, "/")
	containsSlash := strings.Contains(bodyNoLeadingSlash, "/")

	switch {
	case anchored:
		body = relDir + "/" + bodyNoLeadingSlash
	case containsSlash:
		body = relDir + "/" + body
	default:
		body = relDir + "/**/" + body
	}

	if negated {
		return "!" + body
	}
	return body
}

func loadGitIgnoreMatcher(rootPath string) *ignore.GitIgnore {
	var allLines []string

	filepath.Walk(rootPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		if info.IsDir() {
			if skipDirs[info.Name()] {
				return filepath.SkipDir
			}
			return nil
		}

		if info.Name() != ".gitignore" {
			return nil
		}

		relPath, relErr := filepath.Rel(rootPath, path)
		if relErr != nil {
			return nil
		}
		relPath = filepath.ToSlash(relPath)
		relDir := filepath.ToSlash(filepath.Dir(relPath))

		content, readErr := os.ReadFile(path)
		if readErr != nil {
			return nil
		}

		lines := strings.Split(string(content), "\n")
		for _, line := range lines {
			allLines = append(allLines, rewriteGitIgnoreLineForDir(line, relDir))
		}
		return nil
	})

	if len(allLines) == 0 {
		return nil
	}
	return ignore.CompileIgnoreLines(allLines...)
}

func DetectLanguage(files []SourceFile) string {
	extCount := make(map[string]int)
	for _, f := range files {
		ext := strings.ToLower(filepath.Ext(f.Path))
		if languageHints[ext] != "" {
			extCount[ext]++
		}
	}

	language := ""
	maxCount := 0
	for ext, count := range extCount {
		if count > maxCount {
			maxCount = count
			language = languageHints[ext]
		}
	}
	return language
}

func DiscoverFiles(rootPath string) ([]SourceFile, string) {
	var entries []fileEntry
	extCount := make(map[string]int)
	gitIgnoreMatcher := loadGitIgnoreMatcher(rootPath)

	filepath.Walk(rootPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		relPath, relErr := filepath.Rel(rootPath, path)
		if relErr != nil {
			return nil
		}
		relPath = filepath.ToSlash(relPath)

		if info.IsDir() {
			if skipDirs[info.Name()] {
				return filepath.SkipDir
			}
			if relPath != "." && gitIgnoreMatcher != nil && gitIgnoreMatcher.MatchesPath(relPath+"/") {
				return filepath.SkipDir
			}
			return nil
		}

		if gitIgnoreMatcher != nil && gitIgnoreMatcher.MatchesPath(relPath) {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(info.Name()))
		if !sourceExtensions[ext] {
			return nil
		}

		if isTestFile(relPath) {
			return nil
		}

		extCount[ext]++
		entries = append(entries, fileEntry{
			path:     path,
			relPath:  relPath,
			priority: filePriority(info.Name()),
		})

		return nil
	})

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].priority < entries[j].priority
	})

	var files []SourceFile
	totalBytes := 0
	maxBytes := maxTokenBudget * bytesPerToken

	for _, entry := range entries {
		if totalBytes >= maxBytes {
			break
		}

		content, err := os.ReadFile(entry.path)
		if err != nil {
			continue
		}

		if totalBytes+len(content) > maxBytes {
			break
		}

		files = append(files, SourceFile{
			Path:    entry.relPath,
			Content: string(content),
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

	return files, language
}
