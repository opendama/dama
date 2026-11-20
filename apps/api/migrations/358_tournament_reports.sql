-- Tournament player reports (parity with hosted_event_reports). Idempotent.

CREATE TABLE IF NOT EXISTS tournament_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tournament_reports_reason_nonempty CHECK (length(trim(reason_code)) > 0),
  CONSTRAINT tournament_reports_status_ok CHECK (status IN ('open', 'dismissed', 'deactivated'))
);

CREATE INDEX IF NOT EXISTS idx_tournament_reports_status
  ON tournament_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tournament_reports_tournament
  ON tournament_reports (tournament_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_reports_open_unique
  ON tournament_reports (tournament_id, reporter_id)
  WHERE status = 'open';

INSERT INTO notification_kinds (code, audience, title_template, body_template, href_path, href_query_key) VALUES
  ('player.tournament_report_received', 'player', 'Report received', 'We received your report for "%s".', '/?view=tournaments', 'id'),
  ('admin.tournament_report_pending', 'admin', 'Tournament report', '%s reported cup "%s" (%s).', '/tournaments', 'report')
ON CONFLICT (code) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  body_template = EXCLUDED.body_template,
  href_path = EXCLUDED.href_path,
  href_query_key = EXCLUDED.href_query_key;

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "report_action": "Report tournament",
  "report_title": "Report this tournament",
  "report_reason_label": "Reason",
  "report_note_label": "Details",
  "report_submit_action": "Submit report",
  "report_toast_sent": "Report submitted",
  "report_toast_failed": "Could not submit report",
  "cancel_action": "Cancel",
  "err_report_already_open": "You already have an open report",
  "err_report_submit_failed": "Unable to submit report",
  "err_report_not_allowed": "Reports are not open for this cup",
  "err_not_enrolled": "You must be enrolled to report",
  "err_invalid_reason_code": "Invalid reason",
  "err_invalid_json": "Invalid request body"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'tournaments_player_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "reports_title": "Tournament reports",
  "reports_blurb": "Review player reports. Dismiss or resolve before prizes settle.",
  "reports_empty": "No open reports.",
  "report_reason_col": "Reason",
  "report_tournament_col": "Tournament",
  "report_reporter_col": "Reporter",
  "report_status_col": "Status",
  "dismiss_action": "Dismiss",
  "resolve_action": "Resolve",
  "toast_dismissed": "Report dismissed",
  "toast_resolved": "Report resolved",
  "err_report_not_found": "Report not found",
  "err_reports_failed": "Unable to load reports",
  "err_dismiss_failed": "Unable to dismiss report",
  "err_resolve_failed": "Unable to resolve report"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'tournament_chrome';
