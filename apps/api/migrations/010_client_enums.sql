-- Assignable roles and lifecycle statuses for clients (no client-side enum hardcodes).
INSERT INTO platform_settings (key, value) VALUES
  (
    'client_enums',
    '{
      "roles": ["player", "ad_publisher", "admin", "superadmin"],
      "console_roles": ["admin", "superadmin"],
      "publisher_roles": ["ad_publisher", "advertiser"],
      "tournament_statuses": ["draft", "open", "archived"],
      "campaign_statuses": ["active", "paused", "archived"],
      "ethiopia_payment_modes": [
        {"mode": "local_checkout", "label": "Local gateway", "enabled": true},
        {"mode": "manual_transfer", "label": "Manual transfer", "enabled": false}
      ]
    }'::jsonb
  )
ON CONFLICT (key) DO NOTHING;
