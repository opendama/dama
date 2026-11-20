-- App shell: splash plate color + logo ink from DB (no client invent).
-- Soft-fill only; idempotent. Global copy only.

UPDATE platform_settings
SET value = value || jsonb_strip_nulls(jsonb_build_object(
  'splash_background_color', COALESCE(NULLIF(trim(value->>'splash_background_color'), ''), '#A31D38'),
  'splash_logo_ink', COALESCE(NULLIF(trim(value->>'splash_logo_ink'), ''), 'white'),
  'manifest_description', COALESCE(NULLIF(trim(value->>'manifest_description'), ''), 'International draughts. Play, tournaments, wallet.'),
  'brand_mark_alt', COALESCE(NULLIF(trim(value->>'brand_mark_alt'), ''), 'Dama')
)),
    updated_at = NOW()
WHERE key = 'app_shell_chrome';

-- Force-replace any Ethiopia marketing still lingering in slide/manifest copy.
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
  );
