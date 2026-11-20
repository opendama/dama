-- Player public list / join cells: DB empty_value (no client invent 0 / "-").
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'empty_value',
    COALESCE(NULLIF(trim(value->>'empty_value'), ''), '-'),
    'players_count_suffix',
    COALESCE(NULLIF(trim(value->>'players_count_suffix'), ''), 'players'),
    'amount_currency_separator',
    COALESCE(
      NULLIF(trim(value->>'amount_currency_separator'), ''),
      ' '
    )
  ),
  updated_at = NOW()
WHERE key = 'events_player_chrome';
