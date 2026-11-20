import 'dart:async';
import 'dart:math' as math;

import 'package:dama_mobile/core/audio/game_notify.dart';
import 'package:dama_mobile/core/board_square.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/game.dart';
import 'package:dama_mobile/features/game/palace_piece.dart';
import 'package:flutter/material.dart';

/// Flat Chess.com-style board (default). Same tap + move_history animation
/// contract as [DraughtsBoard3D] (pick→hold→travel→land, legal/select/must,
/// last-ply highlights).
class DraughtsBoard2D extends StatefulWidget {
  const DraughtsBoard2D({
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
    this.replayMode = false,
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
  final bool flipBoard;
  final int? yourPlayer;
  final List<MoveHistoryEntry> moveHistory;
  final bool replayMode;
  final void Function(List<List<dynamic>> boardAfter)? onPlyAnimated;
  final int illegalShakeKey;

  @override
  State<DraughtsBoard2D> createState() => _DraughtsBoard2DState();
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

class _DraughtsBoard2DState extends State<DraughtsBoard2D>
    with TickerProviderStateMixin {
  static const _pickPhaseEnd = 0.24;
  static const _holdPhaseEnd = 0.34;
  static const _landPhaseStart = 0.72;
  static const _moveDurationMinMs = 720;
  static const _captureDurationMinMs = 920;
  static const _durationPerSquareMs = 160;
  static const _moveDurationMaxMs = 1650;
  static const _opponentMoveMinMs = 340;
  static const _opponentCaptureMinMs = 440;
  static const _opponentPerSquareMs = 90;
  static const _opponentMaxMs = 820;

  late final AnimationController _anim;
  late final AnimationController _shakeCtrl;
  List<List<dynamic>> _renderBoard = const [];
  _ActiveAnim? _active;
  double _progress = 0;
  final List<_ActiveAnim> _queue = [];
  int _prevHistoryLen = 0;
  bool _holdSync = false;

  @override
  void initState() {
    super.initState();
    _renderBoard = _cloneBoard(widget.board);
    _prevHistoryLen = widget.moveHistory.length;
    _anim = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 900))
      ..addListener(() {
        setState(() {
          final prev = _progress;
          _progress = _anim.value;
          final active = _active;
          if (active != null &&
              !active.boardApplied &&
              active.boardAfter != null &&
              active.boardAfter!.isNotEmpty &&
              prev < _landPhaseStart &&
              _progress >= _landPhaseStart) {
            active.boardApplied = true;
            _renderBoard = _cloneBoard(active.boardAfter!);
            widget.onPlyAnimated?.call(active.boardAfter!);
            if (!widget.replayMode) {
              // Put-down only - Chess.com move / capture / promote.
              unawaited(
                GameNotify.playPiecePlace(
                  captured: active.isCapture,
                  promoted: active.isPromotion,
                ),
              );
            }
          }
        });
      })
      ..addStatusListener((status) {
        if (status == AnimationStatus.completed) {
          _finishAndAdvance();
        }
      });
    _shakeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    )..addListener(() => setState(() {}));
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
      if (!widget.replayMode) {
        unawaited(
          GameNotify.playPiecePlace(
            captured: finished.isCapture,
            promoted: finished.isPromotion,
          ),
        );
      }
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
  void didUpdateWidget(covariant DraughtsBoard2D oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.illegalShakeKey != oldWidget.illegalShakeKey &&
        widget.illegalShakeKey != 0) {
      _shakeCtrl.forward(from: 0);
    }

    if (widget.replayMode) {
      _queue.clear();
      _active = null;
      _holdSync = false;
      _anim.stop();
      _renderBoard = _cloneBoard(widget.board);
      return;
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

  static _ActiveAnim? _diffAnim(
    List<List<dynamic>> prev,
    List<List<dynamic>> next,
    List<List<int>> legalHint,
  ) {
    if (prev.isEmpty || next.isEmpty || prev.length != next.length) return null;
    final size = prev.length;
    final emptied = <(int, int)>[];
    final filled = <(int, int)>[];
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        final a = r < prev.length && c < prev[r].length ? prev[r][c] : null;
        final b = r < next.length && c < next[r].length ? next[r][c] : null;
        final aMap = a is Map ? a : null;
        final bMap = b is Map ? b : null;
        if (aMap != null && bMap == null) emptied.add((r, c));
        if (aMap == null && bMap != null) filled.add((r, c));
        if (aMap != null &&
            bMap != null &&
            (aMap['p'] != bMap['p'] || aMap['k'] != bMap['k'])) {
          emptied.add((r, c));
          filled.add((r, c));
        }
      }
    }
    if (filled.length != 1) return null;
    final to = filled.first;
    final dest = next[to.$1][to.$2];
    if (dest is! Map) return null;
    final destP = (dest['p'] as num?)?.toInt() ?? 1;
    (int, int)? from;
    final captures = <(int, int)>[];
    for (final sq in emptied) {
      final was = prev[sq.$1][sq.$2];
      if (was is! Map) continue;
      final wp = (was['p'] as num?)?.toInt();
      if (wp == destP) {
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
      player: destP == 2 ? 2 : 1,
      isKing: isKing,
      isPromotion: isKing && !wasKing,
      captures: captures,
      isCapture: captures.isNotEmpty,
      boardAfter: next,
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

  bool _isDark(int row, int col) => (row + col).isOdd;

  Set<String> get _targets {
    final out = <String>{};
    final hasSel = widget.selectedRow != null && widget.selectedCol != null;
    for (final m in widget.legalMoves) {
      if (m.length < 4) continue;
      if (hasSel) {
        if (m[0] == widget.selectedRow && m[1] == widget.selectedCol) {
          out.add('${m[2]},${m[3]}');
        }
      }
    }
    return out;
  }

  Set<String> get _origins {
    final out = <String>{};
    if (widget.selectedRow != null) return out;
    for (final m in widget.legalMoves) {
      if (m.length >= 2) out.add('${m[0]},${m[1]}');
    }
    return out;
  }

  Set<String> get _hiddenKeys {
    final a = _active;
    if (a == null || _progress >= 1) return {};
    final set = <String>{'${a.fromR},${a.fromC}', '${a.toR},${a.toC}'};
    for (final c in a.captures) {
      set.add('${c.$1},${c.$2}');
    }
    return set;
  }

  (String, String)? get _lastMoveKeys {
    if (widget.replayMode || _active != null || widget.moveHistory.isEmpty) {
      return null;
    }
    final last = widget.moveHistory.last;
    if (last.from.length < 2 || last.to.length < 2) return null;
    return (
      '${last.from[0]},${last.from[1]}',
      '${last.to[0]},${last.to[1]}',
    );
  }

  /// Visual travel fraction after pick/hold.
  double _travelT(double progress) {
    if (progress < _holdPhaseEnd) return 0;
    if (progress >= _landPhaseStart) return 1;
    final t = (progress - _holdPhaseEnd) / (_landPhaseStart - _holdPhaseEnd);
    return t < 0.5 ? 4 * t * t * t : 1 - math.pow(-2 * t + 2, 3).toDouble() / 2;
  }

  double _flyScale(double progress) {
    if (progress < _pickPhaseEnd) {
      final t = progress / _pickPhaseEnd;
      final ease = t * t * (3 - 2 * t);
      return 1 + ease * 0.08;
    }
    if (progress < _landPhaseStart) return 1.08;
    final t = (progress - _landPhaseStart) / (1 - _landPhaseStart);
    final ease = t * t * (3 - 2 * t);
    return 1.08 - ease * 0.08;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final size = widget.boardSize;
    if (size <= 0) return const SizedBox.shrink();

    final display = (_holdSync || _active != null || _queue.isNotEmpty)
        ? _renderBoard
        : widget.board;
    final targets = _targets;
    final origins = _origins;
    final hidden = _hiddenKeys;
    final lastMove = _lastMoveKeys;
    final shakeT = _shakeCtrl.value;
    final shakeAmp = (1.0 - shakeT) * 4.0;
    final shakeDx =
        shakeAmp > 0.05 ? math.sin(shakeT * math.pi * 10) * shakeAmp : 0.0;

    return AspectRatio(
      aspectRatio: 1,
      child: Transform.translate(
        offset: Offset(shakeDx, 0),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final side = math.min(constraints.maxWidth, constraints.maxHeight);
            final cell = side / size;
            Widget? fly;
            final active = _active;
            if (active != null && _progress < 1) {
              final t = _travelT(_progress);
              final scale = _flyScale(_progress);
              final fromR =
                  widget.flipBoard ? size - 1 - active.fromR : active.fromR;
              final fromC =
                  widget.flipBoard ? size - 1 - active.fromC : active.fromC;
              final toR = widget.flipBoard ? size - 1 - active.toR : active.toR;
              final toC = widget.flipBoard ? size - 1 - active.toC : active.toC;
              final vr = fromR + (toR - fromR) * t;
              final vc = fromC + (toC - fromC) * t;
              final piece = cell * 0.98;
              fly = Positioned(
                left: vc * cell + (cell - piece) / 2,
                top: vr * cell + (cell - piece) / 2,
                width: piece,
                height: piece,
                child: Transform.scale(
                  scale: scale,
                  child: _PieceDisc(
                    player: active.player,
                    king: active.isKing,
                    light: tokens.pieceLight,
                    dark: tokens.pieceDark,
                    darkSplit: tokens.pieceDarkSplit,
                    border: const Color(0x44000000),
                    borderWidth: 1,
                  ),
                ),
              );
            }

            return Stack(
              clipBehavior: Clip.hardEdge,
              children: [
                GridView.builder(
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: size,
                  ),
                  itemCount: size * size,
                  itemBuilder: (context, i) {
                    final visualRow = i ~/ size;
                    final visualCol = i % size;
                    final row =
                        widget.flipBoard ? size - 1 - visualRow : visualRow;
                    final col =
                        widget.flipBoard ? size - 1 - visualCol : visualCol;
                    final dark = _isDark(row, col);
                    final cellData =
                        (row < display.length && col < display[row].length)
                            ? display[row][col]
                            : null;
                    final selected =
                        widget.selectedRow == row && widget.selectedCol == col;
                    final must = widget.mustContinueRow == row &&
                        widget.mustContinueCol == col;
                    final key = '$row,$col';
                    final isTarget = targets.contains(key);
                    final isLastFrom = lastMove?.$1 == key;
                    final isLastTo = lastMove?.$2 == key;
                    int? player;
                    var king = false;
                    if (cellData is Map) {
                      final p = cellData['p'];
                      if (p is num) player = p.toInt();
                      king = cellData['k'] == true;
                    }
                    // Select / dest / must use boardSelected; last-move uses Chess yellow.
                    final isLast = isLastFrom || isLastTo;
                    final squareHighlighted = selected ||
                        isTarget ||
                        must ||
                        isLast ||
                        (widget.selectedRow == null && origins.contains(key));
                    final hidePiece = hidden.contains(key);
                    final canTap =
                        widget.interactive && dark && _active == null;
                    final hi = tokens.boardSelected;
                    final lastHi = tokens.lastMove;
                    final disc = Color.lerp(hi, Colors.white, 0.45) ?? hi;
                    final squareColor = !squareHighlighted
                        ? (dark ? tokens.boardDark : tokens.boardLight)
                        : (isLast && !selected && !must && !isTarget
                            ? lastHi
                            : hi);

                    return Material(
                      color: squareColor,
                      child: InkWell(
                        onTap: canTap
                            ? () => widget.onSelectSquare(row, col)
                            : null,
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            ..._boardCoordLabels(
                              row: row,
                              col: col,
                              boardSize: size,
                              flipBoard: widget.flipBoard,
                              isDark: dark,
                              light: tokens.boardLight,
                              darkColor: tokens.boardDark,
                            ),
                            if (isTarget)
                              FractionallySizedBox(
                                widthFactor: 0.44,
                                heightFactor: 0.44,
                                child: DecoratedBox(
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: disc.withValues(alpha: 0.95),
                                    boxShadow: [
                                      BoxShadow(
                                        color: hi.withValues(alpha: 0.7),
                                        blurRadius: 10,
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            if (player != null && !hidePiece)
                              FractionallySizedBox(
                                widthFactor: 0.98,
                                heightFactor: 0.98,
                                // Square fill is the movable cue - no under-piece ring.
                                child: _PieceDisc(
                                  player: player,
                                  king: king,
                                  light: tokens.pieceLight,
                                  dark: tokens.pieceDark,
                                  darkSplit: tokens.pieceDarkSplit,
                                  border: const Color(0x44000000),
                                  borderWidth: 1,
                                  glow: selected || must ? hi : null,
                                  scale: selected || must ? 1.1 : 1.0,
                                ),
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
                if (fly != null) fly,
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Chess.com-style in-square algebraic rails (palette-contrast ink).
List<Widget> _boardCoordLabels({
  required int row,
  required int col,
  required int boardSize,
  required bool flipBoard,
  required bool isDark,
  required Color light,
  required Color darkColor,
}) {
  final showRank = isVisualLeftFile(col, boardSize, flipBoard);
  final showFile = isVisualBottomRank(row, boardSize, flipBoard);
  if (!showRank && !showFile) return const [];
  final ink = boardCoordUsesLightInk(isDark) ? light : darkColor;
  final fontSize = boardSize >= 10 ? 9.0 : 10.5;
  final style = TextStyle(
    color: ink,
    fontSize: fontSize,
    fontWeight: FontWeight.w700,
    height: 1,
  );
  return [
    if (showRank)
      Positioned(
        left: 3,
        top: 2,
        child: Text(
          '${boardRankNumber(row, boardSize)}',
          style: style,
        ),
      ),
    if (showFile)
      Positioned(
        right: 3,
        bottom: 2,
        child: Text(
          boardFileLetter(col),
          style: style,
        ),
      ),
  ];
}

class _PieceDisc extends StatelessWidget {
  const _PieceDisc({
    required this.player,
    required this.king,
    required this.light,
    required this.dark,
    required this.border,
    required this.borderWidth,
    this.darkSplit = false,
    this.glow,
    this.scale = 1,
  });

  final int player;
  final bool king;
  final Color light;
  final Color dark;
  final bool darkSplit;
  final Color border;
  final double borderWidth;
  final Color? glow;
  final double scale;

  @override
  Widget build(BuildContext context) {
    final role = palacePieceRole(player, king);
    // Neo silhouette fills the square (Chess.com Neo pattern) - not a stamped disc.
    return Transform.scale(
      scale: scale,
      child: DecoratedBox(
        decoration: BoxDecoration(
          boxShadow: [
            const BoxShadow(
              color: Color(0x55000000),
              blurRadius: 3,
              offset: Offset(0, 2),
            ),
            if (glow != null)
              BoxShadow(
                color: glow!.withValues(alpha: 0.85),
                blurRadius: 12,
                spreadRadius: 1,
              ),
          ],
        ),
        child: PalacePieceMark(
          role: role,
          pieceLight: light,
          pieceDark: dark,
          player: player,
          darkSplit: darkSplit,
        ),
      ),
    );
  }
}
