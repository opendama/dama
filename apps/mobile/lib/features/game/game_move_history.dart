import 'package:dama_mobile/core/board_square.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/game.dart';
import 'package:dama_mobile/core/ui/skip_pagination_bar.dart';
import 'package:dama_mobile/features/leaderboard/leaderboard_cubit.dart'
    show SkipMeta;
import 'package:flutter/material.dart';

/// Labels for Trim-style first/prev/go/next/last over move history pages.
class HistorySkipLabels {
  const HistorySkipLabels({
    required this.first,
    required this.prev,
    required this.next,
    required this.last,
    required this.go,
    required this.pageOfFmt,
  });

  final String first;
  final String prev;
  final String next;
  final String last;
  final String go;

  /// Supports `{page}`, `{pages}`, `{total}` placeholders.
  final String pageOfFmt;
}

/// Move history: Chess.com-style paired algebraic sidebar, or horizontal chip strip.
class GameMoveHistoryBar extends StatefulWidget {
  const GameMoveHistoryBar({
    super.key,
    required this.moves,
    required this.boardSize,
    required this.replayIndex,
    required this.onSelectLive,
    required this.onSelectMove,
    required this.liveLabel,
    required this.historyLabel,
    this.skipLabels,
    this.pageSize = 12,
    this.layout = GameMoveHistoryLayout.sidebar,
  });

  final List<MoveHistoryEntry> moves;
  final int boardSize;
  final int? replayIndex;
  final VoidCallback onSelectLive;
  final ValueChanged<int> onSelectMove;
  final String liveLabel;
  final String historyLabel;
  final HistorySkipLabels? skipLabels;
  final int pageSize;
  final GameMoveHistoryLayout layout;

  @override
  State<GameMoveHistoryBar> createState() => _GameMoveHistoryBarState();
}

enum GameMoveHistoryLayout { sidebar, horizontal }

class _GameMoveHistoryBarState extends State<GameMoveHistoryBar> {
  int _skip = 0;
  final _scrollCtrl = ScrollController();

  @override
  void dispose() {
    _scrollCtrl.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant GameMoveHistoryBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    final pageSize = widget.pageSize;
    if (widget.layout == GameMoveHistoryLayout.horizontal) {
      if (widget.replayIndex != null && widget.replayIndex! > 0) {
        final idx = widget.replayIndex! - 1;
        _skip = (idx ~/ pageSize) * pageSize;
      } else if (widget.moves.isNotEmpty) {
        _skip = ((widget.moves.length - 1) ~/ pageSize) * pageSize;
      } else {
        _skip = 0;
      }
    }
    if (widget.moves.length != oldWidget.moves.length ||
        widget.replayIndex != oldWidget.replayIndex) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!_scrollCtrl.hasClients) return;
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOut,
        );
      });
    }
  }

  String _pageSummary(int page, int totalPages, int total) {
    final fmt = widget.skipLabels?.pageOfFmt ?? '';
    if (fmt.isEmpty) return 'Page $page of $totalPages ($total)';
    return fmt
        .replaceAll('{page}', '$page')
        .replaceAll('{pages}', '$totalPages')
        .replaceAll('{total}', '$total');
  }

  SkipMeta _skipMeta({
    required int page,
    required int totalPages,
    required int total,
    required int pageSize,
  }) {
    final labels = widget.skipLabels;
    return SkipMeta(
      skip: _skip,
      limit: pageSize,
      page: page,
      totalPages: totalPages,
      total: total,
      hasMore: page < totalPages,
      firstSkip: page > 1 ? 0 : null,
      prevSkip: page > 1 ? (_skip - pageSize).clamp(0, _skip) : null,
      nextSkip: page < totalPages
          ? (_skip + pageSize).clamp(0, (totalPages - 1) * pageSize)
          : null,
      lastSkip: page < totalPages ? (totalPages - 1) * pageSize : null,
      firstActionLabel: labels?.first ?? '',
      prevActionLabel: labels?.prev ?? '',
      nextActionLabel: labels?.next ?? '',
      lastActionLabel: labels?.last ?? '',
      skipToActionLabel: labels?.go ?? '',
      pageSummary: _pageSummary(page, totalPages, total),
    );
  }

  String _algebraic(MoveHistoryEntry move) {
    return formatMoveAlgebraic(
      from: move.from,
      to: move.to,
      boardSize: widget.boardSize,
      captureCount: move.captures.length,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.moves.isEmpty) return const SizedBox.shrink();
    final live = widget.liveLabel.trim();
    final heading = widget.historyLabel.trim();
    if (live.isEmpty || heading.isEmpty) return const SizedBox.shrink();

    if (widget.layout == GameMoveHistoryLayout.sidebar) {
      return _buildSidebar(context, live, heading);
    }
    return _buildHorizontal(context, live, heading);
  }

  Widget _buildSidebar(BuildContext context, String live, String heading) {
    final colors = damaColorsOf(context);
    final ink = Theme.of(context).colorScheme.onSurface;
    final isLive = widget.replayIndex == null;
    final pairs = <({
      int num,
      MoveHistoryEntry? white,
      int? whiteIdx,
      MoveHistoryEntry? black,
      int? blackIdx
    })>[];
    for (var i = 0; i < widget.moves.length; i += 2) {
      pairs.add((
        num: (i ~/ 2) + 1,
        white: widget.moves[i],
        whiteIdx: i,
        black: i + 1 < widget.moves.length ? widget.moves[i + 1] : null,
        blackIdx: i + 1 < widget.moves.length ? i + 1 : null,
      ));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                heading,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: ink,
                ),
              ),
            ),
            Text(
              '${widget.moves.length}',
              style: TextStyle(fontSize: 12, color: colors.onSurfaceMuted),
            ),
          ],
        ),
        const SizedBox(height: 8),
        _Chip(
          label: live,
          active: isLive,
          capture: false,
          onTap: widget.onSelectLive,
          expanded: true,
          leading: Icon(
            Icons.radio_button_checked,
            size: 14,
            color: isLive ? colors.onGold : colors.onSurfaceMuted,
          ),
        ),
        const SizedBox(height: 8),
        // Bounded height so this works under the board Column (no Expanded parent).
        ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 220),
          child: ListView.builder(
            controller: _scrollCtrl,
            shrinkWrap: true,
            itemCount: pairs.length,
            itemBuilder: (context, i) {
              final pair = pairs[i];
              final whiteActive = pair.whiteIdx != null &&
                  widget.replayIndex == pair.whiteIdx! + 1;
              final blackActive = pair.blackIdx != null &&
                  widget.replayIndex == pair.blackIdx! + 1;
              final whiteCap = pair.white?.captures.length ?? 0;
              final blackCap = pair.black?.captures.length ?? 0;
              final whiteLabel =
                  pair.white != null ? _algebraic(pair.white!) : '';
              final blackLabel =
                  pair.black != null ? _algebraic(pair.black!) : '';
              return Container(
                decoration: BoxDecoration(
                  color: i.isOdd
                      ? colors.surfaceMuted.withValues(alpha: 0.45)
                      : null,
                  border: Border(
                    bottom: BorderSide(color: colors.borderSubtle),
                  ),
                ),
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  children: [
                    SizedBox(
                      width: 28,
                      child: Text(
                        '${pair.num}.',
                        textAlign: TextAlign.right,
                        style: TextStyle(
                          fontSize: 11,
                          color: colors.onSurfaceMuted,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: pair.white != null
                          ? _PlyCell(
                              label: whiteLabel,
                              active: whiteActive,
                              capture: whiteCap > 0,
                              onTap: () =>
                                  widget.onSelectMove(pair.whiteIdx! + 1),
                            )
                          : const SizedBox.shrink(),
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: pair.black != null
                          ? _PlyCell(
                              label: blackLabel,
                              active: blackActive,
                              capture: blackCap > 0,
                              onTap: () =>
                                  widget.onSelectMove(pair.blackIdx! + 1),
                            )
                          : const SizedBox.shrink(),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildHorizontal(BuildContext context, String live, String heading) {
    final colors = damaColorsOf(context);
    final ink = Theme.of(context).colorScheme.onSurface;
    final isLive = widget.replayIndex == null;
    final pageSize = widget.pageSize;
    final total = widget.moves.length;
    final totalPages = (total / pageSize).ceil().clamp(1, 999999);
    final page = (_skip ~/ pageSize) + 1;
    final pageMoves = widget.moves.skip(_skip).take(pageSize).toList();

    return LayoutBuilder(
      builder: (context, constraints) {
        return ConstrainedBox(
          constraints: BoxConstraints(maxWidth: constraints.maxWidth),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      heading,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: ink,
                      ),
                    ),
                  ),
                  Text(
                    '$total',
                    style:
                        TextStyle(fontSize: 12, color: colors.onSurfaceMuted),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  _Chip(
                    label: live,
                    active: isLive,
                    capture: false,
                    onTap: widget.onSelectLive,
                    leading: Icon(
                      Icons.radio_button_checked,
                      size: 14,
                      color: isLive ? colors.onGold : colors.onSurfaceMuted,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ClipRect(
                      child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        physics: const BouncingScrollPhysics(),
                        child: Row(
                          children: [
                            for (var i = 0; i < pageMoves.length; i++) ...[
                              if (i > 0) const SizedBox(width: 8),
                              Builder(
                                builder: (_) {
                                  final index = _skip + i;
                                  final move = pageMoves[i];
                                  final active =
                                      widget.replayIndex == index + 1;
                                  final captured = move.captures.isNotEmpty;
                                  final algebraic = _algebraic(move);
                                  return _Chip(
                                    label: algebraic.isNotEmpty
                                        ? '${index + 1} $algebraic'
                                        : '${index + 1}',
                                    active: active,
                                    capture: captured && !active,
                                    onTap: () => widget.onSelectMove(index + 1),
                                  );
                                },
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              if (total > pageSize)
                SkipPaginationBar(
                  meta: _skipMeta(
                    page: page,
                    totalPages: totalPages,
                    total: total,
                    pageSize: pageSize,
                  ),
                  busy: false,
                  padding: const EdgeInsets.only(top: 8),
                  onSkip: (skip) => setState(() => _skip = skip),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _PlyCell extends StatelessWidget {
  const _PlyCell({
    required this.label,
    required this.active,
    required this.capture,
    required this.onTap,
  });

  final String label;
  final bool active;
  final bool capture;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = damaColorsOf(context);
    final ink = Theme.of(context).colorScheme.onSurface;
    final bg = active
        ? ink
        : capture
            ? colors.brand.withValues(alpha: 0.12)
            : Colors.transparent;
    final fg = active ? colors.onGold : ink;
    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(4),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(4),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: fg,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.active,
    required this.capture,
    required this.onTap,
    this.leading,
    this.expanded = false,
  });

  final String label;
  final bool active;
  final bool capture;
  final VoidCallback onTap;
  final Widget? leading;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final colors = damaColorsOf(context);
    final ink = Theme.of(context).colorScheme.onSurface;
    final bg = active
        ? ink
        : capture
            ? colors.brand.withValues(alpha: 0.12)
            : Colors.transparent;
    final fg = active ? colors.onGold : colors.onSurfaceMuted;
    final child = Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: active
              ? ink
              : capture
                  ? colors.brand.withValues(alpha: 0.4)
                  : colors.borderSubtle,
        ),
      ),
      child: Row(
        mainAxisSize: expanded ? MainAxisSize.max : MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (leading != null) ...[leading!, const SizedBox(width: 6)],
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: fg,
            ),
          ),
        ],
      ),
    );
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: expanded ? child : child,
      ),
    );
  }
}
