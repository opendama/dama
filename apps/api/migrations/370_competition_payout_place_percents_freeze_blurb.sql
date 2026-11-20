-- Mig 370: place-% blurb must match freeze timing (cups at start; Arena at finish).
-- Force-update chrome (not COALESCE) so prior "at start" copy is corrected.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'prize_place_percents_blurb',
  'Must sum to 100. Applied to the frozen pot (fees + guarantee): cups freeze at start; Arena freezes when the arena ends.'
),
updated_at = NOW()
WHERE key = 'tournament_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'prize_place_percents_blurb',
  'Must sum to 100. Applied to the frozen pot (fees + guarantee): cups freeze at start; Arena freezes when the arena ends.'
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';
