-- Notify all active players when a tournament becomes enrollable (open).
-- Status changes for entrants remain player.tournament_status (REST + GraphQL).

INSERT INTO notification_kinds (code, audience, title_template, body_template, href_path, href_query_key)
VALUES
  (
    'player.tournament_created',
    'player',
    'New tournament',
    'Tournament "%s" is now open for entry.',
    '/?view=tournaments',
    'id'
  )
ON CONFLICT (code) DO UPDATE
SET title_template = EXCLUDED.title_template,
    body_template = EXCLUDED.body_template,
    href_path = EXCLUDED.href_path,
    href_query_key = EXCLUDED.href_query_key;

-- Deep-link status updates to the same tournaments surface with tournament id.
UPDATE notification_kinds
SET href_path = '/?view=tournaments',
    href_query_key = 'id'
WHERE code = 'player.tournament_status';
