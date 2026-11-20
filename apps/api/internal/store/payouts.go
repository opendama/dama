package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"dama/apps/api/internal/db"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ErrPayoutPhoneRequired is returned when payout method phone is missing; map to wallet_chrome in REST.
var ErrPayoutPhoneRequired = errors.New("payout_phone_required")

type PayoutMethod struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Provider    string    `json:"provider"`
	AccountName string    `json:"account_name"`
	Phone       string    `json:"phone"`
	CreatedAt   time.Time `json:"created_at,omitempty"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type PayoutRequest struct {
	ID          string     `json:"id"`
	UserID      string     `json:"user_id"`
	Username    string     `json:"username,omitempty"`
	Amount      float64    `json:"amount"`
	Currency    string     `json:"currency"`
	Phone       string     `json:"phone"`
	Provider    string     `json:"provider"`
	Status      string     `json:"status"`
	StatusLabel string     `json:"status_label,omitempty"`
	ReviewNote  string     `json:"review_note,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	ReviewedAt  *time.Time `json:"reviewed_at,omitempty"`
	ReviewedBy  *string    `json:"reviewed_by,omitempty"`
}

type PayoutStore struct {
	db *db.Handle
}

func NewPayoutStore(handle *db.Handle) *PayoutStore {
	return &PayoutStore{db: handle}
}

func (s *PayoutStore) scanMethod(row interface {
	Scan(dest ...any) error
}) (*PayoutMethod, error) {
	var m PayoutMethod
	err := row.Scan(&m.ID, &m.UserID, &m.Provider, &m.AccountName, &m.Phone, &m.CreatedAt, &m.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// GetMethod returns the user's most recently updated payout destination (compat for single-method callers).
func (s *PayoutStore) GetMethod(ctx context.Context, userID string) (*PayoutMethod, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	row := s.db.Pool.QueryRow(ctx, `
		SELECT id, user_id, provider, account_name, phone, created_at, updated_at
		FROM user_payout_methods WHERE user_id=$1
		ORDER BY updated_at DESC
		LIMIT 1
	`, userID)
	return s.scanMethod(row)
}

// GetMethodByID returns one payout destination owned by userID.
func (s *PayoutStore) GetMethodByID(ctx context.Context, userID, id string) (*PayoutMethod, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, fmt.Errorf("method id required")
	}
	row := s.db.Pool.QueryRow(ctx, `
		SELECT id, user_id, provider, account_name, phone, created_at, updated_at
		FROM user_payout_methods WHERE id=$1 AND user_id=$2
	`, id, userID)
	return s.scanMethod(row)
}

// ListMethodsForUser returns a skip/limit page of payout destinations (newest first).
func (s *PayoutStore) ListMethodsForUser(ctx context.Context, userID string, skip, limit int) ([]PayoutMethod, int, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, 0, fmt.Errorf("service temporarily unavailable")
	}
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, 0, fmt.Errorf("user required")
	}
	if skip < 0 {
		skip = 0
	}
	if limit < 1 {
		limit = 10
	}
	if limit > 200 {
		limit = 200
	}
	var total int
	if err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM user_payout_methods WHERE user_id=$1
	`, userID).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, user_id, provider, account_name, phone, created_at, updated_at
		FROM user_payout_methods WHERE user_id=$1
		ORDER BY updated_at DESC
		LIMIT $2 OFFSET $3
	`, userID, limit, skip)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := make([]PayoutMethod, 0)
	for rows.Next() {
		m, err := s.scanMethod(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, *m)
	}
	return out, total, nil
}

func (s *PayoutStore) mirrorPrimaryPhone(ctx context.Context, userID, phone string) {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return
	}
	// Mirror payout phone onto the profile. Only clear phone KYC when the number
	// actually changes - identical mirrors must not wipe a verified stamp
	// (that left users with a saved phone but cash still blocked on phone_kyc).
	_, _ = s.db.Pool.Exec(ctx, `
		UPDATE users
		SET primary_phone = $2,
		    phone_kyc_verified_at = CASE
		      WHEN NULLIF(trim(COALESCE(primary_phone, '')), '') IS NOT DISTINCT FROM $2
		      THEN phone_kyc_verified_at
		      ELSE NULL
		    END,
		    updated_at = NOW()
		WHERE id = $1
	`, userID, phone)
}

func (s *PayoutStore) validateMethodFields(provider, accountName, phone string) (string, string, string, error) {
	phone = strings.TrimSpace(phone)
	provider = strings.TrimSpace(provider)
	accountName = strings.TrimSpace(accountName)
	if len(phone) < 8 {
		return "", "", "", fmt.Errorf("primary phone required")
	}
	if provider == "" {
		return "", "", "", fmt.Errorf("provider required")
	}
	return provider, accountName, phone, nil
}

// CreateMethod inserts a new payout destination for the user.
func (s *PayoutStore) CreateMethod(ctx context.Context, userID, provider, accountName, phone string) (*PayoutMethod, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	provider, accountName, phone, err := s.validateMethodFields(provider, accountName, phone)
	if err != nil {
		return nil, err
	}
	id := uuid.NewString()
	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO user_payout_methods (id, user_id, provider, account_name, phone, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
	`, id, userID, provider, accountName, phone)
	if err != nil {
		return nil, err
	}
	s.mirrorPrimaryPhone(ctx, userID, phone)
	return s.GetMethodByID(ctx, userID, id)
}

// UpdateMethod updates an owned payout destination.
func (s *PayoutStore) UpdateMethod(ctx context.Context, userID, id, provider, accountName, phone string) (*PayoutMethod, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	provider, accountName, phone, err := s.validateMethodFields(provider, accountName, phone)
	if err != nil {
		return nil, err
	}
	id = strings.TrimSpace(id)
	tag, err := s.db.Pool.Exec(ctx, `
		UPDATE user_payout_methods
		SET provider=$3, account_name=$4, phone=$5, updated_at=NOW()
		WHERE id=$1 AND user_id=$2
	`, id, userID, provider, accountName, phone)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	s.mirrorPrimaryPhone(ctx, userID, phone)
	return s.GetMethodByID(ctx, userID, id)
}

// DeleteMethod removes an owned payout destination.
func (s *PayoutStore) DeleteMethod(ctx context.Context, userID, id string) error {
	if s.db == nil || !s.db.Ready() {
		return fmt.Errorf("service temporarily unavailable")
	}
	id = strings.TrimSpace(id)
	tag, err := s.db.Pool.Exec(ctx, `
		DELETE FROM user_payout_methods WHERE id=$1 AND user_id=$2
	`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// UpsertMethod creates a new method when none exist, otherwise updates the most recent (legacy PUT /method).
func (s *PayoutStore) UpsertMethod(ctx context.Context, userID, provider, accountName, phone string) (*PayoutMethod, error) {
	existing, err := s.GetMethod(ctx, userID)
	if err != nil || existing == nil {
		return s.CreateMethod(ctx, userID, provider, accountName, phone)
	}
	return s.UpdateMethod(ctx, userID, existing.ID, provider, accountName, phone)
}

func (s *PayoutStore) CreateRequest(ctx context.Context, userID string, amount float64, currency, initialStatus string, method *PayoutMethod) (*PayoutRequest, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	if method == nil || len(strings.TrimSpace(method.Phone)) < 8 {
		return nil, ErrPayoutPhoneRequired
	}
	if amount <= 0 {
		return nil, fmt.Errorf("amount required")
	}
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if currency == "" {
		return nil, fmt.Errorf("currency required")
	}
	initialStatus = strings.TrimSpace(initialStatus)
	if initialStatus == "" {
		return nil, fmt.Errorf("payout status required")
	}
	id := uuid.NewString()
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO payout_requests (id, user_id, amount, currency, phone, provider, status, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
	`, id, userID, amount, currency, method.Phone, method.Provider, initialStatus)
	if err != nil {
		return nil, err
	}
	return &PayoutRequest{
		ID:        id,
		UserID:    userID,
		Amount:    amount,
		Currency:  currency,
		Phone:     method.Phone,
		Provider:  method.Provider,
		Status:    initialStatus,
		CreatedAt: time.Now().UTC(),
	}, nil
}

// GetRequest returns one payout request by id.
func (s *PayoutStore) GetRequest(ctx context.Context, id string) (*PayoutRequest, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, ErrPayoutNotFound
	}
	if _, err := uuid.Parse(id); err != nil {
		return nil, ErrPayoutNotFound
	}
	var r PayoutRequest
	err := s.db.Pool.QueryRow(ctx, `
		SELECT pr.id, pr.user_id, COALESCE(u.username,''), pr.amount, pr.currency, pr.phone, pr.provider, pr.status,
		       COALESCE(pr.review_note,''), pr.created_at, pr.reviewed_at, pr.reviewed_by
		FROM payout_requests pr
		LEFT JOIN users u ON u.id = pr.user_id
		WHERE pr.id = $1
	`, id).Scan(
		&r.ID, &r.UserID, &r.Username, &r.Amount, &r.Currency, &r.Phone, &r.Provider, &r.Status,
		&r.ReviewNote, &r.CreatedAt, &r.ReviewedAt, &r.ReviewedBy,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPayoutNotFound
		}
		return nil, err
	}
	return &r, nil
}

// ListRequests returns payout requests newest first (console review).
func (s *PayoutStore) ListRequests(ctx context.Context, status string, limit int) ([]PayoutRequest, error) {
	list, _, err := s.ListRequestsPaged(ctx, status, 0, limit, "")
	return list, err
}

// SeekSkipForUserRequest returns the skip offset so pageSize pages contain payoutID
// (newest-first). Returns 0 if not found or pageSize invalid.
func (s *PayoutStore) SeekSkipForUserRequest(ctx context.Context, userID, payoutID string, pageSize int) (int, error) {
	if s.db == nil || !s.db.Ready() {
		return 0, fmt.Errorf("service temporarily unavailable")
	}
	userID = strings.TrimSpace(userID)
	payoutID = strings.TrimSpace(payoutID)
	if userID == "" || payoutID == "" {
		return 0, fmt.Errorf("user and payout id required")
	}
	if pageSize <= 0 || pageSize > 200 {
		return 0, fmt.Errorf("payout history page size required")
	}
	var rank int
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COALESCE(ord.rn, 0) FROM (
			SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1) AS rn
			FROM payout_requests
			WHERE user_id = $1
		) ord WHERE ord.id::text = $2`, userID, payoutID).Scan(&rank)
	if err != nil {
		return 0, err
	}
	return (rank / pageSize) * pageSize, nil
}

// ListRequestsForUser returns the authenticated player's payout history page.
func (s *PayoutStore) ListRequestsForUser(ctx context.Context, userID string, skip, limit int) ([]PayoutRequest, int, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, 0, fmt.Errorf("service temporarily unavailable")
	}
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, 0, fmt.Errorf("user required")
	}
	if skip < 0 {
		skip = 0
	}
	if limit <= 0 || limit > 200 {
		return nil, 0, fmt.Errorf("payout history page size required")
	}
	var total int
	if err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM payout_requests WHERE user_id = $1`, userID).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT pr.id, pr.user_id, COALESCE(u.username,''), pr.amount, pr.currency, pr.phone, pr.provider, pr.status,
		       COALESCE(pr.review_note,''), pr.created_at, pr.reviewed_at, pr.reviewed_by
		FROM payout_requests pr
		LEFT JOIN users u ON u.id = pr.user_id
		WHERE pr.user_id = $1
		ORDER BY pr.created_at DESC
		LIMIT $2 OFFSET $3`, userID, limit, skip)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []PayoutRequest{}
	for rows.Next() {
		var r PayoutRequest
		if err := rows.Scan(
			&r.ID, &r.UserID, &r.Username, &r.Amount, &r.Currency, &r.Phone, &r.Provider, &r.Status,
			&r.ReviewNote, &r.CreatedAt, &r.ReviewedAt, &r.ReviewedBy,
		); err != nil {
			return nil, 0, err
		}
		out = append(out, r)
	}
	return out, total, rows.Err()
}

// ListRequestsPaged returns a skip/limit page plus total (Trim BuildMeta).
func (s *PayoutStore) ListRequestsPaged(ctx context.Context, status string, skip, limit int, qFilter string) ([]PayoutRequest, int, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, 0, fmt.Errorf("service temporarily unavailable")
	}
	if skip < 0 {
		skip = 0
	}
	if limit <= 0 || limit > 200 {
		return nil, 0, fmt.Errorf("payout console page size required")
	}
	status = strings.TrimSpace(status)
	qFilter = strings.TrimSpace(qFilter)
	like := "%" + qFilter + "%"
	var total int
	whereParts := []string{}
	args := []any{}
	if status != "" {
		args = append(args, status)
		whereParts = append(whereParts, fmt.Sprintf("pr.status = $%d", len(args)))
	}
	if qFilter != "" {
		args = append(args, like)
		whereParts = append(whereParts, fmt.Sprintf(
			"(pr.id::text ILIKE $%d OR COALESCE(u.username,'') ILIKE $%d)",
			len(args), len(args),
		))
	}
	countSQL := `SELECT COUNT(*) FROM payout_requests pr LEFT JOIN users u ON u.id = pr.user_id`
	if len(whereParts) > 0 {
		countSQL += ` WHERE ` + strings.Join(whereParts, " AND ")
	}
	if err := s.db.Pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	listSQL := `
		SELECT pr.id, pr.user_id, COALESCE(u.username,''), pr.amount, pr.currency, pr.phone, pr.provider, pr.status,
		       COALESCE(pr.review_note,''), pr.created_at, pr.reviewed_at, pr.reviewed_by
		FROM payout_requests pr
		LEFT JOIN users u ON u.id = pr.user_id
	`
	if len(whereParts) > 0 {
		listSQL += ` WHERE ` + strings.Join(whereParts, " AND ")
	}
	args = append(args, limit, skip)
	listSQL += fmt.Sprintf(` ORDER BY pr.created_at DESC LIMIT $%d OFFSET $%d`, len(args)-1, len(args))
	rows, err := s.db.Pool.Query(ctx, listSQL, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []PayoutRequest{}
	for rows.Next() {
		var r PayoutRequest
		if err := rows.Scan(
			&r.ID, &r.UserID, &r.Username, &r.Amount, &r.Currency, &r.Phone, &r.Provider, &r.Status,
			&r.ReviewNote, &r.CreatedAt, &r.ReviewedAt, &r.ReviewedBy,
		); err != nil {
			return nil, 0, err
		}
		out = append(out, r)
	}
	return out, total, rows.Err()
}

// ErrPayoutNotFound is returned when the payout id does not exist.
var ErrPayoutNotFound = errors.New("payout not found")

// ErrPayoutTransitionConflict is returned when the atomic status predicate matches no row
// (concurrent console/bot review already moved the payout).
var ErrPayoutTransitionConflict = errors.New("payout transition conflict")

// ReviewRequest sets status / note / reviewer for operator fulfillment.
// fromStatus is required and enforced in SQL (pending→approved|rejected, approved→paid)
// so concurrent bot+console actuators cannot double-apply or double-refund.
func (s *PayoutStore) ReviewRequest(ctx context.Context, id, fromStatus, status, note, reviewerID string) (*PayoutRequest, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	id = strings.TrimSpace(id)
	fromStatus = strings.TrimSpace(fromStatus)
	status = strings.TrimSpace(status)
	note = strings.TrimSpace(note)
	reviewerID = strings.TrimSpace(reviewerID)
	if id == "" || fromStatus == "" || status == "" || reviewerID == "" {
		return nil, fmt.Errorf("review fields required")
	}
	if _, err := uuid.Parse(id); err != nil {
		return nil, ErrPayoutNotFound
	}
	tag, err := s.db.Pool.Exec(ctx, `
		UPDATE payout_requests
		SET status = $2, review_note = $3, reviewed_by = $4, reviewed_at = NOW()
		WHERE id = $1 AND status = $5
	`, id, status, note, reviewerID, fromStatus)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		var exists bool
		if err := s.db.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM payout_requests WHERE id = $1)`, id).Scan(&exists); err != nil {
			return nil, err
		}
		if !exists {
			return nil, ErrPayoutNotFound
		}
		return nil, ErrPayoutTransitionConflict
	}
	var r PayoutRequest
	err = s.db.Pool.QueryRow(ctx, `
		SELECT pr.id, pr.user_id, COALESCE(u.username,''), pr.amount, pr.currency, pr.phone, pr.provider, pr.status,
		       COALESCE(pr.review_note,''), pr.created_at, pr.reviewed_at, pr.reviewed_by
		FROM payout_requests pr
		LEFT JOIN users u ON u.id = pr.user_id
		WHERE pr.id = $1
	`, id).Scan(
		&r.ID, &r.UserID, &r.Username, &r.Amount, &r.Currency, &r.Phone, &r.Provider, &r.Status,
		&r.ReviewNote, &r.CreatedAt, &r.ReviewedAt, &r.ReviewedBy,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPayoutNotFound
		}
		return nil, err
	}
	return &r, nil
}
