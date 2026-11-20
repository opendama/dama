-- DB-backed ad placement keys (no client invent of "lobby" / "in_match").
-- Ensure ad_runtime_chrome.lacks_permissions is present for console fail-closed UX.

UPDATE platform_settings
SET value = value || '{
  "placement_lobby": "lobby",
  "placement_in_match": "in_match"
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_player_chrome';

UPDATE platform_settings
SET value = value || '{
  "lacks_permissions": "Your role lacks ads.manage_runtime / ads.manage_campaigns."
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
