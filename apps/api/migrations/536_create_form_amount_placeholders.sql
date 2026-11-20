-- Create-form amount placeholders (Community host + Official admin).
-- Heal-only. Labels already exist; add clear empty-state hints for amount inputs.
-- Select placeholders continue to reuse existing *_label keys (format/size/payout/visibility).

-- Community organizer create / manage
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'prize_pool_guarantee_amount_placeholder',
  COALESCE(
    NULLIF(trim(value->>'prize_pool_guarantee_amount_placeholder'), ''),
    '0.00'
  ),
  'prize_place_percent_1_placeholder',
  COALESCE(
    NULLIF(trim(value->>'prize_place_percent_1_placeholder'), ''),
    '50'
  ),
  'prize_place_percent_2_placeholder',
  COALESCE(
    NULLIF(trim(value->>'prize_place_percent_2_placeholder'), ''),
    '30'
  ),
  'prize_place_percent_3_placeholder',
  COALESCE(
    NULLIF(trim(value->>'prize_place_percent_3_placeholder'), ''),
    '20'
  ),
  'arena_duration_length_placeholder',
  COALESCE(
    NULLIF(trim(value->>'arena_duration_length_placeholder'), ''),
    '90'
  )
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

-- Official admin tournament create / edit (same place-% + arena length pattern)
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'prize_place_percent_1_placeholder',
  COALESCE(
    NULLIF(trim(value->>'prize_place_percent_1_placeholder'), ''),
    '50'
  ),
  'prize_place_percent_2_placeholder',
  COALESCE(
    NULLIF(trim(value->>'prize_place_percent_2_placeholder'), ''),
    '30'
  ),
  'prize_place_percent_3_placeholder',
  COALESCE(
    NULLIF(trim(value->>'prize_place_percent_3_placeholder'), ''),
    '20'
  ),
  'arena_duration_length_placeholder',
  COALESCE(
    NULLIF(trim(value->>'arena_duration_length_placeholder'), ''),
    '90'
  )
),
updated_at = NOW()
WHERE key = 'tournament_chrome';
