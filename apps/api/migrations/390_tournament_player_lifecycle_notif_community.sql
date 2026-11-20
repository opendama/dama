-- Mig 390: Player lifecycle notifs (kick / cancel / reopen) → Community tournaments.
-- Organizer money/manage kinds keep /events/* host portal.
-- Idempotent.

UPDATE notification_kinds
SET href_path = '/?view=tournaments&source=community',
    href_query_key = 'code'
WHERE code IN (
  'player.event_cancelled',
  'player.event_entry_kicked',
  'player.event_reopened'
)
AND (
  href_path IS DISTINCT FROM '/?view=tournaments&source=community'
  OR href_query_key IS DISTINCT FROM 'code'
);
