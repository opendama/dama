import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/features/chat/chat_message_bubble.dart';
import 'package:http/http.dart' as http;

class GameChatMessage {
  const GameChatMessage({
    required this.id,
    required this.userId,
    required this.username,
    this.body,
    this.imageUrl,
    this.replyToId,
    this.replyPreview,
    this.avatarThumbUrl,
    this.countryCode,
    this.reactions = const [],
    this.seenCount = 0,
    this.seenTotal = 0,
    this.clientId,
    this.localStatus,
    this.createdAt,
  });

  final String id;
  final String userId;
  final String username;
  final String? body;
  final String? imageUrl;
  final String? replyToId;
  final String? replyPreview;
  final String? avatarThumbUrl;
  final String? countryCode;
  final List<ChatReactionAgg> reactions;
  final int seenCount;
  final int seenTotal;

  /// Server / outbox idempotency key (`client_id`).
  final String? clientId;

  /// Client outbox: pending | failed (Telegram-style).
  final String? localStatus;
  final String? createdAt;

  bool get isLocalOutbox =>
      localStatus == 'pending' ||
      localStatus == 'failed' ||
      localStatus == 'sending' ||
      id.startsWith('local-');

  GameChatMessage copyWith({
    String? id,
    String? clientId,
    String? localStatus,
    bool clearLocalStatus = false,
  }) {
    return GameChatMessage(
      id: id ?? this.id,
      userId: userId,
      username: username,
      body: body,
      imageUrl: imageUrl,
      replyToId: replyToId,
      replyPreview: replyPreview,
      avatarThumbUrl: avatarThumbUrl,
      countryCode: countryCode,
      reactions: reactions,
      seenCount: seenCount,
      seenTotal: seenTotal,
      clientId: clientId ?? this.clientId,
      localStatus: clearLocalStatus ? null : (localStatus ?? this.localStatus),
      createdAt: createdAt,
    );
  }

  static GameChatMessage? fromJson(Map<String, dynamic> json) {
    final id = (json['id'] as String?)?.trim() ?? '';
    final userId = (json['user_id'] as String?)?.trim() ?? '';
    final username = (json['username'] as String?)?.trim() ?? '';
    if (id.isEmpty || userId.isEmpty) return null;
    final reactions = <ChatReactionAgg>[];
    for (final row in (json['reactions'] as List?) ?? const []) {
      if (row is Map<String, dynamic>) {
        final r = ChatReactionAgg.fromJson(row);
        if (r != null) reactions.add(r);
      }
    }
    final clientId = (json['client_id'] as String?)?.trim();
    return GameChatMessage(
      id: id,
      userId: userId,
      username: username,
      body: (json['body'] as String?)?.trim(),
      imageUrl: (json['image_url'] as String?)?.trim(),
      replyToId: (json['reply_to_id'] as String?)?.trim(),
      replyPreview: (json['reply_preview'] as String?)?.trim(),
      avatarThumbUrl: (json['avatar_thumb_url'] as String?)?.trim(),
      countryCode: (json['country_code'] as String?)?.trim(),
      reactions: reactions,
      seenCount:
          json['seen_count'] is num ? (json['seen_count'] as num).toInt() : 0,
      seenTotal:
          json['seen_total'] is num ? (json['seen_total'] as num).toInt() : 0,
      clientId: (clientId != null && clientId.isNotEmpty) ? clientId : null,
      createdAt: (json['created_at'] as String?)?.trim(),
    );
  }
}

class GameChatPayload {
  const GameChatPayload({
    required this.enabled,
    required this.canToggle,
    required this.canPost,
    required this.messages,
    this.unreadCount = 0,
  });

  final bool enabled;
  final bool canToggle;
  final bool canPost;
  final List<GameChatMessage> messages;
  final int unreadCount;
}

String get _rest => ApiConfig.defaults.restUrl;

enum GameChatFetchKind { ok, joinRequired, failed }

class GameChatFetchResult {
  const GameChatFetchResult._(this.kind, this.payload);
  const GameChatFetchResult.ok(GameChatPayload payload)
      : this._(GameChatFetchKind.ok, payload);
  const GameChatFetchResult.joinRequired()
      : this._(GameChatFetchKind.joinRequired, null);
  const GameChatFetchResult.failed() : this._(GameChatFetchKind.failed, null);

  final GameChatFetchKind kind;
  final GameChatPayload? payload;
}

Future<GameChatFetchResult> fetchGameChat(String gameId,
    {String? token}) async {
  final headers = <String, String>{};
  if ((token ?? '').trim().isNotEmpty) {
    headers['Authorization'] = 'Bearer ${token!.trim()}';
  }
  final res = await http.get(
    Uri.parse('$_rest/games/${Uri.encodeComponent(gameId)}/chat'),
    headers: headers,
  );
  if (res.statusCode != 200) {
    try {
      final errMap = jsonDecode(res.body) as Map<String, dynamic>;
      if ((errMap['error'] as String?)?.trim() == 'join_required') {
        return const GameChatFetchResult.joinRequired();
      }
    } catch (_) {
      /* body may be non-JSON */
    }
    return const GameChatFetchResult.failed();
  }
  final map = jsonDecode(res.body) as Map<String, dynamic>;
  final msgs = <GameChatMessage>[];
  for (final row in (map['messages'] as List?) ?? const []) {
    if (row is Map<String, dynamic>) {
      final m = GameChatMessage.fromJson(row);
      if (m != null) msgs.add(m);
    }
  }
  // Fail closed: only true when API explicitly says so.
  final unreadRaw = map['unread_count'];
  final unread = unreadRaw is num ? unreadRaw.toInt() : 0;
  return GameChatFetchResult.ok(
    GameChatPayload(
      enabled: map['enabled'] == true,
      canToggle: map['can_toggle'] == true,
      canPost: map['can_post'] == true,
      messages: msgs,
      unreadCount: unread > 0 ? unread : 0,
    ),
  );
}

/// Returns the server message on success (for optimistic commit); null on failure.
Future<GameChatMessage?> postGameChat({
  required String token,
  required String gameId,
  String? body,
  String? imageUrl,
  String? replyToId,
  String? clientId,
}) async {
  try {
    final res = await http.post(
      Uri.parse('$_rest/games/${Uri.encodeComponent(gameId)}/chat'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        if (body != null && body.trim().isNotEmpty) 'body': body.trim(),
        if (imageUrl != null && imageUrl.trim().isNotEmpty)
          'image_url': imageUrl.trim(),
        if (replyToId != null && replyToId.trim().isNotEmpty)
          'reply_to_id': replyToId.trim(),
        if (clientId != null && clientId.trim().isNotEmpty)
          'client_id': clientId.trim(),
      }),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) return null;
    final decoded = jsonDecode(res.body);
    if (decoded is Map<String, dynamic>) {
      final raw = decoded['message'];
      if (raw is Map<String, dynamic>) {
        final parsed = GameChatMessage.fromJson(raw);
        if (parsed != null) return parsed;
      }
    }
    // HTTP ok but unparsed body - caller drops pending + soft-reloads.
    return const GameChatMessage(id: '', userId: '', username: '');
  } catch (_) {
    return null;
  }
}

Future<bool> toggleGameChat({
  required String token,
  required String gameId,
  required bool enabled,
}) async {
  final res = await http.patch(
    Uri.parse('$_rest/games/${Uri.encodeComponent(gameId)}/chat'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({'enabled': enabled}),
  );
  return res.statusCode >= 200 && res.statusCode < 300;
}

Future<bool> reactGameChat({
  required String token,
  required String gameId,
  required String messageId,
  required String emoji,
}) async {
  final res = await http.post(
    Uri.parse(
      '$_rest/games/${Uri.encodeComponent(gameId)}/chat/messages/${Uri.encodeComponent(messageId)}/reactions',
    ),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({'emoji': emoji}),
  );
  return res.statusCode >= 200 && res.statusCode < 300;
}

Future<bool> markGameChatRead({
  required String token,
  required String gameId,
  String? messageId,
}) async {
  final res = await http.post(
    Uri.parse('$_rest/games/${Uri.encodeComponent(gameId)}/chat/read'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      if ((messageId ?? '').trim().isNotEmpty) 'message_id': messageId!.trim(),
    }),
  );
  return res.statusCode >= 200 && res.statusCode < 300;
}
