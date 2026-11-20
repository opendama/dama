package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"dama/apps/api/internal/db"
)

type RBACPermission struct {
	Key         string `json:"key"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

type RBACStore struct {
	db *db.Handle
}

func NewRBACStore(handle *db.Handle) *RBACStore {
	return &RBACStore{db: handle}
}

func (s *RBACStore) ListPermissions(ctx context.Context) ([]RBACPermission, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT key, title, description FROM rbac_permissions ORDER BY key
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]RBACPermission, 0)
	for rows.Next() {
		var p RBACPermission
		if err := rows.Scan(&p.Key, &p.Title, &p.Description); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *RBACStore) ListRolePermissions(ctx context.Context) (map[string][]string, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT role, permission_key FROM rbac_role_permissions ORDER BY role, permission_key
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string][]string{}
	for rows.Next() {
		var role, key string
		if err := rows.Scan(&role, &key); err != nil {
			return nil, err
		}
		out[role] = append(out[role], key)
	}
	return out, rows.Err()
}

func (s *RBACStore) RoleHasPermission(ctx context.Context, role, permission string) (bool, error) {
	role = strings.TrimSpace(role)
	permission = strings.TrimSpace(permission)
	if role == "" || permission == "" {
		return false, nil
	}
	if s.db == nil || !s.db.Ready() {
		return false, fmt.Errorf("service temporarily unavailable")
	}
	var ok bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM rbac_role_permissions WHERE role=$1 AND permission_key=$2
		)
	`, role, permission).Scan(&ok)
	return ok, err
}

// ReplaceRolePermissions sets the full grant list for a role (fail closed empty = no grants).
// Every key must already exist in rbac_permissions (FK + explicit check).
func (s *RBACStore) ReplaceRolePermissions(ctx context.Context, role string, keys []string) error {
	role = strings.TrimSpace(role)
	if role == "" {
		return fmt.Errorf("role required")
	}
	if s.db == nil || !s.db.Ready() {
		return fmt.Errorf("service temporarily unavailable")
	}
	catalog, err := s.ListPermissions(ctx)
	if err != nil {
		return err
	}
	allowed := map[string]struct{}{}
	for _, p := range catalog {
		allowed[p.Key] = struct{}{}
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `DELETE FROM rbac_role_permissions WHERE role=$1`, role); err != nil {
		return err
	}
	for _, k := range keys {
		k = strings.TrimSpace(k)
		if k == "" {
			continue
		}
		if _, ok := allowed[k]; !ok {
			return fmt.Errorf("unknown permission %q", k)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO rbac_role_permissions (role, permission_key) VALUES ($1,$2)
			ON CONFLICT DO NOTHING
		`, role, k); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// UpsertClientEnumsRoles writes roles / console_roles / publisher_roles / default_role into client_enums.
func (s *SettingsStore) UpsertClientEnumsRBAC(ctx context.Context, roles, consoleRoles, publisherRoles []string, defaultRole string) error {
	if s.db == nil || !s.db.Ready() {
		return fmt.Errorf("service temporarily unavailable")
	}
	defaultRole = strings.TrimSpace(defaultRole)
	if defaultRole == "" {
		return fmt.Errorf("default_role required")
	}
	roles = normalizeRoleList(roles)
	consoleRoles = normalizeRoleList(consoleRoles)
	publisherRoles = normalizeRoleList(publisherRoles)
	if len(roles) == 0 {
		return fmt.Errorf("roles required")
	}
	found := false
	for _, r := range roles {
		if r == defaultRole {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("default_role must be in roles")
	}
	for _, r := range consoleRoles {
		ok := false
		for _, x := range roles {
			if x == r {
				ok = true
				break
			}
		}
		if !ok {
			return fmt.Errorf("console role %q not in roles", r)
		}
	}
	for _, r := range publisherRoles {
		ok := false
		for _, x := range roles {
			if x == r {
				ok = true
				break
			}
		}
		if !ok {
			return fmt.Errorf("publisher role %q not in roles", r)
		}
	}
	patch, _ := json.Marshal(map[string]any{
		"roles":           roles,
		"console_roles":   consoleRoles,
		"publisher_roles": publisherRoles,
		"default_role":    defaultRole,
	})
	tag, err := s.db.Pool.Exec(ctx, `
		UPDATE platform_settings
		SET value = value || $1::jsonb, updated_at = NOW()
		WHERE key = 'client_enums'
	`, patch)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("client_enums missing")
	}
	return s.ReloadClientEnums(ctx)
}

func normalizeRoleList(in []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(in))
	for _, r := range in {
		r = strings.TrimSpace(r)
		if r == "" {
			continue
		}
		if _, ok := seen[r]; ok {
			continue
		}
		seen[r] = struct{}{}
		out = append(out, r)
	}
	return out
}
