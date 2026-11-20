-- Hosted Events organizer chrome: dashboard / analytics KPI labels (merge; fail-closed clients).

-- Hosting KPI/analytics chrome: Tournament wording. migrateonly re-applies this
-- || seed before later soft-fills - keep mid-migrate Event-clean (softHostingPatchTitleLocked
-- / softHostingUploadLogoFailed still fail-open at paint).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "kpi_active_label": "Active",
  "kpi_upcoming_label": "Upcoming",
  "kpi_players_week_label": "Players joined this week",
  "kpi_host_fee_revenue_label": "Host fees paid",
  "kpi_entry_fee_revenue_label": "Entry fees collected",
  "kpi_last_share_label": "Latest share link",
  "analytics_title": "Hosting analytics",
  "analytics_blurb": "Joins, completions, and fees for cups you host.",
  "analytics_players_label": "Players joined",
  "analytics_completion_label": "Completed",
  "analytics_started_label": "Started",
  "analytics_host_fee_label": "Host fee",
  "analytics_entry_fees_label": "Entry fees",
  "analytics_empty": "No hosted tournaments yet.",
  "analytics_metrics_note": "Metrics: joins, completions, and money from entry rows. Share clicks are not tracked.",
  "patch_title_locked": "Title can only change while the tournament is open",
  "upload_logo_failed": "Could not upload tournament logo",
  "upload_sponsor_failed": "Could not upload sponsor logo"
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_organizer_chrome';
