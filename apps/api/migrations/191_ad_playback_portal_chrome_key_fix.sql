-- Fix: 189/190 wrote ads publisher close/payout chrome under wrong keys
-- ('ad_playback_chrome' / 'ad_playback'). Runtime serves schedule_chrome from
-- platform_settings.key = 'ad_runtime_chrome' (see AdsAPI.Playback).
-- Idempotent merge onto the live key.

UPDATE platform_settings
SET value = value || '{
  "close_campaign_action": "Close campaign",
  "reopen_campaign_action": "Reopen campaign",
  "cannot_reopen_campaign_blurb": "This campaign was auto-closed and cannot be reopened.",
  "toast_campaign_closed": "Campaign closed",
  "toast_campaign_reopened": "Campaign reopened",
  "toast_campaign_close_failed": "Could not close campaign",
  "toast_campaign_reopen_failed": "Could not reopen campaign",
  "auto_closed_badge": "Auto-closed",
  "ends_at_label": "End date (optional)",
  "ends_at_blurb": "When set, the campaign auto-closes after this time.",
  "ph_ends_at": "Campaign end date",
  "publisher_portal_wallet_href": "/ads/wallet",
  "publisher_portal_receipts_href": "/ads/receipts",
  "publisher_portal_transactions_href": "/ads/transactions",
  "publisher_portal_payout_label": "Payout",
  "publisher_portal_payout_href": "/ads/wallet",
  "publisher_portal_payout_blurb": "Cash out from your publisher wallet using the same payout flow as players."
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
