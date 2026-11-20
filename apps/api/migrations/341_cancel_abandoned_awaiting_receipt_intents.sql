-- Cancel abandoned manual top-up holds left after approved proofs / extra checkouts.
-- Also add display labels for cancelled intents (admin + player wallet).
--
-- Prefer linking each approved proof to the nearest prior awaiting/paid hold, then
-- mark that hold paid and cancel leftover siblings so admin transactions stop showing
-- stale awaiting_receipt rows.

WITH preferred AS (
  SELECT
    r.id AS receipt_id,
    i.id AS intent_id,
    ROW_NUMBER() OVER (
      PARTITION BY r.id
      ORDER BY
        CASE WHEN i.created_at <= r.created_at THEN 0 ELSE 1 END,
        ABS(EXTRACT(EPOCH FROM (i.created_at - r.created_at))) ASC,
        i.created_at DESC
    ) AS rn
  FROM payment_receipts r
  INNER JOIN payment_intents i
    ON i.user_id = r.user_id
   AND i.amount = r.amount
   AND UPPER(TRIM(i.currency)) = UPPER(TRIM(r.currency))
   AND i.provider = 'manual'
   AND i.purpose = 'wallet_topup'
   AND i.status IN ('awaiting_receipt', 'paid', 'cancelled')
  WHERE r.status = 'approved'
)
UPDATE payment_receipts r
SET intent_id = p.intent_id
FROM preferred p
WHERE r.id = p.receipt_id
  AND p.rn = 1
  AND (r.intent_id IS DISTINCT FROM p.intent_id);

UPDATE payment_intents i
SET status = 'paid', updated_at = NOW()
FROM payment_receipts r
WHERE r.intent_id = i.id
  AND r.status = 'approved'
  AND i.status IN ('awaiting_receipt', 'cancelled');

UPDATE payment_intents i
SET status = 'cancelled', updated_at = NOW()
WHERE i.status = 'awaiting_receipt'
  AND i.provider = 'manual'
  AND i.purpose = 'wallet_topup'
  AND NOT EXISTS (
    SELECT 1 FROM payment_receipts r
    WHERE r.intent_id = i.id AND r.status IN ('pending', 'approved')
  )
  AND EXISTS (
    SELECT 1 FROM payment_receipts r
    WHERE r.user_id = i.user_id
      AND r.amount = i.amount
      AND UPPER(TRIM(r.currency)) = UPPER(TRIM(i.currency))
      AND r.status = 'approved'
      AND r.created_at >= i.created_at - INTERVAL '14 days'
  );

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'list_status_cancelled', COALESCE(NULLIF(trim(value->>'list_status_cancelled'), ''), 'Cancelled')
),
  updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'txn_status_cancelled', COALESCE(NULLIF(trim(value->'payments'->>'txn_status_cancelled'), ''), 'Cancelled')
  ),
  true
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';
