-- Tournaments browse: mobile/tablet filters toggle + search debounce (fail-closed chrome).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'filters_toggle_label', COALESCE(NULLIF(trim(value->>'filters_toggle_label'), ''), 'Filters'),
  'filters_toggle_show_aria', COALESCE(NULLIF(trim(value->>'filters_toggle_show_aria'), ''), 'Show filters'),
  'filters_toggle_hide_aria', COALESCE(NULLIF(trim(value->>'filters_toggle_hide_aria'), ''), 'Hide filters'),
  'search_debounce_ms', COALESCE(NULLIF(trim(value->>'search_debounce_ms'), ''), '250')
),
    updated_at = NOW()
WHERE key = 'tournaments_player_chrome';
