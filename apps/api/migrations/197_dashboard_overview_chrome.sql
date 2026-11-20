-- Player portal overview: remove client invent for KPI/table/action labels (DB-only).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "dashboard_profile_action": "Profile",
  "dashboard_profile_href": "/profile",
  "dashboard_play_action": "Play",
  "dashboard_play_href": "/",
  "dashboard_win_rate_label": "Win rate",
  "dashboard_matches_suffix": "matches",
  "dashboard_recent_results_title": "Recent results",
  "dashboard_transactions_action": "Transactions",
  "dashboard_transactions_href": "/transactions",
  "dashboard_find_match_action": "Find a match",
  "dashboard_wallet_href": "/wallet",
  "dashboard_col_result": "Result",
  "dashboard_col_mode": "Mode",
  "dashboard_col_moves": "Moves",
  "dashboard_col_date": "Date"
}'::jsonb,
updated_at = NOW()
WHERE key = 'client_nav';
