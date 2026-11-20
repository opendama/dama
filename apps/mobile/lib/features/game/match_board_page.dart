import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/audio/game_notify.dart';
import 'package:dama_mobile/core/cache/query_cache.dart';
import 'package:dama_mobile/core/nav/dama_route_observer.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/network/auth_http.dart';
import 'package:dama_mobile/core/network/game_ws_client.dart';
import 'package:dama_mobile/core/prefs/board_palette_prefs.dart';
import 'package:dama_mobile/core/prefs/board_view_prefs.dart';
import 'package:dama_mobile/core/prefs/play_session_store.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/features/ads/in_match_ad_overlay.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/chat/chat_message_notify.dart';
import 'package:dama_mobile/features/chat/game_chat_api.dart';
import 'package:dama_mobile/features/chat/game_chat_live.dart';
import 'package:dama_mobile/features/chat/game_chat_sheet.dart';
import 'package:dama_mobile/features/chat/match_intro_overlay.dart';
import 'package:dama_mobile/features/chat/match_result_overlay.dart';
import 'package:dama_mobile/features/notifications/notification_app_bar_actions.dart';
import 'package:dama_mobile/features/auth/otp_session.dart';
import 'package:dama_mobile/features/game/apply_optimistic_draughts_move.dart';
import 'package:dama_mobile/features/game/draughts_board_2d.dart';
import 'package:dama_mobile/features/game/draughts_board_3d.dart';
import 'package:dama_mobile/features/game/game_move_history.dart';
import 'package:dama_mobile/features/game/game_turn_status.dart';
import 'package:dama_mobile/features/game/match_pause_overlay.dart';
import 'package:dama_mobile/features/game/matchmaking_realtime.dart';
import 'package:dama_mobile/features/game/official_pause_activity_strip.dart';
import 'package:dama_mobile/features/game/pause_active_game.dart';
import 'package:dama_mobile/features/game/play_board_frame.dart';
import 'package:dama_mobile/features/player/match_seat_avatars.dart';
import 'package:dama_mobile/features/player/open_create_game_challenge.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;
import 'package:share_plus/share_plus.dart';

/// Live 10x10 board page with real-time move sync.
class MatchBoardPage extends StatefulWidget {
  const MatchBoardPage({
    super.key,
    required this.accessToken,
    this.aiDepth,
    this.timeControlSeconds,
    this.gameId,
    this.mode = 'ai',

    /// When set, back exits in-place (no Navigator.pop) - home hub embed.
    this.onClose,
  });

  final String accessToken;
  final int? aiDepth;

  /// Required for VS-AI start - must match platform match_clock.presets.
  final int? timeControlSeconds;
  final String? gameId;
  final String mode;
  final VoidCallback? onClose;

  @override
  State<MatchBoardPage> createState() => _MatchBoardPageState();
}

class _MatchBoardPageState extends State<MatchBoardPage> with RouteAware {
  final _ws = GameWsClient();
  bool _routeAwareSubscribed = false;

  /// True while another route covers this board (push) - release FAB claim + pause.
  bool _routeCovered = false;
  StreamSubscription? _sub;
  String? _gameId;
  int _chatUnread = 0;
  StreamSubscription<String>? _chatLiveSub;
  List<List<dynamic>>? _board;
  int _boardSize = 0;
  BoardViewMode _boardView = BoardViewMode.flat2d;
  BoardPaletteId _boardPaletteId = BoardPaletteId.forest;
  PiecePaletteId _piecePaletteId = PiecePaletteId.whiteBlack;
  String? _status;
  String? _error;
  bool _busy = false;
  String? _player1Id;
  String? _player2Id;
  int _moveCount = 0;
  int? _halfmoveClock;
  int _whitePieces = 0;
  int _blackPieces = 0;
  PlayChrome? _chrome;
  OfficialPauseChrome? _officialPauseChrome;
  ProfileInspectChrome? _profileChrome;
  PlayRailChrome? _railChrome;
  bool _chromeLoading = true;

  /// null = follow seat orientation; otherwise override (manual flip).
  bool? _manualFlip;
  bool _shareCopied = false;
  bool _matchIntroVisible = false;
  bool _matchResultVisible = false;
  String? _matchIntroSeenGameId;
  String? _matchIntroPendingGameId;
  int? _piecesPerSide;
  String? _boardVariant;
  bool _clockEnabled = false;
  int _clockP1RemainingMs = 0;
  int _clockP2RemainingMs = 0;
  int _clockSyncP1Ms = 0;
  int _clockSyncP2Ms = 0;
  DateTime _clockSyncedAt = DateTime.now();
  bool _clockFlagClaimed = false;
  String? _clockFlagToastGameId;
  Timer? _clockTimer;

  /// DB `match_clock.presets` for observing strip timeLabel (no client invent).
  List<MatchClockPreset> _clockPresets = const [];

  /// DB `match_clock.pause_enabled` - fail-closed until progression hydrates.
  bool _pauseEnabled = false;
  int? _gameTimeControlSeconds;
  List<List<int>> _legalMoves = const [];
  List<LegalMoveDetail> _legalMoveDetails = const [];
  List<int>? _mustContinue;
  int? _selectedRow;
  int _illegalShakeKey = 0;
  int? _selectedCol;
  int _turn = 1;
  DateTime? _gameStartedAt;
  List<MoveHistoryEntry> _moveHistory = const [];

  /// null = Live; 1-based ply index after that move (smart-menu parity).
  int? _replayIndex;
  List<List<dynamic>>? _liveBoard;
  final Map<String, PublicPlayerCard> _seatPlayers = {};
  MatchmakingRealtimeController? _avatarRt;
  int _seenAvatarSeq = 0;
  bool _aiThinking = false;
  bool _abandoning = false;

  /// True while Stop confirm dialog is open (dismiss if official pause lands).
  bool _stopConfirmOpen = false;
  bool _paused = false;
  bool _pausing = false;
  bool _resuming = false;
  String _pauseKind = '';
  String _pauseReasonLabel = '';
  String _pauseNote = '';
  String _pauseActorRole = '';
  String _pauseActorDisplayName = '';
  int _pauseRemainingMs = 0;
  int _pauseExpiresAtUnixMs = 0;
  int _pausedAtUnixMs = 0;
  Timer? _pauseRemainTimer;
  _PauseSnap? _prevPause;
  String _resumeBanner = '';
  int _pauseActivityRefresh = 0;

  bool get _isOfficialPause => _paused && _pauseKind.trim() == 'official';
  String? _boundActiveId;
  String? _pendingAutoResumeToast;
  int? _outcome;
  bool _draw = false;
  String? _endReason;
  bool _gameOverVisible = false;
  bool _gameEndFxPlayed = false;
  Timer? _gameOverGrace;

  int? get _yourPlayer {
    final uid = context.read<AuthCubit>().state.userId;
    if (uid == null || uid.isEmpty) return null;
    if (_player1Id != null && uid == _player1Id) return 1;
    if (_player2Id != null && uid == _player2Id) return 2;
    return null;
  }

  bool get _isYourTurn {
    final yp = _yourPlayer;
    return yp != null && _turn == yp && _replayIndex == null;
  }

  /// Painted board has landed on the latest history snapshot (clock/highlight sync).
  bool get _boardPlySynced {
    if (_moveHistory.isEmpty) return true;
    final after = _moveHistory.last.boardAfter;
    if (after == null || after.isEmpty) return true;
    return _boardsMatch(_board, after);
  }

  /// Hide legal/must-continue until the piece lands (same predicate as clocks).
  bool get _showMoveHighlights => _isYourTurn && _boardPlySynced && !_paused;

  /// Seat clock follows animating ply (board behind board_after), then side-to-move.
  /// Prevents AI/server turn flips from lighting your clock mid-slide.
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

  bool get _yourClockActive {
    final yp = _yourPlayer;
    final cp = _activeClockPlayer;
    return yp != null && cp == yp;
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

  int _capturesByPlayer(int player) {
    final start = _piecesPerSide;
    if (start == null || start <= 0) return 0;
    final remaining = player == 1 ? _whitePieces : _blackPieces;
    return (start - remaining).clamp(0, start);
  }

  int get _yourCaptures {
    final yp = _yourPlayer;
    if (yp == null) return 0;
    final opp = yp == 1 ? 2 : 1;
    return _capturesByPlayer(opp);
  }

  int get _opponentCaptures {
    final yp = _yourPlayer;
    if (yp == null) return 0;
    return _capturesByPlayer(yp);
  }

  /// DB `id_truncate_chars` + `id_truncate_suffix` - never invent a fixed length.
  String _formatGameIdDisplay(String id, PlayChrome chrome) {
    final n = int.tryParse(chrome.idTruncateChars.trim());
    if (n == null || n <= 0) return id;
    if (id.length <= n) return id;
    return '${id.substring(0, n)}${chrome.idTruncateSuffix}';
  }

  String _seatDisplayName(int seat, PlayChrome chrome) {
    final id = seat == 1 ? _player1Id : _player2Id;
    final fromCard =
        id != null ? (_seatPlayers[id]?.username ?? '').trim() : '';
    if (fromCard.isNotEmpty) return fromCard;
    final auth = context.read<AuthCubit>().state;
    if (id != null &&
        auth.userId != null &&
        id == auth.userId &&
        (auth.username ?? '').trim().isNotEmpty) {
      return auth.username!.trim();
    }
    // Guests: palette color names instead of chrome White/Black.
    if (!auth.isAuthenticated) {
      final piece = piecePaletteById(_piecePaletteId);
      return seat == 1 ? piece.lightName : piece.darkName;
    }
    return seat == 1 ? chrome.labelWhite : chrome.labelBlack;
  }

  String _yourDisplayName(PlayChrome chrome) {
    final yp = _yourPlayer;
    if (yp == null) {
      final auth = context.read<AuthCubit>().state;
      if (!auth.isAuthenticated) {
        return piecePaletteById(_piecePaletteId).lightName;
      }
      return chrome.labelWhite;
    }
    return _seatDisplayName(yp, chrome);
  }

  String _opponentDisplayName(PlayChrome chrome) {
    if (widget.mode == 'ai') return chrome.playComputerAction;
    final yp = _yourPlayer;
    if (yp == null) {
      final auth = context.read<AuthCubit>().state;
      if (!auth.isAuthenticated) {
        return piecePaletteById(_piecePaletteId).darkName;
      }
      return chrome.labelBlack;
    }
    return _seatDisplayName(yp == 1 ? 2 : 1, chrome);
  }

  String _seatRatingParen(int seat, PlayRailChrome rail) {
    final id = seat == 1 ? _player1Id : _player2Id;
    if (id == null || id.isEmpty) return '';
    final rating = _seatPlayers[id]?.rating;
    if (rating == null || rating <= 0) return '';
    return '${rail.ratingParenOpen}$rating${rail.ratingParenClose}';
  }

  String _observingMatchup(PlayChrome chrome, PlayRailChrome rail) {
    final yp = _yourPlayer;
    final topSeat = yp == 1 ? 2 : 1;
    final bottomSeat = yp ?? 1;
    final top =
        '${_seatDisplayName(topSeat, chrome)}${_seatRatingParen(topSeat, rail)}';
    final bottom =
        '${_seatDisplayName(bottomSeat, chrome)}${_seatRatingParen(bottomSeat, rail)}';
    return '$top${rail.vsSeparator}$bottom';
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

  bool? _seatOnline(int seat) {
    if (widget.mode == 'ai' && seat == 2) return null;
    final id = seat == 1 ? _player1Id : _player2Id;
    if (id == null || id.isEmpty) return null;
    final card = _seatPlayers[id];
    if (card != null) return card.online;
    return null;
  }

  bool? _seatPlaying(int seat) {
    if (widget.mode == 'ai' && seat == 2) return null;
    final id = seat == 1 ? _player1Id : _player2Id;
    if (id == null || id.isEmpty) return null;
    final card = _seatPlayers[id];
    if (card != null) return card.playing;
    // In an active live board, seat is playing until card hydrates.
    return true;
  }

  bool? get _yourOnline {
    final yp = _yourPlayer;
    if (yp == null) return true;
    return _seatOnline(yp) ?? true;
  }

  bool? get _yourPlaying {
    final yp = _yourPlayer;
    if (yp == null) return true;
    return _seatPlaying(yp);
  }

  bool? get _opponentOnline {
    if (widget.mode == 'ai') return null;
    final yp = _yourPlayer;
    if (yp == null) return null;
    return _seatOnline(yp == 1 ? 2 : 1);
  }

  bool? get _opponentPlaying {
    if (widget.mode == 'ai') return null;
    final yp = _yourPlayer;
    if (yp == null) return null;
    return _seatPlaying(yp == 1 ? 2 : 1);
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
    if (uid != _player1Id && uid != _player2Id) return;
    final thumb = (rt.lastAvatarThumbUrl ?? '').trim();
    final full = (rt.lastAvatarFullUrl ?? '').trim();
    final clear = thumb.isEmpty && full.isEmpty;
    final existing = _seatPlayers[uid];
    if (existing == null) {
      unawaited(_hydrateSeatPlayers());
      return;
    }
    setState(() {
      _seatPlayers[uid] = existing.copyWith(
        clearAvatar: clear,
        avatarThumbUrl: clear ? null : (thumb.isNotEmpty ? thumb : full),
        avatarFullUrl: clear ? null : (full.isNotEmpty ? full : null),
      );
    });
  }

  Future<void> _hydrateSeatPlayers() async {
    final ids = <String>[
      if (_player1Id != null && _player1Id!.isNotEmpty) _player1Id!,
      if (_player2Id != null && _player2Id!.isNotEmpty) _player2Id!,
    ];
    if (ids.isEmpty) return;
    final next = <String, PublicPlayerCard>{};
    for (final id in ids) {
      final cached = QueryCache.read<PlayerDetailResponse>(
        CacheKeys.player(id),
        maxAge: QueryCache.sessionTtl,
        allowStale: true,
      );
      final player = cached?.player;
      if (player != null) next[id] = player;
    }
    final missing = ids.where((id) => !next.containsKey(id)).toList();
    if (missing.isEmpty) {
      if (!mounted) return;
      setState(() => _seatPlayers
        ..clear()
        ..addAll(next));
      return;
    }
    for (final id in missing) {
      try {
        final res = await http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/players/$id'),
        );
        if (res.statusCode >= 300) continue;
        final detail = PlayerDetailResponse.fromJson(
          jsonDecode(res.body) as Map<String, dynamic>,
        );
        QueryCache.write(CacheKeys.player(id), detail);
        final player = detail.player;
        if (player != null) next[id] = player;
      } catch (_) {}
    }
    if (!mounted) return;
    setState(() => _seatPlayers
      ..clear()
      ..addAll(next));
  }

  Future<void> _showMatchIntroAfterSeats(String gameId) async {
    final gid = gameId.trim();
    if (gid.isEmpty) return;
    await _hydrateSeatPlayers();
    if (!mounted) return;
    if (_matchIntroSeenGameId == gid) return;
    if (_matchIntroPendingGameId != gid) return;
    // Wait for rail chrome so VS intro duration/labels are DB-driven (no skip race).
    for (var i = 0; i < 50 && _railChrome == null; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 100));
      if (!mounted) return;
      if (_matchIntroPendingGameId != gid) return;
    }
    if (_railChrome == null) {
      // Fail closed: do not invent intro without chrome; mark seen so we don't loop.
      _matchIntroSeenGameId = gid;
      _matchIntroPendingGameId = null;
      return;
    }
    if (!mounted) return;
    if (_matchIntroSeenGameId == gid) return;
    if (_matchIntroPendingGameId != gid) return;
    setState(() {
      _matchIntroSeenGameId = gid;
      _matchIntroVisible = true;
      _matchIntroPendingGameId = null;
    });
  }

  List<List<dynamic>>? get _displayBoard {
    if (_replayIndex == null) return _board;
    if (_replayIndex! <= 0) return _liveBoard ?? _board;
    final idx = _replayIndex! - 1;
    if (idx < 0 || idx >= _moveHistory.length) return _board;
    return _moveHistory[idx].boardAfter ?? _board;
  }

  void _applyBoardPayload(GameStatePayload payload) {
    // Freeze parent board while history grows so the scene can animate plies.
    // Turn/legal/must_continue still update from the server, but highlights are
    // gated on _boardPlySynced so they do not flash onto a frozen pre-ply board.
    final incomingHist = payload.moveHistory;
    final histGrew = incomingHist.length > _moveHistory.length;
    if (payload.board != null) {
      _liveBoard = payload.board;
      if (_replayIndex == null && !histGrew) {
        // Same-ply WS (move_ack + game_state) must not snap the board mid-flight.
        final lastAfter = incomingHist.isNotEmpty
            ? incomingHist.last.boardAfter
            : (_moveHistory.isNotEmpty ? _moveHistory.last.boardAfter : null);
        if (lastAfter == null ||
            lastAfter.isEmpty ||
            _boardsMatch(_board, lastAfter)) {
          _board = payload.board;
        }
      }
    }
    if (_replayIndex == null) {
      _legalMoves = payload.legalMoves;
      _legalMoveDetails = payload.legalMoveDetails;
      _mustContinue = payload.mustContinue;
    }
    // Preserve local board_after snapshots when the server omits them.
    if (incomingHist.isNotEmpty && _moveHistory.isNotEmpty) {
      final merged = <MoveHistoryEntry>[];
      for (var i = 0; i < incomingHist.length; i++) {
        final entry = incomingHist[i];
        if (entry.boardAfter != null && entry.boardAfter!.isNotEmpty) {
          merged.add(entry);
          continue;
        }
        if (i < _moveHistory.length &&
            _moveHistory[i].boardAfter != null &&
            _moveHistory[i].boardAfter!.isNotEmpty) {
          merged.add(
            MoveHistoryEntry(
              from: entry.from,
              to: entry.to,
              captures: entry.captures,
              player: entry.player,
              boardAfter: _moveHistory[i].boardAfter,
            ),
          );
        } else {
          merged.add(entry);
        }
      }
      _moveHistory = merged;
    } else {
      _moveHistory = incomingHist;
    }
    _boardSize = payload.size;
    final prevP1 = _player1Id;
    final prevP2 = _player2Id;
    _player1Id = payload.player1Id ?? _player1Id;
    _player2Id = payload.player2Id ?? _player2Id;
    if (_player1Id != prevP1 || _player2Id != prevP2) {
      unawaited(_hydrateSeatPlayers());
    }
    final gid = (payload.gameId ?? '').trim();
    final seatsReady = widget.mode == 'ai' ||
        ((_player1Id ?? '').isNotEmpty && (_player2Id ?? '').isNotEmpty);
    if ((widget.mode == 'pvp' || widget.mode == 'ai') &&
        gid.isNotEmpty &&
        seatsReady &&
        _matchIntroSeenGameId != gid &&
        _matchIntroPendingGameId != gid) {
      // Match-start only: require explicit move_count == 0 (missing → no intro).
      if (payload.hasMoveCount) {
        if (payload.moveCount > 0) {
          _matchIntroSeenGameId = gid;
        } else {
          // Wait for seat bios (web LivePlayHub parity) before starting the VS intro.
          _matchIntroPendingGameId = gid;
          unawaited(_showMatchIntroAfterSeats(gid));
        }
      }
    }
    final tc = payload.timeControlSeconds ?? 0;
    if (tc > 0) _gameTimeControlSeconds = tc;
    _observePause(payload);
    if (!payload.clockActive) {
      // Server disarmed (flag-fall / finished) - stop interpolating (spectate parity).
      _clockEnabled = false;
      _clockTimer?.cancel();
      _clockSyncP1Ms = payload.clockP1RemainingMs;
      _clockSyncP2Ms = payload.clockP2RemainingMs;
      _clockP1RemainingMs = _clockSyncP1Ms;
      _clockP2RemainingMs = _clockSyncP2Ms;
    } else {
      _clockEnabled = true;
      _applyServerClock(
        p1Ms: payload.clockP1RemainingMs,
        p2Ms: payload.clockP2RemainingMs,
      );
    }
    _moveCount = payload.moveCount;
    _halfmoveClock = payload.halfmoveClock;
    _turn = payload.turn;
    final incomingOutcome =
        payload.outcome is num ? (payload.outcome as num).toInt() : _outcome;
    if (payload.draw) _draw = true;
    if (incomingOutcome != null) _outcome = incomingOutcome;
    final endReason = (payload.endReason ?? '').trim();
    if (endReason.isNotEmpty) _endReason = endReason;
    final clockEnded = _endReason == 'clock_flag' || _endReason == 'clock_draw';
    if (clockEnded &&
        (_outcome != null || payload.draw || _draw) &&
        gid.isNotEmpty &&
        _clockFlagToastGameId != gid) {
      _clockFlagToastGameId = gid;
      final chrome = _chrome;
      var label = '';
      if (chrome != null) {
        final yp = _yourPlayer;
        if (yp != null) {
          // Seated: on-time result copy only (fail closed - no generic toast invent).
          if (_endReason == 'clock_draw' || _draw) {
            label = chrome.youDrewOnTimeMessage.trim();
          } else if (_outcome == yp) {
            label = chrome.youWonOnTimeMessage.trim();
          } else if (_outcome == 1 || _outcome == 2) {
            label = chrome.youLostOnTimeMessage.trim();
          }
        } else {
          label = chrome.toastClockFlag.trim();
        }
      }
      if (label.isNotEmpty && mounted) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(label)));
        });
      }
    }
    // Wipe fallback when server outcome is briefly missing.
    // Clock endings: ForcedOutcome / clock_draw own the result - never invent a board wipe winner.
    final clockOwned = _endReason == 'clock_flag' || _endReason == 'clock_draw';
    if (_outcome == null && !_draw && !clockOwned) {
      final after = incomingHist.isNotEmpty
          ? incomingHist.last.boardAfter
          : payload.board;
      if (after != null) {
        final wipe = winnerFromBoard(after);
        if (wipe != null) _outcome = wipe;
      }
    }
    final pieceBoard = _liveBoard ?? _board;
    _whitePieces = GameStatePayload.countPlayerPieces(pieceBoard, 1);
    _blackPieces = GameStatePayload.countPlayerPieces(pieceBoard, 2);
    if (!histGrew && _replayIndex == null) {
      _selectedRow = null;
      _selectedCol = null;
    }
    if (gid.isNotEmpty) {
      QueryCache.write(CacheKeys.gameState(gid), payload);
    }
    _syncStoredSession();
    _flushAutoResumeToast();
  }

  void _bindActiveBoard(String? id) {
    final next = (id ?? '').trim();
    final current = _boundActiveId ?? '';
    if (current == next) {
      // Re-claim after a covering route pops, even when the id is unchanged.
      if (!_routeCovered && next.isNotEmpty) {
        PlaySessionStore.instance.setActiveBoardGameId(next);
      }
      return;
    }
    if (current.isNotEmpty &&
        PlaySessionStore.instance.activeBoardGameId == current) {
      PlaySessionStore.instance.setActiveBoardGameId(null);
    }
    _boundActiveId = next.isEmpty ? null : next;
    if (!_routeCovered && next.isNotEmpty) {
      PlaySessionStore.instance.setActiveBoardGameId(next);
    }
  }

  void _clearActiveBoardClaim() {
    if (_boundActiveId != null &&
        PlaySessionStore.instance.activeBoardGameId == _boundActiveId) {
      PlaySessionStore.instance.setActiveBoardGameId(null);
    }
  }

  /// Server pause when leaving the visible board (tab dispose or covered push).
  void _pauseBecauseLeftSurface() {
    final pauseId = (_gameId ?? '').trim();
    final shouldPause = pauseId.isNotEmpty &&
        _pauseEnabled &&
        _outcome == null &&
        !_draw &&
        !_isOfficialPause &&
        !_paused;
    final token = widget.accessToken.trim();
    if (!shouldPause || token.isEmpty) return;
    final mode = widget.mode;
    final messenger = ScaffoldMessenger.maybeOf(context);
    final toastPaused = (_chrome?.toastPaused ?? '').trim();
    final chrome = _chrome;
    unawaited(() async {
      try {
        final payload = await pauseGameOnLeave(
          token,
          pauseId,
          mode: mode,
        );
        if (payload == null || toastPaused.isEmpty) return;
        messenger?.showSnackBar(SnackBar(content: Text(toastPaused)));
      } on PauseGameException catch (e) {
        if (isLeavePauseSilentError(e.errorKey)) return;
        final msg = pauseFailureLabel(chrome, e.errorKey, PauseFailKind.pause);
        if (msg.isNotEmpty) {
          messenger?.showSnackBar(SnackBar(content: Text(msg)));
        }
      } catch (_) {
        final msg = pauseFailureLabel(chrome, '', PauseFailKind.pause);
        if (msg.isNotEmpty) {
          messenger?.showSnackBar(SnackBar(content: Text(msg)));
        }
      }
    }());
  }

  @override
  void didPushNext() {
    _routeCovered = true;
    _clearActiveBoardClaim();
    _pauseBecauseLeftSurface();
  }

  @override
  void didPopNext() {
    _routeCovered = false;
    final id = (_boundActiveId ?? _gameId ?? '').trim();
    if (id.isNotEmpty) {
      PlaySessionStore.instance.setActiveBoardGameId(id);
    }
  }

  void _observePause(GameStatePayload payload) {
    final id = (payload.gameId ?? _gameId ?? '').trim();
    final paused = payload.paused;
    final prev = _prevPause;
    final prevOfficial = prev != null && prev.paused && prev.official;
    _prevPause = _PauseSnap(
      id,
      paused,
      payload.isOfficialPause,
      payload.pauseActorRole,
      payload.pauseActorDisplayName,
    );
    final prevReason = _pauseReasonLabel;
    final prevNote = _pauseNote;
    _paused = paused;
    _pauseKind = paused ? payload.pauseKind.trim() : '';
    _pauseReasonLabel = paused ? payload.pauseReasonLabel.trim() : '';
    _pauseNote = paused ? payload.pauseNote.trim() : '';
    _pauseActorRole = paused ? payload.pauseActorRole.trim() : '';
    _pauseActorDisplayName = paused ? payload.pauseActorDisplayName.trim() : '';
    _pauseRemainingMs = paused ? payload.pauseRemainingMs : 0;
    _pauseExpiresAtUnixMs = paused ? payload.pauseExpiresAtUnixMs : 0;
    _pausedAtUnixMs = paused ? payload.pausedAtUnixMs : 0;
    if (paused != (prev?.paused ?? false) ||
        payload.isOfficialPause != (prev?.official ?? false) ||
        (paused &&
            (_pauseReasonLabel != prevReason || _pauseNote != prevNote))) {
      _pauseActivityRefresh++;
    }
    _syncPauseRemainTimer();
    if (prev == null || prev.id.isEmpty || id.isEmpty || prev.id != id) return;
    if (prev.paused && !paused) {
      unawaited(PlaySessionStore.instance.patchPaused(false));
      if (PlaySessionStore.instance.takeManualResume()) return;
      if (prevOfficial) {
        final role = _officialRoleLabel(prev.actorRole);
        final name = prev.actorName.trim();
        // Fail closed: never show hollow "Resumed by ·" (fmt needs both role and name).
        if (role.isNotEmpty && name.isNotEmpty) {
          final bannerFmt =
              (_officialPauseChrome?.bannerResumedFmt ?? '').trim();
          final banner = bannerFmt.isEmpty
              ? ''
              : bannerFmt
                  .replaceAll('{role}', role)
                  .replaceAll('{name}', name)
                  .trim();
          if (banner.isNotEmpty) _resumeBanner = banner;
          final toastFmt = (_chrome?.officialResumedToastFmt ?? '').trim();
          final toast = toastFmt.isEmpty
              ? ''
              : toastFmt
                  .replaceAll('{role}', role)
                  .replaceAll('{name}', name)
                  .trim();
          if (toast.isNotEmpty) _pendingAutoResumeToast = toast;
        }
        return;
      }
      final msg = (_chrome?.toastAutoResumed ?? '').trim();
      if (msg.isNotEmpty) _pendingAutoResumeToast = msg;
      return;
    }
    if (!prev.paused && paused) {
      final expires = payload.pauseExpiresAtUnixMs;
      unawaited(
        PlaySessionStore.instance.patchPaused(
          true,
          pauseExpiresAtUnixMs: expires > 0 ? expires : null,
          pauseKind: payload.pauseKind,
        ),
      );
    } else if (prev.paused &&
        paused &&
        prev.official != payload.isOfficialPause) {
      unawaited(
        PlaySessionStore.instance.patchPaused(
          true,
          pauseExpiresAtUnixMs: payload.pauseExpiresAtUnixMs > 0
              ? payload.pauseExpiresAtUnixMs
              : null,
          pauseKind: payload.pauseKind,
        ),
      );
    }
    // Web LivePlayHub parity: close sticky Stop confirm under official pause.
    if (payload.isOfficialPause && _stopConfirmOpen && mounted) {
      _stopConfirmOpen = false;
      final nav = Navigator.of(context, rootNavigator: true);
      if (nav.canPop()) nav.pop(false);
    }
  }

  String _officialRoleLabel(String role) {
    final ops = _officialPauseChrome;
    if (ops == null) return '';
    return ops.roleLabel(role);
  }

  /// Player pause role from play_chrome first so seat clients do not wait on ops chrome.
  String _pauseByRoleLabel(PlayChrome chrome) {
    if (_isOfficialPause) return _officialRoleLabel(_pauseActorRole);
    final fromPlay = chrome.rolePlayerLabel.trim();
    if (fromPlay.isNotEmpty) return fromPlay;
    return _officialRoleLabel(_pauseActorRole);
  }

  String _officialPauseSinceLine() {
    // Official only: player pause uses countdown footer, not wall-clock since.
    if (!_isOfficialPause || !_paused || _pausedAtUnixMs <= 0) return '';
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

  List<String> _officialPauseBannerLines(PlayChrome chrome) {
    if (!_isOfficialPause) return const [];
    final lines = <String>[];
    final blurb = chrome.officialPausedBlurb.trim();
    if (blurb.isNotEmpty) lines.add(blurb);
    final byFmt = chrome.officialPausedByFmt.trim();
    if (byFmt.isNotEmpty) {
      final role = _officialRoleLabel(_pauseActorRole);
      final name = _pauseActorDisplayName.trim();
      // Fail closed: never show hollow "Paused by ·" (fmt needs both role and name).
      if (role.isNotEmpty && name.isNotEmpty) {
        final by =
            byFmt.replaceAll('{role}', role).replaceAll('{name}', name).trim();
        if (by.isNotEmpty) lines.add(by);
      }
    }
    final reasonFmt = chrome.officialPausedReasonFmt.trim();
    final reason = _pauseReasonLabel.trim();
    if (reasonFmt.isNotEmpty && reason.isNotEmpty) {
      final line = reasonFmt.replaceAll('{reason}', reason).trim();
      if (line.isNotEmpty) lines.add(line);
    }
    final noteFmt = chrome.officialPausedNoteFmt.trim();
    final note = _pauseNote.trim();
    if (noteFmt.isNotEmpty && note.isNotEmpty) {
      final line = noteFmt.replaceAll('{note}', note).trim();
      if (line.isNotEmpty) lines.add(line);
    }
    final since = _officialPauseSinceLine();
    if (since.isNotEmpty) lines.add(since);
    return lines;
  }

  void _syncPauseRemainTimer() {
    _pauseRemainTimer?.cancel();
    _pauseRemainTimer = null;
    if (!_paused) {
      _pauseRemainingMs = 0;
      return;
    }
    int remainingFromWall() {
      if (_pauseExpiresAtUnixMs > 0) {
        return (_pauseExpiresAtUnixMs - DateTime.now().millisecondsSinceEpoch)
            .clamp(0, 1 << 31);
      }
      return _pauseRemainingMs.clamp(0, 1 << 31);
    }

    _pauseRemainingMs = remainingFromWall();
    if (_pauseRemainingMs <= 0) return;
    _pauseRemainTimer = Timer.periodic(const Duration(milliseconds: 250), (_) {
      if (!mounted || !_paused) {
        _pauseRemainTimer?.cancel();
        _pauseRemainTimer = null;
        return;
      }
      final next = remainingFromWall();
      setState(() => _pauseRemainingMs = next);
      if (next <= 0) {
        _pauseRemainTimer?.cancel();
        _pauseRemainTimer = null;
      }
    });
  }

  String _pauseRemainingLine(PlayChrome chrome) {
    final fmt = chrome.pauseRemainingFmt.trim();
    if (!_paused || fmt.isEmpty || _pauseRemainingMs <= 0) return '';
    final total = (_pauseRemainingMs / 1000).ceil().clamp(0, 1 << 31);
    final m = total ~/ 60;
    final s = total % 60;
    final time = '$m:${s.toString().padLeft(2, '0')}';
    return fmt.replaceAll('{time}', time).trim();
  }

  void _flushAutoResumeToast() {
    final msg = _pendingAutoResumeToast;
    if (msg == null || msg.isEmpty) return;
    _pendingAutoResumeToast = null;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    });
  }

  void _syncStoredSession() {
    final id = (_gameId ?? '').trim();
    if (id.isEmpty) return;
    final finished = _outcome != null || _draw;
    final mode = widget.mode.toLowerCase() == 'pvp' ? 'pvp' : 'ai';
    var paused = !finished && (_paused || isPauseInflight(id));
    // Covered / leave-pause may set session before local _paused catches WS.
    if (!paused && !finished) {
      final existing = PlaySessionStore.instance.session;
      if (existing != null &&
          existing.gameId == id &&
          existing.paused &&
          (_routeCovered ||
              PlaySessionStore.instance.activeBoardGameId != id)) {
        return;
      }
    }
    final expires = paused ? _pauseExpiresAtUnixMs : 0;
    unawaited(
      PlaySessionStore.instance.store(
        StoredPlaySession(
          gameId: id,
          mode: mode,
          phase: finished ? 'finished' : 'playing',
          paused: paused,
          pauseExpiresAtUnixMs: expires > 0 ? expires : 0,
          pauseKind: paused ? _pauseKind.trim() : '',
          updatedAt: DateTime.now().toUtc().toIso8601String(),
        ),
      ),
    );
  }

  Future<void> _pauseGame(PlayChrome chrome) async {
    final id = (_gameId ?? '').trim();
    if (!_pauseEnabled) return;
    if (id.isEmpty || _pausing || _paused || _outcome != null || _draw) return;
    setState(() => _pausing = true);
    try {
      final payload = await postGamePause(widget.accessToken, id);
      if (!mounted) return;
      setState(() {
        _applyBoardPayload(payload);
        _pausing = false;
      });
      final msg = chrome.toastPaused.trim();
      if (msg.isNotEmpty && mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
    } on PauseGameException catch (e) {
      if (!mounted) return;
      final msg = pauseFailureLabel(chrome, e.errorKey, PauseFailKind.pause);
      setState(() => _pausing = false);
      if (msg.isNotEmpty) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
    } catch (_) {
      if (!mounted) return;
      final msg = pauseFailureLabel(chrome, '', PauseFailKind.pause);
      setState(() => _pausing = false);
      if (msg.isNotEmpty) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
    }
  }

  Future<void> _resumeGame(PlayChrome chrome) async {
    final id = (_gameId ?? '').trim();
    if (id.isEmpty || _resuming || !_paused) return;
    if (_isOfficialPause) {
      final msg = chrome.errOfficiallyPaused.trim();
      if (msg.isNotEmpty && mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
      return;
    }
    setState(() => _resuming = true);
    PlaySessionStore.instance.markManualResume();
    try {
      final payload = await postGameResume(widget.accessToken, id);
      if (!mounted) {
        PlaySessionStore.instance.takeManualResume();
        return;
      }
      setState(() {
        _applyBoardPayload(payload);
        _resuming = false;
      });
      PlaySessionStore.instance.takeManualResume();
      final msg = chrome.toastResumed.trim();
      if (msg.isNotEmpty && mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
    } on PauseGameException catch (e) {
      PlaySessionStore.instance.takeManualResume();
      if (!mounted) return;
      final msg = pauseFailureLabel(chrome, e.errorKey, PauseFailKind.resume);
      setState(() => _resuming = false);
      if (msg.isNotEmpty) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
    } catch (_) {
      PlaySessionStore.instance.takeManualResume();
      if (!mounted) return;
      final msg = pauseFailureLabel(chrome, '', PauseFailKind.resume);
      setState(() => _resuming = false);
      if (msg.isNotEmpty) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
    }
  }

  Widget _pauseControls(PlayChrome chrome) {
    final playing = (_gameId ?? '').isNotEmpty &&
        _outcome == null &&
        !_draw &&
        !_gameOverVisible;
    if (!playing) return const SizedBox.shrink();
    final tokens = damaColorsOf(context);
    // MatchPauseOverlay owns pause copy when cover chrome + VS are ready (rail optional).
    final vsReady =
        (_railChrome?.matchIntroVsLabel.trim().isNotEmpty ?? false) ||
            chrome.matchIntroVsLabel.trim().isNotEmpty;
    final overlayOwnsCopy = _paused &&
        vsReady &&
        chrome.pauseOverlayAria.trim().isNotEmpty &&
        (_isOfficialPause
            ? chrome.pauseKindOfficial.trim().isNotEmpty
            : chrome.pauseKindPlayer.trim().isNotEmpty);
    if (_isOfficialPause) {
      // Prefer board blur cover; rail banner only if overlay cannot render.
      if (overlayOwnsCopy) return const SizedBox.shrink();
      final lines = _officialPauseBannerLines(chrome);
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
    // When admin disables pause, still show Resume if already paused.
    final canPause = _pauseEnabled;
    final label = (_paused
            ? chrome.resumeGameAction
            : (canPause ? chrome.pauseGameAction : ''))
        .trim();
    final pendingLabel =
        (_paused ? chrome.resumeGamePending : chrome.pauseGamePending).trim();
    final blurb =
        (_paused && !overlayOwnsCopy) ? chrome.gamePausedBlurb.trim() : '';
    final remainingLine = overlayOwnsCopy ? '' : _pauseRemainingLine(chrome);
    if (label.isEmpty && blurb.isEmpty && remainingLine.isEmpty) {
      return const SizedBox.shrink();
    }
    final pending = _paused ? _resuming : _pausing;
    final shown = pending && pendingLabel.isNotEmpty ? pendingLabel : label;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (blurb.isNotEmpty)
            Text(
              blurb,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: tokens.onSurfaceMuted,
                  ),
            ),
          if (remainingLine.isNotEmpty) ...[
            if (blurb.isNotEmpty) const SizedBox(height: 4),
            Text(
              remainingLine,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: tokens.brand,
                fontWeight: FontWeight.w600,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
          if (label.isNotEmpty) ...[
            if (blurb.isNotEmpty || remainingLine.isNotEmpty)
              const SizedBox(height: 8),
            if (_paused)
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: tokens.brand,
                  foregroundColor: tokens.onBrand,
                  disabledBackgroundColor: tokens.brand.withValues(alpha: 0.5),
                  disabledForegroundColor: tokens.onBrand,
                ),
                onPressed:
                    pending ? null : () => unawaited(_resumeGame(chrome)),
                child: Text(shown),
              )
            else if (canPause)
              OutlinedButton(
                onPressed: pending ? null : () => unawaited(_pauseGame(chrome)),
                child: Text(shown),
              ),
          ],
        ],
      ),
    );
  }

  bool _terminalBoardSynced() {
    if (_outcome == null && !_draw) return true;
    if (_moveHistory.isEmpty) return true;
    final after = _moveHistory.last.boardAfter;
    if (after == null || after.isEmpty || _board == null) return true;
    if (after.length != _board!.length) return false;
    for (var r = 0; r < after.length; r++) {
      if (after[r].length != _board![r].length) return false;
      for (var c = 0; c < after[r].length; c++) {
        final a = after[r][c];
        final b = _board![r][c];
        final ap = a is Map ? a['p'] : null;
        final bp = b is Map ? b['p'] : null;
        final ak = a is Map ? a['k'] == true : false;
        final bk = b is Map ? b['k'] == true : false;
        if (ap != bp || ak != bk) return false;
      }
    }
    return true;
  }

  void _scheduleGameOverIfNeeded() {
    if (_outcome == null && !_draw) return;
    _gameOverGrace?.cancel();
    if (_terminalBoardSynced()) {
      // Never nest setState; reveal on the next frame.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _revealGameOver();
      });
      return;
    }
    _gameOverGrace = Timer(const Duration(milliseconds: 2200), () {
      if (!mounted) return;
      if (_moveHistory.isNotEmpty &&
          _moveHistory.last.boardAfter != null &&
          _moveHistory.last.boardAfter!.isNotEmpty) {
        setState(() {
          _board = _moveHistory.last.boardAfter;
          _liveBoard = _board;
        });
      }
      _revealGameOver();
    });
  }

  void _revealGameOver() {
    if (!mounted) return;
    if (_gameOverVisible) {
      _playGameEndFxOnce();
      return;
    }
    setState(() {
      _gameOverVisible = true;
      _matchResultVisible = true;
      _selectedRow = null;
      _selectedCol = null;
      _matchIntroVisible = false;
      // 1-based last ply so the board shows the final snapshot.
      _replayIndex = _moveHistory.isEmpty ? null : _moveHistory.length;
    });
    _playGameEndFxOnce();
  }

  void _playGameEndFxOnce() {
    if (_gameEndFxPlayed) return;
    _gameEndFxPlayed = true;
    if (_draw) {
      unawaited(GameNotify.play('info'));
      return;
    }
    final yp = _yourPlayer;
    final outcome = _outcome;
    if (outcome == null) return;
    final youWon = yp != null && outcome == yp;
    unawaited(GameNotify.play(youWon ? 'win' : 'loss'));
  }

  bool get _clockOwnedEnd =>
      _endReason == 'clock_flag' || _endReason == 'clock_draw';

  /// On-time strip during land-animation grace (fail closed - never Your turn).
  String? _clockOwnedStatusBanner(PlayChrome chrome) {
    if (!_clockOwnedEnd) return null;
    if (_draw || _endReason == 'clock_draw') {
      final drew = chrome.youDrewOnTimeMessage.trim();
      return drew.isEmpty ? null : drew;
    }
    final yp = _yourPlayer;
    final outcome = _outcome;
    if (outcome == null || yp == null) return null;
    if (outcome == yp) {
      final won = chrome.youWonOnTimeMessage.trim();
      return won.isEmpty ? null : won;
    }
    final lost = chrome.youLostOnTimeMessage.trim();
    return lost.isEmpty ? null : lost;
  }

  String? _outcomeMessage(PlayChrome chrome) {
    if (!_gameOverVisible) return null;
    final onTime = _clockOwnedEnd;
    // Fail closed on clock endings: on-time DB copy only (never generic You won / gameOverTitle).
    if (onTime) {
      return _clockOwnedStatusBanner(chrome);
    }
    if (_draw) return chrome.statusDraw;
    final yp = _yourPlayer;
    final outcome = _outcome;
    if (outcome == null) return chrome.gameOverTitle;
    if (yp != null) {
      if (outcome == yp) return chrome.youWonMessage;
      return chrome.youLostMessage;
    }
    return chrome.gameOverTitle;
  }

  bool _canSelectPiece(int row, int col) {
    final mc = _mustContinue;
    if (mc != null && mc.length >= 2) {
      return mc[0] == row && mc[1] == col;
    }
    final captureMoves =
        _legalMoves.where((m) => m.length >= 5 && m[4] > 0).toList();
    final forced =
        captureMoves.isNotEmpty && captureMoves.length == _legalMoves.length;
    if (forced) {
      return captureMoves.any((m) => m[0] == row && m[1] == col);
    }
    return true;
  }

  void _onSquareTap(int row, int col) {
    if (_paused) {
      final official = (_chrome?.errOfficiallyPaused ?? '').trim();
      final specific = (_chrome?.errGamePaused ?? '').trim();
      final blurb = (_chrome?.gamePausedBlurb ?? '').trim();
      final label = _isOfficialPause && official.isNotEmpty
          ? official
          : (specific.isNotEmpty ? specific : blurb);
      if (label.isNotEmpty && mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(label)));
      }
      return;
    }
    if (_busy || _board == null || _gameId == null || _replayIndex != null)
      return;
    final yp = _yourPlayer;
    if (yp == null || _turn != yp) return;
    final cell = _board![row][col];
    if (_selectedRow == null || _selectedCol == null) {
      if (cell is Map && cell['p'] == yp && _canSelectPiece(row, col)) {
        setState(() {
          _selectedRow = row;
          _selectedCol = col;
        });
      }
      return;
    }
    if (_selectedRow == row && _selectedCol == col) {
      if (_mustContinue == null) {
        setState(() {
          _selectedRow = null;
          _selectedCol = null;
        });
      }
      return;
    }
    if (cell is Map && cell['p'] == yp && _canSelectPiece(row, col)) {
      setState(() {
        _selectedRow = row;
        _selectedCol = col;
      });
      return;
    }
    final legal = _legalMoves.any(
      (m) =>
          m[0] == _selectedRow &&
          m[1] == _selectedCol &&
          m[2] == row &&
          m[3] == col,
    );
    if (!legal) {
      setState(() {
        _illegalShakeKey += 1;
        _error = _chrome?.toastIllegalSquare ?? '';
      });
      return;
    }
    // Optimistic ply: animate immediately; do not hold `_busy` for WS/AI RTT.
    final fromR = _selectedRow!;
    final fromC = _selectedCol!;
    final optimistic = applyOptimisticDraughtsMove(
      board: _board,
      turn: _turn,
      yourPlayer: yp,
      size: _boardSize,
      legalMoveDetails: _legalMoveDetails,
      moveHistory: _moveHistory,
      moveCount: _moveCount,
      fromR: fromR,
      fromC: fromC,
      toR: row,
      toC: col,
    );
    setState(() {
      _selectedRow = null;
      _selectedCol = null;
      _error = null;
      if (optimistic != null) {
        _turn = optimistic.turn;
        _mustContinue = optimistic.mustContinue;
        _legalMoves = optimistic.legalMoves;
        _legalMoveDetails = optimistic.legalMoveDetails;
        _moveCount = optimistic.moveCount;
        _moveHistory = optimistic.moveHistory;
        if (optimistic.outcome != null) _outcome = optimistic.outcome;
        // Keep `_board` frozen; scene commits board_after on put-down.
      }
    });
    if (optimistic?.outcome != null) _scheduleGameOverIfNeeded();
    _ws.sendMove({
      'game_id': _gameId,
      'from': [fromR, fromC],
      'to': [row, col],
    });
  }

  @override
  void initState() {
    super.initState();
    final seeded = (widget.gameId ?? '').trim();
    if (seeded.isNotEmpty) _bindActiveBoard(seeded);
    unawaited(_loadPlayChrome());
    unawaited(_loadProfileInspectChrome());
    unawaited(_loadProgression());
    unawaited(_loadBoardRules());
    unawaited(_bootstrapGame());
    unawaited(_loadBoardView());
    unawaited(_loadBoardPalette());
    unawaited(_loadPiecePalette());
    _chatLiveSub = GameChatLive.stream.listen((gid) {
      if (gid == (_gameId ?? '').trim()) unawaited(_refreshChatUnread());
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _bindAvatarRt());
  }

  Future<void> _refreshChatUnread() async {
    final id = (_gameId ?? '').trim();
    final token = widget.accessToken.trim();
    if (id.isEmpty || token.isEmpty) return;
    final res = await fetchGameChat(id, token: token);
    if (!mounted || res.payload == null) return;
    setState(() => _chatUnread = res.payload!.unreadCount);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    if (!_routeAwareSubscribed && route is PageRoute) {
      damaRouteObserver.subscribe(this, route);
      _routeAwareSubscribed = true;
    }
    _bindAvatarRt();
  }

  Future<void> _loadBoardView() async {
    final mode = await readBoardViewMode();
    if (!mounted) return;
    setState(() => _boardView = mode);
  }

  Future<void> _setBoardView(BoardViewMode mode) async {
    setState(() => _boardView = mode);
    await writeBoardViewMode(mode);
  }

  Future<void> _loadBoardPalette() async {
    final id = await readBoardPaletteId();
    if (!mounted) return;
    setState(() => _boardPaletteId = id);
  }

  Future<void> _loadPiecePalette() async {
    final id = await readPiecePaletteId();
    if (!mounted) return;
    setState(() => _piecePaletteId = id);
  }

  /// Wait for OTP verify when required (web /play auto-start parity).
  Future<void> _bootstrapGame() async {
    final uid = context.read<AuthCubit>().state.userId;
    for (var i = 0; i < 150; i++) {
      if (!mounted) return;
      var otpRequired = false;
      try {
        final res = await authGet(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/feature-flags'),
          token: null, // public flags; no bounce
        );
        if (res.statusCode == 200) {
          final map = jsonDecode(res.body);
          if (map is Map<String, dynamic>) {
            otpRequired = map['otp_required'] == true;
          }
        }
      } catch (_) {}
      if (!otpRequired || await isOtpSessionVerified(uid)) break;
      await Future<void>.delayed(const Duration(milliseconds: 200));
    }
    if (!mounted) return;
    if (widget.gameId != null && widget.gameId!.isNotEmpty) {
      await _attachExistingGame(widget.gameId!);
    } else {
      await _startAiGame();
    }
  }

  Future<void> _loadPlayChrome() async {
    try {
      final results = await Future.wait([
        http.get(Uri.parse('${ApiConfig.baseUrl}/api/v1/public/play-chrome')),
        http.get(
            Uri.parse('${ApiConfig.baseUrl}/api/v1/public/play-rail-chrome')),
        http.get(
          Uri.parse(
            '${ApiConfig.baseUrl}/api/v1/public/official-pause-chrome',
          ),
        ),
      ]);
      Map<String, dynamic>? map;
      Map<String, dynamic>? railMap;
      Map<String, dynamic>? opsMap;
      try {
        final decoded = jsonDecode(results[0].body);
        if (decoded is Map<String, dynamic>) map = decoded;
      } catch (_) {}
      try {
        final decoded = jsonDecode(results[1].body);
        if (decoded is Map<String, dynamic>) railMap = decoded;
      } catch (_) {}
      try {
        final decoded = jsonDecode(results[2].body);
        if (decoded is Map<String, dynamic>) opsMap = decoded;
      } catch (_) {}
      final chrome = PlayChrome.fromJson(map);
      final rail = PlayRailChrome.fromJson(railMap);
      final ops = OfficialPauseChrome.fromJson(opsMap);
      if (!mounted) return;
      setState(() {
        _chrome = chrome;
        _railChrome = rail;
        _officialPauseChrome = ops;
        _chromeLoading = false;
        if (chrome == null) {
          _error = (map?['play_chrome_unavailable'] as String?)?.trim() ?? '';
        } else {
          _ws.connectionErrorMessage = chrome.toastWsConnectionError;
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _chromeLoading = false;
        _error = '';
      });
    }
  }

  bool get _seatFlip {
    final uid = context.read<AuthCubit>().state.userId;
    return uid != null && _player2Id != null && uid == _player2Id;
  }

  bool get _flipBoard => _manualFlip ?? _seatFlip;

  Future<void> _shareGameUrl() async {
    final id = (_gameId ?? widget.gameId ?? '').trim();
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
    // Share is for watchers - same spectate deep-link as SpectatePage (not seat resume).
    final url = '$origin/?view=spectate&gameId=${Uri.encodeComponent(id)}';
    try {
      await Share.share(url, subject: rail.shareGameAria);
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

  Future<void> _loadProfileInspectChrome() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/public/profile-inspect-chrome'),
      );
      Map<String, dynamic>? map;
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) map = decoded;
      } catch (_) {}
      if (res.statusCode != 200) return;
      final chrome = ProfileInspectChrome.fromJson(map);
      if (!mounted || chrome == null) return;
      setState(() => _profileChrome = chrome);
    } catch (_) {}
  }

  Future<void> _loadBoardRules() async {
    final cached = QueryCache.read<GameRules>(
      CacheKeys.boardRulesPayload,
      maxAge: QueryCache.platformTtl,
      allowStale: true,
    );
    if (cached != null && mounted) {
      setState(() {
        _piecesPerSide = cached.piecesPerSide;
        _boardVariant = cached.variant;
      });
    }
    try {
      final res =
          await http.get(Uri.parse('${ApiConfig.baseUrl}/api/v1/game/rules'));
      if (res.statusCode >= 300) return;
      final rules =
          GameRules.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
      QueryCache.write(CacheKeys.boardRulesPayload, rules);
      if (!mounted) return;
      setState(() {
        _piecesPerSide = rules.piecesPerSide;
        _boardVariant = rules.variant;
      });
    } catch (_) {
      // Fail closed: no invented pieces_per_side.
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
        _pauseEnabled = clock.pauseEnabled;
        // Do not enable seat clocks here - only game_state.clock_active arms UI.
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
        _pauseEnabled = clock.pauseEnabled;
      });
    } catch (_) {
      // Fail closed: no clock without server config.
    }
  }

  void _applyServerClock({required int p1Ms, required int p2Ms}) {
    _clockSyncP1Ms = p1Ms < 0 ? 0 : p1Ms;
    _clockSyncP2Ms = p2Ms < 0 ? 0 : p2Ms;
    _clockP1RemainingMs = _clockSyncP1Ms;
    _clockP2RemainingMs = _clockSyncP2Ms;
    _clockSyncedAt = DateTime.now();
    _clockFlagClaimed = false;
    _restartClockTimer();
  }

  void _restartClockTimer() {
    _clockTimer?.cancel();
    if (!_clockEnabled || _outcome != null || _draw || _paused) return;
    _clockTimer = Timer.periodic(const Duration(milliseconds: 250), (_) {
      if (!mounted || _outcome != null || _draw || _paused) return;
      final activeSeat = _activeClockPlayer;
      final elapsed = DateTime.now().difference(_clockSyncedAt).inMilliseconds;
      var p1 = _clockSyncP1Ms;
      var p2 = _clockSyncP2Ms;
      if (activeSeat == 1) {
        p1 = (_clockSyncP1Ms - elapsed).clamp(0, 1 << 62);
      } else if (activeSeat == 2) {
        p2 = (_clockSyncP2Ms - elapsed).clamp(0, 1 << 62);
      }
      final active = activeSeat == 1
          ? p1
          : activeSeat == 2
              ? p2
              : 1;
      setState(() {
        _clockP1RemainingMs = p1;
        _clockP2RemainingMs = p2;
      });
      if (activeSeat != null && active <= 0 && !_clockFlagClaimed) {
        _clockFlagClaimed = true;
        _claimClockFlag();
        // Server may reject a premature tick; allow another claim after 2s.
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted && _outcome == null && !_draw) {
            _clockFlagClaimed = false;
          }
        });
      }
    });
  }

  void _claimClockFlag() {
    final gid = (_gameId ?? '').trim();
    if (gid.isEmpty) return;
    if (_ws.isConnected) {
      _ws.send({'type': 'clock_flag', 'game_id': gid});
      return;
    }
    // REST fallback when the game socket is down (server still authoritative).
    final tok = widget.accessToken.trim();
    if (tok.isEmpty) return;
    unawaited(() async {
      try {
        final res = await http.post(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/games/$gid/clock-flag'),
          headers: {
            'Authorization': 'Bearer $tok',
            'Accept': 'application/json',
          },
        );
        if (res.statusCode >= 300 || !mounted) return;
        final map = jsonDecode(res.body);
        if (map is! Map<String, dynamic>) return;
        final payload = GameStatePayload.fromJson(map);
        setState(() => _applyBoardPayload(payload));
      } catch (_) {
        // Fail closed; periodic tick may retry after cooldown.
      }
    }());
  }

  String _formatClockMs(int ms) {
    final s = ms <= 0 ? 0 : ms ~/ 1000;
    final m = s ~/ 60;
    final r = s % 60;
    return '$m:${r.toString().padLeft(2, '0')}';
  }

  Future<void> _attachExistingGame(String id) async {
    setState(() {
      _error = null;
      _gameId = id;
    });
    _bindActiveBoard(id);
    // Session-tier paint (web useGameStateQuery / lists parity): show cache first.
    final cached = QueryCache.read<GameStatePayload>(
      CacheKeys.gameState(id),
      maxAge: QueryCache.sessionTtl,
      allowStale: true,
    );
    if (cached != null && mounted) {
      setState(() {
        _applyBoardPayload(cached);
        if (_boardSize > 0) {
          _status = _chrome?.statusMatched ?? '';
          _busy = false;
          _gameStartedAt ??= DateTime.now();
        }
      });
    } else if (mounted) {
      setState(() => _busy = true);
    }
    // Background refresh only - never flip busy back on when cache already painted.
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/games/$id/state'),
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      if (res.statusCode >= 300) {
        if (cached == null && mounted) {
          setState(() {
            _error = _chrome?.toastLoadFailed ?? '';
            _busy = false;
          });
        }
        return;
      }
      final payload = GameStatePayload.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      QueryCache.write(CacheKeys.gameState(id), payload);
      setState(() {
        _applyBoardPayload(payload);
        if (_boardSize <= 0) {
          _error = _chrome?.toastLoadFailed ?? '';
          _busy = false;
          return;
        }
        _status = _chrome?.statusMatched ?? '';
        _busy = false;
        _gameStartedAt ??= DateTime.now();
      });
      _scheduleGameOverIfNeeded();
      if (_error != null) return;
      await _ws.connectGame(token: widget.accessToken, gameId: id);
      await GameNotify.play('match_found');
      _sub = _ws.messages.listen(_onWsMessage);
    } catch (_) {
      setState(() {
        _error = _chrome?.toastLoadFailed ?? '';
        _busy = false;
      });
    }
  }

  void _onWsMessage(Map<String, dynamic> msg) {
    if (!mounted) return;
    final chatGid = GameChatLive.gameIdFromWs(msg, fallbackGameId: _gameId);
    if (chatGid != null) {
      if (msg['type'] == 'game_chat_message') {
        notifyIncomingChatMessage(
          myUserId: context.read<AuthCubit>().state.userId,
          payload: msg,
        );
      }
      GameChatLive.notify(chatGid);
      unawaited(_refreshChatUnread());
      return;
    }
    if (msg['type'] == 'welcome') {
      setState(
          () => _status = '${_chrome?.statusWsPrefix ?? ''}${msg['room']}');
      return;
    }
    if (msg['type'] == 'ai_thinking') {
      setState(() => _aiThinking = msg['thinking'] == true);
      return;
    }
    if (msg['type'] == 'error') {
      // Terminal board already applied - do not surface ledger/finish errors as a failed move.
      if (_outcome != null || _draw) {
        setState(() {
          _busy = false;
          _aiThinking = false;
        });
        return;
      }
      final errKey = (msg['error_key']?.toString() ?? '').trim();
      // Fail closed: WS pause rejects send error_key only (empty English).
      final pauseByKey =
          errKey == 'err_officially_paused' || errKey == 'err_game_paused';
      if (pauseByKey) {
        final official = (_chrome?.errOfficiallyPaused ?? '').trim();
        final specific = (_chrome?.errGamePaused ?? '').trim();
        final blurb = (_chrome?.gamePausedBlurb ?? '').trim();
        final preferOfficial = errKey == 'err_officially_paused';
        final label = preferOfficial && official.isNotEmpty
            ? official
            : (specific.isNotEmpty ? specific : blurb);
        setState(() {
          _busy = false;
          _aiThinking = false;
          if (label.isNotEmpty) _error = label;
        });
        if (label.isNotEmpty && mounted) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(label)));
        }
        return;
      }
      // Fail closed: prefer error_key; never invent from WS English body (web parity).
      if (errKey == 'err_clock_still_running' ||
          errKey == 'err_match_clock_inactive' ||
          errKey == 'not_a_seat') {
        setState(() {
          _busy = false;
          _aiThinking = false;
        });
        return;
      }
      if (errKey == 'err_clock_flag' ||
          errKey == 'err_clock_flag_failed' ||
          errKey == 'clock_flag_failed') {
        final label = (_chrome?.toastClockFlagFailed ?? '').trim();
        setState(() {
          _busy = false;
          _aiThinking = false;
        });
        if (label.isNotEmpty && mounted) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(label)));
        }
        return;
      }
      final moveFailed = (_chrome?.toastMoveFailed ?? '').trim();
      setState(() {
        _busy = false;
        _aiThinking = false;
        if (moveFailed.isNotEmpty) _error = moveFailed;
      });
      return;
    }
    if (msg['type'] == 'move_ack' || msg['type'] == 'game_state') {
      final game = msg['game'];
      if (game is Map<String, dynamic>) {
        final payload = GameStatePayload.fromJson(game);
        // Web LivePlayHub parity: envelope actor when resume clears pause fields.
        final envRole = (msg['actor_role'] as String?)?.trim() ?? '';
        final envName = (msg['actor_display_name'] as String?)?.trim() ?? '';
        if (_isOfficialPause && !payload.paused) {
          final id = (_gameId ?? '').trim();
          _prevPause = _PauseSnap(
            id,
            true,
            true,
            envRole.isNotEmpty ? envRole : _pauseActorRole,
            envName.isNotEmpty ? envName : _pauseActorDisplayName,
          );
        }
        setState(() {
          _aiThinking = false;
          _applyBoardPayload(payload);
          _busy = false;
          _status =
              '${_chrome?.statusSyncedMovesPrefix ?? ''}${payload.moveCount}';
        });
        _scheduleGameOverIfNeeded();
      }
    }
  }

  Future<void> _confirmAbandon(PlayChrome chrome) async {
    final id = _gameId;
    if (id == null || id.isEmpty || _abandoning || _isOfficialPause) return;
    _stopConfirmOpen = true;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(chrome.stopGameConfirmTitle),
        content: Text(chrome.stopGameConfirmDescription),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(chrome.stopGameConfirmCancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(chrome.stopGameConfirmConfirm),
          ),
        ],
      ),
    );
    _stopConfirmOpen = false;
    if (ok != true || !mounted) return;
    // Official pause may land while the confirm dialog was open (web sticky Stop parity).
    if (_isOfficialPause) {
      final msg = chrome.errOfficiallyPaused.trim();
      if (msg.isNotEmpty) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
      return;
    }
    setState(() => _abandoning = true);
    try {
      final res = await authPost(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/games/$id/abandon'),
        token: widget.accessToken,
        body: '{}',
      );
      if (res.statusCode >= 300) {
        if (mounted) {
          var errKey = '';
          try {
            final decoded = jsonDecode(res.body);
            if (decoded is Map) {
              errKey = (decoded['error_key'] as String?)?.trim() ?? '';
            }
          } catch (_) {}
          final official = chrome.errOfficiallyPaused.trim();
          final stopFail = chrome.stopGameFailed.trim();
          final msg = (errKey == 'err_officially_paused' && official.isNotEmpty)
              ? official
              : stopFail;
          setState(() {
            _error = msg;
            _abandoning = false;
          });
          if (msg.isNotEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(msg)),
            );
          }
          // Stay on board under official pause (web LivePlayHub isOfficialPause parity),
          // including races where error_key is missing but local state already flipped.
          if (errKey == 'err_officially_paused' ||
              errKey == 'officially_paused' ||
              _isOfficialPause) {
            return;
          }
          // Embedded VS-AI: leave board even if abandon failed (web endLocalSession parity).
          if (widget.mode == 'ai' && widget.onClose != null) {
            widget.onClose!();
          }
        }
        return;
      }
      final payload = GameStatePayload.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      if (!mounted) return;
      setState(() {
        _applyBoardPayload(payload);
        _abandoning = false;
        _aiThinking = false;
        _busy = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(chrome.stopGameSuccess)),
        );
      }
      // Embedded VS-AI: return to Play lobby after stop (web HomePlayHub parity).
      if (widget.mode == 'ai' && widget.onClose != null) {
        widget.onClose!();
        return;
      }
      _scheduleGameOverIfNeeded();
    } catch (_) {
      if (mounted) {
        if (_isOfficialPause) {
          final official = chrome.errOfficiallyPaused.trim();
          setState(() {
            _error = official;
            _abandoning = false;
          });
          if (official.isNotEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(official)),
            );
          }
          return;
        }
        final stopFail = chrome.stopGameFailed.trim();
        setState(() {
          _error = stopFail;
          _abandoning = false;
        });
        if (stopFail.isNotEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(stopFail)),
          );
        }
        if (widget.mode == 'ai' && widget.onClose != null) {
          widget.onClose!();
        }
      }
    }
  }

  Future<void> _startAiGame() async {
    final depth = widget.aiDepth;
    if (depth == null) {
      setState(() => _error = _chrome?.toastAiDepthRequired ?? '');
      return;
    }
    final tc = widget.timeControlSeconds;
    if (tc == null || tc <= 0) {
      setState(() => _error = _chrome?.toastStartFailed ?? '');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await authPost(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/games/start'),
        token: widget.accessToken,
        body: jsonEncode({
          'mode': widget.mode,
          'ai_search_depth': depth,
          'time_control_seconds': tc,
        }),
      );
      if (res.statusCode >= 300) {
        setState(() {
          _error = _chrome?.toastStartFailed ?? '';
          _busy = false;
        });
        return;
      }
      final payload = GameStatePayload.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      final id = payload.gameId;
      setState(() {
        _gameId = id;
        _bindActiveBoard(id);
        _applyBoardPayload(payload);
        if (_boardSize <= 0) {
          _error = _chrome?.toastLoadFailed ?? '';
          _busy = false;
          return;
        }
        _status = _chrome?.statusStarted ?? '';
        _busy = false;
        _gameStartedAt ??= DateTime.now();
      });
      if (_error != null) return;
      if (id != null) {
        await _ws.connectGame(token: widget.accessToken, gameId: id);
        await GameNotify.play('match_found');
        _sub = _ws.messages.listen(_onWsMessage);
      }
    } catch (e) {
      setState(() {
        _error = _chrome?.toastStartFailed ?? '';
        _busy = false;
      });
    }
  }

  @override
  void dispose() {
    if (_routeAwareSubscribed) {
      damaRouteObserver.unsubscribe(this);
      _routeAwareSubscribed = false;
    }
    _pauseRemainTimer?.cancel();
    _pauseRemainTimer = null;
    _clearActiveBoardClaim();
    // Tab switch / embed close: pause unless a covering route already did.
    if (!_routeCovered) {
      _pauseBecauseLeftSurface();
    }
    _avatarRt?.removeListener(_onAvatarRt);
    _avatarRt = null;
    _chatLiveSub?.cancel();
    _clockTimer?.cancel();
    _gameOverGrace?.cancel();
    _sub?.cancel();
    _ws.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final chrome = _chrome;
    final boardPending = _displayBoard == null || _boardSize <= 0;
    // Single full-column BoardGridSkeleton for chrome+board wait - never a second,
    // smaller skeleton inside Expanded (that was the old→new flash).
    if (_chromeLoading || chrome == null || boardPending) {
      return PopScope(
        canPop: widget.onClose == null,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) widget.onClose?.call();
        },
        child: Scaffold(
          appBar: AppBar(
            leading: widget.onClose != null
                ? IconButton(
                    icon: const BackButtonIcon(),
                    onPressed: widget.onClose,
                  )
                : null,
            title: chrome == null ? null : Text(chrome.liveBoardTitle),
            actions: const [NotificationAppBarActions()],
          ),
          body: const Padding(
            padding: EdgeInsets.all(16),
            child: BoardGridSkeleton(),
          ),
        ),
      );
    }
    final titleSize = _boardSize > 0 ? _boardSize : null;
    final sep = chrome.seatMetaSeparator;
    final authed = context.watch<AuthCubit>().state.isAuthenticated;
    final piece = piecePaletteById(_piecePaletteId);
    final court = pieceSeatNames(piece);
    final seatLight = authed ? chrome.labelWhite : court.light;
    final seatDark = authed ? chrome.labelBlack : court.dark;
    // Seat bars: dual authoritative clocks (web BoardSeatBar parity).
    final yourMs = _yourPlayer == 2 ? _clockP2RemainingMs : _clockP1RemainingMs;
    final oppMs = _yourPlayer == 2 ? _clockP1RemainingMs : _clockP2RemainingMs;
    final yourClockLabel = _clockEnabled ? _formatClockMs(yourMs) : null;
    final oppClockLabel = _clockEnabled ? _formatClockMs(oppMs) : null;
    return PopScope(
      canPop: widget.onClose == null,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) widget.onClose?.call();
      },
      child: Scaffold(
        appBar: AppBar(
          leading: widget.onClose != null
              ? IconButton(
                  icon: const BackButtonIcon(),
                  onPressed: widget.onClose,
                )
              : null,
          title: Text(
            titleSize == null
                ? chrome.liveBoardTitle
                : '${chrome.liveBoardTitle} $titleSize${chrome.boardSizeSeparator}$titleSize',
          ),
          actions: [
            if (_railChrome != null &&
                _gameId != null &&
                _gameId!.isNotEmpty) ...[
              IconButton(
                tooltip: _railChrome!.flipBoardAria,
                onPressed: () {
                  setState(() => _manualFlip = !(_manualFlip ?? _seatFlip));
                },
                icon: const Icon(Icons.flip_camera_android_outlined),
              ),
              IconButton(
                tooltip: _railChrome!.shareGameAria,
                onPressed: () => unawaited(_shareGameUrl()),
                icon: Icon(
                  _shareCopied ? Icons.check : Icons.ios_share_outlined,
                  color: _shareCopied ? damaColorsOf(context).online : null,
                ),
              ),
            ],
            if (_gameId != null &&
                _gameId!.isNotEmpty &&
                _board != null &&
                !_isOfficialPause)
              TextButton(
                onPressed: _abandoning
                    ? null
                    : () => unawaited(_confirmAbandon(chrome)),
                child: Text(
                  _abandoning ? chrome.stopGamePending : chrome.stopGameAction,
                ),
              ),
            if (_gameId != null &&
                _gameId!.isNotEmpty &&
                widget.mode == 'pvp' &&
                _railChrome != null)
              IconButton(
                tooltip: _railChrome!.watchTabChat,
                onPressed: () {
                  unawaited(() async {
                    await showGameChatSheet(
                      context,
                      chrome: _railChrome!,
                      gameId: _gameId!,
                      accessToken: widget.accessToken,
                      observingLabel: _railChrome!.observingGameLabel,
                      observingMatchup: _observingMatchup(chrome, _railChrome!),
                      observingTimeLabel: _observingTimeLabel(),
                    );
                    if (mounted) unawaited(_refreshChatUnread());
                  }());
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
            const NotificationAppBarActions(),
          ],
        ),
        body: Stack(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_gameId != null && _gameId!.isNotEmpty)
                    Text(
                      '${chrome.labelGame}${chrome.labelValueSeparator}${_formatGameIdDisplay(_gameId!, chrome)}',
                    ),
                  if (_status != null && _yourPlayer == null)
                    Text('${chrome.statusPrefix}: $_status'),
                  Text('${chrome.labelMoves}: $_moveCount'),
                  if (_halfmoveClock != null)
                    Text('${chrome.labelHalfmove}: $_halfmoveClock'),
                  if (_boardVariant != null && _boardVariant!.isNotEmpty)
                    Text('${chrome.labelRules}: $_boardVariant'),
                  if (_board != null)
                    Text(
                      '${chrome.labelPieces}${chrome.labelValueSeparator}$seatLight${chrome.pieceCountSeparator}$_whitePieces$sep$seatDark${chrome.pieceCountSeparator}$_blackPieces',
                    ),
                  if (_gameOverVisible) ...[
                    const SizedBox(height: 10),
                    // Web LivePlayHub parity: plain result stack (no tinted Material /
                    // ColorScheme outline that can read as a blue border).
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          chrome.gameOverTitle,
                          style:
                              Theme.of(context).textTheme.titleSmall?.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                        ),
                        if (_outcomeMessage(chrome) != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            _outcomeMessage(chrome)!,
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(
                                  color: damaColorsOf(context).onSurfaceMuted,
                                ),
                          ),
                        ],
                        if (widget.mode != 'pvp') ...[
                          const SizedBox(height: 10),
                          FilledButton(
                            onPressed: _busy
                                ? null
                                : () {
                                    setState(() {
                                      _outcome = null;
                                      _draw = false;
                                      _gameOverVisible = false;
                                      _gameEndFxPlayed = false;
                                      _replayIndex = null;
                                      _board = null;
                                      _matchResultVisible = false;
                                      _matchIntroVisible = false;
                                      _matchIntroSeenGameId = null;
                                      _matchIntroPendingGameId = null;
                                      _moveHistory = const [];
                                      _gameId = null;
                                      _bindActiveBoard(null);
                                      _paused = false;
                                      _pauseKind = '';
                                      _pauseReasonLabel = '';
                                      _pauseNote = '';
                                      _pauseActorRole = '';
                                      _pauseActorDisplayName = '';
                                    });
                                    unawaited(_startAiGame());
                                  },
                            child: Text(chrome.restartAction),
                          ),
                        ],
                      ],
                    ),
                  ],
                  if (_error != null && _error!.isNotEmpty)
                    Text(_error!,
                        style: TextStyle(color: damaColorsOf(context).danger)),
                  if (_resumeBanner.trim().isNotEmpty) ...[
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: damaColorsOf(context).border,
                          ),
                          borderRadius: BorderRadius.circular(8),
                          color: damaColorsOf(context).card,
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
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodySmall
                                      ?.copyWith(
                                        color: damaColorsOf(context).brand,
                                        fontWeight: FontWeight.w600,
                                      ),
                                ),
                              ),
                              if ((_officialPauseChrome?.confirmCancel ?? '')
                                  .trim()
                                  .isNotEmpty)
                                TextButton(
                                  onPressed: () =>
                                      setState(() => _resumeBanner = ''),
                                  child: Text(
                                    _officialPauseChrome!.confirmCancel.trim(),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                  _pauseControls(chrome),
                  if ((_gameId ?? '').trim().isNotEmpty)
                    OfficialPauseActivityStrip(
                      accessToken: widget.accessToken,
                      gameId: (_gameId ?? '').trim(),
                      chrome: _officialPauseChrome,
                      enabled: _paused ||
                          _resumeBanner.trim().isNotEmpty ||
                          (_outcome != null || _draw),
                      refreshToken: _pauseActivityRefresh,
                    ),
                  const SizedBox(height: 12),
                  if (_board != null && _boardSize > 0)
                    GameTurnStatus(
                      yourName: _yourDisplayName(chrome),
                      opponentName: _opponentDisplayName(chrome),
                      yourTurnLabel: chrome.statusYourTurn,
                      opponentTurnLabel: chrome.statusOpponentTurn,
                      replayLabel: chrome.statusReplay,
                      vsSeparator: chrome.seatMetaSeparator,
                      mode: widget.mode == 'pvp' ? 'pvp' : 'ai',
                      yourPlayer: _yourPlayer,
                      turn: _turn,
                      yourCaptures: _yourCaptures,
                      opponentCaptures: _opponentCaptures,
                      isBusy: _busy || _abandoning || _pausing || _resuming,
                      opponentThinking: !_paused &&
                          !_clockOwnedEnd &&
                          _replayIndex == null &&
                          _yourPlayer != null &&
                          _turn != _yourPlayer &&
                          (_aiThinking || _busy),
                      replayIndex: _replayIndex,
                      historyLength: _moveHistory.length,
                      yourOnline: _yourOnline,
                      yourPlaying: _yourPlaying,
                      opponentOnline: _opponentOnline,
                      opponentPlaying: _opponentPlaying,
                      suppressTurnHints: _clockOwnedEnd || _paused,
                      statusBanner: _clockOwnedStatusBanner(chrome),
                    ),
                  if (_board != null && _boardSize > 0)
                    const SizedBox(height: 10),
                  Expanded(
                    child: PlayBoardFrame(
                      vsLabel: _railChrome?.vsSeparator ?? '',
                      topSeat: MatchSeatAvatars(
                        layout: MatchSeatBarLayout.sideColumn,
                        sideSlot: MatchSideSeatSlot.top,
                        yourPlayer: _yourPlayer,
                        player1Id: _player1Id,
                        player2Id: _player2Id,
                        whitePieces: _whitePieces,
                        blackPieces: _blackPieces,
                        piecesPerSide: _piecesPerSide,
                        clockLabel: oppClockLabel,
                        clockActive: _outcome == null &&
                            !_draw &&
                            !_paused &&
                            !_clockOwnedEnd &&
                            !_yourClockActive &&
                            _activeClockPlayer != null,
                        labelWhite: seatLight,
                        labelBlack: seatDark,
                        seatMetaSeparator: chrome.seatMetaSeparator,
                        piecesLeftSuffix: _profileChrome?.piecesLeftSuffix,
                        capturedSuffix: _profileChrome?.capturedSuffix,
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
                        yourPlayer: _yourPlayer,
                        player1Id: _player1Id,
                        player2Id: _player2Id,
                        whitePieces: _whitePieces,
                        blackPieces: _blackPieces,
                        piecesPerSide: _piecesPerSide,
                        clockLabel: yourClockLabel,
                        clockActive: _outcome == null &&
                            !_draw &&
                            !_paused &&
                            !_clockOwnedEnd &&
                            _yourClockActive,
                        labelWhite: seatLight,
                        labelBlack: seatDark,
                        seatMetaSeparator: chrome.seatMetaSeparator,
                        piecesLeftSuffix: _profileChrome?.piecesLeftSuffix,
                        capturedSuffix: _profileChrome?.capturedSuffix,
                        ratingParenOpen: _railChrome?.ratingParenOpen,
                        ratingParenClose: _railChrome?.ratingParenClose,
                        onChallenge: (req) =>
                            openCreateGameChallenge(context, req),
                      ),
                      board: BoardPaletteScope(
                        board: boardPaletteById(_boardPaletteId),
                        piece: piecePaletteById(_piecePaletteId),
                        child: _boardView == BoardViewMode.flat2d
                            ? DraughtsBoard2D(
                                board: _displayBoard!,
                                boardSize: _boardSize,
                                legalMoves:
                                    _replayIndex != null || !_showMoveHighlights
                                        ? const []
                                        : _legalMoves,
                                selectedRow:
                                    _replayIndex != null || !_showMoveHighlights
                                        ? null
                                        : _selectedRow,
                                selectedCol:
                                    _replayIndex != null || !_showMoveHighlights
                                        ? null
                                        : _selectedCol,
                                mustContinueRow:
                                    _replayIndex != null || !_showMoveHighlights
                                        ? null
                                        : (_mustContinue != null &&
                                                _mustContinue!.length >= 2
                                            ? _mustContinue![0]
                                            : null),
                                mustContinueCol:
                                    _replayIndex != null || !_showMoveHighlights
                                        ? null
                                        : (_mustContinue != null &&
                                                _mustContinue!.length >= 2
                                            ? _mustContinue![1]
                                            : null),
                                onSelectSquare: _onSquareTap,
                                interactive: !_busy &&
                                    _replayIndex == null &&
                                    _showMoveHighlights &&
                                    _outcome == null &&
                                    !_draw &&
                                    !_gameOverVisible,
                                yourPlayer: _yourPlayer,
                                flipBoard: _flipBoard,
                                moveHistory: _replayIndex != null
                                    ? const []
                                    : _moveHistory,
                                replayMode: _replayIndex != null,
                                illegalShakeKey: _illegalShakeKey,
                                onPlyAnimated: _replayIndex == null &&
                                        !_gameOverVisible
                                    ? (boardAfter) {
                                        setState(() {
                                          _board = boardAfter;
                                          final clockOwned =
                                              _endReason == 'clock_flag' ||
                                                  _endReason == 'clock_draw';
                                          if (_outcome == null &&
                                              !_draw &&
                                              !clockOwned) {
                                            final wipe =
                                                winnerFromBoard(boardAfter);
                                            if (wipe != null) _outcome = wipe;
                                          }
                                        });
                                        _scheduleGameOverIfNeeded();
                                      }
                                    : null,
                              )
                            : DraughtsBoard3D(
                                board: _displayBoard!,
                                boardSize: _boardSize,
                                legalMoves:
                                    _replayIndex != null || !_showMoveHighlights
                                        ? const []
                                        : _legalMoves,
                                selectedRow:
                                    _replayIndex != null || !_showMoveHighlights
                                        ? null
                                        : _selectedRow,
                                selectedCol:
                                    _replayIndex != null || !_showMoveHighlights
                                        ? null
                                        : _selectedCol,
                                mustContinueRow:
                                    _replayIndex != null || !_showMoveHighlights
                                        ? null
                                        : (_mustContinue != null &&
                                                _mustContinue!.length >= 2
                                            ? _mustContinue![0]
                                            : null),
                                mustContinueCol:
                                    _replayIndex != null || !_showMoveHighlights
                                        ? null
                                        : (_mustContinue != null &&
                                                _mustContinue!.length >= 2
                                            ? _mustContinue![1]
                                            : null),
                                onSelectSquare: _onSquareTap,
                                interactive: !_busy &&
                                    _replayIndex == null &&
                                    _showMoveHighlights &&
                                    _outcome == null &&
                                    !_draw &&
                                    !_gameOverVisible,
                                yourPlayer: _yourPlayer,
                                flipBoard: _flipBoard,
                                moveHistory: _replayIndex != null
                                    ? const []
                                    : _moveHistory,
                                illegalShakeKey: _illegalShakeKey,
                                onPlyAnimated: _replayIndex == null &&
                                        !_gameOverVisible
                                    ? (boardAfter) {
                                        setState(() {
                                          _board = boardAfter;
                                          final clockOwned =
                                              _endReason == 'clock_flag' ||
                                                  _endReason == 'clock_draw';
                                          if (_outcome == null &&
                                              !_draw &&
                                              !clockOwned) {
                                            final wipe =
                                                winnerFromBoard(boardAfter);
                                            if (wipe != null) _outcome = wipe;
                                          }
                                        });
                                        _scheduleGameOverIfNeeded();
                                      }
                                    : null,
                              ),
                      ),
                      coverOverlay: _boardCoverOverlay(chrome),
                    ),
                  ),
                  if (_moveHistory.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    GameMoveHistoryBar(
                      moves: _moveHistory,
                      boardSize: _boardSize > 0 ? _boardSize : 0,
                      replayIndex: _replayIndex,
                      liveLabel: chrome.liveLabel,
                      historyLabel: chrome.historyLabel,
                      skipLabels: HistorySkipLabels(
                        first: chrome.historySkipFirst,
                        prev: chrome.historySkipPrev,
                        next: chrome.historySkipNext,
                        last: chrome.historySkipLast,
                        go: chrome.historySkipGo,
                        pageOfFmt: chrome.historySkipPageOf,
                      ),
                      onSelectLive: () {
                        setState(() {
                          _replayIndex = null;
                          _board = _liveBoard ?? _board;
                          _selectedRow = null;
                          _selectedCol = null;
                        });
                      },
                      onSelectMove: (idx) {
                        setState(() {
                          _replayIndex = idx;
                          _selectedRow = null;
                          _selectedCol = null;
                        });
                      },
                    ),
                  ],
                ],
              ),
            ),
            InMatchAdOverlay(
              active: _board != null && _gameStartedAt != null,
              gameStartedAt: _gameStartedAt,
            ),
          ],
        ),
      ),
    );
  }

  String _applyPauseFmt(
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

  /// Square board plane only (seats stay visible around the cinematic).
  /// Pause cover wins over intro so reconnect mid-pause stays clear.
  Widget? _boardCoverOverlay(PlayChrome chrome) {
    final rail = _railChrome;

    String trunc(String raw) {
      if (rail == null) return raw;
      final n = int.tryParse(rail.livePlayerNameMaxChars.trim());
      final suffix = rail.nameTruncateSuffix;
      if (n == null || n <= 0 || suffix.isEmpty || raw.length <= n) return raw;
      return '${raw.substring(0, n)}$suffix';
    }

    MatchIntroPlayer topSeat() => MatchIntroPlayer(
          username: trunc(_opponentDisplayName(chrome)),
          avatarUrl: () {
            if (widget.mode != 'pvp') return null;
            final yp = _yourPlayer;
            final oppId = yp == 1 ? _player2Id : _player1Id;
            return _seatPlayers[oppId ?? '']?.avatarFullUrl ??
                _seatPlayers[oppId ?? '']?.avatarThumbUrl;
          }(),
          countryCode: () {
            if (widget.mode != 'pvp') return null;
            final yp = _yourPlayer;
            final oppId = yp == 1 ? _player2Id : _player1Id;
            return _seatPlayers[oppId ?? '']?.countryCode;
          }(),
          hostTrustTier: () {
            if (widget.mode != 'pvp') return null;
            final yp = _yourPlayer;
            final oppId = yp == 1 ? _player2Id : _player1Id;
            return _seatPlayers[oppId ?? '']?.hostTrustTier;
          }(),
          hostTrustBadge: () {
            if (widget.mode != 'pvp') return null;
            final yp = _yourPlayer;
            final oppId = yp == 1 ? _player2Id : _player1Id;
            return _seatPlayers[oppId ?? '']?.hostTrustBadge;
          }(),
        );

    MatchIntroPlayer bottomSeat() => MatchIntroPlayer(
          username: trunc(_yourDisplayName(chrome)),
          avatarUrl: () {
            final yp = _yourPlayer;
            final youId = yp == 2 ? _player2Id : _player1Id;
            return _seatPlayers[youId ?? '']?.avatarFullUrl ??
                _seatPlayers[youId ?? '']?.avatarThumbUrl;
          }(),
          countryCode: () {
            final yp = _yourPlayer;
            final youId = yp == 2 ? _player2Id : _player1Id;
            return _seatPlayers[youId ?? '']?.countryCode;
          }(),
          hostTrustTier: () {
            final yp = _yourPlayer;
            final youId = yp == 2 ? _player2Id : _player1Id;
            return _seatPlayers[youId ?? '']?.hostTrustTier;
          }(),
          hostTrustBadge: () {
            final yp = _yourPlayer;
            final youId = yp == 2 ? _player2Id : _player1Id;
            return _seatPlayers[youId ?? '']?.hostTrustBadge;
          }(),
        );

    if (_paused &&
        (_outcome == null && !_draw) &&
        (widget.mode == 'pvp' || widget.mode == 'ai')) {
      final aria = chrome.pauseOverlayAria.trim();
      final status =
          (_isOfficialPause ? chrome.pauseKindOfficial : chrome.pauseKindPlayer)
              .trim();
      // Rail VS first; play chrome when rail lags or is absent (web LivePlayHub parity).
      final railVs = (rail?.matchIntroVsLabel ?? '').trim();
      final vs = railVs.isNotEmpty ? railVs : chrome.matchIntroVsLabel.trim();
      if (aria.isNotEmpty && status.isNotEmpty && vs.isNotEmpty) {
        final role = _pauseByRoleLabel(chrome);
        final name = _pauseActorDisplayName.trim();
        final byFmt = _isOfficialPause
            ? chrome.officialPausedByFmt
            : chrome.playerPausedByFmt;
        // Fail closed: never show hollow "Paused by ·" (fmt needs both role and name).
        final byLine = (role.isNotEmpty && name.isNotEmpty)
            ? _applyPauseFmt(byFmt, role: role, name: name)
            : '';
        final reason = _pauseReasonLabel.trim();
        final reasonLine = _isOfficialPause && reason.isNotEmpty
            ? _applyPauseFmt(chrome.officialPausedReasonFmt, reason: reason)
            : '';
        final note = _pauseNote.trim();
        final noteLine = _isOfficialPause && note.isNotEmpty
            ? _applyPauseFmt(chrome.officialPausedNoteFmt, note: note)
            : '';
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
          sinceLine: _officialPauseSinceLine(),
          footerLine:
              _isOfficialPause ? chrome.pauseOverlayUntilResume.trim() : '',
          footerLineFmt:
              _isOfficialPause ? '' : chrome.pauseRemainingFmt.trim(),
          expiresAtUnixMs: _isOfficialPause ? 0 : _pauseExpiresAtUnixMs,
          top: topSeat(),
          bottom: bottomSeat(),
        );
      }
      // Paused but overlay chrome incomplete: never fall through to intro.
      return null;
    }

    // Intro / result covers still need rail chrome for aria + duration soft-fill.
    if (rail == null) return null;

    if (_matchIntroVisible && (widget.mode == 'pvp' || widget.mode == 'ai')) {
      final introVs = rail.matchIntroVsLabel.trim().isNotEmpty
          ? rail.matchIntroVsLabel.trim()
          : chrome.matchIntroVsLabel.trim();
      return MatchIntroOverlay(
        vsLabel: introVs,
        ariaLabel: rail.matchIntroAria,
        startingLabel: rail.matchIntroStartingLabel,
        durationMs: int.tryParse(rail.matchIntroDurationMs) ?? 0,
        top: topSeat(),
        bottom: bottomSeat(),
        onShow: () {
          unawaited(GameNotify.play('game_start'));
        },
        onDone: () {
          if (mounted) setState(() => _matchIntroVisible = false);
        },
      );
    }

    if (_matchResultVisible && _gameOverVisible) {
      final onTime = _endReason == 'clock_flag' || _endReason == 'clock_draw';
      final outcomeMsg = _outcomeMessage(chrome);
      // Clock endings: require on-time DB message (never invent gameOverTitle as the headline).
      if (onTime && (outcomeMsg == null || outcomeMsg.trim().isEmpty)) {
        return null;
      }
      return MatchResultOverlay(
        tone: _draw
            ? MatchResultTone.draw
            : (_yourPlayer != null && _outcome == _yourPlayer)
                ? MatchResultTone.win
                : MatchResultTone.loss,
        title: chrome.gameOverTitle,
        message: outcomeMsg ?? chrome.gameOverTitle,
        ariaLabel: () {
          // Clock endings: rail on-time aria preferred (web LivePlayHub parity), else play_chrome.
          if (onTime) {
            if (_draw || _endReason == 'clock_draw') {
              final railAria = rail.matchResultDrawOnTimeAria.trim();
              return railAria.isNotEmpty
                  ? railAria
                  : chrome.matchResultDrawOnTimeAria.trim();
            }
            if (_yourPlayer != null && _outcome == _yourPlayer) {
              final railAria = rail.matchResultWinOnTimeAria.trim();
              return railAria.isNotEmpty
                  ? railAria
                  : chrome.matchResultWinOnTimeAria.trim();
            }
            final railAria = rail.matchResultLossOnTimeAria.trim();
            return railAria.isNotEmpty
                ? railAria
                : chrome.matchResultLossOnTimeAria.trim();
          }
          if (_draw) return rail.matchResultDrawAria;
          if (_yourPlayer != null && _outcome == _yourPlayer) {
            return rail.matchResultWinAria;
          }
          return rail.matchResultLossAria;
        }(),
        durationMs: int.tryParse(rail.matchResultDurationMs) ?? 0,
        onDone: () {
          if (mounted) setState(() => _matchResultVisible = false);
        },
      );
    }

    return null;
  }
}

class _PauseSnap {
  const _PauseSnap(
    this.id,
    this.paused, [
    this.official = false,
    this.actorRole = '',
    this.actorName = '',
  ]);
  final String id;
  final bool paused;
  final bool official;
  final String actorRole;
  final String actorName;
}
