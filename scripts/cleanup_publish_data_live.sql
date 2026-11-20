-- Publish data cleanup (LIVE). DATA rows only. No DROP DATABASE / No DROP TABLE.
-- Same intent as local pass1+pass2:
-- KEEP users: bereketgezha@gmail.com, ihate*, telegram ops reviewer id (bot admins stay in .env).
-- KEEP config: platform_settings/chrome, feature_flags rows, RBAC, notification_kinds,
--              site_legal_sections, email_domain_denylist, payment_accounts (if any).
-- CLEAR: games/matches, tournaments, events, ledger/receipts/payouts/notifications,
--        ads, social, audit/geo/otp/kyc/devices, non-kept users (incl. fake admins).

BEGIN;

CREATE TEMP TABLE keep_users AS
SELECT id
FROM users
WHERE email = 'bereketgezha@gmail.com'
   OR username ILIKE 'ihate%'
   OR email ILIKE '%ihate%'
   OR id = '29c29227-d741-45eb-8c9e-93583bf1ab37';

UPDATE feature_flags
SET updated_by = NULL
WHERE updated_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM keep_users k WHERE k.id = updated_by);

UPDATE game_chat_settings
SET updated_by = NULL
WHERE updated_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM keep_users k WHERE k.id = updated_by);

UPDATE youtube_upload_jobs
SET publisher_id = NULL
WHERE publisher_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM keep_users k WHERE k.id = publisher_id);

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
  app_notifications,
  ad_impression_events,
  ad_unique_viewers,
  ad_campaigns,
  dm_message_reactions,
  dm_thread_reads,
  dm_messages,
  dm_requests,
  dm_threads,
  friend_requests,
  player_friends,
  device_fingerprints,
  otp_challenges,
  kyc_document_submissions,
  user_activity_days,
  audit_log,
  platform_visit_days,
  geo_ip_records,
  youtube_upload_jobs,
  youtube_channels
RESTART IDENTITY;

DELETE FROM wallets w
WHERE NOT EXISTS (SELECT 1 FROM keep_users k WHERE k.id = w.user_id);

DELETE FROM user_payout_methods m
WHERE NOT EXISTS (SELECT 1 FROM keep_users k WHERE k.id = m.user_id);

DELETE FROM users u
WHERE NOT EXISTS (SELECT 1 FROM keep_users k WHERE k.id = u.id);

DO $$
DECLARE
  n_settings int;
  n_flags int;
  n_rbac int;
  n_kinds int;
  n_legal int;
  n_users int;
  n_ihate int;
  n_bereket int;
  n_ops int;
  n_ads int;
  n_dm int;
  n_audit int;
  n_matches int;
  n_tournaments int;
  n_events int;
  n_ledger int;
  n_receipts int;
  n_payouts int;
  n_notifs int;
  n_admin_extra int;
BEGIN
  SELECT COUNT(*) INTO n_settings FROM platform_settings;
  SELECT COUNT(*) INTO n_flags FROM feature_flags;
  SELECT COUNT(*) INTO n_rbac FROM rbac_permissions;
  SELECT COUNT(*) INTO n_kinds FROM notification_kinds;
  SELECT COUNT(*) INTO n_legal FROM site_legal_sections;
  SELECT COUNT(*) INTO n_users FROM users;
  SELECT COUNT(*) INTO n_ihate FROM users WHERE username ILIKE 'ihate%' OR email ILIKE '%ihate%';
  SELECT COUNT(*) INTO n_bereket FROM users WHERE email = 'bereketgezha@gmail.com';
  SELECT COUNT(*) INTO n_ops FROM users WHERE id = '29c29227-d741-45eb-8c9e-93583bf1ab37';
  SELECT COUNT(*) INTO n_ads FROM ad_campaigns;
  SELECT COUNT(*) INTO n_dm FROM dm_messages;
  SELECT COUNT(*) INTO n_audit FROM audit_log;
  SELECT COUNT(*) INTO n_matches FROM matches;
  SELECT COUNT(*) INTO n_tournaments FROM tournaments;
  SELECT COUNT(*) INTO n_events FROM hosted_events;
  SELECT COUNT(*) INTO n_ledger FROM wallet_ledger;
  SELECT COUNT(*) INTO n_receipts FROM payment_receipts;
  SELECT COUNT(*) INTO n_payouts FROM payout_requests;
  SELECT COUNT(*) INTO n_notifs FROM app_notifications;
  SELECT COUNT(*) INTO n_admin_extra FROM users
    WHERE role IN ('admin', 'superadmin', 'console')
      AND email <> 'bereketgezha@gmail.com'
      AND id <> '29c29227-d741-45eb-8c9e-93583bf1ab37';

  IF n_settings < 1 OR n_flags < 1 OR n_rbac < 1 OR n_kinds < 1 OR n_legal < 1 THEN
    RAISE EXCEPTION 'fail-closed: config/catalog/legal missing';
  END IF;
  IF n_bereket <> 1 THEN
    RAISE EXCEPTION 'fail-closed: bereketgezha admin missing';
  END IF;
  IF n_ihate < 1 THEN
    RAISE EXCEPTION 'fail-closed: ihate users missing';
  END IF;
  IF n_ops <> 1 THEN
    RAISE EXCEPTION 'fail-closed: telegram ops reviewer missing';
  END IF;
  IF n_matches <> 0 OR n_tournaments <> 0 OR n_events <> 0 OR n_ledger <> 0 OR n_receipts <> 0 OR n_payouts <> 0 OR n_notifs <> 0 THEN
    RAISE EXCEPTION 'fail-closed: agreed runtime data not fully cleared';
  END IF;
  IF n_ads <> 0 OR n_dm <> 0 OR n_audit <> 0 THEN
    RAISE EXCEPTION 'fail-closed: leftover ads/social/audit not cleared';
  END IF;
  IF n_admin_extra <> 0 THEN
    RAISE EXCEPTION 'fail-closed: extra admin users remain';
  END IF;
  IF n_users <> (n_ihate + n_bereket + n_ops) THEN
    RAISE EXCEPTION 'fail-closed: unexpected leftover users=% (ihate=% bereket=% ops=%)',
      n_users, n_ihate, n_bereket, n_ops;
  END IF;

  RAISE NOTICE 'live_cleanup_ok settings=% flags=% rbac=% kinds=% legal=% users=% ihate=% ops=%',
    n_settings, n_flags, n_rbac, n_kinds, n_legal, n_users, n_ihate, n_ops;
END $$;

COMMIT;
