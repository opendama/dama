-- Hall of Fame period tabs + podium chrome (fail-closed merge into leaderboard_chrome).

UPDATE platform_settings
SET value = value || '{
  "hall_of_fame_title": "Hall of Fame",
  "period_week": "This Week",
  "period_month": "This Month",
  "period_year": "This Year",
  "period_all": "All Time",
  "pts_suffix": "pts",
  "your_rank_prefix": "Your Rank:",
  "view_full_leaderboard": "View Full Leaderboard",
  "podium_first_aria": "1st place",
  "podium_second_aria": "2nd place",
  "podium_third_aria": "3rd place",
  "rank_list_title": "Rankings"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'leaderboard_chrome';
