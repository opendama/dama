-- Phase C polish: camera/gallery picker labels for identity KYC (DB chrome only).

UPDATE platform_settings
SET value = value || '{
  "doc_kyc_camera_action": "Take photo",
  "doc_kyc_gallery_action": "Choose from gallery"
}'::jsonb,
updated_at = NOW()
WHERE key = 'cash_rmg_chrome'
  AND COALESCE(value->>'doc_kyc_camera_action', '') = '';
