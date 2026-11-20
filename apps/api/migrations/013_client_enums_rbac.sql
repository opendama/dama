-- Expand client_enums with console/publisher role sets and domestic payment mode options.
-- MERGE ONLY (never replace the whole JSON). A full replace wiped later keys on every migrateonly.

UPDATE platform_settings
SET value = value || jsonb_strip_nulls(jsonb_build_object(
  'roles', COALESCE(value->'roles', '["player", "ad_publisher", "admin", "superadmin"]'::jsonb),
  'console_roles', COALESCE(value->'console_roles', '["admin", "superadmin"]'::jsonb),
  'publisher_roles', COALESCE(value->'publisher_roles', '["ad_publisher", "advertiser"]'::jsonb),
  'tournament_statuses', COALESCE(value->'tournament_statuses', '["draft", "open", "archived"]'::jsonb),
  'campaign_statuses', COALESCE(value->'campaign_statuses', '["active", "paused", "archived"]'::jsonb),
  'ethiopia_payment_modes', COALESCE(
    value->'ethiopia_payment_modes',
    '[
      {"mode": "local_checkout", "label": "Local gateway", "enabled": true},
      {"mode": "manual_transfer", "label": "Manual transfer", "enabled": false}
    ]'::jsonb
  )
)),
    updated_at = NOW()
WHERE key = 'client_enums';
