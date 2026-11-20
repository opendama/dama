-- Mig 391: Competition points awarded → Tournaments cup deep link (parity with
-- player.tournament_* kinds). Emitters already pass tournament/event id as href entity.
-- Old href_path=/ + query view produced /?view=<uuid> (broken; not a cup surface).
-- Idempotent. Official + Community both open under /?view=tournaments&id= (All tab).

UPDATE notification_kinds
SET href_path = '/?view=tournaments',
    href_query_key = 'id'
WHERE code = 'player.competition_points_awarded'
  AND (
    href_path IS DISTINCT FROM '/?view=tournaments'
    OR href_query_key IS DISTINCT FROM 'id'
  );
