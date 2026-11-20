-- Cup lobby: empty copy when Live cup has no unfinished boards to Spectate yet.
-- Watch CTA only deep-links when API stamps live_game_id; otherwise Enter lobby.

UPDATE platform_settings
SET value = value || '{
  "lobby_no_live_boards": "No boards in play yet. Matches show Spectate here once both players start."
}'::jsonb,
    updated_at = NOW()
WHERE key = 'tournaments_player_chrome';

UPDATE platform_settings
SET value = value || '{
  "lobby_no_live_boards": "No boards in play yet. Matches show Spectate here once both players start."
}'::jsonb,
    updated_at = NOW()
WHERE key = 'events_player_chrome';
