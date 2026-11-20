-- Admin hosted-events Ops list chrome (lifecycle deep-links land on /console/events).

UPDATE platform_settings
SET value = value || '{
  "hosted_events_title": "Hosted cups",
  "hosted_events_blurb": "All organizer cups on the platform. Use reports to deactivate abusive public cups.",
  "hosted_events_empty": "No hosted cups yet.",
  "hosted_col_title": "Title",
  "hosted_col_status": "Status",
  "hosted_col_organizer": "Organizer",
  "hosted_col_code": "Join code",
  "hosted_col_players": "Players",
  "hosted_col_visibility": "Visibility",
  "hosted_col_created": "Created"
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_admin_chrome';
