-- Clarify Settle prizes when this cup's wallets were already credited.
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'settle_prizes_already_settled', COALESCE(
      NULLIF(trim(value->>'settle_prizes_already_settled'), ''),
      'Prizes for this cup are already settled to wallets.'
    )
  ),
  updated_at = NOW()
WHERE key = 'tournament_chrome';
