/// DB-backed public platform stats chrome from GET /public/platform-stats-chrome.
class PlatformStatsChrome {
  const PlatformStatsChrome({
    required this.source,
    required this.unavailable,
    required this.sectionTitle,
    required this.sectionBlurb,
    required this.periodLabel,
    required this.periodDayLabel,
    required this.periodWeekLabel,
    required this.periodMonthLabel,
    required this.periodYearLabel,
    required this.kpiOnlineNow,
    required this.kpiPlayingNow,
    required this.kpiUsersTotal,
    required this.kpiVisited,
    required this.kpiPlayed,
    required this.kpiGamesFinished,
    required this.kpiDau,
    required this.kpiWau,
    required this.kpiMau,
  });

  final String source;
  final String unavailable;
  final String sectionTitle;
  final String sectionBlurb;
  final String periodLabel;
  final String periodDayLabel;
  final String periodWeekLabel;
  final String periodMonthLabel;
  final String periodYearLabel;
  final String kpiOnlineNow;
  final String kpiPlayingNow;
  final String kpiUsersTotal;
  final String kpiVisited;
  final String kpiPlayed;
  final String kpiGamesFinished;
  final String kpiDau;
  final String kpiWau;
  final String kpiMau;

  bool get isReady =>
      source.isNotEmpty &&
      unavailable.isNotEmpty &&
      sectionTitle.isNotEmpty &&
      sectionBlurb.isNotEmpty &&
      periodLabel.isNotEmpty &&
      periodDayLabel.isNotEmpty &&
      periodWeekLabel.isNotEmpty &&
      periodMonthLabel.isNotEmpty &&
      periodYearLabel.isNotEmpty &&
      kpiOnlineNow.isNotEmpty &&
      kpiPlayingNow.isNotEmpty &&
      kpiUsersTotal.isNotEmpty &&
      kpiVisited.isNotEmpty &&
      kpiPlayed.isNotEmpty &&
      kpiGamesFinished.isNotEmpty &&
      kpiDau.isNotEmpty &&
      kpiWau.isNotEmpty &&
      kpiMau.isNotEmpty;

  static PlatformStatsChrome? fromJson(Map<String, dynamic>? map) {
    if (map == null) return null;
    String s(String k) => (map[k] as String?)?.trim() ?? '';
    final chrome = PlatformStatsChrome(
      source: s('source'),
      unavailable: s('platform_stats_unavailable'),
      sectionTitle: s('section_title'),
      sectionBlurb: s('section_blurb'),
      periodLabel: s('period_label'),
      periodDayLabel: s('period_day_label'),
      periodWeekLabel: s('period_week_label'),
      periodMonthLabel: s('period_month_label'),
      periodYearLabel: s('period_year_label'),
      kpiOnlineNow: s('kpi_online_now'),
      kpiPlayingNow: s('kpi_playing_now'),
      kpiUsersTotal: s('kpi_users_total'),
      kpiVisited: s('kpi_visited'),
      kpiPlayed: s('kpi_played'),
      kpiGamesFinished: s('kpi_games_finished'),
      kpiDau: s('kpi_dau'),
      kpiWau: s('kpi_wau'),
      kpiMau: s('kpi_mau'),
    );
    return chrome.isReady ? chrome : null;
  }
}

class PlatformPeriodOption {
  const PlatformPeriodOption({required this.id, required this.label});
  final String id;
  final String label;
}

class PlatformKpiItem {
  const PlatformKpiItem({
    required this.id,
    required this.label,
    required this.value,
  });
  final String id;
  final String label;
  final int value;
}

class PlatformKpiSection {
  const PlatformKpiSection({
    required this.id,
    required this.title,
    required this.items,
  });
  final String id;
  final String title;
  final List<PlatformKpiItem> items;
}

class PlatformSeriesMeta {
  const PlatformSeriesMeta({
    required this.key,
    required this.label,
    required this.colorClass,
  });
  final String key;
  final String label;
  final String colorClass;
}

class PlatformSeriesPoint {
  const PlatformSeriesPoint({
    required this.bucket,
    required this.values,
  });
  final String bucket;
  final Map<String, int> values;
}

class PlatformHeatmapStat {
  const PlatformHeatmapStat({
    required this.id,
    required this.label,
    required this.value,
  });
  final String id;
  final String label;
  final String value;
}

class PlatformBreakdownRow {
  const PlatformBreakdownRow({
    required this.id,
    required this.label,
    required this.count,
  });
  final String id;
  final String label;
  final int count;
}

class PlatformStatsSnapshot {
  const PlatformStatsSnapshot({
    required this.period,
    required this.defaultPeriod,
    required this.periodOptions,
    required this.kpiSections,
    required this.series,
    required this.seriesMeta,
    required this.seriesTitle,
    required this.seriesSubtitle,
    required this.seriesYAxis,
    required this.seriesEmpty,
    required this.seriesLegendAria,
    required this.seriesTodayLabel,
    required this.todayDay,
    required this.heatmapTitle,
    required this.heatmapEmpty,
    required this.heatmapTotalLabel,
    required this.heatmapStats,
    required this.cumulativeTitle,
    required this.cumulativeEmpty,
    required this.cumulativeSeriesLabel,
    required this.breakdownModesTitle,
    required this.breakdownModesEmpty,
    required this.breakdownModes,
    required this.breakdownOutcomesTitle,
    required this.breakdownOutcomesEmpty,
    required this.breakdownOutcomesMeta,
    required this.breakdownOutcomes,
    required this.breakdownEntryTitle,
    required this.breakdownEntryEmpty,
    required this.breakdownEntry,
  });

  final String period;
  final String defaultPeriod;
  final List<PlatformPeriodOption> periodOptions;
  final List<PlatformKpiSection> kpiSections;
  final List<PlatformSeriesPoint> series;
  final List<PlatformSeriesMeta> seriesMeta;
  final String seriesTitle;
  final String seriesSubtitle;
  final String seriesYAxis;
  final String seriesEmpty;
  final String seriesLegendAria;
  final String seriesTodayLabel;
  final String todayDay;
  final String heatmapTitle;
  final String heatmapEmpty;
  final String heatmapTotalLabel;
  final List<PlatformHeatmapStat> heatmapStats;
  final String cumulativeTitle;
  final String cumulativeEmpty;
  final String cumulativeSeriesLabel;
  final String breakdownModesTitle;
  final String breakdownModesEmpty;
  final List<PlatformBreakdownRow> breakdownModes;
  final String breakdownOutcomesTitle;
  final String breakdownOutcomesEmpty;
  final String breakdownOutcomesMeta;
  final List<PlatformBreakdownRow> breakdownOutcomes;
  final String breakdownEntryTitle;
  final String breakdownEntryEmpty;
  final List<PlatformBreakdownRow> breakdownEntry;

  /// Match web/admin: chrome + meta enough to mount chart (empty axis → in-chart empty).
  bool get hasChart =>
      seriesTitle.isNotEmpty &&
      seriesEmpty.isNotEmpty &&
      seriesLegendAria.isNotEmpty &&
      seriesMeta.isNotEmpty;

  bool get hasHeatmap =>
      heatmapTitle.isNotEmpty &&
      heatmapEmpty.isNotEmpty &&
      heatmapTotalLabel.isNotEmpty &&
      heatmapStats.isNotEmpty &&
      series.isNotEmpty;

  bool get hasCumulative =>
      cumulativeTitle.isNotEmpty &&
      cumulativeEmpty.isNotEmpty &&
      cumulativeSeriesLabel.isNotEmpty;

  bool get hasBreakdownModes =>
      breakdownModesTitle.isNotEmpty && breakdownModesEmpty.isNotEmpty;

  bool get hasBreakdownOutcomes =>
      breakdownOutcomesTitle.isNotEmpty && breakdownOutcomesEmpty.isNotEmpty;

  bool get hasBreakdownEntry =>
      breakdownEntryTitle.isNotEmpty && breakdownEntryEmpty.isNotEmpty;

  static List<PlatformHeatmapStat> _parseHeatmapStats(dynamic raw) {
    final out = <PlatformHeatmapStat>[];
    if (raw is! List) return out;
    for (final row in raw) {
      if (row is! Map) continue;
      final id = '${row['id'] ?? ''}'.trim();
      final label = '${row['label'] ?? ''}'.trim();
      final value = '${row['value'] ?? ''}'.trim();
      if (id.isEmpty || label.isEmpty || value.isEmpty) continue;
      out.add(PlatformHeatmapStat(id: id, label: label, value: value));
    }
    return out;
  }

  static List<PlatformBreakdownRow> _parseBreakdownRows(dynamic raw) {
    final out = <PlatformBreakdownRow>[];
    if (raw is! List) return out;
    for (final row in raw) {
      if (row is! Map) continue;
      final id = '${row['id'] ?? ''}'.trim();
      final label = '${row['label'] ?? ''}'.trim();
      final c = row['count'];
      int? count;
      if (c is int) {
        count = c;
      } else if (c is num) {
        count = c.toInt();
      }
      if (id.isEmpty || label.isEmpty || count == null) continue;
      out.add(PlatformBreakdownRow(id: id, label: label, count: count));
    }
    return out;
  }

  static PlatformStatsSnapshot? fromJson(Map<String, dynamic>? map) {
    if (map == null) return null;
    final period = (map['period'] as String?)?.trim() ?? '';
    final defaultPeriod = (map['default_period'] as String?)?.trim() ?? '';
    if (period.isEmpty || defaultPeriod.isEmpty) return null;

    final options = <PlatformPeriodOption>[];
    final rawOpts = map['period_options'];
    if (rawOpts is List) {
      for (final row in rawOpts) {
        if (row is! Map) continue;
        final id = '${row['id'] ?? ''}'.trim();
        final label = '${row['label'] ?? ''}'.trim();
        if (id.isEmpty || label.isEmpty) continue;
        options.add(PlatformPeriodOption(id: id, label: label));
      }
    }
    if (options.isEmpty) return null;

    final sections = <PlatformKpiSection>[];
    final rawSecs = map['kpi_sections'];
    if (rawSecs is List) {
      for (final sec in rawSecs) {
        if (sec is! Map) continue;
        final id = '${sec['id'] ?? ''}'.trim();
        final title = '${sec['title'] ?? ''}'.trim();
        if (id.isEmpty || title.isEmpty) continue;
        final items = <PlatformKpiItem>[];
        final rawItems = sec['items'];
        if (rawItems is List) {
          for (final it in rawItems) {
            if (it is! Map) continue;
            final iid = '${it['id'] ?? ''}'.trim();
            final label = '${it['label'] ?? ''}'.trim();
            final v = it['value'];
            int? value;
            if (v is int) {
              value = v;
            } else if (v is num) {
              value = v.toInt();
            }
            if (iid.isEmpty || label.isEmpty || value == null) continue;
            items.add(PlatformKpiItem(id: iid, label: label, value: value));
          }
        }
        if (items.isEmpty) continue;
        sections.add(PlatformKpiSection(id: id, title: title, items: items));
      }
    }
    if (sections.isEmpty) return null;

    final seriesMeta = <PlatformSeriesMeta>[];
    final rawMeta = map['series_meta'];
    if (rawMeta is List) {
      for (final row in rawMeta) {
        if (row is! Map) continue;
        final key = '${row['key'] ?? ''}'.trim();
        final label = '${row['label'] ?? ''}'.trim();
        final color = '${row['color_class'] ?? ''}'.trim();
        if (key.isEmpty || label.isEmpty || color.isEmpty) continue;
        seriesMeta
            .add(PlatformSeriesMeta(key: key, label: label, colorClass: color));
      }
    }

    final series = <PlatformSeriesPoint>[];
    final rawSeries = map['series'];
    if (rawSeries is List) {
      for (final row in rawSeries) {
        if (row is! Map) continue;
        final bucket = '${row['bucket'] ?? ''}'.trim();
        if (bucket.isEmpty) continue;
        final values = <String, int>{};
        final rawVals = row['values'];
        if (rawVals is Map) {
          rawVals.forEach((k, v) {
            final id = '$k'.trim();
            if (id.isEmpty) return;
            if (v is int) {
              values[id] = v;
            } else if (v is num) {
              values[id] = v.toInt();
            }
          });
        }
        series.add(PlatformSeriesPoint(bucket: bucket, values: values));
      }
    }

    String s(String k) => (map[k] as String?)?.trim() ?? '';
    // Chart chrome fail-closed in UI via hasChart; KPIs still render without inventing chart copy.
    return PlatformStatsSnapshot(
      period: period,
      defaultPeriod: defaultPeriod,
      periodOptions: options,
      kpiSections: sections,
      series: series,
      seriesMeta: seriesMeta,
      seriesTitle: s('series_title'),
      seriesSubtitle: s('series_subtitle'),
      seriesYAxis: s('series_y_axis'),
      seriesEmpty: s('series_empty'),
      seriesLegendAria: s('series_legend_aria'),
      seriesTodayLabel: s('series_today_label'),
      todayDay: s('today_day'),
      heatmapTitle: s('heatmap_title'),
      heatmapEmpty: s('heatmap_empty'),
      heatmapTotalLabel: s('heatmap_total_label'),
      heatmapStats: _parseHeatmapStats(map['heatmap_stats']),
      cumulativeTitle: s('cumulative_title'),
      cumulativeEmpty: s('cumulative_empty'),
      cumulativeSeriesLabel: s('cumulative_series_label'),
      breakdownModesTitle: s('breakdown_modes_title'),
      breakdownModesEmpty: s('breakdown_modes_empty'),
      breakdownModes: _parseBreakdownRows(map['breakdown_modes']),
      breakdownOutcomesTitle: s('breakdown_outcomes_title'),
      breakdownOutcomesEmpty: s('breakdown_outcomes_empty'),
      breakdownOutcomesMeta: s('breakdown_outcomes_meta'),
      breakdownOutcomes: _parseBreakdownRows(map['breakdown_outcomes']),
      breakdownEntryTitle: s('breakdown_entry_title'),
      breakdownEntryEmpty: s('breakdown_entry_empty'),
      breakdownEntry: _parseBreakdownRows(map['breakdown_entry']),
    );
  }
}
