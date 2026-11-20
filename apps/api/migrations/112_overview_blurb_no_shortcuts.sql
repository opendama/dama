-- Overview blurb: metrics-focused (shortcut cards removed from the page).
UPDATE platform_settings
SET value = value || '{
  "dashboard_page_blurb": "Your rating, wallet balance, career stats, and recent matches."
}'::jsonb,
updated_at = NOW()
WHERE key = 'client_nav';
