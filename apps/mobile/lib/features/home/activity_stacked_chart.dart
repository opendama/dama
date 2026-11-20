import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/platform_stats_chrome.dart';
import 'package:dama_mobile/features/home/chart_sticky_tip.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// Trim UsageStackedChart parity - stacked area + ranked legend with %.
class ActivityStackedChart extends StatelessWidget {
  const ActivityStackedChart({
    super.key,
    required this.title,
    required this.subtitle,
    required this.yAxisLabel,
    required this.series,
    required this.seriesMeta,
    required this.emptyLabel,
    required this.legendAria,
    required this.todayDay,
    required this.todayLabel,
  });

  final String title;
  final String subtitle;
  final String yAxisLabel;
  final List<PlatformSeriesPoint> series;
  final List<PlatformSeriesMeta> seriesMeta;
  final String emptyLabel;
  final String legendAria;
  final String todayDay;
  final String todayLabel;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final titleTrim = title.trim();
    final aria = legendAria.trim();
    if (titleTrim.isEmpty || aria.isEmpty) return const SizedBox.shrink();

    final onSurface = Theme.of(context).colorScheme.onSurface;
    final meta = <_SeriesPaint>[];
    for (final m in seriesMeta) {
      final id = m.key.trim();
      final label = m.label.trim();
      final color = resolveSeriesColor(m.colorClass, tokens, onSurface);
      if (id.isEmpty || label.isEmpty || color == null) continue;
      meta.add(_SeriesPaint(id: id, label: label, color: color));
    }

    final daily = <_ChartRow>[];
    for (final pt in series) {
      final day = pt.bucket.trim();
      final dayLabel = formatBucketDayLabel(day);
      if (day.isEmpty || dayLabel.isEmpty) continue;
      final vals = <String, double>{};
      for (final s in meta) {
        final v = pt.values[s.id];
        if (v != null && v >= 0) vals[s.id] = v.toDouble();
      }
      daily.add(_ChartRow(day: day, dayLabel: dayLabel, values: vals));
    }
    // Cap year density (web ActivityStackedChart parity) to avoid jank on period switch.
    const maxPoints = 62;
    final rows = <_ChartRow>[];
    if (daily.length <= maxPoints) {
      rows.addAll(daily);
    } else {
      final stride = (daily.length / maxPoints).ceil();
      for (var i = 0; i < daily.length; i += stride) {
        final end = math.min(i + stride, daily.length);
        final chunk = daily.sublist(i, end);
        if (chunk.isEmpty) continue;
        final first = chunk.first;
        final vals = <String, double>{};
        for (final s in meta) {
          var sum = 0.0;
          for (final row in chunk) {
            sum += row.values[s.id] ?? 0;
          }
          vals[s.id] = sum;
        }
        rows.add(
            _ChartRow(day: first.day, dayLabel: first.dayLabel, values: vals));
      }
    }

    final totals = <String, double>{};
    for (final row in rows) {
      for (final s in meta) {
        final v = row.values[s.id] ?? 0;
        totals[s.id] = (totals[s.id] ?? 0) + v;
      }
    }
    final periodTotal = totals.values.fold<double>(0, (a, b) => a + b);
    final ranked = [...meta]
      ..sort((a, b) => (totals[b.id] ?? 0).compareTo(totals[a.id] ?? 0));

    final hasSeries = meta.isNotEmpty && rows.isNotEmpty;
    final empty = emptyLabel.trim();

    return Semantics(
      label: aria,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            titleTrim,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                  letterSpacing: -0.2,
                ),
          ),
          if (subtitle.trim().isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              subtitle.trim(),
              style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 13),
            ),
          ],
          if (yAxisLabel.trim().isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              yAxisLabel.trim().toUpperCase(),
              style: TextStyle(
                color: tokens.onSurfaceMuted,
                fontSize: 11,
                letterSpacing: 0.6,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
          const SizedBox(height: 12),
          LayoutBuilder(
            builder: (context, constraints) {
              final h = constraints.maxWidth >= 600
                  ? 288.0
                  : constraints.maxWidth >= 400
                      ? 256.0
                      : 208.0;
              return SizedBox(
                height: h,
                child: hasSeries
                    ? _StackedAreaCanvas(
                        rows: rows,
                        meta: meta,
                        todayDay: todayDay.trim(),
                        todayLabel: todayLabel.trim(),
                        gridColor: tokens.borderSubtle,
                        axisColor: tokens.onSurfaceMuted,
                        mutedColor: tokens.onSurfaceMuted,
                      )
                    : Center(
                        child: empty.isEmpty
                            ? const SizedBox.shrink()
                            : Padding(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 24),
                                child: Text(
                                  empty,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: tokens.onSurfaceMuted,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                      ),
              );
            },
          ),
          if (hasSeries) ...[
            const SizedBox(height: 12),
            for (final s in ranked)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: s.color,
                        shape: BoxShape.circle,
                        border: Border.all(color: tokens.borderSubtle),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        s.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: tokens.onSurfaceMuted,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    Text(
                      NumberFormat.decimalPattern()
                          .format((totals[s.id] ?? 0).round()),
                      style: const TextStyle(
                        fontSize: 12,
                        fontFeatures: [ui.FontFeature.tabularFigures()],
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      width: 44,
                      child: Text(
                        sharePctText(totals[s.id] ?? 0, periodTotal),
                        textAlign: TextAlign.right,
                        style: TextStyle(
                          color: tokens.onSurfaceMuted,
                          fontSize: 12,
                          fontFeatures: const [ui.FontFeature.tabularFigures()],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _SeriesPaint {
  const _SeriesPaint({
    required this.id,
    required this.label,
    required this.color,
  });
  final String id;
  final String label;
  final Color color;
}

class _ChartRow {
  const _ChartRow({
    required this.day,
    required this.dayLabel,
    required this.values,
  });
  final String day;
  final String dayLabel;
  final Map<String, double> values;
}

Color? resolveSeriesColor(String raw, DamaColors tokens, Color onSurface) {
  final s = raw.trim();
  if (s.isEmpty) return null;
  final varMatch =
      RegExp(r'var\((--[a-z0-9-]+)\)', caseSensitive: false).firstMatch(s);
  final bgMatch = RegExp(r'bg-\[var\((--[a-z0-9-]+)\)\]', caseSensitive: false)
      .firstMatch(s);
  final token = varMatch?.group(1) ?? bgMatch?.group(1);
  if (token != null) {
    switch (token) {
      case '--dama-gold':
        return tokens.gold;
      case '--dama-text':
        return onSurface;
      case '--dama-muted':
        return tokens.onSurfaceMuted;
      case '--dama-danger':
        return tokens.danger;
      default:
        return null;
    }
  }
  if (s.startsWith('#') && (s.length == 7 || s.length == 9)) {
    final hex = s.substring(1);
    final value = int.tryParse(hex, radix: 16);
    if (value == null) return null;
    if (hex.length == 6) return Color(0xFF000000 | value);
    return Color(value);
  }
  return null;
}

String formatBucketDayLabel(String bucket) {
  final raw = bucket.trim();
  if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(raw)) return '';
  final parts = raw.split('-');
  final y = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  final d = int.tryParse(parts[2]);
  if (y == null || m == null || d == null) return '';
  final dt = DateTime.utc(y, m, d);
  if (dt.year != y || dt.month != m || dt.day != d) return '';
  // Trim formatDateShort parity: "Oct 2, 2026" (fixed locale; matches web en-US).
  return DateFormat.yMMMd('en_US').format(dt);
}

/// Month label for YYYY-MM (heatmap peak_month) - web `formatBucketMonthLabel` parity.
String formatBucketMonthLabel(String ym) {
  final raw = ym.trim();
  if (!RegExp(r'^\d{4}-\d{2}$').hasMatch(raw)) return '';
  final parts = raw.split('-');
  final y = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  if (y == null || m == null || m < 1 || m > 12) return '';
  final dt = DateTime.utc(y, m, 1);
  return DateFormat.yMMM('en_US').format(dt);
}

String formatCompactNumber(num n) {
  if (!n.isFinite) return '';
  final abs = n.abs();
  if (abs >= 1000000) {
    final v = n / 1000000;
    final t = abs >= 10000000 ? v.toStringAsFixed(0) : v.toStringAsFixed(1);
    return '${t.replaceAll(RegExp(r'\.0$'), '')}M';
  }
  if (abs >= 1000) {
    final v = n / 1000;
    final t = abs >= 10000 ? v.toStringAsFixed(0) : v.toStringAsFixed(1);
    return '${t.replaceAll(RegExp(r'\.0$'), '')}k';
  }
  return n.round().toString();
}

String sharePctText(double part, double total) {
  if (!(total > 0) || !part.isFinite) return '';
  final pct = (part / total * 1000).round() / 10;
  return '${pct.toStringAsFixed(1)}%';
}

class _StackedAreaCanvas extends StatefulWidget {
  const _StackedAreaCanvas({
    required this.rows,
    required this.meta,
    required this.todayDay,
    required this.todayLabel,
    required this.gridColor,
    required this.axisColor,
    required this.mutedColor,
  });

  final List<_ChartRow> rows;
  final List<_SeriesPaint> meta;
  final String todayDay;
  final String todayLabel;
  final Color gridColor;
  final Color axisColor;
  final Color mutedColor;

  @override
  State<_StackedAreaCanvas> createState() => _StackedAreaCanvasState();
}

class _StackedAreaCanvasState extends State<_StackedAreaCanvas>
    with ChartTipHost {
  static const _left = 40.0;
  static const _right = 8.0;

  @override
  Widget build(BuildContext context) {
    final activeIdx =
        tipKey == null ? -1 : widget.rows.indexWhere((r) => r.day == tipKey);
    final active = activeIdx >= 0 ? widget.rows[activeIdx] : null;
    final fmt = NumberFormat.decimalPattern();

    return TapRegion(
      onTapOutside: (_) => onTipOutside(),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapUp: (details) {
          final idx = _nearestIndex(details.localPosition.dx);
          if (idx == null) {
            clearTip();
            return;
          }
          openOrToggleTip(widget.rows[idx].day, details.localPosition);
        },
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            CustomPaint(
              painter: _StackedAreaPainter(
                rows: widget.rows,
                meta: widget.meta,
                todayDay: widget.todayDay,
                todayLabel: widget.todayLabel,
                gridColor: widget.gridColor,
                axisColor: widget.axisColor,
                mutedColor: widget.mutedColor,
                activeIndex: activeIdx >= 0 ? activeIdx : null,
              ),
              child: const SizedBox.expand(),
            ),
            if (active != null && tipAnchor != null)
              ChartStickyTipOverlay(
                anchor: tipAnchor!,
                child: ChartStickyTipBubble(
                  title: active.dayLabel,
                  lines: [
                    for (final s in _rankedLines(active))
                      ChartStickyTipLine(
                        label: s.label,
                        value: fmt.format(s.raw.round()),
                        color: s.color,
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  List<({String label, double raw, Color color})> _rankedLines(_ChartRow row) {
    final lines = <({String label, double raw, Color color})>[];
    for (final s in widget.meta) {
      final raw = row.values[s.id] ?? 0;
      if (raw > 0) {
        lines.add((label: s.label, raw: raw, color: s.color));
      }
    }
    lines.sort((a, b) => b.raw.compareTo(a.raw));
    return lines;
  }

  int? _nearestIndex(double x) {
    final n = widget.rows.length;
    if (n <= 0) return null;
    final box = context.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return null;
    final width = box.size.width;
    if (width <= 0) return null;
    final chartW = width - _left - _right;
    if (chartW <= 0) return null;
    final t = ((x - _left) / chartW).clamp(0.0, 1.0);
    if (n == 1) return 0;
    return (t * (n - 1)).round().clamp(0, n - 1);
  }
}

class _StackedAreaPainter extends CustomPainter {
  _StackedAreaPainter({
    required this.rows,
    required this.meta,
    required this.todayDay,
    required this.todayLabel,
    required this.gridColor,
    required this.axisColor,
    required this.mutedColor,
    this.activeIndex,
  });

  final List<_ChartRow> rows;
  final List<_SeriesPaint> meta;
  final String todayDay;
  final String todayLabel;
  final Color gridColor;
  final Color axisColor;
  final Color mutedColor;
  final int? activeIndex;

  @override
  void paint(Canvas canvas, Size size) {
    if (rows.isEmpty || meta.isEmpty) return;
    const left = 40.0;
    const right = 8.0;
    const top = 12.0;
    const bottom = 28.0;
    final chartW = size.width - left - right;
    final chartH = size.height - top - bottom;
    if (chartW <= 0 || chartH <= 0) return;

    var maxY = 0.0;
    for (final row in rows) {
      var sum = 0.0;
      for (final s in meta) {
        sum += row.values[s.id] ?? 0;
      }
      maxY = math.max(maxY, sum);
    }
    if (maxY <= 0) maxY = 1;

    final gridPaint = Paint()
      ..color = gridColor
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;
    for (var i = 0; i <= 4; i++) {
      final y = top + chartH * (i / 4);
      canvas.drawLine(Offset(left, y), Offset(left + chartW, y), gridPaint);
    }

    final n = rows.length;
    final dx = n <= 1 ? 0.0 : chartW / (n - 1);

    Offset pt(int i, double yVal) {
      final x = left + (n <= 1 ? chartW / 2 : i * dx);
      final y = top + chartH * (1 - (yVal / maxY));
      return Offset(x, y);
    }

    // Draw stacks bottom-up: for each series, fill between cumulative base and top.
    final bases = List<double>.filled(n, 0);
    for (final s in meta) {
      final path = Path();
      final tops = <Offset>[];
      for (var i = 0; i < n; i++) {
        final v = rows[i].values[s.id] ?? 0;
        final topVal = bases[i] + v;
        tops.add(pt(i, topVal));
      }
      path.moveTo(tops.first.dx, tops.first.dy);
      for (var i = 1; i < tops.length; i++) {
        path.lineTo(tops[i].dx, tops[i].dy);
      }
      for (var i = n - 1; i >= 0; i--) {
        path.lineTo(pt(i, bases[i]).dx, pt(i, bases[i]).dy);
      }
      path.close();
      canvas.drawPath(
        path,
        Paint()
          ..color = s.color.withValues(alpha: 0.5)
          ..style = PaintingStyle.fill,
      );
      final stroke = Paint()
        ..color = s.color
        ..strokeWidth = 1.25
        ..style = PaintingStyle.stroke;
      final line = Path()..moveTo(tops.first.dx, tops.first.dy);
      for (var i = 1; i < tops.length; i++) {
        line.lineTo(tops[i].dx, tops[i].dy);
      }
      canvas.drawPath(line, stroke);
      for (var i = 0; i < n; i++) {
        bases[i] += rows[i].values[s.id] ?? 0;
      }
    }

    if (todayDay.isNotEmpty && todayLabel.isNotEmpty) {
      final idx = rows.indexWhere((r) => r.day == todayDay);
      if (idx >= 0) {
        final x = pt(idx, 0).dx;
        final dash = Paint()
          ..color = mutedColor
          ..strokeWidth = 1
          ..style = PaintingStyle.stroke;
        const dashLen = 4.0;
        var y = top;
        while (y < top + chartH) {
          canvas.drawLine(Offset(x, y),
              Offset(x, math.min(y + dashLen, top + chartH)), dash);
          y += dashLen * 2;
        }
        final tp = TextPainter(
          text: TextSpan(
            text: todayLabel,
            style: TextStyle(color: mutedColor, fontSize: 10),
          ),
          textDirection: ui.TextDirection.ltr,
        )..layout();
        tp.paint(canvas, Offset(x - tp.width - 4, top + 2));
      }
    }

    final labelStyle = TextStyle(color: axisColor, fontSize: 10);
    void drawLabel(String text, Offset anchor, {bool right = false}) {
      final tp = TextPainter(
        text: TextSpan(text: text, style: labelStyle),
        textDirection: ui.TextDirection.ltr,
      )..layout(maxWidth: left - 4);
      final dx = right ? anchor.dx - tp.width : anchor.dx - tp.width / 2;
      tp.paint(canvas, Offset(dx.clamp(0, size.width - tp.width), anchor.dy));
    }

    drawLabel(formatCompactNumber(maxY), Offset(left - 4, top - 2),
        right: true);
    drawLabel('0', Offset(left - 4, top + chartH - 4), right: true);

    if (n == 1) {
      drawLabel(
          rows.first.dayLabel, Offset(left + chartW / 2, top + chartH + 6));
    } else {
      drawLabel(rows.first.dayLabel, Offset(left, top + chartH + 6));
      drawLabel(rows.last.dayLabel, Offset(left + chartW, top + chartH + 6));
      if (n > 2) {
        final mid = n ~/ 2;
        drawLabel(
            rows[mid].dayLabel, Offset(left + mid * dx, top + chartH + 6));
      }
    }

    final ai = activeIndex;
    if (ai != null && ai >= 0 && ai < n) {
      final x = pt(ai, 0).dx;
      final guide = Paint()
        ..color = mutedColor
        ..strokeWidth = 1
        ..style = PaintingStyle.stroke;
      canvas.drawLine(Offset(x, top), Offset(x, top + chartH), guide);
    }
  }

  @override
  bool shouldRepaint(covariant _StackedAreaPainter oldDelegate) =>
      oldDelegate.rows != rows ||
      oldDelegate.meta != meta ||
      oldDelegate.todayDay != todayDay ||
      oldDelegate.todayLabel != todayLabel ||
      oldDelegate.activeIndex != activeIndex;
}
