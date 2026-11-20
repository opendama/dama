-- Player dashboard page chrome + brand name on client_nav (fail closed).

UPDATE platform_settings
SET value = value || '{
  "brand_name": "dama",
  "dashboard_page_title": "Player portal",
  "dashboard_page_blurb": "Your live profile, practice options, and shortcuts.",
  "profile_load_failed": "Could not load profile. Try again.",
  "dashboard_unavailable": "Dashboard shortcuts unavailable from database."
}'::jsonb,
updated_at = NOW()
WHERE key = 'client_nav';
