-- Play rail: View profile CTA + friend-request tab count aria (bell-style badge).
-- Profile inspect: friends count + presence labels for dedicated player pages.

UPDATE platform_settings
SET value = value || '{
  "view_profile_action": "View",
  "friend_requests_count_aria": "{count} friend requests"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';

UPDATE platform_settings
SET value = value || '{
  "friends_count_label": "Friends",
  "online_now_label": "Online now",
  "offline_now_label": "Offline",
  "playing_now_label": "Playing now",
  "overview_tab": "Overview",
  "games_tab": "Games"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'profile_inspect_chrome';
