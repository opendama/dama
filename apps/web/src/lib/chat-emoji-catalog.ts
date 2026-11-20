/** Types + helpers for DB-backed chat emoji catalog (`GET /public/chat-emoji-catalog`). */

export type ChatEmojiCategoryId = string;

export type ChatEmojiItem = {
  glyph: string;
  keywords: string;
};

export type ChatEmojiCategory = {
  id: ChatEmojiCategoryId;
  label: string;
  icon: string;
  emojis: ChatEmojiItem[];
};

export type ChatEmojiCatalog = {
  categories: ChatEmojiCategory[];
  quick_reactions: string[];
};

export function isChatEmojiCatalogReady(data: unknown): data is ChatEmojiCatalog {
  if (!data || typeof data !== "object") return false;
  const d = data as ChatEmojiCatalog;
  if (!Array.isArray(d.categories) || d.categories.length === 0) return false;
  if (!Array.isArray(d.quick_reactions) || d.quick_reactions.length === 0) return false;
  for (const c of d.categories) {
    if (!c || typeof c.id !== "string" || !c.id.trim()) return false;
    if (typeof c.label !== "string" || !c.label.trim()) return false;
    if (typeof c.icon !== "string" || !c.icon.trim()) return false;
    if (!Array.isArray(c.emojis) || c.emojis.length === 0) return false;
    for (const e of c.emojis) {
      if (!e || typeof e.glyph !== "string" || !e.glyph.trim()) return false;
    }
  }
  for (const q of d.quick_reactions) {
    if (typeof q !== "string" || !q.trim()) return false;
  }
  return true;
}

export function searchChatEmojis(
  catalog: ChatEmojiCatalog,
  query: string,
): { glyph: string; keywords: string; category: string }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: { glyph: string; keywords: string; category: string }[] = [];
  const seen = new Set<string>();
  for (const cat of catalog.categories) {
    for (const item of cat.emojis) {
      if (seen.has(item.glyph)) continue;
      const kw = (item.keywords || "").toLowerCase();
      if (kw.includes(q) || item.glyph.includes(q)) {
        seen.add(item.glyph);
        out.push({ glyph: item.glyph, keywords: item.keywords || "", category: cat.label });
      }
    }
  }
  return out;
}
