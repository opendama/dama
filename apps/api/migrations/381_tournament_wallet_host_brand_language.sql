-- Mig 381: Player-facing wallet + host brand - Tournament wording (not Event sport).
-- Admin/ops keys (events_admin_chrome, spectate event log) unchanged.
-- Backend tables stay separate. Idempotent.

-- ---------------------------------------------------------------------------
-- client_nav: organizer surface brand (SurfaceHomeLink events surface).
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{events_brand_name}',
  to_jsonb('Hosting'::text)
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND (
    COALESCE(value->>'events_brand_name', '') = ''
    OR COALESCE(value->>'events_brand_name', '') ILIKE 'events'
  );

-- ---------------------------------------------------------------------------
-- wallet_chrome: ledger labels players see for hosted-cup money.
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'list_kind_event_host_fee',
  COALESCE(NULLIF(trim(value->>'list_kind_event_host_fee'), ''), 'Tournament host fee'),
  'list_kind_event_entry_paid',
  COALESCE(NULLIF(trim(value->>'list_kind_event_entry_paid'), ''), 'Tournament entry fee'),
  'list_kind_event_entry_earned',
  COALESCE(NULLIF(trim(value->>'list_kind_event_entry_earned'), ''), 'Tournament entry earned'),
  'list_kind_event_entry_commission',
  COALESCE(NULLIF(trim(value->>'list_kind_event_entry_commission'), ''), 'Tournament entry commission'),
  'list_kind_event_entry_refund',
  COALESCE(NULLIF(trim(value->>'list_kind_event_entry_refund'), ''), 'Tournament entry refund'),
  'list_kind_event_entry_clawback',
  COALESCE(NULLIF(trim(value->>'list_kind_event_entry_clawback'), ''), 'Tournament entry clawback')
),
updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'list_kind_event_host_fee', 'Tournament host fee',
  'list_kind_event_entry_paid', 'Tournament entry fee',
  'list_kind_event_entry_earned', 'Tournament entry earned',
  'list_kind_event_entry_commission', 'Tournament entry commission',
  'list_kind_event_entry_refund', 'Tournament entry refund',
  'list_kind_event_entry_clawback', 'Tournament entry clawback'
),
updated_at = NOW()
WHERE key = 'wallet_chrome'
  AND (
    COALESCE(value->>'list_kind_event_host_fee', '') ILIKE 'event %'
    OR COALESCE(value->>'list_kind_event_entry_paid', '') ILIKE 'event %'
    OR COALESCE(value->>'list_kind_event_entry_earned', '') ILIKE 'event %'
  );
