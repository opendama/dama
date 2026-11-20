package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var ErrHostedEventCheckIn = errors.New("hosted event check-in unavailable")

// EnsureCheckInOpenForCupStart opens check-in when unset, or leaves a scheduled window intact.
// The second return value is true when entrants should receive check-in-open notifications now.
func (s *HostedEventStore) EnsureCheckInOpenForCupStart(
	ctx context.Context,
	eventID string,
	closeAfterHours int,
) (*HostedEvent, bool, error) {
	if !s.ready() {
		return nil, false, fmt.Errorf("database unavailable")
	}
	ev, err := s.Get(ctx, eventID)
	if err != nil {
		return nil, false, err
	}
	now := time.Now().UTC()
	if ev.CheckInOpensAt != nil && now.Before(*ev.CheckInOpensAt) {
		return ev, false, nil
	}
	if ev.CheckInOpensAt != nil {
		return ev, true, nil
	}
	var closesAt *time.Time
	if closeAfterHours > 0 {
		c := now.Add(time.Duration(closeAfterHours) * time.Hour)
		closesAt = &c
	}
	var row pgx.Row
	if closesAt != nil {
		row = s.db.Pool.QueryRow(ctx, `
			UPDATE hosted_events
			SET check_in_opens_at = NOW(),
			    check_in_closes_at = COALESCE(check_in_closes_at, $2),
			    updated_at = NOW()
			WHERE id = $1
			RETURNING `+hostedEventCols, eventID, *closesAt)
	} else {
		row = s.db.Pool.QueryRow(ctx, `
			UPDATE hosted_events
			SET check_in_opens_at = NOW(),
			    updated_at = NOW()
			WHERE id = $1
			RETURNING `+hostedEventCols, eventID)
	}
	ev, err = scanHostedEvent(row)
	if err != nil {
		return nil, false, err
	}
	return ev, true, nil
}

// CheckIn marks an approved entrant checked in when the window allows.
func (s *HostedEventStore) CheckIn(ctx context.Context, eventID, userID, approvedStatus string) error {
	if !s.ready() {
		return fmt.Errorf("database unavailable")
	}
	ev, err := s.Get(ctx, eventID)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	if ev.CheckInOpensAt != nil && now.Before(*ev.CheckInOpensAt) {
		return ErrHostedEventCheckIn
	}
	if ev.CheckInClosesAt != nil && now.After(*ev.CheckInClosesAt) {
		return ErrHostedEventCheckIn
	}
	approvedStatus = strings.TrimSpace(approvedStatus)
	if approvedStatus == "" {
		return ErrHostedEventInvalidInput
	}
	tag, err := s.db.Pool.Exec(ctx, `
		UPDATE hosted_event_entries SET checked_in_at = COALESCE(checked_in_at, NOW())
		WHERE event_id = $1 AND user_id = $2 AND status = $3`, eventID, userID, approvedStatus)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("not enrolled")
	}
	return nil
}

// MarkPlayerReady records ready for slot a or b; returns updated match.
func (s *HostedEventStore) MarkPlayerReady(ctx context.Context, eventID, matchID, userID string) (*HostedBracketMatch, error) {
	if !s.ready() {
		return nil, fmt.Errorf("database unavailable")
	}
	m, err := s.GetBracketMatch(ctx, eventID, matchID)
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
		UPDATE hosted_event_bracket_matches
		SET %s = COALESCE(%s, NOW()), updated_at = NOW()
		WHERE id = $1 AND event_id = $2
		RETURNING `+hostedBracketMatchReturningCols, col, col)
	updated, err := scanBracketMatch(s.db.Pool.QueryRow(ctx, q, matchID, eventID))
	if err != nil {
		return nil, err
	}
	return updated, nil
}
