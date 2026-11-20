-- Campaign lifecycle notifs deep-link to the campaigns list with campaign id.
UPDATE notification_kinds
SET href_path = '/ads/campaigns',
    href_query_key = 'id'
WHERE code IN (
  'player.campaign_closed',
  'player.campaign_reopened',
  'player.campaign_auto_closed',
  'player.campaign_status'
);

-- Report queue status labels (admin UI; fail closed when missing).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "hosted_event_report_status_labels": {
    "open": "Open",
    "dismissed": "Dismissed",
    "deactivated": "Deactivated"
  }
}'::jsonb,
    updated_at = NOW()
WHERE key = 'client_enums';
