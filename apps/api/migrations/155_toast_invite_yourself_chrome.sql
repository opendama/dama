-- Self-challenge copy: fail-closed DB chrome for invite Create errors.
UPDATE platform_settings
SET value = value || '{
  "toast_invite_yourself": "You cannot challenge yourself"
}'::jsonb,
    updated_at = NOW()
WHERE key IN ('play_rail_chrome', 'matchmaking_chrome');
