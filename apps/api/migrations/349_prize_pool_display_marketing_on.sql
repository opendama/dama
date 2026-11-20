-- Marketing: surface live prize pool on player cards for paid cups.
-- Platform flag was default OFF (267); without it attachTournamentPrizePool never emits
-- prize_pool_now / if_full even when a tournament opted in. Enable platform display and
-- opt-in paid tournaments that already declare a prize floor or charge an entry fee.

UPDATE feature_flags
SET enabled = TRUE,
    updated_at = NOW()
WHERE key = 'prize_pool_display_enabled'
  AND enabled = FALSE;

-- Paid cups: show live pot (enrolls x fee + declared floor) and if-full when max_players set.
UPDATE tournaments
SET prize_pool_display_enabled = TRUE,
    updated_at = NOW()
WHERE is_free = FALSE
  AND prize_pool_display_enabled = FALSE
  AND entry_fee_amount > 0;

UPDATE hosted_events
SET prize_pool_display_enabled = TRUE,
    updated_at = NOW()
WHERE is_free_entry = FALSE
  AND prize_pool_display_enabled = FALSE
  AND entry_fee_amount > 0;
