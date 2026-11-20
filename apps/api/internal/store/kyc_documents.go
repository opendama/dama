package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"dama/apps/api/internal/db"

	"github.com/google/uuid"
)

// KycDocumentSubmission is one government-ID KYC package for payout eligibility.
// Identity proof is document type + legal name + photo uploads (no printed metadata fields).
type KycDocumentSubmission struct {
	ID           string     `json:"id"`
	UserID       string     `json:"user_id"`
	Username     string     `json:"username,omitempty"`
	DocumentType string     `json:"document_type"`
	LegalName    string     `json:"legal_name"`
	IDFrontURL   string     `json:"id_front_url"`
	IDBackURL    string     `json:"id_back_url"`
	SelfieURL    string     `json:"selfie_url"`
	Status       string     `json:"status"`
	ReviewNote   string     `json:"review_note,omitempty"`
	ReviewerID   *string    `json:"reviewer_id,omitempty"`
	ReviewedAt   *time.Time `json:"reviewed_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type KycDocumentStore struct {
	db *db.Handle
}

func NewKycDocumentStore(handle *db.Handle) *KycDocumentStore {
	return &KycDocumentStore{db: handle}
}

func (s *KycDocumentStore) requireDB() error {
	if s == nil || s.db == nil || !s.db.Ready() {
		return errors.New("database unavailable")
	}
	return nil
}

const kycSelectCols = `
		id, user_id, document_type, legal_name,
		id_front_url, id_back_url, selfie_url,
		status, review_note, reviewer_id, reviewed_at, created_at, updated_at`

func (s *KycDocumentStore) LatestForUser(ctx context.Context, userID string) (*KycDocumentSubmission, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	row := s.db.Pool.QueryRow(ctx, `
		SELECT `+kycSelectCols+`
		FROM kyc_document_submissions
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`, userID)
	return scanKyc(row)
}

func (s *KycDocumentStore) GetByID(ctx context.Context, id string) (*KycDocumentSubmission, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	row := s.db.Pool.QueryRow(ctx, `
		SELECT `+kycSelectCols+`
		FROM kyc_document_submissions WHERE id = $1
	`, id)
	return scanKyc(row)
}

type kycScanner interface {
	Scan(dest ...any) error
}

func scanKyc(row kycScanner) (*KycDocumentSubmission, error) {
	var m KycDocumentSubmission
	var reviewer *string
	var reviewed *time.Time
	err := row.Scan(
		&m.ID, &m.UserID, &m.DocumentType, &m.LegalName,
		&m.IDFrontURL, &m.IDBackURL, &m.SelfieURL,
		&m.Status, &m.ReviewNote, &reviewer, &reviewed, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	m.ReviewerID = reviewer
	m.ReviewedAt = reviewed
	return &m, nil
}

// SaveDraft creates or updates the user's editable submission as draft.
func (s *KycDocumentStore) SaveDraft(ctx context.Context, userID, docType, legalName, front, back, selfie, draftStatus string) (*KycDocumentSubmission, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	latest, _ := s.LatestForUser(ctx, userID)
	if latest != nil {
		_, err := s.db.Pool.Exec(ctx, `
			UPDATE kyc_document_submissions
			SET document_type=$2, legal_name=$3,
			    id_front_url=$4, id_back_url=$5, selfie_url=$6,
			    status=$7, review_note='', reviewer_id=NULL, reviewed_at=NULL, updated_at=NOW()
			WHERE id=$1
		`, latest.ID, docType, legalName, front, back, selfie, draftStatus)
		if err != nil {
			return nil, err
		}
		return s.GetByID(ctx, latest.ID)
	}
	id := uuid.NewString()
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO kyc_document_submissions (
			id, user_id, document_type, legal_name,
			id_front_url, id_back_url, selfie_url, status, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
	`, id, userID, docType, legalName, front, back, selfie, draftStatus)
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *KycDocumentStore) Submit(ctx context.Context, userID, id, pendingStatus, draftStatus, rejectedStatus string) (*KycDocumentSubmission, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	cur, err := s.GetByID(ctx, id)
	if err != nil || cur == nil || cur.UserID != userID {
		return nil, fmt.Errorf("submission not found")
	}
	if cur.Status != draftStatus && cur.Status != rejectedStatus {
		return nil, fmt.Errorf("submission not submittable")
	}
	_, err = s.db.Pool.Exec(ctx, `
		UPDATE kyc_document_submissions
		SET status=$2, review_note='', reviewer_id=NULL, reviewed_at=NULL, updated_at=NOW()
		WHERE id=$1 AND user_id=$3
	`, id, pendingStatus, userID)
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

// ListByStatus returns submissions filtered by status ("all"/empty = recent history DESC).
func (s *KycDocumentStore) ListByStatus(ctx context.Context, status string, limit int) ([]KycDocumentSubmission, error) {
	list, _, err := s.ListByStatusPaged(ctx, status, 0, limit, "")
	return list, err
}

// ListByStatusPaged returns a skip/limit page plus total (Trim BuildMeta).
func (s *KycDocumentStore) ListByStatusPaged(ctx context.Context, status string, skip, limit int, q string) ([]KycDocumentSubmission, int, error) {
	if err := s.requireDB(); err != nil {
		return nil, 0, err
	}
	if skip < 0 {
		skip = 0
	}
	if limit < 1 {
		limit = 50
	}
	status = strings.TrimSpace(status)
	q = strings.TrimSpace(q)
	like := "%" + q + "%"
	var total int
	if status == "" || status == "all" {
		if q != "" {
			if err := s.db.Pool.QueryRow(ctx, `
				SELECT COUNT(*) FROM kyc_document_submissions WHERE id::text ILIKE $1
			`, like).Scan(&total); err != nil {
				return nil, 0, err
			}
			rows, err := s.db.Pool.Query(ctx, `
				SELECT `+kycSelectCols+`
				FROM kyc_document_submissions
				WHERE id::text ILIKE $1
				ORDER BY created_at DESC
				LIMIT $2 OFFSET $3
			`, like, limit, skip)
			if err != nil {
				return nil, 0, err
			}
			defer rows.Close()
			list, err := collectKycRows(rows)
			return list, total, err
		}
		if err := s.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM kyc_document_submissions`).Scan(&total); err != nil {
			return nil, 0, err
		}
		rows, err := s.db.Pool.Query(ctx, `
			SELECT `+kycSelectCols+`
			FROM kyc_document_submissions
			ORDER BY created_at DESC
			LIMIT $1 OFFSET $2
		`, limit, skip)
		if err != nil {
			return nil, 0, err
		}
		defer rows.Close()
		list, err := collectKycRows(rows)
		return list, total, err
	}
	if q != "" {
		if err := s.db.Pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM kyc_document_submissions WHERE status = $1 AND id::text ILIKE $2
		`, status, like).Scan(&total); err != nil {
			return nil, 0, err
		}
		rows, err := s.db.Pool.Query(ctx, `
			SELECT `+kycSelectCols+`
			FROM kyc_document_submissions
			WHERE status = $1 AND id::text ILIKE $2
			ORDER BY created_at DESC
			LIMIT $3 OFFSET $4
		`, status, like, limit, skip)
		if err != nil {
			return nil, 0, err
		}
		defer rows.Close()
		list, err := collectKycRows(rows)
		return list, total, err
	}
	if err := s.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM kyc_document_submissions WHERE status = $1`, status).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT `+kycSelectCols+`
		FROM kyc_document_submissions
		WHERE status = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, status, limit, skip)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	list, err := collectKycRows(rows)
	return list, total, err
}

type kycRowIter interface {
	Next() bool
	Err() error
	Scan(dest ...any) error
}

func collectKycRows(rows kycRowIter) ([]KycDocumentSubmission, error) {
	out := make([]KycDocumentSubmission, 0)
	for rows.Next() {
		m, err := scanKyc(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *m)
	}
	return out, rows.Err()
}

func (s *KycDocumentStore) ListPending(ctx context.Context, pendingStatus string, limit int) ([]KycDocumentSubmission, error) {
	return s.ListByStatus(ctx, pendingStatus, limit)
}

func (s *KycDocumentStore) Review(ctx context.Context, id, status, note, reviewerID, approvedStatus, rejectedStatus, pendingStatus string) (*KycDocumentSubmission, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	cur, err := s.GetByID(ctx, id)
	if err != nil || cur == nil {
		return nil, fmt.Errorf("submission not found")
	}
	if cur.Status != pendingStatus {
		return nil, fmt.Errorf("submission not reviewable")
	}
	if status != approvedStatus && status != rejectedStatus {
		return nil, fmt.Errorf("invalid review status")
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `
		UPDATE kyc_document_submissions
		SET status=$2, review_note=$3, reviewer_id=$4, reviewed_at=NOW(), updated_at=NOW()
		WHERE id=$1
	`, id, status, strings.TrimSpace(note), reviewerID)
	if err != nil {
		return nil, err
	}
	if status == approvedStatus {
		_, err = tx.Exec(ctx, `
			UPDATE users SET document_kyc_verified_at = NOW(), updated_at = NOW() WHERE id = $1
		`, cur.UserID)
		if err != nil {
			return nil, err
		}
	} else {
		_, err = tx.Exec(ctx, `
			UPDATE users SET document_kyc_verified_at = NULL, updated_at = NOW() WHERE id = $1
		`, cur.UserID)
		if err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

// AutoApprovePending stamps an already-pending submission as approved with no human reviewer.
// Used when feature flag kyc_auto_approve is on. Same user stamp path as Review.
func (s *KycDocumentStore) AutoApprovePending(ctx context.Context, id, approvedStatus, pendingStatus, note string) (*KycDocumentSubmission, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	cur, err := s.GetByID(ctx, id)
	if err != nil || cur == nil {
		return nil, fmt.Errorf("submission not found")
	}
	if cur.Status != pendingStatus {
		return nil, fmt.Errorf("submission not reviewable")
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `
		UPDATE kyc_document_submissions
		SET status=$2, review_note=$3, reviewer_id=NULL, reviewed_at=NOW(), updated_at=NOW()
		WHERE id=$1
	`, id, approvedStatus, strings.TrimSpace(note))
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `
		UPDATE users SET document_kyc_verified_at = NOW(), updated_at = NOW() WHERE id = $1
	`, cur.UserID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

// HasApprovedDocument returns true when the user has an approved submission
// and users.document_kyc_verified_at is set (kept in sync by Review).
func (s *KycDocumentStore) HasApprovedDocument(ctx context.Context, userID, approvedStatus string) (bool, error) {
	if err := s.requireDB(); err != nil {
		return false, err
	}
	var n int
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(1) FROM kyc_document_submissions k
		INNER JOIN users u ON u.id = k.user_id
		WHERE k.user_id = $1
		  AND k.status = $2
		  AND u.document_kyc_verified_at IS NOT NULL
	`, userID, approvedStatus).Scan(&n)
	return n > 0, err
}
