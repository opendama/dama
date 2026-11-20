-- Prize settle ops: admin settings chrome + cup detail dispute/settled labels.
-- Auto-settle applies to BOTH platform tournaments and organizer hosted events.

UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'prize_settle_settings_title', COALESCE(NULLIF(trim(value->>'prize_settle_settings_title'), ''), 'Prize settle'),
    'prize_settle_settings_blurb', COALESCE(NULLIF(trim(value->>'prize_settle_settings_blurb'), ''), 'Controls the dispute hold and auto wallet credit for finished paid cups (platform tournaments and organizer events).'),
    'prize_settle_settings_save_action', COALESCE(NULLIF(trim(value->>'prize_settle_settings_save_action'), ''), 'Save settle settings'),
    'prize_settle_settings_save_pending', COALESCE(NULLIF(trim(value->>'prize_settle_settings_save_pending'), ''), 'Saving…'),
    'prize_settle_settings_toast_saved', COALESCE(NULLIF(trim(value->>'prize_settle_settings_toast_saved'), ''), 'Prize settle settings saved'),
    'prize_settle_settings_toast_failed', COALESCE(NULLIF(trim(value->>'prize_settle_settings_toast_failed'), ''), 'Could not save prize settle settings'),
    'prize_settle_label_auto_settle', COALESCE(NULLIF(trim(value->>'prize_settle_label_auto_settle'), ''), 'Auto-settle after dispute window'),
    'prize_settle_label_dispute_hours', COALESCE(NULLIF(trim(value->>'prize_settle_label_dispute_hours'), ''), 'Dispute window (hours)'),
    'prize_settle_label_interval_minutes', COALESCE(NULLIF(trim(value->>'prize_settle_label_interval_minutes'), ''), 'Auto-settle check interval (minutes)'),
    'prize_settle_auto_settle_blurb', COALESCE(NULLIF(trim(value->>'prize_settle_auto_settle_blurb'), ''), 'When on, the API worker credits winners after the dispute window (and when no open reports). Manual Settle prizes still works.'),
    'dispute_window_ends_at_label', COALESCE(NULLIF(trim(value->>'dispute_window_ends_at_label'), ''), 'Dispute window ends'),
    'dispute_window_not_open_value', COALESCE(NULLIF(trim(value->>'dispute_window_not_open_value'), ''), 'Not opened yet'),
    'prize_settled_at_label', COALESCE(NULLIF(trim(value->>'prize_settled_at_label'), ''), 'Prizes settled'),
    'prize_not_settled_value', COALESCE(NULLIF(trim(value->>'prize_not_settled_value'), ''), 'Not settled yet')
  ),
  updated_at = NOW()
WHERE key = 'tournament_chrome';

-- Keep settle worker defaults present (idempotent).
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'competition_prize_auto_settle', COALESCE(NULLIF(trim(value->>'competition_prize_auto_settle'), ''), 'true'),
    'competition_prize_settle_interval_minutes', COALESCE(NULLIF(trim(value->>'competition_prize_settle_interval_minutes'), ''), '5'),
    'competition_dispute_window_hours', COALESCE(NULLIF(trim(value->>'competition_dispute_window_hours'), ''), '24')
  ),
  updated_at = NOW()
WHERE key = 'client_enums';
