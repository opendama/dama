-- Admin tournament section tabs: list tab label for dedicated section routes.
-- Idempotent.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'tab_list_label', COALESCE(NULLIF(trim(value->>'tab_list_label'), ''), 'Tournaments')
),
updated_at = NOW()
WHERE key = 'tournament_chrome';
