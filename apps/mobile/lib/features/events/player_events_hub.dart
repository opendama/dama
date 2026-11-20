import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/cache/skip_store.dart';
import 'package:dama_mobile/core/cup_lifecycle.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/gallery_carousel.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/core/ui/skip_pagination_bar.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/auth/sign_in_dialog.dart';
import 'package:dama_mobile/features/events/community_player_chrome_soft.dart';
import 'package:dama_mobile/features/events/event_cup_lobby_sheet.dart';
import 'package:dama_mobile/features/events/event_invite_share_url.dart';
import 'package:dama_mobile/features/events/event_join_error.dart';
import 'package:dama_mobile/features/events/payment_event_join_dialog.dart';
import 'package:dama_mobile/features/events/event_mini_card.dart';
import 'package:dama_mobile/features/game/spectate_page.dart';
import 'package:dama_mobile/features/events/public_events_browse.dart'
    show EventEntryFilter;
import 'package:dama_mobile/features/leaderboard/leaderboard_cubit.dart'
    show SkipMeta;
import 'package:dama_mobile/features/notifications/notification_app_bar_actions.dart';
import 'package:dama_mobile/features/notifications/notification_href_nav.dart';
import 'package:dama_mobile/features/player/player_inspect_sheet.dart';
import 'package:dama_mobile/features/wallet/portal_wallet_focus.dart';
import 'package:dama_mobile/features/wallet/wallet_page.dart';
import 'package:dama_mobile/widgets/dama_user_avatar.dart';
import 'package:dama_mobile/widgets/host_trust_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;
import 'package:web_socket_channel/web_socket_channel.dart';

/// Community tournament browse (hosted events).
/// Standalone legacy Events route; embedded under unified Tournaments.
/// Card / deep-link opens detail as a modal sheet (list stays mounted).
class PlayerEventsHub extends StatefulWidget {
  const PlayerEventsHub({
    super.key,
    this.accessToken,
    this.initialEventId,
    this.initialJoinCode,
    this.embedded = false,
    this.sourceBadge,
    this.hideOuterFilters = false,
    this.controlledEntryFilter,
    this.controlledSearchQ,
    this.controlledLifecycle,
    this.controlledMine,
    this.emptyOverride,
  });

  /// Nullable - browse is public; join prompts sign-in when missing.
  final String? accessToken;
  final String? initialEventId;
  final String? initialJoinCode;

  /// Inside unified Tournaments (Community / All) - no duplicate AppBar.
  final bool embedded;

  /// Community badge on cards.
  final String? sourceBadge;

  /// Parent owns Official|Community filters (All tab).
  final bool hideOuterFilters;

  /// All-tab free/paid from parent Official filters (when [hideOuterFilters]).
  final EventEntryFilter? controlledEntryFilter;

  /// All-tab search from parent Official filters (when [hideOuterFilters]).
  final String? controlledSearchQ;

  /// All-tab lifecycle from parent Official filters (when [hideOuterFilters]).
  final CupLifecyclePhase? controlledLifecycle;

  /// All-tab mine filter from parent (when [hideOuterFilters]).
  final bool? controlledMine;

  /// Unified hub empty copy (`tournaments_player_chrome.empty_community`).
  final String? emptyOverride;

  @override
  State<PlayerEventsHub> createState() => _PlayerEventsHubState();
}

class _PlayerEventsHubState extends State<PlayerEventsHub>
    with WidgetsBindingObserver {
  EventsPlayerChrome? _chrome;
  EventsCatalog? _catalog;

  /// True when catalog says hosted off, or GET /events/catalog returned 503.
  bool _catalogFeatureOff = false;
  String _unavailable = '';
  bool _chromeLoading = true;
  bool _openedInitialDetail = false;
  WebSocketChannel? _flagsWs;
  StreamSubscription? _flagsSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_loadChrome());
  }

  @override
  void didUpdateWidget(covariant PlayerEventsHub oldWidget) {
    super.didUpdateWidget(oldWidget);
    final prev = (oldWidget.accessToken ?? '').trim();
    final next = (widget.accessToken ?? '').trim();
    if (prev != next) {
      unawaited(_listenFeatureFlags());
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Guest path has no flags WS - refresh catalog on resume (web invalidate parity).
      unawaited(_reloadCatalogOnly());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    final sub = _flagsSub;
    final ws = _flagsWs;
    _flagsSub = null;
    _flagsWs = null;
    unawaited(sub?.cancel() ?? Future<void>.value());
    unawaited(ws?.sink.close() ?? Future<void>.value());
    super.dispose();
  }

  Future<void> _reloadCatalogOnly() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/catalog'),
      );
      if (!mounted) return;
      if (res.statusCode == 503) {
        setState(() {
          _catalog = null;
          _catalogFeatureOff = true;
        });
        return;
      }
      if (res.statusCode >= 300) return;
      final catalog = EventsCatalog.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      if (!mounted) return;
      setState(() {
        _catalog = catalog;
        _catalogFeatureOff = catalog.hostedEventsEnabled == false;
      });
    } catch (_) {}
  }

  Future<void> _listenFeatureFlags() async {
    await _flagsSub?.cancel();
    await _flagsWs?.sink.close();
    _flagsWs = null;
    _flagsSub = null;
    final token = (widget.accessToken ?? '').trim();
    if (token.isEmpty) return;
    try {
      final origin = ApiConfig.baseUrl.replaceFirst(RegExp(r'^http'), 'ws');
      final uri = Uri.parse(
        '$origin/ws/matchmaking?token=${Uri.encodeComponent(token)}',
      );
      _flagsWs = WebSocketChannel.connect(uri);
      _flagsSub = _flagsWs!.stream.listen((event) {
        if (event is! String) return;
        try {
          final msg = jsonDecode(event) as Map<String, dynamic>;
          if (msg['type'] != 'feature_flags') return;
          unawaited(_reloadCatalogOnly());
        } catch (_) {}
      });
    } catch (_) {}
  }

  Future<void> _loadChrome() async {
    try {
      final results = await Future.wait([
        http.get(
          Uri.parse(
            '${ApiConfig.baseUrl}/api/v1/public/events-player-chrome',
          ),
        ),
        http.get(Uri.parse('${ApiConfig.baseUrl}/api/v1/events/catalog')),
      ]);
      EventsPlayerChrome? chrome;
      String unavailable = '';
      if (results[0].statusCode < 300) {
        final map = jsonDecode(results[0].body) as Map<String, dynamic>;
        chrome = EventsPlayerChrome.fromJson(map);
        unavailable =
            (map['events_player_chrome_unavailable'] as String?)?.trim() ?? '';
      }
      EventsCatalog? catalog;
      var catalogFeatureOff = false;
      if (results[1].statusCode < 300) {
        catalog = EventsCatalog.fromJson(
          jsonDecode(results[1].body) as Map<String, dynamic>,
        );
        catalogFeatureOff = catalog.hostedEventsEnabled == false;
      } else if (results[1].statusCode == 503) {
        catalogFeatureOff = true;
      }
      if (!mounted) return;
      setState(() {
        _chrome = chrome;
        _catalog = catalog;
        _catalogFeatureOff = catalogFeatureOff;
        _unavailable = softCommunityChromeUnavailable(unavailable);
        _chromeLoading = false;
      });
      unawaited(_listenFeatureFlags());
      final initialId = (widget.initialEventId ?? '').trim();
      final readyChrome = chrome;
      if (!_openedInitialDetail &&
          initialId.isNotEmpty &&
          readyChrome != null) {
        _openedInitialDetail = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          unawaited(_openInitialEventTarget(initialId, readyChrome));
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _chromeLoading = false);
    }
  }

  Future<bool> _fetchJoinedContains(String token, String eventId) async {
    final id = eventId.trim();
    if (id.isEmpty) return false;
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/joined'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (res.statusCode < 300) {
        final map = jsonDecode(res.body) as Map<String, dynamic>;
        for (final row in map['events'] as List<dynamic>? ?? const []) {
          if (row is Map && (row['id']?.toString().trim() ?? '') == id) {
            return true;
          }
        }
      }
    } catch (_) {}
    // Paginated /events/joined can miss older seats: confirm via approved roster.
    try {
      final uid = (context.read<AuthCubit>().state.userId ?? '').trim();
      if (uid.isEmpty) return false;
      final entriesRes = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/$id/entries'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (entriesRes.statusCode >= 300) return false;
      final body = jsonDecode(entriesRes.body);
      if (body is! Map) return false;
      for (final row in body['entries'] as List<dynamic>? ?? const []) {
        if (row is Map && (row['user_id']?.toString().trim() ?? '') == uid) {
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  Future<void> _openInitialEventTarget(
      String id, EventsPlayerChrome chrome) async {
    final token = _effectiveToken;
    if (token != null && token.isNotEmpty && chrome.isCupLobbyReady) {
      final seated = await _fetchJoinedContains(token, id);
      var cupLobby = seated;
      if (!seated) {
        // Spectate / results parity: open lobby when live or finished (never enroll).
        try {
          final res = await http.get(
            Uri.parse('${ApiConfig.baseUrl}/api/v1/events/$id'),
            headers: {'Authorization': 'Bearer $token'},
          );
          if (res.statusCode < 300) {
            final body = jsonDecode(res.body);
            if (body is Map) {
              cupLobby = shouldOpenEventCupLobby(
                joined: false,
                startedAt: body['started_at']?.toString(),
                finishedAt: body['finished_at']?.toString(),
              );
            }
          }
        } catch (_) {}
      }
      if (cupLobby) {
        if (!mounted) return;
        await showEventCupLobbySheet(
          context,
          eventId: id,
          accessToken: token,
          chrome: chrome,
        );
        return;
      }
    }
    await _openDetail(id);
  }

  /// Returns seated event id when join succeeds inside the sheet (else null).
  Future<String?> _openDetail(String id) async {
    final next = id.trim();
    if (next.isEmpty) return null;
    final chrome = _chrome;
    if (chrome == null) return null;
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: damaColorsOf(context).card,
      builder: (ctx) {
        final h = MediaQuery.sizeOf(ctx).height * 0.92;
        return SizedBox(
          height: h,
          child: _PlayerEventsDetail(
            eventId: next,
            chrome: chrome,
            catalog: _catalog,
            accessToken: _effectiveToken,
            onBack: () => Navigator.of(ctx).pop(),
            onJoined: (joinedId) => Navigator.of(ctx).pop(joinedId),
          ),
        );
      },
    );
  }

  String? get _effectiveToken {
    final fromWidget = (widget.accessToken ?? '').trim();
    if (fromWidget.isNotEmpty) return fromWidget;
    final auth = context.read<AuthCubit>().state;
    final t = (auth.token ?? '').trim();
    return t.isNotEmpty ? t : null;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    if (_chromeLoading) {
      if (widget.embedded) {
        return const TournamentsPageSkeleton();
      }
      return Scaffold(
        appBar: AppBar(actions: const [NotificationAppBarActions()]),
        body: const TournamentsPageSkeleton(),
      );
    }
    final chrome = _chrome;
    if (chrome == null) {
      final err = Center(
        child: Text(
          softCommunityChromeUnavailable(_unavailable),
          style: TextStyle(color: tokens.danger),
        ),
      );
      if (widget.embedded) return err;
      return Scaffold(
        appBar: AppBar(actions: const [NotificationAppBarActions()]),
        body: err,
      );
    }
    return _PlayerEventsBrowse(
      chrome: chrome,
      catalog: _catalog,
      catalogFeatureOff: _catalogFeatureOff,
      accessToken: _effectiveToken,
      initialJoinCode: widget.initialJoinCode,
      embedded: widget.embedded,
      sourceBadge: widget.sourceBadge,
      hideOuterFilters: widget.hideOuterFilters,
      controlledEntryFilter: widget.controlledEntryFilter,
      controlledSearchQ: widget.controlledSearchQ,
      controlledLifecycle: widget.controlledLifecycle,
      controlledMine: widget.controlledMine,
      emptyOverride: widget.emptyOverride,
      onOpenDetail: (id) async {
        final seatedId = await _openDetail(id);
        return seatedId;
      },
    );
  }
}

class _PlayerEventsBrowse extends StatefulWidget {
  const _PlayerEventsBrowse({
    required this.chrome,
    required this.catalog,
    required this.catalogFeatureOff,
    required this.accessToken,
    required this.onOpenDetail,
    this.initialJoinCode,
    this.embedded = false,
    this.sourceBadge,
    this.hideOuterFilters = false,
    this.controlledEntryFilter,
    this.controlledSearchQ,
    this.controlledLifecycle,
    this.controlledMine,
    this.emptyOverride,
  });
  final EventsPlayerChrome chrome;
  final EventsCatalog? catalog;
  final bool catalogFeatureOff;
  final String? accessToken;
  final String? initialJoinCode;
  final bool embedded;
  final String? sourceBadge;
  final bool hideOuterFilters;
  final EventEntryFilter? controlledEntryFilter;
  final String? controlledSearchQ;
  final CupLifecyclePhase? controlledLifecycle;
  final bool? controlledMine;
  final String? emptyOverride;

  /// Opens detail; returns seated event id when join completed in the sheet.
  final Future<String?> Function(String id) onOpenDetail;

  @override
  State<_PlayerEventsBrowse> createState() => _PlayerEventsBrowseState();
}

class _PlayerEventsBrowseState extends State<_PlayerEventsBrowse> {
  final _searchCtrl = TextEditingController();
  final _codeCtrl = TextEditingController();
  final _codeFocus = FocusNode();
  Timer? _searchDebounce;
  Timer? _scrollLockTimer;
  late bool _filtersOpen;
  bool _filtersVisible = true;
  bool _scrollLock = false;
  double _lastScrollOffset = 0;

  bool _loading = true;
  bool _softFetching = false;
  bool _joining = false;
  bool _joinCodeAttempted = false;
  String _error = '';
  List<HostedEvent> _events = const [];
  SkipMeta? _meta;
  static const _skipKey = 'events_player';
  int _skip = 0;
  EventEntryFilter _entryFilter = EventEntryFilter.all;
  CupLifecyclePhase _lifecycle = CupLifecyclePhase.open;
  bool _mine = false;
  String _searchQ = '';
  final Set<String> _joinedIds = <String>{};

  static const _scrollThreshold = 12.0;
  static const _topRevealPx = 40.0;

  int get _searchDebounceMs {
    final n = int.tryParse(widget.chrome.searchDebounceMs.trim());
    return n != null && n >= 0 ? n : 0;
  }

  /// Explicit catalog false or 503 feature-off (null/legacy key → not gated).
  bool get _hostedKnownOff =>
      widget.catalogFeatureOff || widget.catalog?.hostedEventsEnabled == false;

  bool get _publicEnabled => widget.catalog?.publicEventsEnabled == true;

  EventEntryFilter get _effectiveEntryFilter =>
      widget.hideOuterFilters && widget.controlledEntryFilter != null
          ? widget.controlledEntryFilter!
          : _entryFilter;

  String get _effectiveSearchQ =>
      widget.hideOuterFilters && widget.controlledSearchQ != null
          ? widget.controlledSearchQ!
          : _searchQ;

  CupLifecyclePhase get _effectiveLifecycle =>
      widget.hideOuterFilters && widget.controlledLifecycle != null
          ? widget.controlledLifecycle!
          : _lifecycle;

  bool get _effectiveMine =>
      widget.hideOuterFilters && widget.controlledMine != null
          ? widget.controlledMine!
          : _mine;

  bool get _signedIn {
    final fromWidget = (widget.accessToken ?? '').trim();
    if (fromWidget.isNotEmpty) return true;
    final auth = context.read<AuthCubit>().state;
    return auth.isAuthenticated && (auth.token ?? '').trim().isNotEmpty;
  }

  CupCardCtaLabels get _cardCtaLabels {
    final chrome = widget.chrome;
    return CupCardCtaLabels(
      joinAction: softTournamentsJoinAction(chrome.joinAction),
      enrollAction: softTournamentsJoinAction(chrome.joinAction),
      lobbyAction: chrome.lobbyAction,
      watchAction: chrome.watchAction,
      resultsAction: chrome.resultsAction,
    );
  }

  String _lifecycleChipLabel(CupLifecyclePhase phase) {
    final chrome = widget.chrome;
    switch (phase) {
      case CupLifecyclePhase.open:
        return chrome.filterLifecycleOpenLabel;
      case CupLifecyclePhase.live:
        return chrome.filterLifecycleLiveLabel;
      case CupLifecyclePhase.finished:
        return chrome.filterLifecycleFinishedLabel;
    }
  }

  String _discoveryEmptyCopy() {
    final override = (widget.emptyOverride ?? '').trim();
    if (override.isNotEmpty) return softCommunityEmpty(override);
    final chrome = widget.chrome;
    if (_effectiveMine) return chrome.emptyMine;
    switch (_effectiveLifecycle) {
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
    final w = WidgetsBinding.instance.platformDispatcher.views.isEmpty
        ? 400.0
        : WidgetsBinding
                .instance.platformDispatcher.views.first.physicalSize.width /
            WidgetsBinding
                .instance.platformDispatcher.views.first.devicePixelRatio;
    _filtersOpen = w >= 720;
    final code = (widget.initialJoinCode ?? '').trim().toUpperCase();
    if (code.isNotEmpty) {
      _codeCtrl.text = code;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _codeFocus.requestFocus();
      });
    }
    _skip = SkipStore.read(_skipKey);
    if (!_hostedKnownOff && _publicEnabled) {
      _load(skip: _skip);
    } else {
      _loading = false;
    }
  }

  @override
  void didUpdateWidget(covariant _PlayerEventsBrowse oldWidget) {
    super.didUpdateWidget(oldWidget);
    final wasHostedOff = oldWidget.catalog?.hostedEventsEnabled == false;
    final nowHostedOff = widget.catalog?.hostedEventsEnabled == false;
    final wasPublic = oldWidget.catalog?.publicEventsEnabled == true;
    final nowPublic = widget.catalog?.publicEventsEnabled == true;
    if (wasHostedOff != nowHostedOff || wasPublic != nowPublic) {
      if (!nowHostedOff && nowPublic) {
        unawaited(_load(skip: 0));
      } else {
        setState(() {
          _events = const [];
          _meta = null;
          _loading = false;
          _softFetching = false;
          _error = '';
        });
      }
      return;
    }
    if (!widget.hideOuterFilters) return;
    if (widget.controlledEntryFilter == oldWidget.controlledEntryFilter &&
        widget.controlledSearchQ == oldWidget.controlledSearchQ &&
        widget.controlledLifecycle == oldWidget.controlledLifecycle &&
        widget.controlledMine == oldWidget.controlledMine) {
      return;
    }
    if (!_hostedKnownOff && _publicEnabled) {
      unawaited(_load(skip: 0));
    }
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _scrollLockTimer?.cancel();
    _searchCtrl.dispose();
    _codeCtrl.dispose();
    _codeFocus.dispose();
    super.dispose();
  }

  void _onSearchChanged(String raw) {
    _searchDebounce?.cancel();
    final ms = _searchDebounceMs;
    _searchDebounce = Timer(Duration(milliseconds: ms), () {
      if (!mounted) return;
      unawaited(_applySearch(raw));
    });
  }

  Future<void> _applySearch(String raw) async {
    final next = raw.trim();
    if (_searchQ == next) return;
    setState(() {
      _searchQ = next;
      _skip = 0;
    });
    unawaited(SkipStore.clear(_skipKey));
    await _load(skip: 0);
  }

  Future<void> _setEntryFilter(EventEntryFilter filter) async {
    if (_entryFilter == filter) return;
    setState(() {
      _entryFilter = filter;
      _skip = 0;
    });
    unawaited(SkipStore.clear(_skipKey));
    await _load(skip: 0);
  }

  Future<void> _setLifecycle(CupLifecyclePhase phase) async {
    if (_lifecycle == phase) return;
    setState(() {
      _lifecycle = phase;
      _skip = 0;
    });
    unawaited(SkipStore.clear(_skipKey));
    await _load(skip: 0);
  }

  Future<void> _setMine(bool mine) async {
    if (_mine == mine) return;
    if (mine && !_signedIn) return;
    setState(() {
      _mine = mine;
      _skip = 0;
    });
    unawaited(SkipStore.clear(_skipKey));
    await _load(skip: 0);
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
    // Center list only - ignore nested scrollables.
    if (notification.depth > 0) return false;
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

  Future<void> _load({int? skip, bool soft = false}) async {
    if (_hostedKnownOff || !_publicEnabled) {
      setState(() {
        _loading = false;
        _softFetching = false;
        _events = const [];
      });
      return;
    }
    final nextSkip = skip ?? _skip;
    // Persist before fetch so leaving the hub mid-request keeps the navigated page.
    if (skip != null) {
      _skip = nextSkip;
      unawaited(SkipStore.write(_skipKey, nextSkip));
    }
    final limit = widget.chrome.listPageSizeInt;
    setState(() {
      if (soft) {
        _softFetching = true;
      } else {
        _loading = true;
      }
      _error = '';
    });
    if (limit < 1) {
      setState(() {
        _loading = false;
        _softFetching = false;
        _error = softCommunityLoadFailed(widget.chrome.loadFailed);
        _events = const [];
      });
      return;
    }
    try {
      final params = <String, String>{
        'skip': '$nextSkip',
        'limit': '$limit',
      };
      switch (_effectiveEntryFilter) {
        case EventEntryFilter.free:
          params['is_free_entry'] = 'true';
          break;
        case EventEntryFilter.paid:
          params['is_free_entry'] = 'false';
          break;
        case EventEntryFilter.all:
          break;
      }
      final q = _effectiveSearchQ.trim();
      if (q.isNotEmpty) params['q'] = q;
      params['lifecycle'] = _effectiveLifecycle.apiValue;
      if (_effectiveMine) params['mine'] = '1';
      final headers = <String, String>{};
      var authToken = (widget.accessToken ?? '').trim();
      if (authToken.isEmpty) {
        final auth = context.read<AuthCubit>().state;
        authToken = (auth.token ?? '').trim();
      }
      if (_effectiveMine && authToken.isEmpty) {
        setState(() {
          _loading = false;
          _softFetching = false;
          _events = const [];
          _meta = null;
        });
        return;
      }
      if (authToken.isNotEmpty) {
        headers['Authorization'] = 'Bearer $authToken';
      }
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/public').replace(
          queryParameters: params,
        ),
        headers: headers,
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        setState(() {
          _loading = false;
          _softFetching = false;
          _error = softCommunityLoadFailed(widget.chrome.loadFailed);
          _events = const [];
        });
        return;
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final rows = (body['events'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(HostedEvent.fromJson)
          .where((e) => e.id.isNotEmpty)
          .toList();
      final metaRaw = body['meta'];
      final meta =
          metaRaw is Map<String, dynamic> ? SkipMeta.fromJson(metaRaw) : null;
      setState(() {
        _events = rows;
        _meta = meta;
        _skip = nextSkip;
        _loading = false;
        _softFetching = false;
      });
      unawaited(SkipStore.write(_skipKey, nextSkip));
      final token = (widget.accessToken ?? '').trim();
      if (token.isNotEmpty) unawaited(_refreshJoinedIds(token));
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _softFetching = false;
        _error = softCommunityLoadFailed(widget.chrome.loadFailed);
      });
    }
  }

  Future<String?> _ensureToken() async {
    final existing = (widget.accessToken ?? '').trim();
    if (existing.isNotEmpty) return existing;
    final auth = context.read<AuthCubit>().state;
    if (auth.isAuthenticated) return auth.token;
    return showSignInDialog(context);
  }

  void _markJoined(String id) {
    final next = id.trim();
    if (next.isEmpty) return;
    setState(() => _joinedIds.add(next));
  }

  Future<void> _refreshJoinedIds(String token) async {
    final limit = widget.chrome.listPageSizeInt;
    if (limit < 1 || token.trim().isEmpty) return;
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/joined').replace(
          queryParameters: {'skip': '0', 'limit': '${limit < 50 ? 50 : limit}'},
        ),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (!mounted || res.statusCode >= 300) return;
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final rows = (body['events'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(HostedEvent.fromJson)
          .map((e) => e.id.trim())
          .where((id) => id.isNotEmpty);
      setState(() => _joinedIds.addAll(rows));
    } catch (_) {}
  }

  Future<void> _runJoin(String rawCode, {String? fromCardId}) async {
    final chrome = widget.chrome;
    final code = rawCode.trim().toUpperCase();
    setState(() => _joinCodeAttempted = true);
    if (code.isEmpty) return;
    final token = await _ensureToken();
    if (!mounted || token == null || token.isEmpty) return;
    setState(() => _joining = true);
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/join'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'code': code}),
      );
      if (!mounted) return;
      if (res.statusCode == 402) {
        setState(() => _joining = false);
        final msg = eventJoinErrorChrome(chrome, res);
        final topUp = chrome.topUpAction.trim();
        final href = withWalletFocusParam(chrome.topUpHref.trim(), 'topup');
        showEventJoinSnack(
          context,
          message:
              msg.isNotEmpty ? msg : softCommunityLoadFailed(chrome.loadFailed),
          action: topUp.isNotEmpty
              ? SnackBarAction(
                  label: topUp,
                  textColor: Colors.white,
                  onPressed: () {
                    if (href.isNotEmpty) {
                      unawaited(
                        navigateNotificationHref(
                          context,
                          href: href,
                          accessToken: token,
                        ),
                      );
                    } else {
                      unawaited(
                        Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => WalletPage(
                              token: token,
                              focusTopUp: true,
                            ),
                          ),
                        ),
                      );
                    }
                  },
                )
              : null,
        );
        return;
      }
      if (res.statusCode >= 300) {
        setState(() => _joining = false);
        if (isAlreadyJoinedEventError(res)) {
          final msg = softCommunityJoinStatusMessage(
            chrome.alreadyJoined.trim().isNotEmpty
                ? chrome.alreadyJoined
                : chrome.approvedBlurb,
          );
          showEventJoinSnack(context, message: msg, success: true);
          if (fromCardId != null) _markJoined(fromCardId);
          unawaited(_refreshJoinedIds(token));
          // Tournament parity: already seated → event cup lobby.
          _goEventCupLobby(fromCardId ?? '');
          return;
        }
        showEventJoinSnack(
          context,
          message: eventJoinErrorChrome(chrome, res),
        );
        return;
      }
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      final entryRaw = map['entry'];
      final eventRaw = map['event'];
      String blurb = chrome.approvedBlurb;
      var goPlay = true;
      if (entryRaw is Map<String, dynamic>) {
        final entry = HostedEventEntry.fromJson(entryRaw);
        final st = entry.status.trim();
        final pending = (widget.catalog?.hostedEventEntryPending ?? '').trim();
        if (pending.isNotEmpty && st == pending) {
          blurb = chrome.pendingApproval;
          goPlay = false;
        }
      }
      setState(() => _joining = false);
      showEventJoinSnack(
        context,
        message: softCommunityJoinStatusMessage(blurb),
        success: true,
      );
      String eventId = (fromCardId ?? '').trim();
      if (eventRaw is Map<String, dynamic>) {
        final id = HostedEvent.fromJson(eventRaw).id.trim();
        if (id.isNotEmpty) eventId = id;
      }
      if (eventId.isNotEmpty) _markJoined(eventId);
      unawaited(_refreshJoinedIds(token));
      if (goPlay) {
        // Tournament parity: approved seat → event cup lobby.
        _goEventCupLobby(eventId);
      } else {
        unawaited(_load(skip: _skip, soft: true));
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _joining = false);
      showEventJoinSnack(context,
          message: softCommunityLoadFailed(chrome.loadFailed));
    }
  }

  /// Event cup lobby (web EventCupLobby parity).
  void _goEventCupLobby(String eventId) {
    final id = eventId.trim();
    if (!mounted || id.isEmpty) return;
    final chrome = widget.chrome;
    final token = (widget.accessToken ?? '').trim();
    if (chrome.isCupLobbyReady && token.isNotEmpty) {
      unawaited(
        showEventCupLobbySheet(
          context,
          eventId: id,
          accessToken: token,
          chrome: chrome,
        ),
      );
      return;
    }
    // Avoid remounting a second public browse; open Community with focus.
    navigateNotificationHref(
      context,
      href: '/?view=tournaments&source=community&id=${Uri.encodeComponent(id)}',
      accessToken: token,
    );
  }

  Future<void> _openDetailAndMark(String id) async {
    final seated = await widget.onOpenDetail(id);
    if (!mounted) return;
    if (seated != null && seated.trim().isNotEmpty) {
      _markJoined(seated.trim());
      // Detail join / already-joined returns seated id → event cup lobby.
      _goEventCupLobby(seated.trim());
    }
  }

  Future<void> _onCardJoin(HostedEvent e) async {
    final seated = _joinedIds.contains(e.id);
    final liveGameId = (e.liveGameId ?? '').trim();
    final cta = resolveCupCardCta(
      CupLifecycleFields(startedAt: e.startedAt, finishedAt: e.finishedAt),
      enrolled: seated,
      isFree: e.isFreeEntry,
      liveGameId: liveGameId,
      labels: _cardCtaLabels,
    );
    if (cta.kind == CupCardCtaKind.watch && liveGameId.isNotEmpty) {
      final token = await _ensureToken();
      if (!mounted) return;
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
      if (!mounted) return;
      if (token == null || token.isEmpty) return;
      _goEventCupLobby(e.id);
      return;
    }
    final code = e.joinCode.trim();
    if (code.isEmpty) {
      await _openDetailAndMark(e.id);
      return;
    }
    if (!e.isFreeEntry) {
      // Official/web parity: sign in before paid join sheet (not mid-dialog).
      final token = await _ensureToken();
      if (!mounted || token == null || token.isEmpty) return;
      final ok = await showPaymentEventJoinDialog(
        context,
        event: e,
        prizePoolLabels: PrizePoolCardLabels.fromPlayer(widget.chrome),
        joinChrome: widget.chrome,
      );
      if (!mounted) return;
      if (ok) {
        _markJoined(e.id);
        unawaited(_refreshJoinedIds(token));
        _goEventCupLobby(e.id);
      }
      return;
    }
    await _runJoin(code, fromCardId: e.id);
  }

  Widget _joinCodeStrip(DamaColors tokens) {
    final chrome = widget.chrome;
    return Material(
      color: tokens.surfaceMuted.withValues(alpha: 0.35),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              softCommunityJoinCodeSectionTitle(chrome.joinCodeSectionTitle),
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
            ),
            const SizedBox(height: 2),
            Text(
              softCommunityJoinCodeSectionBlurb(chrome.joinCodeSectionBlurb),
              style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
            ),
            const SizedBox(height: 10),
            LayoutBuilder(
              builder: (context, constraints) {
                final wide = constraints.maxWidth >= 480;
                final field = TextField(
                  controller: _codeCtrl,
                  focusNode: _codeFocus,
                  textCapitalization: TextCapitalization.characters,
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9]')),
                    TextInputFormatter.withFunction((old, next) {
                      return next.copyWith(text: next.text.toUpperCase());
                    }),
                  ],
                  decoration: InputDecoration(
                    labelText: softCommunityCodeLabel(chrome.codeLabel),
                    hintText:
                        softCommunityCodePlaceholder(chrome.codePlaceholder),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                    isDense: true,
                    errorText:
                        _joinCodeAttempted && _codeCtrl.text.trim().isEmpty
                            ? (chrome.errCodeRequired.isNotEmpty
                                ? softCommunityErrCodeRequired(
                                    chrome.errCodeRequired,
                                  )
                                : null)
                            : null,
                  ),
                  textInputAction: TextInputAction.go,
                  onChanged: (_) {
                    if (_joinCodeAttempted &&
                        _codeCtrl.text.trim().isNotEmpty) {
                      setState(() => _joinCodeAttempted = false);
                    }
                  },
                  onSubmitted:
                      _joining ? null : (_) => _runJoin(_codeCtrl.text),
                );
                final btn = FilledButton(
                  onPressed: _joining ? null : () => _runJoin(_codeCtrl.text),
                  style: FilledButton.styleFrom(
                    backgroundColor: tokens.gold,
                    foregroundColor: tokens.onGold,
                  ),
                  child: Text(softTournamentsJoinAction(chrome.joinAction)),
                );
                if (wide) {
                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(child: field),
                      const SizedBox(width: 10),
                      btn,
                    ],
                  );
                }
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    field,
                    const SizedBox(height: 8),
                    btn,
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _filterPanel(DamaColors tokens) {
    final chrome = widget.chrome;
    final lifecycle = _effectiveLifecycle;
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
                label: Text(_lifecycleChipLabel(phase)),
                selected: lifecycle == phase,
                onSelected: _loading || widget.hideOuterFilters
                    ? null
                    : (_) => unawaited(_setLifecycle(phase)),
              ),
            if (_signedIn && !widget.hideOuterFilters)
              FilterChip(
                label: Text(chrome.filterMineLabel),
                selected: _mine,
                onSelected: _loading ? null : (v) => unawaited(_setMine(v)),
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
            for (final f in EventEntryFilter.values)
              ChoiceChip(
                label: Text(
                  switch (f) {
                    EventEntryFilter.all =>
                      softTournamentsFilterEntryAll(chrome.filterAllLabel),
                    EventEntryFilter.free =>
                      softTournamentsFilterEntryFree(chrome.filterFreeLabel),
                    EventEntryFilter.paid =>
                      softTournamentsFilterEntryPaid(chrome.filterPaidLabel),
                  },
                ),
                selected: _entryFilter == f,
                onSelected: _loading ? null : (_) => _setEntryFilter(f),
              ),
          ],
        ),
        const SizedBox(height: 12),
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
            onChanged: _loading ? null : _onSearchChanged,
            onSubmitted: _loading
                ? null
                : (v) {
                    _searchDebounce?.cancel();
                    unawaited(_applySearch(v));
                  },
          ),
        ),
      ],
    );
  }

  Widget _filterChrome(DamaColors tokens, bool wide) {
    final chrome = widget.chrome;
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
            if (!wide) ...[
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
                  child: _filterPanel(tokens),
                ),
            ] else
              _filterPanel(tokens),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final chrome = widget.chrome;
    final wide = MediaQuery.sizeOf(context).width >= 720;
    final prizeLabels = PrizePoolCardLabels.fromPlayer(chrome);

    final body = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Join-by-code stays on All-tab embed (parent only owns free/paid/search).
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: ListenableBuilder(
            listenable: _codeCtrl,
            builder: (context, _) => _joinCodeStrip(tokens),
          ),
        ),
        if (_hostedKnownOff)
          Expanded(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  softCommunityFeatureDisabled(widget.chrome.featureDisabled),
                  style: TextStyle(color: tokens.onSurfaceMuted),
                ),
              ),
            ),
          )
        else if (!_publicEnabled)
          Expanded(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(16),
                // Gate off ≠ empty list - public_disabled (soft fail-open; web parity).
                child: Text(
                  softCommunityPublicDisabled(widget.chrome.publicDisabled),
                  style: TextStyle(color: tokens.onSurfaceMuted),
                ),
              ),
            ),
          )
        else ...[
          if (!widget.hideOuterFilters)
            ClipRect(
              child: AnimatedAlign(
                duration: const Duration(milliseconds: 280),
                curve: Curves.easeOutCubic,
                heightFactor: _filtersVisible ? 1 : 0,
                alignment: Alignment.topCenter,
                child: ExcludeSemantics(
                  excluding: !_filtersVisible,
                  child: _filterChrome(tokens, wide),
                ),
              ),
            ),
          // Reserved 2px slot - never insert/remove progress (pagination layout jump).
          SizedBox(
            height: 2,
            child: _softFetching
                ? const LinearProgressIndicator(minHeight: 2)
                : const SizedBox.expand(),
          ),
          Expanded(
            child: NotificationListener<ScrollNotification>(
              onNotification: _onScroll,
              child: RefreshIndicator(
                onRefresh: () => _load(skip: _skip),
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                  children: [
                    if (_loading) ...[
                      const TournamentListSkeleton(),
                      const SizedBox(height: 48),
                    ] else ...[
                      if (_error.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Text(
                            _error,
                            style: TextStyle(color: tokens.danger),
                          ),
                        ),
                      if (_events.isEmpty && _error.isEmpty)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 24),
                          child: Text(
                            softCommunityEmpty(_discoveryEmptyCopy()),
                            style: TextStyle(color: tokens.onSurfaceMuted),
                          ),
                        ),
                      if (_events.isNotEmpty)
                        Opacity(
                          opacity: _softFetching ? 0.7 : 1,
                          child: EventMiniCardGrid(
                            itemCount: _events.length,
                            itemBuilder: (context, i) {
                              final e = _events[i];
                              return EventMiniCard(
                                event: e,
                                detailDescriptionLabel:
                                    chrome.detailDescriptionLabel,
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
                                ctaLabel: resolveCupCardCta(
                                  CupLifecycleFields(
                                    startedAt: e.startedAt,
                                    finishedAt: e.finishedAt,
                                  ),
                                  enrolled: _joinedIds.contains(e.id),
                                  isFree: e.isFreeEntry,
                                  liveGameId: (e.liveGameId ?? '').trim(),
                                  labels: _cardCtaLabels,
                                ).label,
                                hostedByLabel: softTournamentsHostedByLabel(
                                  chrome.hostedByLabel,
                                ),
                                metaSeparator: chrome.metaSeparator,
                                amountCurrencySeparator:
                                    chrome.amountCurrencySeparator,
                                emptyValue: chrome.emptyValue,
                                hostRepFinishedLabel:
                                    chrome.hostRepFinishedLabel,
                                hostRepCancelledLabel:
                                    chrome.hostRepCancelledLabel,
                                hostRepReportsLabel: chrome.hostRepReportsLabel,
                                hostRepMetaSeparator:
                                    chrome.hostRepMetaSeparator,
                                statusLabel: cupLifecycleStatusLabel(
                                  CupLifecycleFields(
                                    startedAt: e.startedAt,
                                    finishedAt: e.finishedAt,
                                  ),
                                  CupLifecycleLabelChrome(
                                    openLabel: chrome.filterLifecycleOpenLabel,
                                    liveLabel: chrome.filterLifecycleLiveLabel,
                                    finishedLabel:
                                        chrome.filterLifecycleFinishedLabel,
                                  ),
                                  fallback: e.statusLabel.isNotEmpty
                                      ? e.statusLabel
                                      : e.status,
                                ),
                                sourceBadge: widget.sourceBadge,
                                prizePoolLabels: prizeLabels,
                                onOpen: () =>
                                    unawaited(_openDetailAndMark(e.id)),
                                onJoin: _joining ? null : () => _onCardJoin(e),
                              );
                            },
                          ),
                        ),
                      // Outside Opacity - stable pagination chrome (no flicker).
                      if (_meta != null && _meta!.totalPages > 1)
                        SkipPaginationBar(
                          meta: _meta!,
                          busy: _softFetching,
                          onSkip: (skip) =>
                              unawaited(_load(skip: skip, soft: true)),
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
      ],
    );
    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(
        title: Text(softCommunityPageTitle(chrome.pageTitle)),
        actions: const [NotificationAppBarActions()],
      ),
      body: body,
    );
  }
}

class _PlayerEventsDetail extends StatefulWidget {
  const _PlayerEventsDetail({
    required this.eventId,
    required this.chrome,
    required this.catalog,
    required this.accessToken,
    required this.onBack,
    this.onJoined,
  });

  final String eventId;
  final EventsPlayerChrome chrome;
  final EventsCatalog? catalog;
  final String? accessToken;
  final VoidCallback onBack;
  final void Function(String eventId)? onJoined;

  @override
  State<_PlayerEventsDetail> createState() => _PlayerEventsDetailState();
}

class _PlayerEventsDetailState extends State<_PlayerEventsDetail> {
  bool _loading = true;
  bool _joining = false;
  bool _alreadyIn = false;
  bool _myPending = false;
  HostedEvent? _event;
  List<HostedEventEntry> _roster = const [];
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant _PlayerEventsDetail oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.eventId != widget.eventId) {
      _load();
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
      _event = null;
      _roster = const [];
      _alreadyIn = false;
      _myPending = false;
    });
    try {
      final res = await http.get(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/events/${Uri.encodeComponent(widget.eventId)}',
        ),
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        setState(() {
          _loading = false;
          // Web EventDetailModal: soft detail_unavailable || load_failed.
          final detail = widget.chrome.detailUnavailable.trim();
          _error = softCommunityLoadFailed(
            detail.isNotEmpty ? detail : widget.chrome.loadFailed,
          );
        });
        return;
      }
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      final raw = map['event'] is Map<String, dynamic>
          ? map['event'] as Map<String, dynamic>
          : map;
      final ev = HostedEvent.fromJson(raw);
      List<HostedEventEntry> roster = const [];
      var alreadyIn = false;
      var myPending = false;
      // Public cups: GET /events/{id}/entries is guest-ok (approved roster only).
      if (ev.id.isNotEmpty) {
        try {
          final token = (widget.accessToken ?? '').trim();
          final headers = <String, String>{};
          if (token.isNotEmpty) {
            headers['Authorization'] = 'Bearer $token';
          }
          final entRes = await http.get(
            Uri.parse(
              '${ApiConfig.baseUrl}/api/v1/events/${Uri.encodeComponent(ev.id)}/entries',
            ),
            headers: headers.isEmpty ? null : headers,
          );
          if (entRes.statusCode < 300) {
            final body = jsonDecode(entRes.body) as Map<String, dynamic>;
            final approved =
                (widget.catalog?.hostedEventEntryApproved ?? '').trim();
            final pending =
                (widget.catalog?.hostedEventEntryPending ?? '').trim();
            final all = (body['entries'] as List<dynamic>? ?? const [])
                .whereType<Map<String, dynamic>>()
                .map(HostedEventEntry.fromJson)
                .toList();
            final myId = (context.read<AuthCubit>().state.userId ?? '').trim();
            if (myId.isNotEmpty) {
              HostedEventEntry? mine;
              for (final row in all) {
                if (row.userId.trim() == myId) {
                  mine = row;
                  break;
                }
              }
              if (mine != null) {
                myPending = pending.isNotEmpty && mine.status == pending;
                final myApproved = approved.isNotEmpty
                    ? mine.status == approved
                    : mine.username.trim().isNotEmpty;
                alreadyIn = myPending || myApproved;
              }
            }
            roster = all
                .where((row) {
                  if (approved.isEmpty) {
                    return row.username.trim().isNotEmpty;
                  }
                  return row.status == approved;
                })
                .take(8)
                .toList();
          }
        } catch (_) {}
      }
      if (!mounted) return;
      setState(() {
        _event = ev.id.isNotEmpty ? ev : null;
        _roster = roster;
        _alreadyIn = alreadyIn;
        _myPending = myPending;
        _loading = false;
        if (ev.id.isEmpty) {
          final detail = widget.chrome.detailUnavailable.trim();
          _error = softCommunityLoadFailed(
            detail.isNotEmpty ? detail : widget.chrome.loadFailed,
          );
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        final detail = widget.chrome.detailUnavailable.trim();
        _error = softCommunityLoadFailed(
          detail.isNotEmpty ? detail : widget.chrome.loadFailed,
        );
      });
    }
  }

  Future<String?> _ensureToken() async {
    final existing = (widget.accessToken ?? '').trim();
    if (existing.isNotEmpty) return existing;
    final auth = context.read<AuthCubit>().state;
    if (auth.isAuthenticated) return auth.token;
    return showSignInDialog(context);
  }

  Future<void> _join() async {
    final chrome = widget.chrome;
    final ev = _event;
    if (ev == null) return;
    // Approved seat → Join opens cup lobby (web EventDetailModal parity).
    if (_alreadyIn && !_myPending) {
      final seatedId = widget.eventId.trim();
      if (seatedId.isNotEmpty) {
        widget.onJoined?.call(seatedId);
      } else {
        widget.onBack();
      }
      return;
    }
    if (_myPending) return;
    final code = ev.joinCode.trim();
    if (code.isEmpty) return;
    if (!ev.isFreeEntry && !_alreadyIn) {
      // Official/web parity: sign in before paid join sheet (not mid-dialog).
      final token = await _ensureToken();
      if (!mounted || token == null || token.isEmpty) return;
      final ok = await showPaymentEventJoinDialog(
        context,
        event: ev,
        prizePoolLabels: PrizePoolCardLabels.fromPlayer(chrome),
        joinChrome: chrome,
      );
      if (!mounted) return;
      if (ok) {
        setState(() {
          _alreadyIn = true;
          _myPending = false;
        });
        final seatedId = widget.eventId.trim().isNotEmpty
            ? widget.eventId.trim()
            : ev.id.trim();
        if (seatedId.isNotEmpty) {
          widget.onJoined?.call(seatedId);
        } else {
          widget.onBack();
        }
      }
      return;
    }
    final token = await _ensureToken();
    if (!mounted || token == null || token.isEmpty) return;
    setState(() => _joining = true);
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/join'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'code': code}),
      );
      if (!mounted) return;
      if (res.statusCode == 402) {
        setState(() => _joining = false);
        final msg = eventJoinErrorChrome(chrome, res);
        final topUp = chrome.topUpAction.trim();
        final href = withWalletFocusParam(chrome.topUpHref.trim(), 'topup');
        showEventJoinSnack(
          context,
          message:
              msg.isNotEmpty ? msg : softCommunityLoadFailed(chrome.loadFailed),
          action: topUp.isNotEmpty
              ? SnackBarAction(
                  label: topUp,
                  textColor: Colors.white,
                  onPressed: () {
                    if (href.isNotEmpty) {
                      unawaited(
                        navigateNotificationHref(
                          context,
                          href: href,
                          accessToken: token,
                        ),
                      );
                    } else {
                      unawaited(
                        Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => WalletPage(
                              token: token,
                              focusTopUp: true,
                            ),
                          ),
                        ),
                      );
                    }
                  },
                )
              : null,
        );
        return;
      }
      if (res.statusCode >= 300) {
        setState(() => _joining = false);
        if (isAlreadyJoinedEventError(res)) {
          final msg = softCommunityJoinStatusMessage(
            chrome.alreadyJoined.trim().isNotEmpty
                ? chrome.alreadyJoined
                : chrome.approvedBlurb,
          );
          showEventJoinSnack(context, message: msg, success: true);
          setState(() {
            _joining = false;
            _alreadyIn = true;
            _myPending = false;
          });
          final seatedId = widget.eventId.trim();
          if (seatedId.isNotEmpty) {
            // Parent pops sheet then navigates to play lobby (tournament parity).
            widget.onJoined?.call(seatedId);
          } else {
            widget.onBack();
          }
          return;
        }
        showEventJoinSnack(
          context,
          message: eventJoinErrorChrome(chrome, res),
        );
        return;
      }
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      final entryRaw = map['entry'];
      final eventRaw = map['event'];
      String blurb = chrome.approvedBlurb;
      var goPlay = true;
      if (entryRaw is Map<String, dynamic>) {
        final entry = HostedEventEntry.fromJson(entryRaw);
        final st = entry.status.trim();
        final pending = (widget.catalog?.hostedEventEntryPending ?? '').trim();
        if (pending.isNotEmpty && st == pending) {
          blurb = chrome.pendingApproval;
          goPlay = false;
        }
      }
      String seatedId = widget.eventId.trim();
      if (eventRaw is Map<String, dynamic>) {
        final id = HostedEvent.fromJson(eventRaw).id.trim();
        if (id.isNotEmpty) seatedId = id;
      }
      setState(() {
        _joining = false;
        if (!goPlay) {
          _alreadyIn = true;
          _myPending = true;
        }
      });
      showEventJoinSnack(
        context,
        message: softCommunityJoinStatusMessage(blurb),
        success: true,
      );
      if (!goPlay) {
        // Pending approval: stay on detail; do not open play lobby.
        return;
      }
      // Approved seat → parent pops + play lobby (tournament free-join parity).
      if (seatedId.isNotEmpty) {
        widget.onJoined?.call(seatedId);
      } else {
        widget.onBack();
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _joining = false);
      showEventJoinSnack(context,
          message: softCommunityLoadFailed(chrome.loadFailed));
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final chrome = widget.chrome;

    final detailBadge = (_event?.organizerHostTrustBadge ?? '').trim();
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Expanded(
              child: Text(
                (_event?.title.trim().isNotEmpty ?? false)
                    ? _event!.title.trim()
                    : softCommunityPageTitle(chrome.pageTitle),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            HostTrustBadge(
              label: detailBadge,
              tier: _event?.organizerHostTrustTier,
              fontSize: 10,
              dense: true,
            ),
          ],
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: chrome.dialogCloseLabel.trim().isNotEmpty
              ? chrome.dialogCloseLabel
              : null,
          onPressed: widget.onBack,
        ),
        actions: const [NotificationAppBarActions()],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _event == null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(
                      _error,
                      style: TextStyle(color: tokens.danger),
                    ),
                  ),
                )
              : _buildBody(tokens, chrome, _event!),
    );
  }

  Future<void> _copyShareLink(String url) async {
    final chrome = widget.chrome;
    try {
      await Clipboard.setData(ClipboardData(text: url));
      if (!mounted) return;
      final ok = chrome.copiedBlurb.trim();
      if (ok.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ok)));
      }
    } catch (_) {
      if (!mounted) return;
      final fail = chrome.toastCopyFailed.trim();
      if (fail.isNotEmpty) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(fail)));
      }
    }
  }

  Widget _buildBody(
    DamaColors tokens,
    EventsPlayerChrome chrome,
    HostedEvent e,
  ) {
    final empty = chrome.emptyValue;
    final amountSep = chrome.amountCurrencySeparator;
    final feeCur = e.entryFeeCurrency.trim();
    final feeAmt = e.entryFeeAmount;
    final entry = e.isFreeEntry
        ? softTournamentsFreeLabel(chrome.freeLabel)
        : (feeAmt != null && feeCur.isNotEmpty && amountSep.isNotEmpty)
            ? '$feeAmt$amountSep$feeCur'
            : empty;
    final fillLeft = e.approvedCount != null
        ? '${e.approvedCount}'
        : (empty.isNotEmpty ? empty : '');
    final fillRight = seatCapFillRight(
          e.maxPlayers,
          e.seatCapUnlimited,
          chrome.unlimitedPlayersLabel,
        ) ??
        (empty.isNotEmpty ? empty : '');
    final fill =
        '$fillLeft/$fillRight ${softTournamentsPlayersLabel(chrome.playersLabel)}'
            .trim();
    final hostName = e.organizerUsername.trim();
    final hostAvatar = e.organizerAvatarUrl.trim();
    final prizeLabels = PrizePoolCardLabels.fromPlayer(chrome);
    final poolLines = hostedEventPrizePoolLines(e, prizeLabels);
    final publicVis =
        (widget.catalog?.hostedEventPublicVisibility ?? '').trim();
    final isPublic = publicVis.isNotEmpty && e.visibility == publicVis;
    final ratedBlurb = isPublic
        ? softCommunityJoinStatusMessage(
            widget.catalog?.publicEventMatchesRated == true
                ? chrome.publicRatedOnBlurb
                : chrome.publicRatedOffBlurb,
          )
        : '';
    final status = (e.statusLabel.isNotEmpty ? e.statusLabel : e.status).trim();
    // Approved seat → Join (play). Pending stays locked with pending copy.
    final joinCta = softTournamentsJoinAction(
      chrome.detailJoinAction.trim().isNotEmpty
          ? chrome.detailJoinAction
          : chrome.joinAction,
    );
    final joinLabel = _myPending
        ? softCommunityJoinStatusMessage(chrome.pendingApproval)
        : joinCta;
    // Organizer parity: Share copies invite link (never opens a browser tab).
    // Fail closed: bare origin is not a valid invite (must include join code).
    // Prefer API share_url; template+origin only when origin is http(s) (web).
    final baseOrigin = Uri.base.origin.trim();
    final originForFallback =
        baseOrigin.startsWith('http://') || baseOrigin.startsWith('https://')
            ? baseOrigin
            : '';
    final shareUrl = isPublic
        ? resolveEventInviteShareUrl(
            shareUrl: e.shareUrl,
            joinCode: e.joinCode,
            sharePathTemplate: widget.catalog?.sharePathTemplate,
            origin: originForFallback,
          )
        : '';
    final emptyLabel = empty;
    final images = e.carouselImages;
    Color galleryFallback = tokens.surfaceMuted;
    if (images.isEmpty) {
      final brand = (e.brandColor ?? '').trim();
      if (brand.isNotEmpty) {
        final hex = brand.startsWith('#') ? brand.substring(1) : brand;
        final parsed = int.tryParse(
          hex.length == 6 ? 'FF$hex' : hex,
          radix: 16,
        );
        if (parsed != null) galleryFallback = Color(parsed);
      }
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Stack(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: images.isEmpty
                  ? AspectRatio(
                      aspectRatio: 16 / 10,
                      child: ColoredBox(color: galleryFallback),
                    )
                  : GalleryCarousel(
                      images: images,
                      semanticsLabel: softCommunityCarouselAria(
                        chrome.carouselAria,
                      ),
                      aspectRatio: 16 / 10,
                    ),
            ),
            if (status.isNotEmpty)
              Positioned(
                left: 12,
                top: 12,
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 200),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(999),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x22000000),
                        blurRadius: 4,
                        offset: Offset(0, 1),
                      ),
                    ],
                  ),
                  child: Text(
                    status,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFF171717),
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
          ],
        ),
        // Title lives in AppBar (web dialog title parity - no duplicate body H1).
        if (hostName.isNotEmpty) ...[
          const SizedBox(height: 16),
          InkWell(
            onTap: e.organizerId.trim().isEmpty
                ? null
                : () => unawaited(
                      showPlayerInspectSheet(context, e.organizerId.trim()),
                    ),
            borderRadius: BorderRadius.circular(8),
            child: Row(
              children: [
                DamaUserAvatar(
                  imageUrl: hostAvatar.isNotEmpty ? hostAvatar : null,
                  radius: 16,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text:
                                  '${softTournamentsHostedByLabel(chrome.hostedByLabel)} ',
                              style: TextStyle(
                                color: tokens.onSurfaceMuted,
                                fontSize: 13,
                              ),
                            ),
                            TextSpan(
                              text: hostName,
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                                decoration: e.organizerId.trim().isNotEmpty
                                    ? TextDecoration.underline
                                    : TextDecoration.none,
                                decorationColor: tokens.onSurfaceMuted,
                              ),
                            ),
                          ],
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (e.organizerRating != null && e.organizerRating! > 0)
                        Text(
                          '${e.organizerRating}',
                          style: TextStyle(
                            color: tokens.onSurfaceMuted,
                            fontSize: 12,
                          ),
                        ),
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: HostTrustBadge(
                          label: e.organizerHostTrustBadge,
                          tier: e.organizerHostTrustTier,
                          fontSize: 10,
                          dense: true,
                        ),
                      ),
                      if (() {
                        final sep = chrome.hostRepMetaSeparator;
                        return sep.isNotEmpty &&
                            chrome.hostRepFinishedLabel.trim().isNotEmpty &&
                            chrome.hostRepCancelledLabel.trim().isNotEmpty &&
                            chrome.hostRepReportsLabel.trim().isNotEmpty &&
                            e.organizerFinishedPaidCups != null &&
                            e.organizerCancelledPaidCups != null &&
                            e.organizerOpenReports != null;
                      }())
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            [
                              '${chrome.hostRepFinishedLabel.trim()} ${e.organizerFinishedPaidCups}',
                              '${chrome.hostRepCancelledLabel.trim()} ${e.organizerCancelledPaidCups}',
                              '${chrome.hostRepReportsLabel.trim()} ${e.organizerOpenReports}',
                            ].join(chrome.hostRepMetaSeparator),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: tokens.onSurfaceMuted,
                              fontSize: 11,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
        if (e.description.trim().isNotEmpty) ...[
          const SizedBox(height: 16),
          if (chrome.detailDescriptionLabel.trim().isNotEmpty)
            Text(
              chrome.detailDescriptionLabel.trim(),
              style: TextStyle(
                color: tokens.onSurfaceMuted,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.4,
              ),
            ),
          if (chrome.detailDescriptionLabel.trim().isNotEmpty)
            const SizedBox(height: 6),
          Text(
            e.description.trim(),
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurface,
              fontSize: 14,
              height: 1.45,
            ),
          ),
        ],
        const SizedBox(height: 16),
        Wrap(
          spacing: 24,
          runSpacing: 12,
          children: [
            _Fact(
              label: chrome.formatLabel,
              value: e.formatLabel.trim().isNotEmpty ? e.formatLabel : empty,
              muted: tokens.onSurfaceMuted,
            ),
            _Fact(
              label: chrome.sizeLabel,
              value: e.sizeLabel.trim().isNotEmpty ? e.sizeLabel : empty,
              muted: tokens.onSurfaceMuted,
            ),
            _Fact(
              label: softTournamentsFilterEntryLabel(chrome.entryLabel),
              value: entry,
              muted: tokens.onSurfaceMuted,
            ),
            _Fact(
              label: softTournamentsPlayersLabel(chrome.playersLabel),
              value: fill,
              muted: tokens.onSurfaceMuted,
            ),
          ],
        ),
        if (poolLines.isNotEmpty) ...[
          const SizedBox(height: 16),
          for (final line in poolLines)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(
                line,
                style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 13),
              ),
            ),
        ],
        if (ratedBlurb.trim().isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(
            ratedBlurb,
            style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 13),
          ),
        ],
        if (_roster.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(
            softCommunityRosterTitle(chrome.rosterTitle),
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final row in _roster)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: tokens.onSurfaceMuted.withValues(alpha: 0.35),
                    ),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    row.username.trim().isNotEmpty
                        ? row.username.trim()
                        : emptyLabel,
                    style: TextStyle(
                      color: tokens.onSurfaceMuted,
                      fontSize: 12,
                    ),
                  ),
                ),
            ],
          ),
        ],
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: FilledButton(
                onPressed: _joining ||
                        _myPending ||
                        (!_alreadyIn && e.joinCode.trim().isEmpty)
                    ? null
                    : _join,
                style: FilledButton.styleFrom(
                  backgroundColor: tokens.gold,
                  foregroundColor: tokens.onGold,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: Text(joinLabel),
              ),
            ),
            if (shareUrl.isNotEmpty &&
                chrome.shareAction.trim().isNotEmpty) ...[
              const SizedBox(width: 10),
              OutlinedButton(
                onPressed: () => unawaited(_copyShareLink(shareUrl)),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                ),
                child: Text(softCommunityShareAction(chrome.shareAction)),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({
    required this.label,
    required this.value,
    required this.muted,
  });

  final String label;
  final String value;
  final Color muted;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 140,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(color: muted, fontSize: 11),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
          ),
        ],
      ),
    );
  }
}
