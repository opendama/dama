-- YouTube media pool: priority ordering, default 10 uploads/day,
-- soft chrome for admin full CRUD (update / delete / reorder / multipart test upload).
-- Soft-fill media_pool keys only (never overwrite ops edits on migrateonly re-apply).

ALTER TABLE youtube_channels
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- One-shot sort_order seed for rows still at 0 after first install.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM platform_settings
    WHERE key = 'youtube_channels_sort_order_seed_v1' AND value = 'true'::jsonb
  ) THEN
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
      FROM youtube_channels
    )
    UPDATE youtube_channels yc
    SET sort_order = ranked.rn,
        updated_at = NOW()
    FROM ranked
    WHERE yc.id = ranked.id
      AND yc.sort_order = 0;

    INSERT INTO platform_settings (key, value, updated_at)
    VALUES ('youtube_channels_sort_order_seed_v1', 'true'::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = 'true'::jsonb, updated_at = NOW();
  END IF;
END $$;

ALTER TABLE youtube_channels
  ALTER COLUMN daily_quota_limit SET DEFAULT 10;

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
