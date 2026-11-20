-- Default role/status values for create, enroll, and serve flows (no Go/client string hardcodes).
-- Also ensure campaign_statuses includes draft so default_campaign_status is valid.
UPDATE platform_settings
SET value = (
  value
  || '{
    "default_role": "player",
    "default_tournament_status": "draft",
    "default_campaign_status": "draft",
    "enrollable_tournament_status": "open",
    "servable_campaign_status": "active"
  }'::jsonb
)
|| jsonb_build_object(
  'campaign_statuses', '["draft", "active", "paused", "archived"]'::jsonb
),
updated_at = NOW()
WHERE key = 'client_enums';
