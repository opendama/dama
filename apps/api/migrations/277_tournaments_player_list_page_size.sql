-- Player tournaments list_page_size from DB (no client invent of 12).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'list_page_size',
  COALESCE(NULLIF(trim(value->>'list_page_size'), ''), '12')
),
    updated_at = NOW()
WHERE key = 'tournaments_player_chrome';
