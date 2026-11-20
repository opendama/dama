-- Notification API error chrome (stop invent unauthorized / DATABASE_UNAVAILABLE / English codes).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "err_unauthorized": "Sign in required",
  "unavailable": "Notifications unavailable",
  "count_failed": "Could not load unread count.",
  "list_failed": "Could not load notifications.",
  "mark_failed": "Could not update notification."
}'::jsonb,
    updated_at = NOW()
WHERE key = 'notification_chrome';
