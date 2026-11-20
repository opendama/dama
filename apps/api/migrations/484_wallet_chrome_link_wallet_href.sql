-- Fail-closed wallet sibling href for Manual Transfer page (no client path invent).

UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'link_wallet_href', COALESCE(NULLIF(trim(value->>'link_wallet_href'), ''), '/wallet')
  ),
  updated_at = NOW()
WHERE key = 'wallet_chrome';
