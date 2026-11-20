package store

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var (
	ErrTournamentBracketNotFound   = errors.New("tournament bracket match not found")
	ErrTournamentAlreadyHasBracket = errors.New("tournament already has bracket")
	ErrTournamentNotStarted        = errors.New("tournament not started")
	ErrTournamentAlreadyStarted    = errors.New("tournament already started")
	ErrTournamentCheckIn           = errors.New("tournament check-in unavailable")
	ErrTournamentMatchForfeit      = errors.New("tournament match cannot be forfeited")
	// ErrBracketMatchAlreadyFinalized: concurrent finalize lost the CAS claim (no side effects).
	ErrBracketMatchAlreadyFinalized = errors.New("bracket match already finalized")
	ErrTournamentMatchRematch       = errors.New("tournament match cannot be reset for rematch")
)

// TournamentBracketMatch mirrors hosted bracket rows for platform cups.
type TournamentBracketMatch struct {
	ID              string     `json:"id"`
	TournamentID    string     `json:"tournament_id"`
	Phase           string     `json:"phase"`
	GroupIndex      int        `json:"group_index"`
	RoundIndex      int        `json:"round_index"`
	MatchIndex      int        `json:"match_index"`
	PlayerAID       *string    `json:"player_a_id,omitempty"`
	PlayerBID       *string    `json:"player_b_id,omitempty"`
	WinnerID        *string    `json:"winner_id,omitempty"`
	PlayerAUsername string     `json:"player_a_username,omitempty"`
	PlayerBUsername string     `json:"player_b_username,omitempty"`
	WinnerUsername  string     `json:"winner_username,omitempty"`
	NextMatchID     *string    `json:"next_match_id,omitempty"`
	NextSlot        *string    `json:"next_slot,omitempty"`
	GameID          *string    `json:"game_id,omitempty"`
	Status          string     `json:"status"`
	StatusLabel     string     `json:"status_label,omitempty"`
	IsBye           bool       `json:"is_bye"`
	PlayerAReadyAt  *time.Time `json:"player_a_ready_at,omitempty"`
	PlayerBReadyAt  *time.Time `json:"player_b_ready_at,omitempty"`
	StartedAt       *time.Time `json:"started_at,omitempty"`
	FinishedAt      *time.Time `json:"finished_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

func (s *TournamentStore) bracketReady() bool {
	return s.db != nil && s.db.Ready()
}

const tournamentBracketSelect = `
	m.id, m.tournament_id, m.phase, m.group_index, m.round_index, m.match_index,
	m.player_a_id, m.player_b_id, m.winner_id,
	COALESCE(ua.username, ''), COALESCE(ub.username, ''), COALESCE(uw.username, ''),
	m.next_match_id, m.next_slot, m.game_id, m.status, m.is_bye,
	m.player_a_ready_at, m.player_b_ready_at, m.started_at, m.finished_at, m.created_at, m.updated_at`

func scanTournamentBracketNamed(row pgx.Row) (*TournamentBracketMatch, error) {
	var m TournamentBracketMatch
	err := row.Scan(
		&m.ID, &m.TournamentID, &m.Phase, &m.GroupIndex, &m.RoundIndex, &m.MatchIndex,
		&m.PlayerAID, &m.PlayerBID, &m.WinnerID,
		&m.PlayerAUsername, &m.PlayerBUsername, &m.WinnerUsername,
		&m.NextMatchID, &m.NextSlot, &m.GameID,
		&m.Status, &m.IsBye,
		&m.PlayerAReadyAt, &m.PlayerBReadyAt, &m.StartedAt, &m.FinishedAt, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func scanTournamentBracket(row pgx.Row) (*TournamentBracketMatch, error) {
	var m TournamentBracketMatch
	err := row.Scan(
		&m.ID, &m.TournamentID, &m.Phase, &m.GroupIndex, &m.RoundIndex, &m.MatchIndex,
		&m.PlayerAID, &m.PlayerBID, &m.WinnerID,
		&m.NextMatchID, &m.NextSlot, &m.GameID,
		&m.Status, &m.IsBye,
		&m.PlayerAReadyAt, &m.PlayerBReadyAt, &m.StartedAt, &m.FinishedAt, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (s *TournamentStore) HasBracket(ctx context.Context, tournamentID string) (bool, error) {
	if !s.bracketReady() {
		return false, fmt.Errorf("database unavailable")
	}
	var n int
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM tournament_bracket_matches WHERE tournament_id = $1`, tournamentID).Scan(&n)
	return n > 0, err
}

func (s *TournamentStore) ListBracket(ctx context.Context, tournamentID string) ([]TournamentBracketMatch, error) {
	if !s.bracketReady() {
		return nil, fmt.Errorf("database unavailable")
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT `+tournamentBracketSelect+`
		FROM tournament_bracket_matches m
		LEFT JOIN users ua ON ua.id = m.player_a_id
		LEFT JOIN users ub ON ub.id = m.player_b_id
		LEFT JOIN users uw ON uw.id = m.winner_id
		WHERE m.tournament_id = $1
		ORDER BY m.phase ASC, m.group_index ASC, m.round_index ASC, m.match_index ASC`, tournamentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]TournamentBracketMatch, 0)
	for rows.Next() {
		m, err := scanTournamentBracketNamed(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *m)
	}
	return out, rows.Err()
}

func (s *TournamentStore) GetBracketMatch(ctx context.Context, tournamentID, matchID string) (*TournamentBracketMatch, error) {
	if !s.bracketReady() {
		return nil, fmt.Errorf("database unavailable")
	}
	m, err := scanTournamentBracket(s.db.Pool.QueryRow(ctx, `
		SELECT id, tournament_id, phase, group_index, round_index, match_index, player_a_id, player_b_id, winner_id,
			next_match_id, next_slot, game_id, status, is_bye,
			player_a_ready_at, player_b_ready_at, started_at, finished_at, created_at, updated_at
		FROM tournament_bracket_matches WHERE tournament_id = $1 AND id = $2`, tournamentID, matchID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrTournamentBracketNotFound
	}
	return m, err
}

func (s *TournamentStore) GetBracketMatchByGameID(ctx context.Context, gameID string) (*TournamentBracketMatch, error) {
	if !s.bracketReady() {
		return nil, fmt.Errorf("database unavailable")
	}
	m, err := scanTournamentBracket(s.db.Pool.QueryRow(ctx, `
		SELECT id, tournament_id, phase, group_index, round_index, match_index, player_a_id, player_b_id, winner_id,
			next_match_id, next_slot, game_id, status, is_bye,
			player_a_ready_at, player_b_ready_at, started_at, finished_at, created_at, updated_at
		FROM tournament_bracket_matches WHERE game_id = $1`, gameID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrTournamentBracketNotFound
	}
	return m, err
}

func (s *TournamentStore) GenerateKnockoutBracket(
	ctx context.Context,
	tournamentID string,
	playerIDs []string,
	st HostedBracketStatuses,
	phase string,
) ([]TournamentBracketMatch, error) {
	if !s.bracketReady() {
		return nil, fmt.Errorf("database unavailable")
	}
	phase = strings.TrimSpace(phase)
	if phase == "" || st.Pending == "" || st.Ready == "" || st.Done == "" || st.Bye == "" {
		return nil, ErrHostedEventInvalidInput
	}
	if len(playerIDs) < 2 {
		return nil, ErrHostedNotEnoughPlayers
	}
	has, err := s.HasBracket(ctx, tournamentID)
	if err != nil {
		return nil, err
	}
	if has {
		return nil, ErrTournamentAlreadyHasBracket
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err := generateKnockoutBracketTx(ctx, tx, BracketTableTournament, tournamentID, playerIDs, st, phase, -1, 0); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.ListBracket(ctx, tournamentID)
}

func (s *TournamentStore) GenerateRoundRobinBracket(
	ctx context.Context,
	tournamentID string,
	playerIDs []string,
	st HostedBracketStatuses,
	phase string,
) ([]TournamentBracketMatch, error) {
	if !s.bracketReady() {
		return nil, fmt.Errorf("database unavailable")
	}
	phase = strings.TrimSpace(phase)
	if phase == "" || st.Ready == "" {
		return nil, ErrHostedEventInvalidInput
	}
	if len(playerIDs) < 2 {
		return nil, ErrHostedNotEnoughPlayers
	}
	has, err := s.HasBracket(ctx, tournamentID)
	if err != nil {
		return nil, err
	}
	if has {
		return nil, ErrTournamentAlreadyHasBracket
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err := insertRoundRobinTx(ctx, tx, BracketTableTournament, tournamentID, playerIDs, st, phase, -1, 0); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.ListBracket(ctx, tournamentID)
}

func (s *TournamentStore) GenerateSwissBracket(
	ctx context.Context,
	tournamentID string,
	playerIDs []string,
	st HostedBracketStatuses,
	phase string,
) ([]TournamentBracketMatch, error) {
	if !s.bracketReady() {
		return nil, fmt.Errorf("database unavailable")
	}
	phase = strings.TrimSpace(phase)
	if phase == "" || st.Ready == "" || st.Bye == "" {
		return nil, ErrHostedEventInvalidInput
	}
	if len(playerIDs) < 2 {
		return nil, ErrHostedNotEnoughPlayers
	}
	has, err := s.HasBracket(ctx, tournamentID)
	if err != nil {
		return nil, err
	}
	if has {
		return nil, ErrTournamentAlreadyHasBracket
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err := insertSwissRoundTx(ctx, tx, BracketTableTournament, tournamentID, playerIDs, st, phase, 0, nil); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.ListBracket(ctx, tournamentID)
}

func (s *TournamentStore) GenerateGroupsKnockoutBracket(
	ctx context.Context,
	tournamentID string,
	playerIDs []string,
	st HostedBracketStatuses,
	phases HostedFormatPhases,
	targetGroupSize, advancePerGroup int,
) ([]TournamentBracketMatch, error) {
	if !s.bracketReady() {
		return nil, fmt.Errorf("database unavailable")
	}
	if strings.TrimSpace(phases.Group) == "" || targetGroupSize < 2 || advancePerGroup < 1 {
		return nil, ErrHostedEventInvalidInput
	}
	if len(playerIDs) < targetGroupSize {
		return nil, ErrHostedNotEnoughPlayers
	}
	has, err := s.HasBracket(ctx, tournamentID)
	if err != nil {
		return nil, err
	}
	if has {
		return nil, ErrTournamentAlreadyHasBracket
	}
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	shuffled := append([]string{}, playerIDs...)
	rng.Shuffle(len(shuffled), func(i, j int) { shuffled[i], shuffled[j] = shuffled[j], shuffled[i] })
	nGroups := (len(shuffled) + targetGroupSize - 1) / targetGroupSize
	if nGroups < 1 {
		nGroups = 1
	}
	groups := make([][]string, nGroups)
	for i, id := range shuffled {
		g := i % nGroups
		groups[g] = append(groups[g], id)
	}
	for _, g := range groups {
		if len(g) < 2 {
			return nil, ErrHostedNotEnoughPlayers
		}
		if advancePerGroup > len(g) {
			return nil, ErrHostedEventInvalidInput
		}
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	for gi, g := range groups {
		if err := insertRoundRobinTx(ctx, tx, BracketTableTournament, tournamentID, g, st, phases.Group, gi, 0); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.ListBracket(ctx, tournamentID)
}

// MapLiveGameIDsByTournamentIDs returns one unfinished live board id per cup (newest first).
// Batched for discovery Watch CTAs - never N+1 ListBracket.
func (s *TournamentStore) MapLiveGameIDsByTournamentIDs(ctx context.Context, tournamentIDs []string, liveStatus string) (map[string]string, error) {
	out := map[string]string{}
	liveStatus = strings.TrimSpace(liveStatus)
	if !s.bracketReady() || liveStatus == "" || len(tournamentIDs) == 0 {
		return out, nil
	}
	ids := make([]string, 0, len(tournamentIDs))
	seen := map[string]struct{}{}
	for _, id := range tournamentIDs {
		id = strings.TrimSpace(id)
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
		return out, nil
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT DISTINCT ON (tournament_id) tournament_id::text, game_id::text
		FROM tournament_bracket_matches
		WHERE tournament_id = ANY($1::uuid[])
		  AND game_id IS NOT NULL
		  AND status = $2
		  AND finished_at IS NULL
		ORDER BY tournament_id, updated_at DESC NULLS LAST, started_at DESC NULLS LAST`,
		ids, liveStatus)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var tid, gid string
		if err := rows.Scan(&tid, &gid); err != nil {
			return nil, err
		}
		tid = strings.TrimSpace(tid)
		gid = strings.TrimSpace(gid)
		if tid != "" && gid != "" {
			out[tid] = gid
		}
	}
	return out, rows.Err()
}

func (s *TournamentStore) AttachGame(ctx context.Context, matchID, gameID, liveStatus string) (*TournamentBracketMatch, error) {
	if !s.bracketReady() {
		return nil, fmt.Errorf("database unavailable")
	}
	m, err := scanTournamentBracket(s.db.Pool.QueryRow(ctx, `
		UPDATE tournament_bracket_matches
		SET game_id = $2, status = $3, started_at = COALESCE(started_at, NOW()), updated_at = NOW()
		WHERE id = $1
		RETURNING id, tournament_id, phase, group_index, round_index, match_index, player_a_id, player_b_id, winner_id,
			next_match_id, next_slot, game_id, status, is_bye,
			player_a_ready_at, player_b_ready_at, started_at, finished_at, created_at, updated_at`,
		matchID, gameID, liveStatus))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrTournamentBracketNotFound
	}
	return m, err
}

func (s *TournamentStore) ResetMatchForRematch(ctx context.Context, matchID, readyStatus string) (*TournamentBracketMatch, error) {
	if !s.bracketReady() {
		return nil, fmt.Errorf("database unavailable")
	}
	m, err := scanTournamentBracket(s.db.Pool.QueryRow(ctx, `
		UPDATE tournament_bracket_matches
		SET game_id = NULL, winner_id = NULL, status = $2, started_at = NULL, finished_at = NULL,
		    player_a_ready_at = NULL, player_b_ready_at = NULL, updated_at = NOW()
		WHERE id = $1
		RETURNING id, tournament_id, phase, group_index, round_index, match_index, player_a_id, player_b_id, winner_id,
			next_match_id, next_slot, game_id, status, is_bye,
			player_a_ready_at, player_b_ready_at, started_at, finished_at, created_at, updated_at`,
		matchID, readyStatus))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrTournamentBracketNotFound
	}
	return m, err
}

// RematchTournamentMatch clears readiness/game for a ready or live match that has not finished.
// Refuses done matches (winner already advanced) so bracket seats stay consistent.
func (s *TournamentStore) RematchTournamentMatch(
	ctx context.Context,
	tournamentID, matchID string,
	bst HostedBracketStatuses,
) (*TournamentBracketMatch, error) {
	if !s.bracketReady() {
		return nil, fmt.Errorf("database unavailable")
	}
	ready := strings.TrimSpace(bst.Ready)
	live := strings.TrimSpace(bst.Live)
	if ready == "" {
		return nil, ErrTournamentMatchRematch
	}
	m, err := s.GetBracketMatch(ctx, tournamentID, matchID)
	if err != nil {
		return nil, err
	}
	if m.IsBye || m.FinishedAt != nil || (m.WinnerID != nil && strings.TrimSpace(*m.WinnerID) != "") {
		return nil, ErrTournamentMatchRematch
	}
	if m.PlayerAID == nil || m.PlayerBID == nil || strings.TrimSpace(*m.PlayerAID) == "" || strings.TrimSpace(*m.PlayerBID) == "" {
		return nil, ErrTournamentMatchRematch
	}
	st := strings.TrimSpace(m.Status)
	if st != ready && (live == "" || st != live) {
		return nil, ErrTournamentMatchRematch
	}
	return s.ResetMatchForRematch(ctx, m.ID, ready)
}

// MarkStarted sets started_at once (cup lifecycle; tournament status unchanged).
func (s *TournamentStore) MarkStarted(ctx context.Context, tournamentID string) (*Tournament, error) {
	if !s.bracketReady() {
		return nil, fmt.Errorf("database unavailable")
	}
	row := s.db.Pool.QueryRow(ctx, `
		UPDATE tournaments
		SET started_at = COALESCE(started_at, NOW()), updated_at = NOW()
		WHERE id = $1 AND started_at IS NULL
		RETURNING `+tournamentSelectCols, tournamentID)
	t, err := scanTournament(row)
	if errors.Is(err, pgx.ErrNoRows) {
		cur, getErr := s.Get(ctx, tournamentID)
		if getErr != nil {
			return nil, getErr
		}
		if cur.StartedAt != nil {
			return cur, ErrTournamentAlreadyStarted
		}
		return nil, fmt.Errorf("tournament not found")
	}
	return t, err
}

// EnsureCheckInOpenForCupStart opens check-in when unset, or leaves a scheduled window intact.
// The second return value is true when entrants should receive check-in-open notifications now.
func (s *TournamentStore) EnsureCheckInOpenForCupStart(
	ctx context.Context,
	tournamentID string,
	closeAfterHours int,
) (*Tournament, bool, error) {
	if !s.bracketReady() {
		return nil, false, fmt.Errorf("database unavailable")
	}
	t, err := s.Get(ctx, tournamentID)
	if err != nil {
		return nil, false, err
	}
	now := time.Now().UTC()
	if t.CheckInOpensAt != nil && now.Before(*t.CheckInOpensAt) {
		return t, false, nil
	}
	if t.CheckInOpensAt != nil {
		return t, true, nil
	}
	var closesAt *time.Time
	if closeAfterHours > 0 {
		c := now.Add(time.Duration(closeAfterHours) * time.Hour)
		closesAt = &c
	}
	var row pgx.Row
	if closesAt != nil {
		row = s.db.Pool.QueryRow(ctx, `
			UPDATE tournaments
			SET check_in_opens_at = NOW(),
			    check_in_closes_at = COALESCE(check_in_closes_at, $2),
			    updated_at = NOW()
			WHERE id = $1
			RETURNING `+tournamentSelectCols, tournamentID, *closesAt)
	} else {
		row = s.db.Pool.QueryRow(ctx, `
			UPDATE tournaments
			SET check_in_opens_at = NOW(),
			    updated_at = NOW()
			WHERE id = $1
			RETURNING `+tournamentSelectCols, tournamentID)
	}
	t, err = scanTournament(row)
	if err != nil {
		return nil, false, err
	}
	return t, true, nil
}

// CheckIn marks the entrant checked in when the window allows.
func (s *TournamentStore) CheckIn(ctx context.Context, tournamentID, userID string) error {
	if !s.bracketReady() {
		return fmt.Errorf("database unavailable")
	}
	t, err := s.Get(ctx, tournamentID)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	if t.CheckInOpensAt != nil && now.Before(*t.CheckInOpensAt) {
		return ErrTournamentCheckIn
	}
	if t.CheckInClosesAt != nil && now.After(*t.CheckInClosesAt) {
		return ErrTournamentCheckIn
	}
	tag, err := s.db.Pool.Exec(ctx, `
		UPDATE tournament_entries SET checked_in_at = COALESCE(checked_in_at, NOW())
		WHERE tournament_id = $1 AND user_id = $2`, tournamentID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("not enrolled")
	}
	return nil
}

// MarkPlayerReady records ready for slot a or b; returns updated match.
func (s *TournamentStore) MarkPlayerReady(ctx context.Context, tournamentID, matchID, userID string) (*TournamentBracketMatch, error) {
	if !s.bracketReady() {
		return nil, fmt.Errorf("database unavailable")
	}
	m, err := s.GetBracketMatch(ctx, tournamentID, matchID)
	if err != nil {
		return nil, err
	}
	col := ""
	switch {
	case m.PlayerAID != nil && *m.PlayerAID == userID:
		col = "player_a_ready_at"
	case m.PlayerBID != nil && *m.PlayerBID == userID:
		col = "player_b_ready_at"
	default:
		return nil, ErrHostedEventInvalidInput
	}
	q := fmt.Sprintf(`
		UPDATE tournament_bracket_matches
		SET %s = COALESCE(%s, NOW()), updated_at = NOW()
		WHERE id = $1 AND tournament_id = $2
		RETURNING id, tournament_id, phase, group_index, round_index, match_index, player_a_id, player_b_id, winner_id,
			next_match_id, next_slot, game_id, status, is_bye,
			player_a_ready_at, player_b_ready_at, started_at, finished_at, created_at, updated_at`, col, col)
	updated, err := scanTournamentBracket(s.db.Pool.QueryRow(ctx, q, matchID, tournamentID))
	if err != nil {
		return nil, err
	}
	return updated, nil
}
