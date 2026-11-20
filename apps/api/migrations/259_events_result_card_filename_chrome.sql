-- Result card download/share filename from DB chrome (no client invent).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'result_card_filename', COALESCE(NULLIF(trim(value->>'result_card_filename'), ''), 'dama-result-card.png')
),
    updated_at = NOW()
WHERE key = 'events_organizer_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'result_card_filename', COALESCE(NULLIF(trim(value->>'result_card_filename'), ''), 'dama-result-card.png')
),
    updated_at = NOW()
WHERE key = 'events_player_chrome';
