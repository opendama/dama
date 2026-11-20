-- Admin chrome for cash RMG allowlist CRUD (cash_rmg_policy.allowed_country_codes).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{feature_flags}',
  COALESCE(value->'feature_flags', '{}'::jsonb) || '{
    "cash_allowed_countries_title": "Cash allowed countries",
    "cash_allowed_countries_blurb": "ISO country codes where cash tournaments, top-ups, and payouts may run. At least one code is required. Free play is unaffected. Comma-separated for bulk save.",
    "cash_allowed_countries_label": "Allowed country codes",
    "cash_allowed_countries_add_label": "Add country code",
    "cash_allowed_countries_add_action": "Add",
    "cash_allowed_countries_remove_action": "Remove",
    "cash_allowed_countries_save": "Save allowed countries",
    "cash_allowed_countries_saved": "Allowed countries updated",
    "cash_allowed_countries_failed": "Unable to update allowed countries",
    "cash_allowed_countries_empty": "Keep at least one allowed country. Use the cash kill switch to block all cash instead."
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND COALESCE(value->'feature_flags'->>'cash_allowed_countries_title', '') = '';
