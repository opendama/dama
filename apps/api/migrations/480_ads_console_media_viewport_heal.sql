-- Soft-heal only: fill missing viewport/media-pool chrome keys without overwriting ops edits.
-- Add console media + auto-closed media gate error chrome.
-- Do NOT re-backfill creative slot columns (that was a one-time 478 concern).

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
      ('err_campaign_auto_closed', to_jsonb('This campaign was auto-closed and media can no longer be changed'::text)),
      ('clear_legacy_video_action', to_jsonb('Remove campaign video'::text)),
      ('toast_legacy_video_cleared', to_jsonb('Campaign video removed'::text))
  ) AS t(k, v)
  WHERE NOT (COALESCE(platform_settings.value, '{}'::jsonb) ? k)
),
    updated_at = NOW()
WHERE key = 'ad_runtime_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{media_pool}',
  COALESCE(value->'media_pool', '{}'::jsonb) || (
    SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
    FROM (
      VALUES
        ('default_daily_quota', to_jsonb('10'::text)),
        ('quota_hint', to_jsonb('YouTube practical daily upload cap is about 10 videos per channel. Add multiple channels so uploads fail over automatically.'::text)),
        ('edit_channel_action', to_jsonb('Edit channel'::text)),
        ('delete_channel_action', to_jsonb('Delete channel'::text)),
        ('delete_channel_confirm', to_jsonb('Delete this YouTube channel from the pool? Active campaigns keep existing video IDs.'::text)),
        ('save_channel_action', to_jsonb('Save channel'::text)),
        ('sort_order_label', to_jsonb('Failover order'::text)),
        ('sort_order_hint', to_jsonb('Lower numbers are tried first when uploading.'::text)),
        ('toast_channel_updated', to_jsonb('Channel saved'::text)),
        ('toast_channel_deleted', to_jsonb('Channel deleted'::text)),
        ('toast_channel_update_failed', to_jsonb('Could not save channel'::text)),
        ('toast_channel_delete_failed', to_jsonb('Could not delete channel'::text)),
        ('credentials_optional_blurb', to_jsonb('Leave credential fields blank to keep existing secrets.'::text)),
        ('upload_file_label', to_jsonb('Video file'::text)),
        ('upload_file_hint', to_jsonb('MP4, MOV, or WebM. Uploads try the next healthy channel when quota or auth fails.'::text)),
        ('err_channel_not_found', to_jsonb('Channel not found'::text)),
        ('err_channel_update_failed', to_jsonb('Unable to update channel'::text)),
        ('err_channel_delete_failed', to_jsonb('Unable to delete channel'::text)),
        ('err_quota_invalid', to_jsonb('Daily quota must be a whole number of 1 or more'::text)),
        ('err_sort_order_invalid', to_jsonb('Failover order must be a whole number of 0 or more'::text)),
        ('err_upload_file_required', to_jsonb('Video file is required'::text)),
        ('err_upload_file_type', to_jsonb('Video must be MP4, MOV, or WebM'::text)),
        ('err_upload_file_too_large', to_jsonb('Video is too large'::text)),
        ('err_invalid_json', to_jsonb('Invalid JSON'::text)),
        ('err_register_failed', to_jsonb('Unable to register channel'::text)),
        ('err_upload_failed', to_jsonb('Unable to upload video'::text)),
        ('err_upload_queue_failed', to_jsonb('Unable to queue upload'::text)),
        ('err_read_failed', to_jsonb('Unable to read file'::text)),
        ('default_upload_title', to_jsonb('dama ad'::text))
    ) AS t(k, v)
    WHERE NOT (COALESCE(platform_settings.value->'media_pool', '{}'::jsonb) ? k)
  ),
  true
),
    updated_at = NOW()
WHERE key = 'admin_console_chrome';
