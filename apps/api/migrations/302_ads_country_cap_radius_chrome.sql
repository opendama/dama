-- Clearer publisher create labels: country (name + code), daily spend example.
-- Note: ph_radius_km removed in migration 303 (worldwide country matching only).

UPDATE platform_settings
SET value = value || '{
  "ph_country": "Country",
  "ph_daily_spend_cap": "Max spend per day (e.g. 500)"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
