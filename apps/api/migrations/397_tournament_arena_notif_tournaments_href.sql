-- Mig 397: Arena player notifs used href_path=/ + href_query_key=view with cup id as
-- entity → /?view=<uuid> (broken; not a cup surface). Same bug mig 391 fixed for
-- player.competition_points_awarded. Point arena started/finished/matched at
-- /?view=tournaments&id= (All tab; Official + Community focus classify). Idempotent.

UPDATE notification_kinds
SET href_path = '/?view=tournaments',
    href_query_key = 'id'
WHERE code IN (
  'player.arena_started',
  'player.arena_finished',
  'player.arena_matched'
)
  AND (
    href_path IS DISTINCT FROM '/?view=tournaments'
    OR href_query_key IS DISTINCT FROM 'id'
  );
