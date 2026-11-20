import 'dart:async';

/// Fan-out for live game chat WS events:
/// `game_chat_message`, `game_chat_toggle`, `game_chat_reaction`, `game_chat_read`.
class GameChatLive {
  GameChatLive._();

  static final StreamController<String> _ctrl =
      StreamController<String>.broadcast();

  static Stream<String> get stream => _ctrl.stream;

  static void notify(String gameId) {
    final id = gameId.trim();
    if (id.isEmpty) return;
    _ctrl.add(id);
  }

  static bool isLiveWsType(String? type) {
    return type == 'game_chat_message' ||
        type == 'game_chat_toggle' ||
        type == 'game_chat_reaction' ||
        type == 'game_chat_read';
  }

  /// Returns game id when [msg] is a game-chat live event (for invalidation).
  static String? gameIdFromWs(Map<String, dynamic> msg,
      {String? fallbackGameId}) {
    if (!isLiveWsType(msg['type']?.toString())) return null;
    final gid = (msg['game_id']?.toString() ?? fallbackGameId ?? '').trim();
    return gid.isEmpty ? null : gid;
  }
}
