-- Viewport creatives (IAB-style aspect slots): desktop 16:9, tablet 4:3, mobile 9:16.
-- Soft-fill chrome keys only (never overwrite ops edits on migrateonly re-apply).
-- Slot backfill from legacy is one-shot via platform_settings flag (see below).

ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS creative_desktop_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS creative_tablet_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS creative_mobile_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS youtube_video_id_desktop TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS youtube_video_id_tablet TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS youtube_video_id_mobile TEXT NOT NULL DEFAULT '';

-- One-shot legacy → slot backfill (skip after first successful run).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM platform_settings
    WHERE key = 'ad_viewport_slot_backfill_v1' AND value = 'true'::jsonb
  ) THEN
    UPDATE ad_campaigns
    SET
      creative_desktop_url = CASE
        WHEN TRIM(COALESCE(creative_desktop_url, '')) = '' AND TRIM(COALESCE(creative_url, '')) <> ''
          THEN TRIM(creative_url)
        ELSE creative_desktop_url
      END,
      creative_tablet_url = CASE
        WHEN TRIM(COALESCE(creative_tablet_url, '')) = '' AND TRIM(COALESCE(creative_url, '')) <> ''
          THEN TRIM(creative_url)
        ELSE creative_tablet_url
      END,
      creative_mobile_url = CASE
        WHEN TRIM(COALESCE(creative_mobile_url, '')) = '' AND TRIM(COALESCE(creative_url, '')) <> ''
          THEN TRIM(creative_url)
        ELSE creative_mobile_url
      END,
      youtube_video_id_desktop = CASE
        WHEN TRIM(COALESCE(youtube_video_id_desktop, '')) = '' AND TRIM(COALESCE(youtube_video_id, '')) <> ''
          THEN TRIM(youtube_video_id)
        ELSE youtube_video_id_desktop
      END,
      youtube_video_id_tablet = CASE
        WHEN TRIM(COALESCE(youtube_video_id_tablet, '')) = '' AND TRIM(COALESCE(youtube_video_id, '')) <> ''
          THEN TRIM(youtube_video_id)
        ELSE youtube_video_id_tablet
      END,
      youtube_video_id_mobile = CASE
        WHEN TRIM(COALESCE(youtube_video_id_mobile, '')) = '' AND TRIM(COALESCE(youtube_video_id, '')) <> ''
          THEN TRIM(youtube_video_id)
        ELSE youtube_video_id_mobile
      END,
      updated_at = NOW()
    WHERE TRIM(COALESCE(creative_url, '')) <> ''
       OR TRIM(COALESCE(youtube_video_id, '')) <> '';

    INSERT INTO platform_settings (key, value, updated_at)
    VALUES ('ad_viewport_slot_backfill_v1', 'true'::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = 'true'::jsonb, updated_at = NOW();
  END IF;
END $$;

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || (
  SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
  FROM (
    VALUES
      ('viewport_creatives_title', to_jsonb('Device creatives'::text)),
      ('viewport_creatives_blurb', to_jsonb('Upload image or video for each screen. You can fill all three or only the sizes you need. Players see the matching size; other sizes fall back automatically.'::text)),
      ('viewport_desktop_label', to_jsonb('Desktop'::text)),
      ('viewport_tablet_label', to_jsonb('Tablet'::text)),
      ('viewport_mobile_label', to_jsonb('Mobile'::text)),
      ('viewport_desktop_ratio_label', to_jsonb('16:9'::text)),
      ('viewport_tablet_ratio_label', to_jsonb('4:3'::text)),
      ('viewport_mobile_ratio_label', to_jsonb('9:16'::text)),
      ('viewport_desktop_hint', to_jsonb('Landscape 16:9 for large screens'::text)),
      ('viewport_tablet_hint', to_jsonb('4:3 for tablet screens'::text)),
      ('viewport_mobile_hint', to_jsonb('Portrait 9:16 for phones'::text)),
      ('viewport_upload_image_action', to_jsonb('Upload image'::text)),
      ('viewport_upload_video_action', to_jsonb('Upload video'::text)),
      ('viewport_replace_image_action', to_jsonb('Replace image'::text)),
      ('viewport_clear_action', to_jsonb('Remove'::text)),
      ('viewport_preview_empty', to_jsonb('No creative yet'::text)),
      ('viewport_optional_badge', to_jsonb('Optional'::text)),
      ('viewport_video_badge', to_jsonb('Video'::text)),
      ('viewport_image_badge', to_jsonb('Image'::text)),
      ('viewport_ratio_mismatch', to_jsonb('Image aspect ratio does not match this slot. Use the shown ratio.'::text)),
      ('viewport_slot_invalid', to_jsonb('Unknown creative slot'::text)),
      ('viewport_breakpoint_mobile_max', to_jsonb('767'::text)),
      ('viewport_breakpoint_tablet_max', to_jsonb('1023'::text)),
      ('err_viewport_slot_required', to_jsonb('Creative slot is required'::text)),
      ('err_viewport_ratio_mismatch', to_jsonb('Image must match the required aspect ratio for this screen'::text)),
      ('err_viewport_video_required', to_jsonb('Video file is required'::text)),
      ('err_viewport_video_type', to_jsonb('Video must be MP4, MOV, or WebM'::text)),
      ('err_viewport_video_too_large', to_jsonb('Video is too large'::text)),
      ('toast_viewport_creative_saved', to_jsonb('Device creative saved'::text)),
      ('toast_viewport_creative_cleared', to_jsonb('Device creative removed'::text)),
      ('toast_viewport_video_queued', to_jsonb('Video upload queued'::text)),
      ('viewport_aspect_tolerance', to_jsonb('0.08'::text)),
      ('viewport_max_video_bytes', to_jsonb('104857600'::text))
  ) AS t(k, v)
  WHERE NOT (COALESCE(platform_settings.value, '{}'::jsonb) ? k)
),
    updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
