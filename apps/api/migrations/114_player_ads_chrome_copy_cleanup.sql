-- Replace leaked engineering copy with worldwide product chrome.
-- Improve form placeholders (ISO country, lat/lng, search/filter, dialog actions).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{page_blurb}',
  '"Update your photo and review career stats. Tap your avatar for a full profile card."'::jsonb
),
updated_at = NOW()
WHERE key = 'avatar_chrome'
  AND (
    COALESCE(value->>'page_blurb', '') ILIKE '%hydrate%'
    OR COALESCE(value->>'page_blurb', '') ILIKE '%backend%'
  );

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{page_blurb}',
  '"Browse top players by rating. Tap a player to open their profile card."'::jsonb
),
updated_at = NOW()
WHERE key = 'leaderboard_chrome'
  AND (
    COALESCE(value->>'page_blurb', '') ILIKE '%hydrate%'
    OR COALESCE(value->>'page_blurb', '') ILIKE '%backend%'
    OR COALESCE(value->>'page_blurb', '') ILIKE '%Tap an avatar%'
  );

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{blurb}',
  '"Find an opponent online. Your queue stays private until a match starts, then both players appear on the board."'::jsonb
),
updated_at = NOW()
WHERE key = 'matchmaking_chrome'
  AND (
    COALESCE(value->>'blurb', '') ILIKE '%hydrate%'
    OR COALESCE(value->>'blurb', '') ILIKE '%backend%'
    OR COALESCE(value->>'blurb', '') ILIKE '%Queue peers%'
  );

UPDATE platform_settings
SET value = value || '{
  "publisher_dash_body": "Track campaign performance, click-through rate, cost per click, and creative status.",
  "publisher_stat_source_note": "Live publisher metrics",
  "publisher_analytics_body": "Live campaign performance. Cost per click uses the platform impression unit price.",
  "ph_title": "Campaign title",
  "ph_country": "Country code (e.g. US, ET, GB)",
  "ph_region": "State / province / region (optional)",
  "ph_district": "City / district (optional)",
  "ph_lat": "Latitude (e.g. 9.0300)",
  "ph_lng": "Longitude (e.g. 38.7400)",
  "ph_radius_km": "Radius in km (e.g. 25)",
  "ph_daily_spend_cap": "Daily spend cap (local currency)",
  "search_campaigns_label": "Search",
  "search_campaigns_placeholder": "Search by title, status, or creative…",
  "filter_status_label": "Status",
  "filter_status_all": "All statuses",
  "view_action": "View",
  "cancel_action": "Cancel",
  "dialog_close_label": "Close"
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{graphql_empty}',
  '"No data returned. Try again in a moment."'::jsonb
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND COALESCE(value->>'graphql_empty', '') ILIKE '%GraphQL%';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{lobby_modes_blurb}',
  '"Available play modes for your region."'::jsonb
),
updated_at = NOW()
WHERE key = 'tournament_chrome'
  AND COALESCE(value->>'lobby_modes_blurb', '') ILIKE '%hydrate%';

-- KYC: distinct date placeholders (avoid duplicating field labels in the picker).
UPDATE platform_settings
SET value = value || '{
  "doc_kyc_issued_placeholder": "YYYY-MM-DD",
  "doc_kyc_expires_placeholder": "YYYY-MM-DD",
  "doc_kyc_country_placeholder": "Country code (e.g. US, ET, GB)",
  "doc_kyc_number_placeholder": "As printed on the ID",
  "doc_kyc_legal_name_placeholder": "Full name as printed on the ID",
  "age_gate_dob_placeholder": "YYYY-MM-DD",
  "phone_kyc_phone_placeholder": "+251 9xx xxx xxx"
}'::jsonb,
updated_at = NOW()
WHERE key = 'cash_rmg_chrome';
