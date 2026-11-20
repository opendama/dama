-- Admin + organizer list filters (entry free/paid + search). Pagination stays skip/limit server-side.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'filter_all_label', COALESCE(NULLIF(trim(value->>'filter_all_label'), ''), 'All'),
  'filter_free_label', COALESCE(NULLIF(trim(value->>'filter_free_label'), ''), 'Free'),
  'filter_paid_label', COALESCE(NULLIF(trim(value->>'filter_paid_label'), ''), 'Paid'),
  'filter_entry_label', COALESCE(NULLIF(trim(value->>'filter_entry_label'), ''), 'Entry'),
  'search_label', COALESCE(NULLIF(trim(value->>'search_label'), ''), 'Search'),
  'search_placeholder', COALESCE(NULLIF(trim(value->>'search_placeholder'), ''), 'Search tournaments')
),
    updated_at = NOW()
WHERE key = 'tournament_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'filter_all_label', COALESCE(NULLIF(trim(value->>'filter_all_label'), ''), 'All'),
  'filter_free_label', COALESCE(NULLIF(trim(value->>'filter_free_label'), ''), 'Free'),
  'filter_paid_label', COALESCE(NULLIF(trim(value->>'filter_paid_label'), ''), 'Paid'),
  'filter_entry_label', COALESCE(NULLIF(trim(value->>'filter_entry_label'), ''), 'Entry'),
  'search_label', COALESCE(NULLIF(trim(value->>'search_label'), ''), 'Search'),
  'search_placeholder', COALESCE(NULLIF(trim(value->>'search_placeholder'), ''), 'Search events')
),
    updated_at = NOW()
WHERE key = 'events_admin_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'filter_all_label', COALESCE(NULLIF(trim(value->>'filter_all_label'), ''), 'All'),
  'filter_free_label', COALESCE(NULLIF(trim(value->>'filter_free_label'), ''), 'Free'),
  'filter_paid_label', COALESCE(NULLIF(trim(value->>'filter_paid_label'), ''), 'Paid'),
  'filter_entry_label', COALESCE(NULLIF(trim(value->>'filter_entry_label'), ''), 'Entry')
),
    updated_at = NOW()
WHERE key = 'events_organizer_chrome';
