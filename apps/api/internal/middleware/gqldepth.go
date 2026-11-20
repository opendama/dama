package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

// GraphQLDepthReject rejects POST bodies whose query nesting exceeds maxDepth.
// Lightweight defense for Layer 6 without a full AST parser dependency.
func GraphQLDepthReject(maxDepth int) func(http.Handler) http.Handler {
	if maxDepth <= 0 {
		maxDepth = 12
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodPost {
				next.ServeHTTP(w, r)
				return
			}
			raw, err := io.ReadAll(r.Body)
			if err != nil {
				http.Error(w, `{"errors":[{"message":"invalid body"}]}`, http.StatusBadRequest)
				return
			}
			r.Body = io.NopCloser(bytes.NewReader(raw))

			var body struct {
				Query string `json:"query"`
			}
			if err := json.Unmarshal(raw, &body); err == nil && body.Query != "" {
				if estimateBraceDepth(body.Query) > maxDepth {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusBadRequest)
					_, _ = w.Write([]byte(`{"errors":[{"message":"query depth exceeds limit"}]}`))
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

func estimateBraceDepth(query string) int {
	depth := 0
	max := 0
	inString := false
	escaped := false
	for _, r := range query {
		if inString {
			if escaped {
				escaped = false
				continue
			}
			if r == '\\' {
				escaped = true
				continue
			}
			if r == '"' {
				inString = false
			}
			continue
		}
		switch r {
		case '"':
			inString = true
		case '{':
			depth++
			if depth > max {
				max = depth
			}
		case '}':
			if depth > 0 {
				depth--
			}
		}
	}
	// Ignore operation wrapper noise like "query { ... }"
	_ = strings.TrimSpace(query)
	return max
}
