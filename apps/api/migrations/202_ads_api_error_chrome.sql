-- Ads API errors: DB chrome only (no English invent in ads_handlers).
-- Keys read via SettingsStore.AdRuntimeChromeString / writeAdsErr.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "err_pricing_unavailable": "Ad pricing unavailable",
  "err_title_required": "Title is required",
  "err_creative_type_required": "Creative type is required",
  "err_invalid_creative_type": "Invalid creative type",
  "err_campaign_defaults_unavailable": "Campaign defaults unavailable",
  "err_invalid_ends_at": "Invalid ends_at",
  "err_status_required": "Status is required",
  "err_invalid_status": "Invalid status",
  "err_campaign_cannot_reopen": "Campaign cannot reopen",
  "err_cannot_reopen": "Cannot reopen",
  "err_video_creative_unavailable": "Video creative type unavailable",
  "err_servable_status_unavailable": "Servable campaign status unavailable",
  "err_invalid_body": "Invalid request body",
  "err_placement_required": "Placement is required",
  "err_invalid_placement": "Invalid placement",
  "err_player_chrome_unavailable": "Ad player chrome unavailable",
  "err_playback_unavailable": "Ad playback unavailable",
  "err_runtime_chrome_unavailable": "Ad runtime chrome unavailable",
  "err_game_elapsed_required": "game_elapsed_seconds is required",
  "err_creative_url_required": "Creative URL is required",
  "err_unauthorized": "Sign in required",
  "err_invalid_multipart": "Invalid upload form",
  "err_file_required": "A file is required",
  "err_read_failed": "Could not read the file",
  "err_validation_failed": "Invalid request",
  "err_campaign_not_found": "Campaign not found",
  "err_create_failed": "Unable to create campaign",
  "err_rollback_failed": "Unable to roll back unpaid campaign",
  "err_media_upload_failed": "Unable to upload media",
  "err_list_failed": "Unable to load campaigns",
  "err_video_queue_failed": "Unable to queue video upload",
  "err_video_upload_failed": "Unable to upload video",
  "err_serve_failed": "Unable to serve ads",
  "err_schedule_list_failed": "Unable to load scheduled campaigns",
  "err_caps_failed": "Unable to read impression caps",
  "err_click_failed": "Unable to record click",
  "err_media_unavailable": "Media upload unavailable",
  "err_completion_failed": "Unable to record completion"
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome';

-- Player events browse + bracket labels for Flutter (parity with web).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "meta_separator": " · ",
  "bracket_bye_label": "bye",
  "bracket_vs_label": "vs",
  "bracket_empty_seat": "-"
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_player_chrome';

-- Organizer bracket labels for Flutter (no invent bye/vs/-).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "bracket_bye_label": "bye",
  "bracket_vs_label": "vs",
  "bracket_empty_seat": "-"
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_organizer_chrome';
