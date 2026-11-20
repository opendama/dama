-- Include Overview in console_nav so header + dashboard share one DB source.
UPDATE platform_settings
SET value = '{
  "modules": [
    {"title": "Overview", "href": "/dashboard", "body": "Control console home and module index."},
    {"title": "Feature flags", "href": "/feature-flags", "body": "Toggle VS-AI practice, OTP gate, and Ethiopian payment mode."},
    {"title": "Progression", "href": "/progression", "body": "XP ladder badges and match clock seconds from platform_settings."},
    {"title": "Tournaments", "href": "/tournaments", "body": "Create paid or free (is_free) tournaments with entry fee override."},
    {"title": "Payments", "href": "/payments", "body": "Local vs international checkout, manual bank transfer, and receipt review."},
    {"title": "Media pool", "href": "/media-pool", "body": "Multi-channel upload pool with daily quota failover for ad creatives."},
    {"title": "Avatars", "href": "/avatars", "body": "Moderation queue for player avatar thumb and full assets."},
    {"title": "Banks", "href": "/banks", "body": "Manual transfer bank and mobile-money accounts for checkout."},
    {"title": "Users & RBAC", "href": "/users", "body": "Players, publishers, and console roles with audit trail."},
    {"title": "Telemetry", "href": "/telemetry", "body": "Fingerprints, GeoIP records, and immutable audit vault."}
  ]
}'::jsonb,
updated_at = NOW()
WHERE key = 'console_nav';
