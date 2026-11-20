package store

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var (
	ErrArenaNotActive   = errors.New("arena not active")
	ErrArenaInMatch     = errors.New("arena player in live match")
	ErrArenaQueue       = errors.New("arena queue unavailable")
	ErrArenaScoreConfig = errors.New("arena score config invalid")
)

type ArenaScoreConfig struct {
	PointsWin, PointsDraw, PointsLoss   float64
	StreakSecondWin, StreakThirdPlusWin float64
}

// CompetitionPointsAward is points earned from one arena (or standings) result.
type CompetitionPointsAward struct {
	UserID string
	Points float64
}

type ArenaPairingMode string

const (
	ArenaPairingByRating ArenaPairingMode = "rating"
	ArenaPairingByScore  ArenaPairingMode = "score"
)

func ParseArenaScoreConfig(cfg ClientEnumsConfig) (ArenaScoreConfig, error) {
	parse := func(raw string) (float64, error) {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			return 0, ErrArenaScoreConfig
		}
		v, err := strconv.ParseFloat(raw, 64)
		if err != nil {
			return 0, ErrArenaScoreConfig
		}
		return v, nil
	}
	win, err := parse(cfg.CompetitionArenaPointsWin)
	if err != nil {
		return ArenaScoreConfig{}, err
	}
	draw, err := parse(cfg.CompetitionArenaPointsDraw)
	if err != nil {
		return ArenaScoreConfig{}, err
	}
	loss, err := parse(cfg.CompetitionArenaPointsLoss)
	if err != nil {
		return ArenaScoreConfig{}, err
	}
	s2, err := parse(cfg.CompetitionArenaStreakSecondWin)
	if err != nil {
		return ArenaScoreConfig{}, err
	}
	s3, err := parse(cfg.CompetitionArenaStreakThirdPlusWin)
	if err != nil {
		return ArenaScoreConfig{}, err
	}
	return ArenaScoreConfig{
		PointsWin: win, PointsDraw: draw, PointsLoss: loss,
		StreakSecondWin: s2, StreakThirdPlusWin: s3,
	}, nil
}

type ArenaQueuePlayer struct {
	UserID   string  `json:"user_id"`
	Username string  `json:"username,omitempty"`
	Rating   int     `json:"rating"`
	Points   float64 `json:"arena_points"`
}

type ArenaStandingRow struct {
	UserID     string  `json:"user_id"`
	Username   string  `json:"username,omitempty"`
	Points     float64 `json:"arena_points"`
	Streak     int     `json:"arena_streak"`
	BestStreak int     `json:"arena_best_streak"`
	Wins       int     `json:"arena_wins"`
	Losses     int     `json:"arena_losses"`
	Draws      int     `json:"arena_draws"`
	Placement  *int    `json:"placement,omitempty"`
}

func arenaWinPoints(score ArenaScoreConfig, newStreak int) float64 {
	if newStreak >= 3 {
		return score.StreakThirdPlusWin
	}
	if newStreak == 2 {
		return score.StreakSecondWin
	}
	return score.PointsWin
}

func (s *TournamentStore) StartArena(ctx context.Context, tournamentID string, durationMinutes int, phase string) (*Tournament, error) {
	if !s.bracketReady() {
		return nil, errors.New("database unavailable")
	}
	if durationMinutes < 1 {
		return nil, ErrHostedEventInvalidInput
	}
	phase = strings.TrimSpace(phase)
	if phase == "" {
		return nil, ErrHostedEventInvalidInput
	}
	ends := time.Now().UTC().Add(time.Duration(durationMinutes) * time.Minute)
	row := s.db.Pool.QueryRow(ctx, `
		UPDATE tournaments SET
			started_at = COALESCE(started_at, NOW()),
			finished_at = NULL,
			winner_id = NULL,
			arena_duration_minutes = $2,
			arena_ends_at = $3,
			updated_at = NOW()
		WHERE id = $1 AND started_at IS NULL
		RETURNING `+tournamentSelectCols, tournamentID, durationMinutes, ends)
	t, err := scanTournament(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTournamentAlreadyStarted
		}
		return nil, err
	}
	return t, nil
}

func (s *TournamentStore) arenaEntryActive(ctx context.Context, tournamentID, userID string) error {
	var n int
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM tournament_entries
		WHERE tournament_id = $1 AND user_id = $2::uuid`, tournamentID, userID).Scan(&n)
	if err != nil || n < 1 {
		return ErrHostedEntryNotFound
	}
	return nil
}

func (s *TournamentStore) arenaPlayerInOpenMatch(
	ctx context.Context, tournamentID, userID, phase string, bst HostedBracketStatuses,
) (bool, error) {
	var n int
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM tournament_bracket_matches
		WHERE tournament_id = $1 AND phase = $2
		  AND ($3::uuid = player_a_id OR $3::uuid = player_b_id)
		  AND status IN ($4, $5)
		  AND finished_at IS NULL`,
		tournamentID, phase, userID, bst.Ready, bst.Live).Scan(&n)
	return n > 0, err
}

func (s *TournamentStore) JoinArenaQueue(ctx context.Context, tournamentID, userID string, bst HostedBracketStatuses, phase string) error {
	if !s.bracketReady() {
		return errors.New("database unavailable")
	}
	userID = strings.TrimSpace(userID)
	tournamentID = strings.TrimSpace(tournamentID)
	if userID == "" || tournamentID == "" {
		return ErrArenaQueue
	}
	tour, err := s.Get(ctx, tournamentID)
	if err != nil {
		return err
	}
	if tour.StartedAt == nil || tour.FinishedAt != nil {
		return ErrArenaNotActive
	}
	if tour.ArenaEndsAt == nil || !time.Now().UTC().Before(*tour.ArenaEndsAt) {
		return ErrArenaNotActive
	}
	if err := s.arenaEntryActive(ctx, tournamentID, userID); err != nil {
		return err
	}
	inMatch, err := s.arenaPlayerInOpenMatch(ctx, tournamentID, userID, phase, bst)
	if err != nil {
		return err
	}
	if inMatch {
		return ErrArenaInMatch
	}
	tag, err := s.db.Pool.Exec(ctx, `
		UPDATE tournament_entries SET
			arena_queue_joined_at = NOW(),
			arena_left_at = NULL
		WHERE tournament_id = $1 AND user_id = $2::uuid`, tournamentID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrHostedEntryNotFound
	}
	return nil
}

func (s *TournamentStore) LeaveArenaQueue(ctx context.Context, tournamentID, userID string) error {
	if !s.bracketReady() {
		return errors.New("database unavailable")
	}
	userID = strings.TrimSpace(userID)
	tournamentID = strings.TrimSpace(tournamentID)
	// Idempotent: clear queue if present; already-idle seats succeed (pair worker may have cleared queue).
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE tournament_entries SET
			arena_queue_joined_at = NULL,
			arena_left_at = NOW()
		WHERE tournament_id = $1 AND user_id = $2::uuid`, tournamentID, userID)
	return err
}

func (s *TournamentStore) ListArenaQueuedPlayers(ctx context.Context, tournamentID, pairingMode string, bst HostedBracketStatuses, phase string) ([]ArenaQueuePlayer, error) {
	if !s.bracketReady() {
		return nil, errors.New("database unavailable")
	}
	mode := strings.TrimSpace(pairingMode)
	order := "u.rating DESC, e.arena_points DESC, e.user_id ASC"
	if mode == string(ArenaPairingByScore) {
		order = "e.arena_points DESC, u.rating DESC, e.user_id ASC"
	}
	q := fmt.Sprintf(`
		SELECT e.user_id::text, COALESCE(u.username, ''), COALESCE(u.rating, 0), COALESCE(e.arena_points, 0)
		FROM tournament_entries e
		JOIN users u ON u.id = e.user_id
		WHERE e.tournament_id = $1
		  AND e.arena_queue_joined_at IS NOT NULL
		  AND e.arena_left_at IS NULL
		  AND NOT EXISTS (
		    SELECT 1 FROM tournament_bracket_matches m
		    WHERE m.tournament_id = e.tournament_id
		      AND m.phase = $2
		      AND (m.player_a_id = e.user_id OR m.player_b_id = e.user_id)
		      AND m.status IN ($3, $4)
		      AND m.finished_at IS NULL
		  )
		ORDER BY %s`, order)
	rows, err := s.db.Pool.Query(ctx, q, tournamentID, phase, bst.Ready, bst.Live)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]ArenaQueuePlayer, 0)
	for rows.Next() {
		var p ArenaQueuePlayer
		if err := rows.Scan(&p.UserID, &p.Username, &p.Rating, &p.Points); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *TournamentStore) nextArenaMatchIndex(ctx context.Context, tx pgx.Tx, tournamentID, phase string) (int, error) {
	var max *int
	err := tx.QueryRow(ctx, `
		SELECT MAX(match_index) FROM tournament_bracket_matches
		WHERE tournament_id = $1 AND phase = $2`, tournamentID, phase).Scan(&max)
	if err != nil {
		return 0, err
	}
	if max == nil {
		return 0, nil
	}
	return *max + 1, nil
}

func (s *TournamentStore) PairArenaPlayers(
	ctx context.Context, tournamentID, playerA, playerB string,
	bst HostedBracketStatuses, phase string,
) (TournamentBracketMatch, error) {
	if !s.bracketReady() {
		return TournamentBracketMatch{}, errors.New("database unavailable")
	}
	playerA = strings.TrimSpace(playerA)
	playerB = strings.TrimSpace(playerB)
	if playerA == "" || playerB == "" || playerA == playerB {
		return TournamentBracketMatch{}, ErrHostedEventInvalidInput
	}
	phase = strings.TrimSpace(phase)
	if phase == "" || bst.Ready == "" {
		return TournamentBracketMatch{}, ErrHostedEventInvalidInput
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return TournamentBracketMatch{}, err
	}
	defer tx.Rollback(ctx)
	idx, err := s.nextArenaMatchIndex(ctx, tx, tournamentID, phase)
	if err != nil {
		return TournamentBracketMatch{}, err
	}
	matchID := uuid.NewString()
	status := bst.Ready
	if status == "" {
		status = bst.Pending
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO tournament_bracket_matches (
			id, tournament_id, phase, group_index, round_index, match_index,
			player_a_id, player_b_id, status, is_bye
		) VALUES ($1,$2,$3,-1,0,$4,$5::uuid,$6::uuid,$7,false)`,
		matchID, tournamentID, phase, idx, playerA, playerB, status)
	if err != nil {
		return TournamentBracketMatch{}, err
	}
	_, err = tx.Exec(ctx, `
		UPDATE tournament_entries SET arena_queue_joined_at = NULL
		WHERE tournament_id = $1 AND user_id IN ($2::uuid, $3::uuid)`,
		tournamentID, playerA, playerB)
	if err != nil {
		return TournamentBracketMatch{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return TournamentBracketMatch{}, err
	}
	m, err := s.GetBracketMatch(ctx, tournamentID, matchID)
	if err != nil || m == nil {
		return TournamentBracketMatch{}, fmt.Errorf("paired match load failed")
	}
	return *m, nil
}

func (s *TournamentStore) applyArenaEntryScoresTx(
	ctx context.Context, tx pgx.Tx, tbl string, entityCol, entityID, userID string,
	isWin, isLoss, isDraw bool, score ArenaScoreConfig,
) (float64, error) {
	var streak, best int
	var points float64
	err := tx.QueryRow(ctx, fmt.Sprintf(`
		SELECT COALESCE(arena_streak,0), COALESCE(arena_best_streak,0), COALESCE(arena_points,0)
		FROM %s WHERE %s = $1 AND user_id = $2::uuid`, tbl, entityCol), entityID, userID).
		Scan(&streak, &best, &points)
	if err != nil {
		return 0, err
	}
	newStreak := 0
	addPts := score.PointsLoss
	wins, losses, draws := 0, 0, 0
	switch {
	case isWin:
		newStreak = streak + 1
		addPts = arenaWinPoints(score, newStreak)
		wins = 1
	case isDraw:
		addPts = score.PointsDraw
		draws = 1
	default:
		losses = 1
	}
	if newStreak > best {
		best = newStreak
	}
	_, err = tx.Exec(ctx, fmt.Sprintf(`
		UPDATE %s SET
			arena_points = COALESCE(arena_points,0) + $3,
			arena_streak = $4,
			arena_best_streak = $5,
			arena_wins = arena_wins + $6,
			arena_losses = arena_losses + $7,
			arena_draws = arena_draws + $8,
			arena_queue_joined_at = NULL,
			arena_left_at = NULL
		WHERE %s = $1 AND user_id = $2::uuid`, tbl, entityCol),
		entityID, userID, addPts, newStreak, best, wins, losses, draws)
	return addPts, err
}

// ApplyArenaGameResult scores an Arena match found by board game_id.
func (s *TournamentStore) ApplyArenaGameResult(
	ctx context.Context, tournamentID, gameID, winnerID string, score ArenaScoreConfig, bst HostedBracketStatuses, phase string,
) ([]CompetitionPointsAward, error) {
	if !s.bracketReady() {
		return nil, errors.New("database unavailable")
	}
	gameID = strings.TrimSpace(gameID)
	if gameID == "" {
		return nil, nil
	}
	m, err := s.GetBracketMatchByGameID(ctx, gameID)
	if err != nil {
		if errors.Is(err, ErrTournamentBracketNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return s.ApplyArenaMatchResult(ctx, tournamentID, m, winnerID, score, bst, phase)
}

// ApplyArenaMatchResult scores an Arena bracket match (board finish or ready/live forfeit).
func (s *TournamentStore) ApplyArenaMatchResult(
	ctx context.Context, tournamentID string, m *TournamentBracketMatch, winnerID string, score ArenaScoreConfig, bst HostedBracketStatuses, phase string,
) ([]CompetitionPointsAward, error) {
	if !s.bracketReady() || m == nil {
		return nil, errors.New("database unavailable")
	}
	if m.TournamentID != tournamentID || m.Phase != phase {
		return nil, nil
	}
	if m.Status == bst.Done || m.Status == bst.Bye {
		return nil, nil
	}
	if m.PlayerAID == nil || m.PlayerBID == nil {
		return nil, ErrHostedEventInvalidInput
	}
	aID, bID := *m.PlayerAID, *m.PlayerBID
	isDraw := strings.TrimSpace(winnerID) == ""
	if !isDraw && winnerID != aID && winnerID != bID {
		return nil, fmt.Errorf("winner not in match")
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Claim the bracket row first (CAS) so concurrent finalize cannot double-apply arena points.
	var claimTag interface{ RowsAffected() int64 }
	if isDraw {
		tag, e := tx.Exec(ctx, `
			UPDATE tournament_bracket_matches
			SET status = $2, finished_at = NOW(), updated_at = NOW(), winner_id = NULL
			WHERE id = $1 AND status <> $2 AND status <> $3`, m.ID, bst.Done, bst.Bye)
		if e != nil {
			return nil, e
		}
		claimTag = tag
	} else {
		tag, e := tx.Exec(ctx, `
			UPDATE tournament_bracket_matches
			SET status = $2, winner_id = $3, finished_at = NOW(), updated_at = NOW()
			WHERE id = $1 AND status <> $2 AND status <> $4`, m.ID, bst.Done, winnerID, bst.Bye)
		if e != nil {
			return nil, e
		}
		claimTag = tag
	}
	if claimTag.RowsAffected() == 0 {
		return nil, nil
	}

	awards := make([]CompetitionPointsAward, 0, 2)
	if isDraw {
		if pts, err := s.applyArenaEntryScoresTx(ctx, tx, "tournament_entries", "tournament_id", tournamentID, aID, false, false, true, score); err != nil {
			return nil, err
		} else if pts > 0 {
			awards = append(awards, CompetitionPointsAward{UserID: aID, Points: pts})
		}
		if pts, err := s.applyArenaEntryScoresTx(ctx, tx, "tournament_entries", "tournament_id", tournamentID, bID, false, false, true, score); err != nil {
			return nil, err
		} else if pts > 0 {
			awards = append(awards, CompetitionPointsAward{UserID: bID, Points: pts})
		}
	} else {
		loser := bID
		if winnerID == bID {
			loser = aID
		}
		if pts, err := s.applyArenaEntryScoresTx(ctx, tx, "tournament_entries", "tournament_id", tournamentID, winnerID, true, false, false, score); err != nil {
			return nil, err
		} else if pts > 0 {
			awards = append(awards, CompetitionPointsAward{UserID: winnerID, Points: pts})
		}
		if pts, err := s.applyArenaEntryScoresTx(ctx, tx, "tournament_entries", "tournament_id", tournamentID, loser, false, true, false, score); err != nil {
			return nil, err
		} else if pts > 0 {
			awards = append(awards, CompetitionPointsAward{UserID: loser, Points: pts})
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return awards, nil
}

func (s *TournamentStore) ListArenaStandings(ctx context.Context, tournamentID string) ([]ArenaStandingRow, error) {
	if !s.bracketReady() {
		return nil, errors.New("database unavailable")
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT e.user_id::text, COALESCE(u.username, ''),
			COALESCE(e.arena_points,0), COALESCE(e.arena_streak,0), COALESCE(e.arena_best_streak,0),
			COALESCE(e.arena_wins,0), COALESCE(e.arena_losses,0), COALESCE(e.arena_draws,0),
			e.placement
		FROM tournament_entries e
		LEFT JOIN users u ON u.id = e.user_id
		WHERE e.tournament_id = $1
		ORDER BY e.arena_points DESC, e.arena_best_streak DESC, e.arena_wins DESC, e.arena_losses ASC, e.user_id ASC`,
		tournamentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]ArenaStandingRow, 0)
	for rows.Next() {
		var row ArenaStandingRow
		if err := rows.Scan(&row.UserID, &row.Username, &row.Points, &row.Streak, &row.BestStreak,
			&row.Wins, &row.Losses, &row.Draws, &row.Placement); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (s *TournamentStore) FinishArena(ctx context.Context, tournamentID string, bst HostedBracketStatuses, phase string) (*Tournament, error) {
	if !s.bracketReady() {
		return nil, errors.New("database unavailable")
	}
	phase = strings.TrimSpace(phase)
	standings, err := s.ListArenaStandings(ctx, tournamentID)
	if err != nil {
		return nil, err
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `
		UPDATE tournament_bracket_matches
		SET status = $3, finished_at = NOW(), updated_at = NOW(), winner_id = NULL
		WHERE tournament_id = $1 AND phase = $2
		  AND status NOT IN ($3, $4)
		  AND finished_at IS NULL`,
		tournamentID, phase, bst.Done, bst.Bye)
	if err != nil {
		return nil, err
	}
	if len(standings) > 0 {
		if err := s.finishTournamentByStandingsTx(ctx, tx, tournamentID, arenaStandingsToHosted(standings)); err != nil {
			return nil, err
		}
	} else {
		_, err = tx.Exec(ctx, `
			UPDATE tournaments SET finished_at = NOW(), updated_at = NOW() WHERE id = $1`, tournamentID)
		if err != nil {
			return nil, err
		}
	}
	row := tx.QueryRow(ctx, `SELECT `+tournamentSelectCols+` FROM tournaments WHERE id = $1`, tournamentID)
	t, err := scanTournament(row)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return t, nil
}

func arenaStandingsToHosted(rows []ArenaStandingRow) []HostedStandingRow {
	out := make([]HostedStandingRow, 0, len(rows))
	for _, r := range rows {
		pts := int(r.Points)
		out = append(out, HostedStandingRow{
			UserID: r.UserID, Username: r.Username,
			Points: pts, Wins: r.Wins, Losses: r.Losses, Played: r.Wins + r.Losses + r.Draws,
		})
	}
	return out
}

func (s *TournamentStore) ListLiveArenasNeedingPair(ctx context.Context) ([]string, error) {
	if !s.bracketReady() {
		return nil, errors.New("database unavailable")
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id::text FROM tournaments
		WHERE started_at IS NOT NULL AND finished_at IS NULL
		  AND arena_ends_at IS NOT NULL AND arena_ends_at > NOW()`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanStringIDs(rows)
}

func (s *TournamentStore) ListExpiredArenas(ctx context.Context) ([]string, error) {
	if !s.bracketReady() {
		return nil, errors.New("database unavailable")
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id::text FROM tournaments
		WHERE started_at IS NOT NULL AND finished_at IS NULL
		  AND arena_ends_at IS NOT NULL AND arena_ends_at <= NOW()`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanStringIDs(rows)
}

func scanStringIDs(rows pgx.Rows) ([]string, error) {
	out := make([]string, 0)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// --- Hosted events (mirror) ---

func (s *HostedEventStore) StartArena(ctx context.Context, eventID string, durationMinutes int, phase string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	if durationMinutes < 1 {
		return nil, ErrHostedEventInvalidInput
	}
	phase = strings.TrimSpace(phase)
	if phase == "" {
		return nil, ErrHostedEventInvalidInput
	}
	ends := time.Now().UTC().Add(time.Duration(durationMinutes) * time.Minute)
	row := s.db.Pool.QueryRow(ctx, `
		UPDATE hosted_events SET
			started_at = COALESCE(started_at, NOW()),
			finished_at = NULL,
			winner_id = NULL,
			arena_duration_minutes = $2,
			arena_ends_at = $3,
			updated_at = NOW()
		WHERE id = $1 AND started_at IS NULL
		RETURNING `+hostedEventCols, eventID, durationMinutes, ends)
	ev, err := scanHostedEvent(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrHostedEventConflict
		}
		return nil, err
	}
	return ev, nil
}

// RevertArenaClockAfterFailedStart clears Arena clock fields when StartArena ran but
// MarkLive failed (status still priorStatus), so cancel/re-start stay possible.
func (s *HostedEventStore) RevertArenaClockAfterFailedStart(ctx context.Context, eventID, priorStatus string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	eventID = strings.TrimSpace(eventID)
	priorStatus = strings.TrimSpace(priorStatus)
	if eventID == "" || priorStatus == "" {
		return nil, ErrHostedEventInvalidInput
	}
	row := s.db.Pool.QueryRow(ctx, `
		UPDATE hosted_events SET
			started_at = NULL,
			arena_ends_at = NULL,
			finished_at = NULL,
			winner_id = NULL,
			updated_at = NOW()
		WHERE id = $1
		  AND started_at IS NOT NULL
		  AND finished_at IS NULL
		  AND status = $2
		RETURNING `+hostedEventCols, eventID, priorStatus)
	ev, err := scanHostedEvent(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrHostedEventConflict
		}
		return nil, err
	}
	return ev, nil
}

func (s *HostedEventStore) arenaEntryApproved(ctx context.Context, eventID, userID, approved string) error {
	var n int
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM hosted_event_entries
		WHERE event_id = $1 AND user_id = $2::uuid AND status = $3`, eventID, userID, approved).Scan(&n)
	if err != nil || n < 1 {
		return ErrHostedEntryNotFound
	}
	return nil
}

func (s *HostedEventStore) arenaPlayerInOpenMatch(
	ctx context.Context, eventID, userID, phase string, bst HostedBracketStatuses,
) (bool, error) {
	var n int
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM hosted_event_bracket_matches
		WHERE event_id = $1 AND phase = $2
		  AND ($3::uuid = player_a_id OR $3::uuid = player_b_id)
		  AND status IN ($4, $5)
		  AND finished_at IS NULL`,
		eventID, phase, userID, bst.Ready, bst.Live).Scan(&n)
	return n > 0, err
}

func (s *HostedEventStore) JoinArenaQueue(
	ctx context.Context, eventID, userID, entryApproved string, bst HostedBracketStatuses, phase string,
) error {
	if !s.ready() {
		return errors.New("database unavailable")
	}
	userID = strings.TrimSpace(userID)
	eventID = strings.TrimSpace(eventID)
	if userID == "" || eventID == "" {
		return ErrArenaQueue
	}
	ev, err := s.Get(ctx, eventID)
	if err != nil {
		return err
	}
	if ev.StartedAt == nil || ev.FinishedAt != nil {
		return ErrArenaNotActive
	}
	if ev.ArenaEndsAt == nil || !time.Now().UTC().Before(*ev.ArenaEndsAt) {
		return ErrArenaNotActive
	}
	if err := s.arenaEntryApproved(ctx, eventID, userID, entryApproved); err != nil {
		return err
	}
	inMatch, err := s.arenaPlayerInOpenMatch(ctx, eventID, userID, phase, bst)
	if err != nil {
		return err
	}
	if inMatch {
		return ErrArenaInMatch
	}
	tag, err := s.db.Pool.Exec(ctx, `
		UPDATE hosted_event_entries SET
			arena_queue_joined_at = NOW(),
			arena_left_at = NULL
		WHERE event_id = $1 AND user_id = $2::uuid AND status = $3`, eventID, userID, entryApproved)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrHostedEntryNotFound
	}
	return nil
}

func (s *HostedEventStore) LeaveArenaQueue(ctx context.Context, eventID, userID, entryApproved string) error {
	if !s.ready() {
		return errors.New("database unavailable")
	}
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE hosted_event_entries SET
			arena_queue_joined_at = NULL,
			arena_left_at = NOW()
		WHERE event_id = $1 AND user_id = $2::uuid AND status = $3`, eventID, userID, entryApproved)
	return err
}

func (s *HostedEventStore) ListArenaQueuedPlayers(
	ctx context.Context, eventID, pairingMode string, bst HostedBracketStatuses, phase string, entryApproved string,
) ([]ArenaQueuePlayer, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	mode := strings.TrimSpace(pairingMode)
	order := "u.rating DESC, e.arena_points DESC, e.user_id ASC"
	if mode == string(ArenaPairingByScore) {
		order = "e.arena_points DESC, u.rating DESC, e.user_id ASC"
	}
	q := fmt.Sprintf(`
		SELECT e.user_id::text, COALESCE(u.username, ''), COALESCE(u.rating, 0), COALESCE(e.arena_points, 0)
		FROM hosted_event_entries e
		JOIN users u ON u.id = e.user_id
		WHERE e.event_id = $1 AND e.status = $5
		  AND e.arena_queue_joined_at IS NOT NULL
		  AND e.arena_left_at IS NULL
		  AND NOT EXISTS (
		    SELECT 1 FROM hosted_event_bracket_matches m
		    WHERE m.event_id = e.event_id
		      AND m.phase = $2
		      AND (m.player_a_id = e.user_id OR m.player_b_id = e.user_id)
		      AND m.status IN ($3, $4)
		      AND m.finished_at IS NULL
		  )
		ORDER BY %s`, order)
	rows, err := s.db.Pool.Query(ctx, q, eventID, phase, bst.Ready, bst.Live, entryApproved)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]ArenaQueuePlayer, 0)
	for rows.Next() {
		var p ArenaQueuePlayer
		if err := rows.Scan(&p.UserID, &p.Username, &p.Rating, &p.Points); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *HostedEventStore) nextHostedArenaMatchIndex(ctx context.Context, tx pgx.Tx, eventID, phase string) (int, error) {
	var max *int
	err := tx.QueryRow(ctx, `
		SELECT MAX(match_index) FROM hosted_event_bracket_matches
		WHERE event_id = $1 AND phase = $2`, eventID, phase).Scan(&max)
	if err != nil {
		return 0, err
	}
	if max == nil {
		return 0, nil
	}
	return *max + 1, nil
}

func (s *HostedEventStore) PairArenaPlayers(
	ctx context.Context, eventID, playerA, playerB string,
	bst HostedBracketStatuses, phase string,
) (HostedBracketMatch, error) {
	if !s.ready() {
		return HostedBracketMatch{}, errors.New("database unavailable")
	}
	playerA = strings.TrimSpace(playerA)
	playerB = strings.TrimSpace(playerB)
	if playerA == "" || playerB == "" || playerA == playerB {
		return HostedBracketMatch{}, ErrHostedEventInvalidInput
	}
	phase = strings.TrimSpace(phase)
	if phase == "" || bst.Ready == "" {
		return HostedBracketMatch{}, ErrHostedEventInvalidInput
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return HostedBracketMatch{}, err
	}
	defer tx.Rollback(ctx)
	idx, err := s.nextHostedArenaMatchIndex(ctx, tx, eventID, phase)
	if err != nil {
		return HostedBracketMatch{}, err
	}
	matchID := uuid.NewString()
	status := bst.Ready
	_, err = tx.Exec(ctx, `
		INSERT INTO hosted_event_bracket_matches (
			id, event_id, phase, group_index, round_index, match_index,
			player_a_id, player_b_id, status, is_bye
		) VALUES ($1,$2,$3,-1,0,$4,$5::uuid,$6::uuid,$7,false)`,
		matchID, eventID, phase, idx, playerA, playerB, status)
	if err != nil {
		return HostedBracketMatch{}, err
	}
	_, err = tx.Exec(ctx, `
		UPDATE hosted_event_entries SET arena_queue_joined_at = NULL
		WHERE event_id = $1 AND user_id IN ($2::uuid, $3::uuid)`,
		eventID, playerA, playerB)
	if err != nil {
		return HostedBracketMatch{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return HostedBracketMatch{}, err
	}
	m, err := s.GetBracketMatch(ctx, eventID, matchID)
	if err != nil || m == nil {
		return HostedBracketMatch{}, fmt.Errorf("paired match load failed")
	}
	return *m, nil
}

// ApplyArenaGameResult scores an Arena match found by board game_id.
func (s *HostedEventStore) ApplyArenaGameResult(
	ctx context.Context, eventID, gameID, winnerID string, score ArenaScoreConfig, bst HostedBracketStatuses, phase string,
) ([]CompetitionPointsAward, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	gameID = strings.TrimSpace(gameID)
	if gameID == "" {
		return nil, nil
	}
	m, err := s.GetBracketMatchByGameID(ctx, gameID)
	if err != nil {
		if errors.Is(err, ErrHostedBracketNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return s.ApplyArenaMatchResult(ctx, eventID, m, winnerID, score, bst, phase)
}

// ApplyArenaMatchResult scores an Arena bracket match (board finish or ready/live forfeit).
func (s *HostedEventStore) ApplyArenaMatchResult(
	ctx context.Context, eventID string, m *HostedBracketMatch, winnerID string, score ArenaScoreConfig, bst HostedBracketStatuses, phase string,
) ([]CompetitionPointsAward, error) {
	if !s.ready() || m == nil {
		return nil, errors.New("database unavailable")
	}
	if m.EventID != eventID || m.Phase != phase {
		return nil, nil
	}
	if m.Status == bst.Done || m.Status == bst.Bye {
		return nil, nil
	}
	if m.PlayerAID == nil || m.PlayerBID == nil {
		return nil, ErrHostedEventInvalidInput
	}
	aID, bID := *m.PlayerAID, *m.PlayerBID
	isDraw := strings.TrimSpace(winnerID) == ""
	if !isDraw && winnerID != aID && winnerID != bID {
		return nil, fmt.Errorf("winner not in match")
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Claim the bracket row first (CAS) so concurrent finalize cannot double-apply arena points.
	var claimTag interface{ RowsAffected() int64 }
	if isDraw {
		tag, e := tx.Exec(ctx, `
			UPDATE hosted_event_bracket_matches
			SET status = $2, finished_at = NOW(), updated_at = NOW(), winner_id = NULL
			WHERE id = $1 AND status <> $2 AND status <> $3`, m.ID, bst.Done, bst.Bye)
		if e != nil {
			return nil, e
		}
		claimTag = tag
	} else {
		tag, e := tx.Exec(ctx, `
			UPDATE hosted_event_bracket_matches
			SET status = $2, winner_id = $3, finished_at = NOW(), updated_at = NOW()
			WHERE id = $1 AND status <> $2 AND status <> $4`, m.ID, bst.Done, winnerID, bst.Bye)
		if e != nil {
			return nil, e
		}
		claimTag = tag
	}
	if claimTag.RowsAffected() == 0 {
		return nil, nil
	}

	awards := make([]CompetitionPointsAward, 0, 2)
	if isDraw {
		if pts, err := s.applyArenaEntryScoresTx(ctx, tx, "hosted_event_entries", "event_id", eventID, aID, false, false, true, score); err != nil {
			return nil, err
		} else if pts > 0 {
			awards = append(awards, CompetitionPointsAward{UserID: aID, Points: pts})
		}
		if pts, err := s.applyArenaEntryScoresTx(ctx, tx, "hosted_event_entries", "event_id", eventID, bID, false, false, true, score); err != nil {
			return nil, err
		} else if pts > 0 {
			awards = append(awards, CompetitionPointsAward{UserID: bID, Points: pts})
		}
	} else {
		loser := bID
		if winnerID == bID {
			loser = aID
		}
		if pts, err := s.applyArenaEntryScoresTx(ctx, tx, "hosted_event_entries", "event_id", eventID, winnerID, true, false, false, score); err != nil {
			return nil, err
		} else if pts > 0 {
			awards = append(awards, CompetitionPointsAward{UserID: winnerID, Points: pts})
		}
		if pts, err := s.applyArenaEntryScoresTx(ctx, tx, "hosted_event_entries", "event_id", eventID, loser, false, true, false, score); err != nil {
			return nil, err
		} else if pts > 0 {
			awards = append(awards, CompetitionPointsAward{UserID: loser, Points: pts})
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return awards, nil
}

func (s *HostedEventStore) applyArenaEntryScoresTx(
	ctx context.Context, tx pgx.Tx, tbl, entityCol, entityID, userID string,
	isWin, isLoss, isDraw bool, score ArenaScoreConfig,
) (float64, error) {
	var streak, best int
	var points float64
	err := tx.QueryRow(ctx, fmt.Sprintf(`
		SELECT COALESCE(arena_streak,0), COALESCE(arena_best_streak,0), COALESCE(arena_points,0)
		FROM %s WHERE %s = $1 AND user_id = $2::uuid`, tbl, entityCol), entityID, userID).
		Scan(&streak, &best, &points)
	if err != nil {
		return 0, err
	}
	newStreak := 0
	addPts := score.PointsLoss
	wins, losses, draws := 0, 0, 0
	switch {
	case isWin:
		newStreak = streak + 1
		addPts = arenaWinPoints(score, newStreak)
		wins = 1
	case isDraw:
		addPts = score.PointsDraw
		draws = 1
	default:
		losses = 1
	}
	if newStreak > best {
		best = newStreak
	}
	_, err = tx.Exec(ctx, fmt.Sprintf(`
		UPDATE %s SET
			arena_points = COALESCE(arena_points,0) + $3,
			arena_streak = $4,
			arena_best_streak = $5,
			arena_wins = arena_wins + $6,
			arena_losses = arena_losses + $7,
			arena_draws = arena_draws + $8,
			arena_queue_joined_at = NULL,
			arena_left_at = NULL
		WHERE %s = $1 AND user_id = $2::uuid`, tbl, entityCol),
		entityID, userID, addPts, newStreak, best, wins, losses, draws)
	return addPts, err
}

func (s *HostedEventStore) ListArenaStandings(ctx context.Context, eventID string) ([]ArenaStandingRow, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT e.user_id::text, COALESCE(u.username, ''),
			COALESCE(e.arena_points,0), COALESCE(e.arena_streak,0), COALESCE(e.arena_best_streak,0),
			COALESCE(e.arena_wins,0), COALESCE(e.arena_losses,0), COALESCE(e.arena_draws,0),
			e.placement
		FROM hosted_event_entries e
		LEFT JOIN users u ON u.id = e.user_id
		WHERE e.event_id = $1
		ORDER BY e.arena_points DESC, e.arena_best_streak DESC, e.arena_wins DESC, e.arena_losses ASC, e.user_id ASC`,
		eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]ArenaStandingRow, 0)
	for rows.Next() {
		var row ArenaStandingRow
		if err := rows.Scan(&row.UserID, &row.Username, &row.Points, &row.Streak, &row.BestStreak,
			&row.Wins, &row.Losses, &row.Draws, &row.Placement); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (s *HostedEventStore) FinishArena(
	ctx context.Context, eventID string, bst HostedBracketStatuses, est HostedEventStatuses, entryApproved, phase string,
) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	phase = strings.TrimSpace(phase)
	standings, err := s.ListArenaStandings(ctx, eventID)
	if err != nil {
		return nil, err
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `
		UPDATE hosted_event_bracket_matches
		SET status = $3, finished_at = NOW(), updated_at = NOW(), winner_id = NULL
		WHERE event_id = $1 AND phase = $2
		  AND status NOT IN ($3, $4)
		  AND finished_at IS NULL`,
		eventID, phase, bst.Done, bst.Bye)
	if err != nil {
		return nil, err
	}
	if len(standings) > 0 {
		if err := s.finishEventByStandingsTx(ctx, tx, eventID, arenaStandingsToHosted(standings), est, entryApproved); err != nil {
			return nil, err
		}
	} else {
		_, err = tx.Exec(ctx, `
			UPDATE hosted_events SET status = $2, finished_at = NOW(), updated_at = NOW()
			WHERE id = $1`, eventID, est.Finished)
		if err != nil {
			return nil, err
		}
	}
	row := tx.QueryRow(ctx, `SELECT `+hostedEventCols+` FROM hosted_events WHERE id = $1`, eventID)
	ev, err := scanHostedEvent(row)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return ev, nil
}

func (s *HostedEventStore) ListLiveArenasNeedingPair(ctx context.Context) ([]string, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id::text FROM hosted_events
		WHERE started_at IS NOT NULL AND finished_at IS NULL
		  AND arena_ends_at IS NOT NULL AND arena_ends_at > NOW()`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanStringIDs(rows)
}

func (s *TournamentStore) ViewerArenaQueued(ctx context.Context, tournamentID, userID string) (bool, error) {
	if !s.bracketReady() {
		return false, errors.New("database unavailable")
	}
	tournamentID = strings.TrimSpace(tournamentID)
	userID = strings.TrimSpace(userID)
	if tournamentID == "" || userID == "" {
		return false, nil
	}
	var joinedAt *time.Time
	err := s.db.Pool.QueryRow(ctx, `
		SELECT arena_queue_joined_at FROM tournament_entries
		WHERE tournament_id = $1 AND user_id = $2`, tournamentID, userID).Scan(&joinedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return joinedAt != nil, nil
}

func (s *HostedEventStore) ViewerArenaQueued(ctx context.Context, eventID, userID string) (bool, error) {
	if !s.ready() {
		return false, errors.New("database unavailable")
	}
	eventID = strings.TrimSpace(eventID)
	userID = strings.TrimSpace(userID)
	if eventID == "" || userID == "" {
		return false, nil
	}
	var joinedAt *time.Time
	err := s.db.Pool.QueryRow(ctx, `
		SELECT arena_queue_joined_at FROM hosted_event_entries
		WHERE event_id = $1 AND user_id = $2`, eventID, userID).Scan(&joinedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return joinedAt != nil, nil
}

func (s *HostedEventStore) ListExpiredArenas(ctx context.Context) ([]string, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id::text FROM hosted_events
		WHERE started_at IS NOT NULL AND finished_at IS NULL
		  AND arena_ends_at IS NOT NULL AND arena_ends_at <= NOW()`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanStringIDs(rows)
}
