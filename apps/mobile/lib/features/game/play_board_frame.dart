import 'package:dama_mobile/core/prefs/board_view_prefs.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:flutter/material.dart';

/// Chess.com column: top seat + square board + bottom seat share one width (flush L/R).
/// Pass 2D/3D into the top seat as `trailing` so the timer stays flush with the board edge.
class PlayBoardFrame extends StatelessWidget {
  const PlayBoardFrame({
    super.key,
    required this.topSeat,
    required this.bottomSeat,
    required this.board,
    @Deprecated(
        'Pass toggle into topSeat trailing so the clock stays flush-right')
    this.boardViewToggle,
    this.vsLabel = '',
    this.sideWidth = 56,
    this.wideBreakpoint = 720,

    /// Intro/result: covers the square board plane only (not seats).
    this.coverOverlay,
  });

  final Widget topSeat;
  final Widget bottomSeat;
  final Widget board;
  final Widget? boardViewToggle;
  final String vsLabel;
  final double sideWidth;
  final double wideBreakpoint;
  final Widget? coverOverlay;

  static const double _seatGap = 2;
  static const double _seatRowH = 40;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxW = constraints.maxWidth;
        final maxH = constraints.maxHeight;
        if (!maxW.isFinite || maxW <= 0) {
          return const SizedBox.shrink();
        }

        final reserved = _seatRowH * 2 + _seatGap * 2;
        // Prefer full width on phone/tablet when height allows; otherwise fit height.
        final double side;
        if (maxH.isFinite && maxH > 0) {
          final availH = maxH - reserved;
          side = (maxW <= availH ? maxW : availH).clamp(0.0, double.infinity);
        } else {
          // Unbounded height (rare): size from width only.
          side = maxW;
        }

        if (side <= 0) {
          return const SizedBox.shrink();
        }

        return Center(
          child: SizedBox(
            width: side,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(height: _seatRowH, child: topSeat),
                const SizedBox(height: _seatGap),
                SizedBox(
                  width: side,
                  height: side,
                  child: Stack(
                    fit: StackFit.expand,
                    clipBehavior: Clip.hardEdge,
                    children: [
                      board,
                      if (coverOverlay != null)
                        Positioned.fill(child: coverOverlay!),
                    ],
                  ),
                ),
                const SizedBox(height: _seatGap),
                SizedBox(height: _seatRowH, child: bottomSeat),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Compact 2D / 3D control for the board header (horizontal; Chess.com-adjacent).
class CompactBoardViewToggle extends StatelessWidget {
  const CompactBoardViewToggle({
    super.key,
    required this.selected,
    required this.onChanged,
    required this.label2d,
    required this.label3d,
  });

  final BoardViewMode selected;
  final ValueChanged<BoardViewMode> onChanged;
  final String label2d;
  final String label3d;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    Widget chip(BoardViewMode mode, String label, IconData icon) {
      final on = selected == mode;
      return Material(
        color: on ? tokens.brand.withValues(alpha: 0.15) : tokens.surfaceMuted,
        borderRadius: BorderRadius.circular(6),
        child: InkWell(
          onTap: () => onChanged(mode),
          borderRadius: BorderRadius.circular(6),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 5),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon,
                    size: 13, color: on ? tokens.brand : tokens.onSurfaceMuted),
                const SizedBox(width: 3),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: on ? tokens.brand : tokens.onSurfaceMuted,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        border: Border.all(color: tokens.borderSubtle),
        borderRadius: BorderRadius.circular(6),
        color: tokens.card,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          chip(BoardViewMode.flat2d, label2d, Icons.grid_view),
          const SizedBox(width: 3),
          chip(BoardViewMode.scene3d, label3d, Icons.view_in_ar_outlined),
        ],
      ),
    );
  }
}
