-- Dama Events (hosted cups): tables, catalog, enums, RBAC, feature flag, nav.
-- Fail-closed; prices/sizes/formats/statuses live in platform_settings only.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hosted_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  format_id TEXT NOT NULL,
  size_id TEXT NOT NULL,
  max_players INT NOT NULL CHECK (max_players >= 2),
  host_fee_amount NUMERIC(12,2) NOT NULL CHECK (host_fee_amount > 0),
  host_fee_currency TEXT NOT NULL,
  host_paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entry_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (entry_fee_amount >= 0),
  entry_fee_currency TEXT NOT NULL,
  is_free_entry BOOLEAN NOT NULL DEFAULT TRUE,
  auto_approve BOOLEAN NOT NULL DEFAULT FALSE,
  join_code TEXT NOT NULL,
  status TEXT NOT NULL,
  logo_url TEXT,
  brand_color TEXT,
  sponsor_logo_url TEXT,
  sponsor_name TEXT,
  winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hosted_events_title_nonempty CHECK (length(trim(title)) > 0),
  CONSTRAINT hosted_events_join_code_nonempty CHECK (length(trim(join_code)) > 0),
  CONSTRAINT hosted_events_currency_nonempty CHECK (length(trim(host_fee_currency)) > 0),
  CONSTRAINT hosted_events_entry_currency_nonempty CHECK (length(trim(entry_fee_currency)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hosted_events_join_code
  ON hosted_events (upper(trim(join_code)));

CREATE INDEX IF NOT EXISTS idx_hosted_events_organizer
  ON hosted_events (organizer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hosted_events_status
  ON hosted_events (status, created_at DESC);

CREATE TABLE IF NOT EXISTS hosted_event_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES hosted_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  seed INT,
  eliminated BOOLEAN NOT NULL DEFAULT FALSE,
  placement INT,
  fee_paid NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (fee_paid >= 0),
  fee_currency TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  UNIQUE (event_id, user_id),
  CONSTRAINT hosted_event_entries_fee_currency_nonempty CHECK (length(trim(fee_currency)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_hosted_event_entries_event_status
  ON hosted_event_entries (event_id, status);

CREATE INDEX IF NOT EXISTS idx_hosted_event_entries_user
  ON hosted_event_entries (user_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS hosted_event_bracket_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES hosted_events(id) ON DELETE CASCADE,
  round_index INT NOT NULL CHECK (round_index >= 0),
  match_index INT NOT NULL CHECK (match_index >= 0),
  player_a_id UUID REFERENCES users(id) ON DELETE SET NULL,
  player_b_id UUID REFERENCES users(id) ON DELETE SET NULL,
  winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  next_match_id UUID REFERENCES hosted_event_bracket_matches(id) ON DELETE SET NULL,
  next_slot TEXT,
  game_id UUID,
  status TEXT NOT NULL,
  is_bye BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, round_index, match_index),
  CONSTRAINT hosted_event_bracket_next_slot_ok
    CHECK (next_slot IS NULL OR next_slot IN ('a', 'b'))
);

CREATE INDEX IF NOT EXISTS idx_hosted_event_bracket_event
  ON hosted_event_bracket_matches (event_id, round_index, match_index);

CREATE INDEX IF NOT EXISTS idx_hosted_event_bracket_game
  ON hosted_event_bracket_matches (game_id)
  WHERE game_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hosted_event_bracket_status
  ON hosted_event_bracket_matches (event_id, status);

-- ---------------------------------------------------------------------------
-- Catalog (admin-editable via GET/PUT /console/events/catalog)
-- ---------------------------------------------------------------------------
INSERT INTO platform_settings (key, value) VALUES
  (
    'events_catalog',
    '{
      "join_code_length": 6,
      "join_code_alphabet": "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
      "auto_approve_default": false,
      "share_path_template": "/?view=tournaments&source=community&code={code}",
      "qr_filename_prefix": "dama-tournament-",
      "min_players_to_start": {
        "knockout": 4,
        "round_robin": 3,
        "groups_knockout": 8,
        "swiss": 6
      },
      "formats": [
        {
          "id": "knockout",
          "enabled": true,
          "sort_order": 1
        },
        {
          "id": "round_robin",
          "enabled": false,
          "sort_order": 2
        },
        {
          "id": "groups_knockout",
          "enabled": false,
          "sort_order": 3
        },
        {
          "id": "swiss",
          "enabled": false,
          "sort_order": 4
        }
      ],
      "sizes": [
        {
          "id": "size_8",
          "enabled": true,
          "sort_order": 1,
          "max_players": 8,
          "host_fee_amount": 50,
          "host_fee_currency": "ETB",
          "allowed_format_ids": ["knockout"]
        },
        {
          "id": "size_16",
          "enabled": true,
          "sort_order": 2,
          "max_players": 16,
          "host_fee_amount": 100,
          "host_fee_currency": "ETB",
          "allowed_format_ids": ["knockout", "round_robin", "groups_knockout", "swiss"]
        },
        {
          "id": "size_32",
          "enabled": true,
          "sort_order": 3,
          "max_players": 32,
          "host_fee_amount": 200,
          "host_fee_currency": "ETB",
          "allowed_format_ids": ["knockout", "groups_knockout", "swiss"]
        },
        {
          "id": "size_64",
          "enabled": true,
          "sort_order": 4,
          "max_players": 64,
          "host_fee_amount": 400,
          "host_fee_currency": "ETB",
          "allowed_format_ids": ["knockout", "swiss"]
        }
      ]
    }'::jsonb
  )
-- Seed once only. Later migrations merge keys; admin catalog edits must survive restarts.
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- client_enums: hosted event statuses / formats / entry / bracket
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || '{
  "hosted_event_statuses": ["open", "full", "live", "finished", "cancelled"],
  "hosted_event_default_status": "open",
  "hosted_event_joinable_statuses": ["open"],
  "hosted_event_full_status": "full",
  "hosted_event_live_status": "live",
  "hosted_event_finished_status": "finished",
  "hosted_event_cancelled_status": "cancelled",
  "hosted_event_formats": ["knockout", "round_robin", "groups_knockout", "swiss"],
  "hosted_event_default_format": "knockout",
  "hosted_event_knockout_format": "knockout",
  "hosted_event_entry_statuses": ["pending", "approved", "rejected", "kicked"],
  "hosted_event_entry_pending": "pending",
  "hosted_event_entry_approved": "approved",
  "hosted_event_entry_rejected": "rejected",
  "hosted_event_entry_kicked": "kicked",
  "hosted_event_bracket_statuses": ["pending", "ready", "live", "done", "bye"],
  "hosted_event_bracket_pending": "pending",
  "hosted_event_bracket_ready": "ready",
  "hosted_event_bracket_live": "live",
  "hosted_event_bracket_done": "done",
  "hosted_event_bracket_bye": "bye"
}'::jsonb,
updated_at = NOW()
WHERE key = 'client_enums';

-- ---------------------------------------------------------------------------
-- RBAC
-- ---------------------------------------------------------------------------
INSERT INTO rbac_permissions (key, title, description) VALUES
  ('events.manage_catalog', 'Events catalog', 'Configure hosted event sizes, formats, and host fees')
ON CONFLICT (key) DO NOTHING;

INSERT INTO rbac_role_permissions (role, permission_key)
SELECT 'superadmin', 'events.manage_catalog'
WHERE NOT EXISTS (
  SELECT 1 FROM rbac_role_permissions
  WHERE role = 'superadmin' AND permission_key = 'events.manage_catalog'
);

INSERT INTO rbac_role_permissions (role, permission_key)
SELECT 'admin', 'events.manage_catalog'
WHERE NOT EXISTS (
  SELECT 1 FROM rbac_role_permissions
  WHERE role = 'admin' AND permission_key = 'events.manage_catalog'
);

-- ---------------------------------------------------------------------------
-- Feature flag + catalog toggle
-- ---------------------------------------------------------------------------
INSERT INTO feature_flags (key, enabled, payload, updated_at)
VALUES ('hosted_events_enabled', true, '{}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{toggles}',
  COALESCE(value->'toggles', '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'key', 'hosted_events_enabled',
      'title', 'Dama Events',
      'description', 'Pay-to-create hosted cups with join code, QR, and knockout brackets.',
      'kind', 'boolean',
      'state_field', 'hostedEventsEnabled'
    )
  )
),
updated_at = NOW()
WHERE key = 'feature_flag_catalog'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'toggles', '[]'::jsonb)) t
    WHERE t->>'key' = 'hosted_events_enabled'
  );

-- ---------------------------------------------------------------------------
-- Console nav module
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{modules}',
  COALESCE(value->'modules', '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'title', 'Events',
      'href', '/events',
      'body', 'Host packages, formats, and join rules for Dama Events.'
    )
  )
),
updated_at = NOW()
WHERE key = 'console_nav'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(value->'modules', '[]'::jsonb)) AS m
    WHERE m->>'href' = '/events'
  );

-- ---------------------------------------------------------------------------
-- client_nav: events + brand + bottom_nav.events + dashboard card
-- ---------------------------------------------------------------------------
-- Hosting manage tabs (Tournament wording; never a second public Event browse).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{events}',
  '[
    {"title": "Dashboard", "href": "/events/dashboard", "route_key": "events_dashboard"},
    {"title": "My hosted tournaments", "href": "/events/events", "route_key": "events_list"},
    {"title": "Join with code", "href": "/events/join", "route_key": "events_join"}
  ]'::jsonb
),
updated_at = NOW()
WHERE key = 'client_nav';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{bottom_nav,events}',
  '[
    {"title": "Dashboard", "href": "/events/dashboard", "route_key": "events_dashboard"},
    {"title": "My hosted tournaments", "href": "/events/events", "route_key": "events_list"},
    {"title": "Join with code", "href": "/events/join", "route_key": "events_join"}
  ]'::jsonb
),
updated_at = NOW()
WHERE key = 'client_nav';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'events_brand_name', 'Hosting',
  'events_nav_unavailable', 'Hosting navigation unavailable'
),
updated_at = NOW()
WHERE key = 'client_nav';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard}',
  (
    SELECT jsonb_agg(elem)
    FROM (
      SELECT elem
      FROM jsonb_array_elements(COALESCE(value->'dashboard', '[]'::jsonb)) AS elem
      WHERE elem->>'route_key' <> 'events'
      UNION ALL
      SELECT jsonb_build_object(
        'title', 'Hosting',
        'href', '/events/dashboard',
        'route_key', 'events',
        'body', 'Create branded cups with join code, QR, and brackets.',
        'cta', 'Open Hosting'
      )
    ) AS x(elem)
  )
),
updated_at = NOW()
WHERE key = 'client_nav';

-- Player shell: do NOT seed a second Event browse world (376+ owns Tournaments discovery).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{player}',
  COALESCE(value->'player', '[]'::jsonb) ||
  CASE
    WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'player', '[]'::jsonb)) e
      WHERE e->>'route_key' IN ('events', 'tournaments')
    ) THEN '[]'::jsonb
    ELSE '[{"title": "Tournaments", "href": "/?view=tournaments", "route_key": "tournaments"}]'::jsonb
  END
),
updated_at = NOW()
WHERE key = 'client_nav';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{bottom_nav,player}',
  COALESCE(value->'bottom_nav'->'player', '[]'::jsonb) ||
  CASE
    WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'player', '[]'::jsonb)) e
      WHERE e->>'route_key' IN ('events', 'tournaments')
    ) THEN '[]'::jsonb
    ELSE '[{"title": "Tournaments", "href": "/?view=tournaments", "route_key": "tournaments"}]'::jsonb
  END
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'bottom_nav';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{bottom_nav,mobile}',
  COALESCE(value->'bottom_nav'->'mobile', '[]'::jsonb) ||
  CASE
    WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'mobile', '[]'::jsonb)) e
      WHERE e->>'route_key' IN ('events', 'tournaments')
    ) THEN '[]'::jsonb
    ELSE '[{"title": "Tournaments", "route_key": "tournaments"}]'::jsonb
  END
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'bottom_nav';
