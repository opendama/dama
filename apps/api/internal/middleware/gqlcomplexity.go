package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"regexp"
	"strings"
)

var identRe = regexp.MustCompile(`[a-zA-Z_][a-zA-Z0-9_]*`)

// GraphQLComplexityReject rejects queries whose estimated field cost exceeds maxCost.
// Complements GraphQLDepthReject for Layer 6 defense.
func GraphQLComplexityReject(maxCost int) func(http.Handler) http.Handler {
	if maxCost <= 0 {
		maxCost = 200
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
				if estimateQueryComplexity(body.Query) > maxCost {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusBadRequest)
					_, _ = w.Write([]byte(`{"errors":[{"message":"query complexity exceeds limit"}]}`))
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

func estimateQueryComplexity(query string) int {
	stripped := stripGQLCommentsAndStrings(query)
	matches := identRe.FindAllString(stripped, -1)
	cost := 0
	for _, name := range matches {
		switch strings.ToLower(name) {
		case "query", "mutation", "subscription", "fragment", "on", "true", "false", "null",
			"int", "float", "string", "boolean", "id", "type", "input", "enum", "interface", "union",
			"schema", "extend", "implements", "directive", "scalar":
			continue
		case "leaderboard", "mycampaigns", "tournaments", "matches":
			cost += 8
		default:
			cost += 1
		}
	}
	return cost
}

func stripGQLCommentsAndStrings(q string) string {
	var b strings.Builder
	inString := false
	escaped := false
	for i := 0; i < len(q); i++ {
		ch := q[i]
		if inString {
			b.WriteByte(ch)
			if escaped {
				escaped = false
				continue
			}
			if ch == '\\' {
				escaped = true
				continue
			}
			if ch == '"' {
				inString = false
			}
			continue
		}
		if ch == '"' {
			inString = true
			b.WriteByte(ch)
			continue
		}
		if ch == '#' {
			for i < len(q) && q[i] != '\n' {
				i++
			}
			continue
		}
		b.WriteByte(ch)
	}
	return b.String()
}
