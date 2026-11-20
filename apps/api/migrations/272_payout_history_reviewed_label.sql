-- Player payout history: show reviewed_at with DB chrome label when present.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'payout_history_reviewed_label',
  COALESCE(NULLIF(trim(value->>'payout_history_reviewed_label'), ''), 'Reviewed')
),
    updated_at = NOW()
WHERE key = 'wallet_chrome';
