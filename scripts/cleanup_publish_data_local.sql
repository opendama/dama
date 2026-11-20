-- Publish data cleanup (LOCAL). DATA rows only. No DROP DATABASE / No DROP TABLE.
-- KEEP: platform_settings/chrome, feature_flags rows, RBAC, notification_kinds,
--       admin/superadmin/console users, ihate* users, seed/ops admins.
-- CLEAR: games/matches, tournaments, events, wallet ledger, receipts, payouts,
--        notifications, and non-kept users (+ FK dependents).

BEGIN;

CREATE TEMP TABLE keep_users AS
SELECT id
FROM users
WHERE role IN ('admin', 'superadmin', 'console')
   OR username ILIKE 'ihate%'
   OR email ILIKE '%ihate%'
   OR email = 'bereketgezha@gmail.com'
   OR id = '29c29227-d741-45eb-8c9e-93583bf1ab37';

-- Keep users required by untouched admin/config rows (ads not-null publisher, flag auditors).
INSERT INTO keep_users (id)
SELECT DISTINCT a.publisher_id
FROM ad_campaigns a
WHERE a.publisher_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM keep_users k WHERE k.id = a.publisher_id);

INSERT INTO keep_users (id)
SELECT DISTINCT ff.updated_by
FROM feature_flags ff
WHERE ff.updated_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM keep_users k WHERE k.id = ff.updated_by);

-- Detach only nullable refs; never modify ad_campaigns / feature_flags / chrome rows.
UPDATE youtube_upload_jobs AS y
SET publisher_id = NULL
WHERE y.publisher_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM keep_users k WHERE k.id = y.publisher_id);

UPDATE game_chat_settings AS g
SET updated_by = NULL
WHERE g.updated_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM keep_users k WHERE k.id = g.updated_by);

-- Agreed runtime data clears (tables kept, rows removed).
TRUNCATE TABLE
  game_chat_reactions,
  game_chat_reads,
  game_chat_user_reads,
  game_chat_messages,
  match_votes,
  match_official_pause_events,
  matches,
  match_history,
  hosted_event_bracket_matches,
  hosted_event_entries,
  hosted_event_reports,
  hosted_events,
  tournament_bracket_matches,
  tournament_entries,
  tournament_reports,
  tournaments,
  wallet_ledger,
  payment_receipts,
  payment_intents,
  payout_requests,
  competition_prize_payouts,
  app_notifications
RESTART IDENTITY;

-- User-owned money rows for non-kept users only (kept users retain wallet shells).
DELETE FROM wallets w
WHERE NOT EXISTS (SELECT 1 FROM keep_users k WHERE k.id = w.user_id);

DELETE FROM user_payout_methods m
WHERE NOT EXISTS (SELECT 1 FROM keep_users k WHERE k.id = m.user_id);

-- payment_accounts is platform deposit config (no user_id). Do not touch.

-- NO ACTION FKs that block user delete.
DELETE FROM geo_ip_records g
WHERE NOT EXISTS (SELECT 1 FROM keep_users k WHERE k.id = g.user_id);

-- Non-kept users only. CASCADE clears dependents (friends, dm, kyc, otp, etc.).
DELETE FROM users u
WHERE NOT EXISTS (SELECT 1 FROM keep_users k WHERE k.id = u.id);

-- Post-checks inside the same transaction (fail closed if violated).
DO $$
DECLARE
  n_settings int;
  n_flags int;
  n_rbac int;
  n_kinds int;
  n_users int;
  n_ihate int;
  n_adminish int;
  n_matches int;
  n_tournaments int;
  n_events int;
  n_ledger int;
  n_receipts int;
  n_payouts int;
  n_notifs int;
BEGIN
  SELECT COUNT(*) INTO n_settings FROM platform_settings;
  SELECT COUNT(*) INTO n_flags FROM feature_flags;
  SELECT COUNT(*) INTO n_rbac FROM rbac_permissions;
  SELECT COUNT(*) INTO n_kinds FROM notification_kinds;
  SELECT COUNT(*) INTO n_users FROM users;
  SELECT COUNT(*) INTO n_ihate FROM users WHERE username ILIKE 'ihate%' OR email ILIKE '%ihate%';
  SELECT COUNT(*) INTO n_adminish FROM users WHERE role IN ('admin', 'superadmin', 'console');
  SELECT COUNT(*) INTO n_matches FROM matches;
  SELECT COUNT(*) INTO n_tournaments FROM tournaments;
  SELECT COUNT(*) INTO n_events FROM hosted_events;
  SELECT COUNT(*) INTO n_ledger FROM wallet_ledger;
  SELECT COUNT(*) INTO n_receipts FROM payment_receipts;
  SELECT COUNT(*) INTO n_payouts FROM payout_requests;
  SELECT COUNT(*) INTO n_notifs FROM app_notifications;

  IF n_settings < 1 THEN
    RAISE EXCEPTION 'fail-closed: platform_settings empty';
  END IF;
  IF n_flags < 1 THEN
    RAISE EXCEPTION 'fail-closed: feature_flags empty';
  END IF;
  IF n_rbac < 1 THEN
    RAISE EXCEPTION 'fail-closed: rbac_permissions empty';
  END IF;
  IF n_kinds < 1 THEN
    RAISE EXCEPTION 'fail-closed: notification_kinds empty';
  END IF;
  IF n_ihate < 1 THEN
    RAISE EXCEPTION 'fail-closed: ihate users missing';
  END IF;
  IF n_adminish < 1 THEN
    RAISE EXCEPTION 'fail-closed: admin users missing';
  END IF;
  IF n_matches <> 0 OR n_tournaments <> 0 OR n_events <> 0 OR n_ledger <> 0 OR n_receipts <> 0 OR n_payouts <> 0 OR n_notifs <> 0 THEN
    RAISE EXCEPTION 'fail-closed: agreed runtime data not fully cleared';
  END IF;

  RAISE NOTICE 'cleanup_ok settings=% flags=% rbac=% kinds=% users=% ihate=% adminish=%',
    n_settings, n_flags, n_rbac, n_kinds, n_users, n_ihate, n_adminish;
END $$;

COMMIT;
