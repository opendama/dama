-- Player payout history: show admin review_note with DB chrome label (no client invent).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'payout_history_note_label',
  COALESCE(NULLIF(trim(value->>'payout_history_note_label'), ''), 'Review note')
),
    updated_at = NOW()
WHERE key = 'wallet_chrome';
