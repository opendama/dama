import 'package:dama_mobile/features/ads/publisher_shell.dart';
import 'package:dama_mobile/features/app/not_found_page.dart';
import 'package:dama_mobile/features/events/events_shell.dart';
import 'package:dama_mobile/features/game/match_board_page.dart';
import 'package:dama_mobile/features/game/matchmaking_page.dart';
import 'package:dama_mobile/features/game/spectate_page.dart';
import 'package:dama_mobile/features/home/dashboard_page.dart';
import 'package:dama_mobile/features/home/home_page.dart';
import 'package:dama_mobile/features/home/player_shell_controller.dart';
import 'package:dama_mobile/features/profile/profile_page.dart';
import 'package:dama_mobile/features/wallet/manual_transfer_page.dart';
import 'package:dama_mobile/features/wallet/receipts_page.dart';
import 'package:dama_mobile/features/wallet/transactions_page.dart';
import 'package:dama_mobile/features/wallet/wallet_page.dart';
import 'package:flutter/material.dart';

/// Maps web-style notification hrefs to Flutter routes (Trim deep-link parity).
///
/// Tournament discovery (`/?view=tournaments`, legacy `view=events`, `/events/public`)
/// is guest-safe (shell tab; join/host still sign-in inside the hub). Auth-gated
/// surfaces (wallet, Hosting portal, match board, …) still require [accessToken].
Future<void> navigateNotificationHref(
  BuildContext context, {
  required String href,
  required String accessToken,
}) async {
  final raw = href.trim();
  if (!raw.startsWith('/') || raw.startsWith('//')) return;

  final uri = Uri.tryParse(raw);
  if (uri == null) return;
  final path = uri.path.isEmpty ? '/' : uri.path;
  final view = (uri.queryParameters['view'] ?? '').trim().toLowerCase();
  final rail = (uri.queryParameters['rail'] ?? '').trim().toLowerCase();
  final sub = (uri.queryParameters['sub'] ?? '').trim().toLowerCase();
  final gameId = (uri.queryParameters['gameId'] ?? '').trim();
  final focusId = (uri.queryParameters['id'] ?? '').trim();
  final focusParam = (uri.queryParameters['focus'] ?? '').trim().toLowerCase();
  final focusPayoutQuery = focusParam == 'payout';
  final focusTopUpQuery = focusParam == 'topup';
  final eventCode = (uri.queryParameters['code'] ?? '').trim();
  final sourceRaw = (uri.queryParameters['source'] ?? '').trim().toLowerCase();

  if (!context.mounted) return;

  // Guest-safe Tournament discovery → shell tab (web Official|Community|All parity).
  // Must run before the empty-token gate so join-page Community CTA / invite
  // `/events/join` works for guests (signed-in Hosting Join tab is EventsShell).
  final isCommunityDiscovery = view == 'events' ||
      path.contains('/events/public') ||
      path.contains('/events/join') ||
      (view == 'tournaments' && sourceRaw == 'community');
  final isTournamentDiscovery = view == 'tournaments' ||
      path == '/tournaments' ||
      path.startsWith('/tournaments/');
  if (isCommunityDiscovery || isTournamentDiscovery) {
    final source = isCommunityDiscovery
        ? 'community'
        : ((sourceRaw == 'official' ||
                sourceRaw == 'community' ||
                sourceRaw == 'all')
            ? sourceRaw
            : (eventCode.isNotEmpty ? 'community' : 'all'));
    PlayerShellController.instance.openTournaments(
      source: source,
      focusId: focusId.isNotEmpty ? focusId : null,
      joinCode: eventCode.isNotEmpty ? eventCode : null,
    );
    if (context.mounted) {
      Navigator.of(context).popUntil((route) => route.isFirst);
    }
    return;
  }

  final token = accessToken.trim();
  if (token.isEmpty) return;

  final Widget page;
  if (gameId.isNotEmpty &&
      (path == '/' || path.isEmpty) &&
      view != 'spectate') {
    page = MatchBoardPage(accessToken: token, gameId: gameId, mode: 'pvp');
  } else if (view == 'spectate') {
    page = SpectatePage(
      accessToken: token,
      initialGameId: gameId.isNotEmpty ? gameId : null,
    );
  } else if (path == '/wallet' || path.startsWith('/wallet')) {
    page = WalletPage(
      token: token,
      focusPayout: focusPayoutQuery && focusId.isEmpty,
      focusTopUp: focusTopUpQuery && focusId.isEmpty && !focusPayoutQuery,
      focusPayoutHistoryId: focusId.isNotEmpty ? focusId : null,
    );
  } else if (path == '/transfer' || path.startsWith('/transfer/')) {
    page = ManualTransferPage(
      accessToken: token,
      initialAmount: (uri.queryParameters['amount'] ?? '').trim(),
      intentId: (uri.queryParameters['intent_id'] ?? '').trim(),
    );
  } else if (path == '/receipts') {
    page = ReceiptsPage(
      accessToken: token,
      focusId: focusId.isNotEmpty ? focusId : null,
    );
  } else if (path == '/transactions' || path.startsWith('/transactions')) {
    page = TransactionsPage(
      accessToken: token,
      focusId: focusId.isNotEmpty ? focusId : null,
    );
  } else if (path == '/dashboard') {
    page = DashboardPage(accessToken: token);
  } else if (path == '/settings' || path == '/profile') {
    page = ProfilePage(accessToken: token);
  } else if (path.startsWith('/ads')) {
    String routeKey = 'ads_dashboard';
    if (path.contains('campaign')) {
      routeKey = 'ads_campaigns';
    } else if (path.contains('analytics')) {
      routeKey = 'ads_analytics';
    } else if (path.contains('wallet')) {
      routeKey = 'ads_wallet';
    } else if (path.contains('receipt')) {
      routeKey = 'ads_receipts';
    } else if (path.contains('transaction')) {
      routeKey = 'ads_transactions';
    } else if (path.contains('transfer')) {
      routeKey = 'ads_transfer';
    }
    final moneyRoute = routeKey == 'ads_wallet' ||
        routeKey == 'ads_receipts' ||
        routeKey == 'ads_transactions' ||
        routeKey == 'ads_transfer';
    page = PublisherShell(
      accessToken: token,
      initialRouteKey: routeKey,
      initialCampaignId: !moneyRoute && focusId.isNotEmpty ? focusId : null,
      initialMoneyFocusId:
          (routeKey == 'ads_receipts' || routeKey == 'ads_transactions') &&
                  focusId.isNotEmpty
              ? focusId
              : null,
      focusPayout:
          routeKey == 'ads_wallet' && focusPayoutQuery && focusId.isEmpty,
      focusTopUp: routeKey == 'ads_wallet' &&
          focusTopUpQuery &&
          focusId.isEmpty &&
          !focusPayoutQuery,
      focusPayoutHistoryId:
          routeKey == 'ads_wallet' && focusId.isNotEmpty ? focusId : null,
    );
  } else if (path.startsWith('/events')) {
    // Organizer Hosting portal (auth): /events/events?create=1, list, wallet, …
    String routeKey = 'events_dashboard';
    // Canonical list is /events/events (mig 225); /events/list remains an alias.
    if (path.contains('/events/events') ||
        path.endsWith('/events/list') ||
        path.contains('/list')) {
      routeKey = 'events_list';
    } else if (path.contains('/analytics')) {
      routeKey = 'events_analytics';
    } else if (path.contains('/wallet')) {
      routeKey = 'events_wallet';
    } else if (path.contains('/receipt')) {
      routeKey = 'events_receipts';
    } else if (path.contains('/transaction')) {
      routeKey = 'events_transactions';
    } else if (path.contains('/transfer')) {
      routeKey = 'events_transfer';
    } else if (path.contains('/join') || eventCode.isNotEmpty) {
      routeKey = 'events_join';
    }
    final moneyRoute = routeKey == 'events_wallet' ||
        routeKey == 'events_receipts' ||
        routeKey == 'events_transactions' ||
        routeKey == 'events_transfer';
    final openCreate = (uri.queryParameters['create'] ?? '').trim() == '1';
    page = EventsShell(
      accessToken: token,
      initialRouteKey: routeKey,
      initialJoinCode: eventCode.isNotEmpty ? eventCode : null,
      initialEventId: !moneyRoute && focusId.isNotEmpty ? focusId : null,
      initialOpenCreate: openCreate && routeKey == 'events_list',
      initialMoneyFocusId: (routeKey == 'events_receipts' ||
                  routeKey == 'events_transactions') &&
              focusId.isNotEmpty
          ? focusId
          : null,
      focusPayout:
          routeKey == 'events_wallet' && focusPayoutQuery && focusId.isEmpty,
      focusTopUp: routeKey == 'events_wallet' &&
          focusTopUpQuery &&
          focusId.isEmpty &&
          !focusPayoutQuery,
      focusPayoutHistoryId:
          routeKey == 'events_wallet' && focusId.isNotEmpty ? focusId : null,
    );
  } else if (rail == 'players' || rail == 'games' || rail == 'new') {
    // Friend-request / players deep-links: replace stack so embedded AI cannot
    // block the rail (web clears aiLive when rail=* is present).
    final dm = (uri.queryParameters['dm'] ?? '').trim();
    final thread = (uri.queryParameters['thread'] ?? '').trim();
    final home = HomePage(
      launchUri: Uri(
        path: '/',
        queryParameters: {
          'rail': rail,
          if (sub.isNotEmpty) 'sub': sub,
          if (dm.isNotEmpty) 'dm': dm,
          if (thread.isNotEmpty) 'thread': thread,
        },
      ),
    );
    await Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => home),
      (route) => false,
    );
    return;
  } else if (view == 'match') {
    page = MatchmakingPage(token: token);
  } else {
    page = NotFoundPage(
      onHome: () {
        Navigator.of(context).popUntil((route) => route.isFirst);
      },
    );
  }

  await Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));
}
