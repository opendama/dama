import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/platform_stats_chrome.dart';
import 'package:dama_mobile/features/home/activity_stacked_chart.dart';
import 'package:dama_mobile/features/home/chart_sticky_tip.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

double? _sharePct(int part, int total) {
  if (total <= 0) return null;
  return (part / total * 1000).roundToDouble() / 10;
}

class ActivityBreakdownPanel extends StatefulWidget {
  const ActivityBreakdownPanel({
    super.key,
    required this.title,
    required this.emptyLabel,
    required this.rows,
    this.metaLine,
    this.variant = BreakdownVariant.pie,
  });

  final String title;
  final String emptyLabel;
  final String? metaLine;
  final List<PlatformBreakdownRow> rows;
  final BreakdownVariant variant;

  @override
  State<ActivityBreakdownPanel> createState() => _ActivityBreakdownPanelState();
}

class _ActivityBreakdownPanelState extends State<ActivityBreakdownPanel>
    with ChartTipHost {
  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final titleTrim = widget.title.trim();
    final empty = widget.emptyLabel.trim();
    if (titleTrim.isEmpty || empty.isEmpty) return const SizedBox.shrink();

    final items = widget.rows
        .where((r) => r.label.trim().isNotEmpty && r.count > 0)
        .toList()
      ..sort((a, b) => b.count.compareTo(a.count));
    final total = items.fold<int>(0, (s, r) => s + r.count);
    final fmt = NumberFormat.decimalPattern();
    final meta = (widget.metaLine ?? '').trim();
    final onSurface = Theme.of(context).colorScheme.onSurface;
    final palette = [
      tokens.gold,
      onSurface,
      tokens.onSurfaceMuted,
      tokens.brand
    ];
    final colors = [
      for (var i = 0; i < items.length; i++) palette[i % palette.length],
    ];

    final activeIdx =
        tipKey == null ? -1 : items.indexWhere((e) => e.id == tipKey);
    final active = activeIdx >= 0 ? items[activeIdx] : null;
    final activeColor = activeIdx >= 0 ? colors[activeIdx] : null;

    Widget tipOverlay() {
      if (active == null || tipAnchor == null || activeColor == null) {
        return const SizedBox.shrink();
      }
      return ChartStickyTipOverlay(
        anchor: tipAnchor!,
        child: ChartStickyTipBubble(
          title: widget.variant == BreakdownVariant.bar ? active.label : null,
          lines: [
            ChartStickyTipLine(
              label: widget.variant == BreakdownVariant.pie ? active.label : '',
              value: fmt.format(active.count),
              color: activeColor,
            ),
          ],
        ),
      );
    }

    return TapRegion(
      onTapOutside: (_) => onTipOutside(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            titleTrim,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
          if (meta.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(meta,
                style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 13)),
          ],
          const SizedBox(height: 12),
          if (total <= 0)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(
                  empty,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: tokens.onSurfaceMuted),
                ),
              ),
            )
          else if (widget.variant == BreakdownVariant.bar) ...[
            LayoutBuilder(
              builder: (context, c) {
                if (c.maxWidth >= 640) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (var i = 0; i < items.length; i++)
                        InkWell(
                          borderRadius: BorderRadius.circular(999),
                          onTap: () {
                            openOrToggleTip(
                              items[i].id,
                              Offset(c.maxWidth / 2, 24),
                            );
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: tokens.bone,
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: tipKey == items[i].id
                                    ? onSurface
                                    : tokens.borderSubtle,
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 8,
                                  height: 8,
                                  decoration: BoxDecoration(
                                    color: colors[i],
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  items[i].label,
                                  style: TextStyle(
                                      color: tokens.onSurfaceMuted,
                                      fontSize: 12),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  fmt.format(items[i].count),
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
            LayoutBuilder(
              builder: (context, c) {
                final h = c.maxWidth >= 768
                    ? 256.0
                    : c.maxWidth >= 640
                        ? 224.0
                        : 192.0;
                return SizedBox(
                  height: h,
                  width: double.infinity,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTapUp: (details) {
                      final idx = _hitBar(
                        details.localPosition,
                        Size(c.maxWidth, h),
                        items.length,
                      );
                      if (idx == null) {
                        clearTip();
                        return;
                      }
                      openOrToggleTip(items[idx].id, details.localPosition);
                    },
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        CustomPaint(
                          size: Size(c.maxWidth, h),
                          painter: _BarBreakdownPainter(
                            items: items,
                            colors: colors,
                            grid: tokens.borderSubtle,
                            axis: tokens.onSurfaceMuted,
                          ),
                        ),
                        tipOverlay(),
                      ],
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 12),
            _LegendList(
              items: items,
              total: total,
              colors: colors,
              selectedId: tipKey,
              onSelect: (id, anchor) => openOrToggleTip(id, anchor),
            ),
          ] else ...[
            Center(
              child: SizedBox(
                height: 176,
                width: 256,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTapUp: (details) {
                    final idx = _hitDonut(
                      details.localPosition,
                      const Size(256, 176),
                      items.map((e) => e.count.toDouble()).toList(),
                    );
                    if (idx == null) {
                      // Single-slice pies: any tap on the chart area selects it.
                      if (items.length == 1) {
                        openOrToggleTip(items.first.id, details.localPosition);
                        return;
                      }
                      clearTip();
                      return;
                    }
                    openOrToggleTip(items[idx].id, details.localPosition);
                  },
                  child: Stack(
                    alignment: Alignment.center,
                    clipBehavior: Clip.none,
                    children: [
                      CustomPaint(
                        size: const Size(256, 176),
                        painter: _DonutPainter(
                          values: items.map((e) => e.count.toDouble()).toList(),
                          colors: colors,
                          stroke: tokens.card,
                        ),
                      ),
                      Text(
                        formatCompactNumber(total),
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                      tipOverlay(),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            _LegendList(
              items: items,
              total: total,
              colors: colors,
              selectedId: tipKey,
              onSelect: (id, anchor) => openOrToggleTip(id, anchor),
            ),
          ],
        ],
      ),
    );
  }

  int? _hitBar(Offset local, Size size, int n) {
    if (n <= 0) return null;
    const left = 36.0;
    const right = 8.0;
    final chartW = size.width - left - right;
    if (chartW <= 0) return null;
    if (local.dx < left || local.dx > left + chartW) return null;
    final slot = chartW / n;
    return ((local.dx - left) / slot).floor().clamp(0, n - 1);
  }

  int? _hitDonut(Offset local, Size size, List<double> values) {
    final total = values.fold<double>(0, (a, b) => a + b);
    if (total <= 0) return null;
    final cx = size.width / 2;
    final cy = size.height / 2;
    final dx = local.dx - cx;
    final dy = local.dy - cy;
    final dist = math.sqrt(dx * dx + dy * dy);
    final r = math.min(size.width, size.height) * 0.41;
    final inner = r * 0.40;
    final outer = r + r * 0.25;
    if (dist < inner || dist > outer) return null;
    var angle = math.atan2(dy, dx);
    angle = (angle + math.pi / 2 + math.pi * 2) % (math.pi * 2);
    final gap = values.length > 1 ? 0.04 : 0.0;
    var start = 0.0;
    for (var i = 0; i < values.length; i++) {
      final sweep = (values[i] / total) * math.pi * 2 - gap;
      if (sweep <= 0) continue;
      if (angle >= start && angle < start + sweep) return i;
      start += sweep + gap;
    }
    return values.isEmpty ? null : values.length - 1;
  }
}

enum BreakdownVariant { pie, bar }

class _LegendList extends StatelessWidget {
  const _LegendList({
    required this.items,
    required this.total,
    required this.colors,
    this.selectedId,
    this.onSelect,
  });
  final List<PlatformBreakdownRow> items;
  final int total;
  final List<Color> colors;
  final String? selectedId;
  final void Function(String id, Offset anchor)? onSelect;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final fmt = NumberFormat.decimalPattern();
    return Column(
      children: [
        for (var i = 0; i < items.length; i++)
          InkWell(
            onTap: onSelect == null
                ? null
                : () {
                    final box = context.findRenderObject() as RenderBox?;
                    final anchor = box == null
                        ? const Offset(120, 40)
                        : box.size.center(Offset.zero);
                    onSelect!(items[i].id, anchor);
                  },
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: colors[i % colors.length],
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: selectedId == items[i].id
                            ? Theme.of(context).colorScheme.onSurface
                            : tokens.borderSubtle,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      items[i].label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style:
                          TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
                    ),
                  ),
                  Text(fmt.format(items[i].count),
                      style: const TextStyle(fontSize: 12)),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 44,
                    child: Text(
                      () {
                        final pct = _sharePct(items[i].count, total);
                        return pct == null ? '' : '${pct.toStringAsFixed(1)}%';
                      }(),
                      textAlign: TextAlign.right,
                      style:
                          TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({
    required this.values,
    required this.colors,
    required this.stroke,
  });

  final List<double> values;
  final List<Color> colors;
  final Color stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final total = values.fold<double>(0, (a, b) => a + b);
    if (total <= 0) return;
    final cx = size.width / 2;
    final cy = size.height / 2;
    final r = math.min(size.width, size.height) * 0.41;
    final rect = Rect.fromCircle(center: Offset(cx, cy), radius: r);
    var start = -math.pi / 2;
    final gap = values.length > 1 ? 0.04 : 0.0;
    for (var i = 0; i < values.length; i++) {
      final sweep = (values[i] / total) * math.pi * 2 - gap;
      if (sweep <= 0) continue;
      final paint = Paint()
        ..color = colors[i % colors.length]
        ..style = PaintingStyle.stroke
        ..strokeWidth = r * 0.34
        ..strokeCap = StrokeCap.butt;
      canvas.drawArc(rect, start, sweep, false, paint);
      start += sweep + gap;
    }
    canvas.drawCircle(
      Offset(cx, cy),
      r * 0.54,
      Paint()..color = stroke,
    );
  }

  @override
  bool shouldRepaint(covariant _DonutPainter oldDelegate) =>
      oldDelegate.values != values || oldDelegate.colors != colors;
}

class _BarBreakdownPainter extends CustomPainter {
  _BarBreakdownPainter({
    required this.items,
    required this.colors,
    required this.grid,
    required this.axis,
  });

  final List<PlatformBreakdownRow> items;
  final List<Color> colors;
  final Color grid;
  final Color axis;

  @override
  void paint(Canvas canvas, Size size) {
    if (items.isEmpty) return;
    const left = 36.0;
    const right = 8.0;
    const top = 8.0;
    const bottom = 28.0;
    final chartW = size.width - left - right;
    final chartH = size.height - top - bottom;
    if (chartW <= 0 || chartH <= 0) return;

    final maxY = items
        .map((e) => e.count)
        .reduce(math.max)
        .toDouble()
        .clamp(1, double.infinity);
    final gridPaint = Paint()
      ..color = grid
      ..strokeWidth = 1;
    for (var i = 0; i <= 4; i++) {
      final y = top + chartH * (i / 4);
      canvas.drawLine(Offset(left, y), Offset(left + chartW, y), gridPaint);
    }

    final n = items.length;
    final slot = chartW / n;
    final barW = math.min(72.0, slot * 0.55);
    for (var i = 0; i < n; i++) {
      final v = items[i].count.toDouble();
      final h = chartH * (v / maxY);
      final x = left + slot * i + (slot - barW) / 2;
      final y = top + chartH - h;
      final r = RRect.fromRectAndRadius(
        Rect.fromLTWH(x, y, barW, h),
        const Radius.circular(6),
      );
      canvas.drawRRect(r, Paint()..color = colors[i % colors.length]);

      final label = TextPainter(
        text: TextSpan(
          text: items[i].label,
          style: TextStyle(color: axis, fontSize: 11),
        ),
        textDirection: ui.TextDirection.ltr,
        maxLines: 1,
        ellipsis: '…',
      )..layout(maxWidth: slot);
      label.paint(
        canvas,
        Offset(left + slot * i + (slot - label.width) / 2, top + chartH + 6),
      );
    }

    final maxLabel = TextPainter(
      text: TextSpan(
        text: formatCompactNumber(maxY),
        style: TextStyle(color: axis, fontSize: 10),
      ),
      textDirection: ui.TextDirection.ltr,
    )..layout();
    maxLabel.paint(canvas, Offset(left - maxLabel.width - 4, top - 2));
  }

  @override
  bool shouldRepaint(covariant _BarBreakdownPainter oldDelegate) =>
      oldDelegate.items != items || oldDelegate.colors != colors;
}
