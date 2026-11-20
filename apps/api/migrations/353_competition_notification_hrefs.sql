-- Split tournament vs event competition notification deep links (cup lobby parity).
-- Idempotent.

INSERT INTO notification_kinds (code, audience, title_template, body_template, href_path, href_query_key) VALUES
  ('player.tournament_check_in_open', 'player', 'Check-in open', 'Check in for "%s" before it starts.', '/?view=tournaments', 'id'),
  ('player.tournament_dispute_open', 'player', 'Results in review', '"%s" is in the dispute window before prizes pay out.', '/?view=tournaments', 'id')
ON CONFLICT (code) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  body_template = EXCLUDED.body_template,
  href_path = EXCLUDED.href_path,
  href_query_key = EXCLUDED.href_query_key;

UPDATE notification_kinds
SET href_path = '/?view=events',
    href_query_key = 'id'
WHERE code IN ('player.competition_check_in_open', 'player.competition_dispute_open');

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'competition_check_in_window_hours', COALESCE(NULLIF(trim(value->>'competition_check_in_window_hours'), ''), '')
),
updated_at = NOW()
WHERE key = 'client_enums';
