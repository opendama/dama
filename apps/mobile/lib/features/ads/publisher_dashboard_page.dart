import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/cache/skip_store.dart';
import 'package:dama_mobile/core/geo/device_locate.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/network/graphql_client.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/core/ui/skip_pagination_bar.dart';
import 'package:dama_mobile/core/lib/chrome_string.dart';
import 'package:dama_mobile/features/ads/schedule_chrome_ready.dart';
import 'package:dama_mobile/features/leaderboard/leaderboard_cubit.dart'
    show SkipMeta;
import 'package:dama_mobile/features/notifications/notification_href_nav.dart';
import 'package:dama_mobile/features/wallet/portal_wallet_focus.dart';
import 'package:dama_mobile/features/wallet/wallet_page.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

/// Publisher dashboard - GraphQL KPIs + REST paged campaigns (web parity).
class PublisherDashboardPage extends StatefulWidget {
  const PublisherDashboardPage({super.key, required this.accessToken});

  final String accessToken;

  @override
  State<PublisherDashboardPage> createState() => _PublisherDashboardPageState();
}

class _PublisherDashboardPageState extends State<PublisherDashboardPage> {
  Map<String, String> _chrome = const {};
  GPublisherDashboard? _dash;
  List<Map<String, dynamic>> _campaigns = const [];
  SkipMeta? _meta;
  static const _skipKey = 'ads_dashboard';
  int _skip = 0;
  WalletChrome? _walletChrome;
  String _walletBalValue = '';
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _skip = SkipStore.read(_skipKey);
    _load(skip: _skip);
  }

  String _c(String key) => chromeMapString(_chrome, key);

  int get _listPageSize {
    final n = int.tryParse(_c('list_page_size'));
    return n != null && n > 0 ? n : 0;
  }

  Future<(WalletChrome?, String)> _loadWalletBalanceKpi() async {
    try {
      final chromeRes = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/public/wallet-chrome'),
      );
      if (chromeRes.statusCode >= 300) return (null, '');
      final walletChrome = WalletChrome.fromJson(
        jsonDecode(chromeRes.body) as Map<String, dynamic>,
      );
      if (walletChrome == null || !walletChrome.isReady) {
        return (null, '');
      }
      final empty = walletChrome.emptyValue;
      final pending = walletChrome.balancePending.isNotEmpty
          ? walletChrome.balancePending
          : (walletChrome.walletUnavailable.isNotEmpty
              ? walletChrome.walletUnavailable
              : empty);
      final located = await locateWithDeviceGps(
        locateUrl: '${ApiConfig.baseUrl}/api/v1/geo/locate',
        headers: {
          'Authorization': 'Bearer ${widget.accessToken}',
        },
      );
      final country = (located?.countryCode ?? '').trim().toUpperCase();
      if (country.isEmpty) {
        return (walletChrome, pending);
      }
      final walletRes = await http.get(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/payments/wallet',
        ),
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      if (walletRes.statusCode >= 300) {
        return (
          walletChrome,
          walletChrome.walletUnavailable.isNotEmpty
              ? walletChrome.walletUnavailable
              : pending,
        );
      }
      final snap = WalletSnapshot.fromJson(
        jsonDecode(walletRes.body) as Map<String, dynamic>,
      );
      final sep = walletChrome.amountCurrencySeparator;
      final bal = snap.balance;
      final cur = (snap.currency ?? '').trim();
      if (bal == null || cur.isEmpty || sep.isEmpty) {
        return (walletChrome, pending);
      }
      return (walletChrome, '$bal$sep$cur');
    } catch (_) {
      return (null, '');
    }
  }

  Future<void> _load({int? skip}) async {
    final nextSkip = skip ?? _skip;
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
      final gql = GraphqlClient(accessToken: widget.accessToken);
      final dash = await gql.fetchPublisherDashboard();
      final list = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/campaigns').replace(
          queryParameters: {'skip': '$nextSkip', 'limit': '$limit'},
        ),
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      if (!mounted) return;
      if (list.statusCode >= 300) {
        setState(() {
          _dash = dash;
          _loading = false;
          _error = _c('publisher_dash_load_failed');
        });
        return;
      }
      final body = jsonDecode(list.body) as Map<String, dynamic>;
      final campaigns = (body['campaigns'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .toList();
      final metaRaw = body['meta'];
      final meta =
          metaRaw is Map<String, dynamic> ? SkipMeta.fromJson(metaRaw) : null;
      final walletKpi = await _loadWalletBalanceKpi();
      if (!mounted) return;
      setState(() {
        _dash = dash;
        _campaigns = campaigns;
        _meta = meta;
        _skip = nextSkip;
        _walletChrome = walletKpi.$1;
        _walletBalValue = walletKpi.$2;
        _loading = false;
      });
      unawaited(SkipStore.write(_skipKey, nextSkip));
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = _c('publisher_dash_load_failed');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    // Soft page changes keep list + pager mounted (no skeleton flash).
    if (_loading && _campaigns.isEmpty && _dash == null) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: WalletSkeleton(),
      );
    }
    final dash = _dash;
    final open = _c('paren_open');
    final close = _c('paren_close');
    final meta = _meta;
    final empty = _c('empty_value');
    final total = meta?.total;
    return RefreshIndicator(
      onRefresh: () => _load(skip: _skip),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            _c('publisher_dash_title'),
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            _c('publisher_dash_body'),
            style: TextStyle(color: tokens.onSurfaceMuted),
          ),
          if (_c('publisher_portal_section_title').isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(
              _c('publisher_portal_section_title'),
              style: TextStyle(
                color: tokens.gold,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (_c('publisher_portal_payout_blurb').isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                _c('publisher_portal_payout_blurb'),
                style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 13),
              ),
            ],
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (_c('publisher_portal_create_label').isNotEmpty &&
                    _c('publisher_portal_create_href').isNotEmpty)
                  FilledButton(
                    onPressed: () {
                      navigateNotificationHref(
                        context,
                        href: _c('publisher_portal_create_href'),
                        accessToken: widget.accessToken,
                      );
                    },
                    child: Text(_c('publisher_portal_create_label')),
                  ),
                if (_c('publisher_manage_campaigns').isNotEmpty &&
                    _c('publisher_manage_campaigns_href').isNotEmpty)
                  OutlinedButton(
                    onPressed: () {
                      navigateNotificationHref(
                        context,
                        href: _c('publisher_manage_campaigns_href'),
                        accessToken: widget.accessToken,
                      );
                    },
                    child: Text(_c('publisher_manage_campaigns')),
                  ),
                if (_c('publisher_portal_overview_label').isNotEmpty &&
                    _c('publisher_portal_overview_href').isNotEmpty)
                  OutlinedButton(
                    onPressed: () {
                      navigateNotificationHref(
                        context,
                        href: _c('publisher_portal_overview_href'),
                        accessToken: widget.accessToken,
                      );
                    },
                    child: Text(_c('publisher_portal_overview_label')),
                  ),
                if (_c('publisher_portal_wallet_label').isNotEmpty &&
                    _c('publisher_portal_wallet_href').isNotEmpty)
                  OutlinedButton(
                    onPressed: () {
                      final focus = portalWalletFocusFromHref(
                        _c('publisher_portal_wallet_href'),
                      );
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => WalletPage(
                            token: widget.accessToken,
                            showOrganizerPayoutBlurb: true,
                            moneyBasePath: moneyBasePathFromHref(
                              _c('publisher_portal_wallet_href'),
                            ),
                            focusPayout: focus.focusPayout,
                            focusTopUp: focus.focusTopUp,
                            focusPayoutHistoryId: focus.historyId,
                          ),
                        ),
                      );
                    },
                    child: Text(_c('publisher_portal_wallet_label')),
                  ),
                if (_c('publisher_portal_payout_label').isNotEmpty &&
                    _c('publisher_portal_payout_href').isNotEmpty)
                  OutlinedButton(
                    onPressed: () {
                      final focus = portalWalletFocusFromHref(
                        _c('publisher_portal_payout_href'),
                      );
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => WalletPage(
                            token: widget.accessToken,
                            showOrganizerPayoutBlurb: true,
                            moneyBasePath: moneyBasePathFromHref(
                              _c('publisher_portal_payout_href'),
                            ),
                            focusPayout: focus.focusPayout,
                            focusTopUp: focus.focusTopUp,
                            focusPayoutHistoryId: focus.historyId,
                          ),
                        ),
                      );
                    },
                    child: Text(_c('publisher_portal_payout_label')),
                  ),
                if (_c('publisher_portal_receipts_label').isNotEmpty &&
                    _c('publisher_portal_receipts_href').isNotEmpty)
                  OutlinedButton(
                    onPressed: () {
                      navigateNotificationHref(
                        context,
                        href: _c('publisher_portal_receipts_href'),
                        accessToken: widget.accessToken,
                      );
                    },
                    child: Text(_c('publisher_portal_receipts_label')),
                  ),
                if (_c('publisher_portal_transactions_label').isNotEmpty &&
                    _c('publisher_portal_transactions_href').isNotEmpty)
                  OutlinedButton(
                    onPressed: () {
                      navigateNotificationHref(
                        context,
                        href: _c('publisher_portal_transactions_href'),
                        accessToken: widget.accessToken,
                      );
                    },
                    child: Text(_c('publisher_portal_transactions_label')),
                  ),
              ],
            ),
          ],
          if (dash?.meUsername != null) ...[
            const SizedBox(height: 8),
            Text(
              dash!.meUsername!,
              style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 13),
            ),
          ],
          if (_error != null && _error!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(_error!, style: TextStyle(color: tokens.danger)),
          ],
          if (dash != null) ...[
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                _StatCard(
                  label: _c('publisher_stat_impressions'),
                  value: dash.totalImpressions != null
                      ? '${dash.totalImpressions}'
                      : empty,
                  note: _c('publisher_stat_source_note'),
                ),
                _StatCard(
                  label: _c('publisher_stat_reach'),
                  value: dash.totalUniqueReach != null
                      ? '${dash.totalUniqueReach}'
                      : empty,
                  note: _c('publisher_stat_source_note'),
                ),
                _StatCard(
                  label: _c('publisher_stat_clicks'),
                  value:
                      dash.totalClicks != null ? '${dash.totalClicks}' : empty,
                  note: _c('publisher_stat_source_note'),
                ),
                if (dash.ctrPercent != null)
                  _StatCard(
                    label: _c('publisher_stat_ctr'),
                    value: dash.ctrPercent!.toStringAsFixed(2),
                    note: _c('publisher_stat_source_note'),
                  ),
                if (dash.cpc != null &&
                    dash.cpcCurrency.isNotEmpty &&
                    (_walletChrome?.amountCurrencySeparator ?? '').isNotEmpty)
                  _StatCard(
                    label: _c('publisher_stat_cpc'),
                    value:
                        '${dash.cpc!.toStringAsFixed(4)}${_walletChrome!.amountCurrencySeparator}${dash.cpcCurrency}',
                    note: _c('publisher_stat_source_note'),
                  ),
                if (dash.completionPercent != null)
                  _StatCard(
                    label: _c('publisher_stat_completion'),
                    value: dash.completionPercent!.toStringAsFixed(2),
                    note: _c('publisher_stat_source_note'),
                  ),
                if (dash.createFeeSpendSum != null &&
                    dash.createFeeSpendCurrency.isNotEmpty &&
                    (_walletChrome?.amountCurrencySeparator ?? '').isNotEmpty &&
                    _c('publisher_stat_create_fee').isNotEmpty)
                  _StatCard(
                    label: _c('publisher_stat_create_fee'),
                    value:
                        '${dash.createFeeSpendSum}${_walletChrome!.amountCurrencySeparator}${dash.createFeeSpendCurrency}',
                    note: _c('publisher_stat_source_note'),
                  ),
                if ((_walletChrome?.balanceLabel ?? '').trim().isNotEmpty &&
                    _walletBalValue.trim().isNotEmpty)
                  _StatCard(
                    label: _walletChrome!.balanceLabel,
                    value: _walletBalValue,
                    note: _c('publisher_stat_source_note'),
                  ),
              ],
            ),
            const SizedBox(height: 24),
            Text(
              '${_c('publisher_campaigns_heading')}$open${total ?? empty}$close',
              style: TextStyle(
                color: tokens.gold,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            if (_campaigns.isEmpty)
              Text(
                _c('publisher_no_campaigns'),
                style: TextStyle(color: tokens.onSurfaceMuted),
              )
            else
              ..._campaigns.map(
                (c) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(
                      c['title']?.toString() ?? '',
                      style: TextStyle(color: tokens.gold),
                    ),
                    subtitle: Text(
                      [
                        (() {
                          final labeled =
                              (c['status_label'] as String?)?.trim() ?? '';
                          return labeled.isNotEmpty
                              ? labeled
                              : _c('empty_value');
                        })(),
                        (() {
                          final labeled =
                              (c['creative_type_label'] as String?)?.trim() ??
                                  '';
                          return labeled.isNotEmpty
                              ? labeled
                              : _c('empty_value');
                        })(),
                        c['impressions'] is num
                            ? '${c['impressions']} ${_c('stats_impressions_suffix')}'
                            : _c('empty_value'),
                        c['unique_reach'] is num
                            ? '${c['unique_reach']} ${_c('stats_reach_suffix')}'
                            : _c('empty_value'),
                        c['clicks'] is num
                            ? '${c['clicks']} ${_c('stats_clicks_suffix')}'
                            : _c('empty_value'),
                        c['video_completions'] is num
                            ? '${c['video_completions']} ${_c('publisher_stat_completion')}'
                            : _c('empty_value'),
                      ].join(_c('meta_separator')),
                    ),
                  ),
                ),
              ),
            if (meta != null && meta.totalPages > 1)
              SkipPaginationBar(
                meta: meta,
                busy: _loading && _campaigns.isNotEmpty,
                onSkip: (skip) => unawaited(_load(skip: skip)),
              ),
          ],
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.note,
  });

  final String label;
  final String value;
  final String note;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    return SizedBox(
      width: 140,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: tokens.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: tokens.borderSubtle),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style: TextStyle(fontSize: 11, color: tokens.onSurfaceMuted)),
              const SizedBox(height: 6),
              Text(
                value,
                style: TextStyle(
                  color: tokens.gold,
                  fontWeight: FontWeight.w700,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              if (note.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  note,
                  style: TextStyle(fontSize: 10, color: tokens.onSurfaceMuted),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
