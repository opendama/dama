-- Admin transactions Ops filters: status + kind labels + All sentinel.
-- Kind labels mirror wallet_chrome list_kind_* (payments surface; fail-closed).

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'filter_all_label', COALESCE(NULLIF(trim(value->'payments'->>'filter_all_label'), ''), 'All'),
    'txn_kind_topup', COALESCE(
      NULLIF(trim(value->'payments'->>'txn_kind_topup'), ''),
      NULLIF(trim((SELECT value->>'list_kind_topup' FROM platform_settings WHERE key = 'wallet_chrome')), ''),
      'Top-up'
    ),
    'txn_kind_payout', COALESCE(
      NULLIF(trim(value->'payments'->>'txn_kind_payout'), ''),
      NULLIF(trim((SELECT value->>'list_kind_payout' FROM platform_settings WHERE key = 'wallet_chrome')), ''),
      'Payout'
    ),
    'txn_kind_competition_prize_payout', COALESCE(
      NULLIF(trim(value->'payments'->>'txn_kind_competition_prize_payout'), ''),
      NULLIF(trim((SELECT value->>'list_kind_competition_prize_payout' FROM platform_settings WHERE key = 'wallet_chrome')), ''),
      'Competition prize'
    ),
    'txn_kind_campaign_create_fee', COALESCE(
      NULLIF(trim(value->'payments'->>'txn_kind_campaign_create_fee'), ''),
      NULLIF(trim((SELECT value->>'list_kind_campaign_create_fee' FROM platform_settings WHERE key = 'wallet_chrome')), ''),
      'Campaign create fee'
    ),
    'txn_kind_event_host_fee', COALESCE(
      NULLIF(trim(value->'payments'->>'txn_kind_event_host_fee'), ''),
      NULLIF(trim((SELECT value->>'list_kind_event_host_fee' FROM platform_settings WHERE key = 'wallet_chrome')), ''),
      'Tournament host fee'
    ),
    'txn_kind_event_entry_paid', COALESCE(
      NULLIF(trim(value->'payments'->>'txn_kind_event_entry_paid'), ''),
      NULLIF(trim((SELECT value->>'list_kind_event_entry_paid' FROM platform_settings WHERE key = 'wallet_chrome')), ''),
      'Tournament entry fee'
    ),
    'txn_kind_event_entry_earned', COALESCE(
      NULLIF(trim(value->'payments'->>'txn_kind_event_entry_earned'), ''),
      NULLIF(trim((SELECT value->>'list_kind_event_entry_earned' FROM platform_settings WHERE key = 'wallet_chrome')), ''),
      'Tournament entry earned'
    ),
    'txn_kind_event_entry_commission', COALESCE(
      NULLIF(trim(value->'payments'->>'txn_kind_event_entry_commission'), ''),
      NULLIF(trim((SELECT value->>'list_kind_event_entry_commission' FROM platform_settings WHERE key = 'wallet_chrome')), ''),
      'Tournament entry commission'
    ),
    'txn_kind_event_entry_refund', COALESCE(
      NULLIF(trim(value->'payments'->>'txn_kind_event_entry_refund'), ''),
      NULLIF(trim((SELECT value->>'list_kind_event_entry_refund' FROM platform_settings WHERE key = 'wallet_chrome')), ''),
      'Tournament entry refund'
    ),
    'txn_kind_event_entry_clawback', COALESCE(
      NULLIF(trim(value->'payments'->>'txn_kind_event_entry_clawback'), ''),
      NULLIF(trim((SELECT value->>'list_kind_event_entry_clawback' FROM platform_settings WHERE key = 'wallet_chrome')), ''),
      'Tournament entry clawback'
    ),
    'txn_kind_prize_pool_guarantee_hold', COALESCE(
      NULLIF(trim(value->'payments'->>'txn_kind_prize_pool_guarantee_hold'), ''),
      NULLIF(trim((SELECT value->>'list_kind_prize_pool_guarantee_hold' FROM platform_settings WHERE key = 'wallet_chrome')), ''),
      'Prize pool guarantee hold'
    ),
    'txn_kind_prize_pool_guarantee_release', COALESCE(
      NULLIF(trim(value->'payments'->>'txn_kind_prize_pool_guarantee_release'), ''),
      NULLIF(trim((SELECT value->>'list_kind_prize_pool_guarantee_release' FROM platform_settings WHERE key = 'wallet_chrome')), ''),
      'Prize pool guarantee release'
    ),
    'txn_kind_prize_pool_guarantee_capture', COALESCE(
      NULLIF(trim(value->'payments'->>'txn_kind_prize_pool_guarantee_capture'), ''),
      NULLIF(trim((SELECT value->>'list_kind_prize_pool_guarantee_capture' FROM platform_settings WHERE key = 'wallet_chrome')), ''),
      'Prize pool guarantee capture'
    ),
    'txn_kind_tournament_entry_refund', COALESCE(
      NULLIF(trim(value->'payments'->>'txn_kind_tournament_entry_refund'), ''),
      NULLIF(trim((SELECT value->>'list_kind_tournament_entry_refund' FROM platform_settings WHERE key = 'wallet_chrome')), ''),
      'Tournament entry refund'
    )
  ),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
