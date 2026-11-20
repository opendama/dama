-- Wallet / cash CRUD pending labels (Trim Button isLoading + pendingLabel parity).
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'payout_save_pending', COALESCE(value->>'payout_save_pending', 'Saving…'),
    'payout_request_pending', COALESCE(value->>'payout_request_pending', 'Submitting…'),
    'top_up_pending', COALESCE(value->>'top_up_pending', 'Starting checkout…'),
    'submit_receipt_pending', COALESCE(value->>'submit_receipt_pending', 'Submitting…'),
    'detect_location_pending', COALESCE(value->>'detect_location_pending', 'Detecting…'),
    'refresh_pending', COALESCE(value->>'refresh_pending', 'Refreshing…')
  )
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'age_gate_submit_pending', COALESCE(value->>'age_gate_submit_pending', 'Saving…'),
    'phone_kyc_send_pending', COALESCE(value->>'phone_kyc_send_pending', 'Sending…'),
    'phone_kyc_verify_pending', COALESCE(value->>'phone_kyc_verify_pending', 'Verifying…'),
    'doc_kyc_submit_pending', COALESCE(value->>'doc_kyc_submit_pending', 'Submitting…')
  )
WHERE key = 'cash_rmg_chrome';
