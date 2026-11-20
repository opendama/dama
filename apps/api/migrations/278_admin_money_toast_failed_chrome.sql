-- Admin money mutation fail toasts (banks / receipts / currency): DB chrome only.

UPDATE platform_settings
SET value = jsonb_set(
  jsonb_set(
    value,
    '{banks}',
    COALESCE(value->'banks', '{}'::jsonb) || jsonb_build_object(
      'toast_failed',
      COALESCE(
        NULLIF(trim(value->'banks'->>'toast_failed'), ''),
        'Bank update failed'
      )
    )
  ),
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'toast_receipt_failed',
    COALESCE(
      NULLIF(trim(value->'payments'->>'toast_receipt_failed'), ''),
      'Receipt review failed'
    ),
    'toast_currency_failed',
    COALESCE(
      NULLIF(trim(value->'payments'->>'toast_currency_failed'), ''),
      'Currency save failed'
    )
  )
),
    updated_at = NOW()
WHERE key = 'admin_console_chrome';
