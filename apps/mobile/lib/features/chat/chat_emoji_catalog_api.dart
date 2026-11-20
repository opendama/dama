import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/features/chat/chat_emoji_catalog.dart';
import 'package:http/http.dart' as http;

ChatEmojiCatalog? _memoryCache;

/// In-memory catalog from REST; null when unavailable (fail-closed).
ChatEmojiCatalog? get cachedChatEmojiCatalog => _memoryCache;

Future<ChatEmojiCatalog?> fetchChatEmojiCatalog({bool force = false}) async {
  if (!force && _memoryCache != null) return _memoryCache;
  try {
    final res = await http.get(
      Uri.parse('${ApiConfig.defaults.restUrl}/public/chat-emoji-catalog'),
    );
    if (res.statusCode != 200) {
      _memoryCache = null;
      return null;
    }
    final map = jsonDecode(res.body);
    if (map is! Map<String, dynamic>) {
      _memoryCache = null;
      return null;
    }
    final parsed = ChatEmojiCatalog.fromJson(map);
    _memoryCache = parsed;
    return parsed;
  } catch (_) {
    _memoryCache = null;
    return null;
  }
}

void clearChatEmojiCatalogCache() {
  _memoryCache = null;
}
