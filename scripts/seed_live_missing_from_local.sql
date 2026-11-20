-- Seed LIVE with gaps that cleaned LOCAL still has.
-- DATA/config rows only. No DROP. No chrome overwrite.
-- SKIP: e2e.probe.* RBAC (test-only).
-- payment_accounts ciphertext requires the same DAMA_SECRETS_KEY as local.

BEGIN;

-- 1) Telegram ops reviewer user (matches .env DAMA_TELEGRAM_OPS_REVIEWER_USER_ID)
-- Live already uses username "admin" for bereketgezha@gmail.com, so ops username differs.
INSERT INTO users (
  id, email, username, role, rating, xp, wins, losses, draws,
  is_active, avatar_moderation_status, created_at, updated_at
) VALUES (
  '29c29227-d741-45eb-8c9e-93583bf1ab37',
  'admin@dama.local',
  'telegram_ops',
  'admin',
  1200, 0, 0, 0, 0,
  TRUE, 'none', NOW(), NOW()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  role = EXCLUDED.role,
  is_active = TRUE,
  updated_at = NOW();

-- 2) Missing ihate3 (local has; live did not). Auth user already exists in Supabase.
INSERT INTO users (
  id, email, username, role, rating, xp, wins, losses, draws,
  is_active, avatar_moderation_status, auth_provider, supabase_user_id,
  created_at, updated_at
) VALUES (
  'b1def23f-6ac5-4d09-bf7b-8d1388171046',
  'ihateofficial12@gmail.com',
  'ihate3',
  'player',
  1232, 50, 0, 0, 0,
  TRUE, 'none', 'google', '49187c9b-a82d-4b70-95b4-71714fc2c056',
  NOW(), NOW()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  role = EXCLUDED.role,
  auth_provider = EXCLUDED.auth_provider,
  supabase_user_id = EXCLUDED.supabase_user_id,
  is_active = TRUE,
  updated_at = NOW();

-- username/email unique conflicts if another row owns them
-- (fail closed below if ihate3 missing after insert)

-- 3) Payment accounts from local (sealed with DAMA_SECRETS_KEY)
INSERT INTO payment_accounts (
  id, provider, label, account_name, account_number, mobile_code, currency, is_active, created_at
) VALUES
  (
    'eba9703a-6f10-450e-affd-e1b583026cc0',
    'Safari', 'mobile-transfer', 'Bereket Gezha',
    'GZ8AbiGOgsXxW7+D0sIIR4dGYbkKTr9XB2c4Zx0gE5mk3HyBxCU=', NULL,
    'ETB', TRUE, NOW()
  ),
  (
    '3f82857c-b195-46ad-9c4f-84930e1a78bc',
    'awash', 'Awash', 'dama Awash',
    'jTi41FI1n5MSxs3hvQ9bbdcD1KKG+4neAm+RB3rJvXibmZ5PKtJPEIA=', NULL,
    'ETB', TRUE, NOW()
  ),
  (
    '89a2af7f-9788-49dd-924c-140fb0ee44e7',
    'cbe', 'CBE Test', 'dama',
    'FdFT9O8aNXpgrM2CUHD8ENgmI9KotqWtER2xZCgEqiMZl+H5VmBk424=',
    'h1PwcZivrvse35Rj8jJg57fp8ngUh7wcoNQ+hVRQAWxh/Zco0JnWqQ==',
    'ETB', TRUE, NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  provider = EXCLUDED.provider,
  label = EXCLUDED.label,
  account_name = EXCLUDED.account_name,
  account_number = EXCLUDED.account_number,
  mobile_code = EXCLUDED.mobile_code,
  currency = EXCLUDED.currency,
  is_active = EXCLUDED.is_active;

-- 4) Wallets for local balances, matched by email on live users
INSERT INTO wallets (id, user_id, currency, balance, updated_at)
SELECT gen_random_uuid(), u.id, v.currency, v.balance, NOW()
FROM (
  VALUES
    ('ihateofficial12@gmail.com', 'ETB', 4790.00::numeric),
    ('ihateofficial47@gmail.com', 'ETB', 14118.00::numeric),
    ('ihateofficial59@gmail.com', 'ETB', 660.00::numeric)
) AS v(email, currency, balance)
JOIN users u ON lower(u.email) = lower(v.email)
ON CONFLICT (user_id, currency) DO UPDATE SET
  balance = EXCLUDED.balance,
  updated_at = NOW();

DO $$
DECLARE
  n_ops int;
  n_ihate3 int;
  n_banks int;
  n_wallets int;
  n_e2e int;
BEGIN
  SELECT COUNT(*) INTO n_ops FROM users WHERE id = '29c29227-d741-45eb-8c9e-93583bf1ab37';
  SELECT COUNT(*) INTO n_ihate3 FROM users WHERE email = 'ihateofficial12@gmail.com' AND username = 'ihate3';
  SELECT COUNT(*) INTO n_banks FROM payment_accounts;
  SELECT COUNT(*) INTO n_wallets FROM wallets;
  SELECT COUNT(*) INTO n_e2e FROM rbac_permissions WHERE key LIKE 'e2e.%';

  IF n_ops <> 1 THEN
    RAISE EXCEPTION 'fail-closed: ops reviewer user missing';
  END IF;
  IF n_ihate3 <> 1 THEN
    RAISE EXCEPTION 'fail-closed: ihate3 user missing';
  END IF;
  IF n_banks < 3 THEN
    RAISE EXCEPTION 'fail-closed: payment_accounts not seeded';
  END IF;
  IF n_wallets < 3 THEN
    RAISE EXCEPTION 'fail-closed: wallets not seeded';
  END IF;
  IF n_e2e <> 0 THEN
    RAISE EXCEPTION 'fail-closed: e2e rbac must not be seeded to live';
  END IF;

  RAISE NOTICE 'live_seed_ok ops=% ihate3=% banks=% wallets=%', n_ops, n_ihate3, n_banks, n_wallets;
END $$;

COMMIT;
