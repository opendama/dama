-- Portal overview hrefs must land on organizer/publisher shells (not player /dashboard).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "portal_overview_href": "/events/dashboard",
  "portal_create_href": "/events/events"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'events_organizer_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "publisher_portal_overview_href": "/ads/dashboard"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'ad_runtime_chrome';

-- Canonical events list path (alias /events/list still re-exports the same page).
UPDATE platform_settings
SET value = jsonb_set(
  jsonb_set(
    COALESCE(value, '{}'::jsonb),
    '{events}',
    (
      SELECT COALESCE(jsonb_agg(
        CASE
          WHEN elem->>'route_key' = 'events_list'
            THEN jsonb_set(elem, '{href}', '"/events/events"')
          ELSE elem
        END
      ), '[]'::jsonb)
      FROM jsonb_array_elements(COALESCE(value->'events', '[]'::jsonb)) AS elem
    )
  ),
  '{bottom_nav,events}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN elem->>'route_key' = 'events_list'
          THEN jsonb_set(elem, '{href}', '"/events/events"')
        ELSE elem
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'events', '[]'::jsonb)) AS elem
  )
),
    updated_at = NOW()
WHERE key = 'client_nav';

-- DB-driven status labels (clients must not invent English from raw codes).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "hosted_event_status_labels": {
    "open": "Open",
    "full": "Full",
    "live": "Live",
    "finished": "Finished",
    "cancelled": "Cancelled"
  },
  "hosted_event_bracket_status_labels": {
    "pending": "Pending",
    "ready": "Ready",
    "live": "Live",
    "done": "Done",
    "bye": "Bye"
  },
  "campaign_status_labels": {
    "draft": "Draft",
    "active": "Active",
    "paused": "Paused",
    "archived": "Archived"
  }
}'::jsonb,
    updated_at = NOW()
WHERE key = 'client_enums';

-- Organizer start deep-link (players keep player.event_started → join+code).
INSERT INTO notification_kinds (code, audience, title_template, body_template, href_path, href_query_key)
VALUES (
  'player.event_started_org',
  'player',
  'Event started',
  'Your cup "%s" is live. Run the bracket.',
  '/events/events',
  ''
)
ON CONFLICT (code) DO UPDATE
SET href_path = EXCLUDED.href_path,
    href_query_key = EXCLUDED.href_query_key,
    title_template = EXCLUDED.title_template,
    body_template = EXCLUDED.body_template;

-- Commission ledger is informational (platform retained); clients mute amount styling.
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "list_muted_kinds": ["event_entry_commission"]
}'::jsonb,
    updated_at = NOW()
WHERE key = 'wallet_chrome';
