import 'dart:async';

import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/play_rail_chrome.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/chat/chat_composer_bar.dart';
import 'package:dama_mobile/features/chat/chat_scroll.dart';
import 'package:dama_mobile/features/chat/chat_time.dart';
import 'package:dama_mobile/features/chat/chat_emoji_catalog.dart';
import 'package:dama_mobile/features/chat/chat_emoji_catalog_api.dart';
import 'package:dama_mobile/features/chat/chat_emoji_picker.dart';
import 'package:dama_mobile/features/chat/dm_thread_live.dart';
import 'package:dama_mobile/features/chat/chat_image_upload.dart';
import 'package:dama_mobile/features/chat/chat_message_bubble.dart';
import 'package:dama_mobile/features/chat/chat_outbox.dart';
import 'package:dama_mobile/features/chat/dm_api.dart';
import 'package:dama_mobile/features/player/open_create_game_challenge.dart';
import 'package:dama_mobile/features/player/player_inspect_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

Future<void> showDmThreadSheet(
  BuildContext context, {
  required PlayRailChrome chrome,
  required String accessToken,
  required String threadId,
  required String peerName,
  bool canCompose = true,
  String? requestId,
  String? requestSide,
  String? requestStatus,
}) {
  final auth = context.read<AuthCubit>();
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: false,
    backgroundColor: damaColorsOf(context).card,
    builder: (_) => BlocProvider.value(
      value: auth,
      child: _DmThreadBody(
        chrome: chrome,
        accessToken: accessToken,
        threadId: threadId,
        peerName: peerName,
        canCompose: canCompose,
        requestId: requestId,
        requestSide: requestSide,
        requestStatus: requestStatus,
      ),
    ),
  );
}

class _DmThreadBody extends StatefulWidget {
  const _DmThreadBody({
    required this.chrome,
    required this.accessToken,
    required this.threadId,
    required this.peerName,
    this.canCompose = true,
    this.requestId,
    this.requestSide,
    this.requestStatus,
  });

  final PlayRailChrome chrome;
  final String accessToken;
  final String threadId;
  final String peerName;
  final bool canCompose;
  final String? requestId;
  final String? requestSide;
  final String? requestStatus;

  @override
  State<_DmThreadBody> createState() => _DmThreadBodyState();
}

class _DmThreadBodyState extends State<_DmThreadBody> {
  final _ctrl = TextEditingController();
  final _focus = FocusNode();
  final _scroll = ScrollController();
  final Map<String, GlobalKey> _msgKeys = {};
  List<DmMessage> _msgs = const [];

  /// Telegram outbox: clientId → pending/failed/sending bubble (durable + ordered drain).
  final Map<String, DmMessage> _outbox = {};
  int _outboxSeq = 0;
  String? _outboxUserId;
  DmMessage? _replyTo;
  String? _imageUrl;
  String? _flashId;
  bool _busy = false;
  bool _uploading = false;
  bool _loaded = false;
  bool _loadFailed = false;

  /// Telegram: stay pinned unless the user scrolls up into history.
  bool _pinToLatest = true;
  late bool _canCompose;
  late String _status;
  Timer? _poll;
  Timer? _flashTimer;
  Timer? _markVisibleTimer;
  StreamSubscription<String>? _liveSub;
  ChatEmojiCatalog? _emojiCatalog;

  void _requestComposerFocus() {
    requestChatComposerFocus(
      _focus,
      enabled: _canCompose,
      mounted: () => mounted && _canCompose,
    );
  }

  @override
  void initState() {
    super.initState();
    _canCompose = widget.canCompose;
    _status = (widget.requestStatus ?? '').trim();
    _scroll.addListener(_onScroll);
    unawaited(_loadEmojiCatalog());
    unawaited(_hydrateOutboxAndLoad());
    _liveSub = DmThreadLive.stream.listen((tid) {
      if (tid == widget.threadId.trim()) unawaited(_load());
    });
    final pollMs = int.tryParse(widget.chrome.dmPollIntervalMs.trim()) ?? 0;
    if (pollMs > 0) {
      _poll = Timer.periodic(
          Duration(milliseconds: pollMs), (_) => unawaited(_load()));
    }
    // Telegram/WhatsApp: caret ready when the DM sheet opens.
    _requestComposerFocus();
  }

  Future<void> _hydrateOutboxAndLoad() async {
    await _hydrateOutbox();
    await _load(forceStick: true);
    _drainOutbox();
  }

  Future<void> _hydrateOutbox() async {
    final auth = context.read<AuthCubit>().state;
    final myId = (auth.userId ?? '').trim();
    if (myId.isEmpty) return;
    _outboxUserId = myId;
    final items = await hydrateChatOutbox(
      userId: myId,
      kind: ChatOutboxKind.dm,
      threadId: widget.threadId,
    );
    if (!mounted) return;
    setState(() {
      _outbox
        ..clear()
        ..addEntries(
          items.map(
              (item) => MapEntry(item.clientId, _dmFromOutbox(item, auth))),
        );
    });
  }

  DmMessage _dmFromOutbox(ChatOutboxItem item, AuthState auth) {
    final failed = item.status == ChatOutboxStatus.failed;
    final local = failed ? 'failed' : 'pending';
    return DmMessage(
      id: item.clientId,
      userId: (auth.userId ?? '').trim(),
      username: (auth.username ?? '').trim(),
      body: item.body,
      imageUrl: item.imageUrl,
      replyToId: item.replyToId,
      replyPreview: item.replyPreview,
      avatarThumbUrl: auth.avatarUrl,
      clientId: item.clientId,
      receipt: local,
      localStatus: local,
      createdAt: item.createdAt,
    );
  }

  void _paintOutboxItem(ChatOutboxItem item) {
    final auth = context.read<AuthCubit>().state;
    setState(() {
      _outbox[item.clientId] = _dmFromOutbox(item, auth);
    });
  }

  void _drainOutbox() {
    final uid =
        (_outboxUserId ?? context.read<AuthCubit>().state.userId ?? '').trim();
    if (uid.isEmpty) return;
    unawaited(
      drainChatOutbox(
        userId: uid,
        kind: ChatOutboxKind.dm,
        threadId: widget.threadId,
        send: (item) async {
          final server = await sendDmThread(
            token: widget.accessToken,
            threadId: widget.threadId,
            body: item.body,
            imageUrl: item.imageUrl,
            replyToId: item.replyToId,
            clientId: item.clientId,
          );
          if (server == null) {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(widget.chrome.dmToastFailed)),
              );
            }
            throw StateError('dm_send_failed');
          }
          if (!mounted) return;
          if (server.id.isNotEmpty && server.userId.isNotEmpty) {
            setState(() {
              _outbox.remove(item.clientId);
              _msgs = [
                ..._msgs.where(
                  (m) =>
                      m.id != server.id &&
                      m.id != item.clientId &&
                      (m.clientId ?? '') != item.clientId,
                ),
                server,
              ];
            });
            _stickToLatest(force: true);
            return;
          }
          // HTTP ok but empty body - soft-reload; keep bubble until server client_id matches.
          await _load();
          if (!mounted) return;
          if (_outbox.containsKey(item.clientId)) {
            throw StateError('dm_send_unconfirmed');
          }
        },
        onSending: (item) {
          if (!mounted) return;
          _paintOutboxItem(item);
        },
        onFailed: (item) {
          if (!mounted) return;
          _paintOutboxItem(item);
        },
        onRemoved: (clientId) {
          if (!mounted) return;
          setState(() => _outbox.remove(clientId));
        },
      ),
    );
  }

  Future<void> _retryOutbox(DmMessage msg) async {
    final uid =
        (_outboxUserId ?? context.read<AuthCubit>().state.userId ?? '').trim();
    final clientId = (msg.clientId ?? msg.id).trim();
    if (uid.isEmpty || clientId.isEmpty) return;
    final item = await enqueueChatOutbox(
      uid,
      ChatOutboxItem(
        clientId: clientId,
        kind: ChatOutboxKind.dm,
        threadId: widget.threadId,
        body: msg.body,
        imageUrl: msg.imageUrl,
        replyToId: msg.replyToId,
        replyPreview: msg.replyPreview,
        status: ChatOutboxStatus.pending,
        createdAt: msg.createdAt ?? DateTime.now().toUtc().toIso8601String(),
      ),
    );
    if (!mounted) return;
    _paintOutboxItem(item);
    _drainOutbox();
  }

  @override
  void didUpdateWidget(covariant _DmThreadBody oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.canCompose && !oldWidget.canCompose) {
      _canCompose = true;
      _requestComposerFocus();
    }
  }

  void _onScroll() {
    _pinToLatest = isChatNearBottom(_scroll);
    _scheduleMarkVisible();
  }

  void _stickToLatest({bool force = false}) {
    if (!force && !_pinToLatest) return;
    _pinToLatest = true;
    scrollChatToLatest(_scroll);
  }

  @override
  void dispose() {
    _liveSub?.cancel();
    _poll?.cancel();
    _flashTimer?.cancel();
    _markVisibleTimer?.cancel();
    _scroll.removeListener(_onScroll);
    _ctrl.dispose();
    _focus.dispose();
    _scroll.dispose();
    super.dispose();
  }

  GlobalKey _keyFor(String id) => _msgKeys.putIfAbsent(id, GlobalKey.new);

  Future<void> _loadEmojiCatalog() async {
    final catalog = await fetchChatEmojiCatalog();
    if (!mounted) return;
    setState(() => _emojiCatalog = catalog);
  }

  Future<void> _openSender(String userId) async {
    final id = userId.trim();
    if (id.isEmpty) return;
    final req = await showPlayerInspectSheet(context, id);
    if (req == null || !mounted) return;
    await openCreateGameChallenge(context, req);
  }

  Future<void> _openEmojiPicker() async {
    final catalog = _emojiCatalog;
    final c = widget.chrome;
    if (catalog == null) return;
    await showChatEmojiPicker(
      context,
      catalog: catalog,
      searchPlaceholder: c.chatEmojiSearchPlaceholder,
      searchEmptyLabel: c.chatEmojiSearchEmpty,
      resultsPrefix: c.chatEmojiResultsPrefix,
      ariaLabel: c.dmEmojiAria,
      onPick: (e) => setState(() => _ctrl.text = '${_ctrl.text}$e'),
    );
  }

  Future<void> _jumpToReply(String replyToId) async {
    final id = replyToId.trim();
    if (id.isEmpty) return;
    final key = _msgKeys[id];
    final ctx = key?.currentContext;
    if (ctx == null) return;
    await Scrollable.ensureVisible(
      ctx,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
      alignment: 0.35,
    );
    if (!mounted) return;
    setState(() => _flashId = id);
    _flashTimer?.cancel();
    _flashTimer = Timer(const Duration(milliseconds: 1200), () {
      if (!mounted) return;
      setState(() => _flashId = null);
    });
  }

  String? _lastMarkedId;

  void _scheduleMarkVisible() {
    _markVisibleTimer?.cancel();
    _markVisibleTimer =
        Timer(const Duration(milliseconds: 200), _markVisibleMessages);
  }

  bool _isKeyVisible(GlobalKey key) {
    final ctx = key.currentContext;
    if (ctx == null) return false;
    final box = ctx.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize || !box.attached) return false;
    final scrollCtx = _scroll.positions.isEmpty
        ? null
        : _scroll.position.context.notificationContext;
    final scrollBox = scrollCtx?.findRenderObject() as RenderBox?;
    if (scrollBox == null || !scrollBox.hasSize) return false;
    final msgTopLeft = box.localToGlobal(Offset.zero);
    final scrollTopLeft = scrollBox.localToGlobal(Offset.zero);
    final msgRect = msgTopLeft & box.size;
    final viewRect = scrollTopLeft & scrollBox.size;
    final overlap = msgRect.intersect(viewRect);
    if (overlap.isEmpty) return false;
    return overlap.height >= box.size.height * 0.35;
  }

  void _markVisibleMessages() {
    final display = _displayMessages();
    if (!mounted || display.isEmpty) return;
    String? bestId;
    for (final m in display) {
      if (m.isLocalOutbox) continue;
      final key = _msgKeys[m.id];
      if (key == null) continue;
      if (_isKeyVisible(key)) bestId = m.id;
    }
    if (bestId == null || bestId == _lastMarkedId) return;
    _lastMarkedId = bestId;
    unawaited(
      markDmThreadRead(
        token: widget.accessToken,
        threadId: widget.threadId,
        messageId: bestId,
      ),
    );
  }

  Future<void> _load({bool forceStick = false}) async {
    try {
      final result = await fetchDmMessages(widget.accessToken, widget.threadId);
      if (!mounted) return;
      setState(() {
        _loaded = true;
        if (result.kind != DmMessagesFetchKind.ok) {
          // Poll / live refresh blip: keep prior messages painted (game chat parity).
          // Only hard-fail when we never had a successful page.
          if (_msgs.isEmpty) _loadFailed = true;
          return;
        }
        _loadFailed = false;
        // Drop durable/outbox rows whose client_id appears on server messages.
        final server = result.messages;
        final matchedClientIds = server
            .map((m) => (m.clientId ?? '').trim())
            .where((id) => id.isNotEmpty)
            .toSet();
        if (matchedClientIds.isNotEmpty) {
          _outbox.removeWhere((id, _) => matchedClientIds.contains(id));
          final uid =
              (_outboxUserId ?? context.read<AuthCubit>().state.userId ?? '')
                  .trim();
          if (uid.isNotEmpty) {
            unawaited(dropChatOutboxMatchingServer(uid, matchedClientIds));
          }
        }
        _msgs = server;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loaded = true;
        if (_msgs.isEmpty) _loadFailed = true;
      });
      return;
    }
    // Progressive read after layout (Telegram: only what is on screen).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _stickToLatest(force: forceStick);
      _scheduleMarkVisible();
    });
  }

  Future<void> _pickImage() async {
    if (_uploading || !_canCompose) return;
    setState(() => _uploading = true);
    final result = await pickAndUploadChatImage(
      token: widget.accessToken,
      uploadPath: '/dms/image',
    );
    if (!mounted) return;
    setState(() {
      _uploading = false;
      if (result.kind == ChatImagePickKind.ok) _imageUrl = result.url;
    });
    if (result.kind == ChatImagePickKind.cancelled) return;
    if (result.kind == ChatImagePickKind.notImage) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(widget.chrome.chatImageOnlyHint)),
      );
      return;
    }
    if (result.kind == ChatImagePickKind.failed) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(widget.chrome.dmToastFailed)),
      );
    }
  }

  List<DmMessage> _displayMessages() {
    if (_outbox.isEmpty) return _msgs;
    final byId = <String, DmMessage>{for (final m in _msgs) m.id: m};
    for (final m in _outbox.values) {
      byId[m.id] = m;
    }
    final list = byId.values.toList()
      ..sort((a, b) => (a.createdAt ?? '').compareTo(b.createdAt ?? ''));
    return list;
  }

  Future<void> _send() async {
    final body = _ctrl.text.trim();
    final image = (_imageUrl ?? '').trim();
    final reply = _replyTo;
    final replyId = reply?.id;
    if (!_canCompose) return;
    if (body.isEmpty && image.isEmpty) return;
    final auth = context.read<AuthCubit>().state;
    final myId = (auth.userId ?? '').trim();
    if (myId.isEmpty) return;
    _outboxUserId = myId;
    final replyPreview = reply?.body ??
        ((reply?.imageUrl ?? '').isNotEmpty
            ? widget.chrome.chatImageFallbackLabel
            : reply?.replyPreview);
    final clientId =
        'local-${DateTime.now().microsecondsSinceEpoch}-${_outboxSeq++}';
    final createdAt = DateTime.now().toUtc().toIso8601String();
    _pinToLatest = true;
    // Telegram: clear + paint bubble immediately; never await POST for UI.
    _ctrl.clear();
    setState(() {
      _replyTo = null;
      _imageUrl = null;
    });
    final item = await enqueueChatOutbox(
      myId,
      ChatOutboxItem(
        clientId: clientId,
        kind: ChatOutboxKind.dm,
        threadId: widget.threadId,
        body: body.isEmpty ? null : body,
        imageUrl: image.isEmpty ? null : image,
        replyToId: replyId,
        replyPreview: replyPreview,
        status: ChatOutboxStatus.pending,
        createdAt: createdAt,
      ),
    );
    if (!mounted) return;
    _paintOutboxItem(item);
    _stickToLatest(force: true);
    if (!_focus.hasFocus) _focus.requestFocus();
    _drainOutbox();
  }

  Future<void> _react(String messageId, String emoji) async {
    final ok = await reactDmMessage(
      token: widget.accessToken,
      threadId: widget.threadId,
      messageId: messageId,
      emoji: emoji,
    );
    if (!mounted) return;
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(widget.chrome.dmToastFailed)),
      );
      return;
    }
    await _load();
  }

  Future<void> _accept() async {
    final id = (widget.requestId ?? '').trim();
    if (id.isEmpty || _busy) return;
    setState(() => _busy = true);
    final ok = await acceptDm(widget.accessToken, id);
    if (!mounted) return;
    setState(() {
      _busy = false;
      if (ok) {
        _canCompose = true;
        _status = 'accepted';
      }
    });
    if (ok) _requestComposerFocus();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
          content: Text(ok
              ? widget.chrome.dmToastAccepted
              : widget.chrome.dmToastFailed)),
    );
  }

  Future<void> _deny() async {
    final id = (widget.requestId ?? '').trim();
    if (id.isEmpty || _busy) return;
    setState(() => _busy = true);
    final ok = await denyDm(widget.accessToken, id);
    if (!mounted) return;
    setState(() => _busy = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
          content: Text(
              ok ? widget.chrome.dmToastDenied : widget.chrome.dmToastFailed)),
    );
    if (ok && mounted) Navigator.of(context).pop();
  }

  Future<void> _cancel() async {
    final id = (widget.requestId ?? '').trim();
    if (id.isEmpty || _busy) return;
    setState(() => _busy = true);
    final ok = await cancelDm(widget.accessToken, id);
    if (!mounted) return;
    setState(() => _busy = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
          content: Text(ok
              ? widget.chrome.dmToastCancelled
              : widget.chrome.dmToastFailed)),
    );
    if (ok && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final c = widget.chrome;
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    final myId = (context.watch<AuthCubit>().state.userId ?? '').trim();
    final emojiCatalog = _emojiCatalog;
    final wordCount = () {
      final t = _ctrl.text.trim();
      if (t.isEmpty) return 0;
      return t.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).length;
    }();
    final side = (widget.requestSide ?? '').trim();
    final pending = !_canCompose && _status == 'pending';

    final topSafe = MediaQuery.paddingOf(context).top;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height - bottom,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding:
                  EdgeInsets.fromLTRB(16, topSafe > 0 ? topSafe : 14, 16, 8),
              child: Text(widget.peerName,
                  style: Theme.of(context).textTheme.titleMedium),
            ),
            Expanded(
              child: ColoredBox(
                // Soft chat canvas (web `--dama-chat-wallpaper` parity - not flat white).
                color: Theme.of(context).brightness == Brightness.dark
                    ? const Color(0xFF151A17)
                    : const Color(0xFFE8EBE4),
                child: !_loaded
                    ? Center(
                        child: Text(
                          c.dmChatLoading,
                          style: TextStyle(color: tokens.onSurfaceMuted),
                        ),
                      )
                    : () {
                        final display = _displayMessages();
                        if (display.isEmpty) {
                          return Center(
                            child: Text(
                              // Hard-fail only with no messages; otherwise keep empty/loaded state.
                              _loadFailed ? c.dmLoadFailedLabel : c.dmChatEmpty,
                              style: TextStyle(color: tokens.onSurfaceMuted),
                            ),
                          );
                        }
                        return Builder(
                          builder: (context) {
                            final timeline = buildChatTimeline<DmMessage>(
                              messages: display,
                              createdAtOf: (m) => m.createdAt ?? '',
                              todayLabel: c.chatDateToday,
                              yesterdayLabel: c.chatDateYesterday,
                            );
                            return ListView.builder(
                              controller: _scroll,
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              itemCount: timeline.length,
                              itemBuilder: (_, i) {
                                final item = timeline[i];
                                if (item.isDate) {
                                  return Padding(
                                    padding:
                                        const EdgeInsets.symmetric(vertical: 8),
                                    child: Center(
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 12,
                                          vertical: 4,
                                        ),
                                        decoration: BoxDecoration(
                                          color: tokens.card
                                              .withValues(alpha: 0.9),
                                          borderRadius:
                                              BorderRadius.circular(999),
                                          border: Border.all(
                                              color: tokens.borderSubtle),
                                        ),
                                        child: Text(
                                          item.label ?? '',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                            color: tokens.onSurfaceMuted,
                                          ),
                                        ),
                                      ),
                                    ),
                                  );
                                }
                                final m = item.message!;
                                final mine =
                                    myId.isNotEmpty && m.userId == myId;
                                return KeyedSubtree(
                                  key: _keyFor(m.id),
                                  child: ChatMessageBubble(
                                    messageId: m.id,
                                    username: m.username,
                                    mine: mine,
                                    body: m.body,
                                    imageUrl: m.imageUrl,
                                    replyToId: m.replyToId,
                                    replyPreview: m.replyPreview,
                                    avatarThumbUrl: m.avatarThumbUrl,
                                    countryCode: m.countryCode,
                                    reactions: m.reactions,
                                    // Outbox localStatus only for pending/failed; else server receipt.
                                    receipt: () {
                                      final local =
                                          (m.localStatus ?? '').trim();
                                      if (local == 'pending' ||
                                          local == 'failed' ||
                                          local == 'sending') {
                                        return local;
                                      }
                                      return m.receipt;
                                    }(),
                                    showReceipt: true,
                                    createdAt: m.createdAt,
                                    replyActionLabel: c.dmReplyAction,
                                    highlighted: _flashId == m.id,
                                    emojiCatalog: emojiCatalog,
                                    youLabel: c.chatYouLabel,
                                    replyPreviewLabel: c.chatReplyLabel,
                                    reactActionLabel: c.chatReactAction,
                                    reactMoreAria: c.chatReactMoreAria,
                                    emojiSearchPlaceholder:
                                        c.chatEmojiSearchPlaceholder,
                                    emojiSearchEmpty: c.chatEmojiSearchEmpty,
                                    emojiResultsPrefix:
                                        c.chatEmojiResultsPrefix,
                                    receiptSentAria: c.chatReceiptSentAria,
                                    receiptSeenAria: c.chatReceiptSeenAria,
                                    receiptDeliveredAria:
                                        c.chatReceiptDeliveredAria,
                                    seenByPrefix: c.chatSeenByPrefix,
                                    receiptSentGlyph: c.chatReceiptSentGlyph,
                                    receiptReadGlyph: c.chatReceiptReadGlyph,
                                    receiptDeliveredGlyph:
                                        c.chatReceiptDeliveredGlyph,
                                    seenCountGlyph: c.chatSeenCountGlyph,
                                    receiptPendingAria:
                                        c.chatReceiptPendingAria,
                                    receiptPendingGlyph:
                                        c.chatReceiptPendingGlyph,
                                    receiptFailedAria: c.chatReceiptFailedAria,
                                    receiptFailedGlyph:
                                        c.chatReceiptFailedGlyph,
                                    receiptRetryAction:
                                        c.chatReceiptRetryAction,
                                    onRetry: m.isLocalOutbox &&
                                            m.localStatus == 'failed'
                                        ? () => unawaited(_retryOutbox(m))
                                        : null,
                                    mediaLightboxTitle:
                                        c.chatMediaLightboxTitle,
                                    mediaLightboxCloseAria:
                                        c.chatMediaLightboxCloseAria,
                                    onSenderTap: m.userId.trim().isEmpty
                                        ? null
                                        : () =>
                                            unawaited(_openSender(m.userId)),
                                    onJumpToReply: _jumpToReply,
                                    canReact: _canCompose &&
                                        emojiCatalog != null &&
                                        !m.isLocalOutbox,
                                    onReact: _canCompose &&
                                            emojiCatalog != null &&
                                            !m.isLocalOutbox
                                        ? (emoji) =>
                                            unawaited(_react(m.id, emoji))
                                        : null,
                                    onReply: _canCompose && !m.isLocalOutbox
                                        ? () => setState(() => _replyTo = m)
                                        : null,
                                  ),
                                );
                              },
                            );
                          },
                        );
                      }(),
              ),
            ),
            if (pending && side == 'in')
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      c.dmRequestPendingLabel,
                      style:
                          TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton(
                            onPressed:
                                _busy ? null : () => unawaited(_accept()),
                            child:
                                Text(_busy ? c.dmAccepting : c.dmAcceptAction),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _busy ? null : () => unawaited(_deny()),
                            child: Text(_busy ? c.dmDenying : c.dmDenyAction),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              )
            else if (pending && side == 'out')
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      c.dmRequestOutgoingLabel,
                      style:
                          TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton(
                      onPressed: _busy ? null : () => unawaited(_cancel()),
                      child: Text(_busy ? c.dmCancelling : c.dmCancelAction),
                    ),
                  ],
                ),
              )
            else if (!_canCompose)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                child: Text(
                  _status == 'denied'
                      ? c.dmRequestDeniedLabel
                      : _status == 'cancelled'
                          ? c.dmRequestCancelledLabel
                          : c.dmRequestPendingLabel,
                  style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
                ),
              ),
            if (_canCompose)
              Material(
                color: tokens.card,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    border: Border(top: BorderSide(color: tokens.borderSubtle)),
                    color: tokens.card.withValues(alpha: 0.97),
                  ),
                  child: ChatComposerBar(
                    controller: _ctrl,
                    focusNode: _focus,
                    autofocus: true,
                    enabled: true,
                    busy: _uploading,
                    uploading: _uploading,
                    placeholder: c.dmInputPlaceholder,
                    sendLabel: c.dmSendAction,
                    sendingLabel: c.dmSending,
                    wordsLabel: c.dmWordsLabel,
                    wordCount: wordCount,
                    attachAria: c.dmAttachImageAria,
                    emojiAria: c.dmEmojiAria,
                    removeImageAria: c.removeImageAria,
                    replyCancelAria: c.dmReplyCancel,
                    replyUsername: _replyTo?.username,
                    replyBody: _replyTo?.body ??
                        ((_replyTo?.imageUrl ?? '').isNotEmpty
                            ? c.chatImageFallbackLabel
                            : null),
                    onClearReply: () => setState(() => _replyTo = null),
                    imageUrl: _imageUrl,
                    onClearImage: () => setState(() => _imageUrl = null),
                    onChanged: (_) => setState(() {}),
                    imageFallbackLabel: c.chatImageFallbackLabel,
                    emojiEnabled: emojiCatalog != null,
                    onAttach: () => unawaited(_pickImage()),
                    onEmoji: () => unawaited(_openEmojiPicker()),
                    onSend: () => unawaited(_send()),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
