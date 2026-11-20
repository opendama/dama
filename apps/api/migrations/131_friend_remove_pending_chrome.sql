-- Pending label for remove-friend CTA (Trim Button isLoading + pendingLabel).

UPDATE platform_settings
SET value = value || '{
  "removing_friend": "Removing..."
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';
