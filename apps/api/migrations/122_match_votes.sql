-- Spectator winner votes for live/finished games (DB-backed tallies; no client invent).

CREATE TABLE IF NOT EXISTS match_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL,
  voter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  voted_player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT match_votes_game_voter_unique UNIQUE (game_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_match_votes_game_id ON match_votes (game_id);
CREATE INDEX IF NOT EXISTS idx_match_votes_voted_player ON match_votes (game_id, voted_player_id);

-- Spectate chrome: vote UI strings (fail-closed merge).
UPDATE platform_settings
SET value = value || '{
  "vote_section_title": "Who will win?",
  "vote_pick_action": "Vote",
  "vote_locked_label": "Your vote",
  "vote_sign_in": "Sign in to vote",
  "vote_unavailable": "Voting unavailable",
  "vote_cast_failed": "Could not cast vote",
  "vote_percent_suffix": "%",
  "vote_count_suffix": "votes",
  "vote_correct_title": "Top correct voters",
  "vote_correct_empty": "No correct voters yet.",
  "vote_correct_blurb": "Random top voters who picked the winner."
}'::jsonb,
    updated_at = NOW()
WHERE key = 'spectate_chrome';
