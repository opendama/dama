import 'dart:convert';

import 'package:dama_mobile/core/nav/manual_transfer_nav.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/theme/theme_toggle_button.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/scrollable_portal_bottom_nav.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/features/events/analytics_page.dart';
import 'package:dama_mobile/features/events/community_player_chrome_soft.dart';
import 'package:dama_mobile/features/events/dashboard_page.dart';
import 'package:dama_mobile/features/events/events_page.dart';
import 'package:dama_mobile/features/events/hosting_organizer_chrome_soft.dart';
import 'package:dama_mobile/features/events/join_event_page.dart';
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

/// Events organizer shell: tabs only from `client_nav.bottom_nav.events` (DB, fail closed).
class EventsShell extends StatefulWidget {
  const EventsShell({
    super.key,
    required this.accessToken,
    this.initialRouteKey = 'events_dashboard',
    this.initialJoinCode,
    this.initialEventId,
    this.initialOpenCreate = false,
    this.initialMoneyFocusId,
    this.focusPayout = false,
    this.focusTopUp = false,
    this.focusPayoutHistoryId,
  });

  final String accessToken;
  final String initialRouteKey;
  final String? initialJoinCode;

  /// Notification deep-link: open manage for this event on the list tab.
  final String? initialEventId;

  /// Host CTA `?create=1` - open create flow on the list tab.
  final bool initialOpenCreate;

  /// Receipt deep-link focus (wallet/receipts money paths only).
  final String? initialMoneyFocusId;

  /// Wallet deep-link: scroll/highlight payout request section.
  final bool focusPayout;

  /// Wallet deep-link `?focus=topup`: open top-up sheet.
  final bool focusTopUp;

  /// Wallet deep-link `?id=`: seek/highlight payout history row.
  final String? focusPayoutHistoryId;

  @override
  State<EventsShell> createState() => _EventsShellState();
}

class _EventsShellState extends State<EventsShell> {
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
        // Fail closed: no invented English; keep skeleton until chrome can explain.
        if (mounted) {
          setState(() {
            _tabs = const [];
            _navUnavailable = '';
            _loading = false;
          });
        }
        return;
      }
      final payload = ClientNavPayload.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      final unavailable = payload.eventsNavUnavailable.isNotEmpty
          ? payload.eventsNavUnavailable
          : payload.mobileNavUnavailable;
      if (!isEventsBottomNavReady(payload)) {
        if (!mounted) return;
        setState(() {
          _tabs = const [];
          _brandName = '';
          _navUnavailable = unavailable;
          _loading = false;
        });
        return;
      }
      // Hosting = manage only; never show legacy public browse as a Hosting tab.
      // Soft-replace Event-sport brand + dashboard title (web SurfaceHomeLink / pickHostingNavLinks parity).
      final brand = softHostingBrandName(payload.eventsBrandName);
      final brandOk = brand.isNotEmpty &&
          !RegExp(r'\bevents?\b', caseSensitive: false).hasMatch(brand);
      final eventSport = RegExp(r'\bevents?\b', caseSensitive: false);
      final events = payload.bottomNav.events.where((l) {
        final key = l.routeKey.trim();
        if (key == 'events_public' || key == 'events') return false;
        final href = (l.href ?? '').trim();
        final path = href.split('?').first;
        if (path == '/events/public' || path.startsWith('/events/public/')) {
          return false;
        }
        return true;
      }).map((l) {
        final key = l.routeKey.trim();
        final title = l.title.trim();
        // Mig 378 exact soft-fills + events_dashboard brand (web pickHostingNavLinks parity).
        String? nextTitle;
        if (key == 'events_dashboard' &&
            brandOk &&
            eventSport.hasMatch(title)) {
          nextTitle = brand;
        } else if (key == 'events_list' &&
            (title == 'My events' ||
                title == 'Events' ||
                title == 'Event' ||
                title.toLowerCase() == 'my events' ||
                title.toLowerCase() == 'events' ||
                title.toLowerCase() == 'event')) {
          nextTitle = 'My hosted tournaments';
        } else if (key == 'events_join') {
          // softCommunityJoinTitle: Join / Join event / Events → Join with code (panel parity).
          final softJoin = softCommunityJoinTitle(title);
          if (softJoin != title) nextTitle = softJoin;
        } else if (key == 'events_analytics' && eventSport.hasMatch(title)) {
          nextTitle = softHostingAnalyticsTitle(title);
        }
        if (nextTitle == null) return l;
        return ClientNavLink(
          title: nextTitle,
          routeKey: l.routeKey,
          href: l.href,
          body: l.body,
          bodyWhenVsAi: l.bodyWhenVsAi,
          cta: l.cta,
        );
      }).toList();
      final isManual = await fetchIsManualTransferRoute();
      final filtered = filterManualTransferNavLinks(events, isManual);
      var idx =
          filtered.indexWhere((l) => l.routeKey == widget.initialRouteKey);
      if (idx < 0 &&
          (widget.initialRouteKey == 'events' ||
              widget.initialRouteKey == 'events_dashboard')) {
        idx = filtered.indexWhere((l) => l.routeKey == 'events_dashboard');
      }
      if (idx < 0 && (widget.initialJoinCode ?? '').trim().isNotEmpty) {
        idx = filtered.indexWhere((l) => l.routeKey == 'events_join');
      }
      if (!mounted) return;
      setState(() {
        _tabs = filtered;
        _brandName = brand;
        // Filtered-empty Hosting still uses DB unavailable (never invent copy).
        _navUnavailable = unavailable;
        _index = idx >= 0 ? idx : 0;
        _loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _tabs = const [];
          _brandName = '';
          _navUnavailable = '';
          _loading = false;
        });
      }
    }
  }

  /// Money portal prefix from DB bottom_nav wallet/receipts/transactions hrefs.
  String _moneyBasePath() {
    for (final key in const [
      'events_wallet',
      'events_receipts',
      'events_transactions',
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
      case 'events_list':
        return EventsPage(
          accessToken: widget.accessToken,
          initialEventId: widget.initialEventId,
          initialOpenCreate: widget.initialOpenCreate,
        );
      case 'events_analytics':
        return EventsAnalyticsPage(accessToken: widget.accessToken);
      case 'events_join':
        return JoinEventPage(
          accessToken: widget.accessToken,
          initialCode: widget.initialJoinCode,
        );
      case 'events_wallet':
        return WalletPage(
          token: widget.accessToken,
          showOrganizerPayoutBlurb: true,
          moneyBasePath: _moneyBasePath(),
          focusPayout: widget.focusPayout,
          focusTopUp: widget.focusTopUp,
          focusPayoutHistoryId: widget.focusPayoutHistoryId,
        );
      case 'events_receipts':
        return ReceiptsPage(
          accessToken: widget.accessToken,
          focusId: widget.initialMoneyFocusId,
        );
      case 'events_transactions':
        return TransactionsPage(
          accessToken: widget.accessToken,
          focusId: widget.initialMoneyFocusId,
        );
      case 'events_transfer':
        return ManualTransferPage(
          accessToken: widget.accessToken,
          moneyBasePath: _moneyBasePath(),
        );
      case 'events_dashboard':
      default:
        return EventsDashboardPage(accessToken: widget.accessToken);
    }
  }

  IconData _iconFor(String routeKey, {required bool selected}) {
    switch (routeKey) {
      case 'events_list':
        // Trophy = Tournament parity (not calendar Event sport).
        return selected ? Icons.emoji_events : Icons.emoji_events_outlined;
      case 'events_analytics':
        return selected ? Icons.analytics : Icons.analytics_outlined;
      case 'events_join':
        return selected ? Icons.qr_code : Icons.qr_code_outlined;
      case 'events_wallet':
        return selected
            ? Icons.account_balance_wallet
            : Icons.account_balance_wallet_outlined;
      case 'events_receipts':
        return selected ? Icons.receipt_long : Icons.receipt_long_outlined;
      case 'events_transactions':
        return selected ? Icons.list_alt : Icons.list_alt_outlined;
      case 'events_transfer':
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
        // Prefer DB unavailable chrome; otherwise keep skeleton (no invented English).
        body: _navUnavailable.isNotEmpty
            ? Center(
                child: Padding(
                  padding: EdgeInsets.zero,
                  child: Text(
                    softHostingChromeUnavailable(_navUnavailable),
                    textAlign: TextAlign.center,
                    style: TextStyle(color: tokens.danger),
                  ),
                ),
              )
            : const ShellNavSkeleton(),
      );
    }
    final selected = _index.clamp(0, _tabs.length - 1);
    final current = _tabs[selected];
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
      // Keep tab bodies mounted so organizer list skip/scroll survive tab switches
      // (SkipStore still covers process restart / cold open).
      body: IndexedStack(
        index: selected,
        children: [
          for (final tab in _tabs) _pageFor(tab.routeKey),
        ],
      ),
      bottomNavigationBar: ScrollablePortalBottomNav(
        selectedIndex: selected,
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
