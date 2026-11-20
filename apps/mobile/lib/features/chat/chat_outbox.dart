import 'dart:async';
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

enum ChatOutboxKind { dm, game }

enum ChatOutboxStatus { pending, failed, sending }

/// Durable Telegram-grade chat outbox row (SharedPreferences-backed).
class ChatOutboxItem {
  const ChatOutboxItem({
    required this.clientId,
    required this.kind,
    required this.status,
    required this.createdAt,
    this.threadId,
    this.toUserId,
    this.gameId,
    this.body,
    this.imageUrl,
    this.replyToId,
    this.replyPreview,
    this.peerName,
  });

  final String clientId;
  final ChatOutboxKind kind;
  final String? threadId;

  /// Compose-new DM: peer user id before thread_id exists.
  final String? toUserId;
  final String? gameId;
  final String? body;
  final String? imageUrl;
  final String? replyToId;
  final String? replyPreview;
  final String? peerName;
  final ChatOutboxStatus status;
  final String createdAt;

  ChatOutboxItem copyWith({
    ChatOutboxKind? kind,
    String? threadId,
    String? toUserId,
    String? gameId,
    String? body,
    String? imageUrl,
    String? replyToId,
    String? replyPreview,
    String? peerName,
    ChatOutboxStatus? status,
    String? createdAt,
  }) {
    return ChatOutboxItem(
      clientId: clientId,
      kind: kind ?? this.kind,
      threadId: threadId ?? this.threadId,
      toUserId: toUserId ?? this.toUserId,
      gameId: gameId ?? this.gameId,
      body: body ?? this.body,
      imageUrl: imageUrl ?? this.imageUrl,
      replyToId: replyToId ?? this.replyToId,
      replyPreview: replyPreview ?? this.replyPreview,
      peerName: peerName ?? this.peerName,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  Map<String, dynamic> toJson() => {
        'clientId': clientId,
        'kind': kind == ChatOutboxKind.dm ? 'dm' : 'game',
        if (threadId != null) 'threadId': threadId,
        if (toUserId != null) 'toUserId': toUserId,
        if (gameId != null) 'gameId': gameId,
        if (body != null) 'body': body,
        if (imageUrl != null) 'imageUrl': imageUrl,
        if (replyToId != null) 'replyToId': replyToId,
        if (replyPreview != null) 'replyPreview': replyPreview,
        if (peerName != null) 'peerName': peerName,
        'status': switch (status) {
          ChatOutboxStatus.pending => 'pending',
          ChatOutboxStatus.failed => 'failed',
          ChatOutboxStatus.sending => 'sending',
        },
        'createdAt': createdAt,
      };

  static ChatOutboxItem? fromJson(Map<String, dynamic> json) {
    final clientId = (json['clientId'] as String?)?.trim() ?? '';
    final createdAt = (json['createdAt'] as String?)?.trim() ?? '';
    if (clientId.isEmpty || createdAt.isEmpty) return null;
    final kindRaw = (json['kind'] as String?)?.trim() ?? '';
    final ChatOutboxKind kind;
    if (kindRaw == 'dm') {
      kind = ChatOutboxKind.dm;
    } else if (kindRaw == 'game') {
      kind = ChatOutboxKind.game;
    } else {
      return null;
    }
    final statusRaw = (json['status'] as String?)?.trim() ?? '';
    final ChatOutboxStatus status;
    if (statusRaw == 'pending') {
      status = ChatOutboxStatus.pending;
    } else if (statusRaw == 'failed') {
      status = ChatOutboxStatus.failed;
    } else if (statusRaw == 'sending') {
      status = ChatOutboxStatus.sending;
    } else {
      return null;
    }
    return ChatOutboxItem(
      clientId: clientId,
      kind: kind,
      threadId: (json['threadId'] as String?)?.trim(),
      toUserId: (json['toUserId'] as String?)?.trim(),
      gameId: (json['gameId'] as String?)?.trim(),
      body: json['body'] as String?,
      imageUrl: json['imageUrl'] as String?,
      replyToId: json['replyToId'] as String?,
      replyPreview: json['replyPreview'] as String?,
      peerName: json['peerName'] as String?,
      status: status,
      createdAt: createdAt,
    );
  }
}

/// Durable SharedPreferences key for a user's chat outbox.
String chatOutboxStorageKey(String userId) =>
    'dama_chat_outbox_${userId.trim()}';

String chatOutboxScopeKey({
  required ChatOutboxKind kind,
  String? threadId,
  String? toUserId,
  String? gameId,
}) {
  if (kind == ChatOutboxKind.dm) {
    final tid = (threadId ?? '').trim();
    if (tid.isNotEmpty) return 'dm:$tid';
    final peer = (toUserId ?? '').trim();
    if (peer.isNotEmpty) return 'dm:compose:$peer';
    return 'dm:';
  }
  return 'game:${(gameId ?? '').trim()}';
}

bool chatOutboxMatchesScope(
  ChatOutboxItem item, {
  required ChatOutboxKind kind,
  String? threadId,
  String? toUserId,
  String? gameId,
}) {
  if (item.kind != kind) return false;
  if (kind == ChatOutboxKind.dm) {
    return chatOutboxScopeKey(
          kind: item.kind,
          threadId: item.threadId,
          toUserId: item.toUserId,
        ) ==
        chatOutboxScopeKey(
          kind: kind,
          threadId: threadId,
          toUserId: toUserId,
        );
  }
  return (item.gameId ?? '').trim() == (gameId ?? '').trim();
}

List<ChatOutboxItem> sortChatOutboxByCreatedAt(List<ChatOutboxItem> items) {
  final next = [...items];
  next.sort((a, b) => a.createdAt.compareTo(b.createdAt));
  return next;
}

/// Pure in-memory queue ops (unit-testable without SharedPreferences).
class ChatOutboxQueue {
  ChatOutboxQueue([List<ChatOutboxItem>? seed])
      : _items = [...(seed ?? const [])];

  List<ChatOutboxItem> _items;

  List<ChatOutboxItem> get items => List.unmodifiable(_items);

  void replaceAll(List<ChatOutboxItem> next) {
    _items = [...next];
  }

  ChatOutboxItem enqueue(ChatOutboxItem item) {
    final clientId = item.clientId.trim();
    final nextItem = ChatOutboxItem(
      clientId: clientId,
      kind: item.kind,
      threadId: item.threadId?.trim(),
      toUserId: item.toUserId?.trim(),
      gameId: item.gameId?.trim(),
      body: item.body,
      imageUrl: item.imageUrl,
      replyToId: item.replyToId,
      replyPreview: item.replyPreview,
      peerName: item.peerName,
      status: item.status,
      createdAt: item.createdAt.trim().isEmpty
          ? DateTime.now().toUtc().toIso8601String()
          : item.createdAt,
    );
    _items = [
      ..._items.where((i) => i.clientId != clientId),
      nextItem,
    ];
    _items = sortChatOutboxByCreatedAt(_items);
    return nextItem;
  }

  void remove(String clientId) {
    final cid = clientId.trim();
    if (cid.isEmpty) return;
    _items = _items.where((i) => i.clientId != cid).toList();
  }

  ChatOutboxItem? update(
    String clientId,
    ChatOutboxItem Function(ChatOutboxItem prev) patch,
  ) {
    final cid = clientId.trim();
    if (cid.isEmpty) return null;
    final idx = _items.indexWhere((i) => i.clientId == cid);
    if (idx < 0) return null;
    final updated = patch(_items[idx]);
    // Ensure clientId cannot change via patch result.
    final locked = ChatOutboxItem(
      clientId: cid,
      kind: updated.kind,
      threadId: updated.threadId,
      toUserId: updated.toUserId,
      gameId: updated.gameId,
      body: updated.body,
      imageUrl: updated.imageUrl,
      replyToId: updated.replyToId,
      replyPreview: updated.replyPreview,
      peerName: updated.peerName,
      status: updated.status,
      createdAt: updated.createdAt,
    );
    _items = [..._items];
    _items[idx] = locked;
    _items = sortChatOutboxByCreatedAt(_items);
    return locked;
  }

  ChatOutboxItem? requeue(String clientId) {
    return update(
        clientId, (prev) => prev.copyWith(status: ChatOutboxStatus.pending));
  }

  void dropMatchingClientIds(Iterable<String> clientIds) {
    final matched =
        clientIds.map((e) => e.trim()).where((e) => e.isNotEmpty).toSet();
    if (matched.isEmpty) return;
    _items = _items.where((i) => !matched.contains(i.clientId)).toList();
  }

  /// On hydrate: sending → pending so drain can resume after app kill.
  void normalizeSendingToPending() {
    var dirty = false;
    _items = _items.map((item) {
      if (item.status != ChatOutboxStatus.sending) return item;
      dirty = true;
      return item.copyWith(status: ChatOutboxStatus.pending);
    }).toList();
    if (dirty) _items = sortChatOutboxByCreatedAt(_items);
  }

  List<ChatOutboxItem> pendingInScope({
    required ChatOutboxKind kind,
    String? threadId,
    String? toUserId,
    String? gameId,
  }) {
    return sortChatOutboxByCreatedAt(
      _items
          .where(
            (i) =>
                chatOutboxMatchesScope(
                  i,
                  kind: kind,
                  threadId: threadId,
                  toUserId: toUserId,
                  gameId: gameId,
                ) &&
                i.status == ChatOutboxStatus.pending,
          )
          .toList(),
    );
  }

  List<ChatOutboxItem> displayInScope({
    required ChatOutboxKind kind,
    String? threadId,
    String? toUserId,
    String? gameId,
  }) {
    return sortChatOutboxByCreatedAt(
      _items
          .where(
            (i) =>
                chatOutboxMatchesScope(
                  i,
                  kind: kind,
                  threadId: threadId,
                  toUserId: toUserId,
                  gameId: gameId,
                ) &&
                (i.status == ChatOutboxStatus.pending ||
                    i.status == ChatOutboxStatus.failed ||
                    i.status == ChatOutboxStatus.sending),
          )
          .toList(),
    );
  }
}

Future<List<ChatOutboxItem>> loadChatOutbox(String userId) async {
  final uid = userId.trim();
  if (uid.isEmpty) return const [];
  try {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(chatOutboxStorageKey(uid));
    if (raw == null || raw.isEmpty) return const [];
    final parsed = jsonDecode(raw);
    if (parsed is! List) return const [];
    final out = <ChatOutboxItem>[];
    for (final row in parsed) {
      if (row is Map<String, dynamic>) {
        final item = ChatOutboxItem.fromJson(row);
        if (item != null) out.add(item);
      } else if (row is Map) {
        final item = ChatOutboxItem.fromJson(Map<String, dynamic>.from(row));
        if (item != null) out.add(item);
      }
    }
    return sortChatOutboxByCreatedAt(out);
  } catch (_) {
    return const [];
  }
}

Future<void> saveChatOutbox(String userId, List<ChatOutboxItem> items) async {
  final uid = userId.trim();
  if (uid.isEmpty) return;
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      chatOutboxStorageKey(uid),
      jsonEncode(items.map((e) => e.toJson()).toList()),
    );
  } catch (_) {
    // Quota / platform failure - fail closed; in-memory UI still works.
  }
}

Future<ChatOutboxItem> enqueueChatOutbox(
    String userId, ChatOutboxItem item) async {
  final queue = ChatOutboxQueue(await loadChatOutbox(userId));
  final next = queue.enqueue(item);
  await saveChatOutbox(userId, queue.items);
  return next;
}

Future<void> removeChatOutboxItem(String userId, String clientId) async {
  final uid = userId.trim();
  final cid = clientId.trim();
  if (uid.isEmpty || cid.isEmpty) return;
  final queue = ChatOutboxQueue(await loadChatOutbox(uid));
  queue.remove(cid);
  await saveChatOutbox(uid, queue.items);
}

Future<ChatOutboxItem?> updateChatOutboxItem(
  String userId,
  String clientId, {
  ChatOutboxStatus? status,
  String? body,
  String? imageUrl,
  String? replyToId,
  String? replyPreview,
}) async {
  final uid = userId.trim();
  final cid = clientId.trim();
  if (uid.isEmpty || cid.isEmpty) return null;
  final queue = ChatOutboxQueue(await loadChatOutbox(uid));
  final updated = queue.update(
    cid,
    (prev) => prev.copyWith(
      status: status,
      body: body,
      imageUrl: imageUrl,
      replyToId: replyToId,
      replyPreview: replyPreview,
    ),
  );
  if (updated == null) return null;
  await saveChatOutbox(uid, queue.items);
  return updated;
}

Future<ChatOutboxItem?> requeueChatOutboxItem(
    String userId, String clientId) async {
  return updateChatOutboxItem(userId, clientId,
      status: ChatOutboxStatus.pending);
}

Future<void> dropChatOutboxMatchingServer(
  String userId,
  Iterable<String?> serverClientIds,
) async {
  final uid = userId.trim();
  if (uid.isEmpty) return;
  final matched = serverClientIds
      .map((e) => (e ?? '').trim())
      .where((e) => e.isNotEmpty)
      .toSet();
  if (matched.isEmpty) return;
  final queue = ChatOutboxQueue(await loadChatOutbox(uid));
  final before = queue.items.length;
  queue.dropMatchingClientIds(matched);
  if (queue.items.length != before) {
    await saveChatOutbox(uid, queue.items);
  }
}

/// Hydrate durable rows for a scope: normalize sending→pending and return display rows.
Future<List<ChatOutboxItem>> hydrateChatOutbox({
  required String userId,
  required ChatOutboxKind kind,
  String? threadId,
  String? toUserId,
  String? gameId,
}) async {
  final uid = userId.trim();
  if (uid.isEmpty) return const [];
  final queue = ChatOutboxQueue(await loadChatOutbox(uid));
  queue.normalizeSendingToPending();
  await saveChatOutbox(uid, queue.items);
  return queue.displayInScope(
    kind: kind,
    threadId: threadId,
    toUserId: toUserId,
    gameId: gameId,
  );
}

final Map<String, Future<void>> _drainLocks = {};

typedef ChatOutboxSend = Future<void> Function(ChatOutboxItem item);

/// Drain pending items for one scope in createdAt order.
/// On failure: mark failed, then continue with the next pending item.
Future<void> drainChatOutbox({
  required String userId,
  required ChatOutboxKind kind,
  String? threadId,
  String? toUserId,
  String? gameId,
  required ChatOutboxSend send,
  void Function(ChatOutboxItem item)? onSending,
  void Function(ChatOutboxItem item)? onFailed,
  void Function(String clientId)? onRemoved,
}) {
  final scope = chatOutboxScopeKey(
    kind: kind,
    threadId: threadId,
    toUserId: toUserId,
    gameId: gameId,
  );
  final prev = _drainLocks[scope] ?? Future<void>.value();
  final run = prev.catchError((Object _) {}).then(
        (_) => _drainScopeOnce(
          userId: userId,
          kind: kind,
          threadId: threadId,
          toUserId: toUserId,
          gameId: gameId,
          send: send,
          onSending: onSending,
          onFailed: onFailed,
          onRemoved: onRemoved,
        ),
      );
  _drainLocks[scope] = run.whenComplete(() {
    if (identical(_drainLocks[scope], run)) {
      _drainLocks.remove(scope);
    }
  });
  return run;
}

Future<void> _drainScopeOnce({
  required String userId,
  required ChatOutboxKind kind,
  String? threadId,
  String? toUserId,
  String? gameId,
  required ChatOutboxSend send,
  void Function(ChatOutboxItem item)? onSending,
  void Function(ChatOutboxItem item)? onFailed,
  void Function(String clientId)? onRemoved,
}) async {
  final uid = userId.trim();
  if (uid.isEmpty) return;

  for (;;) {
    final queue = ChatOutboxQueue(await loadChatOutbox(uid));
    final pending = queue.pendingInScope(
      kind: kind,
      threadId: threadId,
      toUserId: toUserId,
      gameId: gameId,
    );
    if (pending.isEmpty) return;
    final next = pending.first;

    final sending = queue.update(
      next.clientId,
      (prev) => prev.copyWith(status: ChatOutboxStatus.sending),
    );
    await saveChatOutbox(uid, queue.items);
    if (sending != null) onSending?.call(sending);

    try {
      await send(next);
      final after = ChatOutboxQueue(await loadChatOutbox(uid));
      after.remove(next.clientId);
      await saveChatOutbox(uid, after.items);
      onRemoved?.call(next.clientId);
    } catch (_) {
      final failed = await updateChatOutboxItem(
        uid,
        next.clientId,
        status: ChatOutboxStatus.failed,
      );
      if (failed != null) onFailed?.call(failed);
      // Continue with the next pending item.
    }
  }
}

/// Clear drain locks (tests only).
void debugResetChatOutboxDrainLocks() => _drainLocks.clear();
