import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/audio/game_notify.dart';
import 'package:dama_mobile/core/audio/invite_alert.dart';
import 'package:dama_mobile/core/cache/query_cache.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/chat/chat_message_notify.dart';
import 'package:dama_mobile/features/chat/dm_thread_live.dart';
import 'package:dama_mobile/features/game/match_board_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;
import 'package:web_socket_channel/web_socket_channel.dart';

/// Shell-wide matchmaking WS (web MatchmakingRealtimeProvider parity).
/// Keeps invite ringtone alive on every tab, not only Matchmaking.
class MatchmakingRealtimeController extends ChangeNotifier {
  MatchmakingRealtimeController();

  WebSocketChannel? _ws;
  StreamSubscription? _wsSub;
  String? _token;
  String? _myUserId;
  MatchmakingChrome? _chrome;
  PlayRailChrome? _railChrome;
  List<MatchClockPreset> _tcPresets = const [];
  bool connected = false;
  int? queueSize;
  MatchInvite? incoming;
  String? outgoingInviteId;
  String? outgoingToUsername;
  bool outgoingDismissed = false;
  String? lastStatusToast;
  String? matchedP1;
  String? matchedP2;
  bool inviteActionBusy = false;
  Timer? _outgoingPoll;
  bool _enteringMatch = false;

  /// Called when another (or same) client uploads a new avatar.
  void Function(String userId, String? thumbUrl, String? fullUrl)?
      onAvatarUpdated;

  /// Monotonic seq so rails/seats can patch in-memory lists (QueryCache alone does not rebuild UI).
  int avatarEventSeq = 0;
  String? lastAvatarUserId;
  String? lastAvatarThumbUrl;
  String? lastAvatarFullUrl;

  MatchmakingChrome? get chrome => _chrome;
  PlayRailChrome? get railChrome => _railChrome;

  /// Accept-dialog body: from + rated/unrated + color + TC label (DB only).
  String formatIncomingInviteBody(MatchInvite invite) {
    final chrome = _chrome;
    if (chrome == null) return '';
    final parts = <String>[
      invite.fromUsername != null && invite.fromUsername!.isNotEmpty
          ? '${chrome.inviteFromPrefix} ${invite.fromUsername}'
          : chrome.toastInviteReceived,
    ];
    final trust = (invite.fromHostTrustBadge ?? '').trim();
    if (trust.isNotEmpty) parts.add(trust);
    final rail = _railChrome;
    if (rail != null) {
      if (invite.rated == true) {
        parts.add(rail.labelRated);
      } else if (invite.rated == false) {
        parts.add(rail.labelUnrated);
      }
      final color = (invite.preferredColor ?? '').trim();
      if (color == 'white') {
        parts.add(rail.ariaColorWhite);
      } else if (color == 'black') {
        parts.add(rail.ariaColorBlack);
      } else if (color == 'random') {
        parts.add(rail.ariaColorRandom);
      }
    }
    final sec = invite.timeControlSeconds;
    if (sec != null && sec > 0) {
      for (final p in _tcPresets) {
        if (p.seconds == sec && p.label.trim().isNotEmpty) {
          parts.add(p.label.trim());
          break;
        }
      }
    }
    return parts.where((s) => s.trim().isNotEmpty).join(chrome.metaSeparator);
  }

  Future<void> bindToken(String? token, {String? userId}) async {
    _myUserId = (userId ?? '').trim().isEmpty ? null : userId!.trim();
    if (token == _token && _ws != null) return;
    await disposeSocket();
    _token = token;
    incoming = null;
    outgoingInviteId = null;
    outgoingToUsername = null;
    outgoingDismissed = false;
    matchedP1 = null;
    matchedP2 = null;
    lastStatusToast = null;
    queueSize = null;
    connected = false;
    notifyListeners();
    if (token == null || token.isEmpty) return;
    await _loadChrome();
    _connect(token);
  }

  Future<void> _loadChrome() async {
    try {
      final results = await Future.wait([
        http.get(Uri.parse(
            '${ApiConfig.defaults.restUrl}/public/matchmaking-chrome')),
        http.get(
            Uri.parse('${ApiConfig.baseUrl}/api/v1/public/play-rail-chrome')),
        http.get(Uri.parse('${ApiConfig.baseUrl}/api/v1/progression')),
      ]);
      final mmRes = results[0];
      if (mmRes.statusCode == 200) {
        final decoded = jsonDecode(mmRes.body);
        if (decoded is Map<String, dynamic>) {
          _chrome = MatchmakingChrome.fromJson(decoded);
        }
      }
      final railRes = results[1];
      if (railRes.statusCode == 200) {
        final decoded = jsonDecode(railRes.body);
        if (decoded is Map<String, dynamic>) {
          _railChrome = PlayRailChrome.fromJson(decoded);
        }
      }
      final progRes = results[2];
      if (progRes.statusCode == 200) {
        final decoded = jsonDecode(progRes.body);
        if (decoded is Map<String, dynamic>) {
          final progression = ProgressionConfig.fromJson(decoded);
          _tcPresets =
              progression.matchClock?.presets ?? const <MatchClockPreset>[];
        }
      }
      notifyListeners();
    } catch (_) {}
  }

  void _connect(String token) {
    final origin = ApiConfig.baseUrl.replaceFirst(RegExp(r'^http'), 'ws');
    final uri = Uri.parse(
      '$origin/ws/matchmaking?token=${Uri.encodeComponent(token)}',
    );
    _ws = WebSocketChannel.connect(uri);
    _wsSub = _ws!.stream.listen(
      _onMessage,
      onDone: () {
        connected = false;
        notifyListeners();
      },
      onError: (_) {
        connected = false;
        notifyListeners();
      },
    );
    connected = true;
    notifyListeners();
    unawaited(_reconcilePendingOutgoing());
  }

  Future<void> _reconcilePendingOutgoing() async {
    final token = (_token ?? '').trim();
    final me = (_myUserId ?? '').trim();
    if (token.isEmpty || me.isEmpty) return;
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/invites/pending'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (res.statusCode != 200) return;
      final decoded = jsonDecode(res.body);
      if (decoded is! Map<String, dynamic>) return;
      final list = decoded['invites'];
      if (list is! List) return;
      for (final row in list) {
        if (row is! Map<String, dynamic>) continue;
        final from = (row['from_user_id']?.toString() ?? '').trim();
        final status = (row['status']?.toString() ?? '').trim();
        final id = (row['id']?.toString() ?? '').trim();
        if (from == me && status == 'pending' && id.isNotEmpty) {
          if (outgoingInviteId != id) {
            outgoingInviteId = id;
            outgoingToUsername = null;
            outgoingDismissed = false;
            _startOutgoingPoll(id);
            notifyListeners();
          }
          return;
        }
      }
    } catch (_) {}
  }

  void _startOutgoingPoll(String inviteId) {
    _outgoingPoll?.cancel();
    final id = inviteId.trim();
    if (id.isEmpty) return;
    _outgoingPoll = Timer.periodic(const Duration(seconds: 2), (_) {
      unawaited(_pollOutgoingInvite(id));
    });
    unawaited(_pollOutgoingInvite(id));
  }

  void _stopOutgoingPoll() {
    _outgoingPoll?.cancel();
    _outgoingPoll = null;
  }

  Future<void> _pollOutgoingInvite(String inviteId) async {
    final token = (_token ?? '').trim();
    final id = inviteId.trim();
    if (token.isEmpty || id.isEmpty) return;
    if (outgoingInviteId != id) return;
    try {
      final res = await http.get(
        Uri.parse(
            '${ApiConfig.baseUrl}/api/v1/invites/${Uri.encodeComponent(id)}'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (res.statusCode != 200) return;
      final decoded = jsonDecode(res.body);
      if (decoded is! Map<String, dynamic>) return;
      final inv = decoded['invite'];
      if (inv is! Map<String, dynamic>) return;
      final status = (inv['status']?.toString() ?? '').trim();
      final gid = (inv['game_id']?.toString() ?? '').trim();
      if (status == 'accepted' && gid.isNotEmpty) {
        _enterAcceptedMatch(gid);
      }
    } catch (_) {}
  }

  void _enterAcceptedMatch(String gameId) {
    final gid = gameId.trim();
    if (gid.isEmpty || _enteringMatch) return;
    _enteringMatch = true;
    _stopOutgoingPoll();
    unawaited(InviteAlert.playResolvedChime());
    unawaited(GameNotify.play('match_found'));
    inviteActionBusy = false;
    incoming = null;
    outgoingInviteId = null;
    outgoingToUsername = null;
    outgoingDismissed = false;
    lastStatusToast = _chrome?.toastInviteAccepted;
    notifyListeners();
    _openMatchCallback?.call(gid);
    Future<void>.delayed(const Duration(milliseconds: 800), () {
      _enteringMatch = false;
    });
  }

  void _onMessage(dynamic event) {
    if (event is! String) return;
    try {
      final msg = jsonDecode(event) as Map<String, dynamic>;
      final type = msg['type']?.toString() ?? '';
      switch (type) {
        case 'invite_received':
          final inv = msg['invite'];
          if (inv is Map<String, dynamic> && inv['id'] != null) {
            final invite = MatchInvite.fromJson(inv);
            if (invite.id.isNotEmpty) {
              unawaited(InviteAlert.start());
              incoming = invite;
              lastStatusToast = invite.fromUsername != null &&
                      invite.fromUsername!.isNotEmpty &&
                      _chrome != null
                  ? '${_chrome!.inviteFromPrefix} ${invite.fromUsername}'
                  : _chrome?.toastInviteReceived;
              notifyListeners();
            }
          }
        case 'invite_accepted':
          final gid = msg['game_id']?.toString() ?? '';
          if (gid.isNotEmpty) {
            _enterAcceptedMatch(gid);
          }
        case 'invite_declined':
          unawaited(InviteAlert.playResolvedChime());
          inviteActionBusy = false;
          incoming = null; // actor who declined
          outgoingInviteId = null; // inviter notified
          outgoingToUsername = null;
          outgoingDismissed = false;
          _stopOutgoingPoll();
          lastStatusToast = _chrome?.toastInviteDeclined;
          notifyListeners();
        case 'invite_cancelled':
          unawaited(InviteAlert.stop());
          inviteActionBusy = false;
          outgoingInviteId = null; // actor who cancelled
          outgoingToUsername = null;
          outgoingDismissed = false;
          incoming = null; // invitee notified
          _stopOutgoingPoll();
          lastStatusToast = _chrome?.toastInviteCancelled;
          notifyListeners();
        case 'error':
          inviteActionBusy = false;
          final err = msg['error']?.toString().trim() ?? '';
          lastStatusToast = err.isNotEmpty ? err : _chrome?.toastLiveRequired;
          notifyListeners();
        case 'invite_sent':
          final id = msg['invite_id']?.toString() ?? '';
          final to = msg['to_username']?.toString();
          if (id.isNotEmpty) {
            final isNew = outgoingInviteId != id;
            if (isNew) unawaited(InviteAlert.playSent());
            outgoingInviteId = id;
            outgoingToUsername = to;
            outgoingDismissed = false;
            lastStatusToast = _chrome?.toastInviteSent;
            notifyListeners();
          }
        case 'match_found':
          final gid = msg['game_id']?.toString();
          if (gid != null && gid.isNotEmpty) {
            unawaited(GameNotify.play('match_found'));
            matchedP1 = msg['player1_id']?.toString();
            matchedP2 = msg['player2_id']?.toString();
            outgoingInviteId = null;
            outgoingToUsername = null;
            outgoingDismissed = false;
            notifyListeners();
            Future<void>.delayed(const Duration(milliseconds: 900), () {
              _openMatchCallback?.call(gid);
            });
          }
        case 'queue_joined':
        case 'queue_left':
        case 'queue_updated':
          final size = msg['size'];
          if (size is num) {
            queueSize = size.toInt();
            notifyListeners();
          }
        case 'avatar_updated':
          final uid = msg['user_id']?.toString().trim() ?? '';
          final thumb = msg['avatar_thumb_url']?.toString();
          final full = msg['avatar_full_url']?.toString();
          if (uid.isNotEmpty) {
            _patchPlayerCache(uid, thumb, full);
          }
          QueryCache.invalidatePrefix('session:leaderboard');
          QueryCache.invalidatePrefix('session:me');
          QueryCache.invalidatePrefix('live:matchmaking');
          if (uid.isNotEmpty) {
            lastAvatarUserId = uid;
            lastAvatarThumbUrl = thumb;
            lastAvatarFullUrl = full;
            avatarEventSeq++;
            onAvatarUpdated?.call(uid, thumb, full);
            notifyListeners();
          }
        case 'dm_message':
          notifyIncomingChatMessage(myUserId: _myUserId, payload: msg);
          QueryCache.invalidatePrefix('session:dms');
          final dmThread = (msg['thread_id']?.toString() ?? '').trim();
          if (dmThread.isNotEmpty) DmThreadLive.notify(dmThread);
        case 'dm_reaction':
        case 'dm_read':
          QueryCache.invalidatePrefix('session:dms');
          final liveThread = (msg['thread_id']?.toString() ?? '').trim();
          if (liveThread.isNotEmpty) DmThreadLive.notify(liveThread);
        case 'dm_request':
        case 'dm_request_updated':
          QueryCache.invalidatePrefix('session:dms');
        default:
          break;
      }
    } catch (_) {}
  }

  void Function(String gameId)? _openMatchCallback;

  void setOpenMatchHandler(void Function(String gameId)? handler) {
    _openMatchCallback = handler;
  }

  void _patchPlayerCache(String userId, String? thumb, String? full) {
    final nextThumb = thumb?.trim();
    final nextFull = full?.trim();
    final clear = (nextThumb == null || nextThumb.isEmpty) &&
        (nextFull == null || nextFull.isEmpty);
    PublicPlayerCard patchCard(PublicPlayerCard p) {
      return p.copyWith(
        clearAvatar: clear,
        avatarThumbUrl: clear
            ? null
            : (nextThumb != null && nextThumb.isNotEmpty
                ? nextThumb
                : nextFull),
        avatarFullUrl: clear
            ? null
            : (nextFull != null && nextFull.isNotEmpty ? nextFull : null),
      );
    }

    // Patch every cached player detail: root card + nested friends_preview.
    for (final key in QueryCache.keysWithPrefix('session:player:')) {
      final cached = QueryCache.read<PlayerDetailResponse>(
        key,
        maxAge: QueryCache.sessionTtl,
        allowStale: true,
      );
      if (cached == null) continue;
      var changed = false;
      PublicPlayerCard? player = cached.player;
      if (player != null && player.id == userId) {
        player = patchCard(player);
        changed = true;
      }
      final friends = cached.friendsPreview.map((f) {
        if (f.id != userId) return f;
        changed = true;
        return patchCard(f);
      }).toList();
      if (!changed) continue;
      QueryCache.write(
        key,
        PlayerDetailResponse(
          player: player,
          matches: cached.matches,
          placements: cached.placements,
          regionalRank: cached.regionalRank,
          regionLabel: cached.regionLabel,
          friendsCount: cached.friendsCount,
          friendsPreview: friends,
        ),
      );
    }
  }

  bool send(Map<String, dynamic> payload) {
    final ws = _ws;
    if (ws == null) return false;
    try {
      ws.sink.add(jsonEncode(payload));
      return true;
    } catch (_) {
      return false;
    }
  }

  void noteOutgoing({required String id, String? toUsername}) {
    if (id.isEmpty) return;
    final isNew = outgoingInviteId != id;
    if (isNew) unawaited(InviteAlert.playSent());
    outgoingInviteId = id;
    outgoingToUsername = toUsername;
    outgoingDismissed = false;
    lastStatusToast = _chrome?.toastInviteSent;
    _startOutgoingPoll(id);
    notifyListeners();
  }

  void dismissOutgoing() {
    outgoingDismissed = true;
    notifyListeners();
  }

  void clearIncoming() {
    incoming = null;
    unawaited(InviteAlert.stop());
    notifyListeners();
  }

  void acceptIncoming() {
    final id = incoming?.id;
    if (id == null || id.isEmpty || inviteActionBusy) return;
    inviteActionBusy = true;
    notifyListeners();
    unawaited(InviteAlert.stop());
    // Keep incoming until invite_accepted / error ack.
    if (!send({'type': 'invite_accept', 'invite_id': id})) {
      inviteActionBusy = false;
      lastStatusToast = _chrome?.toastLiveRequired;
      notifyListeners();
    }
  }

  void declineIncoming() {
    final id = incoming?.id;
    if (id == null || id.isEmpty || inviteActionBusy) return;
    inviteActionBusy = true;
    notifyListeners();
    unawaited(InviteAlert.playResolvedChime());
    // Keep incoming until invite_declined / error ack.
    if (!send({'type': 'invite_decline', 'invite_id': id})) {
      inviteActionBusy = false;
      lastStatusToast = _chrome?.toastLiveRequired;
      notifyListeners();
    }
  }

  void cancelOutgoing() {
    final id = outgoingInviteId;
    if (id == null || id.isEmpty || inviteActionBusy) return;
    inviteActionBusy = true;
    notifyListeners();
    // Keep outgoing until invite_cancelled / error ack.
    if (!send({'type': 'invite_cancel', 'invite_id': id})) {
      inviteActionBusy = false;
      lastStatusToast = _chrome?.toastLiveRequired;
      notifyListeners();
    }
  }

  Future<void> disposeSocket() async {
    _stopOutgoingPoll();
    await _wsSub?.cancel();
    _wsSub = null;
    await _ws?.sink.close();
    _ws = null;
    await InviteAlert.stop();
  }

  @override
  void dispose() {
    unawaited(disposeSocket());
    super.dispose();
  }
}

class MatchmakingRealtimeScope
    extends InheritedNotifier<MatchmakingRealtimeController> {
  const MatchmakingRealtimeScope({
    super.key,
    required MatchmakingRealtimeController controller,
    required super.child,
  }) : super(notifier: controller);

  static MatchmakingRealtimeController? maybeOf(BuildContext context) {
    return context
        .dependOnInheritedWidgetOfExactType<MatchmakingRealtimeScope>()
        ?.notifier;
  }

  static MatchmakingRealtimeController of(BuildContext context) {
    final c = maybeOf(context);
    assert(c != null, 'MatchmakingRealtimeScope not found');
    return c!;
  }
}

/// Hosts shell-wide matchmaking WS + incoming invite dialog.
class MatchmakingRealtimeHost extends StatefulWidget {
  const MatchmakingRealtimeHost({super.key, required this.child});

  final Widget child;

  @override
  State<MatchmakingRealtimeHost> createState() =>
      _MatchmakingRealtimeHostState();
}

class _MatchmakingRealtimeHostState extends State<MatchmakingRealtimeHost> {
  late final MatchmakingRealtimeController _controller =
      MatchmakingRealtimeController();
  bool _incomingDialogOpen = false;
  bool _outgoingDialogOpen = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onCtrl);
    _controller.setOpenMatchHandler(_openMatch);
    _controller.onAvatarUpdated = (userId, thumb, full) {
      if (!mounted) return;
      final auth = context.read<AuthCubit>();
      if (auth.state.userId == userId) {
        auth.applyGameAvatar(thumb ?? '', fullUrl: full ?? '');
      }
    };
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthCubit>().state;
      unawaited(_controller.bindToken(
        auth.isAuthenticated ? auth.token : null,
        userId: auth.userId,
      ));
    });
  }

  void _openMatch(String gameId) {
    if (!mounted) return;
    final token = context.read<AuthCubit>().state.token;
    if (token == null || token.isEmpty) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => MatchBoardPage(
          accessToken: token,
          gameId: gameId,
          mode: 'pvp',
        ),
      ),
    );
  }

  void _onCtrl() {
    if (!mounted) return;
    // Fail-closed: never open invite dialogs with empty invent chrome (web chrome-gate parity).
    final chrome = _controller.chrome;
    if (chrome == null || !chrome.isReady) return;
    final invite = _controller.incoming;
    if (invite != null && !_incomingDialogOpen) {
      _showIncomingDialog(invite, chrome);
    }
    final outId = _controller.outgoingInviteId;
    if (outId != null &&
        outId.isNotEmpty &&
        !_controller.outgoingDismissed &&
        _controller.incoming == null &&
        !_outgoingDialogOpen &&
        !_incomingDialogOpen) {
      _showOutgoingDialog(chrome);
    }
  }

  void _showIncomingDialog(MatchInvite invite, MatchmakingChrome chrome) {
    _incomingDialogOpen = true;
    final title = chrome.directInviteTitle.isNotEmpty
        ? chrome.directInviteTitle
        : chrome.toastInviteReceived;
    final body = _controller.formatIncomingInviteBody(invite);
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        final c = MatchmakingRealtimeScope.maybeOf(ctx) ?? _controller;
        return ListenableBuilder(
          listenable: c,
          builder: (ctx, _) {
            final ch = c.chrome;
            final inv = c.incoming;
            // Close when accept/decline/cancel clears incoming (web ConfirmDialog parity).
            if (inv == null) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (ctx.mounted && Navigator.of(ctx).canPop()) {
                  Navigator.of(ctx).pop();
                }
              });
            }
            final desc = inv != null ? c.formatIncomingInviteBody(inv) : body;
            final labels = ch ?? chrome;
            return AlertDialog(
              title: Text(title),
              content: Text(desc.isNotEmpty ? desc : body),
              actions: [
                TextButton(
                  onPressed: c.inviteActionBusy || inv == null
                      ? null
                      : () => c.declineIncoming(),
                  child: Text(
                    c.inviteActionBusy
                        ? labels.declinePending
                        : labels.declineAction,
                  ),
                ),
                FilledButton(
                  onPressed: c.inviteActionBusy || inv == null
                      ? null
                      : () => c.acceptIncoming(),
                  child: Text(
                    c.inviteActionBusy
                        ? labels.acceptPending
                        : labels.acceptAction,
                  ),
                ),
              ],
            );
          },
        );
      },
    ).whenComplete(() {
      _incomingDialogOpen = false;
    });
  }

  void _showOutgoingDialog(MatchmakingChrome chrome) {
    _outgoingDialogOpen = true;
    final title = chrome.outgoingInviteTitle;
    showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        final c = MatchmakingRealtimeScope.maybeOf(ctx) ?? _controller;
        return ListenableBuilder(
          listenable: c,
          builder: (ctx, _) {
            final ch = c.chrome ?? chrome;
            final id = c.outgoingInviteId;
            final dismissed = c.outgoingDismissed;
            final hasIncoming = c.incoming != null;
            if (id == null || id.isEmpty || dismissed || hasIncoming) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (ctx.mounted && Navigator.of(ctx).canPop()) {
                  Navigator.of(ctx).pop();
                }
              });
            }
            final to = (c.outgoingToUsername ?? '').trim();
            final blurb = to.isNotEmpty
                ? '${ch.outgoingInviteBlurb}${ch.metaSeparator}$to'
                : ch.outgoingInviteBlurb;
            return AlertDialog(
              title: Text(title),
              content: Text(blurb),
              actions: [
                TextButton(
                  onPressed: () {
                    c.dismissOutgoing();
                    if (Navigator.of(ctx).canPop()) Navigator.of(ctx).pop();
                  },
                  child: Text(ch.outgoingKeepWaitingAction),
                ),
                FilledButton(
                  onPressed:
                      c.inviteActionBusy ? null : () => c.cancelOutgoing(),
                  child: Text(
                    c.inviteActionBusy
                        ? ch.outgoingCancelPending
                        : ch.outgoingCancelAction,
                  ),
                ),
              ],
            );
          },
        );
      },
    ).whenComplete(() {
      _outgoingDialogOpen = false;
    });
  }

  @override
  void dispose() {
    _controller.removeListener(_onCtrl);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthCubit, AuthState>(
      listenWhen: (a, b) =>
          a.token != b.token ||
          a.isAuthenticated != b.isAuthenticated ||
          a.userId != b.userId,
      listener: (context, state) {
        unawaited(_controller.bindToken(
          state.isAuthenticated ? state.token : null,
          userId: state.userId,
        ));
      },
      child: MatchmakingRealtimeScope(
        controller: _controller,
        child: widget.child,
      ),
    );
  }
}
