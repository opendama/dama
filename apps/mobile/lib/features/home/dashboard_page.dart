import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/country_flag.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/game/matchmaking_realtime.dart';
import 'package:dama_mobile/features/notifications/notification_bell.dart';
import 'package:dama_mobile/features/notifications/notification_href_nav.dart';
import 'package:dama_mobile/features/profile/my_tournaments_panel.dart';
import 'package:dama_mobile/features/profile/profile_page.dart';
import 'package:dama_mobile/widgets/dama_brand_mark.dart';
import 'package:dama_mobile/widgets/dama_user_avatar.dart';
import 'package:dama_mobile/widgets/host_trust_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;

/// Ops hub (web `/dashboard` parity): professional KPI metrics + recent matches.
class DashboardPage extends StatefulWidget {
  DashboardPage({
    super.key,
    required this.accessToken,
    ApiConfig? config,
  }) : config = config ?? ApiConfig.defaults;

  final String accessToken;
  final ApiConfig config;

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  ClientNavPayload? _nav;
  ProfileInspectChrome? _inspect;
  List<_MyMatchRow> _matches = const [];
  String _navUnavailable = '';
  String _historyUnavailable = '';
  bool _navLoading = true;
  bool _matchesLoading = true;
  int? _rating;
  int? _xp;
  int? _wins;
  int? _losses;
  int? _draws;
  String? _username;
  String? _countryCode;
  String? _avatarThumb;
  String? _hostTrustBadge;
  String? _hostTrustTier;
  String? _walletBalance;
  String? _walletBalLabel;
  String? _userId;
  MatchmakingRealtimeController? _avatarRt;
  int _seenAvatarSeq = 0;

  @override
  void initState() {
    super.initState();
    unawaited(_loadNav());
    unawaited(_loadMatches());
    unawaited(_loadMe());
    unawaited(_loadWallet());
    WidgetsBinding.instance.addPostFrameCallback((_) => _bindAvatarRt());
  }

  @override
  void dispose() {
    _avatarRt?.removeListener(_onAvatarRt);
    _avatarRt = null;
    super.dispose();
  }

  void _bindAvatarRt() {
    if (!mounted) return;
    final rt = MatchmakingRealtimeScope.maybeOf(context);
    if (identical(rt, _avatarRt)) return;
    _avatarRt?.removeListener(_onAvatarRt);
    _avatarRt = rt;
    _avatarRt?.addListener(_onAvatarRt);
    _seenAvatarSeq = rt?.avatarEventSeq ?? 0;
  }

  void _onAvatarRt() {
    final rt = _avatarRt;
    if (rt == null || !mounted) return;
    if (rt.avatarEventSeq == _seenAvatarSeq) return;
    _seenAvatarSeq = rt.avatarEventSeq;
    final uid = (rt.lastAvatarUserId ?? '').trim();
    if (uid.isEmpty || (_userId ?? '') != uid) return;
    final thumb = (rt.lastAvatarThumbUrl ?? '').trim();
    final full = (rt.lastAvatarFullUrl ?? '').trim();
    final clear = thumb.isEmpty && full.isEmpty;
    setState(() {
      _avatarThumb = clear ? null : (thumb.isNotEmpty ? thumb : full);
    });
  }

  Future<void> _loadNav() async {
    try {
      final res = await http.get(
        Uri.parse('${widget.config.restUrl}/platform/client-nav'),
      );
      if (res.statusCode >= 300) {
        if (mounted) {
          setState(() {
            _navLoading = false;
            _navUnavailable = '';
          });
        }
        return;
      }
      final payload = ClientNavPayload.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      ProfileInspectChrome? inspect;
      try {
        final chromeRes = await http.get(
          Uri.parse('${widget.config.restUrl}/public/profile-inspect-chrome'),
        );
        if (chromeRes.statusCode < 300) {
          inspect = ProfileInspectChrome.fromJson(
            jsonDecode(chromeRes.body) as Map<String, dynamic>,
          );
        }
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _nav = payload;
        _inspect = inspect;
        _navLoading = false;
        _navUnavailable = payload.dashboardUnavailable;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _navLoading = false;
        _navUnavailable = '';
      });
    }
  }

  Future<void> _loadMe() async {
    try {
      final res = await http.get(
        Uri.parse('${widget.config.restUrl}/auth/me'),
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      if (res.statusCode >= 300 || !mounted) return;
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      final user = map['user'] as Map<String, dynamic>? ?? map;
      setState(() {
        _userId = (user['id'] as String?)?.trim();
        _username = (user['username'] as String?)?.trim();
        _countryCode = (user['country_code'] as String?)?.trim() ??
            (user['countryCode'] as String?)?.trim();
        _rating = user['rating'] is int
            ? user['rating'] as int
            : int.tryParse('${user['rating']}');
        _xp = user['xp'] is int
            ? user['xp'] as int
            : int.tryParse('${user['xp']}');
        _wins = user['wins'] is int
            ? user['wins'] as int
            : int.tryParse('${user['wins']}');
        _losses = user['losses'] is int
            ? user['losses'] as int
            : int.tryParse('${user['losses']}');
        _draws = user['draws'] is int
            ? user['draws'] as int
            : int.tryParse('${user['draws']}');
        _avatarThumb = (user['avatar_thumb_url'] as String?)?.trim() ??
            (user['avatarThumbUrl'] as String?)?.trim();
        _hostTrustTier = (user['host_trust_tier'] as String?)?.trim() ??
            (user['hostTrustTier'] as String?)?.trim();
        _hostTrustBadge = (user['host_trust_badge'] as String?)?.trim() ??
            (user['hostTrustBadge'] as String?)?.trim();
      });
    } catch (_) {}
  }

  Future<void> _loadWallet() async {
    try {
      final chromeRes = await http.get(
        Uri.parse('${widget.config.restUrl}/public/wallet-chrome'),
      );
      if (chromeRes.statusCode >= 300) return;
      final walletChrome = WalletChrome.fromJson(
        jsonDecode(chromeRes.body) as Map<String, dynamic>,
      );
      if (walletChrome == null || !walletChrome.isReady) return;
      final empty = walletChrome.emptyValue;
      final pending = walletChrome.balancePending.isNotEmpty
          ? walletChrome.balancePending
          : (walletChrome.walletUnavailable.isNotEmpty
              ? walletChrome.walletUnavailable
              : empty);
      final balLabel = walletChrome.balanceLabel.trim();
      if (balLabel.isEmpty) return;

      final geoRes = await http.post(
        Uri.parse('${widget.config.restUrl}/geo/locate'),
        headers: {
          'Authorization': 'Bearer ${widget.accessToken}',
          'Content-Type': 'application/json',
        },
        body: '{}',
      );
      if (!mounted) return;
      if (geoRes.statusCode >= 300) {
        setState(() {
          _walletBalLabel = balLabel;
          _walletBalance = pending;
        });
        return;
      }
      final locate = GeoLocateResponse.fromJson(
        jsonDecode(geoRes.body) as Map<String, dynamic>,
      );
      final country = (locate.location?.countryCode ?? '').trim().toUpperCase();
      if (country.isEmpty) {
        setState(() {
          _walletBalLabel = balLabel;
          _walletBalance = pending;
        });
        return;
      }
      // Server resolves payer country from request IP (reference pay chain).
      final walletRes = await http.get(
        Uri.parse('${widget.config.restUrl}/payments/wallet'),
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      if (!mounted) return;
      if (walletRes.statusCode >= 300) {
        setState(() {
          _walletBalLabel = balLabel;
          _walletBalance = walletChrome.walletUnavailable.isNotEmpty
              ? walletChrome.walletUnavailable
              : pending;
        });
        return;
      }
      final snap = WalletSnapshot.fromJson(
        jsonDecode(walletRes.body) as Map<String, dynamic>,
      );
      final sep = walletChrome.amountCurrencySeparator;
      final bal = snap.balance;
      final cur = (snap.currency ?? '').trim();
      if (bal == null || cur.isEmpty || sep.isEmpty) {
        setState(() {
          _walletBalLabel = balLabel;
          _walletBalance = pending;
        });
        return;
      }
      setState(() {
        _walletBalLabel = balLabel;
        _walletBalance = '$bal$sep$cur';
      });
    } catch (_) {}
  }

  Future<void> _loadMatches() async {
    try {
      final railRes = await http.get(
        Uri.parse('${widget.config.restUrl}/public/play-rail-chrome'),
      );
      var limit = 0;
      if (railRes.statusCode < 300) {
        final rail = PlayRailChrome.fromJson(
          jsonDecode(railRes.body) as Map<String, dynamic>,
        );
        if (rail != null) {
          limit = int.tryParse(rail.listPageSize.trim()) ?? 0;
        }
      }
      if (limit < 1) {
        if (mounted) {
          setState(() {
            _matchesLoading = false;
            _historyUnavailable = _nav?.dashboardHistoryUnavailable ?? '';
          });
        }
        return;
      }
      final res = await http.get(
        Uri.parse('${widget.config.restUrl}/matches/me').replace(
          queryParameters: {'skip': '0', 'limit': '$limit'},
        ),
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      if (res.statusCode >= 300) {
        if (mounted) {
          setState(() {
            _matchesLoading = false;
            _historyUnavailable = _nav?.dashboardHistoryUnavailable ?? '';
          });
        }
        return;
      }
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      final list = (map['matches'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(_MyMatchRow.fromJson)
          .toList();
      if (!mounted) return;
      setState(() {
        _matches = list;
        _matchesLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _matchesLoading = false;
        _historyUnavailable = _nav?.dashboardHistoryUnavailable ?? '';
      });
    }
  }

  Future<void> _openProfile() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ProfilePage(accessToken: widget.accessToken),
      ),
    );
  }

  Widget _kpi(BuildContext context, String label, String value,
      {String? hint, VoidCallback? onTap}) {
    final tokens = damaColorsOf(context);
    final body = Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: tokens.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: tokens.onSurfaceMuted,
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
          if ((hint ?? '').isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              hint!,
              style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 11),
            ),
          ],
        ],
      ),
    );
    if (onTap == null) return body;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: body,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final loadingBell = widget.accessToken.trim().isNotEmpty
        ? NotificationBellButton(
            accessToken: widget.accessToken,
            onNavigateHref: (href) {
              unawaited(
                navigateNotificationHref(
                  context,
                  href: href,
                  accessToken: widget.accessToken,
                ),
              );
            },
          )
        : null;
    if (_navLoading) {
      return Scaffold(
        appBar: AppBar(
          title: const Text(''),
          actions: [if (loadingBell != null) loadingBell],
        ),
        body: const Padding(
          padding: EdgeInsets.all(16),
          child: DashboardPanelsSkeleton(),
        ),
      );
    }
    final nav = _nav;
    if (nav == null) {
      return Scaffold(
        appBar: AppBar(actions: [if (loadingBell != null) loadingBell]),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: Text(
            _navUnavailable,
            style: TextStyle(color: tokens.danger),
          ),
        ),
      );
    }

    final historyTitle = nav.dashboardHistoryTitle;
    final historyEmpty = nav.dashboardHistoryEmpty;
    final historyUnavailable = _historyUnavailable.isNotEmpty
        ? _historyUnavailable
        : nav.dashboardHistoryUnavailable;
    final inspect = _inspect;
    final ratingLabel = (inspect?.labelRating ?? '').trim();
    final xpLabel = (inspect?.labelXp ?? '').trim();
    final winsLabel = (inspect?.labelWins ?? '').trim();
    final lossesLabel = (inspect?.labelLosses ?? '').trim();
    final drawsLabel = (inspect?.labelDraws ?? '').trim();
    final empty = (inspect?.emptyValue ?? '').trim();
    final winsN = _wins;
    final lossesN = _losses;
    final drawsN = _draws;
    final kpiReady = winsN != null && lossesN != null && drawsN != null;
    final played = kpiReady ? winsN + lossesN + drawsN : 0;
    final percentSuffix = nav.dashboardPercentSuffix.trim();
    final winRate = kpiReady && played > 0 && percentSuffix.isNotEmpty
        ? '${((winsN / played) * 1000).round() / 10}$percentSuffix'
        : empty;
    final winsDisplay = winsN != null ? '$winsN' : empty;
    final lossesDisplay = lossesN != null ? '$lossesN' : empty;
    final drawsDisplay = drawsN != null ? '$drawsN' : empty;
    final sep = (inspect?.seatMetaSeparator ?? '').isNotEmpty
        ? inspect!.seatMetaSeparator
        : nav.dashboardMatchesJoiner;
    final matchesHint = kpiReady &&
            played > 0 &&
            nav.dashboardMatchesJoiner.isNotEmpty &&
            nav.dashboardMatchesSuffix.isNotEmpty
        ? '$played${nav.dashboardMatchesJoiner}${nav.dashboardMatchesSuffix}'
        : null;

    return Scaffold(
      appBar: AppBar(
        title: DamaBrandTitle(title: nav.dashboardPageTitle),
        actions: [
          if (widget.accessToken.trim().isNotEmpty)
            NotificationBellButton(
              accessToken: widget.accessToken,
              onNavigateHref: (href) {
                unawaited(
                  navigateNotificationHref(
                    context,
                    href: href,
                    accessToken: widget.accessToken,
                  ),
                );
              },
            ),
          if (nav.dashboardProfileAction.isNotEmpty)
            TextButton(
              onPressed: _openProfile,
              child: Text(nav.dashboardProfileAction),
            ),
          if (nav.dashboardPlayAction.isNotEmpty)
            TextButton(
              onPressed: () {
                Navigator.of(context).popUntil((r) => r.isFirst);
              },
              child: Text(nav.dashboardPlayAction),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (nav.dashboardPageBlurb.isNotEmpty)
            Text(
              nav.dashboardPageBlurb,
              style: TextStyle(color: tokens.onSurfaceMuted, height: 1.4),
            ),
          if ((_username ?? '').isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: tokens.card,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: tokens.borderSubtle),
              ),
              child: Row(
                children: [
                  Builder(
                    builder: (context) {
                      final live =
                          (context.watch<AuthCubit>().state.avatarUrl ?? '')
                              .trim();
                      final thumb =
                          live.isNotEmpty ? live : (_avatarThumb ?? '').trim();
                      return DamaUserAvatar(
                        imageUrl: thumb.isNotEmpty ? thumb : null,
                        radius: 20,
                      );
                    },
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                _username!,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (_rating != null) ...[
                              const SizedBox(width: 6),
                              Text(
                                '($_rating)',
                                style: TextStyle(
                                  color: tokens.onSurfaceMuted,
                                  fontSize: 12,
                                  fontFeatures: const [
                                    FontFeature.tabularFigures()
                                  ],
                                ),
                              ),
                            ],
                            const SizedBox(width: 6),
                            CountryFlag(code: _countryCode, height: 13),
                            const SizedBox(width: 6),
                            Flexible(
                              child: HostTrustBadge(
                                label: _hostTrustBadge,
                                tier: _hostTrustTier,
                                fontSize: 10,
                                dense: true,
                              ),
                            ),
                          ],
                        ),
                        if (ratingLabel.isNotEmpty || xpLabel.isNotEmpty)
                          Text(
                            [
                              if (ratingLabel.isNotEmpty)
                                '$ratingLabel ${_rating?.toString() ?? empty}',
                              if (xpLabel.isNotEmpty)
                                '$xpLabel ${_xp?.toString() ?? empty}',
                            ].join(sep),
                            style: TextStyle(
                              color: tokens.onSurfaceMuted,
                              fontSize: 12,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 1.45,
            children: [
              if (ratingLabel.isNotEmpty)
                _kpi(context, ratingLabel, _rating?.toString() ?? empty),
              if (xpLabel.isNotEmpty)
                _kpi(context, xpLabel, _xp?.toString() ?? empty),
              if (winsLabel.isNotEmpty) _kpi(context, winsLabel, winsDisplay),
              if (lossesLabel.isNotEmpty)
                _kpi(context, lossesLabel, lossesDisplay),
              if (drawsLabel.isNotEmpty)
                _kpi(context, drawsLabel, drawsDisplay),
              if (nav.dashboardWinRateLabel.isNotEmpty)
                _kpi(
                  context,
                  nav.dashboardWinRateLabel,
                  winRate.isNotEmpty ? winRate : empty,
                  hint: matchesHint,
                ),
              if ((_walletBalLabel ?? '').isNotEmpty &&
                  (_walletBalance ?? '').isNotEmpty)
                _kpi(
                  context,
                  _walletBalLabel!,
                  _walletBalance!,
                  onTap: nav.dashboardWalletHref.isNotEmpty
                      ? () {
                          unawaited(
                            navigateNotificationHref(
                              context,
                              href: nav.dashboardWalletHref,
                              accessToken: widget.accessToken,
                            ),
                          );
                        }
                      : null,
                ),
            ],
          ),
          const SizedBox(height: 20),
          MyTournamentsPanel(
            accessToken: widget.accessToken,
            config: widget.config,
            skipStoreKey: 'dashboard_my_cups',
          ),
          if (historyTitle.isNotEmpty) ...[
            const SizedBox(height: 20),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Text(
                    historyTitle,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ),
                if (nav.dashboardTransactionsAction.isNotEmpty &&
                    nav.dashboardTransactionsHref.isNotEmpty)
                  OutlinedButton(
                    onPressed: () {
                      unawaited(
                        navigateNotificationHref(
                          context,
                          href: nav.dashboardTransactionsHref,
                          accessToken: widget.accessToken,
                        ),
                      );
                    },
                    child: Text(nav.dashboardTransactionsAction),
                  ),
              ],
            ),
            const SizedBox(height: 8),
          ],
          if (_matchesLoading)
            const FormCardSkeleton()
          else if (historyUnavailable.isNotEmpty && _matches.isEmpty)
            Text(
              historyUnavailable,
              style: TextStyle(color: tokens.danger),
            )
          else if (_matches.isEmpty)
            Text(
              historyEmpty,
              style: TextStyle(color: tokens.onSurfaceMuted),
            )
          else
            ..._matches.map((m) {
              final draw = m.isDraw;
              final won = !draw &&
                  m.winnerId != null &&
                  m.winnerId!.isNotEmpty &&
                  _userId != null &&
                  m.winnerId == _userId;
              final lost = !draw &&
                  m.winnerId != null &&
                  m.winnerId!.isNotEmpty &&
                  _userId != null &&
                  m.winnerId != _userId;
              final outcome = draw
                  ? (inspect?.outcomeDraw ?? inspect?.labelDraws ?? empty)
                  : won
                      ? (inspect?.outcomeWin ?? inspect?.labelWins ?? empty)
                      : lost
                          ? (inspect?.outcomeLoss ??
                              inspect?.labelLosses ??
                              empty)
                          : empty;
              final when = (m.finishedAt ?? '').trim();
              final meta = [
                if ((m.mode ?? '').trim().isNotEmpty) m.mode!.trim(),
                if (m.moveCount != null) '${m.moveCount}',
                if (when.isNotEmpty)
                  when.length >= 10 ? when.substring(0, 10) : when,
              ].join(sep);
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  color: tokens.card,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: tokens.borderSubtle),
                ),
                child: ListTile(
                  dense: true,
                  title: Text(outcome,
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(meta),
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _MyMatchRow {
  const _MyMatchRow({
    required this.id,
    this.mode,
    this.winnerId,
    this.isDraw = false,
    this.moveCount,
    this.finishedAt,
  });

  final String id;
  final String? mode;
  final String? winnerId;
  final bool isDraw;
  final int? moveCount;
  final String? finishedAt;

  factory _MyMatchRow.fromJson(Map<String, dynamic> json) {
    return _MyMatchRow(
      id: (json['id'] as String?)?.trim() ?? '',
      mode: (json['mode'] as String?)?.trim(),
      winnerId: (json['winner_id'] as String?)?.trim(),
      isDraw: json['is_draw'] == true,
      moveCount: json['move_count'] is int ? json['move_count'] as int : null,
      finishedAt: (json['finished_at'] as String?)?.trim(),
    );
  }
}
