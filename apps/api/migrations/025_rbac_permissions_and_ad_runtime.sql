-- RBAC permission catalog + role grants (DB-driven; no client invent).
-- Ad playback / in-match runtime policy + campaign schedule caps (Meta-style frequency).

CREATE TABLE IF NOT EXISTS rbac_permissions (
  key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rbac_permissions_key_nonempty CHECK (length(trim(key)) > 0),
  CONSTRAINT rbac_permissions_title_nonempty CHECK (length(trim(title)) > 0)
);

CREATE TABLE IF NOT EXISTS rbac_role_permissions (
  role TEXT NOT NULL,
  permission_key TEXT NOT NULL REFERENCES rbac_permissions(key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role, permission_key),
  CONSTRAINT rbac_role_permissions_role_nonempty CHECK (length(trim(role)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_rbac_role_permissions_role ON rbac_role_permissions(role);

INSERT INTO rbac_permissions (key, title, description) VALUES
  ('users.read', 'Read users', 'List console users'),
  ('users.write_role', 'Assign roles', 'Change user role'),
  ('users.write_active', 'Activate users', 'Soft activate/deactivate users'),
  ('rbac.manage', 'Manage RBAC', 'CRUD roles catalog and permission grants'),
  ('feature_flags.write', 'Feature flags', 'Toggle platform feature flags'),
  ('progression.write', 'Progression', 'Edit XP ladder, clock, board rules, ad pricing'),
  ('tournaments.write', 'Tournaments', 'Create and lifecycle tournaments'),
  ('payments.review', 'Payment review', 'Review receipts and banks'),
  ('media_pool.write', 'Media pool', 'Register channels and upload creatives'),
  ('avatars.moderate', 'Avatar moderation', 'Approve or flag player avatars'),
  ('telemetry.read', 'Telemetry', 'Read fingerprints, geo, audit'),
  ('ads.manage_runtime', 'Ad runtime policy', 'Edit global ad playback and interval defaults'),
  ('ads.manage_campaigns', 'Ad campaigns', 'Admin view/edit campaign schedule and status')
ON CONFLICT (key) DO NOTHING;

-- superadmin: all permissions
INSERT INTO rbac_role_permissions (role, permission_key)
SELECT 'superadmin', key FROM rbac_permissions
ON CONFLICT DO NOTHING;

-- admin: all except rbac.manage (superadmin-only by default)
INSERT INTO rbac_role_permissions (role, permission_key)
SELECT 'admin', key FROM rbac_permissions WHERE key <> 'rbac.manage'
ON CONFLICT DO NOTHING;

-- Fix publisher catalog consistency (advertiser must be assignable).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{roles}',
  (
    SELECT COALESCE(jsonb_agg(DISTINCT x), '[]'::jsonb)
    FROM (
      SELECT jsonb_array_elements_text(COALESCE(value->'roles', '[]'::jsonb)) AS x
      UNION
      SELECT 'advertiser'
    ) s
  )
),
updated_at = NOW()
WHERE key = 'client_enums';

-- Global ad playback + in-match runtime (defaults; campaigns may override interval/caps).
INSERT INTO platform_settings (key, value, updated_at) VALUES
(
  'ad_playback',
  '{
    "non_skippable_seconds": 10,
    "first_show_after_game_seconds": 60,
    "default_interval_seconds": 300,
    "source": "database"
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = platform_settings.value || EXCLUDED.value,
  updated_at = NOW();

INSERT INTO platform_settings (key, value, updated_at) VALUES
(
  'ad_runtime_chrome',
  '{
    "section_title": "In-match ad runtime",
    "non_skippable_label": "Non-skippable seconds",
    "first_show_label": "First show after game start (seconds)",
    "interval_label": "Repeat interval (seconds)",
    "daily_cap_label": "Daily impression cap",
    "weekly_cap_label": "Weekly impression cap",
    "monthly_cap_label": "Monthly impression cap",
    "yearly_cap_label": "Yearly impression cap",
    "schedule_enabled_label": "Enable in-match schedule",
    "save_action": "Save ad runtime",
    "save_campaign_schedule_action": "Save campaign schedule",
    "unavailable": "Ad runtime chrome unavailable"
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = platform_settings.value || EXCLUDED.value,
  updated_at = NOW();

-- Campaign-level schedule (nullable caps = unlimited; interval null = use platform default).
ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS schedule_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_show_after_seconds INT,
  ADD COLUMN IF NOT EXISTS interval_seconds INT,
  ADD COLUMN IF NOT EXISTS non_skippable_seconds INT,
  ADD COLUMN IF NOT EXISTS daily_impression_cap INT,
  ADD COLUMN IF NOT EXISTS weekly_impression_cap INT,
  ADD COLUMN IF NOT EXISTS monthly_impression_cap INT,
  ADD COLUMN IF NOT EXISTS yearly_impression_cap INT;

ALTER TABLE ad_campaigns DROP CONSTRAINT IF EXISTS ad_campaigns_interval_positive;
ALTER TABLE ad_campaigns ADD CONSTRAINT ad_campaigns_interval_positive
  CHECK (interval_seconds IS NULL OR interval_seconds >= 30);
ALTER TABLE ad_campaigns DROP CONSTRAINT IF EXISTS ad_campaigns_first_show_nonneg;
ALTER TABLE ad_campaigns ADD CONSTRAINT ad_campaigns_first_show_nonneg
  CHECK (first_show_after_seconds IS NULL OR first_show_after_seconds >= 0);
ALTER TABLE ad_campaigns DROP CONSTRAINT IF EXISTS ad_campaigns_nonskip_positive;
ALTER TABLE ad_campaigns ADD CONSTRAINT ad_campaigns_nonskip_positive
  CHECK (non_skippable_seconds IS NULL OR non_skippable_seconds >= 1);

-- Impression event log for calendar period caps (day/week/month/year).
CREATE TABLE IF NOT EXISTS ad_impression_events (
  id BIGSERIAL PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  viewer_key TEXT NOT NULL DEFAULT '',
  placement TEXT NOT NULL DEFAULT 'lobby',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ad_impression_events_campaign_created
  ON ad_impression_events(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_impression_events_created
  ON ad_impression_events(created_at DESC);

-- Console nav: dedicated RBAC + Ads runtime modules (append if missing).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{modules}',
  COALESCE(value->'modules', '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'title', 'RBAC',
      'href', '/rbac',
      'body', 'Roles catalog and permission grants (database-driven).'
    )
  )
),
updated_at = NOW()
WHERE key = 'console_nav'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'modules', '[]'::jsonb)) m
    WHERE m->>'href' = '/rbac'
  );

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{modules}',
  COALESCE(value->'modules', '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'title', 'Ads runtime',
      'href', '/ads',
      'body', 'In-match ad interval, non-skippable window, and campaign schedule caps.'
    )
  )
),
updated_at = NOW()
WHERE key = 'console_nav'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'modules', '[]'::jsonb)) m
    WHERE m->>'href' = '/ads'
  );
