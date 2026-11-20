-- Friend-request notifications: deep-link to Players rail (requests/friends),
-- cancel kind, and fix legacy /?view=match targets.

UPDATE notification_kinds
SET href_path = '/?rail=players&sub=requests',
    href_query_key = ''
WHERE code IN (
  'player.friend_request',
  'player.friend_request_denied'
);

UPDATE notification_kinds
SET href_path = '/?rail=players&sub=friends',
    href_query_key = ''
WHERE code IN (
  'player.friend_request_accepted',
  'player.friend_added',
  'player.friend_removed'
);

INSERT INTO notification_kinds (code, audience, title_template, body_template, href_path, href_query_key)
VALUES
  (
    'player.friend_request_cancelled',
    'player',
    'Friend request cancelled',
    '%s cancelled their friend request.',
    '/?rail=players&sub=requests',
    ''
  )
ON CONFLICT (code) DO UPDATE
SET href_path = EXCLUDED.href_path,
    title_template = EXCLUDED.title_template,
    body_template = EXCLUDED.body_template;
