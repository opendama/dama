import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/io/share_bytes.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/prefs/board_palette_prefs.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/ui/chrome_select_sheet.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/country_flag.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/auth/sign_in_dialog.dart';
import 'package:dama_mobile/features/chat/compose_message_sheet.dart';
import 'package:dama_mobile/features/chat/dm_api.dart';
import 'package:dama_mobile/features/chat/dm_thread_sheet.dart';
import 'package:dama_mobile/features/game/cubit/feature_flags_cubit.dart';
import 'package:dama_mobile/features/game/match_board_page.dart';
import 'package:dama_mobile/features/game/matchmaking_realtime.dart';
import 'package:dama_mobile/features/game/palace_piece.dart';
import 'package:dama_mobile/features/game/spectate_page.dart';
import 'package:dama_mobile/features/player/player_inspect_sheet.dart';
import 'package:dama_mobile/widgets/dama_user_avatar.dart';
import 'package:dama_mobile/widgets/host_trust_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;

/// One row in Friends / All Players lists.
class RailPlayer {
  const RailPlayer({
    required this.id,
    required this.username,
    required this.rating,
    this.wins,
    this.losses,
    this.avatarThumbUrl,
    this.online = false,
    this.playing = false,
    this.playingGameId,
    this.countryCode,
    this.hostTrustTier,
    this.hostTrustBadge,
  });

  final String id;
  final String username;
  final int rating;
  final int? wins;
  final int? losses;
  final String? avatarThumbUrl;
  final bool online;
  final bool playing;
  final String? playingGameId;
  final String? countryCode;
  final String? hostTrustTier;
  final String? hostTrustBadge;

  RailPlayer copyWith({String? avatarThumbUrl, bool clearAvatar = false}) {
    return RailPlayer(
      id: id,
      username: username,
      rating: rating,
      wins: wins,
      losses: losses,
      avatarThumbUrl:
          clearAvatar ? null : (avatarThumbUrl ?? this.avatarThumbUrl),
      online: online,
      playing: playing,
      playingGameId: playingGameId,
      countryCode: countryCode,
      hostTrustTier: hostTrustTier,
      hostTrustBadge: hostTrustBadge,
    );
  }

  static RailPlayer? fromJson(Map<String, dynamic> json) {
    final id = (json['id'] as String?)?.trim() ?? '';
    final username = (json['username'] as String?)?.trim() ?? '';
    if (id.isEmpty || username.isEmpty) return null;
    final ratingRaw = json['rating'];
    if (ratingRaw is! num) return null;
    return RailPlayer(
      id: id,
      username: username,
      rating: ratingRaw.toInt(),
      wins: (json['wins'] as num?)?.toInt(),
      losses: (json['losses'] as num?)?.toInt(),
      avatarThumbUrl: (json['avatar_thumb_url'] as String?)?.trim() ??
          (json['avatarThumbUrl'] as String?)?.trim(),
      online: json['online'] == true,
      playing: json['playing'] == true,
      playingGameId: (json['playing_game_id'] as String?)?.trim() ??
          (json['playingGameId'] as String?)?.trim(),
      countryCode: (json['country_code'] as String?)?.trim() ??
          (json['countryCode'] as String?)?.trim(),
      hostTrustTier: (json['host_trust_tier'] as String?)?.trim() ??
          (json['hostTrustTier'] as String?)?.trim(),
      hostTrustBadge: (json['host_trust_badge'] as String?)?.trim() ??
          (json['hostTrustBadge'] as String?)?.trim(),
    );
  }
}

class RailChallengeOpponent {
  const RailChallengeOpponent({
    this.id,
    required this.username,
    this.rating,
    this.countryCode,
    this.avatarThumbUrl,
    this.online = false,
    this.playing = false,
    this.hostTrustTier,
    this.hostTrustBadge,
  });

  final String? id;
  final String username;
  final int? rating;
  final String? countryCode;
  final String? avatarThumbUrl;
  final bool online;
  final bool playing;
  final String? hostTrustTier;
  final String? hostTrustBadge;
}

/// Chess.com-style dark play rail (New Game | Games | Players).
class PlayRailPanel extends StatefulWidget {
  const PlayRailPanel({
    super.key,
    required this.railChrome,
    required this.playChrome,
    required this.tab,
    required this.onTab,
    required this.aiDepth,
    required this.onDepth,
    required this.flags,
    required this.onPlayAi,
    required this.onPlayMatch,
    required this.clockLabel,
    this.clockSeconds,
    this.timeControlPresets = const [],
    this.timeControlsLoading = false,
    required this.boardPaletteId,
    required this.onBoardPalette,
    required this.piecePaletteId,
    required this.onPiecePalette,
    this.initialPlayersSub = 2,
    this.initialDmRequestId,
    this.initialDmThreadId,
    this.initialChallengeOpponent,
    this.onChallengeOpponentConsumed,
  });

  final PlayRailChrome railChrome;
  final PlayChrome playChrome;
  final int tab;

  /// 0 friends, 1 requests, 2 all, 3 dms (notification deep-link).
  final int initialPlayersSub;

  /// Notification deep-link `?dm=` / `?thread=`.
  final String? initialDmRequestId;
  final String? initialDmThreadId;
  final ValueChanged<int> onTab;
  final int? aiDepth;
  final ValueChanged<int?> onDepth;
  final FeatureFlagsState flags;

  /// Challenge-parity: selected match_clock.presets seconds.
  final Future<void> Function(int timeControlSeconds) onPlayAi;
  final Future<void> Function() onPlayMatch;
  final String clockLabel;
  final int? clockSeconds;
  final List<MatchClockPreset> timeControlPresets;
  final bool timeControlsLoading;
  final BoardPaletteId boardPaletteId;
  final Future<void> Function(BoardPaletteId) onBoardPalette;
  final PiecePaletteId piecePaletteId;
  final Future<void> Function(PiecePaletteId) onPiecePalette;
  final RailChallengeOpponent? initialChallengeOpponent;
  final VoidCallback? onChallengeOpponentConsumed;

  @override
  State<PlayRailPanel> createState() => _PlayRailPanelState();
}

class _PlayRailPanelState extends State<PlayRailPanel> {
  int _newSub = 0; // 0 = AI, 1 = challenge
  int _gamesSub = 0; // 0 watch, 1 history
  int _playersSub = 2; // 0 friends, 1 requests, 2 all, 3 dms
  List<DmRequestRow> _dmRequests = const [];
  int _dmPendingIncoming = 0;
  int _dmUnreadTotal = 0;
  bool _dmLoading = false;
  bool _dmLoadingMore = false;
  bool _dmHasMore = false;
  int _dmNextSkip = 0;
  int? _selectedTcSeconds;

  final _opponentQueryCtrl = TextEditingController();
  final _playerSearchCtrl = TextEditingController();
  RailChallengeOpponent? _challengeOpponent;

  /// Debounced opponent typeahead query (web CreateChallengeForm parity).
  String _opponentSearch = '';
  Timer? _opponentSearchDebounce;
  List<RailPlayer> _opponentSearchResults = const [];
  bool _opponentSearchLoading = false;
  int _opponentSearchGen = 0;

  /// Debounce-panel suggestions from GET /players?q= (Games Watch/History + All Players).
  List<RailPlayer> _railPlayerSuggest = const [];
  int _railPlayerSuggestGen = 0;

  /// Full friends membership (unpaged) for Friends-tab typeahead - not the infinite list page.
  List<RailPlayer> _friendsMembership = const [];

  /// Full DM request peers (unpaged GET /dms/requests) for DMs-tab typeahead - not list pages.
  List<RailPlayer> _dmMembership = const [];

  /// Full unpaged DM rows (thread/status) so typeahead pick can open without the paged list.
  List<DmRequestRow> _dmMembershipRows = const [];
  bool _rated = true;
  String _preferredColor = 'random';
  bool _sendingChallenge = false;
  bool _challengeAttempted = false;
  String? _shareToken;
  bool _copiedLink = false;
  Timer? _copiedTimer;

  List<_LiveGameRow> _liveGames = const [];
  bool _liveLoading = false;
  bool _liveLoadingMore = false;
  bool _liveHasMore = false;
  int _liveNextSkip = 0;
  String? _liveViewersGameId;
  List<RailPlayer> _liveSpectators = const [];
  bool _liveSpectatorsLoading = false;
  bool _liveSpectatorsLoadingMore = false;
  bool _liveSpectatorsHasMore = false;
  int _liveSpectatorsNextSkip = 0;
  final _liveViewerSearchCtrl = TextEditingController();
  final ScrollController _railScrollController = ScrollController();

  /// Rising-edge gate so sitting at the bottom after a page append does not cascade loads.
  bool _railWasNearBottom = false;
  String _liveViewerSearch = '';
  Timer? _liveViewerSearchDebounce;
  List<_HistoryRow> _history = const [];
  bool _historyLoading = false;
  bool _historyLoadingMore = false;
  bool _historyHasMore = false;
  int _historyNextSkip = 0;
  List<RailPlayer> _players = const [];
  bool _playersLoading = false;
  bool _playersLoadingMore = false;
  bool _playersHasMore = false;
  int _playersNextSkip = 0;

  /// Bumps on each Players fetch so stale Friends↔All responses cannot paint the wrong tab.
  int _playersLoadGen = 0;
  String _playerSearch = '';
  Timer? _playerSearchDebounce;
  bool _addingFriend = false;

  /// Friend membership for All Players Add/Remove toggle (DB-backed).
  Set<String> _friendIds = {};

  /// True only after a successful friends fetch - never paint Add on error/empty race.
  bool _friendIdsReady = false;

  /// Unpaged friend requests for badge + outgoing-pending membership (poll).
  List<_FriendRequestEntry> _friendRequests = const [];

  /// Trim-paged rows for the Requests rail tab (web useFriendRequestsInfinite).
  List<_FriendRequestEntry> _friendReqRows = const [];
  Set<String> _outgoingPendingUserIds = {};
  String? _busyRequestId;

  /// accept | deny | cancel
  String? _busyRequestOp;

  /// Keep Requests-tab badge live while Players rail is open (web useFriendRequestsQuery 15s parity).
  Timer? _friendRequestsPoll;

  /// Consume notification deep-link once requests load.
  String? _pendingDmRequestId;
  String? _pendingDmThreadId;
  bool _dmDeepLinkOpened = false;
  bool _composeOutboxResumed = false;
  MatchmakingRealtimeController? _avatarRt;
  int _seenAvatarSeq = 0;

  @override
  void initState() {
    super.initState();
    final boot = widget.initialPlayersSub;
    _playersSub = boot >= 0 && boot <= 3 ? boot : 2;
    _pendingDmRequestId = (widget.initialDmRequestId ?? '').trim();
    _pendingDmThreadId = (widget.initialDmThreadId ?? '').trim();
    if ((_pendingDmRequestId ?? '').isNotEmpty ||
        (_pendingDmThreadId ?? '').isNotEmpty) {
      _playersSub = 3;
    }
    _applyInitialOpponent(fromInit: true);
    _scheduleTabLoads();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _bindAvatarRt();
      _resumeComposeOutbox();
    });
  }

  void _resumeComposeOutbox() {
    if (_composeOutboxResumed || !mounted) return;
    final auth = context.read<AuthCubit>().state;
    final token = (auth.token ?? '').trim();
    final uid = (auth.userId ?? '').trim();
    if (token.isEmpty || uid.isEmpty) return;
    _composeOutboxResumed = true;
    unawaited(
      resumeComposeOutboxIfNeeded(
        context,
        chrome: widget.railChrome,
        accessToken: token,
        userId: uid,
      ),
    );
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
    if (rt == null || !mounted) return;
    if (rt.avatarEventSeq == _seenAvatarSeq) return;
    _seenAvatarSeq = rt.avatarEventSeq;
    final uid = (rt.lastAvatarUserId ?? '').trim();
    if (uid.isEmpty) return;
    _applyLiveAvatar(uid, rt.lastAvatarThumbUrl, rt.lastAvatarFullUrl);
  }

  void _applyLiveAvatar(String userId, String? thumb, String? full) {
    final next = (thumb ?? '').trim().isNotEmpty
        ? (thumb ?? '').trim()
        : (full ?? '').trim();
    final clear = (thumb ?? '').trim().isEmpty && (full ?? '').trim().isEmpty;
    var changed = false;
    List<RailPlayer> patchPlayers(List<RailPlayer> src) {
      var touched = false;
      final out = src.map((p) {
        if (p.id != userId) return p;
        touched = true;
        return p.copyWith(
          avatarThumbUrl: clear ? null : next,
          clearAvatar: clear,
        );
      }).toList();
      if (touched) changed = true;
      return touched ? out : src;
    }

    final nextPlayers = patchPlayers(_players);
    final nextLive = _liveGames.map((g) {
      var gTouched = false;
      _LiveSeat patchSeat(_LiveSeat s) {
        if (s.id != userId) return s;
        gTouched = true;
        changed = true;
        return _LiveSeat(
          id: s.id,
          username: s.username,
          avatarThumbUrl: clear ? null : next,
          rating: s.rating,
          wins: s.wins,
          losses: s.losses,
          draws: s.draws,
          countryCode: s.countryCode,
          hostTrustTier: s.hostTrustTier,
          hostTrustBadge: s.hostTrustBadge,
        );
      }

      final seats = g.seats.map(patchSeat).toList();
      final viewers = g.viewers.map(patchSeat).toList();
      if (!gTouched) return g;
      return _LiveGameRow(
        id: g.id,
        line1: g.line1,
        line2: g.line2,
        p1Name: g.p1Name,
        p2Name: g.p2Name,
        seats: seats,
        viewers: viewers,
        spectatorCount: g.spectatorCount,
        moveCount: g.moveCount,
        timeControlSeconds: g.timeControlSeconds,
      );
    }).toList();

    RailChallengeOpponent? nextOpp = _challengeOpponent;
    if (nextOpp != null && (nextOpp.id ?? '') == userId) {
      nextOpp = RailChallengeOpponent(
        id: nextOpp.id,
        username: nextOpp.username,
        rating: nextOpp.rating,
        countryCode: nextOpp.countryCode,
        avatarThumbUrl: clear ? null : next,
        online: nextOpp.online,
        playing: nextOpp.playing,
        hostTrustTier: nextOpp.hostTrustTier,
        hostTrustBadge: nextOpp.hostTrustBadge,
      );
      changed = true;
    }

    var dmTouched = false;
    final nextDms = _dmRequests.map((r) {
      final p = r.player;
      if (p == null || p.id != userId) return r;
      dmTouched = true;
      changed = true;
      return DmRequestRow(
        id: r.id,
        status: r.status,
        side: r.side,
        preview: r.preview,
        threadId: r.threadId,
        player: p.copyWith(
          avatarThumbUrl: clear ? null : next,
          clearAvatar: clear,
        ),
      );
    }).toList();

    final nextOppSearch = patchPlayers(_opponentSearchResults);
    final nextSpectators = patchPlayers(_liveSpectators);

    List<_FriendRequestEntry> patchFriendRows(List<_FriendRequestEntry> src) {
      var touched = false;
      final out = src.map((r) {
        if (r.player.id != userId) return r;
        touched = true;
        return _FriendRequestEntry(
          id: r.id,
          status: r.status,
          incoming: r.incoming,
          player: r.player.copyWith(
            avatarThumbUrl: clear ? null : next,
            clearAvatar: clear,
          ),
        );
      }).toList();
      if (touched) changed = true;
      return touched ? out : src;
    }

    final nextFriendReqs = patchFriendRows(_friendRequests);
    final nextFriendReqRows = patchFriendRows(_friendReqRows);

    if (!changed &&
        identical(nextPlayers, _players) &&
        identical(nextLive, _liveGames) &&
        !dmTouched) {
      return;
    }
    setState(() {
      _players = nextPlayers;
      _liveGames = nextLive;
      _challengeOpponent = nextOpp;
      if (dmTouched) _dmRequests = nextDms;
      _opponentSearchResults = nextOppSearch;
      _liveSpectators = nextSpectators;
      _friendRequests = nextFriendReqs;
      _friendReqRows = nextFriendReqRows;
    });
  }

  @override
  void didUpdateWidget(covariant PlayRailPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialChallengeOpponent != oldWidget.initialChallengeOpponent) {
      _applyInitialOpponent();
    }
    if (widget.initialPlayersSub != oldWidget.initialPlayersSub) {
      final next = widget.initialPlayersSub;
      if (next >= 0 && next <= 3 && next != _playersSub) {
        setState(() => _playersSub = next);
        _scheduleTabLoads();
      }
    }
    final nextDm = (widget.initialDmRequestId ?? '').trim();
    final nextThread = (widget.initialDmThreadId ?? '').trim();
    if (nextDm != (oldWidget.initialDmRequestId ?? '').trim() ||
        nextThread != (oldWidget.initialDmThreadId ?? '').trim()) {
      _pendingDmRequestId = nextDm;
      _pendingDmThreadId = nextThread;
      _dmDeepLinkOpened = false;
      if (nextDm.isNotEmpty || nextThread.isNotEmpty) {
        setState(() => _playersSub = 3);
        _scheduleTabLoads();
      }
    }
    if (widget.tab != oldWidget.tab) {
      _scheduleTabLoads();
    }
    if (_gamesSub == 0 && widget.tab == 1 && oldWidget.tab != 1) {
      _loadLiveGames();
    }
  }

  void _applyInitialOpponent({bool fromInit = false}) {
    final o = widget.initialChallengeOpponent;
    if (o == null) return;
    void apply() {
      _newSub = 1;
      _challengeOpponent = o;
      _clearOpponentSearch();
    }

    if (fromInit) {
      apply();
    } else if (mounted) {
      setState(apply);
    } else {
      apply();
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      widget.onTab(0);
      widget.onChallengeOpponentConsumed?.call();
    });
  }

  void _scheduleTabLoads() {
    _railWasNearBottom = false;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (widget.tab == 1) {
        _stopFriendRequestsPoll();
        if (_gamesSub == 0) {
          _loadLiveGames();
        } else {
          _loadHistory();
        }
      } else if (widget.tab == 2) {
        if (_playersSub == 3) {
          unawaited(_loadDmRequests());
        } else {
          _loadPlayers();
        }
        unawaited(_refreshDmBadge());
        _startFriendRequestsPoll();
      } else {
        _stopFriendRequestsPoll();
      }
    });
  }

  void _startFriendRequestsPoll() {
    _friendRequestsPoll?.cancel();
    final token = context.read<AuthCubit>().state.token;
    if (token == null || token.isEmpty) return;
    // Fail closed: DM/friend request poll interval from play_rail chrome only.
    final pollMs =
        int.tryParse(widget.railChrome.dmRequestsPollIntervalMs.trim()) ?? 0;
    if (pollMs <= 0) return;
    _friendRequestsPoll = Timer.periodic(Duration(milliseconds: pollMs), (_) {
      if (!mounted || widget.tab != 2) {
        _stopFriendRequestsPoll();
        return;
      }
      final t = context.read<AuthCubit>().state.token;
      if (t == null || t.isEmpty) {
        _stopFriendRequestsPoll();
        return;
      }
      unawaited(_refreshFriendRequests(t));
      // Badge only (unpaged COUNT); list tabs keep their own Trim pages.
      unawaited(_refreshDmBadge());
    });
  }

  void _stopFriendRequestsPoll() {
    _friendRequestsPoll?.cancel();
    _friendRequestsPoll = null;
  }

  @override
  void dispose() {
    _avatarRt?.removeListener(_onAvatarRt);
    _avatarRt = null;
    _opponentQueryCtrl.dispose();
    _playerSearchCtrl.dispose();
    _liveViewerSearchCtrl.dispose();
    _railScrollController.dispose();
    _copiedTimer?.cancel();
    _playerSearchDebounce?.cancel();
    _opponentSearchDebounce?.cancel();
    _liveViewerSearchDebounce?.cancel();
    _stopFriendRequestsPoll();
    super.dispose();
  }

  String get _rest => '${ApiConfig.baseUrl}/api/v1';

  Map<String, String> _authHeaders(String? token) {
    if (token == null || token.isEmpty) return const {};
    return {'Authorization': 'Bearer $token'};
  }

  int get _searchDebounceMs {
    final n = int.tryParse(widget.railChrome.searchDebounceMs.trim());
    // DB chrome only (panel mounts when PlayRailChrome.isReady).
    if (n == null || n < 0) {
      throw StateError('play_rail_chrome.search_debounce_ms invalid');
    }
    return n;
  }

  String _formatPlayerNameDisplay(String name, PlayRailChrome c) {
    final n = int.tryParse(c.livePlayerNameMaxChars.trim());
    final trimmed = name.trim();
    if (n == null || n <= 0) return trimmed;
    if (trimmed.length <= n) return trimmed;
    return '${trimmed.substring(0, n)}${c.nameTruncateSuffix}';
  }

  void _onPlayerSearchChanged(String v) {
    _playerSearchDebounce?.cancel();
    final ms = _searchDebounceMs;
    _playerSearchDebounce = Timer(Duration(milliseconds: ms), () {
      if (!mounted) return;
      setState(() => _playerSearch = v);
      // Server-driven q for every players sub-tab (not client filter of loaded pages).
      unawaited(_loadPlayers());
      if (_playersSub == 3) unawaited(_loadDmRequests());
      if (_playersSub == 2) unawaited(_loadRailPlayerSuggest(v));
    });
  }

  void _onGamesSearchChanged(String v) {
    _playerSearchDebounce?.cancel();
    final ms = _searchDebounceMs;
    _playerSearchDebounce = Timer(Duration(milliseconds: ms), () {
      if (!mounted) return;
      setState(() => _playerSearch = v);
      unawaited(_loadRailPlayerSuggest(v));
      if (_gamesSub == 0) {
        unawaited(_loadLiveGames());
      } else {
        unawaited(_loadHistory());
      }
    });
  }

  Future<void> _loadRailPlayerSuggest(String raw) async {
    final q = raw.trim();
    final gen = ++_railPlayerSuggestGen;
    if (q.isEmpty) {
      if (!mounted || gen != _railPlayerSuggestGen) return;
      setState(() => _railPlayerSuggest = const []);
      return;
    }
    final pageSize = _listPageSize();
    if (pageSize <= 0) {
      if (!mounted || gen != _railPlayerSuggestGen) return;
      setState(() => _railPlayerSuggest = const []);
      return;
    }
    // Drain every relevance-ranked page for this q (debounce panel must not be first-page-only).
    try {
      final all = <RailPlayer>[];
      final seen = <String>{};
      var skip = 0;
      var hasMore = true;
      while (hasMore) {
        if (!mounted || gen != _railPlayerSuggestGen) return;
        final uri = Uri.parse('$_rest/players').replace(
          queryParameters: {
            'q': q,
            'skip': '$skip',
            'limit': '$pageSize',
          },
        );
        final res = await http.get(uri);
        if (!mounted || gen != _railPlayerSuggestGen) return;
        if (res.statusCode >= 300) {
          setState(() => _railPlayerSuggest = const []);
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
          hasMore = list.length >= pageSize;
          skip += list.length;
        }
        if (list.isEmpty) hasMore = false;
        if (mounted && gen == _railPlayerSuggestGen) {
          setState(() => _railPlayerSuggest = List<RailPlayer>.from(all));
        }
      }
    } catch (_) {
      if (!mounted || gen != _railPlayerSuggestGen) return;
      setState(() => _railPlayerSuggest = const []);
    }
  }

  List<RailPlayer> _rankUsernameMatches(List<RailPlayer> source, String q) {
    final needle = q.trim().toLowerCase();
    if (needle.isEmpty) return const [];
    final ranked = <({RailPlayer p, int rank})>[];
    for (final p in source) {
      final u = p.username.trim().toLowerCase();
      if (!u.contains(needle)) continue;
      final rank = u == needle ? 0 : (u.startsWith(needle) ? 1 : 2);
      ranked.add((p: p, rank: rank));
    }
    ranked.sort((a, b) {
      final c = a.rank.compareTo(b.rank);
      if (c != 0) return c;
      return b.p.rating.compareTo(a.p.rating);
    });
    // Full membership set - never slice to one page in the debounce panel.
    return ranked.map((e) => e.p).toList();
  }

  List<RailPlayer> _playerTypeaheadSuggestions() {
    final q = _playerSearch.trim();
    if (q.isEmpty) return const [];
    // Games Watch/History: debounce panel from GET /players?q= only.
    if (widget.tab == 1) {
      return _railPlayerSuggest;
    }
    if (_playersSub == 2) {
      return _railPlayerSuggest.isNotEmpty ? _railPlayerSuggest : _players;
    }
    if (_playersSub == 0) {
      return _rankUsernameMatches(_friendsMembership, q);
    }
    if (_playersSub == 1) {
      // Full unpaged request set (badge membership), not infinite list pages.
      return _rankUsernameMatches(
        _friendRequests.map((r) => r.player).toList(),
        q,
      );
    }
    if (_playersSub == 3) {
      // Full unpaged DM membership (badge fetch), not infinite list pages.
      return _rankUsernameMatches(_dmMembership, q);
    }
    return const [];
  }

  void _pickPlayerFromTypeahead(RailPlayer p) {
    // Dismiss keyboard first so this tap activates (not only unfocus).
    FocusManager.instance.primaryFocus?.unfocus();
    _playerSearchCtrl.text = p.username;
    _playerSearchCtrl.selection =
        TextSelection.collapsed(offset: p.username.length);
    setState(() => _playerSearch = p.username);
    if (widget.tab == 1) {
      if (_gamesSub == 0) {
        unawaited(_loadLiveGames());
      } else {
        unawaited(_loadHistory());
      }
      return;
    }
    // DMs: open the thread on the first typeahead tap (list-row parity).
    if (_playersSub == 3) {
      DmRequestRow? match;
      for (final r in [..._dmMembershipRows, ..._dmRequests]) {
        if (r.player?.id == p.id) {
          match = r;
          break;
        }
      }
      final row = match;
      final tid = (row?.threadId ?? '').trim();
      final auth = context.read<AuthCubit>().state;
      final token = auth.token?.trim() ?? '';
      if (row != null && tid.isNotEmpty && token.isNotEmpty) {
        unawaited(() async {
          await showDmThreadSheet(
            context,
            chrome: widget.railChrome,
            accessToken: token,
            threadId: tid,
            peerName: p.username,
            canCompose: row.status == 'accepted',
            requestId: row.id,
            requestSide: row.side,
            requestStatus: row.status,
          );
          if (mounted) unawaited(_loadDmRequests());
        }());
        return;
      }
      unawaited(_loadDmRequests());
      return;
    }
    // Friends / requests / all: open player card on the first typeahead tap.
    if (_playersSub == 0 || _playersSub == 1 || _playersSub == 2) {
      final tokens = damaColorsOf(context);
      final signedIn = context.read<AuthCubit>().state.isAuthenticated;
      unawaited(_showPlayerCard(tokens, widget.railChrome, p, signedIn));
      if (_playersSub == 2 || _playersSub == 0 || _playersSub == 1) {
        unawaited(_loadPlayers());
      }
    }
  }

  List<Widget> _playerSearchTypeaheadPanel(
      DamaColors tokens, PlayRailChrome c) {
    final suggestions = _playerTypeaheadSuggestions();
    final q = _playerSearch.trim();
    if (q.isEmpty || suggestions.isEmpty) return const [];
    return [
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
            itemCount: suggestions.length,
            separatorBuilder: (_, __) =>
                Divider(height: 1, color: tokens.borderSubtle),
            itemBuilder: (context, i) {
              final p = suggestions[i];
              return KeyedSubtree(
                key: ValueKey('rail-typeahead-${p.id}'),
                child: _typeaheadPlayerTile(
                  tokens,
                  c,
                  p,
                  onTap: () => _pickPlayerFromTypeahead(p),
                ),
              );
            },
          ),
        ),
      ),
    ];
  }

  void _onOpponentQueryChanged(String v) {
    _opponentSearchDebounce?.cancel();
    final ms = _searchDebounceMs;
    _opponentSearchDebounce = Timer(Duration(milliseconds: ms), () {
      if (!mounted) return;
      setState(() => _opponentSearch = v);
      unawaited(_loadOpponentSearch());
    });
  }

  void _clearOpponentSearch() {
    _opponentSearchDebounce?.cancel();
    _opponentSearchGen++;
    _opponentSearch = '';
    _opponentSearchResults = const [];
    _opponentSearchLoading = false;
    _opponentQueryCtrl.clear();
  }

  void _pickOpponentFromSearch(RailPlayer player) {
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      _challengeOpponent = RailChallengeOpponent(
        id: player.id,
        username: player.username,
        rating: player.rating,
        countryCode: player.countryCode,
        avatarThumbUrl: player.avatarThumbUrl,
        online: player.online,
        playing: player.playing,
        hostTrustTier: player.hostTrustTier,
        hostTrustBadge: player.hostTrustBadge,
      );
      _clearOpponentSearch();
    });
  }

  Widget _typeaheadPlayerTile(
    DamaColors tokens,
    PlayRailChrome c,
    RailPlayer p, {
    required VoidCallback onTap,
  }) {
    final statusLabel = p.playing
        ? c.playingLabel
        : p.online
            ? c.onlineLabel
            : c.offlineLabel;
    final statusColor = p.playing
        ? tokens.playing
        : p.online
            ? tokens.online
            : tokens.offline;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  DamaUserAvatar(imageUrl: p.avatarThumbUrl, radius: 16),
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: statusColor,
                        shape: BoxShape.circle,
                        border: Border.all(color: tokens.card, width: 2),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            _formatPlayerNameDisplay(p.username, c),
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ),
                        Text(
                          '${c.ratingParenOpen}${p.rating}${c.ratingParenClose}',
                          style: TextStyle(
                            color: tokens.onSurfaceMuted,
                            fontSize: 12,
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
                        ),
                        const SizedBox(width: 6),
                        CountryFlag(
                          code: p.countryCode,
                          imageUrlTemplate: c.countryFlagImageUrlTemplate,
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
  }

  Future<void> _loadOpponentSearch() async {
    final auth = context.read<AuthCubit>().state;
    final signedIn = auth.isAuthenticated && (auth.token?.isNotEmpty ?? false);
    final q = _opponentSearch.trim();
    final gen = ++_opponentSearchGen;
    if (!signedIn || _challengeOpponent != null || q.isEmpty) {
      if (!mounted || gen != _opponentSearchGen) return;
      setState(() {
        _opponentSearchResults = const [];
        _opponentSearchLoading = false;
      });
      return;
    }
    setState(() => _opponentSearchLoading = true);
    try {
      final pageSize = _listPageSize();
      if (pageSize <= 0) {
        if (mounted && gen == _opponentSearchGen) {
          setState(() {
            _opponentSearchResults = const [];
            _opponentSearchLoading = false;
          });
        }
        return;
      }
      // Drain all relevance pages for challenge opponent typeahead.
      final all = <RailPlayer>[];
      final seen = <String>{};
      var skip = 0;
      var hasMore = true;
      while (hasMore) {
        if (!mounted || gen != _opponentSearchGen) return;
        final uri = Uri.parse('$_rest/players').replace(
          queryParameters: {
            'q': q,
            'skip': '$skip',
            'limit': '$pageSize',
          },
        );
        final res = await http.get(uri);
        if (!mounted || gen != _opponentSearchGen) return;
        if (res.statusCode >= 300) {
          setState(() {
            _opponentSearchResults = const [];
            _opponentSearchLoading = false;
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
          hasMore = list.length >= pageSize;
          skip += list.length;
        }
        if (list.isEmpty) hasMore = false;
        if (mounted && gen == _opponentSearchGen) {
          setState(() {
            _opponentSearchResults = List<RailPlayer>.from(all);
            _opponentSearchLoading = false;
          });
        }
      }
    } catch (_) {
      if (!mounted || gen != _opponentSearchGen) return;
      setState(() {
        _opponentSearchResults = const [];
        _opponentSearchLoading = false;
      });
    }
  }

  bool _responseMentionsAlreadyFriends(String body) {
    final t = body.trim().toLowerCase();
    // Stable API code only (never match localized chrome / English prose).
    return t == 'already_friends' ||
        t.contains('"error":"already_friends"') ||
        t.contains('"error": "already_friends"');
  }

  String? _challengeShareUrl(String token) {
    final origin =
        widget.railChrome.webAppOrigin.trim().replaceAll(RegExp(r'/$'), '');
    if (origin.isEmpty) return null;
    return '$origin/?challenge=${Uri.encodeComponent(token)}';
  }

  void _onLiveViewerSearchChanged(String v) {
    _liveViewerSearchDebounce?.cancel();
    final ms = _searchDebounceMs;
    _liveViewerSearchDebounce = Timer(Duration(milliseconds: ms), () {
      if (!mounted) return;
      setState(() => _liveViewerSearch = v);
      final gid = (_liveViewersGameId ?? '').trim();
      if (gid.isEmpty) return;
      // Server filters the full spectator roster by q.
      unawaited(_loadLiveSpectators(gid, reset: true));
    });
  }

  List<RailPlayer> _liveSpectatorsFiltered() {
    // Server already applied q - keep helper for call sites.
    return _liveSpectators;
  }

  void _openLiveViewersInRail(String gameId) {
    final id = gameId.trim();
    if (id.isEmpty) return;
    setState(() {
      _liveViewersGameId = id;
      _liveSpectators = const [];
      _liveSpectatorsHasMore = false;
      _liveSpectatorsNextSkip = 0;
      _liveViewerSearch = '';
      _liveViewerSearchCtrl.clear();
    });
    unawaited(_loadLiveSpectators(id, reset: true));
  }

  void _closeLiveViewersInRail() {
    setState(() {
      _liveViewersGameId = null;
      _liveSpectators = const [];
      _liveSpectatorsLoading = false;
      _liveSpectatorsLoadingMore = false;
      _liveSpectatorsHasMore = false;
      _liveSpectatorsNextSkip = 0;
    });
  }

  /// Backend `meta.has_more` / `meta.next_skip` only - never invent from list length.
  ({bool hasMore, int nextSkip}) _pageMeta(
    Map<String, dynamic>? meta, {
    required int skip,
    required int pageLen,
  }) {
    if (meta != null && meta['has_more'] is bool) {
      final hasMore = meta['has_more'] as bool;
      final ns = meta['next_skip'];
      final nextSkip = ns is num ? ns.toInt() : skip + pageLen;
      return (hasMore: hasMore, nextSkip: nextSkip);
    }
    return (hasMore: false, nextSkip: skip + pageLen);
  }

  bool _railNearBottom(ScrollMetrics m) {
    // Content shorter than viewport: maxScrollExtent == 0 → never treat as "at end"
    // (that caused rapid cascade load-more glitching). Short lists fill via
    // `_maybeFillActiveList` after each successful page.
    if (m.maxScrollExtent <= 8) return false;
    return m.pixels >= m.maxScrollExtent - 80;
  }

  void _loadMoreForActiveRailTab() {
    if (widget.tab == 1) {
      final viewersId = (_liveViewersGameId ?? '').trim();
      if (viewersId.isNotEmpty) {
        unawaited(_loadLiveSpectators(viewersId, reset: false));
        return;
      }
      if (_gamesSub == 0) {
        unawaited(_loadLiveGames(reset: false));
      } else {
        unawaited(_loadHistory(reset: false));
      }
    } else if (widget.tab == 2) {
      if (_playersSub == 3) {
        unawaited(_loadDmRequests(reset: false));
      } else {
        unawaited(_loadPlayers(reset: false));
      }
    }
  }

  void _maybeFillActiveList() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_railScrollController.hasClients) return;
      final pos = _railScrollController.position;
      if (pos.maxScrollExtent > 8) return;
      _loadMoreForActiveRailTab();
    });
  }

  Future<void> _loadLiveSpectators(String gameId, {bool reset = true}) async {
    final requested = gameId.trim();
    if (requested.isEmpty) return;
    final limit = _listPageSize();
    if (limit <= 0) {
      if (mounted && _liveViewersGameId == requested) {
        setState(() {
          _liveSpectators = const [];
          _liveSpectatorsHasMore = false;
          _liveSpectatorsNextSkip = 0;
          _liveSpectatorsLoading = false;
          _liveSpectatorsLoadingMore = false;
        });
      }
      return;
    }
    if (reset) {
      if (_liveSpectatorsLoading) return;
      setState(() {
        _liveSpectatorsLoading = true;
        _liveSpectatorsNextSkip = 0;
        _liveSpectatorsHasMore = false;
        _liveSpectators = const [];
      });
    } else {
      if (_liveSpectatorsLoading ||
          _liveSpectatorsLoadingMore ||
          !_liveSpectatorsHasMore) {
        return;
      }
      setState(() => _liveSpectatorsLoadingMore = true);
    }
    final skip = reset ? 0 : _liveSpectatorsNextSkip;
    try {
      final q = _liveViewerSearch.trim();
      final uri = Uri.parse(
        '$_rest/games/${Uri.encodeComponent(requested)}/spectators',
      ).replace(queryParameters: {
        'skip': '$skip',
        'limit': '$limit',
        if (q.isNotEmpty) 'q': q,
      });
      final res = await http.get(uri);
      if (!mounted || _liveViewersGameId != requested) return;
      if (res.statusCode >= 300) {
        if (reset) setState(() => _liveSpectators = const []);
        return;
      }
      final decoded = jsonDecode(res.body);
      if (decoded is! Map<String, dynamic>) {
        if (reset) setState(() => _liveSpectators = const []);
        return;
      }
      final raw = decoded['spectators'] as List<dynamic>? ??
          decoded['viewers'] as List<dynamic>? ??
          const [];
      final list = raw
          .whereType<Map>()
          .map((e) => RailPlayer.fromJson(Map<String, dynamic>.from(e)))
          .whereType<RailPlayer>()
          .toList();
      final meta = decoded['meta'] is Map<String, dynamic>
          ? decoded['meta'] as Map<String, dynamic>
          : null;
      final page = _pageMeta(meta, skip: skip, pageLen: list.length);
      setState(() {
        if (reset) {
          _liveSpectators = list;
        } else {
          final seen = {for (final p in _liveSpectators) p.id};
          _liveSpectators = [
            ..._liveSpectators,
            ...list.where((p) => !seen.contains(p.id)),
          ];
        }
        _liveSpectatorsNextSkip = page.nextSkip;
        _liveSpectatorsHasMore = page.hasMore;
      });
      if (page.hasMore && list.isNotEmpty) _maybeFillActiveList();
    } catch (_) {
      if (mounted && _liveViewersGameId == requested && reset) {
        setState(() => _liveSpectators = const []);
      }
    } finally {
      if (mounted && _liveViewersGameId == requested) {
        setState(() {
          _liveSpectatorsLoading = false;
          _liveSpectatorsLoadingMore = false;
        });
      } else if (mounted) {
        setState(() {
          _liveSpectatorsLoading = false;
          _liveSpectatorsLoadingMore = false;
        });
      }
    }
  }

  int _listPageSize() {
    final n = int.tryParse(widget.railChrome.listPageSize.trim());
    return (n != null && n > 0) ? n : 0;
  }

  Future<void> _loadLiveGames({bool reset = true}) async {
    final limit = _listPageSize();
    if (limit <= 0) {
      if (mounted) {
        setState(() {
          _liveGames = const [];
          _liveHasMore = false;
          _liveNextSkip = 0;
        });
      }
      return;
    }
    if (reset) {
      if (_liveLoading) return;
      setState(() {
        _liveLoading = true;
        _liveNextSkip = 0;
        _liveHasMore = false;
      });
    } else {
      if (_liveLoading || _liveLoadingMore || !_liveHasMore) return;
      setState(() => _liveLoadingMore = true);
    }
    final skip = reset ? 0 : _liveNextSkip;
    try {
      final q = _playerSearch.trim();
      final uri = Uri.parse('$_rest/games/live').replace(
        queryParameters: {
          'skip': '$skip',
          'limit': '$limit',
          if (q.isNotEmpty) 'q': q,
        },
      );
      final res = await http.get(uri);
      if (res.statusCode >= 300) {
        if (mounted && reset) setState(() => _liveGames = const []);
        return;
      }
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      final c = widget.railChrome;
      final list = (map['games'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(
            (e) => _LiveGameRow.fromJson(
              e,
              parenOpen: c.ratingParenOpen,
              parenClose: c.ratingParenClose,
            ),
          )
          .whereType<_LiveGameRow>()
          .toList();
      if (mounted) {
        setState(() {
          if (reset) {
            _liveGames = list;
          } else {
            final seen = {for (final g in _liveGames) g.id};
            _liveGames = [
              ..._liveGames,
              ...list.where((g) => !seen.contains(g.id)),
            ];
          }
          final meta = map['meta'] is Map<String, dynamic>
              ? map['meta'] as Map<String, dynamic>
              : null;
          final page = _pageMeta(meta, skip: skip, pageLen: list.length);
          _liveNextSkip = page.nextSkip;
          _liveHasMore = page.hasMore;
        });
        if (_liveHasMore && list.isNotEmpty) _maybeFillActiveList();
      }
    } catch (_) {
      if (mounted && reset) setState(() => _liveGames = const []);
    } finally {
      if (mounted) {
        setState(() {
          _liveLoading = false;
          _liveLoadingMore = false;
        });
      }
    }
  }

  Future<void> _loadHistory({bool reset = true}) async {
    final token = context.read<AuthCubit>().state.token;
    if (token == null || token.isEmpty) {
      setState(() {
        _history = const [];
        _historyLoading = false;
        _historyLoadingMore = false;
        _historyHasMore = false;
        _historyNextSkip = 0;
      });
      return;
    }
    final limit = _listPageSize();
    if (limit <= 0) {
      if (mounted) {
        setState(() {
          _history = const [];
          _historyLoading = false;
          _historyLoadingMore = false;
          _historyHasMore = false;
          _historyNextSkip = 0;
        });
      }
      return;
    }
    if (reset) {
      if (_historyLoading) return;
      setState(() {
        _historyLoading = true;
        _historyNextSkip = 0;
        _historyHasMore = false;
      });
    } else {
      if (_historyLoading || _historyLoadingMore || !_historyHasMore) return;
      setState(() => _historyLoadingMore = true);
    }
    final skip = reset ? 0 : _historyNextSkip;
    try {
      final q = _playerSearch.trim();
      final res = await http.get(
        Uri.parse('$_rest/matches/me').replace(
          queryParameters: {
            'skip': '$skip',
            'limit': '$limit',
            if (q.isNotEmpty) 'q': q,
          },
        ),
        headers: _authHeaders(token),
      );
      if (res.statusCode >= 300) {
        if (mounted && reset) setState(() => _history = const []);
        return;
      }
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      final list = (map['matches'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(_HistoryRow.fromJson)
          .whereType<_HistoryRow>()
          .toList();
      if (mounted) {
        setState(() {
          if (reset) {
            _history = list;
          } else {
            final seen = {for (final m in _history) m.id};
            _history = [
              ..._history,
              ...list.where((m) => !seen.contains(m.id)),
            ];
          }
          final meta = map['meta'] is Map<String, dynamic>
              ? map['meta'] as Map<String, dynamic>
              : null;
          final page = _pageMeta(meta, skip: skip, pageLen: list.length);
          _historyNextSkip = page.nextSkip;
          _historyHasMore = page.hasMore;
        });
        if (_historyHasMore && list.isNotEmpty) _maybeFillActiveList();
      }
    } catch (_) {
      if (mounted && reset) setState(() => _history = const []);
    } finally {
      if (mounted) {
        setState(() {
          _historyLoading = false;
          _historyLoadingMore = false;
        });
      }
    }
  }

  Future<void> _loadPlayers({bool reset = true}) async {
    final sub = _playersSub;
    // Friends + All Players + Requests use Trim skip/limit append.
    final pageable = sub == 0 || sub == 1 || sub == 2;
    final append = !reset && pageable;
    late final int gen;
    if (append) {
      if (_playersLoading || _playersLoadingMore || !_playersHasMore) return;
      gen = _playersLoadGen;
      setState(() => _playersLoadingMore = true);
    } else {
      gen = ++_playersLoadGen;
      setState(() {
        _playersLoading = true;
        _playersNextSkip = 0;
        _playersHasMore = false;
        // Clear stale rows immediately so Friends never shows All Players Add chips mid-race.
        _players = const [];
        if (sub == 0) {
          _friendIdsReady = false;
        } else if (sub == 1) {
          _friendReqRows = const [];
        }
      });
    }
    bool stillCurrent() =>
        mounted && gen == _playersLoadGen && _playersSub == sub;
    try {
      final token = context.read<AuthCubit>().state.token;
      final signedIn = token != null && token.isNotEmpty;
      if (sub == 0) {
        if (!signedIn) {
          if (stillCurrent()) {
            setState(() {
              _players = const [];
              _friendIds = {};
              _friendIdsReady = false;
            });
          }
          return;
        }
        final pageSize = _listPageSize();
        if (pageSize <= 0) {
          if (stillCurrent()) {
            setState(() {
              _players = const [];
              _playersHasMore = false;
              _playersNextSkip = 0;
            });
          }
          return;
        }
        // Membership Set stays unpaged (Add/Remove on All Players).
        if (!append) {
          await _refreshFriendIds(token);
          if (!stillCurrent()) return;
          await _refreshFriendRequests(token);
          if (!stillCurrent()) return;
        }
        final skip = append ? _playersNextSkip : 0;
        final q = _playerSearch.trim();
        final uri = Uri.parse('$_rest/friends/').replace(
          queryParameters: {
            'skip': '$skip',
            'limit': '$pageSize',
            if (q.isNotEmpty) 'q': q,
          },
        );
        final res = await http.get(uri, headers: _authHeaders(token));
        if (!stillCurrent()) return;
        if (res.statusCode >= 300) {
          if (!append) {
            setState(() {
              _players = const [];
              _playersHasMore = false;
              _playersNextSkip = 0;
            });
          }
          return;
        }
        final map = jsonDecode(res.body) as Map<String, dynamic>;
        final list = (map['friends'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(RailPlayer.fromJson)
            .whereType<RailPlayer>()
            .toList();
        if (!stillCurrent()) return;
        setState(() {
          if (append) {
            final seen = {for (final p in _players) p.id};
            _players = [
              ..._players,
              ...list.where((p) => !seen.contains(p.id)),
            ];
          } else {
            _players = list;
          }
          final meta = map['meta'];
          final page = _pageMeta(
            meta is Map<String, dynamic> ? meta : null,
            skip: skip,
            pageLen: list.length,
          );
          _playersNextSkip = page.nextSkip;
          _playersHasMore = page.hasMore;
        });
      } else if (sub == 1) {
        if (!signedIn) {
          if (stillCurrent()) {
            setState(() {
              _friendReqRows = const [];
              _friendRequests = const [];
            });
          }
          return;
        }
        final pageSize = _listPageSize();
        if (pageSize <= 0) {
          if (stillCurrent()) {
            setState(() {
              _friendReqRows = const [];
              _playersHasMore = false;
              _playersNextSkip = 0;
            });
          }
          return;
        }
        // Badge / outgoing-pending membership stays unpaged.
        if (!append) {
          await _refreshFriendRequests(token);
          if (!stillCurrent()) return;
        }
        final skip = append ? _playersNextSkip : 0;
        final q = _playerSearch.trim();
        final uri = Uri.parse('$_rest/friends/requests').replace(
          queryParameters: {
            'skip': '$skip',
            'limit': '$pageSize',
            if (q.isNotEmpty) 'q': q,
          },
        );
        final res = await http.get(uri, headers: _authHeaders(token));
        if (!stillCurrent()) return;
        if (res.statusCode >= 300) {
          if (!append) {
            setState(() {
              _friendReqRows = const [];
              _playersHasMore = false;
              _playersNextSkip = 0;
            });
          }
          return;
        }
        final map = jsonDecode(res.body) as Map<String, dynamic>;
        final list = (map['requests'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(_FriendRequestEntry.fromPagedJson)
            .whereType<_FriendRequestEntry>()
            .toList();
        if (!stillCurrent()) return;
        setState(() {
          if (append) {
            final seen = {for (final r in _friendReqRows) r.id};
            _friendReqRows = [
              ..._friendReqRows,
              ...list.where((r) => !seen.contains(r.id)),
            ];
          } else {
            _friendReqRows = list;
          }
          final meta = map['meta'];
          final page = _pageMeta(
            meta is Map<String, dynamic> ? meta : null,
            skip: skip,
            pageLen: list.length,
          );
          _playersNextSkip = page.nextSkip;
          _playersHasMore = page.hasMore;
        });
      } else {
        // Await membership success before paint - hide Add/Remove if friends fetch fails.
        if (token != null && token.isNotEmpty) {
          await _refreshFriendIds(token);
          await _refreshFriendRequests(token);
          if (!stillCurrent()) return;
        } else if (stillCurrent()) {
          setState(() {
            _friendIds = {};
            _friendIdsReady = true;
            _outgoingPendingUserIds = {};
          });
        }
        if (!stillCurrent()) return;
        final q = _playerSearch.trim();
        final pageSize = _listPageSize();
        if (pageSize <= 0) {
          if (stillCurrent()) {
            setState(() {
              _players = const [];
              _playersHasMore = false;
              _playersNextSkip = 0;
            });
          }
          return;
        }
        final skip = append ? _playersNextSkip : 0;
        final uri = Uri.parse('$_rest/players').replace(
          queryParameters: {
            if (q.isNotEmpty) 'q': q,
            'skip': '$skip',
            'limit': '$pageSize',
          },
        );
        final res = await http.get(uri);
        if (!stillCurrent()) return;
        if (res.statusCode >= 300) {
          if (!append) setState(() => _players = const []);
          return;
        }
        final map = jsonDecode(res.body) as Map<String, dynamic>;
        final list = (map['players'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(RailPlayer.fromJson)
            .whereType<RailPlayer>()
            .toList();
        if (!stillCurrent()) return;
        setState(() {
          if (append) {
            final seen = {for (final p in _players) p.id};
            _players = [
              ..._players,
              ...list.where((p) => !seen.contains(p.id)),
            ];
          } else {
            _players = list;
          }
          final meta = map['meta'] is Map<String, dynamic>
              ? map['meta'] as Map<String, dynamic>
              : null;
          final page = _pageMeta(meta, skip: skip, pageLen: list.length);
          _playersNextSkip = page.nextSkip;
          _playersHasMore = page.hasMore;
        });
        if (_playersHasMore && list.isNotEmpty) _maybeFillActiveList();
      }
    } catch (_) {
      if (stillCurrent() && !append) {
        setState(() {
          _players = const [];
          if (sub == 0) {
            _friendIds = {};
            _friendIdsReady = false;
          } else if (sub == 1) {
            _friendReqRows = const [];
          }
        });
      }
    } finally {
      if (mounted && gen == _playersLoadGen) {
        setState(() {
          _playersLoading = false;
          _playersLoadingMore = false;
        });
      }
    }
  }

  void _openChallengeFor(RailPlayer player) {
    setState(() {
      _challengeOpponent = RailChallengeOpponent(
        id: player.id,
        username: player.username,
        rating: player.rating,
        countryCode: player.countryCode,
        avatarThumbUrl: player.avatarThumbUrl,
        online: player.online,
        playing: player.playing,
        hostTrustTier: player.hostTrustTier,
        hostTrustBadge: player.hostTrustBadge,
      );
      _newSub = 1;
      _clearOpponentSearch();
    });
    widget.onTab(0);
  }

  Future<void> _sendChallenge({required bool openLink}) async {
    final c = widget.railChrome;
    final auth = context.read<AuthCubit>().state;
    final target =
        (_challengeOpponent?.username ?? _opponentQueryCtrl.text).trim();
    if (!openLink && target.isEmpty) {
      setState(() => _challengeAttempted = true);
      return;
    }
    if (!auth.isAuthenticated || auth.token == null) {
      _toast(c.toastSignInChallenge);
      return;
    }
    final sec = _effectiveTc;
    if (sec == null || sec <= 0 || _presets.isEmpty) {
      _toast(c.toastTimeControlUnavailable);
      return;
    }
    if (!openLink) {
      final myName = (auth.username ?? '').trim().toLowerCase();
      final myId = (auth.userId ?? '').trim().toLowerCase();
      final targetNorm = target.toLowerCase();
      final oppId = (_challengeOpponent?.id ?? '').trim().toLowerCase();
      if ((myName.isNotEmpty && targetNorm == myName) ||
          (myId.isNotEmpty &&
              (targetNorm == myId || (oppId.isNotEmpty && oppId == myId)))) {
        _toast(c.toastInviteYourself);
        return;
      }
    }
    final rt = MatchmakingRealtimeScope.maybeOf(context);
    setState(() => _sendingChallenge = true);
    try {
      final body = <String, dynamic>{
        'rated': _rated,
        'preferred_color': _preferredColor,
        'open_link': openLink,
        'time_control_seconds': sec,
      };
      if (!openLink) body['to_user'] = target;
      final res = await http.post(
        Uri.parse('$_rest/invites/'),
        headers: {
          ..._authHeaders(auth.token),
          'Content-Type': 'application/json',
        },
        body: jsonEncode(body),
      );
      if (res.statusCode >= 300) {
        _toast(c.toastChallengeFailed);
        return;
      }
      String? tok;
      String? inviteId;
      try {
        final json = jsonDecode(res.body) as Map<String, dynamic>;
        final inv = json['invite'];
        if (inv is Map<String, dynamic>) {
          tok = inv['share_token']?.toString();
          inviteId = inv['id']?.toString();
        }
      } catch (_) {}
      if (tok != null && tok.isNotEmpty) {
        setState(() => _shareToken = tok);
      }
      // Arm outgoing wait for both targeted and open challenge links (web parity).
      final id = (inviteId ?? '').trim();
      if (id.isNotEmpty) {
        rt?.noteOutgoing(
          id: id,
          toUsername: openLink ? null : target,
        );
      }
      if (openLink && tok != null && tok.isNotEmpty) {
        // _copyChallengeLink toasts copied / copy-failed (no duplicate blurb).
        await _copyChallengeLink(tok);
      } else if (!openLink) {
        _toast('${c.toastChallengeSentPrefix} $target'.trim());
        if (_challengeOpponent == null && target.isNotEmpty) {
          setState(() =>
              _challengeOpponent = RailChallengeOpponent(username: target));
        }
      }
    } catch (_) {
      _toast(c.toastChallengeFailed);
    } finally {
      if (mounted) setState(() => _sendingChallenge = false);
    }
  }

  Future<void> _copyChallengeLink([String? tokenOverride]) async {
    final c = widget.railChrome;
    final tok = tokenOverride ?? _shareToken;
    if (tok == null || tok.isEmpty) {
      await _sendChallenge(openLink: true);
      return;
    }
    final url = _challengeShareUrl(tok);
    if (url == null || url.isEmpty) {
      _toast(c.toastCopyFailed);
      return;
    }
    try {
      await Clipboard.setData(ClipboardData(text: url));
      setState(() => _copiedLink = true);
      _copiedTimer?.cancel();
      _copiedTimer = Timer(const Duration(seconds: 2), () {
        if (mounted) setState(() => _copiedLink = false);
      });
      _toast(c.copiedShareBlurb);
    } catch (_) {
      _toast(c.toastCopyFailed);
    }
  }

  Future<bool> _refreshFriendRequests(String token) async {
    try {
      final res = await http.get(
        Uri.parse('$_rest/friends/requests'),
        headers: _authHeaders(token),
      );
      if (res.statusCode >= 300) {
        // Keep last-known request / pending CTAs on transient API failures.
        return false;
      }
      if (!mounted) return false;
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      final incoming = (map['incoming'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>();
      final outgoing = (map['outgoing'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>();
      final entries = <_FriendRequestEntry>[];
      for (final row in incoming) {
        final e = _FriendRequestEntry.fromJson(row, incoming: true);
        if (e != null) entries.add(e);
      }
      for (final row in outgoing) {
        final e = _FriendRequestEntry.fromJson(row, incoming: false);
        if (e != null) entries.add(e);
      }
      final pendingIds = <String>{};
      for (final row in outgoing) {
        final status = (row['status'] as String?)?.trim() ?? '';
        final toId = (row['to_user_id'] as String?)?.trim() ?? '';
        if (status == 'pending' && toId.isNotEmpty) {
          pendingIds.add(toId);
        }
      }
      if (mounted) {
        setState(() {
          _friendRequests = entries;
          _outgoingPendingUserIds = pendingIds;
        });
      }
      return true;
    } catch (_) {
      // Keep last-known request state on transport blips (outgoing pending CTAs).
      return false;
    }
  }

  Future<bool> _refreshFriendIds(String token) async {
    try {
      final res = await http.get(
        Uri.parse('$_rest/friends/'),
        headers: _authHeaders(token),
      );
      if (res.statusCode >= 300) {
        // Keep last-known membership on transient API failures (web isLoadingError).
        if (mounted && !_friendIdsReady) {
          setState(() {
            _friendIdsReady = false;
            _friendIds = {};
          });
          final msg = widget.railChrome.toastFriendFailed.trim();
          if (msg.isNotEmpty) _toast(msg);
        }
        return false;
      }
      if (!mounted) return false;
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      final ids = (map['friends'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map((e) => (e['id'] ?? e['user_id'] ?? '').toString())
          .where((id) => id.isNotEmpty)
          .toSet();
      final membership = (map['friends'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(RailPlayer.fromJson)
          .whereType<RailPlayer>()
          .toList();
      if (mounted) {
        setState(() {
          _friendIds = ids;
          _friendsMembership = membership;
          _friendIdsReady = true;
        });
      }
      return true;
    } catch (_) {
      // Transport blip: do not wipe CTAs or toast if we already have membership.
      if (mounted && !_friendIdsReady) {
        setState(() {
          _friendIdsReady = false;
          _friendIds = {};
        });
        final msg = widget.railChrome.toastFriendFailed.trim();
        if (msg.isNotEmpty) _toast(msg);
      }
      return false;
    }
  }

  Future<void> _addFriend(String friendId) async {
    final c = widget.railChrome;
    final token = context.read<AuthCubit>().state.token;
    if (token == null) return;
    setState(() => _addingFriend = true);
    try {
      final res = await http.post(
        Uri.parse('$_rest/friends/$friendId'),
        headers: _authHeaders(token),
      );
      if (res.statusCode >= 300) {
        if (_responseMentionsAlreadyFriends(res.body)) {
          _toast(c.friendRequestAlreadyFriends);
        } else {
          _toast(c.toastFriendRequestFailed);
        }
        return;
      }
      _toast(c.toastFriendRequestSent);
      await _refreshFriendRequests(token);
      if (_playersSub == 1 && mounted) {
        unawaited(_loadPlayers());
      } else if (mounted) {
        setState(() {});
      }
    } catch (_) {
      _toast(c.toastFriendRequestFailed);
    } finally {
      if (mounted) setState(() => _addingFriend = false);
    }
  }

  Future<void> _acceptFriendRequest(String requestId) async {
    final c = widget.railChrome;
    final token = context.read<AuthCubit>().state.token;
    if (token == null) return;
    setState(() {
      _busyRequestId = requestId;
      _busyRequestOp = 'accept';
    });
    try {
      final res = await http.post(
        Uri.parse('$_rest/friends/requests/$requestId/accept'),
        headers: _authHeaders(token),
      );
      if (res.statusCode >= 300) {
        _toast(c.toastFriendRequestFailed);
        return;
      }
      _toast(c.toastFriendRequestAccepted);
      await _refreshFriendIds(token);
      await _refreshFriendRequests(token);
      if (_playersSub == 0 || _playersSub == 1) {
        unawaited(_loadPlayers());
      }
    } catch (_) {
      _toast(c.toastFriendRequestFailed);
    } finally {
      if (mounted) {
        setState(() {
          _busyRequestId = null;
          _busyRequestOp = null;
        });
      }
    }
  }

  Future<void> _denyFriendRequest(String requestId) async {
    final c = widget.railChrome;
    final token = context.read<AuthCubit>().state.token;
    if (token == null) return;
    setState(() {
      _busyRequestId = requestId;
      _busyRequestOp = 'deny';
    });
    try {
      final res = await http.post(
        Uri.parse('$_rest/friends/requests/$requestId/deny'),
        headers: _authHeaders(token),
      );
      if (res.statusCode >= 300) {
        _toast(c.toastFriendRequestFailed);
        return;
      }
      _toast(c.toastFriendRequestDenied);
      await _refreshFriendRequests(token);
      if (_playersSub == 1) {
        unawaited(_loadPlayers());
      }
    } catch (_) {
      _toast(c.toastFriendRequestFailed);
    } finally {
      if (mounted) {
        setState(() {
          _busyRequestId = null;
          _busyRequestOp = null;
        });
      }
    }
  }

  Future<void> _cancelFriendRequest(String requestId) async {
    final c = widget.railChrome;
    final token = context.read<AuthCubit>().state.token;
    if (token == null) return;
    setState(() {
      _busyRequestId = requestId;
      _busyRequestOp = 'cancel';
    });
    try {
      final res = await http.delete(
        Uri.parse('$_rest/friends/requests/$requestId'),
        headers: _authHeaders(token),
      );
      if (res.statusCode >= 300) {
        _toast(c.toastFriendRequestFailed);
        return;
      }
      _toast(c.toastFriendRequestCancelled);
      await _refreshFriendRequests(token);
      if (_playersSub == 1) {
        unawaited(_loadPlayers());
      } else if (_playersSub == 2 && mounted) {
        setState(() {});
      }
    } catch (_) {
      _toast(c.toastFriendRequestFailed);
    } finally {
      if (mounted) {
        setState(() {
          _busyRequestId = null;
          _busyRequestOp = null;
        });
      }
    }
  }

  Future<void> _removeFriend(String friendId) async {
    final c = widget.railChrome;
    final token = context.read<AuthCubit>().state.token;
    if (token == null) return;
    setState(() => _addingFriend = true);
    try {
      final res = await http.delete(
        Uri.parse('$_rest/friends/$friendId'),
        headers: _authHeaders(token),
      );
      if (res.statusCode >= 300) {
        _toast(c.toastFriendFailed);
        return;
      }
      _toast(c.toastFriendRemoved);
      if (mounted) {
        setState(() {
          _friendIds = {..._friendIds}..remove(friendId);
        });
      }
      unawaited(_loadPlayers());
    } catch (_) {
      _toast(c.toastFriendFailed);
    } finally {
      if (mounted) setState(() => _addingFriend = false);
    }
  }

  void _toast(String message) {
    final text = message.trim();
    if (text.isEmpty || !mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  void _watchGame(String gameId) {
    final token = context.read<AuthCubit>().state.token;
    unawaited(
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => SpectatePage(
            accessToken: token,
            initialGameId: gameId,
          ),
        ),
      ),
    );
  }

  String _historyOutcome(_HistoryRow row, String? myId) {
    final c = widget.railChrome;
    if (row.isDraw) return c.outcomeDraw;
    if (myId == null || myId.isEmpty || row.winnerId == null) {
      return row.mode ?? '';
    }
    return row.winnerId == myId ? c.outcomeWin : c.outcomeLoss;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final c = widget.railChrome;
    final play = widget.playChrome;
    final signedIn = context.watch<AuthCubit>().state.isAuthenticated;

    return LayoutBuilder(
      builder: (context, constraints) {
        // Inside home ListView maxHeight is infinite - expand content and let
        // the page scroll. Wide Row gives a bounded height - use Expanded.
        final expandBody =
            constraints.hasBoundedHeight && constraints.maxHeight.isFinite;

        // When the rail has a bounded height, lists shrink-wrap into one outer
        // scroller. Unbounded: page scroll.
        final listExpand = false;
        // Desktop width only: pin main + sub tabs outside the body scroller.
        // Phone/tablet: whole rail scrolls (tabs + body) - matches web max-lg.
        final isDesktopWidth = MediaQuery.sizeOf(context).width >= 1024;
        final pinChrome = expandBody && isDesktopWidth;

        final Widget body;
        if (widget.tab == 0) {
          body = _buildNewGame(
            context,
            tokens,
            c,
            play,
            signedIn,
            listExpand,
            includeSubTabs: !pinChrome,
          );
        } else if (widget.tab == 1) {
          body = _buildGames(
            context,
            tokens,
            c,
            signedIn,
            listExpand,
            includeSubTabs: !pinChrome,
          );
        } else if (widget.tab == 2) {
          body = _buildPlayers(
            context,
            tokens,
            c,
            signedIn,
            listExpand,
            includeSubTabs: !pinChrome,
          );
        } else {
          body = const SizedBox.shrink();
        }

        final Widget? pinnedSub = !pinChrome
            ? null
            : widget.tab == 0
                ? _newGameSubTabs(context, tokens, c)
                : widget.tab == 1
                    ? _gamesSubTabs(context, tokens, c)
                    : widget.tab == 2
                        ? _playersSubTabs(context, tokens, c)
                        : null;

        final mainTabs = SegmentedButton<int>(
          segments: [
            ButtonSegment(
              value: 0,
              label: Text(c.tabNewGame),
              icon: const Icon(Icons.add, size: 18),
            ),
            ButtonSegment(
              value: 1,
              label: Text(c.tabGames),
              icon: const Icon(Icons.grid_view_outlined, size: 18),
            ),
            ButtonSegment(
              value: 2,
              label: Text(c.tabPlayers),
              icon: const Icon(Icons.people_outline, size: 18),
            ),
          ],
          selected: {widget.tab.clamp(0, 2)},
          onSelectionChanged: (s) => widget.onTab(s.first),
        );

        if (expandBody) {
          return DecoratedBox(
            decoration: BoxDecoration(
              color: tokens.card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: tokens.borderSubtle),
            ),
            child: NotificationListener<ScrollNotification>(
              onNotification: (n) {
                // Outer rail scroll drives infinite load (lists are shrink-wrapped).
                if (n.metrics.axis != Axis.vertical) return false;
                if (n is! ScrollUpdateNotification &&
                    n is! ScrollEndNotification) {
                  return false;
                }
                if (n.depth != 0) return false;
                final near = _railNearBottom(n.metrics);
                // Rising edge only - prevents load-more cascade while parked at bottom.
                if (near && !_railWasNearBottom) {
                  _loadMoreForActiveRailTab();
                }
                _railWasNearBottom = near;
                return false;
              },
              child: pinChrome
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Material(
                          color: tokens.card,
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
                            child: mainTabs,
                          ),
                        ),
                        if (pinnedSub != null)
                          Material(
                            color: tokens.card,
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                              child: pinnedSub,
                            ),
                          ),
                        Expanded(
                          child: SingleChildScrollView(
                            controller: _railScrollController,
                            clipBehavior: Clip.hardEdge,
                            padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                            child: body,
                          ),
                        ),
                      ],
                    )
                  : SingleChildScrollView(
                      controller: _railScrollController,
                      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          mainTabs,
                          const SizedBox(height: 12),
                          body,
                        ],
                      ),
                    ),
            ),
          );
        }

        return DecoratedBox(
          decoration: BoxDecoration(
            color: tokens.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: tokens.borderSubtle),
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                mainTabs,
                const SizedBox(height: 12),
                body,
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _newGameSubTabs(
    BuildContext context,
    DamaColors tokens,
    PlayRailChrome c,
  ) {
    return _subTabRow(
      context: context,
      tokens: tokens,
      tabs: [
        (0, c.subPlayAi, Icons.smart_toy_outlined),
        (1, c.subChallenge, Icons.sports_martial_arts_outlined),
      ],
      selected: _newSub,
      onSelect: (i) => setState(() => _newSub = i),
    );
  }

  Widget _buildNewGame(
    BuildContext context,
    DamaColors tokens,
    PlayRailChrome c,
    PlayChrome play,
    bool signedIn,
    bool expandBody, {
    bool includeSubTabs = true,
  }) {
    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_newSub == 0) ...[
          if (play.lobbyModesBlurb.trim().isNotEmpty)
            Text(
              play.lobbyModesBlurb,
              style: TextStyle(color: tokens.onSurfaceMuted, height: 1.4),
            ),
          const SizedBox(height: 12),
          if (widget.flags.loading)
            Container(
              height: 48,
              decoration: BoxDecoration(
                color: tokens.surfaceMuted,
                borderRadius: BorderRadius.circular(10),
              ),
            )
          else if (!widget.flags.vsAiEnabled)
            Text(
              play.practiceUnavailableShort,
              style: TextStyle(color: tokens.onSurfaceMuted),
            )
          else ...[
            ChromeSelectField(
              label: play.practiceDepthLabel,
              valueLabel: widget.aiDepth == null
                  ? ''
                  : '${play.depthOptionPrefix} ${widget.aiDepth}',
              enabled: widget.flags.aiDepths.isNotEmpty,
              onTap: () async {
                final picked = await showChromeOptionSheet<int>(
                  context: context,
                  title: play.practiceDepthLabel,
                  options: [
                    for (final d in widget.flags.aiDepths)
                      ChromeSelectOption(
                        value: d,
                        label: '${play.depthOptionPrefix} $d',
                      ),
                  ],
                  selected: widget.aiDepth,
                );
                if (picked != null) widget.onDepth(picked);
              },
            ),
            const SizedBox(height: 12),
            // Same Time picker as Challenge / matchmaking (guest practice allowed).
            _timeControlPicker(tokens, c, signedIn, requireAuth: false),
            FilledButton(
              onPressed: widget.aiDepth == null
                  ? null
                  : () {
                      final tc = _effectiveTc;
                      if (tc == null || tc <= 0 || _presets.isEmpty) {
                        _toast(c.toastTimeControlUnavailable);
                        return;
                      }
                      unawaited(widget.onPlayAi(tc));
                    },
              child: Text(play.playComputerAction),
            ),
          ],
          const SizedBox(height: 12),
          _colorsExpansion(tokens, c),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => widget.onPlayMatch(),
            icon: const Icon(Icons.sports_esports_outlined, size: 18),
            label: Text(c.findMatchmakingAction),
          ),
        ] else
          _buildChallengeForm(context, tokens, c, signedIn),
      ],
    );

    return Column(
      mainAxisSize: expandBody ? MainAxisSize.max : MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (includeSubTabs) ...[
          _newGameSubTabs(context, tokens, c),
          const SizedBox(height: 12),
        ],
        if (expandBody)
          Expanded(child: SingleChildScrollView(child: content))
        else
          content,
      ],
    );
  }

  List<MatchClockPreset> get _presets => widget.timeControlPresets;

  int? get _effectiveTc {
    final presets = _presets;
    if (presets.isEmpty) return null;
    final selected = _selectedTcSeconds;
    if (selected != null && presets.any((p) => p.seconds == selected)) {
      return selected;
    }
    final def = widget.clockSeconds;
    if (def != null && presets.any((p) => p.seconds == def)) return def;
    return presets.first.seconds;
  }

  Widget _timeControlPicker(
    DamaColors tokens,
    PlayRailChrome c,
    bool signedIn, {
    bool requireAuth = true,
  }) {
    final presets = _presets;
    if (presets.isEmpty && widget.timeControlsLoading) {
      return const Padding(
        padding: EdgeInsets.only(bottom: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ShimmerBox(
                height: 12,
                width: 64,
                borderRadius: BorderRadius.all(Radius.circular(4))),
            SizedBox(height: 8),
            ShimmerBox(
                height: 48, borderRadius: BorderRadius.all(Radius.circular(8))),
          ],
        ),
      );
    }
    if (presets.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Text(
          c.toastTimeControlUnavailable,
          style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 13),
        ),
      );
    }
    final value = _effectiveTc;
    final valueLabel = _labelForSeconds(value) ?? '';
    final canPick = presets.isNotEmpty && (!requireAuth || signedIn);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: ChromeSelectField(
        label: c.labelTime,
        valueLabel: valueLabel,
        enabled: canPick,
        leading: Icon(Icons.timer_outlined, color: tokens.online, size: 20),
        onTap: () async {
          final picked = await showChromeOptionSheet<int>(
            context: context,
            title: c.labelTime,
            options: [
              for (final p in presets)
                ChromeSelectOption(value: p.seconds, label: p.label),
            ],
            selected: value,
          );
          if (picked != null) setState(() => _selectedTcSeconds = picked);
        },
      ),
    );
  }

  String? _labelForSeconds(int? seconds) {
    if (seconds == null || seconds <= 0) return null;
    for (final p in _presets) {
      if (p.seconds == seconds) return p.label;
    }
    return null;
  }

  void _openMatch(String? gameId, {String? mode}) {
    final id = (gameId ?? '').trim();
    if (id.isEmpty) {
      _toast(widget.railChrome.toastGameUnavailable);
      return;
    }
    final token = context.read<AuthCubit>().state.token;
    if (token == null || token.isEmpty) return;
    final m = (mode ?? '').trim().toLowerCase();
    if (m != 'ai' && m != 'pvp') {
      _toast(widget.railChrome.toastGameUnavailable);
      return;
    }
    unawaited(
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => MatchBoardPage(
            accessToken: token,
            gameId: id,
            mode: m,
          ),
        ),
      ),
    );
  }

  /// Mini Neo man/king previews (light + dark) for a palette row - board parity.
  List<Widget> _palacePalettePreview(PiecePalette p) {
    const preview = <(PalacePieceRole, int)>[
      (PalacePieceRole.servant, 1),
      (PalacePieceRole.king, 1),
      (PalacePieceRole.servant, 2),
      (PalacePieceRole.king, 2),
    ];
    return [
      for (var i = 0; i < preview.length; i++) ...[
        if (i > 0) const SizedBox(width: 3),
        SizedBox(
          width: 14,
          height: 16,
          child: PalacePieceMark(
            role: preview[i].$1,
            pieceLight: p.pieceLight,
            pieceDark: p.pieceDark,
            player: preview[i].$2,
            darkSplit: p.darkSplit,
          ),
        ),
      ],
    ];
  }

  Widget _colorsExpansion(DamaColors tokens, PlayRailChrome c) {
    return ExpansionTile(
      tilePadding: EdgeInsets.zero,
      childrenPadding: const EdgeInsets.only(bottom: 4),
      leading: Icon(Icons.palette_outlined, color: tokens.gold, size: 20),
      title: Text(c.labelColors),
      subtitle: Text(
        '${boardPaletteById(widget.boardPaletteId).label} · ${piecePaletteById(widget.piecePaletteId).label}',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
      ),
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: Text(
            c.labelBoard,
            style: TextStyle(
              color: tokens.onSurfaceMuted,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final p in kBoardPalettes)
              GestureDetector(
                onTap: () => widget.onBoardPalette(p.id),
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: widget.boardPaletteId == p.id
                          ? tokens.gold
                          : tokens.borderSubtle,
                      width: widget.boardPaletteId == p.id ? 2 : 1,
                    ),
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [p.boardLight, p.boardDark],
                      stops: const [0.5, 0.5],
                    ),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerLeft,
          child: Text(
            c.labelPieces,
            style: TextStyle(
              color: tokens.onSurfaceMuted,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final p in kPiecePalettes)
              GestureDetector(
                onTap: () => widget.onPiecePalette(p.id),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: widget.piecePaletteId == p.id
                          ? tokens.gold
                          : tokens.borderSubtle,
                      width: widget.piecePaletteId == p.id ? 2 : 1,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ..._palacePalettePreview(p),
                      const SizedBox(width: 6),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(p.label, style: const TextStyle(fontSize: 12)),
                          Text(
                            '${p.lightName} · ${p.darkName} · Man · King',
                            style: TextStyle(
                              fontSize: 10,
                              color: tokens.onSurfaceMuted,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }

  Widget _buildChallengeForm(
    BuildContext context,
    DamaColors tokens,
    PlayRailChrome c,
    bool signedIn,
  ) {
    final opponent = _challengeOpponent;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          c.createGameTitle,
          textAlign: TextAlign.center,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 10),
        Text(c.labelOpponent,
            style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12)),
        const SizedBox(height: 6),
        if (opponent == null)
          _opponentTypeahead(tokens, c, signedIn)
        else
          _opponentChip(tokens, c, opponent),
        const SizedBox(height: 12),
        _timeControlPicker(tokens, c, signedIn),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(c.labelRated),
          value: _rated,
          activeTrackColor: tokens.brand,
          thumbColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) return tokens.onBrand;
            return null;
          }),
          onChanged: signedIn ? (v) => setState(() => _rated = v) : null,
        ),
        Row(
          children: [
            Expanded(child: Text(c.labelIPlayAs)),
            _colorChoiceButton('white', tokens, c.ariaColorWhite),
            _colorChoiceButton('random', tokens, c.ariaColorRandom),
            _colorChoiceButton('black', tokens, c.ariaColorBlack),
          ],
        ),
        const SizedBox(height: 4),
        Text(c.colorPrefNote,
            style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 11)),
        const SizedBox(height: 12),
        if (!signedIn)
          OutlinedButton(
            onPressed: () {
              unawaited(showSignInDialog(context));
            },
            child: Text(c.signInToChallenge),
          )
        else ...[
          FilledButton.icon(
            onPressed: _sendingChallenge || _presets.isEmpty
                ? null
                : () => _sendChallenge(openLink: false),
            icon: const Icon(Icons.sports_martial_arts_outlined, size: 18),
            label: Text(
                _sendingChallenge ? c.sendingChallenge : c.sendChallengeAction),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _sendingChallenge || _presets.isEmpty
                ? null
                : () => _copyChallengeLink(),
            icon: Icon(
              _copiedLink ? Icons.check : Icons.link,
              size: 18,
              color: _copiedLink ? tokens.online : null,
            ),
            label: Text(
              _sendingChallenge
                  ? c.sendingChallenge
                  : (_copiedLink ? c.copiedAction : c.challengeLinkAction),
            ),
          ),
        ],
      ],
    );
  }

  Widget _colorChoiceButton(String id, DamaColors tokens, String aria) {
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

  Widget _opponentTypeahead(
    DamaColors tokens,
    PlayRailChrome c,
    bool signedIn,
  ) {
    final q = _opponentSearch.trim();
    final showResults =
        signedIn && q.isNotEmpty && _opponentSearchResults.isNotEmpty;
    final showShimmer =
        signedIn && q.isNotEmpty && _opponentSearchLoading && !showResults;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _opponentQueryCtrl,
          enabled: signedIn,
          decoration: InputDecoration(
            hintText: c.searchOpponentPlaceholder,
            prefixIcon: const Icon(Icons.search, size: 20),
            border: const OutlineInputBorder(),
            errorText: _challengeAttempted &&
                    (_challengeOpponent?.username ?? _opponentQueryCtrl.text)
                        .trim()
                        .isEmpty
                ? c.toastEnterUsername
                : null,
          ),
          onTapOutside: (_) {},
          onChanged: (v) {
            _onOpponentQueryChanged(v);
            if (_challengeAttempted && v.trim().isNotEmpty) {
              setState(() => _challengeAttempted = false);
            }
          },
          onSubmitted: (_) => _sendChallenge(openLink: false),
        ),
        if (showShimmer) ...[
          const SizedBox(height: 6),
          SizedBox(
            height: 132,
            child: const PlayRailListSkeleton(
              rows: 3,
              variant: PlayRailListVariant.player,
            ),
          ),
        ] else if (showResults) ...[
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
                itemCount: _opponentSearchResults.length,
                separatorBuilder: (_, __) =>
                    Divider(height: 1, color: tokens.borderSubtle),
                itemBuilder: (context, i) {
                  final p = _opponentSearchResults[i];
                  return _typeaheadPlayerTile(
                    tokens,
                    c,
                    p,
                    onTap: () => _pickOpponentFromSearch(p),
                  );
                },
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _opponentChip(
    DamaColors tokens,
    PlayRailChrome c,
    RailChallengeOpponent opponent,
  ) {
    final statusColor = opponent.playing
        ? tokens.playing
        : opponent.online
            ? tokens.online
            : tokens.offline;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        border: Border.all(color: tokens.borderSubtle),
        borderRadius: BorderRadius.circular(8),
        color: tokens.surfaceMuted,
      ),
      child: Row(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              DamaUserAvatar(
                imageUrl: opponent.avatarThumbUrl,
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
                    border: Border.all(color: tokens.surfaceMuted, width: 2),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        opponent.username,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                    if (opponent.rating != null)
                      Text(
                        '${c.ratingParenOpen}${opponent.rating}${c.ratingParenClose}',
                        style: TextStyle(
                          color: tokens.onSurfaceMuted,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    const SizedBox(width: 6),
                    CountryFlag(
                      code: opponent.countryCode,
                      imageUrlTemplate: c.countryFlagImageUrlTemplate,
                    ),
                  ],
                ),
                HostTrustBadge(
                  label: opponent.hostTrustBadge,
                  tier: opponent.hostTrustTier,
                  fontSize: 10,
                  dense: true,
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close, size: 18),
            onPressed: () => setState(() {
              _challengeOpponent = null;
              _clearOpponentSearch();
            }),
          ),
        ],
      ),
    );
  }

  Widget _gamesSubTabs(
    BuildContext context,
    DamaColors tokens,
    PlayRailChrome c,
  ) {
    return _subTabRow(
      context: context,
      tokens: tokens,
      tabs: [
        (0, c.subWatch, Icons.visibility_outlined),
        (1, c.subHistory, Icons.history),
      ],
      selected: _gamesSub,
      onSelect: (i) {
        _railWasNearBottom = false;
        setState(() {
          _gamesSub = i;
          if (i != 0) _liveViewersGameId = null;
          _playerSearchCtrl.clear();
          _playerSearch = '';
        });
        if (i == 0) {
          _loadLiveGames();
        } else {
          _loadHistory();
        }
      },
    );
  }

  Widget _buildGames(
    BuildContext context,
    DamaColors tokens,
    PlayRailChrome c,
    bool signedIn,
    bool expandBody, {
    bool includeSubTabs = true,
  }) {
    final myId = context.watch<AuthCubit>().state.userId;
    if (_gamesSub == 0 && _liveViewersGameId != null) {
      final viewersPanel = _liveViewersInRail(tokens, c, signedIn, expandBody);
      return Column(
        mainAxisSize: expandBody ? MainAxisSize.max : MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (expandBody) Expanded(child: viewersPanel) else viewersPanel,
        ],
      );
    }
    final list = _gamesSub == 0
        ? _liveGamesBody(tokens, c, expandBody)
        : _historyBody(tokens, c, signedIn, myId, expandBody);
    final searchHint = _gamesSub == 0
        ? c.searchUsernamePlaceholder
        : (c.searchOpponentPlaceholder.isNotEmpty
            ? c.searchOpponentPlaceholder
            : c.searchUsernamePlaceholder);
    return Column(
      mainAxisSize: expandBody ? MainAxisSize.max : MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (includeSubTabs) ...[
          _gamesSubTabs(context, tokens, c),
          const SizedBox(height: 8),
        ],
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _playerSearchCtrl,
                enabled: _gamesSub == 0 || signedIn,
                decoration: InputDecoration(
                  isDense: true,
                  hintText: searchHint,
                  prefixIcon: const Icon(Icons.search, size: 18),
                  border: const OutlineInputBorder(),
                ),
                onTapOutside: (_) {},
                onChanged: _onGamesSearchChanged,
              ),
              ..._playerSearchTypeaheadPanel(tokens, c),
            ],
          ),
        ),
        if (expandBody) Expanded(child: list) else list,
      ],
    );
  }

  Widget _liveGamesBody(DamaColors tokens, PlayRailChrome c, bool expandBody) {
    if (_liveLoading) {
      return const PlayRailListSkeleton(
        rows: 7,
        variant: PlayRailListVariant.game,
      );
    }
    if (_liveGames.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Text(c.emptyLiveGames,
            style: TextStyle(color: tokens.onSurfaceMuted)),
      );
    }
    final showFooter = _liveLoadingMore || _liveHasMore;
    // Load-more is driven only by the outer rail rising-edge listener
    // (nested near-bottom handlers cascaded pages while parked at the end).
    return ListView.separated(
      shrinkWrap: !expandBody,
      physics: expandBody ? null : const NeverScrollableScrollPhysics(),
      itemCount: _liveGames.length + (showFooter ? 1 : 0),
      separatorBuilder: (_, __) =>
          Divider(height: 1, color: tokens.borderSubtle),
      itemBuilder: (context, i) {
        if (i >= _liveGames.length) {
          return _infiniteListFooter(tokens, c, loading: _liveLoadingMore);
        }
        final g = _liveGames[i];
        final tc = _labelForSeconds(g.timeControlSeconds);
        final truncN = int.tryParse(c.idTruncateChars.trim()) ?? 0;
        final shortId = truncN > 0 && g.id.length > truncN
            ? '${g.id.substring(0, truncN)}${c.idTruncateSuffix}'
            : g.id;
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _avatarStack(
                context,
                tokens,
                c,
                g.seats,
                max: 2,
                size: 36,
                overflowPrefix: c.viewersOverflowPrefix,
                roundedFace: true,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Order: players → viewers → game id (parity with web GamesPanel).
                    // Watch sheet opens from player names only - not the whole row / TC.
                    Text(
                      c.labelPlayers.toUpperCase(),
                      style: TextStyle(
                        color: tokens.onSurfaceMuted,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.4,
                      ),
                    ),
                    InkWell(
                      onTap: () => _openLiveGameSheet(context, tokens, c, g),
                      child: _livePlayersNameLine(
                        tokens,
                        c,
                        g.seats,
                        g.p1Name,
                        g.p2Name,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Text(
                          c.labelViewers.toUpperCase(),
                          style: TextStyle(
                            color: tokens.onSurfaceMuted,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(width: 6),
                        if (g.spectatorCount > 0)
                          _avatarStack(
                            context,
                            tokens,
                            c,
                            g.viewers,
                            max: 3,
                            size: 22,
                            totalCount: g.spectatorCount,
                            overflowPrefix: c.viewersOverflowPrefix,
                            enableBio: false,
                            onStackTap: () => _openLiveViewersInRail(g.id),
                          )
                        else
                          Text(
                            c.viewersEmptyCount,
                            style: TextStyle(
                              color: tokens.onSurfaceMuted,
                              fontSize: 12,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${c.labelGameId} $shortId',
                      style: TextStyle(
                        color: tokens.onSurfaceMuted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.bolt, size: 16, color: tokens.playing),
                  if (tc != null || g.moveCount != null) ...[
                    const SizedBox(width: 4),
                    Text(
                      tc ?? '${g.moveCount} ${c.movesSuffix}',
                      style: TextStyle(
                        color: tokens.onSurfaceMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _livePlayersNameLine(
    DamaColors tokens,
    PlayRailChrome c,
    List<_LiveSeat> seats,
    String p1Name,
    String p2Name,
  ) {
    if (seats.isEmpty) {
      return Text(
        '${_formatPlayerNameDisplay(p1Name, c)} ${c.vsSeparator} ${_formatPlayerNameDisplay(p2Name, c)}',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
      );
    }
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        for (var i = 0; i < seats.length; i++) ...[
          if (i > 0)
            Text(
              ' ${c.vsSeparator} ',
              style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 14),
            ),
          Text(
            _formatPlayerNameDisplay(seats[i].username, c),
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
          ),
          if (seats[i].rating != null) ...[
            const SizedBox(width: 4),
            Text(
              '${c.ratingParenOpen}${seats[i].rating}${c.ratingParenClose}',
              style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
            ),
          ],
          const SizedBox(width: 4),
          CountryFlag(
            code: seats[i].countryCode,
            imageUrlTemplate: c.countryFlagImageUrlTemplate,
          ),
          const SizedBox(width: 4),
          HostTrustBadge(
            label: seats[i].hostTrustBadge,
            tier: seats[i].hostTrustTier,
            fontSize: 10,
            dense: true,
          ),
        ],
      ],
    );
  }

  void _showSeatBio(
    BuildContext context,
    DamaColors tokens,
    PlayRailChrome c,
    _LiveSeat seat,
  ) {
    // Same card as All Players (avatar placement + friend/challenge/message).
    final signedIn =
        (context.read<AuthCubit>().state.token ?? '').trim().isNotEmpty;
    final rating = seat.rating;
    if (rating == null) return;
    final rail = RailPlayer(
      id: seat.id,
      username: seat.username,
      rating: rating,
      wins: seat.wins,
      losses: seat.losses,
      avatarThumbUrl: seat.avatarThumbUrl,
      playing: true,
      countryCode: seat.countryCode,
      hostTrustTier: seat.hostTrustTier,
      hostTrustBadge: seat.hostTrustBadge,
    );
    unawaited(_showPlayerCard(tokens, c, rail, signedIn));
  }

  Widget _avatarStack(
    BuildContext context,
    DamaColors tokens,
    PlayRailChrome c,
    List<_LiveSeat> people, {
    required int max,
    required double size,
    int? totalCount,
    required String overflowPrefix,

    /// List-row faces open bio; Watch sheet faces are display-only (web parity).
    bool enableBio = true,

    /// Watch seats: rounded-square like All Players / web `faceShape="rounded"`.
    bool roundedFace = false,
    VoidCallback? onStackTap,
  }) {
    final visible = people.take(max).toList();
    final total = totalCount ?? people.length;
    final overflow = total - visible.length;
    // Half-diameter step matches web AvatarStack (~50% overlap).
    final step = size * 0.5;
    final radius = roundedFace ? BorderRadius.circular(8) : null;
    final stack = SizedBox(
      height: size,
      width: size +
          (visible.length + (overflow > 0 ? 1 : 0) - 1).clamp(0, 8) * step,
      child: Stack(
        clipBehavior: Clip.none,
        // Paint faces first; overflow chip last so +N stays visible (web parity).
        children: [
          for (var i = visible.length - 1; i >= 0; i--)
            Positioned(
              left: i * step,
              child: GestureDetector(
                onTap: enableBio
                    ? () => _showSeatBio(context, tokens, c, visible[i])
                    : null,
                child: Container(
                  width: size,
                  height: size,
                  decoration: BoxDecoration(
                    shape: roundedFace ? BoxShape.rectangle : BoxShape.circle,
                    borderRadius: radius,
                    border: Border.all(color: tokens.card, width: 2),
                    color: tokens.surfaceMuted,
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: DamaUserAvatar(
                    imageUrl: visible[i].avatarThumbUrl,
                    radius: size / 2,
                    showMarkPlate: false,
                  ),
                ),
              ),
            ),
          if (overflow > 0)
            Positioned(
              left: visible.length * step,
              child: Container(
                width: size,
                height: size,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: roundedFace ? BoxShape.rectangle : BoxShape.circle,
                  borderRadius: radius,
                  color: tokens.brand,
                  border: Border.all(color: tokens.card, width: 2),
                ),
                child: Text(
                  '$overflowPrefix$overflow',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: size * 0.32,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
    if (onStackTap == null) return stack;
    return GestureDetector(
      onTap: onStackTap,
      behavior: HitTestBehavior.opaque,
      child: stack,
    );
  }

  Widget _liveViewersInRail(
    DamaColors tokens,
    PlayRailChrome c,
    bool signedIn,
    bool expandBody,
  ) {
    final list = _liveViewersBody(tokens, c, signedIn, expandBody);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: expandBody ? MainAxisSize.max : MainAxisSize.min,
      children: [
        Row(
          children: [
            IconButton(
              tooltip: c.backToLiveGames,
              onPressed: _closeLiveViewersInRail,
              icon: const Icon(Icons.arrow_back),
            ),
            Expanded(
              child: Text(
                c.liveViewersTitle,
                style:
                    const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
              ),
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: TextField(
            controller: _liveViewerSearchCtrl,
            decoration: InputDecoration(
              isDense: true,
              hintText: c.searchUsernamePlaceholder,
              prefixIcon: const Icon(Icons.search, size: 18),
              border: const OutlineInputBorder(),
            ),
            // Keep first tap on filtered viewer rows from only dismissing keyboard.
            onTapOutside: (_) {},
            onChanged: _onLiveViewerSearchChanged,
          ),
        ),
        if (expandBody) Expanded(child: list) else list,
      ],
    );
  }

  Widget _liveViewersBody(
    DamaColors tokens,
    PlayRailChrome c,
    bool signedIn,
    bool expandBody,
  ) {
    if (_liveSpectatorsLoading) {
      return Semantics(
        label: c.loadingLiveViewers,
        child: const PlayRailListSkeleton(
          rows: 7,
          variant: PlayRailListVariant.player,
        ),
      );
    }
    final visible = _liveSpectatorsFiltered();
    if (visible.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Text(
          c.emptyLiveViewers,
          style: TextStyle(color: tokens.onSurfaceMuted),
        ),
      );
    }
    final showFooter = _liveSpectatorsLoadingMore || _liveSpectatorsHasMore;
    return ListView.separated(
      shrinkWrap: !expandBody,
      physics: expandBody ? null : const NeverScrollableScrollPhysics(),
      itemCount: visible.length + (showFooter ? 1 : 0),
      separatorBuilder: (_, __) =>
          Divider(height: 1, color: tokens.borderSubtle),
      itemBuilder: (context, i) {
        if (i >= visible.length) {
          return _infiniteListFooter(tokens, c,
              loading: _liveSpectatorsLoadingMore);
        }
        return _playerRow(tokens, c, visible[i], signedIn);
      },
    );
  }

  Future<void> _openLiveGameSheet(
    BuildContext context,
    DamaColors tokens,
    PlayRailChrome c,
    _LiveGameRow g,
  ) async {
    final qrUrl = '$_rest/games/${Uri.encodeComponent(g.id)}/qr.png';
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: tokens.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        var qrReady = false;
        var qrFailed = false;
        var qrDownloading = false;
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
            child: StatefulBuilder(
              builder: (ctx, setSheet) {
                if (!qrReady && !qrFailed) {
                  return Stack(
                    children: [
                      const LiveGameWatchSkeleton(),
                      Opacity(
                        opacity: 0,
                        child: Image.network(
                          qrUrl,
                          width: 1,
                          height: 1,
                          loadingBuilder: (context, child, progress) {
                            if (progress == null && !qrReady) {
                              WidgetsBinding.instance.addPostFrameCallback((_) {
                                if (ctx.mounted) setSheet(() => qrReady = true);
                              });
                            }
                            return child;
                          },
                          errorBuilder: (_, __, ___) {
                            WidgetsBinding.instance.addPostFrameCallback((_) {
                              if (ctx.mounted) setSheet(() => qrFailed = true);
                            });
                            return const SizedBox.shrink();
                          },
                        ),
                      ),
                    ],
                  );
                }
                // Web LiveGameWatchPopover parity: title + QR + Join + Download only.
                return Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      c.liveGamePopoverTitle,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 16),
                    ),
                    const SizedBox(height: 14),
                    if (qrFailed)
                      Text(c.qrUnavailable,
                          style: TextStyle(color: tokens.danger))
                    else
                      Semantics(
                        label: c.qrPreviewAria,
                        button: true,
                        child: GestureDetector(
                          onTap: () async {
                            try {
                              final res = await http.get(Uri.parse(qrUrl));
                              if (res.statusCode != 200) throw Exception('qr');
                              if (!ctx.mounted) return;
                              await showDialog<void>(
                                context: ctx,
                                builder: (dCtx) => AlertDialog(
                                  backgroundColor: tokens.card,
                                  title: Text(c.qrPreviewAria),
                                  content: Image.memory(
                                    res.bodyBytes,
                                    width: 240,
                                    height: 240,
                                  ),
                                  actions: [
                                    TextButton(
                                      onPressed: () => Navigator.of(dCtx).pop(),
                                      child: Text(c.qrLightboxCloseAria),
                                    ),
                                  ],
                                ),
                              );
                            } catch (_) {
                              if (!ctx.mounted) return;
                              ScaffoldMessenger.of(ctx).showSnackBar(
                                SnackBar(content: Text(c.qrUnavailable)),
                              );
                            }
                          },
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.network(
                              qrUrl,
                              width: 160,
                              height: 160,
                              fit: BoxFit.contain,
                              errorBuilder: (_, __, ___) => Padding(
                                padding: const EdgeInsets.all(24),
                                child: Text(
                                  c.qrUnavailable,
                                  style: TextStyle(color: tokens.danger),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: () {
                              Navigator.of(ctx).pop();
                              _watchGame(g.id);
                            },
                            icon:
                                const Icon(Icons.visibility_outlined, size: 18),
                            label: Text(c.joinGameAction),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: qrFailed || qrDownloading
                                ? null
                                : () async {
                                    setSheet(() => qrDownloading = true);
                                    try {
                                      final res =
                                          await http.get(Uri.parse(qrUrl));
                                      if (res.statusCode != 200)
                                        throw Exception('qr');
                                      if (!ctx.mounted) return;
                                      final cd =
                                          res.headers['content-disposition'] ??
                                              '';
                                      final match = RegExp(
                                        r'filename="?([^";]+)"?',
                                        caseSensitive: false,
                                      ).firstMatch(cd);
                                      final filename =
                                          (match?.group(1) ?? '').trim();
                                      if (filename.isEmpty) {
                                        throw Exception('qr filename');
                                      }
                                      await shareBytesAsFile(
                                        bytes: res.bodyBytes,
                                        filename: filename,
                                        mimeType: 'image/png',
                                      );
                                    } catch (_) {
                                      if (!ctx.mounted) return;
                                      ScaffoldMessenger.of(ctx).showSnackBar(
                                        SnackBar(
                                          content:
                                              Text(c.toastQrDownloadFailed),
                                        ),
                                      );
                                    } finally {
                                      if (ctx.mounted) {
                                        setSheet(() => qrDownloading = false);
                                      }
                                    }
                                  },
                            icon: qrDownloading
                                ? SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: tokens.brand,
                                    ),
                                  )
                                : const Icon(Icons.qr_code_2, size: 18),
                            label: Text(
                              qrDownloading
                                  ? c.downloadQrPending
                                  : c.downloadQrAction,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                );
              },
            ),
          ),
        );
      },
    );
  }

  Widget _historyBody(
    DamaColors tokens,
    PlayRailChrome c,
    bool signedIn,
    String? myId,
    bool expandBody,
  ) {
    if (!signedIn) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Text(c.signInHistory,
            style: TextStyle(color: tokens.onSurfaceMuted)),
      );
    }
    if (_historyLoading) {
      return const PlayRailListSkeleton(
        rows: 7,
        variant: PlayRailListVariant.game,
      );
    }
    if (_history.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Text(c.emptyHistory,
            style: TextStyle(color: tokens.onSurfaceMuted)),
      );
    }
    final showFooter = _historyLoadingMore || _historyHasMore;
    return ListView.separated(
      shrinkWrap: !expandBody,
      physics: expandBody ? null : const NeverScrollableScrollPhysics(),
      itemCount: _history.length + (showFooter ? 1 : 0),
      separatorBuilder: (_, __) =>
          Divider(height: 1, color: tokens.borderSubtle),
      itemBuilder: (context, i) {
        if (i >= _history.length) {
          return _infiniteListFooter(tokens, c, loading: _historyLoadingMore);
        }
        final row = _history[i];
        final modeKey = (row.mode ?? '').trim().toLowerCase();
        final modeLabel = modeKey == 'ai'
            ? c.modeAi
            : modeKey == 'pvp'
                ? c.modePvp
                : '';
        final meta = [
          if (modeLabel.isNotEmpty) modeLabel,
          if (row.moveCount != null) '${row.moveCount} ${c.movesSuffix}',
        ].join(c.metaSeparator);
        return Semantics(
          label: c.resumeGameAction,
          button: true,
          child: ListTile(
            dense: true,
            title: Text(meta,
                style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 13)),
            trailing: Text(
              _historyOutcome(row, myId),
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            onTap: () => _openMatch(row.gameId, mode: row.mode),
          ),
        );
      },
    );
  }

  Widget _playersSubTabs(
    BuildContext context,
    DamaColors tokens,
    PlayRailChrome c,
  ) {
    return _subTabRow(
      context: context,
      tokens: tokens,
      tabs: [
        (0, c.subFriends, Icons.group_outlined),
        (1, c.subFriendRequests, Icons.mail_outline),
        (3, c.subDms, Icons.chat_bubble_outline),
        (2, c.subAllPlayers, Icons.person_search_outlined),
      ],
      badges: {
        1: _friendRequests
            .where((e) => e.incoming && e.status == 'pending')
            .length,
        3: _dmUnreadTotal > 0 ? _dmUnreadTotal : _dmPendingIncoming,
      },
      badgeAriaFmts: {
        1: c.friendRequestsCountAria,
        3: _dmUnreadTotal > 0 ? c.dmsUnreadCountAria : c.dmsRequestsCountAria,
      },
      selected: _playersSub,
      onSelect: (i) {
        _railWasNearBottom = false;
        setState(() => _playersSub = i);
        if (i == 3) {
          unawaited(_loadDmRequests());
        } else {
          _loadPlayers();
        }
      },
    );
  }

  Widget _buildPlayers(
    BuildContext context,
    DamaColors tokens,
    PlayRailChrome c,
    bool signedIn,
    bool expandBody, {
    bool includeSubTabs = true,
  }) {
    final list = _playersBody(tokens, c, signedIn, expandBody);
    return Column(
      mainAxisSize: expandBody ? MainAxisSize.max : MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (includeSubTabs) _playersSubTabs(context, tokens, c),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _playerSearchCtrl,
                      decoration: InputDecoration(
                        isDense: true,
                        hintText: c.searchUsernamePlaceholder,
                        prefixIcon: const Icon(Icons.search, size: 18),
                        border: const OutlineInputBorder(),
                      ),
                      // Keep focus so the first suggestion tap activates (default
                      // onTapOutside would only dismiss the keyboard).
                      onTapOutside: (_) {},
                      onChanged: _onPlayerSearchChanged,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    c.labelRating,
                    style:
                        TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
                  ),
                ],
              ),
              ..._playerSearchTypeaheadPanel(tokens, c),
            ],
          ),
        ),
        if (expandBody) Expanded(child: list) else list,
      ],
    );
  }

  Widget _playersBody(
    DamaColors tokens,
    PlayRailChrome c,
    bool signedIn,
    bool expandBody,
  ) {
    if ((_playersSub == 0 || _playersSub == 1 || _playersSub == 3) &&
        !signedIn) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Text(c.signInFriends,
            style: TextStyle(color: tokens.onSurfaceMuted)),
      );
    }
    if (_playersSub == 1) {
      return _friendRequestsBody(tokens, c, expandBody);
    }
    if (_playersSub == 3) {
      return _dmRequestsBody(tokens, c, expandBody);
    }
    if (_playersLoading) {
      return const PlayRailListSkeleton(
        rows: 8,
        variant: PlayRailListVariant.player,
      );
    }
    // Server already filtered by q for friends + all players.
    final visible = _players;
    if (visible.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Text(
          _playersSub == 0 ? c.emptyFriends : c.emptyPlayers,
          style: TextStyle(color: tokens.onSurfaceMuted),
          textAlign: TextAlign.center,
        ),
      );
    }
    final pageList = _playersSub == 0 || _playersSub == 2;
    final showFooter = pageList && (_playersLoadingMore || _playersHasMore);
    return ListView.separated(
      shrinkWrap: !expandBody,
      physics: expandBody ? null : const NeverScrollableScrollPhysics(),
      itemCount: visible.length + (showFooter ? 1 : 0),
      separatorBuilder: (_, __) =>
          Divider(height: 1, color: tokens.borderSubtle),
      itemBuilder: (context, i) {
        if (i >= visible.length) {
          return _infiniteListFooter(tokens, c, loading: _playersLoadingMore);
        }
        final p = visible[i];
        return _playerRow(tokens, c, p, signedIn);
      },
    );
  }

  Future<void> _refreshDmBadge() async {
    final auth = context.read<AuthCubit>().state;
    final token = auth.token?.trim() ?? '';
    if (token.isEmpty) return;
    final payload = await fetchDmRequests(token);
    if (!mounted || payload == null) return;
    final membership = <RailPlayer>[];
    final seen = <String>{};
    for (final r in [...payload.incoming, ...payload.outgoing]) {
      final p = r.player;
      if (p == null || seen.contains(p.id)) continue;
      seen.add(p.id);
      membership.add(p);
    }
    setState(() {
      _dmPendingIncoming = payload.pendingIncoming;
      _dmUnreadTotal = payload.unreadTotal;
      _dmMembership = membership;
      _dmMembershipRows = [...payload.incoming, ...payload.outgoing];
      // Soft-merge unread/preview onto the open DMs list (Telegram live badge).
      if (_playersSub == 3 && _dmRequests.isNotEmpty) {
        final byId = <String, DmRequestRow>{
          for (final r in [...payload.incoming, ...payload.outgoing]) r.id: r,
        };
        _dmRequests = [
          for (final r in _dmRequests)
            if (byId[r.id] case final next?)
              DmRequestRow(
                id: r.id,
                status: next.status,
                side: next.side,
                preview: next.preview,
                threadId: next.threadId,
                unreadCount: next.unreadCount,
                player: next.player ?? r.player,
              )
            else
              r,
        ];
      }
    });
  }

  String _formatDmUnreadBadge(PlayRailChrome c, int count) {
    if (count <= 0) return '';
    final max = int.tryParse(c.dmUnreadBadgeMax.trim()) ?? 0;
    final fmt = c.dmUnreadBadgeOverflowFmt.trim();
    if (max <= 0 || count <= max || !fmt.contains('{max}')) {
      return '$count';
    }
    return fmt.replaceAll('{max}', '$max');
  }

  Future<void> _loadDmRequests({bool reset = true}) async {
    final auth = context.read<AuthCubit>().state;
    final token = auth.token?.trim() ?? '';
    if (token.isEmpty) return;
    final pageSize = _listPageSize();
    if (pageSize <= 0) {
      if (mounted) {
        setState(() {
          _dmRequests = const [];
          _dmHasMore = false;
          _dmNextSkip = 0;
        });
      }
      return;
    }
    if (reset) {
      if (_dmLoading) return;
      setState(() {
        _dmLoading = true;
        _dmNextSkip = 0;
        _dmHasMore = false;
        _dmRequests = const [];
      });
    } else {
      if (_dmLoading || _dmLoadingMore || !_dmHasMore) return;
      setState(() => _dmLoadingMore = true);
    }
    try {
      final skip = reset ? 0 : _dmNextSkip;
      final page = await fetchDmRequestsPage(
        token,
        skip: skip,
        limit: pageSize,
        q: _playerSearch.trim(),
      );
      if (!mounted) return;
      if (page == null) {
        if (reset) {
          setState(() {
            _dmRequests = const [];
            _dmHasMore = false;
            _dmNextSkip = 0;
          });
        }
        return;
      }
      setState(() {
        if (reset) {
          _dmRequests = page.requests;
        } else {
          final seen = {for (final r in _dmRequests) r.id};
          _dmRequests = [
            ..._dmRequests,
            ...page.requests.where((r) => !seen.contains(r.id)),
          ];
        }
        // Keep typeahead open-thread lookup warm even before badge refresh returns.
        final memSeen = {for (final r in _dmMembershipRows) r.id};
        final mergedRows = [
          ..._dmMembershipRows,
          ...page.requests.where((r) => !memSeen.contains(r.id)),
        ];
        _dmMembershipRows = mergedRows;
        final players = <RailPlayer>[];
        final playerSeen = <String>{};
        for (final r in mergedRows) {
          final p = r.player;
          if (p == null || playerSeen.contains(p.id)) continue;
          playerSeen.add(p.id);
          players.add(p);
        }
        if (players.isNotEmpty) _dmMembership = players;
        _dmPendingIncoming = page.pendingIncoming;
        _dmUnreadTotal = page.unreadTotal;
        _dmNextSkip = page.nextSkip;
        _dmHasMore = page.hasMore;
      });
      if (_dmHasMore && page.requests.isNotEmpty) _maybeFillActiveList();
      if (reset) _tryOpenDmDeepLink(token);
    } finally {
      if (mounted) {
        setState(() {
          _dmLoading = false;
          _dmLoadingMore = false;
        });
      }
    }
  }

  void _tryOpenDmDeepLink(String token) {
    if (_dmDeepLinkOpened || !mounted) return;
    final dmId = (_pendingDmRequestId ?? '').trim();
    final threadId = (_pendingDmThreadId ?? '').trim();
    if (dmId.isEmpty && threadId.isEmpty) return;
    DmRequestRow? row;
    if (dmId.isNotEmpty) {
      for (final r in _dmRequests) {
        if (r.id == dmId) {
          row = r;
          break;
        }
      }
    } else {
      for (final r in _dmRequests) {
        if ((r.threadId ?? '') == threadId) {
          row = r;
          break;
        }
      }
    }
    void open(DmRequestRow? r, String tid) {
      if (tid.isEmpty) return;
      _dmDeepLinkOpened = true;
      _pendingDmRequestId = null;
      _pendingDmThreadId = null;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        unawaited(
          showDmThreadSheet(
            context,
            chrome: widget.railChrome,
            accessToken: token,
            threadId: tid,
            peerName: r?.player?.username ?? '',
            canCompose: r == null || r.status == 'accepted',
            requestId: r?.id,
            requestSide: r?.side,
            requestStatus: r?.status,
          ),
        );
      });
    }

    final tid = (row?.threadId ?? threadId).trim();
    if (tid.isNotEmpty && row != null) {
      open(row, tid);
      return;
    }
    // GET /dms/requests/{id} when list page missed the row.
    if (dmId.isNotEmpty) {
      final myId = context.read<AuthCubit>().state.userId ?? '';
      unawaited(() async {
        final got = await fetchDmRequestById(token, dmId, myUserId: myId);
        if (!mounted) return;
        final t = (got?.threadId ?? '').trim();
        if (got == null || t.isEmpty) {
          _dmDeepLinkOpened = true;
          _pendingDmRequestId = null;
          _pendingDmThreadId = null;
          _toast(widget.railChrome.dmOpenFailed);
          return;
        }
        open(got, t);
      }());
      return;
    }
    // thread= without a list row: probe membership before opening.
    if (tid.isEmpty) return;
    unawaited(() async {
      final ok = await probeDmThreadAccess(token, tid);
      if (!mounted) return;
      if (!ok) {
        _dmDeepLinkOpened = true;
        _pendingDmRequestId = null;
        _pendingDmThreadId = null;
        _toast(widget.railChrome.dmOpenFailed);
        return;
      }
      open(null, tid);
    }());
  }

  Widget _dmRequestsBody(
    DamaColors tokens,
    PlayRailChrome c,
    bool expandBody,
  ) {
    if (_dmLoading && _dmRequests.isEmpty) {
      return const PlayRailListSkeleton(
        rows: 8,
        variant: PlayRailListVariant.player,
      );
    }
    // Server already filtered by q.
    final visible = _dmRequests;
    if (visible.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Text(
          c.dmEmptyRequests,
          style: TextStyle(color: tokens.onSurfaceMuted),
          textAlign: TextAlign.center,
        ),
      );
    }
    final showFooter = _dmLoadingMore || _dmHasMore;
    return ListView.separated(
      shrinkWrap: !expandBody,
      physics: expandBody ? null : const NeverScrollableScrollPhysics(),
      itemCount: visible.length + (showFooter ? 1 : 0),
      separatorBuilder: (_, __) =>
          Divider(height: 1, color: tokens.borderSubtle),
      itemBuilder: (context, i) {
        if (i >= visible.length) {
          return _infiniteListFooter(tokens, c, loading: _dmLoadingMore);
        }
        final row = visible[i];
        final p = row.player;
        final statusLabel = row.status == 'denied'
            ? c.dmRequestDeniedLabel
            : row.status == 'cancelled'
                ? c.dmRequestCancelledLabel
                : row.status == 'pending' && row.side == 'in'
                    ? c.dmRequestPendingLabel
                    : row.status == 'pending' && row.side == 'out'
                        ? c.dmRequestOutgoingLabel
                        : '';
        final unreadLabel = _formatDmUnreadBadge(c, row.unreadCount);
        Future<void> openThread() async {
          final tid = (row.threadId ?? '').trim();
          final auth = context.read<AuthCubit>().state;
          final token = auth.token?.trim() ?? '';
          if (tid.isEmpty || token.isEmpty) return;
          await showDmThreadSheet(
            context,
            chrome: c,
            accessToken: token,
            threadId: tid,
            peerName: p?.username ?? '',
            canCompose: row.status == 'accepted',
            requestId: row.id,
            requestSide: row.side,
            requestStatus: row.status,
          );
          if (mounted) unawaited(_loadDmRequests());
        }

        // Messaging-list pattern: entire row opens the thread (Telegram/WhatsApp).
        // Long-press peeks profile. Accept/Deny/Cancel remain nested TextButtons.
        final canOpen = (row.threadId ?? '').trim().isNotEmpty;
        return Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: canOpen ? () => unawaited(openThread()) : null,
            onLongPress: p == null
                ? null
                : () => unawaited(showPlayerInspectSheet(context, p.id)),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  DamaUserAvatar(
                    imageUrl: p?.avatarThumbUrl,
                    radius: 20,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          p?.username ?? '',
                          style: TextStyle(
                            fontWeight: row.unreadCount > 0
                                ? FontWeight.w800
                                : FontWeight.w600,
                          ),
                        ),
                        HostTrustBadge(
                          label: p?.hostTrustBadge,
                          tier: p?.hostTrustTier,
                          fontSize: 10,
                          dense: true,
                        ),
                        Text(
                          row.preview,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontWeight: row.unreadCount > 0
                                ? FontWeight.w600
                                : FontWeight.w400,
                            color: row.unreadCount > 0
                                ? Theme.of(context).colorScheme.onSurface
                                : tokens.onSurfaceMuted,
                          ),
                        ),
                        if (statusLabel.isNotEmpty)
                          Text(
                            statusLabel,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: tokens.onSurfaceMuted,
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (unreadLabel.isNotEmpty) ...[
                    IgnorePointer(
                      child: Container(
                        constraints:
                            const BoxConstraints(minWidth: 20, minHeight: 20),
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: tokens.brand,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          unreadLabel,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                  ],
                  if (row.side == 'in' && row.status == 'pending') ...[
                    TextButton(
                      onPressed: () async {
                        final auth = context.read<AuthCubit>().state;
                        final token = auth.token?.trim() ?? '';
                        if (token.isEmpty) return;
                        final ok = await acceptDm(token, row.id);
                        _toast(ok ? c.dmToastAccepted : c.dmToastFailed);
                        if (ok) {
                          unawaited(_loadDmRequests());
                          final tid = (row.threadId ?? '').trim();
                          if (tid.isNotEmpty && context.mounted) {
                            unawaited(() async {
                              await showDmThreadSheet(
                                context,
                                chrome: c,
                                accessToken: token,
                                threadId: tid,
                                peerName: p?.username ?? '',
                                canCompose: true,
                                requestId: row.id,
                                requestSide: row.side,
                                requestStatus: 'accepted',
                              );
                              if (mounted) unawaited(_loadDmRequests());
                            }());
                          }
                        }
                      },
                      child: Text(c.dmAcceptAction),
                    ),
                    TextButton(
                      onPressed: () async {
                        final auth = context.read<AuthCubit>().state;
                        final token = auth.token?.trim() ?? '';
                        if (token.isEmpty) return;
                        final ok = await denyDm(token, row.id);
                        _toast(ok ? c.dmToastDenied : c.dmToastFailed);
                        if (ok) unawaited(_loadDmRequests());
                      },
                      child: Text(c.dmDenyAction),
                    ),
                  ],
                  if (row.side == 'out' && row.status == 'pending')
                    TextButton(
                      onPressed: () async {
                        final auth = context.read<AuthCubit>().state;
                        final token = auth.token?.trim() ?? '';
                        if (token.isEmpty) return;
                        final ok = await cancelDm(token, row.id);
                        _toast(ok ? c.dmToastCancelled : c.dmToastFailed);
                        if (ok) unawaited(_loadDmRequests());
                      },
                      child: Text(c.dmCancelAction),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _friendRequestsBody(
    DamaColors tokens,
    PlayRailChrome c,
    bool expandBody,
  ) {
    if (_playersLoading && _friendReqRows.isEmpty) {
      return const PlayRailListSkeleton(
        rows: 8,
        variant: PlayRailListVariant.player,
      );
    }
    // Server already filtered by q.
    final visible = _friendReqRows;
    if (visible.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Text(
          c.emptyFriendRequests,
          style: TextStyle(color: tokens.onSurfaceMuted),
          textAlign: TextAlign.center,
        ),
      );
    }
    final showFooter = _playersLoadingMore || _playersHasMore;
    return ListView.separated(
      shrinkWrap: !expandBody,
      physics: expandBody ? null : const NeverScrollableScrollPhysics(),
      itemCount: visible.length + (showFooter ? 1 : 0),
      separatorBuilder: (_, __) =>
          Divider(height: 1, color: tokens.borderSubtle),
      itemBuilder: (context, i) {
        if (i >= visible.length) {
          return _infiniteListFooter(tokens, c, loading: _playersLoadingMore);
        }
        final row = visible[i];
        final p = row.player;
        final rowBusy = _busyRequestId == row.id;
        final statusLabel = row.status == 'denied'
            ? c.friendRequestDeniedLabel
            : row.incoming
                ? c.friendRequestPendingLabel
                : c.friendRequestOutgoingLabel;
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
          child: Row(
            children: [
              // Inspect: avatar + name (not the whole row).
              InkWell(
                onTap: () => unawaited(showPlayerInspectSheet(context, p.id)),
                customBorder: const CircleBorder(),
                child: DamaUserAvatar(imageUrl: p.avatarThumbUrl, radius: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: InkWell(
                            onTap: () => unawaited(
                                showPlayerInspectSheet(context, p.id)),
                            child: Text(
                              _formatPlayerNameDisplay(p.username, c),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),
                        Text(
                          '${c.ratingParenOpen}${p.rating}${c.ratingParenClose}',
                          style: TextStyle(
                            color: tokens.onSurfaceMuted,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(width: 4),
                        CountryFlag(
                          code: p.countryCode,
                          imageUrlTemplate: c.countryFlagImageUrlTemplate,
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
                        color: tokens.onSurfaceMuted,
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.4,
                      ),
                    ),
                  ],
                ),
              ),
              TextButton(
                style: TextButton.styleFrom(
                  minimumSize: const Size(0, 28),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                onPressed: () =>
                    unawaited(showPlayerInspectSheet(context, p.id)),
                child: Text(c.viewProfileAction),
              ),
              if (row.incoming && row.status == 'pending') ...[
                TextButton(
                  onPressed:
                      rowBusy ? null : () => _acceptFriendRequest(row.id),
                  child: Text(
                    rowBusy && _busyRequestOp == 'accept'
                        ? c.acceptingFriendRequest
                        : c.acceptFriendRequestAction,
                  ),
                ),
                TextButton(
                  onPressed: rowBusy ? null : () => _denyFriendRequest(row.id),
                  child: Text(
                    rowBusy && _busyRequestOp == 'deny'
                        ? c.denyingFriendRequest
                        : c.denyFriendRequestAction,
                  ),
                ),
              ],
              if (!row.incoming && row.status == 'pending')
                TextButton(
                  onPressed:
                      rowBusy ? null : () => _cancelFriendRequest(row.id),
                  child: Text(
                    rowBusy && _busyRequestOp == 'cancel'
                        ? c.cancellingFriendRequest
                        : c.cancelFriendRequestAction,
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  /// Reserved end slot: keeps list height stable; label only while a page is in flight.
  Widget _infiniteListFooter(
    DamaColors tokens,
    PlayRailChrome c, {
    required bool loading,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Center(
        child: loading
            ? Text(
                c.loadingMore,
                style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
              )
            : const SizedBox(height: 14),
      ),
    );
  }

  Widget _playerRow(
    DamaColors tokens,
    PlayRailChrome c,
    RailPlayer p,
    bool signedIn,
  ) {
    final statusLabel = p.playing
        ? c.playingLabel
        : p.online
            ? c.onlineLabel
            : c.offlineLabel;
    final statusColor = p.playing
        ? tokens.playing
        : p.online
            ? tokens.online
            : tokens.offline;
    final playingGid = (p.playingGameId ?? '').trim();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
      child: Row(
        children: [
          // Card: avatar + name (not the whole row).
          InkWell(
            onTap: () => _showPlayerCard(tokens, c, p, signedIn),
            customBorder: const CircleBorder(),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                DamaUserAvatar(imageUrl: p.avatarThumbUrl, radius: 18),
                Positioned(
                  right: 1,
                  bottom: 1,
                  child: Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: statusColor,
                      shape: BoxShape.circle,
                      border: Border.all(color: tokens.card, width: 2),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                InkWell(
                  onTap: () => _showPlayerCard(tokens, c, p, signedIn),
                  child: Text(
                    _formatPlayerNameDisplay(p.username, c),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
                HostTrustBadge(
                  label: p.hostTrustBadge,
                  tier: p.hostTrustTier,
                  fontSize: 10,
                  dense: true,
                ),
                Text(statusLabel,
                    style: TextStyle(color: statusColor, fontSize: 12)),
              ],
            ),
          ),
          Text(
            '${c.ratingParenOpen}${p.rating}${c.ratingParenClose}',
            style: TextStyle(color: tokens.onSurfaceMuted),
          ),
          const SizedBox(width: 4),
          CountryFlag(
            code: p.countryCode,
            imageUrlTemplate: c.countryFlagImageUrlTemplate,
          ),
          const SizedBox(width: 4),
          TextButton(
            style: TextButton.styleFrom(
              minimumSize: const Size(0, 28),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            onPressed: () => unawaited(showPlayerInspectSheet(context, p.id)),
            child: Text(c.viewProfileAction),
          ),
          if (p.playing && playingGid.isNotEmpty)
            TextButton(
              onPressed: () => _watchGame(playingGid),
              child: Text(c.watchGameAction),
            ),
          if (signedIn) ...[
            TextButton(
              onPressed: () => _openChallengeFor(p),
              child: Text(c.challengeAction),
            ),
            // Friends tab: Remove only. All Players: request / pending / remove.
            if (_friendIdsReady)
              if (_playersSub == 0 || _friendIds.contains(p.id))
                TextButton.icon(
                  style: TextButton.styleFrom(
                    minimumSize: const Size(0, 28),
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  onPressed: _addingFriend ? null : () => _removeFriend(p.id),
                  icon: const Icon(Icons.person_remove_outlined, size: 16),
                  label: Text(
                    _addingFriend ? c.removingFriend : c.removeFriendAction,
                  ),
                )
              else if (_playersSub == 2 &&
                  _outgoingPendingUserIds.contains(p.id))
                Text(
                  c.friendRequestOutgoingLabel,
                  style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
                )
              else if (_playersSub == 2)
                TextButton.icon(
                  style: TextButton.styleFrom(
                    minimumSize: const Size(0, 28),
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  onPressed: _addingFriend ? null : () => _addFriend(p.id),
                  icon: const Icon(Icons.person_add_alt_1_outlined, size: 16),
                  label: Text(
                    _addingFriend
                        ? c.sendingFriendRequest
                        : c.sendFriendRequestAction,
                  ),
                ),
          ],
        ],
      ),
    );
  }

  Future<void> _showPlayerCard(
    DamaColors tokens,
    PlayRailChrome c,
    RailPlayer p,
    bool signedIn,
  ) async {
    final statusLabel = p.playing
        ? c.playingLabel
        : p.online
            ? c.onlineLabel
            : c.offlineLabel;
    final statusColor = p.playing
        ? tokens.playing
        : p.online
            ? tokens.online
            : tokens.offline;
    final playingGid = (p.playingGameId ?? '').trim();
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: tokens.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        // Match web PlayerHoverCard: rounded-square face (not circle).
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: DamaUserAvatar(
                            imageUrl: p.avatarThumbUrl,
                            radius: 28,
                          ),
                        ),
                        Positioned(
                          right: 0,
                          bottom: 0,
                          child: Container(
                            width: 12,
                            height: 12,
                            decoration: BoxDecoration(
                              color: statusColor,
                              shape: BoxShape.circle,
                              border: Border.all(color: tokens.card, width: 2),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  p.username,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 18,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              Text(
                                '${c.ratingParenOpen}${p.rating}${c.ratingParenClose}',
                                style: TextStyle(
                                  color: tokens.onSurfaceMuted,
                                  fontSize: 13,
                                ),
                              ),
                              const SizedBox(width: 6),
                              CountryFlag(
                                code: p.countryCode,
                                imageUrlTemplate: c.countryFlagImageUrlTemplate,
                                height: 14,
                              ),
                            ],
                          ),
                          Text(
                            '${c.labelRating} ${p.rating}',
                            style: TextStyle(
                              color: tokens.onSurfaceMuted,
                              fontSize: 13,
                            ),
                          ),
                          if (p.wins != null && p.losses != null)
                            Text(
                              '${p.wins}${c.winsAbbr}${c.statsSeparator}${p.losses}${c.lossesAbbr}',
                              style: TextStyle(
                                color: tokens.onSurfaceMuted,
                                fontSize: 12,
                                fontFeatures: const [
                                  FontFeature.tabularFigures()
                                ],
                              ),
                            ),
                          Text(
                            statusLabel,
                            style: TextStyle(color: statusColor, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                // Web PlayerHoverCard parity: stacked full-width CTAs (no clipped labels).
                if (signedIn)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (c.viewProfileAction.isNotEmpty)
                        OutlinedButton.icon(
                          onPressed: () {
                            Navigator.of(ctx).pop();
                            unawaited(showPlayerInspectSheet(context, p.id));
                          },
                          icon: const Icon(Icons.person_outline, size: 18),
                          label: Text(
                            c.viewProfileAction,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      if (c.viewProfileAction.isNotEmpty &&
                          p.playing &&
                          playingGid.isNotEmpty)
                        const SizedBox(height: 8),
                      if (p.playing && playingGid.isNotEmpty)
                        OutlinedButton.icon(
                          onPressed: () {
                            Navigator.of(ctx).pop();
                            _watchGame(playingGid);
                          },
                          icon: const Icon(Icons.visibility_outlined, size: 18),
                          label: Text(
                            c.watchGameAction,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      if (_friendIdsReady) ...[
                        if (c.viewProfileAction.isNotEmpty ||
                            (p.playing && playingGid.isNotEmpty))
                          const SizedBox(height: 8),
                        Builder(
                          builder: (_) {
                            final isFriend = _friendIds.contains(p.id);
                            final pending = !isFriend &&
                                _outgoingPendingUserIds.contains(p.id);
                            if (pending) {
                              return Padding(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 8),
                                child: Text(
                                  c.friendRequestOutgoingLabel,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: tokens.onSurfaceMuted,
                                    fontSize: 12,
                                  ),
                                ),
                              );
                            }
                            return OutlinedButton.icon(
                              onPressed: _addingFriend
                                  ? null
                                  : () {
                                      Navigator.of(ctx).pop();
                                      if (isFriend) {
                                        _removeFriend(p.id);
                                      } else {
                                        _addFriend(p.id);
                                      }
                                    },
                              icon: Icon(
                                isFriend
                                    ? Icons.person_remove_outlined
                                    : Icons.person_add_alt_1_outlined,
                                size: 18,
                              ),
                              label: Text(
                                isFriend
                                    ? (_addingFriend
                                        ? c.removingFriend
                                        : c.removeFriendAction)
                                    : (_addingFriend
                                        ? c.sendingFriendRequest
                                        : c.sendFriendRequestAction),
                                overflow: TextOverflow.ellipsis,
                              ),
                            );
                          },
                        ),
                      ],
                      if (c.messageAction.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        OutlinedButton.icon(
                          onPressed: () {
                            final auth = context.read<AuthCubit>().state;
                            final token = auth.token?.trim() ?? '';
                            Navigator.of(ctx).pop();
                            if (token.isEmpty) return;
                            final messenger = ScaffoldMessenger.of(context);
                            final navContext = context;
                            unawaited(() async {
                              final composed = await showComposeMessageSheet(
                                navContext,
                                chrome: c,
                                accessToken: token,
                                toUserId: p.id,
                                username: p.username,
                                avatarThumbUrl: p.avatarThumbUrl,
                                hostTrustBadge: p.hostTrustBadge,
                                hostTrustTier: p.hostTrustTier,
                              );
                              if (composed == null || !mounted) return;
                              await followComposeMessageResult(
                                navContext,
                                chrome: c,
                                accessToken: token,
                                userId: auth.userId?.trim() ?? '',
                                composed: composed,
                                messenger: messenger,
                              );
                            }());
                          },
                          icon: const Icon(Icons.mail_outline, size: 18),
                          label: Text(
                            c.messageAction,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                      const SizedBox(height: 8),
                      FilledButton.icon(
                        onPressed: () {
                          Navigator.of(ctx).pop();
                          _openChallengeFor(p);
                        },
                        icon:
                            const Icon(Icons.sports_esports_outlined, size: 18),
                        label: Text(
                          c.challengeAction,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _subTabRow({
    required BuildContext context,
    required DamaColors tokens,
    required List<(int, String, IconData)> tabs,
    required int selected,
    required ValueChanged<int> onSelect,
    Map<int, int> badges = const {},

    /// Chrome aria template with `{count}` for badge tabs (e.g. friend requests).
    Map<int, String> badgeAriaFmts = const {},
  }) {
    return Row(
      children: [
        for (final t in tabs)
          Expanded(
            child: Builder(
              builder: (context) {
                final count = badges[t.$1] ?? 0;
                final fmt = (badgeAriaFmts[t.$1] ?? '').trim();
                final semantic = count > 0 && fmt.contains('{count}')
                    ? fmt.replaceAll('{count}', '$count')
                    : t.$2;
                return Semantics(
                  button: true,
                  selected: selected == t.$1,
                  label: semantic,
                  child: InkWell(
                    onTap: () => onSelect(t.$1),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(
                            color: selected == t.$1
                                ? tokens.gold
                                : tokens.borderSubtle,
                            width: selected == t.$1 ? 2 : 1,
                          ),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(t.$3,
                              size: 16,
                              color: selected == t.$1
                                  ? null
                                  : tokens.onSurfaceMuted),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              t.$2,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                                color: selected == t.$1
                                    ? null
                                    : tokens.onSurfaceMuted,
                              ),
                            ),
                          ),
                          if (count > 0) ...[
                            const SizedBox(width: 4),
                            ExcludeSemantics(
                              child: Builder(
                                builder: (ctx) {
                                  // Match NotificationBell/web: onSurface pill, surface digits.
                                  final scheme = Theme.of(ctx).colorScheme;
                                  return Container(
                                    constraints:
                                        const BoxConstraints(minWidth: 16),
                                    height: 16,
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 4),
                                    decoration: BoxDecoration(
                                      color: scheme.onSurface,
                                      borderRadius: BorderRadius.circular(999),
                                      border: Border.all(
                                          color: tokens.card, width: 1),
                                    ),
                                    alignment: Alignment.center,
                                    child: Text(
                                      '$count',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                        color: scheme.surface,
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }
}

class _LiveSeat {
  const _LiveSeat({
    required this.id,
    required this.username,
    this.avatarThumbUrl,
    this.rating,
    this.wins,
    this.losses,
    this.draws,
    this.countryCode,
    this.hostTrustTier,
    this.hostTrustBadge,
  });

  final String id;
  final String username;
  final String? avatarThumbUrl;
  final int? rating;
  final int? wins;
  final int? losses;
  final int? draws;
  final String? countryCode;
  final String? hostTrustTier;
  final String? hostTrustBadge;
}

class _LiveGameRow {
  const _LiveGameRow({
    required this.id,
    required this.line1,
    required this.line2,
    required this.p1Name,
    required this.p2Name,
    required this.seats,
    required this.viewers,
    required this.spectatorCount,
    this.moveCount,
    this.timeControlSeconds,
  });

  final String id;
  final String line1;
  final String line2;
  final String p1Name;
  final String p2Name;
  final List<_LiveSeat> seats;
  final List<_LiveSeat> viewers;
  final int spectatorCount;
  final int? moveCount;
  final int? timeControlSeconds;

  static _LiveGameRow? fromJson(
    Map<String, dynamic> json, {
    required String parenOpen,
    required String parenClose,
  }) {
    final id = (json['id'] as String?)?.trim() ?? '';
    if (id.isEmpty) return null;
    String fmtUser(String? name, num? rating) {
      final n = (name ?? '').trim();
      if (n.isEmpty) return '';
      if (rating != null) return '$n$parenOpen$rating$parenClose';
      return n;
    }

    final p1Name = (json['player1_username'] as String?)?.trim() ?? '';
    final p2Name = (json['player2_username'] as String?)?.trim() ?? '';
    final p1 = fmtUser(p1Name, json['player1_rating'] as num?);
    final p2 = fmtUser(p2Name, json['player2_rating'] as num?);
    final seats = <_LiveSeat>[];
    final p1Id = (json['player1_id'] as String?)?.trim() ?? '';
    final p2Id = (json['player2_id'] as String?)?.trim() ?? '';
    if (p1Id.isNotEmpty && p1Name.isNotEmpty) {
      seats.add(_LiveSeat(
        id: p1Id,
        username: p1Name,
        avatarThumbUrl: (json['player1_avatar_thumb_url'] as String?)?.trim(),
        rating: (json['player1_rating'] as num?)?.toInt(),
        wins: (json['player1_wins'] as num?)?.toInt(),
        losses: (json['player1_losses'] as num?)?.toInt(),
        draws: (json['player1_draws'] as num?)?.toInt(),
        countryCode: (json['player1_country_code'] as String?)?.trim(),
        hostTrustTier: (json['player1_host_trust_tier'] as String?)?.trim(),
        hostTrustBadge: (json['player1_host_trust_badge'] as String?)?.trim(),
      ));
    }
    if (p2Id.isNotEmpty && p2Name.isNotEmpty) {
      seats.add(_LiveSeat(
        id: p2Id,
        username: p2Name,
        avatarThumbUrl: (json['player2_avatar_thumb_url'] as String?)?.trim(),
        rating: (json['player2_rating'] as num?)?.toInt(),
        wins: (json['player2_wins'] as num?)?.toInt(),
        losses: (json['player2_losses'] as num?)?.toInt(),
        draws: (json['player2_draws'] as num?)?.toInt(),
        countryCode: (json['player2_country_code'] as String?)?.trim(),
        hostTrustTier: (json['player2_host_trust_tier'] as String?)?.trim(),
        hostTrustBadge: (json['player2_host_trust_badge'] as String?)?.trim(),
      ));
    }
    final viewers = <_LiveSeat>[];
    final rawViewers = json['viewers'];
    if (rawViewers is List) {
      for (final v in rawViewers) {
        if (v is! Map) continue;
        final map = Map<String, dynamic>.from(v);
        final vid = (map['id'] as String?)?.trim() ?? '';
        final un = (map['username'] as String?)?.trim() ?? '';
        if (vid.isEmpty || un.isEmpty) continue;
        viewers.add(_LiveSeat(
          id: vid,
          username: un,
          avatarThumbUrl: (map['avatar_thumb_url'] as String?)?.trim(),
          rating: (map['rating'] as num?)?.toInt(),
          wins: (map['wins'] as num?)?.toInt(),
          losses: (map['losses'] as num?)?.toInt(),
          draws: (map['draws'] as num?)?.toInt(),
          countryCode: (map['country_code'] as String?)?.trim(),
          hostTrustTier: (map['host_trust_tier'] as String?)?.trim(),
          hostTrustBadge: (map['host_trust_badge'] as String?)?.trim(),
        ));
      }
    }
    return _LiveGameRow(
      id: id,
      line1: p1,
      line2: p2,
      p1Name: p1Name,
      p2Name: p2Name,
      seats: seats,
      viewers: viewers,
      spectatorCount:
          (json['spectator_count'] as num?)?.toInt() ?? viewers.length,
      moveCount: (json['move_count'] as num?)?.toInt(),
      timeControlSeconds: (json['time_control_seconds'] as num?)?.toInt(),
    );
  }
}

class _FriendRequestEntry {
  const _FriendRequestEntry({
    required this.id,
    required this.status,
    required this.incoming,
    required this.player,
  });

  final String id;
  final String status;
  final bool incoming;
  final RailPlayer player;

  static _FriendRequestEntry? fromJson(
    Map<String, dynamic> json, {
    required bool incoming,
  }) {
    final id = (json['id'] as String?)?.trim() ?? '';
    if (id.isEmpty) return null;
    final status = (json['status'] as String?)?.trim() ?? '';
    final playerJson = json['player'];
    if (playerJson is! Map<String, dynamic>) return null;
    final player = RailPlayer.fromJson(playerJson);
    if (player == null) return null;
    return _FriendRequestEntry(
      id: id,
      status: status,
      incoming: incoming,
      player: player,
    );
  }

  /// Trim-paged `/friends/requests?skip&limit` row (`side`: in|out).
  static _FriendRequestEntry? fromPagedJson(Map<String, dynamic> json) {
    final side = (json['side'] as String?)?.trim() ?? '';
    if (side != 'in' && side != 'out') return null;
    return fromJson(json, incoming: side == 'in');
  }
}

class _HistoryRow {
  const _HistoryRow({
    required this.id,
    this.gameId,
    this.mode,
    this.winnerId,
    this.isDraw = false,
    this.moveCount,
  });

  final String id;
  final String? gameId;
  final String? mode;
  final String? winnerId;
  final bool isDraw;
  final int? moveCount;

  static _HistoryRow? fromJson(Map<String, dynamic> json) {
    final id = (json['id'] as String?)?.trim() ?? '';
    if (id.isEmpty) return null;
    final gid = (json['game_id'] as String?)?.trim();
    return _HistoryRow(
      id: id,
      gameId: gid != null && gid.isNotEmpty ? gid : null,
      mode: (json['mode'] as String?)?.trim(),
      winnerId: (json['winner_id'] as String?)?.trim(),
      isDraw: json['is_draw'] == true,
      moveCount: json['move_count'] is int ? json['move_count'] as int : null,
    );
  }
}
