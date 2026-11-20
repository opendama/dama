-- Enum contract: archived / reopen campaign statuses (no hardcoded "archived"/"paused").
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'archived_campaign_status',
    COALESCE(
      NULLIF(trim(value->>'archived_campaign_status'), ''),
      'archived'
    ),
    'reopen_campaign_status',
    COALESCE(
      NULLIF(trim(value->>'reopen_campaign_status'), ''),
      'paused'
    )
  ),
  updated_at = NOW()
WHERE key = 'client_enums';

-- Match history: persist rated so period HoF aligns with career (rated PvP only).
-- Backfill non-AI rows as rated=true so historical HoF stays continuous; new rows set from game.Rated.
ALTER TABLE match_history
  ADD COLUMN IF NOT EXISTS rated BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE match_history
SET rated = TRUE
WHERE mode IS DISTINCT FROM 'ai'
  AND rated = FALSE;

CREATE INDEX IF NOT EXISTS idx_match_history_rated_finished
  ON match_history (rated, finished_at DESC)
  WHERE rated = TRUE AND is_draw = FALSE AND winner_id IS NOT NULL;
