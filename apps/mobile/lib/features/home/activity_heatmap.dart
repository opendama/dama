import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/platform_stats_chrome.dart';
import 'package:dama_mobile/features/home/activity_stacked_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

int _dayIntensity(Map<String, int> values) {
  return [
    values['visited'] ?? 0,
    values['played'] ?? 0,
    values['games'] ?? 0,
  ].reduce((a, b) => a > b ? a : b);
}

int _intensityLevel(int value, int max) {
  if (value <= 0) return 0;
  if (max <= 0) return 1;
  final ratio = value / max;
  if (ratio >= 0.85) return 4;
  if (ratio >= 0.6) return 3;
  if (ratio >= 0.35) return 2;
  return 1;
}

Color _cellColor(DamaColors tokens, int level) {
  final base = tokens.bone;
  switch (level) {
    case 0:
      return base;
    case 1:
      return Color.alphaBlend(tokens.gold.withValues(alpha: 0.22), base);
    case 2:
      return Color.alphaBlend(tokens.gold.withValues(alpha: 0.4), base);
    case 3:
      return Color.alphaBlend(tokens.gold.withValues(alpha: 0.62), base);
    default:
      return Color.alphaBlend(tokens.gold.withValues(alpha: 0.82), base);
  }
}

String _formatStatValue(PlatformHeatmapStat stat, int activeDays) {
  final fallback = stat.value.trim();
  if (stat.id == 'peak_day') {
    return formatBucketDayLabel(fallback).isNotEmpty
        ? formatBucketDayLabel(fallback)
        : fallback;
  }
  if (stat.id == 'peak_month' && fallback.length >= 7) {
    final label = formatBucketMonthLabel(fallback.substring(0, 7));
    return label.isNotEmpty ? label : fallback;
  }
  if (stat.id == 'active_days') {
    return '$activeDays';
  }
  return fallback;
}

/// Trim loc-heatmap parity: tap cell shows tip; tap elsewhere dismisses.
class ActivityHeatmap extends StatelessWidget {
  const ActivityHeatmap({
    super.key,
    required this.title,
    required this.totalLabel,
    required this.series,
    required this.stats,
  });

  final String title;
  final String totalLabel;
  final List<PlatformSeriesPoint> series;
  final List<PlatformHeatmapStat> stats;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final titleTrim = title.trim();
    final totalLbl = totalLabel.trim();
    if (titleTrim.isEmpty ||
        totalLbl.isEmpty ||
        stats.isEmpty ||
        series.isEmpty) {
      return const SizedBox.shrink();
    }

    final cells = <({String day, int value, int level})>[];
    var max = 0;
    for (final row in series) {
      final day = row.bucket.trim();
      if (day.isEmpty) continue;
      final value = _dayIntensity(row.values);
      if (value > max) max = value;
      cells.add((day: day, value: value, level: 0));
    }
    for (var i = 0; i < cells.length; i++) {
      final c = cells[i];
      cells[i] =
          (day: c.day, value: c.value, level: _intensityLevel(c.value, max));
    }
    if (cells.isEmpty) return const SizedBox.shrink();

    final activeDays = cells.where((c) => c.value > 0).length;
    final fmt = NumberFormat.decimalPattern();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          titleTrim,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 4),
        Text(
          totalLbl,
          style: TextStyle(
            color: tokens.onSurfaceMuted,
            fontSize: 11,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.4,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          fmt.format(activeDays),
          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 3,
          runSpacing: 3,
          children: [
            for (final c in cells)
              Builder(
                builder: (context) {
                  final dateLabel = formatBucketDayLabel(c.day).isNotEmpty
                      ? formatBucketDayLabel(c.day)
                      : c.day;
                  final tip = c.value > 0
                      ? '$dateLabel\n${fmt.format(c.value)}'
                      : dateLabel;
                  return Tooltip(
                    message: tip,
                    triggerMode: TooltipTriggerMode.tap,
                    preferBelow: false,
                    waitDuration: Duration.zero,
                    showDuration: const Duration(seconds: 5),
                    child: Container(
                      width: 11,
                      height: 11,
                      decoration: BoxDecoration(
                        color: _cellColor(tokens, c.level),
                        borderRadius: BorderRadius.circular(2),
                        border: Border.all(
                          color:
                              c.level >= 4 ? tokens.gold : tokens.borderSubtle,
                        ),
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
        const SizedBox(height: 16),
        Divider(color: tokens.borderSubtle),
        const SizedBox(height: 12),
        LayoutBuilder(
          builder: (context, constraints) {
            final cols = constraints.maxWidth >= 360 ? 4 : 2;
            return GridView.count(
              crossAxisCount: cols,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 2.2,
              children: [
                for (final s in stats)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        s.label,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: tokens.onSurfaceMuted,
                          fontSize: 11,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _formatStatValue(s, activeDays),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}
