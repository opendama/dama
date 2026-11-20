-- Player /settings: fail-closed chrome (no English invent for blurb/session/profile CTA).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "settings_session_label": "Session",
  "settings_unavailable": "Settings chrome unavailable"
}'::jsonb,
updated_at = NOW()
WHERE key = 'client_nav';
