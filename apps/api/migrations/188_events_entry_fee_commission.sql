-- Entry fee platform commission: admin catalog %, snapshot per event, split on join,
-- wallet ledger for transactions history, chrome for organizer/player/admin.

-- ---------------------------------------------------------------------------
-- Event snapshot + entry split columns
-- ---------------------------------------------------------------------------
ALTER TABLE hosted_events
  ADD COLUMN IF NOT EXISTS entry_fee_commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (entry_fee_commission_percent >= 0 AND entry_fee_commission_percent <= 100);

ALTER TABLE hosted_event_entries
  ADD COLUMN IF NOT EXISTS platform_commission NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (platform_commission >= 0);

ALTER TABLE hosted_event_entries
  ADD COLUMN IF NOT EXISTS organizer_net NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (organizer_net >= 0);

-- ---------------------------------------------------------------------------
-- Wallet ledger (unioned into player transactions list)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'posted',
  reference TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'wallet',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wallet_ledger_currency_nonempty CHECK (length(trim(currency)) > 0),
  CONSTRAINT wallet_ledger_kind_nonempty CHECK (length(trim(kind)) > 0),
  CONSTRAINT wallet_ledger_status_nonempty CHECK (length(trim(status)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_created
  ON wallet_ledger (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Catalog: entry fee commission percent (0-100)
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || '{
  "entry_fee_commission_percent": 10
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_catalog';

-- ---------------------------------------------------------------------------
-- Enums: wallet ledger kinds (clients map via wallet_chrome)
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || '{
  "wallet_ledger_kinds": ["event_host_fee", "event_entry_paid", "event_entry_earned"]
}'::jsonb,
updated_at = NOW()
WHERE key = 'client_enums';

-- ---------------------------------------------------------------------------
-- Notification: organizer received entry fee net
-- ---------------------------------------------------------------------------
INSERT INTO notification_kinds (code, audience, title_template, body_template, href_path, href_query_key) VALUES
  ('player.event_entry_earned', 'player', 'Entry fee received', 'You earned %s %s from a join on "%s".', '/events/dashboard', '')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Organizer chrome
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || '{
  "commission_percent_label": "Platform commission",
  "commission_blurb_template": "Platform keeps {percent}% of each paid entry. You receive the rest in your wallet.",
  "kpi_entry_fee_gross_label": "Entry fees (gross)",
  "kpi_entry_fee_commission_label": "Platform commission",
  "kpi_entry_fee_net_label": "Entry fees (your net)",
  "payments_commission_label": "Platform commission",
  "payments_organizer_net_label": "Your entry net",
  "analytics_commission_label": "Commission",
  "analytics_entry_net_label": "Entry net"
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

-- ---------------------------------------------------------------------------
-- Player chrome
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || '{
  "entry_fee_pay_blurb": "Entry fee is charged from your wallet when you join."
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_player_chrome';

-- ---------------------------------------------------------------------------
-- Admin chrome
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || '{
  "entry_fee_commission_label": "Entry fee commission %",
  "entry_fee_commission_blurb": "Percent of each player entry fee kept by the platform. Organizer receives the remainder."
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_admin_chrome';

-- ---------------------------------------------------------------------------
-- Wallet chrome: ledger kind labels
-- ---------------------------------------------------------------------------
-- Wallet ledger labels: Tournament wording (migrateonly re-applies before 381/387).
UPDATE platform_settings
SET value = value || '{
  "list_kind_event_host_fee": "Tournament host fee",
  "list_kind_event_entry_paid": "Tournament entry fee",
  "list_kind_event_entry_earned": "Tournament entry earned"
}'::jsonb,
updated_at = NOW()
WHERE key = 'wallet_chrome';
