-- Organizer event notifs that pass event UUID as href_entity_id deep-link to list?id=.
UPDATE notification_kinds
SET href_path = '/events/events',
    href_query_key = 'id'
WHERE code IN (
  'player.event_created',
  'player.event_player_joined',
  'player.event_started_org',
  'player.event_auto_closed'
);

-- Admin campaign lifecycle notifs carry campaign id for console deep-link.
UPDATE notification_kinds
SET href_query_key = 'id'
WHERE code IN (
  'admin.campaign_closed',
  'admin.campaign_reopened',
  'admin.campaign_auto_closed'
);

-- Admin event lifecycle notifs carry event id.
UPDATE notification_kinds
SET href_query_key = 'id'
WHERE code IN (
  'admin.event_closed',
  'admin.event_reopened',
  'admin.event_auto_closed'
);
