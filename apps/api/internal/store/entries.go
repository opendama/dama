package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"dama/apps/api/internal/db"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type TournamentEntry struct {
	ID              string    `json:"id"`
	TournamentID    string    `json:"tournament_id"`
	UserID          string    `json:"user_id"`
	EntryFeeCharged float64   `json:"entry_fee_charged"`
	Currency        string    `json:"currency"`
	IsFree          bool      `json:"is_free"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
}

// TournamentRosterEntry is a public cup roster row (lobby / admin detail).
type TournamentRosterEntry struct {
	UserID      string     `json:"user_id"`
	Username    string     `json:"username,omitempty"`
	Status      string     `json:"status,omitempty"`
	CheckedInAt *time.Time `json:"checked_in_at,omitempty"`
	JoinedAt    time.Time  `json:"joined_at"`
	Placement   *int       `json:"placement,omitempty"`
}

type EntryStore struct {
	db  *db.Handle
	mu  sync.RWMutex
	mem map[string]*TournamentEntry // key tournamentID:userID
}

func NewEntryStore(handle *db.Handle) *EntryStore {
	return &EntryStore{db: handle, mem: map[string]*TournamentEntry{}}
}

func entryKey(tournamentID, userID string) string {
	return tournamentID + ":" + userID
}

func (s *EntryStore) requireDB() error {
	if s.db != nil && s.db.Ready() {
		return nil
	}
	if allowMemoryMode() {
		return nil
	}
	return fmt.Errorf("service temporarily unavailable")
}

// ListUserIDsByTournament returns entrant user ids for notification fanout.
// When excludeUncheckedIn is true, only rows with checked_in_at set are included.
func (s *EntryStore) ListUserIDsByTournament(ctx context.Context, tournamentID string, excludeUncheckedIn bool) ([]string, error) {
	tournamentID = strings.TrimSpace(tournamentID)
	if tournamentID == "" {
		return nil, fmt.Errorf("tournament required")
	}
	if s.db != nil && s.db.Ready() {
		q := `
			SELECT user_id::text FROM tournament_entries WHERE tournament_id=$1`
		if excludeUncheckedIn {
			q += ` AND checked_in_at IS NOT NULL`
		}
		q += ` ORDER BY created_at ASC`
		rows, err := s.db.Pool.Query(ctx, q, tournamentID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		out := []string{}
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				return nil, err
			}
			out = append(out, id)
		}
		return out, rows.Err()
	}
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []string{}
	for _, e := range s.mem {
		if e != nil && e.TournamentID == tournamentID {
			out = append(out, e.UserID)
		}
	}
	return out, nil
}

// ListByTournament returns all entries for refund / console flows.
func (s *EntryStore) ListByTournament(ctx context.Context, tournamentID string) ([]TournamentEntry, error) {
	tournamentID = strings.TrimSpace(tournamentID)
	if tournamentID == "" {
		return nil, fmt.Errorf("tournament required")
	}
	if s.db != nil && s.db.Ready() {
		rows, err := s.db.Pool.Query(ctx, `
			SELECT id, tournament_id, user_id, entry_fee_charged, currency, is_free, status, created_at
			FROM tournament_entries WHERE tournament_id=$1 ORDER BY created_at ASC
		`, tournamentID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		out := []TournamentEntry{}
		for rows.Next() {
			var e TournamentEntry
			if err := rows.Scan(
				&e.ID, &e.TournamentID, &e.UserID, &e.EntryFeeCharged, &e.Currency, &e.IsFree, &e.Status, &e.CreatedAt,
			); err != nil {
				return nil, err
			}
			out = append(out, e)
		}
		return out, rows.Err()
	}
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []TournamentEntry{}
	for _, e := range s.mem {
		if e != nil && e.TournamentID == tournamentID {
			cp := *e
			out = append(out, cp)
		}
	}
	return out, nil
}

// ClearEntryFeeCharged zeros fee on a refunded tournament seat.
func (s *EntryStore) ClearEntryFeeCharged(ctx context.Context, entryID string) error {
	entryID = strings.TrimSpace(entryID)
	if entryID == "" {
		return fmt.Errorf("entry id required")
	}
	if s.db != nil && s.db.Ready() {
		_, err := s.db.Pool.Exec(ctx, `
			UPDATE tournament_entries SET entry_fee_charged = 0 WHERE id = $1
		`, entryID)
		return err
	}
	if err := s.requireDB(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, e := range s.mem {
		if e != nil && e.ID == entryID {
			e.EntryFeeCharged = 0
			return nil
		}
	}
	return fmt.Errorf("entry not found")
}

// CountByTournament returns the number of tournament_entries for a tournament.
func (s *EntryStore) CountByTournament(ctx context.Context, tournamentID string) (int, error) {
	if s.db != nil && s.db.Ready() {
		var n int
		err := s.db.Pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM tournament_entries WHERE tournament_id=$1
		`, tournamentID).Scan(&n)
		if err != nil {
			return 0, err
		}
		return n, nil
	}
	if err := s.requireDB(); err != nil {
		return 0, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	n := 0
	for _, e := range s.mem {
		if e.TournamentID == tournamentID {
			n++
		}
	}
	return n, nil
}

// EnrolledAmong returns tournament IDs from the page that the user already entered.
func (s *EntryStore) EnrolledAmong(ctx context.Context, userID string, tournamentIDs []string) (map[string]bool, error) {
	out := map[string]bool{}
	userID = strings.TrimSpace(userID)
	if userID == "" || len(tournamentIDs) == 0 {
		return out, nil
	}
	ids := make([]string, 0, len(tournamentIDs))
	for _, id := range tournamentIDs {
		id = strings.TrimSpace(id)
		if id != "" {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return out, nil
	}
	if s.db != nil && s.db.Ready() {
		rows, err := s.db.Pool.Query(ctx, `
			SELECT tournament_id::text
			FROM tournament_entries
			WHERE user_id = $1::uuid AND tournament_id = ANY($2::uuid[])
		`, userID, ids)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var tid string
			if err := rows.Scan(&tid); err != nil {
				return nil, err
			}
			tid = strings.TrimSpace(tid)
			if tid != "" {
				out[tid] = true
			}
		}
		return out, rows.Err()
	}
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, tid := range ids {
		if _, ok := s.mem[entryKey(tid, userID)]; ok {
			out[tid] = true
		}
	}
	return out, nil
}

// ViewerEntryStats is the viewer's placement / arena score on one cup (My tournaments memory).
type ViewerEntryStats struct {
	Placement   *int
	ArenaPoints float64
	ArenaStreak int
}

// ViewerStatsAmong returns placement/points/streak for the user across the given tournament ids.
func (s *EntryStore) ViewerStatsAmong(ctx context.Context, userID string, tournamentIDs []string) (map[string]ViewerEntryStats, error) {
	out := map[string]ViewerEntryStats{}
	userID = strings.TrimSpace(userID)
	if userID == "" || len(tournamentIDs) == 0 {
		return out, nil
	}
	ids := make([]string, 0, len(tournamentIDs))
	for _, id := range tournamentIDs {
		id = strings.TrimSpace(id)
		if id != "" {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return out, nil
	}
	if s.db == nil || !s.db.Ready() {
		return out, nil
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT tournament_id::text, placement, COALESCE(arena_points, 0)::float8, COALESCE(arena_streak, 0)::int
		FROM tournament_entries
		WHERE user_id = $1::uuid AND tournament_id = ANY($2::uuid[])
	`, userID, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var tid string
		var placement *int
		var pts float64
		var streak int
		if err := rows.Scan(&tid, &placement, &pts, &streak); err != nil {
			return nil, err
		}
		tid = strings.TrimSpace(tid)
		if tid == "" {
			continue
		}
		out[tid] = ViewerEntryStats{Placement: placement, ArenaPoints: pts, ArenaStreak: streak}
	}
	return out, rows.Err()
}

// ListRosterForTournament returns entrants ordered by join time (public lobby roster).
func (s *EntryStore) ListRosterForTournament(ctx context.Context, tournamentID string) ([]TournamentRosterEntry, error) {
	tournamentID = strings.TrimSpace(tournamentID)
	if tournamentID == "" {
		return nil, fmt.Errorf("tournament required")
	}
	if s.db != nil && s.db.Ready() {
		rows, err := s.db.Pool.Query(ctx, `
			SELECT e.user_id::text, COALESCE(u.username, ''), COALESCE(e.status, ''), e.checked_in_at, e.created_at, e.placement
			FROM tournament_entries e
			LEFT JOIN users u ON u.id = e.user_id
			WHERE e.tournament_id = $1
			ORDER BY e.created_at ASC`, tournamentID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		out := make([]TournamentRosterEntry, 0)
		for rows.Next() {
			var row TournamentRosterEntry
			if err := rows.Scan(&row.UserID, &row.Username, &row.Status, &row.CheckedInAt, &row.JoinedAt, &row.Placement); err != nil {
				return nil, err
			}
			out = append(out, row)
		}
		return out, rows.Err()
	}
	return []TournamentRosterEntry{}, nil
}

// ListRosterPageForTournament returns a skip/limit page of entrants plus total count.
func (s *EntryStore) ListRosterPageForTournament(
	ctx context.Context, tournamentID string, skip, limit int,
) ([]TournamentRosterEntry, int, error) {
	tournamentID = strings.TrimSpace(tournamentID)
	if tournamentID == "" {
		return nil, 0, fmt.Errorf("tournament required")
	}
	if skip < 0 || limit < 1 {
		return nil, 0, fmt.Errorf("invalid pagination")
	}
	if s.db == nil || !s.db.Ready() {
		return nil, 0, fmt.Errorf("database unavailable")
	}
	var total int
	if err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM tournament_entries WHERE tournament_id = $1`, tournamentID,
	).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT e.user_id::text, COALESCE(u.username, ''), COALESCE(e.status, ''), e.checked_in_at, e.created_at, e.placement
		FROM tournament_entries e
		LEFT JOIN users u ON u.id = e.user_id
		WHERE e.tournament_id = $1
		ORDER BY e.created_at ASC
		OFFSET $2 LIMIT $3`, tournamentID, skip, limit)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := make([]TournamentRosterEntry, 0)
	for rows.Next() {
		var row TournamentRosterEntry
		if err := rows.Scan(&row.UserID, &row.Username, &row.Status, &row.CheckedInAt, &row.JoinedAt, &row.Placement); err != nil {
			return nil, 0, err
		}
		out = append(out, row)
	}
	return out, total, rows.Err()
}

// Exists reports whether the user already has a tournament entry (before wallet debit).
func (s *EntryStore) Exists(ctx context.Context, tournamentID, userID string) (bool, error) {
	if s.db != nil && s.db.Ready() {
		var one int
		err := s.db.Pool.QueryRow(ctx, `
			SELECT 1 FROM tournament_entries WHERE tournament_id=$1 AND user_id=$2 LIMIT 1
		`, tournamentID, userID).Scan(&one)
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		if err != nil {
			return false, err
		}
		return true, nil
	}
	if err := s.requireDB(); err != nil {
		return false, err
	}
	key := entryKey(tournamentID, userID)
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, ok := s.mem[key]
	return ok, nil
}

// ErrTournamentEntryFull is returned when RegisterWithCapacity hits a hard seat cap.
var ErrTournamentEntryFull = errors.New("tournament entry full")

func (s *EntryStore) Register(ctx context.Context, tournamentID, userID string, fee float64, currency string, isFree bool) (*TournamentEntry, error) {
	return s.RegisterWithCapacity(ctx, tournamentID, userID, fee, currency, isFree, 0)
}

// RegisterWithCapacity inserts a tournament entry. When maxPlayers > 0, locks the
// tournament row and rejects when entry count is already at the seat cap (JoinWithCapacity parity).
// maxPlayers 0 = uncapped (Arena Unlimited null).
func (s *EntryStore) RegisterWithCapacity(
	ctx context.Context,
	tournamentID, userID string,
	fee float64,
	currency string,
	isFree bool,
	maxPlayers int,
) (*TournamentEntry, error) {
	e := &TournamentEntry{
		ID:              uuid.NewString(),
		TournamentID:    tournamentID,
		UserID:          userID,
		EntryFeeCharged: fee,
		Currency:        currency,
		IsFree:          isFree,
		Status:          "registered",
		CreatedAt:       time.Now().UTC(),
	}

	if s.db != nil && s.db.Ready() {
		tx, err := s.db.Pool.Begin(ctx)
		if err != nil {
			return nil, err
		}
		defer tx.Rollback(ctx)

		if _, err := tx.Exec(ctx, `SELECT id FROM tournaments WHERE id = $1 FOR UPDATE`, tournamentID); err != nil {
			return nil, err
		}
		if maxPlayers > 0 {
			var n int
			if err := tx.QueryRow(ctx, `
				SELECT COUNT(*) FROM tournament_entries WHERE tournament_id = $1`, tournamentID).Scan(&n); err != nil {
				return nil, err
			}
			if n >= maxPlayers {
				return nil, ErrTournamentEntryFull
			}
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO tournament_entries (
				id, tournament_id, user_id, entry_fee_charged, currency, is_free, status, created_at
			) VALUES ($1,$2,$3,$4,$5,$6,'registered',NOW())
		`, e.ID, tournamentID, userID, fee, currency, isFree)
		if err != nil {
			if strings.Contains(err.Error(), "tournament_entries") &&
				(strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique")) {
				return nil, fmt.Errorf("already registered")
			}
			return nil, err
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		cp := *e
		return &cp, nil
	}

	if err := s.requireDB(); err != nil {
		return nil, err
	}

	key := entryKey(tournamentID, userID)
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.mem[key]; exists {
		return nil, fmt.Errorf("already registered")
	}
	if maxPlayers > 0 {
		n := 0
		for _, existing := range s.mem {
			if existing != nil && existing.TournamentID == tournamentID {
				n++
			}
		}
		if n >= maxPlayers {
			return nil, ErrTournamentEntryFull
		}
	}
	s.mem[key] = e
	cp := *e
	return &cp, nil
}

// PlacementSummary is a public tournament placement row for player inspect modals.
type PlacementSummary struct {
	TournamentID string    `json:"tournament_id"`
	Title        string    `json:"title"`
	Status       string    `json:"status"`
	IsFree       bool      `json:"is_free"`
	EntryStatus  string    `json:"entry_status"`
	JoinedAt     time.Time `json:"joined_at"`
}

func (s *EntryStore) ListPlacementsForUser(ctx context.Context, userID string, limit int) ([]PlacementSummary, error) {
	list, _, err := s.ListPlacementsForUserPaged(ctx, userID, 0, limit)
	return list, err
}

// ListPlacementsForUserPaged returns tournament placements with skip/limit and total.
func (s *EntryStore) ListPlacementsForUserPaged(ctx context.Context, userID string, skip, limit int) ([]PlacementSummary, int, error) {
	if skip < 0 {
		skip = 0
	}
	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}
	if s.db != nil && s.db.Ready() {
		var total int
		if err := s.db.Pool.QueryRow(ctx, `
			SELECT COUNT(*)::int FROM tournament_entries WHERE user_id = $1
		`, userID).Scan(&total); err != nil {
			return nil, 0, err
		}
		rows, err := s.db.Pool.Query(ctx, `
			SELECT e.tournament_id, t.title, t.status, e.is_free, e.status, e.created_at
			FROM tournament_entries e
			JOIN tournaments t ON t.id = e.tournament_id
			WHERE e.user_id = $1
			ORDER BY e.created_at DESC
			LIMIT $2 OFFSET $3
		`, userID, limit, skip)
		if err != nil {
			return nil, 0, err
		}
		defer rows.Close()
		out := []PlacementSummary{}
		for rows.Next() {
			var p PlacementSummary
			if err := rows.Scan(&p.TournamentID, &p.Title, &p.Status, &p.IsFree, &p.EntryStatus, &p.JoinedAt); err != nil {
				return nil, 0, err
			}
			out = append(out, p)
		}
		return out, total, nil
	}
	return []PlacementSummary{}, 0, nil
}
