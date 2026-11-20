package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"dama/apps/api/internal/db"

	"github.com/google/uuid"
)

type Tournament struct {
	ID                      string         `json:"id"`
	Title                   string         `json:"title"`
	Description             string         `json:"description,omitempty"`
	IsFree                  bool           `json:"is_free"`
	EntryFeeAmount          float64        `json:"entry_fee_amount"`
	EntryFeeCurrency        string         `json:"entry_fee_currency"`
	PrizePool               map[string]any `json:"prize_pool,omitempty"`
	PrizeImageURL           string         `json:"prize_image_url,omitempty"`
	Gallery                 []string       `json:"gallery,omitempty"`
	Status                  string         `json:"status"`
	FormatID                string         `json:"format_id"`
	PrizePoolDisplayEnabled bool           `json:"prize_pool_display_enabled"`
	MaxPlayers              *int           `json:"max_players,omitempty"`
	PrizePoolFrozenAmount   *float64       `json:"prize_pool_frozen_amount,omitempty"`
	PrizePoolFrozenAt       *time.Time     `json:"prize_pool_frozen_at,omitempty"`
	CheckInOpensAt          *time.Time     `json:"check_in_opens_at,omitempty"`
	CheckInClosesAt         *time.Time     `json:"check_in_closes_at,omitempty"`
	StartedAt               *time.Time     `json:"started_at,omitempty"`
	FinishedAt              *time.Time     `json:"finished_at,omitempty"`
	WinnerID                *string        `json:"winner_id,omitempty"`
	PrizeSettledAt          *time.Time     `json:"prize_settled_at,omitempty"`
	DisputeWindowEndsAt     *time.Time     `json:"dispute_window_ends_at,omitempty"`
	ArenaEndsAt             *time.Time     `json:"arena_ends_at,omitempty"`
	ArenaDurationMinutes    *int           `json:"arena_duration_minutes,omitempty"`
	PrizePayoutMode         string         `json:"prize_payout_mode,omitempty"`
	PrizePlacePercents      map[string]any `json:"prize_place_percents,omitempty"`
	CreatedBy               *string        `json:"-"` // console actor id - never public
	CreatedAt               time.Time      `json:"created_at"`
	UpdatedAt               time.Time      `json:"-"`
}

type TournamentStore struct {
	db  *db.Handle
	mu  sync.RWMutex
	mem map[string]*Tournament
}

func NewTournamentStore(handle *db.Handle) *TournamentStore {
	return &TournamentStore{db: handle, mem: map[string]*Tournament{}}
}

func (s *TournamentStore) requireDB() error {
	if s.db != nil && s.db.Ready() {
		return nil
	}
	if allowMemoryMode() {
		return nil
	}
	return fmt.Errorf("service temporarily unavailable")
}

type CreateTournamentInput struct {
	Title                   string
	Description             string
	IsFree                  bool
	EntryFeeAmount          float64
	EntryFeeCurrency        string
	PrizePool               map[string]any
	PrizeImageURL           string
	Gallery                 []string
	Status                  string
	FormatID                string
	CreatedBy               *string
	PrizePoolDisplayEnabled bool
	MaxPlayers              *int
	ArenaDurationMinutes    *int
	PrizePayoutMode         string
	PrizePlacePercents      map[string]any
}

const tournamentSelectCols = `
	id, title, COALESCE(description,''), is_free, entry_fee_amount, entry_fee_currency,
	prize_pool, COALESCE(prize_image_url,''), COALESCE(gallery,'[]'::jsonb), status,
	format_id,
	prize_pool_display_enabled, max_players, prize_pool_frozen_amount, prize_pool_frozen_at,
	check_in_opens_at, check_in_closes_at, started_at, finished_at, winner_id,
	prize_settled_at, dispute_window_ends_at,
	arena_ends_at, arena_duration_minutes,
	COALESCE(prize_payout_mode,''), COALESCE(prize_place_percents,'{}'::jsonb),
	created_at, updated_at`

// tournamentSelectColsAliased is for joins (e.g. mine = INNER JOIN tournament_entries).
const tournamentSelectColsAliased = `
	t.id, t.title, COALESCE(t.description,''), t.is_free, t.entry_fee_amount, t.entry_fee_currency,
	t.prize_pool, COALESCE(t.prize_image_url,''), COALESCE(t.gallery,'[]'::jsonb), t.status,
	t.format_id,
	t.prize_pool_display_enabled, t.max_players, t.prize_pool_frozen_amount, t.prize_pool_frozen_at,
	t.check_in_opens_at, t.check_in_closes_at, t.started_at, t.finished_at, t.winner_id,
	t.prize_settled_at, t.dispute_window_ends_at,
	t.arena_ends_at, t.arena_duration_minutes,
	COALESCE(t.prize_payout_mode,''), COALESCE(t.prize_place_percents,'{}'::jsonb),
	t.created_at, t.updated_at`

func scanTournament(row interface{ Scan(dest ...any) error }) (*Tournament, error) {
	var t Tournament
	var prizeRaw, galleryRaw, placePercentsRaw []byte
	var maxPlayers *int
	var frozenAmount *float64
	var frozenAt *time.Time
	var checkInOpens, checkInCloses, startedAt, finishedAt, prizeSettled, disputeEnds, arenaEnds *time.Time
	var winnerID *string
	var arenaDuration *int
	if err := row.Scan(
		&t.ID, &t.Title, &t.Description, &t.IsFree, &t.EntryFeeAmount, &t.EntryFeeCurrency,
		&prizeRaw, &t.PrizeImageURL, &galleryRaw, &t.Status, &t.FormatID,
		&t.PrizePoolDisplayEnabled, &maxPlayers, &frozenAmount, &frozenAt,
		&checkInOpens, &checkInCloses, &startedAt, &finishedAt, &winnerID,
		&prizeSettled, &disputeEnds,
		&arenaEnds, &arenaDuration,
		&t.PrizePayoutMode, &placePercentsRaw,
		&t.CreatedAt, &t.UpdatedAt,
	); err != nil {
		return nil, err
	}
	t.MaxPlayers = maxPlayers
	t.PrizePoolFrozenAmount = frozenAmount
	t.PrizePoolFrozenAt = frozenAt
	t.CheckInOpensAt = checkInOpens
	t.CheckInClosesAt = checkInCloses
	t.StartedAt = startedAt
	t.FinishedAt = finishedAt
	t.WinnerID = winnerID
	t.PrizeSettledAt = prizeSettled
	t.DisputeWindowEndsAt = disputeEnds
	t.ArenaEndsAt = arenaEnds
	t.ArenaDurationMinutes = arenaDuration
	t.PrizePool = map[string]any{}
	_ = json.Unmarshal(prizeRaw, &t.PrizePool)
	t.Gallery = []string{}
	_ = json.Unmarshal(galleryRaw, &t.Gallery)
	t.PrizePlacePercents = map[string]any{}
	_ = json.Unmarshal(placePercentsRaw, &t.PrizePlacePercents)
	return &t, nil
}

func (s *TournamentStore) Create(ctx context.Context, in CreateTournamentInput) (*Tournament, error) {
	if in.Title == "" {
		return nil, fmt.Errorf("title required")
	}
	if in.Status == "" {
		return nil, fmt.Errorf("status required")
	}
	currency := in.EntryFeeCurrency
	if currency == "" {
		return nil, fmt.Errorf("entry_fee_currency required from currency matrix")
	}
	amount := in.EntryFeeAmount
	if in.IsFree {
		amount = 0
	}
	// Paid tournaments must carry a positive fee. Zero fee without is_free is invalid (no silent free).
	if !in.IsFree && amount <= 0 {
		return nil, fmt.Errorf("paid tournament requires entry_fee_amount > 0")
	}
	prizePool := in.PrizePool
	if prizePool == nil {
		prizePool = map[string]any{}
	}
	gallery := in.Gallery
	if gallery == nil {
		gallery = []string{}
	}
	now := time.Now().UTC()
	display := in.PrizePoolDisplayEnabled && !in.IsFree && amount > 0
	formatID := strings.TrimSpace(in.FormatID)
	if formatID == "" {
		return nil, fmt.Errorf("format_id required")
	}
	t := &Tournament{
		ID:                      uuid.NewString(),
		Title:                   in.Title,
		Description:             in.Description,
		IsFree:                  in.IsFree,
		EntryFeeAmount:          amount,
		EntryFeeCurrency:        currency,
		PrizePool:               prizePool,
		PrizeImageURL:           strings.TrimSpace(in.PrizeImageURL),
		Gallery:                 gallery,
		Status:                  in.Status,
		FormatID:                formatID,
		PrizePoolDisplayEnabled: display,
		MaxPlayers:              in.MaxPlayers,
		ArenaDurationMinutes:    in.ArenaDurationMinutes,
		PrizePayoutMode:         strings.TrimSpace(in.PrizePayoutMode),
		PrizePlacePercents:      in.PrizePlacePercents,
		CreatedBy:               in.CreatedBy,
		CreatedAt:               now,
		UpdatedAt:               now,
	}
	if t.PrizePlacePercents == nil {
		t.PrizePlacePercents = map[string]any{}
	}
	if t.IsFree {
		t.PrizePoolDisplayEnabled = false
		t.PrizePayoutMode = ""
		t.PrizePlacePercents = map[string]any{}
	}

	if s.db != nil && s.db.Ready() {
		prizeJSON, err := json.Marshal(t.PrizePool)
		if err != nil {
			return nil, fmt.Errorf("prize_pool invalid")
		}
		galleryJSON, err := json.Marshal(t.Gallery)
		if err != nil {
			return nil, fmt.Errorf("gallery invalid")
		}
		percentsJSON, err := json.Marshal(t.PrizePlacePercents)
		if err != nil {
			return nil, fmt.Errorf("prize_place_percents invalid")
		}
		_, err = s.db.Pool.Exec(ctx, `
			INSERT INTO tournaments (
				id, title, description, is_free, entry_fee_amount, entry_fee_currency,
				prize_pool, prize_image_url, gallery, status, format_id, created_by, created_at, updated_at,
				prize_pool_display_enabled, max_players, arena_duration_minutes,
				prize_payout_mode, prize_place_percents
			) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10,$11,$12,$13,$13,$14,$15,$16,$17,$18::jsonb)
		`, t.ID, t.Title, nullIfEmpty(t.Description), t.IsFree, t.EntryFeeAmount, t.EntryFeeCurrency, string(prizeJSON), nullIfEmpty(t.PrizeImageURL), string(galleryJSON), t.Status, t.FormatID, t.CreatedBy, now, t.PrizePoolDisplayEnabled, t.MaxPlayers, t.ArenaDurationMinutes, t.PrizePayoutMode, string(percentsJSON))
		if err != nil {
			return nil, err
		}
		return t, nil
	}
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	s.mu.Lock()
	s.mem[t.ID] = t
	s.mu.Unlock()
	cp := *t
	return &cp, nil
}

// TournamentListFilter is server-side list filtering (never invent client-side pages).
type TournamentListFilter struct {
	Statuses []string
	// IsFree nil = all; true/false filters is_free.
	IsFree *bool
	// Q matches title (case-insensitive substring).
	Q string
	// Lifecycle: open | live | finished (timestamp-based; empty = no lifecycle clause).
	Lifecycle string
	// MineUserID: when set, only cups this user has a tournament_entries row for.
	MineUserID string
}

// List returns tournaments. When statuses is non-empty, only matching rows are returned.
func (s *TournamentStore) List(ctx context.Context, statuses ...string) ([]Tournament, error) {
	list, _, err := s.ListPaged(ctx, 0, 100, TournamentListFilter{Statuses: statuses})
	return list, err
}

// ListPaged returns a skip/limit page plus total count (Trim BuildMeta).
func (s *TournamentStore) ListPaged(ctx context.Context, skip, limit int, filter TournamentListFilter) ([]Tournament, int, error) {
	if skip < 0 {
		skip = 0
	}
	if limit < 1 {
		limit = 100
	}
	want := map[string]struct{}{}
	for _, st := range filter.Statuses {
		st = strings.TrimSpace(st)
		if st != "" {
			want[st] = struct{}{}
		}
	}
	q := strings.TrimSpace(filter.Q)
	lifecycle := strings.ToLower(strings.TrimSpace(filter.Lifecycle))
	mineUID := strings.TrimSpace(filter.MineUserID)
	if s.db != nil && s.db.Ready() {
		where := make([]string, 0, 6)
		args := make([]any, 0, 8)
		argN := 1
		fromSQL := `tournaments t`
		if mineUID != "" {
			fromSQL = `tournaments t INNER JOIN tournament_entries te ON te.tournament_id = t.id AND te.user_id = $` + fmt.Sprintf("%d", argN) + `::uuid`
			args = append(args, mineUID)
			argN++
		}
		if len(want) > 0 {
			allowed := make([]string, 0, len(want))
			for st := range want {
				allowed = append(allowed, st)
			}
			where = append(where, fmt.Sprintf("t.status = ANY($%d)", argN))
			args = append(args, allowed)
			argN++
		}
		switch lifecycle {
		case "open":
			where = append(where, "t.started_at IS NULL AND t.finished_at IS NULL")
		case "live":
			where = append(where, "t.started_at IS NOT NULL AND t.finished_at IS NULL")
		case "finished":
			where = append(where, "t.finished_at IS NOT NULL")
		}
		if filter.IsFree != nil {
			where = append(where, fmt.Sprintf("t.is_free = $%d", argN))
			args = append(args, *filter.IsFree)
			argN++
		}
		if q != "" {
			where = append(where, fmt.Sprintf("t.title ILIKE $%d", argN))
			args = append(args, "%"+q+"%")
			argN++
		}
		whereSQL := ""
		if len(where) > 0 {
			whereSQL = " WHERE " + strings.Join(where, " AND ")
		}
		var total int
		countQ := `SELECT COUNT(*) FROM ` + fromSQL + whereSQL
		if err := s.db.Pool.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
			return nil, 0, err
		}
		listArgs := append(append([]any{}, args...), limit, skip)
		listQ := `
			SELECT ` + tournamentSelectColsAliased + `
			FROM ` + fromSQL + whereSQL + `
			ORDER BY t.created_at DESC
			LIMIT $` + fmt.Sprintf("%d", argN) + ` OFFSET $` + fmt.Sprintf("%d", argN+1)
		rows, err := s.db.Pool.Query(ctx, listQ, listArgs...)
		if err != nil {
			return nil, 0, err
		}
		defer rows.Close()
		out := []Tournament{}
		for rows.Next() {
			t, err := scanTournament(rows)
			if err != nil {
				return nil, 0, err
			}
			out = append(out, *t)
		}
		return out, total, rows.Err()
	}
	if err := s.requireDB(); err != nil {
		return nil, 0, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	filtered := make([]Tournament, 0, len(s.mem))
	qlower := strings.ToLower(q)
	for _, t := range s.mem {
		if len(want) > 0 {
			if _, ok := want[t.Status]; !ok {
				continue
			}
		}
		switch lifecycle {
		case "open":
			if t.StartedAt != nil || t.FinishedAt != nil {
				continue
			}
		case "live":
			if t.StartedAt == nil || t.FinishedAt != nil {
				continue
			}
		case "finished":
			if t.FinishedAt == nil {
				continue
			}
		}
		if filter.IsFree != nil && t.IsFree != *filter.IsFree {
			continue
		}
		if qlower != "" && !strings.Contains(strings.ToLower(t.Title), qlower) {
			continue
		}
		// Mine filter requires DB join; mem path skips mine (production uses Postgres).
		if mineUID != "" {
			continue
		}
		filtered = append(filtered, *t)
	}
	total := len(filtered)
	if skip >= total {
		return []Tournament{}, total, nil
	}
	end := skip + limit
	if end > total {
		end = total
	}
	return filtered[skip:end], total, nil
}

func (s *TournamentStore) Get(ctx context.Context, id string) (*Tournament, error) {
	if s.db != nil && s.db.Ready() {
		t, err := scanTournament(s.db.Pool.QueryRow(ctx, `
			SELECT `+tournamentSelectCols+`
			FROM tournaments WHERE id = $1
		`, id))
		if err != nil {
			return nil, fmt.Errorf("tournament not found")
		}
		return t, nil
	}
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	t, ok := s.mem[id]
	if !ok {
		return nil, fmt.Errorf("tournament not found")
	}
	cp := *t
	return &cp, nil
}

// SetPrizeImage sets tournaments.prize_image_url from an uploaded media URL.
func (s *TournamentStore) SetPrizeImage(ctx context.Context, id, prizeImageURL string) (*Tournament, error) {
	prizeImageURL = strings.TrimSpace(prizeImageURL)
	if prizeImageURL == "" {
		return nil, fmt.Errorf("prize_image_url required")
	}
	if s.db != nil && s.db.Ready() {
		tag, err := s.db.Pool.Exec(ctx, `
			UPDATE tournaments
			SET prize_image_url=$2, updated_at=NOW()
			WHERE id=$1
		`, id, prizeImageURL)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, fmt.Errorf("tournament not found")
		}
		return s.Get(ctx, id)
	}
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	t, ok := s.mem[id]
	if !ok {
		return nil, fmt.Errorf("tournament not found")
	}
	t.PrizeImageURL = prizeImageURL
	t.UpdatedAt = time.Now().UTC()
	cp := *t
	if cp.Gallery != nil {
		cp.Gallery = append([]string{}, t.Gallery...)
	}
	return &cp, nil
}

// ClearPrizeImage clears tournaments.prize_image_url (smart-menu thumbnail remove).
func (s *TournamentStore) ClearPrizeImage(ctx context.Context, id string) (*Tournament, error) {
	if s.db != nil && s.db.Ready() {
		tag, err := s.db.Pool.Exec(ctx, `
			UPDATE tournaments
			SET prize_image_url=NULL, updated_at=NOW()
			WHERE id=$1
		`, id)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, fmt.Errorf("tournament not found")
		}
		return s.Get(ctx, id)
	}
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	t, ok := s.mem[id]
	if !ok {
		return nil, fmt.Errorf("tournament not found")
	}
	t.PrizeImageURL = ""
	t.UpdatedAt = time.Now().UTC()
	cp := *t
	if cp.Gallery != nil {
		cp.Gallery = append([]string{}, t.Gallery...)
	}
	return &cp, nil
}

// AppendGallery appends one media URL to tournaments.gallery.
func (s *TournamentStore) AppendGallery(ctx context.Context, id, imageURL string) (*Tournament, error) {
	imageURL = strings.TrimSpace(imageURL)
	if imageURL == "" {
		return nil, fmt.Errorf("gallery image url required")
	}
	cur, err := s.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	n := 0
	for _, u := range cur.Gallery {
		if strings.TrimSpace(u) != "" {
			n++
		}
	}
	if n >= MaxEntityGalleryImages {
		return nil, ErrGalleryFull
	}
	if s.db != nil && s.db.Ready() {
		tag, err := s.db.Pool.Exec(ctx, `
			UPDATE tournaments
			SET gallery = COALESCE(gallery, '[]'::jsonb) || to_jsonb($2::text), updated_at=NOW()
			WHERE id=$1
			  AND jsonb_array_length(COALESCE(gallery, '[]'::jsonb)) < $3
		`, id, imageURL, MaxEntityGalleryImages)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			// Re-check: either missing or raced past capacity.
			again, gerr := s.Get(ctx, id)
			if gerr != nil {
				return nil, fmt.Errorf("tournament not found")
			}
			filled := 0
			for _, u := range again.Gallery {
				if strings.TrimSpace(u) != "" {
					filled++
				}
			}
			if filled >= MaxEntityGalleryImages {
				return nil, ErrGalleryFull
			}
			return nil, fmt.Errorf("tournament not found")
		}
		return s.Get(ctx, id)
	}
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	t, ok := s.mem[id]
	if !ok {
		return nil, fmt.Errorf("tournament not found")
	}
	if t.Gallery == nil {
		t.Gallery = []string{}
	}
	filled := 0
	for _, u := range t.Gallery {
		if strings.TrimSpace(u) != "" {
			filled++
		}
	}
	if filled >= MaxEntityGalleryImages {
		return nil, ErrGalleryFull
	}
	t.Gallery = append(t.Gallery, imageURL)
	t.UpdatedAt = time.Now().UTC()
	cp := *t
	cp.Gallery = append([]string{}, t.Gallery...)
	return &cp, nil
}

// UpdateGallery replaces tournaments.gallery (used to remove a slot).
func (s *TournamentStore) UpdateGallery(ctx context.Context, id string, gallery []string) (*Tournament, error) {
	if gallery == nil {
		gallery = []string{}
	}
	clean := make([]string, 0, len(gallery))
	for _, u := range gallery {
		u = strings.TrimSpace(u)
		if u != "" {
			clean = append(clean, u)
		}
	}
	if len(clean) > MaxEntityGalleryImages {
		return nil, ErrGalleryFull
	}
	if s.db != nil && s.db.Ready() {
		raw, err := json.Marshal(clean)
		if err != nil {
			return nil, fmt.Errorf("gallery invalid")
		}
		tag, err := s.db.Pool.Exec(ctx, `
			UPDATE tournaments
			SET gallery=$2::jsonb, updated_at=NOW()
			WHERE id=$1
		`, id, string(raw))
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, fmt.Errorf("tournament not found")
		}
		return s.Get(ctx, id)
	}
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	t, ok := s.mem[id]
	if !ok {
		return nil, fmt.Errorf("tournament not found")
	}
	t.Gallery = append([]string{}, clean...)
	t.UpdatedAt = time.Now().UTC()
	cp := *t
	cp.Gallery = append([]string{}, clean...)
	return &cp, nil
}

// RemoveGalleryAt removes the gallery image at index (0-based among non-empty URLs).
func (s *TournamentStore) RemoveGalleryAt(ctx context.Context, id string, index int) (*Tournament, error) {
	cur, err := s.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	urls := make([]string, 0, len(cur.Gallery))
	for _, u := range cur.Gallery {
		u = strings.TrimSpace(u)
		if u != "" {
			urls = append(urls, u)
		}
	}
	if index < 0 || index >= len(urls) {
		return nil, ErrGalleryIndex
	}
	next := append(append([]string{}, urls[:index]...), urls[index+1:]...)
	return s.UpdateGallery(ctx, id, next)
}

// FreezePrizePool locks the displayed pot (idempotent).
func (s *TournamentStore) FreezePrizePool(ctx context.Context, id string, amount float64) (*Tournament, error) {
	if s.db != nil && s.db.Ready() {
		tag, err := s.db.Pool.Exec(ctx, `
			UPDATE tournaments
			SET prize_pool_frozen_amount = COALESCE(prize_pool_frozen_amount, $2),
			    prize_pool_frozen_at = COALESCE(prize_pool_frozen_at, NOW()),
			    updated_at = NOW()
			WHERE id = $1
		`, id, amount)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, fmt.Errorf("tournament not found")
		}
		return s.Get(ctx, id)
	}
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	t, ok := s.mem[id]
	if !ok {
		return nil, fmt.Errorf("tournament not found")
	}
	if t.PrizePoolFrozenAmount == nil {
		amt := amount
		t.PrizePoolFrozenAmount = &amt
		now := time.Now().UTC()
		t.PrizePoolFrozenAt = &now
	}
	cp := *t
	return &cp, nil
}

// ClearPrizePoolFreeze clears a pre-start pot lock when a cup is archived before play.
func (s *TournamentStore) ClearPrizePoolFreeze(ctx context.Context, id string) (*Tournament, error) {
	if s.db != nil && s.db.Ready() {
		tag, err := s.db.Pool.Exec(ctx, `
			UPDATE tournaments
			SET prize_pool_frozen_amount = NULL,
			    prize_pool_frozen_at = NULL,
			    updated_at = NOW()
			WHERE id = $1
		`, id)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, fmt.Errorf("tournament not found")
		}
		return s.Get(ctx, id)
	}
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	t, ok := s.mem[id]
	if !ok {
		return nil, fmt.Errorf("tournament not found")
	}
	t.PrizePoolFrozenAmount = nil
	t.PrizePoolFrozenAt = nil
	cp := *t
	return &cp, nil
}

// UpdateTournamentInput updates mutable console fields (media stays on upload endpoints).
type UpdateTournamentInput struct {
	Title                   string
	Description             string
	IsFree                  bool
	EntryFeeAmount          float64
	EntryFeeCurrency        string
	PrizePool               map[string]any
	PrizePoolDisplayEnabled bool
	MaxPlayers              *int
	FormatID                string
	ArenaDurationMinutes    *int
	PrizePayoutMode         string
	PrizePlacePercents      map[string]any
}

// Update applies console edit fields. Prize image / gallery unchanged.
func (s *TournamentStore) Update(ctx context.Context, id string, in UpdateTournamentInput) (*Tournament, error) {
	if strings.TrimSpace(id) == "" {
		return nil, fmt.Errorf("id required")
	}
	if strings.TrimSpace(in.Title) == "" {
		return nil, fmt.Errorf("title required")
	}
	currency := strings.TrimSpace(in.EntryFeeCurrency)
	if currency == "" {
		return nil, fmt.Errorf("entry_fee_currency required from currency matrix")
	}
	amount := in.EntryFeeAmount
	if in.IsFree {
		amount = 0
	}
	if !in.IsFree && amount <= 0 {
		return nil, fmt.Errorf("paid tournament requires entry_fee_amount > 0")
	}
	prizePool := in.PrizePool
	if prizePool == nil {
		prizePool = map[string]any{}
	}
	display := in.PrizePoolDisplayEnabled && !in.IsFree && amount > 0
	maxPlayers := in.MaxPlayers
	payoutMode := strings.TrimSpace(in.PrizePayoutMode)
	placePercents := in.PrizePlacePercents
	if placePercents == nil {
		placePercents = map[string]any{}
	}
	if in.IsFree {
		display = false
		payoutMode = ""
		placePercents = map[string]any{}
	}
	formatID := strings.TrimSpace(in.FormatID)
	if formatID == "" {
		return nil, fmt.Errorf("format_id required")
	}
	now := time.Now().UTC()

	if s.db != nil && s.db.Ready() {
		prizeJSON, err := json.Marshal(prizePool)
		if err != nil {
			return nil, fmt.Errorf("prize_pool invalid")
		}
		percentsJSON, err := json.Marshal(placePercents)
		if err != nil {
			return nil, fmt.Errorf("prize_place_percents invalid")
		}
		tag, err := s.db.Pool.Exec(ctx, `
			UPDATE tournaments SET
				title=$2, description=$3, is_free=$4, entry_fee_amount=$5, entry_fee_currency=$6,
				prize_pool=$7::jsonb, prize_pool_display_enabled=$8, max_players=$9, format_id=$10,
				arena_duration_minutes=$11, prize_payout_mode=$12, prize_place_percents=$13::jsonb, updated_at=$14
			WHERE id=$1
		`, id, strings.TrimSpace(in.Title), nullIfEmpty(strings.TrimSpace(in.Description)), in.IsFree,
			amount, currency, string(prizeJSON), display, maxPlayers, formatID, in.ArenaDurationMinutes,
			payoutMode, string(percentsJSON), now)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, fmt.Errorf("tournament not found")
		}
		return s.Get(ctx, id)
	}
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	t, ok := s.mem[id]
	if !ok {
		return nil, fmt.Errorf("tournament not found")
	}
	t.Title = strings.TrimSpace(in.Title)
	t.Description = strings.TrimSpace(in.Description)
	t.IsFree = in.IsFree
	t.EntryFeeAmount = amount
	t.EntryFeeCurrency = currency
	t.PrizePool = prizePool
	t.PrizePoolDisplayEnabled = display
	t.MaxPlayers = maxPlayers
	t.FormatID = formatID
	t.ArenaDurationMinutes = in.ArenaDurationMinutes
	t.PrizePayoutMode = payoutMode
	t.PrizePlacePercents = placePercents
	t.UpdatedAt = now
	cp := *t
	if cp.Gallery != nil {
		cp.Gallery = append([]string{}, t.Gallery...)
	}
	return &cp, nil
}

// Delete removes a tournament row (entries cascade in DB).
func (s *TournamentStore) Delete(ctx context.Context, id string) error {
	if strings.TrimSpace(id) == "" {
		return fmt.Errorf("id required")
	}
	if s.db != nil && s.db.Ready() {
		tag, err := s.db.Pool.Exec(ctx, `DELETE FROM tournaments WHERE id=$1`, id)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return fmt.Errorf("tournament not found")
		}
		return nil
	}
	if err := s.requireDB(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.mem[id]; !ok {
		return fmt.Errorf("tournament not found")
	}
	delete(s.mem, id)
	return nil
}

// SetStatus soft-lifecycle update from platform_settings.client_enums (no hard DELETE).
func (s *TournamentStore) SetStatus(ctx context.Context, id, status string) (*Tournament, error) {
	if status == "" {
		return nil, fmt.Errorf("status required")
	}
	if s.db != nil && s.db.Ready() {
		tag, err := s.db.Pool.Exec(ctx, `
			UPDATE tournaments SET status=$2, updated_at=NOW() WHERE id=$1
		`, id, status)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, fmt.Errorf("tournament not found")
		}
		return s.Get(ctx, id)
	}
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	t, ok := s.mem[id]
	if !ok {
		return nil, fmt.Errorf("tournament not found")
	}
	t.Status = status
	t.UpdatedAt = time.Now().UTC()
	cp := *t
	return &cp, nil
}

func nullIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// ValidateOfficialMaxPlayers enforces Unlimited (nil or high safety ceiling) for Arena only.
// Classic formats require a fixed seat cap (>= 2) at or below the DB classic ceiling.
// Returns a tournament_chrome err key.
func ValidateOfficialMaxPlayers(
	formatID, arenaFormatID string,
	maxPlayers *int,
	swissRoundsByMax map[string]int,
) string {
	arena := strings.TrimSpace(arenaFormatID)
	format := strings.TrimSpace(formatID)
	isArena := arena != "" && format == arena
	if maxPlayers == nil {
		if isArena {
			return ""
		}
		return "err_unlimited_arena_only"
	}
	if !HasPlayerCap(maxPlayers) {
		return "err_max_players_required"
	}
	ceiling := ClassicSeatCeiling(swissRoundsByMax)
	if ceiling >= 2 && *maxPlayers > ceiling && !isArena {
		return "err_unlimited_arena_only"
	}
	return ""
}
