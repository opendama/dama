import 'dart:math' as math;

import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:flutter/material.dart';

/// Compact tip bubble matching web Recharts / Trim chart tooltips.
class ChartStickyTipBubble extends StatelessWidget {
  const ChartStickyTipBubble({
    super.key,
    required this.lines,
    this.title,
  });

  final String? title;
  final List<ChartStickyTipLine> lines;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final maxW = math.min(240.0, MediaQuery.sizeOf(context).width - 20);
    return Material(
      color: Colors.transparent,
      elevation: 0,
      child: Container(
        constraints: BoxConstraints(maxWidth: maxW),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: tokens.card,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: tokens.borderSubtle),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.14),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: DefaultTextStyle(
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
            fontSize: 12,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if ((title ?? '').trim().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    title!.trim(),
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              for (final line in lines)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 1),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (line.color != null) ...[
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: line.color,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                      ],
                      if (line.label.trim().isNotEmpty) ...[
                        Flexible(
                          child: Text(
                            line.label,
                            style: TextStyle(color: tokens.onSurfaceMuted),
                          ),
                        ),
                        const SizedBox(width: 10),
                      ],
                      Text(
                        line.value,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontFeatures: [FontFeature.tabularFigures()],
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
}

class ChartStickyTipLine {
  const ChartStickyTipLine({
    required this.label,
    required this.value,
    this.color,
  });
  final String label;
  final String value;
  final Color? color;
}

/// Positions a tip near [anchor], clamped inside the parent Stack (and viewport).
class ChartStickyTipOverlay extends StatelessWidget {
  const ChartStickyTipOverlay({
    super.key,
    required this.anchor,
    required this.child,
  });

  final Offset anchor;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: CustomSingleChildLayout(
        delegate: _ClampTipDelegate(anchor: anchor),
        child: IgnorePointer(child: child),
      ),
    );
  }
}

/// Prefer above + centered on anchor; clamp to parent bounds (right-edge safe).
class _ClampTipDelegate extends SingleChildLayoutDelegate {
  _ClampTipDelegate({required this.anchor});

  final Offset anchor;
  static const _pad = 8.0;

  @override
  BoxConstraints getConstraintsForChild(BoxConstraints constraints) {
    final maxW = math.max(0.0, constraints.maxWidth - _pad * 2);
    return BoxConstraints(
      maxWidth: math.min(240, maxW),
      maxHeight: math.max(0.0, constraints.maxHeight - _pad * 2),
    );
  }

  @override
  Offset getPositionForChild(Size size, Size childSize) {
    // Prefer centered above the tap point.
    var left = anchor.dx - childSize.width / 2;
    var top = anchor.dy - 8 - childSize.height;

    // Flip below when not enough room above.
    if (top < _pad) {
      top = anchor.dy + 12;
    }

    left =
        left.clamp(_pad, math.max(_pad, size.width - _pad - childSize.width));
    top =
        top.clamp(_pad, math.max(_pad, size.height - _pad - childSize.height));
    return Offset(left, top);
  }

  @override
  bool shouldRelayout(covariant _ClampTipDelegate oldDelegate) =>
      oldDelegate.anchor != anchor;
}

/// Mixin: open tip, ignore the same-frame outside tap that opened it.
mixin ChartTipHost<T extends StatefulWidget> on State<T> {
  String? tipKey;
  Offset? tipAnchor;
  int _openedAtMs = 0;

  bool get hasTip => tipKey != null && tipAnchor != null;

  void openOrToggleTip(String key, Offset anchor) {
    setState(() {
      if (tipKey == key) {
        tipKey = null;
        tipAnchor = null;
      } else {
        tipKey = key;
        tipAnchor = anchor;
        _openedAtMs = DateTime.now().millisecondsSinceEpoch;
      }
    });
  }

  void clearTip() {
    if (!hasTip) return;
    setState(() {
      tipKey = null;
      tipAnchor = null;
    });
  }

  void onTipOutside() {
    if (DateTime.now().millisecondsSinceEpoch - _openedAtMs < 120) return;
    clearTip();
  }
}
