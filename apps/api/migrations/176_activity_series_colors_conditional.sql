-- Soften mig 173: only fill series_*_color when missing or still Tailwind bg-[var(...)] legacy.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{activity}',
  (value->'activity')
    || CASE WHEN COALESCE(value->'activity'->>'series_visited_color', '') = ''
          OR (value->'activity'->>'series_visited_color') LIKE 'bg-[%'
        THEN jsonb_build_object('series_visited_color', 'var(--dama-gold)') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'series_played_color', '') = ''
          OR (value->'activity'->>'series_played_color') LIKE 'bg-[%'
        THEN jsonb_build_object('series_played_color', 'var(--dama-text)') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'series_games_color', '') = ''
          OR (value->'activity'->>'series_games_color') LIKE 'bg-[%'
        THEN jsonb_build_object('series_games_color', 'var(--dama-muted)') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'series_new_users_color', '') = ''
          OR (value->'activity'->>'series_new_users_color') LIKE 'bg-[%'
        THEN jsonb_build_object('series_new_users_color', 'var(--dama-online)') ELSE '{}'::jsonb END
),
updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND value ? 'activity';
