-- Official pause: meta (reason/note update) audit action + rate-limit chrome.
-- Soft-fill only. Idempotent.

ALTER TABLE match_official_pause_events
  DROP CONSTRAINT IF EXISTS match_official_pause_events_action_ok;

ALTER TABLE match_official_pause_events
  ADD CONSTRAINT match_official_pause_events_action_ok
  CHECK (action IN ('pause', 'resume', 'meta'));

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'err_rate_limited', COALESCE(
    NULLIF(trim(value->>'err_rate_limited'), ''),
    'Too many official pause actions. Try again shortly.'
  ),
  'err_list_failed', COALESCE(
    NULLIF(trim(value->>'err_list_failed'), ''),
    'Could not load pause history'
  ),
  'err_meta_not_paused', COALESCE(
    NULLIF(trim(value->>'err_meta_not_paused'), ''),
    'Match is not under an official pause'
  ),
  'meta_action', COALESCE(
    NULLIF(trim(value->>'meta_action'), ''),
    'Update pause note'
  ),
  'meta_pending', COALESCE(
    NULLIF(trim(value->>'meta_pending'), ''),
    'Saving…'
  ),
  'toast_meta_saved', COALESCE(
    NULLIF(trim(value->>'toast_meta_saved'), ''),
    'Pause details updated'
  ),
  'toast_meta_failed', COALESCE(
    NULLIF(trim(value->>'toast_meta_failed'), ''),
    'Could not update pause details'
  ),
  'activity_meta_fmt', COALESCE(
    NULLIF(trim(value->>'activity_meta_fmt'), ''),
    'Updated by {role} · {name} · {reason}'
  )
),
updated_at = NOW()
WHERE key = 'official_pause_chrome';
