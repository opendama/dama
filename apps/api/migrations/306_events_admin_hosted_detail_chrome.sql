-- Admin hosted cups: entry column, view-detail modal chrome, search debounce.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'hosted_col_entry', COALESCE(NULLIF(trim(value->>'hosted_col_entry'), ''), 'Entry'),
  'hosted_col_actions', COALESCE(NULLIF(trim(value->>'hosted_col_actions'), ''), 'Actions'),
  'view_detail_action', COALESCE(NULLIF(trim(value->>'view_detail_action'), ''), 'View details'),
  'detail_modal_title', COALESCE(NULLIF(trim(value->>'detail_modal_title'), ''), 'Cup details'),
  'detail_close_label', COALESCE(NULLIF(trim(value->>'detail_close_label'), ''), 'Close'),
  'detail_format_label', COALESCE(NULLIF(trim(value->>'detail_format_label'), ''), 'Format'),
  'detail_size_label', COALESCE(NULLIF(trim(value->>'detail_size_label'), ''), 'Host size'),
  'detail_entry_fee_label', COALESCE(NULLIF(trim(value->>'detail_entry_fee_label'), ''), 'Entry fee'),
  'detail_host_fee_label', COALESCE(NULLIF(trim(value->>'detail_host_fee_label'), ''), 'Host fee'),
  'detail_commission_label', COALESCE(NULLIF(trim(value->>'detail_commission_label'), ''), 'Platform commission'),
  'detail_auto_approve_label', COALESCE(NULLIF(trim(value->>'detail_auto_approve_label'), ''), 'Auto-approve join'),
  'detail_pending_players_label', COALESCE(NULLIF(trim(value->>'detail_pending_players_label'), ''), 'Pending players'),
  'detail_updated_label', COALESCE(NULLIF(trim(value->>'detail_updated_label'), ''), 'Updated'),
  'detail_started_label', COALESCE(NULLIF(trim(value->>'detail_started_label'), ''), 'Started'),
  'detail_finished_label', COALESCE(NULLIF(trim(value->>'detail_finished_label'), ''), 'Finished'),
  'detail_cancelled_label', COALESCE(NULLIF(trim(value->>'detail_cancelled_label'), ''), 'Cancelled'),
  'detail_share_label', COALESCE(NULLIF(trim(value->>'detail_share_label'), ''), 'Share link'),
  'detail_prize_now_label', COALESCE(NULLIF(trim(value->>'detail_prize_now_label'), ''), 'Prize pool now'),
  'detail_prize_if_full_label', COALESCE(NULLIF(trim(value->>'detail_prize_if_full_label'), ''), 'Prize pool if full'),
  'detail_prize_guarantee_label', COALESCE(NULLIF(trim(value->>'detail_prize_guarantee_label'), ''), 'Guaranteed minimum'),
  'detail_prize_frozen_label', COALESCE(NULLIF(trim(value->>'detail_prize_frozen_label'), ''), 'Prize pool frozen'),
  'detail_sponsor_label', COALESCE(NULLIF(trim(value->>'detail_sponsor_label'), ''), 'Sponsor'),
  'detail_yes', COALESCE(NULLIF(trim(value->>'detail_yes'), ''), 'Yes'),
  'detail_no', COALESCE(NULLIF(trim(value->>'detail_no'), ''), 'No'),
  'amount_currency_separator', COALESCE(NULLIF(trim(value->>'amount_currency_separator'), ''), ' '),
  'search_debounce_ms', COALESCE(NULLIF(trim(value->>'search_debounce_ms'), ''), '250')
),
    updated_at = NOW()
WHERE key = 'events_admin_chrome';
