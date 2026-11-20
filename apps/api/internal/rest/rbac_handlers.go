package rest

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/store"
	"github.com/go-chi/chi/v5"
)

type RBACAPI struct {
	RBAC     *store.RBACStore
	Users    *store.UserStore
	Settings *store.SettingsStore
	Audit    *store.AuditStore
}

func (a *RBACAPI) Snapshot(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil || a.Settings.ClientEnums().Source != "database" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "client enums unavailable"})
		return
	}
	perms, err := a.RBAC.ListPermissions(r.Context())
	if err != nil {
		writeClientError(w, http.StatusInternalServerError, "unable to load permissions")
		return
	}
	grants, err := a.RBAC.ListRolePermissions(r.Context())
	if err != nil {
		writeClientError(w, http.StatusInternalServerError, "unable to load role grants")
		return
	}
	chrome := a.Settings.RBACChrome()
	if chrome.Source != "database" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "rbac chrome unavailable"})
		return
	}
	enums := a.Settings.ClientEnums()
	writeJSON(w, http.StatusOK, map[string]any{
		"roles":            enums.Roles,
		"console_roles":    enums.ConsoleRoles,
		"publisher_roles":  enums.PublisherRoles,
		"default_role":     enums.DefaultRole,
		"permissions":      perms,
		"role_permissions": grants,
		"chrome":           chrome,
	})
}

type upsertPermissionBody struct {
	Key         string `json:"key"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

func (a *RBACAPI) UpsertPermission(w http.ResponseWriter, r *http.Request) {
	var body upsertPermissionBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	p, err := a.RBAC.UpsertPermission(r.Context(), body.Key, body.Title, body.Description)
	if err != nil {
		writeClientError(w, http.StatusBadRequest, "unable to save permission")
		return
	}
	if a.Audit != nil {
		actor := auth.UserIDFromContext(r.Context())
		a.Audit.Log(r.Context(), &actor, "rbac.permission.upsert", "permission", p.Key, map[string]any{
			"title": p.Title,
		})
	}
	writeJSON(w, http.StatusOK, p)
}

func (a *RBACAPI) DeletePermission(w http.ResponseWriter, r *http.Request) {
	key := chi.URLParam(r, "key")
	if a.Settings == nil || a.Settings.RBACChrome().Source != "database" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "rbac chrome unavailable"})
		return
	}
	chrome := a.Settings.RBACChrome()
	if a.RBAC.IsProtectedPermission(key, chrome.ProtectedPermissionKeys) {
		writeClientError(w, http.StatusBadRequest, chrome.ErrProtectedDelete)
		return
	}
	if err := a.RBAC.DeletePermission(r.Context(), key); err != nil {
		if err == store.ErrNotFound {
			writeClientError(w, http.StatusNotFound, "permission not found")
			return
		}
		writeClientError(w, http.StatusBadRequest, "unable to delete permission")
		return
	}
	if a.Audit != nil {
		actor := auth.UserIDFromContext(r.Context())
		a.Audit.Log(r.Context(), &actor, "rbac.permission.delete", "permission", key, nil)
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

type replaceGrantsBody struct {
	Permissions []string `json:"permissions"`
}

func (a *RBACAPI) ReplaceRolePermissions(w http.ResponseWriter, r *http.Request) {
	role := strings.TrimSpace(chi.URLParam(r, "role"))
	if role == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "role required"})
		return
	}
	if a.Settings == nil || !a.Settings.IsAllowedRole(role) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid role"})
		return
	}
	var body replaceGrantsBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	if body.Permissions == nil {
		body.Permissions = []string{}
	}
	if a.Settings == nil || a.Settings.RBACChrome().Source != "database" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "rbac chrome unavailable"})
		return
	}
	chrome := a.Settings.RBACChrome()
	nextSet := map[string]struct{}{}
	for _, k := range body.Permissions {
		nextSet[strings.TrimSpace(k)] = struct{}{}
	}
	for _, protected := range chrome.ProtectedPermissionKeys {
		protected = strings.TrimSpace(protected)
		if protected == "" {
			continue
		}
		if _, keep := nextSet[protected]; keep {
			continue
		}
		n, err := a.RBAC.CountRolesWithPermission(r.Context(), protected, role)
		if err != nil {
			writeClientError(w, http.StatusInternalServerError, "unable to verify protected grants")
			return
		}
		if n < 1 {
			writeClientError(w, http.StatusBadRequest, chrome.ErrProtectedLastGrant)
			return
		}
	}
	if err := a.RBAC.ReplaceRolePermissions(r.Context(), role, body.Permissions); err != nil {
		writeClientError(w, http.StatusBadRequest, err.Error())
		return
	}
	if a.Audit != nil {
		actor := auth.UserIDFromContext(r.Context())
		a.Audit.Log(r.Context(), &actor, "rbac.role_permissions.replace", "role", role, map[string]any{
			"permissions": body.Permissions,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"role": role, "permissions": body.Permissions})
}

type catalogBody struct {
	Roles          []string `json:"roles"`
	ConsoleRoles   []string `json:"console_roles"`
	PublisherRoles []string `json:"publisher_roles"`
	DefaultRole    string   `json:"default_role"`
}

func (a *RBACAPI) PutCatalog(w http.ResponseWriter, r *http.Request) {
	var body catalogBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	prev := a.Settings.ClientEnums()
	prevSet := map[string]struct{}{}
	for _, role := range prev.Roles {
		prevSet[role] = struct{}{}
	}
	nextSet := map[string]struct{}{}
	for _, role := range body.Roles {
		nextSet[role] = struct{}{}
	}
	for role := range prevSet {
		if _, ok := nextSet[role]; ok {
			continue
		}
		if a.Users == nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "user store unavailable"})
			return
		}
		n, err := a.Users.CountUsersByRole(r.Context(), role)
		if err != nil {
			writeClientError(w, http.StatusInternalServerError, "unable to verify role usage")
			return
		}
		if n > 0 {
			writeClientError(w, http.StatusBadRequest, fmt.Sprintf("role %q still assigned to %d user(s)", role, n))
			return
		}
	}
	if err := a.Settings.UpsertClientEnumsRBAC(r.Context(), body.Roles, body.ConsoleRoles, body.PublisherRoles, body.DefaultRole); err != nil {
		writeClientError(w, http.StatusBadRequest, err.Error())
		return
	}
	for role := range prevSet {
		if _, ok := nextSet[role]; !ok {
			_ = a.RBAC.DeleteRoleGrants(r.Context(), role)
		}
	}
	if a.Audit != nil {
		actor := auth.UserIDFromContext(r.Context())
		a.Audit.Log(r.Context(), &actor, "rbac.catalog.put", "client_enums", "roles", map[string]any{
			"roles":           body.Roles,
			"console_roles":   body.ConsoleRoles,
			"publisher_roles": body.PublisherRoles,
			"default_role":    body.DefaultRole,
		})
	}
	enums := a.Settings.ClientEnums()
	writeJSON(w, http.StatusOK, map[string]any{
		"roles":           enums.Roles,
		"console_roles":   enums.ConsoleRoles,
		"publisher_roles": enums.PublisherRoles,
		"default_role":    enums.DefaultRole,
	})
}

func (a *RBACAPI) MyPermissions(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromContext(r.Context())
	if claims == nil {
		auth.WriteUnauthorized(w)
		return
	}
	chrome := a.Settings.RBACChrome()
	if chrome.Source != "database" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "rbac chrome unavailable"})
		return
	}
	grants, err := a.RBAC.ListRolePermissions(r.Context())
	if err != nil {
		writeClientError(w, http.StatusInternalServerError, "unable to load permissions")
		return
	}
	keys := grants[claims.Role]
	if keys == nil {
		keys = []string{}
	}
	adsChrome := a.Settings.AdRuntimeChrome()
	if adsChrome.Source != "database" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "ad runtime chrome unavailable"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"role":        claims.Role,
		"permissions": keys,
		"chrome":      chrome,
		"ads_chrome": map[string]any{
			"section_title":            adsChrome.SectionTitle,
			"lacks_permissions":        adsChrome.LacksPermissions,
			"unavailable":              adsChrome.Unavailable,
			"runtime_permission_key":   adsChrome.RuntimePermissionKey,
			"campaigns_permission_key": adsChrome.CampaignsPermissionKey,
		},
	})
}
