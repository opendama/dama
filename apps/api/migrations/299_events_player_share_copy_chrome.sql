-- Player event Share = copy invite link (organizer copy_link parity). Toast chrome fail-closed.
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'copied_blurb', COALESCE(NULLIF(trim(value->>'copied_blurb'), ''), 'Copied'),
    'toast_copy_failed', COALESCE(NULLIF(trim(value->>'toast_copy_failed'), ''), 'Copy failed')
  ),
  updated_at = now()
WHERE key = 'events_player_chrome';
