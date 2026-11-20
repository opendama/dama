-- Fix admin avatar deep-link (console uses /avatars, not /moderation).
-- Invite accepted should open the ready game (gameId query), matching match_found.
UPDATE notification_kinds
SET href_path = '/avatars', href_query_key = 'user'
WHERE code = 'admin.avatar_pending';

UPDATE notification_kinds
SET href_path = '/', href_query_key = 'gameId'
WHERE code = 'player.invite_accepted';
