package sourcefile

import (
	"path/filepath"
	"strings"
)

var SkipDirs = map[string]bool{
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

var SourceExtensions = map[string]bool{
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

var LanguageHints = map[string]string{
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

func IsTestFile(path string) bool {
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

func InSkippedDir(path string) bool {
	for _, part := range strings.Split(path, "/") {
		if SkipDirs[part] {
			return true
		}
	}
	return false
}
