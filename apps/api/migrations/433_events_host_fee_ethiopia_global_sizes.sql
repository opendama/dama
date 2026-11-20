-- Host sizes: Ethiopia vs global host fees (ads campaign-create fee parity).
-- Legacy host_fee_amount/currency → Ethiopia; global seeded from amount/10 (min 1).
-- Currencies lock to payment_currency.ethiopia / payment_currency.global.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{sizes}',
  COALESCE((
    SELECT jsonb_agg(
      elem || jsonb_build_object(
        'host_fee_ethiopia_amount', COALESCE(
          NULLIF((NULLIF(trim(elem->>'host_fee_ethiopia_amount'), ''))::numeric, 0),
          NULLIF((NULLIF(trim(elem->>'host_fee_amount'), ''))::numeric, 0),
          50
        ),
        'host_fee_ethiopia_currency', upper(COALESCE(
          NULLIF(trim(elem->>'host_fee_ethiopia_currency'), ''),
          NULLIF(trim((SELECT value->>'ethiopia' FROM platform_settings WHERE key = 'payment_currency')), ''),
          NULLIF(trim(elem->>'host_fee_currency'), ''),
          'ETB'
        )),
        'host_fee_global_amount', COALESCE(
          NULLIF((NULLIF(trim(elem->>'host_fee_global_amount'), ''))::numeric, 0),
          GREATEST(1, round(COALESCE(
            NULLIF((NULLIF(trim(elem->>'host_fee_ethiopia_amount'), ''))::numeric, 0),
            NULLIF((NULLIF(trim(elem->>'host_fee_amount'), ''))::numeric, 0),
            50
          ) / 10.0, 2))
        ),
        'host_fee_global_currency', upper(COALESCE(
          NULLIF(trim(elem->>'host_fee_global_currency'), ''),
          NULLIF(trim((SELECT value->>'global' FROM platform_settings WHERE key = 'payment_currency')), ''),
          'USD'
        )),
        'host_fee_amount', COALESCE(
          NULLIF((NULLIF(trim(elem->>'host_fee_ethiopia_amount'), ''))::numeric, 0),
          NULLIF((NULLIF(trim(elem->>'host_fee_amount'), ''))::numeric, 0),
          50
        ),
        'host_fee_currency', upper(COALESCE(
          NULLIF(trim(elem->>'host_fee_ethiopia_currency'), ''),
          NULLIF(trim((SELECT value->>'ethiopia' FROM platform_settings WHERE key = 'payment_currency')), ''),
          NULLIF(trim(elem->>'host_fee_currency'), ''),
          'ETB'
        ))
      )
      ORDER BY COALESCE((elem->>'sort_order')::int, 0), elem->>'id'
    )
    FROM jsonb_array_elements(COALESCE(value->'sizes', '[]'::jsonb)) elem
  ), '[]'::jsonb)
),
updated_at = NOW()
WHERE key = 'events_catalog';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'host_fee_geo_blurb', COALESCE(
    NULLIF(trim(value->>'host_fee_geo_blurb'), ''),
    'Ethiopia organizers are charged the Ethiopia host fee in ETB. Organizers outside Ethiopia are charged the global host fee in USD.'
  ),
  'host_fee_ethiopia_amount_label', COALESCE(
    NULLIF(trim(value->>'host_fee_ethiopia_amount_label'), ''),
    'Ethiopia host fee'
  ),
  'host_fee_ethiopia_currency_label', COALESCE(
    NULLIF(trim(value->>'host_fee_ethiopia_currency_label'), ''),
    'Ethiopia host fee currency'
  ),
  'host_fee_global_amount_label', COALESCE(
    NULLIF(trim(value->>'host_fee_global_amount_label'), ''),
    'Global host fee'
  ),
  'host_fee_global_currency_label', COALESCE(
    NULLIF(trim(value->>'host_fee_global_currency_label'), ''),
    'Global host fee currency'
  ),
  'sizes_col_ethiopia_fee', COALESCE(NULLIF(trim(value->>'sizes_col_ethiopia_fee'), ''), 'Ethiopia fee'),
  'sizes_col_global_fee', COALESCE(NULLIF(trim(value->>'sizes_col_global_fee'), ''), 'Global fee'),
  'sizes_col_max_players', COALESCE(NULLIF(trim(value->>'sizes_col_max_players'), ''), 'Max players'),
  'sizes_col_formats', COALESCE(NULLIF(trim(value->>'sizes_col_formats'), ''), 'Formats'),
  'sizes_col_status', COALESCE(NULLIF(trim(value->>'sizes_col_status'), ''), 'Status'),
  'sizes_col_id', COALESCE(NULLIF(trim(value->>'sizes_col_id'), ''), 'Size id'),
  'sizes_col_label', COALESCE(NULLIF(trim(value->>'sizes_col_label'), ''), 'Label'),
  'sizes_add_action', COALESCE(NULLIF(trim(value->>'sizes_add_action'), ''), 'Add size'),
  'sizes_edit_action', COALESCE(NULLIF(trim(value->>'sizes_edit_action'), ''), 'Edit size'),
  'sizes_delete_action', COALESCE(NULLIF(trim(value->>'sizes_delete_action'), ''), 'Delete size'),
  'sizes_delete_confirm', COALESCE(
    NULLIF(trim(value->>'sizes_delete_confirm'), ''),
    'Delete this host size from the catalog? Cups that already use it are not changed.'
  ),
  'sizes_detail_title', COALESCE(NULLIF(trim(value->>'sizes_detail_title'), ''), 'Host size detail'),
  'sizes_empty', COALESCE(NULLIF(trim(value->>'sizes_empty'), ''), 'No host sizes match these filters'),
  'sizes_active_label', COALESCE(NULLIF(trim(value->>'sizes_active_label'), ''), 'Enabled'),
  'sizes_inactive_label', COALESCE(NULLIF(trim(value->>'sizes_inactive_label'), ''), 'Disabled'),
  'sizes_actions_label', COALESCE(NULLIF(trim(value->>'sizes_actions_label'), ''), 'Actions'),
  'sizes_dialog_close_label', COALESCE(NULLIF(trim(value->>'sizes_dialog_close_label'), ''), 'Close'),
  'sizes_cancel_action', COALESCE(NULLIF(trim(value->>'sizes_cancel_action'), ''), 'Cancel'),
  'sizes_save_action', COALESCE(NULLIF(trim(value->>'sizes_save_action'), ''), 'Save size'),
  'sizes_save_pending', COALESCE(NULLIF(trim(value->>'sizes_save_pending'), ''), 'Saving…'),
  'sizes_delete_pending', COALESCE(NULLIF(trim(value->>'sizes_delete_pending'), ''), 'Deleting…'),
  'sizes_status_pending', COALESCE(NULLIF(trim(value->>'sizes_status_pending'), ''), 'Updating…'),
  'sizes_toast_created', COALESCE(NULLIF(trim(value->>'sizes_toast_created'), ''), 'Host size created'),
  'sizes_toast_updated', COALESCE(NULLIF(trim(value->>'sizes_toast_updated'), ''), 'Host size updated'),
  'sizes_toast_deleted', COALESCE(NULLIF(trim(value->>'sizes_toast_deleted'), ''), 'Host size deleted'),
  'sizes_toast_failed', COALESCE(NULLIF(trim(value->>'sizes_toast_failed'), ''), 'Could not save host size'),
  'sizes_bulk_activate_action', COALESCE(NULLIF(trim(value->>'sizes_bulk_activate_action'), ''), 'Enable selected'),
  'sizes_bulk_deactivate_action', COALESCE(NULLIF(trim(value->>'sizes_bulk_deactivate_action'), ''), 'Disable selected'),
  'sizes_bulk_status_pending', COALESCE(NULLIF(trim(value->>'sizes_bulk_status_pending'), ''), 'Updating selection…'),
  'sizes_search_label', COALESCE(NULLIF(trim(value->>'sizes_search_label'), ''), 'Search sizes'),
  'sizes_search_placeholder', COALESCE(NULLIF(trim(value->>'sizes_search_placeholder'), ''), 'Size id or label'),
  'sizes_sort_order_label', COALESCE(NULLIF(trim(value->>'sizes_sort_order_label'), ''), 'Sort order'),
  'err_size_id_required', COALESCE(NULLIF(trim(value->>'err_size_id_required'), ''), 'Size id is required'),
  'err_size_id_exists', COALESCE(NULLIF(trim(value->>'err_size_id_exists'), ''), 'That size id already exists'),
  'err_size_not_found', COALESCE(NULLIF(trim(value->>'err_size_not_found'), ''), 'Host size not found'),
  'err_host_fee_dual_required', COALESCE(
    NULLIF(trim(value->>'err_host_fee_dual_required'), ''),
    'Ethiopia and global host fee amounts are required'
  )
),
updated_at = NOW()
WHERE key = 'events_admin_chrome';
