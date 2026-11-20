import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/audio/game_notify.dart';
import 'package:dama_mobile/core/audio/invite_alert.dart';
import 'package:dama_mobile/core/cache/query_cache.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/chrome_select_sheet.dart';
import 'package:dama_mobile/core/ui/country_flag.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/game/match_board_page.dart';
import 'package:dama_mobile/features/game/matchmaking_realtime.dart';
import 'package:dama_mobile/features/home/play_rail_panel.dart' show RailPlayer;
import 'package:dama_mobile/features/notifications/notification_app_bar_actions.dart';
import 'package:dama_mobile/features/player/match_seat_avatars.dart';
import 'package:dama_mobile/features/player/open_create_game_challenge.dart';
import 'package:dama_mobile/widgets/dama_user_avatar.dart';
import 'package:dama_mobile/widgets/host_trust_badge.dart';
import 'package:dama_mobile/widgets/player_rail_menu_leading.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;
import 'package:web_socket_channel/web_socket_channel.dart';

class MatchmakingPage extends StatefulWidget {
  MatchmakingPage({
    super.key,
    required this.token,
    String? restBaseUrl,
  }) : restBaseUrl = restBaseUrl ?? ApiConfig.defaults.restUrl;

  final String token;
  final String restBaseUrl;

  @override
  State<MatchmakingPage> createState() => _MatchmakingPageState();
}

class _MatchmakingPageState extends State<MatchmakingPage> {
  int queueSize = 0;
  bool queued = false;
  bool busy = false;

  /// join | leave | invite | accept | decline
  String? _busyKind;
  bool _statusLoading = true;
  bool _statusReady = false;
  String? error;
  WebSocketChannel? _ws;
  StreamSubscription? _wsSub;
  MatchmakingSelfCard? _self;
  String? _matchedP1;
  String? _matchedP2;
  final _inviteToCtrl = TextEditingController();
  Timer? _inviteSearchDebounce;
  String _inviteSearchQ = '';
  List<RailPlayer> _inviteSuggestions = const [];
  bool _inviteSearchLoading = false;
  int _inviteSearchGen = 0;
  MatchInvite? _incomingInvite;
  String? _outgoingInviteId;
  String? _outgoingToUsername;
  bool _outgoingDismissed = false;
  bool _inviteCancelBusy = false;
  bool _inviteAttempted = false;
  String? _inviteStatus;
  MatchmakingChrome? _chrome;
  bool _chromeLoading = true;
  String? _chromeError;
  PlayRailChrome? _railChrome;
  List<MatchClockPreset> _tcPresets = const [];
  bool _tcLoading = true;
  int? _selectedTcSeconds;
  bool _rated = true;
  String _preferredColor = 'random';
  MatchmakingRealtimeController? _rt;
  VoidCallback? _rtListener;

  Map<String, String> get _auth => {'Authorization': 'Bearer ${widget.token}'};

  int _seenAvatarSeq = 0;

  void _syncFromRealtime() {
    final rt = _rt;
    if (rt == null || !mounted) return;
    setState(() {
      if (rt.queueSize != null) queueSize = rt.queueSize!;
      _incomingInvite = rt.incoming;
      _outgoingInviteId = rt.outgoingInviteId;
      _outgoingToUsername = rt.outgoingToUsername;
      _outgoingDismissed = rt.outgoingDismissed;
      if (rt.matchedP1 != null) _matchedP1 = rt.matchedP1;
      if (rt.matchedP2 != null) _matchedP2 = rt.matchedP2;
      if (rt.lastStatusToast != null) _inviteStatus = rt.lastStatusToast;
      if (rt.chrome != null) _chrome = rt.chrome;
      // Release local pending flags when shell controller finishes accept/decline/cancel.
      if (!rt.inviteActionBusy) {
        if (_busyKind == 'accept' || _busyKind == 'decline') {
          busy = false;
          _busyKind = null;
        }
        _inviteCancelBusy = false;
      }
      if (rt.avatarEventSeq != _seenAvatarSeq) {
        _seenAvatarSeq = rt.avatarEventSeq;
        final uid = (rt.lastAvatarUserId ?? '').trim();
        if (uid.isNotEmpty) {
          final thumb = (rt.lastAvatarThumbUrl ?? '').trim();
          final full = (rt.lastAvatarFullUrl ?? '').trim();
          final clear = thumb.isEmpty && full.isEmpty;
          final next = clear ? null : (thumb.isNotEmpty ? thumb : full);
          final self = _self;
          if (self != null && self.id == uid) {
            _self = self.copyWith(avatarThumbUrl: next, clearAvatar: clear);
            _persistStatus();
          }
          var sugTouched = false;
          final nextSug = _inviteSuggestions.map((p) {
            if (p.id != uid) return p;
            sugTouched = true;
            return p.copyWith(
              avatarThumbUrl: clear ? null : next,
              clearAvatar: clear,
            );
          }).toList();
          if (sugTouched) _inviteSuggestions = nextSug;
        }
      }
    });
  }

  void _persistStatus() {
    QueryCache.write(
      CacheKeys.matchmaking(widget.token),
      MatchmakingCacheSnapshot(
        queueSize: queueSize,
        queued: queued,
        self: _self,
      ),
    );
  }

  Future<void> refresh({bool showSkeleton = false}) async {
    if (showSkeleton && mounted) {
      setState(() => _statusLoading = true);
    }
    try {
      final res = await http.get(
        Uri.parse('${widget.restBaseUrl}/matchmaking/status'),
        headers: _auth,
      );
      if (res.statusCode == 200) {
        final json = jsonDecode(res.body) as Map<String, dynamic>;
        final selfRaw = json['self'];
        if (selfRaw is Map<String, dynamic>) {
          _self = MatchmakingSelfCard.fromJson(selfRaw);
        }
        if (!mounted) return;
        setState(() {
          final sizeRaw = json['size'];
          if (sizeRaw is num) {
            queueSize = sizeRaw.toInt();
          }
          queued = json['queued'] == true;
          _statusReady = true;
          _statusLoading = false;
        });
        _persistStatus();
        return;
      }
    } finally {
      if (mounted) {
        setState(() {
          _statusLoading = false;
          _statusReady = true;
        });
      }
    }
  }

  void _openMatch(String gameId) {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => MatchBoardPage(
          accessToken: widget.token,
          gameId: gameId,
          mode: 'pvp',
        ),
      ),
    );
  }

  Future<void> _connectQueueWs() async {
    // Prefer shell-wide realtime host (ringtone on every tab).
    final shared = MatchmakingRealtimeScope.maybeOf(context);
    if (shared != null) {
      _rt = shared;
      _rtListener = _syncFromRealtime;
      shared.addListener(_rtListener!);
      _syncFromRealtime();
      return;
    }
    await _wsSub?.cancel();
    await _ws?.sink.close();
    final origin = ApiConfig.baseUrl.replaceFirst(RegExp(r'^http'), 'ws');
    final uri = Uri.parse(
      '$origin/ws/matchmaking?token=${Uri.encodeComponent(widget.token)}',
    );
    _ws = WebSocketChannel.connect(uri);
    _wsSub = _ws!.stream.listen((event) {
      if (event is! String) return;
      try {
        final msg = jsonDecode(event) as Map<String, dynamic>;
        if (msg['type'] == 'match_found' && msg['game_id'] is String) {
          unawaited(GameNotify.play('match_found'));
          setState(() {
            queued = false;
            _matchedP1 = msg['player1_id']?.toString();
            _matchedP2 = msg['player2_id']?.toString();
            _outgoingInviteId = null;
            _outgoingToUsername = null;
            _outgoingDismissed = false;
          });
          Future<void>.delayed(const Duration(milliseconds: 900), () {
            _openMatch(msg['game_id'] as String);
          });
        }
        if (msg['type'] == 'invite_received') {
          final inv = msg['invite'];
          if (inv is Map<String, dynamic> && inv['id'] != null) {
            final invite = MatchInvite.fromJson(inv);
            if (invite.id.isNotEmpty) {
              final chrome = _chrome;
              unawaited(InviteAlert.start());
              setState(() {
                _incomingInvite = invite;
                _inviteStatus = invite.fromUsername != null &&
                        invite.fromUsername!.isNotEmpty &&
                        chrome != null
                    ? '${chrome.inviteFromPrefix} ${invite.fromUsername}'
                    : (chrome?.toastInviteReceived ?? '');
              });
            }
          }
        }
        if (msg['type'] == 'invite_accepted' && msg['game_id'] is String) {
          unawaited(InviteAlert.playResolvedChime());
          unawaited(GameNotify.play('match_found'));
          setState(() {
            _incomingInvite = null;
            _outgoingInviteId = null;
            _outgoingToUsername = null;
            _outgoingDismissed = false;
            busy = false;
            _busyKind = null;
            _inviteCancelBusy = false;
            _inviteStatus = _chrome?.toastInviteAccepted;
          });
          _openMatch(msg['game_id'] as String);
        }
        if (msg['type'] == 'error') {
          final err = msg['error']?.toString().trim() ?? '';
          setState(() {
            busy = false;
            _busyKind = null;
            _inviteCancelBusy = false;
            if (err.isNotEmpty) {
              _inviteStatus = err;
              error = err;
            }
          });
        }
        if (msg['type'] == 'invite_declined') {
          unawaited(InviteAlert.playResolvedChime());
          setState(() {
            _incomingInvite = null;
            _outgoingInviteId = null;
            _outgoingToUsername = null;
            _outgoingDismissed = false;
            busy = false;
            _busyKind = null;
            _inviteStatus = _chrome?.toastInviteDeclined;
          });
        }
        if (msg['type'] == 'invite_cancelled') {
          unawaited(InviteAlert.stop());
          setState(() {
            _incomingInvite = null;
            _outgoingInviteId = null;
            _outgoingToUsername = null;
            _outgoingDismissed = false;
            _inviteCancelBusy = false;
            _inviteStatus = _chrome?.toastInviteCancelled;
          });
        }
        if (msg['type'] == 'invite_sent') {
          final id = msg['invite_id']?.toString() ?? '';
          final to = msg['to_username']?.toString();
          if (id.isNotEmpty) {
            final isNew = _outgoingInviteId != id;
            if (isNew) unawaited(InviteAlert.playSent());
            setState(() {
              _outgoingInviteId = id;
              _outgoingToUsername = to;
              _outgoingDismissed = false;
              _inviteStatus = _chrome?.toastInviteSent;
            });
          } else {
            setState(() => _inviteStatus = _chrome?.toastInviteSent);
          }
        }
        if (msg['type'] == 'queue_joined' ||
            msg['type'] == 'queue_left' ||
            msg['type'] == 'queue_updated') {
          final size = msg['size'];
          if (size is num) {
            setState(() => queueSize = size.toInt());
          } else {
            refresh();
          }
        }
      } catch (_) {}
    });
  }

  int? get _effectiveTcSeconds {
    if (_tcPresets.isEmpty) return null;
    final selected = _selectedTcSeconds;
    if (selected != null && _tcPresets.any((p) => p.seconds == selected)) {
      return selected;
    }
    return _tcPresets.first.seconds;
  }

  Future<void> _loadProgressionAndRail() async {
    final cached = QueryCache.read<ProgressionConfig>(
      CacheKeys.progression,
      maxAge: QueryCache.sessionTtl,
      allowStale: true,
    );
    if (cached?.matchClock?.presets != null &&
        cached!.matchClock!.presets.isNotEmpty &&
        mounted) {
      setState(() {
        _tcPresets = cached.matchClock!.presets;
        _selectedTcSeconds ??= _tcPresets.first.seconds;
        _tcLoading = false;
      });
    }
    try {
      final results = await Future.wait([
        http.get(Uri.parse('${ApiConfig.baseUrl}/api/v1/progression')),
        http.get(
            Uri.parse('${ApiConfig.baseUrl}/api/v1/public/play-rail-chrome')),
      ]);
      if (!mounted) return;
      final progRes = results[0];
      final railRes = results[1];
      if (progRes.statusCode < 300) {
        final progression = ProgressionConfig.fromJson(
          jsonDecode(progRes.body) as Map<String, dynamic>,
        );
        QueryCache.write(CacheKeys.progression, progression);
        final presets =
            progression.matchClock?.presets ?? const <MatchClockPreset>[];
        setState(() {
          _tcPresets = presets;
          _tcLoading = false;
          if (presets.isNotEmpty) {
            final cur = _selectedTcSeconds;
            if (cur == null || !presets.any((p) => p.seconds == cur)) {
              final def = progression.matchClock?.initialSeconds ?? 0;
              _selectedTcSeconds = presets.any((p) => p.seconds == def)
                  ? def
                  : presets.first.seconds;
            }
          } else {
            _selectedTcSeconds = null;
          }
        });
      } else if (mounted) {
        setState(() => _tcLoading = false);
      }
      if (railRes.statusCode == 200) {
        Map<String, dynamic>? map;
        try {
          final decoded = jsonDecode(railRes.body);
          if (decoded is Map<String, dynamic>) map = decoded;
        } catch (_) {}
        final rail = PlayRailChrome.fromJson(map);
        if (rail != null && mounted) {
          setState(() => _railChrome = rail);
        }
      }
    } catch (_) {
      if (mounted) setState(() => _tcLoading = false);
    }
  }

  Future<void> _sendInvite() async {
    final to = _inviteToCtrl.text.trim();
    if (to.isEmpty) {
      setState(() => _inviteAttempted = true);
      return;
    }
    final rtScope = _rt ?? MatchmakingRealtimeScope.maybeOf(context);
    final tc = _effectiveTcSeconds;
    if (_railChrome == null || tc == null || tc <= 0 || _tcPresets.isEmpty) {
      setState(() {
        error = _railChrome?.toastTimeControlUnavailable ??
            _chrome?.toastInviteFailed ??
            '';
        busy = false;
        _busyKind = null;
      });
      return;
    }
    final auth = context.read<AuthCubit>().state;
    final myName = (auth.username ?? '').trim().toLowerCase();
    final myId = (auth.userId ?? '').trim().toLowerCase();
    final toNorm = to.toLowerCase();
    if ((myName.isNotEmpty && toNorm == myName) ||
        (myId.isNotEmpty && toNorm == myId)) {
      setState(() {
        error = _chrome?.toastInviteYourself ??
            _railChrome?.toastInviteYourself ??
            '';
        busy = false;
        _busyKind = null;
      });
      return;
    }
    setState(() {
      busy = true;
      _busyKind = 'invite';
      error = null;
      _inviteStatus = null;
    });
    try {
      final res = await http.post(
        Uri.parse('${widget.restBaseUrl}/invites/'),
        headers: {
          ..._auth,
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'to_user': to,
          'rated': _rated,
          'preferred_color': _preferredColor,
          'time_control_seconds': tc,
        }),
      );
      if (res.statusCode >= 300) {
        setState(() => error = _chrome?.toastInviteFailed ?? '');
        return;
      }
      String? inviteId;
      try {
        final json = jsonDecode(res.body) as Map<String, dynamic>;
        final inv = json['invite'];
        if (inv is Map<String, dynamic>) {
          inviteId = inv['id']?.toString();
        }
      } catch (_) {}
      if (inviteId != null && inviteId.isNotEmpty) {
        if (rtScope != null) {
          rtScope.noteOutgoing(id: inviteId, toUsername: to);
        } else {
          unawaited(InviteAlert.playSent());
        }
        setState(() {
          _outgoingInviteId = inviteId;
          _outgoingToUsername = to;
          _outgoingDismissed = false;
          _inviteStatus = _chrome?.toastInviteSent;
          _inviteToCtrl.clear();
        });
      } else {
        setState(() {
          _inviteStatus = _chrome?.toastInviteSent;
          _inviteToCtrl.clear();
        });
      }
    } catch (_) {
      setState(() => error = _chrome?.toastInviteFailed);
    } finally {
      setState(() {
        busy = false;
        _busyKind = null;
      });
    }
  }

  void _cancelOutgoing() {
    final id = _outgoingInviteId;
    if (id == null || id.isEmpty || _inviteCancelBusy) return;
    final rt = _rt ?? MatchmakingRealtimeScope.maybeOf(context);
    if (rt != null) {
      if (rt.inviteActionBusy) return;
      setState(() => _inviteCancelBusy = true);
      rt.cancelOutgoing();
      // Clear on invite_cancelled / error via rt listener - do not clear on send.
      return;
    }
    final ws = _ws;
    if (ws == null) {
      setState(() => error = _chrome?.toastLiveRequired);
      return;
    }
    setState(() => _inviteCancelBusy = true);
    ws.sink.add(jsonEncode({'type': 'invite_cancel', 'invite_id': id}));
    // Clear on invite_cancelled / error WS ack - do not clear on send.
  }

  String _formatIncomingInviteLocal(
      MatchmakingChrome chrome, MatchInvite invite) {
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

  void _respondInvite(String action) {
    final id = _incomingInvite?.id;
    if (id == null || id.isEmpty) return;
    if (busy && (_busyKind == 'accept' || _busyKind == 'decline')) return;
    final rt = _rt ?? MatchmakingRealtimeScope.maybeOf(context);
    if (rt != null) {
      if (rt.inviteActionBusy) return;
      setState(() {
        busy = true;
        _busyKind = action == 'invite_accept' ? 'accept' : 'decline';
      });
      if (action == 'invite_accept') {
        rt.acceptIncoming();
      } else {
        rt.declineIncoming();
      }
      // Clear on invite_accepted / invite_declined / error via rt listener.
      return;
    }
    final ws = _ws;
    if (ws == null) {
      setState(() => error = _chrome?.toastLiveRequired);
      return;
    }
    setState(() {
      busy = true;
      _busyKind = action == 'invite_accept' ? 'accept' : 'decline';
    });
    if (action == 'invite_accept') {
      unawaited(InviteAlert.stop());
    } else if (action == 'invite_decline') {
      unawaited(InviteAlert.playResolvedChime());
    }
    ws.sink.add(jsonEncode({'type': action, 'invite_id': id}));
    // Clear on invite_accepted / invite_declined / error WS ack - do not clear on send.
  }

  Future<void> join() async {
    setState(() {
      busy = true;
      _busyKind = 'join';
      error = null;
    });
    try {
      final res = await http.post(
        Uri.parse('${widget.restBaseUrl}/matchmaking/join'),
        headers: {
          ..._auth,
          'Content-Type': 'application/json',
        },
        body: '{}',
      );
      if (res.statusCode >= 300) {
        throw Exception(_chrome?.toastJoinFailed ?? '');
      }
      final json = jsonDecode(res.body) as Map<String, dynamic>;
      final self = json['self'];
      if (self is Map<String, dynamic>) {
        _self = MatchmakingSelfCard.fromJson(self);
      }
      final match = json['match'];
      if (match is Map && match['game_id'] is String) {
        await GameNotify.play('match_found');
        setState(() {
          _matchedP1 = match['player1_id']?.toString();
          _matchedP2 = match['player2_id']?.toString();
        });
        await Future<void>.delayed(const Duration(milliseconds: 900));
        _openMatch(match['game_id'] as String);
        return;
      }
      setState(() {
        queued = json['queued'] == true;
        queueSize = (json['queue_size'] as num?)?.toInt() ?? queueSize;
      });
      _persistStatus();
    } catch (e) {
      setState(() => error = _chrome?.toastJoinFailed);
    } finally {
      setState(() {
        busy = false;
        _busyKind = null;
      });
    }
  }

  Future<void> leave() async {
    setState(() {
      busy = true;
      _busyKind = 'leave';
    });
    try {
      final res = await http.post(
        Uri.parse('${widget.restBaseUrl}/matchmaking/leave'),
        headers: _auth,
      );
      setState(() => queued = false);
      if (res.statusCode == 200) {
        final json = jsonDecode(res.body) as Map<String, dynamic>;
        queueSize = (json['queue_size'] as num?)?.toInt() ?? queueSize;
      } else {
        await refresh();
      }
      _persistStatus();
    } finally {
      setState(() {
        busy = false;
        _busyKind = null;
      });
    }
  }

  Future<void> _loadChrome() async {
    try {
      final res = await http.get(
        Uri.parse('${widget.restBaseUrl}/public/matchmaking-chrome'),
      );
      Map<String, dynamic>? map;
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) map = decoded;
      } catch (_) {}
      final fromBody =
          (map?['matchmaking_chrome_unavailable'] as String?)?.trim() ?? '';
      if (res.statusCode != 200) {
        if (!mounted) return;
        setState(() {
          _chromeLoading = false;
          _chromeError = fromBody.isNotEmpty
              ? fromBody
              : ((map?['error'] as String?)?.trim() ?? '');
        });
        return;
      }
      final chrome = MatchmakingChrome.fromJson(map);
      if (!mounted) return;
      setState(() {
        _chrome = chrome;
        _chromeLoading = false;
        _chromeError = chrome == null ? fromBody : null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _chromeLoading = false;
        _chromeError = '';
      });
    }
  }

  @override
  void initState() {
    super.initState();
    unawaited(_loadChrome());
    unawaited(_loadProgressionAndRail());
    final cached = QueryCache.read<MatchmakingCacheSnapshot>(
      CacheKeys.matchmaking(widget.token),
      maxAge: const Duration(seconds: 30),
      allowStale: true,
    );
    if (cached != null) {
      queueSize = cached.queueSize;
      queued = cached.queued;
      _self = cached.self;
      _statusLoading = false;
      _statusReady = true;
    }
    unawaited(refresh(showSkeleton: !_statusReady));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(_connectQueueWs());
    });
  }

  @override
  void dispose() {
    if (_rtListener != null) {
      _rt?.removeListener(_rtListener!);
    } else {
      // Local WS only - shell host owns ringtone lifecycle when shared.
      unawaited(InviteAlert.stop());
      _wsSub?.cancel();
      _ws?.sink.close();
    }
    _inviteSearchDebounce?.cancel();
    _inviteToCtrl.dispose();
    super.dispose();
  }

  int get _inviteDebounceMs {
    final n = int.tryParse((_railChrome?.searchDebounceMs ?? '').trim());
    if (n == null || n < 0) return -1;
    return n;
  }

  int get _invitePageSize {
    final n = int.tryParse((_railChrome?.listPageSize ?? '').trim());
    return (n != null && n > 0) ? n : 0;
  }

  void _onInviteQueryChanged(String v) {
    final ms = _inviteDebounceMs;
    if (ms < 0) return;
    _inviteSearchDebounce?.cancel();
    _inviteSearchDebounce = Timer(Duration(milliseconds: ms), () {
      if (!mounted) return;
      setState(() => _inviteSearchQ = v.trim());
      unawaited(_loadInviteSuggestions());
    });
    setState(() {});
  }

  Future<void> _loadInviteSuggestions() async {
    final q = _inviteSearchQ;
    final limit = _invitePageSize;
    if (q.isEmpty || limit <= 0) {
      if (mounted) {
        setState(() {
          _inviteSuggestions = const [];
          _inviteSearchLoading = false;
        });
      }
      return;
    }
    final gen = ++_inviteSearchGen;
    setState(() => _inviteSearchLoading = true);
    try {
      // Drain every relevance-ranked page - invite typeahead must not be first-page-only.
      final all = <RailPlayer>[];
      final seen = <String>{};
      var skip = 0;
      var hasMore = true;
      while (hasMore) {
        if (!mounted || gen != _inviteSearchGen) return;
        final uri = Uri.parse('${widget.restBaseUrl}/players').replace(
          queryParameters: {'q': q, 'skip': '$skip', 'limit': '$limit'},
        );
        final res = await http.get(uri, headers: _auth);
        if (!mounted || gen != _inviteSearchGen) return;
        if (res.statusCode >= 300) {
          setState(() {
            _inviteSuggestions = const [];
            _inviteSearchLoading = false;
          });
          return;
        }
        final map = jsonDecode(res.body) as Map<String, dynamic>;
        final list = (map['players'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(RailPlayer.fromJson)
            .whereType<RailPlayer>()
            .toList();
        for (final p in list) {
          if (seen.contains(p.id)) continue;
          seen.add(p.id);
          all.add(p);
        }
        final meta = map['meta'];
        hasMore = false;
        if (meta is Map<String, dynamic>) {
          final hm = meta['has_more'];
          if (hm is bool) hasMore = hm;
          final ns = meta['next_skip'];
          if (ns is num) {
            skip = ns.toInt();
          } else {
            skip += list.length;
          }
        } else {
          hasMore = list.length >= limit;
          skip += list.length;
        }
        if (list.isEmpty) hasMore = false;
        if (mounted && gen == _inviteSearchGen) {
          setState(() {
            _inviteSuggestions = List<RailPlayer>.from(all);
            _inviteSearchLoading = false;
          });
        }
      }
    } catch (_) {
      if (mounted && gen == _inviteSearchGen) {
        setState(() {
          _inviteSuggestions = const [];
          _inviteSearchLoading = false;
        });
      }
    }
  }

  void _pickInviteSuggestion(RailPlayer p) {
    FocusManager.instance.primaryFocus?.unfocus();
    _inviteToCtrl.text = p.username;
    _inviteToCtrl.selection =
        TextSelection.collapsed(offset: p.username.length);
    setState(() {
      _inviteSearchQ = p.username;
      _inviteSuggestions = const [];
    });
  }

  Widget _matchmakingColorBtn(String id, DamaColors tokens, String aria) {
    final selected = _preferredColor == id;
    final selectedBorder = tokens.brand;
    final Decoration decoration;
    switch (id) {
      case 'white':
        decoration = BoxDecoration(
          color: tokens.pieceLight,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: selected ? selectedBorder : tokens.borderSubtle,
            width: selected ? 2 : 1,
          ),
        );
      case 'black':
        decoration = BoxDecoration(
          color: tokens.pieceDark,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: selected ? selectedBorder : tokens.borderSubtle,
            width: selected ? 2 : 1,
          ),
        );
      default:
        decoration = BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              tokens.pieceLight,
              tokens.pieceLight,
              tokens.pieceDark,
              tokens.pieceDark
            ],
            stops: const [0, 0.5, 0.5, 1],
          ),
          border: Border.all(
            color: selected ? selectedBorder : tokens.borderSubtle,
            width: selected ? 2 : 1,
          ),
        );
    }
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Semantics(
        button: true,
        label: aria,
        selected: selected,
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          child: InkWell(
            onTap: () => setState(() => _preferredColor = id),
            borderRadius: BorderRadius.circular(8),
            child: Container(
              width: 36,
              height: 36,
              decoration: decoration,
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final chrome = _chrome;
    if (_chromeLoading || chrome == null) {
      return Scaffold(
        appBar: AppBar(
          leading: PlayerRailMenuLeading.maybe(context),
          actions: const [NotificationAppBarActions()],
        ),
        body: _chromeError != null
            ? Center(child: Text(_chromeError!))
            : const MatchmakingSkeleton(),
      );
    }

    return Scaffold(
      appBar: AppBar(
        leading: PlayerRailMenuLeading.maybe(context),
        title: Text(chrome.title),
        actions: const [NotificationAppBarActions()],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: _statusLoading && !_statusReady
            ? const MatchmakingSkeleton()
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(chrome.blurb),
                  if (_self != null) ...[
                    const SizedBox(height: 16),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: DamaUserAvatar(
                        imageUrl: _self!.avatarThumbUrl,
                        radius: 20,
                      ),
                      title: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  _self!.username,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              Text(
                                ' (${_self!.rating})',
                                style: TextStyle(color: tokens.onSurfaceMuted),
                              ),
                              const SizedBox(width: 4),
                              CountryFlag(code: _self!.countryCode),
                            ],
                          ),
                          HostTrustBadge(
                            label: _self!.hostTrustBadge,
                            tier: _self!.hostTrustTier,
                            fontSize: 10,
                            dense: true,
                          ),
                        ],
                      ),
                      subtitle: queued ? Text(chrome.searchingSuffix) : null,
                    ),
                  ],
                  if (_matchedP1 != null || _matchedP2 != null) ...[
                    const SizedBox(height: 8),
                    Text(chrome.matchedOpening),
                    MatchSeatAvatars(
                      player1Id: _matchedP1,
                      player2Id: _matchedP2,
                      onChallenge: (req) =>
                          openCreateGameChallenge(context, req),
                    ),
                  ],
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed:
                        busy || queued || _matchedP1 != null ? null : join,
                    child: Text(
                      _busyKind == 'join'
                          ? chrome.joinPending
                          : chrome.findMatchAction,
                    ),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: busy || !queued ? null : leave,
                    child: Text(
                      _busyKind == 'leave'
                          ? chrome.leavePending
                          : chrome.leaveQueueAction,
                    ),
                  ),
                  if (error != null) ...[
                    const SizedBox(height: 12),
                    Text(error!,
                        style: TextStyle(color: damaColorsOf(context).danger)),
                  ],
                  const SizedBox(height: 24),
                  Text(chrome.playersWaitingTitle,
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Text(
                    '$queueSize',
                    style: Theme.of(context).textTheme.displaySmall?.copyWith(
                          color: tokens.gold,
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    queued ? chrome.queuedYes : chrome.queuedNo,
                    style: TextStyle(color: tokens.onSurfaceMuted),
                  ),
                  const SizedBox(height: 24),
                  Text(chrome.directInviteTitle,
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Text(
                    chrome.directInviteBlurb,
                    style: TextStyle(color: tokens.onSurfaceMuted),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _inviteToCtrl,
                    decoration: InputDecoration(
                      labelText: chrome.invitePlaceholder,
                      border: const OutlineInputBorder(),
                      prefixIcon: const Icon(Icons.search, size: 20),
                      errorText:
                          _inviteAttempted && _inviteToCtrl.text.trim().isEmpty
                              ? (_railChrome?.toastEnterUsername ?? '')
                                      .trim()
                                      .isNotEmpty
                                  ? _railChrome!.toastEnterUsername
                                  : null
                              : null,
                    ),
                    onTapOutside: (_) {},
                    onChanged: (v) {
                      _onInviteQueryChanged(v);
                      if (_inviteAttempted && v.trim().isNotEmpty) {
                        setState(() => _inviteAttempted = false);
                      }
                    },
                  ),
                  if (_railChrome != null &&
                      _inviteDebounceMs >= 0 &&
                      _invitePageSize > 0) ...[
                    if (_inviteSearchLoading &&
                        _inviteSearchQ.isNotEmpty &&
                        _inviteSuggestions.isEmpty) ...[
                      const SizedBox(height: 6),
                      const SizedBox(
                        height: 120,
                        child: PlayRailListSkeleton(
                          rows: 3,
                          variant: PlayRailListVariant.player,
                        ),
                      ),
                    ] else if (_inviteSuggestions.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Material(
                        elevation: 4,
                        color: tokens.card,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                          side: BorderSide(color: tokens.borderSubtle),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxHeight: 192),
                          child: ListView.separated(
                            shrinkWrap: true,
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            itemCount: _inviteSuggestions.length,
                            separatorBuilder: (_, __) =>
                                Divider(height: 1, color: tokens.borderSubtle),
                            itemBuilder: (context, i) {
                              final rail = _railChrome!;
                              final p = _inviteSuggestions[i];
                              final statusLabel = p.playing
                                  ? rail.playingLabel
                                  : p.online
                                      ? rail.onlineLabel
                                      : rail.offlineLabel;
                              final statusColor = p.playing
                                  ? tokens.playing
                                  : p.online
                                      ? tokens.online
                                      : tokens.offline;
                              return KeyedSubtree(
                                key: ValueKey('invite-typeahead-${p.id}'),
                                child: InkWell(
                                  onTap: () => _pickInviteSuggestion(p),
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 10,
                                    ),
                                    child: Row(
                                      children: [
                                        Stack(
                                          clipBehavior: Clip.none,
                                          children: [
                                            DamaUserAvatar(
                                              imageUrl: p.avatarThumbUrl,
                                              radius: 16,
                                            ),
                                            Positioned(
                                              right: 0,
                                              bottom: 0,
                                              child: Container(
                                                width: 10,
                                                height: 10,
                                                decoration: BoxDecoration(
                                                  color: statusColor,
                                                  shape: BoxShape.circle,
                                                  border: Border.all(
                                                    color: tokens.card,
                                                    width: 2,
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Flexible(
                                                    child: Text(
                                                      p.username,
                                                      overflow:
                                                          TextOverflow.ellipsis,
                                                      style: const TextStyle(
                                                        fontWeight:
                                                            FontWeight.w600,
                                                      ),
                                                    ),
                                                  ),
                                                  Text(
                                                    '${rail.ratingParenOpen}${p.rating}${rail.ratingParenClose}',
                                                    style: TextStyle(
                                                      color:
                                                          tokens.onSurfaceMuted,
                                                      fontSize: 12,
                                                    ),
                                                  ),
                                                  const SizedBox(width: 6),
                                                  CountryFlag(
                                                    code: p.countryCode,
                                                    imageUrlTemplate: rail
                                                        .countryFlagImageUrlTemplate,
                                                  ),
                                                ],
                                              ),
                                              HostTrustBadge(
                                                label: p.hostTrustBadge,
                                                tier: p.hostTrustTier,
                                                fontSize: 10,
                                                dense: true,
                                              ),
                                              Text(
                                                statusLabel,
                                                style: TextStyle(
                                                  color: statusColor,
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.w600,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                    ],
                  ],
                  const SizedBox(height: 12),
                  if (_tcPresets.isEmpty && _tcLoading)
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        ShimmerBox(
                            height: 12,
                            width: 64,
                            borderRadius: BorderRadius.all(Radius.circular(4))),
                        SizedBox(height: 8),
                        ShimmerBox(
                            height: 48,
                            borderRadius: BorderRadius.all(Radius.circular(8))),
                      ],
                    )
                  else if (_tcPresets.isEmpty &&
                      (_railChrome?.toastTimeControlUnavailable ?? '')
                          .isNotEmpty)
                    Text(
                      _railChrome!.toastTimeControlUnavailable,
                      style:
                          TextStyle(color: tokens.onSurfaceMuted, fontSize: 13),
                    )
                  else if (_tcPresets.isEmpty)
                    const SizedBox.shrink()
                  else
                    ChromeSelectField(
                      label: _railChrome?.labelTime ?? '',
                      valueLabel: () {
                        final secs = _effectiveTcSeconds;
                        for (final p in _tcPresets) {
                          if (p.seconds == secs) return p.label;
                        }
                        return '';
                      }(),
                      enabled: _tcPresets.isNotEmpty,
                      leading: Icon(Icons.timer_outlined,
                          color: tokens.online, size: 20),
                      onTap: () async {
                        final picked = await showChromeOptionSheet<int>(
                          context: context,
                          title: _railChrome?.labelTime ?? '',
                          options: [
                            for (final p in _tcPresets)
                              ChromeSelectOption(
                                  value: p.seconds, label: p.label),
                          ],
                          selected: _effectiveTcSeconds,
                        );
                        if (picked != null)
                          setState(() => _selectedTcSeconds = picked);
                      },
                    ),
                  if (_railChrome != null) ...[
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(_railChrome!.labelRated),
                      value: _rated,
                      thumbColor: WidgetStateProperty.resolveWith((states) {
                        if (states.contains(WidgetState.selected)) {
                          return tokens.onBrand;
                        }
                        return null;
                      }),
                      trackColor: WidgetStateProperty.resolveWith((states) {
                        if (states.contains(WidgetState.selected)) {
                          return tokens.brand;
                        }
                        return null;
                      }),
                      onChanged: (v) => setState(() => _rated = v),
                    ),
                    Row(
                      children: [
                        Expanded(child: Text(_railChrome!.labelIPlayAs)),
                        _matchmakingColorBtn(
                            'white', tokens, _railChrome!.ariaColorWhite),
                        _matchmakingColorBtn(
                            'random', tokens, _railChrome!.ariaColorRandom),
                        _matchmakingColorBtn(
                            'black', tokens, _railChrome!.ariaColorBlack),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _railChrome!.colorPrefNote,
                      style:
                          TextStyle(color: tokens.onSurfaceMuted, fontSize: 11),
                    ),
                  ],
                  const SizedBox(height: 8),
                  FilledButton.icon(
                    onPressed: busy ||
                            _railChrome == null ||
                            _tcPresets.isEmpty ||
                            (_effectiveTcSeconds ?? 0) <= 0
                        ? null
                        : _sendInvite,
                    icon: const Icon(Icons.sports_martial_arts_outlined,
                        size: 18),
                    label: Text(
                      _busyKind == 'invite'
                          ? chrome.sendInvitePending
                          : chrome.sendInviteAction,
                    ),
                  ),
                  if (_inviteStatus != null) ...[
                    const SizedBox(height: 8),
                    Text(_inviteStatus!, style: TextStyle(color: tokens.gold)),
                  ],
                  if (_outgoingInviteId != null &&
                      !_outgoingDismissed &&
                      _incomingInvite == null) ...[
                    const SizedBox(height: 12),
                    Text(
                      chrome.outgoingInviteTitle,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _outgoingToUsername != null &&
                              _outgoingToUsername!.isNotEmpty
                          ? '${chrome.outgoingInviteBlurb}${chrome.metaSeparator}$_outgoingToUsername'
                          : chrome.outgoingInviteBlurb,
                      style: TextStyle(color: tokens.onSurfaceMuted),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _inviteCancelBusy
                                ? null
                                : () =>
                                    setState(() => _outgoingDismissed = true),
                            child: Text(chrome.outgoingKeepWaitingAction),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: FilledButton(
                            onPressed:
                                _inviteCancelBusy ? null : _cancelOutgoing,
                            child: Text(
                              _inviteCancelBusy
                                  ? chrome.outgoingCancelPending
                                  : chrome.outgoingCancelAction,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                  // Incoming accept/decline: shell MatchmakingRealtimeHost dialog when
                  // shared realtime is active (avoid duplicate controls + ringtone).
                  if (_incomingInvite != null && _rt == null) ...[
                    const SizedBox(height: 12),
                    Text(_formatIncomingInviteLocal(chrome, _incomingInvite!)),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton(
                            onPressed: busy
                                ? null
                                : () => _respondInvite('invite_accept'),
                            child: Text(
                              _busyKind == 'accept'
                                  ? chrome.acceptPending
                                  : chrome.acceptAction,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: busy
                                ? null
                                : () => _respondInvite('invite_decline'),
                            child: Text(
                              _busyKind == 'decline'
                                  ? chrome.declinePending
                                  : chrome.declineAction,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
      ),
    );
  }
}
