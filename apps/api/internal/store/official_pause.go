package store

import (
	"context"
	"fmt"
	"strings"
	"time"

	"dama/apps/api/internal/db"
)

// OfficialPauseEvent is one audited official pause or resume on a live board.
type OfficialPauseEvent struct {
	ID               string    `json:"id"`
	GameID           string    `json:"game_id"`
	Action           string    `json:"action"`
	ActorUserID      string    `json:"actor_user_id"`
	ActorRole        string    `json:"actor_role"`
	ActorDisplayName string    `json:"actor_display_name"`
	ReasonKey        string    `json:"reason_key"`
	ReasonLabel      string    `json:"reason_label"`
	Note             string    `json:"note"`
	EventID          *string   `json:"event_id,omitempty"`
	TournamentID     *string   `json:"tournament_id,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
}

// OfficialPauseStore writes/reads match_official_pause_events.
type OfficialPauseStore struct {
	db *db.Handle
}

func NewOfficialPauseStore(handle *db.Handle) *OfficialPauseStore {
	return &OfficialPauseStore{db: handle}
}

func (s *OfficialPauseStore) Insert(ctx context.Context, ev OfficialPauseEvent) (*OfficialPauseEvent, error) {
	if s == nil || s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	gameID := strings.TrimSpace(ev.GameID)
	action := strings.TrimSpace(ev.Action)
	actorID := strings.TrimSpace(ev.ActorUserID)
	role := strings.TrimSpace(ev.ActorRole)
	if gameID == "" || actorID == "" || (action != "pause" && action != "resume" && action != "meta") {
		return nil, fmt.Errorf("invalid official pause event")
	}
	if role != "admin" && role != "organizer" {
		return nil, fmt.Errorf("invalid official pause actor role")
	}
	eventID := strings.TrimSpace(ptrStr(ev.EventID))
	tourID := strings.TrimSpace(ptrStr(ev.TournamentID))
	var out OfficialPauseEvent
	var eventOut, tourOut *string
	err := s.db.Pool.QueryRow(ctx, `
		INSERT INTO match_official_pause_events (
			game_id, action, actor_user_id, actor_role, actor_display_name,
			reason_key, reason_label, note, event_id, tournament_id
		) VALUES (
			$1, $2, $3::uuid, $4, $5,
			$6, $7, $8,
			NULLIF($9, '')::uuid, NULLIF($10, '')::uuid
		)
		RETURNING id::text, game_id, action, actor_user_id::text, actor_role,
			actor_display_name, reason_key, reason_label, note,
			event_id::text, tournament_id::text, created_at
	`,
		gameID, action, actorID, role, strings.TrimSpace(ev.ActorDisplayName),
		strings.TrimSpace(ev.ReasonKey), strings.TrimSpace(ev.ReasonLabel), strings.TrimSpace(ev.Note),
		eventID, tourID,
	).Scan(
		&out.ID, &out.GameID, &out.Action, &out.ActorUserID, &out.ActorRole,
		&out.ActorDisplayName, &out.ReasonKey, &out.ReasonLabel, &out.Note,
		&eventOut, &tourOut, &out.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	out.EventID = eventOut
	out.TournamentID = tourOut
	return &out, nil
}

func (s *OfficialPauseStore) ListByGame(ctx context.Context, gameID string, limit int) ([]OfficialPauseEvent, error) {
	if s == nil || s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	gameID = strings.TrimSpace(gameID)
	if gameID == "" {
		return nil, fmt.Errorf("game id required")
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id::text, game_id, action, actor_user_id::text, actor_role,
			actor_display_name, reason_key, reason_label, note,
			event_id::text, tournament_id::text, created_at
		FROM match_official_pause_events
		WHERE game_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, gameID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]OfficialPauseEvent, 0)
	for rows.Next() {
		var ev OfficialPauseEvent
		var eventID, tourID *string
		if err := rows.Scan(
			&ev.ID, &ev.GameID, &ev.Action, &ev.ActorUserID, &ev.ActorRole,
			&ev.ActorDisplayName, &ev.ReasonKey, &ev.ReasonLabel, &ev.Note,
			&eventID, &tourID, &ev.CreatedAt,
		); err != nil {
			return nil, err
		}
		ev.EventID = eventID
		ev.TournamentID = tourID
		out = append(out, ev)
	}
	return out, rows.Err()
}

// AverageCompletedPauseSecondsForOrganizer averages pause→resume gaps for an organizer.
// Open (never resumed) sessions are excluded. Returns 0 when no completed pairs.
func (s *OfficialPauseStore) AverageCompletedPauseSecondsForOrganizer(
	ctx context.Context, organizerID string,
) (int, error) {
	if s == nil || s.db == nil || !s.db.Ready() {
		return 0, fmt.Errorf("service temporarily unavailable")
	}
	organizerID = strings.TrimSpace(organizerID)
	if organizerID == "" {
		return 0, nil
	}
	var avg float64
	// Pair each pause with the next resume on that game (meta rows between are ignored).
	err := s.db.Pool.QueryRow(ctx, `
		WITH pauses AS (
			SELECT e.game_id, e.created_at AS paused_at
			FROM match_official_pause_events e
			INNER JOIN hosted_events he ON he.id = e.event_id
			WHERE he.organizer_id = $1::uuid
			  AND e.event_id IS NOT NULL
			  AND e.action = 'pause'
		),
		paired AS (
			SELECT p.paused_at,
				(
					SELECT MIN(r.created_at)
					FROM match_official_pause_events r
					WHERE r.game_id = p.game_id
					  AND r.action = 'resume'
					  AND r.created_at > p.paused_at
				) AS resumed_at
			FROM pauses p
		)
		SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resumed_at - paused_at))), 0)::float8
		FROM paired
		WHERE resumed_at IS NOT NULL`,
		organizerID,
	).Scan(&avg)
	if err != nil {
		return 0, err
	}
	if avg < 0 {
		return 0, nil
	}
	return int(avg + 0.5), nil
}

func ptrStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
