package store

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"dama/apps/api/internal/db"

	"github.com/google/uuid"
)

type DeviceFingerprint struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Username    string    `json:"username,omitempty"`
	Fingerprint string    `json:"fingerprint"`
	UserAgent   string    `json:"user_agent,omitempty"`
	Platform    string    `json:"platform,omitempty"`
	IPHint      string    `json:"ip_hint,omitempty"`
	LastSeenAt  time.Time `json:"last_seen_at"`
	CreatedAt   time.Time `json:"created_at"`
}

type FingerprintStore struct {
	db *db.Handle
}

func NewFingerprintStore(handle *db.Handle) *FingerprintStore {
	return &FingerprintStore{db: handle}
}

func (s *FingerprintStore) requireDB() error {
	if s.db != nil && s.db.Ready() {
		return nil
	}
	if os.Getenv("DAMA_ALLOW_MEMORY") == "1" {
		return fmt.Errorf("service temporarily unavailable")
	}
	return fmt.Errorf("service temporarily unavailable")
}

func (s *FingerprintStore) Upsert(ctx context.Context, userID, fingerprint, userAgent, platform, ipHint string) (*DeviceFingerprint, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	id := uuid.NewString()
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO device_fingerprints (id, user_id, fingerprint, user_agent, platform, ip_hint, last_seen_at, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
		ON CONFLICT (user_id, fingerprint) DO UPDATE
		SET last_seen_at=NOW(), user_agent=EXCLUDED.user_agent, platform=EXCLUDED.platform,
		    ip_hint=COALESCE(NULLIF(EXCLUDED.ip_hint,''), device_fingerprints.ip_hint)
	`, id, userID, fingerprint, userAgent, platform, ipHint)
	if err != nil {
		return nil, err
	}
	var rec DeviceFingerprint
	err = s.db.Pool.QueryRow(ctx, `
		SELECT id, user_id, fingerprint, COALESCE(user_agent,''), COALESCE(platform,''), COALESCE(ip_hint,''),
		       last_seen_at, created_at
		FROM device_fingerprints WHERE user_id=$1 AND fingerprint=$2
	`, userID, fingerprint).Scan(
		&rec.ID, &rec.UserID, &rec.Fingerprint, &rec.UserAgent, &rec.Platform, &rec.IPHint, &rec.LastSeenAt, &rec.CreatedAt,
	)
	if err != nil {
		rec = DeviceFingerprint{
			ID: id, UserID: userID, Fingerprint: fingerprint, UserAgent: userAgent,
			Platform: platform, IPHint: ipHint, LastSeenAt: now, CreatedAt: now,
		}
	}
	return &rec, nil
}

func (s *FingerprintStore) ListByUser(ctx context.Context, userID string, limit int) ([]DeviceFingerprint, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 20
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, user_id, fingerprint, COALESCE(user_agent,''), COALESCE(platform,''), COALESCE(ip_hint,''),
		       last_seen_at, created_at
		FROM device_fingerprints WHERE user_id=$1
		ORDER BY last_seen_at DESC LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []DeviceFingerprint{}
	for rows.Next() {
		var f DeviceFingerprint
		if err := rows.Scan(&f.ID, &f.UserID, &f.Fingerprint, &f.UserAgent, &f.Platform, &f.IPHint, &f.LastSeenAt, &f.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, nil
}

// ListRecent returns recent fingerprints across users for admin telemetry CRUD.
func (s *FingerprintStore) ListRecent(ctx context.Context, limit int) ([]DeviceFingerprint, error) {
	list, _, err := s.ListPaged(ctx, 0, limit, "")
	return list, err
}

// ListPaged returns skip/limit page + total (Trim BuildMeta).
// Optional q matches username, user id, fingerprint, platform, or ip hint.
func (s *FingerprintStore) ListPaged(ctx context.Context, skip, limit int, q string) ([]DeviceFingerprint, int, error) {
	if err := s.requireDB(); err != nil {
		return nil, 0, err
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
		SELECT COUNT(*) FROM device_fingerprints f
		LEFT JOIN users u ON u.id = f.user_id
		WHERE (
		  $1 = '' OR lower(COALESCE(u.username,'')) LIKE '%' || lower($1) || '%'
		  OR f.user_id::text ILIKE '%' || $1 || '%'
		  OR lower(f.fingerprint) LIKE '%' || lower($1) || '%'
		  OR lower(COALESCE(f.platform,'')) LIKE '%' || lower($1) || '%'
		  OR lower(COALESCE(f.ip_hint,'')) LIKE '%' || lower($1) || '%'
		)
	`, needle).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT f.id, f.user_id, COALESCE(u.username,''), f.fingerprint,
		       COALESCE(f.user_agent,''), COALESCE(f.platform,''), COALESCE(f.ip_hint,''),
		       f.last_seen_at, f.created_at
		FROM device_fingerprints f
		LEFT JOIN users u ON u.id = f.user_id
		WHERE (
		  $3 = '' OR lower(COALESCE(u.username,'')) LIKE '%' || lower($3) || '%'
		  OR f.user_id::text ILIKE '%' || $3 || '%'
		  OR lower(f.fingerprint) LIKE '%' || lower($3) || '%'
		  OR lower(COALESCE(f.platform,'')) LIKE '%' || lower($3) || '%'
		  OR lower(COALESCE(f.ip_hint,'')) LIKE '%' || lower($3) || '%'
		)
		ORDER BY f.last_seen_at DESC
		LIMIT $1 OFFSET $2
	`, limit, skip, needle)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []DeviceFingerprint{}
	for rows.Next() {
		var f DeviceFingerprint
		if err := rows.Scan(
			&f.ID, &f.UserID, &f.Username, &f.Fingerprint,
			&f.UserAgent, &f.Platform, &f.IPHint, &f.LastSeenAt, &f.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		out = append(out, f)
	}
	return out, total, nil
}
