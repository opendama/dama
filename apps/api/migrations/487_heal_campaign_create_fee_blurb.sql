-- Keep create-fee blurb distinct from daily spend cap copy (force-heal legacy one-liners).

UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'campaign_create_fee_blurb', CASE
      WHEN NULLIF(trim(value->>'campaign_create_fee_blurb'), '') IS NULL THEN
        'One-time create fee charged from your wallet when you create the campaign. This is not the daily spend cap.'
      WHEN lower(trim(value->>'campaign_create_fee_blurb')) IN (
        'pay once from your wallet to publish this campaign. no pay, no campaign.',
        'pay once from your wallet to publish this campaign. no pay, no campaign'
      ) THEN
        'One-time create fee charged from your wallet when you create the campaign. This is not the daily spend cap.'
      ELSE trim(value->>'campaign_create_fee_blurb')
    END
  ),
  updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
