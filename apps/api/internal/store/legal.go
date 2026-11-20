package store

import (
	"context"
	"fmt"
	"strings"

	"dama/apps/api/internal/db"
)

// LegalSection is one privacy/terms block from site_legal_sections (DB-backed only).
type LegalSection struct {
	Heading          string `json:"heading"`
	Body             string `json:"body"`
	ContactLead      string `json:"contact_lead"`
	ContactTrail     string `json:"contact_trail"`
	UsesSupportEmail bool   `json:"uses_support_email"`
}

type LegalStore struct {
	db *db.Handle
}

func NewLegalStore(handle *db.Handle) *LegalStore {
	return &LegalStore{db: handle}
}

// ListByKind returns site_legal_sections for privacy, terms, or refunds, ordered by sort_order.
// Fails when the database is unavailable.
func (s *LegalStore) ListByKind(ctx context.Context, docKind string) ([]LegalSection, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	docKind = strings.ToLower(strings.TrimSpace(docKind))
	if docKind != "privacy" && docKind != "terms" && docKind != "refunds" {
		return nil, fmt.Errorf("invalid legal doc_kind")
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT COALESCE(heading, ''), COALESCE(body, ''),
		       COALESCE(contact_lead, ''), COALESCE(contact_trail, ''),
		       uses_support_email
		FROM site_legal_sections
		WHERE doc_kind = $1
		ORDER BY sort_order ASC
	`, docKind)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]LegalSection, 0)
	for rows.Next() {
		var sec LegalSection
		if err := rows.Scan(
			&sec.Heading, &sec.Body, &sec.ContactLead, &sec.ContactTrail, &sec.UsesSupportEmail,
		); err != nil {
			return nil, err
		}
		out = append(out, sec)
	}
	return out, rows.Err()
}
