import 'dart:math' as math;

import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/platform_stats_chrome.dart';
import 'package:dama_mobile/features/home/activity_stacked_chart.dart';
import 'package:dama_mobile/features/home/chart_sticky_tip.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class ActivityCumulativeChart extends StatefulWidget {
  const ActivityCumulativeChart({
    super.key,
    required this.title,
    required this.emptyLabel,
    required this.seriesLabel,
    required this.series,
  });

  final String title;
  final String emptyLabel;
  final String seriesLabel;
  final List<PlatformSeriesPoint> series;

  @override
  State<ActivityCumulativeChart> createState() =>
      _ActivityCumulativeChartState();
}

class _ActivityCumulativeChartState extends State<ActivityCumulativeChart>
    with ChartTipHost {
  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final titleTrim = widget.title.trim();
    final empty = widget.emptyLabel.trim();
    final label = widget.seriesLabel.trim();
    if (titleTrim.isEmpty || empty.isEmpty || label.isEmpty) {
      return const SizedBox.shrink();
    }

    var run = 0.0;
    final points = <_CumPoint>[];
    for (final row in widget.series) {
      final day = row.bucket.trim();
      if (day.isEmpty) continue;
      final dayLabel = formatBucketDayLabel(day);
      if (dayLabel.isEmpty) continue;
      final games = row.values['games'] ?? 0;
      if (games > 0) run += games;
      points.add(_CumPoint(day: day, dayLabel: dayLabel, total: run));
    }
    final hasPlot = points.any((p) => p.total > 0);
    final fmt = NumberFormat.decimalPattern();
    final activeIdx =
        tipKey == null ? null : points.indexWhere((p) => p.day == tipKey);
    final active =
        activeIdx != null && activeIdx >= 0 ? points[activeIdx] : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          titleTrim,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 12),
        LayoutBuilder(
          builder: (context, constraints) {
            final h = constraints.maxWidth >= 768
                ? 288.0
                : constraints.maxWidth >= 640
                    ? 256.0
                    : 208.0;
            return SizedBox(
              height: h,
              width: double.infinity,
              child: hasPlot
                  ? TapRegion(
                      onTapOutside: (_) => onTipOutside(),
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTapUp: (details) {
                          final idx = _nearestIndex(
                            details.localPosition.dx,
                            constraints.maxWidth,
                            points.length,
                          );
                          if (idx == null) {
                            clearTip();
                            return;
                          }
                          openOrToggleTip(
                              points[idx].day, details.localPosition);
                        },
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            CustomPaint(
                              size: Size(constraints.maxWidth, h),
                              painter: _CumulativePainter(
                                points: [
                                  for (var i = 0; i < points.length; i++)
                                    Offset(i.toDouble(), points[i].total),
                                ],
                                stroke: Theme.of(context).colorScheme.onSurface,
                                fill: tokens.gold.withValues(alpha: 0.25),
                                grid: tokens.borderSubtle,
                                activeIndex: activeIdx,
                              ),
                            ),
                            if (active != null && tipAnchor != null)
                              ChartStickyTipOverlay(
                                anchor: tipAnchor!,
                                child: ChartStickyTipBubble(
                                  title: active.dayLabel,
                                  lines: [
                                    ChartStickyTipLine(
                                      label: label,
                                      value: fmt.format(active.total.round()),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                    )
                  : Center(
                      child: Text(
                        empty,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            color: tokens.onSurfaceMuted, fontSize: 13),
                      ),
                    ),
            );
          },
        ),
      ],
    );
  }

  int? _nearestIndex(double x, double width, int n) {
    if (n <= 0 || width <= 0) return null;
    const pad = 8.0;
    final chartW = width - pad * 2;
    if (chartW <= 0) return null;
    final t = ((x - pad) / chartW).clamp(0.0, 1.0);
    if (n == 1) return 0;
    return (t * (n - 1)).round().clamp(0, n - 1);
  }
}

class _CumPoint {
  const _CumPoint({
    required this.day,
    required this.dayLabel,
    required this.total,
  });
  final String day;
  final String dayLabel;
  final double total;
}

class _CumulativePainter extends CustomPainter {
  _CumulativePainter({
    required this.points,
    required this.stroke,
    required this.fill,
    required this.grid,
    this.activeIndex,
  });

  final List<Offset> points;
  final Color stroke;
  final Color fill;
  final Color grid;
  final int? activeIndex;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty) return;
    final maxY = points.map((p) => p.dy).fold<double>(0, math.max);
    final maxX = math.max(1, points.length - 1).toDouble();
    final pad = 8.0;

    final gridPaint = Paint()
      ..color = grid
      ..strokeWidth = 1;
    for (var i = 0; i <= 3; i++) {
      final y = pad + (size.height - pad * 2) * i / 3;
      canvas.drawLine(Offset(pad, y), Offset(size.width - pad, y), gridPaint);
    }

    Offset map(Offset p) {
      final x = pad + (size.width - pad * 2) * (p.dx / maxX);
      final y = size.height -
          pad -
          (size.height - pad * 2) * (maxY <= 0 ? 0 : p.dy / maxY);
      return Offset(x, y);
    }

    final mapped = points.map(map).toList();
    final path = Path()..moveTo(mapped.first.dx, size.height - pad);
    for (final p in mapped) {
      path.lineTo(p.dx, p.dy);
    }
    path.lineTo(mapped.last.dx, size.height - pad);
    path.close();

    canvas.drawPath(path, Paint()..color = fill);
    final line = Path()..moveTo(mapped.first.dx, mapped.first.dy);
    for (var i = 1; i < mapped.length; i++) {
      line.lineTo(mapped[i].dx, mapped[i].dy);
    }
    canvas.drawPath(
      line,
      Paint()
        ..color = stroke
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );

    final ai = activeIndex;
    if (ai != null && ai >= 0 && ai < mapped.length) {
      canvas.drawCircle(mapped[ai], 5, Paint()..color = stroke);
    }
  }

  @override
  bool shouldRepaint(covariant _CumulativePainter oldDelegate) {
    return oldDelegate.points != points ||
        oldDelegate.stroke != stroke ||
        oldDelegate.fill != fill ||
        oldDelegate.activeIndex != activeIndex;
  }
}
