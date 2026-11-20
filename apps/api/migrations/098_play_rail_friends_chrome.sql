-- Play rail chrome (New Game | Games | Players) + friends graph.
-- Fail-closed UI strings; friends are DB-backed only.

INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'play_rail_chrome',
  '{
    "source": "database",
    "tab_new_game": "New Game",
    "tab_games": "Games",
    "tab_players": "Players",
    "sub_play_ai": "Play AI",
    "sub_challenge": "Challenge",
    "sub_watch": "Watch",
    "sub_history": "History",
    "sub_friends": "Friends",
    "sub_all_players": "All Players",
    "label_opponent": "Opponent",
    "label_time": "Time",
    "label_i_play_as": "I play as",
    "label_rated": "Rated",
    "label_colors": "Colors",
    "label_board": "Board",
    "label_pieces": "Pieces",
    "label_rating": "Rating",
    "search_username_placeholder": "Username…",
    "search_opponent_placeholder": "Search username…",
    "send_challenge_action": "Send Challenge",
    "sending_challenge": "Sending…",
    "challenge_link_action": "Challenge Link",
    "copied_action": "Copied!",
    "copied_share_blurb": "Copied! Share this link within 15 minutes to start a game.",
    "sign_in_to_challenge": "Sign in to challenge",
    "find_matchmaking_action": "Find matchmaking",
    "watch_game_action": "Watch game",
    "challenge_action": "Challenge",
    "add_friend_action": "Add Friend",
    "online_label": "Online",
    "playing_label": "Playing",
    "offline_label": "Offline",
    "empty_live_games": "No live games right now.",
    "empty_history": "No finished matches yet.",
    "empty_friends": "No friends yet. Add players from All Players.",
    "empty_players": "No players match.",
    "loading_live": "Loading live games…",
    "loading_history": "Loading history…",
    "loading_players": "Loading players…",
    "sign_in_history": "Sign in to see your match history.",
    "sign_in_friends": "Sign in to see your friends.",
    "outcome_win": "Win",
    "outcome_loss": "Loss",
    "outcome_draw": "Draw",
    "moves_suffix": "moves",
    "toast_enter_username": "Enter a username to challenge",
    "toast_sign_in_challenge": "Sign in to send a challenge",
    "toast_challenge_sent_prefix": "Challenge sent to",
    "toast_challenge_failed": "Could not send challenge",
    "toast_copy_failed": "Could not copy link",
    "toast_send_link_first": "Send a challenge first to get a share link",
    "toast_friend_added": "Friend added",
    "toast_friend_removed": "Friend removed",
    "toast_friend_failed": "Could not update friends",
    "color_pref_note": "Color is applied when the opponent accepts.",
    "board_view_2d": "2D",
    "board_view_3d": "3D",
    "share_watch_action": "Share watch link",
    "flip_board_aria": "Flip board",
    "share_game_aria": "Share game link",
    "play_rail_chrome_unavailable": "Play rail chrome unavailable"
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = platform_settings.value || EXCLUDED.value,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS player_friends (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);

CREATE INDEX IF NOT EXISTS player_friends_friend_id_idx ON player_friends (friend_id);
