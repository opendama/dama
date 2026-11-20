package store

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"dama/apps/api/internal/db"
)

type GeoIPRecord struct {
	ID          string    `json:"id"`
	UserID      *string   `json:"user_id,omitempty"`
	Username    string    `json:"username,omitempty"`
	IP          string    `json:"ip"`
	CountryCode string    `json:"country_code"`
	Region      string    `json:"region,omitempty"`
	City        string    `json:"city,omitempty"`
	Source      string    `json:"-"` // mapped via publicLocateSource at the API boundary
	Latitude    float64   `json:"latitude,omitempty"`
	Longitude   float64   `json:"longitude,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type GeoIPStore struct {
	db *db.Handle
}

func NewGeoIPStore(handle *db.Handle) *GeoIPStore {
	return &GeoIPStore{db: handle}
}

func (s *GeoIPStore) ListRecent(ctx context.Context, limit int) ([]GeoIPRecord, error) {
	list, _, err := s.ListPaged(ctx, 0, limit, "")
	return list, err
}

// ListPaged returns skip/limit page + total (Trim BuildMeta).
// Optional q matches username, user id, ip, country, region, city, or source.
func (s *GeoIPStore) ListPaged(ctx context.Context, skip, limit int, q string) ([]GeoIPRecord, int, error) {
	if s.db == nil || !s.db.Ready() {
		if os.Getenv("DAMA_ALLOW_MEMORY") == "1" {
			return []GeoIPRecord{}, 0, nil
		}
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
		SELECT COUNT(*) FROM geo_ip_records g
		LEFT JOIN users u ON u.id = g.user_id
		WHERE (
		  $1 = '' OR lower(COALESCE(u.username,'')) LIKE '%' || lower($1) || '%'
		  OR COALESCE(g.user_id::text,'') ILIKE '%' || $1 || '%'
		  OR lower(COALESCE(g.ip,'')) LIKE '%' || lower($1) || '%'
		  OR lower(COALESCE(g.country_code,'')) LIKE '%' || lower($1) || '%'
		  OR lower(COALESCE(g.region,'')) LIKE '%' || lower($1) || '%'
		  OR lower(COALESCE(g.city,'')) LIKE '%' || lower($1) || '%'
		  OR lower(COALESCE(g.source,'')) LIKE '%' || lower($1) || '%'
		)
	`, needle).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT g.id, g.user_id, COALESCE(u.username,''), COALESCE(g.ip,''), COALESCE(g.country_code,''),
		       COALESCE(g.region,''), COALESCE(g.city,''), COALESCE(g.source,''),
		       COALESCE(g.latitude,0), COALESCE(g.longitude,0), g.created_at
		FROM geo_ip_records g
		LEFT JOIN users u ON u.id = g.user_id
		WHERE (
		  $3 = '' OR lower(COALESCE(u.username,'')) LIKE '%' || lower($3) || '%'
		  OR COALESCE(g.user_id::text,'') ILIKE '%' || $3 || '%'
		  OR lower(COALESCE(g.ip,'')) LIKE '%' || lower($3) || '%'
		  OR lower(COALESCE(g.country_code,'')) LIKE '%' || lower($3) || '%'
		  OR lower(COALESCE(g.region,'')) LIKE '%' || lower($3) || '%'
		  OR lower(COALESCE(g.city,'')) LIKE '%' || lower($3) || '%'
		  OR lower(COALESCE(g.source,'')) LIKE '%' || lower($3) || '%'
		)
		ORDER BY g.created_at DESC
		LIMIT $1 OFFSET $2
	`, limit, skip, needle)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []GeoIPRecord{}
	for rows.Next() {
		var r GeoIPRecord
		if err := rows.Scan(
			&r.ID, &r.UserID, &r.Username, &r.IP, &r.CountryCode,
			&r.Region, &r.City, &r.Source, &r.Latitude, &r.Longitude, &r.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		out = append(out, r)
	}
	return out, total, nil
}
