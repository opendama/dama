package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"dama/apps/api/internal/db"
)

// Soft-reload interval so pause_enabled / pause_duration_seconds changes on one
// API replica are picked up by others without a process restart.
const matchClockReloadMinInterval = 5 * time.Second

var errIncompleteCurrency = errors.New("currency config incomplete")

// CurrencyConfig is loaded from platform_settings.key = 'currency'.
type CurrencyConfig struct {
	Global    string   `json:"global"`
	Ethiopia  string   `json:"ethiopia"`
	Supported []string `json:"supported"`
	Source    string   `json:"-"` // internal hydrate marker - never client-facing
}

// GeoPaymentConfig is loaded from platform_settings.key = 'geo_payment'.
// EthiopiaCountry is the ISO code that routes to domestic (Chapa/manual) gateways.
// PrivateDefaultCity/Region fill localhost invent (reference Addis Ababa) from DB only.
type GeoPaymentConfig struct {
	EthiopiaCountry      string `json:"ethiopia_country"`
	PrivateDefaultCity   string `json:"private_default_city"`
	PrivateDefaultRegion string `json:"private_default_region"`
	Source               string `json:"-"`
}

// TelegramOpsBotConfig is loaded from platform_settings.key = 'telegram_ops_bot'.
// Bridges manual receipt + payout review to the shared telegram_bot worker.
type TelegramOpsBotConfig struct {
	Enabled                      bool   `json:"enabled"`
	BotServiceURL                string `json:"bot_service_url"`
	BotAPIKey                    string `json:"bot_api_key"`
	ReviewerUserID               string `json:"reviewer_user_id"`
	NotifyTimeoutMS              int    `json:"notify_timeout_ms"`
	NotifyReceiptType            string `json:"notify_receipt_type"`
	NotifyPayoutType             string `json:"notify_payout_type"`
	ProductLabel                 string `json:"product_label"`
	ReceiptHubTitle              string `json:"receipt_hub_title"`
	ReceiptHubEmpty              string `json:"receipt_hub_empty"`
	ReceiptDetailTitle           string `json:"receipt_detail_title"`
	ReceiptNotifyTitle           string `json:"receipt_notify_title"`
	PayoutHubTitle               string `json:"payout_hub_title"`
	PayoutHubEmpty               string `json:"payout_hub_empty"`
	PayoutDetailTitle            string `json:"payout_detail_title"`
	PayoutNotifyTitle            string `json:"payout_notify_title"`
	BtnViewDetails               string `json:"btn_view_details"`
	BtnViewHub                   string `json:"btn_view_hub"`
	BtnApprove                   string `json:"btn_approve"`
	BtnReject                    string `json:"btn_reject"`
	BtnMarkPaid                  string `json:"btn_mark_paid"`
	BtnBackHub                   string `json:"btn_back_hub"`
	BtnClose                     string `json:"btn_close"`
	ErrBotNotConfigured          string `json:"err_bot_not_configured"`
	ErrUnauthorizedBot           string `json:"err_unauthorized_bot"`
	ErrReviewerMissing           string `json:"err_reviewer_missing"`
	MenuReceiptsLabel            string `json:"menu_receipts_label"`
	MenuPayoutsLabel             string `json:"menu_payouts_label"`
	MenuReceiptsLabelAm          string `json:"menu_receipts_label_am"`
	MenuPayoutsLabelAm           string `json:"menu_payouts_label_am"`
	UnknownUserLabel             string `json:"unknown_user_label"`
	NALabel                      string `json:"na_label"`
	RejectReasonPromptReceipt    string `json:"reject_reason_prompt_receipt"`
	RejectReasonPromptPayout     string `json:"reject_reason_prompt_payout"`
	RejectCancelled              string `json:"reject_cancelled"`
	ApprovedToast                string `json:"approved_toast"`
	RejectedToast                string `json:"rejected_toast"`
	PaidToast                    string `json:"paid_toast"`
	ErrFetchFailed               string `json:"err_fetch_failed"`
	ErrNotConfiguredEnv          string `json:"err_not_configured_env"`
	HubFoundTemplate             string `json:"hub_found_template"`
	AdminBackLabel               string `json:"admin_back_label"`
	ErrNotAllowed                string `json:"err_not_allowed"`
	ErrBadCallback               string `json:"err_bad_callback"`
	UserFallbackTemplate         string `json:"user_fallback_template"`
	NoteApprovedByTemplate       string `json:"note_approved_by_template"`
	NotePaidByTemplate           string `json:"note_paid_by_template"`
	ReviewNoteApprovedPrefix     string `json:"review_note_approved_prefix"`
	ReviewNoteRejectedPrefix     string `json:"review_note_rejected_prefix"`
	ReviewNotePaidPrefix         string `json:"review_note_paid_prefix"`
	ReviewNoteTelegramIDTpl      string `json:"review_note_telegram_id_template"`
	ReviewNoteReasonTemplate     string `json:"review_note_reason_template"`
	ReviewNoteJoiner             string `json:"review_note_joiner"`
	ReceiptPendingStatus         string `json:"receipt_pending_status"`
	HTTPClientTimeoutSeconds     int    `json:"http_client_timeout_seconds"`
	ErrBotNotInitialized         string `json:"err_bot_not_initialized"`
	ErrUnavailable               string `json:"err_unavailable"`
	ErrBotRequestFailed          string `json:"err_bot_request_failed"`
	ErrPaymentsUnavailable       string `json:"err_payments_unavailable"`
	ErrPayoutsUnavailable        string `json:"err_payouts_unavailable"`
	ErrReceiptNotFound           string `json:"err_receipt_not_found"`
	ErrPayoutNotFound            string `json:"err_payout_not_found"`
	ErrInvalidPayoutTransition   string `json:"err_invalid_payout_transition"`
	ErrInvalidPayoutStatus       string `json:"err_invalid_payout_status"`
	ErrRefundFailedPrefix        string `json:"err_refund_failed_prefix"`
	HubListLimit                 int    `json:"hub_list_limit"`
	ErrReceiptReviewFailed       string `json:"err_receipt_review_failed"`
	ErrPayoutReviewFailed        string `json:"err_payout_review_failed"`
	ErrRejectReasonRequired      string `json:"err_reject_reason_required"`
	ErrNoTelegramAdmins          string `json:"err_no_telegram_admins"`
	RejectKeyboardLang           string `json:"reject_keyboard_lang"`
	HubHeaderMDTemplate          string `json:"hub_header_md_template"`
	HubEmptyMDTemplate           string `json:"hub_empty_md_template"`
	HubReceiptButtonTemplate     string `json:"hub_receipt_button_template"`
	HubPayoutButtonTemplate      string `json:"hub_payout_button_template"`
	ReceiptDetailHTMLTemplate    string `json:"receipt_detail_html_template"`
	PayoutDetailHTMLTemplate     string `json:"payout_detail_html_template"`
	ReceiptNotifyHTMLTemplate    string `json:"receipt_notify_html_template"`
	PayoutNotifyHTMLTemplate     string `json:"payout_notify_html_template"`
	ScreenshotLineTemplate       string `json:"screenshot_line_template"`
	ButtonTruncateSuffix         string `json:"button_truncate_suffix"`
	ActionResultMDTemplate       string `json:"action_result_md_template"`
	ActionRejectResultMDTemplate string `json:"action_reject_result_md_template"`
	Source                       string `json:"-"`
}

// ModerationConfig is loaded from platform_settings.key = 'avatar_moderation'.
type ModerationConfig struct {
	Provider string `json:"provider"` // internal: cloudinary_aws_rek | admin_only
	Enabled  bool   `json:"enabled"`
	Source   string `json:"-"` // internal hydrate marker - never client-facing
}

// XPLevel is one rung of the career ladder from platform_settings.xp_levels.
type XPLevel struct {
	MinXP int    `json:"min_xp"`
	Label string `json:"label"`
}

// XPLevelsConfig is loaded from platform_settings.key = 'xp_levels'.
type XPLevelsConfig struct {
	Levels []XPLevel `json:"levels"`
	Source string    `json:"-"`
}

// MatchClockPreset is one selectable time control from platform_settings.match_clock.presets.
type MatchClockPreset struct {
	Seconds int    `json:"seconds"`
	Label   string `json:"label"`
}

// MatchClockConfig is loaded from platform_settings.key = 'match_clock'.
type MatchClockConfig struct {
	Enabled          bool               `json:"enabled"`
	InitialSeconds   int                `json:"initial_seconds"`
	IncrementSeconds int                `json:"increment_seconds"`
	Presets          []MatchClockPreset `json:"presets,omitempty"`
	// InviteTTLSeconds is pending invite / challenge-link lifetime. Required > 0.
	InviteTTLSeconds int `json:"invite_ttl_seconds,omitempty"`
	// PauseEnabled lets a seated player freeze the match clock and moves.
	PauseEnabled bool `json:"pause_enabled"`
	// PauseDurationSeconds is the auto-resume deadline. Required > 0 when pause is enabled.
	PauseDurationSeconds int    `json:"pause_duration_seconds"`
	Source               string `json:"-"`
}

// AdPricingConfig is loaded from platform_settings.key = 'ad_pricing'.
// Campaign create fees are split: Ethiopia (domestic) vs global (everywhere else).
type AdPricingConfig struct {
	ImpressionUnitCost float64 `json:"impression_unit_cost"`
	// Ethiopia domestic create fee (typically ETB; currency locked to payment_currency.ethiopia).
	CampaignCreateFeeEthiopiaAmount   float64 `json:"campaign_create_fee_ethiopia_amount"`
	CampaignCreateFeeEthiopiaCurrency string  `json:"campaign_create_fee_ethiopia_currency"`
	// Global create fee outside Ethiopia (typically USD; currency locked to payment_currency.global).
	CampaignCreateFeeGlobalAmount   float64 `json:"campaign_create_fee_global_amount"`
	CampaignCreateFeeGlobalCurrency string  `json:"campaign_create_fee_global_currency"`
	Source                          string  `json:"-"`
}

// BoardRulesConfig is loaded from platform_settings.key = 'board_rules' (FMJD params).
type BoardRulesConfig struct {
	Size          int    `json:"size"`
	PiecesPerSide int    `json:"pieces_per_side"`
	SetupRows     int    `json:"setup_rows"`
	Variant       string `json:"variant"`
	Source        string `json:"-"`
}

// MatchRewardsConfig is loaded from platform_settings.key = 'match_rewards' (PvP only).
type MatchRewardsConfig struct {
	WinXP      int `json:"win_xp"`
	DrawXP     int `json:"draw_xp"`
	LossXP     int `json:"loss_xp"`
	WinRating  int `json:"win_rating"`
	DrawRating int `json:"draw_rating"`
	LossRating int `json:"loss_rating"`
	// RatingFloor is the admin-owned minimum profile rating after career deltas (may be 0).
	RatingFloor int `json:"rating_floor"`
	// StartingRating is assigned to brand-new player accounts (OAuth / e2e mint).
	// Must be >= RatingFloor.
	StartingRating int    `json:"starting_rating"`
	Source         string `json:"-"`
}

func validateMatchRewardsConfig(cfg MatchRewardsConfig) error {
	if cfg.WinXP < 0 || cfg.DrawXP < 0 || cfg.LossXP < 0 {
		return errors.New("match_rewards XP values must be >= 0")
	}
	if cfg.RatingFloor < 0 {
		return errors.New("match_rewards.rating_floor must be >= 0")
	}
	if cfg.StartingRating < cfg.RatingFloor {
		return errors.New("match_rewards.starting_rating must be >= rating_floor")
	}
	return nil
}

// ConsoleNavModule is one dashboard card / leaf link from platform_settings.console_nav.
type ConsoleNavModule struct {
	Title string `json:"title"`
	Href  string `json:"href"`
	Body  string `json:"body"`
}

// ConsoleNavItem is one accordion leaf under a console nav section (Trim nav_sections parity).
type ConsoleNavItem struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Href  string `json:"href"`
}

// ConsoleNavSection groups sidebar links (single-item sections render flat).
type ConsoleNavSection struct {
	ID    string           `json:"id"`
	Label string           `json:"label"`
	Items []ConsoleNavItem `json:"items"`
}

// ConsoleNavConfig is loaded from platform_settings.key = 'console_nav'.
type ConsoleNavConfig struct {
	Modules         []ConsoleNavModule  `json:"modules"`
	Sections        []ConsoleNavSection `json:"sections,omitempty"`
	BrandTitle      string              `json:"brand_title,omitempty"`
	TitleTemplate   string              `json:"title_template,omitempty"`
	MetaDescription string              `json:"meta_description,omitempty"`
	MetaSeparator   string              `json:"meta_separator,omitempty"`
	GraphqlEmpty    string              `json:"graphql_empty,omitempty"`
	Source          string              `json:"-"`
}

// EthiopiaPaymentModeOption is one domestic payment mode choice for console UI.
type EthiopiaPaymentModeOption struct {
	Mode    string `json:"mode"`
	Label   string `json:"label"`
	Enabled bool   `json:"enabled"`
}

// ClientEnumsConfig is loaded from platform_settings.key = 'client_enums'.
type ClientEnumsConfig struct {
	Roles                      []string                    `json:"roles"`
	ConsoleRoles               []string                    `json:"console_roles"`
	PublisherRoles             []string                    `json:"publisher_roles"`
	DefaultRole                string                      `json:"default_role"`
	TournamentStatuses         []string                    `json:"tournament_statuses"`
	CampaignStatuses           []string                    `json:"campaign_statuses"`
	CreativeTypes              []string                    `json:"creative_types"`
	DefaultCreativeType        string                      `json:"default_creative_type"`
	VideoCreativeType          string                      `json:"video_creative_type"`
	DefaultTournamentStatus    string                      `json:"default_tournament_status"`
	DefaultCampaignStatus      string                      `json:"default_campaign_status"`
	EnrollableTournamentStatus string                      `json:"enrollable_tournament_status"`
	ServableCampaignStatus     string                      `json:"servable_campaign_status"`
	ArchivedCampaignStatus     string                      `json:"archived_campaign_status"`
	ReopenCampaignStatus       string                      `json:"reopen_campaign_status"`
	EthiopiaPaymentModes       []EthiopiaPaymentModeOption `json:"ethiopia_payment_modes"`
	Unavailable                string                      `json:"unavailable,omitempty"`

	HostedEventStatuses                []string `json:"hosted_event_statuses"`
	HostedEventDefaultStatus           string   `json:"hosted_event_default_status"`
	HostedEventJoinableStatuses        []string `json:"hosted_event_joinable_statuses"`
	HostedEventFullStatus              string   `json:"hosted_event_full_status"`
	HostedEventLiveStatus              string   `json:"hosted_event_live_status"`
	HostedEventFinishedStatus          string   `json:"hosted_event_finished_status"`
	HostedEventCancelledStatus         string   `json:"hosted_event_cancelled_status"`
	HostedEventFormats                 []string `json:"hosted_event_formats"`
	HostedEventDefaultFormat           string   `json:"hosted_event_default_format"`
	HostedEventKnockoutFormat          string   `json:"hosted_event_knockout_format"`
	HostedEventRoundRobinFormat        string   `json:"hosted_event_round_robin_format"`
	HostedEventSwissFormat             string   `json:"hosted_event_swiss_format"`
	HostedEventGroupsKnockoutFormat    string   `json:"hosted_event_groups_knockout_format"`
	HostedEventArenaFormat             string   `json:"hosted_event_arena_format"`
	HostedEventBracketPhases           []string `json:"hosted_event_bracket_phases"`
	HostedEventPhaseKnockout           string   `json:"hosted_event_phase_knockout"`
	HostedEventPhaseRoundRobin         string   `json:"hosted_event_phase_round_robin"`
	HostedEventPhaseSwiss              string   `json:"hosted_event_phase_swiss"`
	HostedEventPhaseGroup              string   `json:"hosted_event_phase_group"`
	HostedEventPhaseArena              string   `json:"hosted_event_phase_arena"`
	HostedEventEntryStatuses           []string `json:"hosted_event_entry_statuses"`
	HostedEventEntryPending            string   `json:"hosted_event_entry_pending"`
	HostedEventEntryApproved           string   `json:"hosted_event_entry_approved"`
	HostedEventEntryRejected           string   `json:"hosted_event_entry_rejected"`
	HostedEventEntryKicked             string   `json:"hosted_event_entry_kicked"`
	HostedEventBracketStatuses         []string `json:"hosted_event_bracket_statuses"`
	HostedEventBracketPending          string   `json:"hosted_event_bracket_pending"`
	HostedEventBracketReady            string   `json:"hosted_event_bracket_ready"`
	HostedEventBracketLive             string   `json:"hosted_event_bracket_live"`
	HostedEventBracketDone             string   `json:"hosted_event_bracket_done"`
	HostedEventBracketBye              string   `json:"hosted_event_bracket_bye"`
	HostedEventVisibilities            []string `json:"hosted_event_visibilities"`
	HostedEventDefaultVisibility       string   `json:"hosted_event_default_visibility"`
	HostedEventPublicVisibility        string   `json:"hosted_event_public_visibility"`
	HostedEventPrivateVisibility       string   `json:"hosted_event_private_visibility"`
	HostedEventReportStatuses          []string `json:"hosted_event_report_statuses"`
	HostedEventReportOpenStatus        string   `json:"hosted_event_report_open_status"`
	HostedEventReportDismissedStatus   string   `json:"hosted_event_report_dismissed_status"`
	HostedEventReportDeactivatedStatus string   `json:"hosted_event_report_deactivated_status"`
	// Status label maps (DB-only display strings; fail closed when a status code lacks a label).
	HostedEventStatusLabels                    map[string]string `json:"hosted_event_status_labels"`
	HostedEventEntryStatusLabels               map[string]string `json:"hosted_event_entry_status_labels"`
	HostedEventBracketStatusLabels             map[string]string `json:"hosted_event_bracket_status_labels"`
	HostedEventReportStatusLabels              map[string]string `json:"hosted_event_report_status_labels"`
	HostedEventVisibilityLabels                map[string]string `json:"hosted_event_visibility_labels"`
	CampaignStatusLabels                       map[string]string `json:"campaign_status_labels"`
	TournamentStatusLabels                     map[string]string `json:"tournament_status_labels"`
	TournamentFormats                          []string          `json:"tournament_formats"`
	TournamentDefaultFormat                    string            `json:"tournament_default_format"`
	TournamentBracketStatuses                  []string          `json:"tournament_bracket_statuses"`
	TournamentBracketPending                   string            `json:"tournament_bracket_pending"`
	TournamentBracketReady                     string            `json:"tournament_bracket_ready"`
	TournamentBracketLive                      string            `json:"tournament_bracket_live"`
	TournamentBracketDone                      string            `json:"tournament_bracket_done"`
	TournamentBracketBye                       string            `json:"tournament_bracket_bye"`
	TournamentBracketStatusLabels              map[string]string `json:"tournament_bracket_status_labels"`
	CreativeTypeLabels                         map[string]string `json:"creative_type_labels"`
	CompetitionPrizePayoutStatuses             []string          `json:"competition_prize_payout_statuses"`
	CompetitionPrizePayoutPending              string            `json:"competition_prize_payout_pending"`
	CompetitionPrizePayoutSettled              string            `json:"competition_prize_payout_settled"`
	CompetitionPrizePayoutFailed               string            `json:"competition_prize_payout_failed"`
	CompetitionPrizePayoutCancelled            string            `json:"competition_prize_payout_cancelled"`
	CompetitionDisputeWindowHours              string            `json:"competition_dispute_window_hours"`
	CompetitionPrizeSettleIntervalMinutes      string            `json:"competition_prize_settle_interval_minutes"`
	CompetitionPrizeAutoSettle                 string            `json:"competition_prize_auto_settle"`
	CompetitionCheckInWindowHours              string            `json:"competition_check_in_window_hours,omitempty"`
	CompetitionMatchReadyTimeoutSeconds        string            `json:"competition_match_ready_timeout_seconds,omitempty"`
	CompetitionMatchReadyAutoForfeit           string            `json:"competition_match_ready_auto_forfeit,omitempty"`
	CompetitionArenaPointsWin                  string            `json:"competition_arena_points_win,omitempty"`
	CompetitionArenaPointsDraw                 string            `json:"competition_arena_points_draw,omitempty"`
	CompetitionArenaPointsLoss                 string            `json:"competition_arena_points_loss,omitempty"`
	CompetitionArenaStreakSecondWin            string            `json:"competition_arena_streak_second_win,omitempty"`
	CompetitionArenaStreakThirdPlusWin         string            `json:"competition_arena_streak_third_plus_win,omitempty"`
	CompetitionArenaDefaultDurationMinutes     string            `json:"competition_arena_default_duration_minutes,omitempty"`
	CompetitionArenaPairingModes               []string          `json:"competition_arena_pairing_modes,omitempty"`
	CompetitionArenaDefaultPairingMode         string            `json:"competition_arena_default_pairing_mode,omitempty"`
	CompetitionArenaAutoStart                  string            `json:"competition_arena_auto_start,omitempty"`
	CompetitionArenaPairIntervalSeconds        string            `json:"competition_arena_pair_interval_seconds,omitempty"`
	CompetitionArenaAllowJoinWhileLive         string            `json:"competition_arena_allow_join_while_live,omitempty"`
	CompetitionPayoutModes                     []string          `json:"competition_payout_modes,omitempty"`
	CompetitionPayoutModePlacesPercent         string            `json:"competition_payout_mode_places_percent,omitempty"`
	CompetitionPayoutModeScoreShare            string            `json:"competition_payout_mode_score_share,omitempty"`
	CompetitionPayoutModeDualPurse             string            `json:"competition_payout_mode_dual_purse,omitempty"`
	CompetitionDualPursePlacePercent           string            `json:"competition_dual_purse_place_percent,omitempty"`
	CompetitionDefaultPayoutModeKnockout       string            `json:"competition_default_payout_mode_knockout,omitempty"`
	CompetitionDefaultPayoutModeRoundRobin     string            `json:"competition_default_payout_mode_round_robin,omitempty"`
	CompetitionDefaultPayoutModeSwiss          string            `json:"competition_default_payout_mode_swiss,omitempty"`
	CompetitionDefaultPayoutModeGroupsKnockout string            `json:"competition_default_payout_mode_groups_knockout,omitempty"`
	CompetitionDefaultPayoutModeArena          string            `json:"competition_default_payout_mode_arena,omitempty"`
	CompetitionDefaultPlacePercent1            string            `json:"competition_default_place_percent_1,omitempty"`
	CompetitionDefaultPlacePercent2            string            `json:"competition_default_place_percent_2,omitempty"`
	CompetitionDefaultPlacePercent3            string            `json:"competition_default_place_percent_3,omitempty"`
	CompetitionStandingsPointsWin              string            `json:"competition_standings_points_win,omitempty"`
	CompetitionStandingsPointsDraw             string            `json:"competition_standings_points_draw,omitempty"`
	// WalletLedgerKinds must include every payments.LedgerKind* code (DB catalog; fail closed).
	WalletLedgerKinds []string `json:"wallet_ledger_kinds"`

	Source string `json:"-"`
}

// EventsCatalogFormat is one format row from platform_settings.events_catalog.
type EventsCatalogFormat struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	Enabled   bool   `json:"enabled"`
	SortOrder int    `json:"sort_order"`
}

// EventsCatalogSize is one host-size / fee row from platform_settings.events_catalog.
type EventsCatalogSize struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	Enabled   bool   `json:"enabled"`
	SortOrder int    `json:"sort_order"`
	// MaxPlayers is the enroll seat cap. nil = Unlimited open enroll (Arena-only).
	MaxPlayers *int `json:"max_players"`
	// HostFeeAmount/Currency are legacy mirrors of the Ethiopia pair (ads create-fee pattern).
	HostFeeAmount   float64 `json:"host_fee_amount"`
	HostFeeCurrency string  `json:"host_fee_currency"`
	// Ethiopia organizers pay this pair (currency locked to payment_currency.ethiopia).
	HostFeeEthiopiaAmount   float64 `json:"host_fee_ethiopia_amount"`
	HostFeeEthiopiaCurrency string  `json:"host_fee_ethiopia_currency"`
	// Non-Ethiopia organizers pay this pair (currency locked to payment_currency.global).
	HostFeeGlobalAmount   float64  `json:"host_fee_global_amount"`
	HostFeeGlobalCurrency string   `json:"host_fee_global_currency"`
	AllowedFormatIDs      []string `json:"allowed_format_ids"`
	// PublicHostFeeAmount is server-computed (geo base * public_host_fee_multiplier) for create UI.
	// Omitted from admin catalog PUT/GET storage; set only on public catalog responses.
	PublicHostFeeAmount float64 `json:"public_host_fee_amount,omitempty"`
}

// HasPlayerCap reports whether maxPlayers is a hard enroll seat limit (>= 2).
func HasPlayerCap(maxPlayers *int) bool {
	return maxPlayers != nil && *maxPlayers >= 2
}

// PlayerCapOrZero returns the seat cap for JoinWithCapacity (0 = uncapped).
// nil → 0 (Unlimited). Valid caps (>= 2) pass through. Present but under 2 is
// fail-closed as that tiny hard cap (never uncapped) so invalid rows cannot open-enroll.
func PlayerCapOrZero(maxPlayers *int) int {
	if maxPlayers == nil {
		return 0
	}
	if *maxPlayers < 2 {
		if *maxPlayers <= 0 {
			return 1
		}
		return *maxPlayers
	}
	return *maxPlayers
}

// ClassicSeatCeiling is the largest fixed classic bracket size from
// swiss_rounds_by_max_players keys (DB-driven; never invent a magic number).
func ClassicSeatCeiling(swissRoundsByMax map[string]int) int {
	max := 0
	for k := range swissRoundsByMax {
		n, err := strconv.Atoi(strings.TrimSpace(k))
		if err != nil || n < 2 {
			continue
		}
		if n > max {
			max = n
		}
	}
	return max
}

// SeatCapRequiresArenaOnly is true for null Unlimited or a high safety ceiling
// above the DB classic seat ceiling (must stay Arena-only).
// Present max under 2 is invalid (not Unlimited) and must be rejected at write.
func SeatCapRequiresArenaOnly(maxPlayers *int, swissRoundsByMax map[string]int) bool {
	if maxPlayers == nil {
		return true
	}
	if !HasPlayerCap(maxPlayers) {
		return false
	}
	ceiling := ClassicSeatCeiling(swissRoundsByMax)
	if ceiling < 2 {
		return false
	}
	return *maxPlayers > ceiling
}

// EventsCatalogConfig is loaded from platform_settings.key = 'events_catalog'.
type EventsCatalogConfig struct {
	JoinCodeLength                int                   `json:"join_code_length"`
	JoinCodeAlphabet              string                `json:"join_code_alphabet"`
	AutoApproveDefault            bool                  `json:"auto_approve_default"`
	ForceAutoApprove              bool                  `json:"force_auto_approve"`
	PublicHostFeeMultiplier       float64               `json:"public_host_fee_multiplier"`
	DefaultVisibility             string                `json:"default_visibility"`
	ReportReasonCodes             []string              `json:"report_reason_codes"`
	ReportReasonLabels            map[string]string     `json:"report_reason_labels"`
	EntryFeeCommissionPercent     float64               `json:"entry_fee_commission_percent"`
	SharePathTemplate             string                `json:"share_path_template"`
	QRFilenamePrefix              string                `json:"qr_filename_prefix"`
	MinPlayersToStart             map[string]int        `json:"min_players_to_start"`
	SwissRoundsByMaxPlayers       map[string]int        `json:"swiss_rounds_by_max_players"`
	GroupsKnockoutTargetGroupSize int                   `json:"groups_knockout_target_group_size"`
	GroupsKnockoutAdvancePerGroup int                   `json:"groups_knockout_advance_per_group"`
	Formats                       []EventsCatalogFormat `json:"formats"`
	Sizes                         []EventsCatalogSize   `json:"sizes"`
	Source                        string                `json:"-"`
}

// ClientNavLink is one nav entry from platform_settings.client_nav.
type ClientNavLink struct {
	Title        string `json:"title"`
	Href         string `json:"href,omitempty"`
	RouteKey     string `json:"route_key"`
	Body         string `json:"body,omitempty"`
	BodyWhenVsAI string `json:"body_when_vs_ai,omitempty"`
	CTA          string `json:"cta,omitempty"`
}

// ClientNavBottomNav is nested bottom_nav from platform_settings.client_nav.
type ClientNavBottomNav struct {
	Player []ClientNavLink `json:"player"`
	Mobile []ClientNavLink `json:"mobile"`
	Ads    []ClientNavLink `json:"ads"`
	Events []ClientNavLink `json:"events"`
}

// ClientNavConfig is loaded from platform_settings.key = 'client_nav'.
type ClientNavConfig struct {
	Player                      []ClientNavLink    `json:"player"`
	Ads                         []ClientNavLink    `json:"ads"`
	Events                      []ClientNavLink    `json:"events"`
	Marketing                   []ClientNavLink    `json:"marketing"`
	Mobile                      []ClientNavLink    `json:"mobile"`
	Dashboard                   []ClientNavLink    `json:"dashboard"`
	BottomNav                   ClientNavBottomNav `json:"bottom_nav"`
	MobileNavUnavailable        string             `json:"mobile_nav_unavailable,omitempty"`
	BrandName                   string             `json:"brand_name,omitempty"`
	AdsBrandName                string             `json:"ads_brand_name,omitempty"`
	EventsBrandName             string             `json:"events_brand_name,omitempty"`
	EventsNavUnavailable        string             `json:"events_nav_unavailable,omitempty"`
	DashboardPageTitle          string             `json:"dashboard_page_title,omitempty"`
	DashboardPageBlurb          string             `json:"dashboard_page_blurb,omitempty"`
	ProfileLoadFailed           string             `json:"profile_load_failed,omitempty"`
	DashboardUnavailable        string             `json:"dashboard_unavailable,omitempty"`
	DashboardHistoryTitle       string             `json:"dashboard_history_title,omitempty"`
	DashboardHistoryEmpty       string             `json:"dashboard_history_empty,omitempty"`
	DashboardHistoryUnavailable string             `json:"dashboard_history_unavailable,omitempty"`
	DashboardProfileAction      string             `json:"dashboard_profile_action,omitempty"`
	DashboardProfileHref        string             `json:"dashboard_profile_href,omitempty"`
	DashboardPlayAction         string             `json:"dashboard_play_action,omitempty"`
	DashboardPlayHref           string             `json:"dashboard_play_href,omitempty"`
	DashboardWinRateLabel       string             `json:"dashboard_win_rate_label,omitempty"`
	DashboardPercentSuffix      string             `json:"dashboard_percent_suffix,omitempty"`
	DashboardMatchesSuffix      string             `json:"dashboard_matches_suffix,omitempty"`
	DashboardMatchesJoiner      string             `json:"dashboard_matches_joiner,omitempty"`
	DashboardRecentResultsTitle string             `json:"dashboard_recent_results_title,omitempty"`
	DashboardTransactionsAction string             `json:"dashboard_transactions_action,omitempty"`
	DashboardTransactionsHref   string             `json:"dashboard_transactions_href,omitempty"`
	DashboardFindMatchAction    string             `json:"dashboard_find_match_action,omitempty"`
	DashboardWalletHref         string             `json:"dashboard_wallet_href,omitempty"`
	DashboardColResult          string             `json:"dashboard_col_result,omitempty"`
	DashboardColMode            string             `json:"dashboard_col_mode,omitempty"`
	DashboardColMoves           string             `json:"dashboard_col_moves,omitempty"`
	DashboardColDate            string             `json:"dashboard_col_date,omitempty"`
	SettingsSessionLabel        string             `json:"settings_session_label,omitempty"`
	SettingsUnavailable         string             `json:"settings_unavailable,omitempty"`
	MarketingHeroEyebrow        string             `json:"marketing_hero_eyebrow,omitempty"`
	MarketingHeroBlurb          string             `json:"marketing_hero_blurb,omitempty"`
	MarketingFooterText         string             `json:"marketing_footer_text,omitempty"`
	SiteTitleDefault            string             `json:"site_title_default,omitempty"`
	SiteTitleTemplate           string             `json:"site_title_template,omitempty"`
	SiteDescription             string             `json:"site_description,omitempty"`
	GraphqlEmpty                string             `json:"graphql_empty,omitempty"`
	Source                      string             `json:"-"`
}

// FeatureFlagToggle is one console toggle from platform_settings.feature_flag_catalog.
type FeatureFlagToggle struct {
	Key         string `json:"key"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Kind        string `json:"kind"` // boolean | mode
	StateField  string `json:"state_field,omitempty"`
}

// FeatureFlagCatalogConfig is loaded from platform_settings.key = 'feature_flag_catalog'.
type FeatureFlagCatalogConfig struct {
	Toggles         []FeatureFlagToggle `json:"toggles"`
	AIDepthsFlagKey string              `json:"ai_depths_flag_key"`
	CashRmgFlagKey  string              `json:"cash_rmg_flag_key"`
	Source          string              `json:"-"`
}

type SettingsStore struct {
	db           *db.Handle
	mu           sync.RWMutex
	cur          CurrencyConfig
	geo          GeoPaymentConfig
	telegramOps  TelegramOpsBotConfig
	mod          ModerationConfig
	levels       XPLevelsConfig
	clock        MatchClockConfig
	ads          AdPricingConfig
	playback     AdPlaybackConfig
	adChrome     AdRuntimeChromeConfig
	adChromeDoc  map[string]string
	adPlayer     AdPlayerChromeConfig
	rbacChrome   RBACChromeConfig
	board        BoardRulesConfig
	rewards      MatchRewardsConfig
	nav          ConsoleNavConfig
	enums        ClientEnumsConfig
	cNav         ClientNavConfig
	ffCat        FeatureFlagCatalogConfig
	eventsCat    EventsCatalogConfig
	authGateDoc  map[string]string
	otpChromeDoc map[string]string
	// Soft TTL so pause_enabled / pause_duration_seconds (and other match_clock
	// knobs) pick up admin writes from another API replica without a restart.
	progressionLoadedAt time.Time
}

func NewSettingsStore(handle *db.Handle) *SettingsStore {
	s := &SettingsStore{
		db: handle,
		cur: CurrencyConfig{
			Source: "unavailable",
		},
		geo: GeoPaymentConfig{
			Source: "unavailable",
		},
		telegramOps: TelegramOpsBotConfig{
			Source: "unavailable",
		},
		mod: ModerationConfig{
			Source: "unavailable",
		},
		levels:     XPLevelsConfig{Source: "unavailable"},
		clock:      MatchClockConfig{Source: "unavailable"},
		ads:        AdPricingConfig{Source: "unavailable"},
		playback:   AdPlaybackConfig{Source: "unavailable"},
		adChrome:   AdRuntimeChromeConfig{Source: "unavailable"},
		adPlayer:   AdPlayerChromeConfig{Source: "unavailable"},
		rbacChrome: RBACChromeConfig{Source: "unavailable"},
		board:      BoardRulesConfig{Source: "unavailable"},
		rewards:    MatchRewardsConfig{Source: "unavailable"},
		nav:        ConsoleNavConfig{Source: "unavailable"},
		enums:      ClientEnumsConfig{Source: "unavailable"},
		cNav:       ClientNavConfig{Source: "unavailable"},
		ffCat:      FeatureFlagCatalogConfig{Source: "unavailable"},
		eventsCat:  EventsCatalogConfig{Source: "unavailable"},
	}
	_ = s.Reload(context.Background())
	_ = s.ReloadGeoPayment(context.Background())
	_ = s.ReloadTelegramOpsBot(context.Background())
	_ = s.ReloadModeration(context.Background())
	_ = s.ReloadProgression(context.Background())
	_ = s.ReloadAdPricing(context.Background())
	_ = s.ReloadAdPlayback(context.Background())
	_ = s.ReloadAdRuntimeChrome(context.Background())
	_ = s.ReloadAdPlayerChrome(context.Background())
	_ = s.ReloadRBACChrome(context.Background())
	_ = s.ReloadBoardRules(context.Background())
	_ = s.ReloadConsoleNav(context.Background())
	_ = s.ReloadClientEnums(context.Background())
	_ = s.ReloadClientNav(context.Background())
	_ = s.ReloadFeatureFlagCatalog(context.Background())
	_ = s.ReloadEventsCatalog(context.Background())
	_ = s.ReloadAuthGateChrome(context.Background())
	_ = s.ReloadOTPChrome(context.Background())
	return s
}

// ReloadOTPChrome caches otp_chrome API error keys for OTP handlers and gate middleware.
func (s *SettingsStore) ReloadOTPChrome(ctx context.Context) error {
	if s.db == nil || !s.db.Ready() {
		return nil
	}
	row := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'otp_chrome'`)
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		return err
	}
	var rawDoc map[string]any
	if err := json.Unmarshal(raw, &rawDoc); err != nil {
		return err
	}
	required := []string{
		"err_unauthorized", "err_not_required", "err_challenge_required",
		"err_verification_required", "err_verification_unavailable",
		"invalid_code", "verification_start_failed", "start_failed",
	}
	doc := map[string]string{}
	for _, k := range required {
		v, _ := rawDoc[k].(string)
		v = strings.TrimSpace(v)
		if v == "" {
			return fmt.Errorf("otp_chrome incomplete (%s)", k)
		}
		doc[k] = v
	}
	for k, v := range rawDoc {
		if s, ok := v.(string); ok {
			if t := strings.TrimSpace(s); t != "" {
				doc[k] = t
			}
		}
	}
	s.mu.Lock()
	s.otpChromeDoc = doc
	s.mu.Unlock()
	return nil
}

// OTPChromeString returns a DB otp_chrome string by key (fail closed empty).
func (s *SettingsStore) OTPChromeString(key string) string {
	if s == nil {
		return ""
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return ""
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return strings.TrimSpace(s.otpChromeDoc[key])
}

// ReloadAuthGateChrome loads auth_providers gate + OAuth API error strings.
func (s *SettingsStore) ReloadAuthGateChrome(ctx context.Context) error {
	if s.db == nil || !s.db.Ready() {
		return nil
	}
	row := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'auth_providers'`)
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		return err
	}
	var rawDoc map[string]any
	if err := json.Unmarshal(raw, &rawDoc); err != nil {
		return err
	}
	required := []string{
		"err_unauthorized", "err_forbidden",
		"login_auth_providers_unavailable", "login_missing_supabase_env",
		"login_oauth_email_missing", "login_provider_disabled_message",
		"err_access_token_required", "err_invalid_oauth_token",
		"err_email_policy_unavailable", "err_oauth_email_denied",
		"err_default_role_unavailable", "err_username_unavailable",
		"err_account_create_failed", "err_sign_in_incomplete",
		"err_account_disabled", "err_token_issue_failed",
		"guest_username", "err_auth_unavailable",
		"err_invalid_json", "err_e2e_identity_required",
	}
	doc := map[string]string{}
	for _, k := range required {
		v, _ := rawDoc[k].(string)
		v = strings.TrimSpace(v)
		if v == "" {
			return fmt.Errorf("auth_providers gate chrome incomplete (%s)", k)
		}
		doc[k] = v
	}
	for k, v := range rawDoc {
		if s, ok := v.(string); ok {
			if t := strings.TrimSpace(s); t != "" {
				doc[k] = t
			}
		}
	}
	s.mu.Lock()
	s.authGateDoc = doc
	s.mu.Unlock()
	return nil
}

// AuthProvidersChromeString returns a DB auth_providers string by key (fail closed empty).
func (s *SettingsStore) AuthProvidersChromeString(key string) string {
	if s == nil {
		return ""
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return ""
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return strings.TrimSpace(s.authGateDoc[key])
}

// AuthUnauthorized implements auth.GateChrome (DB auth_providers.err_unauthorized).
func (s *SettingsStore) AuthUnauthorized() string {
	return s.AuthProvidersChromeString("err_unauthorized")
}

// AuthForbidden implements auth.GateChrome (DB auth_providers.err_forbidden).
func (s *SettingsStore) AuthForbidden() string {
	return s.AuthProvidersChromeString("err_forbidden")
}

func (s *SettingsStore) Reload(ctx context.Context) error {
	if s.db == nil || !s.db.Ready() {
		return nil
	}
	row := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'currency'`)
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		return err
	}
	var cfg CurrencyConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	if cfg.Global == "" || cfg.Ethiopia == "" || len(cfg.Supported) == 0 {
		return errIncompleteCurrency
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.cur = cfg
	s.mu.Unlock()
	return nil
}

func (s *SettingsStore) Currency() CurrencyConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cp := s.cur
	cp.Supported = append([]string{}, s.cur.Supported...)
	return cp
}

func (s *SettingsStore) SetCurrency(ctx context.Context, cfg CurrencyConfig) error {
	if cfg.Global == "" || cfg.Ethiopia == "" {
		return errIncompleteCurrency
	}
	if len(cfg.Supported) == 0 {
		cfg.Supported = []string{cfg.Global, cfg.Ethiopia}
	}
	raw, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	if s.db != nil && s.db.Ready() {
		_, err := s.db.Pool.Exec(ctx, `
			INSERT INTO platform_settings (key, value, updated_at)
			VALUES ('currency', $1::jsonb, NOW())
			ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
		`, string(raw))
		if err != nil {
			return err
		}
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.cur = cfg
	s.mu.Unlock()
	return nil
}

func (s *SettingsStore) ReloadGeoPayment(ctx context.Context) error {
	if s.db == nil || !s.db.Ready() {
		return nil
	}
	row := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'geo_payment'`)
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		return err
	}
	var cfg GeoPaymentConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	cc := normalizeCC(cfg.EthiopiaCountry)
	if cc == "" {
		return errors.New("geo_payment ethiopia_country required")
	}
	cfg.EthiopiaCountry = cc
	cfg.PrivateDefaultCity = strings.TrimSpace(cfg.PrivateDefaultCity)
	if cfg.PrivateDefaultCity == "" {
		return errors.New("geo_payment private_default_city required")
	}
	cfg.PrivateDefaultRegion = strings.TrimSpace(cfg.PrivateDefaultRegion)
	cfg.Source = "database"
	s.mu.Lock()
	s.geo = cfg
	s.mu.Unlock()
	return nil
}

func (s *SettingsStore) GeoPayment() GeoPaymentConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.geo
}

// SetGeoPayment persists domestic ISO + localhost invent city/region (DB only).
func (s *SettingsStore) SetGeoPayment(ctx context.Context, cfg GeoPaymentConfig) error {
	cc := normalizeCC(cfg.EthiopiaCountry)
	if cc == "" {
		return errors.New("geo_payment ethiopia_country required")
	}
	city := strings.TrimSpace(cfg.PrivateDefaultCity)
	if city == "" {
		return errors.New("geo_payment private_default_city required")
	}
	region := strings.TrimSpace(cfg.PrivateDefaultRegion)
	out := GeoPaymentConfig{
		EthiopiaCountry:      cc,
		PrivateDefaultCity:   city,
		PrivateDefaultRegion: region,
		Source:               "database",
	}
	raw, err := json.Marshal(map[string]any{
		"ethiopia_country":       out.EthiopiaCountry,
		"private_default_city":   out.PrivateDefaultCity,
		"private_default_region": out.PrivateDefaultRegion,
	})
	if err != nil {
		return err
	}
	if s.db == nil || !s.db.Ready() {
		return errors.New("database required to persist geo_payment")
	}
	if _, err := s.db.Pool.Exec(ctx, `
		INSERT INTO platform_settings (key, value, updated_at)
		VALUES ('geo_payment', $1::jsonb, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`, string(raw)); err != nil {
		return err
	}
	s.mu.Lock()
	s.geo = out
	s.mu.Unlock()
	return nil
}

// EthiopiaCountry returns the DB-configured ISO code for domestic payment routing.
// Empty when geo_payment is unavailable (callers must fail closed).
func (s *SettingsStore) EthiopiaCountry() string {
	cfg := s.GeoPayment()
	if cfg.Source != "database" {
		return ""
	}
	return cfg.EthiopiaCountry
}

func telegramOpsRequiredString(v, field string) (string, error) {
	out := strings.TrimSpace(v)
	if out == "" {
		return "", fmt.Errorf("telegram_ops_bot.%s required", field)
	}
	return out, nil
}

// ReloadTelegramOpsBot loads platform_settings.telegram_ops_bot (fail closed when missing).
func (s *SettingsStore) ReloadTelegramOpsBot(ctx context.Context) error {
	if s.db == nil || !s.db.Ready() {
		return nil
	}
	row := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'telegram_ops_bot'`)
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		return err
	}
	var cfg TelegramOpsBotConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	cfg.BotServiceURL = strings.TrimSpace(cfg.BotServiceURL)
	cfg.BotAPIKey = strings.TrimSpace(cfg.BotAPIKey)
	cfg.ReviewerUserID = strings.TrimSpace(cfg.ReviewerUserID)
	if cfg.NotifyTimeoutMS <= 0 {
		return errors.New("telegram_ops_bot.notify_timeout_ms required")
	}
	if _, err := telegramOpsRequiredString(cfg.NotifyReceiptType, "notify_receipt_type"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.NotifyPayoutType, "notify_payout_type"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ProductLabel, "product_label"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ReceiptHubTitle, "receipt_hub_title"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ReceiptHubEmpty, "receipt_hub_empty"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ReceiptDetailTitle, "receipt_detail_title"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ReceiptNotifyTitle, "receipt_notify_title"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.PayoutHubTitle, "payout_hub_title"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.PayoutHubEmpty, "payout_hub_empty"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.PayoutDetailTitle, "payout_detail_title"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.PayoutNotifyTitle, "payout_notify_title"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.BtnViewDetails, "btn_view_details"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.BtnViewHub, "btn_view_hub"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.BtnApprove, "btn_approve"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.BtnReject, "btn_reject"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.BtnMarkPaid, "btn_mark_paid"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.BtnBackHub, "btn_back_hub"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.BtnClose, "btn_close"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ErrBotNotConfigured, "err_bot_not_configured"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ErrUnauthorizedBot, "err_unauthorized_bot"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ErrReviewerMissing, "err_reviewer_missing"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.MenuReceiptsLabel, "menu_receipts_label"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.MenuPayoutsLabel, "menu_payouts_label"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.MenuReceiptsLabelAm, "menu_receipts_label_am"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.MenuPayoutsLabelAm, "menu_payouts_label_am"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.UnknownUserLabel, "unknown_user_label"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.NALabel, "na_label"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.RejectReasonPromptReceipt, "reject_reason_prompt_receipt"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.RejectReasonPromptPayout, "reject_reason_prompt_payout"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.RejectCancelled, "reject_cancelled"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ApprovedToast, "approved_toast"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.RejectedToast, "rejected_toast"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.PaidToast, "paid_toast"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ErrFetchFailed, "err_fetch_failed"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ErrNotConfiguredEnv, "err_not_configured_env"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.HubFoundTemplate, "hub_found_template"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.AdminBackLabel, "admin_back_label"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ErrNotAllowed, "err_not_allowed"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ErrBadCallback, "err_bad_callback"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.UserFallbackTemplate, "user_fallback_template"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.NoteApprovedByTemplate, "note_approved_by_template"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.NotePaidByTemplate, "note_paid_by_template"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ReviewNoteApprovedPrefix, "review_note_approved_prefix"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ReviewNoteRejectedPrefix, "review_note_rejected_prefix"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ReviewNotePaidPrefix, "review_note_paid_prefix"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ReviewNoteTelegramIDTpl, "review_note_telegram_id_template"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ReviewNoteReasonTemplate, "review_note_reason_template"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ReviewNoteJoiner, "review_note_joiner"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ReceiptPendingStatus, "receipt_pending_status"); err != nil {
		return err
	}
	if cfg.HTTPClientTimeoutSeconds <= 0 {
		return errors.New("telegram_ops_bot.http_client_timeout_seconds required")
	}
	if _, err := telegramOpsRequiredString(cfg.ErrBotNotInitialized, "err_bot_not_initialized"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ErrUnavailable, "err_unavailable"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ErrBotRequestFailed, "err_bot_request_failed"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ErrPaymentsUnavailable, "err_payments_unavailable"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ErrPayoutsUnavailable, "err_payouts_unavailable"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ErrReceiptNotFound, "err_receipt_not_found"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ErrPayoutNotFound, "err_payout_not_found"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ErrInvalidPayoutTransition, "err_invalid_payout_transition"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ErrInvalidPayoutStatus, "err_invalid_payout_status"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ErrRefundFailedPrefix, "err_refund_failed_prefix"); err != nil {
		return err
	}
	if cfg.HubListLimit <= 0 {
		return errors.New("telegram_ops_bot.hub_list_limit required")
	}
	if _, err := telegramOpsRequiredString(cfg.ErrReceiptReviewFailed, "err_receipt_review_failed"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ErrPayoutReviewFailed, "err_payout_review_failed"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ErrRejectReasonRequired, "err_reject_reason_required"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ErrNoTelegramAdmins, "err_no_telegram_admins"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.RejectKeyboardLang, "reject_keyboard_lang"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.HubHeaderMDTemplate, "hub_header_md_template"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.HubEmptyMDTemplate, "hub_empty_md_template"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.HubReceiptButtonTemplate, "hub_receipt_button_template"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.HubPayoutButtonTemplate, "hub_payout_button_template"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ReceiptDetailHTMLTemplate, "receipt_detail_html_template"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.PayoutDetailHTMLTemplate, "payout_detail_html_template"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ReceiptNotifyHTMLTemplate, "receipt_notify_html_template"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.PayoutNotifyHTMLTemplate, "payout_notify_html_template"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ScreenshotLineTemplate, "screenshot_line_template"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ButtonTruncateSuffix, "button_truncate_suffix"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ActionResultMDTemplate, "action_result_md_template"); err != nil {
		return err
	}
	if _, err := telegramOpsRequiredString(cfg.ActionRejectResultMDTemplate, "action_reject_result_md_template"); err != nil {
		return err
	}
	if cfg.Enabled {
		if strings.TrimSpace(cfg.BotServiceURL) == "" {
			return errors.New("telegram_ops_bot.bot_service_url required when enabled")
		}
		if strings.TrimSpace(cfg.BotAPIKey) == "" {
			return errors.New("telegram_ops_bot.bot_api_key required when enabled")
		}
		if strings.TrimSpace(cfg.ReviewerUserID) == "" {
			return errors.New("telegram_ops_bot.reviewer_user_id required when enabled")
		}
	}
	// Heal dead reviewer (e.g. HardDelete raced before settings scrub): Ready must not lie.
	if cfg.ReviewerUserID != "" {
		alive, err := s.telegramOpsReviewerExists(ctx, cfg.ReviewerUserID)
		if err != nil {
			return fmt.Errorf("telegram_ops_bot reviewer check: %w", err)
		}
		if !alive {
			if s.db == nil || !s.db.Ready() {
				return errors.New("telegram_ops_bot heal dead reviewer: database unavailable")
			}
			if _, execErr := s.db.Pool.Exec(ctx, `
				UPDATE platform_settings
				SET value = jsonb_set(COALESCE(value, '{}'::jsonb), '{reviewer_user_id}', '""'::jsonb),
				    updated_at = NOW()
				WHERE key = 'telegram_ops_bot'
				  AND NULLIF(trim(value->>'reviewer_user_id'), '') = $1
			`, cfg.ReviewerUserID); execErr != nil {
				return fmt.Errorf("telegram_ops_bot heal dead reviewer: %w", execErr)
			}
			cfg.ReviewerUserID = ""
		}
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.telegramOps = cfg
	s.mu.Unlock()
	return nil
}

func (s *SettingsStore) telegramOpsReviewerExists(ctx context.Context, id string) (bool, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return false, nil
	}
	// Memory/test mode (no DB): skip EXISTS - Set/Reload paths that need DB already require it.
	if s.db == nil || !s.db.Ready() {
		return true, nil
	}
	var exists bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM users WHERE id = $1::uuid)
	`, id).Scan(&exists)
	return exists, err
}

// TelegramOpsReviewerAlive reports whether reviewer_user_id still exists in users (FK-safe).
func (s *SettingsStore) TelegramOpsReviewerAlive(ctx context.Context, id string) (bool, error) {
	return s.telegramOpsReviewerExists(ctx, id)
}

// TelegramOpsBot returns the cached telegram_ops_bot config.
func (s *SettingsStore) TelegramOpsBot() TelegramOpsBotConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.telegramOps
}

// SetTelegramOpsBot persists telegram_ops_bot.
// Empty bot_api_key / bot_service_url / reviewer_user_id keep previous DB values (safe disable/re-enable).
// Non-empty reviewer_user_id must reference an existing users.id (reviewed_by FK).
func (s *SettingsStore) SetTelegramOpsBot(ctx context.Context, cfg TelegramOpsBotConfig) error {
	if s.db == nil || !s.db.Ready() {
		return errors.New("database required to persist telegram_ops_bot")
	}
	// Always reload DB before merge so migrate seeds are never clobbered by stale memory.
	if err := s.ReloadTelegramOpsBot(ctx); err != nil {
		return err
	}
	cur := s.TelegramOpsBot()
	cfg.BotServiceURL = strings.TrimSpace(cfg.BotServiceURL)
	cfg.BotAPIKey = strings.TrimSpace(cfg.BotAPIKey)
	cfg.ReviewerUserID = strings.TrimSpace(cfg.ReviewerUserID)
	if cfg.BotAPIKey == "" {
		cfg.BotAPIKey = strings.TrimSpace(cur.BotAPIKey)
	}
	if cfg.BotServiceURL == "" {
		cfg.BotServiceURL = strings.TrimSpace(cur.BotServiceURL)
	}
	if cfg.ReviewerUserID == "" {
		cfg.ReviewerUserID = strings.TrimSpace(cur.ReviewerUserID)
	}
	if cfg.NotifyTimeoutMS <= 0 {
		if cur.NotifyTimeoutMS > 0 {
			cfg.NotifyTimeoutMS = cur.NotifyTimeoutMS
		} else {
			return errors.New("telegram_ops_bot.notify_timeout_ms required")
		}
	}
	// Preserve chrome / notify type strings from DB when admin save only sends ops fields.
	mergeTelegramOpsChrome(&cfg, cur)
	if cfg.ReviewerUserID != "" {
		exists, err := s.telegramOpsReviewerExists(ctx, cfg.ReviewerUserID)
		if err != nil {
			return errors.New("telegram_ops_bot.reviewer_user_id invalid")
		}
		if !exists {
			return errors.New("telegram_ops_bot.reviewer_user_id not found")
		}
	}
	if cfg.Enabled {
		if cfg.BotServiceURL == "" {
			return errors.New("telegram_ops_bot.bot_service_url required when enabled")
		}
		if cfg.BotAPIKey == "" {
			return errors.New("telegram_ops_bot.bot_api_key required when enabled")
		}
		if cfg.ReviewerUserID == "" {
			return errors.New("telegram_ops_bot.reviewer_user_id required when enabled")
		}
	}
	raw, err := json.Marshal(map[string]any{
		"enabled":                          cfg.Enabled,
		"bot_service_url":                  cfg.BotServiceURL,
		"bot_api_key":                      cfg.BotAPIKey,
		"reviewer_user_id":                 cfg.ReviewerUserID,
		"notify_timeout_ms":                cfg.NotifyTimeoutMS,
		"notify_receipt_type":              cfg.NotifyReceiptType,
		"notify_payout_type":               cfg.NotifyPayoutType,
		"product_label":                    cfg.ProductLabel,
		"receipt_hub_title":                cfg.ReceiptHubTitle,
		"receipt_hub_empty":                cfg.ReceiptHubEmpty,
		"receipt_detail_title":             cfg.ReceiptDetailTitle,
		"receipt_notify_title":             cfg.ReceiptNotifyTitle,
		"payout_hub_title":                 cfg.PayoutHubTitle,
		"payout_hub_empty":                 cfg.PayoutHubEmpty,
		"payout_detail_title":              cfg.PayoutDetailTitle,
		"payout_notify_title":              cfg.PayoutNotifyTitle,
		"btn_view_details":                 cfg.BtnViewDetails,
		"btn_view_hub":                     cfg.BtnViewHub,
		"btn_approve":                      cfg.BtnApprove,
		"btn_reject":                       cfg.BtnReject,
		"btn_mark_paid":                    cfg.BtnMarkPaid,
		"btn_back_hub":                     cfg.BtnBackHub,
		"btn_close":                        cfg.BtnClose,
		"err_bot_not_configured":           cfg.ErrBotNotConfigured,
		"err_unauthorized_bot":             cfg.ErrUnauthorizedBot,
		"err_reviewer_missing":             cfg.ErrReviewerMissing,
		"menu_receipts_label":              cfg.MenuReceiptsLabel,
		"menu_payouts_label":               cfg.MenuPayoutsLabel,
		"menu_receipts_label_am":           cfg.MenuReceiptsLabelAm,
		"menu_payouts_label_am":            cfg.MenuPayoutsLabelAm,
		"unknown_user_label":               cfg.UnknownUserLabel,
		"na_label":                         cfg.NALabel,
		"reject_reason_prompt_receipt":     cfg.RejectReasonPromptReceipt,
		"reject_reason_prompt_payout":      cfg.RejectReasonPromptPayout,
		"reject_cancelled":                 cfg.RejectCancelled,
		"approved_toast":                   cfg.ApprovedToast,
		"rejected_toast":                   cfg.RejectedToast,
		"paid_toast":                       cfg.PaidToast,
		"err_fetch_failed":                 cfg.ErrFetchFailed,
		"err_not_configured_env":           cfg.ErrNotConfiguredEnv,
		"hub_found_template":               cfg.HubFoundTemplate,
		"admin_back_label":                 cfg.AdminBackLabel,
		"err_not_allowed":                  cfg.ErrNotAllowed,
		"err_bad_callback":                 cfg.ErrBadCallback,
		"user_fallback_template":           cfg.UserFallbackTemplate,
		"note_approved_by_template":        cfg.NoteApprovedByTemplate,
		"note_paid_by_template":            cfg.NotePaidByTemplate,
		"review_note_approved_prefix":      cfg.ReviewNoteApprovedPrefix,
		"review_note_rejected_prefix":      cfg.ReviewNoteRejectedPrefix,
		"review_note_paid_prefix":          cfg.ReviewNotePaidPrefix,
		"review_note_telegram_id_template": cfg.ReviewNoteTelegramIDTpl,
		"review_note_reason_template":      cfg.ReviewNoteReasonTemplate,
		"review_note_joiner":               cfg.ReviewNoteJoiner,
		"receipt_pending_status":           cfg.ReceiptPendingStatus,
		"http_client_timeout_seconds":      cfg.HTTPClientTimeoutSeconds,
		"err_bot_not_initialized":          cfg.ErrBotNotInitialized,
		"err_unavailable":                  cfg.ErrUnavailable,
		"err_bot_request_failed":           cfg.ErrBotRequestFailed,
		"err_payments_unavailable":         cfg.ErrPaymentsUnavailable,
		"err_payouts_unavailable":          cfg.ErrPayoutsUnavailable,
		"err_receipt_not_found":            cfg.ErrReceiptNotFound,
		"err_payout_not_found":             cfg.ErrPayoutNotFound,
		"err_invalid_payout_transition":    cfg.ErrInvalidPayoutTransition,
		"err_invalid_payout_status":        cfg.ErrInvalidPayoutStatus,
		"err_refund_failed_prefix":         cfg.ErrRefundFailedPrefix,
		"hub_list_limit":                   cfg.HubListLimit,
		"err_receipt_review_failed":        cfg.ErrReceiptReviewFailed,
		"err_payout_review_failed":         cfg.ErrPayoutReviewFailed,
		"err_reject_reason_required":       cfg.ErrRejectReasonRequired,
		"err_no_telegram_admins":           cfg.ErrNoTelegramAdmins,
		"reject_keyboard_lang":             cfg.RejectKeyboardLang,
		"hub_header_md_template":           cfg.HubHeaderMDTemplate,
		"hub_empty_md_template":            cfg.HubEmptyMDTemplate,
		"hub_receipt_button_template":      cfg.HubReceiptButtonTemplate,
		"hub_payout_button_template":       cfg.HubPayoutButtonTemplate,
		"receipt_detail_html_template":     cfg.ReceiptDetailHTMLTemplate,
		"payout_detail_html_template":      cfg.PayoutDetailHTMLTemplate,
		"receipt_notify_html_template":     cfg.ReceiptNotifyHTMLTemplate,
		"payout_notify_html_template":      cfg.PayoutNotifyHTMLTemplate,
		"screenshot_line_template":         cfg.ScreenshotLineTemplate,
		"button_truncate_suffix":           cfg.ButtonTruncateSuffix,
		"action_result_md_template":        cfg.ActionResultMDTemplate,
		"action_reject_result_md_template": cfg.ActionRejectResultMDTemplate,
	})
	if err != nil {
		return err
	}
	// Fail closed: never persist a row that Reload would reject (avoids clobber).
	var check TelegramOpsBotConfig
	if err := json.Unmarshal(raw, &check); err != nil {
		return err
	}
	check.BotServiceURL = strings.TrimSpace(check.BotServiceURL)
	check.BotAPIKey = strings.TrimSpace(check.BotAPIKey)
	check.ReviewerUserID = strings.TrimSpace(check.ReviewerUserID)
	if check.NotifyTimeoutMS <= 0 {
		return errors.New("telegram_ops_bot.notify_timeout_ms required")
	}
	if check.HTTPClientTimeoutSeconds <= 0 {
		return errors.New("telegram_ops_bot.http_client_timeout_seconds required")
	}
	if check.HubListLimit <= 0 {
		return errors.New("telegram_ops_bot.hub_list_limit required")
	}
	if strings.TrimSpace(check.ErrReceiptReviewFailed) == "" || strings.TrimSpace(check.ErrPayoutReviewFailed) == "" ||
		strings.TrimSpace(check.ErrRejectReasonRequired) == "" || strings.TrimSpace(check.ErrNoTelegramAdmins) == "" ||
		strings.TrimSpace(check.RejectKeyboardLang) == "" {
		return errors.New("telegram_ops_bot review chrome incomplete")
	}
	if strings.TrimSpace(check.HubHeaderMDTemplate) == "" || strings.TrimSpace(check.HubEmptyMDTemplate) == "" ||
		strings.TrimSpace(check.HubReceiptButtonTemplate) == "" || strings.TrimSpace(check.HubPayoutButtonTemplate) == "" ||
		strings.TrimSpace(check.ReceiptDetailHTMLTemplate) == "" || strings.TrimSpace(check.PayoutDetailHTMLTemplate) == "" ||
		strings.TrimSpace(check.ReceiptNotifyHTMLTemplate) == "" || strings.TrimSpace(check.PayoutNotifyHTMLTemplate) == "" ||
		strings.TrimSpace(check.ScreenshotLineTemplate) == "" || strings.TrimSpace(check.ButtonTruncateSuffix) == "" ||
		strings.TrimSpace(check.ActionResultMDTemplate) == "" || strings.TrimSpace(check.ActionRejectResultMDTemplate) == "" {
		return errors.New("telegram_ops_bot message templates incomplete")
	}
	if _, err := s.db.Pool.Exec(ctx, `
		INSERT INTO platform_settings (key, value, updated_at)
		VALUES ('telegram_ops_bot', $1::jsonb, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`, string(raw)); err != nil {
		return err
	}
	return s.ReloadTelegramOpsBot(ctx)
}

func mergeTelegramOpsChrome(dst *TelegramOpsBotConfig, src TelegramOpsBotConfig) {
	if strings.TrimSpace(dst.NotifyReceiptType) == "" {
		dst.NotifyReceiptType = src.NotifyReceiptType
	}
	if strings.TrimSpace(dst.NotifyPayoutType) == "" {
		dst.NotifyPayoutType = src.NotifyPayoutType
	}
	if strings.TrimSpace(dst.ProductLabel) == "" {
		dst.ProductLabel = src.ProductLabel
	}
	if strings.TrimSpace(dst.ReceiptHubTitle) == "" {
		dst.ReceiptHubTitle = src.ReceiptHubTitle
	}
	if strings.TrimSpace(dst.ReceiptHubEmpty) == "" {
		dst.ReceiptHubEmpty = src.ReceiptHubEmpty
	}
	if strings.TrimSpace(dst.ReceiptDetailTitle) == "" {
		dst.ReceiptDetailTitle = src.ReceiptDetailTitle
	}
	if strings.TrimSpace(dst.ReceiptNotifyTitle) == "" {
		dst.ReceiptNotifyTitle = src.ReceiptNotifyTitle
	}
	if strings.TrimSpace(dst.PayoutHubTitle) == "" {
		dst.PayoutHubTitle = src.PayoutHubTitle
	}
	if strings.TrimSpace(dst.PayoutHubEmpty) == "" {
		dst.PayoutHubEmpty = src.PayoutHubEmpty
	}
	if strings.TrimSpace(dst.PayoutDetailTitle) == "" {
		dst.PayoutDetailTitle = src.PayoutDetailTitle
	}
	if strings.TrimSpace(dst.PayoutNotifyTitle) == "" {
		dst.PayoutNotifyTitle = src.PayoutNotifyTitle
	}
	if strings.TrimSpace(dst.BtnViewDetails) == "" {
		dst.BtnViewDetails = src.BtnViewDetails
	}
	if strings.TrimSpace(dst.BtnViewHub) == "" {
		dst.BtnViewHub = src.BtnViewHub
	}
	if strings.TrimSpace(dst.BtnApprove) == "" {
		dst.BtnApprove = src.BtnApprove
	}
	if strings.TrimSpace(dst.BtnReject) == "" {
		dst.BtnReject = src.BtnReject
	}
	if strings.TrimSpace(dst.BtnMarkPaid) == "" {
		dst.BtnMarkPaid = src.BtnMarkPaid
	}
	if strings.TrimSpace(dst.BtnBackHub) == "" {
		dst.BtnBackHub = src.BtnBackHub
	}
	if strings.TrimSpace(dst.BtnClose) == "" {
		dst.BtnClose = src.BtnClose
	}
	if strings.TrimSpace(dst.ErrBotNotConfigured) == "" {
		dst.ErrBotNotConfigured = src.ErrBotNotConfigured
	}
	if strings.TrimSpace(dst.ErrUnauthorizedBot) == "" {
		dst.ErrUnauthorizedBot = src.ErrUnauthorizedBot
	}
	if strings.TrimSpace(dst.ErrReviewerMissing) == "" {
		dst.ErrReviewerMissing = src.ErrReviewerMissing
	}
	if strings.TrimSpace(dst.MenuReceiptsLabel) == "" {
		dst.MenuReceiptsLabel = src.MenuReceiptsLabel
	}
	if strings.TrimSpace(dst.MenuPayoutsLabel) == "" {
		dst.MenuPayoutsLabel = src.MenuPayoutsLabel
	}
	if strings.TrimSpace(dst.MenuReceiptsLabelAm) == "" {
		dst.MenuReceiptsLabelAm = src.MenuReceiptsLabelAm
	}
	if strings.TrimSpace(dst.MenuPayoutsLabelAm) == "" {
		dst.MenuPayoutsLabelAm = src.MenuPayoutsLabelAm
	}
	if strings.TrimSpace(dst.UnknownUserLabel) == "" {
		dst.UnknownUserLabel = src.UnknownUserLabel
	}
	if strings.TrimSpace(dst.NALabel) == "" {
		dst.NALabel = src.NALabel
	}
	if strings.TrimSpace(dst.RejectReasonPromptReceipt) == "" {
		dst.RejectReasonPromptReceipt = src.RejectReasonPromptReceipt
	}
	if strings.TrimSpace(dst.RejectReasonPromptPayout) == "" {
		dst.RejectReasonPromptPayout = src.RejectReasonPromptPayout
	}
	if strings.TrimSpace(dst.RejectCancelled) == "" {
		dst.RejectCancelled = src.RejectCancelled
	}
	if strings.TrimSpace(dst.ApprovedToast) == "" {
		dst.ApprovedToast = src.ApprovedToast
	}
	if strings.TrimSpace(dst.RejectedToast) == "" {
		dst.RejectedToast = src.RejectedToast
	}
	if strings.TrimSpace(dst.PaidToast) == "" {
		dst.PaidToast = src.PaidToast
	}
	if strings.TrimSpace(dst.ErrFetchFailed) == "" {
		dst.ErrFetchFailed = src.ErrFetchFailed
	}
	if strings.TrimSpace(dst.ErrNotConfiguredEnv) == "" {
		dst.ErrNotConfiguredEnv = src.ErrNotConfiguredEnv
	}
	if strings.TrimSpace(dst.HubFoundTemplate) == "" {
		dst.HubFoundTemplate = src.HubFoundTemplate
	}
	if strings.TrimSpace(dst.AdminBackLabel) == "" {
		dst.AdminBackLabel = src.AdminBackLabel
	}
	if strings.TrimSpace(dst.ErrNotAllowed) == "" {
		dst.ErrNotAllowed = src.ErrNotAllowed
	}
	if strings.TrimSpace(dst.ErrBadCallback) == "" {
		dst.ErrBadCallback = src.ErrBadCallback
	}
	if strings.TrimSpace(dst.UserFallbackTemplate) == "" {
		dst.UserFallbackTemplate = src.UserFallbackTemplate
	}
	if strings.TrimSpace(dst.NoteApprovedByTemplate) == "" {
		dst.NoteApprovedByTemplate = src.NoteApprovedByTemplate
	}
	if strings.TrimSpace(dst.NotePaidByTemplate) == "" {
		dst.NotePaidByTemplate = src.NotePaidByTemplate
	}
	if strings.TrimSpace(dst.ReviewNoteApprovedPrefix) == "" {
		dst.ReviewNoteApprovedPrefix = src.ReviewNoteApprovedPrefix
	}
	if strings.TrimSpace(dst.ReviewNoteRejectedPrefix) == "" {
		dst.ReviewNoteRejectedPrefix = src.ReviewNoteRejectedPrefix
	}
	if strings.TrimSpace(dst.ReviewNotePaidPrefix) == "" {
		dst.ReviewNotePaidPrefix = src.ReviewNotePaidPrefix
	}
	if strings.TrimSpace(dst.ReviewNoteTelegramIDTpl) == "" {
		dst.ReviewNoteTelegramIDTpl = src.ReviewNoteTelegramIDTpl
	}
	if strings.TrimSpace(dst.ReviewNoteReasonTemplate) == "" {
		dst.ReviewNoteReasonTemplate = src.ReviewNoteReasonTemplate
	}
	if strings.TrimSpace(dst.ReviewNoteJoiner) == "" {
		dst.ReviewNoteJoiner = src.ReviewNoteJoiner
	}
	if strings.TrimSpace(dst.ReceiptPendingStatus) == "" {
		dst.ReceiptPendingStatus = src.ReceiptPendingStatus
	}
	if dst.HTTPClientTimeoutSeconds <= 0 {
		dst.HTTPClientTimeoutSeconds = src.HTTPClientTimeoutSeconds
	}
	if strings.TrimSpace(dst.ErrBotNotInitialized) == "" {
		dst.ErrBotNotInitialized = src.ErrBotNotInitialized
	}
	if strings.TrimSpace(dst.ErrUnavailable) == "" {
		dst.ErrUnavailable = src.ErrUnavailable
	}
	if strings.TrimSpace(dst.ErrBotRequestFailed) == "" {
		dst.ErrBotRequestFailed = src.ErrBotRequestFailed
	}
	if strings.TrimSpace(dst.ErrPaymentsUnavailable) == "" {
		dst.ErrPaymentsUnavailable = src.ErrPaymentsUnavailable
	}
	if strings.TrimSpace(dst.ErrPayoutsUnavailable) == "" {
		dst.ErrPayoutsUnavailable = src.ErrPayoutsUnavailable
	}
	if strings.TrimSpace(dst.ErrReceiptNotFound) == "" {
		dst.ErrReceiptNotFound = src.ErrReceiptNotFound
	}
	if strings.TrimSpace(dst.ErrPayoutNotFound) == "" {
		dst.ErrPayoutNotFound = src.ErrPayoutNotFound
	}
	if strings.TrimSpace(dst.ErrInvalidPayoutTransition) == "" {
		dst.ErrInvalidPayoutTransition = src.ErrInvalidPayoutTransition
	}
	if strings.TrimSpace(dst.ErrInvalidPayoutStatus) == "" {
		dst.ErrInvalidPayoutStatus = src.ErrInvalidPayoutStatus
	}
	if strings.TrimSpace(dst.ErrRefundFailedPrefix) == "" {
		dst.ErrRefundFailedPrefix = src.ErrRefundFailedPrefix
	}
	if dst.HubListLimit <= 0 {
		dst.HubListLimit = src.HubListLimit
	}
	if strings.TrimSpace(dst.ErrReceiptReviewFailed) == "" {
		dst.ErrReceiptReviewFailed = src.ErrReceiptReviewFailed
	}
	if strings.TrimSpace(dst.ErrPayoutReviewFailed) == "" {
		dst.ErrPayoutReviewFailed = src.ErrPayoutReviewFailed
	}
	if strings.TrimSpace(dst.ErrRejectReasonRequired) == "" {
		dst.ErrRejectReasonRequired = src.ErrRejectReasonRequired
	}
	if strings.TrimSpace(dst.ErrNoTelegramAdmins) == "" {
		dst.ErrNoTelegramAdmins = src.ErrNoTelegramAdmins
	}
	if strings.TrimSpace(dst.RejectKeyboardLang) == "" {
		dst.RejectKeyboardLang = src.RejectKeyboardLang
	}
	if strings.TrimSpace(dst.HubHeaderMDTemplate) == "" {
		dst.HubHeaderMDTemplate = src.HubHeaderMDTemplate
	}
	if strings.TrimSpace(dst.HubEmptyMDTemplate) == "" {
		dst.HubEmptyMDTemplate = src.HubEmptyMDTemplate
	}
	if strings.TrimSpace(dst.HubReceiptButtonTemplate) == "" {
		dst.HubReceiptButtonTemplate = src.HubReceiptButtonTemplate
	}
	if strings.TrimSpace(dst.HubPayoutButtonTemplate) == "" {
		dst.HubPayoutButtonTemplate = src.HubPayoutButtonTemplate
	}
	if strings.TrimSpace(dst.ReceiptDetailHTMLTemplate) == "" {
		dst.ReceiptDetailHTMLTemplate = src.ReceiptDetailHTMLTemplate
	}
	if strings.TrimSpace(dst.PayoutDetailHTMLTemplate) == "" {
		dst.PayoutDetailHTMLTemplate = src.PayoutDetailHTMLTemplate
	}
	if strings.TrimSpace(dst.ReceiptNotifyHTMLTemplate) == "" {
		dst.ReceiptNotifyHTMLTemplate = src.ReceiptNotifyHTMLTemplate
	}
	if strings.TrimSpace(dst.PayoutNotifyHTMLTemplate) == "" {
		dst.PayoutNotifyHTMLTemplate = src.PayoutNotifyHTMLTemplate
	}
	if strings.TrimSpace(dst.ScreenshotLineTemplate) == "" {
		dst.ScreenshotLineTemplate = src.ScreenshotLineTemplate
	}
	if strings.TrimSpace(dst.ButtonTruncateSuffix) == "" {
		dst.ButtonTruncateSuffix = src.ButtonTruncateSuffix
	}
	if strings.TrimSpace(dst.ActionResultMDTemplate) == "" {
		dst.ActionResultMDTemplate = src.ActionResultMDTemplate
	}
	if strings.TrimSpace(dst.ActionRejectResultMDTemplate) == "" {
		dst.ActionRejectResultMDTemplate = src.ActionRejectResultMDTemplate
	}
}

// TelegramOpsBotChromePublic returns bot-facing chrome (never includes bot_api_key).
func (s *SettingsStore) TelegramOpsBotChromePublic() map[string]any {
	cfg := s.TelegramOpsBot()
	if cfg.Source != "database" {
		return nil
	}
	return map[string]any{
		"product_label":                    cfg.ProductLabel,
		"notify_receipt_type":              cfg.NotifyReceiptType,
		"notify_payout_type":               cfg.NotifyPayoutType,
		"receipt_hub_title":                cfg.ReceiptHubTitle,
		"receipt_hub_empty":                cfg.ReceiptHubEmpty,
		"receipt_detail_title":             cfg.ReceiptDetailTitle,
		"receipt_notify_title":             cfg.ReceiptNotifyTitle,
		"payout_hub_title":                 cfg.PayoutHubTitle,
		"payout_hub_empty":                 cfg.PayoutHubEmpty,
		"payout_detail_title":              cfg.PayoutDetailTitle,
		"payout_notify_title":              cfg.PayoutNotifyTitle,
		"btn_view_details":                 cfg.BtnViewDetails,
		"btn_view_hub":                     cfg.BtnViewHub,
		"btn_approve":                      cfg.BtnApprove,
		"btn_reject":                       cfg.BtnReject,
		"btn_mark_paid":                    cfg.BtnMarkPaid,
		"btn_back_hub":                     cfg.BtnBackHub,
		"btn_close":                        cfg.BtnClose,
		"menu_receipts_label":              cfg.MenuReceiptsLabel,
		"menu_payouts_label":               cfg.MenuPayoutsLabel,
		"menu_receipts_label_am":           cfg.MenuReceiptsLabelAm,
		"menu_payouts_label_am":            cfg.MenuPayoutsLabelAm,
		"unknown_user_label":               cfg.UnknownUserLabel,
		"na_label":                         cfg.NALabel,
		"reject_reason_prompt_receipt":     cfg.RejectReasonPromptReceipt,
		"reject_reason_prompt_payout":      cfg.RejectReasonPromptPayout,
		"reject_cancelled":                 cfg.RejectCancelled,
		"approved_toast":                   cfg.ApprovedToast,
		"rejected_toast":                   cfg.RejectedToast,
		"paid_toast":                       cfg.PaidToast,
		"err_fetch_failed":                 cfg.ErrFetchFailed,
		"err_not_configured_env":           cfg.ErrNotConfiguredEnv,
		"hub_found_template":               cfg.HubFoundTemplate,
		"admin_back_label":                 cfg.AdminBackLabel,
		"err_bot_not_configured":           cfg.ErrBotNotConfigured,
		"err_unauthorized_bot":             cfg.ErrUnauthorizedBot,
		"err_not_allowed":                  cfg.ErrNotAllowed,
		"err_bad_callback":                 cfg.ErrBadCallback,
		"user_fallback_template":           cfg.UserFallbackTemplate,
		"note_approved_by_template":        cfg.NoteApprovedByTemplate,
		"note_paid_by_template":            cfg.NotePaidByTemplate,
		"review_note_approved_prefix":      cfg.ReviewNoteApprovedPrefix,
		"review_note_rejected_prefix":      cfg.ReviewNoteRejectedPrefix,
		"review_note_paid_prefix":          cfg.ReviewNotePaidPrefix,
		"review_note_telegram_id_template": cfg.ReviewNoteTelegramIDTpl,
		"review_note_reason_template":      cfg.ReviewNoteReasonTemplate,
		"review_note_joiner":               cfg.ReviewNoteJoiner,
		"receipt_pending_status":           cfg.ReceiptPendingStatus,
		"http_client_timeout_seconds":      cfg.HTTPClientTimeoutSeconds,
		"err_bot_not_initialized":          cfg.ErrBotNotInitialized,
		"err_unavailable":                  cfg.ErrUnavailable,
		"err_bot_request_failed":           cfg.ErrBotRequestFailed,
		"err_payments_unavailable":         cfg.ErrPaymentsUnavailable,
		"err_payouts_unavailable":          cfg.ErrPayoutsUnavailable,
		"err_receipt_not_found":            cfg.ErrReceiptNotFound,
		"err_payout_not_found":             cfg.ErrPayoutNotFound,
		"err_invalid_payout_transition":    cfg.ErrInvalidPayoutTransition,
		"err_invalid_payout_status":        cfg.ErrInvalidPayoutStatus,
		"err_refund_failed_prefix":         cfg.ErrRefundFailedPrefix,
		"hub_list_limit":                   cfg.HubListLimit,
		"err_receipt_review_failed":        cfg.ErrReceiptReviewFailed,
		"err_payout_review_failed":         cfg.ErrPayoutReviewFailed,
		"err_reject_reason_required":       cfg.ErrRejectReasonRequired,
		"err_no_telegram_admins":           cfg.ErrNoTelegramAdmins,
		"reject_keyboard_lang":             cfg.RejectKeyboardLang,
		"hub_header_md_template":           cfg.HubHeaderMDTemplate,
		"hub_empty_md_template":            cfg.HubEmptyMDTemplate,
		"hub_receipt_button_template":      cfg.HubReceiptButtonTemplate,
		"hub_payout_button_template":       cfg.HubPayoutButtonTemplate,
		"receipt_detail_html_template":     cfg.ReceiptDetailHTMLTemplate,
		"payout_detail_html_template":      cfg.PayoutDetailHTMLTemplate,
		"receipt_notify_html_template":     cfg.ReceiptNotifyHTMLTemplate,
		"payout_notify_html_template":      cfg.PayoutNotifyHTMLTemplate,
		"screenshot_line_template":         cfg.ScreenshotLineTemplate,
		"button_truncate_suffix":           cfg.ButtonTruncateSuffix,
		"action_result_md_template":        cfg.ActionResultMDTemplate,
		"action_reject_result_md_template": cfg.ActionRejectResultMDTemplate,
	}
}

// TelegramOpsBotReady is true when DB config is loaded, enabled, and fully wired.
// Includes notify_timeout_ms - notify fails closed without it, so Ready must not lie.
func (s *SettingsStore) TelegramOpsBotReady() bool {
	cfg := s.TelegramOpsBot()
	return cfg.Source == "database" &&
		cfg.Enabled &&
		strings.TrimSpace(cfg.BotServiceURL) != "" &&
		strings.TrimSpace(cfg.BotAPIKey) != "" &&
		strings.TrimSpace(cfg.ReviewerUserID) != "" &&
		cfg.NotifyTimeoutMS > 0
}

// PrivateDefaultCity is the DB city used when inventing location on private/loopback IP.
func (s *SettingsStore) PrivateDefaultCity() string {
	cfg := s.GeoPayment()
	if cfg.Source != "database" {
		return ""
	}
	return cfg.PrivateDefaultCity
}

// PrivateDefaultRegion is the DB region used with PrivateDefaultCity (may be empty).
func (s *SettingsStore) PrivateDefaultRegion() string {
	cfg := s.GeoPayment()
	if cfg.Source != "database" {
		return ""
	}
	return cfg.PrivateDefaultRegion
}

// CurrencyForCountry returns Ethiopia currency when country matches geo_payment,
// otherwise global (typically USD). Empty when country unresolved or config incomplete
// (never invent USD without a real ISO country - reference pay-geo fail-closed).
func (s *SettingsStore) CurrencyForCountry(countryCode string) string {
	cfg := s.Currency()
	if cfg.Source != "database" {
		return ""
	}
	cc := normalizeCC(countryCode)
	if len(cc) != 2 {
		return ""
	}
	et := s.EthiopiaCountry()
	if et != "" && cc == et {
		return cfg.Ethiopia
	}
	return cfg.Global
}

func (s *SettingsStore) ReloadModeration(ctx context.Context) error {
	if s.db == nil || !s.db.Ready() {
		return nil
	}
	row := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'avatar_moderation'`)
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		return err
	}
	var cfg ModerationConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	if cfg.Provider == "" {
		return errors.New("moderation provider required")
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.mod = cfg
	s.mu.Unlock()
	return nil
}

func (s *SettingsStore) Moderation() ModerationConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.mod
}

func (s *SettingsStore) SetModeration(ctx context.Context, cfg ModerationConfig) error {
	if cfg.Provider == "" {
		return errors.New("moderation provider required (no hardcode fill)")
	}
	raw, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	if s.db != nil && s.db.Ready() {
		_, err := s.db.Pool.Exec(ctx, `
			INSERT INTO platform_settings (key, value, updated_at)
			VALUES ('avatar_moderation', $1::jsonb, NOW())
			ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
		`, string(raw))
		if err != nil {
			return err
		}
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.mod = cfg
	s.mu.Unlock()
	return nil
}

func (s *SettingsStore) ReloadProgression(ctx context.Context) error {
	if s.db == nil || !s.db.Ready() {
		return nil
	}
	levelsRow := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'xp_levels'`)
	var levelsRaw []byte
	if err := levelsRow.Scan(&levelsRaw); err != nil {
		return err
	}
	var levels XPLevelsConfig
	if err := json.Unmarshal(levelsRaw, &levels); err != nil {
		return err
	}
	if len(levels.Levels) == 0 {
		return errors.New("xp_levels missing from platform_settings")
	}
	levels.Source = "database"

	clockRow := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'match_clock'`)
	var clockRaw []byte
	if err := clockRow.Scan(&clockRaw); err != nil {
		return err
	}
	var clock MatchClockConfig
	if err := json.Unmarshal(clockRaw, &clock); err != nil {
		return err
	}
	if clock.InitialSeconds <= 0 {
		return errors.New("match_clock.initial_seconds required from platform_settings")
	}
	if len(clock.Presets) == 0 {
		return errors.New("match_clock.presets required from platform_settings")
	}
	initialInPresets := false
	for _, p := range clock.Presets {
		if p.Seconds <= 0 || strings.TrimSpace(p.Label) == "" {
			return errors.New("match_clock.presets entries require seconds > 0 and label")
		}
		if p.Seconds == clock.InitialSeconds {
			initialInPresets = true
		}
	}
	if !initialInPresets {
		return errors.New("match_clock.initial_seconds must match a preset")
	}
	if clock.InviteTTLSeconds <= 0 {
		return errors.New("match_clock.invite_ttl_seconds required from platform_settings")
	}
	if clock.PauseDurationSeconds < 0 {
		return errors.New("match_clock.pause_duration_seconds must be >= 0")
	}
	if clock.PauseEnabled && clock.PauseDurationSeconds <= 0 {
		return errors.New("match_clock.pause_duration_seconds must be > 0 when pause is enabled")
	}
	clock.Source = "database"

	rewardsRow := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'match_rewards'`)
	var rewardsRaw []byte
	if err := rewardsRow.Scan(&rewardsRaw); err != nil {
		return err
	}
	var rewards MatchRewardsConfig
	if err := json.Unmarshal(rewardsRaw, &rewards); err != nil {
		return err
	}
	if err := validateMatchRewardsConfig(rewards); err != nil {
		return err
	}
	rewards.Source = "database"

	s.mu.Lock()
	s.levels = levels
	s.clock = clock
	s.rewards = rewards
	s.progressionLoadedAt = time.Now()
	s.mu.Unlock()
	return nil
}

func (s *SettingsStore) MatchRewards() MatchRewardsConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.rewards
}

func (s *SettingsStore) XPLevels() XPLevelsConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cp := s.levels
	cp.Levels = append([]XPLevel{}, s.levels.Levels...)
	return cp
}

func (s *SettingsStore) refreshMatchClockIfStale() {
	if s == nil || s.db == nil || !s.db.Ready() {
		return
	}
	s.mu.RLock()
	last := s.progressionLoadedAt
	s.mu.RUnlock()
	if !last.IsZero() && time.Since(last) < matchClockReloadMinInterval {
		return
	}
	_ = s.ReloadProgression(context.Background())
}

func (s *SettingsStore) MatchClock() MatchClockConfig {
	s.refreshMatchClockIfStale()
	s.mu.RLock()
	defer s.mu.RUnlock()
	cp := s.clock
	if len(s.clock.Presets) > 0 {
		cp.Presets = append([]MatchClockPreset{}, s.clock.Presets...)
	}
	return cp
}

// SetMatchClockCacheForTest injects an in-memory match_clock for unit tests (no DB write).
func (s *SettingsStore) SetMatchClockCacheForTest(cfg MatchClockConfig) {
	if s == nil {
		return
	}
	s.mu.Lock()
	s.clock = cfg
	s.progressionLoadedAt = time.Now()
	s.mu.Unlock()
}

func (s *SettingsStore) ReloadAdPricing(ctx context.Context) error {
	if s.db == nil || !s.db.Ready() {
		return nil
	}
	row := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'ad_pricing'`)
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		return err
	}
	var cfg AdPricingConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	// Legacy single-fee keys → Ethiopia until migration 323 is applied everywhere.
	if cfg.CampaignCreateFeeEthiopiaAmount <= 0 {
		var legacy struct {
			Amount   float64 `json:"campaign_create_fee_amount"`
			Currency string  `json:"campaign_create_fee_currency"`
		}
		_ = json.Unmarshal(raw, &legacy)
		if legacy.Amount > 0 {
			cfg.CampaignCreateFeeEthiopiaAmount = legacy.Amount
		}
		if strings.TrimSpace(cfg.CampaignCreateFeeEthiopiaCurrency) == "" {
			cfg.CampaignCreateFeeEthiopiaCurrency = legacy.Currency
		}
	}
	if cfg.ImpressionUnitCost <= 0 {
		return errors.New("ad_pricing.impression_unit_cost required from platform_settings")
	}
	if cfg.CampaignCreateFeeEthiopiaAmount <= 0 {
		return errors.New("ad_pricing.campaign_create_fee_ethiopia_amount required from platform_settings")
	}
	if cfg.CampaignCreateFeeGlobalAmount <= 0 {
		return errors.New("ad_pricing.campaign_create_fee_global_amount required from platform_settings")
	}
	pay := s.Currency()
	etCur := strings.ToUpper(strings.TrimSpace(pay.Ethiopia))
	glCur := strings.ToUpper(strings.TrimSpace(pay.Global))
	cfg.CampaignCreateFeeEthiopiaCurrency = strings.ToUpper(strings.TrimSpace(cfg.CampaignCreateFeeEthiopiaCurrency))
	cfg.CampaignCreateFeeGlobalCurrency = strings.ToUpper(strings.TrimSpace(cfg.CampaignCreateFeeGlobalCurrency))
	if etCur != "" {
		cfg.CampaignCreateFeeEthiopiaCurrency = etCur
	}
	if glCur != "" {
		cfg.CampaignCreateFeeGlobalCurrency = glCur
	}
	if cfg.CampaignCreateFeeEthiopiaCurrency == "" {
		return errors.New("ad_pricing.campaign_create_fee_ethiopia_currency required from platform_settings")
	}
	if cfg.CampaignCreateFeeGlobalCurrency == "" {
		return errors.New("ad_pricing.campaign_create_fee_global_currency required from platform_settings")
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.ads = cfg
	s.mu.Unlock()
	return nil
}

func (s *SettingsStore) AdPricing() AdPricingConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.ads
}

// CampaignCreateFeeForCountry returns the Ethiopia or global create-fee pair for an ISO country.
func (s *SettingsStore) CampaignCreateFeeForCountry(countryCode string) (amount float64, currency string, ok bool) {
	cfg := s.AdPricing()
	if cfg.Source != "database" {
		return 0, "", false
	}
	cc := normalizeCC(countryCode)
	if len(cc) != 2 {
		return 0, "", false
	}
	et := s.EthiopiaCountry()
	if et != "" && cc == et {
		if cfg.CampaignCreateFeeEthiopiaAmount <= 0 || cfg.CampaignCreateFeeEthiopiaCurrency == "" {
			return 0, "", false
		}
		return cfg.CampaignCreateFeeEthiopiaAmount, cfg.CampaignCreateFeeEthiopiaCurrency, true
	}
	if cfg.CampaignCreateFeeGlobalAmount <= 0 || cfg.CampaignCreateFeeGlobalCurrency == "" {
		return 0, "", false
	}
	return cfg.CampaignCreateFeeGlobalAmount, cfg.CampaignCreateFeeGlobalCurrency, true
}

func (s *SettingsStore) SetAdPricing(ctx context.Context, cfg AdPricingConfig) error {
	if cfg.ImpressionUnitCost <= 0 {
		return errors.New("ad_pricing.impression_unit_cost must be > 0")
	}
	if cfg.CampaignCreateFeeEthiopiaAmount <= 0 {
		return errors.New("ad_pricing.campaign_create_fee_ethiopia_amount must be > 0")
	}
	if cfg.CampaignCreateFeeGlobalAmount <= 0 {
		return errors.New("ad_pricing.campaign_create_fee_global_amount must be > 0")
	}
	pay := s.Currency()
	etCur := strings.ToUpper(strings.TrimSpace(pay.Ethiopia))
	glCur := strings.ToUpper(strings.TrimSpace(pay.Global))
	if etCur == "" || glCur == "" || pay.Source != "database" {
		return errors.New("payment_currency required to lock campaign create fee currencies")
	}
	cfg.CampaignCreateFeeEthiopiaCurrency = etCur
	cfg.CampaignCreateFeeGlobalCurrency = glCur
	raw, err := json.Marshal(map[string]any{
		"impression_unit_cost":                  cfg.ImpressionUnitCost,
		"campaign_create_fee_ethiopia_amount":   cfg.CampaignCreateFeeEthiopiaAmount,
		"campaign_create_fee_ethiopia_currency": cfg.CampaignCreateFeeEthiopiaCurrency,
		"campaign_create_fee_global_amount":     cfg.CampaignCreateFeeGlobalAmount,
		"campaign_create_fee_global_currency":   cfg.CampaignCreateFeeGlobalCurrency,
		// Legacy mirrors (Ethiopia) for older readers until fully retired.
		"campaign_create_fee_amount":   cfg.CampaignCreateFeeEthiopiaAmount,
		"campaign_create_fee_currency": cfg.CampaignCreateFeeEthiopiaCurrency,
	})
	if err != nil {
		return err
	}
	if s.db == nil || !s.db.Ready() {
		return errors.New("database required to persist ad_pricing")
	}
	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO platform_settings (key, value, updated_at)
		VALUES ('ad_pricing', $1::jsonb, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`, string(raw))
	if err != nil {
		return err
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.ads = cfg
	s.mu.Unlock()
	return nil
}

// SetXPLevels persists the career ladder into platform_settings (fail-closed validation).
func (s *SettingsStore) SetXPLevels(ctx context.Context, cfg XPLevelsConfig) error {
	if len(cfg.Levels) == 0 {
		return errors.New("xp_levels requires at least one level")
	}
	for _, lvl := range cfg.Levels {
		if lvl.Label == "" {
			return errors.New("xp_levels.label required")
		}
		if lvl.MinXP < 0 {
			return errors.New("xp_levels.min_xp must be >= 0")
		}
	}
	payload := map[string]any{"levels": cfg.Levels}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	if s.db == nil || !s.db.Ready() {
		return errors.New("database required to persist xp_levels")
	}
	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO platform_settings (key, value, updated_at)
		VALUES ('xp_levels', $1::jsonb, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`, string(raw))
	if err != nil {
		return err
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.levels = cfg
	s.mu.Unlock()
	return nil
}

// SetMatchRewards persists PvP career XP/rating deltas, rating floor, + new-account starting rating.
// VS-AI never applies match deltas. XP deltas must be >= 0; rating deltas may be negative (losses).
// RatingFloor >= 0; StartingRating must be >= RatingFloor.
func (s *SettingsStore) SetMatchRewards(ctx context.Context, cfg MatchRewardsConfig) error {
	if err := validateMatchRewardsConfig(cfg); err != nil {
		return err
	}
	payload := map[string]any{
		"win_xp":          cfg.WinXP,
		"draw_xp":         cfg.DrawXP,
		"loss_xp":         cfg.LossXP,
		"win_rating":      cfg.WinRating,
		"draw_rating":     cfg.DrawRating,
		"loss_rating":     cfg.LossRating,
		"rating_floor":    cfg.RatingFloor,
		"starting_rating": cfg.StartingRating,
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	if s.db == nil || !s.db.Ready() {
		return errors.New("database required to persist match_rewards")
	}
	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO platform_settings (key, value, updated_at)
		VALUES ('match_rewards', $1::jsonb, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`, string(raw))
	if err != nil {
		return err
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.rewards = cfg
	s.progressionLoadedAt = time.Now()
	s.mu.Unlock()
	return nil
}

// SetMatchClock persists match clock config into platform_settings (fail-closed validation).
func (s *SettingsStore) SetMatchClock(ctx context.Context, cfg MatchClockConfig) error {
	if cfg.InitialSeconds <= 0 {
		return errors.New("match_clock.initial_seconds must be > 0")
	}
	if cfg.IncrementSeconds < 0 {
		return errors.New("match_clock.increment_seconds must be >= 0")
	}
	presets := cfg.Presets
	if len(presets) == 0 {
		presets = s.MatchClock().Presets
	}
	if len(presets) == 0 {
		return errors.New("match_clock.presets required")
	}
	initialInPresets := false
	for _, p := range presets {
		if p.Seconds <= 0 || strings.TrimSpace(p.Label) == "" {
			return errors.New("match_clock.presets entries require seconds > 0 and label")
		}
		if p.Seconds == cfg.InitialSeconds {
			initialInPresets = true
		}
	}
	if !initialInPresets {
		return errors.New("match_clock.initial_seconds must match a preset")
	}
	cfg.Presets = presets
	ttl := cfg.InviteTTLSeconds
	if ttl <= 0 {
		ttl = s.MatchClock().InviteTTLSeconds
	}
	if ttl <= 0 {
		return errors.New("match_clock.invite_ttl_seconds must be > 0")
	}
	cfg.InviteTTLSeconds = ttl
	if cfg.PauseDurationSeconds < 0 {
		return errors.New("match_clock.pause_duration_seconds must be >= 0")
	}
	if cfg.PauseEnabled && cfg.PauseDurationSeconds <= 0 {
		return errors.New("match_clock.pause_duration_seconds must be > 0 when pause is enabled")
	}
	payload := map[string]any{
		"enabled":                cfg.Enabled,
		"initial_seconds":        cfg.InitialSeconds,
		"increment_seconds":      cfg.IncrementSeconds,
		"presets":                presets,
		"invite_ttl_seconds":     ttl,
		"pause_enabled":          cfg.PauseEnabled,
		"pause_duration_seconds": cfg.PauseDurationSeconds,
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	if s.db == nil || !s.db.Ready() {
		return errors.New("database required to persist match_clock")
	}
	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO platform_settings (key, value, updated_at)
		VALUES ('match_clock', $1::jsonb, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`, string(raw))
	if err != nil {
		return err
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.clock = cfg
	s.progressionLoadedAt = time.Now()
	s.mu.Unlock()
	return nil
}

func (s *SettingsStore) ReloadBoardRules(ctx context.Context) error {
	if s.db == nil || !s.db.Ready() {
		return nil
	}
	row := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'board_rules'`)
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		return err
	}
	var cfg BoardRulesConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	if cfg.Size <= 0 || cfg.PiecesPerSide <= 0 || cfg.SetupRows <= 0 || cfg.Variant == "" {
		return errors.New("board_rules incomplete in platform_settings")
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.board = cfg
	s.mu.Unlock()
	return nil
}

func (s *SettingsStore) BoardRules() BoardRulesConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.board
}

func (s *SettingsStore) SetBoardRules(ctx context.Context, cfg BoardRulesConfig) error {
	if cfg.Size <= 0 || cfg.PiecesPerSide <= 0 || cfg.SetupRows <= 0 || cfg.Variant == "" {
		return errors.New("board_rules requires size, pieces_per_side, setup_rows, variant")
	}
	payload := map[string]any{
		"size":            cfg.Size,
		"pieces_per_side": cfg.PiecesPerSide,
		"setup_rows":      cfg.SetupRows,
		"variant":         cfg.Variant,
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	if s.db == nil || !s.db.Ready() {
		return errors.New("database required to persist board_rules")
	}
	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO platform_settings (key, value, updated_at)
		VALUES ('board_rules', $1::jsonb, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`, string(raw))
	if err != nil {
		return err
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.board = cfg
	s.mu.Unlock()
	return nil
}

// LevelLabelForXP picks the highest ladder label whose min_xp <= xp.
func (s *SettingsStore) LevelLabelForXP(xp int) string {
	cfg := s.XPLevels()
	if cfg.Source != "database" || len(cfg.Levels) == 0 {
		return ""
	}
	label := ""
	best := -1
	for _, lvl := range cfg.Levels {
		if lvl.MinXP <= xp && lvl.MinXP >= best && lvl.Label != "" {
			best = lvl.MinXP
			label = lvl.Label
		}
	}
	return label
}

func (s *SettingsStore) ReloadConsoleNav(ctx context.Context) error {
	if s.db == nil || !s.db.Ready() {
		return nil
	}
	row := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'console_nav'`)
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		return err
	}
	var cfg ConsoleNavConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	if len(cfg.Modules) == 0 {
		return errors.New("console_nav.modules required from platform_settings")
	}
	if strings.TrimSpace(cfg.BrandTitle) == "" ||
		strings.TrimSpace(cfg.TitleTemplate) == "" ||
		strings.TrimSpace(cfg.MetaDescription) == "" ||
		strings.TrimSpace(cfg.MetaSeparator) == "" ||
		strings.TrimSpace(cfg.GraphqlEmpty) == "" {
		return errors.New("console_nav brand/meta chrome incomplete")
	}
	for _, m := range cfg.Modules {
		if m.Title == "" || m.Href == "" {
			return errors.New("console_nav module title and href required")
		}
	}
	for _, sec := range cfg.Sections {
		if strings.TrimSpace(sec.ID) == "" || strings.TrimSpace(sec.Label) == "" || len(sec.Items) == 0 {
			return errors.New("console_nav section id/label/items required")
		}
		for _, it := range sec.Items {
			if strings.TrimSpace(it.ID) == "" || strings.TrimSpace(it.Label) == "" || strings.TrimSpace(it.Href) == "" {
				return errors.New("console_nav section item id/label/href required")
			}
		}
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.nav = cfg
	s.mu.Unlock()
	return nil
}

func (s *SettingsStore) ConsoleNav() ConsoleNavConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cp := s.nav
	cp.Modules = append([]ConsoleNavModule{}, s.nav.Modules...)
	if len(s.nav.Sections) > 0 {
		cp.Sections = make([]ConsoleNavSection, len(s.nav.Sections))
		for i, sec := range s.nav.Sections {
			cp.Sections[i] = ConsoleNavSection{
				ID:    sec.ID,
				Label: sec.Label,
				Items: append([]ConsoleNavItem{}, sec.Items...),
			}
		}
	}
	return cp
}

func (s *SettingsStore) ReloadClientEnums(ctx context.Context) error {
	if s.db == nil || !s.db.Ready() {
		return nil
	}
	row := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'client_enums'`)
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		return err
	}
	var cfg ClientEnumsConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	if len(cfg.Roles) == 0 || len(cfg.ConsoleRoles) == 0 || len(cfg.PublisherRoles) == 0 ||
		cfg.DefaultRole == "" || len(cfg.TournamentStatuses) == 0 || len(cfg.CampaignStatuses) == 0 ||
		len(cfg.CreativeTypes) == 0 || cfg.DefaultCreativeType == "" || cfg.VideoCreativeType == "" ||
		cfg.DefaultTournamentStatus == "" || cfg.DefaultCampaignStatus == "" ||
		cfg.EnrollableTournamentStatus == "" || cfg.ServableCampaignStatus == "" ||
		cfg.ArchivedCampaignStatus == "" || cfg.ReopenCampaignStatus == "" ||
		len(cfg.EthiopiaPaymentModes) == 0 || strings.TrimSpace(cfg.Unavailable) == "" ||
		len(cfg.HostedEventStatuses) == 0 || cfg.HostedEventDefaultStatus == "" ||
		len(cfg.HostedEventJoinableStatuses) == 0 ||
		cfg.HostedEventFullStatus == "" || cfg.HostedEventLiveStatus == "" ||
		cfg.HostedEventFinishedStatus == "" || cfg.HostedEventCancelledStatus == "" ||
		len(cfg.HostedEventFormats) == 0 || cfg.HostedEventDefaultFormat == "" ||
		cfg.HostedEventKnockoutFormat == "" ||
		cfg.HostedEventRoundRobinFormat == "" || cfg.HostedEventSwissFormat == "" ||
		cfg.HostedEventGroupsKnockoutFormat == "" ||
		cfg.HostedEventArenaFormat == "" ||
		len(cfg.HostedEventBracketPhases) == 0 ||
		cfg.HostedEventPhaseKnockout == "" || cfg.HostedEventPhaseRoundRobin == "" ||
		cfg.HostedEventPhaseSwiss == "" || cfg.HostedEventPhaseGroup == "" ||
		cfg.HostedEventPhaseArena == "" ||
		strings.TrimSpace(cfg.CompetitionArenaPointsWin) == "" ||
		strings.TrimSpace(cfg.CompetitionArenaPointsDraw) == "" ||
		strings.TrimSpace(cfg.CompetitionArenaPointsLoss) == "" ||
		strings.TrimSpace(cfg.CompetitionArenaStreakSecondWin) == "" ||
		strings.TrimSpace(cfg.CompetitionArenaStreakThirdPlusWin) == "" ||
		strings.TrimSpace(cfg.CompetitionArenaDefaultDurationMinutes) == "" ||
		len(cfg.CompetitionArenaPairingModes) == 0 ||
		strings.TrimSpace(cfg.CompetitionArenaDefaultPairingMode) == "" ||
		strings.TrimSpace(cfg.CompetitionArenaAutoStart) == "" ||
		strings.TrimSpace(cfg.CompetitionArenaPairIntervalSeconds) == "" ||
		strings.TrimSpace(cfg.CompetitionArenaAllowJoinWhileLive) == "" ||
		len(cfg.CompetitionPayoutModes) == 0 ||
		strings.TrimSpace(cfg.CompetitionPayoutModePlacesPercent) == "" ||
		strings.TrimSpace(cfg.CompetitionPayoutModeScoreShare) == "" ||
		strings.TrimSpace(cfg.CompetitionPayoutModeDualPurse) == "" ||
		strings.TrimSpace(cfg.CompetitionDualPursePlacePercent) == "" ||
		strings.TrimSpace(cfg.CompetitionDefaultPayoutModeKnockout) == "" ||
		strings.TrimSpace(cfg.CompetitionDefaultPayoutModeRoundRobin) == "" ||
		strings.TrimSpace(cfg.CompetitionDefaultPayoutModeSwiss) == "" ||
		strings.TrimSpace(cfg.CompetitionDefaultPayoutModeGroupsKnockout) == "" ||
		strings.TrimSpace(cfg.CompetitionDefaultPayoutModeArena) == "" ||
		strings.TrimSpace(cfg.CompetitionDefaultPlacePercent1) == "" ||
		strings.TrimSpace(cfg.CompetitionDefaultPlacePercent2) == "" ||
		strings.TrimSpace(cfg.CompetitionDefaultPlacePercent3) == "" ||
		strings.TrimSpace(cfg.CompetitionStandingsPointsWin) == "" ||
		strings.TrimSpace(cfg.CompetitionStandingsPointsDraw) == "" ||
		len(cfg.HostedEventEntryStatuses) == 0 ||
		cfg.HostedEventEntryPending == "" || cfg.HostedEventEntryApproved == "" ||
		cfg.HostedEventEntryRejected == "" || cfg.HostedEventEntryKicked == "" ||
		len(cfg.HostedEventBracketStatuses) == 0 ||
		cfg.HostedEventBracketPending == "" || cfg.HostedEventBracketReady == "" ||
		cfg.HostedEventBracketLive == "" || cfg.HostedEventBracketDone == "" ||
		cfg.HostedEventBracketBye == "" ||
		len(cfg.HostedEventVisibilities) == 0 || cfg.HostedEventDefaultVisibility == "" ||
		cfg.HostedEventPublicVisibility == "" || cfg.HostedEventPrivateVisibility == "" ||
		len(cfg.HostedEventReportStatuses) == 0 ||
		cfg.HostedEventReportOpenStatus == "" ||
		cfg.HostedEventReportDismissedStatus == "" ||
		cfg.HostedEventReportDeactivatedStatus == "" ||
		len(cfg.TournamentFormats) == 0 || cfg.TournamentDefaultFormat == "" ||
		len(cfg.TournamentBracketStatuses) == 0 ||
		cfg.TournamentBracketPending == "" || cfg.TournamentBracketReady == "" ||
		cfg.TournamentBracketLive == "" || cfg.TournamentBracketDone == "" ||
		cfg.TournamentBracketBye == "" ||
		len(cfg.CompetitionPrizePayoutStatuses) == 0 ||
		cfg.CompetitionPrizePayoutPending == "" ||
		cfg.CompetitionPrizePayoutSettled == "" ||
		cfg.CompetitionPrizePayoutFailed == "" ||
		cfg.CompetitionPrizePayoutCancelled == "" ||
		strings.TrimSpace(cfg.CompetitionDisputeWindowHours) == "" ||
		strings.TrimSpace(cfg.CompetitionPrizeSettleIntervalMinutes) == "" ||
		strings.TrimSpace(cfg.CompetitionPrizeAutoSettle) == "" {
		return errors.New("client_enums incomplete in platform_settings")
	}
	foundDefault, foundVideo := false, false
	for _, t := range cfg.CreativeTypes {
		if t == cfg.DefaultCreativeType {
			foundDefault = true
		}
		if t == cfg.VideoCreativeType {
			foundVideo = true
		}
	}
	if !foundDefault || !foundVideo {
		return errors.New("client_enums creative type defaults not in creative_types")
	}
	foundArchived, foundReopen := false, false
	for _, st := range cfg.CampaignStatuses {
		if st == cfg.ArchivedCampaignStatus {
			foundArchived = true
		}
		if st == cfg.ReopenCampaignStatus {
			foundReopen = true
		}
	}
	if !foundArchived || !foundReopen {
		return errors.New("client_enums archived/reopen campaign status not in campaign_statuses")
	}
	foundPayoutPending, foundPayoutSettled, foundPayoutFailed, foundPayoutCancelled := false, false, false, false
	for _, st := range cfg.CompetitionPrizePayoutStatuses {
		if st == cfg.CompetitionPrizePayoutPending {
			foundPayoutPending = true
		}
		if st == cfg.CompetitionPrizePayoutSettled {
			foundPayoutSettled = true
		}
		if st == cfg.CompetitionPrizePayoutFailed {
			foundPayoutFailed = true
		}
		if st == cfg.CompetitionPrizePayoutCancelled {
			foundPayoutCancelled = true
		}
	}
	if !foundPayoutPending || !foundPayoutSettled || !foundPayoutFailed || !foundPayoutCancelled {
		return errors.New("client_enums competition prize payout defaults not in competition_prize_payout_statuses")
	}
	if _, err := strconv.Atoi(strings.TrimSpace(cfg.CompetitionDisputeWindowHours)); err != nil {
		return errors.New("client_enums competition_dispute_window_hours invalid")
	}
	if mins, err := strconv.Atoi(strings.TrimSpace(cfg.CompetitionPrizeSettleIntervalMinutes)); err != nil || mins <= 0 {
		return errors.New("client_enums competition_prize_settle_interval_minutes invalid")
	}
	switch strings.ToLower(strings.TrimSpace(cfg.CompetitionPrizeAutoSettle)) {
	case "true", "false":
	default:
		return errors.New("client_enums competition_prize_auto_settle invalid")
	}
	if err := requireStatusLabels(cfg.HostedEventStatuses, cfg.HostedEventStatusLabels, "hosted_event_status_labels"); err != nil {
		return err
	}
	if err := requireStatusLabels(cfg.HostedEventEntryStatuses, cfg.HostedEventEntryStatusLabels, "hosted_event_entry_status_labels"); err != nil {
		return err
	}
	if err := requireStatusLabels(cfg.HostedEventBracketStatuses, cfg.HostedEventBracketStatusLabels, "hosted_event_bracket_status_labels"); err != nil {
		return err
	}
	if err := requireStatusLabels(cfg.CampaignStatuses, cfg.CampaignStatusLabels, "campaign_status_labels"); err != nil {
		return err
	}
	if err := requireStatusLabels(cfg.TournamentStatuses, cfg.TournamentStatusLabels, "tournament_status_labels"); err != nil {
		return err
	}
	if err := requireStatusLabels(cfg.TournamentBracketStatuses, cfg.TournamentBracketStatusLabels, "tournament_bracket_status_labels"); err != nil {
		return err
	}
	if err := requireStatusLabels(cfg.CreativeTypes, cfg.CreativeTypeLabels, "creative_type_labels"); err != nil {
		return err
	}
	if err := requireStatusLabels(cfg.HostedEventReportStatuses, cfg.HostedEventReportStatusLabels, "hosted_event_report_status_labels"); err != nil {
		return err
	}
	if err := requireStatusLabels(cfg.HostedEventVisibilities, cfg.HostedEventVisibilityLabels, "hosted_event_visibility_labels"); err != nil {
		return err
	}
	if err := requireWalletLedgerKinds(cfg.WalletLedgerKinds); err != nil {
		return err
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.enums = cfg
	s.mu.Unlock()
	return nil
}

// requireWalletLedgerKinds fail-closes when prize-pool guarantee ledger kinds are missing from client_enums.
func requireWalletLedgerKinds(kinds []string) error {
	need := []string{
		"event_host_fee",
		"event_entry_paid",
		"event_entry_earned",
		"event_entry_commission",
		"event_entry_refund",
		"event_entry_clawback",
		"campaign_create_fee",
		"prize_pool_guarantee_hold",
		"prize_pool_guarantee_release",
		"prize_pool_guarantee_capture",
		"competition_prize_payout",
		"tournament_entry_refund",
	}
	have := make(map[string]struct{}, len(kinds))
	for _, k := range kinds {
		k = strings.TrimSpace(k)
		if k != "" {
			have[k] = struct{}{}
		}
	}
	for _, k := range need {
		if _, ok := have[k]; !ok {
			return fmt.Errorf("client_enums wallet_ledger_kinds missing %s", k)
		}
	}
	return nil
}

func requireStatusLabels(codes []string, labels map[string]string, field string) error {
	if len(codes) == 0 {
		return fmt.Errorf("client_enums %s: empty codes", field)
	}
	if labels == nil {
		return fmt.Errorf("client_enums %s missing", field)
	}
	for _, code := range codes {
		code = strings.TrimSpace(code)
		if code == "" {
			continue
		}
		if strings.TrimSpace(labels[code]) == "" {
			return fmt.Errorf("client_enums %s missing label for %s", field, code)
		}
	}
	return nil
}

// StatusLabel returns the DB display label for a status code, or empty when missing.
func StatusLabel(labels map[string]string, status string) string {
	if labels == nil {
		return ""
	}
	return strings.TrimSpace(labels[strings.TrimSpace(status)])
}

func (s *SettingsStore) ClientEnums() ClientEnumsConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cp := s.enums
	cp.Roles = append([]string{}, s.enums.Roles...)
	cp.ConsoleRoles = append([]string{}, s.enums.ConsoleRoles...)
	cp.PublisherRoles = append([]string{}, s.enums.PublisherRoles...)
	cp.TournamentStatuses = append([]string{}, s.enums.TournamentStatuses...)
	cp.CampaignStatuses = append([]string{}, s.enums.CampaignStatuses...)
	cp.CreativeTypes = append([]string{}, s.enums.CreativeTypes...)
	cp.EthiopiaPaymentModes = append([]EthiopiaPaymentModeOption{}, s.enums.EthiopiaPaymentModes...)
	cp.HostedEventStatuses = append([]string{}, s.enums.HostedEventStatuses...)
	cp.HostedEventJoinableStatuses = append([]string{}, s.enums.HostedEventJoinableStatuses...)
	cp.HostedEventFormats = append([]string{}, s.enums.HostedEventFormats...)
	cp.HostedEventEntryStatuses = append([]string{}, s.enums.HostedEventEntryStatuses...)
	cp.HostedEventBracketStatuses = append([]string{}, s.enums.HostedEventBracketStatuses...)
	cp.HostedEventVisibilities = append([]string{}, s.enums.HostedEventVisibilities...)
	cp.HostedEventReportStatuses = append([]string{}, s.enums.HostedEventReportStatuses...)
	cp.HostedEventStatusLabels = cloneStringMap(s.enums.HostedEventStatusLabels)
	cp.HostedEventEntryStatusLabels = cloneStringMap(s.enums.HostedEventEntryStatusLabels)
	cp.HostedEventBracketStatusLabels = cloneStringMap(s.enums.HostedEventBracketStatusLabels)
	cp.HostedEventReportStatusLabels = cloneStringMap(s.enums.HostedEventReportStatusLabels)
	cp.HostedEventVisibilityLabels = cloneStringMap(s.enums.HostedEventVisibilityLabels)
	cp.CampaignStatusLabels = cloneStringMap(s.enums.CampaignStatusLabels)
	cp.TournamentStatusLabels = cloneStringMap(s.enums.TournamentStatusLabels)
	cp.TournamentFormats = append([]string{}, s.enums.TournamentFormats...)
	cp.TournamentBracketStatuses = append([]string{}, s.enums.TournamentBracketStatuses...)
	cp.TournamentBracketStatusLabels = cloneStringMap(s.enums.TournamentBracketStatusLabels)
	cp.CreativeTypeLabels = cloneStringMap(s.enums.CreativeTypeLabels)
	cp.WalletLedgerKinds = append([]string{}, s.enums.WalletLedgerKinds...)
	cp.CompetitionPrizePayoutStatuses = append([]string{}, s.enums.CompetitionPrizePayoutStatuses...)
	return cp
}

func cloneStringMap(in map[string]string) map[string]string {
	if in == nil {
		return nil
	}
	out := make(map[string]string, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}

func (s *SettingsStore) ReloadClientNav(ctx context.Context) error {
	if s.db == nil || !s.db.Ready() {
		return nil
	}
	row := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'client_nav'`)
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		return fmt.Errorf("client_nav scan: %w", err)
	}
	var cfg ClientNavConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return fmt.Errorf("client_nav unmarshal: %w", err)
	}
	if len(cfg.Player) == 0 || len(cfg.Ads) == 0 || len(cfg.Events) == 0 ||
		len(cfg.Marketing) == 0 || len(cfg.Mobile) == 0 || len(cfg.Dashboard) == 0 {
		return fmt.Errorf("client_nav incomplete in platform_settings (player=%d ads=%d events=%d marketing=%d mobile=%d dashboard=%d)",
			len(cfg.Player), len(cfg.Ads), len(cfg.Events), len(cfg.Marketing), len(cfg.Mobile), len(cfg.Dashboard))
	}
	if len(cfg.BottomNav.Player) == 0 || len(cfg.BottomNav.Mobile) == 0 ||
		len(cfg.BottomNav.Ads) == 0 || len(cfg.BottomNav.Events) == 0 {
		return fmt.Errorf("client_nav bottom_nav incomplete in platform_settings (player=%d mobile=%d ads=%d events=%d)",
			len(cfg.BottomNav.Player), len(cfg.BottomNav.Mobile), len(cfg.BottomNav.Ads), len(cfg.BottomNav.Events))
	}
	if strings.TrimSpace(cfg.MobileNavUnavailable) == "" {
		return errors.New("client_nav mobile_nav_unavailable required")
	}
	if strings.TrimSpace(cfg.BrandName) == "" ||
		strings.TrimSpace(cfg.AdsBrandName) == "" ||
		strings.TrimSpace(cfg.EventsBrandName) == "" ||
		strings.TrimSpace(cfg.EventsNavUnavailable) == "" ||
		strings.TrimSpace(cfg.DashboardPageTitle) == "" ||
		strings.TrimSpace(cfg.DashboardPageBlurb) == "" ||
		strings.TrimSpace(cfg.ProfileLoadFailed) == "" ||
		strings.TrimSpace(cfg.DashboardUnavailable) == "" ||
		strings.TrimSpace(cfg.DashboardHistoryTitle) == "" ||
		strings.TrimSpace(cfg.DashboardHistoryEmpty) == "" ||
		strings.TrimSpace(cfg.DashboardHistoryUnavailable) == "" ||
		strings.TrimSpace(cfg.DashboardProfileAction) == "" ||
		strings.TrimSpace(cfg.DashboardProfileHref) == "" ||
		strings.TrimSpace(cfg.DashboardPlayAction) == "" ||
		strings.TrimSpace(cfg.DashboardPlayHref) == "" ||
		strings.TrimSpace(cfg.DashboardWinRateLabel) == "" ||
		strings.TrimSpace(cfg.DashboardPercentSuffix) == "" ||
		strings.TrimSpace(cfg.DashboardMatchesSuffix) == "" ||
		strings.TrimSpace(cfg.DashboardMatchesJoiner) == "" ||
		strings.TrimSpace(cfg.DashboardRecentResultsTitle) == "" ||
		strings.TrimSpace(cfg.DashboardTransactionsAction) == "" ||
		strings.TrimSpace(cfg.DashboardTransactionsHref) == "" ||
		strings.TrimSpace(cfg.DashboardFindMatchAction) == "" ||
		strings.TrimSpace(cfg.DashboardWalletHref) == "" ||
		strings.TrimSpace(cfg.DashboardColResult) == "" ||
		strings.TrimSpace(cfg.DashboardColMode) == "" ||
		strings.TrimSpace(cfg.DashboardColMoves) == "" ||
		strings.TrimSpace(cfg.DashboardColDate) == "" ||
		strings.TrimSpace(cfg.SettingsSessionLabel) == "" ||
		strings.TrimSpace(cfg.SettingsUnavailable) == "" ||
		strings.TrimSpace(cfg.MarketingHeroEyebrow) == "" ||
		strings.TrimSpace(cfg.MarketingHeroBlurb) == "" ||
		strings.TrimSpace(cfg.MarketingFooterText) == "" ||
		strings.TrimSpace(cfg.SiteTitleDefault) == "" ||
		strings.TrimSpace(cfg.SiteTitleTemplate) == "" ||
		strings.TrimSpace(cfg.SiteDescription) == "" ||
		strings.TrimSpace(cfg.GraphqlEmpty) == "" {
		return errors.New("client_nav dashboard/brand/marketing chrome incomplete")
	}
	for _, group := range [][]ClientNavLink{
		cfg.Player, cfg.Ads, cfg.Events, cfg.Marketing, cfg.Mobile, cfg.Dashboard,
		cfg.BottomNav.Player, cfg.BottomNav.Mobile, cfg.BottomNav.Ads, cfg.BottomNav.Events,
	} {
		for _, m := range group {
			if m.Title == "" || m.RouteKey == "" {
				return fmt.Errorf("client_nav link title and route_key required (title=%q route_key=%q)", m.Title, m.RouteKey)
			}
		}
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.cNav = cfg
	s.mu.Unlock()
	return nil
}

func (s *SettingsStore) ClientNav() ClientNavConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cp := s.cNav
	cp.Player = append([]ClientNavLink{}, s.cNav.Player...)
	cp.Ads = append([]ClientNavLink{}, s.cNav.Ads...)
	cp.Events = append([]ClientNavLink{}, s.cNav.Events...)
	cp.Marketing = append([]ClientNavLink{}, s.cNav.Marketing...)
	cp.Mobile = append([]ClientNavLink{}, s.cNav.Mobile...)
	cp.Dashboard = append([]ClientNavLink{}, s.cNav.Dashboard...)
	cp.BottomNav.Player = append([]ClientNavLink{}, s.cNav.BottomNav.Player...)
	cp.BottomNav.Mobile = append([]ClientNavLink{}, s.cNav.BottomNav.Mobile...)
	cp.BottomNav.Ads = append([]ClientNavLink{}, s.cNav.BottomNav.Ads...)
	cp.BottomNav.Events = append([]ClientNavLink{}, s.cNav.BottomNav.Events...)
	return cp
}

func (s *SettingsStore) ReloadFeatureFlagCatalog(ctx context.Context) error {
	if s.db == nil || !s.db.Ready() {
		return nil
	}
	row := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'feature_flag_catalog'`)
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		return err
	}
	var cfg FeatureFlagCatalogConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	if len(cfg.Toggles) == 0 || cfg.AIDepthsFlagKey == "" || cfg.CashRmgFlagKey == "" {
		return errors.New("feature_flag_catalog incomplete in platform_settings")
	}
	for _, t := range cfg.Toggles {
		if t.Key == "" || t.Title == "" || t.Kind == "" {
			return errors.New("feature_flag_catalog toggle key, title, and kind required")
		}
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.ffCat = cfg
	s.mu.Unlock()
	return nil
}

func (s *SettingsStore) FeatureFlagCatalog() FeatureFlagCatalogConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cp := s.ffCat
	cp.Toggles = append([]FeatureFlagToggle{}, s.ffCat.Toggles...)
	return cp
}

func (s *SettingsStore) IsCatalogFlagKey(key string) bool {
	for _, t := range s.FeatureFlagCatalog().Toggles {
		if t.Key == key {
			return true
		}
	}
	return false
}

func (s *SettingsStore) IsConsoleRole(role string) bool {
	for _, r := range s.ClientEnums().ConsoleRoles {
		if r == role {
			return true
		}
	}
	return false
}

func (s *SettingsStore) IsPublisherRole(role string) bool {
	for _, r := range s.ClientEnums().PublisherRoles {
		if r == role {
			return true
		}
	}
	return false
}

func (s *SettingsStore) IsAllowedEthiopiaPaymentMode(mode string) bool {
	for _, m := range s.ClientEnums().EthiopiaPaymentModes {
		if m.Mode == mode {
			return true
		}
	}
	return false
}

func (s *SettingsStore) IsAllowedRole(role string) bool {
	for _, r := range s.ClientEnums().Roles {
		if r == role {
			return true
		}
	}
	return false
}

func (s *SettingsStore) IsAllowedTournamentStatus(status string) bool {
	for _, st := range s.ClientEnums().TournamentStatuses {
		if st == status {
			return true
		}
	}
	return false
}

func (s *SettingsStore) IsAllowedCampaignStatus(status string) bool {
	for _, st := range s.ClientEnums().CampaignStatuses {
		if st == status {
			return true
		}
	}
	return false
}

func (s *SettingsStore) IsAllowedCreativeType(t string) bool {
	for _, ct := range s.ClientEnums().CreativeTypes {
		if ct == t {
			return true
		}
	}
	return false
}

func (s *SettingsStore) IsAllowedHostedEventStatus(status string) bool {
	for _, st := range s.ClientEnums().HostedEventStatuses {
		if st == status {
			return true
		}
	}
	return false
}

func (s *SettingsStore) IsJoinableHostedEventStatus(status string) bool {
	for _, st := range s.ClientEnums().HostedEventJoinableStatuses {
		if st == status {
			return true
		}
	}
	return false
}

func (s *SettingsStore) IsAllowedHostedEventFormat(format string) bool {
	for _, f := range s.ClientEnums().HostedEventFormats {
		if f == format {
			return true
		}
	}
	return false
}

// IsAllowedTournamentFormat: must be in client_enums.tournament_formats and, when events_catalog
// defines formats, must be enabled there (fail closed when catalog has no enabled match).
func (s *SettingsStore) IsAllowedTournamentFormat(formatID string) bool {
	formatID = strings.TrimSpace(formatID)
	if formatID == "" {
		return false
	}
	found := false
	for _, f := range s.ClientEnums().TournamentFormats {
		if f == formatID {
			found = true
			break
		}
	}
	if !found {
		return false
	}
	cat := s.EventsCatalog()
	if len(cat.Formats) == 0 {
		return true
	}
	for _, f := range cat.Formats {
		if f.ID == formatID && f.Enabled {
			return true
		}
	}
	return false
}

// ResolveTournamentFormatID applies TournamentDefaultFormat when formatID is empty (never hardcode).
func (s *SettingsStore) ResolveTournamentFormatID(formatID string) (string, error) {
	formatID = strings.TrimSpace(formatID)
	if formatID == "" {
		formatID = strings.TrimSpace(s.ClientEnums().TournamentDefaultFormat)
		if formatID == "" {
			return "", errors.New("tournament default format unavailable")
		}
	}
	if !s.IsAllowedTournamentFormat(formatID) {
		return "", errors.New("invalid format_id")
	}
	return formatID, nil
}

func (s *SettingsStore) IsAllowedHostedEventEntryStatus(status string) bool {
	for _, st := range s.ClientEnums().HostedEventEntryStatuses {
		if st == status {
			return true
		}
	}
	return false
}

func (s *SettingsStore) IsAllowedHostedEventVisibility(visibility string) bool {
	for _, v := range s.ClientEnums().HostedEventVisibilities {
		if v == visibility {
			return true
		}
	}
	return false
}

func (s *SettingsStore) IsAllowedHostedEventReportStatus(status string) bool {
	for _, st := range s.ClientEnums().HostedEventReportStatuses {
		if st == status {
			return true
		}
	}
	return false
}

func (s *SettingsStore) IsAllowedEventsReportReason(code string) bool {
	code = strings.TrimSpace(code)
	for _, c := range s.EventsCatalog().ReportReasonCodes {
		if c == code {
			return true
		}
	}
	return false
}

func validateEventsCatalog(cfg *EventsCatalogConfig, arenaFormatID string) error {
	if cfg == nil {
		return errors.New("events_catalog missing")
	}
	if cfg.JoinCodeLength < 4 || cfg.JoinCodeLength > 16 {
		return errors.New("events_catalog.join_code_length invalid")
	}
	if strings.TrimSpace(cfg.JoinCodeAlphabet) == "" || len(cfg.JoinCodeAlphabet) < cfg.JoinCodeLength {
		return errors.New("events_catalog.join_code_alphabet incomplete")
	}
	if strings.TrimSpace(cfg.SharePathTemplate) == "" || !strings.Contains(cfg.SharePathTemplate, "{code}") {
		return errors.New("events_catalog.share_path_template requires {code}")
	}
	if strings.TrimSpace(cfg.QRFilenamePrefix) == "" {
		return errors.New("events_catalog.qr_filename_prefix required")
	}
	if cfg.PublicHostFeeMultiplier <= 0 {
		return errors.New("events_catalog.public_host_fee_multiplier required (>0)")
	}
	if cfg.EntryFeeCommissionPercent < 0 || cfg.EntryFeeCommissionPercent > 100 {
		return errors.New("events_catalog.entry_fee_commission_percent must be 0-100")
	}
	if strings.TrimSpace(cfg.DefaultVisibility) == "" {
		return errors.New("events_catalog.default_visibility required")
	}
	if len(cfg.ReportReasonCodes) == 0 {
		return errors.New("events_catalog.report_reason_codes required")
	}
	if err := requireStatusLabels(cfg.ReportReasonCodes, cfg.ReportReasonLabels, "events_catalog.report_reason_labels"); err != nil {
		return err
	}
	if len(cfg.Formats) == 0 || len(cfg.Sizes) == 0 || len(cfg.MinPlayersToStart) == 0 {
		return errors.New("events_catalog formats/sizes/min_players_to_start required")
	}
	if len(cfg.SwissRoundsByMaxPlayers) == 0 {
		return errors.New("events_catalog.swiss_rounds_by_max_players required")
	}
	for k, v := range cfg.SwissRoundsByMaxPlayers {
		if strings.TrimSpace(k) == "" || v < 1 {
			return errors.New("events_catalog.swiss_rounds_by_max_players invalid")
		}
	}
	if cfg.GroupsKnockoutTargetGroupSize < 2 {
		return errors.New("events_catalog.groups_knockout_target_group_size required (>=2)")
	}
	if cfg.GroupsKnockoutAdvancePerGroup < 1 {
		return errors.New("events_catalog.groups_knockout_advance_per_group required (>=1)")
	}
	formatIDs := map[string]bool{}
	enabledFormat := false
	for _, f := range cfg.Formats {
		if strings.TrimSpace(f.ID) == "" {
			return errors.New("events_catalog.format.id required")
		}
		if strings.TrimSpace(f.Label) == "" {
			return fmt.Errorf("events_catalog.format.%s.label required", f.ID)
		}
		formatIDs[f.ID] = true
		if f.Enabled {
			enabledFormat = true
		}
		if _, ok := cfg.MinPlayersToStart[f.ID]; !ok || cfg.MinPlayersToStart[f.ID] < 2 {
			return fmt.Errorf("events_catalog.min_players_to_start.%s required (>=2)", f.ID)
		}
	}
	if !enabledFormat {
		return errors.New("events_catalog requires at least one enabled format")
	}
	enabledSize := false
	seenSizeIDs := map[string]bool{}
	arenaID := strings.TrimSpace(arenaFormatID)
	for i := range cfg.Sizes {
		sz := &cfg.Sizes[i]
		if strings.TrimSpace(sz.ID) == "" || strings.TrimSpace(sz.Label) == "" ||
			len(sz.AllowedFormatIDs) == 0 {
			return errors.New("events_catalog.size incomplete")
		}
		if SeatCapRequiresArenaOnly(sz.MaxPlayers, cfg.SwissRoundsByMaxPlayers) {
			// Null Unlimited or high safety ceiling: Arena only.
			if arenaID == "" {
				return errors.New("events_catalog.size unlimited requires arena format id")
			}
			if len(sz.AllowedFormatIDs) != 1 || strings.TrimSpace(sz.AllowedFormatIDs[0]) != arenaID {
				return fmt.Errorf("events_catalog.size %s unlimited requires arena only", sz.ID)
			}
		} else if sz.MaxPlayers != nil && *sz.MaxPlayers < 2 {
			return fmt.Errorf("events_catalog.size %s max_players must be null (unlimited) or >= 2", sz.ID)
		}
		if seenSizeIDs[sz.ID] {
			return fmt.Errorf("events_catalog.size %s duplicate id", sz.ID)
		}
		seenSizeIDs[sz.ID] = true
		if err := normalizeAndValidateSizeHostFees(sz); err != nil {
			return err
		}
		for _, fid := range sz.AllowedFormatIDs {
			if !formatIDs[fid] {
				return fmt.Errorf("events_catalog.size %s references unknown format %s", sz.ID, fid)
			}
		}
		if sz.Enabled {
			enabledSize = true
		}
	}
	if !enabledSize {
		return errors.New("events_catalog requires at least one enabled size")
	}
	return nil
}

func (s *SettingsStore) ReloadEventsCatalog(ctx context.Context) error {
	if s.db == nil || !s.db.Ready() {
		return nil
	}
	row := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'events_catalog'`)
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		return err
	}
	var rawMap map[string]json.RawMessage
	if err := json.Unmarshal(raw, &rawMap); err != nil {
		return err
	}
	if _, ok := rawMap["entry_fee_commission_percent"]; !ok {
		return errors.New("events_catalog.entry_fee_commission_percent required")
	}
	var cfg EventsCatalogConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	arenaFormatID := strings.TrimSpace(s.ClientEnums().HostedEventArenaFormat)
	if err := validateEventsCatalog(&cfg, arenaFormatID); err != nil {
		return err
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.eventsCat = cfg
	s.mu.Unlock()
	return nil
}

func (s *SettingsStore) EventsCatalog() EventsCatalogConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cp := s.eventsCat
	cp.Formats = append([]EventsCatalogFormat{}, s.eventsCat.Formats...)
	cp.Sizes = append([]EventsCatalogSize{}, s.eventsCat.Sizes...)
	cp.ReportReasonCodes = append([]string{}, s.eventsCat.ReportReasonCodes...)
	if s.eventsCat.MinPlayersToStart != nil {
		cp.MinPlayersToStart = make(map[string]int, len(s.eventsCat.MinPlayersToStart))
		for k, v := range s.eventsCat.MinPlayersToStart {
			cp.MinPlayersToStart[k] = v
		}
	}
	for i := range cp.Sizes {
		cp.Sizes[i].AllowedFormatIDs = append([]string{}, s.eventsCat.Sizes[i].AllowedFormatIDs...)
	}
	return cp
}

// CompetitionArenaSettingsPatch updates platform_settings.client_enums arena keys only.
type CompetitionArenaSettingsPatch struct {
	CompetitionArenaPointsWin              string `json:"competition_arena_points_win"`
	CompetitionArenaPointsDraw             string `json:"competition_arena_points_draw"`
	CompetitionArenaPointsLoss             string `json:"competition_arena_points_loss"`
	CompetitionArenaStreakSecondWin        string `json:"competition_arena_streak_second_win"`
	CompetitionArenaStreakThirdPlusWin     string `json:"competition_arena_streak_third_plus_win"`
	CompetitionArenaDefaultDurationMinutes string `json:"competition_arena_default_duration_minutes"`
	CompetitionArenaDefaultPairingMode     string `json:"competition_arena_default_pairing_mode"`
	CompetitionArenaAutoStart              string `json:"competition_arena_auto_start"`
	CompetitionArenaPairIntervalSeconds    string `json:"competition_arena_pair_interval_seconds"`
	CompetitionArenaAllowJoinWhileLive     string `json:"competition_arena_allow_join_while_live"`
}

func validateBoolStringField(field, val string) error {
	v := strings.ToLower(strings.TrimSpace(val))
	if v != "true" && v != "false" {
		return fmt.Errorf("%s must be true or false", field)
	}
	return nil
}

func validatePositiveIntStringField(field, val string) error {
	raw := strings.TrimSpace(val)
	if raw == "" {
		return fmt.Errorf("%s required", field)
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return fmt.Errorf("%s must be a positive integer", field)
	}
	return nil
}

func validateNonNegativeIntStringField(field, val string) error {
	raw := strings.TrimSpace(val)
	if raw == "" {
		return fmt.Errorf("%s required", field)
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 0 {
		return fmt.Errorf("%s must be a non-negative integer", field)
	}
	return nil
}

// CompetitionPrizeSettleSettingsPatch updates dispute window + auto-settle worker keys in client_enums.
// Applies to platform tournaments and organizer hosted events (shared escrow/settle pipeline).
type CompetitionPrizeSettleSettingsPatch struct {
	CompetitionPrizeAutoSettle            string `json:"competition_prize_auto_settle"`
	CompetitionDisputeWindowHours         string `json:"competition_dispute_window_hours"`
	CompetitionPrizeSettleIntervalMinutes string `json:"competition_prize_settle_interval_minutes"`
}

func (s *SettingsStore) SetCompetitionPrizeSettleSettings(ctx context.Context, patch CompetitionPrizeSettleSettingsPatch) error {
	if s.db == nil || !s.db.Ready() {
		return errors.New("database required to persist client_enums")
	}
	cur := s.ClientEnums()
	if cur.Source != "database" {
		return errors.New("client_enums unavailable")
	}
	if err := validateBoolStringField("competition_prize_auto_settle", patch.CompetitionPrizeAutoSettle); err != nil {
		return err
	}
	if err := validateNonNegativeIntStringField("competition_dispute_window_hours", patch.CompetitionDisputeWindowHours); err != nil {
		return err
	}
	if err := validatePositiveIntStringField("competition_prize_settle_interval_minutes", patch.CompetitionPrizeSettleIntervalMinutes); err != nil {
		return err
	}
	merge := map[string]any{
		"competition_prize_auto_settle":             strings.ToLower(strings.TrimSpace(patch.CompetitionPrizeAutoSettle)),
		"competition_dispute_window_hours":          strings.TrimSpace(patch.CompetitionDisputeWindowHours),
		"competition_prize_settle_interval_minutes": strings.TrimSpace(patch.CompetitionPrizeSettleIntervalMinutes),
	}
	raw, err := json.Marshal(merge)
	if err != nil {
		return err
	}
	_, err = s.db.Pool.Exec(ctx, `
		UPDATE platform_settings
		SET value = value || $1::jsonb, updated_at = NOW()
		WHERE key = 'client_enums'`, string(raw))
	if err != nil {
		return err
	}
	return s.ReloadClientEnums(ctx)
}

func (s *SettingsStore) SetCompetitionArenaSettings(ctx context.Context, patch CompetitionArenaSettingsPatch) error {
	if s.db == nil || !s.db.Ready() {
		return errors.New("database required to persist client_enums")
	}
	cur := s.ClientEnums()
	if cur.Source != "database" {
		return errors.New("client_enums unavailable")
	}
	modes := cur.CompetitionArenaPairingModes
	if len(modes) == 0 {
		return errors.New("competition_arena_pairing_modes unavailable")
	}
	checks := []struct {
		field string
		val   string
	}{
		{"competition_arena_points_win", patch.CompetitionArenaPointsWin},
		{"competition_arena_points_draw", patch.CompetitionArenaPointsDraw},
		{"competition_arena_points_loss", patch.CompetitionArenaPointsLoss},
		{"competition_arena_streak_second_win", patch.CompetitionArenaStreakSecondWin},
		{"competition_arena_streak_third_plus_win", patch.CompetitionArenaStreakThirdPlusWin},
	}
	for _, c := range checks {
		if strings.TrimSpace(c.val) == "" {
			return fmt.Errorf("%s required", c.field)
		}
	}
	if err := validatePositiveIntStringField("competition_arena_default_duration_minutes", patch.CompetitionArenaDefaultDurationMinutes); err != nil {
		return err
	}
	if err := validatePositiveIntStringField("competition_arena_pair_interval_seconds", patch.CompetitionArenaPairIntervalSeconds); err != nil {
		return err
	}
	if err := validateBoolStringField("competition_arena_auto_start", patch.CompetitionArenaAutoStart); err != nil {
		return err
	}
	if err := validateBoolStringField("competition_arena_allow_join_while_live", patch.CompetitionArenaAllowJoinWhileLive); err != nil {
		return err
	}
	mode := strings.TrimSpace(patch.CompetitionArenaDefaultPairingMode)
	if mode == "" {
		return errors.New("competition_arena_default_pairing_mode required")
	}
	modeOK := false
	for _, m := range modes {
		if strings.TrimSpace(m) == mode {
			modeOK = true
			break
		}
	}
	if !modeOK {
		return fmt.Errorf("competition_arena_default_pairing_mode invalid")
	}
	merge := map[string]any{
		"competition_arena_points_win":               strings.TrimSpace(patch.CompetitionArenaPointsWin),
		"competition_arena_points_draw":              strings.TrimSpace(patch.CompetitionArenaPointsDraw),
		"competition_arena_points_loss":              strings.TrimSpace(patch.CompetitionArenaPointsLoss),
		"competition_arena_streak_second_win":        strings.TrimSpace(patch.CompetitionArenaStreakSecondWin),
		"competition_arena_streak_third_plus_win":    strings.TrimSpace(patch.CompetitionArenaStreakThirdPlusWin),
		"competition_arena_default_duration_minutes": strings.TrimSpace(patch.CompetitionArenaDefaultDurationMinutes),
		"competition_arena_default_pairing_mode":     mode,
		"competition_arena_auto_start":               strings.ToLower(strings.TrimSpace(patch.CompetitionArenaAutoStart)),
		"competition_arena_pair_interval_seconds":    strings.TrimSpace(patch.CompetitionArenaPairIntervalSeconds),
		"competition_arena_allow_join_while_live":    strings.ToLower(strings.TrimSpace(patch.CompetitionArenaAllowJoinWhileLive)),
	}
	raw, err := json.Marshal(merge)
	if err != nil {
		return err
	}
	_, err = s.db.Pool.Exec(ctx, `
		UPDATE platform_settings
		SET value = value || $1::jsonb, updated_at = NOW()
		WHERE key = 'client_enums'`, string(raw))
	if err != nil {
		return err
	}
	return s.ReloadClientEnums(ctx)
}

// CompetitionStandingsSettingsPatch updates standings points per win/draw in client_enums.
type CompetitionStandingsSettingsPatch struct {
	CompetitionStandingsPointsWin  string `json:"competition_standings_points_win"`
	CompetitionStandingsPointsDraw string `json:"competition_standings_points_draw"`
}

func (s *SettingsStore) SetCompetitionStandingsSettings(ctx context.Context, patch CompetitionStandingsSettingsPatch) error {
	if s.db == nil || !s.db.Ready() {
		return errors.New("database required to persist client_enums")
	}
	cur := s.ClientEnums()
	if cur.Source != "database" {
		return errors.New("client_enums unavailable")
	}
	winRaw := strings.TrimSpace(patch.CompetitionStandingsPointsWin)
	drawRaw := strings.TrimSpace(patch.CompetitionStandingsPointsDraw)
	if winRaw == "" {
		return errors.New("competition_standings_points_win required")
	}
	if drawRaw == "" {
		return errors.New("competition_standings_points_draw required")
	}
	win, err := strconv.Atoi(winRaw)
	if err != nil || win < 0 {
		return errors.New("competition_standings_points_win invalid")
	}
	draw, err := strconv.Atoi(drawRaw)
	if err != nil || draw < 0 {
		return errors.New("competition_standings_points_draw invalid")
	}
	merge := map[string]any{
		"competition_standings_points_win":  strconv.Itoa(win),
		"competition_standings_points_draw": strconv.Itoa(draw),
	}
	raw, err := json.Marshal(merge)
	if err != nil {
		return err
	}
	_, err = s.db.Pool.Exec(ctx, `
		UPDATE platform_settings
		SET value = value || $1::jsonb, updated_at = NOW()
		WHERE key = 'client_enums'`, string(raw))
	if err != nil {
		return err
	}
	return s.ReloadClientEnums(ctx)
}

// CompetitionPointsToastSettings holds DB-backed labels + notification copy for points toasts.
type CompetitionPointsToastSettings struct {
	ArenaPointsLabel      string `json:"arena_points_label"`
	StandingsPointsLabel  string `json:"standings_points_label"`
	ToastPointsAwardedFmt string `json:"toast_points_awarded_fmt"`
	NotifTitleTemplate    string `json:"notif_title_template"`
	NotifBodyTemplate     string `json:"notif_body_template"`
}

// CompetitionPointsToastSettingsPatch updates player chrome labels and the points-awarded notification kind.
type CompetitionPointsToastSettingsPatch struct {
	ArenaPointsLabel      string `json:"arena_points_label"`
	StandingsPointsLabel  string `json:"standings_points_label"`
	ToastPointsAwardedFmt string `json:"toast_points_awarded_fmt"`
	NotifTitleTemplate    string `json:"notif_title_template"`
	NotifBodyTemplate     string `json:"notif_body_template"`
}

func countPrintfVerbs(s string) int {
	n := 0
	for i := 0; i < len(s); i++ {
		if s[i] != '%' {
			continue
		}
		if i+1 < len(s) && s[i+1] == '%' {
			i++
			continue
		}
		n++
	}
	return n
}

func (s *SettingsStore) GetCompetitionPointsToastSettings(ctx context.Context) (CompetitionPointsToastSettings, error) {
	out := CompetitionPointsToastSettings{}
	if s.db == nil || !s.db.Ready() {
		return out, errors.New("database required")
	}
	var raw []byte
	err := s.db.Pool.QueryRow(ctx, `
		SELECT value FROM platform_settings WHERE key = 'tournaments_player_chrome'`).Scan(&raw)
	if err != nil {
		return out, err
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return out, err
	}
	asStr := func(k string) string {
		if v, ok := m[k].(string); ok {
			return strings.TrimSpace(v)
		}
		return ""
	}
	out.ArenaPointsLabel = asStr("arena_points_label")
	out.StandingsPointsLabel = asStr("standings_points_label")
	out.ToastPointsAwardedFmt = asStr("toast_points_awarded_fmt")
	err = s.db.Pool.QueryRow(ctx, `
		SELECT COALESCE(title_template,''), COALESCE(body_template,'')
		FROM notification_kinds WHERE code = 'player.competition_points_awarded'`).Scan(
		&out.NotifTitleTemplate, &out.NotifBodyTemplate,
	)
	if err != nil {
		return out, err
	}
	out.NotifTitleTemplate = strings.TrimSpace(out.NotifTitleTemplate)
	out.NotifBodyTemplate = strings.TrimSpace(out.NotifBodyTemplate)
	if out.ArenaPointsLabel == "" || out.StandingsPointsLabel == "" || out.ToastPointsAwardedFmt == "" ||
		out.NotifTitleTemplate == "" || out.NotifBodyTemplate == "" {
		return out, errors.New("points toast settings incomplete")
	}
	return out, nil
}

func (s *SettingsStore) SetCompetitionPointsToastSettings(ctx context.Context, patch CompetitionPointsToastSettingsPatch) error {
	if s.db == nil || !s.db.Ready() {
		return errors.New("database required to persist points toast settings")
	}
	arena := strings.TrimSpace(patch.ArenaPointsLabel)
	standings := strings.TrimSpace(patch.StandingsPointsLabel)
	fmtStr := strings.TrimSpace(patch.ToastPointsAwardedFmt)
	title := strings.TrimSpace(patch.NotifTitleTemplate)
	body := strings.TrimSpace(patch.NotifBodyTemplate)
	if arena == "" {
		return errors.New("arena_points_label required")
	}
	if standings == "" {
		return errors.New("standings_points_label required")
	}
	if fmtStr == "" {
		return errors.New("toast_points_awarded_fmt required")
	}
	if !strings.Contains(fmtStr, "{points}") || !strings.Contains(fmtStr, "{label}") {
		return errors.New("toast_points_awarded_fmt requires {points} and {label}")
	}
	if title == "" {
		return errors.New("notif_title_template required")
	}
	if body == "" {
		return errors.New("notif_body_template required")
	}
	// EmitPlayer passes points, label, entity title - body must accept 3 verbs.
	if countPrintfVerbs(body) < 3 {
		return errors.New("notif_body_template requires three %s placeholders")
	}
	merge := map[string]any{
		"arena_points_label":       arena,
		"standings_points_label":   standings,
		"toast_points_awarded_fmt": fmtStr,
	}
	raw, err := json.Marshal(merge)
	if err != nil {
		return err
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	for _, key := range []string{"tournaments_player_chrome", "events_player_chrome"} {
		tag, err := tx.Exec(ctx, `
			UPDATE platform_settings
			SET value = value || $1::jsonb, updated_at = NOW()
			WHERE key = $2`, string(raw), key)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return fmt.Errorf("%s missing", key)
		}
	}
	fmtOnly, err := json.Marshal(map[string]any{"toast_points_awarded_fmt": fmtStr})
	if err != nil {
		return err
	}
	for _, key := range []string{"play_chrome", "notification_chrome"} {
		if _, err := tx.Exec(ctx, `
			UPDATE platform_settings
			SET value = value || $1::jsonb, updated_at = NOW()
			WHERE key = $2`, string(fmtOnly), key); err != nil {
			return err
		}
	}
	tag, err := tx.Exec(ctx, `
		UPDATE notification_kinds
		SET title_template = $1, body_template = $2
		WHERE code = 'player.competition_points_awarded'`, title, body)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("player.competition_points_awarded kind missing")
	}
	return tx.Commit(ctx)
}

// CompetitionPayoutDefaultsSettingsPatch updates default payout modes, place percents, and dual-purse split.
type CompetitionPayoutDefaultsSettingsPatch struct {
	CompetitionDefaultPayoutModeKnockout       string `json:"competition_default_payout_mode_knockout"`
	CompetitionDefaultPayoutModeRoundRobin     string `json:"competition_default_payout_mode_round_robin"`
	CompetitionDefaultPayoutModeSwiss          string `json:"competition_default_payout_mode_swiss"`
	CompetitionDefaultPayoutModeGroupsKnockout string `json:"competition_default_payout_mode_groups_knockout"`
	CompetitionDefaultPayoutModeArena          string `json:"competition_default_payout_mode_arena"`
	CompetitionDefaultPlacePercent1            string `json:"competition_default_place_percent_1"`
	CompetitionDefaultPlacePercent2            string `json:"competition_default_place_percent_2"`
	CompetitionDefaultPlacePercent3            string `json:"competition_default_place_percent_3"`
	CompetitionDualPursePlacePercent           string `json:"competition_dual_purse_place_percent"`
}

func (s *SettingsStore) SetCompetitionPayoutDefaultsSettings(ctx context.Context, patch CompetitionPayoutDefaultsSettingsPatch) error {
	if s.db == nil || !s.db.Ready() {
		return errors.New("database required to persist client_enums")
	}
	cur := s.ClientEnums()
	if cur.Source != "database" {
		return errors.New("client_enums unavailable")
	}
	modes := cur.CompetitionPayoutModes
	if len(modes) == 0 {
		return errors.New("competition_payout_modes unavailable")
	}
	modeAllowed := func(mode string) bool {
		mode = strings.TrimSpace(mode)
		if mode == "" {
			return false
		}
		for _, m := range modes {
			if strings.TrimSpace(m) == mode {
				return true
			}
		}
		places := strings.TrimSpace(cur.CompetitionPayoutModePlacesPercent)
		score := strings.TrimSpace(cur.CompetitionPayoutModeScoreShare)
		dual := strings.TrimSpace(cur.CompetitionPayoutModeDualPurse)
		return mode == places || mode == score || mode == dual
	}
	fields := []struct {
		field string
		val   string
	}{
		{"competition_default_payout_mode_knockout", patch.CompetitionDefaultPayoutModeKnockout},
		{"competition_default_payout_mode_round_robin", patch.CompetitionDefaultPayoutModeRoundRobin},
		{"competition_default_payout_mode_swiss", patch.CompetitionDefaultPayoutModeSwiss},
		{"competition_default_payout_mode_groups_knockout", patch.CompetitionDefaultPayoutModeGroupsKnockout},
		{"competition_default_payout_mode_arena", patch.CompetitionDefaultPayoutModeArena},
	}
	merge := map[string]any{}
	for _, f := range fields {
		mode := strings.TrimSpace(f.val)
		if mode == "" {
			return fmt.Errorf("%s required", f.field)
		}
		if !modeAllowed(mode) {
			return fmt.Errorf("%s invalid", f.field)
		}
		merge[f.field] = mode
	}
	pctFields := []struct {
		field string
		val   string
	}{
		{"competition_default_place_percent_1", patch.CompetitionDefaultPlacePercent1},
		{"competition_default_place_percent_2", patch.CompetitionDefaultPlacePercent2},
		{"competition_default_place_percent_3", patch.CompetitionDefaultPlacePercent3},
	}
	asFloat := map[string]float64{}
	for _, f := range pctFields {
		raw := strings.TrimSpace(f.val)
		if raw == "" {
			return fmt.Errorf("%s required", f.field)
		}
		v, err := strconv.ParseFloat(raw, 64)
		if err != nil || v < 0 {
			return fmt.Errorf("%s invalid", f.field)
		}
		asFloat[f.field] = v
	}
	// Validate sum via shared parser (keys "1","2","3").
	placeMap := map[string]float64{
		"1": asFloat["competition_default_place_percent_1"],
		"2": asFloat["competition_default_place_percent_2"],
		"3": asFloat["competition_default_place_percent_3"],
	}
	if _, err := ParsePlacePercentsMap(placeMap); err != nil {
		return errors.New("competition_default_place_percents must sum to 100")
	}
	for k, v := range asFloat {
		merge[k] = strings.TrimSpace(strconv.FormatFloat(v, 'f', -1, 64))
	}
	dualPlaceRaw := strings.TrimSpace(patch.CompetitionDualPursePlacePercent)
	if dualPlaceRaw == "" {
		dualPlaceRaw = strings.TrimSpace(cur.CompetitionDualPursePlacePercent)
	}
	if _, err := DualPursePlacePercentFromRaw(dualPlaceRaw); err != nil {
		return fmt.Errorf("competition_dual_purse_place_percent invalid")
	}
	merge["competition_dual_purse_place_percent"] = dualPlaceRaw
	raw, err := json.Marshal(merge)
	if err != nil {
		return err
	}
	_, err = s.db.Pool.Exec(ctx, `
		UPDATE platform_settings
		SET value = value || $1::jsonb, updated_at = NOW()
		WHERE key = 'client_enums'`, string(raw))
	if err != nil {
		return err
	}
	return s.ReloadClientEnums(ctx)
}

func (s *SettingsStore) SetEventsCatalog(ctx context.Context, cfg EventsCatalogConfig) error {
	// Lock Ethiopia/global currencies from payment_currency before validate (ads create-fee parity).
	// Create/update size bodies send amounts only; currencies are never client-invented.
	if err := s.lockEventsCatalogSizeCurrencies(&cfg); err != nil {
		return err
	}
	arenaFormatID := strings.TrimSpace(s.ClientEnums().HostedEventArenaFormat)
	if err := validateEventsCatalog(&cfg, arenaFormatID); err != nil {
		return err
	}
	if s.db == nil || !s.db.Ready() {
		return errors.New("database required to persist events_catalog")
	}
	raw, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO platform_settings (key, value, updated_at)
		VALUES ('events_catalog', $1::jsonb, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, string(raw))
	if err != nil {
		return err
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.eventsCat = cfg
	s.mu.Unlock()
	return nil
}

func normalizeAndValidateSizeHostFees(sz *EventsCatalogSize) error {
	if sz == nil {
		return errors.New("events_catalog.size missing")
	}
	id := strings.TrimSpace(sz.ID)
	if sz.HostFeeEthiopiaAmount <= 0 && sz.HostFeeAmount > 0 {
		sz.HostFeeEthiopiaAmount = sz.HostFeeAmount
	}
	if strings.TrimSpace(sz.HostFeeEthiopiaCurrency) == "" && strings.TrimSpace(sz.HostFeeCurrency) != "" {
		sz.HostFeeEthiopiaCurrency = strings.ToUpper(strings.TrimSpace(sz.HostFeeCurrency))
	}
	if sz.HostFeeEthiopiaAmount <= 0 {
		return fmt.Errorf("events_catalog.size %s host_fee_ethiopia_amount required", id)
	}
	if strings.TrimSpace(sz.HostFeeEthiopiaCurrency) == "" {
		return fmt.Errorf("events_catalog.size %s host_fee_ethiopia_currency required", id)
	}
	if sz.HostFeeGlobalAmount <= 0 {
		return fmt.Errorf("events_catalog.size %s host_fee_global_amount required", id)
	}
	if strings.TrimSpace(sz.HostFeeGlobalCurrency) == "" {
		return fmt.Errorf("events_catalog.size %s host_fee_global_currency required", id)
	}
	sz.HostFeeEthiopiaCurrency = strings.ToUpper(strings.TrimSpace(sz.HostFeeEthiopiaCurrency))
	sz.HostFeeGlobalCurrency = strings.ToUpper(strings.TrimSpace(sz.HostFeeGlobalCurrency))
	// Legacy mirrors Ethiopia pair (same as ads create-fee Ethiopia mirror keys).
	sz.HostFeeAmount = sz.HostFeeEthiopiaAmount
	sz.HostFeeCurrency = sz.HostFeeEthiopiaCurrency
	return nil
}

func (s *SettingsStore) lockEventsCatalogSizeCurrencies(cfg *EventsCatalogConfig) error {
	if s == nil || cfg == nil {
		return errors.New("events_catalog missing")
	}
	pay := s.Currency()
	etCur := strings.ToUpper(strings.TrimSpace(pay.Ethiopia))
	glCur := strings.ToUpper(strings.TrimSpace(pay.Global))
	if etCur == "" || glCur == "" || pay.Source != "database" {
		return errors.New("payment_currency required to lock host size fees")
	}
	for i := range cfg.Sizes {
		cfg.Sizes[i].HostFeeEthiopiaCurrency = etCur
		cfg.Sizes[i].HostFeeGlobalCurrency = glCur
		cfg.Sizes[i].HostFeeCurrency = etCur
		if cfg.Sizes[i].HostFeeEthiopiaAmount > 0 {
			cfg.Sizes[i].HostFeeAmount = cfg.Sizes[i].HostFeeEthiopiaAmount
		}
	}
	return nil
}

// HostFeeForSizeCountry returns Ethiopia or global host-fee pair for an ISO country (ads create-fee parity).
func (s *SettingsStore) HostFeeForSizeCountry(sz EventsCatalogSize, countryCode string) (amount float64, currency string, ok bool) {
	if err := normalizeAndValidateSizeHostFees(&sz); err != nil {
		return 0, "", false
	}
	cc := normalizeCC(countryCode)
	if len(cc) != 2 {
		return 0, "", false
	}
	et := s.EthiopiaCountry()
	if et != "" && cc == et {
		if sz.HostFeeEthiopiaAmount <= 0 || strings.TrimSpace(sz.HostFeeEthiopiaCurrency) == "" {
			return 0, "", false
		}
		return sz.HostFeeEthiopiaAmount, strings.ToUpper(strings.TrimSpace(sz.HostFeeEthiopiaCurrency)), true
	}
	if sz.HostFeeGlobalAmount <= 0 || strings.TrimSpace(sz.HostFeeGlobalCurrency) == "" {
		return 0, "", false
	}
	return sz.HostFeeGlobalAmount, strings.ToUpper(strings.TrimSpace(sz.HostFeeGlobalCurrency)), true
}

func (s *SettingsStore) FindEventsCatalogSize(sizeID string) (EventsCatalogSize, bool) {
	for _, sz := range s.EventsCatalog().Sizes {
		if sz.ID == sizeID {
			return sz, true
		}
	}
	return EventsCatalogSize{}, false
}

func (s *SettingsStore) FindEventsCatalogFormat(formatID string) (EventsCatalogFormat, bool) {
	for _, f := range s.EventsCatalog().Formats {
		if f.ID == formatID {
			return f, true
		}
	}
	return EventsCatalogFormat{}, false
}

// ListEventsCatalogSizesPaged filters and pages the catalog sizes slice (backend-driven admin table).
func (s *SettingsStore) ListEventsCatalogSizesPaged(skip, limit int, q, status string) ([]EventsCatalogSize, int) {
	cat := s.EventsCatalog()
	q = strings.ToLower(strings.TrimSpace(q))
	status = strings.ToLower(strings.TrimSpace(status))
	filtered := make([]EventsCatalogSize, 0, len(cat.Sizes))
	for _, sz := range cat.Sizes {
		if status == "active" && !sz.Enabled {
			continue
		}
		if status == "inactive" && sz.Enabled {
			continue
		}
		if q != "" {
			blob := strings.ToLower(sz.ID + " " + sz.Label + " " + sz.HostFeeEthiopiaCurrency + " " + sz.HostFeeGlobalCurrency)
			if !strings.Contains(blob, q) {
				continue
			}
		}
		filtered = append(filtered, sz)
	}
	total := len(filtered)
	if skip < 0 {
		skip = 0
	}
	// Fail closed: never invent a page size (HTTP parseListPagination already requires limit > 0).
	if limit <= 0 {
		return []EventsCatalogSize{}, total
	}
	if skip >= total {
		return []EventsCatalogSize{}, total
	}
	end := skip + limit
	if end > total {
		end = total
	}
	out := append([]EventsCatalogSize{}, filtered[skip:end]...)
	return out, total
}

func normalizeCC(cc string) string {
	out := make([]rune, 0, 2)
	for _, r := range cc {
		if r >= 'a' && r <= 'z' {
			r = r - 32
		}
		if r >= 'A' && r <= 'Z' {
			out = append(out, r)
		}
	}
	return string(out)
}

// AuthProvidersJSON returns the raw platform_settings.auth_providers document.
func (s *SettingsStore) AuthProvidersJSON(ctx context.Context) ([]byte, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, errors.New("auth providers unavailable")
	}
	var raw []byte
	err := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'auth_providers'`).Scan(&raw)
	if err != nil {
		return nil, err
	}
	return raw, nil
}

// WalletChromeJSON returns the raw platform_settings.wallet_chrome document.
func (s *SettingsStore) WalletChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "wallet_chrome", "wallet chrome unavailable")
}

// PlayChromeJSON returns platform_settings.play_chrome (player play page strings).
func (s *SettingsStore) PlayChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "play_chrome", "play chrome unavailable")
}

// OfficialPauseChromeJSON returns platform_settings.official_pause_chrome.
func (s *SettingsStore) OfficialPauseChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "official_pause_chrome", "official pause chrome unavailable")
}

// OfficialPauseChromeField returns one DB official_pause_chrome string (fail closed empty).
func (s *SettingsStore) OfficialPauseChromeField(ctx context.Context, key string) string {
	if s == nil {
		return ""
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return ""
	}
	raw, err := s.OfficialPauseChromeJSON(ctx)
	if err != nil || len(raw) == 0 {
		return ""
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return ""
	}
	v, ok := doc[key]
	if !ok || v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return strings.TrimSpace(t)
	default:
		return strings.TrimSpace(fmt.Sprint(t))
	}
}

// OfficialPauseRateLimitPerMinute reads official_pause_chrome.rate_limit_per_minute (DB only).
// Returns 0 when missing or invalid (caller must not invent a silent unlimited budget).
func (s *SettingsStore) OfficialPauseRateLimitPerMinute(ctx context.Context) int {
	raw := s.OfficialPauseChromeField(ctx, "rate_limit_per_minute")
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || n <= 0 {
		return 0
	}
	return n
}

// PlayChromeField returns one DB play_chrome string (fail closed empty when missing).
func (s *SettingsStore) PlayChromeField(ctx context.Context, key string) string {
	if s == nil {
		return ""
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return ""
	}
	raw, err := s.PlayChromeJSON(ctx)
	if err != nil || len(raw) == 0 {
		return ""
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return ""
	}
	v, ok := doc[key]
	if !ok || v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return strings.TrimSpace(t)
	default:
		return strings.TrimSpace(fmt.Sprint(t))
	}
}

// PaginationChromeJSON returns platform_settings.pagination_chrome (Trim skip/go labels).
func (s *SettingsStore) PaginationChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "pagination_chrome", "pagination chrome unavailable")
}

// MatchmakingChromeJSON returns platform_settings.matchmaking_chrome.
func (s *SettingsStore) PlayRailChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "play_rail_chrome", "play rail chrome unavailable")
}

// ChatEmojiCatalogJSON returns platform_settings.chat_emoji_catalog (Telegram-style emoji grid).
func (s *SettingsStore) ChatEmojiCatalogJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "chat_emoji_catalog", "chat emoji catalog unavailable")
}

func (s *SettingsStore) MatchmakingChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "matchmaking_chrome", "matchmaking chrome unavailable")
}

// TournamentChromeJSON returns platform_settings.tournament_chrome (admin create UI).
func (s *SettingsStore) TournamentChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "tournament_chrome", "tournament chrome unavailable")
}

// AdminConsoleChromeJSON returns platform_settings.admin_console_chrome.
func (s *SettingsStore) AdminConsoleChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "admin_console_chrome", "admin console chrome unavailable")
}

// ProfileInspectChromeJSON returns platform_settings.profile_inspect_chrome.
func (s *SettingsStore) ProfileInspectChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "profile_inspect_chrome", "profile inspect chrome unavailable")
}

// CountryFlagChromeJSON returns platform_settings.country_flag_chrome (image URL template).
func (s *SettingsStore) CountryFlagChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "country_flag_chrome", "country flag chrome unavailable")
}

// AvatarChromeJSON returns platform_settings.avatar_chrome.
func (s *SettingsStore) AvatarChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "avatar_chrome", "avatar chrome unavailable")
}

// MediaUploadChromeJSON returns platform_settings.media_upload_chrome (shared dropzone copy).
func (s *SettingsStore) MediaUploadChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "media_upload_chrome", "media upload unavailable")
}

// SpectateChromeJSON returns platform_settings.spectate_chrome.
func (s *SettingsStore) SpectateChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "spectate_chrome", "spectate chrome unavailable")
}

// LeaderboardChromeJSON returns platform_settings.leaderboard_chrome.
func (s *SettingsStore) LeaderboardChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "leaderboard_chrome", "leaderboard chrome unavailable")
}

// EventsOrganizerChromeJSON returns platform_settings.events_organizer_chrome.
func (s *SettingsStore) EventsOrganizerChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "events_organizer_chrome", "events organizer chrome unavailable")
}

// EventsPlayerChromeJSON returns platform_settings.events_player_chrome.
func (s *SettingsStore) EventsPlayerChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "events_player_chrome", "events player chrome unavailable")
}

// EventsAdminChromeJSON returns platform_settings.events_admin_chrome.
func (s *SettingsStore) EventsAdminChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "events_admin_chrome", "events admin chrome unavailable")
}

// TournamentsPlayerChromeJSON returns platform_settings.tournaments_player_chrome.
func (s *SettingsStore) TournamentsPlayerChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "tournaments_player_chrome", "tournaments chrome unavailable")
}

// PlatformStatsChromeJSON returns platform_settings.platform_stats_chrome.
func (s *SettingsStore) PlatformStatsChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "platform_stats_chrome", "platform stats chrome unavailable")
}

// HomeSurfaceChromeJSON returns platform_settings.home_surface_chrome.
func (s *SettingsStore) HomeSurfaceChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "home_surface_chrome", "home chrome unavailable")
}

// AppShellChromeJSON returns platform_settings.app_shell_chrome (splash, onboarding, 404, SEO).
func (s *SettingsStore) AppShellChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "app_shell_chrome", "app shell chrome unavailable")
}

// PaymentModalChromeJSON returns platform_settings.payment_modal_chrome.
func (s *SettingsStore) PaymentModalChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "payment_modal_chrome", "payment modal chrome unavailable")
}

// OTPChromeJSON returns platform_settings.otp_chrome.
func (s *SettingsStore) OTPChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "otp_chrome", "otp chrome unavailable")
}

// ThemeChromeJSON returns platform_settings.theme_chrome.
func (s *SettingsStore) ThemeChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "theme_chrome", "theme chrome unavailable")
}

// LegalChromeJSON returns platform_settings.legal_chrome (privacy/terms page chrome).
func (s *SettingsStore) LegalChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "legal_chrome", "legal chrome unavailable")
}

// StoreComplianceChromeJSON returns platform_settings.store_compliance_chrome.
func (s *SettingsStore) StoreComplianceChromeJSON(ctx context.Context) ([]byte, error) {
	return s.platformSettingJSON(ctx, "store_compliance_chrome", "store compliance chrome unavailable")
}

// SupportEmail returns the public support contact from platform_settings.support_email.
func (s *SettingsStore) SupportEmail(ctx context.Context) (string, error) {
	raw, err := s.platformSettingJSON(ctx, "support_email", "support email unavailable")
	if err != nil {
		return "", err
	}
	var email string
	if err := json.Unmarshal(raw, &email); err != nil {
		return "", err
	}
	email = strings.TrimSpace(email)
	if email == "" {
		return "", errors.New("support email unavailable")
	}
	return email, nil
}

func (s *SettingsStore) platformSettingJSON(ctx context.Context, key, missing string) ([]byte, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, errors.New(missing)
	}
	var raw []byte
	err := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = $1`, key).Scan(&raw)
	if err != nil {
		return nil, err
	}
	return scrubLeakedChromeJSON(key, raw), nil
}

// scrubLeakedChromeJSON replaces known engineering leaks until mig 114 lands on the DB.
func scrubLeakedChromeJSON(key string, raw []byte) []byte {
	var m map[string]json.RawMessage
	if err := json.Unmarshal(raw, &m); err != nil {
		return raw
	}
	changed := false
	setStr := func(field, next string) {
		cur := ""
		if v, ok := m[field]; ok {
			_ = json.Unmarshal(v, &cur)
		}
		low := strings.ToLower(cur)
		if strings.Contains(low, "hydrate") ||
			strings.Contains(low, "graphql") ||
			strings.Contains(low, "publisherdashboard") ||
			strings.Contains(low, "from the live backend") ||
			strings.Contains(low, "queue peers") {
			b, err := json.Marshal(next)
			if err != nil {
				return
			}
			m[field] = b
			changed = true
		}
	}
	switch key {
	case "leaderboard_chrome":
		setStr("page_blurb", "Browse top players by rating. Tap a player to open their profile card.")
	case "avatar_chrome":
		setStr("page_blurb", "Update your photo and review career stats. Tap your avatar for a full profile card.")
	case "matchmaking_chrome":
		setStr("blurb", "Find an opponent online. Your queue stays private until a match starts, then both players appear on the board.")
	case "ad_runtime_chrome":
		setStr("publisher_dash_body", "Track campaign performance, click-through rate, cost per click, and creative status.")
		setStr("publisher_stat_source_note", "Live publisher metrics")
		setStr("publisher_analytics_body", "Live campaign performance. Cost per click uses the platform impression unit price.")
	case "tournament_chrome":
		setStr("lobby_modes_blurb", "Available play modes for your region.")
	case "client_nav":
		setStr("graphql_empty", "No data returned. Try again in a moment.")
		// wallet_chrome: no soft-fill. Keys must exist in platform_settings (migrations). Clients fail closed.
	}
	if !changed {
		return raw
	}
	out, err := json.Marshal(m)
	if err != nil {
		return raw
	}
	return out
}

// SetPlayRailWebAppOrigin persists play_rail_chrome.web_app_origin (fail-closed).
func (s *SettingsStore) SetPlayRailWebAppOrigin(ctx context.Context, origin string) error {
	origin = strings.TrimSpace(strings.TrimRight(origin, "/"))
	if origin == "" {
		return errors.New("web_app_origin required")
	}
	if !strings.HasPrefix(origin, "http://") && !strings.HasPrefix(origin, "https://") {
		return errors.New("web_app_origin must be http(s) URL")
	}
	if s.db == nil || !s.db.Ready() {
		return errors.New("database required to persist web_app_origin")
	}
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE platform_settings
		SET value = jsonb_set(COALESCE(value, '{}'::jsonb), '{web_app_origin}', to_jsonb($1::text), true),
		    updated_at = NOW()
		WHERE key = 'play_rail_chrome'
	`, origin)
	return err
}

// PlayRailWebAppOrigin returns play_rail_chrome.web_app_origin from DB.
func (s *SettingsStore) PlayRailWebAppOrigin(ctx context.Context) (string, error) {
	raw, err := s.PlayRailChromeJSON(ctx)
	if err != nil {
		return "", err
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return "", err
	}
	v, _ := doc["web_app_origin"].(string)
	return strings.TrimSpace(strings.TrimRight(v, "/")), nil
}

// PlayRailQRFilenamePrefix returns play_rail_chrome.qr_download_filename_prefix (fail-closed).
func (s *SettingsStore) PlayRailQRFilenamePrefix(ctx context.Context) (string, error) {
	raw, err := s.PlayRailChromeJSON(ctx)
	if err != nil {
		return "", err
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return "", err
	}
	v, _ := doc["qr_download_filename_prefix"].(string)
	v = strings.TrimSpace(v)
	if v == "" {
		return "", fmt.Errorf("qr filename prefix unavailable")
	}
	return v, nil
}

// AllowedAuthProviders reads providers[] from auth_providers settings.
func (s *SettingsStore) AllowedAuthProviders(ctx context.Context) ([]string, error) {
	raw, err := s.AuthProvidersJSON(ctx)
	if err != nil {
		return nil, err
	}
	var body struct {
		Providers []string `json:"providers"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		return nil, err
	}
	out := make([]string, 0, len(body.Providers))
	for _, p := range body.Providers {
		p = strings.ToLower(strings.TrimSpace(p))
		if p != "" {
			out = append(out, p)
		}
	}
	return out, nil
}
