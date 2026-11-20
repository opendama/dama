-- Clarify Events catalog page blurb for Ethiopia vs global host fees + sizes table.
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'page_blurb', COALESCE(
    NULLIF(trim(value->>'page_blurb'), ''),
    'Enable formats and manage host sizes. Each size has an Ethiopia host fee (ETB) and a global host fee (USD), same pattern as campaign create fees.'
  )
),
updated_at = NOW()
WHERE key = 'events_admin_chrome'
  AND (
    COALESCE(trim(value->>'page_blurb'), '') = ''
    OR value->>'page_blurb' = 'Enable formats and set host size fees. Organizers only see enabled options.'
  );
