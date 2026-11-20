package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
)

var expected = []string{
	"admin.avatar_pending",
	"admin.kyc_pending",
	"admin.payout_pending",
	"admin.receipt_pending",
	"player.account_status",
	"player.avatar_reviewed",
	"player.campaign_status",
	"player.campaign_closed",
	"player.campaign_auto_closed",
	"player.campaign_reopened",
	"admin.campaign_closed",
	"admin.campaign_reopened",
	"admin.campaign_auto_closed",
	"player.event_joined",
	"player.event_player_joined",
	"player.event_entry_earned",
	"player.event_entry_kicked",
	"player.event_created",
	"player.event_started",
	"player.event_started_org",
	"player.event_finished",
	"player.event_cancelled",
	"player.event_reopened",
	"player.event_auto_closed",
	"player.event_match_ready",
	"player.event_report_received",
	"admin.event_closed",
	"admin.event_reopened",
	"admin.event_auto_closed",
	"admin.event_report_pending",
	"admin.tournament_report_pending",
	"player.friend_added",
	"player.friend_removed",
	"player.friend_request",
	"player.friend_request_accepted",
	"player.friend_request_cancelled",
	"player.friend_request_denied",
	"player.dm_request",
	"player.dm_request_accepted",
	"player.dm_request_cancelled",
	"player.dm_request_denied",
	"player.dm_message",
	"player.game_finished",
	"player.official_pause",
	"player.official_resume",
	"player.invite_accepted",
	"player.invite_cancelled",
	"player.invite_declined",
	"player.invite_expired",
	"player.invite_received",
	"player.kyc_reviewed",
	"player.match_found",
	"player.payout_updated",
	"player.receipt_reviewed",
	"player.tournament_created",
	"player.tournament_status",
	"player.tournament_match_ready",
	"player.tournament_started",
	"player.tournament_finished",
	"player.tournament_check_in_open",
	"player.tournament_dispute_open",
	"player.tournament_report_received",
	"player.competition_check_in_open",
	"player.competition_prize_settled",
	"player.competition_dispute_open",
	"player.arena_started",
	"player.arena_finished",
	"player.arena_matched",
	"player.wallet_credited",
}

func main() {
	ctx := context.Background()
	url := strings.TrimSpace(os.Getenv("DAMA_DATABASE_URL"))
	if url == "" {
		url = strings.TrimSpace(os.Getenv("DATABASE_URL"))
	}
	if url == "" {
		fmt.Fprintln(os.Stderr, "FAIL: no DAMA_DATABASE_URL")
		os.Exit(1)
	}
	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		panic(err)
	}
	defer conn.Close(ctx)

	rows, err := conn.Query(ctx, `
		SELECT code, audience, href_path, href_query_key
		FROM notification_kinds ORDER BY code`)
	if err != nil {
		panic(err)
	}
	defer rows.Close()

	found := map[string]bool{}
	n := 0
	for rows.Next() {
		var code, audience, hrefPath, hrefKey string
		if err := rows.Scan(&code, &audience, &hrefPath, &hrefKey); err != nil {
			panic(err)
		}
		found[code] = true
		n++
		fmt.Printf("%s|%s|%s|%s\n", code, audience, hrefPath, hrefKey)
	}
	fmt.Println("KIND_COUNT", n)
	for _, code := range expected {
		if !found[code] {
			fmt.Fprintln(os.Stderr, "FAIL missing kind:", code)
			os.Exit(1)
		}
	}

	var raw []byte
	if err := conn.QueryRow(ctx, `
		SELECT value FROM platform_settings WHERE key = 'notification_chrome'`).Scan(&raw); err != nil {
		panic(err)
	}
	var chrome map[string]any
	if err := json.Unmarshal(raw, &chrome); err != nil {
		panic(err)
	}
	keys := []string{
		"bell_aria", "panel_title", "empty_message", "mark_all_read", "mark_all_pending",
		"mark_read", "mark_read_pending", "loading_more", "list_failed",
	}
	for _, k := range keys {
		s, _ := chrome[k].(string)
		if strings.TrimSpace(s) == "" {
			fmt.Fprintln(os.Stderr, "FAIL chrome key:", k)
			os.Exit(1)
		}
		fmt.Println("CHROME", k, "ok")
	}
	for _, k := range []string{"list_page_size", "poll_interval_ms"} {
		switch v := chrome[k].(type) {
		case float64:
			if v <= 0 {
				fmt.Fprintln(os.Stderr, "FAIL chrome key:", k)
				os.Exit(1)
			}
		case string:
			if strings.TrimSpace(v) == "" {
				fmt.Fprintln(os.Stderr, "FAIL chrome key:", k)
				os.Exit(1)
			}
		default:
			fmt.Fprintln(os.Stderr, "FAIL chrome key:", k)
			os.Exit(1)
		}
		fmt.Println("CHROME", k, "ok")
	}
	fmt.Println("NOTIFICATION_KINDS_DB_OK")
}
