-- Admin CRUD chrome for competition points toast labels + notification templates.
-- Idempotent.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'points_toast_settings_title', COALESCE(NULLIF(trim(value->>'points_toast_settings_title'), ''), 'Points toast'),
  'points_toast_settings_blurb', COALESCE(NULLIF(trim(value->>'points_toast_settings_blurb'), ''), 'Labels and notification copy shown when a player earns standings or arena points.'),
  'points_toast_settings_label_arena_points', COALESCE(NULLIF(trim(value->>'points_toast_settings_label_arena_points'), ''), 'Arena points label'),
  'points_toast_settings_label_standings_points', COALESCE(NULLIF(trim(value->>'points_toast_settings_label_standings_points'), ''), 'Standings points label'),
  'points_toast_settings_label_toast_fmt', COALESCE(NULLIF(trim(value->>'points_toast_settings_label_toast_fmt'), ''), 'Client toast format'),
  'points_toast_settings_label_notif_title', COALESCE(NULLIF(trim(value->>'points_toast_settings_label_notif_title'), ''), 'Notification title'),
  'points_toast_settings_label_notif_body', COALESCE(NULLIF(trim(value->>'points_toast_settings_label_notif_body'), ''), 'Notification body'),
  'points_toast_settings_notif_body_blurb', COALESCE(NULLIF(trim(value->>'points_toast_settings_notif_body_blurb'), ''), 'Use three %s placeholders: points, label, event title.'),
  'points_toast_settings_save_action', COALESCE(NULLIF(trim(value->>'points_toast_settings_save_action'), ''), 'Save points toast'),
  'points_toast_settings_save_pending', COALESCE(NULLIF(trim(value->>'points_toast_settings_save_pending'), ''), 'Saving'),
  'points_toast_settings_toast_saved', COALESCE(NULLIF(trim(value->>'points_toast_settings_toast_saved'), ''), 'Points toast settings saved'),
  'points_toast_settings_toast_failed', COALESCE(NULLIF(trim(value->>'points_toast_settings_toast_failed'), ''), 'Unable to save points toast settings')
),
updated_at = NOW()
WHERE key = 'tournament_chrome';

-- Keep player chrome toast keys present (fail-closed clients).
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'toast_points_awarded_fmt', COALESCE(NULLIF(trim(value->>'toast_points_awarded_fmt'), ''), '+{points} {label}'),
  'arena_points_label', COALESCE(NULLIF(trim(value->>'arena_points_label'), ''), 'Points'),
  'standings_points_label', COALESCE(NULLIF(trim(value->>'standings_points_label'), ''), 'Pts')
),
updated_at = NOW()
WHERE key = 'tournaments_player_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'toast_points_awarded_fmt', COALESCE(NULLIF(trim(value->>'toast_points_awarded_fmt'), ''), '+{points} {label}'),
  'arena_points_label', COALESCE(NULLIF(trim(value->>'arena_points_label'), ''), 'Points'),
  'standings_points_label', COALESCE(NULLIF(trim(value->>'standings_points_label'), ''), 'Pts')
),
updated_at = NOW()
WHERE key = 'events_player_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'toast_points_awarded_fmt', COALESCE(NULLIF(trim(value->>'toast_points_awarded_fmt'), ''), '+{points} {label}')
),
updated_at = NOW()
WHERE key = 'play_chrome';

INSERT INTO notification_kinds (code, audience, title_template, body_template, href_path, href_query_key)
VALUES
  (
    'player.competition_points_awarded',
    'player',
    'Points earned',
    'You earned +%s %s in "%s".',
    '/',
    'view'
  )
ON CONFLICT (code) DO UPDATE SET
  audience = EXCLUDED.audience,
  title_template = COALESCE(NULLIF(trim(notification_kinds.title_template), ''), EXCLUDED.title_template),
  body_template = COALESCE(NULLIF(trim(notification_kinds.body_template), ''), EXCLUDED.body_template),
  href_path = EXCLUDED.href_path,
  href_query_key = EXCLUDED.href_query_key;
