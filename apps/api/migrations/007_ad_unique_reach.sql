-- Unique ad reach: distinct viewers per campaign (viewer_key from client device id).
ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS unique_reach BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS ad_unique_viewers (
  campaign_id UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  viewer_key TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, viewer_key)
);

CREATE INDEX IF NOT EXISTS idx_ad_unique_viewers_campaign ON ad_unique_viewers(campaign_id);
