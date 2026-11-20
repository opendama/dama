-- Organizer results tab: share winners/result card (same chrome key as player join surface).
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'share_result_action',
    COALESCE(
      NULLIF(trim(value->>'share_result_action'), ''),
      'Share result card'
    )
  ),
  updated_at = NOW()
WHERE key = 'events_organizer_chrome';
