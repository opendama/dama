-- Events: visibility (private|public), always auto-approve, public flag,
-- reports/deactivate, notification kinds, dashboard portal chrome.
-- Idempotent. No client hardcoding.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
ALTER TABLE hosted_events
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hosted_events_visibility_ok'
  ) THEN
    ALTER TABLE hosted_events
      ADD CONSTRAINT hosted_events_visibility_ok
      CHECK (visibility IN ('private', 'public'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hosted_events_visibility_status
  ON hosted_events (visibility, status, created_at DESC)
  WHERE visibility = 'public';

-- Force auto-approve for all existing and future rows (product decision).
UPDATE hosted_events SET auto_approve = TRUE WHERE auto_approve IS DISTINCT FROM TRUE;
ALTER TABLE hosted_events ALTER COLUMN auto_approve SET DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS hosted_event_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES hosted_events(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hosted_event_reports_reason_nonempty CHECK (length(trim(reason_code)) > 0),
  CONSTRAINT hosted_event_reports_status_ok CHECK (status IN ('open', 'dismissed', 'deactivated'))
);

CREATE INDEX IF NOT EXISTS idx_hosted_event_reports_status
  ON hosted_event_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hosted_event_reports_event
  ON hosted_event_reports (event_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hosted_event_reports_open_unique
  ON hosted_event_reports (event_id, reporter_id)
  WHERE status = 'open';

-- ---------------------------------------------------------------------------
-- Feature flags
-- ---------------------------------------------------------------------------
INSERT INTO feature_flags (key, enabled, payload) VALUES
  ('public_events_enabled', TRUE, '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{toggles}',
  COALESCE(value->'toggles', '[]'::jsonb) || CASE
    WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'toggles', '[]'::jsonb)) t
      WHERE t->>'key' = 'public_events_enabled'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'key', 'public_events_enabled',
      'title', 'Public events',
      'description', 'Allow organizers to create public cups listed in the app.',
      'kind', 'boolean'
    ))
  END
),
updated_at = NOW()
WHERE key = 'feature_flag_catalog';

-- ---------------------------------------------------------------------------
-- Catalog: force auto-approve; public fee multiplier (1 = same as private)
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || '{
  "auto_approve_default": true,
  "force_auto_approve": true,
  "public_host_fee_multiplier": 1,
  "default_visibility": "private",
  "report_reason_codes": ["spam", "abuse", "offensive_name", "other"]
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_catalog';

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || '{
  "hosted_event_visibilities": ["private", "public"],
  "hosted_event_default_visibility": "private",
  "hosted_event_report_statuses": ["open", "dismissed", "deactivated"]
}'::jsonb,
updated_at = NOW()
WHERE key = 'client_enums';

-- ---------------------------------------------------------------------------
-- Notification kinds (DB templates + deep links)
-- ---------------------------------------------------------------------------
-- Player lifecycle: Tournament wording + Community discovery (Hosting manage stays /events/*).
-- ON CONFLICT DO UPDATE must stay Tournament-safe - migrateonly re-applies before 379 soft-fills.
INSERT INTO notification_kinds (code, audience, title_template, body_template, href_path, href_query_key) VALUES
  ('player.event_created', 'player', 'Tournament created', 'Your cup "%s" is open. Share the join code.', '/events/events', ''),
  ('player.event_joined', 'player', 'Joined tournament', 'You joined "%s". Wait for the bracket to start.', '/?view=tournaments&source=community', 'code'),
  ('player.event_player_joined', 'player', 'New player', '%s joined your cup "%s".', '/events/events', ''),
  ('player.event_started', 'player', 'Tournament started', 'Cup "%s" has started. Check the bracket.', '/?view=tournaments&source=community', 'code'),
  ('player.event_match_ready', 'player', 'Match ready', 'Your match in "%s" is ready to play.', '/', 'gameId'),
  ('player.event_finished', 'player', 'Tournament finished', 'Cup "%s" finished. Results are ready.', '/?view=tournaments&source=community', 'code'),
  ('player.event_cancelled', 'player', 'Tournament cancelled', 'Cup "%s" was cancelled.', '/?view=tournaments&source=community', 'code'),
  ('player.event_report_received', 'player', 'Report received', 'We received your report for "%s".', '/?view=tournaments&source=community', 'id'),
  ('admin.event_report_pending', 'admin', 'Event report', '%s reported cup "%s" (%s).', '/events', 'report')
ON CONFLICT (code) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  body_template = EXCLUDED.body_template,
  href_path = EXCLUDED.href_path,
  href_query_key = EXCLUDED.href_query_key;

-- ---------------------------------------------------------------------------
-- RBAC
-- ---------------------------------------------------------------------------
INSERT INTO rbac_permissions (key, title, description) VALUES
  ('events.manage_reports', 'Event reports', 'Review and deactivate reported hosted events')
ON CONFLICT (key) DO NOTHING;

INSERT INTO rbac_role_permissions (role, permission_key)
SELECT 'superadmin', 'events.manage_reports'
ON CONFLICT DO NOTHING;

INSERT INTO rbac_role_permissions (role, permission_key)
SELECT 'admin', 'events.manage_reports'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Organizer chrome: visibility, report, portal links (fail-closed clients)
-- ---------------------------------------------------------------------------
-- Player/Hosting chrome: Tournament wording (not Event sport). migrateonly re-applies
-- this file before 377+/402+/403 soft-fills - keep seeds Tournament-safe so mid-migrate
-- never flashes "Public events" / "Create event" to players. Admin ops chrome below may keep Event.
UPDATE platform_settings
SET value = value || '{
  "visibility_label": "Visibility",
  "visibility_private_label": "Private",
  "visibility_public_label": "Public",
  "visibility_private_blurb": "Join only with code, link, or QR.",
  "visibility_public_blurb": "Listed in Community tournaments when public cups are enabled.",
  "public_disabled": "Community tournaments are temporarily unavailable",
  "make_public_action": "Make public",
  "make_private_action": "Make private",
  "visibility_change_blocked": "Visibility cannot be changed now",
  "report_action": "Report tournament",
  "report_title": "Report this tournament",
  "report_reason_label": "Reason",
  "report_note_label": "Details",
  "report_submit_action": "Submit report",
  "report_toast_sent": "Report submitted",
  "report_toast_failed": "Could not submit report",
  "portal_wallet_label": "Wallet",
  "portal_receipts_label": "Receipts",
  "portal_transactions_label": "Transactions",
  "portal_overview_label": "Overview",
  "portal_create_label": "Host a tournament",
  "portal_public_list_label": "Community tournaments",
  "public_list_title": "Community tournaments",
  "public_list_blurb": "Open community tournaments anyone can join.",
  "public_list_empty": "No community tournaments open right now.",
  "join_open_action": "Join",
  "force_auto_approve_note": "Joiners are approved automatically."
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

UPDATE platform_settings
SET value = value || '{
  "report_action": "Report tournament",
  "report_title": "Report this tournament",
  "report_reason_label": "Reason",
  "report_note_label": "Details",
  "report_submit_action": "Submit report",
  "report_toast_sent": "Report submitted",
  "report_toast_failed": "Could not submit report",
  "public_list_title": "Community tournaments",
  "public_list_blurb": "Open community tournaments anyone can join.",
  "public_list_empty": "No community tournaments open right now.",
  "visibility_private_blurb": "Private cup. Use the join code.",
  "visibility_public_blurb": "Public cup."
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_player_chrome';

UPDATE platform_settings
SET value = value || '{
  "public_events_flag_label": "Public events enabled",
  "public_events_flag_blurb": "When off, organizers can only create private cups.",
  "reports_title": "Event reports",
  "reports_blurb": "Review player reports. Dismiss or deactivate the cup.",
  "reports_empty": "No open reports.",
  "report_reason_col": "Reason",
  "report_event_col": "Event",
  "report_reporter_col": "Reporter",
  "report_status_col": "Status",
  "dismiss_action": "Dismiss",
  "deactivate_action": "Deactivate event",
  "toast_dismissed": "Report dismissed",
  "toast_deactivated": "Event deactivated",
  "reports_permission_key": "events.manage_reports"
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_admin_chrome';

-- Ads publisher dashboard portal chrome (wallet / receipts / transactions)
UPDATE platform_settings
SET value = value || '{
  "publisher_portal_wallet_label": "Wallet",
  "publisher_portal_receipts_label": "Receipts",
  "publisher_portal_transactions_label": "Transactions",
  "publisher_portal_overview_label": "Overview",
  "publisher_portal_create_label": "Create campaign",
  "publisher_portal_section_title": "Account"
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
