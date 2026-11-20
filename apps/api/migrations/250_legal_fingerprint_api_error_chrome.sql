-- Legal doc + fingerprint API errors from DB (no invent English).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "err_doc_not_found": "Document not found",
  "err_content_unavailable": "Legal content unavailable"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'legal_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "err_fingerprint_required": "Fingerprint required",
  "err_fingerprint_save_failed": "Unable to save device",
  "err_fingerprint_list_failed": "Unable to list devices"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'auth_providers';
