-- Organizer events list: dedicated "all statuses" label (ads schedule_chrome parity)
-- + public career-rated disclosure on create (same copy as player chrome).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "filter_status_all": "All statuses",
  "public_rated_on_blurb": "Wins and losses in this public cup count toward career XP, W-L, and rating.",
  "public_rated_off_blurb": "Cup matches are for the bracket only. Career rating stays unchanged."
}'::jsonb,
    updated_at = NOW()
WHERE key = 'events_organizer_chrome';

-- Wallet/receipt list status labels (no capitalize invent from raw codes).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "list_status_posted": "Posted",
  "list_status_pending": "Pending",
  "list_status_approved": "Approved",
  "list_status_rejected": "Rejected"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'wallet_chrome';
