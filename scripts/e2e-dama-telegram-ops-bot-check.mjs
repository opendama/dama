/**
 * Static + live locks for Dama ↔ shared telegram_bot manual payment ops bridge.
 * Usage: node scripts/e2e-dama-telegram-ops-bot-check.mjs
 * Optional: DAMA_API_BASE=http://127.0.0.1:18080/api/v1
 * Full submit→notify capture→bot approve/paid (local docker): node tmp/live-telegram-ops-notify-e2e.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = (process.env.DAMA_API_BASE || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failed += 1;
  } else {
    console.log(`OK: ${msg}`);
  }
}

function read(rel) {
  const p = join(root, rel);
  assert(existsSync(p), `exists ${rel}`);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const mig = read("apps/api/migrations/415_telegram_ops_bot_manual_payments.sql");
assert(
  /telegram_ops_bot/.test(mig) && /dama_receipt_pending/.test(mig),
  "mig 415 seeds telegram_ops_bot",
);
assert(/telegram_ops_page_title/.test(mig), "mig 415 admin chrome for telegram ops page");
assert(
  /pay-telegram-ops/.test(mig) && /\/payments\/telegram-ops/.test(mig),
  "mig 415 console nav telegram ops",
);
assert(
  /EXCLUDED\.value \|\| platform_settings\.value/.test(mig),
  "mig 415 re-apply preserves ops secrets",
);

const mig416 = read("apps/api/migrations/416_telegram_ops_bot_chrome_receipt_note.sql");
assert(
  /review_note/.test(mig416) && /menu_receipts_label/.test(mig416),
  "mig 416 review_note + bot menu chrome",
);
assert(/telegram_ops_ready_label/.test(mig416), "mig 416 admin ready chrome");

const mig417 = read("apps/api/migrations/417_telegram_ops_bot_no_hardcode_chrome.sql");
assert(
  /err_not_allowed/.test(mig417) && /note_approved_by_template/.test(mig417),
  "mig 417 bot err/note chrome",
);
assert(
  /review_note_approved_prefix/.test(mig417) && /user_fallback_template/.test(mig417),
  "mig 417 review note prefixes",
);

const mig418 = read("apps/api/migrations/418_telegram_ops_bot_status_errors_timeout.sql");
assert(
  /receipt_pending_status/.test(mig418) && /http_client_timeout_seconds/.test(mig418),
  "mig 418 status + http timeout",
);
assert(
  /err_payments_unavailable/.test(mig418) && /err_bot_not_initialized/.test(mig418),
  "mig 418 API/bot error chrome",
);

const mig419 = read("apps/api/migrations/419_telegram_ops_bot_reload_hub_limit.sql");
assert(/hub_list_limit/.test(mig419), "mig 419 hub_list_limit");
assert(
  /telegram_ops_settings_unavailable/.test(mig419) && /telegram_ops_save_invalid/.test(mig419),
  "mig 419 admin console err chrome",
);

const mig420 = read("apps/api/migrations/420_telegram_ops_bot_review_err_lang.sql");
assert(
  /err_receipt_review_failed/.test(mig420) && /reject_keyboard_lang/.test(mig420),
  "mig 420 review err + reject lang",
);

const mig421 = read("apps/api/migrations/421_telegram_ops_bot_message_templates.sql");
assert(
  /hub_receipt_button_template/.test(mig421) && /receipt_notify_html_template/.test(mig421),
  "mig 421 hub/notify templates",
);
assert(
  /receipt_detail_html_template/.test(mig421) && /action_result_md_template/.test(mig421),
  "mig 421 detail/action templates",
);
assert(
  /action_reject_result_md_template/.test(mig421) && /hub_header_md_template/.test(mig421),
  "mig 421 reject/hub header templates",
);

const mig422 = read("apps/api/migrations/422_telegram_ops_bot_reject_reason_required.sql");
assert(/err_reject_reason_required/.test(mig422), "mig 422 reject reason required chrome");

const mig423 = read("apps/api/migrations/423_telegram_ops_bot_console_nav_sales.sql");
assert(
  /pay-telegram-ops/.test(mig423) && /pay-receipts/.test(mig423),
  "mig 423 injects telegram ops into payment section by item id",
);
assert(/\/payments\/telegram-ops/.test(mig423), "mig 423 keeps /payments/telegram-ops href");
assert(
  !/sec->>'id' = 'payments'/.test(mig423),
  "mig 423 does not rely on sections.id=payments only",
);

const mig424 = read("apps/api/migrations/424_telegram_ops_bot_err_no_admins.sql");
assert(/err_no_telegram_admins/.test(mig424), "mig 424 err_no_telegram_admins chrome");

const mig425 = read("apps/api/migrations/425_telegram_ops_bot_refund_err_full.sql");
assert(/err_refund_failed_prefix/.test(mig425), "mig 425 refund err full chrome key");
assert(
  /Wallet refund after payout reject failed/.test(mig425),
  "mig 425 upgrades truncated refund seed",
);

const notify = read("apps/api/internal/telegramops/notify.go");
assert(
  /NotifyReceiptPending/.test(notify) && /NotifyPayoutPending/.test(notify),
  "Go telegramops notify helpers",
);
assert(/X-Bot-Key/.test(notify), "Go notify sends X-Bot-Key");
assert(/bot_api_key missing/.test(notify), "Go notify fails closed when bot_api_key missing");
assert(!/timeout = 10 \* time\.Second/.test(notify), "Go notify does not invent 10s timeout");
assert(/notify_timeout_ms missing/.test(notify), "Go notify fails closed when timeout missing");
const notifyTest = read("apps/api/internal/telegramops/notify_test.go");
assert(
  /TestPostNotifySendsBotKeyAndJSON/.test(notifyTest),
  "notify unit covers X-Bot-Key+JSON POST",
);
assert(
  /TestPostNotifyFailsClosedWithoutTimeout/.test(notifyTest),
  "notify unit covers missing timeout fail-closed",
);
assert(
  /TestPostNotifyFailsClosedWithoutBotKey/.test(notifyTest),
  "notify unit covers missing bot key fail-closed",
);
const botAuthTest = read("apps/api/internal/rest/telegram_bot_auth_test.go");
assert(
  /TestRejectReceiptRequiresNonEmptyReason/.test(botAuthTest),
  "bot auth unit covers empty reject reason",
);
assert(
  /TestRejectReceiptWithReasonPassesGate/.test(botAuthTest),
  "bot auth unit covers reject reason gate pass",
);
assert(/TestRequireBotKeyWrongKey/.test(botAuthTest), "bot auth unit covers wrong X-Bot-Key 401");
assert(/TestRequireBotKeyMissing/.test(botAuthTest), "bot auth unit covers missing X-Bot-Key 401");
assert(
  /TestGetChromeFailsClosedWhenCashNil/.test(botAuthTest),
  "bot auth unit covers GetChrome Cash nil 503",
);
assert(
  /TestGetChromeFailsClosedWhenCashNotReady/.test(botAuthTest),
  "bot auth unit covers GetChrome Cash not Ready 503",
);
assert(
  /ReplaceTelegramOpsBotMemory/.test(
    read("apps/api/internal/store/settings_telegram_ops_test_helper.go"),
  ),
  "settings test helper injects telegram ops memory",
);
const botHandlers = read("apps/api/internal/rest/telegram_bot_handlers.go");
assert(/TelegramBotAPI/.test(botHandlers), "Go TelegramBotAPI adapter");
assert(
  /ListPendingReceipts/.test(botHandlers) && /MarkPayoutPaid/.test(botHandlers),
  "Go bot receipt+payout routes",
);
assert(
  /requireBotKey/.test(botHandlers) && /ConstantTimeCompare/.test(botHandlers),
  "Go bot X-Bot-Key auth",
);
assert(
  /ReloadTelegramOpsBot\(r\.Context\(\)\)/.test(botHandlers),
  "Go bot requireBotKey reloads settings",
);
assert(
  /GetChrome/.test(botHandlers) && /ApprovedPayoutStatus/.test(botHandlers),
  "Go chrome + approved payout hub",
);
assert(
  /payout_approvable_status/.test(botHandlers) && /payout_approved_status/.test(botHandlers),
  "Go chrome exports cash policy statuses",
);
assert(
  /payout_rejected_status/.test(botHandlers) && /payout_paid_status/.test(botHandlers),
  "Go chrome exports rejected+paid cash policy statuses",
);
assert(
  /Cash == nil \|\| !a\.Cash\.Ready\(\)/.test(botHandlers) &&
    /ErrPaymentsUnavailable/.test(botHandlers),
  "Go GetChrome fails closed when Cash not Ready",
);
assert(/HubListLimit/.test(botHandlers), "Go hub uses DB hub_list_limit");
assert(
  /listErr/.test(botHandlers) && /ErrFetchFailed/.test(botHandlers),
  "Go receipt hub surfaces list DB errors",
);
assert(
  /ReviewReceipt\(/.test(botHandlers) && /botTelegramAdminNote/.test(botHandlers),
  "Go bot persists review note",
);
assert(
  /Query\(\)\.Get\("reason"\)/.test(botHandlers) &&
    /Query\(\)\.Get\("admin_telegram_id"\)/.test(botHandlers),
  "Go bot reads reject reason + admin_telegram_id from query",
);
assert(
  /ErrRejectReasonRequired/.test(botHandlers) && /Get\("reason"\)\) == ""/.test(botHandlers),
  "Go reject fails closed when reason empty",
);
assert(
  /ReviewNoteReasonTemplate/.test(botHandlers),
  "Go reject note uses DB review_note_reason_template",
);
assert(/ReviewNoteApprovedPrefix/.test(botHandlers), "Go review notes use DB prefixes");
assert(
  /KindPlayerReceiptReviewed/.test(botHandlers) && /KindPlayerPayoutUpdated/.test(botHandlers),
  "Go bot reject/approve still emits in-app player notifs",
);
assert(
  /RejectPayoutAndRefund/.test(botHandlers) && /wallet_credited:payout_reject:/.test(botHandlers),
  "Go bot payout reject refunds wallet atomically",
);
assert(
  /ErrPaymentsUnavailable/.test(botHandlers) && /ErrInvalidPayoutTransition/.test(botHandlers),
  "Go bot errors use DB chrome",
);
assert(
  /ErrReceiptReviewFailed/.test(botHandlers) && /ErrPayoutReviewFailed/.test(botHandlers),
  "Go review failures use DB chrome",
);
assert(!/err\.Error\(\)/.test(botHandlers), "Go bot handlers never leak err.Error()");
assert(
  /telegram_ops_settings_unavailable/.test(botHandlers) &&
    /telegram_ops_save_invalid/.test(botHandlers),
  "Go console uses admin chrome errors",
);
assert(
  !/"settings unavailable"/.test(botHandlers) &&
    !/"telegram_ops_bot unavailable"/.test(botHandlers),
  "Go console has no English hardcodes",
);
assert(
  !/telegram ops bot not configured/.test(botHandlers),
  "Go bot auth has no English hardcode fallbacks",
);
assert(
  !/"payments unavailable"/.test(botHandlers) && !/"payout not found"/.test(botHandlers),
  "Go bot handlers have no English infra hardcodes",
);
assert(/error_key/.test(botHandlers), "Go writeBotErr includes error_key");
assert(
  /msg == ""/.test(botHandlers) && /errorKey/.test(botHandlers),
  "Go writeBotErr never emits empty error string",
);

const mainGo = read("apps/api/cmd/server/main.go");
assert(/telegram-bot\/admin\/dama/.test(mainGo), "main registers /telegram-bot/admin/dama");
assert(/\/chrome/.test(mainGo), "main registers dama chrome route");
assert(/telegram-ops-bot/.test(mainGo), "main registers console telegram-ops-bot");

const submitPay = read("apps/api/internal/rest/payments_handlers.go");
assert(/NotifyReceiptPending/.test(submitPay), "SubmitReceipt notifies telegram ops");
assert(/ReloadTelegramOpsBot/.test(submitPay), "SubmitReceipt reloads telegram ops before notify");
assert(
  /Telegram notify only needs Settings|Keep them independent/.test(submitPay) &&
    /if a\.Settings != nil/.test(submitPay),
  "SubmitReceipt notify is not gated on EmitAdmins/DB block",
);
const submitPo = read("apps/api/internal/rest/payout_handlers.go");
assert(/NotifyPayoutPending/.test(submitPo), "CreateRequest notifies telegram ops");
assert(/ReloadTelegramOpsBot/.test(submitPo), "CreateRequest reloads telegram ops before notify");
assert(
  /Telegram notify only needs Settings/.test(submitPo) && /if a\.Settings != nil/.test(submitPo),
  "CreateRequest notify is not gated on EmitAdmins/DB block",
);

const settings = read("apps/api/internal/store/settings.go");
assert(
  /TelegramOpsBotConfig/.test(settings) && /ReloadTelegramOpsBot/.test(settings),
  "settings telegram_ops_bot loader",
);
assert(
  /TelegramOpsBotReady[\s\S]{0,400}?NotifyTimeoutMS\s*>\s*0/.test(settings),
  "TelegramOpsBotReady requires notify_timeout_ms",
);
assert(
  /ErrNotAllowed/.test(settings) && /NoteApprovedByTemplate/.test(settings),
  "settings loads 417 chrome fields",
);
assert(
  /ReceiptPendingStatus/.test(settings) && /HTTPClientTimeoutSeconds/.test(settings),
  "settings loads 418 chrome fields",
);
assert(/HubListLimit/.test(settings), "settings loads 419 hub_list_limit");
assert(
  /ErrReceiptReviewFailed/.test(settings) && /RejectKeyboardLang/.test(settings),
  "settings loads 420 review chrome",
);
assert(
  /ErrRejectReasonRequired/.test(settings) && /err_reject_reason_required/.test(settings),
  "settings loads 422 reject reason required",
);
assert(
  /ErrNoTelegramAdmins/.test(settings) && /err_no_telegram_admins/.test(settings),
  "settings loads 424 no-admins chrome",
);
assert(
  /HubReceiptButtonTemplate/.test(settings) && /ReceiptNotifyHTMLTemplate/.test(settings),
  "settings loads 421 message templates",
);
assert(
  /ActionRejectResultMDTemplate/.test(settings) && /HubHeaderMDTemplate/.test(settings),
  "settings loads 421 hub/action templates",
);
assert(
  /ReloadTelegramOpsBot\(ctx\).*[\s\S]*mergeTelegramOpsChrome/s.test(settings) ||
    /Always reload DB before merge/.test(settings),
  "SetTelegramOpsBot reloads before merge",
);
assert(
  /cfg\.BotServiceURL == ""[\s\S]*cur\.BotServiceURL/.test(settings) &&
    /cfg\.ReviewerUserID == ""[\s\S]*cur\.ReviewerUserID/.test(settings),
  "SetTelegramOpsBot preserves empty URL+reviewer",
);
assert(
  /EXISTS\(SELECT 1 FROM users WHERE id = \$1::uuid\)/.test(settings),
  "SetTelegramOpsBot validates reviewer exists in users",
);
assert(
  /Heal dead reviewer|telegramOpsReviewerExists/.test(settings) &&
    /reviewer_user_id.*""/.test(settings),
  "Reload heals dead reviewer_user_id",
);
assert(
  /heal dead reviewer: %w/.test(settings) ||
    /heal dead reviewer: database unavailable/.test(settings),
  "Reload heal surfaces UPDATE/DB errors (no silent discard)",
);
const usersHard = read("apps/api/internal/store/users.go");
assert(
  /telegram_ops_bot[\s\S]*reviewer_user_id/.test(usersHard),
  "HardDelete clears telegram_ops reviewer_user_id",
);
const botKeyLive = read("apps/api/internal/rest/telegram_bot_handlers.go");
assert(/TelegramOpsReviewerAlive/.test(botKeyLive), "requireBotKey re-checks reviewer EXISTS");

const damaOps = read("../telegram_bot/dama_ops.py");
assert(/dama_notify_kind/.test(damaOps), "shared bot dama_notify_kind DB type routing");
assert(
  /notify_receipt_type/.test(damaOps) && /notify_payout_type/.test(damaOps),
  "shared bot matches DB notify types",
);
assert(
  /DAMA_API_BASE_URL/.test(damaOps) && /call_dama_backend/.test(damaOps),
  "shared bot call_dama_backend",
);
assert(
  /if not DAMA_API_BASE_URL or not DAMA_BOT_API_KEY:/.test(damaOps),
  "call_dama_backend fails closed without bot key",
);
assert(
  /headers = \{"X-Bot-Key": DAMA_BOT_API_KEY\}/.test(damaOps),
  "call_dama_backend always sends X-Bot-Key",
);
assert(
  /detail\.get\("error"\)/.test(damaOps) && /_operator_err/.test(damaOps),
  "call_dama_backend surfaces API error chrome via _operator_err",
);
assert(
  /return bool\(DAMA_API_BASE_URL and DAMA_BOT_API_KEY\)/.test(damaOps),
  "dama_configured requires URL+key",
);
assert(
  /adm_dama_rcpt/.test(damaOps) && /adm_dama_po/.test(damaOps),
  "shared bot Dama callback prefixes",
);
// Telegram callback_data max 64 bytes - UUID-based Dama prefixes must fit.
{
  const uuid = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx";
  const samples = [
    `adm_dama_rcpt:approve:${uuid}`,
    `adm_dama_rcpt:reject:${uuid}`,
    `adm_dama_rcpt_det:${uuid}`,
    `adm_dama_po:approve:${uuid}`,
    `adm_dama_po:reject:${uuid}`,
    `adm_dama_po:paid:${uuid}`,
    `adm_dama_po_det:${uuid}`,
  ];
  for (const s of samples) {
    assert(Buffer.byteLength(s, "utf8") <= 64, `callback bytes<=64 for ${s}`);
  }
}
assert(
  /params=\{[\s\S]*?reason[\s\S]*?\}/.test(damaOps) && /admin_telegram_id/.test(damaOps),
  "dama_ops reject passes reason+admin_telegram_id as query params",
);
assert(
  /reject_reason_prompt_receipt/.test(damaOps) && /reject_reason_prompt_payout/.test(damaOps),
  "dama_ops reject prompts from DB chrome",
);
assert(!/BACKEND_API_URL/.test(damaOps), "dama_ops never references BACKEND_API_URL");
assert(
  /ensure_chrome/.test(damaOps) && /\/telegram-bot\/admin\/dama\/chrome/.test(damaOps),
  "dama_ops loads DB chrome",
);
assert(
  /product_label/.test(damaOps) && /notify_title/.test(damaOps),
  "dama_ops uses product_label/notify_title",
);
assert(
  /err_not_allowed/.test(damaOps) && /note_approved_by_template/.test(damaOps),
  "dama_ops uses DB err/note templates",
);
assert(
  !/Not allowed/.test(damaOps) && !/Bad callback/.test(damaOps),
  "dama_ops has no hardcoded allow/callback English",
);
assert(
  /receipt_pending_status/.test(damaOps) && /payout_approvable_status/.test(damaOps),
  "dama_ops gates on DB status strings",
);
assert(
  /_chrome_fresh[\s\S]*?payout_approvable_status[\s\S]*?payout_paid_status/.test(damaOps),
  "dama_ops chrome freshness requires full payout cash-policy statuses",
);
assert(
  /ensure_chrome[\s\S]*?payout_approvable_status[\s\S]*?payout_paid_status[\s\S]*?_CHROME = data/.test(
    damaOps,
  ),
  "dama_ops ensure_chrome refuses to cache chrome missing payout cash-policy statuses",
);
assert(
  /err_reject_reason_required/.test(damaOps) && /if not reason:/.test(damaOps),
  "dama_ops fails closed on empty reject reason",
);
assert(
  /if not receipt_id:/.test(damaOps) && /if not payout_id:/.test(damaOps),
  "dama_ops fails closed on missing related_entity_id",
);
assert(
  /if not admin_ids:/.test(damaOps) && /err_no_telegram_admins/.test(damaOps),
  "dama_ops fails closed when Telegram admin set empty",
);
assert(
  /success == 0/.test(damaOps) && /err_no_telegram_admins/.test(damaOps),
  "dama_ops fails closed when all admin DMs fail",
);
assert(/Mark paid only/.test(damaOps), "dama_ops does not reject from approved");
assert(
  /http_client_timeout_seconds/.test(damaOps) && /DAMA_HTTP_TIMEOUT_SECONDS/.test(damaOps),
  "dama_ops timeout from DB/env bootstrap",
);
assert(!/timeout: float = 30\.0/.test(damaOps), "dama_ops does not invent 30s timeout default");
assert(
  /err_bot_not_initialized/.test(damaOps) && !/Bot not initialized/.test(damaOps),
  "dama_ops bot-init error is DB chrome",
);
assert(
  !/amount", "0\.0"/.test(damaOps) && !/amount', '0\.0'/.test(damaOps),
  "dama_ops does not invent amount 0.0",
);
assert(!/err_fetch_failed.*\{e\}/.test(damaOps), "dama_ops does not append exception English");
assert(
  /reject_keyboard_lang/.test(damaOps) && !/back_reply_keyboard\("en"\)/.test(damaOps),
  "dama_ops reject keyboard lang from DB",
);
assert(
  /_chrome_fresh/.test(damaOps) && /err_receipt_review_failed/.test(damaOps),
  "dama_ops chrome freshness includes 419/420 keys",
);
assert(
  /hub_receipt_button_template/.test(damaOps) && /receipt_notify_html_template/.test(damaOps),
  "dama_ops uses 421 DB message templates",
);
assert(
  /action_reject_result_md_template/.test(damaOps) && /hub_header_md_template/.test(damaOps),
  "dama_ops uses 421 hub/reject templates",
);
assert(
  !/(?:📋|✨|🧾|💸|🆔|👤|📞|💵|🖼️|💳|📑|📌|🕒|✉️|💰|✅|❌)/u.test(damaOps),
  "dama_ops has no hardcoded emoji/glyphs",
);
assert(
  /_reject_reply_markup/.test(damaOps) && /ReplyKeyboardRemove/.test(damaOps),
  "dama_ops reject keyboard fail-closed when lang empty",
);
assert(
  !/back_reply_keyboard\(chrome_str\("reject_keyboard_lang"\)\)/.test(damaOps),
  "dama_ops does not call shared back keyboard with empty lang invent path",
);
assert(
  !/menu_receipts_label_am"\)\s*\n\s*if not rcpt:/.test(damaOps) &&
    !/if not rcpt:\s*\n\s*rcpt = chrome_str\("menu_receipts_label"\)/.test(damaOps),
  "dama_ops menu does not fall back Amharic→English",
);

const botMain = read("../telegram_bot/main.py");
assert(
  /dama_ops/.test(botMain) && /dama_notify_kind/.test(botMain),
  "shared bot main wires DB notify kinds",
);
assert(/register_dama_ops/.test(botMain), "shared bot registers Dama handlers");
assert(/dama_menu_rows/.test(botMain), "shared bot admin menu adds Dama rows");
assert(
  /send_admin_menu[\s\S]*?ensure_chrome\(\)/.test(botMain),
  "send_admin_menu awaits ensure_chrome before Dama menu rows",
);
assert(
  !/notif_type in \("dama_receipt_pending"/.test(botMain),
  "shared bot main does not hardcode Dama notify types",
);
assert(
  /notif_type == "manual_payment_claim"/.test(botMain),
  "shared bot keeps legacy manual_payment_claim lane",
);
assert(
  /BACKEND_API_URL/.test(botMain) && /adm_man_pay:/.test(botMain),
  "shared bot keeps BACKEND_API_URL + adm_man_pay legacy callbacks",
);
assert(/compare_digest/.test(botMain), "shared bot notify auth uses constant-time compare");
assert(/not want/.test(botMain), "shared bot requires DAMA_BOT_API_KEY for Dama notify");
assert(
  /load_dotenv\(dotenv_path=os\.path\.join\(_bot_dir, "\.env"\)\)/.test(botMain),
  "shared bot loads telegram_bot/.env before Dama lane",
);
assert(
  /load_dotenv\(dotenv_path=os\.path\.join\(_bot_dir, "\.\.", "\.env"\)\)/.test(botMain),
  "shared bot also loads repo-root .env",
);

const damaCopy = read("telegram_bot/dama_ops.py");
assert(
  /call_dama_backend/.test(damaCopy) && /dama_notify_kind/.test(damaCopy),
  "dama/telegram_bot copy has dama_ops",
);
assert(/payout_approved_status/.test(damaCopy), "dama/telegram_bot copy has status gates");
assert(damaOps === damaCopy, "sibling telegram_bot/dama_ops.py identical to dama copy");

const adminPage = read("apps/admin/src/app/(console)/payments/telegram-ops/page.tsx");
assert(/useConsoleTelegramOpsQuery/.test(adminPage), "admin telegram-ops page");
assert(/useSaveConsoleTelegramOpsMutation/.test(adminPage), "admin telegram-ops save mutation");
assert(
  !/\|\| 10000/.test(adminPage) && !/useState\("10000"\)/.test(adminPage),
  "admin page does not invent 10000 timeout",
);
assert(
  /has_bot_api_key/.test(adminPage) && /!botApiKey\.trim\(\)/.test(adminPage),
  "admin enable Save requires bot_api_key when DB has none yet",
);

const chromeTs = read("apps/admin/src/types/admin-console-chrome.ts");
assert(/telegram_ops_page_title/.test(chromeTs), "admin chrome keys include telegram ops");
assert(
  /telegram_ops_settings_unavailable/.test(chromeTs) && /telegram_ops_save_invalid/.test(chromeTs),
  "admin chrome keys include 419 console errors",
);

const chromeGo = read("apps/api/internal/rest/chrome_handlers.go");
assert(
  /"telegram_ops_page_title"/.test(chromeGo) && /"telegram_ops_save_invalid"/.test(chromeGo),
  "Go AdminConsoleChrome payments REQUIRED includes telegram_ops keys",
);

const paymentsSvc = read("apps/api/internal/payments/service.go");
assert(
  /ListPendingReceiptsPaged\(ctx context\.Context, skip, limit int, q, status string\) \(\[\]Receipt, int, error\)/.test(
    paymentsSvc,
  ),
  "ListPendingReceiptsPaged returns error",
);
assert(/return nil, 0, err/.test(paymentsSvc), "ListPendingReceiptsPaged propagates DB errors");
assert(
  /ErrReceiptAlreadyReviewed/.test(paymentsSvc),
  "payments exports ErrReceiptAlreadyReviewed for dual-actuator 409",
);
assert(/ErrReceiptNotFound/.test(paymentsSvc), "payments exports ErrReceiptNotFound");
const payHandlersConflict = read("apps/api/internal/rest/payments_handlers.go");
assert(
  /ErrReceiptAlreadyReviewed/.test(payHandlersConflict) &&
    /StatusConflict/.test(payHandlersConflict),
  "console ReviewReceipt returns 409 on dual-actuator conflict",
);
assert(
  /ErrReceiptNotFound/.test(botHandlers) && /ErrReceiptAlreadyReviewed/.test(botHandlers),
  "bot reviewReceipt distinguishes not-found 404 vs already-reviewed 409",
);
assert(
  /errors\.Is\(err, payments\.ErrReceiptNotFound\)/.test(botHandlers) &&
    /StatusNotFound/.test(botHandlers) &&
    /StatusInternalServerError/.test(botHandlers) &&
    /ErrReceiptReviewFailed/.test(botHandlers),
  "bot reviewReceipt maps unexpected review errors to 500 not 409",
);
assert(
  /ErrPayoutNotFound/.test(read("apps/api/internal/store/payouts.go")),
  "store exports ErrPayoutNotFound",
);
assert(
  /errors\.Is\(err, store\.ErrPayoutNotFound\)/.test(botHandlers) &&
    /errors\.Is\(err, store\.ErrPayoutTransitionConflict\)/.test(botHandlers),
  "bot payout handlers use errors.Is for not-found + transition conflict",
);
assert(
  /errors\.Is\(err, pgx\.ErrNoRows\)/.test(paymentsSvc) && /ErrReceiptNotFound/.test(paymentsSvc),
  "loadReceipt maps only pgx.ErrNoRows to ErrReceiptNotFound",
);
assert(
  /StatusInternalServerError/.test(payHandlersConflict) &&
    /toast_receipt_failed/.test(payHandlersConflict),
  "console ReviewReceipt maps unexpected errors to 500 not fake 404",
);
assert(
  /TestApproveReceiptMissingIDReturns404/.test(
    read("apps/api/internal/rest/telegram_bot_auth_test.go"),
  ) &&
    /TestApproveReceiptAlreadyReviewedReturns409/.test(
      read("apps/api/internal/rest/telegram_bot_auth_test.go"),
    ) &&
    /TestGetReceiptMissingIDReturns404/.test(
      read("apps/api/internal/rest/telegram_bot_auth_test.go"),
    ),
  "unit covers bot receipt get/approve 404 and dual-actuator 409",
);
assert(
  /SELECT EXISTS\(SELECT 1 FROM payout_requests WHERE id/.test(
    read("apps/api/internal/store/payouts.go"),
  ) &&
    /SELECT EXISTS\(SELECT 1 FROM payout_requests WHERE id/.test(
      read("apps/api/internal/payments/service.go"),
    ),
  "payout ReviewRequest + RejectPayoutAndRefund EXISTS-check missing id vs conflict",
);
assert(
  /SELECT EXISTS\(SELECT 1 FROM payment_receipts WHERE id/.test(
    read("apps/api/internal/payments/service.go"),
  ),
  "ReviewReceipt EXISTS-check missing id vs already-reviewed on RowsAffected=0",
);
assert(
  /uuid\.Parse\(receiptID\)/.test(read("apps/api/internal/payments/service.go")) &&
    /uuid\.Parse\(id\)/.test(read("apps/api/internal/store/payouts.go")),
  "loadReceipt + GetRequest map invalid UUID to not-found before query",
);
assert(
  !/errors\.Is\(err, payments\.ErrReceiptNotFound\) \|\| rec == nil/.test(
    read("apps/api/internal/rest/telegram_bot_handlers.go"),
  ) &&
    !/errors\.Is\(err, store\.ErrPayoutNotFound\) \|\| p == nil/.test(
      read("apps/api/internal/rest/telegram_bot_handlers.go"),
    ) &&
    !/errors\.Is\(err, store\.ErrPayoutNotFound\) \|\| current == nil/.test(
      read("apps/api/internal/rest/telegram_bot_handlers.go"),
    ),
  "bot handlers do not fake 404 via || nil on unexpected get errors",
);
assert(
  /invalid receipt uuid|badUuidReceipt/.test(read("tmp/live-telegram-ops-auth-negatives.mjs")) &&
    /missing payout paid|missingPaid/.test(read("tmp/live-telegram-ops-auth-negatives.mjs")) &&
    /missing receipt reject|missingReject/.test(read("tmp/live-telegram-ops-auth-negatives.mjs")),
  "auth-negatives live covers invalid UUID + missing reject/paid 404",
);
assert(
  read("docs/architecture.md").includes("|| rec == nil") ||
    read("docs/architecture.md").includes("empty/invalid UUID"),
  "architecture documents invalid UUID + no fake 404 via || nil",
);
assert(
  /missingApprove|missing receipt approve/.test(read("tmp/live-telegram-ops-auth-negatives.mjs")) &&
    /missingPoApprove|missing payout approve/.test(
      read("tmp/live-telegram-ops-auth-negatives.mjs"),
    ),
  "auth-negatives live covers missing receipt+payout approve 404",
);
assert(
  /Shared Telegram ops bot|415/.test(read("docs/dama_prd_sad.html")) &&
    /dama_receipt_pending|X-Bot-Key/.test(read("docs/dama_prd_sad.html")),
  "dama_prd_sad.html documents telegram ops bridge",
);
assert(
  read("README.md").includes("404") &&
    read("README.md").includes("409") &&
    read("README.md").includes("500"),
  "root README documents review HTTP taxonomy",
);
assert(
  /missing receipt GET|missingReceipt/.test(read("tmp/live-telegram-ops-auth-negatives.mjs")) &&
    /missing payout GET|missingPayout/.test(read("tmp/live-telegram-ops-auth-negatives.mjs")),
  "auth-negatives live covers missing receipt+payout GET 404",
);
assert(
  /errors\.Is\(err, payments\.ErrReceiptNotFound\)/.test(
    read("apps/api/internal/rest/payments_handlers.go"),
  ) &&
    /GetConsoleReceipt/.test(read("apps/api/internal/rest/payments_handlers.go")) &&
    /StatusInternalServerError/.test(read("apps/api/internal/rest/payments_handlers.go")),
  "console GetConsoleReceipt distinguishes not-found 404 vs unexpected 500",
);
assert(
  read("docs/architecture.md").includes("EXISTS") &&
    read("docs/architecture.md").includes("RowsAffected"),
  "architecture documents payout RowsAffected EXISTS not-found vs conflict",
);
assert(
  read("docs/architecture.md").includes("payment_receipts") &&
    /EXISTS-checks so a deleted id|EXISTS.*deleted id/.test(read("docs/architecture.md")),
  "architecture documents receipt RowsAffected EXISTS not-found vs already-reviewed",
);
assert(
  /errors\.Is\(err, store\.ErrPayoutNotFound\)/.test(
    read("apps/api/internal/rest/payout_handlers.go"),
  ) && /StatusInternalServerError/.test(read("apps/api/internal/rest/payout_handlers.go")),
  "console payout review distinguishes not-found 404 vs unexpected 500",
);
const archOps = read("docs/architecture.md");
assert(
  archOps.includes("loadReceipt") &&
    archOps.includes("pgx.ErrNoRows") &&
    archOps.includes("ErrPayoutNotFound") &&
    archOps.includes("**500**"),
  "architecture documents receipt/payout 404/409/500 taxonomy",
);
assert(
  read("docs/prd-compliance.md").includes("loadReceipt") &&
    read("docs/prd-compliance.md").includes("ErrPayoutNotFound"),
  "prd-compliance documents receipt/payout error taxonomy",
);
assert(
  /missing id → \*\*404\*\*|missing id -> \*\*404\*\*|404\/409\/500/.test(
    read("telegram_bot/readme/readme.md"),
  ) ||
    (read("telegram_bot/readme/readme.md").includes("404") &&
      read("telegram_bot/readme/readme.md").includes("409") &&
      read("telegram_bot/readme/readme.md").includes("500")),
  "bot readme documents Dama review HTTP taxonomy",
);
const botRootReadme = read("telegram_bot/README.md");
assert(
  /readme\/readme\.md/.test(botRootReadme) && /DAMA_API_BASE_URL/.test(botRootReadme),
  "bot root README points to readme/readme.md + Dama env",
);
assert(
  !/Getting started/.test(botRootReadme) || /Dama/.test(botRootReadme),
  "bot root README is not bare GitLab stub",
);
assert(
  existsSync(join(root, "tmp/live-telegram-ops-parallel-race.mjs")),
  "exists tmp/live-telegram-ops-parallel-race.mjs",
);
assert(
  /Promise\.all/.test(read("tmp/live-telegram-ops-parallel-race.mjs")),
  "parallel race harness fires console+bot together",
);

const readmeBot = read("telegram_bot/readme/readme.md");
assert(
  /DAMA_HTTP_TIMEOUT_SECONDS/.test(readmeBot),
  "bot readme documents DAMA_HTTP_TIMEOUT_SECONDS",
);
assert(/reject_keyboard_lang/.test(readmeBot), "bot readme documents reject_keyboard_lang");
assert(
  /415–422|415-422|415–423|415-423|415–424|415-424|415–425|415-425|err_reject_reason_required/.test(
    readmeBot,
  ),
  "bot readme documents mig 422 reject reason",
);
assert(
  /call_dama_backend surfaces|surfaces Dama API/.test(readmeBot) && /425/.test(readmeBot),
  "bot readme documents API error chrome + mig 425",
);
assert(
  /err_no_telegram_admins|TELEGRAM_ADMIN_IDS/.test(readmeBot),
  "bot readme documents empty-admin fail-closed",
);
assert(
  /manual_payment_claim|adm_man_pay|BACKEND_API_URL/.test(readmeBot),
  "bot readme notes legacy products untouched",
);
assert(
  /live-telegram-ops-notify-e2e|submit→notify|host\.docker\.internal/.test(readmeBot),
  "bot readme documents live notify E2E / docker bot_service_url",
);

const liveE2E = read("tmp/live-telegram-ops-notify-e2e.mjs");
assert(
  /dama_receipt_pending/.test(liveE2E) && /dama_payout_pending/.test(liveE2E),
  "live E2E covers receipt+payout notify types",
);
assert(
  /host\.docker\.internal/.test(liveE2E) && /X-Bot-Key/.test(liveE2E),
  "live E2E capture uses docker-reachable URL + bot key",
);
assert(
  /\/paid/.test(liveE2E) && /approve/.test(liveE2E),
  "live E2E exercises payout 2-step approve+paid",
);
assert(
  /\/reject\?/.test(liveE2E) && /reason=/.test(liveE2E) && /review_note/.test(liveE2E),
  "live E2E covers reject reason persistence",
);
assert(
  /reject\?admin_telegram_id=/.test(liveE2E) && /status === 400/.test(liveE2E),
  "live E2E covers empty reject reason 400",
);

const adminLive = read("tmp/live-telegram-ops-admin-console-check.mjs");
assert(
  /console\/telegram-ops-bot/.test(adminLive),
  "admin live covers console telegram-ops-bot GET",
);
assert(/pay-telegram-ops/.test(adminLive), "admin live asserts sidebar pay-telegram-ops");
assert(
  /payments\/receipts\/.*\/review/.test(adminLive),
  "admin live covers JWT console receipt review",
);
assert(
  /status === 409/.test(adminLive) && /mark-paid from pending/.test(adminLive),
  "admin live covers invalid mark-paid 409",
);
assert(
  /bot payout reject after console must 409/.test(adminLive),
  "admin live covers payout reject dual-actuator 409",
);
assert(
  /PUT empty bot_service_url preserves prior/.test(adminLive) &&
    /PUT empty reviewer_user_id preserves prior/.test(adminLive),
  "admin live covers preserve-on-empty URL+reviewer",
);
assert(
  /PUT missing reviewer must 400/.test(adminLive),
  "admin live covers nonexistent reviewer 400",
);

const smokeSql = read("tmp/enable_telegram_ops_smoke.sql");
assert(
  /host\.docker\.internal/.test(smokeSql),
  "smoke SQL bot_service_url is docker-reachable (not API loopback)",
);
assert(
  /COALESCE\([\s\S]*bot_service_url[\s\S]*host\.docker\.internal:18091/.test(smokeSql),
  "smoke SQL preserves bot_service_url or defaults to capture port 18091",
);
assert(
  /COALESCE\([\s\S]*bot_api_key[\s\S]*dama-test-bot-key/.test(smokeSql),
  "smoke SQL preserves existing bot_api_key",
);
assert(
  /COALESCE\([\s\S]*reviewer_user_id/.test(smokeSql),
  "smoke SQL preserves existing reviewer_user_id",
);
assert(
  !/'bot_service_url',\s*'http:\/\/host\.docker\.internal:8080'/.test(smokeSql),
  "smoke SQL does not default bot_service_url to :8080",
);
assert(
  !/'bot_service_url',\s*'http:\/\/127\.0\.0\.1:8080'/.test(smokeSql),
  "smoke SQL does not set bot_service_url to API loopback :8080",
);

const payoutStore = read("apps/api/internal/store/payouts.go");
assert(
  /ErrPayoutTransitionConflict/.test(payoutStore),
  "payout store exports transition conflict sentinel",
);
assert(
  /WHERE id = \$1 AND status = \$5/.test(payoutStore),
  "payout ReviewRequest atomic fromStatus predicate",
);
const paymentsSvcAtomic = read("apps/api/internal/payments/service.go");
assert(
  /func \(s \*Service\) RejectPayoutAndRefund/.test(paymentsSvcAtomic),
  "payments RejectPayoutAndRefund exists",
);
assert(
  /RejectPayoutAndRefund[\s\S]*Begin\(ctx\)[\s\S]*payout_requests[\s\S]*wallets[\s\S]*Commit/.test(
    paymentsSvcAtomic,
  ),
  "RejectPayoutAndRefund single TX status+wallet",
);
const botHandlersAtomic = read("apps/api/internal/rest/telegram_bot_handlers.go");
assert(
  /RejectPayoutAndRefund/.test(botHandlersAtomic) &&
    /ErrPayoutTransitionConflict/.test(botHandlersAtomic),
  "bot payout reject uses RejectPayoutAndRefund + conflict 409",
);
assert(
  !/RejectedPayoutStatus && a\.Payments != nil[\s\S]{0,80}CreditWallet/.test(botHandlersAtomic),
  "bot payout reject does not CreditWallet after separate ReviewRequest",
);
const consolePayout = read("apps/api/internal/rest/payout_handlers.go");
assert(
  /RejectPayoutAndRefund/.test(consolePayout) && /ErrPayoutTransitionConflict/.test(consolePayout),
  "console payout reject uses RejectPayoutAndRefund + conflict 409",
);

const envExample = read(".env.example");
assert(
  /DAMA_API_BASE_URL/.test(envExample) && /DAMA_BOT_API_KEY/.test(envExample),
  "env.example documents Dama bot URL+key",
);
assert(
  /X-Bot-Key/.test(envExample) && /\/api\/v1\/notify/.test(envExample),
  "env.example documents notify inbound X-Bot-Key",
);
assert(
  /bot_service_url/.test(envExample) && /host\.docker\.internal/.test(envExample),
  "env.example documents DB bot_service_url docker reachability",
);
assert(
  /reviewer_user_id/.test(envExample) &&
    /DB\/console only|no DAMA_TELEGRAM_OPS_REVIEWER/.test(envExample),
  "env.example documents reviewer is DB-only",
);
assert(
  !/DAMA_TELEGRAM_OPS_REVIEWER_USER_ID=/.test(envExample),
  "env.example has no dead reviewer env var",
);

const siblingReadme = read("../telegram_bot/readme/readme.md");
assert(
  /415–425|415-425/.test(siblingReadme) &&
    /call_dama_backend surfaces|surfaces Dama API/.test(siblingReadme),
  "sibling bot readme covers mig 425 + API error chrome",
);

const arch = read("docs/architecture.md");
assert(
  /415–425/.test(arch) ||
    /415-425/.test(arch) ||
    ((/415–424/.test(arch) || /415-424/.test(arch)) && /425/.test(arch)),
  "architecture docs cover mig 415-425",
);
assert(/2× items|2x items|up to 2/.test(arch), "architecture notes payout hub 2x hub_list_limit");
assert(
  /pay-telegram-ops|console_nav section|sections.id/.test(arch),
  "architecture notes console_nav section inject",
);
assert(
  /err_no_telegram_admins|no Telegram admins/.test(arch),
  "architecture notes empty-admin fail-closed",
);
assert(
  /ListPendingReceiptsPaged/.test(arch) ||
    /receipt hub surfaces/.test(arch) ||
    /never swallow/.test(arch) ||
    /hub list DB errors/.test(arch),
  "architecture notes receipt hub list error surfacing",
);
assert(
  /message templates|hub_receipt_button_template|no emoji/.test(arch),
  "architecture notes DB message templates",
);
assert(
  /fails closed \(503\)|Cash is not Ready|ensure_chrome/.test(arch),
  "architecture notes GetChrome Cash fail-closed",
);
assert(/local-only|gitignored/.test(arch), "architecture notes tmp live harnesses are local-only");
assert(
  /independent of.*EmitAdmins|EmitAdmins/.test(arch) && /send_admin_menu/.test(arch),
  "architecture notes notify≠EmitAdmins + send_admin_menu chrome hydrate",
);
const prd = read("docs/prd-compliance.md");
assert(
  /415/.test(prd) &&
    /425/.test(prd) &&
    (/418–424|418-424/.test(prd) || /GetChrome fails closed/.test(prd)),
  "prd-compliance covers mig 425 + chrome freshness / GetChrome fail-closed",
);
assert(
  /notify independent of EmitAdmins|independent of EmitAdmins/.test(prd),
  "prd notes notify independent of EmitAdmins",
);
const rootReadme = read("README.md");
assert(
  /telegram_ops|Telegram ops|415–425|415-425/.test(rootReadme),
  "root README documents telegram ops bridge",
);
const apiReadme = read("apps/api/README.md");
assert(
  /telegram-bot\/admin\/dama/.test(apiReadme) && /X-Bot-Key/.test(apiReadme),
  "apps/api README documents bot adapter + X-Bot-Key",
);

const walletLive = read("tmp/live-telegram-ops-wallet-notif-check.mjs");
assert(
  /receipt_reviewed:/.test(walletLive) && /wallet_credited:/.test(walletLive),
  "wallet/notif live covers player notifs",
);
assert(
  /bot_api_key/.test(walletLive) && /reviewer_user_id/.test(walletLive),
  "wallet/notif live asserts chrome has no secrets",
);

const authLive = read("tmp/live-telegram-ops-auth-negatives.mjs");
assert(
  /wrong-key|wrong X-Bot-Key|X-Bot-Key/.test(authLive),
  "auth live covers wrong/missing X-Bot-Key",
);
assert(/err_refund_failed_prefix/.test(authLive), "auth live asserts mig 425 refund chrome");

// Live API (optional): settings row must exist after migrate.
try {
  const chromeRes = await fetch(`${base}/public/tournaments-player-chrome`);
  assert(chromeRes.status === 200, `API reachable (${chromeRes.status})`);
} catch (e) {
  console.log(`SKIP live API: ${e.message || e}`);
}

if (failed) {
  console.error(`\nFAIL: ${failed} check(s)`);
  process.exit(1);
}
console.log("\nPASS: dama telegram ops bot bridge locks");
