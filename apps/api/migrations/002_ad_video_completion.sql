-- Ad publisher video completion telemetry (PRD performance dashboard).
ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS video_completions BIGINT NOT NULL DEFAULT 0;
