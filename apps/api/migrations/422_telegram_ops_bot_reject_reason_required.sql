-- Bot reject must carry a non-empty reason (query param); chrome error for fail-closed UX.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'err_reject_reason_required',
  COALESCE(NULLIF(trim(value->>'err_reject_reason_required'), ''), 'Rejection reason is required.')
),
    updated_at = NOW()
WHERE key = 'telegram_ops_bot';
