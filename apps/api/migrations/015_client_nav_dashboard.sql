-- Player dashboard shortcut cards (title/body/cta/href from DB).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard}',
  '[
    {"title": "Play", "href": "/play", "route_key": "play", "body": "Open the board for practice or live queues.", "body_when_vs_ai": "Practice against the computer or open live queues.", "cta": "Open board"},
    {"title": "Matchmaking", "href": "/matchmaking", "route_key": "matchmaking", "body": "Join 1v1 queues with live avatars and presence.", "cta": "Find match"},
    {"title": "Profile", "href": "/profile", "route_key": "profile", "body": "Update your avatar and view career stats.", "cta": "View profile"},
    {"title": "Wallet", "href": "/wallet", "route_key": "wallet", "body": "Top up, view balance, and pay tournament entry fees.", "cta": "Open wallet"},
    {"title": "Tournaments", "href": "/tournaments", "route_key": "tournaments", "body": "Enroll in paid or free events.", "cta": "Browse events"},
    {"title": "Ad publisher", "href": "/ads/dashboard", "route_key": "ads", "body": "Campaigns, analytics, and spend caps for creators.", "cta": "Open ads"}
  ]'::jsonb
),
updated_at = NOW()
WHERE key = 'client_nav';
