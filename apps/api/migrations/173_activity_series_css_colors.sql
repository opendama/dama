-- Activity series colors as CSS color values (Trim chart theme: resolve via computed style).
-- Replaces Tailwind utility class strings so Recharts + legend can use real colors.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{activity}',
  (value->'activity')
    || jsonb_build_object(
      'series_visited_color', 'var(--dama-gold)',
      'series_played_color', 'var(--dama-text)',
      'series_games_color', 'var(--dama-muted)',
      'series_new_users_color', 'var(--dama-online)'
    )
),
updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND value ? 'activity';
