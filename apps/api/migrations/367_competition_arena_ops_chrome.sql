-- Arena ops chrome + allow_join_while_live enum (idempotent).

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'competition_arena_allow_join_while_live',
  COALESCE(NULLIF(trim(value->>'competition_arena_allow_join_while_live'), ''), 'true')
),
updated_at = NOW()
WHERE key = 'client_enums';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'arena_settings_title', COALESCE(NULLIF(trim(value->>'arena_settings_title'), ''), 'Arena settings'),
  'arena_settings_blurb', COALESCE(NULLIF(trim(value->>'arena_settings_blurb'), ''), 'Platform defaults for arena scoring, pairing, and join rules.'),
  'arena_settings_save_action', COALESCE(NULLIF(trim(value->>'arena_settings_save_action'), ''), 'Save arena settings'),
  'arena_settings_save_pending', COALESCE(NULLIF(trim(value->>'arena_settings_save_pending'), ''), 'Saving'),
  'arena_settings_toast_saved', COALESCE(NULLIF(trim(value->>'arena_settings_toast_saved'), ''), 'Arena settings saved'),
  'arena_settings_toast_failed', COALESCE(NULLIF(trim(value->>'arena_settings_toast_failed'), ''), 'Unable to save arena settings'),
  'arena_settings_label_points_win', COALESCE(NULLIF(trim(value->>'arena_settings_label_points_win'), ''), 'Points per win'),
  'arena_settings_label_points_draw', COALESCE(NULLIF(trim(value->>'arena_settings_label_points_draw'), ''), 'Points per draw'),
  'arena_settings_label_points_loss', COALESCE(NULLIF(trim(value->>'arena_settings_label_points_loss'), ''), 'Points per loss'),
  'arena_settings_label_streak_second', COALESCE(NULLIF(trim(value->>'arena_settings_label_streak_second'), ''), 'Second win streak bonus'),
  'arena_settings_label_streak_third_plus', COALESCE(NULLIF(trim(value->>'arena_settings_label_streak_third_plus'), ''), 'Third+ win streak bonus'),
  'arena_settings_label_default_duration', COALESCE(NULLIF(trim(value->>'arena_settings_label_default_duration'), ''), 'Default duration (minutes)'),
  'arena_settings_label_pairing_mode', COALESCE(NULLIF(trim(value->>'arena_settings_label_pairing_mode'), ''), 'Default pairing mode'),
  'arena_settings_label_auto_start', COALESCE(NULLIF(trim(value->>'arena_settings_label_auto_start'), ''), 'Auto-start paired games'),
  'arena_settings_label_pair_interval', COALESCE(NULLIF(trim(value->>'arena_settings_label_pair_interval'), ''), 'Pairing worker interval (seconds)'),
  'arena_settings_label_allow_join_while_live', COALESCE(NULLIF(trim(value->>'arena_settings_label_allow_join_while_live'), ''), 'Allow join while arena is live')
),
updated_at = NOW()
WHERE key = 'tournament_chrome';
