package store

import (
	"context"
	"time"
)

// ReadyTimeoutCandidate is a ready match where one seat marked ready and the other timed out.
type ReadyTimeoutCandidate struct {
	EntityKind string // tournament | event
	EntityID   string
	MatchID    string
	LoserID    string
}

// ListTournamentReadyTimeoutCandidates returns tournament matches ready for auto no-show forfeit.
func (s *TournamentStore) ListTournamentReadyTimeoutCandidates(
	ctx context.Context,
	readyStatus string,
	timeout time.Duration,
	now time.Time,
) ([]ReadyTimeoutCandidate, error) {
	if !s.bracketReady() || timeout <= 0 {
		return nil, nil
	}
	cutoff := now.UTC().Add(-timeout)
	rows, err := s.db.Pool.Query(ctx, `
		SELECT tournament_id::text, id::text,
		       CASE
		         WHEN player_a_ready_at IS NOT NULL AND player_b_ready_at IS NULL THEN player_b_id::text
		         WHEN player_b_ready_at IS NOT NULL AND player_a_ready_at IS NULL THEN player_a_id::text
		         ELSE NULL
		       END AS loser_id
		FROM tournament_bracket_matches
		WHERE status = $1
		  AND COALESCE(is_bye, false) = false
		  AND game_id IS NULL
		  AND player_a_id IS NOT NULL AND player_b_id IS NOT NULL
		  AND (
		    (player_a_ready_at IS NOT NULL AND player_b_ready_at IS NULL AND player_a_ready_at <= $2)
		    OR
		    (player_b_ready_at IS NOT NULL AND player_a_ready_at IS NULL AND player_b_ready_at <= $2)
		  )`, readyStatus, cutoff)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]ReadyTimeoutCandidate, 0)
	for rows.Next() {
		var entityID, matchID, loserID string
		if err := rows.Scan(&entityID, &matchID, &loserID); err != nil {
			return nil, err
		}
		if loserID == "" {
			continue
		}
		out = append(out, ReadyTimeoutCandidate{
			EntityKind: "tournament",
			EntityID:   entityID,
			MatchID:    matchID,
			LoserID:    loserID,
		})
	}
	return out, rows.Err()
}

// ListEventReadyTimeoutCandidates returns hosted event matches ready for auto no-show forfeit.
func (s *HostedEventStore) ListEventReadyTimeoutCandidates(
	ctx context.Context,
	readyStatus string,
	timeout time.Duration,
	now time.Time,
) ([]ReadyTimeoutCandidate, error) {
	if !s.ready() || timeout <= 0 {
		return nil, nil
	}
	cutoff := now.UTC().Add(-timeout)
	rows, err := s.db.Pool.Query(ctx, `
		SELECT event_id::text, id::text,
		       CASE
		         WHEN player_a_ready_at IS NOT NULL AND player_b_ready_at IS NULL THEN player_b_id::text
		         WHEN player_b_ready_at IS NOT NULL AND player_a_ready_at IS NULL THEN player_a_id::text
		         ELSE NULL
		       END AS loser_id
		FROM hosted_event_bracket_matches
		WHERE status = $1
		  AND COALESCE(is_bye, false) = false
		  AND game_id IS NULL
		  AND player_a_id IS NOT NULL AND player_b_id IS NOT NULL
		  AND (
		    (player_a_ready_at IS NOT NULL AND player_b_ready_at IS NULL AND player_a_ready_at <= $2)
		    OR
		    (player_b_ready_at IS NOT NULL AND player_a_ready_at IS NULL AND player_b_ready_at <= $2)
		  )`, readyStatus, cutoff)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]ReadyTimeoutCandidate, 0)
	for rows.Next() {
		var entityID, matchID, loserID string
		if err := rows.Scan(&entityID, &matchID, &loserID); err != nil {
			return nil, err
		}
		if loserID == "" {
			continue
		}
		out = append(out, ReadyTimeoutCandidate{
			EntityKind: "event",
			EntityID:   entityID,
			MatchID:    matchID,
			LoserID:    loserID,
		})
	}
	return out, rows.Err()
}
