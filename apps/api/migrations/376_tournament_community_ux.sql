-- Mig 376: Player UX - one Tournament discovery (Official | Community | All).
-- Backend tables stay separate (platform tournaments + hosted events).
-- Idempotent. Soft-fills chrome; redirects player Events browse → Tournaments Community.

-- ---------------------------------------------------------------------------
-- tournaments_player_chrome: source filter, badges, host CTA
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'filter_source_label',
  COALESCE(NULLIF(trim(value->>'filter_source_label'), ''), 'Source'),
  'filter_source_all_label',
  COALESCE(NULLIF(trim(value->>'filter_source_all_label'), ''), 'All'),
  'filter_source_official_label',
  COALESCE(NULLIF(trim(value->>'filter_source_official_label'), ''), 'Official'),
  'filter_source_community_label',
  COALESCE(NULLIF(trim(value->>'filter_source_community_label'), ''), 'Community'),
  'badge_official_label',
  COALESCE(NULLIF(trim(value->>'badge_official_label'), ''), 'Official'),
  'badge_community_label',
  COALESCE(NULLIF(trim(value->>'badge_community_label'), ''), 'Community'),
  'host_tournament_action',
  COALESCE(NULLIF(trim(value->>'host_tournament_action'), ''), 'Host a tournament'),
  'host_tournament_href',
  COALESCE(NULLIF(trim(value->>'host_tournament_href'), ''), '/events/events'),
  'host_tournament_blurb',
  COALESCE(NULLIF(trim(value->>'host_tournament_blurb'), ''),
    'Create a community tournament for your club, stream, or school.'),
  'empty_community',
  COALESCE(NULLIF(trim(value->>'empty_community'), ''), 'No community tournaments open right now.'),
  'empty_official',
  COALESCE(NULLIF(trim(value->>'empty_official'), ''), 'No official tournaments open right now.'),
  'page_blurb',
  'Official and community tournaments in one place. Filter by source, then join or host.'
),
updated_at = NOW()
WHERE key = 'tournaments_player_chrome';

-- Force page_blurb (may already be non-empty from older copy).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{page_blurb}',
  to_jsonb('Official and community tournaments in one place. Filter by source, then join or host.'::text)
),
updated_at = NOW()
WHERE key = 'tournaments_player_chrome';

-- ---------------------------------------------------------------------------
-- client_nav: player bottom bar - one discovery tab (tournaments).
-- Remove duplicate player `events` browse tab (organizer portal keeps events_*).
-- Player deep links to view=events resolve client-side → tournaments&source=community.
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{bottom_nav,player}',
  COALESCE(
    (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'player', '[]'::jsonb)) AS elem
      WHERE COALESCE(elem->>'route_key', '') <> 'events'
    ),
    '[]'::jsonb
  )
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'bottom_nav'
  AND value->'bottom_nav' ? 'player';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{bottom_nav,mobile}',
  COALESCE(
    (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'mobile', '[]'::jsonb)) AS elem
      WHERE COALESCE(elem->>'route_key', '') <> 'events'
    ),
    '[]'::jsonb
  )
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'bottom_nav'
  AND value->'bottom_nav' ? 'mobile';

-- Player rail: drop browse-only Events; keep tournaments. Organizer dashboard card stays.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{player}',
  COALESCE(
    (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements(COALESCE(value->'player', '[]'::jsonb)) AS elem
      WHERE NOT (
        COALESCE(elem->>'route_key', '') = 'events'
        AND COALESCE(elem->>'href', '') LIKE '%view=events%'
      )
    ),
    '[]'::jsonb
  )
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'player';

-- Organizer chrome: public list → unified player tournaments Community tab.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{portal_public_list_href}',
  to_jsonb('/?view=tournaments&source=community'::text)
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';
