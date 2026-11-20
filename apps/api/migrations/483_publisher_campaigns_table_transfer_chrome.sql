-- Publisher campaigns table parity (status column, selection, delete) + required daily spend cap
-- + Manual Transfer money page (ET geo / manual_transfer route only on clients).

-- ---------------------------------------------------------------------------
-- ad_runtime_chrome: campaigns list / create / delete
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'status_label', COALESCE(NULLIF(trim(value->>'status_label'), ''), 'Status'),
    'select_all_label', COALESCE(NULLIF(trim(value->>'select_all_label'), ''), 'Select all'),
    'select_row_label', COALESCE(NULLIF(trim(value->>'select_row_label'), ''), 'Select row'),
    'selected_count_fmt', COALESCE(NULLIF(trim(value->>'selected_count_fmt'), ''), '{count} selected'),
    'clear_selection_action', COALESCE(NULLIF(trim(value->>'clear_selection_action'), ''), 'Clear selection'),
    'bulk_apply_status_action', COALESCE(NULLIF(trim(value->>'bulk_apply_status_action'), ''), 'Apply status'),
    'bulk_status_pending', COALESCE(NULLIF(trim(value->>'bulk_status_pending'), ''), 'Updating status…'),
    'delete_campaign_action', COALESCE(NULLIF(trim(value->>'delete_campaign_action'), ''), 'Delete'),
    'delete_campaign_pending', COALESCE(NULLIF(trim(value->>'delete_campaign_pending'), ''), 'Deleting…'),
    'delete_campaign_confirm_title', COALESCE(NULLIF(trim(value->>'delete_campaign_confirm_title'), ''), 'Delete campaign?'),
    'delete_campaign_confirm_description', COALESCE(NULLIF(trim(value->>'delete_campaign_confirm_description'), ''), 'This permanently removes the campaign and its creatives. Campaigns with impressions or clicks cannot be deleted; archive them instead. Create fee is not refunded.'),
    'toast_campaign_deleted', COALESCE(NULLIF(trim(value->>'toast_campaign_deleted'), ''), 'Campaign deleted'),
    'toast_campaign_delete_failed', COALESCE(NULLIF(trim(value->>'toast_campaign_delete_failed'), ''), 'Could not delete campaign'),
    'err_delete_has_delivery', COALESCE(NULLIF(trim(value->>'err_delete_has_delivery'), ''), 'Campaigns with impressions or clicks cannot be deleted. Archive the campaign instead.'),
    'err_delete_auto_closed', COALESCE(NULLIF(trim(value->>'err_delete_auto_closed'), ''), 'Auto-closed campaigns cannot be deleted.'),
    'err_daily_spend_cap_required', COALESCE(NULLIF(trim(value->>'err_daily_spend_cap_required'), ''), 'Daily spend cap is required and must be greater than zero.'),
    'ph_daily_spend_cap', COALESCE(NULLIF(trim(value->>'ph_daily_spend_cap'), ''), 'Daily spend cap (required)'),
    'daily_spend_cap_required_hint', COALESCE(NULLIF(trim(value->>'daily_spend_cap_required_hint'), ''), 'Required. Caps how much this campaign can spend per day from impressions. Separate from the one-time create fee charged to your wallet.'),
    'campaign_create_fee_blurb', COALESCE(NULLIF(trim(value->>'campaign_create_fee_blurb'), ''), 'One-time create fee charged from your wallet when you create the campaign. This is not the daily spend cap.'),
    'publisher_portal_transfer_label', COALESCE(NULLIF(trim(value->>'publisher_portal_transfer_label'), ''), 'Manual transfer'),
    'publisher_portal_transfer_href', COALESCE(NULLIF(trim(value->>'publisher_portal_transfer_href'), ''), '/ads/transfer')
  ),
  updated_at = NOW()
WHERE key = 'ad_runtime_chrome';

-- ---------------------------------------------------------------------------
-- wallet_chrome: Manual Transfer page links (shown only when payment route is manual_transfer)
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'link_manual_transfer_label', COALESCE(NULLIF(trim(value->>'link_manual_transfer_label'), ''), 'Manual transfer'),
    'link_manual_transfer_href', COALESCE(NULLIF(trim(value->>'link_manual_transfer_href'), ''), '/transfer'),
    'manual_transfer_page_title', COALESCE(NULLIF(trim(value->>'manual_transfer_page_title'), ''), 'Manual transfer'),
    'manual_transfer_page_blurb', COALESCE(NULLIF(trim(value->>'manual_transfer_page_blurb'), ''), 'Transfer to a listed account, then upload your screenshot so we can credit your wallet.'),
    'manual_transfer_unavailable', COALESCE(NULLIF(trim(value->>'manual_transfer_unavailable'), ''), 'Manual bank transfer is only available for domestic payment routes. Use Wallet checkout for card payments.')
  ),
  updated_at = NOW()
WHERE key = 'wallet_chrome';

-- ---------------------------------------------------------------------------
-- client_nav: ads / events / player Manual Transfer routes (clients geo-gate visibility)
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{ads}',
  COALESCE(value->'ads', '[]'::jsonb)
  || CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'ads', '[]'::jsonb)) e
      WHERE e->>'route_key' = 'ads_transfer'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'Manual transfer', 'href', '/ads/transfer', 'route_key', 'ads_transfer',
      'body', 'Domestic bank transfer and receipt upload.', 'cta', 'Open transfer'
    ))
  END
),
updated_at = NOW()
WHERE key = 'client_nav';

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{bottom_nav,ads}',
  COALESCE(value->'bottom_nav'->'ads', '[]'::jsonb)
  || CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'ads', '[]'::jsonb)) e
      WHERE e->>'route_key' = 'ads_transfer'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'Manual transfer', 'href', '/ads/transfer', 'route_key', 'ads_transfer'
    ))
  END
),
updated_at = NOW()
WHERE key = 'client_nav';

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{events}',
  COALESCE(value->'events', '[]'::jsonb)
  || CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'events', '[]'::jsonb)) e
      WHERE e->>'route_key' = 'events_transfer'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'Manual transfer', 'href', '/events/transfer', 'route_key', 'events_transfer',
      'body', 'Domestic bank transfer and receipt upload.', 'cta', 'Open transfer'
    ))
  END
),
updated_at = NOW()
WHERE key = 'client_nav';

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{bottom_nav,events}',
  COALESCE(value->'bottom_nav'->'events', '[]'::jsonb)
  || CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'events', '[]'::jsonb)) e
      WHERE e->>'route_key' = 'events_transfer'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'Manual transfer', 'href', '/events/transfer', 'route_key', 'events_transfer'
    ))
  END
),
updated_at = NOW()
WHERE key = 'client_nav';

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{player}',
  COALESCE(value->'player', '[]'::jsonb)
  || CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'player', '[]'::jsonb)) e
      WHERE e->>'route_key' = 'transfer'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'Manual transfer', 'href', '/transfer', 'route_key', 'transfer',
      'body', 'Domestic bank transfer and receipt upload.', 'cta', 'Open transfer'
    ))
  END
),
updated_at = NOW()
WHERE key = 'client_nav';

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{dashboard}',
  COALESCE(value->'dashboard', '[]'::jsonb)
  || CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'dashboard', '[]'::jsonb)) e
      WHERE e->>'route_key' = 'transfer'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'Manual transfer', 'href', '/transfer', 'route_key', 'transfer',
      'body', 'Domestic bank transfer and receipt upload.', 'cta', 'Open transfer'
    ))
  END
),
updated_at = NOW()
WHERE key = 'client_nav';
