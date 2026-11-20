package store

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"dama/apps/api/internal/db"
)

type AuditStore struct {
	db *db.Handle
}

func NewAuditStore(handle *db.Handle) *AuditStore {
	return &AuditStore{db: handle}
}

type AuditEntry struct {
	ID         int64           `json:"id"`
	ActorID    *string         `json:"actor_id,omitempty"`
	Action     string          `json:"action"`
	EntityType string          `json:"entity_type"`
	EntityID   string          `json:"entity_id"`
	Metadata   json.RawMessage `json:"metadata,omitempty"`
	CreatedAt  string          `json:"created_at"`
}

func (s *AuditStore) Log(ctx context.Context, actorID *string, action, entityType, entityID string, metadata map[string]any) {
	if metadata == nil {
		metadata = map[string]any{}
	}
	raw, _ := json.Marshal(metadata)
	if s.db == nil || !s.db.Ready() {
		log.Printf("audit: %s %s/%s actor=%v meta=%s", action, entityType, entityID, actorID, string(raw))
		return
	}
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO audit_log (actor_id, action, entity_type, entity_id, metadata, created_at)
		VALUES ($1,$2,$3,$4,$5::jsonb,NOW())
	`, actorID, action, entityType, entityID, string(raw))
	if err != nil {
		log.Printf("audit persist failed: %v", err)
	}
}

func (s *AuditStore) ListRecent(ctx context.Context, limit int) ([]AuditEntry, error) {
	list, _, err := s.ListPaged(ctx, 0, limit, "")
	return list, err
}

// ListPaged returns skip/limit page + total (Trim BuildMeta).
// Optional q matches actor id, action, entity type, or entity id.
func (s *AuditStore) ListPaged(ctx context.Context, skip, limit int, q string) ([]AuditEntry, int, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, 0, fmt.Errorf("service temporarily unavailable")
	}
	if skip < 0 {
		skip = 0
	}
	if limit <= 0 {
		limit = 100
	}
	needle := strings.TrimSpace(q)
	var total int
	if err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM audit_log
		WHERE (
		  $1 = '' OR COALESCE(actor_id::text,'') ILIKE '%' || $1 || '%'
		  OR lower(action) LIKE '%' || lower($1) || '%'
		  OR lower(entity_type) LIKE '%' || lower($1) || '%'
		  OR lower(COALESCE(entity_id,'')) LIKE '%' || lower($1) || '%'
		)
	`, needle).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, actor_id, action, entity_type, COALESCE(entity_id,''), COALESCE(metadata,'{}'::jsonb), created_at::text
		FROM audit_log
		WHERE (
		  $3 = '' OR COALESCE(actor_id::text,'') ILIKE '%' || $3 || '%'
		  OR lower(action) LIKE '%' || lower($3) || '%'
		  OR lower(entity_type) LIKE '%' || lower($3) || '%'
		  OR lower(COALESCE(entity_id,'')) LIKE '%' || lower($3) || '%'
		)
		ORDER BY created_at DESC LIMIT $1 OFFSET $2
	`, limit, skip, needle)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []AuditEntry{}
	for rows.Next() {
		var e AuditEntry
		if err := rows.Scan(&e.ID, &e.ActorID, &e.Action, &e.EntityType, &e.EntityID, &e.Metadata, &e.CreatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, e)
	}
	return out, total, nil
}
