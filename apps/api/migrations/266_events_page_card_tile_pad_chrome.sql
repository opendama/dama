-- Page card / KPI tile / analytics chip padding from DB chrome (no client invent).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'page_card_pad', COALESCE(NULLIF(trim(value->>'page_card_pad'), ''), '12'),
  'page_card_gap', COALESCE(NULLIF(trim(value->>'page_card_gap'), ''), '8'),
  'dashboard_tile_pad', COALESCE(NULLIF(trim(value->>'dashboard_tile_pad'), ''), '14'),
  'dashboard_tile_radius', COALESCE(NULLIF(trim(value->>'dashboard_tile_radius'), ''), '10'),
  'analytics_chip_pad_h', COALESCE(NULLIF(trim(value->>'analytics_chip_pad_h'), ''), '12'),
  'analytics_chip_pad_v', COALESCE(NULLIF(trim(value->>'analytics_chip_pad_v'), ''), '10'),
  'analytics_chip_radius', COALESCE(NULLIF(trim(value->>'analytics_chip_radius'), ''), '8')
),
    updated_at = NOW()
WHERE key = 'events_organizer_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'page_card_pad', COALESCE(NULLIF(trim(value->>'page_card_pad'), ''), '12'),
  'page_card_gap', COALESCE(NULLIF(trim(value->>'page_card_gap'), ''), '8')
),
    updated_at = NOW()
WHERE key = 'events_player_chrome';
