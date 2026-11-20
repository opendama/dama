-- Share blurb must not invent TTL minutes (invite_ttl_seconds is admin-editable).
-- label_unrated: accept-dialog / invite meta (fail-closed; pairs with label_rated).

UPDATE platform_settings
SET value = value || '{
  "copied_share_blurb": "Copied! Share this link before it expires to start a game.",
  "label_unrated": "Unrated"
}'::jsonb,
updated_at = NOW()
WHERE key = 'play_rail_chrome';

-- Admin progression: web app origin label for Flutter share/challenge links.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || '{
    "web_app_origin_label": "Player web app origin (challenge / share links)"
  }'::jsonb,
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
