package store

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"strings"
	"time"

	"dama/apps/api/internal/crypto"
	"dama/apps/api/internal/db"

	"github.com/google/uuid"
)

type BankAccount struct {
	ID            string    `json:"id"`
	Provider      string    `json:"provider,omitempty"` // bank label (e.g. CBE), not payment gateway
	Label         string    `json:"label"`
	AccountName   string    `json:"account_name,omitempty"`
	AccountNumber string    `json:"account_number,omitempty"`
	MobileCode    string    `json:"mobile_code,omitempty"`
	Currency      string    `json:"currency"`
	IsActive      bool      `json:"is_active"`
	CreatedAt     time.Time `json:"-"`
}

type BankStore struct {
	db    *db.Handle
	vault *crypto.Vault
}

func NewBankStore(handle *db.Handle, vault *crypto.Vault) *BankStore {
	return &BankStore{db: handle, vault: vault}
}

func (s *BankStore) requireDB() error {
	if s.db != nil && s.db.Ready() {
		return nil
	}
	if os.Getenv("DAMA_ALLOW_MEMORY") == "1" {
		return fmt.Errorf("service temporarily unavailable")
	}
	return fmt.Errorf("service temporarily unavailable")
}

func (s *BankStore) seal(plain string) (string, error) {
	if plain == "" {
		return "", nil
	}
	if s.vault == nil {
		return plain, nil
	}
	return s.vault.EncryptToBase64(plain)
}

func (s *BankStore) open(cipher string) string {
	if cipher == "" {
		return ""
	}
	if s.vault == nil {
		// Fail closed for sealed-looking values so players never see raw ciphertext.
		if looksSealedBankSecret(cipher) {
			return ""
		}
		return cipher
	}
	plain, err := s.vault.DecryptFromBase64(cipher)
	if err != nil {
		if looksSealedBankSecret(cipher) {
			return ""
		}
		// Legacy plaintext rows created before encryption.
		return cipher
	}
	return plain
}

func looksSealedBankSecret(s string) bool {
	raw, err := base64.StdEncoding.DecodeString(s)
	// AES-GCM seal is nonce (12) + tag (16) + at least 1 byte plaintext.
	return err == nil && len(raw) >= 29
}

type UpsertBankInput struct {
	Provider      string
	Label         string
	AccountName   string
	AccountNumber string
	MobileCode    string
	Currency      string
	IsActive      bool
}

func (s *BankStore) ListActive(ctx context.Context) ([]BankAccount, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, provider, label, COALESCE(account_name,''), COALESCE(account_number,''),
		       COALESCE(mobile_code,''), currency, is_active, created_at
		FROM payment_accounts WHERE is_active = TRUE ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []BankAccount{}
	for rows.Next() {
		var b BankAccount
		if err := rows.Scan(&b.ID, &b.Provider, &b.Label, &b.AccountName, &b.AccountNumber, &b.MobileCode, &b.Currency, &b.IsActive, &b.CreatedAt); err != nil {
			return nil, err
		}
		b.AccountNumber = s.open(b.AccountNumber)
		b.MobileCode = s.open(b.MobileCode)
		out = append(out, b)
	}
	return out, nil
}

func (s *BankStore) ListAll(ctx context.Context) ([]BankAccount, error) {
	list, _, err := s.ListPaged(ctx, 0, 10_000, BankListFilter{})
	return list, err
}

// BankListFilter optional Trim-style list filters (empty = no constraint).
type BankListFilter struct {
	Q      string
	Active *bool
}

func bankMatchesFilter(b BankAccount, filter BankListFilter) bool {
	if filter.Active != nil && b.IsActive != *filter.Active {
		return false
	}
	q := strings.ToLower(strings.TrimSpace(filter.Q))
	if q == "" {
		return true
	}
	hay := strings.ToLower(strings.Join([]string{
		b.Label, b.Provider, b.AccountNumber, b.MobileCode, b.Currency, b.ID,
	}, " "))
	return strings.Contains(hay, q)
}

func (s *BankStore) scanAllBankAccounts(ctx context.Context) ([]BankAccount, error) {
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, provider, label, COALESCE(account_name,''), COALESCE(account_number,''),
		       COALESCE(mobile_code,''), currency, is_active, created_at
		FROM payment_accounts ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []BankAccount{}
	for rows.Next() {
		var b BankAccount
		if err := rows.Scan(&b.ID, &b.Provider, &b.Label, &b.AccountName, &b.AccountNumber, &b.MobileCode, &b.Currency, &b.IsActive, &b.CreatedAt); err != nil {
			return nil, err
		}
		b.AccountNumber = s.open(b.AccountNumber)
		b.MobileCode = s.open(b.MobileCode)
		out = append(out, b)
	}
	return out, rows.Err()
}

// ListPaged returns skip/limit page + total (Trim BuildMeta).
func (s *BankStore) ListPaged(ctx context.Context, skip, limit int, filter BankListFilter) ([]BankAccount, int, error) {
	if err := s.requireDB(); err != nil {
		return nil, 0, err
	}
	if skip < 0 {
		skip = 0
	}
	if limit < 1 {
		limit = 100
	}
	filter.Q = strings.TrimSpace(filter.Q)
	hasFilter := filter.Q != "" || filter.Active != nil
	if hasFilter {
		all, err := s.scanAllBankAccounts(ctx)
		if err != nil {
			return nil, 0, err
		}
		matched := []BankAccount{}
		for _, b := range all {
			if bankMatchesFilter(b, filter) {
				matched = append(matched, b)
			}
		}
		total := len(matched)
		if skip >= total {
			return []BankAccount{}, total, nil
		}
		end := skip + limit
		if end > total {
			end = total
		}
		return matched[skip:end], total, nil
	}
	var total int
	if err := s.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM payment_accounts`).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, provider, label, COALESCE(account_name,''), COALESCE(account_number,''),
		       COALESCE(mobile_code,''), currency, is_active, created_at
		FROM payment_accounts ORDER BY created_at ASC
		LIMIT $1 OFFSET $2
	`, limit, skip)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []BankAccount{}
	for rows.Next() {
		var b BankAccount
		if err := rows.Scan(&b.ID, &b.Provider, &b.Label, &b.AccountName, &b.AccountNumber, &b.MobileCode, &b.Currency, &b.IsActive, &b.CreatedAt); err != nil {
			return nil, 0, err
		}
		b.AccountNumber = s.open(b.AccountNumber)
		b.MobileCode = s.open(b.MobileCode)
		out = append(out, b)
	}
	return out, total, rows.Err()
}

func (s *BankStore) Create(ctx context.Context, in UpsertBankInput) (*BankAccount, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	if in.Label == "" || in.Provider == "" {
		return nil, fmt.Errorf("provider and label required")
	}
	if in.Currency == "" {
		return nil, fmt.Errorf("currency required")
	}
	encNum, err := s.seal(in.AccountNumber)
	if err != nil {
		return nil, err
	}
	encMobile, err := s.seal(in.MobileCode)
	if err != nil {
		return nil, err
	}
	b := &BankAccount{
		ID:            uuid.NewString(),
		Provider:      in.Provider,
		Label:         in.Label,
		AccountName:   in.AccountName,
		AccountNumber: in.AccountNumber,
		MobileCode:    in.MobileCode,
		Currency:      in.Currency,
		IsActive:      in.IsActive,
		CreatedAt:     time.Now().UTC(),
	}
	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO payment_accounts (
			id, provider, label, account_name, account_number, mobile_code, currency, is_active, created_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
	`, b.ID, b.Provider, b.Label, nullStr(b.AccountName), nullStr(encNum), nullStr(encMobile), b.Currency, b.IsActive)
	if err != nil {
		return nil, err
	}
	cp := *b
	return &cp, nil
}

func (s *BankStore) SetActive(ctx context.Context, id string, active bool) error {
	if err := s.requireDB(); err != nil {
		return err
	}
	tag, err := s.db.Pool.Exec(ctx, `UPDATE payment_accounts SET is_active=$2 WHERE id=$1`, id, active)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// Update rewrites editable fields on a payment_accounts row.
func (s *BankStore) Update(ctx context.Context, id string, in UpsertBankInput) (*BankAccount, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, fmt.Errorf("bank id required")
	}
	if in.Label == "" || in.Provider == "" {
		return nil, fmt.Errorf("provider and label required")
	}
	if in.Currency == "" {
		return nil, fmt.Errorf("currency required")
	}
	encNum, err := s.seal(in.AccountNumber)
	if err != nil {
		return nil, err
	}
	encMobile, err := s.seal(in.MobileCode)
	if err != nil {
		return nil, err
	}
	tag, err := s.db.Pool.Exec(ctx, `
		UPDATE payment_accounts SET
			provider=$2, label=$3, account_name=$4, account_number=$5,
			mobile_code=$6, currency=$7, is_active=$8
		WHERE id=$1
	`, id, in.Provider, in.Label, nullStr(in.AccountName), nullStr(encNum), nullStr(encMobile), in.Currency, in.IsActive)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return &BankAccount{
		ID:            id,
		Provider:      in.Provider,
		Label:         in.Label,
		AccountName:   in.AccountName,
		AccountNumber: in.AccountNumber,
		MobileCode:    in.MobileCode,
		Currency:      in.Currency,
		IsActive:      in.IsActive,
	}, nil
}

// Delete removes a payment_accounts row.
func (s *BankStore) Delete(ctx context.Context, id string) error {
	if err := s.requireDB(); err != nil {
		return err
	}
	id = strings.TrimSpace(id)
	tag, err := s.db.Pool.Exec(ctx, `DELETE FROM payment_accounts WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func nullStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
