-- Publisher campaign title edit (parity with hosted-event title PATCH).
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'save_action',
    COALESCE(NULLIF(trim(value->>'save_action'), ''), 'Save'),
    'toast_campaign_title_saved',
    COALESCE(NULLIF(trim(value->>'toast_campaign_title_saved'), ''), 'Campaign title saved'),
    'patch_title_locked',
    COALESCE(
      NULLIF(trim(value->>'patch_title_locked'), ''),
      'Title can only change while the campaign is open'
    )
  ),
  updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
