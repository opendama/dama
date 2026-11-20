-- Manual top-up: link receipts → payment_intents, settle intent to paid on approve,
-- backfill stuck awaiting_receipt rows, professional payment-proof notification titles
-- (Smart Menu parity: "Payment proof"), and display labels for awaiting_receipt / paid.

ALTER TABLE payment_receipts
  ADD COLUMN IF NOT EXISTS intent_id UUID REFERENCES payment_intents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_receipts_intent_id
  ON payment_receipts(intent_id)
  WHERE intent_id IS NOT NULL;

-- Best-effort link: match oldest awaiting_receipt intent per user/amount/currency
-- that is not already claimed by another receipt.
WITH candidates AS (
  SELECT
    r.id AS receipt_id,
    i.id AS intent_id,
    ROW_NUMBER() OVER (
      PARTITION BY r.id
      ORDER BY i.created_at ASC, i.id ASC
    ) AS rn
  FROM payment_receipts r
  INNER JOIN payment_intents i
    ON i.user_id = r.user_id
   AND UPPER(TRIM(i.currency)) = UPPER(TRIM(r.currency))
   AND i.amount = r.amount
   AND i.provider = 'manual'
   AND i.status IN ('awaiting_receipt', 'paid')
   AND i.purpose = 'wallet_topup'
  WHERE r.intent_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM payment_receipts x WHERE x.intent_id = i.id AND x.id <> r.id
    )
)
UPDATE payment_receipts r
SET intent_id = c.intent_id
FROM candidates c
WHERE r.id = c.receipt_id
  AND c.rn = 1
  AND r.intent_id IS NULL;

-- Approved proofs must show paid on transactions (gateway parity).
UPDATE payment_intents i
SET status = 'paid', updated_at = NOW()
FROM payment_receipts r
WHERE r.intent_id = i.id
  AND r.status = 'approved'
  AND i.status = 'awaiting_receipt';

-- Orphan approved receipts: settle one matching awaiting intent (oldest first).
WITH matched AS (
  SELECT
    r.id AS receipt_id,
    i.id AS intent_id,
    ROW_NUMBER() OVER (
      PARTITION BY r.id
      ORDER BY i.created_at ASC, i.id ASC
    ) AS rn
  FROM payment_receipts r
  INNER JOIN payment_intents i
    ON i.user_id = r.user_id
   AND UPPER(TRIM(i.currency)) = UPPER(TRIM(r.currency))
   AND i.amount = r.amount
   AND i.provider = 'manual'
   AND i.status = 'awaiting_receipt'
   AND i.purpose = 'wallet_topup'
  WHERE r.status = 'approved'
    AND r.intent_id IS NULL
)
UPDATE payment_intents i
SET status = 'paid', updated_at = NOW()
FROM matched m
WHERE i.id = m.intent_id
  AND m.rn = 1;

WITH matched AS (
  SELECT
    r.id AS receipt_id,
    i.id AS intent_id,
    ROW_NUMBER() OVER (
      PARTITION BY r.id
      ORDER BY i.created_at ASC, i.id ASC
    ) AS rn
  FROM payment_receipts r
  INNER JOIN payment_intents i
    ON i.user_id = r.user_id
   AND UPPER(TRIM(i.currency)) = UPPER(TRIM(r.currency))
   AND i.amount = r.amount
   AND i.provider = 'manual'
   AND i.status = 'paid'
   AND i.purpose = 'wallet_topup'
  WHERE r.status = 'approved'
    AND r.intent_id IS NULL
)
UPDATE payment_receipts r
SET intent_id = m.intent_id
FROM matched m
WHERE r.id = m.receipt_id
  AND m.rn = 1
  AND r.intent_id IS NULL;

-- Smart Menu–style staff / player copy (noun "Payment proof", not "Receipt pending").
UPDATE notification_kinds
SET title_template = 'Payment proof',
    body_template = 'Payment proof submitted by %s (%s %s). Please review.'
WHERE code = 'admin.receipt_pending';

UPDATE notification_kinds
SET title_template = 'Payment proof reviewed',
    body_template = 'Your payment proof was %s.'
WHERE code = 'player.receipt_reviewed';

UPDATE notification_kinds
SET title_template = 'Wallet credited'
WHERE code = 'player.wallet_credited';

UPDATE notification_kinds
SET title_template = 'Payout request',
    body_template = 'New payout request from %s (%s %s). Please review.'
WHERE code = 'admin.payout_pending';

-- Player wallet + admin console status display labels.
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'list_status_awaiting_receipt', COALESCE(NULLIF(trim(value->>'list_status_awaiting_receipt'), ''), 'Awaiting proof'),
  'list_status_paid', COALESCE(NULLIF(trim(value->>'list_status_paid'), ''), 'Paid')
),
  updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'txn_status_awaiting_receipt', COALESCE(NULLIF(trim(value->'payments'->>'txn_status_awaiting_receipt'), ''), 'Awaiting proof'),
    'txn_status_paid', COALESCE(NULLIF(trim(value->'payments'->>'txn_status_paid'), ''), 'Paid'),
    'txn_status_pending', COALESCE(NULLIF(trim(value->'payments'->>'txn_status_pending'), ''), 'Pending'),
    'txn_status_posted', COALESCE(NULLIF(trim(value->'payments'->>'txn_status_posted'), ''), 'Posted'),
    'txn_status_approved', COALESCE(NULLIF(trim(value->'payments'->>'txn_status_approved'), ''), 'Approved'),
    'txn_status_rejected', COALESCE(NULLIF(trim(value->'payments'->>'txn_status_rejected'), ''), 'Rejected')
  ),
  true
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';
