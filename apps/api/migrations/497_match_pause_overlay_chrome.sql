-- Match pause board overlay chrome (blur VS board cover, same family as match intro).
-- Soft-fill only. Player and official pause share the overlay shell; copy differs by kind.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'pause_overlay_aria', COALESCE(
    NULLIF(trim(value->>'pause_overlay_aria'), ''),
    'Match paused'
  ),
  'pause_overlay_until_resume', COALESCE(
    NULLIF(trim(value->>'pause_overlay_until_resume'), ''),
    'Waiting for an official to resume'
  ),
  'player_paused_by_fmt', COALESCE(
    NULLIF(trim(value->>'player_paused_by_fmt'), ''),
    'Paused by {role} · {name}'
  )
),
updated_at = NOW()
WHERE key = 'play_chrome';
