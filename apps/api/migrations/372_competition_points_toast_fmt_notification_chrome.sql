-- Expose client toast format on notification_chrome so web/Flutter bell canasts
-- use the same DB-driven fmt as admin points-toast settings (not invent English).
-- Idempotent.

UPDATE platform_settings AS nc
SET value = nc.value || jsonb_build_object(
  'toast_points_awarded_fmt', COALESCE(
    NULLIF(trim(nc.value->>'toast_points_awarded_fmt'), ''),
    NULLIF(trim(tpc.value->>'toast_points_awarded_fmt'), ''),
    '+{points} {label}'
  )
),
updated_at = NOW()
FROM platform_settings AS tpc
WHERE nc.key = 'notification_chrome'
  AND tpc.key = 'tournaments_player_chrome';

-- Keep player + play chrome keys present for fail-closed clients.
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'toast_points_awarded_fmt', COALESCE(NULLIF(trim(value->>'toast_points_awarded_fmt'), ''), '+{points} {label}')
),
updated_at = NOW()
WHERE key IN ('tournaments_player_chrome', 'events_player_chrome', 'play_chrome');
