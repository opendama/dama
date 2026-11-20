-- Mig 375: force dual-aware payout chrome blurbs.
-- 368/370 wrote places%/score-share-only copy; 374 initially used empty-only COALESCE
-- so dual copy never landed on live DBs. Idempotent force-update (parity with mig 370).

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'payout_mode_blurb',
  'Places % pays by finish. Score-share pays by points. Dual purse splits the pot: finish prizes + cash for wins.',
  'prize_place_percents_blurb',
  'Must sum to 100. Places %: full frozen pot. Dual purse: place purse only. Cups freeze at start; Arena freezes when the arena ends.'
),
updated_at = NOW()
WHERE key = 'tournament_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'payout_mode_blurb',
  'Places % pays by finish. Score-share pays by points. Dual purse splits the pot: finish prizes + cash for wins.',
  'prize_place_percents_blurb',
  'Must sum to 100. Places %: full frozen pot. Dual purse: place purse only. Cups freeze at start; Arena freezes when the arena ends.'
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';
