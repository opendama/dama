-- My tournaments: prize amount label (viewer_prize_amount from competition_prize_payouts).

UPDATE platform_settings
SET value = value || '{
  "my_tournaments_prize_label": "Prize"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'tournaments_player_chrome';
