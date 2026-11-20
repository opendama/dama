-- 424: Fail-closed chrome when Telegram admin recipient set is empty / all DM sends fail.
-- Bot must not report status=ok with notified=0 for Dama money alerts.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'err_no_telegram_admins',
  COALESCE(
    NULLIF(trim(value->>'err_no_telegram_admins'), ''),
    'No Telegram admins configured to receive Dama ops alerts.'
  )
),
    updated_at = NOW()
WHERE key = 'telegram_ops_bot';
