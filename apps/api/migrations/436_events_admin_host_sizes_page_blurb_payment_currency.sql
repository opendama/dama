-- Force-update events admin page_blurb: no hardcoded ETB/USD (payment_currency owns codes).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'page_blurb', 'Enable formats and manage host sizes. Each size has an Ethiopia host fee and a global host fee (currencies from payment_currency), same pattern as campaign create fees.'
),
updated_at = NOW()
WHERE key = 'events_admin_chrome';
