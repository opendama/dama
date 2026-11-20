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

type MatchHistory struct {
	ID            string    `json:"id"`
	GameID        string    `json:"game_id,omitempty"`
	Mode          string    `json:"mode"`
	Player1ID     string    `json:"player1_id,omitempty"`
	Player2ID     string    `json:"player2_id,omitempty"`
	WinnerID      string    `json:"winner_id,omitempty"`
	IsDraw        bool      `json:"is_draw"`
	MoveCount     int       `json:"move_count"`
	AISearchDepth int       `json:"-"` // internal AI difficulty - never client-facing
	IsFree        bool      `json:"is_free"`
	Rated         bool      `json:"rated"`
	FinishedAt    time.Time `json:"finished_at"`
}

type MatchHistoryStore struct {
	db  *db.Handle
	mu  sync.RWMutex
	mem []MatchHistory
}

func NewMatchHistoryStore(handle *db.Handle) *MatchHistoryStore {
	return &MatchHistoryStore{db: handle, mem: []MatchHistory{}}
}

type RecordMatchInput struct {
	GameID        string
	Mode          string
	Player1ID     string
	Player2ID     string
	WinnerID      string
	IsDraw        bool
	MoveCount     int
	AISearchDepth int
	IsFree        bool
	Rated         bool
}

// Record inserts match_history once per game_id.
// created=false means a prior finalize already owns side effects (career / bracket / arena).
func (s *MatchHistoryStore) Record(ctx context.Context, in RecordMatchInput) (*MatchHistory, bool, error) {
	m := MatchHistory{
		ID:            uuid.NewString(),
		GameID:        in.GameID,
		Mode:          in.Mode,
		Player1ID:     in.Player1ID,
		Player2ID:     in.Player2ID,
		WinnerID:      in.WinnerID,
		IsDraw:        in.IsDraw,
		MoveCount:     in.MoveCount,
		AISearchDepth: in.AISearchDepth,
		IsFree:        in.IsFree,
		Rated:         in.Rated,
		FinishedAt:    time.Now().UTC(),
	}
	if s.db == nil || !s.db.Ready() {
		return nil, false, fmt.Errorf("match history unavailable")
	}
	// Idempotent by game_id: finish retries / deferred finalize must not fail the move path.
	if existing, err := s.ByGameID(ctx, in.GameID); err == nil && existing != nil {
		return existing, false, nil
	}
	if _, err := s.db.Pool.Exec(ctx, `
		INSERT INTO match_history (
			id, game_id, mode, player1_id, player2_id, winner_id, is_draw, move_count, ai_search_depth, is_free, rated, finished_at
		) VALUES ($1,NULLIF($2,'')::uuid,$3,NULLIF($4,'')::uuid,NULLIF($5,'')::uuid,NULLIF($6,'')::uuid,$7,$8,$9,$10,$11,NOW())
	`, m.ID, m.GameID, m.Mode, m.Player1ID, m.Player2ID, m.WinnerID, m.IsDraw, m.MoveCount, nullInt(m.AISearchDepth), m.IsFree, m.Rated); err != nil {
		// Concurrent insert race: treat existing row as success (not created by this caller).
		if existing, lookupErr := s.ByGameID(ctx, in.GameID); lookupErr == nil && existing != nil {
			return existing, false, nil
		}
		return nil, false, err
	}
	s.mu.Lock()
	s.mem = append([]MatchHistory{m}, s.mem...)
	if len(s.mem) > 500 {
		s.mem = s.mem[:500]
	}
	s.mu.Unlock()
	cp := m
	return &cp, true, nil
}

// ByGameID returns the finished match row for a live game id (if recorded).
func (s *MatchHistoryStore) ByGameID(ctx context.Context, gameID string) (*MatchHistory, error) {
	gameID = trimID(gameID)
	if gameID == "" {
		return nil, fmt.Errorf("game id required")
	}
	if s.db != nil && s.db.Ready() {
		var m MatchHistory
		err := s.db.Pool.QueryRow(ctx, `
			SELECT id, COALESCE(game_id::text,''), mode, COALESCE(player1_id::text,''), COALESCE(player2_id::text,''),
			       COALESCE(winner_id::text,''), is_draw, move_count, COALESCE(ai_search_depth,0), is_free, rated, finished_at
			FROM match_history
			WHERE game_id = $1::uuid
			ORDER BY finished_at DESC
			LIMIT 1
		`, gameID).Scan(
			&m.ID, &m.GameID, &m.Mode, &m.Player1ID, &m.Player2ID, &m.WinnerID,
			&m.IsDraw, &m.MoveCount, &m.AISearchDepth, &m.IsFree, &m.Rated, &m.FinishedAt,
		)
		if err != nil {
			return nil, err
		}
		return &m, nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	for i := range s.mem {
		if s.mem[i].GameID == gameID {
			cp := s.mem[i]
			return &cp, nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func (s *MatchHistoryStore) ListForUser(ctx context.Context, userID string, limit int) ([]MatchHistory, error) {
	list, _, err := s.ListForUserPaged(ctx, userID, 0, limit, "")
	return list, err
}

// ListForUserPaged returns match history for a user with skip/limit and total count.
// Optional q matches opponent username or game id (case-insensitive substring).
func (s *MatchHistoryStore) ListForUserPaged(ctx context.Context, userID string, skip, limit int, q string) ([]MatchHistory, int, error) {
	if skip < 0 {
		skip = 0
	}
	if limit <= 0 {
		return nil, 0, fmt.Errorf("limit required")
	}
	needle := strings.TrimSpace(q)
	if s.db != nil && s.db.Ready() {
		var total int
		if err := s.db.Pool.QueryRow(ctx, `
			SELECT COUNT(*)::int FROM match_history mh
			WHERE (mh.player1_id::text = $1 OR mh.player2_id::text = $1)
			  AND (
			    $2 = ''
			    OR COALESCE(mh.game_id::text, '') ILIKE '%' || $2 || '%'
			    OR EXISTS (
			      SELECT 1 FROM users u
			      WHERE u.id = CASE
			        WHEN mh.player1_id::text = $1 THEN mh.player2_id
			        ELSE mh.player1_id
			      END
			      AND lower(u.username) LIKE '%' || lower($2) || '%'
			    )
			  )
		`, userID, needle).Scan(&total); err != nil {
			return nil, 0, err
		}
		rows, err := s.db.Pool.Query(ctx, `
			SELECT mh.id, COALESCE(mh.game_id::text,''), mh.mode, COALESCE(mh.player1_id::text,''), COALESCE(mh.player2_id::text,''),
			       COALESCE(mh.winner_id::text,''), mh.is_draw, mh.move_count, COALESCE(mh.ai_search_depth,0), mh.is_free, mh.rated, mh.finished_at
			FROM match_history mh
			WHERE (mh.player1_id::text = $1 OR mh.player2_id::text = $1)
			  AND (
			    $2 = ''
			    OR COALESCE(mh.game_id::text, '') ILIKE '%' || $2 || '%'
			    OR EXISTS (
			      SELECT 1 FROM users u
			      WHERE u.id = CASE
			        WHEN mh.player1_id::text = $1 THEN mh.player2_id
			        ELSE mh.player1_id
			      END
			      AND lower(u.username) LIKE '%' || lower($2) || '%'
			    )
			  )
			ORDER BY mh.finished_at DESC, mh.id ASC
			LIMIT $3 OFFSET $4
		`, userID, needle, limit, skip)
		if err != nil {
			return nil, 0, err
		}
		defer rows.Close()
		out := []MatchHistory{}
		for rows.Next() {
			var m MatchHistory
			if err := rows.Scan(&m.ID, &m.GameID, &m.Mode, &m.Player1ID, &m.Player2ID, &m.WinnerID, &m.IsDraw, &m.MoveCount, &m.AISearchDepth, &m.IsFree, &m.Rated, &m.FinishedAt); err != nil {
				return nil, 0, err
			}
			out = append(out, m)
		}
		return out, total, nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	all := []MatchHistory{}
	lower := strings.ToLower(needle)
	for _, m := range s.mem {
		if m.Player1ID != userID && m.Player2ID != userID {
			continue
		}
		if needle != "" {
			if !strings.Contains(strings.ToLower(m.GameID), lower) {
				continue
			}
		}
		all = append(all, m)
	}
	total := len(all)
	if skip >= total {
		return []MatchHistory{}, total, nil
	}
	end := skip + limit
	if end > total {
		end = total
	}
	return all[skip:end], total, nil
}

func nullInt(n int) *int {
	if n == 0 {
		return nil
	}
	return &n
}

// PeriodKind is a Hall of Fame ranking window.
type PeriodKind string

const (
	PeriodWeek  PeriodKind = "week"
	PeriodMonth PeriodKind = "month"
	PeriodYear  PeriodKind = "year"
	PeriodAll   PeriodKind = "all"
)

func ParsePeriodKind(raw string) (PeriodKind, error) {
	switch PeriodKind(raw) {
	case PeriodWeek, PeriodMonth, PeriodYear, PeriodAll, "":
		if raw == "" {
			return PeriodAll, nil
		}
		return PeriodKind(raw), nil
	default:
		return "", fmt.Errorf("invalid period")
	}
}

func (p PeriodKind) Since(now time.Time) time.Time {
	now = now.UTC()
	switch p {
	case PeriodWeek:
		return now.AddDate(0, 0, -7)
	case PeriodMonth:
		return now.AddDate(0, -1, 0)
	case PeriodYear:
		return now.AddDate(-1, 0, 0)
	default:
		return time.Time{}
	}
}

// HallOfFameEntry is a period win ranking row (wins used as points).
type HallOfFameEntry struct {
	ID             string
	Username       string
	Rating         int
	XP             int
	Wins           int // period wins (or career wins for all-time rating board callers)
	Losses         int
	Draws          int
	PeriodWins     int
	Region         *string
	CountryCode    *string
	AvatarThumbURL *string
	AvatarFullURL  *string
}

// HallOfFamePaged ranks players by rated wins in the period (match_history). PeriodAll returns empty;
// callers should use UserStore.LeaderboardPaged for all-time rating ladder.
// Unrated cups (public_event_matches_rated off) and AI seats do not count.
func (s *MatchHistoryStore) HallOfFamePaged(ctx context.Context, period PeriodKind, skip, limit int, playerRole string) ([]HallOfFameEntry, int, error) {
	if period == PeriodAll || period == "" {
		return nil, 0, fmt.Errorf("use rating leaderboard for all-time")
	}
	if limit <= 0 {
		limit = 50
	}
	if skip < 0 {
		skip = 0
	}
	if playerRole == "" {
		return nil, 0, fmt.Errorf("player role required")
	}
	since := period.Since(time.Now().UTC())
	if s.db == nil || !s.db.Ready() {
		return nil, 0, fmt.Errorf("hall of fame unavailable")
	}
	var total int
	if err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(DISTINCT mh.winner_id)
		FROM match_history mh
		INNER JOIN users u ON u.id = mh.winner_id
		WHERE mh.is_draw = FALSE
		  AND mh.rated = TRUE
		  AND mh.winner_id IS NOT NULL
		  AND mh.finished_at >= $1
		  AND u.is_active = TRUE
		  AND u.role = $2
	`, since, playerRole).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT u.id::text, u.username, u.rating, u.xp,
		       COALESCE(u.wins,0), COALESCE(u.losses,0), COALESCE(u.draws,0),
		       COUNT(*)::int AS period_wins,
		       u.region, u.country_code, u.avatar_thumb_url, u.avatar_full_url
		FROM match_history mh
		INNER JOIN users u ON u.id = mh.winner_id
		WHERE mh.is_draw = FALSE
		  AND mh.rated = TRUE
		  AND mh.winner_id IS NOT NULL
		  AND mh.finished_at >= $1
		  AND u.is_active = TRUE
		  AND u.role = $4
		GROUP BY u.id
		ORDER BY period_wins DESC, u.rating DESC, u.xp DESC
		LIMIT $2 OFFSET $3
	`, since, limit, skip, playerRole)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []HallOfFameEntry{}
	for rows.Next() {
		var e HallOfFameEntry
		if err := rows.Scan(
			&e.ID, &e.Username, &e.Rating, &e.XP,
			&e.Wins, &e.Losses, &e.Draws, &e.PeriodWins,
			&e.Region, &e.CountryCode, &e.AvatarThumbURL, &e.AvatarFullURL,
		); err != nil {
			return nil, 0, err
		}
		out = append(out, e)
	}
	return out, total, nil
}

// HallOfFameRank returns 1-based rank and period wins for userID (0 if unranked).
func (s *MatchHistoryStore) HallOfFameRank(ctx context.Context, period PeriodKind, userID, playerRole string) (rank int, periodWins int, err error) {
	userID = trimID(userID)
	if userID == "" || period == PeriodAll || period == "" {
		return 0, 0, nil
	}
	if s.db == nil || !s.db.Ready() {
		return 0, 0, fmt.Errorf("hall of fame unavailable")
	}
	since := period.Since(time.Now().UTC())
	err = s.db.Pool.QueryRow(ctx, `
		WITH ranked AS (
			SELECT mh.winner_id,
			       COUNT(*)::int AS period_wins,
			       RANK() OVER (ORDER BY COUNT(*) DESC, MAX(u.rating) DESC, MAX(u.xp) DESC) AS rnk
			FROM match_history mh
			INNER JOIN users u ON u.id = mh.winner_id
			WHERE mh.is_draw = FALSE
			  AND mh.rated = TRUE
			  AND mh.winner_id IS NOT NULL
			  AND mh.finished_at >= $1
			  AND u.is_active = TRUE
			  AND u.role = $2
			GROUP BY mh.winner_id
		)
		SELECT rnk::int, period_wins FROM ranked WHERE winner_id = $3::uuid
	`, since, playerRole, userID).Scan(&rank, &periodWins)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, 0, nil
		}
		return 0, 0, err
	}
	return rank, periodWins, nil
}
