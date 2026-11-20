-- Multi bank/mobile-money payout destinations per user + wallet/admin chrome for modal CRUD tables.
-- Idempotent: schema reshape runs only when user_payout_methods still lacks id (legacy 1:1 PK).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_payout_methods'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_payout_methods'
      AND column_name = 'id'
  ) THEN
    CREATE TABLE user_payout_methods_v2 (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      account_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT user_payout_methods_v2_phone_nonempty CHECK (length(trim(phone)) >= 8)
    );

    INSERT INTO user_payout_methods_v2 (id, user_id, provider, account_name, phone, created_at, updated_at)
    SELECT gen_random_uuid(), user_id, provider, account_name, phone,
           COALESCE(updated_at, NOW()), COALESCE(updated_at, NOW())
    FROM user_payout_methods;

    DROP TABLE user_payout_methods;
    ALTER TABLE user_payout_methods_v2 RENAME TO user_payout_methods;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_payout_methods_user_updated
  ON user_payout_methods (user_id, updated_at DESC);

-- 2) Wallet chrome: methods table + row actions (fail-closed clients require keys)
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'payout_methods_empty',
  COALESCE(NULLIF(trim(value->>'payout_methods_empty'), ''), 'No bank / mobile money details yet'),
  'payout_methods_load_failed',
  COALESCE(NULLIF(trim(value->>'payout_methods_load_failed'), ''), 'Unable to load payout details'),
  'payout_method_add_action',
  COALESCE(NULLIF(trim(value->>'payout_method_add_action'), ''), 'Add payout details'),
  'payout_method_edit_action',
  COALESCE(NULLIF(trim(value->>'payout_method_edit_action'), ''), 'Edit'),
  'payout_method_delete_action',
  COALESCE(NULLIF(trim(value->>'payout_method_delete_action'), ''), 'Delete'),
  'payout_method_delete_confirm',
  COALESCE(NULLIF(trim(value->>'payout_method_delete_confirm'), ''), 'Delete this payout destination?'),
  'payout_method_deleted',
  COALESCE(NULLIF(trim(value->>'payout_method_deleted'), ''), 'Payout details deleted'),
  'payout_method_delete_failed',
  COALESCE(NULLIF(trim(value->>'payout_method_delete_failed'), ''), 'Unable to delete payout details'),
  'payout_method_updated',
  COALESCE(NULLIF(trim(value->>'payout_method_updated'), ''), 'Payout details updated'),
  'payout_methods_page_size',
  COALESCE(NULLIF(trim(value->>'payout_methods_page_size'), ''), '10'),
  'payout_methods_actions_label',
  COALESCE(NULLIF(trim(value->>'payout_methods_actions_label'), ''), 'Actions'),
  'age_gate_open_action',
  COALESCE(NULLIF(trim(value->>'age_gate_open_action'), ''), 'Verify age')
),
    updated_at = NOW()
WHERE key = 'wallet_chrome';

-- Clearer age gate copy (still DB chrome; clients never invent)
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'age_required_error',
  COALESCE(
    NULLIF(trim(value->>'age_required_error'), ''),
    NULLIF(trim(value->>'age_gate_blurb'), ''),
    'Age verification is required before using cash features'
  )
),
    updated_at = NOW()
WHERE key = 'cash_rmg_chrome';

-- 3) Admin banks: edit/delete chrome for modal CRUD parity
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{banks}',
  COALESCE(value->'banks', '{}'::jsonb) || jsonb_build_object(
    'edit_action',
    COALESCE(NULLIF(trim(value->'banks'->>'edit_action'), ''), 'Edit'),
    'delete_action',
    COALESCE(NULLIF(trim(value->'banks'->>'delete_action'), ''), 'Delete'),
    'delete_confirm',
    COALESCE(NULLIF(trim(value->'banks'->>'delete_confirm'), ''), 'Delete this bank account?'),
    'toast_deleted',
    COALESCE(NULLIF(trim(value->'banks'->>'toast_deleted'), ''), 'Bank deleted'),
    'save_action',
    COALESCE(NULLIF(trim(value->'banks'->>'save_action'), ''), 'Save'),
    'save_pending',
    COALESCE(NULLIF(trim(value->'banks'->>'save_pending'), ''), 'Saving…'),
    'dialog_close_label',
    COALESCE(NULLIF(trim(value->'banks'->>'dialog_close_label'), ''), 'Close'),
    'cancel_action',
    COALESCE(NULLIF(trim(value->'banks'->>'cancel_action'), ''), 'Cancel'),
    'actions_label',
    COALESCE(NULLIF(trim(value->'banks'->>'actions_label'), ''), 'Actions'),
    'empty_label',
    COALESCE(NULLIF(trim(value->'banks'->>'empty_label'), ''), 'No bank accounts yet'),
    'toast_failed',
    COALESCE(NULLIF(trim(value->'banks'->>'toast_failed'), ''), 'Unable to update bank')
  )
),
    updated_at = NOW()
WHERE key = 'admin_console_chrome';
