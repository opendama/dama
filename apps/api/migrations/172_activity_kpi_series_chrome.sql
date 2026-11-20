-- Activity analytics: DB-backed series bar color classes (Trim-style chart meta; no client invent).
-- Only fills missing keys; does not overwrite operator edits.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{activity}',
  (value->'activity')
    || CASE WHEN COALESCE(value->'activity'->>'series_visited_color', '') = ''
        THEN jsonb_build_object('series_visited_color', 'var(--dama-gold)') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'series_played_color', '') = ''
        THEN jsonb_build_object('series_played_color', 'var(--dama-text)') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'series_games_color', '') = ''
        THEN jsonb_build_object('series_games_color', 'var(--dama-muted)') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'series_new_users_color', '') = ''
        THEN jsonb_build_object('series_new_users_color', 'var(--dama-online)') ELSE '{}'::jsonb END
),
updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND value ? 'activity';
