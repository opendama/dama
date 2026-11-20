-- Telegram ops bot: remaining operator strings must be DB-driven (no bot/API English hardcodes).

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'err_not_allowed', COALESCE(NULLIF(trim(value->>'err_not_allowed'), ''), 'Not allowed'),
  'err_bad_callback', COALESCE(NULLIF(trim(value->>'err_bad_callback'), ''), 'Bad callback'),
  'user_fallback_template', COALESCE(NULLIF(trim(value->>'user_fallback_template'), ''), 'User {user_id}'),
  'note_approved_by_template', COALESCE(NULLIF(trim(value->>'note_approved_by_template'), ''), 'Approved by telegram admin {telegram_id}'),
  'note_paid_by_template', COALESCE(NULLIF(trim(value->>'note_paid_by_template'), ''), 'Marked paid by telegram admin {telegram_id}'),
  'review_note_approved_prefix', COALESCE(NULLIF(trim(value->>'review_note_approved_prefix'), ''), 'approved via Telegram ops bot'),
  'review_note_rejected_prefix', COALESCE(NULLIF(trim(value->>'review_note_rejected_prefix'), ''), 'rejected via Telegram ops bot'),
  'review_note_paid_prefix', COALESCE(NULLIF(trim(value->>'review_note_paid_prefix'), ''), 'paid via Telegram ops bot'),
  'review_note_telegram_id_template', COALESCE(NULLIF(trim(value->>'review_note_telegram_id_template'), ''), 'telegram_admin_id={telegram_id}'),
  'review_note_reason_template', COALESCE(NULLIF(trim(value->>'review_note_reason_template'), ''), 'reason={reason}'),
  'review_note_joiner', COALESCE(NULLIF(trim(value->>'review_note_joiner'), ''), ' | ')
),
    updated_at = NOW()
WHERE key = 'telegram_ops_bot';
