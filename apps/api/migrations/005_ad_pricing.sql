-- Ad impression unit cost for daily spend caps and publisher CPC (no client hardcodes).
INSERT INTO platform_settings (key, value) VALUES
  (
    'ad_pricing',
    '{
      "impression_unit_cost": 0.01
    }'::jsonb
  )
ON CONFLICT (key) DO NOTHING;
