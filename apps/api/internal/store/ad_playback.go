package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

// AdPlaybackConfig is loaded from platform_settings.key = 'ad_playback'.
// NonSkippableSeconds is admin-editable (not static); bounds come from the same DB row.
type AdPlaybackConfig struct {
	NonSkippableSeconds       int    `json:"non_skippable_seconds"`
	FirstShowAfterGameSeconds int    `json:"first_show_after_game_seconds"`
	DefaultIntervalSeconds    int    `json:"default_interval_seconds"`
	NonSkippableMin           int    `json:"non_skippable_min"`
	NonSkippableMax           int    `json:"non_skippable_max"`
	FirstShowMin              int    `json:"first_show_min"`
	FirstShowMax              int    `json:"first_show_max"`
	IntervalMin               int    `json:"interval_min"`
	IntervalMax               int    `json:"interval_max"`
	ImpressionCapMin          int    `json:"impression_cap_min"`
	ConsoleCampaignsLimit     int    `json:"console_campaigns_limit"`
	Source                    string `json:"-"`
}

// AdRuntimeChromeConfig is loaded from platform_settings.key = 'ad_runtime_chrome'.
type AdRuntimeChromeConfig struct {
	SectionTitle                     string `json:"section_title"`
	PageBody                         string `json:"page_body"`
	NonSkippableLabel                string `json:"non_skippable_label"`
	FirstShowLabel                   string `json:"first_show_label"`
	IntervalLabel                    string `json:"interval_label"`
	DailyCapLabel                    string `json:"daily_cap_label"`
	WeeklyCapLabel                   string `json:"weekly_cap_label"`
	MonthlyCapLabel                  string `json:"monthly_cap_label"`
	YearlyCapLabel                   string `json:"yearly_cap_label"`
	ScheduleEnabledLabel             string `json:"schedule_enabled_label"`
	StatusLabel                      string `json:"status_label"`
	UpdateStatusAction               string `json:"update_status_action"`
	PlatformDefaultPlaceholder       string `json:"platform_default_placeholder"`
	UnlimitedCapPlaceholder          string `json:"unlimited_cap_placeholder"`
	CampaignsTitle                   string `json:"campaigns_title"`
	NoCampaigns                      string `json:"no_campaigns"`
	LoadCampaignsFailed              string `json:"load_campaigns_failed"`
	LacksPermissions                 string `json:"lacks_permissions"`
	SaveAction                       string `json:"save_action"`
	SaveCampaignScheduleAction       string `json:"save_campaign_schedule_action"`
	Unavailable                      string `json:"unavailable"`
	ToastPlaybackSaved               string `json:"toast_playback_saved"`
	ToastScheduleSaved               string `json:"toast_schedule_saved"`
	ToastStatusUpdated               string `json:"toast_status_updated"`
	ToastSaveFailed                  string `json:"toast_save_failed"`
	ToastUpdateFailed                string `json:"toast_update_failed"`
	PublisherPageTitle               string `json:"publisher_page_title"`
	PublisherPageBody                string `json:"publisher_page_body"`
	ToastCampaignCreated             string `json:"toast_campaign_created"`
	ToastCampaignStatusUpdated       string `json:"toast_campaign_status_updated"`
	ToastCampaignTitleSaved          string `json:"toast_campaign_title_saved"`
	ToastCreativeReplaced            string `json:"toast_creative_replaced"`
	ToastVideoAttached               string `json:"toast_video_attached"`
	VideoUploadJobTitle              string `json:"video_upload_job_title"`
	PhTitle                          string `json:"ph_title"`
	PatchTitleLocked                 string `json:"patch_title_locked"`
	PhCountry                        string `json:"ph_country"`
	PhRegion                         string `json:"ph_region"`
	PhDistrict                       string `json:"ph_district"`
	PhLat                            string `json:"ph_lat"`
	PhLng                            string `json:"ph_lng"`
	PhDailySpendCap                  string `json:"ph_daily_spend_cap"`
	CloseCampaignAction              string `json:"close_campaign_action"`
	ReopenCampaignAction             string `json:"reopen_campaign_action"`
	CannotReopenCampaignBlurb        string `json:"cannot_reopen_campaign_blurb"`
	ToastCampaignClosed              string `json:"toast_campaign_closed"`
	ToastCampaignReopened            string `json:"toast_campaign_reopened"`
	ToastCampaignCloseFailed         string `json:"toast_campaign_close_failed"`
	ToastCampaignReopenFailed        string `json:"toast_campaign_reopen_failed"`
	AutoClosedBadge                  string `json:"auto_closed_badge"`
	EndsAtLabel                      string `json:"ends_at_label"`
	EndsAtBlurb                      string `json:"ends_at_blurb"`
	PhEndsAt                         string `json:"ph_ends_at"`
	CreateAction                     string `json:"create_action"`
	ReplaceCreativeAction            string `json:"replace_creative_action"`
	AttachVideoAction                string `json:"attach_video_action"`
	PublisherNoCampaigns             string `json:"publisher_no_campaigns"`
	CreativeURLPrompt                string `json:"creative_url_prompt"`
	CreativeURLRequired              string `json:"creative_url_required"`
	StatsImpressionsSuffix           string `json:"stats_impressions_suffix"`
	StatsReachSuffix                 string `json:"stats_reach_suffix"`
	StatsClicksSuffix                string `json:"stats_clicks_suffix"`
	VideoAttachedSuffix              string `json:"video_attached_suffix"`
	DailyCapSuffix                   string `json:"daily_cap_suffix"`
	DailySpendCapSuffix              string `json:"daily_spend_cap_suffix"`
	PublisherDashTitle               string `json:"publisher_dash_title"`
	PublisherDashBody                string `json:"publisher_dash_body"`
	PublisherDashLoadFailed          string `json:"publisher_dash_load_failed"`
	PublisherStatImpressions         string `json:"publisher_stat_impressions"`
	PublisherStatReach               string `json:"publisher_stat_reach"`
	PublisherStatClicks              string `json:"publisher_stat_clicks"`
	PublisherStatCtr                 string `json:"publisher_stat_ctr"`
	PublisherStatCpc                 string `json:"publisher_stat_cpc"`
	PublisherStatCompletion          string `json:"publisher_stat_completion"`
	PublisherStatCreateFee           string `json:"publisher_stat_create_fee"`
	PublisherStatSourceNote          string `json:"publisher_stat_source_note"`
	PublisherCampaignsHeading        string `json:"publisher_campaigns_heading"`
	PublisherManageCampaigns         string `json:"publisher_manage_campaigns"`
	PublisherManageCampaignsHref     string `json:"publisher_manage_campaigns_href"`
	PublisherAnalyticsTitle          string `json:"publisher_analytics_title"`
	PublisherAnalyticsBody           string `json:"publisher_analytics_body"`
	PublisherPricingUnavailable      string `json:"publisher_pricing_unavailable"`
	PublisherInvoiceAction           string `json:"publisher_invoice_action"`
	PublisherInvoicePending          string `json:"publisher_invoice_pending"`
	PublisherInvoiceFailed           string `json:"publisher_invoice_failed"`
	PublisherInvoiceFilename         string `json:"publisher_invoice_filename"`
	InvoicePDFTitle                  string `json:"invoice_pdf_title"`
	InvoicePDFGeneratedTemplate      string `json:"invoice_pdf_generated_template"`
	InvoicePDFPublisherTemplate      string `json:"invoice_pdf_publisher_template"`
	InvoicePDFCurrencyTemplate       string `json:"invoice_pdf_currency_template"`
	InvoicePDFTableHeader            string `json:"invoice_pdf_table_header"`
	InvoicePDFTableRule              string `json:"invoice_pdf_table_rule"`
	InvoicePDFLineTemplate           string `json:"invoice_pdf_line_template"`
	InvoicePDFTotalsTemplate         string `json:"invoice_pdf_totals_template"`
	InvoicePDFSettleBlurb            string `json:"invoice_pdf_settle_blurb"`
	ErrInvoiceListFailed             string `json:"err_invoice_list_failed"`
	ErrInvoiceCurrencyUnavailable    string `json:"err_invoice_currency_unavailable"`
	ErrInvoicePDFUnavailable         string `json:"err_invoice_pdf_unavailable"`
	ErrDashboardFailed               string `json:"err_dashboard_failed"`
	PublisherPortalWalletLabel       string `json:"publisher_portal_wallet_label"`
	PublisherPortalReceiptsLabel     string `json:"publisher_portal_receipts_label"`
	PublisherPortalTransactionsLabel string `json:"publisher_portal_transactions_label"`
	PublisherPortalOverviewLabel     string `json:"publisher_portal_overview_label"`
	PublisherPortalCreateLabel       string `json:"publisher_portal_create_label"`
	PublisherPortalSectionTitle      string `json:"publisher_portal_section_title"`
	PublisherPortalWalletHref        string `json:"publisher_portal_wallet_href"`
	PublisherPortalReceiptsHref      string `json:"publisher_portal_receipts_href"`
	PublisherPortalTransactionsHref  string `json:"publisher_portal_transactions_href"`
	PublisherPortalPayoutLabel       string `json:"publisher_portal_payout_label"`
	PublisherPortalPayoutHref        string `json:"publisher_portal_payout_href"`
	PublisherPortalPayoutBlurb       string `json:"publisher_portal_payout_blurb"`
	PublisherPortalOverviewHref      string `json:"publisher_portal_overview_href"`
	PublisherPortalCreateHref        string `json:"publisher_portal_create_href"`
	CampaignCreateFeeLabel           string `json:"campaign_create_fee_label"`
	CampaignCreateFeeBlurb           string `json:"campaign_create_fee_blurb"`
	InsufficientCampaignCreateFee    string `json:"insufficient_campaign_create_fee"`
	PlaybackUnavailable              string `json:"playback_unavailable"`
	MetaSeparator                    string `json:"meta_separator"`
	AmountCurrencySeparator          string `json:"amount_currency_separator"`
	ParenOpen                        string `json:"paren_open"`
	ParenClose                       string `json:"paren_close"`
	RuntimePermissionKey             string `json:"runtime_permission_key"`
	CampaignsPermissionKey           string `json:"campaigns_permission_key"`
	ThumbnailLabel                   string `json:"thumbnail_label"`
	GalleryLabel                     string `json:"gallery_label"`
	GalleryAddAction                 string `json:"gallery_add_action"`
	GalleryEmpty                     string `json:"gallery_empty"`
	ThumbnailUploadAction            string `json:"thumbnail_upload_action"`
	ToastThumbnailSaved              string `json:"toast_thumbnail_saved"`
	ToastGallerySaved                string `json:"toast_gallery_saved"`
	MediaUploadFailed                string `json:"media_upload_failed"`
	GalleryMaxSlots                  string `json:"gallery_max_slots"`
	GallerySlotsFmt                  string `json:"gallery_slots_fmt"`
	ThumbnailMainBadge               string `json:"thumbnail_main_badge"`
	ThumbnailEmptyHint               string `json:"thumbnail_empty_hint"`
	ThumbnailHint                    string `json:"thumbnail_hint"`
	GalleryLimitReached              string `json:"gallery_limit_reached"`
	ListPageSize                     string `json:"list_page_size"`
	EmptyValue                       string `json:"empty_value"`
	CancelAction                     string `json:"cancel_action"`
	DialogCloseLabel                 string `json:"dialog_close_label"`
	SearchCampaignsLabel             string `json:"search_campaigns_label"`
	SearchCampaignsPlaceholder       string `json:"search_campaigns_placeholder"`
	FilterStatusLabel                string `json:"filter_status_label"`
	FilterStatusAll                  string `json:"filter_status_all"`
	ViewAction                       string `json:"view_action"`
	EditAction                       string `json:"edit_action"`
	RowActionsLabel                  string `json:"row_actions_label"`
	SelectAllLabel                   string `json:"select_all_label"`
	SelectRowLabel                   string `json:"select_row_label"`
	SelectedCountFmt                 string `json:"selected_count_fmt"`
	ClearSelectionAction             string `json:"clear_selection_action"`
	BulkApplyStatusAction            string `json:"bulk_apply_status_action"`
	BulkStatusPending                string `json:"bulk_status_pending"`
	DeleteCampaignAction             string `json:"delete_campaign_action"`
	DeleteCampaignPending            string `json:"delete_campaign_pending"`
	DeleteCampaignConfirmTitle       string `json:"delete_campaign_confirm_title"`
	DeleteCampaignConfirmDescription string `json:"delete_campaign_confirm_description"`
	ToastCampaignDeleted             string `json:"toast_campaign_deleted"`
	ToastCampaignDeleteFailed        string `json:"toast_campaign_delete_failed"`
	ErrDeleteHasDelivery             string `json:"err_delete_has_delivery"`
	ErrDeleteAutoClosed              string `json:"err_delete_auto_closed"`
	ErrDailySpendCapRequired         string `json:"err_daily_spend_cap_required"`
	DailySpendCapRequiredHint        string `json:"daily_spend_cap_required_hint"`
	PublisherPortalTransferLabel     string `json:"publisher_portal_transfer_label"`
	PublisherPortalTransferHref      string `json:"publisher_portal_transfer_href"`
	SavePending                      string `json:"save_pending"`
	SaveCampaignSchedulePending      string `json:"save_campaign_schedule_pending"`
	UpdateStatusPending              string `json:"update_status_pending"`
	CreatePending                    string `json:"create_pending"`
	ReplaceCreativePending           string `json:"replace_creative_pending"`
	AttachVideoPending               string `json:"attach_video_pending"`
	ThumbnailUploadPending           string `json:"thumbnail_upload_pending"`
	GalleryUploadPending             string `json:"gallery_upload_pending"`
	MapLocationSectionTitle          string `json:"map_location_section_title"`
	MapPinEmpty                      string `json:"map_pin_empty"`
	MapUseDeviceLocation             string `json:"map_use_device_location"`
	MapClearPin                      string `json:"map_clear_pin"`
	MapHelperText                    string `json:"map_helper_text"`
	MapGeolocationUnavailable        string `json:"map_geolocation_unavailable"`
	MapGeolocationFailed             string `json:"map_geolocation_failed"`
	MapPinRequired                   string `json:"map_pin_required"`
	MapPinCoordsFmt                  string `json:"map_pin_coords_fmt"`
	MapListingsCountFmt              string `json:"map_listings_count_fmt"`
	MapLocateFailed                  string `json:"map_locate_failed"`
	ErrMapPinRequired                string `json:"err_map_pin_required"`
	ErrMapLocateFailed               string `json:"err_map_locate_failed"`
	DailySpendCapLabel               string `json:"daily_spend_cap_label"`
	VideoIDLabel                     string `json:"video_id_label"`
	CreativeURLLabel                 string `json:"creative_url_label"`
	ColTitle                         string `json:"col_title"`
	CreatedAtLabel                   string `json:"created_at_label"`
	Source                           string `json:"-"`
}

// AdPlayerChromeConfig is loaded from platform_settings.key = 'ad_player_chrome'.
type AdPlayerChromeConfig struct {
	SponsoredLabel   string `json:"sponsored_label"`
	SkipInTemplate   string `json:"skip_in_template"`
	CanContinueLabel string `json:"can_continue_label"`
	ContinueAction   string `json:"continue_action"`
	PlacementLobby   string `json:"placement_lobby"`
	PlacementInMatch string `json:"placement_in_match"`
	Unavailable      string `json:"unavailable"`
	Source           string `json:"-"`
}

// RBACChromeConfig is loaded from platform_settings.key = 'rbac_chrome'.
type RBACChromeConfig struct {
	PageTitle                         string   `json:"page_title"`
	PageBody                          string   `json:"page_body"`
	CatalogTitle                      string   `json:"catalog_title"`
	RolesLabel                        string   `json:"roles_label"`
	ConsoleRolesLabel                 string   `json:"console_roles_label"`
	PublisherRolesLabel               string   `json:"publisher_roles_label"`
	DefaultRoleLabel                  string   `json:"default_role_label"`
	SaveCatalogAction                 string   `json:"save_catalog_action"`
	SaveCatalogPending                string   `json:"save_catalog_pending"`
	PermissionsTitle                  string   `json:"permissions_title"`
	PermissionsEmpty                  string   `json:"permissions_empty"`
	PermKeyLabel                      string   `json:"perm_key_label"`
	PermTitleLabel                    string   `json:"perm_title_label"`
	PermDescriptionLabel              string   `json:"perm_description_label"`
	UpsertPermissionAction            string   `json:"upsert_permission_action"`
	UpsertPermissionPending           string   `json:"upsert_permission_pending"`
	DeletePermissionAction            string   `json:"delete_permission_action"`
	DeletePermissionPending           string   `json:"delete_permission_pending"`
	GrantsTitle                       string   `json:"grants_title"`
	RoleLabel                         string   `json:"role_label"`
	SaveGrantsAction                  string   `json:"save_grants_action"`
	SaveGrantsPending                 string   `json:"save_grants_pending"`
	LacksManage                       string   `json:"lacks_manage"`
	LoadFailed                        string   `json:"load_failed"`
	Unavailable                       string   `json:"unavailable"`
	ToastCatalogSaved                 string   `json:"toast_catalog_saved"`
	ToastPermissionSaved              string   `json:"toast_permission_saved"`
	ToastPermissionDeleted            string   `json:"toast_permission_deleted"`
	ToastGrantsSaved                  string   `json:"toast_grants_saved"`
	ToastSaveFailed                   string   `json:"toast_save_failed"`
	ToastDeleteFailed                 string   `json:"toast_delete_failed"`
	ProtectedPermissionKeys           []string `json:"protected_permission_keys"`
	ManagePermissionKey               string   `json:"manage_permission_key"`
	ErrProtectedDelete                string   `json:"err_protected_delete"`
	ErrProtectedLastGrant             string   `json:"err_protected_last_grant"`
	SelectAllLabel                    string   `json:"select_all_label"`
	SelectRowLabel                    string   `json:"select_row_label"`
	SelectedCountFmt                  string   `json:"selected_count_fmt"`
	ClearSelectionAction              string   `json:"clear_selection_action"`
	ViewAction                        string   `json:"view_action"`
	EditAction                        string   `json:"edit_action"`
	AddPermissionAction               string   `json:"add_permission_action"`
	DialogCloseLabel                  string   `json:"dialog_close_label"`
	CancelAction                      string   `json:"cancel_action"`
	RowActionsLabel                   string   `json:"row_actions_label"`
	SearchLabel                       string   `json:"search_label"`
	SearchPlaceholder                 string   `json:"search_placeholder"`
	DetailTitle                       string   `json:"detail_title"`
	EmptyValue                        string   `json:"empty_value"`
	TabCatalogLabel                   string   `json:"tab_catalog_label"`
	TabPermissionsLabel               string   `json:"tab_permissions_label"`
	TabGrantsLabel                    string   `json:"tab_grants_label"`
	ConfirmDeleteTitle                string   `json:"confirm_delete_title"`
	ConfirmDeleteDescription          string   `json:"confirm_delete_description"`
	ConfirmDelete                     string   `json:"confirm_delete"`
	ConfirmDeletePending              string   `json:"confirm_delete_pending"`
	ConfirmCancel                     string   `json:"confirm_cancel"`
	BulkDeleteAction                  string   `json:"bulk_delete_action"`
	BulkDeletePending                 string   `json:"bulk_delete_pending"`
	BulkDeleteConfirmTitle            string   `json:"bulk_delete_confirm_title"`
	BulkDeleteConfirmDescription      string   `json:"bulk_delete_confirm_description"`
	ColRoleLabel                      string   `json:"col_role_label"`
	ColConsoleLabel                   string   `json:"col_console_label"`
	ColPublisherLabel                 string   `json:"col_publisher_label"`
	ColDefaultLabel                   string   `json:"col_default_label"`
	AddRoleAction                     string   `json:"add_role_action"`
	CatalogEmpty                      string   `json:"catalog_empty"`
	FlagYesLabel                      string   `json:"flag_yes_label"`
	FlagNoLabel                       string   `json:"flag_no_label"`
	DeleteRoleAction                  string   `json:"delete_role_action"`
	ConfirmDeleteRoleTitle            string   `json:"confirm_delete_role_title"`
	ConfirmDeleteRoleDescription      string   `json:"confirm_delete_role_description"`
	BulkDeleteRolesConfirmTitle       string   `json:"bulk_delete_roles_confirm_title"`
	BulkDeleteRolesConfirmDescription string   `json:"bulk_delete_roles_confirm_description"`
	IsConsoleLabel                    string   `json:"is_console_label"`
	IsPublisherLabel                  string   `json:"is_publisher_label"`
	IsDefaultLabel                    string   `json:"is_default_label"`
	UpsertRoleAction                  string   `json:"upsert_role_action"`
	UpsertRolePending                 string   `json:"upsert_role_pending"`
	RoleDetailTitle                   string   `json:"role_detail_title"`
	Source                            string   `json:"-"`
}

func (s *SettingsStore) ReloadAdPlayback(ctx context.Context) error {
	if s.db == nil || !s.db.Ready() {
		return nil
	}
	row := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'ad_playback'`)
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		return err
	}
	var cfg AdPlaybackConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	if err := cfg.validateBoundsPresent(); err != nil {
		return err
	}
	if err := cfg.validateValues(); err != nil {
		return err
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.playback = cfg
	s.mu.Unlock()
	return nil
}

func (c *AdPlaybackConfig) validateBoundsPresent() error {
	if c == nil {
		return errors.New("ad_playback missing")
	}
	if c.NonSkippableMin < 1 || c.NonSkippableMax < c.NonSkippableMin {
		return errors.New("ad_playback non_skippable bounds incomplete")
	}
	if c.FirstShowMin < 0 || c.FirstShowMax < c.FirstShowMin {
		return errors.New("ad_playback first_show bounds incomplete")
	}
	if c.IntervalMin < 1 || c.IntervalMax < c.IntervalMin {
		return errors.New("ad_playback interval bounds incomplete")
	}
	if c.ImpressionCapMin < 1 {
		return errors.New("ad_playback impression_cap_min incomplete")
	}
	if c.ConsoleCampaignsLimit < 1 {
		return errors.New("ad_playback console_campaigns_limit incomplete")
	}
	return nil
}

func (c *AdPlaybackConfig) validateValues() error {
	if c == nil {
		return errors.New("ad_playback missing")
	}
	if err := c.validateBoundsPresent(); err != nil {
		return err
	}
	if c.NonSkippableSeconds < c.NonSkippableMin || c.NonSkippableSeconds > c.NonSkippableMax {
		return fmt.Errorf("non_skippable_seconds must be between %d and %d", c.NonSkippableMin, c.NonSkippableMax)
	}
	if c.FirstShowAfterGameSeconds < c.FirstShowMin || c.FirstShowAfterGameSeconds > c.FirstShowMax {
		return fmt.Errorf("first_show_after_game_seconds must be between %d and %d", c.FirstShowMin, c.FirstShowMax)
	}
	if c.DefaultIntervalSeconds < c.IntervalMin || c.DefaultIntervalSeconds > c.IntervalMax {
		return fmt.Errorf("default_interval_seconds must be between %d and %d", c.IntervalMin, c.IntervalMax)
	}
	return nil
}

func (s *SettingsStore) AdPlayback() AdPlaybackConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.playback
}

func (s *SettingsStore) SetAdPlayback(ctx context.Context, cfg AdPlaybackConfig) error {
	// Bounds are platform policy from DB; callers may only change the live values.
	cur := s.AdPlayback()
	if cur.Source != "database" {
		return errors.New("ad playback unavailable")
	}
	cfg.NonSkippableMin = cur.NonSkippableMin
	cfg.NonSkippableMax = cur.NonSkippableMax
	cfg.FirstShowMin = cur.FirstShowMin
	cfg.FirstShowMax = cur.FirstShowMax
	cfg.IntervalMin = cur.IntervalMin
	cfg.IntervalMax = cur.IntervalMax
	cfg.ImpressionCapMin = cur.ImpressionCapMin
	cfg.ConsoleCampaignsLimit = cur.ConsoleCampaignsLimit
	if err := cfg.validateValues(); err != nil {
		return err
	}
	payload := map[string]any{
		"non_skippable_seconds":         cfg.NonSkippableSeconds,
		"first_show_after_game_seconds": cfg.FirstShowAfterGameSeconds,
		"default_interval_seconds":      cfg.DefaultIntervalSeconds,
		"non_skippable_min":             cfg.NonSkippableMin,
		"non_skippable_max":             cfg.NonSkippableMax,
		"first_show_min":                cfg.FirstShowMin,
		"first_show_max":                cfg.FirstShowMax,
		"interval_min":                  cfg.IntervalMin,
		"interval_max":                  cfg.IntervalMax,
		"impression_cap_min":            cfg.ImpressionCapMin,
		"console_campaigns_limit":       cfg.ConsoleCampaignsLimit,
		"source":                        "database",
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	if s.db == nil || !s.db.Ready() {
		return errors.New("database required to persist ad_playback")
	}
	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO platform_settings (key, value, updated_at)
		VALUES ('ad_playback', $1::jsonb, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`, string(raw))
	if err != nil {
		return err
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.playback = cfg
	s.mu.Unlock()
	return nil
}

func (s *SettingsStore) ReloadAdRuntimeChrome(ctx context.Context) error {
	if s.db == nil || !s.db.Ready() {
		return nil
	}
	row := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'ad_runtime_chrome'`)
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		return err
	}
	raw = scrubLeakedChromeJSON("ad_runtime_chrome", raw)
	var cfg AdRuntimeChromeConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	if cfg.SectionTitle == "" || cfg.NonSkippableLabel == "" || cfg.SaveAction == "" ||
		cfg.Unavailable == "" || cfg.PageBody == "" || cfg.StatusLabel == "" ||
		cfg.UpdateStatusAction == "" || cfg.CampaignsTitle == "" || cfg.LacksPermissions == "" ||
		cfg.FirstShowLabel == "" || cfg.IntervalLabel == "" ||
		cfg.DailyCapLabel == "" || cfg.WeeklyCapLabel == "" ||
		cfg.MonthlyCapLabel == "" || cfg.YearlyCapLabel == "" ||
		cfg.ScheduleEnabledLabel == "" || cfg.PlatformDefaultPlaceholder == "" ||
		cfg.UnlimitedCapPlaceholder == "" || cfg.SaveCampaignScheduleAction == "" ||
		cfg.NoCampaigns == "" || cfg.LoadCampaignsFailed == "" ||
		cfg.ToastPlaybackSaved == "" || cfg.ToastScheduleSaved == "" || cfg.ToastStatusUpdated == "" ||
		cfg.ToastSaveFailed == "" || cfg.ToastUpdateFailed == "" ||
		cfg.PublisherPageTitle == "" || cfg.PublisherPageBody == "" ||
		cfg.ToastCampaignCreated == "" || cfg.ToastCampaignStatusUpdated == "" ||
		cfg.ToastCampaignTitleSaved == "" || cfg.PatchTitleLocked == "" ||
		cfg.ToastCreativeReplaced == "" || cfg.ToastVideoAttached == "" ||
		cfg.VideoUploadJobTitle == "" ||
		cfg.PhTitle == "" || cfg.PhCountry == "" || cfg.CreateAction == "" ||
		cfg.ReplaceCreativeAction == "" || cfg.AttachVideoAction == "" ||
		cfg.PublisherNoCampaigns == "" || cfg.CreativeURLPrompt == "" ||
		cfg.CreativeURLRequired == "" || cfg.StatsImpressionsSuffix == "" ||
		cfg.StatsReachSuffix == "" || cfg.StatsClicksSuffix == "" ||
		cfg.VideoAttachedSuffix == "" || cfg.DailyCapSuffix == "" ||
		cfg.PhRegion == "" || cfg.PhDistrict == "" ||
		cfg.PhDailySpendCap == "" ||
		cfg.PublisherDashTitle == "" || cfg.PublisherDashBody == "" ||
		cfg.PublisherDashLoadFailed == "" || cfg.PublisherStatImpressions == "" ||
		cfg.PublisherStatReach == "" || cfg.PublisherStatClicks == "" ||
		cfg.PublisherStatCtr == "" || cfg.PublisherStatCpc == "" ||
		cfg.PublisherStatCompletion == "" || cfg.PublisherStatCreateFee == "" ||
		cfg.PublisherStatSourceNote == "" ||
		cfg.PublisherCampaignsHeading == "" || cfg.PublisherManageCampaigns == "" ||
		cfg.PublisherManageCampaignsHref == "" ||
		cfg.PublisherAnalyticsTitle == "" || cfg.PublisherAnalyticsBody == "" ||
		cfg.PublisherPricingUnavailable == "" || cfg.PublisherInvoiceAction == "" ||
		cfg.PublisherInvoicePending == "" || cfg.PublisherInvoiceFailed == "" ||
		cfg.PublisherInvoiceFilename == "" ||
		cfg.InvoicePDFTitle == "" || cfg.InvoicePDFGeneratedTemplate == "" ||
		cfg.InvoicePDFPublisherTemplate == "" || cfg.InvoicePDFCurrencyTemplate == "" ||
		cfg.InvoicePDFTableHeader == "" || cfg.InvoicePDFTableRule == "" ||
		cfg.InvoicePDFLineTemplate == "" || cfg.InvoicePDFTotalsTemplate == "" ||
		cfg.InvoicePDFSettleBlurb == "" ||
		cfg.ErrInvoiceListFailed == "" || cfg.ErrInvoiceCurrencyUnavailable == "" ||
		cfg.ErrInvoicePDFUnavailable == "" || cfg.ErrDashboardFailed == "" ||
		cfg.PlaybackUnavailable == "" ||
		cfg.PublisherPortalWalletLabel == "" || cfg.PublisherPortalReceiptsLabel == "" ||
		cfg.PublisherPortalTransactionsLabel == "" || cfg.PublisherPortalOverviewLabel == "" ||
		cfg.PublisherPortalCreateLabel == "" || cfg.PublisherPortalSectionTitle == "" ||
		cfg.PublisherPortalWalletHref == "" || cfg.PublisherPortalReceiptsHref == "" ||
		cfg.PublisherPortalTransactionsHref == "" ||
		cfg.PublisherPortalPayoutLabel == "" || cfg.PublisherPortalPayoutHref == "" ||
		cfg.PublisherPortalPayoutBlurb == "" ||
		cfg.PublisherPortalOverviewHref == "" || cfg.PublisherPortalCreateHref == "" ||
		cfg.CampaignCreateFeeLabel == "" || cfg.CampaignCreateFeeBlurb == "" ||
		cfg.InsufficientCampaignCreateFee == "" ||
		cfg.CloseCampaignAction == "" || cfg.ReopenCampaignAction == "" ||
		cfg.CannotReopenCampaignBlurb == "" || cfg.ToastCampaignClosed == "" ||
		cfg.ToastCampaignReopened == "" || cfg.ToastCampaignCloseFailed == "" ||
		cfg.ToastCampaignReopenFailed == "" || cfg.AutoClosedBadge == "" ||
		cfg.EndsAtLabel == "" || cfg.EndsAtBlurb == "" || cfg.PhEndsAt == "" ||
		cfg.MetaSeparator == "" || cfg.AmountCurrencySeparator == "" ||
		cfg.ParenOpen == "" || cfg.ParenClose == "" ||
		cfg.RuntimePermissionKey == "" || cfg.CampaignsPermissionKey == "" ||
		cfg.ThumbnailLabel == "" || cfg.GalleryLabel == "" ||
		cfg.GalleryAddAction == "" || cfg.GalleryEmpty == "" ||
		cfg.ThumbnailUploadAction == "" || cfg.ToastThumbnailSaved == "" ||
		cfg.ToastGallerySaved == "" || cfg.MediaUploadFailed == "" ||
		cfg.GalleryMaxSlots == "" || cfg.GallerySlotsFmt == "" ||
		cfg.ThumbnailMainBadge == "" || cfg.ThumbnailEmptyHint == "" ||
		cfg.ThumbnailHint == "" || cfg.GalleryLimitReached == "" ||
		cfg.ListPageSize == "" || cfg.EmptyValue == "" ||
		cfg.CancelAction == "" || cfg.DialogCloseLabel == "" ||
		cfg.SearchCampaignsLabel == "" || cfg.SearchCampaignsPlaceholder == "" ||
		cfg.FilterStatusLabel == "" || cfg.FilterStatusAll == "" ||
		cfg.ViewAction == "" || cfg.EditAction == "" || cfg.RowActionsLabel == "" ||
		cfg.SelectAllLabel == "" || cfg.SelectRowLabel == "" ||
		cfg.SelectedCountFmt == "" || cfg.ClearSelectionAction == "" ||
		cfg.BulkApplyStatusAction == "" || cfg.BulkStatusPending == "" ||
		cfg.DeleteCampaignAction == "" || cfg.DeleteCampaignPending == "" ||
		cfg.DeleteCampaignConfirmTitle == "" || cfg.DeleteCampaignConfirmDescription == "" ||
		cfg.ToastCampaignDeleted == "" || cfg.ToastCampaignDeleteFailed == "" ||
		cfg.ErrDeleteHasDelivery == "" || cfg.ErrDeleteAutoClosed == "" ||
		cfg.ErrDailySpendCapRequired == "" || cfg.DailySpendCapRequiredHint == "" ||
		cfg.PublisherPortalTransferLabel == "" || cfg.PublisherPortalTransferHref == "" ||
		cfg.SavePending == "" || cfg.SaveCampaignSchedulePending == "" ||
		cfg.UpdateStatusPending == "" || cfg.CreatePending == "" ||
		cfg.ReplaceCreativePending == "" || cfg.AttachVideoPending == "" ||
		cfg.ThumbnailUploadPending == "" || cfg.GalleryUploadPending == "" ||
		cfg.MapLocationSectionTitle == "" || cfg.MapPinEmpty == "" ||
		cfg.MapUseDeviceLocation == "" || cfg.MapClearPin == "" ||
		cfg.MapHelperText == "" || cfg.MapGeolocationUnavailable == "" ||
		cfg.MapGeolocationFailed == "" || cfg.MapPinRequired == "" ||
		cfg.MapPinCoordsFmt == "" || cfg.MapListingsCountFmt == "" ||
		cfg.MapLocateFailed == "" ||
		cfg.ErrMapPinRequired == "" || cfg.ErrMapLocateFailed == "" ||
		cfg.DailySpendCapLabel == "" || cfg.DailySpendCapSuffix == "" ||
		cfg.VideoIDLabel == "" ||
		cfg.CreativeURLLabel == "" || cfg.ColTitle == "" ||
		cfg.CreatedAtLabel == "" {
		return errors.New("ad_runtime_chrome incomplete in platform_settings")
	}
	if n, err := strconv.Atoi(strings.TrimSpace(cfg.ListPageSize)); err != nil || n < 1 {
		return errors.New("ad_runtime_chrome list_page_size invalid")
	}
	cfg.Source = "database"
	doc := map[string]string{}
	var rawDoc map[string]any
	if err := json.Unmarshal(raw, &rawDoc); err == nil {
		for k, v := range rawDoc {
			if s, ok := v.(string); ok {
				doc[k] = strings.TrimSpace(s)
			}
		}
	}
	s.mu.Lock()
	s.adChrome = cfg
	s.adChromeDoc = doc
	s.mu.Unlock()
	return nil
}

func (s *SettingsStore) AdRuntimeChrome() AdRuntimeChromeConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.adChrome
}

// AdRuntimeChromeString returns a DB chrome string by key (err_* and labels). Fail closed empty.
func (s *SettingsStore) AdRuntimeChromeString(key string) string {
	if s == nil {
		return ""
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return ""
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return strings.TrimSpace(s.adChromeDoc[key])
}

func (s *SettingsStore) ReloadAdPlayerChrome(ctx context.Context) error {
	if s.db == nil || !s.db.Ready() {
		return nil
	}
	row := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'ad_player_chrome'`)
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		return err
	}
	var cfg AdPlayerChromeConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	if cfg.SponsoredLabel == "" || cfg.SkipInTemplate == "" || cfg.CanContinueLabel == "" ||
		cfg.ContinueAction == "" || cfg.Unavailable == "" ||
		cfg.PlacementLobby == "" || cfg.PlacementInMatch == "" {
		return errors.New("ad_player_chrome incomplete in platform_settings")
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.adPlayer = cfg
	s.mu.Unlock()
	return nil
}

func (s *SettingsStore) AdPlayerChrome() AdPlayerChromeConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.adPlayer
}

func (s *SettingsStore) ReloadRBACChrome(ctx context.Context) error {
	if s.db == nil || !s.db.Ready() {
		return nil
	}
	row := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'rbac_chrome'`)
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		return err
	}
	var cfg RBACChromeConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return err
	}
	if cfg.PageTitle == "" || cfg.PageBody == "" || cfg.CatalogTitle == "" ||
		cfg.RolesLabel == "" || cfg.ConsoleRolesLabel == "" || cfg.PublisherRolesLabel == "" ||
		cfg.DefaultRoleLabel == "" || cfg.SaveCatalogAction == "" || cfg.SaveCatalogPending == "" ||
		cfg.PermissionsTitle == "" || cfg.PermissionsEmpty == "" ||
		cfg.PermKeyLabel == "" || cfg.PermTitleLabel == "" ||
		cfg.PermDescriptionLabel == "" || cfg.UpsertPermissionAction == "" ||
		cfg.UpsertPermissionPending == "" ||
		cfg.DeletePermissionAction == "" || cfg.DeletePermissionPending == "" ||
		cfg.GrantsTitle == "" || cfg.RoleLabel == "" ||
		cfg.SaveGrantsAction == "" || cfg.SaveGrantsPending == "" || cfg.Unavailable == "" ||
		cfg.LacksManage == "" || cfg.LoadFailed == "" ||
		cfg.ToastCatalogSaved == "" || cfg.ToastPermissionSaved == "" ||
		cfg.ToastPermissionDeleted == "" || cfg.ToastGrantsSaved == "" ||
		cfg.ToastSaveFailed == "" || cfg.ToastDeleteFailed == "" ||
		len(cfg.ProtectedPermissionKeys) == 0 ||
		cfg.ManagePermissionKey == "" || cfg.ErrProtectedDelete == "" ||
		cfg.ErrProtectedLastGrant == "" ||
		cfg.SelectAllLabel == "" || cfg.SelectRowLabel == "" ||
		cfg.SelectedCountFmt == "" || cfg.ClearSelectionAction == "" ||
		cfg.ViewAction == "" || cfg.EditAction == "" ||
		cfg.AddPermissionAction == "" || cfg.DialogCloseLabel == "" ||
		cfg.CancelAction == "" || cfg.RowActionsLabel == "" ||
		cfg.SearchLabel == "" || cfg.SearchPlaceholder == "" || cfg.DetailTitle == "" ||
		cfg.EmptyValue == "" ||
		cfg.TabCatalogLabel == "" || cfg.TabPermissionsLabel == "" || cfg.TabGrantsLabel == "" ||
		cfg.ConfirmDeleteTitle == "" || cfg.ConfirmDeleteDescription == "" ||
		cfg.ConfirmDelete == "" || cfg.ConfirmDeletePending == "" || cfg.ConfirmCancel == "" ||
		cfg.BulkDeleteAction == "" || cfg.BulkDeletePending == "" ||
		cfg.BulkDeleteConfirmTitle == "" || cfg.BulkDeleteConfirmDescription == "" ||
		cfg.ColRoleLabel == "" || cfg.ColConsoleLabel == "" || cfg.ColPublisherLabel == "" ||
		cfg.ColDefaultLabel == "" || cfg.AddRoleAction == "" || cfg.CatalogEmpty == "" ||
		cfg.FlagYesLabel == "" || cfg.FlagNoLabel == "" || cfg.DeleteRoleAction == "" ||
		cfg.ConfirmDeleteRoleTitle == "" || cfg.ConfirmDeleteRoleDescription == "" ||
		cfg.BulkDeleteRolesConfirmTitle == "" || cfg.BulkDeleteRolesConfirmDescription == "" ||
		cfg.IsConsoleLabel == "" || cfg.IsPublisherLabel == "" || cfg.IsDefaultLabel == "" ||
		cfg.UpsertRoleAction == "" || cfg.UpsertRolePending == "" || cfg.RoleDetailTitle == "" {
		return errors.New("rbac_chrome incomplete in platform_settings")
	}
	foundManage := false
	for _, k := range cfg.ProtectedPermissionKeys {
		if k == cfg.ManagePermissionKey {
			foundManage = true
			break
		}
	}
	if !foundManage {
		return errors.New("rbac_chrome manage_permission_key must be in protected_permission_keys")
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.rbacChrome = cfg
	s.mu.Unlock()
	return nil
}

func (s *SettingsStore) RBACChrome() RBACChromeConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.rbacChrome
}

// EffectiveAdTiming resolves campaign overrides against platform ad_playback (fail-closed).
// Null override = inherit platform. Non-null override outside DB bounds = error (no silent fallback).
func (s *SettingsStore) EffectiveAdTiming(c *AdCampaign) (nonSkip, firstShow, interval int, err error) {
	pb := s.AdPlayback()
	if pb.Source != "database" {
		return 0, 0, 0, fmt.Errorf("ad playback unavailable")
	}
	nonSkip = pb.NonSkippableSeconds
	firstShow = pb.FirstShowAfterGameSeconds
	interval = pb.DefaultIntervalSeconds
	if c == nil {
		return nonSkip, firstShow, interval, nil
	}
	if c.NonSkippableSeconds != nil {
		v := *c.NonSkippableSeconds
		if v < pb.NonSkippableMin || v > pb.NonSkippableMax {
			return 0, 0, 0, fmt.Errorf("campaign non_skippable_seconds out of bounds")
		}
		nonSkip = v
	}
	if c.FirstShowAfterSeconds != nil {
		v := *c.FirstShowAfterSeconds
		if v < pb.FirstShowMin || v > pb.FirstShowMax {
			return 0, 0, 0, fmt.Errorf("campaign first_show_after_seconds out of bounds")
		}
		firstShow = v
	}
	if c.IntervalSeconds != nil {
		v := *c.IntervalSeconds
		if v < pb.IntervalMin || v > pb.IntervalMax {
			return 0, 0, 0, fmt.Errorf("campaign interval_seconds out of bounds")
		}
		interval = v
	}
	return nonSkip, firstShow, interval, nil
}
