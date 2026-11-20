import 'package:dama_mobile/features/chat/chat_outbox.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

ChatOutboxItem baseItem({
  required String clientId,
  String threadId = 'thread-a',
  String? body = 'hi',
  ChatOutboxStatus status = ChatOutboxStatus.pending,
  String createdAt = '2026-01-01T00:00:00.000Z',
}) {
  return ChatOutboxItem(
    clientId: clientId,
    kind: ChatOutboxKind.dm,
    threadId: threadId,
    body: body,
    status: status,
    createdAt: createdAt,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    debugResetChatOutboxDrainLocks();
  });

  group('ChatOutboxQueue', () {
    test('enqueues in createdAt order per scope', () {
      final q = ChatOutboxQueue();
      q.enqueue(baseItem(
        clientId: 'local-b',
        body: 'b',
        createdAt: '2026-01-01T00:00:02.000Z',
      ));
      q.enqueue(baseItem(
        clientId: 'local-a',
        body: 'a',
        createdAt: '2026-01-01T00:00:01.000Z',
      ));
      q.enqueue(baseItem(
        clientId: 'local-c',
        threadId: 'thread-b',
        body: 'other',
        createdAt: '2026-01-01T00:00:00.000Z',
      ));
      expect(q.items.map((i) => i.clientId).toList(), [
        'local-c',
        'local-a',
        'local-b',
      ]);
      expect(
        q
            .pendingInScope(kind: ChatOutboxKind.dm, threadId: 'thread-a')
            .map((i) => i.clientId)
            .toList(),
        ['local-a', 'local-b'],
      );
      expect(chatOutboxStorageKey('user-1'), 'dama_chat_outbox_user-1');
    });

    test('compose-new scope keys by toUserId', () {
      final q = ChatOutboxQueue();
      q.enqueue(ChatOutboxItem(
        clientId: 'local-compose',
        kind: ChatOutboxKind.dm,
        toUserId: 'peer-9',
        peerName: 'Peer',
        body: 'hello',
        status: ChatOutboxStatus.pending,
        createdAt: '2026-03-01T00:00:00.000Z',
      ));
      expect(
        chatOutboxScopeKey(kind: ChatOutboxKind.dm, toUserId: 'peer-9'),
        'dm:compose:peer-9',
      );
      expect(
        q
            .pendingInScope(kind: ChatOutboxKind.dm, toUserId: 'peer-9')
            .map((i) => i.clientId)
            .toList(),
        ['local-compose'],
      );
      expect(
        q.pendingInScope(kind: ChatOutboxKind.dm, threadId: 'thread-a'),
        isEmpty,
      );
    });

    test('duplicate clientId replaces row; remove drops it', () {
      final q = ChatOutboxQueue();
      q.enqueue(baseItem(clientId: 'local-dup', body: 'first'));
      q.enqueue(baseItem(clientId: 'local-dup', body: 'second'));
      expect(q.items, hasLength(1));
      expect(q.items.first.body, 'second');
      q.remove('local-dup');
      expect(q.items, isEmpty);
      q.enqueue(baseItem(clientId: 'local-ack', body: 'x'));
      q.dropMatchingClientIds(['local-ack']);
      expect(q.items, isEmpty);
    });

    test('normalizeSendingToPending resumes interrupted drain', () {
      final q = ChatOutboxQueue([
        baseItem(clientId: 'local-1', status: ChatOutboxStatus.sending),
        baseItem(
          clientId: 'local-2',
          status: ChatOutboxStatus.failed,
          createdAt: '2026-01-01T00:00:01.000Z',
        ),
      ]);
      q.normalizeSendingToPending();
      expect(q.items.firstWhere((i) => i.clientId == 'local-1').status,
          ChatOutboxStatus.pending);
      expect(q.items.firstWhere((i) => i.clientId == 'local-2').status,
          ChatOutboxStatus.failed);
    });
  });

  group('durable SharedPreferences roundtrip', () {
    test('load/save via mocked prefs', () async {
      const user = 'user-test-1';
      await enqueueChatOutbox(
        user,
        baseItem(
          clientId: 'local-1',
          body: 'persist me',
          createdAt: '2026-02-01T12:00:00.000Z',
        ).copyWith(
          imageUrl: 'https://example/x.png',
          replyToId: 'msg-9',
          replyPreview: 'earlier',
        ),
      );
      final again = await loadChatOutbox(user);
      expect(again, hasLength(1));
      expect(again.first.clientId, 'local-1');
      expect(again.first.body, 'persist me');
      expect(again.first.imageUrl, 'https://example/x.png');
      expect(again.first.replyToId, 'msg-9');
      expect(again.first.replyPreview, 'earlier');
      expect(again.first.status, ChatOutboxStatus.pending);
      expect(chatOutboxStorageKey(user), 'dama_chat_outbox_$user');
    });
  });

  group('drainChatOutbox', () {
    test('fail-then-retry drains serially and requeues same clientId',
        () async {
      const user = 'user-drain-1';
      await enqueueChatOutbox(
        user,
        baseItem(
          clientId: 'local-1',
          body: 'one',
          createdAt: '2026-01-01T00:00:01.000Z',
        ),
      );
      await enqueueChatOutbox(
        user,
        baseItem(
          clientId: 'local-2',
          body: 'two',
          createdAt: '2026-01-01T00:00:02.000Z',
        ),
      );

      final attempts = <String>[];
      var failFirst = true;
      await drainChatOutbox(
        userId: user,
        kind: ChatOutboxKind.dm,
        threadId: 'thread-a',
        send: (item) async {
          attempts.add(item.clientId);
          if (item.clientId == 'local-1' && failFirst) {
            failFirst = false;
            throw StateError('network');
          }
        },
      );

      expect(attempts, ['local-1', 'local-2']);
      final afterFail = await loadChatOutbox(user);
      expect(afterFail, hasLength(1));
      expect(afterFail.first.clientId, 'local-1');
      expect(afterFail.first.status, ChatOutboxStatus.failed);

      final requeued = await requeueChatOutboxItem(user, 'local-1');
      expect(requeued?.status, ChatOutboxStatus.pending);
      expect(requeued?.clientId, 'local-1');

      await drainChatOutbox(
        userId: user,
        kind: ChatOutboxKind.dm,
        threadId: 'thread-a',
        send: (item) async {
          attempts.add('retry:${item.clientId}');
        },
      );

      expect(attempts, ['local-1', 'local-2', 'retry:local-1']);
      expect(await loadChatOutbox(user), isEmpty);
    });
  });
}
