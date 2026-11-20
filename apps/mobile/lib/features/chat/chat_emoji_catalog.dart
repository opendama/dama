// Types for DB-backed chat emoji catalog (`GET /public/chat-emoji-catalog`).

class ChatEmojiItem {
  const ChatEmojiItem({required this.glyph, required this.keywords});

  final String glyph;
  final String keywords;

  static ChatEmojiItem? fromJson(Map<String, dynamic> json) {
    final glyph = (json['glyph'] as String?)?.trim() ?? '';
    if (glyph.isEmpty) return null;
    return ChatEmojiItem(
      glyph: glyph,
      keywords: (json['keywords'] as String?)?.trim() ?? '',
    );
  }
}

class ChatEmojiCategory {
  const ChatEmojiCategory({
    required this.id,
    required this.label,
    required this.icon,
    required this.emojis,
  });

  final String id;
  final String label;
  final String icon;
  final List<ChatEmojiItem> emojis;

  static ChatEmojiCategory? fromJson(Map<String, dynamic> json) {
    final id = (json['id'] as String?)?.trim() ?? '';
    final label = (json['label'] as String?)?.trim() ?? '';
    final icon = (json['icon'] as String?)?.trim() ?? '';
    if (id.isEmpty || label.isEmpty || icon.isEmpty) return null;
    final emojis = <ChatEmojiItem>[];
    for (final row in (json['emojis'] as List?) ?? const []) {
      if (row is Map<String, dynamic>) {
        final item = ChatEmojiItem.fromJson(row);
        if (item != null) emojis.add(item);
      }
    }
    if (emojis.isEmpty) return null;
    return ChatEmojiCategory(id: id, label: label, icon: icon, emojis: emojis);
  }
}

class ChatEmojiCatalog {
  const ChatEmojiCatalog({
    required this.categories,
    required this.quickReactions,
  });

  final List<ChatEmojiCategory> categories;
  final List<String> quickReactions;

  static ChatEmojiCatalog? fromJson(Map<String, dynamic> json) {
    final categories = <ChatEmojiCategory>[];
    for (final row in (json['categories'] as List?) ?? const []) {
      if (row is Map<String, dynamic>) {
        final cat = ChatEmojiCategory.fromJson(row);
        if (cat != null) categories.add(cat);
      }
    }
    final quick = <String>[];
    for (final row in (json['quick_reactions'] as List?) ?? const []) {
      final g = row?.toString().trim() ?? '';
      if (g.isNotEmpty) quick.add(g);
    }
    if (categories.isEmpty || quick.isEmpty) return null;
    return ChatEmojiCatalog(categories: categories, quickReactions: quick);
  }
}

List<ChatEmojiItem> searchChatEmojis(String query, ChatEmojiCatalog catalog) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) return const [];
  final out = <ChatEmojiItem>[];
  final seen = <String>{};
  for (final cat in catalog.categories) {
    for (final item in cat.emojis) {
      if (seen.contains(item.glyph)) continue;
      if (item.keywords.contains(q) || item.glyph.contains(q)) {
        seen.add(item.glyph);
        out.add(item);
      }
    }
  }
  return out;
}
