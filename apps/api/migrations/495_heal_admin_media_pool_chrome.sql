-- Heal admin_console_chrome.media_pool keys required by AdminConsoleChrome
-- fail-closed (YouTube channel CRUD / upload copy from 479). Soft-fill only when
-- missing or blank so admin edits survive re-apply.
-- Client SECTION_KEYS include these; API previously returned 200 without them,
-- so the admin app rejected chrome and rendered empty fail-closed pages.

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{media_pool}',
  COALESCE(value->'media_pool', '{}'::jsonb) || jsonb_build_object(
    'default_daily_quota', COALESCE(
      NULLIF(trim(value->'media_pool'->>'default_daily_quota'), ''),
      '10'
    ),
    'quota_hint', COALESCE(
      NULLIF(trim(value->'media_pool'->>'quota_hint'), ''),
      'YouTube practical daily upload cap is about 10 videos per channel. Add multiple channels so uploads fail over automatically.'
    ),
    'edit_channel_action', COALESCE(
      NULLIF(trim(value->'media_pool'->>'edit_channel_action'), ''),
      'Edit channel'
    ),
    'delete_channel_action', COALESCE(
      NULLIF(trim(value->'media_pool'->>'delete_channel_action'), ''),
      'Delete channel'
    ),
    'delete_channel_confirm', COALESCE(
      NULLIF(trim(value->'media_pool'->>'delete_channel_confirm'), ''),
      'Delete this YouTube channel from the pool? Active campaigns keep existing video IDs.'
    ),
    'save_channel_action', COALESCE(
      NULLIF(trim(value->'media_pool'->>'save_channel_action'), ''),
      'Save channel'
    ),
    'sort_order_label', COALESCE(
      NULLIF(trim(value->'media_pool'->>'sort_order_label'), ''),
      'Failover order'
    ),
    'sort_order_hint', COALESCE(
      NULLIF(trim(value->'media_pool'->>'sort_order_hint'), ''),
      'Lower numbers are tried first when uploading.'
    ),
    'toast_channel_updated', COALESCE(
      NULLIF(trim(value->'media_pool'->>'toast_channel_updated'), ''),
      'Channel saved'
    ),
    'toast_channel_deleted', COALESCE(
      NULLIF(trim(value->'media_pool'->>'toast_channel_deleted'), ''),
      'Channel deleted'
    ),
    'toast_channel_update_failed', COALESCE(
      NULLIF(trim(value->'media_pool'->>'toast_channel_update_failed'), ''),
      'Could not save channel'
    ),
    'toast_channel_delete_failed', COALESCE(
      NULLIF(trim(value->'media_pool'->>'toast_channel_delete_failed'), ''),
      'Could not delete channel'
    ),
    'credentials_optional_blurb', COALESCE(
      NULLIF(trim(value->'media_pool'->>'credentials_optional_blurb'), ''),
      'Leave credential fields blank to keep existing secrets.'
    ),
    'upload_file_label', COALESCE(
      NULLIF(trim(value->'media_pool'->>'upload_file_label'), ''),
      'Video file'
    ),
    'upload_file_hint', COALESCE(
      NULLIF(trim(value->'media_pool'->>'upload_file_hint'), ''),
      'MP4, MOV, or WebM. Uploads try the next healthy channel when quota or auth fails.'
    ),
    'err_channel_not_found', COALESCE(
      NULLIF(trim(value->'media_pool'->>'err_channel_not_found'), ''),
      'Channel not found'
    ),
    'err_channel_update_failed', COALESCE(
      NULLIF(trim(value->'media_pool'->>'err_channel_update_failed'), ''),
      'Unable to update channel'
    ),
    'err_channel_delete_failed', COALESCE(
      NULLIF(trim(value->'media_pool'->>'err_channel_delete_failed'), ''),
      'Unable to delete channel'
    ),
    'err_quota_invalid', COALESCE(
      NULLIF(trim(value->'media_pool'->>'err_quota_invalid'), ''),
      'Daily quota must be a whole number of 1 or more'
    ),
    'err_sort_order_invalid', COALESCE(
      NULLIF(trim(value->'media_pool'->>'err_sort_order_invalid'), ''),
      'Failover order must be a whole number of 0 or more'
    ),
    'err_upload_file_required', COALESCE(
      NULLIF(trim(value->'media_pool'->>'err_upload_file_required'), ''),
      'Video file is required'
    ),
    'err_upload_file_type', COALESCE(
      NULLIF(trim(value->'media_pool'->>'err_upload_file_type'), ''),
      'Video must be MP4, MOV, or WebM'
    ),
    'err_upload_file_too_large', COALESCE(
      NULLIF(trim(value->'media_pool'->>'err_upload_file_too_large'), ''),
      'Video is too large'
    ),
    'err_invalid_json', COALESCE(
      NULLIF(trim(value->'media_pool'->>'err_invalid_json'), ''),
      'Invalid JSON'
    ),
    'err_register_failed', COALESCE(
      NULLIF(trim(value->'media_pool'->>'err_register_failed'), ''),
      'Unable to register channel'
    ),
    'err_upload_failed', COALESCE(
      NULLIF(trim(value->'media_pool'->>'err_upload_failed'), ''),
      'Unable to upload video'
    ),
    'err_upload_queue_failed', COALESCE(
      NULLIF(trim(value->'media_pool'->>'err_upload_queue_failed'), ''),
      'Unable to queue upload'
    ),
    'err_read_failed', COALESCE(
      NULLIF(trim(value->'media_pool'->>'err_read_failed'), ''),
      'Unable to read file'
    ),
    'default_upload_title', COALESCE(
      NULLIF(trim(value->'media_pool'->>'default_upload_title'), ''),
      'dama ad'
    )
  ),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
