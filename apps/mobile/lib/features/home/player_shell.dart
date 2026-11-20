import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/nav/manual_transfer_nav.dart';
import 'package:dama_mobile/core/nav/player_nav.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/prefs/play_session_store.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/features/ads/publisher_shell.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/auth/auth_providers.dart';
import 'package:dama_mobile/features/auth/sign_in_dialog.dart';
import 'package:dama_mobile/features/events/community_player_chrome_soft.dart';
import 'package:dama_mobile/features/events/events_shell.dart';
import 'package:dama_mobile/features/game/game_lobby_page.dart';
import 'package:dama_mobile/features/game/matchmaking_page.dart';
import 'package:dama_mobile/features/game/spectate_page.dart';
import 'package:dama_mobile/features/home/dashboard_page.dart';
import 'package:dama_mobile/features/home/home_page.dart';
import 'package:dama_mobile/features/home/platform_stats_page.dart';
import 'package:dama_mobile/features/home/player_shell_controller.dart';
import 'package:dama_mobile/features/home/player_shell_rail_access.dart';
import 'package:dama_mobile/features/leaderboard/leaderboard_page.dart';
import 'package:dama_mobile/features/legal/legal_page.dart';
import 'package:dama_mobile/features/profile/avatar_page.dart';
import 'package:dama_mobile/features/profile/profile_page.dart';
import 'package:dama_mobile/features/tournaments/tournaments_page.dart';
import 'package:dama_mobile/features/wallet/manual_transfer_page.dart';
import 'package:dama_mobile/features/wallet/wallet_page.dart';
import 'package:dama_mobile/widgets/dama_brand_mark.dart';
import 'package:dama_mobile/widgets/player_desktop_rail_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;

/// Player shell: bottom tabs (phone) + desktop-rail mirror (tablet rail / phone sheet).
class PlayerShell extends StatefulWidget {
  const PlayerShell({super.key});

  @override
  State<PlayerShell> createState() => _PlayerShellState();
}

class _PlayerShellState extends State<PlayerShell> {
  List<ClientNavLink> _tabs = const [];
  List<ClientNavLink> _railLinks = const [];
  String _brandName = '';
  String _navUnavailable = '';
  int _index = 0;
  bool _loading = true;
  PlayChrome? _playChrome;

  /// Deep-link / notif params for the Tournaments tab (web active-nav parity).
  String? _tourSource;
  String? _tourFocusId;
  String? _tourJoinCode;
  int _tourEpoch = 0;

  @override
  void initState() {
    super.initState();
    PlayerShellController.instance.addListener(_onShellController);
    _loadNav();
    unawaited(PlaySessionStore.instance.ensureLoaded());
    unawaited(_loadPlayChrome());
  }

  Future<void> _loadPlayChrome() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/public/play-chrome'),
      );
      if (res.statusCode >= 300) return;
      final decoded = jsonDecode(res.body);
      if (decoded is! Map<String, dynamic>) return;
      final chrome = PlayChrome.fromJson(decoded);
      if (!mounted || chrome == null) return;
      setState(() => _playChrome = chrome);
    } catch (_) {}
  }

  bool _sessionPaused() {
    final session = PlaySessionStore.instance.session;
    return session != null && session.phase == 'playing' && session.paused;
  }

  String _destinationLabel(ClientNavLink link) {
    final key = link.routeKey.trim();
    if (key != 'play' && key != 'home') return link.title;
    if (!_sessionPaused()) return link.title;
    final session = PlaySessionStore.instance.session;
    if (session != null && session.isOfficialPause) {
      final official = (_playChrome?.pauseKindOfficial ?? '').trim();
      if (official.isNotEmpty) return official;
    }
    final pausedLabel = (_playChrome?.navPausedLabel ?? '').trim();
    if (pausedLabel.isEmpty) return link.title;
    return pausedLabel;
  }

  @override
  void dispose() {
    PlayerShellController.instance.removeListener(_onShellController);
    super.dispose();
  }

  void _onShellController() {
    final c = PlayerShellController.instance;
    final key = (c.routeKey ?? '').trim();
    if (key != 'tournaments' && key != 'home') return;
    if (!mounted) return;
    void apply() {
      if (key == 'home') {
        final i = _tabs.indexWhere((t) {
          final rk = t.routeKey.trim();
          return rk == 'home' || rk == 'play';
        });
        if (i < 0) return;
        setState(() {
          _index = i;
          _tourSource = null;
          _tourFocusId = null;
          _tourJoinCode = null;
          _tourEpoch = c.epoch;
        });
        return;
      }
      final i = _tabs.indexWhere((t) => t.routeKey.trim() == 'tournaments');
      if (i < 0) return;
      setState(() {
        _index = i;
        _tourSource = c.tournamentsSource;
        _tourFocusId = c.tournamentsFocusId;
        _tourJoinCode = c.tournamentsJoinCode;
        _tourEpoch = c.epoch;
      });
    }

    if (_loading || _tabs.isEmpty) {
      // Nav still loading - apply after tabs arrive via _loadNav + listener retry.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) apply();
      });
      return;
    }
    apply();
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
      if (!isMobileBottomNavReady(payload)) {
        if (!mounted) return;
        setState(() {
          _tabs = const [];
          _railLinks = const [];
          _brandName = '';
          _navUnavailable = payload.mobileNavUnavailable;
          _loading = false;
        });
        return;
      }
      if (!mounted) return;
      // Web pickBottomNavLinks parity: primary play loop only (drop stale Events browse).
      final raw = payload.bottomNav.mobile;
      final byKey = <String, ClientNavLink>{
        for (final l in raw) l.routeKey.trim(): l,
      };
      const primaryKeys = ['play', 'matchmaking', 'tournaments', 'spectate'];
      final primary = <ClientNavLink>[
        for (final k in primaryKeys)
          if (byKey[k] != null) byKey[k]!,
      ];
      // Fallback: never keep legacy Events browse beside Tournaments (web filterPlayerNavLinks parity).
      final filtered = primary.length >= 3
          ? primary
          : raw.where((l) {
              final k = l.routeKey.trim();
              if (k == 'events' || k == 'events_public') return false;
              final path = (l.href ?? '').trim().split('?').first;
              if (path == '/events/public' ||
                  path.startsWith('/events/public/')) {
                return false;
              }
              return true;
            }).toList();
      // Web mapPlayerNavDisplayTitles parity - Tournaments tab Event-sport fail-open.
      final tabs = filtered.map((l) {
        if (l.routeKey.trim() != 'tournaments') return l;
        final next = softTournamentsPageTitle(l.title);
        if (next == l.title) return l;
        return ClientNavLink(
          title: next,
          routeKey: l.routeKey,
          href: l.href,
          body: l.body,
          bodyWhenVsAi: l.bodyWhenVsAi,
          cta: l.cta,
        );
      }).toList();
      final isManual = await fetchIsManualTransferRoute();
      final rail = filterManualTransferNavLinks(
        pickDesktopRailLinks(payload),
        isManual,
      );
      if (!mounted) return;
      setState(() {
        _tabs = tabs;
        _railLinks = rail;
        _brandName = payload.brandName.trim();
        _navUnavailable = payload.mobileNavUnavailable;
        _loading = false;
      });
      // Apply any deep-link that arrived before tabs were ready.
      _onShellController();
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<String?> _ensureToken() async {
    final auth = context.read<AuthCubit>().state;
    if (auth.isAuthenticated) return auth.token;
    return showSignInDialog(context);
  }

  IconData _iconFor(String routeKey, {required bool selected}) {
    switch (routeKey) {
      case 'home':
      case 'dashboard':
        return selected ? Icons.home : Icons.home_outlined;
      case 'play':
        return selected ? Icons.sports_esports : Icons.sports_esports_outlined;
      case 'matchmaking':
        return selected ? Icons.people : Icons.people_outline;
      case 'spectate':
        return selected ? Icons.visibility : Icons.visibility_outlined;
      case 'leaderboard':
        return selected ? Icons.leaderboard : Icons.leaderboard_outlined;
      case 'status':
      case 'platform_stats':
        return selected ? Icons.insights : Icons.insights_outlined;
      case 'tournaments':
        // Cup discovery (trophy) - distinct from rankings.
        return selected ? Icons.emoji_events : Icons.emoji_events_outlined;
      case 'tournaments_mine':
        return selected ? Icons.view_list : Icons.view_list_outlined;
      case 'host_tournament':
        return selected ? Icons.add_circle : Icons.add_circle_outline;
      case 'wallet':
        return selected
            ? Icons.account_balance_wallet
            : Icons.account_balance_wallet_outlined;
      case 'transfer':
        return selected
            ? Icons.account_balance
            : Icons.account_balance_outlined;
      case 'profile':
        return selected ? Icons.person : Icons.person_outline;
      case 'avatar':
        return selected ? Icons.face : Icons.face_outlined;
      case 'ads':
      case 'ads_dashboard':
      case 'ads_publisher':
      case 'ads_campaigns':
        return selected ? Icons.campaign : Icons.campaign_outlined;
      case 'ads_analytics':
        return selected ? Icons.analytics : Icons.analytics_outlined;
      case 'events':
      case 'events_dashboard':
      case 'events_list':
      case 'events_join':
        // Trophy = Tournament parity (not calendar Event sport).
        return selected ? Icons.emoji_events : Icons.emoji_events_outlined;
      case 'events_analytics':
        return selected ? Icons.analytics : Icons.analytics_outlined;
      case 'privacy':
        return selected ? Icons.privacy_tip : Icons.privacy_tip_outlined;
      case 'terms':
        return selected ? Icons.gavel : Icons.gavel_outlined;
      case 'refunds':
        return selected ? Icons.receipt_long : Icons.receipt_long_outlined;
      default:
        return selected ? Icons.circle : Icons.circle_outlined;
    }
  }

  Widget _pageFor(String routeKey, String? token) {
    switch (routeKey) {
      case 'play':
        return const GameLobbyPage();
      case 'matchmaking':
        if (token == null || token.isEmpty) {
          return const _AuthRequiredPlaceholder();
        }
        return MatchmakingPage(token: token);
      case 'spectate':
        return SpectatePage(accessToken: token);
      case 'leaderboard':
        return LeaderboardPage();
      case 'status':
      case 'platform_stats':
        return PlatformStatsPage();
      case 'tournaments':
        // Guest browse parity with web Official|Community|All; Host CTA owns sign-in→create.
        // Keyed by epoch so deep-link focusId/source remount cleanly.
        return TournamentsPage(
          key: ValueKey<int>(_tourEpoch),
          accessToken: token ?? '',
          initialSource: _tourSource ?? 'all',
          focusId: _tourFocusId,
          initialJoinCode: _tourJoinCode,
        );
      case 'wallet':
        if (token == null || token.isEmpty) {
          return const _AuthRequiredPlaceholder();
        }
        return WalletPage(token: token);
      case 'profile':
        if (token == null || token.isEmpty) {
          return const _AuthRequiredPlaceholder();
        }
        return ProfilePage(accessToken: token);
      case 'avatar':
        if (token == null || token.isEmpty) {
          return const _AuthRequiredPlaceholder();
        }
        return AvatarPage(accessToken: token);
      case 'ads':
      case 'ads_dashboard':
      case 'ads_publisher':
        if (token == null || token.isEmpty) {
          return const _AuthRequiredPlaceholder();
        }
        return PublisherShell(accessToken: token);
      case 'ads_campaigns':
        if (token == null || token.isEmpty) {
          return const _AuthRequiredPlaceholder();
        }
        return PublisherShell(
          accessToken: token,
          initialRouteKey: 'ads_campaigns',
        );
      case 'ads_analytics':
        if (token == null || token.isEmpty) {
          return const _AuthRequiredPlaceholder();
        }
        return PublisherShell(
          accessToken: token,
          initialRouteKey: 'ads_analytics',
        );
      case 'events':
        // Unified discovery: Community tab under Tournaments (no second sport).
        return TournamentsPage(
          accessToken: token ?? '',
          initialSource: 'community',
        );
      case 'events_dashboard':
        if (token == null || token.isEmpty) {
          return const _AuthRequiredPlaceholder();
        }
        return EventsShell(accessToken: token);
      case 'events_list':
        if (token == null || token.isEmpty) {
          return const _AuthRequiredPlaceholder();
        }
        return EventsShell(
          accessToken: token,
          initialRouteKey: 'events_list',
        );
      case 'events_analytics':
        if (token == null || token.isEmpty) {
          return const _AuthRequiredPlaceholder();
        }
        return EventsShell(
          accessToken: token,
          initialRouteKey: 'events_analytics',
        );
      case 'events_join':
        if (token == null || token.isEmpty) {
          return const _AuthRequiredPlaceholder();
        }
        return EventsShell(
          accessToken: token,
          initialRouteKey: 'events_join',
        );
      case 'privacy':
        return LegalPage(kind: LegalDocKind.privacy);
      case 'terms':
        return LegalPage(kind: LegalDocKind.terms);
      case 'refunds':
        return LegalPage(kind: LegalDocKind.refunds);
      case 'dashboard':
        if (token == null || token.isEmpty) {
          return const _AuthRequiredPlaceholder();
        }
        return DashboardPage(accessToken: token);
      case 'home':
      default:
        return const HomePage();
    }
  }

  Future<void> _onDestinationSelected(int i) async {
    if (i < 0 || i >= _tabs.length) return;
    final key = _tabs[i].routeKey;
    if (key == 'privacy') {
      openLegalPage(context, LegalDocKind.privacy);
      return;
    }
    if (key == 'terms') {
      openLegalPage(context, LegalDocKind.terms);
      return;
    }
    if (key == 'refunds') {
      openLegalPage(context, LegalDocKind.refunds);
      return;
    }
    const authKeys = {
      'dashboard',
      'matchmaking',
      // tournaments: guest browse + Host CTA sign-in (web parity); Hosting portal stays gated.
      'wallet',
      'profile',
      'avatar',
      'ads',
      'ads_dashboard',
      'ads_publisher',
      'ads_campaigns',
      'ads_analytics',
      'events_dashboard',
      'events_list',
      'events_analytics',
      'events_join',
    };
    if (authKeys.contains(key)) {
      final token = await _ensureToken();
      if (!mounted) return;
      if (token == null) return;
    }
    setState(() => _index = i);
  }

  void _openRailMenu() {
    if (_railLinks.isEmpty) return;
    final selected = _tabs.isEmpty
        ? null
        : _tabs[_index.clamp(0, _tabs.length - 1)].routeKey;
    unawaited(
      showPlayerDesktopRailSheet(
        context: context,
        brandName: _brandName,
        links: _railLinks,
        selectedRouteKey: selected,
        onSelect: _openRailLink,
      ),
    );
  }

  Future<void> _openRailLink(ClientNavLink link) async {
    final key = link.routeKey.trim();
    if (key.isEmpty) return;
    // Prefer switching an existing bottom tab (web rail → same surface).
    final tabIdx = _tabs.indexWhere((t) => t.routeKey.trim() == key);
    if (tabIdx >= 0) {
      await _onDestinationSelected(tabIdx);
      return;
    }
    if (key == 'tournaments_mine') {
      PlayerShellController.instance.openTournaments(source: 'all');
      final i = _tabs.indexWhere((t) => t.routeKey.trim() == 'tournaments');
      if (i >= 0) setState(() => _index = i);
      return;
    }
    if (key == 'host_tournament') {
      final hostToken = await _ensureToken();
      if (!mounted || hostToken == null || hostToken.isEmpty) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => EventsShell(
            accessToken: hostToken,
            initialRouteKey: 'events_list',
            initialOpenCreate: true,
          ),
        ),
      );
      return;
    }
    if (key == 'transfer') {
      final tok = await _ensureToken();
      if (!mounted || tok == null || tok.isEmpty) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ManualTransferPage(accessToken: tok),
        ),
      );
      return;
    }
    if (key == 'wallet') {
      final tok = await _ensureToken();
      if (!mounted || tok == null || tok.isEmpty) return;
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => WalletPage(token: tok)),
      );
      return;
    }
    if (key == 'ads_publisher' || key == 'ads' || key == 'ads_dashboard') {
      final tok = await _ensureToken();
      if (!mounted || tok == null || tok.isEmpty) return;
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => PublisherShell(accessToken: tok)),
      );
      return;
    }
    if (key == 'leaderboard') {
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => LeaderboardPage()),
      );
      return;
    }
    if (key == 'status' || key == 'platform_stats') {
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => PlatformStatsPage()),
      );
      return;
    }
    if (key == 'spectate') {
      final tok = context.read<AuthCubit>().state.token;
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => SpectatePage(accessToken: tok)),
      );
      return;
    }
    if (key == 'matchmaking') {
      final tok = await _ensureToken();
      if (!mounted || tok == null) return;
      final i = _tabs.indexWhere((t) => t.routeKey.trim() == 'matchmaking');
      if (i >= 0) {
        setState(() => _index = i);
        return;
      }
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => MatchmakingPage(token: tok)),
      );
      return;
    }
    if (key == 'play' || key == 'home') {
      final i = _tabs.indexWhere((t) {
        final rk = t.routeKey.trim();
        return rk == 'play' || rk == 'home';
      });
      if (i >= 0) setState(() => _index = i);
      return;
    }
  }

  Widget _buildWideRail(int selectedRailIndex) {
    return NavigationRail(
      selectedIndex: selectedRailIndex < 0 ? null : selectedRailIndex,
      onDestinationSelected: (i) {
        if (i < 0 || i >= _railLinks.length) return;
        unawaited(_openRailLink(_railLinks[i]));
      },
      labelType: NavigationRailLabelType.all,
      leading: Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: _brandName.isNotEmpty
            ? DamaBrandTitle(title: _brandName, markSize: 26)
            : const DamaBrandMark(size: 26),
      ),
      destinations: [
        for (final link in _railLinks)
          NavigationRailDestination(
            icon: Icon(_iconFor(link.routeKey, selected: false)),
            selectedIcon: Icon(_iconFor(link.routeKey, selected: true)),
            label: Text(_destinationLabel(link)),
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    if (_loading) {
      return const Scaffold(body: ShellNavSkeleton());
    }
    if (_tabs.isEmpty) {
      return Scaffold(
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
    return ListenableBuilder(
      listenable: PlaySessionStore.instance,
      builder: (context, _) {
        return BlocBuilder<AuthCubit, AuthState>(
          builder: (context, auth) {
            final token = auth.isAuthenticated ? auth.token : null;
            final idx = _index.clamp(0, _tabs.length - 1);
            final current = _tabs[idx];
            final selectedRail = _railLinks.indexWhere(
              (l) => l.routeKey.trim() == current.routeKey.trim(),
            );
            return PlayerShellRailAccess(
              openRailMenu: _openRailMenu,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final wide =
                      constraints.maxWidth >= 720 && _railLinks.isNotEmpty;
                  // IndexedStack keep-alive (web HomePlayHub boardsKeepAlive parity):
                  // tab switches must not remount play/spectate/matchmaking boards.
                  final body = IndexedStack(
                    index: idx,
                    sizing: StackFit.expand,
                    children: [
                      for (final tab in _tabs)
                        KeyedSubtree(
                          key: ValueKey<String>('shell-tab-${tab.routeKey}'),
                          child: _pageFor(tab.routeKey, token),
                        ),
                    ],
                  );
                  final scaffold = wide
                      ? Scaffold(
                          body: Row(
                            children: [
                              _buildWideRail(selectedRail),
                              const VerticalDivider(width: 1),
                              Expanded(child: body),
                            ],
                          ),
                        )
                      : Scaffold(
                          body: body,
                          bottomNavigationBar: NavigationBar(
                            selectedIndex: idx,
                            onDestinationSelected: _onDestinationSelected,
                            destinations: [
                              for (final tab in _tabs)
                                NavigationDestination(
                                  icon: Icon(
                                    _iconFor(tab.routeKey, selected: false),
                                  ),
                                  selectedIcon: Icon(
                                    _iconFor(tab.routeKey, selected: true),
                                  ),
                                  label: _destinationLabel(tab),
                                ),
                            ],
                          ),
                        );
                  return scaffold;
                },
              ),
            );
          },
        );
      },
    );
  }
}

/// Shown when an auth-gated tab has no session - CTA label from auth_providers chrome only.
class _AuthRequiredPlaceholder extends StatefulWidget {
  const _AuthRequiredPlaceholder();

  @override
  State<_AuthRequiredPlaceholder> createState() =>
      _AuthRequiredPlaceholderState();
}

class _AuthRequiredPlaceholderState extends State<_AuthRequiredPlaceholder> {
  AuthProvidersChrome? _chrome;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final chrome = await fetchAuthProvidersChrome();
    if (!mounted) return;
    setState(() => _chrome = chrome);
  }

  @override
  Widget build(BuildContext context) {
    final label = (_chrome?.navSignInLabel ?? '').trim();
    return Scaffold(
      body: Center(
        child: label.isEmpty
            ? const SizedBox.shrink()
            : FilledButton(
                onPressed: () {
                  showSignInDialog(context);
                },
                child: Text(label),
              ),
      ),
    );
  }
}
