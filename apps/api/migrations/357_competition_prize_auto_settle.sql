-- Background competition prize settle worker settings (client_enums; idempotent).

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'competition_prize_settle_interval_minutes', COALESCE(
    NULLIF(trim(value->>'competition_prize_settle_interval_minutes'), ''),
    '5'
  ),
  'competition_prize_auto_settle', COALESCE(
    NULLIF(trim(value->>'competition_prize_auto_settle'), ''),
    'true'
  )
),
updated_at = NOW()
WHERE key = 'client_enums';
