-- Admin receipts list: View details modal chrome (transactions/payouts parity).
-- Labels for every backend receipt field shown in the ops detail dialog.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'receipt_detail_title', COALESCE(NULLIF(trim(value->'payments'->>'receipt_detail_title'), ''), 'Payment receipt'),
    'receipt_detail_close', COALESCE(NULLIF(trim(value->'payments'->>'receipt_detail_close'), ''), 'Close'),
    'receipt_view_detail', COALESCE(NULLIF(trim(value->'payments'->>'receipt_view_detail'), ''), 'View details'),
    'receipt_email_label', COALESCE(NULLIF(trim(value->'payments'->>'receipt_email_label'), ''), 'Email'),
    'receipt_reviewed_at_label', COALESCE(NULLIF(trim(value->'payments'->>'receipt_reviewed_at_label'), ''), 'Reviewed'),
    'receipt_intent_id_label', COALESCE(NULLIF(trim(value->'payments'->>'receipt_intent_id_label'), ''), 'Intent ID'),
    'receipt_provider_label', COALESCE(NULLIF(trim(value->'payments'->>'receipt_provider_label'), ''), 'Channel'),
    'receipt_proof_label', COALESCE(NULLIF(trim(value->'payments'->>'receipt_proof_label'), ''), 'Transfer proof'),
    'receipt_pdf_label', COALESCE(NULLIF(trim(value->'payments'->>'receipt_pdf_label'), ''), 'PDF'),
    'receipt_open_document_action', COALESCE(NULLIF(trim(value->'payments'->>'receipt_open_document_action'), ''), 'Open document'),
    'detail_id_label', COALESCE(NULLIF(trim(value->'payments'->>'detail_id_label'), ''), 'ID'),
    'detail_user_id_label', COALESCE(NULLIF(trim(value->'payments'->>'detail_user_id_label'), ''), 'User ID')
  ),
  true
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';

-- Player wallet receipts list detail modal (same field labels, fail-closed chrome).
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'list_detail_title', COALESCE(NULLIF(trim(value->>'list_detail_title'), ''), 'Receipt details'),
  'dialog_close_label', COALESCE(NULLIF(trim(value->>'dialog_close_label'), ''), 'Close'),
  'receipt_view_detail', COALESCE(NULLIF(trim(value->>'receipt_view_detail'), ''), 'View details'),
  'receipt_reviewed_at_label', COALESCE(NULLIF(trim(value->>'receipt_reviewed_at_label'), ''), 'Reviewed'),
  'receipt_intent_id_label', COALESCE(NULLIF(trim(value->>'receipt_intent_id_label'), ''), 'Intent ID'),
  'receipt_provider_label', COALESCE(NULLIF(trim(value->>'receipt_provider_label'), ''), 'Channel'),
  'receipt_proof_label', COALESCE(NULLIF(trim(value->>'receipt_proof_label'), ''), 'Transfer proof'),
  'receipt_open_document_action', COALESCE(NULLIF(trim(value->>'receipt_open_document_action'), ''), 'Open document'),
  'receipt_label_id', COALESCE(NULLIF(trim(value->>'receipt_label_id'), ''), 'Receipt ID')
),
  updated_at = NOW()
WHERE key = 'wallet_chrome';
