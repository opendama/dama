-- Prize place table chrome for admin tournament create/edit (1st/2nd/3rd payout shares).
-- Place amounts live in tournaments.prize_pool jsonb keys "1","2","3" (no schema change).

UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'prize_places_section_label', COALESCE(
      NULLIF(trim(value->>'prize_places_section_label'), ''),
      'Prize places'
    ),
    'prize_place_1_label', COALESCE(
      NULLIF(trim(value->>'prize_place_1_label'), ''),
      '1st place'
    ),
    'prize_place_2_label', COALESCE(
      NULLIF(trim(value->>'prize_place_2_label'), ''),
      '2nd place'
    ),
    'prize_place_3_label', COALESCE(
      NULLIF(trim(value->>'prize_place_3_label'), ''),
      '3rd place'
    ),
    'prize_places_blurb', COALESCE(
      NULLIF(trim(value->>'prize_places_blurb'), ''),
      'Optional fixed amounts paid to finishers. Leave blank to pay the full pot to 1st. Sum must not exceed the prize pool total.'
    ),
    'err_prize_places_sum', COALESCE(
      NULLIF(trim(value->>'err_prize_places_sum'), ''),
      'Prize place amounts cannot exceed the prize pool total.'
    )
  ),
  updated_at = NOW()
WHERE key = 'admin_tournament_chrome';
