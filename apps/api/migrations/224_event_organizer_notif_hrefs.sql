-- Organizer lifecycle notifs → events list (parity with ads /ads/campaigns).
UPDATE notification_kinds
SET href_path = '/events/events',
    href_query_key = ''
WHERE code IN ('player.event_created', 'player.event_player_joined');

-- Cancelled: players (and organizer) open join with code to see cancelled state.
UPDATE notification_kinds
SET href_path = '/events/join',
    href_query_key = 'code'
WHERE code = 'player.event_cancelled';
