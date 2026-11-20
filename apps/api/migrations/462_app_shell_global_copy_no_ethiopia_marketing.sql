-- Force-replace country-local marketing copy in app_shell_chrome with global
-- international draughts wording. Idempotent. Does not touch payment geo keys.

UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'slide_1_title', 'Play international draughts',
    'slide_1_blurb', 'Official 10x10 dama with live clocks, rated matches, and practice vs computer.',
    'manifest_description', 'International draughts. Play, tournaments, wallet.'
  ),
    updated_at = NOW()
WHERE key = 'app_shell_chrome'
  AND (
    COALESCE(value->>'slide_1_title', '') ~* 'ethiopian'
    OR COALESCE(value->>'slide_1_blurb', '') ~* 'ethiopian'
    OR COALESCE(value->>'manifest_description', '') ~* 'ethiopian'
    OR COALESCE(NULLIF(trim(value->>'manifest_description'), ''), '') = ''
    OR lower(trim(COALESCE(value->>'slide_1_title', ''))) = 'play ethiopian draughts'
  );

-- Soft-fill remaining keys if a partial 461 apply left blanks (global defaults only).
UPDATE platform_settings
SET value = value || jsonb_strip_nulls(jsonb_build_object(
  'slide_1_title', COALESCE(NULLIF(trim(value->>'slide_1_title'), ''), 'Play international draughts'),
  'slide_1_blurb', COALESCE(NULLIF(trim(value->>'slide_1_blurb'), ''), 'Official 10x10 dama with live clocks, rated matches, and practice vs computer.'),
  'manifest_description', COALESCE(NULLIF(trim(value->>'manifest_description'), ''), 'International draughts. Play, tournaments, wallet.')
)),
    updated_at = NOW()
WHERE key = 'app_shell_chrome';
