-- Social-only auth: Google via Supabase OAuth only. Drop password column.
-- Primary phone required on payout destination before a payout request.

ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_phone TEXT;
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;

CREATE TABLE IF NOT EXISTS user_payout_methods (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  account_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_payout_methods_phone_nonempty CHECK (length(trim(phone)) >= 8)
);

CREATE TABLE IF NOT EXISTS payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL,
  phone TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_user ON payout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);

-- Refresh auth_providers chrome: social only messaging.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{login_title}',
  '"Sign in with Google"'
),
updated_at = NOW()
WHERE key = 'auth_providers';
