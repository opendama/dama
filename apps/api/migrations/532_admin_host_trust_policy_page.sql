-- Host trust policy: editable Sales leaf (OpsDataTable + tabs).
-- Moves chrome from Feature Flags read-only card to payments.host_trust_* page chrome.
-- Injects console_nav leaf after Document KYC.

-- ---------------------------------------------------------------------------
-- payments chrome: editable Host trust policy page
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || '{
    "host_trust_page_title": "Host trust policy",
    "host_trust_page_blurb": "Control paid organizer cup gates, open-cup caps, and reputation thresholds. Changes apply to every Community host.",
    "host_trust_tab_gates": "Gates",
    "host_trust_tab_caps": "Caps",
    "host_trust_tab_reputation": "Reputation",
    "host_trust_col_setting": "Setting",
    "host_trust_col_value": "Value",
    "host_trust_col_actions": "Actions",
    "host_trust_view_action": "View",
    "host_trust_edit_action": "Edit",
    "host_trust_detail_title": "Host trust setting",
    "host_trust_edit_title": "Edit host trust setting",
    "host_trust_dialog_close": "Close",
    "host_trust_cancel_action": "Cancel",
    "host_trust_save_action": "Save",
    "host_trust_save_pending": "Saving…",
    "host_trust_toast_saved": "Host trust policy saved",
    "host_trust_toast_failed": "Could not save host trust policy",
    "host_trust_save_invalid": "Check the values and try again",
    "host_trust_load_failed": "Could not load host trust policy",
    "host_trust_empty_value": "-",
    "host_trust_search_label": "Search",
    "host_trust_search_placeholder": "Search settings",
    "host_trust_list_page_size": "25",
    "host_trust_search_debounce_ms": "250",
    "host_trust_yes": "Yes",
    "host_trust_no": "No",
    "host_trust_phone_kyc_label": "Paid create requires phone KYC",
    "host_trust_phone_kyc_blurb": "When on, organizers must verify phone before creating a paid cup.",
    "host_trust_doc_kyc_label": "Guarantee requires document KYC",
    "host_trust_doc_kyc_blurb": "When on, organizers must verify government ID before promising a guaranteed prize floor.",
    "host_trust_cap_new_host_label": "Concurrent open paid cups (new host)",
    "host_trust_cap_new_host_blurb": "Max open paid cups while the host is still under the new-host threshold.",
    "host_trust_cap_phone_label": "Concurrent open paid cups (phone verified)",
    "host_trust_cap_phone_blurb": "Max open paid cups after the new-host threshold, with phone verified and no government ID.",
    "host_trust_cap_document_label": "Concurrent open paid cups (document verified)",
    "host_trust_cap_document_blurb": "Max open paid cups when government ID is verified.",
    "host_trust_settled_threshold_label": "New-host settled paid threshold",
    "host_trust_settled_threshold_blurb": "Finished paid cups required before the phone-verified open-cup cap applies.",
    "host_trust_rep_open_reports_label": "Reputation max open reports",
    "host_trust_rep_open_reports_blurb": "Block paid create when open reports reach this count. Set 0 to disable the reports gate.",
    "host_trust_rep_cancel_bps_label": "Reputation cancel rate (bps)",
    "host_trust_rep_cancel_bps_blurb": "Block paid create when cancel rate reaches this many basis points (7000 = 70%). Set 0 to disable the cancel-rate gate. Max 10000.",
    "host_trust_rep_cancel_sample_label": "Reputation cancel rate min sample",
    "host_trust_rep_cancel_sample_blurb": "Minimum finished + cancelled paid cups before the cancel-rate gate applies."
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

-- Keep legacy feature_flags.host_trust_policy_* keys if present so older API
-- binaries that still require them do not fail chrome until redeployed.
-- New admin UI no longer reads those keys (Sales → Host trust policy owns the page).

-- ---------------------------------------------------------------------------
-- console_nav: Host trust policy under Sales and revenue (after Document KYC)
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{sections}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(sec->'items', '[]'::jsonb)) AS it
          WHERE it->>'id' IN ('pay-receipts', 'pay-payouts', 'pay-transactions', 'pay-currency', 'pay-geo', 'pay-kyc', 'pay-overview')
             OR it->>'href' IN (
               '/payments/receipts',
               '/payments/payouts',
               '/payments/transactions',
               '/payments/currency',
               '/payments/geo',
               '/payments/kyc',
               '/payments/overview'
             )
        ) THEN
          jsonb_set(
            sec,
            '{items}',
            (
              SELECT COALESCE(jsonb_agg(item ORDER BY ord), '[]'::jsonb)
              FROM (
                SELECT
                  item,
                  CASE
                    WHEN item->>'id' = 'pay-overview' OR item->>'href' = '/payments/overview' THEN 10
                    WHEN item->>'id' = 'pay-currency' OR item->>'href' = '/payments/currency' THEN 20
                    WHEN item->>'id' = 'pay-geo' OR item->>'href' = '/payments/geo' THEN 30
                    WHEN item->>'id' = 'pay-kyc' OR item->>'href' = '/payments/kyc' THEN 40
                    WHEN item->>'id' = 'pay-host-trust' OR item->>'href' = '/payments/host-trust' THEN 45
                    WHEN item->>'id' = 'pay-payouts' OR item->>'href' = '/payments/payouts' THEN 50
                    WHEN item->>'id' = 'pay-receipts' OR item->>'href' = '/payments/receipts' THEN 60
                    WHEN item->>'id' = 'pay-transactions' OR item->>'href' = '/payments/transactions' THEN 70
                    WHEN item->>'id' = 'pay-telegram-ops' OR item->>'href' = '/payments/telegram-ops' THEN 80
                    ELSE 90
                  END AS ord
                FROM (
                  SELECT item
                  FROM jsonb_array_elements(COALESCE(sec->'items', '[]'::jsonb)) AS item
                  WHERE item->>'id' IS DISTINCT FROM 'pay-host-trust'
                    AND item->>'href' IS DISTINCT FROM '/payments/host-trust'
                  UNION ALL
                  SELECT jsonb_build_object(
                    'id', 'pay-host-trust',
                    'label', 'Host trust policy',
                    'href', '/payments/host-trust'
                  )
                  WHERE NOT EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(COALESCE(sec->'items', '[]'::jsonb)) AS existing
                    WHERE existing->>'id' = 'pay-host-trust'
                       OR existing->>'href' = '/payments/host-trust'
                  )
                ) AS merged(item)
              ) AS ordered(item, ord)
            )
          )
        ELSE sec
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'sections', '[]'::jsonb)) AS sec
  )
),
updated_at = NOW()
WHERE key = 'console_nav';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{modules}',
  (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM (
      SELECT elem
      FROM jsonb_array_elements(COALESCE(value->'modules', '[]'::jsonb)) AS elem
      WHERE elem->>'href' IS DISTINCT FROM '/payments/host-trust'
      UNION ALL
      SELECT jsonb_build_object(
        'title', 'Host trust policy',
        'href', '/payments/host-trust',
        'body', 'Edit paid-host gates, open-cup caps, and reputation thresholds.'
      )
    ) AS t(elem)
  )
),
updated_at = NOW()
WHERE key = 'console_nav';
