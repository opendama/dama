import 'dart:async';

import 'package:dama_mobile/core/audio/game_notify.dart';

/// Extract sender user id from a WS chat payload (game / DM).
String chatMessageSenderId(Map<String, dynamic> payload) {
  final msg = payload['message'];
  if (msg is Map) {
    final uid = msg['user_id']?.toString().trim() ?? '';
    if (uid.isNotEmpty) return uid;
  }
  return payload['user_id']?.toString().trim() ?? '';
}

/// Recipient-only delivery chime. Skips own outbound echoes.
void notifyIncomingChatMessage({
  required String? myUserId,
  required Map<String, dynamic> payload,
}) {
  final mine = (myUserId ?? '').trim();
  final from = chatMessageSenderId(payload);
  if (from.isEmpty || (mine.isNotEmpty && from == mine)) return;
  unawaited(GameNotify.playMessageDelivered());
}
