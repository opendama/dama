package auth

import (
	"context"
	"net/http"
	"strings"
)

// PermissionChecker resolves whether a role holds a permission key (DB-backed).
type PermissionChecker interface {
	RoleHasPermission(ctx context.Context, role, permission string) (bool, error)
}

// RequireAnyPermission allows the request when the role holds at least one permission.
func RequireAnyPermission(check PermissionChecker, permissions ...string) func(http.Handler) http.Handler {
	perms := append([]string{}, permissions...)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := ClaimsFromContext(r.Context())
			if claims == nil {
				writeAuthGateError(w, http.StatusUnauthorized, false)
				return
			}
			if check == nil || len(perms) == 0 {
				writeAuthGateError(w, http.StatusForbidden, true)
				return
			}
			for _, permission := range perms {
				permission = strings.TrimSpace(permission)
				if permission == "" {
					continue
				}
				ok, err := check.RoleHasPermission(r.Context(), claims.Role, permission)
				if err == nil && ok {
					next.ServeHTTP(w, r)
					return
				}
			}
			writeAuthGateError(w, http.StatusForbidden, true)
		})
	}
}

// RequirePermission enforces a single RBAC permission after auth (fail closed).
func RequirePermission(check PermissionChecker, permission string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := ClaimsFromContext(r.Context())
			if claims == nil {
				writeAuthGateError(w, http.StatusUnauthorized, false)
				return
			}
			if check == nil || permission == "" {
				writeAuthGateError(w, http.StatusForbidden, true)
				return
			}
			ok, err := check.RoleHasPermission(r.Context(), claims.Role, permission)
			if err != nil || !ok {
				writeAuthGateError(w, http.StatusForbidden, true)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
