-- Public event matches can award career XP/rating (admin flag).
-- Event reopen after manual close (not after auto-finish).
-- Ads: ends_at + auto_closed + close/reopen chrome + notifs.
-- Idempotent. No client hardcoding.

-- ---------------------------------------------------------------------------
-- Feature flag: public event matches count toward career (XP / W-L / rating)
-- ---------------------------------------------------------------------------
INSERT INTO feature_flags (key, enabled, payload) VALUES
  ('public_event_matches_rated', TRUE, '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{toggles}',
  COALESCE(value->'toggles', '[]'::jsonb) || CASE
    WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'toggles', '[]'::jsonb)) t
      WHERE t->>'key' = 'public_event_matches_rated'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'key', 'public_event_matches_rated',
      'title', 'Public event matches rated',
      'description', 'When on, matches inside public hosted events award career XP, W-L, and rating like normal PvP.',
      'kind', 'boolean',
      'state_field', 'publicEventMatchesRated'
    ))
  END
),
updated_at = NOW()
WHERE key = 'feature_flag_catalog';

-- ---------------------------------------------------------------------------
-- Ads campaigns: schedule end + close tracking
-- ---------------------------------------------------------------------------
ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_closed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_ends_at_active
  ON ad_campaigns (ends_at)
  WHERE ends_at IS NOT NULL AND auto_closed = FALSE;

-- ---------------------------------------------------------------------------
-- Notification kinds
-- ---------------------------------------------------------------------------
-- Player reopen/auto-close: Tournament wording + Community (412 force soft-fill still applies).
INSERT INTO notification_kinds (code, audience, title_template, body_template, href_path, href_query_key) VALUES
  ('player.event_reopened', 'player', 'Tournament reopened', 'Cup "%s" is open again.', '/?view=tournaments&source=community', 'code'),
  ('player.event_auto_closed', 'player', 'Tournament finished', 'Cup "%s" finished automatically.', '/?view=tournaments&source=community', 'code'),
  ('player.campaign_closed', 'player', 'Campaign closed', 'Campaign "%s" was closed.', '/ads/campaigns', ''),
  ('player.campaign_reopened', 'player', 'Campaign reopened', 'Campaign "%s" is open again.', '/ads/campaigns', ''),
  ('player.campaign_auto_closed', 'player', 'Campaign auto-closed', 'Campaign "%s" ended on schedule and was closed.', '/ads/campaigns', ''),
  ('admin.campaign_auto_closed', 'admin', 'Campaign auto-closed', 'Publisher campaign "%s" auto-closed.', '/console/ads', '')
ON CONFLICT (code) DO NOTHING;

-- Align finished-event deep link copy for auto-close (organizer + players already get event_finished).
UPDATE notification_kinds
SET body_template = 'Cup "%s" finished. Results are ready.'
WHERE code = 'player.event_finished';

-- ---------------------------------------------------------------------------
-- Organizer chrome: close / reopen (Tournament wording - migrateonly re-applies
-- this || seed before 380/403/404 soft-fills; keep Hosting mid-migrate Event-clean)
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || '{
  "close_action": "Close tournament",
  "reopen_action": "Reopen tournament",
  "cannot_reopen_blurb": "This tournament already ran or finished and cannot be reopened.",
  "toast_closed": "Tournament closed",
  "toast_reopened": "Tournament reopened",
  "toast_close_failed": "Could not close tournament",
  "toast_reopen_failed": "Could not reopen tournament",
  "auto_closed_badge": "Auto-closed"
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

-- ---------------------------------------------------------------------------
-- Admin chrome: rated matches flag
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || '{
  "public_rated_flag_label": "Public event matches award career points",
  "public_rated_flag_blurb": "When on, wins and losses in public cups update XP, W-L, and rating like ranked play. Private cups stay unrated."
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_admin_chrome';

-- ---------------------------------------------------------------------------
-- Ads playback chrome: close / reopen / ends_at
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || '{
  "close_campaign_action": "Close campaign",
  "reopen_campaign_action": "Reopen campaign",
  "cannot_reopen_campaign_blurb": "This campaign was auto-closed and cannot be reopened.",
  "toast_campaign_closed": "Campaign closed",
  "toast_campaign_reopened": "Campaign reopened",
  "toast_campaign_close_failed": "Could not close campaign",
  "toast_campaign_reopen_failed": "Could not reopen campaign",
  "auto_closed_badge": "Auto-closed",
  "ends_at_label": "End date (optional)",
  "ends_at_blurb": "When set, the campaign auto-closes after this time.",
  "ph_ends_at": "Campaign end date"
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
