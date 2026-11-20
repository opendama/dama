-- Transactions: resume abandoned manual top-ups (awaiting_receipt) via Submit proof.
-- Heal-only. Links to existing Manual Transfer flow (same amount + optional intent_id).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'list_action_submit_receipt',
  COALESCE(NULLIF(trim(value->>'list_action_submit_receipt'), ''), 'Submit proof'),
  'list_awaiting_proof_blurb',
  COALESCE(
    NULLIF(trim(value->>'list_awaiting_proof_blurb'), ''),
    'Upload your transfer proof to finish this top-up.'
  ),
  'receipt_intent_unavailable',
  COALESCE(
    NULLIF(trim(value->>'receipt_intent_unavailable'), ''),
    'This top-up is no longer awaiting proof.'
  )
),
updated_at = NOW()
WHERE key = 'wallet_chrome';
