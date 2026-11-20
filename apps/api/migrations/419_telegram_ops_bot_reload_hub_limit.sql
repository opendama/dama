-- Hub list limit + admin console chrome for telegram-ops console errors (no English invents).

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'hub_list_limit', COALESCE((value->>'hub_list_limit')::int, 100)
),
    updated_at = NOW()
WHERE key = 'telegram_ops_bot';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'telegram_ops_settings_unavailable',
    COALESCE(NULLIF(trim(value->'payments'->>'telegram_ops_settings_unavailable'), ''), 'Settings unavailable'),
    'telegram_ops_config_unavailable',
    COALESCE(NULLIF(trim(value->'payments'->>'telegram_ops_config_unavailable'), ''), 'Telegram ops bot config unavailable'),
    'telegram_ops_save_invalid',
    COALESCE(NULLIF(trim(value->'payments'->>'telegram_ops_save_invalid'), ''), 'Telegram ops save rejected')
  )
),
    updated_at = NOW()
WHERE key = 'admin_console_chrome';
