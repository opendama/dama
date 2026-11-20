-- Free cups: Join CTA (no pay modal). List filters + clearer already-enrolled copy.
-- Pagination remains skip/limit; filters are server-side (is_free / is_free_entry / q).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'join_action', COALESCE(NULLIF(trim(value->>'join_action'), ''), 'Join'),
  'joining_action', COALESCE(NULLIF(trim(value->>'joining_action'), ''), 'Joining…'),
  'filter_all_label', COALESCE(NULLIF(trim(value->>'filter_all_label'), ''), 'All'),
  'filter_free_label', COALESCE(NULLIF(trim(value->>'filter_free_label'), ''), 'Free'),
  'filter_paid_label', COALESCE(NULLIF(trim(value->>'filter_paid_label'), ''), 'Paid'),
  'filter_entry_label', COALESCE(NULLIF(trim(value->>'filter_entry_label'), ''), 'Entry'),
  'search_label', COALESCE(NULLIF(trim(value->>'search_label'), ''), 'Search'),
  'search_placeholder', COALESCE(NULLIF(trim(value->>'search_placeholder'), ''), 'Search tournaments')
),
    updated_at = NOW()
WHERE key = 'tournaments_player_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'join_cta', COALESCE(NULLIF(trim(value->>'join_cta'), ''), 'Join')
),
    updated_at = NOW()
WHERE key = 'home_surface_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{already_enrolled}',
  to_jsonb(
    CASE
      WHEN COALESCE(trim(value->>'already_enrolled'), '') IN ('', 'Already enrolled')
        THEN 'You are already enrolled in this tournament.'
      ELSE trim(value->>'already_enrolled')
    END
  )
),
    updated_at = NOW()
WHERE key = 'payment_modal_chrome';

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
WHERE key = 'events_player_chrome';
