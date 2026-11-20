import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/audio/game_notify.dart';
import 'package:dama_mobile/core/cache/query_cache.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/features/notifications/notification_app_bar_actions.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/network/game_ws_client.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/core/prefs/board_palette_prefs.dart';
import 'package:dama_mobile/core/prefs/board_view_prefs.dart';
import 'package:dama_mobile/features/game/draughts_board_2d.dart';
import 'package:dama_mobile/features/game/draughts_board_3d.dart';
import 'package:dama_mobile/features/game/game_move_history.dart';
import 'package:dama_mobile/features/game/game_turn_status.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/chat/chat_message_notify.dart';
import 'package:dama_mobile/features/chat/game_chat_api.dart';
import 'package:dama_mobile/features/chat/game_chat_live.dart';
import 'package:dama_mobile/features/chat/game_chat_sheet.dart';
import 'package:dama_mobile/features/chat/match_intro_overlay.dart';
import 'package:dama_mobile/features/game/match_pause_overlay.dart';
import 'package:dama_mobile/features/game/match_vote_panel.dart';
import 'package:dama_mobile/features/game/official_pause_activity_strip.dart';
import 'package:dama_mobile/features/game/play_board_frame.dart';
import 'package:dama_mobile/features/player/match_seat_avatars.dart';
import 'package:dama_mobile/features/player/open_create_game_challenge.dart';
import 'package:dama_mobile/widgets/player_rail_menu_leading.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;
import 'package:share_plus/share_plus.dart';

/// Live spectate via raw Go WebSocket (not GraphQL subscriptions).
class SpectatePage extends StatefulWidget {
  const SpectatePage({super.key, this.accessToken, this.initialGameId});

  final String? accessToken;
  final String? initialGameId;

  @override
  State<SpectatePage> createState() => _SpectatePageState();
}

class _SpectatePageState extends State<SpectatePage> {
  final _gameIdCtrl = TextEditingController();
  final _ws = GameWsClient();
  StreamSubscription? _sub;
  StreamSubscription<String>? _chatLiveSub;
  int _chatUnread = 0;
  bool _connected = false;
  bool _busy = false;
  String? _error;
  String? _status;
  List<List<dynamic>>? _board;
  int _boardSize = 0;
  String? _player1Id;
  String? _player2Id;
  PublicPlayerCard? _p1Card;
  PublicPlayerCard? _p2Card;
  int? _whitePieces;
  int? _blackPieces;
  int? _piecesPerSide;
  int _lastMoveCount = -1;
  SpectateChrome? _chrome;
  PlayRailChrome? _railChrome;
  PlayChrome? _playChrome;
  OfficialPauseChrome? _officialPauseChrome;
  String? _chromeError;
  bool _chromeLoading = true;
  List<MoveHistoryEntry> _moveHistory = const [];
  int? _replayIndex;
  List<List<dynamic>>? _liveBoard;
  int _turn = 1;
  bool _draw = false;
  bool _flipBoard = false;
  bool _shareCopied = false;
  Map<String, dynamic>? _liveVotes;
  int? _outcome;
  String? _endReason;
  BoardViewMode _boardView = BoardViewMode.flat2d;
  BoardPaletteId _boardPaletteId = BoardPaletteId.forest;
  PiecePaletteId _piecePaletteId = PiecePaletteId.whiteBlack;
  bool _clockEnabled = false;
  bool _gamePaused = false;
  String _pauseKind = '';
  String _pauseReasonLabel = '';
  String _pauseNote = '';
  String _pauseActorRole = '';
  String _pauseActorDisplayName = '';
  int _pauseExpiresAtUnixMs = 0;
  int _pausedAtUnixMs = 0;
  String _resumeBanner = '';
  int _pauseActivityRefresh = 0;
  bool _wasOfficialPause = false;
  String _lastOfficialActorRole = '';
  String _lastOfficialActorName = '';
  int _clockP1RemainingMs = 0;
  int _clockP2RemainingMs = 0;
  int _clockSyncP1Ms = 0;
  int _clockSyncP2Ms = 0;
  DateTime _clockSyncedAt = DateTime.now();
  Timer? _clockTimer;
  List<MatchClockPreset> _clockPresets = const [];
  int? _gameTimeControlSeconds;

  /// Focus: collapse vote so Moves/Chat/Info get room; Back restores overview.
  bool _watchFocus = false;
  _WatchTab _watchTab = _WatchTab.moves;

  /// Seat clock follows animating ply, then side-to-move (web activeClockPlayer parity).
  int? get _activeClockPlayer {
    if (_outcome != null || _draw) return null;
    if (_replayIndex != null) return null;
    if (_moveHistory.isNotEmpty) {
      final last = _moveHistory.last;
      final after = last.boardAfter;
      final mover = last.player;
      if (after != null &&
          after.isNotEmpty &&
          (mover == 1 || mover == 2) &&
          !_boardsMatch(_board, after)) {
        return mover;
      }
    }
    return _turn;
  }

  bool _boardsMatch(List<List<dynamic>>? a, List<List<dynamic>>? b) {
    if (identical(a, b)) return true;
    if (a == null || b == null || a.length != b.length) return false;
    for (var r = 0; r < a.length; r++) {
      if (a[r].length != b[r].length) return false;
      for (var c = 0; c < a[r].length; c++) {
        final ac = a[r][c];
        final bc = b[r][c];
        final ap = ac is Map ? ac['p'] : null;
        final bp = bc is Map ? bc['p'] : null;
        final ak = ac is Map ? ac['k'] == true : false;
        final bk = bc is Map ? bc['k'] == true : false;
        if (ap != bp || ak != bk) return false;
      }
    }
    return true;
  }

  @override
  void initState() {
    super.initState();
    final preset = widget.initialGameId?.trim();
    if (preset != null && preset.isNotEmpty) {
      _gameIdCtrl.text = preset;
    }
    _loadChrome();
    unawaited(_loadProgression());
    unawaited(_hydrateBoardView());
    unawaited(_hydrateBoardPalette());
    unawaited(_hydratePiecePalette());
    _chatLiveSub = GameChatLive.stream.listen((gid) {
      if (gid == _gameIdCtrl.text.trim()) unawaited(_refreshChatUnread());
    });
  }

  Future<void> _hydrateBoardView() async {
    final mode = await readBoardViewMode();
    if (!mounted) return;
    setState(() => _boardView = mode);
  }

  Future<void> _hydrateBoardPalette() async {
    final id = await readBoardPaletteId();
    if (!mounted) return;
    setState(() => _boardPaletteId = id);
  }

  Future<void> _hydratePiecePalette() async {
    final id = await readPiecePaletteId();
    if (!mounted) return;
    setState(() => _piecePaletteId = id);
  }

  Future<void> _setBoardView(BoardViewMode mode) async {
    setState(() => _boardView = mode);
    await writeBoardViewMode(mode);
  }

  Future<void> _loadChrome() async {
    // Platform-tier paint first (web spectate-chrome / lists parity).
    final cachedChrome = QueryCache.read<SpectateChrome>(
      CacheKeys.spectateChrome,
      maxAge: QueryCache.platformTtl,
      allowStale: true,
    );
    final cachedRail = QueryCache.read<PlayRailChrome>(
      CacheKeys.playRailChrome,
      maxAge: QueryCache.platformTtl,
      allowStale: true,
    );
    if (cachedChrome != null && mounted) {
      setState(() {
        _chrome = cachedChrome;
        _railChrome = cachedRail;
        _chromeLoading = false;
        _chromeError = null;
      });
      final preset = widget.initialGameId?.trim();
      if (preset != null && preset.isNotEmpty && !_connected) {
        unawaited(_connect());
      }
    }
    try {
      final results = await Future.wait([
        http.get(
            Uri.parse('${ApiConfig.baseUrl}/api/v1/public/spectate-chrome')),
        http.get(
            Uri.parse('${ApiConfig.baseUrl}/api/v1/public/play-rail-chrome')),
        http.get(Uri.parse('${ApiConfig.baseUrl}/api/v1/public/play-chrome')),
        http.get(Uri.parse(
            '${ApiConfig.baseUrl}/api/v1/public/official-pause-chrome')),
      ]);
      final res = results[0];
      Map<String, dynamic>? map;
      Map<String, dynamic>? railMap;
      Map<String, dynamic>? playMap;
      Map<String, dynamic>? opsMap;
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) map = decoded;
      } catch (_) {}
      try {
        final decoded = jsonDecode(results[1].body);
        if (decoded is Map<String, dynamic>) railMap = decoded;
      } catch (_) {}
      try {
        final decoded = jsonDecode(results[2].body);
        if (decoded is Map<String, dynamic>) playMap = decoded;
      } catch (_) {}
      try {
        final decoded = jsonDecode(results[3].body);
        if (decoded is Map<String, dynamic>) opsMap = decoded;
      } catch (_) {}
      final fromBody =
          (map?['spectate_chrome_unavailable'] as String?)?.trim() ?? '';
      if (res.statusCode != 200) {
        if (cachedChrome != null) return;
        if (!mounted) return;
        setState(() {
          _chromeLoading = false;
          _chromeError = fromBody.isNotEmpty
              ? fromBody
              : ((map?['error'] as String?)?.trim() ?? '');
        });
        return;
      }
      final chrome = SpectateChrome.fromJson(map);
      final rail = PlayRailChrome.fromJson(railMap);
      // Soft-validate play chrome payload (fail-closed if JSON shape drifts).
      final playChrome = PlayChrome.fromJson(playMap);
      final ops = OfficialPauseChrome.fromJson(opsMap);
      if (chrome != null) QueryCache.write(CacheKeys.spectateChrome, chrome);
      if (rail != null) QueryCache.write(CacheKeys.playRailChrome, rail);
      if (playChrome != null)
        QueryCache.write(CacheKeys.playChrome, playChrome);
      if (!mounted) return;
      setState(() {
        _chrome = chrome;
        _railChrome = rail;
        _playChrome = playChrome;
        _officialPauseChrome = ops;
        _chromeLoading = false;
        _chromeError = chrome == null ? fromBody : null;
      });
      final preset = widget.initialGameId?.trim();
      if (chrome != null &&
          preset != null &&
          preset.isNotEmpty &&
          !_connected) {
        unawaited(_connect());
      }
    } catch (_) {
      if (cachedChrome != null) return;
      if (!mounted) return;
      setState(() {
        _chromeLoading = false;
        _chromeError = '';
      });
    }
  }

  Future<void> _loadProgression() async {
    final cached = QueryCache.read<ProgressionConfig>(
      CacheKeys.progression,
      maxAge: QueryCache.platformTtl,
      allowStale: true,
    );
    if (cached?.matchClock != null && mounted) {
      final clock = cached!.matchClock!;
      setState(() {
        _clockPresets = clock.presets;
        // Seat clocks arm only from game_state.clock_active (server).
      });
    }
    try {
      final res =
          await http.get(Uri.parse('${ApiConfig.baseUrl}/api/v1/progression'));
      if (res.statusCode >= 300) return;
      final progression = ProgressionConfig.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      QueryCache.write(CacheKeys.progression, progression);
      final clock = progression.matchClock;
      if (clock == null) return;
      if (!mounted) return;
      setState(() {
        _clockPresets = clock.presets;
      });
    } catch (_) {
      // Fail closed: no clock without server config.
    }
  }

  void _applyServerClock(GameStatePayload payload) {
    final tc = payload.timeControlSeconds ?? 0;
    if (tc > 0) _gameTimeControlSeconds = tc;
    final paused = payload.paused;
    final wasPaused = _gamePaused;
    final wasOfficial = _wasOfficialPause;
    final prevReason = _pauseReasonLabel;
    final prevNote = _pauseNote;
    if (paused && payload.isOfficialPause) {
      _wasOfficialPause = true;
      _lastOfficialActorRole = payload.pauseActorRole.trim();
      _lastOfficialActorName = payload.pauseActorDisplayName.trim();
    } else if (!paused && wasOfficial) {
      final fmt = (_officialPauseChrome?.bannerResumedFmt ?? '').trim();
      final role =
          _officialPauseChrome?.roleLabel(_lastOfficialActorRole) ?? '';
      final name = _lastOfficialActorName.trim();
      // Fail closed: never show hollow "Resumed by ·" (fmt needs both role and name).
      if (role.isNotEmpty && name.isNotEmpty) {
        final line = fmt.isEmpty
            ? ''
            : fmt.replaceAll('{role}', role).replaceAll('{name}', name).trim();
        if (line.isNotEmpty) _resumeBanner = line;
      }
      _wasOfficialPause = false;
    }
    _gamePaused = paused;
    _pauseKind = paused ? payload.pauseKind.trim() : '';
    _pauseReasonLabel = paused ? payload.pauseReasonLabel.trim() : '';
    _pauseNote = paused ? payload.pauseNote.trim() : '';
    _pauseActorRole = paused ? payload.pauseActorRole.trim() : '';
    _pauseActorDisplayName = paused ? payload.pauseActorDisplayName.trim() : '';
    _pauseExpiresAtUnixMs = paused ? payload.pauseExpiresAtUnixMs : 0;
    _pausedAtUnixMs = paused ? payload.pausedAtUnixMs : 0;
    if (paused != wasPaused ||
        payload.isOfficialPause != wasOfficial ||
        (paused &&
            (_pauseReasonLabel != prevReason || _pauseNote != prevNote))) {
      _pauseActivityRefresh++;
    }
    if (!payload.clockActive) {
      _clockEnabled = false;
      _clockTimer?.cancel();
      return;
    }
    _clockEnabled = true;
    _clockSyncP1Ms = payload.clockP1RemainingMs;
    _clockSyncP2Ms = payload.clockP2RemainingMs;
    _clockP1RemainingMs = _clockSyncP1Ms;
    _clockP2RemainingMs = _clockSyncP2Ms;
    // While paused, do not advance the local sync anchor (wall time must not burn seats).
    if (!_gamePaused) {
      _clockSyncedAt = DateTime.now();
    }
    _restartClockTimer();
  }

  void _restartClockTimer() {
    _clockTimer?.cancel();
    if (!_clockEnabled) return;
    _clockTimer = Timer.periodic(const Duration(milliseconds: 200), (_) {
      if (!mounted) return;
      // Server pause freezes both seats (parity with web MatchClock `paused`).
      if (_gamePaused) {
        setState(() {
          _clockP1RemainingMs = _clockSyncP1Ms;
          _clockP2RemainingMs = _clockSyncP2Ms;
        });
        return;
      }
      final active = _activeClockPlayer;
      if (active == null) {
        setState(() {
          _clockP1RemainingMs = _clockSyncP1Ms;
          _clockP2RemainingMs = _clockSyncP2Ms;
        });
        return;
      }
      final elapsed = DateTime.now().difference(_clockSyncedAt).inMilliseconds;
      setState(() {
        if (active == 1) {
          _clockP1RemainingMs =
              (_clockSyncP1Ms - elapsed).clamp(0, _clockSyncP1Ms);
          _clockP2RemainingMs = _clockSyncP2Ms;
        } else {
          _clockP2RemainingMs =
              (_clockSyncP2Ms - elapsed).clamp(0, _clockSyncP2Ms);
          _clockP1RemainingMs = _clockSyncP1Ms;
        }
      });
    });
  }

  String _formatClockMs(int ms) {
    final total = (ms / 1000).floor().clamp(0, 24 * 3600);
    final m = total ~/ 60;
    final r = total % 60;
    return '$m:${r.toString().padLeft(2, '0')}';
  }

  String? _observingTimeLabel() {
    final sec = _gameTimeControlSeconds ?? 0;
    if (sec <= 0) return null;
    for (final p in _clockPresets) {
      if (p.seconds == sec && p.label.trim().isNotEmpty) {
        return p.label.trim();
      }
    }
    return null;
  }

  Future<void> _shareWatchUrl() async {
    final id = _gameIdCtrl.text.trim();
    final rail = _railChrome;
    if (id.isEmpty || rail == null) return;
    final origin = rail.webAppOrigin.trim().replaceAll(RegExp(r'/$'), '');
    if (origin.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(rail.toastCopyFailed)),
      );
      return;
    }
    final url = '$origin/?view=spectate&gameId=${Uri.encodeComponent(id)}';
    try {
      await Share.share(url, subject: rail.shareWatchAction);
      if (!mounted) return;
      setState(() => _shareCopied = true);
      Future<void>.delayed(const Duration(seconds: 2), () {
        if (mounted) setState(() => _shareCopied = false);
      });
    } catch (_) {
      try {
        await Clipboard.setData(ClipboardData(text: url));
        if (!mounted) return;
        setState(() => _shareCopied = true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(rail.copiedAction)),
        );
        Future<void>.delayed(const Duration(seconds: 2), () {
          if (mounted) setState(() => _shareCopied = false);
        });
      } catch (_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(rail.toastCopyFailed)),
        );
      }
    }
  }

  void _applyPayload(GameStatePayload payload) {
    final incomingHist = payload.moveHistory;
    final prevLen = _moveHistory.length;
    final histGrew = incomingHist.length > prevLen;
    // Freeze parent board while history grows so scene animates + clock follows ply.
    if (histGrew && _board != null) {
      _liveBoard = payload.board;
      _moveHistory = incomingHist;
    } else {
      _board = payload.board;
      _liveBoard = payload.board;
      _moveHistory = incomingHist;
    }
    _boardSize = payload.size;
    final prevP1 = (_player1Id ?? '').trim();
    final prevP2 = (_player2Id ?? '').trim();
    _player1Id = payload.player1Id;
    _player2Id = payload.player2Id;
    final nextP1 = (_player1Id ?? '').trim();
    final nextP2 = (_player2Id ?? '').trim();
    if (nextP1 != prevP1 || nextP2 != prevP2) {
      unawaited(_refreshSeatCards());
    }
    _turn = payload.turn;
    _draw = payload.draw;
    _outcome = payload.outcome is num ? (payload.outcome as num).toInt() : null;
    final endReason = (payload.endReason ?? '').trim();
    if (endReason.isNotEmpty) _endReason = endReason;
    final pieceBoard = _liveBoard ?? _board;
    _whitePieces = GameStatePayload.countPlayerPieces(pieceBoard, 1);
    _blackPieces = GameStatePayload.countPlayerPieces(pieceBoard, 2);
    final pieces = payload.piecesPerSide;
    if (pieces != null && pieces > 0) {
      _piecesPerSide = pieces;
    }
    _applyServerClock(payload);
    final gid = (payload.gameId ?? _gameIdCtrl.text).trim();
    if (gid.isNotEmpty) {
      QueryCache.write(CacheKeys.gameState(gid), payload);
    }
  }

  Future<void> _refreshSeatCards() async {
    final p1 = await _playerCard(_player1Id);
    final p2 = await _playerCard(_player2Id);
    if (!mounted) return;
    setState(() {
      _p1Card = p1;
      _p2Card = p2;
    });
  }

  Future<PublicPlayerCard?> _playerCard(String? id) async {
    final uid = (id ?? '').trim();
    if (uid.isEmpty) return null;
    final cached = QueryCache.read<PlayerDetailResponse>(
      CacheKeys.player(uid),
      maxAge: QueryCache.sessionTtl,
      allowStale: true,
    );
    if (cached?.player != null) return cached!.player;
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/players/$uid'),
      );
      if (res.statusCode != 200) return null;
      final detail = PlayerDetailResponse.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      QueryCache.write(CacheKeys.player(uid), detail);
      return detail.player;
    } catch (_) {
      return null;
    }
  }

  String _seatMatchupPart(PublicPlayerCard? card, PlayRailChrome rail) {
    final name = (card?.username ?? '').trim();
    if (name.isEmpty) return '';
    final rating = card?.rating ?? 0;
    if (rating <= 0) return name;
    return '$name${rail.ratingParenOpen}$rating${rail.ratingParenClose}';
  }

  Future<void> _refreshChatUnread() async {
    final id = _gameIdCtrl.text.trim();
    final token = (widget.accessToken ?? '').trim();
    if (id.isEmpty || token.isEmpty) return;
    final res = await fetchGameChat(id, token: token);
    if (!mounted || res.payload == null) return;
    setState(() => _chatUnread = res.payload!.unreadCount);
  }

  Future<void> _openGameChat(String gameId) async {
    final rail = _railChrome;
    if (rail == null || !mounted) return;
    if (!_watchFocus || _watchTab != _WatchTab.chat) {
      setState(() {
        _watchTab = _WatchTab.chat;
        _watchFocus = true;
      });
    }
    final p1 = await _playerCard(_player1Id);
    final p2 = await _playerCard(_player2Id);
    if (!mounted) return;
    final left = _seatMatchupPart(p1, rail);
    final right = _seatMatchupPart(p2, rail);
    final matchup = (left.isEmpty && right.isEmpty)
        ? null
        : '$left${rail.vsSeparator}$right';
    await showGameChatSheet(
      context,
      chrome: rail,
      gameId: gameId,
      accessToken: widget.accessToken,
      observingLabel: rail.observingGameLabel,
      observingMatchup: matchup,
      observingTimeLabel: _observingTimeLabel(),
    );
    if (mounted) unawaited(_refreshChatUnread());
  }

  List<List<dynamic>>? get _displayBoard {
    if (_replayIndex == null) return _board;
    if (_replayIndex! <= 0) return _liveBoard ?? _board;
    final idx = _replayIndex! - 1;
    if (idx < 0 || idx >= _moveHistory.length) return _board;
    final after = _moveHistory[idx].boardAfter;
    return after ?? _board;
  }

  int _capturesByPlayer(int player) {
    final limit = _replayIndex ?? _moveHistory.length;
    var n = 0;
    for (var i = 0; i < limit && i < _moveHistory.length; i++) {
      final m = _moveHistory[i];
      if (m.player == player) n += m.captures.length;
    }
    return n;
  }

  Future<void> _connect() async {
    final chrome = _chrome;
    if (chrome == null) return;
    final gameId = _gameIdCtrl.text.trim();
    if (gameId.isEmpty) {
      setState(() => _error = chrome.gameIdRequired);
      return;
    }
    // Session-tier paint first (web spectate / lists parity); wipe only if no cache.
    final cached = QueryCache.read<GameStatePayload>(
      CacheKeys.gameState(gameId),
      maxAge: QueryCache.sessionTtl,
      allowStale: true,
    );
    setState(() {
      _error = null;
      _status = chrome.connectingStatus;
      _replayIndex = null;
      _liveVotes = null;
      if (cached != null) {
        _applyPayload(cached);
        _busy = false;
      } else {
        _busy = true;
        _board = null;
        _liveBoard = null;
        _boardSize = 0;
        _moveHistory = const [];
      }
    });
    try {
      await _sub?.cancel();
      await _ws.disconnect();

      // REST hydrate in background when cache already painted (web session-tier parity).
      final res = await http
          .get(Uri.parse('${ApiConfig.baseUrl}/api/v1/games/$gameId/state'))
          .timeout(const Duration(seconds: 15));
      if (!mounted) return;
      if (res.statusCode < 300) {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) {
          final payload = GameStatePayload.fromJson(decoded);
          QueryCache.write(CacheKeys.gameState(gameId), payload);
          setState(() {
            _applyPayload(payload);
          });
        }
      } else if (res.statusCode == 404) {
        setState(() {
          _error = chrome.unableToSpectate;
          _busy = false;
          _connected = false;
        });
        return;
      }

      if (_piecesPerSide == null) {
        final cached = QueryCache.read<GameRules>(
          CacheKeys.boardRulesPayload,
          maxAge: QueryCache.platformTtl,
          allowStale: true,
        );
        final cachedPcs = cached?.piecesPerSide;
        if (cachedPcs != null && cachedPcs > 0) {
          _piecesPerSide = cachedPcs;
        } else {
          try {
            final rules = await http
                .get(Uri.parse('${ApiConfig.baseUrl}/api/v1/game/rules'))
                .timeout(const Duration(seconds: 10));
            if (rules.statusCode < 300) {
              final gameRules = GameRules.fromJson(
                jsonDecode(rules.body) as Map<String, dynamic>,
              );
              QueryCache.write(CacheKeys.boardRulesPayload, gameRules);
              final pcs = gameRules.piecesPerSide;
              if (pcs != null && pcs > 0) _piecesPerSide = pcs;
            }
          } catch (_) {}
        }
      }

      await _ws
          .connectSpectate(gameId: gameId, token: widget.accessToken)
          .timeout(const Duration(seconds: 15));
      if (!mounted) return;
      _sub = _ws.messages.listen((msg) {
        if (!mounted) return;
        final chatGid = GameChatLive.gameIdFromWs(msg, fallbackGameId: gameId);
        if (chatGid != null) {
          if (msg['type'] == 'game_chat_message') {
            notifyIncomingChatMessage(
              myUserId: context.read<AuthCubit>().state.userId,
              payload: msg,
            );
          }
          GameChatLive.notify(chatGid);
          unawaited(_refreshChatUnread());
        }
        if (msg['type'] == 'welcome' && msg['feature_flags'] is Map) {
          // Snapshot only; UI menus hydrate from REST/GraphQL.
        }
        if (msg['type'] == 'vote_update' && msg['votes'] is Map) {
          setState(() {
            _liveVotes = Map<String, dynamic>.from(msg['votes'] as Map);
          });
        }
        if (msg['type'] == 'game_state') {
          final game = msg['game'];
          if (game is Map<String, dynamic>) {
            final payload = GameStatePayload.fromJson(game);
            // Web SpectateHub parity: envelope actor when resume clears pause fields.
            final envRole = (msg['actor_role'] as String?)?.trim() ?? '';
            final envName =
                (msg['actor_display_name'] as String?)?.trim() ?? '';
            if (_gamePaused &&
                _pauseKind.trim() == 'official' &&
                !payload.paused) {
              if (envRole.isNotEmpty) _lastOfficialActorRole = envRole;
              if (envName.isNotEmpty) _lastOfficialActorName = envName;
              _wasOfficialPause = true;
            }
            setState(() {
              _applyPayload(payload);
              _status = '${chrome.statusLiveMovesPrefix}${payload.moveCount}';
            });
            if (payload.outcome != null) {
              unawaited(GameNotify.play('info'));
            } else if (payload.moveCount > _lastMoveCount &&
                _lastMoveCount >= 0) {
              unawaited(GameNotify.play('your_turn'));
            }
            _lastMoveCount = payload.moveCount;
          }
        }
      });
      setState(() {
        _connected = true;
        _busy = false;
        if (_boardSize <= 0 && _board == null) {
          _status = chrome.waitingGameState;
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = chrome.unableToSpectate;
        _busy = false;
        _connected = false;
      });
    }
  }

  Future<void> _disconnect() async {
    final chrome = _chrome;
    await _sub?.cancel();
    await _ws.disconnect();
    if (!mounted) return;
    setState(() {
      _connected = false;
      _watchFocus = false;
      _watchTab = _WatchTab.moves;
      _busy = false;
      _board = null;
      _liveBoard = null;
      _boardSize = 0;
      _moveHistory = const [];
      _replayIndex = null;
      _liveVotes = null;
      _status = chrome?.disconnectedStatus;
    });
  }

  void _enterWatchFocus(_WatchTab tab) {
    setState(() {
      _watchTab = tab;
      _watchFocus = true;
    });
  }

  void _leaveWatchFocus() {
    setState(() => _watchFocus = false);
  }

  Future<void> _onWatchTab(_WatchTab tab) async {
    _enterWatchFocus(tab);
    if (tab == _WatchTab.chat) {
      final id = _gameIdCtrl.text.trim();
      if (id.isNotEmpty) await _openGameChat(id);
    }
  }

  bool get _isOfficialPause => _gamePaused && _pauseKind.trim() == 'official';

  String _spectatePauseFmt(
    String fmt, {
    String role = '',
    String name = '',
    String reason = '',
    String note = '',
  }) {
    var out = fmt.trim();
    if (out.isEmpty) return '';
    out = out.replaceAll('{role}', role.trim());
    out = out.replaceAll('{name}', name.trim());
    out = out.replaceAll('{reason}', reason.trim());
    out = out.replaceAll('{note}', note.trim());
    return out.trim();
  }

  String _spectateSinceLine() {
    // Official only: player pause uses countdown footer, not wall-clock since.
    if (!_isOfficialPause || !_gamePaused || _pausedAtUnixMs <= 0) return '';
    final fmt = (_officialPauseChrome?.bannerSinceFmt ?? '').trim();
    if (fmt.isEmpty) return '';
    final dt = DateTime.fromMillisecondsSinceEpoch(_pausedAtUnixMs).toLocal();
    final localizations = MaterialLocalizations.of(context);
    final time = localizations.formatTimeOfDay(
      TimeOfDay.fromDateTime(dt),
      alwaysUse24HourFormat: MediaQuery.alwaysUse24HourFormatOf(context),
    );
    if (time.trim().isEmpty) return '';
    return fmt.replaceAll('{time}', time.trim()).trim();
  }

  Widget? _spectatePauseCoverOverlay() {
    final chrome = _playChrome;
    final rail = _railChrome;
    // Rail optional: play_chrome supplies VS when rail lags (web SpectateHub parity).
    if (!_gamePaused || chrome == null) return null;
    if (_outcome != null || _draw) return null;
    final aria = chrome.pauseOverlayAria.trim();
    final status =
        (_isOfficialPause ? chrome.pauseKindOfficial : chrome.pauseKindPlayer)
            .trim();
    final railVs = (rail?.matchIntroVsLabel ?? '').trim();
    final vs = railVs.isNotEmpty ? railVs : chrome.matchIntroVsLabel.trim();
    if (aria.isEmpty || status.isEmpty || vs.isEmpty) return null;
    final role = _isOfficialPause
        ? (_officialPauseChrome?.roleLabel(_pauseActorRole) ?? '')
        : (chrome.rolePlayerLabel.trim().isNotEmpty
            ? chrome.rolePlayerLabel.trim()
            : (_officialPauseChrome?.roleLabel(_pauseActorRole) ?? ''));
    final name = _pauseActorDisplayName.trim();
    final byFmt = _isOfficialPause
        ? chrome.officialPausedByFmt
        : chrome.playerPausedByFmt;
    // Fail closed: never show hollow "Paused by ·" (fmt needs both role and name).
    final byLine = (role.isNotEmpty && name.isNotEmpty)
        ? _spectatePauseFmt(byFmt, role: role, name: name)
        : '';
    final reason = _pauseReasonLabel.trim();
    final reasonLine = _isOfficialPause && reason.isNotEmpty
        ? _spectatePauseFmt(chrome.officialPausedReasonFmt, reason: reason)
        : '';
    final note = _pauseNote.trim();
    final noteLine = _isOfficialPause && note.isNotEmpty
        ? _spectatePauseFmt(chrome.officialPausedNoteFmt, note: note)
        : '';
    final railNameMax =
        int.tryParse((rail?.livePlayerNameMaxChars ?? '').trim());
    final nameSuffix = rail?.nameTruncateSuffix ?? '';
    String trunc(String raw) {
      if (railNameMax == null ||
          railNameMax <= 0 ||
          nameSuffix.isEmpty ||
          raw.length <= railNameMax) {
        return raw;
      }
      return '${raw.substring(0, railNameMax)}$nameSuffix';
    }

    final whiteFallback = chrome.labelWhite.trim();
    final blackFallback = chrome.labelBlack.trim();
    final whiteName = trunc((_p1Card?.username ?? '').trim().isNotEmpty
        ? (_p1Card!.username).trim()
        : whiteFallback);
    final blackName = trunc((_p2Card?.username ?? '').trim().isNotEmpty
        ? (_p2Card!.username).trim()
        : blackFallback);
    return MatchPauseOverlay(
      vsLabel: vs,
      ariaLabel: aria,
      statusLabel: status,
      bannerLine: _isOfficialPause
          ? chrome.officialPausedBlurb.trim()
          : chrome.gamePausedBlurb.trim(),
      byLine: byLine,
      reasonLine: reasonLine,
      noteLine: noteLine,
      sinceLine: _spectateSinceLine(),
      footerLine: _isOfficialPause ? chrome.pauseOverlayUntilResume.trim() : '',
      footerLineFmt: _isOfficialPause ? '' : chrome.pauseRemainingFmt.trim(),
      expiresAtUnixMs: _isOfficialPause ? 0 : _pauseExpiresAtUnixMs,
      top: MatchIntroPlayer(
        username: blackName,
        avatarUrl: _p2Card?.avatarFullUrl ?? _p2Card?.avatarThumbUrl,
        countryCode: _p2Card?.countryCode,
        hostTrustTier: _p2Card?.hostTrustTier,
        hostTrustBadge: _p2Card?.hostTrustBadge,
      ),
      bottom: MatchIntroPlayer(
        username: whiteName,
        avatarUrl: _p1Card?.avatarFullUrl ?? _p1Card?.avatarThumbUrl,
        countryCode: _p1Card?.countryCode,
        hostTrustTier: _p1Card?.hostTrustTier,
        hostTrustBadge: _p1Card?.hostTrustBadge,
      ),
    );
  }

  /// Rail fallback when board-cover chrome/VS is incomplete (play match_board parity).
  Widget _spectatePauseRailFallback() {
    final chrome = _playChrome;
    if (!_gamePaused || chrome == null) return const SizedBox.shrink();
    if (_spectatePauseCoverOverlay() != null) return const SizedBox.shrink();
    final tokens = damaColorsOf(context);
    if (_isOfficialPause) {
      final lines = <String>[];
      final blurb = chrome.officialPausedBlurb.trim();
      if (blurb.isNotEmpty) lines.add(blurb);
      final role = _officialPauseChrome?.roleLabel(_pauseActorRole) ?? '';
      final name = _pauseActorDisplayName.trim();
      final byFmt = chrome.officialPausedByFmt.trim();
      if (byFmt.isNotEmpty && role.isNotEmpty && name.isNotEmpty) {
        final by = _spectatePauseFmt(byFmt, role: role, name: name);
        if (by.isNotEmpty) lines.add(by);
      }
      final reason = _pauseReasonLabel.trim();
      if (reason.isNotEmpty) {
        final line =
            _spectatePauseFmt(chrome.officialPausedReasonFmt, reason: reason);
        if (line.isNotEmpty) lines.add(line);
      }
      final note = _pauseNote.trim();
      if (note.isNotEmpty) {
        final line =
            _spectatePauseFmt(chrome.officialPausedNoteFmt, note: note);
        if (line.isNotEmpty) lines.add(line);
      }
      final since = _spectateSinceLine();
      if (since.isNotEmpty) lines.add(since);
      if (lines.isEmpty) return const SizedBox.shrink();
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < lines.length; i++) ...[
              if (i > 0) const SizedBox(height: 4),
              Text(
                lines[i],
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: i == 0 ? tokens.brand : tokens.onSurfaceMuted,
                      fontWeight: i == 0 ? FontWeight.w600 : FontWeight.w400,
                    ),
              ),
            ],
          ],
        ),
      );
    }
    final blurb = chrome.gamePausedBlurb.trim();
    if (blurb.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Text(
        blurb,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: tokens.onSurfaceMuted,
            ),
      ),
    );
  }

  @override
  void dispose() {
    _clockTimer?.cancel();
    _sub?.cancel();
    _chatLiveSub?.cancel();
    _ws.dispose();
    _gameIdCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    if (_chromeLoading) {
      return Scaffold(
        appBar: AppBar(
          leading: PlayerRailMenuLeading.maybe(context),
          actions: const [NotificationAppBarActions()],
        ),
        body: const Padding(
          padding: EdgeInsets.all(16),
          child: SpectatePageSkeleton(),
        ),
      );
    }
    final chrome = _chrome;
    if (chrome == null) {
      return Scaffold(
        appBar: AppBar(
          leading: PlayerRailMenuLeading.maybe(context),
          actions: const [NotificationAppBarActions()],
        ),
        body: Center(
          child: Text(
            (_chromeError ?? '').isNotEmpty ? _chromeError! : '',
            style: TextStyle(color: tokens.danger),
          ),
        ),
      );
    }
    final connectedId = _gameIdCtrl.text.trim();
    // Seat bars: time badge only (web BoardSeatBar parity).
    final p1ClockLabel =
        _clockEnabled ? _formatClockMs(_clockP1RemainingMs) : null;
    final p2ClockLabel =
        _clockEnabled ? _formatClockMs(_clockP2RemainingMs) : null;
    return Scaffold(
      appBar: AppBar(
        leading: PlayerRailMenuLeading.maybe(context),
        title: Text(chrome.pageTitle),
        actions: [
          if (_railChrome != null && _connected && connectedId.isNotEmpty) ...[
            IconButton(
              tooltip: _railChrome!.flipBoardAria,
              onPressed: () => setState(() => _flipBoard = !_flipBoard),
              icon: const Icon(Icons.flip_camera_android_outlined),
            ),
            IconButton(
              tooltip: _railChrome!.shareWatchAction,
              onPressed: () => unawaited(_shareWatchUrl()),
              icon: Icon(
                _shareCopied ? Icons.check : Icons.ios_share_outlined,
                color: _shareCopied ? tokens.online : null,
              ),
            ),
            IconButton(
              tooltip: _railChrome!.watchTabChat,
              onPressed: () {
                unawaited(_openGameChat(connectedId));
              },
              icon: Badge(
                isLabelVisible: _chatUnread > 0,
                label: Text(
                  _chatUnread > 99 ? '99+' : '$_chatUnread',
                  style: const TextStyle(
                      fontSize: 10, fontWeight: FontWeight.w700),
                ),
                child: const Icon(Icons.chat_bubble_outline),
              ),
            ),
          ],
          const NotificationAppBarActions(),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              chrome.pageBlurb,
              style: TextStyle(color: tokens.onSurfaceMuted),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _gameIdCtrl,
              enabled: !_connected,
              decoration: InputDecoration(
                labelText: chrome.gameIdLabel,
                border: const OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: _busy || _connected ? null : _connect,
                    child: Text(chrome.startAction),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: _connected ? _disconnect : null,
                    child: Text(chrome.disconnectAction),
                  ),
                ),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: TextStyle(color: tokens.danger)),
            ],
            if (_status != null && _board == null) ...[
              const SizedBox(height: 8),
              Text(_status!, style: TextStyle(color: tokens.gold)),
            ],
            if (_resumeBanner.trim().isNotEmpty) ...[
              const SizedBox(height: 8),
              DecoratedBox(
                decoration: BoxDecoration(
                  border: Border.all(color: tokens.border),
                  borderRadius: BorderRadius.circular(8),
                  color: tokens.card,
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          _resumeBanner,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: tokens.brand,
                                    fontWeight: FontWeight.w600,
                                  ),
                        ),
                      ),
                      if ((_officialPauseChrome?.confirmCancel ?? '')
                          .trim()
                          .isNotEmpty)
                        TextButton(
                          onPressed: () => setState(() => _resumeBanner = ''),
                          child: Text(
                            _officialPauseChrome!.confirmCancel.trim(),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
            if (_board != null) ...[
              const SizedBox(height: 8),
              GameTurnStatus(
                yourName: chrome.labelWhite,
                opponentName: chrome.labelBlack,
                yourTurnLabel: chrome.statusYourTurn,
                opponentTurnLabel: chrome.statusOpponentTurn,
                replayLabel: chrome.statusReplay,
                vsSeparator: chrome.seatMetaSeparator,
                mode: 'pvp',
                yourPlayer: 1,
                turn: _turn,
                yourCaptures: _capturesByPlayer(1),
                opponentCaptures: _capturesByPlayer(2),
                isBusy: false,
                replayIndex: _replayIndex,
                historyLength: _moveHistory.length,
                suppressTurnHints: _gamePaused ||
                    _endReason == 'clock_flag' ||
                    _endReason == 'clock_draw',
                statusBanner: () {
                  final onTime =
                      _endReason == 'clock_flag' || _endReason == 'clock_draw';
                  if (!onTime) return null;
                  if (_draw || _endReason == 'clock_draw') {
                    final s = chrome.statusDrawOnTime.trim();
                    return s.isEmpty ? null : s;
                  }
                  if (_outcome == 1) {
                    final s = chrome.statusP1WinsOnTime.trim();
                    return s.isEmpty ? null : s;
                  }
                  if (_outcome == 2) {
                    final s = chrome.statusP2WinsOnTime.trim();
                    return s.isEmpty ? null : s;
                  }
                  return null;
                }(),
              ),
              _spectatePauseRailFallback(),
            ],
            if (_connected &&
                connectedId.isNotEmpty &&
                (widget.accessToken ?? '').trim().isNotEmpty)
              OfficialPauseActivityStrip(
                accessToken: (widget.accessToken ?? '').trim(),
                gameId: connectedId,
                chrome: _officialPauseChrome,
                // API authz decides seats vs operators; pure spectators get 403 and strip hides.
                enabled: (widget.accessToken ?? '').trim().isNotEmpty &&
                    (_gamePaused ||
                        _resumeBanner.trim().isNotEmpty ||
                        (_outcome != null || _draw)),
                refreshToken: _pauseActivityRefresh,
              ),
            const SizedBox(height: 12),
            Expanded(
              child: _busy
                  ? const BoardGridSkeleton()
                  : _displayBoard == null || _boardSize <= 0
                      ? Center(
                          child: Text(
                            _connected
                                ? chrome.waitingBoard
                                : chrome.boardAfterConnect,
                            style: TextStyle(color: tokens.onSurfaceMuted),
                          ),
                        )
                      : PlayBoardFrame(
                          vsLabel: _railChrome?.vsSeparator ?? '',
                          coverOverlay: _spectatePauseCoverOverlay(),
                          topSeat: MatchSeatAvatars(
                            layout: MatchSeatBarLayout.sideColumn,
                            sideSlot: MatchSideSeatSlot.top,
                            yourPlayer: 1,
                            player1Id: _player1Id,
                            player2Id: _player2Id,
                            whitePieces: _whitePieces,
                            blackPieces: _blackPieces,
                            piecesPerSide: _piecesPerSide,
                            labelWhite: chrome.labelWhite,
                            labelBlack: chrome.labelBlack,
                            seatMetaSeparator: chrome.seatMetaSeparator,
                            clockLabel: p2ClockLabel,
                            clockActive: _outcome == null &&
                                !_draw &&
                                !_gamePaused &&
                                _endReason != 'clock_flag' &&
                                _endReason != 'clock_draw' &&
                                _activeClockPlayer == 2,
                            ratingParenOpen: _railChrome?.ratingParenOpen,
                            ratingParenClose: _railChrome?.ratingParenClose,
                            trailing: _railChrome != null
                                ? CompactBoardViewToggle(
                                    selected: _boardView,
                                    onChanged: _setBoardView,
                                    label2d: _railChrome!.boardView2d,
                                    label3d: _railChrome!.boardView3d,
                                  )
                                : null,
                            onChallenge: (req) =>
                                openCreateGameChallenge(context, req),
                          ),
                          bottomSeat: MatchSeatAvatars(
                            layout: MatchSeatBarLayout.sideColumn,
                            sideSlot: MatchSideSeatSlot.bottom,
                            yourPlayer: 1,
                            player1Id: _player1Id,
                            player2Id: _player2Id,
                            whitePieces: _whitePieces,
                            blackPieces: _blackPieces,
                            piecesPerSide: _piecesPerSide,
                            labelWhite: chrome.labelWhite,
                            labelBlack: chrome.labelBlack,
                            seatMetaSeparator: chrome.seatMetaSeparator,
                            clockLabel: p1ClockLabel,
                            clockActive: _outcome == null &&
                                !_draw &&
                                !_gamePaused &&
                                _endReason != 'clock_flag' &&
                                _endReason != 'clock_draw' &&
                                _activeClockPlayer == 1,
                            ratingParenOpen: _railChrome?.ratingParenOpen,
                            ratingParenClose: _railChrome?.ratingParenClose,
                            onChallenge: (req) =>
                                openCreateGameChallenge(context, req),
                          ),
                          // MatchBoardPage parity: shared palette + ply animation props.
                          board: BoardPaletteScope(
                            board: boardPaletteById(_boardPaletteId),
                            piece: piecePaletteById(_piecePaletteId),
                            child: _boardView == BoardViewMode.flat2d
                                ? DraughtsBoard2D(
                                    board: _displayBoard!,
                                    boardSize: _boardSize,
                                    legalMoves: const [],
                                    selectedRow: null,
                                    selectedCol: null,
                                    onSelectSquare: (_, __) {},
                                    interactive: false,
                                    yourPlayer: 1,
                                    flipBoard: _flipBoard,
                                    moveHistory: _replayIndex != null
                                        ? const []
                                        : _moveHistory,
                                    replayMode: _replayIndex != null,
                                    onPlyAnimated: _replayIndex == null
                                        ? (boardAfter) {
                                            setState(() => _board = boardAfter);
                                          }
                                        : null,
                                  )
                                : DraughtsBoard3D(
                                    board: _displayBoard!,
                                    boardSize: _boardSize,
                                    legalMoves: const [],
                                    selectedRow: null,
                                    selectedCol: null,
                                    onSelectSquare: (_, __) {},
                                    interactive: false,
                                    yourPlayer: 1,
                                    flipBoard: _flipBoard,
                                    moveHistory: _replayIndex != null
                                        ? const []
                                        : _moveHistory,
                                    onPlyAnimated: _replayIndex == null
                                        ? (boardAfter) {
                                            setState(() => _board = boardAfter);
                                          }
                                        : null,
                                  ),
                          ),
                        ),
            ),
            if (_moveHistory.isNotEmpty) ...[
              const SizedBox(height: 10),
              GameMoveHistoryBar(
                moves: _moveHistory,
                boardSize: _boardSize > 0 ? _boardSize : 0,
                replayIndex: _replayIndex,
                onSelectLive: () {
                  setState(() {
                    _replayIndex = null;
                    _board = _liveBoard;
                    _watchTab = _WatchTab.moves;
                    _watchFocus = true;
                  });
                },
                onSelectMove: (idx) {
                  setState(() {
                    _replayIndex = idx;
                    _watchTab = _WatchTab.moves;
                    _watchFocus = true;
                  });
                },
                liveLabel: chrome.liveLabel,
                historyLabel: chrome.historyLabel,
              ),
            ],
            if (_connected &&
                connectedId.isNotEmpty &&
                _railChrome != null) ...[
              const SizedBox(height: 10),
              MatchVotePanel(
                chrome: chrome,
                railChrome: _railChrome,
                gameId: connectedId,
                player1Id: _player1Id,
                player2Id: _player2Id,
                // Names hydrate from public-player API only (never chrome White/Black invent).
                player1Name: '',
                player2Name: '',
                accessToken: widget.accessToken,
                finished: _outcome != null,
                paused: _gamePaused,
                liveVotes: _liveVotes,
                compact: _watchFocus,
              ),
              const SizedBox(height: 8),
              _WatchTabBar(
                rail: _railChrome!,
                focus: _watchFocus,
                selected: _watchTab,
                chatUnread: _chatUnread,
                onBack: _leaveWatchFocus,
                onSelect: (tab) => unawaited(_onWatchTab(tab)),
              ),
              if (_watchFocus && _watchTab == _WatchTab.info) ...[
                const SizedBox(height: 8),
                _SpectateInfoStrip(
                  chrome: chrome,
                  whitePieces: _whitePieces,
                  blackPieces: _blackPieces,
                  outcome: _outcome,
                  draw: _draw,
                  endReason: _endReason,
                ),
              ],
            ] else if (_connected && connectedId.isNotEmpty) ...[
              const SizedBox(height: 10),
              MatchVotePanel(
                chrome: chrome,
                railChrome: _railChrome,
                gameId: connectedId,
                player1Id: _player1Id,
                player2Id: _player2Id,
                player1Name: '',
                player2Name: '',
                accessToken: widget.accessToken,
                finished: _outcome != null,
                paused: _gamePaused,
                liveVotes: _liveVotes,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

enum _WatchTab { moves, chat, info }

class _WatchTabBar extends StatelessWidget {
  const _WatchTabBar({
    required this.rail,
    required this.focus,
    required this.selected,
    required this.chatUnread,
    required this.onBack,
    required this.onSelect,
  });

  final PlayRailChrome rail;
  final bool focus;
  final _WatchTab selected;
  final int chatUnread;
  final VoidCallback onBack;
  final ValueChanged<_WatchTab> onSelect;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final tabs = <(_WatchTab, String)>[
      (_WatchTab.moves, rail.watchTabMoves),
      (_WatchTab.chat, rail.watchTabChat),
      (_WatchTab.info, rail.watchTabInfo),
    ];
    return Row(
      children: [
        if (focus)
          IconButton(
            tooltip: rail.watchPanelBackAria,
            onPressed: onBack,
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.chevron_left),
          ),
        Expanded(
          child: Row(
            children: [
              for (final t in tabs)
                Expanded(
                  child: InkWell(
                    onTap: () => onSelect(t.$1),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(
                            width: 2,
                            color: selected == t.$1
                                ? tokens.brand
                                : Colors.transparent,
                          ),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Flexible(
                            child: Text(
                              t.$2,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: selected == t.$1
                                    ? null
                                    : tokens.onSurfaceMuted,
                              ),
                            ),
                          ),
                          if (t.$1 == _WatchTab.chat && chatUnread > 0) ...[
                            const SizedBox(width: 4),
                            Badge(
                              label: Text(
                                chatUnread > 99 ? '99+' : '$chatUnread',
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SpectateInfoStrip extends StatelessWidget {
  const _SpectateInfoStrip({
    required this.chrome,
    required this.whitePieces,
    required this.blackPieces,
    this.outcome,
    this.draw = false,
    this.endReason,
  });

  final SpectateChrome chrome;
  final int? whitePieces;
  final int? blackPieces;
  final int? outcome;
  final bool draw;
  final String? endReason;

  String? get _resultStatus {
    final onTime = endReason == 'clock_flag' || endReason == 'clock_draw';
    if (draw || endReason == 'clock_draw') {
      return onTime ? chrome.statusDrawOnTime : chrome.statusDraw;
    }
    if (outcome == 1) {
      return onTime ? chrome.statusP1WinsOnTime : chrome.statusP1Wins;
    }
    if (outcome == 2) {
      return onTime ? chrome.statusP2WinsOnTime : chrome.statusP2Wins;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final w = whitePieces;
    final b = blackPieces;
    final sep = chrome.seatMetaSeparator;
    final whiteLine =
        w == null ? chrome.labelWhite : '${chrome.labelWhite}$sep$w';
    final blackLine =
        b == null ? chrome.labelBlack : '${chrome.labelBlack}$sep$b';
    final result = (_resultStatus ?? '').trim();
    return DecoratedBox(
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: tokens.borderSubtle.withValues(alpha: 0.6)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (result.isNotEmpty) ...[
              Text(result, style: const TextStyle(fontSize: 12)),
              const SizedBox(height: 6),
            ],
            Text(whiteLine, style: const TextStyle(fontSize: 12)),
            const SizedBox(height: 4),
            Text(blackLine, style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }
}
