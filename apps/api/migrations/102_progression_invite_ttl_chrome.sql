-- Admin progression form: invite TTL label (fail-closed; no client invent).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || '{
    "invite_ttl_seconds_label": "Challenge / invite link TTL (seconds)"
  }'::jsonb,
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
