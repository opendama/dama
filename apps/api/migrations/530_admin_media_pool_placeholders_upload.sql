-- Media pool register placeholders + upload dropzone chrome (admin console).
-- Heal-only merges; never wipe existing admin_console_chrome.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{media_pool}',
  COALESCE(value->'media_pool', '{}'::jsonb) || jsonb_build_object(
    'channel_id_placeholder', COALESCE(
      NULLIF(trim(value->'media_pool'->>'channel_id_placeholder'), ''),
      'UCxxxxxxxxxxxxxxxxxxxxxx'
    ),
    'label_placeholder', COALESCE(
      NULLIF(trim(value->'media_pool'->>'label_placeholder'), ''),
      'Primary upload channel'
    ),
    'client_id_placeholder', COALESCE(
      NULLIF(trim(value->'media_pool'->>'client_id_placeholder'), ''),
      'xxxx.apps.googleusercontent.com'
    ),
    'client_secret_placeholder', COALESCE(
      NULLIF(trim(value->'media_pool'->>'client_secret_placeholder'), ''),
      'OAuth client secret'
    ),
    'refresh_token_placeholder', COALESCE(
      NULLIF(trim(value->'media_pool'->>'refresh_token_placeholder'), ''),
      'OAuth refresh token'
    ),
    'api_key_placeholder', COALESCE(
      NULLIF(trim(value->'media_pool'->>'api_key_placeholder'), ''),
      'Google API key'
    ),
    'upload_drop_title', COALESCE(
      NULLIF(trim(value->'media_pool'->>'upload_drop_title'), ''),
      'Drop video here'
    ),
    'upload_drop_hint', COALESCE(
      NULLIF(trim(value->'media_pool'->>'upload_drop_hint'), ''),
      'MP4, MOV, or WebM. Uploads fail over across healthy channels.'
    ),
    'upload_browse_action', COALESCE(
      NULLIF(trim(value->'media_pool'->>'upload_browse_action'), ''),
      'Browse video'
    ),
    'upload_replace_action', COALESCE(
      NULLIF(trim(value->'media_pool'->>'upload_replace_action'), ''),
      'Replace video'
    ),
    'upload_remove_action', COALESCE(
      NULLIF(trim(value->'media_pool'->>'upload_remove_action'), ''),
      'Remove video'
    ),
    'upload_uploading_label', COALESCE(
      NULLIF(trim(value->'media_pool'->>'upload_uploading_label'), ''),
      'Uploading…'
    ),
    'upload_selected_label', COALESCE(
      NULLIF(trim(value->'media_pool'->>'upload_selected_label'), ''),
      'Video selected'
    ),
    'upload_local_path_label', COALESCE(
      NULLIF(trim(value->'media_pool'->>'upload_local_path_label'), ''),
      'Server path (optional)'
    ),
    'upload_local_path_placeholder', COALESCE(
      NULLIF(trim(value->'media_pool'->>'upload_local_path_placeholder'), ''),
      '/path/on/api/host/video.mp4'
    ),
    'upload_local_path_blurb', COALESCE(
      NULLIF(trim(value->'media_pool'->>'upload_local_path_blurb'), ''),
      'Advanced: upload a file already on the API host instead of browsing from this device.'
    ),
    'upload_section_file_title', COALESCE(
      NULLIF(trim(value->'media_pool'->>'upload_section_file_title'), ''),
      'Upload from this device'
    ),
    'upload_section_path_title', COALESCE(
      NULLIF(trim(value->'media_pool'->>'upload_section_path_title'), ''),
      'Or use a server path'
    )
  ),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
