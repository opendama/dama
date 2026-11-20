-- 423: Inject Telegram ops into the live console_nav section that already hosts
-- payment items (id may be "sales", not "payments"). Mig 415 only matched
-- sections.id = 'payments', so pay-telegram-ops never appeared in sidebar when
-- AdminConsoleShell prefers sections over modules.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{sections}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(sec->'items', '[]'::jsonb)) AS it
          WHERE it->>'id' IN ('pay-receipts', 'pay-payouts', 'pay-transactions', 'pay-currency', 'pay-geo', 'pay-kyc')
             OR it->>'href' IN (
               '/payments/receipts',
               '/payments/payouts',
               '/payments/transactions',
               '/payments/currency',
               '/payments/geo',
               '/payments/kyc'
             )
        ) THEN
          jsonb_set(
            sec,
            '{items}',
            (
              SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
              FROM (
                SELECT item
                FROM jsonb_array_elements(COALESCE(sec->'items', '[]'::jsonb)) AS item
                WHERE item->>'id' IS DISTINCT FROM 'pay-telegram-ops'
                  AND item->>'href' IS DISTINCT FROM '/payments/telegram-ops'
                UNION ALL
                SELECT jsonb_build_object(
                  'id', 'pay-telegram-ops',
                  'label', 'Telegram ops',
                  'href', '/payments/telegram-ops'
                )
              ) AS items(item)
            )
          )
        ELSE sec
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'sections', '[]'::jsonb)) AS sec
  )
),
    updated_at = NOW()
WHERE key = 'console_nav';

-- Keep modules entry present (used when sections empty).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{modules}',
  (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM (
      SELECT elem
      FROM jsonb_array_elements(COALESCE(value->'modules', '[]'::jsonb)) AS elem
      WHERE elem->>'href' IS DISTINCT FROM '/payments/telegram-ops'
      UNION ALL
      SELECT jsonb_build_object(
        'title', 'Telegram ops',
        'href', '/payments/telegram-ops',
        'body', 'Shared Telegram bot bridge for manual receipt and payout review.'
      )
    ) AS t(elem)
  )
),
    updated_at = NOW()
WHERE key = 'console_nav';
