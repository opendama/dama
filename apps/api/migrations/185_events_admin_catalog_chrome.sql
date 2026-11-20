-- Events admin catalog chrome: min-players + permission gate strings (merge; fail-closed clients).
-- console_nav /events already appended in 182_hosted_events.sql.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "min_players_title": "Min players to start",
  "min_players_label": "Min players",
  "lacks_permissions": "Your role lacks events.manage_catalog.",
  "load_failed": "Could not load events catalog",
  "save_pending": "Saving…"
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_admin_chrome';
