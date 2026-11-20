import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:dama_mobile/core/audio/game_notify.dart';
import 'package:dama_mobile/core/board_square.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/game.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/features/game/palace_piece.dart';
import 'package:flutter/material.dart';

/// Perspective 3D draughts board (parity with web DraughtsScene3D / R3F).
/// Pick→hold→travel→land from `move_history`/`board_after` (board-diff fallback).
class DraughtsBoard3D extends StatefulWidget {
  const DraughtsBoard3D({
    super.key,
    required this.board,
    required this.boardSize,
    required this.legalMoves,
    required this.selectedRow,
    required this.selectedCol,
    required this.onSelectSquare,
    this.mustContinueRow,
    this.mustContinueCol,
    this.interactive = true,
    this.flipBoard = false,
    this.yourPlayer,
    this.moveHistory = const [],
    this.onPlyAnimated,
    this.illegalShakeKey = 0,
  });

  final List<List<dynamic>> board;
  final int boardSize;

  /// Moves as `[fromR, fromC, toR, toC, captureCount?]`.
  final List<List<int>> legalMoves;
  final int? selectedRow;
  final int? selectedCol;
  final int? mustContinueRow;
  final int? mustContinueCol;
  final void Function(int row, int col) onSelectSquare;
  final bool interactive;

  /// Player-2 seat: rotate 180° so own pieces sit at the bottom (web parity).
  final bool flipBoard;

  /// Seat number (1|2) for opponent-fast humanization (web DraughtsScene3D parity).
  final int? yourPlayer;
  final List<MoveHistoryEntry> moveHistory;
  final void Function(List<List<dynamic>> boardAfter)? onPlyAnimated;

  /// Increment to trigger horizontal reject shake (illegal destination). Not used for captures.
  final int illegalShakeKey;

  @override
  State<DraughtsBoard3D> createState() => _DraughtsBoard3DState();
}

class _ActiveAnim {
  _ActiveAnim({
    required this.fromR,
    required this.fromC,
    required this.toR,
    required this.toC,
    required this.player,
    required this.isKing,
    required this.isPromotion,
    required this.captures,
    required this.isCapture,
    this.boardAfter,
  });

  final int fromR;
  final int fromC;
  final int toR;
  final int toC;
  final int player;
  final bool isKing;
  final bool isPromotion;
  final List<(int, int)> captures;
  final bool isCapture;
  final List<List<dynamic>>? boardAfter;
  bool boardApplied = false;
}

class _DraughtsBoard3DState extends State<DraughtsBoard3D>
    with TickerProviderStateMixin {
  static const _pickPhaseEnd = 0.24;
  static const _holdPhaseEnd = 0.34;
  static const _landPhaseStart = 0.72;
  // Own-seat humanized timing (web MOVE_* / CAPTURE_*).
  static const _moveDurationMinMs = 720;
  static const _captureDurationMinMs = 920;
  static const _durationPerSquareMs = 160;
  static const _moveDurationMaxMs = 1650;
  // Opponent / AI fast path (web OPPONENT_*).
  static const _opponentMoveMinMs = 340;
  static const _opponentCaptureMinMs = 440;
  static const _opponentPerSquareMs = 90;
  static const _opponentMaxMs = 820;

  double _pitch = 0.55;
  double _yaw = 0.18;

  /// Pinch zoom (web OrbitControls minDistance/maxDistance parity ≈ 0.75-1.9).
  double _zoom = 1.0;
  double _zoomAtScaleStart = 1.0;
  late final AnimationController _anim;
  List<List<dynamic>> _renderBoard = const [];
  _ActiveAnim? _active;
  double _progress = 0;
  final List<_ActiveAnim> _queue = [];
  int _prevHistoryLen = 0;
  bool _holdSync = false;
  late final AnimationController _shakeCtrl;

  /// Board size whose first paint finished - mismatch keeps checker shimmer (web 3D parity).
  int? _paintedSize;

  void _schedulePaintReady() {
    final forSize = widget.boardSize;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || widget.boardSize != forSize) return;
        setState(() => _paintedSize = forSize);
      });
    });
  }

  Set<String> get _highlights {
    final set = <String>{};
    final sr = widget.selectedRow;
    final sc = widget.selectedCol;
    final mcR = widget.mustContinueRow;
    final mcC = widget.mustContinueCol;
    if (mcR != null && mcC != null) set.add('$mcR:$mcC');
    if (sr != null && sc != null) {
      // Selected square uses the same solid highlight fill as destinations.
      set.add('$sr:$sc');
      for (final m in widget.legalMoves) {
        if (m.length >= 4 && m[0] == sr && m[1] == sc) {
          set.add('${m[2]}:${m[3]}');
        }
      }
      return set;
    }
    // All movable FROM squares (quiet + capture) - fastest play cue.
    for (final m in widget.legalMoves) {
      if (m.length >= 2) set.add('${m[0]}:${m[1]}');
    }
    return set;
  }

  /// Legal destination squares only (2D ghost-dot targets).
  Set<String> get _destinationKeys {
    final sr = widget.selectedRow;
    final sc = widget.selectedCol;
    if (sr == null || sc == null) return {};
    final set = <String>{};
    for (final m in widget.legalMoves) {
      if (m.length >= 4 && m[0] == sr && m[1] == sc) {
        set.add('${m[2]}:${m[3]}');
      }
    }
    return set;
  }

  /// Chess.com-style yellow last-ply from/to (skipped while animating).
  Set<String> get _lastMoveKeys {
    if (_active != null || widget.moveHistory.isEmpty) return {};
    final last = widget.moveHistory.last;
    if (last.from.length < 2 || last.to.length < 2) return {};
    return {
      '${last.from[0]}:${last.from[1]}',
      '${last.to[0]}:${last.to[1]}',
    };
  }

  Set<String> get _hiddenKeys {
    final a = _active;
    if (a == null || _progress >= 1) return {};
    final set = <String>{'${a.fromR}:${a.fromC}', '${a.toR}:${a.toC}'};
    for (final c in a.captures) {
      set.add('${c.$1}:${c.$2}');
    }
    return set;
  }

  @override
  void initState() {
    super.initState();
    unawaited(NeoPieceImages.ensureLoaded().then((_) {
      if (mounted) setState(() {});
    }));
    _renderBoard = _cloneBoard(widget.board);
    _prevHistoryLen = widget.moveHistory.length;
    _anim = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 900))
      ..addListener(() {
        setState(() {
          final prev = _progress;
          _progress = _anim.value;
          final active = _active;
          // Commit board as the piece puts down (captures disappear with the land).
          if (active != null &&
              !active.boardApplied &&
              active.boardAfter != null &&
              active.boardAfter!.isNotEmpty &&
              prev < _landPhaseStart &&
              _progress >= _landPhaseStart) {
            active.boardApplied = true;
            _renderBoard = _cloneBoard(active.boardAfter!);
            widget.onPlyAnimated?.call(active.boardAfter!);
            // Put-down only - wood + piece contact (never during travel).
            unawaited(
              GameNotify.playPiecePlace(
                captured: active.isCapture,
                promoted: active.isPromotion,
              ),
            );
          }
        });
      })
      ..addStatusListener((status) {
        if (status == AnimationStatus.completed) {
          _finishAndAdvance();
        }
      });
    // Illegal-destination reject shake (horizontal). Captures never trigger this.
    _shakeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    )..addListener(() => setState(() {}));
    _schedulePaintReady();
  }

  void _startNext() {
    if (_queue.isEmpty) {
      setState(() {
        _active = null;
        _progress = 0;
        _holdSync = false;
      });
      return;
    }
    final next = _queue.removeAt(0);
    final dr = (next.toR - next.fromR).toDouble();
    final dc = (next.toC - next.fromC).toDouble();
    final dist = math.sqrt(dr * dr + dc * dc);
    final yours = widget.yourPlayer;
    final opponentFast = yours != null && next.player != yours;
    final base = next.isCapture
        ? (opponentFast ? _opponentCaptureMinMs : _captureDurationMinMs)
        : (opponentFast ? _opponentMoveMinMs : _moveDurationMinMs);
    final perSq = opponentFast ? _opponentPerSquareMs : _durationPerSquareMs;
    final maxMs = opponentFast ? _opponentMaxMs : _moveDurationMaxMs;
    final minMs = opponentFast
        ? (next.isCapture ? _opponentCaptureMinMs : _opponentMoveMinMs)
        : (next.isCapture ? _captureDurationMinMs : _moveDurationMinMs);
    final ms = (base + dist * perSq).clamp(minMs, maxMs).round();
    setState(() {
      _active = next;
      _progress = 0;
    });
    _anim.duration = Duration(milliseconds: ms);
    _anim.forward(from: 0);
  }

  void _finishAndAdvance() {
    final finished = _active;
    if (finished != null &&
        !finished.boardApplied &&
        finished.boardAfter != null &&
        finished.boardAfter!.isNotEmpty) {
      finished.boardApplied = true;
      setState(() {
        _renderBoard = _cloneBoard(finished.boardAfter!);
      });
      widget.onPlyAnimated?.call(finished.boardAfter!);
      unawaited(
        GameNotify.playPiecePlace(
          captured: finished.isCapture,
          promoted: finished.isPromotion,
        ),
      );
    } else if (_queue.isEmpty) {
      setState(() {
        _renderBoard = _cloneBoard(widget.board);
      });
    }
    _active = null;
    _progress = 0;
    if (_queue.isNotEmpty) {
      _startNext();
    } else {
      setState(() => _holdSync = false);
    }
  }

  @override
  void didUpdateWidget(covariant DraughtsBoard3D oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.boardSize != oldWidget.boardSize) {
      _paintedSize = null;
      _schedulePaintReady();
    }
    if (widget.illegalShakeKey != oldWidget.illegalShakeKey &&
        widget.illegalShakeKey != 0) {
      _shakeCtrl.forward(from: 0);
    }
    final len = widget.moveHistory.length;
    if (len < _prevHistoryLen) {
      _prevHistoryLen = len;
      _queue.clear();
      _active = null;
      _holdSync = false;
      _anim.stop();
      _renderBoard = _cloneBoard(widget.board);
      return;
    }
    if (len > _prevHistoryLen) {
      final start = _prevHistoryLen;
      final newEntries = widget.moveHistory.sublist(start);
      _prevHistoryLen = len;
      _holdSync = true;
      for (var i = 0; i < newEntries.length; i++) {
        final e = newEntries[i];
        final prevBoard = i == 0
            ? (start > 0 ? widget.moveHistory[start - 1].boardAfter : null)
            : newEntries[i - 1].boardAfter;
        final anim = _animFromHistory(e, prevBoard);
        if (anim != null) _queue.add(anim);
      }
      if (_active == null) _startNext();
      return;
    }
    if (_holdSync || _active != null || _queue.isNotEmpty) return;
    if (!_boardsEqual(_renderBoard, widget.board)) {
      if (widget.moveHistory.isEmpty) {
        final next = _diffAnim(_renderBoard, widget.board, widget.legalMoves);
        if (next != null) {
          _queue.add(next);
          _holdSync = true;
          _startNext();
        } else {
          _renderBoard = _cloneBoard(widget.board);
        }
      } else {
        _renderBoard = _cloneBoard(widget.board);
      }
    }
  }

  static _ActiveAnim? _animFromHistory(
    MoveHistoryEntry e, [
    List<List<dynamic>>? prevBoard,
  ]) {
    if (e.from.length < 2 || e.to.length < 2) return null;
    final caps = e.captures.map((c) => (c[0], c[1])).toList();
    var isKing = false;
    if (e.boardAfter != null &&
        e.to[0] < e.boardAfter!.length &&
        e.to[1] < e.boardAfter![e.to[0]].length) {
      final cell = e.boardAfter![e.to[0]][e.to[1]];
      if (cell is Map) isKing = cell['k'] == true;
    }
    var wasKing = false;
    if (prevBoard != null &&
        e.from[0] < prevBoard.length &&
        e.from[1] < prevBoard[e.from[0]].length) {
      final fromCell = prevBoard[e.from[0]][e.from[1]];
      if (fromCell is Map) wasKing = fromCell['k'] == true;
    }
    return _ActiveAnim(
      fromR: e.from[0],
      fromC: e.from[1],
      toR: e.to[0],
      toC: e.to[1],
      player: e.player,
      isKing: isKing,
      isPromotion: isKing && !wasKing,
      captures: caps,
      isCapture: caps.isNotEmpty,
      boardAfter: e.boardAfter,
    );
  }

  @override
  void dispose() {
    _anim.dispose();
    _shakeCtrl.dispose();
    super.dispose();
  }

  static List<List<dynamic>> _cloneBoard(List<List<dynamic>> board) {
    return board.map((row) => List<dynamic>.from(row)).toList();
  }

  static bool _boardsEqual(List<List<dynamic>> a, List<List<dynamic>> b) {
    if (a.length != b.length) return false;
    for (var r = 0; r < a.length; r++) {
      if (a[r].length != b[r].length) return false;
      for (var c = 0; c < a[r].length; c++) {
        final x = a[r][c];
        final y = b[r][c];
        if (x == null && y == null) continue;
        if (x is! Map || y is! Map) return false;
        if (x['p'] != y['p'] || x['k'] != y['k']) return false;
      }
    }
    return true;
  }

  static _ActiveAnim? _diffAnim(
    List<List<dynamic>> prev,
    List<List<dynamic>> next,
    List<List<int>> legalHint,
  ) {
    if (prev.isEmpty || next.isEmpty || prev.length != next.length) return null;
    final emptied = <(int, int)>[];
    final filled = <(int, int)>[];
    for (var r = 0; r < prev.length; r++) {
      for (var c = 0; c < prev[r].length; c++) {
        final a = prev[r][c];
        final b = next[r][c];
        final aPiece = a is Map;
        final bPiece = b is Map;
        if (aPiece && !bPiece) emptied.add((r, c));
        if (!aPiece && bPiece) filled.add((r, c));
        if (aPiece && bPiece && (a['p'] != b['p'] || a['k'] != b['k'])) {
          emptied.add((r, c));
          filled.add((r, c));
        }
      }
    }
    if (filled.length != 1) return null;
    final to = filled.first;
    final dest = next[to.$1][to.$2];
    if (dest is! Map) return null;
    (int, int)? from;
    final captures = <(int, int)>[];
    for (final sq in emptied) {
      final was = prev[sq.$1][sq.$2];
      if (was is! Map) continue;
      if (was['p'] == dest['p']) {
        from = sq;
      } else {
        captures.add(sq);
      }
    }
    if (from == null) {
      for (final m in legalHint) {
        if (m.length >= 4 && m[2] == to.$1 && m[3] == to.$2) {
          from = (m[0], m[1]);
          break;
        }
      }
    }
    if (from == null) return null;
    final isKing = dest['k'] == true;
    final fromCell = prev[from.$1][from.$2];
    final wasKing = fromCell is Map && fromCell['k'] == true;
    return _ActiveAnim(
      fromR: from.$1,
      fromC: from.$2,
      toR: to.$1,
      toC: to.$2,
      player: (dest['p'] as num?)?.toInt() ?? 1,
      isKing: isKing,
      isPromotion: isKing && !wasKing,
      captures: captures,
      isCapture: captures.isNotEmpty,
      boardAfter: next,
    );
  }

  /// Returns (col, row, lift, scale, yawTwist).
  static (double, double, double, double, double) _pieceTransform(
    double progress,
    int fromR,
    int fromC,
    int toR,
    int toC,
    bool isCapture,
  ) {
    const rest = 0.0;
    // Keep capture lift close to quiet moves - tall arcs read as the board dipping.
    final carry = isCapture ? 0.52 : 0.5;
    if (progress < _pickPhaseEnd) {
      final t = progress / _pickPhaseEnd;
      final ease = t * t * (3 - 2 * t);
      return (
        fromC.toDouble(),
        fromR.toDouble(),
        rest + ease * (carry - rest),
        1 + ease * 0.035,
        0,
      );
    }
    if (progress < _holdPhaseEnd) {
      return (fromC.toDouble(), fromR.toDouble(), carry, 1.035, 0);
    }
    if (progress < _landPhaseStart) {
      final t = (progress - _holdPhaseEnd) / (_landPhaseStart - _holdPhaseEnd);
      // easeInOutCubic-ish - no yaw twist (looked like the board twisting/pushing).
      final smooth =
          t < 0.5 ? 4 * t * t * t : 1 - math.pow(-2 * t + 2, 3).toDouble() / 2;
      return (
        fromC + (toC - fromC) * smooth,
        fromR + (toR - fromR) * smooth,
        carry,
        1.035,
        0,
      );
    }
    final t = (progress - _landPhaseStart) / (1 - _landPhaseStart);
    final ease = t * t * (3 - 2 * t);
    return (
      toC.toDouble(),
      toR.toDouble(),
      carry - ease * (carry - rest),
      1.035 - ease * 0.035,
      0,
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    if (widget.boardSize <= 0) return const BoardAreaSkeleton();

    final paintReady = _paintedSize == widget.boardSize;
    final display = (_holdSync || _active != null || _queue.isNotEmpty)
        ? _renderBoard
        : widget.board;
    (double, double, double, double, double)? fly;
    if (_active != null && _progress < 1) {
      fly = _pieceTransform(
        _progress,
        _active!.fromR,
        _active!.fromC,
        _active!.toR,
        _active!.toC,
        _active!.isCapture,
      );
    }
    // Horizontal reject only (decay with shake controller). Captures do not shake.
    final shakeT = _shakeCtrl.value;
    final shakeAmp = (1.0 - shakeT) * 6.0;
    final shakeDx =
        shakeAmp > 0.05 ? math.sin(shakeT * math.pi * 10) * shakeAmp : 0.0;
    final burstT = () {
      final a = _active;
      if (a == null || !a.isCapture || _progress <= _holdPhaseEnd) return 0.0;
      if (_progress >= _landPhaseStart) return 1.0;
      return (_progress - _holdPhaseEnd) / (_landPhaseStart - _holdPhaseEnd);
    }();

    final boardPaint = CustomPaint(
      painter: _Board3DPainter(
        board: display,
        size: widget.boardSize,
        pitch: _pitch,
        yaw: _yaw,
        flipBoard: widget.flipBoard,
        selectedRow: widget.selectedRow,
        selectedCol: widget.selectedCol,
        highlights: _highlights,
        destinationKeys: _destinationKeys,
        lastMoveKeys: _lastMoveKeys,
        hiddenKeys: _hiddenKeys,
        light: tokens.boardLight,
        dark: tokens.boardDark,
        frame: const Color(0xFF4A0012),
        pieceLight: tokens.pieceLight,
        pieceDark: tokens.pieceDark,
        pieceDarkSplit: tokens.pieceDarkSplit,
        gold: tokens.boardSelected,
        lastMove: tokens.lastMove,
        bg: const Color(0xFF4A0012),
        flyCol: fly?.$1,
        flyRow: fly?.$2,
        flyLift: fly?.$3,
        flyScale: fly?.$4 ?? 1,
        flyYaw: fly?.$5 ?? 0,
        flyPlayer: _active?.player,
        flyKing: _active?.isKing ?? false,
        captureBursts: _active?.captures ?? const [],
        burstProgress: burstT,
      ),
      child: const SizedBox.expand(),
    );

    return AspectRatio(
      aspectRatio: 1,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          fit: StackFit.expand,
          children: [
            GestureDetector(
              onScaleStart: (_) {
                _zoomAtScaleStart = _zoom;
              },
              onScaleUpdate: (d) {
                setState(() {
                  if (d.pointerCount >= 2) {
                    // Pinch zoom (smart-menu / web OrbitControls 7-32 distance band).
                    _zoom = (_zoomAtScaleStart * d.scale).clamp(0.75, 1.9);
                  } else {
                    final dx = widget.flipBoard
                        ? -d.focalPointDelta.dx
                        : d.focalPointDelta.dx;
                    final dy = widget.flipBoard
                        ? -d.focalPointDelta.dy
                        : d.focalPointDelta.dy;
                    _yaw = (_yaw + dx * 0.004).clamp(-0.65, 0.65);
                    _pitch = (_pitch - dy * 0.004).clamp(0.25, 1.05);
                  }
                });
              },
              onTapUp: widget.interactive && _active == null
                  ? (details) {
                      final box = context.findRenderObject() as RenderBox?;
                      if (box == null) return;
                      var local = details.localPosition;
                      if (widget.flipBoard) {
                        local = Offset(
                          box.size.width - local.dx,
                          box.size.height - local.dy,
                        );
                      }
                      final hit = _Board3DPainter(
                        board: display,
                        size: widget.boardSize,
                        pitch: _pitch,
                        yaw: _yaw,
                        flipBoard: widget.flipBoard,
                        selectedRow: widget.selectedRow,
                        selectedCol: widget.selectedCol,
                        highlights: _highlights,
                        destinationKeys: _destinationKeys,
                        lastMoveKeys: _lastMoveKeys,
                        hiddenKeys: _hiddenKeys,
                        light: tokens.boardLight,
                        dark: tokens.boardDark,
                        frame: const Color(0xFF4A0012),
                        pieceLight: tokens.pieceLight,
                        pieceDark: tokens.pieceDark,
                        pieceDarkSplit: tokens.pieceDarkSplit,
                        gold: tokens.boardSelected,
                        lastMove: tokens.lastMove,
                        bg: const Color(0xFF4A0012),
                        captureBursts: const [],
                        burstProgress: 0,
                      ).findSquareAt(local, box.size);
                      if (hit != null) widget.onSelectSquare(hit.$1, hit.$2);
                    }
                  : null,
              child: Transform.scale(
                scale: _zoom,
                child: Transform.translate(
                  offset: Offset(shakeDx, 0),
                  child: widget.flipBoard
                      ? Transform.rotate(angle: math.pi, child: boardPaint)
                      : boardPaint,
                ),
              ),
            ),
            if (!paintReady)
              const Positioned.fill(
                child: IgnorePointer(child: BoardAreaSkeleton()),
              ),
          ],
        ),
      ),
    );
  }
}

class _Board3DPainter extends CustomPainter {
  _Board3DPainter({
    required this.board,
    required this.size,
    required this.pitch,
    required this.yaw,
    required this.flipBoard,
    required this.selectedRow,
    required this.selectedCol,
    required this.highlights,
    required this.destinationKeys,
    required this.lastMoveKeys,
    required this.hiddenKeys,
    required this.light,
    required this.dark,
    required this.frame,
    required this.pieceLight,
    required this.pieceDark,
    this.pieceDarkSplit = false,
    required this.gold,
    required this.lastMove,
    required this.bg,
    required this.captureBursts,
    required this.burstProgress,
    this.flyCol,
    this.flyRow,
    this.flyLift,
    this.flyScale = 1,
    this.flyYaw = 0,
    this.flyPlayer,
    this.flyKing = false,
  });

  final List<List<dynamic>> board;
  final int size;
  final double pitch;
  final double yaw;

  /// When true the paint is wrapped in a 180° Transform - place rails so they
  /// land on the viewer left/bottom after that rotate.
  final bool flipBoard;
  final int? selectedRow;
  final int? selectedCol;
  final Set<String> highlights;
  final Set<String> destinationKeys;
  final Set<String> lastMoveKeys;
  final Set<String> hiddenKeys;
  final Color light;
  final Color dark;
  final Color frame;
  final Color pieceLight;
  final Color pieceDark;
  final bool pieceDarkSplit;
  final Color gold;
  final Color lastMove;
  final Color bg;
  final List<(int, int)> captureBursts;
  final double burstProgress;
  final double? flyCol;
  final double? flyRow;
  final double? flyLift;
  final double flyScale;
  final double flyYaw;
  final int? flyPlayer;
  final bool flyKing;

  Offset _project(double x, double y, double z, Size canvas) {
    final cp = math.cos(pitch);
    final sp = math.sin(pitch);
    final cy = math.cos(yaw);
    final sy = math.sin(yaw);

    final x1 = x * cy + z * sy;
    final z1 = -x * sy + z * cy;
    final y1 = y * cp - z1 * sp;
    final z2 = y * sp + z1 * cp;

    final persp = 1 / (1 + z2 * 0.045);
    // Pulled-back default framing (parity with web 3D camera pull-back; was 0.055).
    final scale = math.min(canvas.width, canvas.height) * 0.047 * persp;
    return Offset(
      canvas.width / 2 + x1 * scale,
      canvas.height * 0.42 + y1 * scale,
    );
  }

  (int, int)? findSquareAt(Offset local, Size canvas) {
    double best = double.infinity;
    (int, int)? hit;
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        final wx = c - size / 2 + 0.5;
        final wz = r - size / 2 + 0.5;
        final p = _project(wx, 0, wz, canvas);
        final d = (p - local).distance;
        if (d < best && d < canvas.shortestSide / (size * 1.4)) {
          best = d;
          hit = (r, c);
        }
      }
    }
    return hit;
  }

  void _drawSquareCoords(
    Canvas canvas,
    Size canvasSize,
    int row,
    int col,
    bool isDark,
    List<Offset> corners,
  ) {
    final showRank = isVisualLeftFile(col, size, flipBoard);
    final showFile = isVisualBottomRank(row, size, flipBoard);
    if (!showRank && !showFile) return;
    // corners: [NW, NE, SE, SW] in board space before outer Transform.rotate.
    // After flip Transform.rotate(π), NW↔SE - paint opposite corner so labels
    // still read top-left / bottom-right on screen.
    final ink = boardCoordUsesLightInk(isDark) ? light : dark;
    final fontSize =
        (canvasSize.shortestSide / (size * (size >= 10 ? 3.4 : 3.0)))
            .clamp(7.0, 12.0);
    final style = TextStyle(
      color: ink,
      fontSize: fontSize,
      fontWeight: FontWeight.w700,
      height: 1,
    );
    if (showRank) {
      final anchor = flipBoard ? corners[2] : corners[0];
      final tp = TextPainter(
        text: TextSpan(text: '${boardRankNumber(row, size)}', style: style),
        textDirection: TextDirection.ltr,
      )..layout();
      final origin = flipBoard
          ? Offset(anchor.dx - tp.width - 1, anchor.dy - tp.height - 1)
          : Offset(anchor.dx + 2, anchor.dy + 1);
      tp.paint(canvas, origin);
    }
    if (showFile) {
      final anchor = flipBoard ? corners[0] : corners[2];
      final tp = TextPainter(
        text: TextSpan(text: boardFileLetter(col), style: style),
        textDirection: TextDirection.ltr,
      )..layout();
      final origin = flipBoard
          ? Offset(anchor.dx + 2, anchor.dy + 1)
          : Offset(anchor.dx - tp.width - 1, anchor.dy - tp.height - 1);
      tp.paint(canvas, origin);
    }
  }

  void _drawPiece(
    Canvas canvas,
    Size canvasSize,
    double col,
    double row,
    int player,
    bool king,
    bool selected, {
    double lift = 0,
    double scale = 1,
    double yawTwist = 0,
  }) {
    // Match 2D: square fill is the only movable cue - no ring around the piece.
    final selLift = selected ? 0.1 : 0.0;
    final wx = col - size / 2 + 0.5;
    final wz = row - size / 2 + 0.5;
    // Approximate yaw twist as a small horizontal skew in screen space.
    final skew = math.sin(yawTwist) * 0.12;
    final foot = _project(wx + skew, -0.02 - lift - selLift, wz, canvasSize);
    final unit = (canvasSize.shortestSide / (size * 2.05)) * scale;
    final isLight = player == 1;
    final splitDark = !isLight && pieceDarkSplit;
    final base = isLight ? pieceLight : pieceDark;
    final shade = splitDark
        ? pieceLight
        : isLight
            ? Color.lerp(pieceLight, const Color(0xFF8A8A8A), 0.55)!
            : Color.lerp(pieceDark, const Color(0xFF0A0A0A), 0.4)!;
    final left = splitDark ? pieceLight : base;
    final right = splitDark ? pieceDark : shade;
    final glow = selected ? Color.lerp(base, gold, 0.35)! : null;

    // Contact shadow
    canvas.drawOval(
      Rect.fromCenter(
        center: foot.translate(0, unit * 0.12),
        width: unit * 1.15,
        height: unit * 0.32,
      ),
      Paint()..color = const Color(0x55000000),
    );

    _drawNeoStaunton3D(
      canvas,
      foot: foot,
      unit: unit,
      crowned: king,
      base: glow ?? left,
      shade: glow != null ? Color.lerp(glow, right, 0.45)! : right,
      outline: kNeoOutline,
    );
  }

  /// Standing Neo Staunton pawn / king - layered volumes (web mesh parity).
  void _drawNeoStaunton3D(
    Canvas canvas, {
    required Offset foot,
    required double unit,
    required bool crowned,
    required Color base,
    required Color shade,
    required Color outline,
  }) {
    final cx = foot.dx;
    final stroke = unit * 0.055;
    final stemH = crowned ? unit * 0.72 : unit * 0.52;
    final baseCy = foot.dy - unit * 0.1;
    final stemBot = baseCy - unit * 0.14;
    final stemTop = stemBot - stemH;
    final collarCy = stemTop - unit * 0.02;
    final headR = crowned ? unit * 0.33 : unit * 0.3;
    final headCy = collarCy - unit * 0.1 - headR * 0.55;

    void paintSplitOval(Rect rect) {
      final path = Path()..addOval(rect);
      canvas.drawPath(path, Paint()..color = base);
      canvas.save();
      canvas.clipPath(path);
      canvas.drawRect(
        Rect.fromLTRB(cx, rect.top - 1, rect.right + 1, rect.bottom + 1),
        Paint()..color = shade,
      );
      canvas.restore();
      canvas.drawPath(
        path,
        Paint()
          ..color = outline
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..strokeJoin = StrokeJoin.round,
      );
    }

    void paintSplitPath(Path path) {
      canvas.drawPath(path, Paint()..color = base);
      canvas.save();
      canvas.clipPath(path);
      final bounds = path.getBounds();
      canvas.drawRect(
        Rect.fromLTRB(cx, bounds.top - 1, bounds.right + 1, bounds.bottom + 1),
        Paint()..color = shade,
      );
      canvas.restore();
      canvas.drawPath(
        path,
        Paint()
          ..color = outline
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..strokeJoin = StrokeJoin.round,
      );
    }

    // Flared pedestal (foreshortened cylinder)
    paintSplitOval(Rect.fromCenter(
      center: Offset(cx, baseCy),
      width: unit * 1.12,
      height: unit * 0.34,
    ));
    paintSplitOval(Rect.fromCenter(
      center: Offset(cx, baseCy - unit * 0.1),
      width: unit * 0.95,
      height: unit * 0.26,
    ));

    // Tapered stem - stacked discs
    final stemSteps = crowned ? 5 : 4;
    for (var i = 0; i < stemSteps; i++) {
      final t = i / (stemSteps - 1);
      final y = stemBot - t * stemH;
      final w = ui.lerpDouble(unit * 0.72, unit * 0.4, t)!;
      paintSplitOval(Rect.fromCenter(
        center: Offset(cx, y),
        width: w,
        height: unit * 0.2,
      ));
    }

    // Collar ring
    paintSplitOval(Rect.fromCenter(
      center: Offset(cx, collarCy),
      width: unit * 0.88,
      height: unit * 0.26,
    ));

    // Head sphere
    paintSplitOval(Rect.fromCenter(
      center: Offset(cx, headCy),
      width: headR * 2,
      height: headR * 1.85,
    ));

    if (crowned) {
      // Crown bowl
      paintSplitOval(Rect.fromCenter(
        center: Offset(cx, headCy - headR * 0.72),
        width: unit * 0.7,
        height: unit * 0.24,
      ));
      // Neo king cross
      final crossY = headCy - headR - unit * 0.22;
      final cross = Path()
        ..addRRect(RRect.fromRectAndRadius(
          Rect.fromCenter(
              center: Offset(cx, crossY),
              width: unit * 0.14,
              height: unit * 0.48),
          Radius.circular(unit * 0.03),
        ))
        ..addRRect(RRect.fromRectAndRadius(
          Rect.fromCenter(
            center: Offset(cx, crossY - unit * 0.02),
            width: unit * 0.4,
            height: unit * 0.14,
          ),
          Radius.circular(unit * 0.03),
        ));
      paintSplitPath(cross);
    }
  }

  void _drawCaptureBursts(Canvas canvas, Size canvasSize) {
    if (captureBursts.isEmpty || burstProgress <= 0) return;
    final t = 1 - math.pow(1 - burstProgress, 3).toDouble(); // easeOutCubic
    for (final c in captureBursts) {
      final wx = c.$2 - size / 2 + 0.5;
      final wz = c.$1 - size / 2 + 0.5;
      final center = _project(wx, -0.35 - t * 0.35, wz, canvasSize);
      final radius = (canvasSize.shortestSide / (size * 3.2)) *
          math.max(0.01, 1 - t * 0.9);
      canvas.drawCircle(
        center,
        radius * 0.55,
        Paint()
          ..color =
              const Color(0xFFC0264A).withValues(alpha: 0.85 * (1 - t * 0.5)),
      );
      canvas.drawCircle(
        center,
        radius * 0.35,
        Paint()..color = const Color(0xFFA31D38).withValues(alpha: 0.7),
      );
    }
  }

  @override
  void paint(Canvas canvas, Size canvasSize) {
    canvas.drawRect(Offset.zero & canvasSize, Paint()..color = bg);

    final framePts = <Offset>[
      _project(-size / 2 - 0.35, 0.35, -size / 2 - 0.35, canvasSize),
      _project(size / 2 + 0.35, 0.35, -size / 2 - 0.35, canvasSize),
      _project(size / 2 + 0.35, 0.35, size / 2 + 0.35, canvasSize),
      _project(-size / 2 - 0.35, 0.35, size / 2 + 0.35, canvasSize),
    ];
    canvas.drawPath(
      Path()..addPolygon(framePts, true),
      Paint()..color = frame.withValues(alpha: 0.95),
    );

    final squares = <({int r, int c, double depth})>[];
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        final wx = c - size / 2 + 0.5;
        final wz = r - size / 2 + 0.5;
        final depth = -wx * math.sin(yaw) + wz * math.cos(yaw);
        squares.add((r: r, c: c, depth: depth));
      }
    }
    squares.sort((a, b) => a.depth.compareTo(b.depth));

    for (final s in squares) {
      final r = s.r;
      final c = s.c;
      final isDark = (r + c).isOdd;
      final key = '$r:$c';
      final highlighted = highlights.contains(key);
      final isLast = !highlighted && lastMoveKeys.contains(key);
      final corners = <Offset>[
        _project(c - size / 2, 0, r - size / 2, canvasSize),
        _project(c - size / 2 + 1, 0, r - size / 2, canvasSize),
        _project(c - size / 2 + 1, 0, r - size / 2 + 1, canvasSize),
        _project(c - size / 2, 0, r - size / 2 + 1, canvasSize),
      ];
      canvas.drawPath(
        Path()..addPolygon(corners, true),
        Paint()
          ..color = highlighted
              ? gold
              : isLast
                  ? lastMove
                  : (isDark ? dark : light),
      );
      _drawSquareCoords(
        canvas,
        canvasSize,
        r,
        c,
        isDark,
        corners,
      );
    }

    // 2D parity: lightened circular ghost on legal destination squares.
    final disc = Color.lerp(gold, Colors.white, 0.45) ?? gold;
    for (final key in destinationKeys) {
      final parts = key.split(':');
      if (parts.length != 2) continue;
      final r = int.tryParse(parts[0]);
      final c = int.tryParse(parts[1]);
      if (r == null || c == null) continue;
      final center = _project(
        c - size / 2 + 0.5,
        0.02,
        r - size / 2 + 0.5,
        canvasSize,
      );
      final radius = canvasSize.shortestSide / (size * 4.5);
      canvas.drawCircle(
        center,
        radius,
        Paint()
          ..color = disc.withValues(alpha: 0.95)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2),
      );
      canvas.drawCircle(
        center,
        radius,
        Paint()..color = disc.withValues(alpha: 0.95),
      );
    }

    for (final s in squares) {
      final r = s.r;
      final c = s.c;
      if (hiddenKeys.contains('$r:$c')) continue;
      if (r >= board.length || c >= board[r].length) continue;
      final cell = board[r][c];
      if (cell is! Map) continue;
      final p = (cell['p'] as num?)?.toInt() ?? 1;
      final isSelected = selectedRow == r && selectedCol == c;
      _drawPiece(
        canvas,
        canvasSize,
        c.toDouble(),
        r.toDouble(),
        p,
        cell['k'] == true,
        isSelected,
      );
    }

    _drawCaptureBursts(canvas, canvasSize);

    if (flyCol != null && flyRow != null && flyPlayer != null) {
      _drawPiece(
        canvas,
        canvasSize,
        flyCol!,
        flyRow!,
        flyPlayer!,
        flyKing,
        false,
        lift: flyLift ?? 0,
        scale: flyScale,
        yawTwist: flyYaw,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _Board3DPainter old) {
    return old.board != board ||
        old.pitch != pitch ||
        old.yaw != yaw ||
        old.flipBoard != flipBoard ||
        old.selectedRow != selectedRow ||
        old.selectedCol != selectedCol ||
        old.highlights != highlights ||
        old.destinationKeys != destinationKeys ||
        old.lastMoveKeys != lastMoveKeys ||
        old.lastMove != lastMove ||
        old.light != light ||
        old.dark != dark ||
        old.pieceDarkSplit != pieceDarkSplit ||
        old.pieceLight != pieceLight ||
        old.pieceDark != pieceDark ||
        old.hiddenKeys != hiddenKeys ||
        old.flyCol != flyCol ||
        old.flyRow != flyRow ||
        old.flyLift != flyLift ||
        old.flyScale != flyScale ||
        old.flyYaw != flyYaw ||
        old.burstProgress != burstProgress ||
        old.captureBursts != captureBursts ||
        old.light != light ||
        old.dark != dark ||
        old.gold != gold;
  }
}
