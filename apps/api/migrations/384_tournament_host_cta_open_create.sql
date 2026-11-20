-- Mig 384: Host a tournament CTA opens create flow (not bare list).
-- Soft-force host_tournament_href. Idempotent. Tables unmerged.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{host_tournament_href}',
  to_jsonb('/events/events?create=1'::text)
),
updated_at = NOW()
WHERE key = 'tournaments_player_chrome'
  AND COALESCE(value->>'host_tournament_href', '') IN (
    '',
    '/events/events',
    '/events/list'
  );
