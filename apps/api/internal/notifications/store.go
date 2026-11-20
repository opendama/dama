package notifications

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"dama/apps/api/internal/pagination"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	AudiencePlayer = "player"
	AudienceAdmin  = "admin"

	KindPlayerInviteReceived           = "player.invite_received"
	KindPlayerInviteAccepted           = "player.invite_accepted"
	KindPlayerInviteDeclined           = "player.invite_declined"
	KindPlayerInviteCancelled          = "player.invite_cancelled"
	KindPlayerInviteExpired            = "player.invite_expired"
	KindPlayerMatchFound               = "player.match_found"
	KindPlayerWalletCredited           = "player.wallet_credited"
	KindPlayerReceiptReviewed          = "player.receipt_reviewed"
	KindPlayerPayoutUpdated            = "player.payout_updated"
	KindPlayerKycReviewed              = "player.kyc_reviewed"
	KindPlayerFriendAdded              = "player.friend_added"
	KindPlayerFriendRemoved            = "player.friend_removed"
	KindPlayerFriendRequest            = "player.friend_request"
	KindPlayerFriendRequestAccepted    = "player.friend_request_accepted"
	KindPlayerFriendRequestDenied      = "player.friend_request_denied"
	KindPlayerFriendRequestCancelled   = "player.friend_request_cancelled"
	KindPlayerDMRequest                = "player.dm_request"
	KindPlayerDMRequestAccepted        = "player.dm_request_accepted"
	KindPlayerDMRequestDenied          = "player.dm_request_denied"
	KindPlayerDMRequestCancelled       = "player.dm_request_cancelled"
	KindPlayerDMMessage                = "player.dm_message"
	KindPlayerTournamentStatus         = "player.tournament_status"
	KindPlayerTournamentCreated        = "player.tournament_created"
	KindPlayerTournamentMatchReady     = "player.tournament_match_ready"
	KindPlayerTournamentStarted        = "player.tournament_started"
	KindPlayerTournamentFinished       = "player.tournament_finished"
	KindPlayerTournamentCheckInOpen    = "player.tournament_check_in_open"
	KindPlayerTournamentDisputeOpen    = "player.tournament_dispute_open"
	KindPlayerTournamentReportReceived = "player.tournament_report_received"
	KindPlayerCompetitionCheckInOpen   = "player.competition_check_in_open"
	KindPlayerCompetitionPrizeSettled  = "player.competition_prize_settled"
	KindPlayerCompetitionDisputeOpen   = "player.competition_dispute_open"
	KindPlayerCompetitionPointsAwarded = "player.competition_points_awarded"
	KindPlayerArenaStarted             = "player.arena_started"
	KindPlayerArenaFinished            = "player.arena_finished"
	KindPlayerArenaMatched             = "player.arena_matched"
	KindPlayerCampaignStatus           = "player.campaign_status"
	KindPlayerGameFinished             = "player.game_finished"
	KindPlayerOfficialPause            = "player.official_pause"
	KindPlayerOfficialResume           = "player.official_resume"
	KindPlayerAvatarReviewed           = "player.avatar_reviewed"
	KindPlayerAccountStatus            = "player.account_status"
	KindPlayerEventCreated             = "player.event_created"
	KindPlayerEventJoined              = "player.event_joined"
	KindPlayerEventPlayerJoined        = "player.event_player_joined"
	KindPlayerEventStarted             = "player.event_started"
	KindPlayerEventStartedOrg          = "player.event_started_org"
	KindPlayerEventMatchReady          = "player.event_match_ready"
	KindPlayerEventFinished            = "player.event_finished"
	KindPlayerEventCancelled           = "player.event_cancelled"
	KindPlayerEventReopened            = "player.event_reopened"
	KindPlayerEventAutoClosed          = "player.event_auto_closed"
	KindPlayerEventReportReceived      = "player.event_report_received"
	KindPlayerEventEntryEarned         = "player.event_entry_earned"
	KindPlayerCampaignClosed           = "player.campaign_closed"
	KindPlayerCampaignReopened         = "player.campaign_reopened"
	KindPlayerCampaignAutoClosed       = "player.campaign_auto_closed"
	KindAdminCampaignClosed            = "admin.campaign_closed"
	KindAdminCampaignReopened          = "admin.campaign_reopened"
	KindAdminCampaignAutoClosed        = "admin.campaign_auto_closed"
	KindAdminReceiptPending            = "admin.receipt_pending"
	KindAdminPayoutPending             = "admin.payout_pending"
	KindAdminKycPending                = "admin.kyc_pending"
	KindAdminAvatarPending             = "admin.avatar_pending"
	KindAdminEventReportPending        = "admin.event_report_pending"
	KindAdminTournamentReportPending   = "admin.tournament_report_pending"
	KindAdminEventClosed               = "admin.event_closed"
	KindAdminEventReopened             = "admin.event_reopened"
	KindAdminEventAutoClosed           = "admin.event_auto_closed"
	KindPlayerEventEntryKicked         = "player.event_entry_kicked"
)

type InsertOpts struct {
	RecipientID  string
	Audience     string
	KindCode     string
	BodyArgs     []string
	DedupeKey    string
	HrefEntityID string
}

// Insert one notification. Empty kind / recipient / audience fails closed.
// Duplicate dedupe_key for the same recipient is ignored (no error).
func Insert(ctx context.Context, db *pgxpool.Pool, opts InsertOpts) error {
	if db == nil {
		return fmt.Errorf("DATABASE_UNAVAILABLE")
	}
	opts.RecipientID = strings.TrimSpace(opts.RecipientID)
	opts.Audience = strings.TrimSpace(opts.Audience)
	opts.KindCode = strings.TrimSpace(opts.KindCode)
	if opts.RecipientID == "" || opts.Audience == "" || opts.KindCode == "" {
		return fmt.Errorf("NOTIF_INSERT_INVALID")
	}
	if opts.BodyArgs == nil {
		opts.BodyArgs = []string{}
	}
	argsJSON, err := json.Marshal(opts.BodyArgs)
	if err != nil {
		return fmt.Errorf("NOTIF_INSERT_INVALID")
	}
	dedupe := strings.TrimSpace(opts.DedupeKey)
	entityID := strings.TrimSpace(opts.HrefEntityID)
	_, err = db.Exec(ctx, `
		INSERT INTO app_notifications
			(recipient_id, audience, kind_code, body_args, dedupe_key, href_entity_id)
		VALUES ($1::uuid, $2, $3, $4::jsonb, NULLIF($5, ''), COALESCE(NULLIF($6, ''), ''))
		ON CONFLICT (recipient_id, dedupe_key) WHERE dedupe_key IS NOT NULL AND dedupe_key <> ''
		DO NOTHING
	`, opts.RecipientID, opts.Audience, opts.KindCode, string(argsJSON), dedupe, entityID)
	if err != nil {
		return fmt.Errorf("NOTIF_INSERT_FAILED")
	}
	return nil
}

// InsertForConsoleRoles notifies every active user whose role is in consoleRoles.
func InsertForConsoleRoles(
	ctx context.Context,
	db *pgxpool.Pool,
	consoleRoles []string,
	kindCode string,
	bodyArgs []string,
	dedupeKeyPrefix string,
	skipUserID string,
	hrefEntityID string,
) error {
	if db == nil {
		return fmt.Errorf("DATABASE_UNAVAILABLE")
	}
	kindCode = strings.TrimSpace(kindCode)
	if kindCode == "" || len(consoleRoles) == 0 {
		return fmt.Errorf("NOTIF_INSERT_INVALID")
	}
	rows, err := db.Query(ctx, `
		SELECT id::text FROM users
		WHERE is_active = TRUE AND role = ANY($1::text[])
	`, consoleRoles)
	if err != nil {
		return fmt.Errorf("NOTIF_ADMINS_LOAD_FAILED")
	}
	defer rows.Close()
	skipUserID = strings.TrimSpace(skipUserID)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			continue
		}
		if skipUserID != "" && id == skipUserID {
			continue
		}
		dedupe := ""
		if strings.TrimSpace(dedupeKeyPrefix) != "" {
			dedupe = dedupeKeyPrefix + ":" + id
		}
		_ = Insert(ctx, db, InsertOpts{
			RecipientID:  id,
			Audience:     AudienceAdmin,
			KindCode:     kindCode,
			BodyArgs:     bodyArgs,
			DedupeKey:    dedupe,
			HrefEntityID: hrefEntityID,
		})
	}
	return nil
}

type Item struct {
	ID        string   `json:"id"`
	KindCode  string   `json:"kind_code"`
	Title     string   `json:"title"`
	Body      string   `json:"body"`
	BodyArgs  []string `json:"body_args,omitempty"`
	Href      string   `json:"href,omitempty"`
	Read      bool     `json:"read"`
	CreatedAt string   `json:"created_at"`
}

type Chrome struct {
	BellAria              string `json:"bell_aria"`
	BellAriaCountFmt      string `json:"bell_aria_count_fmt"`
	PanelTitle            string `json:"panel_title"`
	EmptyMessage          string `json:"empty_message"`
	MarkAllRead           string `json:"mark_all_read"`
	MarkAllPending        string `json:"mark_all_pending"`
	MarkRead              string `json:"mark_read"`
	MarkReadPending       string `json:"mark_read_pending"`
	UnreadLabel           string `json:"unread_label"`
	LoadingMore           string `json:"loading_more"`
	PollIntervalMs        int    `json:"poll_interval_ms"`
	ListPageSize          int    `json:"list_page_size"`
	ListFailed            string `json:"list_failed"`
	MarkFailed            string `json:"mark_failed"`
	CountFailed           string `json:"count_failed"`
	Unavailable           string `json:"unavailable"`
	ErrUnauthorized       string `json:"err_unauthorized"`
	MarkReadDone          string `json:"mark_read_done"`
	MarkAllReadDone       string `json:"mark_all_read_done"`
	ToastPointsAwardedFmt string `json:"toast_points_awarded_fmt"`
}

type ListResult struct {
	Items  []Item          `json:"items"`
	Meta   pagination.Meta `json:"meta"`
	Chrome Chrome          `json:"chrome"`
}

func chromeString(m map[string]any, key string) string {
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return strings.TrimSpace(t)
	case float64:
		return strings.TrimSpace(strconv.FormatInt(int64(t), 10))
	case json.Number:
		return strings.TrimSpace(t.String())
	default:
		return strings.TrimSpace(fmt.Sprint(t))
	}
}

func chromeInt(m map[string]any, key string) int {
	raw := chromeString(m, key)
	if raw == "" {
		return 0
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 1 {
		return 0
	}
	return n
}

func LoadChrome(ctx context.Context, db *pgxpool.Pool) Chrome {
	out := Chrome{}
	if db == nil {
		return out
	}
	var raw []byte
	err := db.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'notification_chrome'`).Scan(&raw)
	if err != nil || len(raw) == 0 {
		return out
	}
	var m map[string]any
	if json.Unmarshal(raw, &m) != nil {
		return out
	}
	out.BellAria = chromeString(m, "bell_aria")
	out.BellAriaCountFmt = chromeString(m, "bell_aria_count_fmt")
	out.PanelTitle = chromeString(m, "panel_title")
	out.EmptyMessage = chromeString(m, "empty_message")
	out.MarkAllRead = chromeString(m, "mark_all_read")
	out.MarkAllPending = chromeString(m, "mark_all_pending")
	out.MarkRead = chromeString(m, "mark_read")
	out.MarkReadPending = chromeString(m, "mark_read_pending")
	out.UnreadLabel = chromeString(m, "unread_label")
	out.LoadingMore = chromeString(m, "loading_more")
	out.ListFailed = chromeString(m, "list_failed")
	out.MarkFailed = chromeString(m, "mark_failed")
	out.CountFailed = chromeString(m, "count_failed")
	out.Unavailable = chromeString(m, "unavailable")
	out.ErrUnauthorized = chromeString(m, "err_unauthorized")
	out.MarkReadDone = chromeString(m, "mark_read_done")
	out.MarkAllReadDone = chromeString(m, "mark_all_read_done")
	out.ToastPointsAwardedFmt = chromeString(m, "toast_points_awarded_fmt")
	out.PollIntervalMs = chromeInt(m, "poll_interval_ms")
	out.ListPageSize = chromeInt(m, "list_page_size")
	return out
}

func List(
	ctx context.Context,
	db *pgxpool.Pool,
	r *http.Request,
	recipientID string,
	audience string,
	maxLimit int,
	skipCap int,
	labels pagination.Labels,
) (ListResult, error) {
	out := ListResult{Items: []Item{}, Chrome: LoadChrome(ctx, db)}
	if db == nil {
		return out, fmt.Errorf("DATABASE_UNAVAILABLE")
	}
	recipientID = strings.TrimSpace(recipientID)
	audience = strings.TrimSpace(audience)
	if recipientID == "" || audience == "" {
		return out, fmt.Errorf("NOTIF_LIST_INVALID")
	}
	if maxLimit < 1 {
		return out, fmt.Errorf("PAGINATION_MAX_LIMIT_INVALID")
	}
	params, err := pagination.Parse(r, maxLimit)
	if err != nil {
		return out, err
	}

	var total int
	if err := db.QueryRow(ctx, `
		SELECT COUNT(*) FROM app_notifications
		WHERE recipient_id = $1::uuid AND audience = $2
	`, recipientID, audience).Scan(&total); err != nil {
		return out, fmt.Errorf("NOTIF_COUNT_FAILED")
	}

	rows, err := db.Query(ctx, `
		SELECT n.id::text, n.kind_code, n.body_args, n.read_at IS NOT NULL, n.created_at::text,
		       COALESCE(n.href_entity_id, ''),
		       k.title_template, k.body_template, k.href_path, k.href_query_key
		FROM app_notifications n
		JOIN notification_kinds k ON k.code = n.kind_code
		WHERE n.recipient_id = $1::uuid AND n.audience = $2
		ORDER BY n.created_at DESC
		OFFSET $3 LIMIT $4
	`, recipientID, audience, params.Skip, params.Limit)
	if err != nil {
		return out, fmt.Errorf("NOTIF_LIST_FAILED")
	}
	defer rows.Close()

	for rows.Next() {
		var (
			id, kind, createdAt, entityID          string
			titleTpl, bodyTpl, hrefPath, hrefQuery string
			read                                   bool
			argsRaw                                []byte
		)
		if err := rows.Scan(&id, &kind, &argsRaw, &read, &createdAt, &entityID, &titleTpl, &bodyTpl, &hrefPath, &hrefQuery); err != nil {
			continue
		}
		titleTpl = strings.TrimSpace(titleTpl)
		bodyTpl = strings.TrimSpace(bodyTpl)
		if titleTpl == "" || bodyTpl == "" {
			continue
		}
		var args []string
		_ = json.Unmarshal(argsRaw, &args)
		body := formatBody(bodyTpl, args)
		href := resolveHref(hrefPath, hrefQuery, entityID)
		if args == nil {
			args = []string{}
		}
		out.Items = append(out.Items, Item{
			ID:        id,
			KindCode:  kind,
			Title:     titleTpl,
			Body:      body,
			BodyArgs:  args,
			Href:      href,
			Read:      read,
			CreatedAt: createdAt,
		})
	}

	out.Meta = pagination.BuildMeta(params, total, skipCap, labels)
	return out, nil
}

func UnreadCount(ctx context.Context, db *pgxpool.Pool, recipientID, audience string) (count int, badge string, chrome Chrome, err error) {
	chrome = LoadChrome(ctx, db)
	if db == nil {
		return 0, "", chrome, fmt.Errorf("DATABASE_UNAVAILABLE")
	}
	recipientID = strings.TrimSpace(recipientID)
	audience = strings.TrimSpace(audience)
	if recipientID == "" || audience == "" {
		return 0, "", chrome, fmt.Errorf("NOTIF_LIST_INVALID")
	}
	err = db.QueryRow(ctx, `
		SELECT COUNT(*) FROM app_notifications
		WHERE recipient_id = $1::uuid AND audience = $2 AND read_at IS NULL
	`, recipientID, audience).Scan(&count)
	if err != nil {
		return 0, "", chrome, fmt.Errorf("NOTIF_COUNT_FAILED")
	}
	if count <= 0 {
		return 0, "", chrome, nil
	}
	badge = formatBadgeLabel(ctx, db, count)
	return count, badge, chrome, nil
}

func formatBadgeLabel(ctx context.Context, db *pgxpool.Pool, count int) string {
	if count <= 0 {
		return ""
	}
	var raw []byte
	_ = db.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'notification_chrome'`).Scan(&raw)
	max := 0
	overflowFmt := ""
	if len(raw) > 0 {
		var m map[string]any
		if json.Unmarshal(raw, &m) == nil {
			max = chromeInt(m, "badge_max")
			overflowFmt = chromeString(m, "badge_overflow_fmt")
		}
	}
	if max > 0 && count > max {
		if overflowFmt != "" && strings.Contains(overflowFmt, "{max}") {
			return strings.ReplaceAll(overflowFmt, "{max}", fmt.Sprintf("%d", max))
		}
	}
	return fmt.Sprintf("%d", count)
}

func MarkRead(ctx context.Context, db *pgxpool.Pool, recipientID, audience, id string) error {
	if db == nil {
		return fmt.Errorf("DATABASE_UNAVAILABLE")
	}
	tag, err := db.Exec(ctx, `
		UPDATE app_notifications
		SET read_at = COALESCE(read_at, NOW())
		WHERE id = $1::uuid AND recipient_id = $2::uuid AND audience = $3
	`, strings.TrimSpace(id), strings.TrimSpace(recipientID), strings.TrimSpace(audience))
	if err != nil {
		return fmt.Errorf("NOTIF_MARK_FAILED")
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// MarkReadByDedupe marks unread rows for recipient+audience+dedupe_key as read.
// Used to clear stale friend_request:{id} when the request is resolved.
func MarkReadByDedupe(ctx context.Context, db *pgxpool.Pool, recipientID, audience, dedupeKey string) error {
	if db == nil {
		return fmt.Errorf("DATABASE_UNAVAILABLE")
	}
	recipientID = strings.TrimSpace(recipientID)
	audience = strings.TrimSpace(audience)
	dedupeKey = strings.TrimSpace(dedupeKey)
	if recipientID == "" || audience == "" || dedupeKey == "" {
		return fmt.Errorf("NOTIF_MARK_INVALID")
	}
	_, err := db.Exec(ctx, `
		UPDATE app_notifications
		SET read_at = COALESCE(read_at, NOW())
		WHERE recipient_id = $1::uuid
		  AND audience = $2
		  AND dedupe_key = $3
		  AND read_at IS NULL
	`, recipientID, audience, dedupeKey)
	if err != nil {
		return fmt.Errorf("NOTIF_MARK_FAILED")
	}
	return nil
}

func MarkAllRead(ctx context.Context, db *pgxpool.Pool, recipientID, audience string) error {
	if db == nil {
		return fmt.Errorf("DATABASE_UNAVAILABLE")
	}
	_, err := db.Exec(ctx, `
		UPDATE app_notifications
		SET read_at = NOW()
		WHERE recipient_id = $1::uuid AND audience = $2 AND read_at IS NULL
	`, strings.TrimSpace(recipientID), strings.TrimSpace(audience))
	if err != nil {
		return fmt.Errorf("NOTIF_MARK_FAILED")
	}
	return nil
}

func formatBody(tpl string, args []string) string {
	if len(args) == 0 {
		return tpl
	}
	anyArgs := make([]any, len(args))
	for i, a := range args {
		anyArgs[i] = a
	}
	defer func() { _ = recover() }()
	return fmt.Sprintf(tpl, anyArgs...)
}

func resolveHref(path, queryKey, entityID string) string {
	path = strings.TrimSpace(path)
	queryKey = strings.TrimSpace(queryKey)
	entityID = strings.TrimSpace(entityID)
	if path == "" {
		return ""
	}
	if !strings.HasPrefix(path, "/") || strings.HasPrefix(path, "//") {
		return ""
	}
	if queryKey == "" || entityID == "" {
		return path
	}
	if strings.ContainsAny(entityID, "/\\?#&=") || strings.Contains(entityID, "..") {
		return path
	}
	sep := "?"
	if strings.Contains(path, "?") {
		sep = "&"
	}
	return path + sep + queryKey + "=" + entityID
}
