import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/platform_stats_chrome.dart';
import 'package:dama_mobile/features/home/activity_breakdown_panel.dart';
import 'package:dama_mobile/features/home/activity_cumulative_chart.dart';
import 'package:dama_mobile/features/home/activity_heatmap.dart';
import 'package:flutter/material.dart';

class ActivityDashboardSections extends StatelessWidget {
  const ActivityDashboardSections({super.key, required this.snapshot});

  final PlatformStatsSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final cards = <Widget>[];

    if (snapshot.hasHeatmap) {
      cards.add(
        _card(
          tokens,
          ActivityHeatmap(
            title: snapshot.heatmapTitle,
            totalLabel: snapshot.heatmapTotalLabel,
            series: snapshot.series,
            stats: snapshot.heatmapStats,
          ),
        ),
      );
    }
    if (snapshot.hasCumulative) {
      cards.add(
        _card(
          tokens,
          ActivityCumulativeChart(
            title: snapshot.cumulativeTitle,
            emptyLabel: snapshot.cumulativeEmpty,
            seriesLabel: snapshot.cumulativeSeriesLabel,
            series: snapshot.series,
          ),
        ),
      );
    }

    final breakdowns = <Widget>[];
    if (snapshot.hasBreakdownModes) {
      breakdowns.add(
        _card(
          tokens,
          ActivityBreakdownPanel(
            title: snapshot.breakdownModesTitle,
            emptyLabel: snapshot.breakdownModesEmpty,
            rows: snapshot.breakdownModes,
          ),
        ),
      );
    }
    if (snapshot.hasBreakdownOutcomes) {
      breakdowns.add(
        _card(
          tokens,
          ActivityBreakdownPanel(
            title: snapshot.breakdownOutcomesTitle,
            emptyLabel: snapshot.breakdownOutcomesEmpty,
            metaLine: snapshot.breakdownOutcomesMeta,
            rows: snapshot.breakdownOutcomes,
            variant: BreakdownVariant.bar,
          ),
        ),
      );
    }
    if (snapshot.hasBreakdownEntry) {
      breakdowns.add(
        _card(
          tokens,
          ActivityBreakdownPanel(
            title: snapshot.breakdownEntryTitle,
            emptyLabel: snapshot.breakdownEntryEmpty,
            rows: snapshot.breakdownEntry,
          ),
        ),
      );
    }

    if (cards.isEmpty && breakdowns.isEmpty) return const SizedBox.shrink();

    // Trim dashboard: space-y-8 between major cards; breakdown grid
    // grid-cols-1 → md:2 → xl:3 (768 / 1280).
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final c in cards) ...[const SizedBox(height: 24), c],
        if (breakdowns.isNotEmpty) ...[
          const SizedBox(height: 24),
          LayoutBuilder(
            builder: (context, c) {
              final w = c.maxWidth;
              if (w >= 1280 && breakdowns.length >= 3) {
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (var i = 0; i < breakdowns.length; i++) ...[
                      if (i > 0) const SizedBox(width: 16),
                      Expanded(child: breakdowns[i]),
                    ],
                  ],
                );
              }
              if (w >= 768 && breakdowns.length >= 2) {
                return Wrap(
                  spacing: 16,
                  runSpacing: 16,
                  children: [
                    for (final b in breakdowns)
                      SizedBox(
                        width: (w - 16) / 2,
                        child: b,
                      ),
                  ],
                );
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < breakdowns.length; i++) ...[
                    if (i > 0) const SizedBox(height: 16),
                    breakdowns[i],
                  ],
                ],
              );
            },
          ),
        ],
      ],
    );
  }

  Widget _card(DamaColors tokens, Widget child) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: tokens.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: child,
      ),
    );
  }
}
