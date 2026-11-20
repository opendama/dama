import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/features/chat/chat_message_bubble.dart';
import 'package:dama_mobile/features/home/play_rail_panel.dart';
import 'package:http/http.dart' as http;

class DmRequestRow {
  const DmRequestRow({
    required this.id,
    required this.status,
    required this.side,
    required this.preview,
    this.threadId,
    this.unreadCount = 0,
    this.player,
  });

  final String id;
  final String status;
  final String side;
  final String preview;
  final String? threadId;
  final int unreadCount;
  final RailPlayer? player;

  static DmRequestRow? fromJson(Map<String, dynamic> json,
      [String? sideOverride]) {
    final id = (json['id'] as String?)?.trim() ?? '';
    if (id.isEmpty) return null;
    final side =
        (sideOverride ?? (json['side'] as String?)?.trim() ?? '').trim();
    if (side != 'in' && side != 'out') return null;
    final playerRaw = json['player'];
    RailPlayer? player;
    if (playerRaw is Map<String, dynamic>) {
      player = RailPlayer.fromJson(playerRaw);
    }
    final unreadRaw = json['unread_count'];
    final unread = unreadRaw is num ? unreadRaw.toInt() : 0;
    return DmRequestRow(
      id: id,
      status: (json['status'] as String?)?.trim() ?? '',
      side: side,
      preview: (json['preview'] as String?)?.trim() ?? '',
      threadId: (json['thread_id'] as String?)?.trim(),
      unreadCount: unread > 0 ? unread : 0,
      player: player,
    );
  }
}

class DmRequestsPayload {
  const DmRequestsPayload({
    required this.incoming,
    required this.outgoing,
    required this.pendingIncoming,
    this.unreadTotal = 0,
  });

  final List<DmRequestRow> incoming;
  final List<DmRequestRow> outgoing;
  final int pendingIncoming;
  final int unreadTotal;
}

String get _rest => ApiConfig.defaults.restUrl;

Future<DmRequestsPayload?> fetchDmRequests(String token) async {
  final res = await http.get(
    Uri.parse('$_rest/dms/requests'),
    headers: {'Authorization': 'Bearer $token'},
  );
  if (res.statusCode != 200) return null;
  final map = jsonDecode(res.body) as Map<String, dynamic>;
  final incoming = <DmRequestRow>[];
  final outgoing = <DmRequestRow>[];
  for (final row in (map['incoming'] as List?) ?? const []) {
    if (row is Map<String, dynamic>) {
      final parsed = DmRequestRow.fromJson(row, 'in');
      if (parsed != null) incoming.add(parsed);
    }
  }
  for (final row in (map['outgoing'] as List?) ?? const []) {
    if (row is Map<String, dynamic>) {
      final parsed = DmRequestRow.fromJson(row, 'out');
      if (parsed != null) outgoing.add(parsed);
    }
  }
  // Fail closed: badge comes from API COUNT only (never invent from capped list).
  final pendingRaw = map['pending_incoming'];
  if (pendingRaw is! num) return null;
  final unreadRaw = map['unread_total'];
  final unreadTotal = unreadRaw is num ? unreadRaw.toInt() : 0;
  return DmRequestsPayload(
    incoming: incoming,
    outgoing: outgoing,
    pendingIncoming: pendingRaw.toInt(),
    unreadTotal: unreadTotal > 0 ? unreadTotal : 0,
  );
}

class DmRequestsPage {
  const DmRequestsPage({
    required this.requests,
    required this.pendingIncoming,
    required this.hasMore,
    required this.nextSkip,
    this.unreadTotal = 0,
  });

  final List<DmRequestRow> requests;
  final int pendingIncoming;
  final int unreadTotal;
  final bool hasMore;
  final int nextSkip;
}

/// Trim skip/limit page for the DMs rail tab (web useDMRequestsInfinite parity).
Future<DmRequestsPage?> fetchDmRequestsPage(
  String token, {
  required int skip,
  required int limit,
  String q = '',
}) async {
  if (limit <= 0) return null;
  final safeSkip = skip < 0 ? 0 : skip;
  final needle = q.trim();
  final uri = Uri.parse('$_rest/dms/requests').replace(
    queryParameters: {
      'skip': '$safeSkip',
      'limit': '$limit',
      if (needle.isNotEmpty) 'q': needle,
    },
  );
  final res = await http.get(
    uri,
    headers: {'Authorization': 'Bearer $token'},
  );
  if (res.statusCode != 200) return null;
  final map = jsonDecode(res.body) as Map<String, dynamic>;
  final pendingRaw = map['pending_incoming'];
  if (pendingRaw is! num) return null;
  final list = <DmRequestRow>[];
  for (final row in (map['requests'] as List?) ?? const []) {
    if (row is Map<String, dynamic>) {
      final parsed = DmRequestRow.fromJson(row);
      if (parsed != null) list.add(parsed);
    }
  }
  // Backend meta only - never invent has_more from list length.
  final meta = map['meta'];
  var hasMore = false;
  var nextSkip = safeSkip + list.length;
  if (meta is Map<String, dynamic>) {
    final hm = meta['has_more'];
    if (hm is bool) hasMore = hm;
    final ns = meta['next_skip'];
    if (ns is num) nextSkip = ns.toInt();
  }
  if (list.isEmpty) hasMore = false;
  final unreadRaw = map['unread_total'];
  final unreadTotal = unreadRaw is num ? unreadRaw.toInt() : 0;
  return DmRequestsPage(
    requests: list,
    pendingIncoming: pendingRaw.toInt(),
    unreadTotal: unreadTotal > 0 ? unreadTotal : 0,
    hasMore: hasMore,
    nextSkip: nextSkip,
  );
}

Future<DmRequestRow?> fetchDmRequestById(
  String token,
  String requestId, {
  String? myUserId,
}) async {
  final id = requestId.trim();
  if (id.isEmpty) return null;
  final res = await http.get(
    Uri.parse('$_rest/dms/requests/${Uri.encodeComponent(id)}'),
    headers: {'Authorization': 'Bearer $token'},
  );
  if (res.statusCode != 200) return null;
  final map = jsonDecode(res.body) as Map<String, dynamic>;
  final req = map['request'];
  if (req is! Map<String, dynamic>) return null;
  final toId = (req['to_user_id'] as String?)?.trim() ?? '';
  final fromId = (req['from_user_id'] as String?)?.trim() ?? '';
  final me = (myUserId ?? '').trim();
  String side = 'in';
  if (me.isNotEmpty && fromId == me) side = 'out';
  if (me.isNotEmpty && toId == me) side = 'in';
  final withPlayer = Map<String, dynamic>.from(req);
  if (map['player'] is Map<String, dynamic>) {
    withPlayer['player'] = map['player'];
  }
  return DmRequestRow.fromJson(withPlayer, side);
}

class SendDmRequestResult {
  const SendDmRequestResult({
    required this.threadId,
    required this.canCompose,
  });

  final String threadId;
  final bool canCompose;
}

/// First message / reopen path. Returns [threadId] so the caller can open the thread.
Future<SendDmRequestResult?> sendDmRequest({
  required String token,
  required String toUserId,
  String? body,
  String? imageUrl,
  String? clientId,
}) async {
  try {
    final res = await http.post(
      Uri.parse('$_rest/dms/messages'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'to_user_id': toUserId,
        if (body != null && body.trim().isNotEmpty) 'body': body.trim(),
        if (imageUrl != null && imageUrl.trim().isNotEmpty)
          'image_url': imageUrl.trim(),
        if (clientId != null && clientId.trim().isNotEmpty)
          'client_id': clientId.trim(),
      }),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) return null;
    final decoded = jsonDecode(res.body);
    if (decoded is! Map<String, dynamic>) return null;
    var threadId = (decoded['thread_id'] as String?)?.trim() ?? '';
    final message = decoded['message'];
    final request = decoded['request'];
    if (threadId.isEmpty && message is Map<String, dynamic>) {
      threadId = (message['thread_id'] as String?)?.trim() ?? '';
    }
    if (threadId.isEmpty && request is Map<String, dynamic>) {
      threadId = (request['thread_id'] as String?)?.trim() ?? '';
    }
    if (threadId.isEmpty) return null;
    final requestStatus = request is Map<String, dynamic>
        ? ((request['status'] as String?)?.trim() ?? '')
        : '';
    // Pending DM request still locks compose until accept (message echo ≠ accepted).
    final canCompose =
        request is! Map<String, dynamic> || requestStatus == 'accepted';
    return SendDmRequestResult(threadId: threadId, canCompose: canCompose);
  } catch (_) {
    return null;
  }
}

Future<bool> acceptDm(String token, String id) async {
  final res = await http.post(
    Uri.parse('$_rest/dms/requests/$id/accept'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: '{}',
  );
  return res.statusCode >= 200 && res.statusCode < 300;
}

Future<bool> denyDm(String token, String id) async {
  final res = await http.post(
    Uri.parse('$_rest/dms/requests/$id/deny'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: '{}',
  );
  return res.statusCode >= 200 && res.statusCode < 300;
}

Future<bool> cancelDm(String token, String id) async {
  final res = await http.delete(
    Uri.parse('$_rest/dms/requests/$id'),
    headers: {'Authorization': 'Bearer $token'},
  );
  return res.statusCode >= 200 && res.statusCode < 300;
}

class DmMessage {
  const DmMessage({
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
    this.receipt,
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
  final String? receipt;

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

  DmMessage copyWith({
    String? id,
    String? receipt,
    String? clientId,
    String? localStatus,
    bool clearLocalStatus = false,
  }) {
    return DmMessage(
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
      receipt: receipt ?? this.receipt,
      clientId: clientId ?? this.clientId,
      localStatus: clearLocalStatus ? null : (localStatus ?? this.localStatus),
      createdAt: createdAt,
    );
  }

  static DmMessage? fromJson(Map<String, dynamic> json) {
    final id = (json['id'] as String?)?.trim() ?? '';
    final userId = (json['user_id'] as String?)?.trim() ?? '';
    if (id.isEmpty || userId.isEmpty) return null;
    final reactions = <ChatReactionAgg>[];
    for (final row in (json['reactions'] as List?) ?? const []) {
      if (row is Map<String, dynamic>) {
        final r = ChatReactionAgg.fromJson(row);
        if (r != null) reactions.add(r);
      }
    }
    final clientId = (json['client_id'] as String?)?.trim();
    return DmMessage(
      id: id,
      userId: userId,
      username: (json['username'] as String?)?.trim() ?? '',
      body: (json['body'] as String?)?.trim(),
      imageUrl: (json['image_url'] as String?)?.trim(),
      replyToId: (json['reply_to_id'] as String?)?.trim(),
      replyPreview: (json['reply_preview'] as String?)?.trim(),
      avatarThumbUrl: (json['avatar_thumb_url'] as String?)?.trim(),
      countryCode: (json['country_code'] as String?)?.trim(),
      reactions: reactions,
      receipt: (json['receipt'] as String?)?.trim(),
      clientId: (clientId != null && clientId.isNotEmpty) ? clientId : null,
      createdAt: (json['created_at'] as String?)?.trim(),
    );
  }
}

enum DmMessagesFetchKind { ok, failed }

class DmMessagesFetchResult {
  const DmMessagesFetchResult._(this.kind, this.messages);
  const DmMessagesFetchResult.ok(List<DmMessage> messages)
      : this._(DmMessagesFetchKind.ok, messages);
  const DmMessagesFetchResult.failed()
      : this._(DmMessagesFetchKind.failed, const []);

  final DmMessagesFetchKind kind;
  final List<DmMessage> messages;
}

Future<DmMessagesFetchResult> fetchDmMessages(
  String token,
  String threadId,
) async {
  try {
    final res = await http.get(
      Uri.parse('$_rest/dms/threads/${Uri.encodeComponent(threadId)}/messages'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (res.statusCode != 200) return const DmMessagesFetchResult.failed();
    final decoded = jsonDecode(res.body);
    if (decoded is! Map<String, dynamic>) {
      return const DmMessagesFetchResult.failed();
    }
    final out = <DmMessage>[];
    for (final row in (decoded['messages'] as List?) ?? const []) {
      if (row is Map<String, dynamic>) {
        final m = DmMessage.fromJson(row);
        if (m != null) out.add(m);
      }
    }
    return DmMessagesFetchResult.ok(out);
  } catch (_) {
    return const DmMessagesFetchResult.failed();
  }
}

Future<bool> probeDmThreadAccess(String token, String threadId) async {
  final res = await fetchDmMessages(token, threadId);
  return res.kind == DmMessagesFetchKind.ok;
}

/// Returns the server message on success (for optimistic commit); null on failure.
Future<DmMessage?> sendDmThread({
  required String token,
  required String threadId,
  String? body,
  String? imageUrl,
  String? replyToId,
  String? clientId,
}) async {
  try {
    final res = await http.post(
      Uri.parse('$_rest/dms/messages'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'thread_id': threadId,
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
        final parsed = DmMessage.fromJson(raw);
        if (parsed != null) return parsed;
      }
    }
    // HTTP ok but unparsed body - caller drops pending + soft-reloads.
    return const DmMessage(id: '', userId: '', username: '');
  } catch (_) {
    return null;
  }
}

Future<bool> reactDmMessage({
  required String token,
  required String threadId,
  required String messageId,
  required String emoji,
}) async {
  final res = await http.post(
    Uri.parse(
      '$_rest/dms/threads/${Uri.encodeComponent(threadId)}/messages/${Uri.encodeComponent(messageId)}/reactions',
    ),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({'emoji': emoji}),
  );
  return res.statusCode >= 200 && res.statusCode < 300;
}

Future<bool> markDmThreadRead({
  required String token,
  required String threadId,
  String? messageId,
}) async {
  final res = await http.post(
    Uri.parse('$_rest/dms/threads/${Uri.encodeComponent(threadId)}/read'),
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
