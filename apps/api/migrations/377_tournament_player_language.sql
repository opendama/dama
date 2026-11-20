-- Mig 377: Player language - Tournament (not Event) for discovery/share/host CTAs.
-- Backend tables stay hosted_events / events_* keys; ops admin chrome can keep Event.
-- Idempotent soft-fills + force known player-facing "Events" copy.

-- ---------------------------------------------------------------------------
-- Invite share links → unified Tournaments Community (legacy view=events redirects).
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{share_path_template}',
  to_jsonb('/?view=tournaments&source=community&code={code}'::text)
),
updated_at = NOW()
WHERE key = 'events_catalog'
  AND COALESCE(value->>'share_path_template', '') IN (
    '',
    '/?view=events&code={code}'
  );

-- ---------------------------------------------------------------------------
-- events_player_chrome: Community tab empty/list copy (no "Events" sport name).
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'page_title',
  COALESCE(NULLIF(trim(value->>'page_title'), ''), 'Community tournaments'),
  'page_blurb',
  COALESCE(NULLIF(trim(value->>'page_blurb'), ''),
    'Browse community tournaments or join with a code.'),
  'empty_web',
  COALESCE(NULLIF(trim(value->>'empty_web'), ''),
    'No community tournaments open right now.'),
  'public_list_title',
  COALESCE(NULLIF(trim(value->>'public_list_title'), ''), 'Community tournaments'),
  'public_list_blurb',
  COALESCE(NULLIF(trim(value->>'public_list_blurb'), ''),
    'Open community tournaments anyone can join.'),
  'public_list_empty',
  COALESCE(NULLIF(trim(value->>'public_list_empty'), ''),
    'No community tournaments open right now.')
),
updated_at = NOW()
WHERE key = 'events_player_chrome';

-- Force known legacy Events player copy (may already be non-empty).
UPDATE platform_settings
SET value = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            value,
            '{page_title}',
            to_jsonb('Community tournaments'::text)
          ),
          '{page_blurb}',
          to_jsonb('Browse community tournaments or join with a code.'::text)
        ),
        '{empty_web}',
        to_jsonb('No community tournaments open right now.'::text)
      ),
      '{public_list_title}',
      to_jsonb('Community tournaments'::text)
    ),
    '{public_list_blurb}',
    to_jsonb('Open community tournaments anyone can join.'::text)
  ),
  '{public_list_empty}',
  to_jsonb('No community tournaments open right now.'::text)
),
updated_at = NOW()
WHERE key = 'events_player_chrome'
  AND (
    COALESCE(value->>'page_title', '') IN ('Events', 'Public events')
    OR COALESCE(value->>'empty_web', '') ILIKE '%event%'
    OR COALESCE(value->>'public_list_title', '') ILIKE '%event%'
    OR COALESCE(value->>'public_list_empty', '') ILIKE '%event%'
    OR COALESCE(value->>'public_list_blurb', '') ILIKE '%event%'
    OR COALESCE(value->>'page_blurb', '') ILIKE '%event%'
  );

-- ---------------------------------------------------------------------------
-- Organizer host portal (player hosts): Tournament wording for create / my list / public.
-- Admin console events_admin_chrome stays ops "Events catalog".
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'list_title',
  COALESCE(NULLIF(trim(value->>'list_title'), ''), 'My hosted tournaments'),
  'create_action',
  COALESCE(NULLIF(trim(value->>'create_action'), ''), 'Host a tournament'),
  'create_title',
  COALESCE(NULLIF(trim(value->>'create_title'), ''), 'Host a community tournament'),
  'portal_create_label',
  COALESCE(NULLIF(trim(value->>'portal_create_label'), ''), 'Host a tournament'),
  'portal_public_list_label',
  COALESCE(NULLIF(trim(value->>'portal_public_list_label'), ''), 'Community tournaments')
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          value,
          '{list_title}',
          to_jsonb('My hosted tournaments'::text)
        ),
        '{create_action}',
        to_jsonb('Host a tournament'::text)
      ),
      '{create_title}',
      to_jsonb('Host a community tournament'::text)
    ),
    '{portal_create_label}',
    to_jsonb('Host a tournament'::text)
  ),
  '{portal_public_list_label}',
  to_jsonb('Community tournaments'::text)
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome'
  AND (
    COALESCE(value->>'list_title', '') IN ('My events', 'Events')
    OR COALESCE(value->>'create_action', '') IN ('Create event', 'Create')
    OR COALESCE(value->>'create_title', '') ILIKE '%hosted event%'
    OR COALESCE(value->>'portal_create_label', '') IN ('Create event', 'Create')
    OR COALESCE(value->>'portal_public_list_label', '') IN ('Public events', 'Events')
  );

-- Keep public list href on Community discovery (re-assert; mig 376).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{portal_public_list_href}',
  to_jsonb('/?view=tournaments&source=community'::text)
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';
