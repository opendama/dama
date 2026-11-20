-- Dual purse (PKO-style): place purse (finish %) + performance purse (standings/arena Pts).
-- End-of-cup only: freeze → finish → split frozen pot → escrow → settle.
-- Idempotent. Does not change existing format defaults (places% / score_share remain).

-- ---------------------------------------------------------------------------
-- client_enums: dual_purse mode id + place-purse split % of frozen pot
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'competition_payout_modes',
  CASE
    WHEN COALESCE(value->'competition_payout_modes', '[]'::jsonb) ? 'dual_purse'
      THEN value->'competition_payout_modes'
    ELSE COALESCE(value->'competition_payout_modes', '["places_percent","score_share"]'::jsonb)
      || '["dual_purse"]'::jsonb
  END,
  'competition_payout_mode_dual_purse',
  COALESCE(NULLIF(trim(value->>'competition_payout_mode_dual_purse'), ''), 'dual_purse'),
  'competition_dual_purse_place_percent',
  COALESCE(NULLIF(trim(value->>'competition_dual_purse_place_percent'), ''), '50')
),
updated_at = NOW()
WHERE key = 'client_enums';

-- ---------------------------------------------------------------------------
-- Admin / organizer chrome
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || jsonb_build_object(
  -- Force-update blurbs (not COALESCE): 368/370 places%/score-share copy must become dual-aware.
  'payout_mode_blurb',
  'Places % pays by finish. Score-share pays by points. Dual purse splits the pot: finish prizes + cash for wins.',
  'payout_mode_dual_purse_label', COALESCE(NULLIF(trim(value->>'payout_mode_dual_purse_label'), ''), 'Dual purse'),
  'dual_purse_place_percent_label', COALESCE(NULLIF(trim(value->>'dual_purse_place_percent_label'), ''), 'Place purse % of pot'),
  'dual_purse_place_percent_blurb', COALESCE(NULLIF(trim(value->>'dual_purse_place_percent_blurb'), ''),
    'Share of the frozen pot paid by finish place. The rest is the performance purse (wins / points). Must be between 1 and 99.'),
  'prize_place_percents_blurb',
  'Must sum to 100. Places %: full frozen pot. Dual purse: place purse only. Cups freeze at start; Arena freezes when the arena ends.',
  -- Heal legacy fixed-place $ chrome (required by tournament_chrome fail-closed; mig 364 wrote admin_tournament_chrome).
  'prize_places_section_label', COALESCE(NULLIF(trim(value->>'prize_places_section_label'), ''), 'Prize places'),
  'prize_place_1_label', COALESCE(NULLIF(trim(value->>'prize_place_1_label'), ''), '1st place'),
  'prize_place_2_label', COALESCE(NULLIF(trim(value->>'prize_place_2_label'), ''), '2nd place'),
  'prize_place_3_label', COALESCE(NULLIF(trim(value->>'prize_place_3_label'), ''), '3rd place'),
  'prize_places_blurb', COALESCE(NULLIF(trim(value->>'prize_places_blurb'), ''),
    'Optional fixed amounts paid to finishers. Leave blank when using Places % / Score-share / Dual purse.'),
  'err_prize_places_sum', COALESCE(NULLIF(trim(value->>'err_prize_places_sum'), ''),
    'Prize place amounts cannot exceed the prize pool total.')
),
updated_at = NOW()
WHERE key = 'tournament_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  -- Force-update blurbs (not COALESCE): 368/370 places%/score-share copy must become dual-aware.
  'payout_mode_blurb',
  'Places % pays by finish. Score-share pays by points. Dual purse splits the pot: finish prizes + cash for wins.',
  'payout_mode_dual_purse_label', COALESCE(NULLIF(trim(value->>'payout_mode_dual_purse_label'), ''), 'Dual purse'),
  'prize_place_percents_blurb',
  'Must sum to 100. Places %: full frozen pot. Dual purse: place purse only. Cups freeze at start; Arena freezes when the arena ends.'
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';
