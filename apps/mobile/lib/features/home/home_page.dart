import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/board_square.dart';
import 'package:dama_mobile/core/cache/query_cache.dart';
import 'package:dama_mobile/core/cup_lifecycle.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/prefs/board_palette_prefs.dart';
import 'package:dama_mobile/core/prefs/board_view_prefs.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/theme/theme_toggle_button.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/features/ads/geo_ad_slot.dart';
import 'package:dama_mobile/features/ads/publisher_shell.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/auth/auth_providers.dart';
import 'package:dama_mobile/features/auth/challenge_accept_session.dart';
import 'package:dama_mobile/features/auth/sign_in_dialog.dart';
import 'package:dama_mobile/features/auth/otp_session.dart';
import 'package:dama_mobile/features/auth/practice_token.dart';
import 'package:dama_mobile/features/events/community_player_chrome_soft.dart';
import 'package:dama_mobile/features/events/events_shell.dart';
import 'package:dama_mobile/features/game/cubit/feature_flags_cubit.dart';
import 'package:dama_mobile/features/game/draughts_board_3d.dart';
import 'package:dama_mobile/features/game/play_board_frame.dart';
import 'package:dama_mobile/features/game/game_lobby_page.dart';
import 'package:dama_mobile/features/game/match_board_page.dart';
import 'package:dama_mobile/features/game/matchmaking_page.dart';
import 'package:dama_mobile/features/game/spectate_page.dart';
import 'package:dama_mobile/features/leaderboard/leaderboard_page.dart';
import 'package:dama_mobile/features/legal/legal_page.dart';
import 'package:dama_mobile/features/profile/avatar_page.dart';
import 'package:dama_mobile/features/home/dashboard_page.dart';
import 'package:dama_mobile/features/home/platform_stats_page.dart';
import 'package:dama_mobile/features/home/play_rail_panel.dart';
import 'package:dama_mobile/features/home/player_shell_controller.dart';
import 'package:dama_mobile/features/profile/profile_page.dart';
import 'package:dama_mobile/widgets/player_rail_menu_leading.dart';
import 'package:dama_mobile/core/types/prize_pool_lines.dart';
import 'package:dama_mobile/core/types/payment_modal_chrome.dart';
import 'package:dama_mobile/features/tournaments/payment_enroll_dialog.dart';
import 'package:dama_mobile/features/tournaments/tournament_mini_card.dart';
import 'package:dama_mobile/features/notifications/notification_bell.dart';
import 'package:dama_mobile/features/notifications/notification_href_nav.dart';
import 'package:dama_mobile/features/wallet/wallet_page.dart';
import 'package:dama_mobile/widgets/dama_brand_mark.dart';
import 'package:dama_mobile/widgets/dama_user_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;

class HomePage extends StatefulWidget {
  const HomePage({super.key, this.launchUri});

  /// Deep-link or in-app URI (`/?view=match&challenge=…`).
  final Uri? launchUri;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  String _brandName = '';
  AuthProvidersChrome? _authChrome;
  LegalChrome? _legalChrome;

  HomeSurfaceChrome? _homeChrome;
  String _homeUnavailable = '';
  bool _homeLoading = true;
  List<RestTournament> _tournaments = const [];

  /// From tournaments_player_chrome (status-honest card CTAs on home teaser).
  TournamentsPlayerChrome? _tournamentsPlayerChrome;

  /// Official badge on Play-home teaser rows (Tournaments discovery chrome).
  String _tournamentsOfficialBadge = '';
  List<ClientNavLink> _marketingFooterLinks = const [];
  String _dashboardNavTitle = '';
  String _profileNavTitle = '';
  PlayChrome? _playChrome;
  bool _playChromeLoading = true;
  PlayRailChrome? _playRailChrome;
  bool _playRailChromeLoading = true;
  String _playRailUnavailable = '';
  int? _clockSeconds;
  List<MatchClockPreset> _timeControlPresets = const [];
  bool _timeControlsLoading = true;
  int _playTab = 0; // 0 = New Game, 1 = Games, 2 = Players
  /// Players sub: 0 friends, 1 requests, 2 all (notification deep-link).
  int _playersSub = 2;
  String? _dmDeepLinkRequestId;
  String? _dmDeepLinkThreadId;
  RailChallengeOpponent? _railChallengeOpponent;
  String? _pendingChallengeToken;
  bool _acceptingChallenge = false;

  /// Network retries for challenge accept (no toast spam).
  int _challengeAcceptRetries = 0;
  StreamSubscription<void>? _otpSessionSub;
  int? _aiDepth;
  String _clockLabel = '';
  BoardViewMode _boardView = BoardViewMode.flat2d;
  BoardPaletteId _boardPaletteId = BoardPaletteId.forest;
  PiecePaletteId _piecePaletteId = PiecePaletteId.whiteBlack;

  /// In-place AI session (no Navigator.push - mirrors web hub embed).
  String? _liveAiToken;
  int? _liveAiDepth;
  int? _liveAiTimeControlSeconds;

  /// Deep-link `/?view=events&code=` handled once after first frame.
  bool _eventsDeepLinkHandled = false;

  /// Deep-link `/?view=tournaments&id=` handled once after first frame.
  bool _tournamentsDeepLinkHandled = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(_tryAcceptPendingChallenge());
      if (mounted) unawaited(_tryOpenEventsDeepLink());
      if (mounted) unawaited(_tryOpenTournamentsDeepLink());
    });
    // After OTP verify, retry pending challenge accept (web subscribeOtpSession parity).
    _otpSessionSub = otpSessionChanges.listen((_) {
      if (mounted) unawaited(_tryAcceptPendingChallenge());
    });
    _loadBrand();
    _loadAuthChrome();
    _loadLegalNav();
    _loadHome();
    _loadSecondaryNav();
    _loadPlayChrome();
    _loadPlayRailChrome();
    _pendingChallengeToken = _challengeTokenFromUri(widget.launchUri);
    _applyOpponentFromUri(widget.launchUri);
    _applyRailFromUri(widget.launchUri);
    unawaited(_loadProgressionClock());
    unawaited(_loadBoardView());
    unawaited(_loadBoardPalette());
    unawaited(_loadPiecePalette());
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_persistProfileCountryFromGeo());
    });
  }

  Future<void> _tryOpenEventsDeepLink() async {
    if (_eventsDeepLinkHandled) return;
    final uri = widget.launchUri;
    if (uri == null) return;
    final view = (uri.queryParameters['view'] ?? '').trim().toLowerCase();
    final path = uri.path;
    // Legacy view=events, /events/public, or invite /events/join → Community.
    if (view != 'events' &&
        !path.contains('/events/public') &&
        !path.contains('/events/join')) {
      return;
    }
    _eventsDeepLinkHandled = true;
    final code = (uri.queryParameters['code'] ?? '').trim();
    final id = (uri.queryParameters['id'] ?? '').trim();
    if (!mounted) return;
    // Select shell Tournaments tab (bottom-nav active; web view=tournaments parity).
    PlayerShellController.instance.openTournaments(
      source: 'community',
      focusId: id.isNotEmpty ? id : null,
      joinCode: code.isNotEmpty ? code : null,
    );
    if (!mounted) return;
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  Future<void> _tryOpenTournamentsDeepLink() async {
    if (_tournamentsDeepLinkHandled) return;
    final uri = widget.launchUri;
    if (uri == null) return;
    final view = (uri.queryParameters['view'] ?? '').trim().toLowerCase();
    if (view != 'tournaments') return;
    _tournamentsDeepLinkHandled = true;
    final id = (uri.queryParameters['id'] ?? '').trim();
    final code = (uri.queryParameters['code'] ?? '').trim();
    final source = (uri.queryParameters['source'] ?? '').trim().toLowerCase();
    if (!mounted) return;
    PlayerShellController.instance.openTournaments(
      source: (source == 'official' || source == 'community' || source == 'all')
          ? source
          : (code.isNotEmpty ? 'community' : 'all'),
      focusId: id.isNotEmpty ? id : null,
      joinCode: code.isNotEmpty ? code : null,
    );
    if (!mounted) return;
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  /// POST /geo/locate so API can write verified GeoIP → users.country_code (flags).
  Future<void> _persistProfileCountryFromGeo() async {
    if (!mounted) return;
    final token = context.read<AuthCubit>().state.token?.trim() ?? '';
    if (token.isEmpty) return;
    try {
      await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/geo/locate'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: '{}',
      );
    } catch (_) {}
  }

  @override
  void dispose() {
    unawaited(_otpSessionSub?.cancel());
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant HomePage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.launchUri != oldWidget.launchUri) {
      _pendingChallengeToken ??= _challengeTokenFromUri(widget.launchUri);
      _applyOpponentFromUri(widget.launchUri);
      unawaited(_tryAcceptPendingChallenge());
      // Catalog shares use view=tournaments (+ code/id); legacy view=events still remaps.
      _eventsDeepLinkHandled = false;
      _tournamentsDeepLinkHandled = false;
      unawaited(_tryOpenEventsDeepLink());
      unawaited(_tryOpenTournamentsDeepLink());
    }
  }

  void _applyOpponentFromUri(Uri? uri) {
    if (uri == null) return;
    final opponent = uri.queryParameters['opponent']?.trim() ?? '';
    if (opponent.isEmpty) return;
    final id = uri.queryParameters['opponentId']?.trim();
    final ratingRaw = uri.queryParameters['opponentRating']?.trim();
    final rating = ratingRaw != null ? int.tryParse(ratingRaw) : null;
    final countryRaw = uri.queryParameters['opponentCountry']?.trim();
    final countryCode = (countryRaw != null && countryRaw.length == 2)
        ? countryRaw.toUpperCase()
        : null;
    final hostTrustBadge =
        uri.queryParameters['opponentHostTrustBadge']?.trim();
    final hostTrustTier = uri.queryParameters['opponentHostTrustTier']?.trim();
    void apply() {
      _playTab = 0;
      _railChallengeOpponent = RailChallengeOpponent(
        id: id != null && id.isNotEmpty ? id : null,
        username: opponent,
        rating: rating,
        countryCode: countryCode,
        hostTrustTier: (hostTrustTier != null && hostTrustTier.isNotEmpty)
            ? hostTrustTier
            : null,
        hostTrustBadge: (hostTrustBadge != null && hostTrustBadge.isNotEmpty)
            ? hostTrustBadge
            : null,
      );
    }

    if (!mounted) {
      apply();
      return;
    }
    setState(apply);
  }

  void _applyRailFromUri(Uri? uri) {
    if (uri == null) return;
    final rail = (uri.queryParameters['rail'] ?? '').trim().toLowerCase();
    if (rail.isEmpty) return;
    final sub = (uri.queryParameters['sub'] ?? '').trim().toLowerCase();
    final dm = (uri.queryParameters['dm'] ?? '').trim();
    final thread = (uri.queryParameters['thread'] ?? '').trim();
    void apply() {
      // Rail deep-links win over embedded AI (web HomePlayHub setAiLive(null)).
      _liveAiToken = null;
      _liveAiDepth = null;
      _liveAiTimeControlSeconds = null;
      if (rail == 'games') {
        _playTab = 1;
      } else if (rail == 'players') {
        _playTab = 2;
        _playersSub = switch (sub) {
          'friends' => 0,
          'requests' => 1,
          'all' => 2,
          'dms' => 3,
          _ => 1,
        };
        if (dm.isNotEmpty || thread.isNotEmpty) {
          _playersSub = 3;
          _dmDeepLinkRequestId = dm.isNotEmpty ? dm : null;
          _dmDeepLinkThreadId = thread.isNotEmpty ? thread : null;
        }
      } else if (rail == 'new') {
        _playTab = 0;
      }
    }

    if (!mounted) {
      apply();
      return;
    }
    setState(apply);
  }

  Future<void> _loadBoardView() async {
    final mode = await readBoardViewMode();
    if (!mounted) return;
    setState(() => _boardView = mode);
  }

  Future<void> _setBoardView(BoardViewMode mode) async {
    setState(() => _boardView = mode);
    await writeBoardViewMode(mode);
  }

  Future<void> _loadBoardPalette() async {
    final id = await readBoardPaletteId();
    if (!mounted) return;
    setState(() => _boardPaletteId = id);
  }

  Future<void> _setBoardPalette(BoardPaletteId id) async {
    setState(() => _boardPaletteId = id);
    await writeBoardPaletteId(id);
  }

  Future<void> _loadPiecePalette() async {
    final id = await readPiecePaletteId();
    if (!mounted) return;
    setState(() => _piecePaletteId = id);
  }

  Future<void> _setPiecePalette(PiecePaletteId id) async {
    setState(() => _piecePaletteId = id);
    await writePiecePaletteId(id);
  }

  Future<void> _loadProgressionClock() async {
    try {
      final cached = QueryCache.read<ProgressionConfig>(
        CacheKeys.progression,
        maxAge: QueryCache.platformTtl,
        allowStale: true,
      );
      if (cached?.matchClock?.active == true) {
        final sec = cached!.matchClock!.initialSeconds;
        if (mounted) {
          setState(() {
            _clockLabel = _formatClock(sec);
            _clockSeconds = sec;
            _timeControlPresets = cached.matchClock!.presets;
            if (_timeControlPresets.isNotEmpty) _timeControlsLoading = false;
          });
        }
      }
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/progression'),
      );
      if (res.statusCode >= 300) {
        if (mounted) setState(() => _timeControlsLoading = false);
        return;
      }
      final progression = ProgressionConfig.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      QueryCache.write(CacheKeys.progression, progression);
      final clock = progression.matchClock;
      if (!mounted) return;
      if (clock == null || !clock.active) {
        setState(() => _timeControlsLoading = false);
        return;
      }
      setState(() {
        _clockLabel = _formatClock(clock.initialSeconds);
        _clockSeconds = clock.initialSeconds;
        _timeControlPresets = clock.presets;
        _timeControlsLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _timeControlsLoading = false);
    }
  }

  String _formatClock(int seconds) {
    if (seconds <= 0) return '';
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  Future<void> _loadPlayChrome() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/public/play-chrome'),
      );
      if (res.statusCode >= 300) {
        if (mounted) setState(() => _playChromeLoading = false);
        return;
      }
      final chrome = PlayChrome.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      if (!mounted) return;
      setState(() {
        _playChrome = chrome;
        _playChromeLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _playChromeLoading = false);
    }
  }

  Future<void> _loadPlayRailChrome() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/public/play-rail-chrome'),
      );
      Map<String, dynamic>? map;
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) map = decoded;
      } catch (_) {}
      if (res.statusCode >= 300) {
        if (!mounted) return;
        setState(() {
          _playRailChrome = null;
          _playRailUnavailable = PlayRailChrome.unavailableFrom(map);
          _playRailChromeLoading = false;
        });
        return;
      }
      final chrome = PlayRailChrome.fromJson(map);
      if (!mounted) return;
      setState(() {
        _playRailChrome = chrome;
        _playRailUnavailable =
            chrome == null ? PlayRailChrome.unavailableFrom(map) : '';
        _playRailChromeLoading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _playRailChromeLoading = false;
          _playRailChrome = null;
        });
      }
    }
  }

  static String? _challengeTokenFromUri(Uri? uri) {
    if (uri == null) return null;
    final tok = uri.queryParameters['challenge']?.trim();
    if (tok == null || tok.isEmpty) return null;
    return tok;
  }

  Future<void> _tryAcceptPendingChallenge() async {
    final tok = _pendingChallengeToken;
    if (tok == null || tok.isEmpty || _acceptingChallenge) return;
    if (await isChallengeAcceptDone(tok)) {
      _pendingChallengeToken = null;
      return;
    }
    if (!mounted) return;
    final auth = context.read<AuthCubit>().state;
    if (!auth.isAuthenticated || auth.token == null) return;
    // Wait for OTP when required - never burn the challenge token.
    var otpRequired = false;
    try {
      final flagsRes = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/feature-flags'),
      );
      if (flagsRes.statusCode == 200) {
        final map = jsonDecode(flagsRes.body);
        if (map is Map<String, dynamic>) {
          otpRequired = map['otp_required'] == true;
        }
      }
    } catch (_) {}
    if (otpRequired && !(await isOtpSessionVerified(auth.userId))) {
      return;
    }
    _acceptingChallenge = true;
    final failMsg = _playRailChrome?.toastChallengeAcceptFailed ?? '';
    var scheduleRetry = false;
    var silentRetry = false;
    try {
      final res = await http.post(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/invites/token/${Uri.encodeComponent(tok)}/accept',
        ),
        headers: {
          'Authorization': 'Bearer ${auth.token}',
          'Content-Type': 'application/json',
        },
        body: '{}',
      );
      if (!mounted) return;
      if (res.statusCode == 403) {
        // verification required - keep token; OtpGate + retry loop below.
        scheduleRetry = true;
        silentRetry = true;
        return;
      }
      if (res.statusCode >= 300) {
        _pendingChallengeToken = null;
        _challengeAcceptRetries = 0;
        if (failMsg.isNotEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(failMsg)));
        }
        return;
      }
      String? gameId;
      try {
        final map = jsonDecode(res.body) as Map<String, dynamic>;
        final match = map['match'];
        if (match is Map<String, dynamic>) {
          gameId = match['game_id']?.toString();
        }
      } catch (_) {}
      if (gameId == null || gameId.isEmpty) {
        _pendingChallengeToken = null;
        _challengeAcceptRetries = 0;
        if (failMsg.isNotEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(failMsg)));
        }
        return;
      }
      await markChallengeAcceptDone(tok);
      _pendingChallengeToken = null;
      _challengeAcceptRetries = 0;
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => MatchBoardPage(
            accessToken: auth.token!,
            gameId: gameId,
            mode: 'pvp',
          ),
        ),
      );
    } catch (_) {
      // Network blip - silent retry a few times; toast once then stop.
      _challengeAcceptRetries += 1;
      if (_challengeAcceptRetries <= 3) {
        scheduleRetry = true;
        silentRetry = true;
      } else {
        _pendingChallengeToken = null;
        _challengeAcceptRetries = 0;
        if (mounted && failMsg.isNotEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(failMsg)));
        }
      }
    } finally {
      _acceptingChallenge = false;
      if (scheduleRetry && _pendingChallengeToken != null && mounted) {
        Future<void>.delayed(
          Duration(milliseconds: silentRetry ? 800 : 400),
          () {
            if (mounted) unawaited(_tryAcceptPendingChallenge());
          },
        );
      }
    }
  }

  Future<void> _loadLegalNav() async {
    try {
      final chromeRes = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/public/legal-chrome'),
      );
      if (chromeRes.statusCode >= 300) return;
      final chrome = LegalChrome.fromJson(
        jsonDecode(chromeRes.body) as Map<String, dynamic>,
      );
      if (!mounted) return;
      setState(() => _legalChrome = chrome);
    } catch (_) {}
  }

  /// Mobile nav entries not already covered by bottom_nav (DB-driven secondary shortcuts).
  Future<void> _loadSecondaryNav() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/platform/client-nav'),
      );
      if (res.statusCode >= 300) return;
      final payload = ClientNavPayload.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      final all = [
        ...payload.player,
        ...payload.mobile,
        ...payload.bottomNav.mobile,
      ];
      // Prefer client_nav.dashboard_page_title (web PlayerUserMenu parity).
      String dash = payload.dashboardPageTitle.trim();
      String profile = '';
      for (final l in all) {
        if (dash.isEmpty &&
            l.routeKey == 'dashboard' &&
            l.title.trim().isNotEmpty) {
          dash = l.title.trim();
        }
        if (l.routeKey == 'profile' && l.title.trim().isNotEmpty) {
          profile = l.title.trim();
        }
      }
      // Footer: marketing surface - remap Event-sport titles (web marketing layout parity).
      final marketing = payload.marketing
          .where((l) => l.routeKey.isNotEmpty && l.title.trim().isNotEmpty)
          .map((l) {
        final softTitle = softTournamentsPageTitle(l.title);
        if (softTitle == l.title) return l;
        return ClientNavLink(
          title: softTitle,
          routeKey: l.routeKey,
          href: l.href,
          body: l.body,
          bodyWhenVsAi: l.bodyWhenVsAi,
          cta: l.cta,
        );
      }).toList();
      if (!mounted) return;
      setState(() {
        _marketingFooterLinks = marketing;
        _dashboardNavTitle = dash;
        _profileNavTitle = profile;
      });
    } catch (_) {}
  }

  Future<String?> _ensureToken() async {
    final auth = context.read<AuthCubit>().state;
    if (auth.isAuthenticated) return auth.token;
    return showSignInDialog(context);
  }

  Future<void> _openSecondary(ClientNavLink link) async {
    final key = link.routeKey;
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
    // Home = Play hub; Player/dashboard footer → profile ops (auth).
    if (key == 'home') {
      Navigator.of(context).popUntil((route) => route.isFirst);
      return;
    }
    if (key == 'dashboard') {
      final dashToken = await _ensureToken();
      if (!mounted || dashToken == null || dashToken.isEmpty) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
            builder: (_) => DashboardPage(accessToken: dashToken)),
      );
      return;
    }
    // Guest may open Tournaments (Official|Community|All) like bottom nav / web.
    // Host CTA and join/enroll own sign-in. Do not put 'tournaments' in needsAuth.
    final needsAuth = {
      'matchmaking',
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
    }.contains(key);
    String? token;
    if (needsAuth) {
      token = await _ensureToken();
      if (!mounted || token == null || token.isEmpty) return;
    } else {
      token = context.read<AuthCubit>().state.token;
    }
    if (!mounted) return;
    final Widget page;
    switch (key) {
      case 'play':
        page = const GameLobbyPage();
        break;
      case 'matchmaking':
        page = MatchmakingPage(token: token!);
        break;
      case 'spectate':
        page = SpectatePage(accessToken: token);
        break;
      case 'leaderboard':
        page = LeaderboardPage();
        break;
      case 'status':
      case 'platform_stats':
        page = PlatformStatsPage();
        break;
      case 'tournaments':
      case 'tournaments_mine':
        // Select shell tab so bottom-nav highlights Tournaments (web parity).
        PlayerShellController.instance.openTournaments();
        if (!mounted) return;
        Navigator.of(context).popUntil((route) => route.isFirst);
        return;
      case 'host_tournament':
        final hostToken = await _ensureToken();
        if (!mounted || hostToken == null || hostToken.isEmpty) return;
        page = EventsShell(
          accessToken: hostToken,
          initialRouteKey: 'events_list',
          initialOpenCreate: true,
        );
        break;
      case 'wallet':
        page = WalletPage(token: token!);
        break;
      case 'profile':
        page = ProfilePage(accessToken: token!);
        break;
      case 'avatar':
        page = AvatarPage(accessToken: token!);
        break;
      case 'ads':
      case 'ads_dashboard':
      case 'ads_publisher':
        page = PublisherShell(accessToken: token!);
        break;
      case 'ads_campaigns':
        page = PublisherShell(
          accessToken: token!,
          initialRouteKey: 'ads_campaigns',
        );
        break;
      case 'ads_analytics':
        page = PublisherShell(
          accessToken: token!,
          initialRouteKey: 'ads_analytics',
        );
        break;
      case 'events':
      case 'events_public':
        // Unified discovery: Community under shell Tournaments (no second sport).
        PlayerShellController.instance.openTournaments(source: 'community');
        if (!mounted) return;
        Navigator.of(context).popUntil((route) => route.isFirst);
        return;
      case 'events_dashboard':
        page = EventsShell(accessToken: token!);
        break;
      case 'events_list':
        page = EventsShell(
          accessToken: token!,
          initialRouteKey: 'events_list',
        );
        break;
      case 'events_analytics':
        page = EventsShell(
          accessToken: token!,
          initialRouteKey: 'events_analytics',
        );
        break;
      case 'events_join':
        page = EventsShell(
          accessToken: token!,
          initialRouteKey: 'events_join',
        );
        break;
      default:
        return;
    }
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));
  }

  Future<void> _loadAuthChrome() async {
    final chrome = await fetchAuthProvidersChrome();
    if (!mounted) return;
    setState(() => _authChrome = chrome);
  }

  Future<void> _loadBrand() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/platform/client-nav'),
      );
      if (res.statusCode >= 300) return;
      final payload = ClientNavPayload.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      if (!mounted) return;
      setState(() => _brandName = payload.brandName);
    } catch (_) {}
  }

  Future<void> _loadHome() async {
    setState(() => _homeLoading = true);
    try {
      final chromeRes = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/public/home-chrome'),
      );
      HomeSurfaceChrome? chrome;
      String unavailable = '';
      if (chromeRes.statusCode < 300) {
        final map = jsonDecode(chromeRes.body) as Map<String, dynamic>;
        chrome = HomeSurfaceChrome.fromJson(map);
        unavailable = softCommunityChromeUnavailable(
          (map['home_chrome_unavailable'] as String?)?.trim() ?? '',
        );
      }

      List<RestTournament> rows = const [];
      if (chrome != null) {
        final tChromeRes = await http.get(
          Uri.parse(
            '${ApiConfig.baseUrl}/api/v1/public/tournaments-player-chrome',
          ),
        );
        var tourLimit = 0;
        TournamentsPlayerChrome? tChromeReady;
        var officialBadge = '';
        if (tChromeRes.statusCode < 300) {
          final tChrome = TournamentsPlayerChrome.fromJson(
            jsonDecode(tChromeRes.body) as Map<String, dynamic>,
          );
          tourLimit = tChrome?.listPageSizeInt ?? 0;
          if (tChrome != null && tChrome.isReady) {
            tChromeReady = tChrome;
          }
          officialBadge = softTournamentsBadgeOfficial(
            tChrome?.badgeOfficialLabel ?? '',
          ).trim();
        }
        if (tourLimit < 1) {
          if (!mounted) return;
          setState(() {
            _homeChrome = chrome;
            _homeUnavailable = unavailable;
            _tournaments = const [];
            _tournamentsPlayerChrome = tChromeReady;
            _tournamentsOfficialBadge = officialBadge;
            _homeLoading = false;
          });
          return;
        }
        final tourHeaders = <String, String>{};
        final authTok = context.read<AuthCubit>().state.token?.trim() ?? '';
        if (authTok.isNotEmpty) {
          tourHeaders['Authorization'] = 'Bearer $authTok';
        }
        // Home teaser = joinable-now discovery (Open lifecycle; never mix finished Join traps).
        final tourRes = await http.get(
          Uri.parse(
            '${ApiConfig.baseUrl}/api/v1/tournaments?skip=0&limit=$tourLimit&lifecycle=open',
          ),
          headers: tourHeaders,
        );
        if (tourRes.statusCode < 300) {
          final body = jsonDecode(tourRes.body) as Map<String, dynamic>;
          rows = (body['tournaments'] as List<dynamic>? ?? const [])
              .whereType<Map<String, dynamic>>()
              .map(RestTournament.fromJson)
              .where((t) => t.id.isNotEmpty)
              .toList();
        }
        if (!mounted) return;
        setState(() {
          _tournamentsPlayerChrome = tChromeReady;
          _tournamentsOfficialBadge = officialBadge;
        });
      }

      if (!mounted) return;
      setState(() {
        _homeChrome = chrome;
        _homeUnavailable = unavailable;
        _tournaments = rows;
        _homeLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _homeChrome = null;
        // Keep prior API unavailable copy if any; never invent UI strings.
        _homeLoading = false;
      });
    }
  }

  Future<PaymentModalChrome?> _loadPayChrome() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/public/payment-modal-chrome'),
      );
      if (res.statusCode != 200) return null;
      final decoded = jsonDecode(res.body);
      if (decoded is! Map<String, dynamic>) return null;
      return PaymentModalChrome.fromJson(decoded);
    } catch (_) {
      return null;
    }
  }

  /// After enroll / seated Join: cup lobby via shell Tournaments tab + focusId.
  Future<void> _openTournamentCupLobby(String tournamentId) async {
    final id = tournamentId.trim();
    if (id.isEmpty) return;
    if (!mounted) return;
    final token = await _ensureToken();
    if (!mounted || token == null) return;
    PlayerShellController.instance.openTournaments(
      source: 'official',
      focusId: id,
    );
    if (!mounted) return;
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  Future<void> _onEnroll(RestTournament t) async {
    final chrome = _tournamentsPlayerChrome;
    final cta = resolveCupCardCta(
      CupLifecycleFields(startedAt: t.startedAt, finishedAt: t.finishedAt),
      enrolled: t.viewerEnrolled,
      isFree: t.isFree,
      labels: CupCardCtaLabels(
        joinAction: softTournamentsJoinAction(chrome?.joinAction ?? ''),
        enrollAction: softTournamentsEnrollAction(chrome?.enrollAction ?? ''),
        lobbyAction: (chrome?.lobbyAction ?? '').trim(),
        watchAction: (chrome?.watchAction ?? '').trim(),
        resultsAction: (chrome?.resultsAction ?? '').trim(),
      ),
    );
    // Watch / lobby / results → same cup lobby shell (never enroll finished).
    if (cta.kind != CupCardCtaKind.enroll) {
      await _openTournamentCupLobby(t.id);
      return;
    }
    final token = await _ensureToken();
    if (!mounted || token == null) return;
    final home = _homeChrome;
    if (t.isFree) {
      final pay = await _loadPayChrome();
      if (!mounted) return;
      try {
        final res = await http.post(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/tournaments/${t.id}/enroll'),
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
          body: '{}',
        );
        if (!mounted) return;
        if (res.statusCode == 409) {
          await _openTournamentCupLobby(t.id);
          return;
        }
        if (res.statusCode >= 300) {
          final msg = softCommunityJoinStatusMessage(pay?.enrollFailed ?? '');
          if (msg.isNotEmpty) {
            ScaffoldMessenger.of(context)
                .showSnackBar(SnackBar(content: Text(msg)));
          }
          return;
        }
        final ok = softCommunityJoinStatusMessage(pay?.enrollSuccess ?? '');
        if (ok.isNotEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(ok)));
        }
        await _openTournamentCupLobby(t.id);
      } catch (_) {
        if (!mounted) return;
        final msg = softCommunityJoinStatusMessage(pay?.enrollFailed ?? '');
        if (msg.isNotEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(msg)));
        }
      }
      return;
    }
    final enrolled = await showPaymentEnrollDialog(
      context,
      tournament: t,
      prizePoolLabels: home != null ? PrizePoolCardLabels.fromHome(home) : null,
    );
    if (!mounted) return;
    await _loadHome();
    if (!mounted) return;
    if (enrolled) await _openTournamentCupLobby(t.id);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final signInLabel = (_authChrome?.navSignInLabel ?? '').trim();
    final signOutLabel = (_authChrome?.signOutActionLabel ?? '').trim();
    return Scaffold(
      appBar: AppBar(
        leading: PlayerRailMenuLeading.maybe(context),
        title: DamaBrandTitle(title: _brandName),
        actions: [
          BlocBuilder<AuthCubit, AuthState>(
            builder: (context, state) {
              if (!state.isAuthenticated) {
                if (signInLabel.isEmpty) return const SizedBox.shrink();
                return TextButton(
                  onPressed: () {
                    unawaited(showSignInDialog(context));
                  },
                  child: Text(signInLabel),
                );
              }
              final token = (state.token ?? '').trim();
              // Google OAuth chrome only - never fall back to account username.
              final displayName = (state.displayName ?? '').trim();
              final avatarUrl = (state.avatarUrl ?? '').trim();
              final mark = displayName;
              return Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (token.isNotEmpty)
                    NotificationBellButton(
                      accessToken: token,
                      onNavigateHref: (href) {
                        unawaited(
                          navigateNotificationHref(
                            context,
                            href: href,
                            accessToken: token,
                          ),
                        );
                      },
                    ),
                  PopupMenuButton<String>(
                    tooltip: mark.isNotEmpty ? mark : null,
                    onSelected: (value) async {
                      final nav = Navigator.of(context);
                      final auth = context.read<AuthCubit>();
                      if (value == 'profile') {
                        final tok = await _ensureToken();
                        if (!mounted || tok == null) return;
                        await nav.push(
                          MaterialPageRoute(
                            builder: (_) => ProfilePage(accessToken: tok),
                          ),
                        );
                        return;
                      }
                      if (value == 'wallet') {
                        final tok = await _ensureToken();
                        if (!mounted || tok == null) return;
                        await nav.push(
                          MaterialPageRoute(
                            builder: (_) => WalletPage(token: tok),
                          ),
                        );
                        return;
                      }
                      if (value == 'logout') {
                        await auth.logout();
                      }
                    },
                    itemBuilder: (context) => [
                      if (_profileNavTitle.isNotEmpty)
                        PopupMenuItem(
                          value: 'profile',
                          child: Text(_profileNavTitle),
                        ),
                      if (_dashboardNavTitle.isNotEmpty)
                        PopupMenuItem(
                          value: 'wallet',
                          child: Text(_dashboardNavTitle),
                        ),
                      if (signOutLabel.isNotEmpty)
                        PopupMenuItem(
                          value: 'logout',
                          child: Text(signOutLabel),
                        ),
                    ],
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          DamaUserAvatar(
                            imageUrl: avatarUrl.isNotEmpty ? avatarUrl : null,
                            radius: 14,
                          ),
                          if (displayName.isNotEmpty) ...[
                            const SizedBox(width: 6),
                            ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 96),
                              child: Text(
                                displayName,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.labelLarge,
                              ),
                            ),
                          ],
                          const Icon(Icons.arrow_drop_down, size: 20),
                        ],
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
          const ThemeToggleButton(),
        ],
      ),
      body: _liveAiToken != null &&
              _liveAiDepth != null &&
              _liveAiTimeControlSeconds != null
          ? MatchBoardPage(
              accessToken: _liveAiToken!,
              aiDepth: _liveAiDepth,
              timeControlSeconds: _liveAiTimeControlSeconds,
              onClose: () => setState(() {
                _liveAiToken = null;
                _liveAiDepth = null;
                _liveAiTimeControlSeconds = null;
              }),
            )
          : SafeArea(
              child: LayoutBuilder(
                builder: (context, constraints) {
                  Widget hubBody() {
                    if (_playChromeLoading || _playRailChromeLoading) {
                      return const PlayHubSkeleton();
                    }
                    if (_playChrome != null && _playRailChrome != null) {
                      return BlocListener<AuthCubit, AuthState>(
                        listenWhen: (prev, next) =>
                            prev.isAuthenticated != next.isAuthenticated ||
                            prev.token != next.token,
                        listener: (context, state) {
                          if (state.isAuthenticated) {
                            unawaited(_tryAcceptPendingChallenge());
                            unawaited(_persistProfileCountryFromGeo());
                          }
                        },
                        child: _HomePlayHub(
                          chrome: _playChrome!,
                          railChrome: _playRailChrome!,
                          clockLabel: _clockLabel,
                          clockSeconds: _clockSeconds,
                          timeControlPresets: _timeControlPresets,
                          timeControlsLoading: _timeControlsLoading,
                          boardView: _boardView,
                          onBoardView: _setBoardView,
                          boardPaletteId: _boardPaletteId,
                          onBoardPalette: _setBoardPalette,
                          piecePaletteId: _piecePaletteId,
                          onPiecePalette: _setPiecePalette,
                          tab: _playTab,
                          initialPlayersSub: _playersSub,
                          initialDmRequestId: _dmDeepLinkRequestId,
                          initialDmThreadId: _dmDeepLinkThreadId,
                          aiDepth: _aiDepth,
                          onTab: (i) => setState(() => _playTab = i),
                          onDepth: (d) => setState(() => _aiDepth = d),
                          onPlayAi: (timeControlSeconds) async {
                            // Ensure Play home tab is active (web leave-tournaments parity).
                            PlayerShellController.instance.openHome();
                            var token = context.read<AuthCubit>().state.token;
                            token ??= await ensurePracticeToken();
                            if (!mounted || token == null || token.isEmpty)
                              return;
                            final depth = _aiDepth;
                            if (depth == null) return;
                            if (timeControlSeconds <= 0) return;
                            setState(() {
                              _liveAiToken = token;
                              _liveAiDepth = depth;
                              _liveAiTimeControlSeconds = timeControlSeconds;
                            });
                          },
                          onPlayMatch: () async {
                            final nav = Navigator.of(context);
                            final token = await _ensureToken();
                            if (!mounted || token == null) return;
                            await nav.push(
                              MaterialPageRoute(
                                builder: (_) => MatchmakingPage(token: token),
                              ),
                            );
                          },
                          initialChallengeOpponent: _railChallengeOpponent,
                          onChallengeOpponentConsumed: () {
                            if (_railChallengeOpponent != null) {
                              setState(() => _railChallengeOpponent = null);
                            }
                          },
                          tournaments: _tournaments,
                          homeChrome: _homeChrome,
                          tournamentsLoading: _homeLoading,
                          tournamentsUnavailable: _homeUnavailable,
                          tournamentsPlayerChrome: _tournamentsPlayerChrome,
                          tournamentsOfficialBadge: _tournamentsOfficialBadge,
                          onEnroll: _onEnroll,
                        ),
                      );
                    }
                    final unavailable = (_playRailUnavailable.isNotEmpty
                            ? _playRailUnavailable
                            : (_playChrome?.playChromeUnavailable ?? ''))
                        .trim();
                    if (unavailable.isEmpty) return const SizedBox.shrink();
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: Text(
                        unavailable,
                        textAlign: TextAlign.center,
                        style: TextStyle(color: damaColorsOf(context).danger),
                      ),
                    );
                  }

                  Widget footer() {
                    final privacyLabel =
                        (_legalChrome?.privacyNavLabel ?? '').trim();
                    final termsLabel =
                        (_legalChrome?.termsNavLabel ?? '').trim();
                    final refundsLabel =
                        (_legalChrome?.refundsNavLabel ?? '').trim();
                    final hasMarketing = _marketingFooterLinks.isNotEmpty;
                    final hasLegal = privacyLabel.isNotEmpty ||
                        termsLabel.isNotEmpty ||
                        refundsLabel.isNotEmpty;
                    if (!hasMarketing && !hasLegal) {
                      return const SizedBox.shrink();
                    }
                    return Padding(
                      padding: const EdgeInsets.only(top: 16),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Divider(color: tokens.borderSubtle),
                          const SizedBox(height: 12),
                          Wrap(
                            alignment: WrapAlignment.center,
                            spacing: 12,
                            runSpacing: 8,
                            children: [
                              for (final link in _marketingFooterLinks)
                                TextButton(
                                  onPressed: () => _openSecondary(link),
                                  child: Text(link.title),
                                ),
                              if (privacyLabel.isNotEmpty)
                                TextButton(
                                  onPressed: () => openLegalPage(
                                      context, LegalDocKind.privacy),
                                  child: Text(privacyLabel),
                                ),
                              if (termsLabel.isNotEmpty)
                                TextButton(
                                  onPressed: () => openLegalPage(
                                      context, LegalDocKind.terms),
                                  child: Text(termsLabel),
                                ),
                              if (refundsLabel.isNotEmpty)
                                TextButton(
                                  onPressed: () => openLegalPage(
                                      context, LegalDocKind.refunds),
                                  child: Text(refundsLabel),
                                ),
                            ],
                          ),
                        ],
                      ),
                    );
                  }

                  // Bound to viewport so the play-rail list scrolls inside the hub,
                  // not the whole page (web aside overflow-hidden parity).
                  return RefreshIndicator(
                    onRefresh: _loadHome,
                    child: SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      child: SizedBox(
                        height: constraints.maxHeight,
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const GeoAdSlot(),
                              const SizedBox(height: 12),
                              Expanded(child: hubBody()),
                              footer(),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }
}

/// Chess.com Play pattern: board + New Game | Games | Players rail.
class _HomePlayHub extends StatelessWidget {
  const _HomePlayHub({
    required this.chrome,
    required this.railChrome,
    required this.clockLabel,
    this.clockSeconds,
    this.timeControlPresets = const [],
    this.timeControlsLoading = false,
    required this.boardView,
    required this.onBoardView,
    required this.boardPaletteId,
    required this.onBoardPalette,
    required this.piecePaletteId,
    required this.onPiecePalette,
    required this.tab,
    this.initialPlayersSub = 2,
    this.initialDmRequestId,
    this.initialDmThreadId,
    required this.aiDepth,
    required this.onTab,
    required this.onDepth,
    required this.onPlayAi,
    required this.onPlayMatch,
    this.initialChallengeOpponent,
    this.onChallengeOpponentConsumed,
    required this.tournaments,
    required this.homeChrome,
    required this.tournamentsLoading,
    required this.tournamentsUnavailable,
    this.tournamentsPlayerChrome,
    this.tournamentsOfficialBadge = '',
    required this.onEnroll,
  });

  final PlayChrome chrome;
  final PlayRailChrome railChrome;
  final String clockLabel;
  final int? clockSeconds;
  final List<MatchClockPreset> timeControlPresets;
  final bool timeControlsLoading;
  final BoardViewMode boardView;
  final Future<void> Function(BoardViewMode) onBoardView;
  final BoardPaletteId boardPaletteId;
  final Future<void> Function(BoardPaletteId) onBoardPalette;
  final PiecePaletteId piecePaletteId;
  final Future<void> Function(PiecePaletteId) onPiecePalette;
  final int tab; // 0 New Game, 1 Games, 2 Players
  final int initialPlayersSub;
  final String? initialDmRequestId;
  final String? initialDmThreadId;
  final int? aiDepth;
  final ValueChanged<int> onTab;
  final ValueChanged<int?> onDepth;
  final Future<void> Function(int timeControlSeconds) onPlayAi;
  final Future<void> Function() onPlayMatch;
  final RailChallengeOpponent? initialChallengeOpponent;
  final VoidCallback? onChallengeOpponentConsumed;
  final List<RestTournament> tournaments;
  final HomeSurfaceChrome? homeChrome;
  final bool tournamentsLoading;
  final String tournamentsUnavailable;
  final TournamentsPlayerChrome? tournamentsPlayerChrome;
  final String tournamentsOfficialBadge;
  final Future<void> Function(RestTournament) onEnroll;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (ctx) {
        final token = ctx.read<AuthCubit>().state.token;
        return FeatureFlagsCubit()..load(accessToken: token);
      },
      child: BlocConsumer<FeatureFlagsCubit, FeatureFlagsState>(
        listener: (context, state) {
          if (state.aiDepths.isEmpty) {
            onDepth(null);
            return;
          }
          if (aiDepth == null || !state.aiDepths.contains(aiDepth)) {
            onDepth(state.aiDepths.first);
          }
        },
        builder: (context, state) {
          final board = boardPaletteById(boardPaletteId);
          final piece = piecePaletteById(piecePaletteId);
          final panel = PlayRailPanel(
            railChrome: railChrome,
            playChrome: chrome,
            clockLabel: clockLabel,
            clockSeconds: clockSeconds,
            timeControlPresets: timeControlPresets,
            timeControlsLoading: timeControlsLoading,
            tab: tab,
            initialPlayersSub: initialPlayersSub,
            initialDmRequestId: initialDmRequestId,
            initialDmThreadId: initialDmThreadId,
            aiDepth: aiDepth,
            flags: state,
            onTab: onTab,
            onDepth: onDepth,
            onPlayAi: onPlayAi,
            onPlayMatch: onPlayMatch,
            boardPaletteId: boardPaletteId,
            onBoardPalette: onBoardPalette,
            piecePaletteId: piecePaletteId,
            onPiecePalette: onPiecePalette,
            initialChallengeOpponent: initialChallengeOpponent,
            onChallengeOpponentConsumed: onChallengeOpponentConsumed,
          );
          // Rail tabs are New Game | Games | Players; live tournament strip
          // below matches web HomePlayHub pot cards (DB chrome only).
          final Widget center = BoardPaletteScope(
            board: board,
            piece: piece,
            child: Builder(
              builder: (context) {
                final authed = context.watch<AuthCubit>().state.isAuthenticated;
                // Guests: palette color seat names (same Neo shapes both seats).
                final court = pieceSeatNames(piece);
                final oppLabel = authed ? chrome.labelBlack : court.dark;
                final youLabel = authed ? chrome.labelWhite : court.light;
                final toggle = CompactBoardViewToggle(
                  selected: boardView,
                  onChanged: onBoardView,
                  label2d: railChrome.boardView2d,
                  label3d: railChrome.boardView3d,
                );
                if (boardView == BoardViewMode.flat2d) {
                  return _HomePreviewBoard(
                    opponentLabel: oppLabel,
                    playerLabel: youLabel,
                    clockLabel: clockLabel,
                    boardViewToggle: toggle,
                    vsLabel: railChrome.vsSeparator,
                  );
                }
                return _HomePreviewBoard3D(
                  opponentLabel: oppLabel,
                  playerLabel: youLabel,
                  clockLabel: clockLabel,
                  boardViewToggle: toggle,
                  vsLabel: railChrome.vsSeparator,
                );
              },
            ),
          );
          final hub = LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth >= 720;
              if (wide) {
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(flex: 12, child: center),
                    const SizedBox(width: 20),
                    // Web parity: rail width ~380-440px; stretch so expandBody scrolls.
                    SizedBox(
                      width: (constraints.maxWidth * 0.34).clamp(380.0, 440.0),
                      child: panel,
                    ),
                  ],
                );
              }
              // Board gets remaining height (maximize square to full width when possible).
              // Rail is a bounded scrollport - whole panel scrolls inside, not the page.
              final viewportH = MediaQuery.sizeOf(context).height;
              final basis =
                  constraints.maxHeight.isFinite && constraints.maxHeight > 0
                      ? constraints.maxHeight
                      : viewportH;
              // Keep rail compact so the board can use full width on phone/tablet.
              final railH = (basis * 0.30).clamp(200.0, 340.0);
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(child: center),
                  const SizedBox(height: 8),
                  SizedBox(height: railH, child: panel),
                ],
              );
            },
          );
          final home = homeChrome;
          Widget? liveStrip;
          if (home != null) {
            final poolLabels = PrizePoolCardLabels.fromHome(home);
            liveStrip = Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 16),
                Text(
                  home.liveSectionTitle,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  home.liveSectionBlurb,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 12),
                if (tournamentsLoading)
                  const SizedBox(
                    height: 220,
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (tournaments.isEmpty)
                  Text(
                    home.emptyLive,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                      fontSize: 13,
                    ),
                  )
                else
                  SizedBox(
                    height: 280,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: tournaments.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 12),
                      itemBuilder: (context, i) {
                        final t = tournaments[i];
                        final tChrome = tournamentsPlayerChrome;
                        final cta = resolveCupCardCta(
                          CupLifecycleFields(
                            startedAt: t.startedAt,
                            finishedAt: t.finishedAt,
                          ),
                          enrolled: t.viewerEnrolled,
                          isFree: t.isFree,
                          liveGameId: (t.liveGameId ?? '').trim(),
                          labels: CupCardCtaLabels(
                            joinAction: softTournamentsJoinAction(
                              (tChrome?.joinAction ?? '').trim().isNotEmpty
                                  ? (tChrome?.joinAction ?? '')
                                  : home.joinCta,
                            ),
                            enrollAction: softTournamentsEnrollAction(
                              (tChrome?.enrollAction ?? '').trim().isNotEmpty
                                  ? (tChrome?.enrollAction ?? '')
                                  : home.enrollCta,
                            ),
                            lobbyAction: (tChrome?.lobbyAction ?? '').trim(),
                            watchAction: (tChrome?.watchAction ?? '').trim(),
                            resultsAction:
                                (tChrome?.resultsAction ?? '').trim(),
                          ),
                        );
                        return SizedBox(
                          width: 200,
                          child: TournamentMiniCard(
                            tournament: t,
                            carouselAria: softCommunityCarouselAria(
                              home.carouselAria,
                            ),
                            playersLabel:
                                softTournamentsPlayersLabel(home.playersLabel),
                            unlimitedPlayersLabel:
                                tChrome?.unlimitedPlayersLabel ?? '',
                            entryLabel: softTournamentsFilterEntryLabel(
                              home.entryLabel,
                            ),
                            freeLabel: softTournamentsFreeLabel(home.freeLabel),
                            ctaLabel: cta.label,
                            metaSeparator: home.metaSeparator,
                            amountCurrencySeparator:
                                home.amountCurrencySeparator,
                            emptyValue: home.emptyValue,
                            statusLabel: cupLifecycleStatusLabel(
                              CupLifecycleFields(
                                startedAt: t.startedAt,
                                finishedAt: t.finishedAt,
                              ),
                              CupLifecycleLabelChrome(
                                openLabel:
                                    tChrome?.filterLifecycleOpenLabel ?? '',
                                liveLabel:
                                    tChrome?.filterLifecycleLiveLabel ?? '',
                                finishedLabel:
                                    tChrome?.filterLifecycleFinishedLabel ?? '',
                              ),
                              fallback: t.statusLabel.isNotEmpty
                                  ? t.statusLabel
                                  : t.status,
                            ),
                            prizePoolLabels: poolLabels,
                            sourceBadge:
                                tournamentsOfficialBadge.trim().isNotEmpty
                                    ? tournamentsOfficialBadge.trim()
                                    : null,
                            onEnroll: () => onEnroll(t),
                          ),
                        );
                      },
                    ),
                  ),
              ],
            );
          } else if (tournamentsUnavailable.trim().isNotEmpty) {
            liveStrip = Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(
                softCommunityChromeUnavailable(tournamentsUnavailable),
                style: TextStyle(color: damaColorsOf(context).danger),
              ),
            );
          }
          if (liveStrip == null) return hub;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: hub),
              liveStrip,
            ],
          );
        },
      ),
    );
  }
}

List<List<dynamic>> _previewStartingBoard({int size = 10, int setupRows = 4}) {
  final board = List.generate(
    size,
    (_) => List<dynamic>.filled(size, null),
  );
  for (var r = 0; r < size; r++) {
    for (var c = 0; c < size; c++) {
      if ((r + c).isEven) continue;
      if (r < setupRows) {
        board[r][c] = {'p': 2, 'k': false};
      } else if (r >= size - setupRows) {
        board[r][c] = {'p': 1, 'k': false};
      }
    }
  }
  return board;
}

class _HomePreviewBoard3D extends StatelessWidget {
  const _HomePreviewBoard3D({
    required this.opponentLabel,
    required this.playerLabel,
    required this.clockLabel,
    required this.boardViewToggle,
    this.vsLabel = '',
  });

  final String opponentLabel;
  final String playerLabel;
  final String clockLabel;
  final Widget boardViewToggle;
  final String vsLabel;

  @override
  Widget build(BuildContext context) {
    final board = _previewStartingBoard();
    final frame = PlayBoardFrame(
      vsLabel: vsLabel,
      topSeat: opponentLabel.trim().isNotEmpty
          ? _SideSeatChip(
              label: opponentLabel,
              clock: clockLabel,
              muted: true,
              pieceSideLight: false,
              trailing: boardViewToggle,
            )
          : boardViewToggle,
      bottomSeat: playerLabel.trim().isNotEmpty
          ? _SideSeatChip(
              label: playerLabel,
              clock: clockLabel,
              muted: false,
              pieceSideLight: true,
              clockActive: true,
            )
          : const SizedBox.shrink(),
      board: DraughtsBoard3D(
        board: board,
        boardSize: 10,
        legalMoves: const [],
        selectedRow: null,
        selectedCol: null,
        onSelectSquare: (_, __) {},
        interactive: false,
      ),
    );
    // Frame owns square board + top/bottom seats (do not force outer square).
    return frame;
  }
}

class _HomePreviewBoard extends StatelessWidget {
  const _HomePreviewBoard({
    required this.opponentLabel,
    required this.playerLabel,
    required this.clockLabel,
    required this.boardViewToggle,
    this.vsLabel = '',
  });

  final String opponentLabel;
  final String playerLabel;
  final String clockLabel;
  final Widget boardViewToggle;
  final String vsLabel;

  static const _size = 10;

  bool _isDark(int row, int col) => (row + col).isOdd;

  String? _piece(int row, int col) {
    if (!_isDark(row, col)) return null;
    if (row < 4) return 'dark';
    if (row > 5) return 'light';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final frame = PlayBoardFrame(
      vsLabel: vsLabel,
      topSeat: opponentLabel.trim().isNotEmpty
          ? _SideSeatChip(
              label: opponentLabel,
              clock: clockLabel,
              muted: true,
              pieceSideLight: false,
              trailing: boardViewToggle,
            )
          : boardViewToggle,
      bottomSeat: playerLabel.trim().isNotEmpty
          ? _SideSeatChip(
              label: playerLabel,
              clock: clockLabel,
              muted: false,
              pieceSideLight: true,
              clockActive: true,
            )
          : const SizedBox.shrink(),
      board: GridView.builder(
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: _size,
        ),
        itemCount: _size * _size,
        itemBuilder: (context, i) {
          final row = i ~/ _size;
          final col = i % _size;
          final dark = _isDark(row, col);
          final piece = _piece(row, col);
          final ink = boardCoordUsesLightInk(dark)
              ? tokens.boardLight
              : tokens.boardDark;
          final showRank = isVisualLeftFile(col, _size, false);
          final showFile = isVisualBottomRank(row, _size, false);
          const coordStyle = TextStyle(
            fontSize: 9,
            fontWeight: FontWeight.w700,
            height: 1,
          );
          return ColoredBox(
            color: dark ? tokens.boardDark : tokens.boardLight,
            child: Stack(
              children: [
                if (showRank)
                  Positioned(
                    left: 3,
                    top: 2,
                    child: Text(
                      '${boardRankNumber(row, _size)}',
                      style: coordStyle.copyWith(color: ink),
                    ),
                  ),
                if (showFile)
                  Positioned(
                    right: 3,
                    bottom: 2,
                    child: Text(
                      boardFileLetter(col),
                      style: coordStyle.copyWith(color: ink),
                    ),
                  ),
                if (piece != null)
                  Center(
                    child: FractionallySizedBox(
                      widthFactor: 0.78,
                      heightFactor: 0.78,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: piece == 'light'
                              ? tokens.pieceLight
                              : tokens.pieceDark,
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x33000000),
                              blurRadius: 2,
                              offset: Offset(0, 1),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
    // Frame owns square board + top/bottom seats (do not force outer square).
    return frame;
  }
}

class _SideSeatChip extends StatelessWidget {
  const _SideSeatChip({
    required this.label,
    required this.muted,
    this.clock = '',
    this.pieceSideLight = true,
    this.trailing,
    this.clockActive = false,
  });

  final String label;
  final bool muted;
  final String clock;

  /// true = palette light pieces, false = palette dark pieces.
  final bool pieceSideLight;
  final Widget? trailing;
  final bool clockActive;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final trimmed = label.trim();
    if (trimmed.isEmpty) return const SizedBox.shrink();
    final clockText = clock.trim();
    // Seat swatch = that seat's piece color (web BoardSeatBar parity).
    final swatch = pieceSideLight ? tokens.pieceLight : tokens.pieceDark;
    final active = clockActive;
    return Row(
      children: [
        Expanded(
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: swatch,
                  borderRadius: BorderRadius.circular(3),
                  border: Border.all(color: const Color(0x4D000000)),
                ),
                clipBehavior: Clip.antiAlias,
                child: DamaUserAvatar(
                  radius: 16,
                  pieceSideLight: pieceSideLight,
                  showMarkPlate: false,
                ),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  trimmed,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
              ),
            ],
          ),
        ),
        if (trailing != null) ...[
          const SizedBox(width: 6),
          trailing!,
        ],
        if (clockText.isNotEmpty) ...[
          const SizedBox(width: 6),
          Container(
            constraints: const BoxConstraints(minWidth: 72),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: active ? Colors.white : tokens.surfaceMuted,
              borderRadius: BorderRadius.circular(3),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (active) ...[
                  Icon(Icons.schedule,
                      size: 14, color: Colors.black.withValues(alpha: 0.75)),
                  const SizedBox(width: 4),
                ],
                Text(
                  clockText,
                  style: TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    fontFeatures: const [FontFeature.tabularFigures()],
                    color: active ? Colors.black : tokens.onSurfaceMuted,
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
