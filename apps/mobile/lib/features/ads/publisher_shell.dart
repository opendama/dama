import 'dart:convert';

import 'package:dama_mobile/core/nav/manual_transfer_nav.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/theme/theme_toggle_button.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/scrollable_portal_bottom_nav.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/features/ads/publisher_analytics_page.dart';
import 'package:dama_mobile/features/ads/publisher_campaigns_page.dart';
import 'package:dama_mobile/features/ads/publisher_dashboard_page.dart';
import 'package:dama_mobile/features/notifications/notification_bell.dart';
import 'package:dama_mobile/features/notifications/notification_href_nav.dart';
import 'package:dama_mobile/features/wallet/manual_transfer_page.dart';
import 'package:dama_mobile/features/wallet/portal_wallet_focus.dart';
import 'package:dama_mobile/features/wallet/receipts_page.dart';
import 'package:dama_mobile/features/wallet/transactions_page.dart';
import 'package:dama_mobile/features/wallet/wallet_page.dart';
import 'package:dama_mobile/widgets/dama_brand_mark.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

/// Ad Publisher portal shell - tabs only from `client_nav.bottom_nav.ads` (DB, fail closed).
class PublisherShell extends StatefulWidget {
  const PublisherShell({
    super.key,
    required this.accessToken,
    this.initialRouteKey = 'ads_dashboard',
    this.initialCampaignId,
    this.initialMoneyFocusId,
    this.focusPayout = false,
    this.focusTopUp = false,
    this.focusPayoutHistoryId,
  });

  final String accessToken;
  final String initialRouteKey;

  /// Notification deep-link: open this campaign on the campaigns tab.
  final String? initialCampaignId;

  /// Receipt deep-link focus (wallet/receipts money paths only).
  final String? initialMoneyFocusId;

  /// Wallet deep-link: scroll/highlight payout request section.
  final bool focusPayout;

  /// Wallet deep-link `?focus=topup`: open top-up sheet.
  final bool focusTopUp;

  /// Wallet deep-link `?id=`: seek/highlight payout history row.
  final String? focusPayoutHistoryId;

  @override
  State<PublisherShell> createState() => _PublisherShellState();
}

class _PublisherShellState extends State<PublisherShell> {
  List<ClientNavLink> _tabs = const [];
  String _navUnavailable = '';
  String _brandName = '';
  int _index = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadNav();
  }

  Future<void> _loadNav() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/platform/client-nav'),
      );
      if (res.statusCode >= 300) {
        if (mounted) setState(() => _loading = false);
        return;
      }
      final payload = ClientNavPayload.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      if (!isAdsBottomNavReady(payload)) {
        if (!mounted) return;
        setState(() {
          _tabs = const [];
          _navUnavailable = payload.mobileNavUnavailable;
          _loading = false;
        });
        return;
      }
      final isManual = await fetchIsManualTransferRoute();
      final ads = filterManualTransferNavLinks(payload.bottomNav.ads, isManual);
      var idx = ads.indexWhere((l) => l.routeKey == widget.initialRouteKey);
      if (idx < 0 &&
          (widget.initialRouteKey == 'ads' ||
              widget.initialRouteKey == 'ads_dashboard')) {
        idx = ads.indexWhere((l) => l.routeKey == 'ads_dashboard');
      }
      if (!mounted) return;
      setState(() {
        _tabs = ads;
        _brandName = payload.adsBrandName.trim();
        _navUnavailable = payload.mobileNavUnavailable;
        _index = idx >= 0 ? idx : 0;
        _loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _brandName = '';
          _loading = false;
        });
      }
    }
  }

  /// Money portal prefix from DB bottom_nav wallet/receipts/transactions hrefs.
  String _moneyBasePath() {
    for (final key in const [
      'ads_wallet',
      'ads_receipts',
      'ads_transactions',
    ]) {
      for (final t in _tabs) {
        if (t.routeKey != key) continue;
        final base = moneyBasePathFromHref((t.href ?? '').trim());
        if (base.isNotEmpty) return base;
      }
    }
    return '';
  }

  Widget _pageFor(String routeKey) {
    switch (routeKey) {
      case 'ads_campaigns':
        return PublisherCampaignsPage(
          accessToken: widget.accessToken,
          initialCampaignId: widget.initialCampaignId,
        );
      case 'ads_analytics':
        return PublisherAnalyticsPage(accessToken: widget.accessToken);
      case 'ads_wallet':
        return WalletPage(
          token: widget.accessToken,
          showOrganizerPayoutBlurb: true,
          moneyBasePath: _moneyBasePath(),
          focusPayout: widget.focusPayout,
          focusTopUp: widget.focusTopUp,
          focusPayoutHistoryId: widget.focusPayoutHistoryId,
        );
      case 'ads_receipts':
        return ReceiptsPage(
          accessToken: widget.accessToken,
          focusId: widget.initialMoneyFocusId,
        );
      case 'ads_transactions':
        return TransactionsPage(
          accessToken: widget.accessToken,
          focusId: widget.initialMoneyFocusId,
        );
      case 'ads_transfer':
        return ManualTransferPage(
          accessToken: widget.accessToken,
          moneyBasePath: _moneyBasePath(),
        );
      case 'ads_dashboard':
      default:
        return PublisherDashboardPage(accessToken: widget.accessToken);
    }
  }

  IconData _iconFor(String routeKey, {required bool selected}) {
    switch (routeKey) {
      case 'ads_campaigns':
        return selected ? Icons.campaign : Icons.campaign_outlined;
      case 'ads_analytics':
        return selected ? Icons.analytics : Icons.analytics_outlined;
      case 'ads_wallet':
        return selected
            ? Icons.account_balance_wallet
            : Icons.account_balance_wallet_outlined;
      case 'ads_receipts':
        return selected ? Icons.receipt_long : Icons.receipt_long_outlined;
      case 'ads_transactions':
        return selected ? Icons.list_alt : Icons.list_alt_outlined;
      case 'ads_transfer':
        return selected
            ? Icons.account_balance
            : Icons.account_balance_outlined;
      default:
        return selected ? Icons.dashboard : Icons.dashboard_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final bell = widget.accessToken.trim().isNotEmpty
        ? NotificationBellButton(
            accessToken: widget.accessToken,
            onNavigateHref: (href) {
              navigateNotificationHref(
                context,
                href: href,
                accessToken: widget.accessToken,
              );
            },
          )
        : null;
    if (_loading) {
      return Scaffold(
        appBar: AppBar(
          actions: [
            if (bell != null) bell,
            const ThemeToggleButton(),
          ],
        ),
        body: const ShellNavSkeleton(),
      );
    }
    if (_tabs.isEmpty) {
      return Scaffold(
        appBar: AppBar(
          actions: [
            if (bell != null) bell,
            const ThemeToggleButton(),
          ],
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              _navUnavailable,
              textAlign: TextAlign.center,
              style: TextStyle(color: tokens.danger),
            ),
          ),
        ),
      );
    }
    final current = _tabs[_index.clamp(0, _tabs.length - 1)];
    return Scaffold(
      appBar: AppBar(
        title: _brandName.isNotEmpty
            ? DamaBrandTitle(title: _brandName, markSize: 26)
            : Text(current.title),
        actions: [
          if (bell != null) bell,
          const ThemeToggleButton(),
        ],
      ),
      body: _pageFor(current.routeKey),
      bottomNavigationBar: ScrollablePortalBottomNav(
        selectedIndex: _index.clamp(0, _tabs.length - 1),
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          for (final tab in _tabs)
            NavigationDestination(
              icon: Icon(_iconFor(tab.routeKey, selected: false)),
              selectedIcon: Icon(_iconFor(tab.routeKey, selected: true)),
              label: tab.title,
            ),
        ],
      ),
    );
  }
}
