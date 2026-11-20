package payments

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"dama/apps/api/internal/config"
	"dama/apps/api/internal/db"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/store"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Wallet ledger kinds (must match client_enums.wallet_ledger_kinds + wallet_chrome labels).
const (
	LedgerKindEventHostFee              = "event_host_fee"
	LedgerKindEventEntryPaid            = "event_entry_paid"
	LedgerKindEventEntryEarned          = "event_entry_earned"
	LedgerKindEventEntryCommission      = "event_entry_commission"
	LedgerKindEventEntryRefund          = "event_entry_refund"
	LedgerKindEventEntryClawback        = "event_entry_clawback"
	LedgerKindCampaignCreateFee         = "campaign_create_fee"
	LedgerKindPrizePoolGuaranteeHold    = "prize_pool_guarantee_hold"
	LedgerKindPrizePoolGuaranteeRelease = "prize_pool_guarantee_release"
	LedgerKindPrizePoolGuaranteeCapture = "prize_pool_guarantee_capture"
	LedgerKindCompetitionPrizePayout    = "competition_prize_payout"
	LedgerKindTournamentEntryRefund     = "tournament_entry_refund"
)

// RoundMoney2 rounds to 2 decimal places (currency units).
func RoundMoney2(v float64) float64 {
	return math.Round(v*100) / 100
}

// PrizePoolFloor returns max(entryNets, guarantee) after rounding (guaranteed minimum floor).
func PrizePoolFloor(entryNets, guarantee float64) float64 {
	e := RoundMoney2(entryNets)
	g := RoundMoney2(guarantee)
	if g > e {
		return g
	}
	return e
}

// ErrInsufficientWalletBalance is returned when a debit cannot cover the amount.
var ErrInsufficientWalletBalance = errors.New("insufficient wallet balance")

func guaranteeHoldRef(eventID string, cycle int) string {
	eventID = strings.TrimSpace(eventID)
	if cycle < 1 {
		cycle = 1
	}
	return fmt.Sprintf("hosted_event_prize_guarantee:%s:%d", eventID, cycle)
}

func guaranteeReleaseRef(eventID string, cycle int) string {
	eventID = strings.TrimSpace(eventID)
	if cycle < 1 {
		cycle = 1
	}
	return fmt.Sprintf("hosted_event_prize_guarantee_release:%s:%d", eventID, cycle)
}

func guaranteeCaptureRef(eventID string, cycle int) string {
	eventID = strings.TrimSpace(eventID)
	if cycle < 1 {
		cycle = 1
	}
	return fmt.Sprintf("hosted_event_prize_guarantee_capture:%s:%d", eventID, cycle)
}

// SplitEntryFeeCommission returns platform commission and organizer net from a gross entry fee.
func SplitEntryFeeCommission(fee, commissionPercent float64) (commission, net float64) {
	if fee <= 0 {
		return 0, 0
	}
	if commissionPercent < 0 {
		commissionPercent = 0
	}
	if commissionPercent > 100 {
		commissionPercent = 100
	}
	commission = RoundMoney2(fee * commissionPercent / 100)
	if commission > fee {
		commission = fee
	}
	net = RoundMoney2(fee - commission)
	return commission, net
}

func allowMemoryMode() bool {
	return os.Getenv("DAMA_ALLOW_MEMORY") == "1"
}

func (s *Service) requireDB() error {
	if s.db != nil && s.db.Ready() {
		return nil
	}
	if allowMemoryMode() {
		return nil
	}
	return fmt.Errorf("service temporarily unavailable")
}

type Intent struct {
	ID          string         `json:"id"`
	UserID      string         `json:"user_id"`
	Purpose     string         `json:"purpose"`
	Amount      float64        `json:"amount"`
	Currency    string         `json:"currency"`
	Provider    string         `json:"-"` // internal gateway id; use PublicChannel at the boundary
	CountryCode string         `json:"country_code"`
	TxRef       string         `json:"tx_ref"`
	CheckoutURL string         `json:"checkout_url,omitempty"`
	Status      string         `json:"status"`
	Metadata    map[string]any `json:"-"`
	CreatedAt   time.Time      `json:"created_at"`
}

type Receipt struct {
	ID         string     `json:"id"`
	UserID     string     `json:"user_id"`
	Username   string     `json:"username,omitempty"`
	Amount     float64    `json:"amount"`
	Currency   string     `json:"currency"`
	Provider   string     `json:"-"` // internal gateway id; use PublicChannel at the boundary
	Reference  string     `json:"reference"`
	ReceiptURL string     `json:"receipt_url"`
	Status     string     `json:"status"`
	ReviewNote string     `json:"review_note,omitempty"`
	IntentID   string     `json:"intent_id,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	ReviewedAt *time.Time `json:"reviewed_at,omitempty"`
}

// ReceiptDisplayStatus maps settled approved proofs to "paid" for UI/PDF
// (manual approve credits wallet + marks intent paid; gateway intents are already paid).
func ReceiptDisplayStatus(status string) string {
	st := strings.TrimSpace(status)
	if strings.EqualFold(st, "approved") {
		return "paid"
	}
	return st
}

// ReceiptListFilterStatus maps client filter codes to payment_receipts.status.
// "paid" filters settled approved proofs (display Paid).
func ReceiptListFilterStatus(status string) string {
	st := strings.TrimSpace(status)
	if strings.EqualFold(st, "paid") {
		return "approved"
	}
	return st
}

type BankAccount = store.BankAccount

type Service struct {
	cfg      config.Config
	db       *db.Handle
	flags    *store.FlagStore
	banks    *store.BankStore
	settings *store.SettingsStore
	mu       sync.RWMutex
	intents  map[string]*Intent
	byRef    map[string]string
	receipts map[string]*Receipt
	wallets  map[string]float64 // key: userID:currency
}

func NewService(cfg config.Config, handle *db.Handle, flags *store.FlagStore, banks *store.BankStore, settings *store.SettingsStore) *Service {
	return &Service{
		cfg:      cfg,
		db:       handle,
		flags:    flags,
		banks:    banks,
		settings: settings,
		intents:  map[string]*Intent{},
		byRef:    map[string]string{},
		receipts: map[string]*Receipt{},
		wallets:  map[string]float64{},
	}
}

func (s *Service) Flags() store.FeatureFlags {
	return s.flags.Get(context.Background())
}

func (s *Service) CurrencyConfig() store.CurrencyConfig {
	if s.settings == nil {
		return store.CurrencyConfig{Source: "unavailable"}
	}
	return s.settings.Currency()
}

// EthiopiaCountry is the ISO code for domestic routing from platform_settings.geo_payment.
func (s *Service) EthiopiaCountry() string {
	if s.settings == nil {
		return ""
	}
	return s.settings.EthiopiaCountry()
}

func walletKey(userID, currency string) string {
	return userID + ":" + strings.ToUpper(currency)
}

type CheckoutRequest struct {
	UserID      string
	Amount      float64
	Purpose     string
	CountryCode string
	Email       string
	ReturnURL   string
}

type CheckoutResult struct {
	Intent *Intent       `json:"intent"`
	Route  RouteDecision `json:"route"`
	Banks  []BankAccount `json:"banks,omitempty"`
}

func (s *Service) StartCheckout(ctx context.Context, req CheckoutRequest) (*CheckoutResult, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	if req.Amount <= 0 {
		return nil, fmt.Errorf("amount must be positive")
	}
	if req.Purpose == "" {
		req.Purpose = "wallet_topup"
	}
	flags := s.flags.Get(ctx)
	route := ResolveRoute(req.CountryCode, flags, s.CurrencyConfig(), s.EthiopiaCountry())
	if err := route.Validate(); err != nil {
		return nil, err
	}
	txRef := fmt.Sprintf("dama_%s", strings.ReplaceAll(uuid.NewString(), "-", ""))
	intent := &Intent{
		ID:          uuid.NewString(),
		UserID:      req.UserID,
		Purpose:     req.Purpose,
		Amount:      req.Amount,
		Currency:    route.Currency,
		Provider:    route.Provider,
		CountryCode: strings.ToUpper(req.CountryCode),
		TxRef:       txRef,
		Status:      "pending",
		Metadata:    map[string]any{},
		CreatedAt:   time.Now().UTC(),
	}

	switch route.Provider {
	case "chapa":
		if s.cfg.ChapaSecretKey == "" {
			return nil, fmt.Errorf("payment provider temporarily unavailable")
		}
		url, err := s.initChapa(intent, req.Email, req.ReturnURL)
		if err != nil {
			return nil, err
		}
		intent.CheckoutURL = url
	case "paddle":
		if s.cfg.PaddleAPIKey == "" {
			return nil, fmt.Errorf("payment provider temporarily unavailable")
		}
		url, err := s.initPaddle(intent, req.Email)
		if err != nil {
			return nil, err
		}
		intent.CheckoutURL = url
	case "manual":
		intent.Status = "awaiting_receipt"
		// Supersede abandoned manual holds so transactions don't pile up as awaiting_receipt.
		s.cancelUnlinkedAwaitingReceipts(ctx, req.UserID, intent.Currency)
	}

	s.persistIntent(ctx, intent)
	out := &CheckoutResult{Intent: intent, Route: route}
	if route.Provider == "manual" {
		out.Banks = s.ListBanks()
	}
	return out, nil
}

func (s *Service) ListBanks() []BankAccount {
	if s.banks == nil {
		return []BankAccount{}
	}
	list, err := s.banks.ListActive(context.Background())
	if err != nil {
		return []BankAccount{}
	}
	return list
}

// ErrReceiptIntentUnavailable is returned when an explicit intent_id cannot be claimed
// (wrong owner, wrong amount/currency, already linked, or not awaiting proof).
var ErrReceiptIntentUnavailable = errors.New("receipt intent unavailable")

func (s *Service) SubmitManualReceipt(ctx context.Context, userID string, amount float64, currency, reference, receiptURL, intentIDHint string) (*Receipt, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	if amount <= 0 {
		return nil, fmt.Errorf("amount required")
	}
	currency = strings.ToUpper(strings.TrimSpace(currency))
	intentIDHint = strings.TrimSpace(intentIDHint)
	rec := &Receipt{
		ID:         uuid.NewString(),
		UserID:     userID,
		Amount:     amount,
		Currency:   currency,
		Provider:   "manual",
		Reference:  reference,
		ReceiptURL: receiptURL,
		Status:     "pending",
		CreatedAt:  time.Now().UTC(),
	}
	if s.db != nil && s.db.Ready() {
		tx, err := s.db.Pool.Begin(ctx)
		if err != nil {
			return nil, err
		}
		defer tx.Rollback(ctx)

		// Prefer explicit intent claim (Transactions → Submit proof). Else match by amount.
		var intentID string
		if intentIDHint != "" {
			err = tx.QueryRow(ctx, `
				SELECT i.id::text
				FROM payment_intents i
				WHERE i.id = $1::uuid
				  AND i.user_id = $2
				  AND UPPER(TRIM(i.currency)) = $3
				  AND i.amount = $4
				  AND i.provider = 'manual'
				  AND i.status = 'awaiting_receipt'
				  AND i.purpose = 'wallet_topup'
				  AND NOT EXISTS (
				    SELECT 1 FROM payment_receipts r WHERE r.intent_id = i.id
				  )
				FOR UPDATE OF i
			`, intentIDHint, userID, currency, amount).Scan(&intentID)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					return nil, ErrReceiptIntentUnavailable
				}
				return nil, err
			}
		} else {
			// Claim the newest unmatched manual top-up still awaiting proof.
			err = tx.QueryRow(ctx, `
				SELECT i.id::text
				FROM payment_intents i
				WHERE i.user_id = $1
				  AND UPPER(TRIM(i.currency)) = $2
				  AND i.amount = $3
				  AND i.provider = 'manual'
				  AND i.status = 'awaiting_receipt'
				  AND i.purpose = 'wallet_topup'
				  AND NOT EXISTS (
				    SELECT 1 FROM payment_receipts r WHERE r.intent_id = i.id
				  )
				ORDER BY i.created_at DESC, i.id DESC
				FOR UPDATE OF i SKIP LOCKED
				LIMIT 1
			`, userID, currency, amount).Scan(&intentID)
			if err != nil {
				if !errors.Is(err, pgx.ErrNoRows) {
					return nil, err
				}
				intentID = ""
			}
		}
		rec.IntentID = strings.TrimSpace(intentID)

		if rec.IntentID != "" {
			_, err = tx.Exec(ctx, `
				INSERT INTO payment_receipts (id, user_id, amount, currency, provider, reference, receipt_url, status, intent_id, created_at)
				VALUES ($1,$2,$3,$4,'manual',$5,$6,'pending',$7::uuid,NOW())
			`, rec.ID, userID, amount, currency, reference, receiptURL, rec.IntentID)
		} else {
			_, err = tx.Exec(ctx, `
				INSERT INTO payment_receipts (id, user_id, amount, currency, provider, reference, receipt_url, status, created_at)
				VALUES ($1,$2,$3,$4,'manual',$5,$6,'pending',NOW())
			`, rec.ID, userID, amount, currency, reference, receiptURL)
		}
		if err != nil {
			return nil, err
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		return rec, nil
	}
	if !allowMemoryMode() {
		return nil, s.requireDB()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	claimIntent := func(intent *Intent) bool {
		if intent == nil || intent.UserID != userID {
			return false
		}
		if intent.Status != "awaiting_receipt" || intent.Provider != "manual" {
			return false
		}
		if !strings.EqualFold(intent.Currency, currency) || intent.Amount != amount {
			return false
		}
		for _, existing := range s.receipts {
			if existing != nil && existing.IntentID == intent.ID {
				return false
			}
		}
		rec.IntentID = intent.ID
		return true
	}
	if intentIDHint != "" {
		hit := false
		for _, intent := range s.intents {
			if intent == nil || intent.ID != intentIDHint {
				continue
			}
			if !claimIntent(intent) {
				return nil, ErrReceiptIntentUnavailable
			}
			hit = true
			break
		}
		if !hit {
			return nil, ErrReceiptIntentUnavailable
		}
	} else {
		// Memory mode: attach newest matching awaiting intent if present.
		for _, intent := range s.intents {
			if claimIntent(intent) {
				break
			}
		}
	}
	s.receipts[rec.ID] = rec
	return rec, nil
}

// ErrReceiptAlreadyReviewed is returned when a concurrent console/bot review already won
// the pending→approved/rejected transition (dual-actuator conflict → HTTP 409).
var ErrReceiptAlreadyReviewed = errors.New("receipt already reviewed")

// ErrReceiptNotFound is returned when the receipt id does not exist.
var ErrReceiptNotFound = errors.New("receipt not found")

func (s *Service) ReviewReceipt(ctx context.Context, receiptID, adminID string, approve bool, note string) (*Receipt, error) {
	rec, err := s.loadReceipt(ctx, receiptID)
	if err != nil {
		return nil, err
	}
	if rec.Status != "pending" {
		return nil, ErrReceiptAlreadyReviewed
	}
	next := "rejected"
	if approve {
		next = "approved"
	}
	note = strings.TrimSpace(note)
	if s.db != nil && s.db.Ready() {
		tx, err := s.db.Pool.Begin(ctx)
		if err != nil {
			return nil, err
		}
		defer tx.Rollback(ctx)

		// Atomic pending-only transition prevents double-credit on re-approve.
		tag, err := tx.Exec(ctx, `
			UPDATE payment_receipts SET status=$2, reviewed_by=$3, reviewed_at=NOW(), review_note=$4
			WHERE id=$1 AND status='pending'
		`, receiptID, next, adminID, note)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			var exists bool
			if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM payment_receipts WHERE id = $1)`, receiptID).Scan(&exists); err != nil {
				return nil, err
			}
			if !exists {
				return nil, ErrReceiptNotFound
			}
			return nil, ErrReceiptAlreadyReviewed
		}

		if approve {
			intentID := strings.TrimSpace(rec.IntentID)
			if intentID == "" {
				err = tx.QueryRow(ctx, `
					SELECT i.id::text
					FROM payment_intents i
					WHERE i.user_id = $1
					  AND UPPER(TRIM(i.currency)) = UPPER(TRIM($2))
					  AND i.amount = $3
					  AND i.provider = 'manual'
					  AND i.status = 'awaiting_receipt'
					  AND i.purpose = 'wallet_topup'
					  AND NOT EXISTS (
					    SELECT 1 FROM payment_receipts r
					    WHERE r.intent_id = i.id AND r.id <> $4
					  )
					ORDER BY i.created_at DESC, i.id DESC
					FOR UPDATE OF i SKIP LOCKED
					LIMIT 1
				`, rec.UserID, rec.Currency, rec.Amount, receiptID).Scan(&intentID)
				if err != nil {
					if !errors.Is(err, pgx.ErrNoRows) {
						return nil, err
					}
					intentID = ""
				}
				intentID = strings.TrimSpace(intentID)
				if intentID != "" {
					if _, err = tx.Exec(ctx, `
						UPDATE payment_receipts SET intent_id=$2::uuid WHERE id=$1 AND intent_id IS NULL
					`, receiptID, intentID); err != nil {
						return nil, err
					}
				}
			}
			if intentID != "" {
				// Status only - wallet credit stays below (do not call MarkPaidByTxRef; it also credits).
				_, err = tx.Exec(ctx, `
					UPDATE payment_intents SET status='paid', updated_at=NOW()
					WHERE id=$1::uuid AND status='awaiting_receipt'
				`, intentID)
				if err != nil {
					return nil, err
				}
			}
			// Drop sibling abandoned holds for the same top-up amount (extra checkouts before upload).
			if intentID != "" {
				_, err = tx.Exec(ctx, `
					UPDATE payment_intents i
					SET status='cancelled', updated_at=NOW()
					WHERE i.user_id = $1
					  AND UPPER(TRIM(i.currency)) = UPPER(TRIM($2))
					  AND i.amount = $3
					  AND i.provider = 'manual'
					  AND i.status = 'awaiting_receipt'
					  AND i.purpose = 'wallet_topup'
					  AND i.id <> $4::uuid
					  AND NOT EXISTS (
					    SELECT 1 FROM payment_receipts r
					    WHERE r.intent_id = i.id AND r.status = 'pending'
					  )
				`, rec.UserID, rec.Currency, rec.Amount, intentID)
			} else {
				_, err = tx.Exec(ctx, `
					UPDATE payment_intents i
					SET status='cancelled', updated_at=NOW()
					WHERE i.user_id = $1
					  AND UPPER(TRIM(i.currency)) = UPPER(TRIM($2))
					  AND i.amount = $3
					  AND i.provider = 'manual'
					  AND i.status = 'awaiting_receipt'
					  AND i.purpose = 'wallet_topup'
					  AND NOT EXISTS (
					    SELECT 1 FROM payment_receipts r
					    WHERE r.intent_id = i.id AND r.status = 'pending'
					  )
				`, rec.UserID, rec.Currency, rec.Amount)
			}
			if err != nil {
				return nil, err
			}
			_, err = tx.Exec(ctx, `
				INSERT INTO wallets (user_id, currency, balance, updated_at)
				VALUES ($1,$2,$3,NOW())
				ON CONFLICT (user_id, currency) DO UPDATE
				SET balance = wallets.balance + EXCLUDED.balance, updated_at=NOW()
			`, rec.UserID, rec.Currency, rec.Amount)
			if err != nil {
				return nil, err
			}
		}

		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		return s.loadReceipt(ctx, receiptID)
	}
	if !allowMemoryMode() {
		return nil, s.requireDB()
	}
	s.mu.Lock()
	if existing, ok := s.receipts[receiptID]; ok && existing.Status != "pending" {
		s.mu.Unlock()
		return nil, ErrReceiptAlreadyReviewed
	}
	rec.Status = next
	rec.ReviewNote = note
	s.receipts[rec.ID] = rec
	if approve {
		if id := strings.TrimSpace(rec.IntentID); id != "" {
			if intent, ok := s.intents[id]; ok && intent.Status == "awaiting_receipt" {
				intent.Status = "paid"
			}
		}
		s.creditWalletLocked(rec.UserID, rec.Currency, rec.Amount)
	}
	cp := *rec
	s.mu.Unlock()
	return &cp, nil
}

// GetReceipt loads a payment receipt by id (console / PDF).
func (s *Service) GetReceipt(ctx context.Context, receiptID string) (*Receipt, error) {
	return s.loadReceipt(ctx, receiptID)
}

// GetUserReceipt loads a receipt owned by userID (player PDF / detail).
func (s *Service) GetUserReceipt(ctx context.Context, receiptID, userID string) (*Receipt, error) {
	rec, err := s.loadReceipt(ctx, receiptID)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(rec.UserID) != strings.TrimSpace(userID) {
		return nil, ErrReceiptNotFound
	}
	return rec, nil
}

func (s *Service) loadReceipt(ctx context.Context, receiptID string) (*Receipt, error) {
	receiptID = strings.TrimSpace(receiptID)
	if receiptID == "" {
		return nil, ErrReceiptNotFound
	}
	if _, err := uuid.Parse(receiptID); err != nil {
		// Invalid id shape is not-found for callers (never invent a 500 from uuid parse).
		return nil, ErrReceiptNotFound
	}
	if s.db != nil && s.db.Ready() {
		var rec Receipt
		var intentID *string
		err := s.db.Pool.QueryRow(ctx, `
			SELECT id, user_id, amount, currency, provider, COALESCE(reference,''), COALESCE(receipt_url,''), status,
			       COALESCE(review_note,''), intent_id::text, created_at, reviewed_at
			FROM payment_receipts WHERE id=$1
		`, receiptID).Scan(
			&rec.ID, &rec.UserID, &rec.Amount, &rec.Currency, &rec.Provider, &rec.Reference, &rec.ReceiptURL, &rec.Status,
			&rec.ReviewNote, &intentID, &rec.CreatedAt, &rec.ReviewedAt,
		)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, ErrReceiptNotFound
			}
			return nil, err
		}
		if intentID != nil {
			rec.IntentID = strings.TrimSpace(*intentID)
		}
		return &rec, nil
	}
	if !allowMemoryMode() {
		return nil, s.requireDB()
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	if rec, ok := s.receipts[receiptID]; ok {
		cp := *rec
		return &cp, nil
	}
	return nil, ErrReceiptNotFound
}

func (s *Service) ListPendingReceipts(ctx context.Context) []Receipt {
	list, _, err := s.ListPendingReceiptsPaged(ctx, 0, 100, "", "pending")
	if err != nil {
		return []Receipt{}
	}
	return list
}

// WalletTxn is a player-facing ledger row (top-ups + payouts).
type WalletTxn struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id,omitempty"`
	Username   string    `json:"username,omitempty"`
	Kind       string    `json:"kind"`
	Amount     float64   `json:"amount"`
	Currency   string    `json:"currency"`
	Status     string    `json:"status"`
	Reference  string    `json:"reference"`
	Provider   string    `json:"provider"`
	CreatedAt  time.Time `json:"created_at"`
	ReceiptURL string    `json:"receipt_url,omitempty"`
	// ReceiptID links View receipt → /receipts/{id} (orphan receipt id or intent-linked proof).
	ReceiptID string `json:"receipt_id,omitempty"`
	// ReceiptStatus is the linked payment_receipts.status when ReceiptID is set.
	ReceiptStatus string `json:"receipt_status,omitempty"`
}

// ListUserReceiptsPaged returns the signed-in player's payment receipts (newest first).
func (s *Service) ListUserReceiptsPaged(ctx context.Context, userID string, skip, limit int, q string) ([]Receipt, int) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return []Receipt{}, 0
	}
	if skip < 0 {
		skip = 0
	}
	if limit < 1 || limit > 100 {
		return []Receipt{}, 0
	}
	q = strings.TrimSpace(q)
	if s.db == nil || !s.db.Ready() {
		return []Receipt{}, 0
	}
	var total int
	countSQL := `SELECT COUNT(*) FROM payment_receipts WHERE user_id = $1`
	listSQL := `
		SELECT id, user_id, amount, currency, provider, COALESCE(reference,''), COALESCE(receipt_url,''), status,
		       intent_id::text, created_at, reviewed_at
		FROM payment_receipts WHERE user_id = $1`
	args := []any{userID}
	if q != "" {
		// Include id so notification deep links /receipts?id= can seed search.
		countSQL += ` AND (id::text ILIKE $2 OR reference ILIKE $2 OR status ILIKE $2 OR CAST(amount AS TEXT) ILIKE $2)`
		listSQL += ` AND (id::text ILIKE $2 OR reference ILIKE $2 OR status ILIKE $2 OR CAST(amount AS TEXT) ILIKE $2)`
		args = append(args, "%"+q+"%")
	}
	if err := s.db.Pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return []Receipt{}, 0
	}
	listSQL += ` ORDER BY created_at DESC LIMIT $` + fmt.Sprintf("%d", len(args)+1) + ` OFFSET $` + fmt.Sprintf("%d", len(args)+2)
	args = append(args, limit, skip)
	rows, err := s.db.Pool.Query(ctx, listSQL, args...)
	if err != nil {
		return []Receipt{}, 0
	}
	defer rows.Close()
	out := []Receipt{}
	for rows.Next() {
		var rec Receipt
		var intentID *string
		if err := rows.Scan(
			&rec.ID, &rec.UserID, &rec.Amount, &rec.Currency, &rec.Provider, &rec.Reference, &rec.ReceiptURL, &rec.Status,
			&intentID, &rec.CreatedAt, &rec.ReviewedAt,
		); err != nil {
			continue
		}
		if intentID != nil {
			rec.IntentID = strings.TrimSpace(*intentID)
		}
		out = append(out, rec)
	}
	return out, total
}

// ListUserTransactionsPaged unions payment intents + payout requests for the player.
func (s *Service) ListUserTransactionsPaged(ctx context.Context, userID string, skip, limit int, q string) ([]WalletTxn, int) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return []WalletTxn{}, 0
	}
	if skip < 0 {
		skip = 0
	}
	if limit < 1 || limit > 100 {
		return []WalletTxn{}, 0
	}
	q = strings.TrimSpace(q)
	if s.db == nil || !s.db.Ready() {
		return []WalletTxn{}, 0
	}
	like := "%" + q + "%"
	// Orphan payment_receipts (no intent_id) are real top-ups credited on approve but
	// never appear in payment_intents - include them so Transactions matches Receipts.
	countSQL := `
		SELECT COUNT(*) FROM (
			SELECT id FROM payment_intents WHERE user_id = $1
			UNION ALL
			SELECT id FROM payout_requests WHERE user_id = $1
			UNION ALL
			SELECT id FROM wallet_ledger WHERE user_id = $1
			UNION ALL
			SELECT id FROM payment_receipts WHERE user_id = $1 AND intent_id IS NULL
		) t`
	listSQL := `
		SELECT id, kind, amount, currency, status, reference, provider, created_at FROM (
			SELECT id::text AS id, 'topup' AS kind, amount, currency, status,
			       COALESCE(tx_ref,'') AS reference, provider, created_at
			FROM payment_intents WHERE user_id = $1
			UNION ALL
			SELECT id::text AS id, 'payout' AS kind, amount, currency, status,
			       COALESCE(phone,'') AS reference, provider, created_at
			FROM payout_requests WHERE user_id = $1
			UNION ALL
			SELECT id::text AS id, kind, amount, currency, status,
			       COALESCE(reference,'') AS reference, provider, created_at
			FROM wallet_ledger WHERE user_id = $1
			UNION ALL
			SELECT id::text AS id, 'topup' AS kind, amount, currency, status,
			       COALESCE(reference,''), provider, created_at
			FROM payment_receipts WHERE user_id = $1 AND intent_id IS NULL
		) u`
	args := []any{userID}
	if q != "" {
		// Match id::text so notification deep-links (?id= UUID) resolve like receipts.
		countSQL = `
			SELECT COUNT(*) FROM (
				SELECT id FROM payment_intents
				WHERE user_id = $1 AND (id::text ILIKE $2 OR status ILIKE $2 OR purpose ILIKE $2 OR tx_ref ILIKE $2 OR CAST(amount AS TEXT) ILIKE $2)
				UNION ALL
				SELECT id FROM payout_requests
				WHERE user_id = $1 AND (id::text ILIKE $2 OR status ILIKE $2 OR provider ILIKE $2 OR phone ILIKE $2 OR CAST(amount AS TEXT) ILIKE $2)
				UNION ALL
				SELECT id FROM wallet_ledger
				WHERE user_id = $1 AND (id::text ILIKE $2 OR status ILIKE $2 OR kind ILIKE $2 OR reference ILIKE $2 OR CAST(amount AS TEXT) ILIKE $2)
				UNION ALL
				SELECT id FROM payment_receipts
				WHERE user_id = $1 AND intent_id IS NULL
				  AND (id::text ILIKE $2 OR status ILIKE $2 OR reference ILIKE $2 OR CAST(amount AS TEXT) ILIKE $2)
			) t`
		listSQL += ` WHERE id ILIKE $2 OR status ILIKE $2 OR kind ILIKE $2 OR reference ILIKE $2 OR CAST(amount AS TEXT) ILIKE $2`
		args = append(args, like)
	}
	var total int
	if err := s.db.Pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return []WalletTxn{}, 0
	}
	listSQL += ` ORDER BY created_at DESC LIMIT $` + fmt.Sprintf("%d", len(args)+1) + ` OFFSET $` + fmt.Sprintf("%d", len(args)+2)
	args = append(args, limit, skip)
	rows, err := s.db.Pool.Query(ctx, listSQL, args...)
	if err != nil {
		return []WalletTxn{}, 0
	}
	defer rows.Close()
	out := []WalletTxn{}
	topupIDs := []string{}
	for rows.Next() {
		var t WalletTxn
		var provider string
		if err := rows.Scan(&t.ID, &t.Kind, &t.Amount, &t.Currency, &t.Status, &t.Reference, &provider, &t.CreatedAt); err != nil {
			continue
		}
		t.Provider = PublicChannel(provider)
		if strings.EqualFold(strings.TrimSpace(t.Kind), "topup") {
			topupIDs = append(topupIDs, t.ID)
		}
		out = append(out, t)
	}
	s.attachTopupReceiptProof(ctx, out, topupIDs)
	return out, total
}

// ConsoleWalletTxn is an admin console money movement row (all users).
type ConsoleWalletTxn struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	Kind       string    `json:"kind"`
	Amount     float64   `json:"amount"`
	Currency   string    `json:"currency"`
	Status     string    `json:"status"`
	Reference  string    `json:"reference"`
	Provider   string    `json:"provider"`
	CreatedAt  time.Time `json:"created_at"`
	ReceiptURL string    `json:"receipt_url,omitempty"`
	ReceiptID  string    `json:"receipt_id,omitempty"`
	// ReceiptStatus is the linked payment_receipts.status when ReceiptID is set.
	ReceiptStatus string `json:"receipt_status,omitempty"`
}

type topupReceiptProof struct {
	ReceiptID string
	URL       string
	Status    string
}

// receiptURLsByTopupIntentIDs returns the newest non-empty proof URL per manual top-up intent.
// Prefer intent_id link; fall back to matching receipt.reference = intent.tx_ref.
func (s *Service) receiptURLsByTopupIntentIDs(ctx context.Context, intentIDs []string) map[string]string {
	proofs := s.receiptProofByTopupIntentIDs(ctx, intentIDs)
	out := make(map[string]string, len(proofs))
	for id, p := range proofs {
		if u := strings.TrimSpace(p.URL); u != "" {
			out[id] = u
		}
	}
	return out
}

func (s *Service) receiptProofByTopupIntentIDs(ctx context.Context, intentIDs []string) map[string]topupReceiptProof {
	out := map[string]topupReceiptProof{}
	if s.db == nil || !s.db.Ready() || len(intentIDs) == 0 {
		return out
	}
	ids := make([]string, 0, len(intentIDs))
	seen := map[string]struct{}{}
	for _, raw := range intentIDs {
		id := strings.TrimSpace(raw)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return out
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT DISTINCT ON (i.id)
			i.id::text,
			pr.id::text,
			NULLIF(trim(pr.receipt_url), ''),
			COALESCE(NULLIF(trim(pr.status), ''), '')
		FROM payment_intents i
		INNER JOIN payment_receipts pr
			ON pr.user_id = i.user_id
			AND (
				pr.intent_id = i.id
				OR (
					NULLIF(trim(pr.reference), '') IS NOT NULL
					AND NULLIF(trim(i.tx_ref), '') IS NOT NULL
					AND pr.reference = i.tx_ref
				)
				OR (
					pr.amount = i.amount
					AND UPPER(TRIM(pr.currency)) = UPPER(TRIM(i.currency))
					AND pr.created_at >= i.created_at - INTERVAL '14 days'
					AND pr.created_at <= i.created_at + INTERVAL '14 days'
				)
			)
		WHERE i.id::text = ANY($1::text[])
		ORDER BY i.id,
			CASE
				WHEN pr.intent_id = i.id THEN 0
				WHEN NULLIF(trim(pr.reference), '') IS NOT NULL AND pr.reference = i.tx_ref THEN 1
				ELSE 2
			END,
			CASE WHEN NULLIF(trim(pr.receipt_url), '') IS NOT NULL THEN 0 ELSE 1 END,
			ABS(EXTRACT(EPOCH FROM (pr.created_at - i.created_at))) ASC,
			pr.created_at DESC NULLS LAST
	`, ids)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var intentID, receiptID, status string
		var url *string
		if err := rows.Scan(&intentID, &receiptID, &url, &status); err != nil {
			continue
		}
		p := topupReceiptProof{
			ReceiptID: strings.TrimSpace(receiptID),
			Status:    strings.TrimSpace(status),
		}
		if url != nil {
			p.URL = strings.TrimSpace(*url)
		}
		if p.ReceiptID != "" || p.URL != "" {
			out[intentID] = p
		}
	}
	return out
}

// receiptProofByReceiptIDs loads proof URL for orphan receipt rows (id is payment_receipts.id).
func (s *Service) receiptProofByReceiptIDs(ctx context.Context, receiptIDs []string) map[string]topupReceiptProof {
	out := map[string]topupReceiptProof{}
	if s.db == nil || !s.db.Ready() || len(receiptIDs) == 0 {
		return out
	}
	ids := make([]string, 0, len(receiptIDs))
	seen := map[string]struct{}{}
	for _, raw := range receiptIDs {
		id := strings.TrimSpace(raw)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return out
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id::text,
		       COALESCE(NULLIF(trim(receipt_url), ''), ''),
		       COALESCE(NULLIF(trim(status), ''), '')
		FROM payment_receipts
		WHERE id::text = ANY($1::text[])
	`, ids)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var id, url, status string
		if err := rows.Scan(&id, &url, &status); err != nil {
			continue
		}
		id = strings.TrimSpace(id)
		url = strings.TrimSpace(url)
		status = strings.TrimSpace(status)
		if id == "" {
			continue
		}
		out[id] = topupReceiptProof{ReceiptID: id, URL: url, Status: status}
	}
	return out
}

func applyTopupReceiptProof(p topupReceiptProof, receiptURL, receiptID, receiptStatus *string) {
	if u := strings.TrimSpace(p.URL); u != "" {
		*receiptURL = u
	}
	if rid := strings.TrimSpace(p.ReceiptID); rid != "" {
		*receiptID = rid
	}
	if st := strings.TrimSpace(p.Status); st != "" {
		*receiptStatus = ReceiptDisplayStatus(st)
	}
}

func (s *Service) attachTopupReceiptProof(ctx context.Context, out []WalletTxn, topupIDs []string) {
	if len(out) == 0 || len(topupIDs) == 0 {
		return
	}
	byIntent := s.receiptProofByTopupIntentIDs(ctx, topupIDs)
	byReceipt := s.receiptProofByReceiptIDs(ctx, topupIDs)
	for i := range out {
		if !strings.EqualFold(strings.TrimSpace(out[i].Kind), "topup") {
			continue
		}
		id := strings.TrimSpace(out[i].ID)
		if p, ok := byIntent[id]; ok {
			applyTopupReceiptProof(p, &out[i].ReceiptURL, &out[i].ReceiptID, &out[i].ReceiptStatus)
			continue
		}
		if p, ok := byReceipt[id]; ok {
			applyTopupReceiptProof(p, &out[i].ReceiptURL, &out[i].ReceiptID, &out[i].ReceiptStatus)
			// Orphan receipt rows use payment_receipts.status as the txn status.
			out[i].Status = ReceiptDisplayStatus(out[i].Status)
		}
	}
}

func (s *Service) attachConsoleTopupReceiptProof(ctx context.Context, out []ConsoleWalletTxn, topupIDs []string) {
	if len(out) == 0 || len(topupIDs) == 0 {
		return
	}
	byIntent := s.receiptProofByTopupIntentIDs(ctx, topupIDs)
	byReceipt := s.receiptProofByReceiptIDs(ctx, topupIDs)
	for i := range out {
		if !strings.EqualFold(strings.TrimSpace(out[i].Kind), "topup") {
			continue
		}
		id := strings.TrimSpace(out[i].ID)
		if p, ok := byIntent[id]; ok {
			applyTopupReceiptProof(p, &out[i].ReceiptURL, &out[i].ReceiptID, &out[i].ReceiptStatus)
			continue
		}
		if p, ok := byReceipt[id]; ok {
			applyTopupReceiptProof(p, &out[i].ReceiptURL, &out[i].ReceiptID, &out[i].ReceiptStatus)
			// Orphan receipt rows use payment_receipts.status as the txn status.
			out[i].Status = ReceiptDisplayStatus(out[i].Status)
		}
	}
}

// ListConsoleTransactionsPaged unions intents + payouts + ledger across all users.
// Optional status/kind are exact (case-insensitive); q matches id/status/kind/reference/amount/user.
func (s *Service) ListConsoleTransactionsPaged(ctx context.Context, skip, limit int, q, status, kind string) ([]ConsoleWalletTxn, int) {
	if skip < 0 {
		skip = 0
	}
	if limit < 1 || limit > 100 {
		return []ConsoleWalletTxn{}, 0
	}
	q = strings.TrimSpace(q)
	status = strings.TrimSpace(status)
	kind = strings.TrimSpace(kind)
	if s.db == nil || !s.db.Ready() {
		return []ConsoleWalletTxn{}, 0
	}
	unionSQL := `
			SELECT id::text AS id, user_id::text AS user_id, 'topup' AS kind, amount, currency, status,
			       COALESCE(tx_ref,'') AS reference, provider, created_at
			FROM payment_intents
			UNION ALL
			SELECT id::text AS id, user_id::text AS user_id, 'payout' AS kind, amount, currency, status,
			       COALESCE(phone,'') AS reference, provider, created_at
			FROM payout_requests
			UNION ALL
			SELECT id::text AS id, user_id::text AS user_id, kind, amount, currency, status,
			       COALESCE(reference,'') AS reference, provider, created_at
			FROM wallet_ledger
			UNION ALL
			SELECT id::text AS id, user_id::text AS user_id, 'topup' AS kind, amount, currency, status,
			       COALESCE(reference,''), provider, created_at
			FROM payment_receipts WHERE intent_id IS NULL`
	// status=paid also matches orphan receipt rows (payment_receipts.status=approved, kind=topup).
	where := ` WHERE ($1 = '' OR lower(status) = lower($1)
		OR (lower($1) = 'paid' AND lower(status) = 'approved' AND lower(kind) = 'topup'))
		AND ($2 = '' OR lower(kind) = lower($2))
		AND ($3 = '' OR id ILIKE $3 OR status ILIKE $3 OR kind ILIKE $3 OR reference ILIKE $3
		     OR CAST(amount AS TEXT) ILIKE $3 OR user_id ILIKE $3 OR provider ILIKE $3)`
	like := ""
	if q != "" {
		like = "%" + q + "%"
	}
	args := []any{status, kind, like}
	countSQL := `SELECT COUNT(*) FROM (` + unionSQL + `) t` + where
	listSQL := `SELECT id, user_id, kind, amount, currency, status, reference, provider, created_at FROM (` + unionSQL + `) u` + where
	var total int
	if err := s.db.Pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return []ConsoleWalletTxn{}, 0
	}
	listSQL += ` ORDER BY created_at DESC LIMIT $4 OFFSET $5`
	args = append(args, limit, skip)
	rows, err := s.db.Pool.Query(ctx, listSQL, args...)
	if err != nil {
		return []ConsoleWalletTxn{}, 0
	}
	defer rows.Close()
	out := []ConsoleWalletTxn{}
	topupIDs := []string{}
	for rows.Next() {
		var t ConsoleWalletTxn
		var provider string
		if err := rows.Scan(&t.ID, &t.UserID, &t.Kind, &t.Amount, &t.Currency, &t.Status, &t.Reference, &provider, &t.CreatedAt); err != nil {
			continue
		}
		t.Provider = PublicChannel(provider)
		if strings.EqualFold(strings.TrimSpace(t.Kind), "topup") {
			topupIDs = append(topupIDs, t.ID)
		}
		out = append(out, t)
	}
	s.attachConsoleTopupReceiptProof(ctx, out, topupIDs)
	return out, total
}

// ListPendingReceiptsPaged returns a skip/limit page plus total (Trim BuildMeta).
// Optional status is exact (case-insensitive); empty status = all statuses.
// Optional q matches id/reference/status/amount. DB errors are returned (never swallowed as empty).
func (s *Service) ListPendingReceiptsPaged(ctx context.Context, skip, limit int, q, status string) ([]Receipt, int, error) {
	if skip < 0 {
		skip = 0
	}
	if limit < 1 {
		limit = 10
	}
	if limit > 200 {
		limit = 200
	}
	q = strings.TrimSpace(q)
	status = ReceiptListFilterStatus(status)
	like := ""
	if q != "" {
		like = "%" + q + "%"
	}
	if s.db != nil && s.db.Ready() {
		const where = ` WHERE ($1 = '' OR lower(status) = lower($1))
			AND ($2 = '' OR id::text ILIKE $2 OR COALESCE(reference,'') ILIKE $2
			     OR status ILIKE $2 OR CAST(amount AS TEXT) ILIKE $2)`
		var total int
		if err := s.db.Pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM payment_receipts`+where, status, like).Scan(&total); err != nil {
			return nil, 0, err
		}
		rows, err := s.db.Pool.Query(ctx, `
			SELECT id, user_id, amount, currency, provider, COALESCE(reference,''), COALESCE(receipt_url,''), status,
			       intent_id::text, created_at, reviewed_at
			FROM payment_receipts`+where+`
			ORDER BY created_at DESC
			LIMIT $3 OFFSET $4
		`, status, like, limit, skip)
		if err != nil {
			return nil, 0, err
		}
		defer rows.Close()
		out := []Receipt{}
		for rows.Next() {
			var rec Receipt
			var intentID *string
			if err := rows.Scan(
				&rec.ID, &rec.UserID, &rec.Amount, &rec.Currency, &rec.Provider, &rec.Reference, &rec.ReceiptURL, &rec.Status,
				&intentID, &rec.CreatedAt, &rec.ReviewedAt,
			); err != nil {
				return nil, 0, err
			}
			if intentID != nil {
				rec.IntentID = strings.TrimSpace(*intentID)
			}
			out = append(out, rec)
		}
		if err := rows.Err(); err != nil {
			return nil, 0, err
		}
		return out, total, nil
	}
	if !allowMemoryMode() {
		return nil, 0, fmt.Errorf("service temporarily unavailable")
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	all := []Receipt{}
	ql := strings.ToLower(q)
	st := strings.ToLower(status)
	for _, r := range s.receipts {
		if st != "" && !strings.EqualFold(strings.TrimSpace(r.Status), st) {
			continue
		}
		if ql != "" {
			hay := strings.ToLower(r.ID + " " + r.Reference + " " + r.Status + " " + fmt.Sprintf("%v", r.Amount))
			if !strings.Contains(hay, ql) {
				continue
			}
		}
		all = append(all, *r)
	}
	total := len(all)
	if skip >= total {
		return []Receipt{}, total, nil
	}
	end := skip + limit
	if end > total {
		end = total
	}
	return all[skip:end], total, nil
}

func (s *Service) WalletBalance(ctx context.Context, userID, currency string) float64 {
	if currency == "" {
		// No silent default currency. Callers must pass geo/DB-resolved currency.
		return 0
	}
	currency = strings.ToUpper(currency)
	if s.db != nil && s.db.Ready() {
		var bal float64
		err := s.db.Pool.QueryRow(ctx, `
			SELECT balance FROM wallets WHERE user_id=$1 AND currency=$2
		`, userID, currency).Scan(&bal)
		if err == nil {
			return bal
		}
		// No row yet means zero balance in DB mode.
		return 0
	}
	if !allowMemoryMode() {
		return 0
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.wallets[walletKey(userID, currency)]
}

func (s *Service) creditWalletDB(ctx context.Context, userID, currency string, amount float64) error {
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO wallets (user_id, currency, balance, updated_at)
		VALUES ($1,$2,$3,NOW())
		ON CONFLICT (user_id, currency) DO UPDATE SET balance = wallets.balance + EXCLUDED.balance, updated_at=NOW()
	`, userID, currency, amount)
	return err
}

func (s *Service) WalletSnapshot(ctx context.Context, userID, countryCode string) map[string]any {
	cur := s.CurrencyConfig()
	display := ""
	source := cur.Source
	if cur.Source == "database" {
		if s.settings != nil {
			display = s.settings.CurrencyForCountry(countryCode)
		}
		if display == "" || s.EthiopiaCountry() == "" {
			source = "unavailable"
			display = ""
		}
	}
	bal := s.WalletBalance(ctx, userID, display)
	// Public wallet payload: balance + display currency only.
	// "source" is for the REST handler gate; stripped before the response is written.
	return map[string]any{
		"balance":      bal,
		"currency":     display,
		"country_code": strings.ToUpper(countryCode),
		"source":       source,
	}
}

// CreditWallet adds amount to the wallet (enrollment compensation / admin credit).
func (s *Service) CreditWallet(ctx context.Context, userID string, amount float64, currency string) error {
	if amount <= 0 {
		return nil
	}
	currency = strings.ToUpper(currency)
	if currency == "" {
		return fmt.Errorf("currency required")
	}
	if err := s.requireDB(); err != nil {
		return err
	}
	if s.db != nil && s.db.Ready() {
		return s.creditWalletDB(ctx, userID, currency, amount)
	}
	if !allowMemoryMode() {
		return s.requireDB()
	}
	s.mu.Lock()
	s.creditWalletLocked(userID, currency, amount)
	s.mu.Unlock()
	return nil
}

// RejectPayoutAndRefund atomically transitions a payout to rejected and restores the wallet hold.
// Same safety model as ReviewReceipt: status + credit commit together so a credit failure
// cannot leave funds stuck on an already-rejected payout (retry would hit fromStatus conflict).
func (s *Service) RejectPayoutAndRefund(ctx context.Context, id, fromStatus, rejectedStatus, note, reviewerID string) (*store.PayoutRequest, error) {
	id = strings.TrimSpace(id)
	fromStatus = strings.TrimSpace(fromStatus)
	rejectedStatus = strings.TrimSpace(rejectedStatus)
	note = strings.TrimSpace(note)
	reviewerID = strings.TrimSpace(reviewerID)
	if id == "" || fromStatus == "" || rejectedStatus == "" || reviewerID == "" {
		return nil, fmt.Errorf("review fields required")
	}
	if _, err := uuid.Parse(id); err != nil {
		return nil, store.ErrPayoutNotFound
	}
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	if s.db == nil || !s.db.Ready() {
		return nil, s.requireDB()
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		UPDATE payout_requests
		SET status = $2, review_note = $3, reviewed_by = $4, reviewed_at = NOW()
		WHERE id = $1 AND status = $5
	`, id, rejectedStatus, note, reviewerID, fromStatus)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		var exists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM payout_requests WHERE id = $1)`, id).Scan(&exists); err != nil {
			return nil, err
		}
		if !exists {
			return nil, store.ErrPayoutNotFound
		}
		return nil, store.ErrPayoutTransitionConflict
	}

	var r store.PayoutRequest
	err = tx.QueryRow(ctx, `
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
			return nil, store.ErrPayoutNotFound
		}
		return nil, err
	}

	amount := RoundMoney2(r.Amount)
	currency := strings.ToUpper(strings.TrimSpace(r.Currency))
	if amount > 0 && currency != "" {
		if _, err := tx.Exec(ctx, `
			INSERT INTO wallets (user_id, currency, balance, updated_at)
			VALUES ($1,$2,$3,NOW())
			ON CONFLICT (user_id, currency) DO UPDATE SET balance = wallets.balance + EXCLUDED.balance, updated_at=NOW()
		`, r.UserID, currency, amount); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &r, nil
}

// SettleEventEntryFee debits the joiner, credits organizer net, and posts ledger rows
// in one DB transaction. Platform commission is retained by omission (ledger-only row).
func (s *Service) SettleEventEntryFee(
	ctx context.Context,
	playerID, organizerID string,
	fee, commission, organizerNet float64,
	currency, entryID string,
) error {
	playerID = strings.TrimSpace(playerID)
	organizerID = strings.TrimSpace(organizerID)
	currency = strings.ToUpper(strings.TrimSpace(currency))
	entryID = strings.TrimSpace(entryID)
	fee = RoundMoney2(fee)
	commission = RoundMoney2(commission)
	organizerNet = RoundMoney2(organizerNet)
	if playerID == "" || currency == "" || fee <= 0 || entryID == "" {
		return fmt.Errorf("invalid entry fee settle")
	}
	if err := s.requireDB(); err != nil {
		return err
	}
	if s.db == nil || !s.db.Ready() {
		return s.requireDB()
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	refPaid := "hosted_event_entry:" + entryID
	var already bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM wallet_ledger WHERE reference = $1 AND kind = $2
		)`, refPaid, LedgerKindEventEntryPaid).Scan(&already); err != nil {
		return err
	}
	if already {
		return tx.Commit(ctx)
	}

	tag, err := tx.Exec(ctx, `
		UPDATE wallets SET balance = balance - $3, updated_at=NOW()
		WHERE user_id=$1 AND currency=$2 AND balance >= $3
	`, playerID, currency, fee)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("insufficient wallet balance in %s", currency)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO wallet_ledger (user_id, kind, amount, currency, status, reference, provider)
		VALUES ($1,$2,$3,$4,'posted',$5,'wallet')`,
		playerID, LedgerKindEventEntryPaid, fee, currency, refPaid); err != nil {
		return err
	}

	if organizerNet > 0 && organizerID != "" {
		if _, err := tx.Exec(ctx, `
			INSERT INTO wallets (user_id, currency, balance, updated_at)
			VALUES ($1,$2,$3,NOW())
			ON CONFLICT (user_id, currency) DO UPDATE
			SET balance = wallets.balance + EXCLUDED.balance, updated_at = NOW()
		`, organizerID, currency, organizerNet); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO wallet_ledger (user_id, kind, amount, currency, status, reference, provider)
			VALUES ($1,$2,$3,$4,'posted',$5,'wallet')`,
			organizerID, LedgerKindEventEntryEarned, organizerNet, currency, refPaid); err != nil {
			return err
		}
	}
	if commission > 0 && organizerID != "" {
		if _, err := tx.Exec(ctx, `
			INSERT INTO wallet_ledger (user_id, kind, amount, currency, status, reference, provider)
			VALUES ($1,$2,$3,$4,'posted',$5,'wallet')`,
			organizerID, LedgerKindEventEntryCommission, commission, currency,
			"hosted_event_entry_commission:"+entryID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// LedgerIDByUserKindRef returns the newest wallet_ledger id for user+kind+reference (empty if none).
func (s *Service) LedgerIDByUserKindRef(ctx context.Context, userID, kind, reference string) string {
	userID = strings.TrimSpace(userID)
	kind = strings.TrimSpace(kind)
	reference = strings.TrimSpace(reference)
	if userID == "" || kind == "" || reference == "" || s.db == nil || !s.db.Ready() {
		return ""
	}
	var id string
	err := s.db.Pool.QueryRow(ctx, `
		SELECT id::text FROM wallet_ledger
		WHERE user_id = $1 AND kind = $2 AND reference = $3
		ORDER BY created_at DESC
		LIMIT 1
	`, userID, kind, reference).Scan(&id)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(id)
}

// ErrPrizePoolGuaranteeHoldRace means another txn already posted the hold (UNIQUE conflict).
var ErrPrizePoolGuaranteeHoldRace = errors.New("prize pool guarantee hold race")

type walletExec interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// SettleHostFee debits the organizer host fee and posts the host-fee ledger in one transaction.
func (s *Service) SettleHostFee(ctx context.Context, organizerID string, amount float64, currency, eventID string) error {
	if err := s.requireDB(); err != nil {
		return err
	}
	if s.db == nil || !s.db.Ready() {
		return s.requireDB()
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := s.SettleHostFeeTx(ctx, tx, organizerID, amount, currency, eventID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// SettleHostFeeTx posts host fee on an open transaction (create escrow atomic path).
func (s *Service) SettleHostFeeTx(ctx context.Context, tx walletExec, organizerID string, amount float64, currency, eventID string) error {
	if tx == nil {
		return fmt.Errorf("database unavailable")
	}
	organizerID = strings.TrimSpace(organizerID)
	currency = strings.ToUpper(strings.TrimSpace(currency))
	eventID = strings.TrimSpace(eventID)
	amount = RoundMoney2(amount)
	if organizerID == "" || currency == "" || amount <= 0 || eventID == "" {
		return fmt.Errorf("invalid host fee settle")
	}

	ref := "hosted_event:" + eventID
	var already bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM wallet_ledger WHERE reference = $1 AND kind = $2
		)`, ref, LedgerKindEventHostFee).Scan(&already); err != nil {
		return err
	}
	if already {
		return nil
	}

	tag, err := tx.Exec(ctx, `
		UPDATE wallets SET balance = balance - $3, updated_at=NOW()
		WHERE user_id=$1 AND currency=$2 AND balance >= $3
	`, organizerID, currency, amount)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("%w in %s", ErrInsufficientWalletBalance, currency)
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO wallet_ledger (user_id, kind, amount, currency, status, reference, provider)
		VALUES ($1,$2,$3,$4,'posted',$5,'wallet')`,
		organizerID, LedgerKindEventHostFee, amount, currency, ref)
	return err
}

// SettleCampaignCreateFee debits the publisher create fee and posts the ledger (pay-to-create).
func (s *Service) SettleCampaignCreateFee(ctx context.Context, publisherID string, amount float64, currency, campaignID string) error {
	publisherID = strings.TrimSpace(publisherID)
	currency = strings.ToUpper(strings.TrimSpace(currency))
	campaignID = strings.TrimSpace(campaignID)
	amount = RoundMoney2(amount)
	if publisherID == "" || currency == "" || amount <= 0 || campaignID == "" {
		return fmt.Errorf("invalid campaign create fee settle")
	}
	if err := s.requireDB(); err != nil {
		return err
	}
	if s.db == nil || !s.db.Ready() {
		return s.requireDB()
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	ref := "ad_campaign:" + campaignID
	var already bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM wallet_ledger WHERE reference = $1 AND kind = $2
		)`, ref, LedgerKindCampaignCreateFee).Scan(&already); err != nil {
		return err
	}
	if already {
		return tx.Commit(ctx)
	}

	tag, err := tx.Exec(ctx, `
		UPDATE wallets SET balance = balance - $3, updated_at=NOW()
		WHERE user_id=$1 AND currency=$2 AND balance >= $3
	`, publisherID, currency, amount)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("insufficient wallet balance in %s", currency)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO wallet_ledger (user_id, kind, amount, currency, status, reference, provider)
		VALUES ($1,$2,$3,$4,'posted',$5,'wallet')`,
		publisherID, LedgerKindCampaignCreateFee, amount, currency, ref); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// SettlePrizePoolGuaranteeHold debits the organizer guarantee and posts an idempotent hold ledger for cycle.
func (s *Service) SettlePrizePoolGuaranteeHold(ctx context.Context, organizerID string, amount float64, currency, eventID string, cycle int) error {
	if err := s.requireDB(); err != nil {
		return err
	}
	if s.db == nil || !s.db.Ready() {
		return s.requireDB()
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := s.SettlePrizePoolGuaranteeHoldTx(ctx, tx, organizerID, amount, currency, eventID, cycle); err != nil {
		// Peer already held: roll back our debit (no Commit) and treat as success.
		if errors.Is(err, ErrPrizePoolGuaranteeHoldRace) {
			return nil
		}
		return err
	}
	return tx.Commit(ctx)
}

// SettlePrizePoolGuaranteeHoldTx posts a cycle hold on an open transaction (create escrow atomic path).
func (s *Service) SettlePrizePoolGuaranteeHoldTx(ctx context.Context, tx walletExec, organizerID string, amount float64, currency, eventID string, cycle int) error {
	if tx == nil {
		return fmt.Errorf("database unavailable")
	}
	organizerID = strings.TrimSpace(organizerID)
	currency = strings.ToUpper(strings.TrimSpace(currency))
	eventID = strings.TrimSpace(eventID)
	amount = RoundMoney2(amount)
	if cycle < 1 {
		cycle = 1
	}
	if organizerID == "" || currency == "" || amount <= 0 || eventID == "" {
		return fmt.Errorf("invalid prize pool guarantee hold")
	}

	ref := guaranteeHoldRef(eventID, cycle)
	var already bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM wallet_ledger WHERE reference = $1 AND kind = $2
		)`, ref, LedgerKindPrizePoolGuaranteeHold).Scan(&already); err != nil {
		return err
	}
	if already {
		return nil
	}

	tag, err := tx.Exec(ctx, `
		UPDATE wallets SET balance = balance - $3, updated_at=NOW()
		WHERE user_id=$1 AND currency=$2 AND balance >= $3
	`, organizerID, currency, amount)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("%w in %s", ErrInsufficientWalletBalance, currency)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO wallet_ledger (user_id, kind, amount, currency, status, reference, provider)
		VALUES ($1,$2,$3,$4,'posted',$5,'wallet')`,
		organizerID, LedgerKindPrizePoolGuaranteeHold, amount, currency, ref); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return ErrPrizePoolGuaranteeHoldRace
		}
		return err
	}
	return nil
}

// ReleasePrizePoolGuarantee credits the organizer back if a hold exists for cycle and was not captured.
func (s *Service) ReleasePrizePoolGuarantee(ctx context.Context, organizerID string, amount float64, currency, eventID string, cycle int) error {
	if err := s.requireDB(); err != nil {
		return err
	}
	if s.db == nil || !s.db.Ready() {
		return s.requireDB()
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := s.ReleasePrizePoolGuaranteeTx(ctx, tx, organizerID, amount, currency, eventID, cycle); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ReleasePrizePoolGuaranteeTx posts release on an open transaction (cancel escrow atomic path).
func (s *Service) ReleasePrizePoolGuaranteeTx(ctx context.Context, tx walletExec, organizerID string, amount float64, currency, eventID string, cycle int) error {
	if tx == nil {
		return fmt.Errorf("database unavailable")
	}
	organizerID = strings.TrimSpace(organizerID)
	currency = strings.ToUpper(strings.TrimSpace(currency))
	eventID = strings.TrimSpace(eventID)
	amount = RoundMoney2(amount)
	if cycle < 1 {
		cycle = 1
	}
	if organizerID == "" || currency == "" || amount <= 0 || eventID == "" {
		return fmt.Errorf("invalid prize pool guarantee release")
	}

	holdRef := guaranteeHoldRef(eventID, cycle)
	releaseRef := guaranteeReleaseRef(eventID, cycle)
	captureRef := guaranteeCaptureRef(eventID, cycle)
	legacyHold := "hosted_event_prize_guarantee:" + eventID
	legacyRelease := "hosted_event_prize_guarantee_release:" + eventID
	legacyCapture := "hosted_event_prize_guarantee_capture:" + eventID

	var held bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM wallet_ledger WHERE kind = $1 AND reference = ANY($2::text[])
		)`, LedgerKindPrizePoolGuaranteeHold, []string{holdRef, legacyHold}).Scan(&held); err != nil {
		return err
	}
	if !held {
		return nil
	}
	var captured bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM wallet_ledger WHERE kind = $1 AND reference = ANY($2::text[])
		)`, LedgerKindPrizePoolGuaranteeCapture, []string{captureRef, legacyCapture}).Scan(&captured); err != nil {
		return err
	}
	if captured {
		return nil
	}
	var already bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM wallet_ledger WHERE kind = $1 AND reference = ANY($2::text[])
		)`, LedgerKindPrizePoolGuaranteeRelease, []string{releaseRef, legacyRelease}).Scan(&already); err != nil {
		return err
	}
	if already {
		return nil
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO wallets (user_id, currency, balance, updated_at)
		VALUES ($1,$2,$3,NOW())
		ON CONFLICT (user_id, currency) DO UPDATE
		SET balance = wallets.balance + EXCLUDED.balance, updated_at = NOW()
	`, organizerID, currency, amount); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO wallet_ledger (user_id, kind, amount, currency, status, reference, provider)
		VALUES ($1,$2,$3,$4,'posted',$5,'wallet')`,
		organizerID, LedgerKindPrizePoolGuaranteeRelease, amount, currency, releaseRef)
	return err
}

// CapturePrizePoolGuarantee marks the hold as consumed into the pot (no extra wallet move).
func (s *Service) CapturePrizePoolGuarantee(ctx context.Context, organizerID string, amount float64, currency, eventID string, cycle int) error {
	if err := s.requireDB(); err != nil {
		return err
	}
	if s.db == nil || !s.db.Ready() {
		return s.requireDB()
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := s.CapturePrizePoolGuaranteeTx(ctx, tx, organizerID, amount, currency, eventID, cycle); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// CapturePrizePoolGuaranteeTx posts capture on an open transaction (start/finish escrow atomic path).
func (s *Service) CapturePrizePoolGuaranteeTx(ctx context.Context, tx walletExec, organizerID string, amount float64, currency, eventID string, cycle int) error {
	if tx == nil {
		return fmt.Errorf("database unavailable")
	}
	organizerID = strings.TrimSpace(organizerID)
	currency = strings.ToUpper(strings.TrimSpace(currency))
	eventID = strings.TrimSpace(eventID)
	amount = RoundMoney2(amount)
	if cycle < 1 {
		cycle = 1
	}
	if organizerID == "" || currency == "" || amount <= 0 || eventID == "" {
		return fmt.Errorf("invalid prize pool guarantee capture")
	}

	holdRef := guaranteeHoldRef(eventID, cycle)
	captureRef := guaranteeCaptureRef(eventID, cycle)
	releaseRef := guaranteeReleaseRef(eventID, cycle)
	legacyHold := "hosted_event_prize_guarantee:" + eventID
	legacyRelease := "hosted_event_prize_guarantee_release:" + eventID
	legacyCapture := "hosted_event_prize_guarantee_capture:" + eventID

	var already bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM wallet_ledger WHERE kind = $1 AND reference = ANY($2::text[])
		)`, LedgerKindPrizePoolGuaranteeCapture, []string{captureRef, legacyCapture}).Scan(&already); err != nil {
		return err
	}
	if already {
		return nil
	}
	var held bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM wallet_ledger WHERE kind = $1 AND reference = ANY($2::text[])
		)`, LedgerKindPrizePoolGuaranteeHold, []string{holdRef, legacyHold}).Scan(&held); err != nil {
		return err
	}
	if !held {
		return fmt.Errorf("prize pool guarantee hold missing")
	}
	var released bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM wallet_ledger WHERE kind = $1 AND reference = ANY($2::text[])
		)`, LedgerKindPrizePoolGuaranteeRelease, []string{releaseRef, legacyRelease}).Scan(&released); err != nil {
		return err
	}
	if released {
		return fmt.Errorf("prize pool guarantee already released")
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO wallet_ledger (user_id, kind, amount, currency, status, reference, provider)
		VALUES ($1,$2,$3,$4,'posted',$5,'wallet')`,
		organizerID, LedgerKindPrizePoolGuaranteeCapture, amount, currency, captureRef)
	return err
}

// RefundEventEntryFee returns the full entry fee to the player and claws organizer net.
// Requires a prior posted event_entry_paid ledger for the entry (else no-op).
// If the organizer already withdrew net, clawback takes what remains and the platform
// absorbs the shortfall so the player is never stranded without a refund.
// Platform commission was never credited to a spendable wallet; it is forfeited on refund.
func (s *Service) RefundEventEntryFee(
	ctx context.Context,
	playerID, organizerID string,
	feePaid, organizerNet float64,
	currency, entryID string,
) error {
	playerID = strings.TrimSpace(playerID)
	organizerID = strings.TrimSpace(organizerID)
	currency = strings.ToUpper(strings.TrimSpace(currency))
	entryID = strings.TrimSpace(entryID)
	feePaid = RoundMoney2(feePaid)
	organizerNet = RoundMoney2(organizerNet)
	if feePaid <= 0 {
		return nil
	}
	if playerID == "" || currency == "" || entryID == "" {
		return fmt.Errorf("refund entry fee: missing player, currency, or entry id")
	}
	if err := s.requireDB(); err != nil {
		return err
	}
	if s.db == nil || !s.db.Ready() {
		return s.requireDB()
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	refPaid := "hosted_event_entry:" + entryID
	var paidExists bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM wallet_ledger WHERE reference = $1 AND kind = $2
		)`, refPaid, LedgerKindEventEntryPaid).Scan(&paidExists); err != nil {
		return err
	}
	if !paidExists {
		return fmt.Errorf("refund entry fee: paid ledger missing for entry %s", entryID)
	}

	refRefund := "hosted_event_entry_refund:" + entryID
	var already bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM wallet_ledger WHERE reference = $1 AND kind = $2
		)`, refRefund, LedgerKindEventEntryRefund).Scan(&already); err != nil {
		return err
	}
	if already {
		return tx.Commit(ctx)
	}

	if organizerNet > 0 && organizerID != "" {
		var bal float64
		err := tx.QueryRow(ctx, `
			SELECT COALESCE(balance, 0) FROM wallets WHERE user_id = $1 AND currency = $2
		`, organizerID, currency).Scan(&bal)
		if err != nil {
			bal = 0
		}
		claw := organizerNet
		if bal < claw {
			claw = RoundMoney2(bal)
		}
		if claw > 0 {
			tag, err := tx.Exec(ctx, `
				UPDATE wallets SET balance = balance - $3, updated_at=NOW()
				WHERE user_id=$1 AND currency=$2 AND balance >= $3
			`, organizerID, currency, claw)
			if err != nil {
				return err
			}
			if tag.RowsAffected() == 0 {
				return fmt.Errorf("insufficient organizer balance to clawback entry fee")
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO wallet_ledger (user_id, kind, amount, currency, status, reference, provider)
				VALUES ($1,$2,$3,$4,'posted',$5,'wallet')`,
				organizerID, LedgerKindEventEntryClawback, claw, currency, "hosted_event_entry_clawback:"+entryID); err != nil {
				return err
			}
		}
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO wallets (user_id, currency, balance, updated_at)
		VALUES ($1,$2,$3,NOW())
		ON CONFLICT (user_id, currency) DO UPDATE
		SET balance = wallets.balance + EXCLUDED.balance, updated_at = NOW()
	`, playerID, currency, feePaid); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO wallet_ledger (user_id, kind, amount, currency, status, reference, provider)
		VALUES ($1,$2,$3,$4,'posted',$5,'wallet')`,
		playerID, LedgerKindEventEntryRefund, feePaid, currency, refRefund); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// RefundTournamentEntryFee credits the player wallet for a paid tournament seat (idempotent).
func (s *Service) RefundTournamentEntryFee(
	ctx context.Context,
	playerID string,
	feePaid float64,
	currency, entryID string,
) error {
	playerID = strings.TrimSpace(playerID)
	currency = strings.ToUpper(strings.TrimSpace(currency))
	entryID = strings.TrimSpace(entryID)
	feePaid = RoundMoney2(feePaid)
	if feePaid <= 0 {
		return nil
	}
	if playerID == "" || currency == "" || entryID == "" {
		return fmt.Errorf("refund tournament entry: missing player, currency, or entry id")
	}
	if err := s.requireDB(); err != nil {
		return err
	}
	if s.db == nil || !s.db.Ready() {
		return s.requireDB()
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	refRefund := "tournament_entry_refund:" + entryID
	var already bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM wallet_ledger WHERE reference = $1 AND kind = $2
		)`, refRefund, LedgerKindTournamentEntryRefund).Scan(&already); err != nil {
		return err
	}
	if already {
		return tx.Commit(ctx)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO wallets (user_id, currency, balance, updated_at)
		VALUES ($1,$2,$3,NOW())
		ON CONFLICT (user_id, currency) DO UPDATE
		SET balance = wallets.balance + EXCLUDED.balance, updated_at = NOW()
	`, playerID, currency, feePaid); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO wallet_ledger (user_id, kind, amount, currency, status, reference, provider)
		VALUES ($1,$2,$3,$4,'posted',$5,'wallet')`,
		playerID, LedgerKindTournamentEntryRefund, feePaid, currency, refRefund); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// CreditCompetitionPrizePayout credits a player wallet and posts an idempotent ledger row.
// Returns the wallet_ledger id (empty when already settled).
func (s *Service) CreditCompetitionPrizePayout(ctx context.Context, userID string, amount float64, currency, payoutID string) (string, error) {
	userID = strings.TrimSpace(userID)
	payoutID = strings.TrimSpace(payoutID)
	currency = strings.ToUpper(strings.TrimSpace(currency))
	amount = RoundMoney2(amount)
	if userID == "" || payoutID == "" || currency == "" || amount <= 0 {
		return "", fmt.Errorf("invalid competition prize credit")
	}
	if err := s.requireDB(); err != nil {
		return "", err
	}
	if s.db == nil || !s.db.Ready() {
		return "", s.requireDB()
	}
	ref := "competition_prize_payout:" + payoutID
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var existingID string
	err = tx.QueryRow(ctx, `
		SELECT id::text FROM wallet_ledger WHERE reference = $1 AND kind = $2 LIMIT 1`,
		ref, LedgerKindCompetitionPrizePayout).Scan(&existingID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	if existingID != "" {
		return existingID, tx.Commit(ctx)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO wallets (user_id, currency, balance, updated_at)
		VALUES ($1,$2,$3,NOW())
		ON CONFLICT (user_id, currency) DO UPDATE
		SET balance = wallets.balance + EXCLUDED.balance, updated_at = NOW()
	`, userID, currency, amount); err != nil {
		return "", err
	}
	var ledgerID string
	if err := tx.QueryRow(ctx, `
		INSERT INTO wallet_ledger (user_id, kind, amount, currency, status, reference, provider)
		VALUES ($1,$2,$3,$4,'posted',$5,'wallet')
		RETURNING id::text`,
		userID, LedgerKindCompetitionPrizePayout, amount, currency, ref).Scan(&ledgerID); err != nil {
		return "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return ledgerID, nil
}

// PostWalletLedger records a posted wallet movement for the transactions list.
func (s *Service) PostWalletLedger(ctx context.Context, userID, kind string, amount float64, currency, reference string) error {
	userID = strings.TrimSpace(userID)
	kind = strings.TrimSpace(kind)
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if userID == "" || kind == "" || currency == "" || amount <= 0 {
		return fmt.Errorf("invalid wallet ledger row")
	}
	if err := s.requireDB(); err != nil {
		return err
	}
	if s.db == nil || !s.db.Ready() {
		return s.requireDB()
	}
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO wallet_ledger (user_id, kind, amount, currency, status, reference, provider)
		VALUES ($1,$2,$3,$4,'posted',$5,'wallet')`,
		userID, kind, amount, currency, strings.TrimSpace(reference))
	return err
}

// DebitWallet deducts amount if balance is sufficient. Returns error on insufficient funds.
func (s *Service) DebitWallet(ctx context.Context, userID string, amount float64, currency string) error {
	if amount <= 0 {
		return nil
	}
	currency = strings.ToUpper(currency)
	if currency == "" {
		return fmt.Errorf("currency required")
	}
	if err := s.requireDB(); err != nil {
		return err
	}
	key := walletKey(userID, currency)
	if s.db != nil && s.db.Ready() {
		tag, err := s.db.Pool.Exec(ctx, `
			UPDATE wallets SET balance = balance - $3, updated_at=NOW()
			WHERE user_id=$1 AND currency=$2 AND balance >= $3
		`, userID, currency, amount)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return fmt.Errorf("insufficient wallet balance in %s", currency)
		}
		return nil
	}
	if !allowMemoryMode() {
		return s.requireDB()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.wallets[key] < amount {
		return fmt.Errorf("insufficient wallet balance in %s", currency)
	}
	s.wallets[key] -= amount
	return nil
}

func (s *Service) MarkPaidByTxRef(ctx context.Context, txRef string) (*Intent, error) {
	if s.db != nil && s.db.Ready() {
		tx, err := s.db.Pool.Begin(ctx)
		if err != nil {
			return nil, err
		}
		defer tx.Rollback(ctx)

		var intent Intent
		err = tx.QueryRow(ctx, `
			SELECT id, user_id, purpose, amount, currency, provider, COALESCE(country_code,''), tx_ref,
			       COALESCE(checkout_url,''), status, created_at
			FROM payment_intents WHERE tx_ref=$1 FOR UPDATE
		`, txRef).Scan(
			&intent.ID, &intent.UserID, &intent.Purpose, &intent.Amount, &intent.Currency, &intent.Provider,
			&intent.CountryCode, &intent.TxRef, &intent.CheckoutURL, &intent.Status, &intent.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("intent not found")
		}
		if intent.Status == "paid" {
			if err := tx.Commit(ctx); err != nil {
				return nil, err
			}
			return &intent, nil
		}
		tag, err := tx.Exec(ctx, `
			UPDATE payment_intents SET status='paid', updated_at=NOW()
			WHERE tx_ref=$1 AND status<>'paid'
		`, txRef)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			// Concurrent winner already marked paid; treat as idempotent success.
			intent.Status = "paid"
			if err := tx.Commit(ctx); err != nil {
				return nil, err
			}
			return &intent, nil
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO wallets (user_id, currency, balance, updated_at)
			VALUES ($1,$2,$3,NOW())
			ON CONFLICT (user_id, currency) DO UPDATE
			SET balance = wallets.balance + EXCLUDED.balance, updated_at=NOW()
		`, intent.UserID, intent.Currency, intent.Amount)
		if err != nil {
			return nil, err
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		intent.Status = "paid"
		args := notifications.MoneyArgs(intent.Amount, intent.Currency)
		notifications.EmitPlayer(ctx, s.db.Pool, intent.UserID, notifications.KindPlayerWalletCredited,
			"wallet_credited:intent:"+intent.ID, intent.ID, args...)
		return &intent, nil
	}
	if !allowMemoryMode() {
		return nil, s.requireDB()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	id, ok := s.byRef[txRef]
	if !ok {
		return nil, fmt.Errorf("intent not found")
	}
	intent := s.intents[id]
	if intent.Status == "paid" {
		cp := *intent
		return &cp, nil
	}
	intent.Status = "paid"
	s.creditWalletLocked(intent.UserID, intent.Currency, intent.Amount)
	cp := *intent
	return &cp, nil
}

func (s *Service) creditWalletLocked(userID, currency string, amount float64) {
	s.wallets[walletKey(userID, currency)] += amount
}

// cancelUnlinkedAwaitingReceipts drops abandoned manual top-up holds that are not tied to a pending proof.
func (s *Service) cancelUnlinkedAwaitingReceipts(ctx context.Context, userID, currency string) {
	userID = strings.TrimSpace(userID)
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if userID == "" || currency == "" {
		return
	}
	if s.db != nil && s.db.Ready() {
		_, _ = s.db.Pool.Exec(ctx, `
			UPDATE payment_intents i
			SET status='cancelled', updated_at=NOW()
			WHERE i.user_id = $1
			  AND UPPER(TRIM(i.currency)) = $2
			  AND i.provider = 'manual'
			  AND i.status = 'awaiting_receipt'
			  AND i.purpose = 'wallet_topup'
			  AND NOT EXISTS (
			    SELECT 1 FROM payment_receipts r
			    WHERE r.intent_id = i.id AND r.status IN ('pending', 'approved')
			  )
		`, userID, currency)
		return
	}
	if !allowMemoryMode() {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, intent := range s.intents {
		if intent == nil || intent.UserID != userID {
			continue
		}
		if intent.Status != "awaiting_receipt" || intent.Provider != "manual" {
			continue
		}
		if !strings.EqualFold(intent.Currency, currency) {
			continue
		}
		linked := false
		for _, rec := range s.receipts {
			if rec == nil || rec.IntentID != intent.ID {
				continue
			}
			if rec.Status == "pending" || rec.Status == "approved" {
				linked = true
				break
			}
		}
		if !linked {
			intent.Status = "cancelled"
		}
	}
}

func (s *Service) persistIntent(ctx context.Context, intent *Intent) {
	if s.db != nil && s.db.Ready() {
		meta, _ := json.Marshal(intent.Metadata)
		_, err := s.db.Pool.Exec(ctx, `
			INSERT INTO payment_intents (
				id, user_id, purpose, amount, currency, provider, country_code, tx_ref, checkout_url, status, metadata, created_at, updated_at
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,NOW(),NOW())
		`, intent.ID, intent.UserID, intent.Purpose, intent.Amount, intent.Currency, intent.Provider, intent.CountryCode, intent.TxRef, intent.CheckoutURL, intent.Status, string(meta))
		if err == nil {
			return
		}
		// Fall through only for local smoke memory mode.
	}
	if !allowMemoryMode() {
		return
	}
	s.mu.Lock()
	s.intents[intent.ID] = intent
	s.byRef[intent.TxRef] = intent.ID
	s.mu.Unlock()
}

func (s *Service) initChapa(intent *Intent, email, returnURL string) (string, error) {
	if s.cfg.ChapaSecretKey == "" {
		return "", fmt.Errorf("payment provider temporarily unavailable")
	}
	if returnURL == "" {
		returnURL = s.cfg.PublicAPIBase
	}
	brandTitle := ""
	if s.settings != nil {
		brandTitle = strings.TrimSpace(s.settings.ClientNav().BrandName)
	}
	if brandTitle == "" {
		return "", fmt.Errorf("payment provider temporarily unavailable")
	}
	payload := map[string]any{
		"amount":       fmt.Sprintf("%.2f", intent.Amount),
		"currency":     intent.Currency,
		"email":        email,
		"tx_ref":       intent.TxRef,
		"callback_url": s.cfg.PublicAPIBase + "/api/v1/payments/local/webhook",
		"return_url":   returnURL,
		"customization": map[string]string{
			"title":       brandTitle,
			"description": intent.Purpose,
		},
	}
	body, _ := json.Marshal(payload)
	base := strings.TrimRight(s.cfg.ChapaBaseURL, "/")
	if base == "" {
		base = "https://api.chapa.co/v1"
	}
	req, err := http.NewRequest(http.MethodPost, base+"/transaction/initialize", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("payment provider temporarily unavailable")
	}
	req.Header.Set("Authorization", "Bearer "+s.cfg.ChapaSecretKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("payment provider temporarily unavailable")
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("payment provider temporarily unavailable")
	}
	var parsed struct {
		Data struct {
			CheckoutURL string `json:"checkout_url"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", fmt.Errorf("payment provider temporarily unavailable")
	}
	if parsed.Data.CheckoutURL == "" {
		return "", fmt.Errorf("payment provider temporarily unavailable")
	}
	return parsed.Data.CheckoutURL, nil
}

func (s *Service) initPaddle(intent *Intent, email string) (string, error) {
	if s.cfg.PaddleAPIKey == "" {
		return "", fmt.Errorf("payment provider temporarily unavailable")
	}
	payload := map[string]any{
		"items": []map[string]any{{
			"quantity": 1,
			"price": map[string]any{
				"description": intent.Purpose,
				"unit_price": map[string]any{
					"amount":        fmt.Sprintf("%d", int(intent.Amount*100)),
					"currency_code": intent.Currency,
				},
				"product": map[string]any{
					"name":         "dama " + intent.Purpose,
					"tax_category": "standard",
				},
			},
		}},
		"custom_data": map[string]any{"tx_ref": intent.TxRef, "user_id": intent.UserID},
		"customer":    map[string]any{"email": email},
	}
	body, _ := json.Marshal(payload)
	base := strings.TrimRight(s.cfg.PaddleAPIBase, "/")
	if base == "" {
		base = "https://api.paddle.com"
	}
	req, err := http.NewRequest(http.MethodPost, base+"/transactions", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("payment provider temporarily unavailable")
	}
	req.Header.Set("Authorization", "Bearer "+s.cfg.PaddleAPIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("payment provider temporarily unavailable")
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("payment provider temporarily unavailable")
	}
	var parsed struct {
		Data struct {
			Checkout struct {
				URL string `json:"url"`
			} `json:"checkout"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", fmt.Errorf("payment provider temporarily unavailable")
	}
	if parsed.Data.Checkout.URL == "" {
		return "", fmt.Errorf("payment provider temporarily unavailable")
	}
	return parsed.Data.Checkout.URL, nil
}

func (s *Service) VerifyChapaSignature(rawBody []byte, signature string) bool {
	secret := s.cfg.ChapaWebhookSecret
	if secret == "" {
		secret = s.cfg.ChapaSecretKey
	}
	if secret == "" || signature == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(rawBody)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

// VerifyPaddleSignature validates Paddle Billing webhook signatures (ts + h1 HMAC-SHA256).
// Header form: Paddle-Signature: ts=<unix>;h1=<hex>
func (s *Service) VerifyPaddleSignature(rawBody []byte, signatureHeader string) bool {
	secret := strings.TrimSpace(s.cfg.PaddleWebhookSecret)
	if secret == "" || signatureHeader == "" {
		return false
	}
	var ts, h1 string
	for _, part := range strings.Split(signatureHeader, ";") {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, "ts=") {
			ts = strings.TrimPrefix(part, "ts=")
		}
		if strings.HasPrefix(part, "h1=") {
			h1 = strings.TrimPrefix(part, "h1=")
		}
	}
	if ts == "" || h1 == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(ts + ":"))
	mac.Write(rawBody)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(h1))
}
