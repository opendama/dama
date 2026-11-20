import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/platform_stats_chrome.dart';
import 'package:dama_mobile/core/ui/chrome_select_sheet.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/features/home/activity_dashboard_sections.dart';
import 'package:dama_mobile/features/home/activity_stacked_chart.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _visitorKeyPref = 'dama_platform_visitor_key';

/// Dedicated platform stats page (nav `status`) - Trim Usage-parity charts + KPIs.
class PlatformStatsPage extends StatefulWidget {
  /// Not const: [ApiConfig.defaults] resolves from --dart-define at runtime.
  PlatformStatsPage({super.key, ApiConfig? config})
      : config = config ?? ApiConfig.defaults;

  final ApiConfig config;

  @override
  State<PlatformStatsPage> createState() => _PlatformStatsPageState();
}

class _PlatformStatsPageState extends State<PlatformStatsPage> {
  PlatformStatsChrome? _chrome;
  PlatformStatsSnapshot? _stats;
  String _period = '';
  String _unavailable = '';
  bool _loading = true;
  bool _refreshing = false;
  Timer? _poll;
  int _loadGen = 0;

  /// Period → snapshot cache (web keepPreviousData + staleTime parity).
  final Map<String, PlatformStatsSnapshot> _byPeriod = {};

  static String _cacheKey(String period) {
    final p = period.trim();
    return p.isEmpty ? 'default' : p;
  }

  @override
  void initState() {
    super.initState();
    unawaited(_bootstrap());
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    await _postVisit();
    await _loadChromeAndStats();
    _poll?.cancel();
    _poll = Timer.periodic(const Duration(seconds: 30), (_) {
      // Background refresh of the active period only - never clear paint.
      unawaited(_loadStats(period: _period, background: true));
    });
  }

  Future<void> _postVisit() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      var key = (prefs.getString(_visitorKeyPref) ?? '').trim();
      if (key.length < 8) {
        final r = Random.secure();
        key = List.generate(16, (_) => r.nextInt(256))
            .map((b) => b.toRadixString(16).padLeft(2, '0'))
            .join();
        await prefs.setString(_visitorKeyPref, key);
      }
      await http.post(
        Uri.parse('${widget.config.restUrl}/public/platform-stats/visit'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'visitor_key': key}),
      );
    } catch (_) {}
  }

  Future<void> _loadChromeAndStats() async {
    try {
      final chromeRes = await http.get(
        Uri.parse('${widget.config.restUrl}/public/platform-stats-chrome'),
      );
      Map<String, dynamic>? chromeMap;
      try {
        final decoded = jsonDecode(chromeRes.body);
        if (decoded is Map<String, dynamic>) chromeMap = decoded;
      } catch (_) {}
      final unavailable =
          (chromeMap?['platform_stats_unavailable'] as String?)?.trim() ?? '';
      if (chromeRes.statusCode != 200) {
        if (!mounted) return;
        setState(() {
          _loading = false;
          _chrome = null;
          _unavailable = unavailable;
        });
        return;
      }
      final chrome = PlatformStatsChrome.fromJson(chromeMap);
      if (chrome == null) {
        if (!mounted) return;
        setState(() {
          _loading = false;
          _chrome = null;
          _unavailable = unavailable;
        });
        return;
      }
      if (!mounted) return;
      setState(() {
        _chrome = chrome;
        _unavailable = '';
      });
      await _loadStats(period: _period);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _chrome = null;
        _unavailable = '';
      });
    }
  }

  Future<void> _loadStats({
    required String period,
    bool background = false,
  }) async {
    final chrome = _chrome;
    if (chrome == null) return;
    final key = _cacheKey(period);
    final cached = _byPeriod[key];
    final soft = _stats != null;

    // Instant paint from cache (revisiting day/week/month) - Trim staleTime hit.
    if (cached != null && !background) {
      if (!mounted) return;
      setState(() {
        _stats = cached;
        _loading = false;
        _unavailable = '';
        // Align controlled dropdown with API id without a second hop.
        if (_period.isEmpty && cached.period.trim().isNotEmpty) {
          _period = cached.period.trim();
        }
        _refreshing = true;
      });
    } else if (soft && !background && mounted) {
      setState(() => _refreshing = true);
    }

    final gen = ++_loadGen;
    try {
      final uri =
          Uri.parse('${widget.config.restUrl}/public/platform-stats').replace(
        queryParameters:
            period.trim().isEmpty ? null : {'period': period.trim()},
      );
      final res = await http.get(uri);
      if (gen != _loadGen) return; // Newer period selection won the race.
      Map<String, dynamic>? map;
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) map = decoded;
      } catch (_) {}
      final snap =
          res.statusCode == 200 ? PlatformStatsSnapshot.fromJson(map) : null;
      if (!mounted) return;
      if (snap == null) {
        setState(() {
          _loading = false;
          _refreshing = false;
          if (!soft) {
            _stats = null;
            _unavailable = chrome.unavailable;
          }
        });
        return;
      }

      final apiPeriod = snap.period.trim();
      _byPeriod[key] = snap;
      if (apiPeriod.isNotEmpty) {
        _byPeriod[apiPeriod] = snap;
      }
      _byPeriod['default'] = snap;

      setState(() {
        _loading = false;
        _refreshing = false;
        _stats = snap;
        _unavailable = '';
        // Seed controlled period once (cache already keyed) - no extra request.
        if (_period.isEmpty && apiPeriod.isNotEmpty) {
          _period = apiPeriod;
        }
      });
    } catch (_) {
      if (gen != _loadGen) return;
      if (!mounted) return;
      setState(() {
        _loading = false;
        _refreshing = false;
        if (!soft) {
          _stats = null;
          _unavailable = chrome.unavailable;
        }
      });
    }
  }

  void _onPeriodChanged(String next) {
    if (next.isEmpty || next == _period) return;
    final cached = _byPeriod[next];
    setState(() {
      _period = next;
      // Keep previous paint until cache or network resolves (no list jump).
      if (cached != null) {
        _stats = cached;
        _refreshing = true;
      } else if (_stats != null) {
        _refreshing = true;
      }
    });
    unawaited(_loadStats(period: next));
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final chrome = _chrome;
    if (_loading && chrome == null) {
      return const Scaffold(body: PlatformStatsPageSkeleton());
    }
    if (chrome != null && _loading && _stats == null) {
      return Scaffold(
        appBar: AppBar(title: Text(chrome.sectionTitle)),
        body: const PlatformStatsPageSkeleton(wrapRoot: false),
      );
    }
    if (chrome == null) {
      final msg = _unavailable.trim();
      return Scaffold(
        appBar: AppBar(),
        body: msg.isEmpty
            ? const SizedBox.shrink()
            : Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    msg,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: tokens.onSurfaceMuted),
                  ),
                ),
              ),
      );
    }

    final snap = _stats;
    final fmt = NumberFormat.decimalPattern('en_US');
    final tiles = snap == null
        ? const <PlatformKpiItem>[]
        : snap.kpiSections.expand((s) => s.items).toList();
    final options = snap?.periodOptions ?? const <PlatformPeriodOption>[];

    return Scaffold(
      appBar: AppBar(title: Text(chrome.sectionTitle)),
      body: Stack(
        children: [
          RefreshIndicator(
            onRefresh: () => _loadStats(period: _period),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                Text(
                  chrome.sectionBlurb,
                  style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 13),
                ),
                if (options.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  Text(
                    chrome.periodLabel,
                    style: TextStyle(
                      color: tokens.onSurfaceMuted,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.4,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Builder(
                    builder: (context) {
                      String selectedId = '';
                      if (options.any((o) => o.id == _period)) {
                        selectedId = _period;
                      } else {
                        final api = (snap?.period ?? '').trim();
                        if (api.isNotEmpty && options.any((o) => o.id == api)) {
                          selectedId = api;
                        } else if (options.isNotEmpty) {
                          selectedId = options.first.id;
                        }
                      }
                      String selectedLabel = chrome.periodLabel;
                      for (final o in options) {
                        if (o.id == selectedId) {
                          selectedLabel = o.label;
                          break;
                        }
                      }
                      return ChromeSelectField(
                        label: chrome.periodLabel,
                        valueLabel: selectedLabel,
                        onTap: () async {
                          final picked = await showChromeOptionSheet<String>(
                            context: context,
                            title: chrome.periodLabel,
                            selected: selectedId.isNotEmpty ? selectedId : null,
                            options: [
                              for (final o in options)
                                ChromeSelectOption(value: o.id, label: o.label),
                            ],
                          );
                          final next = (picked ?? '').trim();
                          if (next.isEmpty) return;
                          _onPeriodChanged(next);
                        },
                      );
                    },
                  ),
                ],
                if (_unavailable.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    _unavailable,
                    style: TextStyle(color: tokens.danger, fontSize: 12),
                  ),
                ],
                if (tiles.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  LayoutBuilder(
                    builder: (context, c) {
                      final colW = c.maxWidth >= 720
                          ? (c.maxWidth - 30) / 4
                          : c.maxWidth >= 480
                              ? (c.maxWidth - 20) / 3
                              : (c.maxWidth - 10) / 2;
                      return Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          for (final t in tiles)
                            SizedBox(
                              width: colW.clamp(112.0, 220.0),
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  color: tokens.card,
                                  borderRadius: BorderRadius.circular(8),
                                  border:
                                      Border.all(color: tokens.borderSubtle),
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 12,
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        t.label,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          color: tokens.onSurfaceMuted,
                                          fontSize: 10,
                                          fontWeight: FontWeight.w600,
                                          letterSpacing: 0.4,
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        fmt.format(t.value),
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleMedium
                                            ?.copyWith(
                                          fontFeatures: const [
                                            FontFeature.tabularFigures(),
                                          ],
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                        ],
                      );
                    },
                  ),
                ],
                if (snap != null && snap.hasChart) ...[
                  const SizedBox(height: 24),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      color: tokens.card,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: tokens.borderSubtle),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: ActivityStackedChart(
                        title: snap.seriesTitle,
                        subtitle: snap.seriesSubtitle,
                        yAxisLabel: snap.seriesYAxis,
                        series: snap.series,
                        seriesMeta: snap.seriesMeta,
                        emptyLabel: snap.seriesEmpty,
                        legendAria: snap.seriesLegendAria,
                        todayDay: snap.todayDay,
                        todayLabel: snap.seriesTodayLabel,
                      ),
                    ),
                  ),
                ],
                if (snap != null) ActivityDashboardSections(snapshot: snap),
              ],
            ),
          ),
          // Overlay progress - never inserts into ListView (no layout jump).
          if (_refreshing)
            const Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: LinearProgressIndicator(minHeight: 2),
            ),
        ],
      ),
    );
  }
}
