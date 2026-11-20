import 'dart:convert';

import 'package:dama_mobile/core/io/share_bytes.dart';
import 'package:dama_mobile/core/lib/chrome_string.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/network/graphql_client.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/features/ads/schedule_chrome_ready.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

/// Publisher analytics + invoice download - web ads analytics parity.
/// KPI totals (CTR/CPC/completion) come from GraphQL publisherDashboard only.
class PublisherAnalyticsPage extends StatefulWidget {
  const PublisherAnalyticsPage({super.key, required this.accessToken});

  final String accessToken;

  @override
  State<PublisherAnalyticsPage> createState() => _PublisherAnalyticsPageState();
}

class _PublisherAnalyticsPageState extends State<PublisherAnalyticsPage> {
  Map<String, String> _chrome = const {};
  List<Map<String, dynamic>> _rows = const [];
  GPublisherDashboard? _dash;
  bool _loading = true;
  bool _invoiceBusy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String _c(String key) => chromeMapString(_chrome, key);

  int get _listPageSize {
    final n = int.tryParse(_c('list_page_size'));
    return n != null && n > 0 ? n : 0;
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final playback = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/playback'),
      );
      if (playback.statusCode == 200) {
        final body = jsonDecode(playback.body) as Map<String, dynamic>;
        final sc = body['schedule_chrome'];
        if (sc is Map<String, dynamic>) {
          _chrome = sc.map((k, v) => MapEntry(k, v?.toString() ?? ''));
        }
      }
      if (!scheduleChromeReady(_chrome)) {
        if (!mounted) return;
        setState(() {
          _loading = false;
          _error = _c('playback_unavailable');
        });
        return;
      }
      final limit = _listPageSize;
      if (limit < 1) {
        if (!mounted) return;
        setState(() {
          _loading = false;
          _error = _c('playback_unavailable');
        });
        return;
      }
      GPublisherDashboard? dash;
      try {
        final gql = GraphqlClient(accessToken: widget.accessToken);
        dash = await gql.fetchPublisherDashboard();
      } catch (_) {
        dash = null;
      }
      final all = <Map<String, dynamic>>[];
      var skip = 0;
      for (;;) {
        final list = await http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/campaigns').replace(
            queryParameters: {'skip': '$skip', 'limit': '$limit'},
          ),
          headers: {'Authorization': 'Bearer ${widget.accessToken}'},
        );
        if (list.statusCode >= 300) {
          if (!mounted) return;
          setState(() {
            _loading = false;
            _error = _c('publisher_dash_load_failed');
          });
          return;
        }
        final body = jsonDecode(list.body) as Map<String, dynamic>;
        final rows = (body['campaigns'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .toList();
        all.addAll(rows);
        final meta = body['meta'];
        final hasMore = meta is Map && meta['has_more'] == true;
        final next = meta is Map && meta['next_skip'] is num
            ? (meta['next_skip'] as num).toInt()
            : null;
        if (!hasMore || next == null) break;
        skip = next;
      }
      if (!mounted) return;
      setState(() {
        _rows = all;
        _dash = dash;
        _loading = false;
        if (dash == null) {
          _error = _c('publisher_dash_load_failed');
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = _c('publisher_dash_load_failed');
      });
    }
  }

  Future<void> _downloadInvoice() async {
    setState(() => _invoiceBusy = true);
    try {
      // Server resolves invoice currency from request IP (no client country_code).
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/invoices/pdf'),
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      if (res.statusCode >= 300) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(_c('publisher_invoice_failed'))),
          );
        }
        return;
      }
      final filename = _c('publisher_invoice_filename');
      if (filename.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(_c('publisher_invoice_failed'))),
          );
        }
        return;
      }
      await shareBytesAsFile(
        bytes: res.bodyBytes,
        filename: filename,
        mimeType: 'application/pdf',
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_c('publisher_invoice_failed'))),
        );
      }
    } finally {
      if (mounted) setState(() => _invoiceBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: WalletSkeleton(),
      );
    }
    final dash = _dash;
    final empty = _c('empty_value');
    final impressions =
        dash?.totalImpressions != null ? '${dash!.totalImpressions}' : empty;
    final clicks = dash?.totalClicks != null ? '${dash!.totalClicks}' : empty;
    final uniqueReach =
        dash?.totalUniqueReach != null ? '${dash!.totalUniqueReach}' : empty;
    final ctr =
        dash?.ctrPercent != null ? dash!.ctrPercent!.toStringAsFixed(2) : '';
    final moneySep = _c('amount_currency_separator');
    final cpcVal = dash?.cpc;
    final cpcCur = (dash?.cpcCurrency ?? '').trim();
    final cpc = cpcVal != null && cpcCur.isNotEmpty && moneySep.isNotEmpty
        ? '${cpcVal.toStringAsFixed(4)}$moneySep$cpcCur'
        : '';
    final completionRate = dash?.completionPercent != null
        ? dash!.completionPercent!.toStringAsFixed(2)
        : '';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          _c('publisher_analytics_title'),
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 8),
        Text(
          _c('publisher_analytics_body'),
          style: TextStyle(color: tokens.onSurfaceMuted),
        ),
        if (_error != null && _error!.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(_error!, style: TextStyle(color: tokens.danger)),
        ] else if (dash != null) ...[
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _MiniStat(
                  label: _c('publisher_stat_impressions'),
                  value: impressions.toString()),
              _MiniStat(
                  label: _c('publisher_stat_reach'),
                  value: uniqueReach.toString()),
              _MiniStat(
                  label: _c('publisher_stat_clicks'), value: clicks.toString()),
              if (ctr.isNotEmpty)
                _MiniStat(label: _c('publisher_stat_ctr'), value: ctr),
              if (cpc.isNotEmpty)
                _MiniStat(label: _c('publisher_stat_cpc'), value: cpc),
              if (completionRate.isNotEmpty)
                _MiniStat(
                    label: _c('publisher_stat_completion'),
                    value: completionRate),
            ],
          ),
          const SizedBox(height: 16),
          TextButton(
            onPressed: _invoiceBusy ? null : _downloadInvoice,
            child: Text(
              _invoiceBusy
                  ? _c('publisher_invoice_pending')
                  : _c('publisher_invoice_action'),
            ),
          ),
        ],
        if (_rows.isNotEmpty) ...[
          const SizedBox(height: 24),
          Text(
            _c('publisher_campaigns_heading'),
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          ..._rows.map((c) {
            final title = (c['title'] ?? '').toString();
            final statusLabel = (c['status_label'] as String?)?.trim() ?? '';
            final statusDisp =
                statusLabel.isNotEmpty ? statusLabel : _c('empty_value');
            final imp = c['impressions'];
            final clk = c['clicks'];
            final reach = c['unique_reach'];
            final comps = c['video_completions'];
            return ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
              subtitle: Text(
                [
                  statusDisp,
                  if (imp != null) '${_c('publisher_stat_impressions')}: $imp',
                  if (reach != null) '${_c('publisher_stat_reach')}: $reach',
                  if (clk != null) '${_c('publisher_stat_clicks')}: $clk',
                  if (comps != null)
                    '${_c('publisher_stat_completion')}: $comps',
                ].where((s) => s.trim().isNotEmpty).join(_c('meta_separator')),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            );
          }),
        ],
      ],
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    if (label.trim().isEmpty || value.trim().isEmpty) {
      return const SizedBox.shrink();
    }
    return SizedBox(
      width: 140,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12)),
          Text(
            value,
            style: TextStyle(
              color: tokens.gold,
              fontFeatures: const [FontFeature.tabularFigures()],
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
