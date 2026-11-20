package rest

import (
	"context"
	"strconv"
	"strings"

	"dama/apps/api/internal/db"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/store"
)

func optionalCheckInCloseHours(raw string) int {
	h, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || h <= 0 {
		return 0
	}
	return h
}

func emitTournamentCheckInOpen(ctx context.Context, handle *db.Handle, t *store.Tournament, playerIDs []string) {
	if handle == nil || !handle.Ready() || t == nil {
		return
	}
	for _, uid := range playerIDs {
		uid = strings.TrimSpace(uid)
		if uid == "" {
			continue
		}
		notifications.EmitPlayer(ctx, handle.Pool, uid, notifications.KindPlayerTournamentCheckInOpen,
			"tournament_check_in_open:"+t.ID+":"+uid, t.ID, t.Title)
	}
}

func emitEventCheckInOpen(ctx context.Context, handle *db.Handle, ev *store.HostedEvent, playerIDs []string) {
	if handle == nil || !handle.Ready() || ev == nil {
		return
	}
	for _, uid := range playerIDs {
		uid = strings.TrimSpace(uid)
		if uid == "" {
			continue
		}
		notifications.EmitPlayer(ctx, handle.Pool, uid, notifications.KindPlayerCompetitionCheckInOpen,
			"event_check_in_open:"+ev.ID+":"+uid, ev.ID, ev.Title)
	}
}
