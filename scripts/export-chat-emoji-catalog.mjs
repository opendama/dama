/**
 * Canonical emoji catalog lives in:
 *   apps/api/migrations/data/chat_emoji_catalog.json
 * (DB-backed via mig 160 → platform_settings.chat_emoji_catalog).
 *
 * This script validates that JSON (fail-closed) and prints stats.
 * To rewrite the SQL seed: node scripts/gen-chat-emoji-migration.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(root, "apps/api/migrations/data/chat_emoji_catalog.json");

if (!fs.existsSync(outPath)) {
  console.error("FAIL: missing canonical catalog", outPath);
  process.exit(1);
}

let doc;
try {
  doc = JSON.parse(fs.readFileSync(outPath, "utf8"));
} catch (e) {
  console.error("FAIL: invalid JSON", e.message);
  process.exit(1);
}

if (!Array.isArray(doc.categories) || doc.categories.length === 0) {
  console.error("FAIL: categories required");
  process.exit(1);
}
if (!Array.isArray(doc.quick_reactions) || doc.quick_reactions.length === 0) {
  console.error("FAIL: quick_reactions required");
  process.exit(1);
}

let emojis = 0;
for (const c of doc.categories) {
  if (!c?.id?.trim() || !c?.label?.trim() || !c?.icon?.trim()) {
    console.error("FAIL: category id/label/icon required");
    process.exit(1);
  }
  if (!Array.isArray(c.emojis) || c.emojis.length === 0) {
    console.error("FAIL: category emojis empty", c.id);
    process.exit(1);
  }
  for (const e of c.emojis) {
    if (!e?.glyph?.trim()) {
      console.error("FAIL: empty glyph in", c.id);
      process.exit(1);
    }
    emojis++;
  }
}
for (const q of doc.quick_reactions) {
  if (typeof q !== "string" || !q.trim()) {
    console.error("FAIL: empty quick_reaction");
    process.exit(1);
  }
}

console.log(
  JSON.stringify({
    ok: true,
    cats: doc.categories.length,
    emojis,
    quick: doc.quick_reactions.length,
    bytes: fs.statSync(outPath).size,
    path: outPath,
    note: "canonical JSON - regenerate SQL with gen-chat-emoji-migration.mjs",
  }),
);
