package notifications

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// EmitPlayer inserts a player-audience notification (errors ignored by callers via _).
func EmitPlayer(ctx context.Context, db *pgxpool.Pool, recipientID, kindCode, dedupeKey, hrefEntityID string, bodyArgs ...string) {
	if db == nil || strings.TrimSpace(recipientID) == "" || strings.TrimSpace(kindCode) == "" {
		return
	}
	_ = Insert(ctx, db, InsertOpts{
		RecipientID:  recipientID,
		Audience:     AudiencePlayer,
		KindCode:     kindCode,
		BodyArgs:     bodyArgs,
		DedupeKey:    dedupeKey,
		HrefEntityID: hrefEntityID,
	})
}

// EmitAdmins notifies all active console-role users.
func EmitAdmins(ctx context.Context, db *pgxpool.Pool, consoleRoles []string, kindCode, dedupeKeyPrefix, hrefEntityID string, bodyArgs ...string) {
	if db == nil || strings.TrimSpace(kindCode) == "" || len(consoleRoles) == 0 {
		return
	}
	_ = InsertForConsoleRoles(ctx, db, consoleRoles, kindCode, bodyArgs, dedupeKeyPrefix, "", hrefEntityID)
}

// EmitActivePlayers notifies every active user with the given player role.
func EmitActivePlayers(ctx context.Context, db *pgxpool.Pool, playerRole, kindCode, dedupeKeyPrefix, hrefEntityID string, bodyArgs ...string) {
	if db == nil || strings.TrimSpace(kindCode) == "" {
		return
	}
	playerRole = strings.TrimSpace(playerRole)
	if playerRole == "" {
		playerRole = AudiencePlayer
	}
	rows, err := db.Query(ctx, `
		SELECT id::text FROM users
		WHERE is_active = TRUE AND role = $1
	`, playerRole)
	if err != nil {
		return
	}
	defer rows.Close()
	prefix := strings.TrimSpace(dedupeKeyPrefix)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			continue
		}
		dedupe := ""
		if prefix != "" {
			dedupe = prefix + ":" + id
		}
		EmitPlayer(ctx, db, id, kindCode, dedupe, hrefEntityID, bodyArgs...)
	}
}

// NotifyTournamentLifecycle emits DB-backed player notifications for create/open
// and status changes. Broadcasts player.tournament_created to all active players
// when status becomes enrollable; notifies entrants with player.tournament_status
// on any real status transition.
func NotifyTournamentLifecycle(
	ctx context.Context,
	db *pgxpool.Pool,
	playerRole string,
	enrollableStatus string,
	tournamentID, title, newStatus, previousStatus string,
	entrantUserIDs []string,
) {
	if db == nil {
		return
	}
	tournamentID = strings.TrimSpace(tournamentID)
	newStatus = strings.TrimSpace(newStatus)
	previousStatus = strings.TrimSpace(previousStatus)
	title = strings.TrimSpace(title)
	enrollableStatus = strings.TrimSpace(enrollableStatus)
	if tournamentID == "" || newStatus == "" {
		return
	}
	if previousStatus == newStatus {
		return
	}
	if title == "" {
		title = "Tournament"
	}

	if enrollableStatus != "" && newStatus == enrollableStatus && previousStatus != enrollableStatus {
		EmitActivePlayers(ctx, db, playerRole, KindPlayerTournamentCreated,
			"tournament_created:"+tournamentID, tournamentID, title)
	}

	for _, uid := range entrantUserIDs {
		uid = strings.TrimSpace(uid)
		if uid == "" {
			continue
		}
		EmitPlayer(ctx, db, uid, KindPlayerTournamentStatus,
			"tournament_status:"+tournamentID+":"+newStatus+":"+uid, tournamentID, title, newStatus)
	}
}

// MoneyArgs formats amount + currency for body templates.
func MoneyArgs(amount float64, currency string) []string {
	return []string{fmt.Sprintf("%.2f", amount), strings.TrimSpace(currency)}
}
