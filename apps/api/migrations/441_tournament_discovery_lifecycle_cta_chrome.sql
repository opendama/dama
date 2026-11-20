-- Discovery lifecycle filters + status-honest card CTAs + settle prize feedback.
-- Finished cups show Results (never Join). Default browse = Open.

UPDATE platform_settings
SET value = value || '{
  "watch_action": "Watch",
  "results_action": "Results",
  "lobby_action": "Enter lobby",
  "filter_lifecycle_label": "Status",
  "filter_lifecycle_open_label": "Open",
  "filter_lifecycle_live_label": "Live",
  "filter_lifecycle_finished_label": "Finished",
  "filter_mine_label": "My cups",
  "empty_lifecycle_open": "No open tournaments right now.",
  "empty_lifecycle_live": "No live tournaments right now.",
  "empty_lifecycle_finished": "No finished tournaments yet.",
  "empty_mine": "You have not joined any tournaments yet.",
  "my_tournaments_title": "My tournaments",
  "my_tournaments_empty": "You have not joined any tournaments yet.",
  "my_tournaments_open_action": "Open results"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'tournaments_player_chrome';

UPDATE platform_settings
SET value = value || '{
  "watch_action": "Watch",
  "results_action": "Results",
  "lobby_action": "Enter lobby",
  "filter_lifecycle_label": "Status",
  "filter_lifecycle_open_label": "Open",
  "filter_lifecycle_live_label": "Live",
  "filter_lifecycle_finished_label": "Finished",
  "filter_mine_label": "My cups",
  "empty_lifecycle_open": "No open cups right now.",
  "empty_lifecycle_live": "No live cups right now.",
  "empty_lifecycle_finished": "No finished cups yet.",
  "empty_mine": "You have not joined any cups yet."
}'::jsonb,
    updated_at = NOW()
WHERE key = 'events_player_chrome';

UPDATE platform_settings
SET value = value || '{
  "settle_prizes_success_fmt": "Settled %d · failed %d · due %d",
  "settle_prizes_none_due": "No prizes are due yet (dispute window still open, or none pending).",
  "settle_prizes_failed": "Unable to settle prizes.",
  "settle_prizes_requires_finished": "Finish the tournament before settling prizes."
}'::jsonb,
    updated_at = NOW()
WHERE key = 'tournament_chrome';
