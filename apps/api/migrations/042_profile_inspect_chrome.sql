-- Public player inspect modal chrome (PRD 2.3). Fail closed; no client invent.

INSERT INTO platform_settings (key, value)
VALUES (
  'profile_inspect_chrome',
  '{
    "source": "database",
    "profile_inspect_chrome_unavailable": "Profile inspect chrome unavailable",
    "load_failed": "Failed to load profile",
    "sr_description": "Public career stats and full-resolution avatar",
    "inspect_action": "Inspect player profile",
    "zoom_title": "Scroll or pinch to zoom",
    "no_avatar": "No avatar yet",
    "avatar_alt_suffix": "avatar",
    "label_rating": "Rating",
    "label_xp": "XP",
    "label_level": "Level",
    "label_wins": "Wins",
    "label_losses": "Losses",
    "label_country": "Country",
    "label_region": "Region",
    "label_regional_rank": "Regional rank",
    "top_prefix": "Top",
    "recent_matches_title": "Recent matches",
    "no_matches": "No match history yet",
    "tournament_placements_title": "Tournament placements",
    "no_placements": "No tournament history yet",
    "outcome_draw": "Draw",
    "outcome_win": "Win",
    "outcome_loss": "Loss",
    "free_suffix": " · free",
    "pieces_left_suffix": "left",
    "captured_suffix": "captured",
    "seat_meta_separator": " · "
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW();
