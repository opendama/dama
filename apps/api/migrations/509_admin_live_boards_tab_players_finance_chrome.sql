-- 509: Live boards as tournament section tab; checked-in start copy;
-- admin cup players chrome; Sales financial overview chrome + nav.
-- Idempotent.

-- ---------------------------------------------------------------------------
-- Organizer start: classic cups need checked-in approved seats (not merely approved).
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'not_enough_players',
  'Not enough checked-in players to start. Approved players must check in first.'
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'not_enough_players',
  COALESCE(
    NULLIF(trim(value->>'not_enough_players'), ''),
    'Not enough checked-in players to start. Approved players must check in first.'
  )
),
updated_at = NOW()
WHERE key = 'tournament_chrome';

-- ---------------------------------------------------------------------------
-- Tournament admin: Live boards top-level tab label
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'tab_live_boards_label',
  COALESCE(NULLIF(trim(value->>'tab_live_boards_label'), ''), 'Live boards')
),
updated_at = NOW()
WHERE key = 'tournament_chrome';

-- ---------------------------------------------------------------------------
-- Events admin: players roster labels on hosted detail
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'detail_players_section_title',
  COALESCE(NULLIF(trim(value->>'detail_players_section_title'), ''), 'Players'),
  'detail_players_section_blurb',
  COALESCE(
    NULLIF(trim(value->>'detail_players_section_blurb'), ''),
    'Full roster for this cup: status, check-in, placement, and fees.'
  ),
  'detail_players_col_user',
  COALESCE(NULLIF(trim(value->>'detail_players_col_user'), ''), 'Player'),
  'detail_players_col_status',
  COALESCE(NULLIF(trim(value->>'detail_players_col_status'), ''), 'Status'),
  'detail_players_col_checked_in',
  COALESCE(NULLIF(trim(value->>'detail_players_col_checked_in'), ''), 'Checked in'),
  'detail_players_col_placement',
  COALESCE(NULLIF(trim(value->>'detail_players_col_placement'), ''), 'Place'),
  'detail_players_col_rating',
  COALESCE(NULLIF(trim(value->>'detail_players_col_rating'), ''), 'Rating'),
  'detail_players_empty',
  COALESCE(NULLIF(trim(value->>'detail_players_empty'), ''), 'No players yet'),
  'detail_players_open_user',
  COALESCE(NULLIF(trim(value->>'detail_players_open_user'), ''), 'Open user')
),
updated_at = NOW()
WHERE key = 'events_admin_chrome';

-- ---------------------------------------------------------------------------
-- Tournament admin: players roster labels on cup detail
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'detail_players_section_title',
  COALESCE(NULLIF(trim(value->>'detail_players_section_title'), ''), 'Players'),
  'detail_players_section_blurb',
  COALESCE(
    NULLIF(trim(value->>'detail_players_section_blurb'), ''),
    'Full roster for this official cup: check-in and placement.'
  ),
  'detail_players_col_user',
  COALESCE(NULLIF(trim(value->>'detail_players_col_user'), ''), 'Player'),
  'detail_players_col_checked_in',
  COALESCE(NULLIF(trim(value->>'detail_players_col_checked_in'), ''), 'Checked in'),
  'detail_players_col_placement',
  COALESCE(NULLIF(trim(value->>'detail_players_col_placement'), ''), 'Place'),
  'detail_players_empty',
  COALESCE(NULLIF(trim(value->>'detail_players_empty'), ''), 'No players yet'),
  'detail_players_open_user',
  COALESCE(NULLIF(trim(value->>'detail_players_open_user'), ''), 'Open user'),
  'detail_yes',
  COALESCE(NULLIF(trim(value->>'detail_yes'), ''), 'Yes'),
  'detail_no',
  COALESCE(NULLIF(trim(value->>'detail_no'), ''), 'No')
),
updated_at = NOW()
WHERE key = 'tournament_chrome';

-- ---------------------------------------------------------------------------
-- Organizer manage players: checked-in badge (optional key; soft-fill)
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'players_checked_in_label',
  COALESCE(NULLIF(trim(value->>'players_checked_in_label'), ''), 'Checked in')
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

-- ---------------------------------------------------------------------------
-- Admin console chrome: Financial overview (Sales and revenue)
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'overview_page_title',
    COALESCE(NULLIF(trim(value->'payments'->>'overview_page_title'), ''), 'Financial overview'),
    'overview_page_blurb',
    COALESCE(
      NULLIF(trim(value->'payments'->>'overview_page_blurb'), ''),
      'Platform money queues, wallet volume, and Sales surfaces in one place.'
    ),
    'overview_section_queues_title',
    COALESCE(NULLIF(trim(value->'payments'->>'overview_section_queues_title'), ''), 'Ops queues'),
    'overview_section_volume_title',
    COALESCE(NULLIF(trim(value->'payments'->>'overview_section_volume_title'), ''), 'Volume'),
    'overview_section_links_title',
    COALESCE(NULLIF(trim(value->'payments'->>'overview_section_links_title'), ''), 'Sales and revenue'),
    'overview_kpi_pending_receipts',
    COALESCE(NULLIF(trim(value->'payments'->>'overview_kpi_pending_receipts'), ''), 'Pending receipts'),
    'overview_kpi_pending_payouts',
    COALESCE(NULLIF(trim(value->'payments'->>'overview_kpi_pending_payouts'), ''), 'Pending payouts'),
    'overview_kpi_pending_kyc',
    COALESCE(NULLIF(trim(value->'payments'->>'overview_kpi_pending_kyc'), ''), 'Pending document KYC'),
    'overview_kpi_topup_volume',
    COALESCE(NULLIF(trim(value->'payments'->>'overview_kpi_topup_volume'), ''), 'Top-up volume (7d)'),
    'overview_kpi_payout_volume',
    COALESCE(NULLIF(trim(value->'payments'->>'overview_kpi_payout_volume'), ''), 'Payout volume (7d)'),
    'overview_kpi_host_fee_volume',
    COALESCE(NULLIF(trim(value->'payments'->>'overview_kpi_host_fee_volume'), ''), 'Host fee revenue (7d)'),
    'overview_kpi_entry_commission',
    COALESCE(NULLIF(trim(value->'payments'->>'overview_kpi_entry_commission'), ''), 'Entry commission (7d)'),
    'overview_kpi_wallet_balances',
    COALESCE(NULLIF(trim(value->'payments'->>'overview_kpi_wallet_balances'), ''), 'Wallet balances'),
    'overview_empty_value',
    COALESCE(NULLIF(trim(value->'payments'->>'overview_empty_value'), ''), '-'),
    'overview_period_note',
    COALESCE(
      NULLIF(trim(value->'payments'->>'overview_period_note'), ''),
      'Volume KPIs use the last 7 days in each currency.'
    )
  ),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

-- ---------------------------------------------------------------------------
-- console_nav: Financial overview leaf under Sales and revenue
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
          WHERE it->>'id' IN ('pay-receipts', 'pay-payouts', 'pay-transactions', 'pay-currency', 'pay-geo', 'pay-kyc')
             OR it->>'href' IN (
               '/payments/receipts',
               '/payments/payouts',
               '/payments/transactions',
               '/payments/currency',
               '/payments/geo',
               '/payments/kyc'
             )
        ) THEN
          jsonb_set(
            sec,
            '{items}',
            (
              SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
              FROM (
                SELECT jsonb_build_object(
                  'id', 'pay-overview',
                  'label', 'Financial overview',
                  'href', '/payments/overview'
                ) AS item
                WHERE NOT EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements(COALESCE(sec->'items', '[]'::jsonb)) AS existing
                  WHERE existing->>'id' = 'pay-overview'
                     OR existing->>'href' = '/payments/overview'
                )
                UNION ALL
                SELECT item
                FROM jsonb_array_elements(COALESCE(sec->'items', '[]'::jsonb)) AS item
                WHERE item->>'id' IS DISTINCT FROM 'pay-overview'
                  AND item->>'href' IS DISTINCT FROM '/payments/overview'
              ) AS items(item)
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
      WHERE elem->>'href' IS DISTINCT FROM '/payments/overview'
      UNION ALL
      SELECT jsonb_build_object(
        'title', 'Financial overview',
        'href', '/payments/overview',
        'body', 'Platform money queues, wallet volume, and Sales surfaces.'
      )
    ) AS t(elem)
  )
),
updated_at = NOW()
WHERE key = 'console_nav';
