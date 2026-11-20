-- Admin hosted list thumb: Official-parity prize → gallery (not branding logo).
-- Heal leftover mig 321 "Event logo" caption now that mig 533 added prize media.
-- Branding logo/sponsor stay on the detail proof block only.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'thumbnail_label', COALESCE(
    NULLIF(trim(value->>'detail_prize_image_label'), ''),
    'Prize image'
  )
),
updated_at = NOW()
WHERE key = 'events_admin_chrome'
  AND (
    NULLIF(trim(value->>'thumbnail_label'), '') IS NULL
    OR lower(trim(value->>'thumbnail_label')) IN ('event logo', 'logo')
    OR (
      NULLIF(trim(value->>'detail_logo_label'), '') IS NOT NULL
      AND trim(value->>'thumbnail_label') = trim(value->>'detail_logo_label')
    )
  );
