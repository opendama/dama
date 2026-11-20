-- Cancelled DM request label (thread footer / list edge cases). Cancelled rows
-- are filtered from default DM lists; message rows are deleted on cancel.
UPDATE platform_settings
SET value = value || '{
  "dm_request_cancelled_label": "Cancelled"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';
