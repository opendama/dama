package rest

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"

	"dama/apps/api/internal/db"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/store"
)

func competitionPointsLabelFromChrome(raw []byte, preferArena bool) string {
	if len(raw) == 0 {
		return ""
	}
	var m map[string]any
	if json.Unmarshal(raw, &m) != nil {
		return ""
	}
	arena := ""
	standings := ""
	if v, ok := m["arena_points_label"].(string); ok {
		arena = strings.TrimSpace(v)
	}
	if v, ok := m["standings_points_label"].(string); ok {
		standings = strings.TrimSpace(v)
	}
	if preferArena {
		return arena
	}
	return standings
}

// competitionPointsLabel reads arena/standings labels from player chrome.
// Tries tournaments_player_chrome then events_player_chrome (hosted parity; fail-closed).
func competitionPointsLabel(ctx context.Context, dbh *db.Handle, preferArena bool) string {
	if dbh == nil || !dbh.Ready() {
		return ""
	}
	for _, key := range []string{"tournaments_player_chrome", "events_player_chrome"} {
		var raw []byte
		err := dbh.Pool.QueryRow(ctx, `
			SELECT value FROM platform_settings WHERE key = $1`, key).Scan(&raw)
		if err != nil || len(raw) == 0 {
			continue
		}
		if label := competitionPointsLabelFromChrome(raw, preferArena); label != "" {
			return label
		}
	}
	return ""
}

func emitCompetitionPointsAwarded(
	ctx context.Context,
	dbh *db.Handle,
	gameID, entityTitle, hrefEntityID string,
	awards []store.CompetitionPointsAward,
	preferArenaLabel bool,
) {
	if dbh == nil || !dbh.Ready() || len(awards) == 0 {
		return
	}
	gameID = strings.TrimSpace(gameID)
	entityTitle = strings.TrimSpace(entityTitle)
	hrefEntityID = strings.TrimSpace(hrefEntityID)
	if gameID == "" || entityTitle == "" {
		return
	}
	pointsLabel := competitionPointsLabel(ctx, dbh, preferArenaLabel)
	if pointsLabel == "" {
		return
	}
	for _, a := range awards {
		uid := strings.TrimSpace(a.UserID)
		if uid == "" || a.Points <= 0 {
			continue
		}
		pts := strconv.FormatFloat(a.Points, 'f', -1, 64)
		dedupe := "competition_points:" + gameID + ":" + uid
		notifications.EmitPlayer(ctx, dbh.Pool, uid, notifications.KindPlayerCompetitionPointsAwarded,
			dedupe, hrefEntityID, pts, pointsLabel, entityTitle)
	}
}
