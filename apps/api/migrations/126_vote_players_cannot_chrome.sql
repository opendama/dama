-- Spectators who are seated in the match cannot cast win votes (API reject).
-- Surface a DB chrome string so clients hide cast UI instead of inventing copy.

UPDATE platform_settings
SET value = value || '{
  "vote_players_cannot": "Players in this match cannot vote"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'spectate_chrome';
