import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "apps/api/migrations/data/chat_emoji_catalog.json");
const catalog = fs.readFileSync(catalogPath, "utf8");
JSON.parse(catalog); // validate

const chromePatch = {
  chat_emoji_search_placeholder: "Search emoji",
  chat_emoji_search_empty: "No emoji found",
  chat_emoji_results_prefix: "Results",
  chat_react_action: "React",
  chat_react_more_aria: "More reactions",
  chat_you_label: "You",
  chat_reply_label: "Reply",
  chat_receipt_sent_aria: "Sent",
  chat_receipt_seen_aria: "Seen",
  chat_seen_by_prefix: "Seen by",
  chat_image_fallback_label: "Image",
};

const chromeSql = JSON.stringify(chromePatch).replace(/'/g, "''");

const sql = `-- DB-backed Telegram-style emoji catalog + chat chrome (fail-closed clients).
-- Source JSON: migrations/data/chat_emoji_catalog.json
-- Regenerate: node scripts/export-chat-emoji-catalog.mjs && node scripts/gen-chat-emoji-migration.mjs

INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'chat_emoji_catalog',
  $chat_emoji_catalog$${catalog}$chat_emoji_catalog$::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW();

UPDATE platform_settings
SET value = value || '${chromeSql}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';

UPDATE platform_settings
SET value = value || '${chromeSql}'::jsonb,
    updated_at = NOW()
WHERE key = 'spectate_chrome';
`;

const out = path.join(root, "apps/api/migrations/160_chat_emoji_catalog.sql");
fs.writeFileSync(out, sql);
const parsed = JSON.parse(catalog);
console.log(
  JSON.stringify({
    out,
    bytes: sql.length,
    categories: parsed.categories.length,
    emojis: parsed.categories.reduce((n, c) => n + c.emojis.length, 0),
    quick: parsed.quick_reactions.length,
  }),
);
