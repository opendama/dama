import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/features/events/event_invite_share_url.dart';
import 'package:dama_mobile/features/events/events_dialog_shell.dart';
import 'package:dama_mobile/features/events/hosting_organizer_chrome_soft.dart';
import 'package:dama_mobile/features/notifications/notification_href_nav.dart';
import 'package:dama_mobile/features/wallet/portal_wallet_focus.dart';
import 'package:dama_mobile/features/wallet/wallet_page.dart';
import 'package:dama_mobile/widgets/host_trust_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

/// Organizer events dashboard KPIs from GET /events/dashboard.
class EventsDashboardPage extends StatefulWidget {
  const EventsDashboardPage({super.key, required this.accessToken});

  final String accessToken;

  @override
  State<EventsDashboardPage> createState() => _EventsDashboardPageState();
}

class _EventsDashboardPageState extends State<EventsDashboardPage> {
  EventsOrganizerChrome? _chrome;
  EventsDashboardStats? _stats;
  WalletChrome? _walletChrome;
  String _walletBalValue = '';
  String _sharePathTemplate = '';
  String _error = '';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
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
      final geoRes = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/geo/locate'),
        headers: {
          'Authorization': 'Bearer ${widget.accessToken}',
          'Content-Type': 'application/json',
        },
        body: '{}',
      );
      if (geoRes.statusCode >= 300) {
        return (walletChrome, pending);
      }
      final locate = GeoLocateResponse.fromJson(
        jsonDecode(geoRes.body) as Map<String, dynamic>,
      );
      final country = (locate.location?.countryCode ?? '').trim().toUpperCase();
      if (country.isEmpty) {
        return (walletChrome, pending);
      }
      // Server resolves payer country from request IP (reference pay chain).
      final walletRes = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/payments/wallet'),
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

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final chromeRes = await http.get(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/public/events-organizer-chrome',
        ),
      );
      EventsOrganizerChrome? chrome;
      String unavailable = '';
      if (chromeRes.statusCode < 300) {
        final map = jsonDecode(chromeRes.body) as Map<String, dynamic>;
        chrome = EventsOrganizerChrome.fromJson(map);
        unavailable =
            (map['events_organizer_chrome_unavailable'] as String?)?.trim() ??
                '';
      }
      if (chrome == null) {
        if (!mounted) return;
        setState(() {
          _chrome = null;
          _walletChrome = null;
          _walletBalValue = '';
          _loading = false;
          _error = softHostingChromeUnavailable(unavailable);
        });
        return;
      }
      // Catalog hosted_events_enabled == false → Hosting dashboard gated (web parity).
      var sharePathTemplate = '';
      try {
        final catRes = await http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/events/catalog'),
          headers: {'Authorization': 'Bearer ${widget.accessToken}'},
        );
        if (catRes.statusCode < 300) {
          final catMap = jsonDecode(catRes.body);
          if (catMap is Map<String, dynamic>) {
            sharePathTemplate =
                (catMap['share_path_template'] as String?)?.trim() ?? '';
            if (catMap.containsKey('hosted_events_enabled') &&
                catMap['hosted_events_enabled'] != true) {
              if (!mounted) return;
              final ready = chrome;
              setState(() {
                _chrome = ready;
                _walletChrome = null;
                _walletBalValue = '';
                _sharePathTemplate = '';
                _loading = false;
                _error = softHostingFeatureDisabled(ready.featureDisabled);
              });
              return;
            }
          }
        }
      } catch (_) {}
      final dashRes = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/dashboard'),
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      if (!mounted) return;
      final ready = chrome;
      if (dashRes.statusCode == 503 || dashRes.statusCode >= 300) {
        // Web parity: chrome.feature_disabled only (never invent API error bodies).
        setState(() {
          _chrome = ready;
          _walletChrome = null;
          _walletBalValue = '';
          _loading = false;
          _error = softHostingFeatureDisabled(ready.featureDisabled);
        });
        return;
      }
      final stats = EventsDashboardStats.fromJson(
        jsonDecode(dashRes.body) as Map<String, dynamic>,
      );
      final walletKpi = await _loadWalletBalanceKpi();
      if (!mounted) return;
      setState(() {
        _chrome = ready;
        _stats = stats;
        _walletChrome = walletKpi.$1;
        _walletBalValue = walletKpi.$2;
        _sharePathTemplate = sharePathTemplate;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = softHostingFeatureDisabled(_chrome?.featureDisabled ?? '');
      });
    }
  }

  String _moneyKpi(EventsOrganizerChrome chrome, num? n, String currency) {
    final empty = chrome.emptyValue;
    final sep = chrome.amountCurrencySeparator;
    final cur = currency.trim();
    if (n == null || cur.isEmpty || sep.isEmpty) return empty;
    return '$n$sep$cur';
  }

  String _kpiCell(String emptyValue, num? n) {
    if (n == null) return emptyValue;
    return '$n';
  }

  Widget _kpi(BuildContext context, String label, String value) {
    if (label.trim().isEmpty || value.trim().isEmpty) {
      return const SizedBox.shrink();
    }
    final chrome = _chrome;
    if (chrome == null) return const SizedBox.shrink();
    final pad = double.tryParse(chrome.dashboardTilePad.trim());
    final radius = double.tryParse(chrome.dashboardTileRadius.trim());
    final gap = double.tryParse(chrome.pageCardGap.trim());
    if (pad == null ||
        pad < 0 ||
        radius == null ||
        radius < 0 ||
        gap == null ||
        gap < 0) {
      return const SizedBox.shrink();
    }
    final tokens = damaColorsOf(context);
    return Container(
      padding: EdgeInsets.all(pad),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: tokens.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: tokens.onSurfaceMuted,
              fontWeight: FontWeight.w500,
            ),
          ),
          SizedBox(height: gap),
          Text(
            value,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.zero,
        child: WalletSkeleton(),
      );
    }
    final chrome = _chrome;
    if (chrome == null) {
      return Center(
        child: Padding(
          padding: EdgeInsets.zero,
          child: Text(_error, style: TextStyle(color: tokens.danger)),
        ),
      );
    }
    final pagePad = EventsDialogShell.pageInsets(
      insetH: chrome.dialogShellInsetH,
      insetV: chrome.dialogShellInsetV,
    );
    if (pagePad == null) return const SizedBox.shrink();
    final stats = _stats;
    final baseOrigin = Uri.base.origin.trim();
    final originForFallback =
        baseOrigin.startsWith('http://') || baseOrigin.startsWith('https://')
            ? baseOrigin
            : '';
    final lastShare = stats == null
        ? ''
        : resolveEventInviteShareUrl(
            shareUrl: stats.lastEventShareUrl,
            joinCode: stats.lastEventJoinCode,
            sharePathTemplate: _sharePathTemplate,
            origin: originForFallback,
          );
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: pagePad,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Text(
                  softHostingDashboardTitle(chrome.dashboardTitle),
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
              ),
              HostTrustBadge(
                label: _stats?.hostTrustBadge,
                tier: _stats?.hostTrustTier,
                fontSize: 10,
                dense: true,
              ),
            ],
          ),
          if (() {
            final sep = chrome.hostRepMetaSeparator;
            final s = _stats;
            return sep.isNotEmpty &&
                chrome.hostRepFinishedLabel.trim().isNotEmpty &&
                chrome.hostRepCancelledLabel.trim().isNotEmpty &&
                chrome.hostRepReportsLabel.trim().isNotEmpty &&
                s != null &&
                s.hostFinishedPaidCups != null &&
                s.hostCancelledPaidCups != null &&
                s.hostOpenReports != null;
          }()) ...[
            const SizedBox(height: 6),
            Text(
              [
                '${chrome.hostRepFinishedLabel.trim()} ${_stats!.hostFinishedPaidCups}',
                '${chrome.hostRepCancelledLabel.trim()} ${_stats!.hostCancelledPaidCups}',
                '${chrome.hostRepReportsLabel.trim()} ${_stats!.hostOpenReports}',
              ].join(chrome.hostRepMetaSeparator),
              style: TextStyle(
                color: tokens.onSurfaceMuted,
                fontSize: 11,
              ),
            ),
          ],
          const SizedBox(height: 8),
          Text(
            softHostingDashboardBlurb(chrome.dashboardBlurb),
            style: TextStyle(color: tokens.onSurfaceMuted),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (chrome.portalCreateLabel.isNotEmpty &&
                  chrome.portalCreateHref.isNotEmpty)
                FilledButton(
                  onPressed: () {
                    navigateNotificationHref(
                      context,
                      href: chrome.portalCreateHref,
                      accessToken: widget.accessToken,
                    );
                  },
                  child: Text(
                    softHostingPortalCreateLabel(chrome.portalCreateLabel),
                  ),
                ),
              if (chrome.portalOverviewLabel.isNotEmpty &&
                  chrome.portalOverviewHref.isNotEmpty)
                OutlinedButton(
                  onPressed: () {
                    navigateNotificationHref(
                      context,
                      href: chrome.portalOverviewHref,
                      accessToken: widget.accessToken,
                    );
                  },
                  child: Text(chrome.portalOverviewLabel),
                ),
              if (chrome.portalMoneySectionTitle.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    chrome.portalMoneySectionTitle,
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: tokens.gold,
                    ),
                  ),
                ),
              if (chrome.portalPayoutBlurb.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    chrome.portalPayoutBlurb,
                    style: TextStyle(
                      fontSize: 13,
                      color: tokens.onSurfaceMuted,
                    ),
                  ),
                ),
              if (chrome.portalWalletLabel.isNotEmpty &&
                  chrome.portalWalletHref.isNotEmpty)
                OutlinedButton(
                  onPressed: () {
                    final focus =
                        portalWalletFocusFromHref(chrome.portalWalletHref);
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => WalletPage(
                          token: widget.accessToken,
                          showOrganizerPayoutBlurb: true,
                          moneyBasePath: moneyBasePathFromHref(
                            chrome.portalWalletHref,
                          ),
                          focusPayout: focus.focusPayout,
                          focusTopUp: focus.focusTopUp,
                          focusPayoutHistoryId: focus.historyId,
                        ),
                      ),
                    );
                  },
                  child: Text(chrome.portalWalletLabel),
                ),
              if (chrome.portalPayoutLabel.isNotEmpty &&
                  chrome.portalPayoutHref.isNotEmpty)
                OutlinedButton(
                  onPressed: () {
                    final focus =
                        portalWalletFocusFromHref(chrome.portalPayoutHref);
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => WalletPage(
                          token: widget.accessToken,
                          showOrganizerPayoutBlurb: true,
                          moneyBasePath: moneyBasePathFromHref(
                            chrome.portalPayoutHref.isNotEmpty
                                ? chrome.portalPayoutHref
                                : chrome.portalWalletHref,
                          ),
                          focusPayout: focus.focusPayout,
                          focusTopUp: focus.focusTopUp,
                          focusPayoutHistoryId: focus.historyId,
                        ),
                      ),
                    );
                  },
                  child: Text(chrome.portalPayoutLabel),
                ),
              if (chrome.portalReceiptsLabel.isNotEmpty &&
                  chrome.portalReceiptsHref.isNotEmpty)
                OutlinedButton(
                  onPressed: () {
                    navigateNotificationHref(
                      context,
                      href: chrome.portalReceiptsHref,
                      accessToken: widget.accessToken,
                    );
                  },
                  child: Text(chrome.portalReceiptsLabel),
                ),
              if (chrome.portalTransactionsLabel.isNotEmpty &&
                  chrome.portalTransactionsHref.isNotEmpty)
                OutlinedButton(
                  onPressed: () {
                    navigateNotificationHref(
                      context,
                      href: chrome.portalTransactionsHref,
                      accessToken: widget.accessToken,
                    );
                  },
                  child: Text(chrome.portalTransactionsLabel),
                ),
              if (chrome.portalPublicListLabel.isNotEmpty &&
                  chrome.portalPublicListHref.isNotEmpty)
                OutlinedButton(
                  onPressed: () {
                    // Unified discovery: Community under Tournaments (not a second browse).
                    navigateNotificationHref(
                      context,
                      href: chrome.portalPublicListHref,
                      accessToken: widget.accessToken,
                    );
                  },
                  child: Text(
                    softHostingPortalPublicListLabel(
                        chrome.portalPublicListLabel),
                  ),
                ),
            ],
          ),
          if (_error.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(_error, style: TextStyle(color: tokens.danger)),
          ],
          if (stats != null) ...[
            const SizedBox(height: 16),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 1.45,
              children: [
                _kpi(
                  context,
                  chrome.kpiActiveLabel,
                  _kpiCell(chrome.emptyValue, stats.activeCount),
                ),
                _kpi(
                  context,
                  chrome.kpiUpcomingLabel,
                  _kpiCell(chrome.emptyValue, stats.upcomingCount),
                ),
                _kpi(
                  context,
                  chrome.kpiPlayersWeekLabel,
                  _kpiCell(chrome.emptyValue, stats.playersJoinedThisWeek),
                ),
                if (chrome.kpiPausedBoardsLabel.trim().isNotEmpty)
                  _kpi(
                    context,
                    chrome.kpiPausedBoardsLabel,
                    _kpiCell(chrome.emptyValue, stats.officiallyPausedCount),
                  ),
                if (chrome.kpiPausedAvgLabel.trim().isNotEmpty)
                  _kpi(
                    context,
                    chrome.kpiPausedAvgLabel,
                    _kpiCell(chrome.emptyValue, stats.officialPauseAvgSeconds),
                  ),
                _kpi(
                  context,
                  chrome.kpiHostFeeRevenueLabel,
                  _moneyKpi(
                      chrome, stats.hostFeeRevenueSum, stats.hostFeeCurrency),
                ),
                _kpi(
                  context,
                  chrome.kpiEntryFeeGrossLabel,
                  _moneyKpi(
                      chrome, stats.entryFeeGrossSum, stats.entryFeeCurrency),
                ),
                _kpi(
                  context,
                  chrome.kpiEntryFeeCommissionLabel,
                  _moneyKpi(
                    chrome,
                    stats.entryFeeCommissionSum,
                    stats.entryFeeCurrency,
                  ),
                ),
                _kpi(
                  context,
                  chrome.kpiEntryFeeNetLabel,
                  _moneyKpi(
                      chrome, stats.entryFeeNetSum, stats.entryFeeCurrency),
                ),
                if ((_walletChrome?.balanceLabel ?? '').trim().isNotEmpty &&
                    _walletBalValue.trim().isNotEmpty)
                  _kpi(
                    context,
                    _walletChrome!.balanceLabel,
                    _walletBalValue,
                  ),
              ],
            ),
            if (lastShare.isNotEmpty) ...[
              const SizedBox(height: 20),
              Text(
                chrome.kpiLastShareLabel,
                style: TextStyle(
                  color: tokens.gold,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(
                  (stats.lastEventJoinCode ?? '').trim().isNotEmpty
                      ? (stats.lastEventJoinCode ?? '').trim()
                      : lastShare,
                  style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 13),
                ),
                subtitle: (stats.lastEventJoinCode ?? '').trim().isNotEmpty
                    ? Text(
                        lastShare,
                        style: TextStyle(
                          color: tokens.onSurfaceMuted,
                          fontSize: 12,
                        ),
                      )
                    : null,
                trailing: IconButton(
                  icon: const Icon(Icons.copy),
                  onPressed: () async {
                    try {
                      await Clipboard.setData(ClipboardData(text: lastShare));
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(chrome.copiedBlurb)),
                      );
                    } catch (_) {
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(chrome.toastCopyFailed)),
                      );
                    }
                  },
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}
