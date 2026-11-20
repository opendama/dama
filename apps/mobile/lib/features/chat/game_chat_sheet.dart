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
import 'package:dama_mobile/features/chat/chat_image_upload.dart';
import 'package:dama_mobile/features/chat/chat_message_bubble.dart';
import 'package:dama_mobile/features/chat/chat_outbox.dart';
import 'package:dama_mobile/features/chat/game_chat_api.dart';
import 'package:dama_mobile/features/chat/game_chat_live.dart';
import 'package:dama_mobile/features/game/matchmaking_realtime.dart';
import 'package:dama_mobile/features/player/open_create_game_challenge.dart';
import 'package:dama_mobile/features/player/player_inspect_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

Future<void> showGameChatSheet(
  BuildContext context, {
  required PlayRailChrome chrome,
  required String gameId,
  String? accessToken,
  String? observingLabel,
  String? observingMatchup,
  String? observingTimeLabel,
}) {
  final auth = context.read<AuthCubit>();
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: false,
    backgroundColor: damaColorsOf(context).card,
    builder: (_) => BlocProvider.value(
      value: auth,
      child: _GameChatBody(
        chrome: chrome,
        gameId: gameId,
        accessToken: accessToken,
        observingLabel: observingLabel,
        observingMatchup: observingMatchup,
        observingTimeLabel: observingTimeLabel,
      ),
    ),
  );
}

class _GameChatBody extends StatefulWidget {
  const _GameChatBody({
    required this.chrome,
    required this.gameId,
    this.accessToken,
    this.observingLabel,
    this.observingMatchup,
    this.observingTimeLabel,
  });

  final PlayRailChrome chrome;
  final String gameId;
  final String? accessToken;
  final String? observingLabel;
  final String? observingMatchup;
  final String? observingTimeLabel;

  @override
  State<_GameChatBody> createState() => _GameChatBodyState();
}

class _GameChatBodyState extends State<_GameChatBody> {
  final _ctrl = TextEditingController();
  final _focus = FocusNode();
  final _scroll = ScrollController();
  final Map<String, GlobalKey> _msgKeys = {};
  GameChatPayload? _payload;

  /// Telegram outbox: clientId → pending/failed/sending bubble (durable + ordered drain).
  final Map<String, GameChatMessage> _outbox = {};
  int _outboxSeq = 0;
  String? _outboxUserId;
  GameChatMessage? _replyTo;
  String? _imageUrl;
  String? _flashId;
  bool _busy = false;
  bool _uploading = false;
  GameChatFetchKind? _loadError;

  /// Telegram: stay pinned unless the user scrolls up into history.
  bool _pinToLatest = true;

  /// Autofocus once per open when posting becomes available (avoid poll steal).
  bool _didAutoFocusComposer = false;
  Timer? _poll;
  Timer? _flashTimer;
  Timer? _markVisibleTimer;
  StreamSubscription<String>? _liveSub;
  MatchmakingRealtimeController? _avatarRt;
  int _seenAvatarSeq = 0;
  ChatEmojiCatalog? _emojiCatalog;
  String? _lastMarkedId;

  bool get _canPostComposer {
    final token = (widget.accessToken ?? '').trim();
    return token.isNotEmpty && _payload?.canPost == true;
  }

  void _requestComposerFocus({bool force = false}) {
    if (!_canPostComposer) return;
    if (_didAutoFocusComposer && !force) return;
    _didAutoFocusComposer = true;
    requestChatComposerFocus(
      _focus,
      enabled: true,
      mounted: () => mounted && _canPostComposer,
    );
  }

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    unawaited(_loadEmojiCatalog());
    unawaited(_hydrateOutboxAndLoad());
    final pollMs = int.tryParse(widget.chrome.chatPollIntervalMs.trim()) ?? 0;
    if (pollMs > 0) {
      _poll = Timer.periodic(
          Duration(milliseconds: pollMs), (_) => unawaited(_load()));
    }
    _liveSub = GameChatLive.stream.listen((gid) {
      if (gid == widget.gameId.trim()) unawaited(_load());
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _bindAvatarRt());
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
      kind: ChatOutboxKind.game,
      gameId: widget.gameId,
    );
    if (!mounted) return;
    setState(() {
      _outbox
        ..clear()
        ..addEntries(
          items.map(
              (item) => MapEntry(item.clientId, _gameFromOutbox(item, auth))),
        );
    });
  }

  GameChatMessage _gameFromOutbox(ChatOutboxItem item, AuthState auth) {
    final failed = item.status == ChatOutboxStatus.failed;
    final local = failed ? 'failed' : 'pending';
    return GameChatMessage(
      id: item.clientId,
      userId: (auth.userId ?? '').trim(),
      username: (auth.username ?? '').trim(),
      body: item.body,
      imageUrl: item.imageUrl,
      replyToId: item.replyToId,
      replyPreview: item.replyPreview,
      avatarThumbUrl: auth.avatarUrl,
      clientId: item.clientId,
      localStatus: local,
      createdAt: item.createdAt,
    );
  }

  void _paintOutboxItem(ChatOutboxItem item) {
    final auth = context.read<AuthCubit>().state;
    setState(() {
      _outbox[item.clientId] = _gameFromOutbox(item, auth);
    });
  }

  void _drainOutbox() {
    final uid =
        (_outboxUserId ?? context.read<AuthCubit>().state.userId ?? '').trim();
    final token = (widget.accessToken ?? '').trim();
    if (uid.isEmpty || token.isEmpty) return;
    unawaited(
      drainChatOutbox(
        userId: uid,
        kind: ChatOutboxKind.game,
        gameId: widget.gameId,
        send: (item) async {
          final server = await postGameChat(
            token: token,
            gameId: widget.gameId,
            body: item.body,
            imageUrl: item.imageUrl,
            replyToId: item.replyToId,
            clientId: item.clientId,
          );
          if (server == null) {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(widget.chrome.chatToastSendFailed)),
              );
            }
            throw StateError('game_chat_send_failed');
          }
          if (!mounted) return;
          final cur = _payload;
          if (cur != null && server.id.isNotEmpty && server.userId.isNotEmpty) {
            setState(() {
              _outbox.remove(item.clientId);
              _payload = GameChatPayload(
                enabled: cur.enabled,
                canToggle: cur.canToggle,
                canPost: cur.canPost,
                unreadCount: cur.unreadCount,
                messages: [
                  ...cur.messages.where(
                    (m) =>
                        m.id != server.id &&
                        m.id != item.clientId &&
                        (m.clientId ?? '') != item.clientId,
                  ),
                  server,
                ],
              );
            });
            _stickToLatest(force: true);
            return;
          }
          // HTTP ok but empty body - soft-reload; keep bubble until server client_id matches.
          await _load();
          if (!mounted) return;
          if (_outbox.containsKey(item.clientId)) {
            throw StateError('game_chat_send_unconfirmed');
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

  Future<void> _retryOutbox(GameChatMessage msg) async {
    final uid =
        (_outboxUserId ?? context.read<AuthCubit>().state.userId ?? '').trim();
    final clientId = (msg.clientId ?? msg.id).trim();
    if (uid.isEmpty || clientId.isEmpty) return;
    final item = await enqueueChatOutbox(
      uid,
      ChatOutboxItem(
        clientId: clientId,
        kind: ChatOutboxKind.game,
        gameId: widget.gameId,
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

  void _onScroll() {
    _pinToLatest = isChatNearBottom(_scroll);
    _scheduleMarkVisible();
  }

  void _stickToLatest({bool force = false}) {
    if (!force && !_pinToLatest) return;
    _pinToLatest = true;
    scrollChatToLatest(_scroll);
  }

  void _bindAvatarRt() {
    if (!mounted) return;
    final rt = MatchmakingRealtimeScope.maybeOf(context);
    if (identical(rt, _avatarRt)) return;
    _avatarRt?.removeListener(_onAvatarRt);
    _avatarRt = rt;
    _avatarRt?.addListener(_onAvatarRt);
    _seenAvatarSeq = rt?.avatarEventSeq ?? 0;
  }

  void _onAvatarRt() {
    final rt = _avatarRt;
    final payload = _payload;
    if (rt == null || payload == null || !mounted) return;
    if (rt.avatarEventSeq == _seenAvatarSeq) return;
    _seenAvatarSeq = rt.avatarEventSeq;
    final uid = (rt.lastAvatarUserId ?? '').trim();
    if (uid.isEmpty) return;
    final thumb = (rt.lastAvatarThumbUrl ?? '').trim();
    final full = (rt.lastAvatarFullUrl ?? '').trim();
    final clear = thumb.isEmpty && full.isEmpty;
    final next = clear ? null : (thumb.isNotEmpty ? thumb : full);
    var touched = false;
    final messages = payload.messages.map((m) {
      if (m.userId != uid) return m;
      touched = true;
      return GameChatMessage(
        id: m.id,
        userId: m.userId,
        username: m.username,
        body: m.body,
        imageUrl: m.imageUrl,
        replyToId: m.replyToId,
        replyPreview: m.replyPreview,
        avatarThumbUrl: next,
        countryCode: m.countryCode,
        reactions: m.reactions,
        seenCount: m.seenCount,
        seenTotal: m.seenTotal,
        clientId: m.clientId,
        localStatus: m.localStatus,
        createdAt: m.createdAt,
      );
    }).toList();
    if (!touched) return;
    setState(() {
      _payload = GameChatPayload(
        enabled: payload.enabled,
        canToggle: payload.canToggle,
        canPost: payload.canPost,
        messages: messages,
      );
    });
  }

  @override
  void dispose() {
    _avatarRt?.removeListener(_onAvatarRt);
    _avatarRt = null;
    _poll?.cancel();
    _flashTimer?.cancel();
    _markVisibleTimer?.cancel();
    _liveSub?.cancel();
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
      ariaLabel: c.chatEmojiAria,
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
    final token = (widget.accessToken ?? '').trim();
    final msgs = _displayMessages();
    if (!mounted || token.isEmpty || msgs.isEmpty) return;
    String? bestId;
    for (final m in msgs) {
      if (m.isLocalOutbox) continue;
      final key = _msgKeys[m.id];
      if (key == null) continue;
      if (_isKeyVisible(key)) bestId = m.id;
    }
    if (bestId == null || bestId == _lastMarkedId) return;
    _lastMarkedId = bestId;
    unawaited(markGameChatRead(
        token: token, gameId: widget.gameId, messageId: bestId));
  }

  Future<void> _load({bool forceStick = false}) async {
    final hadCanPost = _canPostComposer;
    try {
      final result =
          await fetchGameChat(widget.gameId, token: widget.accessToken);
      if (!mounted) return;
      if (result.kind != GameChatFetchKind.ok || result.payload == null) {
        // Keep prior payload painted on poll blips; only surface error when empty.
        setState(() {
          if (_payload == null) _loadError = result.kind;
        });
        return;
      }
      setState(() {
        final server = result.payload!;
        final matchedClientIds = server.messages
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
        _payload = server;
        _loadError = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        if (_payload == null) _loadError = GameChatFetchKind.failed;
      });
      return;
    }
    // First open (or chat re-enabled): caret ready when posting is allowed.
    if (_canPostComposer) {
      if (!_didAutoFocusComposer) {
        _requestComposerFocus();
      } else if (!hadCanPost) {
        _requestComposerFocus(force: true);
      }
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _stickToLatest(force: forceStick);
      _scheduleMarkVisible();
    });
  }

  List<GameChatMessage> _displayMessages() {
    final base = _payload?.messages ?? const <GameChatMessage>[];
    if (_outbox.isEmpty) return base;
    final byId = <String, GameChatMessage>{for (final m in base) m.id: m};
    for (final m in _outbox.values) {
      byId[m.id] = m;
    }
    final list = byId.values.toList()
      ..sort((a, b) => (a.createdAt ?? '').compareTo(b.createdAt ?? ''));
    return list;
  }

  Future<void> _pickImage() async {
    final token = (widget.accessToken ?? '').trim();
    if (token.isEmpty || _uploading) return;
    setState(() => _uploading = true);
    final result = await pickAndUploadChatImage(
      token: token,
      uploadPath: '/games/${widget.gameId}/chat/image',
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
        SnackBar(content: Text(widget.chrome.chatToastSendFailed)),
      );
    }
  }

  Future<void> _send() async {
    final token = (widget.accessToken ?? '').trim();
    final body = _ctrl.text.trim();
    final image = (_imageUrl ?? '').trim();
    final reply = _replyTo;
    final replyId = reply?.id;
    if (token.isEmpty) return;
    if (body.isEmpty && image.isEmpty) return;
    if (_payload?.canPost != true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(widget.chrome.chatToastDisabled)),
      );
      return;
    }
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
        kind: ChatOutboxKind.game,
        gameId: widget.gameId,
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

  Future<void> _toggle() async {
    final token = (widget.accessToken ?? '').trim();
    final enabled = _payload?.enabled != false;
    if (token.isEmpty || _payload?.canToggle != true) return;
    setState(() => _busy = true);
    final ok = await toggleGameChat(
      token: token,
      gameId: widget.gameId,
      enabled: !enabled,
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(widget.chrome.chatToastToggleFailed)),
      );
      return;
    }
    await _load();
  }

  Future<void> _react(String messageId, String emoji) async {
    final token = (widget.accessToken ?? '').trim();
    if (token.isEmpty) return;
    final ok = await reactGameChat(
      token: token,
      gameId: widget.gameId,
      messageId: messageId,
      emoji: emoji,
    );
    if (!mounted) return;
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(widget.chrome.chatToastSendFailed)),
      );
      return;
    }
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final c = widget.chrome;
    final enabled = _payload?.enabled == true;
    final canPost = _payload?.canPost == true;
    final msgs = _displayMessages();
    final signedIn = (widget.accessToken ?? '').trim().isNotEmpty;
    final myId = (context.watch<AuthCubit>().state.userId ?? '').trim();
    final emojiCatalog = _emojiCatalog;
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    final wordCount = () {
      final t = _ctrl.text.trim();
      if (t.isEmpty) return 0;
      return t.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).length;
    }();

    final topSafe = MediaQuery.paddingOf(context).top;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: SizedBox(
        // Push composer to the physical bottom (immersive); top keeps status-bar clearance.
        height: MediaQuery.sizeOf(context).height - bottom,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding:
                  EdgeInsets.fromLTRB(16, topSafe > 0 ? topSafe : 14, 16, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      c.watchTabChat,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  Text(
                    enabled ? c.chatEnabledLabel : c.chatDisabledLabel,
                    style:
                        TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
                  ),
                ],
              ),
            ),
            if ((widget.observingLabel ?? '').trim().isNotEmpty ||
                (widget.observingMatchup ?? '').trim().isNotEmpty ||
                (widget.observingTimeLabel ?? '').trim().isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if ((widget.observingLabel ?? '').trim().isNotEmpty)
                      Text(
                        widget.observingLabel!.trim().toUpperCase(),
                        style: TextStyle(
                          color: tokens.onSurfaceMuted,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.6,
                        ),
                      ),
                    if ((widget.observingMatchup ?? '').trim().isNotEmpty ||
                        (widget.observingTimeLabel ?? '').trim().isNotEmpty)
                      Text.rich(
                        TextSpan(
                          style: const TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w600),
                          children: [
                            if ((widget.observingMatchup ?? '')
                                .trim()
                                .isNotEmpty)
                              TextSpan(text: widget.observingMatchup!.trim()),
                            if ((widget.observingTimeLabel ?? '')
                                .trim()
                                .isNotEmpty)
                              TextSpan(
                                text:
                                    '${(widget.observingMatchup ?? '').trim().isNotEmpty ? ' ' : ''}(${widget.observingTimeLabel!.trim()})',
                                style: TextStyle(
                                  fontWeight: FontWeight.w500,
                                  color: tokens.onSurfaceMuted,
                                ),
                              ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            Expanded(
              child: ColoredBox(
                // Soft chat canvas (web `--dama-chat-wallpaper` parity - not flat white).
                color: Theme.of(context).brightness == Brightness.dark
                    ? const Color(0xFF151A17)
                    : const Color(0xFFE8EBE4),
                child: _payload == null
                    ? Center(
                        child: Text(
                          _loadError == GameChatFetchKind.joinRequired
                              ? c.chatJoinRequiredLabel
                              : _loadError == GameChatFetchKind.failed
                                  ? c.chatLoadFailedLabel
                                  : c.chatLoading,
                          style: TextStyle(color: tokens.onSurfaceMuted),
                        ),
                      )
                    : msgs.isEmpty
                        ? Center(
                            child: Text(
                              c.chatEmpty,
                              style: TextStyle(color: tokens.onSurfaceMuted),
                            ),
                          )
                        : Builder(
                            builder: (context) {
                              final timeline =
                                  buildChatTimeline<GameChatMessage>(
                                messages: msgs,
                                createdAtOf: (m) => m.createdAt ?? '',
                                todayLabel: c.chatDateToday,
                                yesterdayLabel: c.chatDateYesterday,
                              );
                              return ListView.builder(
                                controller: _scroll,
                                padding:
                                    const EdgeInsets.symmetric(vertical: 8),
                                itemCount: timeline.length,
                                itemBuilder: (_, i) {
                                  final item = timeline[i];
                                  if (item.isDate) {
                                    return Padding(
                                      padding: const EdgeInsets.symmetric(
                                          vertical: 8),
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
                                      receipt: m.localStatus,
                                      showReceipt: m.isLocalOutbox,
                                      seenCount: m.seenCount,
                                      seenTotal: m.seenTotal,
                                      showSeenCount: !m.isLocalOutbox,
                                      createdAt: m.createdAt,
                                      replyActionLabel: c.chatReplyAction,
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
                                      receiptFailedAria:
                                          c.chatReceiptFailedAria,
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
                                      canReact: canPost &&
                                          signedIn &&
                                          emojiCatalog != null &&
                                          !m.isLocalOutbox,
                                      onReact: canPost &&
                                              signedIn &&
                                              emojiCatalog != null &&
                                              !m.isLocalOutbox
                                          ? (emoji) =>
                                              unawaited(_react(m.id, emoji))
                                          : null,
                                      onReply: canPost &&
                                              signedIn &&
                                              !m.isLocalOutbox
                                          ? () => setState(() => _replyTo = m)
                                          : null,
                                    ),
                                  );
                                },
                              );
                            },
                          ),
              ),
            ),
            Material(
              color: tokens.card,
              elevation: 0,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: tokens.borderSubtle)),
                  color: tokens.card.withValues(alpha: 0.97),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_payload?.canToggle == true)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                enabled
                                    ? c.chatEnabledLabel
                                    : c.chatDisabledLabel,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color:
                                      Theme.of(context).colorScheme.onSurface,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 0.2,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            if (enabled)
                              OutlinedButton(
                                onPressed: _busy ? null : _toggle,
                                style: OutlinedButton.styleFrom(
                                  visualDensity: VisualDensity.compact,
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 14),
                                  shape: const StadiumBorder(),
                                ),
                                child: Text(c.chatDisableAction),
                              )
                            else
                              FilledButton(
                                onPressed: _busy ? null : _toggle,
                                style: FilledButton.styleFrom(
                                  visualDensity: VisualDensity.compact,
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 14),
                                  shape: const StadiumBorder(),
                                ),
                                child: Text(c.chatEnableAction),
                              ),
                          ],
                        ),
                      ),
                    ChatComposerBar(
                      controller: _ctrl,
                      focusNode: _focus,
                      autofocus: canPost && signedIn,
                      enabled: canPost && signedIn,
                      busy: _uploading,
                      uploading: _uploading,
                      placeholder: canPost
                          ? c.chatInputPlaceholder
                          : c.chatDisabledLabel,
                      sendLabel: c.chatSendAction,
                      sendingLabel: c.chatSending,
                      wordsLabel: c.dmWordsLabel,
                      wordCount: wordCount,
                      attachAria: c.chatAttachImageAria,
                      emojiAria: c.chatEmojiAria,
                      removeImageAria: c.removeImageAria,
                      replyCancelAria: c.chatReplyCancel,
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
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
