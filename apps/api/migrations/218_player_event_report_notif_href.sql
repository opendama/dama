-- Align player.event_report_received deep link with events join shell (mig 194 family).
UPDATE notification_kinds
SET href_path = '/events/join',
    href_query_key = 'code'
WHERE code = 'player.event_report_received'
  AND (
    href_path IS DISTINCT FROM '/events/join'
    OR href_query_key IS DISTINCT FROM 'code'
  );
