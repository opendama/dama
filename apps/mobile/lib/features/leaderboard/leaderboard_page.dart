import 'dart:convert';
import 'dart:ui' show FontFeature;

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/features/notifications/notification_app_bar_actions.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/country_flag.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/core/ui/skip_pagination_bar.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/game/matchmaking_realtime.dart';
import 'package:dama_mobile/features/home/home_page.dart';
import 'package:dama_mobile/features/leaderboard/leaderboard_cubit.dart';
import 'package:dama_mobile/features/player/player_inspect_sheet.dart';
import 'package:dama_mobile/widgets/dama_user_avatar.dart';
import 'package:dama_mobile/widgets/host_trust_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';

/// Locale thousands grouping for HoF scores (web `toLocaleString` parity).
String _formatScore(int n) => NumberFormat.decimalPattern().format(n);

class LeaderboardPage extends StatefulWidget {
  LeaderboardPage({super.key, ApiConfig? config})
      : config = config ?? ApiConfig.defaults;

  final ApiConfig config;

  @override
  State<LeaderboardPage> createState() => _LeaderboardPageState();
}

class _LeaderboardPageState extends State<LeaderboardPage> {
  LeaderboardChrome? _chrome;
  String? _chromeError;
  bool _chromeLoading = true;

  @override
  void initState() {
    super.initState();
    _loadChrome();
  }

  Future<void> _loadChrome() async {
    try {
      final res = await http.get(
        Uri.parse('${widget.config.restUrl}/public/leaderboard-chrome'),
      );
      Map<String, dynamic>? map;
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) map = decoded;
      } catch (_) {}
      final fromBody =
          (map?['leaderboard_chrome_unavailable'] as String?)?.trim() ?? '';
      if (res.statusCode != 200) {
        if (!mounted) return;
        setState(() {
          _chromeLoading = false;
          _chromeError = fromBody.isNotEmpty
              ? fromBody
              : ((map?['error'] as String?)?.trim() ?? '');
        });
        return;
      }
      final chrome = LeaderboardChrome.fromJson(map);
      if (!mounted) return;
      setState(() {
        _chrome = chrome;
        _chromeLoading = false;
        _chromeError = chrome == null ? fromBody : null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _chromeLoading = false;
        _chromeError = '';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_chromeLoading) {
      return Scaffold(
        appBar: AppBar(actions: const [NotificationAppBarActions()]),
        body: const LeaderboardPageSkeleton(),
      );
    }
    final chrome = _chrome;
    if (chrome == null) {
      return Scaffold(
        appBar: AppBar(actions: const [NotificationAppBarActions()]),
        body: Center(
          child: Text(
            (_chromeError ?? '').isNotEmpty ? _chromeError! : '',
            style: TextStyle(color: damaColorsOf(context).danger),
          ),
        ),
      );
    }
    final token = context.watch<AuthCubit>().state.token;
    final tokenKey = (token ?? '').trim();
    final initialPeriod = _parseHofPeriod(chrome.defaultPeriod);
    final pageSize = int.tryParse(chrome.listPageSize.trim()) ?? 0;
    if (initialPeriod == null || pageSize <= 0) {
      return Scaffold(
        appBar: AppBar(actions: const [NotificationAppBarActions()]),
        body: Center(
          child: Text(
            chrome.loadFailed,
            style: TextStyle(color: damaColorsOf(context).danger),
          ),
        ),
      );
    }
    return BlocProvider(
      key: ValueKey('hof-$tokenKey-$initialPeriod-$pageSize'),
      create: (_) => LeaderboardCubit(
        config: widget.config,
        loadFailedMessage: chrome.loadFailed,
        accessToken: token,
        pageSize: pageSize,
        initialPeriod: initialPeriod,
      )..load(),
      child: _LeaderboardView(chrome: chrome),
    );
  }
}

/// Fail-closed parse of DB `default_period` (never invent week).
String? _parseHofPeriod(String raw) {
  final p = raw.trim().toLowerCase();
  if (p == 'week' || p == 'month' || p == 'year' || p == 'all') return p;
  return null;
}

class _LeaderboardView extends StatefulWidget {
  const _LeaderboardView({required this.chrome});

  final LeaderboardChrome chrome;

  @override
  State<_LeaderboardView> createState() => _LeaderboardViewState();
}

class _LeaderboardViewState extends State<_LeaderboardView> {
  MatchmakingRealtimeController? _avatarRt;
  int _seenAvatarSeq = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bindAvatarRt());
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
    if (uid.isEmpty) return;
    context.read<LeaderboardCubit>().patchAvatar(
          uid,
          rt.lastAvatarThumbUrl,
          rt.lastAvatarFullUrl,
        );
  }

  @override
  void dispose() {
    _avatarRt?.removeListener(_onAvatarRt);
    _avatarRt = null;
    super.dispose();
  }

  Future<void> _openPlayer(BuildContext context, PublicPlayerCard p) async {
    final id = p.id;
    if (id.isEmpty) return;
    final req = await showPlayerInspectSheet(context, id);
    if (req == null || !context.mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => HomePage(
          launchUri: Uri(
            path: '/',
            queryParameters: {
              'view': 'match',
              'opponent': req.username,
              'opponentId': req.id,
              'opponentRating': '${req.rating}',
            },
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final chrome = widget.chrome;
    final tokens = damaColorsOf(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(chrome.hallOfFameTitle),
        actions: const [NotificationAppBarActions()],
      ),
      body: BlocBuilder<LeaderboardCubit, LeaderboardState>(
        builder: (context, state) {
          final meta = state.meta;
          final periods = <(String, String)>[
            ('all', chrome.periodAll),
            ('week', chrome.periodWeek),
            ('month', chrome.periodMonth),
            ('year', chrome.periodYear),
          ];
          // Score labels follow paintedPeriod while soft-fetching a new tab.
          final painted = state.paintedPeriod.trim().isNotEmpty
              ? state.paintedPeriod.trim()
              : state.period;
          final showSkeleton = state.loading && state.rows.isEmpty;
          return RefreshIndicator(
            onRefresh: () => context.read<LeaderboardCubit>().refresh(),
            child: Stack(
              children: [
                ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Opacity(
                      opacity: state.softFetching ? 0.72 : 1,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            chrome.pageBlurb,
                            style: TextStyle(color: tokens.onSurfaceMuted),
                          ),
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              for (final p in periods)
                                ChoiceChip(
                                  label: Text(p.$2),
                                  selected: state.period == p.$1,
                                  onSelected: (_) => context
                                      .read<LeaderboardCubit>()
                                      .setPeriod(p.$1),
                                ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          if (showSkeleton) const LeaderboardSkeleton(),
                          if (state.error != null)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Text(
                                state.error!,
                                style: TextStyle(
                                  color: damaColorsOf(context).danger,
                                ),
                              ),
                            ),
                          if (!showSkeleton &&
                              state.rows.isEmpty &&
                              state.error == null)
                            Text(
                              chrome.empty,
                              style: TextStyle(color: tokens.onSurfaceMuted),
                            ),
                          // Keep podium/list during soft period switch (Status parity).
                          if (!showSkeleton &&
                              state.error == null &&
                              state.rows.isNotEmpty) ...[
                            if (state.skip == 0 && state.rows.length >= 1) ...[
                              _PodiumRow(
                                chrome: chrome,
                                tokens: tokens,
                                first: state.rows.isNotEmpty
                                    ? state.rows[0]
                                    : null,
                                second: state.rows.length > 1
                                    ? state.rows[1]
                                    : null,
                                third: state.rows.length > 2
                                    ? state.rows[2]
                                    : null,
                                period: painted,
                                onSelect: (p) => _openPlayer(context, p),
                              ),
                              const SizedBox(height: 16),
                              if (state.rows.length > 3) ...[
                                Text(
                                  chrome.rankListTitle,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.6,
                                    color: tokens.onSurfaceMuted,
                                  ),
                                ),
                                const SizedBox(height: 8),
                              ],
                            ],
                            if (state.skip > 0 || state.rows.length > 3) ...[
                              _RankGridPanel(
                                chrome: chrome,
                                tokens: tokens,
                                period: painted,
                                skip: state.skip,
                                metaSkip: meta?.skip ?? state.skip,
                                players:
                                    (state.skip == 0 && state.rows.length > 3)
                                        ? state.rows.sublist(3)
                                        : state.skip == 0
                                            ? const <PublicPlayerCard>[]
                                            : state.rows,
                                onSelect: (p) => _openPlayer(context, p),
                              ),
                              const SizedBox(height: 12),
                            ],
                          ],
                          if (!showSkeleton && state.error == null) ...[
                            Card(
                              color: tokens.card,
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 12,
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        state.me != null && state.me!.rank > 0
                                            ? '${chrome.yourRankPrefix} #${state.me!.rank}'
                                                '${chrome.metaSeparator}${_formatScore(state.me!.points)}'
                                                '${painted == 'all' ? '' : ' ${chrome.ptsSuffix}'}'
                                            : '${chrome.yourRankPrefix} ${chrome.unrankedLabel}',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w700,
                                          color: state.me != null &&
                                                  state.me!.rank > 0
                                              ? tokens.gold
                                              : tokens.onSurfaceMuted,
                                        ),
                                      ),
                                    ),
                                    if (state.period != 'all')
                                      TextButton(
                                        onPressed: () => context
                                            .read<LeaderboardCubit>()
                                            .setPeriod('all'),
                                        child: Text(chrome.viewFullLeaderboard),
                                      ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    // Outside Opacity - stable pagination chrome (no flicker).
                    if (meta != null && meta.totalPages > 1)
                      SkipPaginationBar(
                        meta: meta,
                        busy: state.softFetching,
                        onSkip: (skip) =>
                            context.read<LeaderboardCubit>().goToSkip(skip),
                      ),
                  ],
                ),
                // Overlay progress - never inserts into ListView (no layout jump).
                if (state.softFetching)
                  const Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    child: LinearProgressIndicator(minHeight: 2),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _RankGridPanel extends StatelessWidget {
  const _RankGridPanel({
    required this.chrome,
    required this.tokens,
    required this.period,
    required this.skip,
    required this.metaSkip,
    required this.players,
    required this.onSelect,
  });

  final LeaderboardChrome chrome;
  final DamaColors tokens;
  final String period;
  final int skip;
  final int metaSkip;
  final List<PublicPlayerCard> players;
  final Future<void> Function(PublicPlayerCard) onSelect;

  @override
  Widget build(BuildContext context) {
    if (players.isEmpty) return const SizedBox.shrink();
    return LayoutBuilder(
      builder: (context, constraints) {
        final twoCol = constraints.maxWidth >= 560;
        final panel = Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: tokens.gold.withValues(alpha: 0.35)),
            color: tokens.brand.withValues(alpha: 0.08),
          ),
          child: twoCol
              ? GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: players.length,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisExtent: 76,
                    crossAxisSpacing: 8,
                    mainAxisSpacing: 8,
                  ),
                  itemBuilder: (context, i) => _rankTile(context, i),
                )
              : Column(
                  children: [
                    for (var i = 0; i < players.length; i++) ...[
                      if (i > 0) const SizedBox(height: 8),
                      _rankTile(context, i),
                    ],
                  ],
                ),
        );
        return panel;
      },
    );
  }

  Widget _rankTile(BuildContext context, int i) {
    final p = players[i];
    final rank = p.regionalRank;
    final id = p.id;
    final thumb = p.avatarThumbUrl;
    final online = p.online;
    final playing = p.playing;
    final level = p.levelLabel;
    final country = p.countryCode;
    final displayRank = skip == 0 ? skip + i + 4 : metaSkip + i + 1;
    final stats = '${p.wins}${chrome.winsAbbr}'
        '${chrome.statsSeparator}'
        '${p.losses}${chrome.lossesAbbr}'
        '${chrome.statsSeparator}'
        '${p.draws}${chrome.drawsAbbr}'
        '${level != null && level.isNotEmpty ? '${chrome.metaSeparator}$level' : ''}'
        '${country != null && country.isNotEmpty ? '${chrome.metaSeparator}${country.toUpperCase()}' : ''}'
        '${rank != null ? '${chrome.metaSeparator}${chrome.rankPrefix}$rank' : ''}';
    final scoreLabel = period == 'all'
        ? _formatScore(p.rating)
        : (p.points != null ? _formatScore(p.points!) : '');
    final scoreSub = period == 'all'
        ? '${_formatScore(p.xp)} ${chrome.xpSuffix}'
        : chrome.ptsSuffix;
    return Material(
      color: tokens.card,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: tokens.gold.withValues(alpha: 0.28)),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 22,
              child: Text(
                '$displayRank',
                style: TextStyle(
                  color: tokens.gold,
                  fontWeight: FontWeight.w700,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ),
            const SizedBox(width: 6),
            Semantics(
              label:
                  id.isEmpty ? '' : '${chrome.inspectAriaPrefix} ${p.username}',
              button: id.isNotEmpty,
              child: InkWell(
                onTap: id.isEmpty ? null : () => onSelect(p),
                customBorder: const CircleBorder(),
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    DamaUserAvatar(
                      imageUrl: thumb,
                      radius: 16,
                    ),
                    // Inset presence badge (web OnlineStatusDot parity) so it stays visible.
                    Positioned(
                      right: 1,
                      bottom: 1,
                      child: Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: playing
                              ? tokens.playing
                              : online
                                  ? tokens.online
                                  : tokens.offline,
                          shape: BoxShape.circle,
                          border: Border.all(color: tokens.card, width: 2),
                          boxShadow: [
                            BoxShadow(
                              color: tokens.card,
                              blurRadius: 0,
                              spreadRadius: 0.5,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Semantics(
                          label: id.isEmpty
                              ? ''
                              : '${chrome.inspectAriaPrefix} ${p.username}',
                          button: id.isNotEmpty,
                          child: InkWell(
                            onTap: id.isEmpty ? null : () => onSelect(p),
                            child: Text(
                              p.username,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ),
                      ),
                      Text(
                        ' (${p.rating})',
                        style: TextStyle(
                          color: tokens.onSurfaceMuted,
                          fontSize: 12,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                      const SizedBox(width: 4),
                      CountryFlag(code: country),
                    ],
                  ),
                  HostTrustBadge(
                    label: p.hostTrustBadge,
                    tier: p.hostTrustTier,
                    fontSize: 10,
                    dense: true,
                  ),
                  Text(
                    stats,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: tokens.onSurfaceMuted,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  scoreLabel,
                  style: TextStyle(
                    color: tokens.gold,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  scoreSub,
                  style: TextStyle(
                    color: tokens.onSurfaceMuted,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _PodiumRow extends StatelessWidget {
  const _PodiumRow({
    required this.chrome,
    required this.tokens,
    required this.first,
    required this.second,
    required this.third,
    required this.period,
    required this.onSelect,
  });

  final LeaderboardChrome chrome;
  final DamaColors tokens;
  final PublicPlayerCard? first;
  final PublicPlayerCard? second;
  final PublicPlayerCard? third;
  final String period;
  final Future<void> Function(PublicPlayerCard) onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 16, 8, 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tokens.borderSubtle),
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            tokens.brand.withValues(alpha: 0.18),
            tokens.card,
          ],
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: _PodiumSeat(
              place: 2,
              player: second,
              chrome: chrome,
              tokens: tokens,
              period: period,
              aria: chrome.podiumSecondAria,
              crownLabel: chrome.podiumSecondCrown,
              blockHeight: 56,
              onSelect: onSelect,
            ),
          ),
          Expanded(
            child: _PodiumSeat(
              place: 1,
              player: first,
              chrome: chrome,
              tokens: tokens,
              period: period,
              aria: chrome.podiumFirstAria,
              crownLabel: chrome.podiumFirstCrown,
              blockHeight: 84,
              onSelect: onSelect,
            ),
          ),
          Expanded(
            child: _PodiumSeat(
              place: 3,
              player: third,
              chrome: chrome,
              tokens: tokens,
              period: period,
              aria: chrome.podiumThirdAria,
              crownLabel: chrome.podiumThirdCrown,
              blockHeight: 44,
              onSelect: onSelect,
            ),
          ),
        ],
      ),
    );
  }
}

class _PodiumSeat extends StatelessWidget {
  const _PodiumSeat({
    required this.place,
    required this.player,
    required this.chrome,
    required this.tokens,
    required this.period,
    required this.aria,
    required this.crownLabel,
    required this.blockHeight,
    required this.onSelect,
  });

  final int place;
  final PublicPlayerCard? player;
  final LeaderboardChrome chrome;
  final DamaColors tokens;
  final String period;
  final String aria;
  final String? crownLabel;
  final double blockHeight;
  final Future<void> Function(PublicPlayerCard) onSelect;

  @override
  Widget build(BuildContext context) {
    final p = player;
    if (p == null) return const SizedBox.shrink();
    final pts = period == 'all' ? p.rating : p.points;
    final thumb = p.avatarThumbUrl;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Column(
        children: [
          SizedBox(
            height: 28,
            child: Center(
              child: Text(
                crownLabel ?? '',
                style: TextStyle(
                  color: tokens.gold,
                  fontWeight: FontWeight.w800,
                  fontSize: place == 1 ? 16 : 12,
                ),
              ),
            ),
          ),
          Semantics(
            label: '$aria ${p.username}',
            button: true,
            child: InkWell(
              onTap: () => onSelect(p),
              customBorder: const CircleBorder(),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  DamaUserAvatar(
                    imageUrl: thumb,
                    radius: place == 1 ? 34 : 28,
                  ),
                  Positioned(
                    right: 2,
                    bottom: 2,
                    child: Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: p.playing
                            ? tokens.playing
                            : p.online
                                ? tokens.online
                                : tokens.offline,
                        shape: BoxShape.circle,
                        border: Border.all(color: tokens.card, width: 2),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (place == 1 && (crownLabel ?? '').isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              crownLabel!,
              style: TextStyle(
                color: tokens.gold,
                fontWeight: FontWeight.w800,
                fontSize: 18,
              ),
            ),
          ],
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Semantics(
                  label: '$aria ${p.username}',
                  button: true,
                  child: InkWell(
                    onTap: () => onSelect(p),
                    child: Text(
                      p.username,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 12),
                    ),
                  ),
                ),
              ),
              Text(
                ' (${p.rating})',
                style: TextStyle(
                  color: tokens.onSurfaceMuted,
                  fontSize: 11,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(width: 4),
              CountryFlag(code: p.countryCode),
            ],
          ),
          HostTrustBadge(
            label: p.hostTrustBadge,
            tier: p.hostTrustTier,
            fontSize: 9,
            dense: true,
          ),
          Text(
            pts == null
                ? ''
                : period == 'all'
                    ? _formatScore(pts)
                    : '${_formatScore(pts)} ${chrome.ptsSuffix}',
            style: TextStyle(color: tokens.gold, fontSize: 11),
          ),
          const SizedBox(height: 6),
          Container(
            height: blockHeight,
            width: double.infinity,
            decoration: BoxDecoration(
              color: tokens.brand.withValues(alpha: 0.22),
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(10)),
              border: Border(
                top: BorderSide(color: tokens.borderSubtle),
                left: BorderSide(color: tokens.borderSubtle),
                right: BorderSide(color: tokens.borderSubtle),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
