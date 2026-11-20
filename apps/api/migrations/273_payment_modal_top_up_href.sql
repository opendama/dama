-- Payment enroll modal: top-up deep link from DB (no client invent of /wallet).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'top_up_href',
  COALESCE(NULLIF(trim(value->>'top_up_href'), ''), '/wallet')
),
    updated_at = NOW()
WHERE key = 'payment_modal_chrome';
