-- Admin SPA routes live at /ads and /events (route group does not prefix /console).
-- Mig 200 incorrectly set campaign closed/reopened to /console/ads.
UPDATE notification_kinds
SET href_path = '/ads',
    href_query_key = COALESCE(href_query_key, '')
WHERE code IN (
  'admin.campaign_closed',
  'admin.campaign_reopened',
  'admin.campaign_auto_closed'
);

UPDATE notification_kinds
SET href_path = '/events'
WHERE code IN (
  'admin.event_closed',
  'admin.event_reopened',
  'admin.event_auto_closed'
);

UPDATE notification_kinds
SET href_path = '/events',
    href_query_key = 'report'
WHERE code = 'admin.event_report_pending';
