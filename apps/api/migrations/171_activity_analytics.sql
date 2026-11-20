-- Player / platform activity analytics (admin + public). DB chrome + RBAC only; no client invent.

-- Authenticated visit days (heartbeat upserts).
CREATE TABLE IF NOT EXISTS user_activity_days (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  visit_count INT NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, activity_date)
);
CREATE INDEX IF NOT EXISTS idx_user_activity_days_date ON user_activity_days (activity_date DESC);

-- Anonymous / public visitor days (opaque visitor_key from client; no PII required).
CREATE TABLE IF NOT EXISTS platform_visit_days (
  visitor_key TEXT NOT NULL,
  activity_date DATE NOT NULL,
  hit_count INT NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (visitor_key, activity_date)
);
CREATE INDEX IF NOT EXISTS idx_platform_visit_days_date ON platform_visit_days (activity_date DESC);

-- Allowed period filter values + windows + engagement day spans (backend-driven only).
INSERT INTO platform_settings (key, value, updated_at) VALUES (
  'activity_analytics',
  '{
    "periods": ["day", "week", "month", "year"],
    "default_period": "week",
    "series_max_buckets": 366,
    "period_window_days": {"day": 1, "week": 7, "month": 30, "year": 365},
    "dau_days": 1,
    "wau_days": 7,
    "mau_days": 30
  }'::jsonb,
  NOW()
) ON CONFLICT (key) DO NOTHING;

INSERT INTO rbac_permissions (key, title, description) VALUES
  ('activity.read', 'Activity analytics', 'Read player activity KPIs and time series')
ON CONFLICT (key) DO NOTHING;

INSERT INTO rbac_role_permissions (role, permission_key)
SELECT 'superadmin', 'activity.read'
WHERE NOT EXISTS (
  SELECT 1 FROM rbac_role_permissions WHERE role = 'superadmin' AND permission_key = 'activity.read'
);
INSERT INTO rbac_role_permissions (role, permission_key)
SELECT 'admin', 'activity.read'
WHERE NOT EXISTS (
  SELECT 1 FROM rbac_role_permissions WHERE role = 'admin' AND permission_key = 'activity.read'
);

-- Console nav: Activity module (append if missing).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{modules}',
  COALESCE(value->'modules', '[]'::jsonb) ||
  CASE
    WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'modules', '[]'::jsonb)) m
      WHERE m->>'href' = '/activity'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'Activity',
      'href', '/activity',
      'body', 'Live presence, visits, play volume, and DAU/WAU/MAU by day, week, month, or year.'
    ))
  END
),
updated_at = NOW()
WHERE key = 'console_nav';

-- Admin chrome section (fail-closed).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{activity}',
  '{
    "page_title": "Activity",
    "page_blurb": "Live online and playing counts plus visits, new users, finished games, and engagement (DAU / WAU / MAU) for the selected period.",
    "load_failed": "Activity analytics unavailable",
    "period_label": "Period",
    "period_day_label": "Day",
    "period_week_label": "Week",
    "period_month_label": "Month",
    "period_year_label": "Year",
    "kpi_online_now": "Online now",
    "kpi_playing_now": "Playing now",
    "kpi_users_total": "Players",
    "kpi_new_users": "New players",
    "kpi_visited": "Visited",
    "kpi_played": "Played",
    "kpi_games_finished": "Games finished",
    "kpi_dau": "DAU",
    "kpi_wau": "WAU",
    "kpi_mau": "MAU",
    "series_title": "Activity over time",
    "series_visited_label": "Visited",
    "series_played_label": "Played",
    "series_games_label": "Games",
    "series_new_users_label": "New",
    "series_visited_color": "var(--dama-gold)",
    "series_played_color": "var(--dama-text)",
    "series_games_color": "var(--dama-muted)",
    "series_new_users_color": "var(--dama-online)",
    "series_empty": "No activity in this period yet",
    "series_legend_aria": "Activity series legend",
    "live_section_title": "Live now",
    "period_section_title": "Selected period",
    "engagement_section_title": "Engagement"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND (value->'activity') IS NULL;

-- Public platform stats chrome (fail-closed).
INSERT INTO platform_settings (key, value, updated_at) VALUES (
  'platform_stats_chrome',
  '{
    "source": "platform_settings.platform_stats_chrome",
    "platform_stats_unavailable": "Platform stats unavailable",
    "section_title": "Community",
    "section_blurb": "Live global activity across Dama.",
    "period_label": "Period",
    "period_day_label": "Day",
    "period_week_label": "Week",
    "period_month_label": "Month",
    "period_year_label": "Year",
    "kpi_online_now": "Online now",
    "kpi_playing_now": "Playing now",
    "kpi_users_total": "Players",
    "kpi_visited": "Visited",
    "kpi_played": "Played",
    "kpi_games_finished": "Games finished",
    "kpi_dau": "Daily active",
    "kpi_wau": "Weekly active",
    "kpi_mau": "Monthly active"
  }'::jsonb,
  NOW()
) ON CONFLICT (key) DO NOTHING;
