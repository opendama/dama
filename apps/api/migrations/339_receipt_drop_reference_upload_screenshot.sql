-- Manual receipt upload: drop Reference form chrome; rename image label to Upload screenshot.
-- Keeps payment_receipts.reference column for historical rows (new submits store empty).
UPDATE platform_settings
SET value = (value - 'reference_label')
  || jsonb_build_object(
    'receipt_image_label', 'Upload screenshot'
  ),
  updated_at = NOW()
WHERE key = 'wallet_chrome';
