-- Dialog / panel / standings widths from DB chrome (no client invent).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'wide_dialog_max_width', COALESCE(NULLIF(trim(value->>'wide_dialog_max_width'), ''), '672'),
  'search_field_max_width', COALESCE(NULLIF(trim(value->>'search_field_max_width'), ''), '448'),
  'list_blurb_max_width', COALESCE(NULLIF(trim(value->>'list_blurb_max_width'), ''), '672'),
  'standings_table_min_width', COALESCE(NULLIF(trim(value->>'standings_table_min_width'), ''), '320')
),
    updated_at = NOW()
WHERE key = 'events_organizer_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'panel_max_width', COALESCE(NULLIF(trim(value->>'panel_max_width'), ''), '512'),
  'browse_max_width', COALESCE(NULLIF(trim(value->>'browse_max_width'), ''), '672'),
  'standings_table_min_width', COALESCE(NULLIF(trim(value->>'standings_table_min_width'), ''), '320')
),
    updated_at = NOW()
WHERE key = 'events_player_chrome';
