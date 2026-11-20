package auth

import (
	"context"
	"net/http"
	"strings"
)

type contextKey string

const (
	ClaimsKey contextKey = "dama_claims"
	UserIDKey contextKey = "dama_user_id"
)

// Middleware validates Bearer JWT when TokenService is configured.
// Without a service (or without Authorization), requests continue as anonymous.
type Middleware struct {
	Tokens   *TokenService
	Revoked  *RevocationList
	Disabled *DisabledStore
}

func (m Middleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") && m.Tokens != nil {
			raw := strings.TrimPrefix(authHeader, "Bearer ")
			if claims, err := m.Tokens.Parse(raw); err == nil {
				if m.Revoked != nil && m.Revoked.IsRevoked(r.Context(), claims.ID) {
					// Treat revoked tokens as anonymous so RequireAuth rejects them.
				} else if m.Disabled != nil && m.Disabled.IsDisabled(r.Context(), claims.UserID) {
					// Soft-deactivated accounts cannot use existing JWTs.
				} else {
					ctx = context.WithValue(ctx, ClaimsKey, claims)
					ctx = context.WithValue(ctx, UserIDKey, claims.UserID)
				}
			}
		}
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func ClaimsFromContext(ctx context.Context) *Claims {
	if v, ok := ctx.Value(ClaimsKey).(*Claims); ok {
		return v
	}
	return nil
}

func UserIDFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(UserIDKey).(string); ok {
		return v
	}
	return ""
}

func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if ClaimsFromContext(r.Context()) == nil {
			writeAuthGateError(w, http.StatusUnauthorized, false)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func RequireRole(roles ...string) func(http.Handler) http.Handler {
	allowed := map[string]struct{}{}
	for _, role := range roles {
		allowed[role] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := ClaimsFromContext(r.Context())
			if claims == nil {
				writeAuthGateError(w, http.StatusUnauthorized, false)
				return
			}
			if _, ok := allowed[claims.Role]; !ok {
				writeAuthGateError(w, http.StatusForbidden, true)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RoleChecker resolves whether a JWT role is allowed (typically from platform_settings).
type RoleChecker interface {
	IsAllowed(role string) bool
}

// RequireRoleChecker enforces roles from a live checker (DB-backed console_roles, etc).
func RequireRoleChecker(check RoleChecker) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := ClaimsFromContext(r.Context())
			if claims == nil {
				writeAuthGateError(w, http.StatusUnauthorized, false)
				return
			}
			if check == nil || !check.IsAllowed(claims.Role) {
				writeAuthGateError(w, http.StatusForbidden, true)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
