import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/cup_lifecycle.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/payment_modal_chrome.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/core/ui/skip_pagination_bar.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/auth/sign_in_dialog.dart';
import 'package:dama_mobile/features/notifications/notification_app_bar_actions.dart';
import 'package:dama_mobile/features/events/community_player_chrome_soft.dart';
import 'package:dama_mobile/features/events/player_events_hub.dart';
import 'package:dama_mobile/features/events/public_events_browse.dart'
    show EventEntryFilter;
import 'package:dama_mobile/features/game/spectate_page.dart';
import 'package:dama_mobile/features/home/show_play_rail_sheet.dart';
import 'package:dama_mobile/features/tournaments/payment_enroll_dialog.dart';
import 'package:dama_mobile/features/tournaments/tournament_cup_lobby_sheet.dart';
import 'package:dama_mobile/features/tournaments/tournament_mini_card.dart';
import 'package:dama_mobile/features/tournaments/tournaments_cubit.dart';
import 'package:dama_mobile/widgets/player_rail_menu_leading.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;

/// Tournament list UI; free cups Join silently; paid opens payment modal.
/// Parity with web: Material [SliverAppBar] floating+snap filters, collapsible
/// Filters panel on all widths, search below entry chips, debounced search,
/// card-grid skeleton (never play board), pagination breathing room.
class TournamentsPage extends StatefulWidget {
  TournamentsPage({
    super.key,
    required this.accessToken,
    this.focusId,
    this.initialSource = 'all',
    this.initialJoinCode,
    ApiConfig? config,
  }) : config = config ?? ApiConfig.defaults;

  final String accessToken;

  /// Notification deep-link tournament id (`/?view=tournaments&id=`).
  final String? focusId;

  /// `all` | `official` | `community` - unified Tournament discovery.
  final String initialSource;

  /// Community join-code deep link (legacy `/?view=events&code=`).
  final String? initialJoinCode;
  final ApiConfig config;

  @override
  State<TournamentsPage> createState() => _TournamentsPageState();
}

class _TournamentsPageState extends State<TournamentsPage> {
  TournamentsPlayerChrome? _chrome;
  PaymentModalChrome? _payChrome;
  String? _chromeError;
  bool _chromeLoading = true;

  /// Play rail FAB label (lobby_title) - loaded best-effort for tablet/phone.
  String _playRailFabLabel = '';

  late String _source;

  /// Points/status deep-link `id=` may be Official or Community - classify once.
  String? _focusOfficialId;
  String? _focusCommunityId;
  bool _focusClassified = false;

  @override
  void initState() {
    super.initState();
    final raw = widget.initialSource.trim().toLowerCase();
    _source =
        (raw == 'official' || raw == 'community' || raw == 'all') ? raw : 'all';
    // Invite join codes belong on Community (join strip hidden when All embeds filters).
    final joinCode = (widget.initialJoinCode ?? '').trim();
    if (joinCode.isNotEmpty && _source == 'all') {
      _source = 'community';
    }
    unawaited(_classifyFocusId());
    unawaited(_loadPlayRailFabLabel());
    _loadChrome();
  }

  Future<void> _loadPlayRailFabLabel() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/public/play-chrome'),
      );
      if (res.statusCode >= 300) return;
      final chrome = PlayChrome.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      if (chrome == null) return;
      final label =
          (chrome.lobbyTitle.isNotEmpty ? chrome.lobbyTitle : chrome.pageTitle)
              .trim();
      if (!mounted || label.isEmpty) return;
      setState(() => _playRailFabLabel = label);
    } catch (_) {}
  }

  /// All-tab + shared points notif (`/?view=tournaments&id=`) must not send a
  /// hosted cup id only to Official (or a platform id only to Community).
  Future<void> _classifyFocusId() async {
    final id = (widget.focusId ?? '').trim();
    if (id.isEmpty) {
      if (mounted) setState(() => _focusClassified = true);
      return;
    }
    if (_source == 'community') {
      if (mounted) {
        setState(() {
          _focusCommunityId = id;
          _focusClassified = true;
        });
      }
      return;
    }
    if (_source == 'official') {
      if (mounted) {
        setState(() {
          _focusOfficialId = id;
          _focusClassified = true;
        });
      }
      return;
    }
    // source=all: probe Official then Community (fail closed).
    try {
      final headers = <String, String>{};
      final token = widget.accessToken.trim();
      if (token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
      final rest = widget.config.restUrl.replaceAll(RegExp(r'/$'), '');
      final tRes = await http.get(
        Uri.parse('$rest/tournaments/$id'),
        headers: headers,
      );
      if (!mounted) return;
      if (tRes.statusCode < 300) {
        setState(() {
          _focusOfficialId = id;
          _focusClassified = true;
        });
        return;
      }
      // Same rest base as Official probe (never ApiConfig.baseUrl - may throw /
      // disagree with injected config).
      final eRes = await http.get(
        Uri.parse('$rest/events/$id'),
        headers: headers,
      );
      if (!mounted) return;
      if (eRes.statusCode < 300) {
        setState(() {
          _focusCommunityId = id;
          _focusClassified = true;
        });
        return;
      }
    } catch (_) {}
    if (mounted) setState(() => _focusClassified = true);
  }

  Future<void> _loadChrome() async {
    try {
      final results = await Future.wait([
        http.get(
          Uri.parse(
              '${widget.config.restUrl}/public/tournaments-player-chrome'),
        ),
        http.get(
          Uri.parse('${widget.config.restUrl}/public/payment-modal-chrome'),
        ),
      ]);
      final res = results[0];
      final payRes = results[1];
      Map<String, dynamic>? map;
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) map = decoded;
      } catch (_) {}
      final fromBody =
          (map?['tournaments_player_chrome_unavailable'] as String?)?.trim() ??
              '';
      PaymentModalChrome? payChrome;
      if (payRes.statusCode == 200) {
        try {
          final decoded = jsonDecode(payRes.body);
          if (decoded is Map<String, dynamic>) {
            payChrome = PaymentModalChrome.fromJson(decoded);
          }
        } catch (_) {}
      }
      if (res.statusCode != 200) {
        if (!mounted) return;
        setState(() {
          _chromeLoading = false;
          _payChrome = payChrome;
          _chromeError = softCommunityChromeUnavailable(
            fromBody.isNotEmpty
                ? fromBody
                : ((map?['error'] as String?)?.trim() ?? ''),
          );
        });
        return;
      }
      final chrome = TournamentsPlayerChrome.fromJson(map);
      if (!mounted) return;
      setState(() {
        _chrome = chrome;
        _payChrome = payChrome;
        _chromeLoading = false;
        _chromeError =
            chrome == null ? softCommunityChromeUnavailable(fromBody) : null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _chromeLoading = false;
        // Fail-closed: no invented English - empty until chrome/body supplies copy.
        _chromeError = softCommunityChromeUnavailable('');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // Wait for id classify so All-tab Community gets hosted focus before hub mounts.
    if (_chromeLoading || !_focusClassified) {
      return Scaffold(
        appBar: AppBar(
          leading: PlayerRailMenuLeading.maybe(context),
          actions: const [NotificationAppBarActions()],
        ),
        body: const TournamentsPageSkeleton(),
      );
    }
    final chrome = _chrome;
    if (chrome == null) {
      return Scaffold(
        appBar: AppBar(
          leading: PlayerRailMenuLeading.maybe(context),
          actions: const [NotificationAppBarActions()],
        ),
        body: Center(
          child: Text(
            (_chromeError ?? '').isNotEmpty ? _chromeError! : '',
            style: TextStyle(color: damaColorsOf(context).danger),
          ),
        ),
      );
    }
    final sourceReady = chrome.filterSourceLabel.isNotEmpty &&
        chrome.filterSourceAllLabel.isNotEmpty &&
        chrome.filterSourceOfficialLabel.isNotEmpty &&
        chrome.filterSourceCommunityLabel.isNotEmpty;
    final showOfficial = _source == 'all' || _source == 'official';
    final showCommunity = _source == 'all' || _source == 'community';
    final officialBadge =
        softTournamentsBadgeOfficial(chrome.badgeOfficialLabel).trim();
    final communityBadge =
        softTournamentsBadgeCommunity(chrome.badgeCommunityLabel).trim();

    Widget sourceChips() {
      if (!sourceReady) return const SizedBox.shrink();
      final opts = <(String, String)>[
        ('all', softTournamentsFilterSourceAll(chrome.filterSourceAllLabel)),
        (
          'official',
          softTournamentsFilterSourceOfficial(chrome.filterSourceOfficialLabel)
        ),
        (
          'community',
          softTournamentsFilterSourceCommunity(
            chrome.filterSourceCommunityLabel,
          )
        ),
      ];
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              softTournamentsFilterSourceLabel(chrome.filterSourceLabel),
              style: TextStyle(
                color: damaColorsOf(context).onSurfaceMuted,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final o in opts)
                  ChoiceChip(
                    label: Text(o.$2),
                    selected: _source == o.$1,
                    onSelected: (_) => setState(() => _source = o.$1),
                  ),
              ],
            ),
          ],
        ),
      );
    }

    Widget officialPane() {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_source == 'all' && officialBadge.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Text(
                officialBadge,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          Expanded(
            child: _TournamentsView(
              accessToken: widget.accessToken,
              chrome: chrome,
              payChrome: _payChrome,
              // Classified Official id (All-tab probes; Community tab clears).
              focusId: _focusOfficialId,
              config: widget.config,
              sourceBadge: officialBadge.isNotEmpty ? officialBadge : null,
              emptyOverride: () {
                final official =
                    softTournamentsEmptyOfficial(chrome.emptyOfficial.trim());
                if (official.isNotEmpty) return official;
                final empty = softTournamentsEmpty(chrome.empty.trim());
                return empty.isNotEmpty ? empty : null;
              }(),
              hideAppBar: true,
            ),
          ),
        ],
      );
    }

    Widget communityPane({
      EventEntryFilter? controlledEntry,
      String? controlledSearch,
      CupLifecyclePhase? controlledLifecycle,
      bool? controlledMine,
    }) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_source == 'all' && communityBadge.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Text(
                communityBadge,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          Expanded(
            child: PlayerEventsHub(
              accessToken: widget.accessToken,
              // Classified Community id (All-tab points notif parity with web).
              initialEventId: _focusCommunityId,
              initialJoinCode: widget.initialJoinCode,
              embedded: true,
              sourceBadge: communityBadge.isNotEmpty ? communityBadge : null,
              hideOuterFilters: _source == 'all',
              controlledEntryFilter: controlledEntry,
              controlledSearchQ: controlledSearch,
              controlledLifecycle: controlledLifecycle,
              controlledMine: controlledMine,
              emptyOverride:
                  softCommunityEmpty(chrome.emptyCommunity.trim()).isNotEmpty
                      ? softCommunityEmpty(chrome.emptyCommunity.trim())
                      : null,
            ),
          ),
        ],
      );
    }

    EventEntryFilter mapEntry(TournamentEntryFilter f) => switch (f) {
          TournamentEntryFilter.all => EventEntryFilter.all,
          TournamentEntryFilter.free => EventEntryFilter.free,
          TournamentEntryFilter.paid => EventEntryFilter.paid,
        };

    Widget lists;
    if (showOfficial && showCommunity) {
      // Shared Official filters drive Community list on All tab (web parity).
      lists = BlocProvider(
        create: (_) => TournamentsCubit(
          accessToken: widget.accessToken,
          config: widget.config,
          chrome: chrome,
        )..load(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: officialPane()),
            Expanded(
              child: BlocBuilder<TournamentsCubit, TournamentsState>(
                buildWhen: (prev, next) =>
                    prev.entryFilter != next.entryFilter ||
                    prev.searchQ != next.searchQ ||
                    prev.lifecycle != next.lifecycle ||
                    prev.mine != next.mine,
                builder: (context, state) => communityPane(
                  controlledEntry: mapEntry(state.entryFilter),
                  controlledSearch: state.searchQ,
                  controlledLifecycle: state.lifecycle,
                  controlledMine: state.mine,
                ),
              ),
            ),
          ],
        ),
      );
    } else if (showOfficial) {
      lists = BlocProvider(
        create: (_) => TournamentsCubit(
          accessToken: widget.accessToken,
          config: widget.config,
          chrome: chrome,
        )..load(),
        child: officialPane(),
      );
    } else {
      lists = communityPane();
    }

    // Web max-lg: play rail is a FAB → sheet (center list scrolls alone).
    final compactPlayRail = MediaQuery.sizeOf(context).width < 1024;
    final fabLabel = _playRailFabLabel.trim();

    return Scaffold(
      appBar: AppBar(
        leading: PlayerRailMenuLeading.maybe(context),
        title: Text(softTournamentsPageTitle(chrome.pageTitle)),
        actions: const [NotificationAppBarActions()],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (sourceReady) sourceChips(),
          Expanded(child: lists),
        ],
      ),
      floatingActionButton: compactPlayRail && fabLabel.isNotEmpty
          ? FloatingActionButton.extended(
              onPressed: () => unawaited(showPlayRailSheet(context)),
              icon: const Icon(Icons.layers_outlined),
              label: Text(fabLabel),
            )
          : null,
    );
  }
}

class _TournamentsView extends StatefulWidget {
  const _TournamentsView({
    required this.accessToken,
    required this.chrome,
    required this.payChrome,
    required this.config,
    this.focusId,
    this.sourceBadge,
    this.emptyOverride,
    this.hideAppBar = false,
  });

  final String accessToken;
  final TournamentsPlayerChrome chrome;
  final PaymentModalChrome? payChrome;
  final ApiConfig config;
  final String? focusId;
  final String? sourceBadge;
  final String? emptyOverride;
  final bool hideAppBar;

  @override
  State<_TournamentsView> createState() => _TournamentsViewState();
}

class _TournamentsViewState extends State<_TournamentsView> {
  String? _openedFocusId;
  String? _focusFetchStarted;
  final _searchCtrl = TextEditingController();
  Timer? _searchDebounce;
  Timer? _scrollLockTimer;
  late bool _filtersOpen;
  bool _filtersVisible = true;
  bool _scrollLock = false;
  double _lastScrollOffset = 0;

  static const _scrollThreshold = 12.0;
  static const _topRevealPx = 40.0;

  int get _searchDebounceMs {
    final n = int.tryParse(widget.chrome.searchDebounceMs.trim());
    return n != null && n >= 0 ? n : 0;
  }

  bool get _signedIn {
    if (widget.accessToken.trim().isNotEmpty) return true;
    final auth = context.read<AuthCubit>().state;
    return auth.isAuthenticated && (auth.token ?? '').trim().isNotEmpty;
  }

  CupCardCtaLabels _cardCtaLabels(TournamentsPlayerChrome chrome) {
    return CupCardCtaLabels(
      joinAction: softTournamentsJoinAction(chrome.joinAction),
      enrollAction: softTournamentsEnrollAction(chrome.enrollAction),
      lobbyAction: chrome.lobbyAction,
      watchAction: chrome.watchAction,
      resultsAction: chrome.resultsAction,
    );
  }

  String _lifecycleChipLabel(
    TournamentsPlayerChrome chrome,
    CupLifecyclePhase phase,
  ) {
    switch (phase) {
      case CupLifecyclePhase.open:
        return chrome.filterLifecycleOpenLabel;
      case CupLifecyclePhase.live:
        return chrome.filterLifecycleLiveLabel;
      case CupLifecyclePhase.finished:
        return chrome.filterLifecycleFinishedLabel;
    }
  }

  String _discoveryEmpty(
      TournamentsState state, TournamentsPlayerChrome chrome) {
    final override = (widget.emptyOverride ?? '').trim();
    if (override.isNotEmpty) return override;
    if (state.mine) return chrome.emptyMine;
    switch (state.lifecycle) {
      case CupLifecyclePhase.open:
        return chrome.emptyLifecycleOpen;
      case CupLifecyclePhase.live:
        return chrome.emptyLifecycleLive;
      case CupLifecyclePhase.finished:
        return chrome.emptyLifecycleFinished;
    }
  }

  @override
  void initState() {
    super.initState();
    // Collapsed behind Filters CTA on all widths (web TournamentListFilters parity).
    _filtersOpen = false;
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _scrollLockTimer?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearchChanged(String raw) {
    _searchDebounce?.cancel();
    final ms = _searchDebounceMs;
    _searchDebounce = Timer(Duration(milliseconds: ms), () {
      if (!mounted) return;
      context.read<TournamentsCubit>().setSearchQ(raw);
    });
  }

  void _lockScrollBriefly() {
    _scrollLock = true;
    _scrollLockTimer?.cancel();
    _scrollLockTimer = Timer(const Duration(milliseconds: 420), () {
      _scrollLock = false;
    });
  }

  void _setFiltersVisible(bool visible) {
    if (_filtersVisible == visible) return;
    setState(() => _filtersVisible = visible);
    _lockScrollBriefly();
  }

  bool _onScroll(ScrollNotification notification) {
    if (notification is! ScrollUpdateNotification) return false;
    if (notification.metrics.axis != Axis.vertical) return false;
    // Center list only - ignore nested scrollables (cards, chips, sheets).
    if (notification.depth > 0) return false;
    // Hide/show while Filters is expanded too; _scrollLock covers the open toggle jump.
    if (_scrollLock) {
      _lastScrollOffset = notification.metrics.pixels;
      return false;
    }
    final offset = notification.metrics.pixels;
    final delta = offset - _lastScrollOffset;
    _lastScrollOffset = offset;
    if (offset <= _topRevealPx) {
      _setFiltersVisible(true);
      return false;
    }
    if (delta > _scrollThreshold) {
      _setFiltersVisible(false);
    } else if (delta < -_scrollThreshold) {
      _setFiltersVisible(true);
    }
    return false;
  }

  /// Community hub parity: guest Official enroll/lobby prompts sign-in first.
  Future<String?> _ensureToken() async {
    final existing = widget.accessToken.trim();
    if (existing.isNotEmpty) return existing;
    final auth = context.read<AuthCubit>().state;
    if (auth.isAuthenticated) {
      final t = (auth.token ?? '').trim();
      if (t.isNotEmpty) return t;
    }
    return showSignInDialog(context);
  }

  /// Cup lobby sheet when seated (`focusId` deep link parity with web).
  Future<void> _openCupLobby(
    BuildContext context,
    String tournamentId, {
    String? accessToken,
  }) async {
    final id = tournamentId.trim();
    if (id.isEmpty) return;
    final chrome = widget.chrome;
    if (!chrome.isReady) return;
    final token = (accessToken ?? widget.accessToken).trim();
    if (token.isEmpty) return;
    await showTournamentCupLobbySheet(
      context,
      tournamentId: id,
      accessToken: token,
      chrome: chrome,
      config: widget.config,
    );
  }

  /// Deep-link cups not on the current list page: GET /tournaments/{id} (web detail parity).
  Future<void> _resolveFocusTournament(
      BuildContext context, String focusId) async {
    final id = focusId.trim();
    if (id.isEmpty) return;
    try {
      final headers = <String, String>{};
      final token = widget.accessToken.trim();
      if (token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
      final res = await http.get(
        Uri.parse('${widget.config.restUrl}/tournaments/$id'),
        headers: headers,
      );
      if (!context.mounted) return;
      if (res.statusCode >= 300) {
        _openedFocusId = id;
        return;
      }
      final decoded = jsonDecode(res.body);
      if (decoded is! Map<String, dynamic>) {
        _openedFocusId = id;
        return;
      }
      final match = RestTournament.fromJson(decoded);
      _openedFocusId = id;
      if (shouldOpenTournamentCupLobby(
        enrolled: match.viewerEnrolled,
        startedAt: match.startedAt,
        finishedAt: match.finishedAt,
      )) {
        final token = await _ensureToken();
        if (!context.mounted || token == null || token.trim().isEmpty) return;
        await _openCupLobby(context, match.id, accessToken: token.trim());
        return;
      }
      await _onCta(context, match);
    } catch (_) {
      if (!mounted) return;
      _openedFocusId = id;
    }
  }

  Future<void> _onCta(BuildContext context, RestTournament t) async {
    final chrome = widget.chrome;
    final liveGameId = (t.liveGameId ?? '').trim();
    final cta = resolveCupCardCta(
      CupLifecycleFields(startedAt: t.startedAt, finishedAt: t.finishedAt),
      enrolled: t.viewerEnrolled,
      isFree: t.isFree,
      liveGameId: liveGameId,
      labels: _cardCtaLabels(chrome),
    );
    if (cta.kind == CupCardCtaKind.watch && liveGameId.isNotEmpty) {
      final token = await _ensureToken();
      if (!context.mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => SpectatePage(
            accessToken: token?.trim(),
            initialGameId: liveGameId,
          ),
        ),
      );
      return;
    }
    if (cta.kind != CupCardCtaKind.enroll) {
      final token = await _ensureToken();
      if (!context.mounted || token == null || token.trim().isEmpty) return;
      await _openCupLobby(context, t.id, accessToken: token.trim());
      return;
    }
    if (t.isFree) {
      // Web Official enroll parity: guest must sign in before enroll.
      final token = await _ensureToken();
      if (!context.mounted || token == null || token.trim().isEmpty) return;
      final cubit = context.read<TournamentsCubit>();
      final goPlay = await cubit.joinFree(t.id, bearerToken: token.trim());
      if (!context.mounted) return;
      final st = cubit.state;
      if (st.alreadyEnrolled) {
        final msg = softCommunityJoinStatusMessage(
          widget.payChrome?.alreadyEnrolled ?? '',
        );
        if (msg.isNotEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(msg)));
        }
      } else if ((st.enrollMessage ?? '').trim().isNotEmpty) {
        final ok = softCommunityJoinStatusMessage(st.enrollMessage!);
        if (ok.isNotEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(ok)),
          );
        }
      } else if ((st.error ?? '').trim().isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(st.error!.trim())),
        );
      }
      if (goPlay) {
        await _openCupLobby(context, t.id, accessToken: token.trim());
      }
      return;
    }
    final token = await _ensureToken();
    if (!context.mounted || token == null || token.trim().isEmpty) return;
    final enrolled = await showPaymentEnrollDialog(
      context,
      tournament: t,
      prizePoolLabels: PrizePoolCardLabels.fromTournaments(widget.chrome),
    );
    if (!context.mounted) return;
    await context.read<TournamentsCubit>().refresh();
    if (!context.mounted) return;
    if (enrolled) {
      await _openCupLobby(context, t.id, accessToken: token.trim());
    }
  }

  /// Entry chips first, search always below (never elevated to the top row).
  Widget _filterPanel(TournamentsState state, DamaColors tokens) {
    final chrome = widget.chrome;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          chrome.filterLifecycleLabel,
          style: TextStyle(
            color: tokens.onSurfaceMuted,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 6),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final phase in CupLifecyclePhase.values)
              ChoiceChip(
                label: Text(_lifecycleChipLabel(chrome, phase)),
                selected: state.lifecycle == phase,
                onSelected: state.busy
                    ? null
                    : (_) =>
                        context.read<TournamentsCubit>().setLifecycle(phase),
              ),
            if (_signedIn)
              FilterChip(
                label: Text(chrome.filterMineLabel),
                selected: state.mine,
                onSelected: state.busy
                    ? null
                    : (v) => context.read<TournamentsCubit>().setMine(v),
              ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          softTournamentsFilterEntryLabel(chrome.filterEntryLabel),
          style: TextStyle(
            color: tokens.onSurfaceMuted,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 6),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final f in TournamentEntryFilter.values)
              ChoiceChip(
                label: Text(
                  switch (f) {
                    TournamentEntryFilter.all =>
                      softTournamentsFilterEntryAll(chrome.filterAllLabel),
                    TournamentEntryFilter.free =>
                      softTournamentsFilterEntryFree(chrome.filterFreeLabel),
                    TournamentEntryFilter.paid =>
                      softTournamentsFilterEntryPaid(chrome.filterPaidLabel),
                  },
                ),
                selected: state.entryFilter == f,
                onSelected: state.busy
                    ? null
                    : (_) => context.read<TournamentsCubit>().setEntryFilter(f),
              ),
          ],
        ),
        const SizedBox(height: 12),
        // Label above the field (web Field parity) - avoids Material floating-label
        // clip inside SliverAppBar PreferredSize on phone/tablet focus.
        Text(
          softCommunitySearchLabel(chrome.searchLabel),
          style: TextStyle(
            color: tokens.onSurfaceMuted,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 6),
        Padding(
          padding: const EdgeInsets.fromLTRB(2, 2, 2, 4),
          child: TextField(
            controller: _searchCtrl,
            decoration: InputDecoration(
              hintText:
                  softCommunitySearchPlaceholder(chrome.searchPlaceholder),
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(
                  color: tokens.onSurfaceMuted.withValues(alpha: 0.35),
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(
                  color: Theme.of(context).colorScheme.primary,
                  width: 2,
                ),
              ),
              prefixIcon: const Icon(Icons.search),
              isDense: true,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
            ),
            textInputAction: TextInputAction.search,
            onChanged: state.busy ? null : _onSearchChanged,
            onSubmitted: state.busy
                ? null
                : (v) {
                    _searchDebounce?.cancel();
                    context.read<TournamentsCubit>().setSearchQ(v);
                  },
          ),
        ),
      ],
    );
  }

  Widget _filterChrome(TournamentsState state, DamaColors tokens) {
    final chrome = widget.chrome;
    // Tournament page only: Live tournaments / enroll blurb - commented out.
    // final blurb = chrome.pageBlurb.trim();
    return Material(
      color: Theme.of(context).scaffoldBackgroundColor,
      // Keep filter chrome above scrolling card carousels.
      elevation: 1,
      shadowColor: Colors.black26,
      clipBehavior: Clip.hardEdge,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // if (blurb.isNotEmpty) ...[
            //   Text(
            //     blurb,
            //     style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 13),
            //   ),
            //   const SizedBox(height: 10),
            // ],
            Semantics(
              button: true,
              expanded: _filtersOpen,
              label: _filtersOpen
                  ? softTournamentsFiltersToggleHideAria(
                      chrome.filtersToggleHideAria,
                    )
                  : softTournamentsFiltersToggleShowAria(
                      chrome.filtersToggleShowAria,
                    ),
              child: OutlinedButton(
                onPressed: () {
                  setState(() {
                    _filtersOpen = !_filtersOpen;
                    _filtersVisible = true;
                  });
                  _lockScrollBriefly();
                },
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.tune, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        softTournamentsFiltersToggleLabel(
                          chrome.filtersToggleLabel,
                        ),
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                    AnimatedRotation(
                      turns: _filtersOpen ? 0.5 : 0,
                      duration: const Duration(milliseconds: 280),
                      curve: Curves.easeOutCubic,
                      child: Icon(
                        Icons.expand_more,
                        size: 20,
                        color: tokens.onSurfaceMuted,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (_filtersOpen)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: _filterPanel(state, tokens),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final chrome = widget.chrome;

    final body = BlocConsumer<TournamentsCubit, TournamentsState>(
      listener: (context, state) {
        final focus = (widget.focusId ?? '').trim();
        if (focus.isEmpty || _openedFocusId == focus || state.loading) return;
        RestTournament? match;
        for (final t in state.rows) {
          if (t.id == focus) {
            match = t;
            break;
          }
        }
        if (match == null) {
          // Not on this page of the list: fetch detail once (notif deep-link).
          if (_focusFetchStarted == focus) return;
          _focusFetchStarted = focus;
          unawaited(_resolveFocusTournament(context, focus));
          return;
        }
        _openedFocusId = focus;
        final focused = match;
        if (shouldOpenTournamentCupLobby(
          enrolled: focused.viewerEnrolled,
          startedAt: focused.startedAt,
          finishedAt: focused.finishedAt,
        )) {
          final lobbyId = focused.id;
          unawaited(() async {
            final token = await _ensureToken();
            if (!mounted || token == null || token.trim().isEmpty) return;
            await _openCupLobby(context, lobbyId, accessToken: token.trim());
          }());
          return;
        }
        unawaited(_onCta(context, focused));
      },
      builder: (context, state) {
        final meta = state.meta;
        final emptyCopy = _discoveryEmpty(state, chrome);
        // Column + locked heightFactor hide/show (works phone/tablet/desktop).
        // Paused while phone Filters panel is open so expand does not snap shut.
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ClipRect(
              child: AnimatedAlign(
                duration: const Duration(milliseconds: 280),
                curve: Curves.easeOutCubic,
                heightFactor: _filtersVisible ? 1 : 0,
                alignment: Alignment.topCenter,
                child: ExcludeSemantics(
                  excluding: !_filtersVisible,
                  child: _filterChrome(state, tokens),
                ),
              ),
            ),
            // Reserved 2px slot - never insert/remove progress (pagination layout jump).
            SizedBox(
              height: 2,
              child: state.softFetching
                  ? const LinearProgressIndicator(minHeight: 2)
                  : const SizedBox.expand(),
            ),
            Expanded(
              child: NotificationListener<ScrollNotification>(
                onNotification: _onScroll,
                child: RefreshIndicator(
                  onRefresh: () => context.read<TournamentsCubit>().refresh(),
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                    children: [
                      if (state.loading) ...[
                        const TournamentListSkeleton(),
                        const SizedBox(height: 48),
                      ] else ...[
                        if (state.error != null)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Text(
                              state.error!,
                              style: TextStyle(color: tokens.danger),
                            ),
                          ),
                        if (state.rows.isEmpty && state.error == null)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 24),
                            child: Text(
                              emptyCopy,
                              style: TextStyle(color: tokens.onSurfaceMuted),
                            ),
                          ),
                        if (state.rows.isNotEmpty)
                          TournamentMiniCardGrid(
                            itemCount: state.rows.length,
                            itemBuilder: (context, i) {
                              final t = state.rows[i];
                              final liveGameId = (t.liveGameId ?? '').trim();
                              final cta = resolveCupCardCta(
                                CupLifecycleFields(
                                  startedAt: t.startedAt,
                                  finishedAt: t.finishedAt,
                                ),
                                enrolled: t.viewerEnrolled,
                                isFree: t.isFree,
                                liveGameId: liveGameId,
                                labels: _cardCtaLabels(chrome),
                              );
                              return TournamentMiniCard(
                                tournament: t,
                                carouselAria: softCommunityCarouselAria(
                                  chrome.carouselAria,
                                ),
                                playersLabel: softTournamentsPlayersLabel(
                                  chrome.playersLabel,
                                ),
                                unlimitedPlayersLabel:
                                    chrome.unlimitedPlayersLabel,
                                entryLabel: softTournamentsFilterEntryLabel(
                                  chrome.entryLabel,
                                ),
                                freeLabel:
                                    softTournamentsFreeLabel(chrome.freeLabel),
                                ctaLabel: cta.label,
                                metaSeparator: chrome.metaSeparator,
                                amountCurrencySeparator:
                                    chrome.amountCurrencySeparator,
                                emptyValue: chrome.emptyValue,
                                statusLabel: cupLifecycleStatusLabel(
                                  CupLifecycleFields(
                                    startedAt: t.startedAt,
                                    finishedAt: t.finishedAt,
                                  ),
                                  CupLifecycleLabelChrome(
                                    openLabel: chrome.filterLifecycleOpenLabel,
                                    liveLabel: chrome.filterLifecycleLiveLabel,
                                    finishedLabel:
                                        chrome.filterLifecycleFinishedLabel,
                                  ),
                                  fallback: t.statusLabel.isNotEmpty
                                      ? t.statusLabel
                                      : t.status,
                                ),
                                sourceBadge: widget.sourceBadge,
                                prizePoolLabels:
                                    PrizePoolCardLabels.fromTournaments(chrome),
                                onEnroll: t.id.isEmpty
                                    ? null
                                    : () => _onCta(context, t),
                              );
                            },
                          ),
                        if (meta != null && meta.totalPages > 1)
                          SkipPaginationBar(
                            meta: meta,
                            busy: state.softFetching,
                            padding: const EdgeInsets.fromLTRB(0, 32, 0, 32),
                            onSkip: (skip) =>
                                context.read<TournamentsCubit>().goSkip(skip),
                          )
                        else
                          const SizedBox(height: 24),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
    if (widget.hideAppBar) return body;
    return Scaffold(
      appBar: AppBar(
        actions: const [NotificationAppBarActions()],
      ),
      body: body,
    );
  }
}
