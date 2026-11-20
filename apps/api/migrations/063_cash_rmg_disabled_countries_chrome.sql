-- Admin chrome for per-country cash RMG kill list (payload.disabled_countries).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{feature_flags}',
  COALESCE(value->'feature_flags', '{}'::jsonb) || '{
    "cash_disabled_countries_title": "Cash disabled countries",
    "cash_disabled_countries_blurb": "ISO country codes where cash tournaments stay blocked even when Cash / RMG is enabled. Comma-separated. Empty means no per-country override.",
    "cash_disabled_countries_label": "Disabled country codes",
    "cash_disabled_countries_save": "Save disabled countries",
    "cash_disabled_countries_saved": "Disabled countries updated",
    "cash_disabled_countries_failed": "Unable to update disabled countries"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND COALESCE(value->'feature_flags'->>'cash_disabled_countries_title', '') = '';
