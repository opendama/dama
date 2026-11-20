-- Player-pause overlay "who" role label on play_chrome (seat clients).
-- Soft-fill only. Prefer existing official_pause_chrome.role_player_label when present.
-- Does not change official pause ops chrome or RBAC.

UPDATE platform_settings AS pc
SET value = COALESCE(pc.value, '{}'::jsonb) || jsonb_build_object(
  'role_player_label', COALESCE(
    NULLIF(trim(pc.value->>'role_player_label'), ''),
    NULLIF(trim(opc.value->>'role_player_label'), ''),
    'Player'
  )
),
updated_at = NOW()
FROM platform_settings AS opc
WHERE pc.key = 'play_chrome'
  AND opc.key = 'official_pause_chrome';

-- If official_pause_chrome row is missing, still soft-fill play_chrome alone.
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'role_player_label', COALESCE(
    NULLIF(trim(value->>'role_player_label'), ''),
    'Player'
  )
),
updated_at = NOW()
WHERE key = 'play_chrome'
  AND NULLIF(trim(value->>'role_player_label'), '') IS NULL;
