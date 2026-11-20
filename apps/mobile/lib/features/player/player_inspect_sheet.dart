import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/cache/query_cache.dart';
import 'package:dama_mobile/core/cache/skip_store.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/country_flag.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/core/ui/skip_pagination_bar.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/chat/compose_message_sheet.dart';
import 'package:dama_mobile/features/game/matchmaking_realtime.dart';
import 'package:dama_mobile/features/game/spectate_page.dart';
import 'package:dama_mobile/features/leaderboard/leaderboard_cubit.dart'
    show SkipMeta;
import 'package:dama_mobile/widgets/dama_user_avatar.dart';
import 'package:dama_mobile/widgets/host_trust_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;

/// Result when the user taps Challenge - open Create Game with this opponent.
class PlayerChallengeRequest {
  const PlayerChallengeRequest({
    required this.id,
    required this.username,
    required this.rating,
    this.countryCode,
    this.avatarThumbUrl,
    this.hostTrustTier,
    this.hostTrustBadge,
  });

  final String id;
  final String username;
  final int rating;
  final String? countryCode;
  final String? avatarThumbUrl;
  final String? hostTrustTier;
  final String? hostTrustBadge;
}

/// Full-screen style inspection sheet hydrated from GET /players/{id}.
Future<PlayerChallengeRequest?> showPlayerInspectSheet(
  BuildContext context,
  String playerId,
) async {
  return showModalBottomSheet<PlayerChallengeRequest>(
    context: context,
    isScrollControlled: true,
    backgroundColor: damaColorsOf(context).card,
    builder: (_) => _PlayerInspectBody(playerId: playerId),
  );
}

class _PlayerInspectBody extends StatefulWidget {
  const _PlayerInspectBody({required this.playerId});

  final String playerId;

  @override
  State<_PlayerInspectBody> createState() => _PlayerInspectBodyState();
}

class _PlayerInspectBodyState extends State<_PlayerInspectBody> {
  bool _loading = true;
  String? _error;
  PlayerDetailResponse? _detail;
  ProfileInspectChrome? _chrome;
  PlayRailChrome? _railChrome;
  bool _chromeLoading = true;
  List<RestMatchSummary> _matches = const [];
  List<TournamentPlacementEntry> _placements = const [];
  SkipMeta? _matchesMeta;
  SkipMeta? _placementsMeta;
  bool _matchesLoading = false;
  bool _placementsLoading = false;
  MatchmakingRealtimeController? _avatarRt;
  int _seenAvatarSeq = 0;

  @override
  void initState() {
    super.initState();
    unawaited(_loadChrome());
    final cached = QueryCache.read<PlayerDetailResponse>(
      CacheKeys.player(widget.playerId),
      maxAge: QueryCache.sessionTtl,
      allowStale: true,
    );
    if (cached != null) {
      _detail = cached;
      _loading = false;
      unawaited(_load(showSkeleton: false));
    } else {
      unawaited(_load(showSkeleton: true));
    }
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
    // Prefer patched QueryCache (root + friends_preview); fall back to WS URLs.
    final cached = QueryCache.read<PlayerDetailResponse>(
      CacheKeys.player(widget.playerId),
      maxAge: QueryCache.sessionTtl,
      allowStale: true,
    );
    if (cached != null) {
      setState(() => _detail = cached);
      return;
    }
    if (uid != widget.playerId.trim()) return;
    final detail = _detail;
    final player = detail?.player;
    if (detail == null || player == null) return;
    final thumb = (rt.lastAvatarThumbUrl ?? '').trim();
    final full = (rt.lastAvatarFullUrl ?? '').trim();
    final clear = thumb.isEmpty && full.isEmpty;
    setState(() {
      _detail = PlayerDetailResponse(
        player: player.copyWith(
          clearAvatar: clear,
          avatarThumbUrl: clear ? null : (thumb.isNotEmpty ? thumb : full),
          avatarFullUrl: clear ? null : (full.isNotEmpty ? full : null),
        ),
        matches: detail.matches,
        placements: detail.placements,
        regionalRank: detail.regionalRank,
        regionLabel: detail.regionLabel,
        friendsCount: detail.friendsCount,
        friendsPreview: detail.friendsPreview,
      );
    });
  }

  @override
  void dispose() {
    _avatarRt?.removeListener(_onAvatarRt);
    _avatarRt = null;
    super.dispose();
  }

  Future<void> _loadChrome() async {
    try {
      final results = await Future.wait([
        http.get(
          Uri.parse(
              '${ApiConfig.baseUrl}/api/v1/public/profile-inspect-chrome'),
        ),
        http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/public/play-rail-chrome'),
        ),
      ]);
      Map<String, dynamic>? map;
      Map<String, dynamic>? railMap;
      try {
        final decoded = jsonDecode(results[0].body);
        if (decoded is Map<String, dynamic>) map = decoded;
      } catch (_) {}
      try {
        final decoded = jsonDecode(results[1].body);
        if (decoded is Map<String, dynamic>) railMap = decoded;
      } catch (_) {}
      final chrome = ProfileInspectChrome.fromJson(map);
      final rail = PlayRailChrome.fromJson(railMap);
      if (!mounted) return;
      setState(() {
        _chrome = chrome;
        _railChrome = rail;
        _chromeLoading = false;
        if (chrome == null) {
          _error =
              (map?['profile_inspect_chrome_unavailable'] as String?)?.trim() ??
                  '';
        }
      });
      if (chrome != null && chrome.listPageSizeInt > 0) {
        final pid = widget.playerId.trim();
        unawaited(_loadMatches(SkipStore.read('inspect_matches_$pid')));
        unawaited(_loadPlacements(SkipStore.read('inspect_placements_$pid')));
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _chromeLoading = false;
        _error = '';
      });
    }
  }

  Future<void> _loadMatches(int skip) async {
    final limit = _chrome?.listPageSizeInt ?? 0;
    if (limit < 1) return;
    if (mounted) setState(() => _matchesLoading = true);
    try {
      final uri = Uri.parse(
        '${ApiConfig.baseUrl}/api/v1/players/${widget.playerId}/matches',
      ).replace(queryParameters: {
        'skip': '$skip',
        'limit': '$limit',
      });
      final res = await http.get(uri);
      if (res.statusCode >= 300) {
        if (mounted) setState(() => _matchesLoading = false);
        return;
      }
      final json = jsonDecode(res.body) as Map<String, dynamic>;
      final list = (json['matches'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(RestMatchSummary.fromJson)
          .toList();
      final metaMap = json['meta'];
      final meta =
          metaMap is Map<String, dynamic> ? SkipMeta.fromJson(metaMap) : null;
      if (!mounted) return;
      setState(() {
        _matches = list;
        _matchesMeta = meta;
        _matchesLoading = false;
      });
      unawaited(
          SkipStore.write('inspect_matches_${widget.playerId.trim()}', skip));
    } catch (_) {
      if (mounted) setState(() => _matchesLoading = false);
    }
  }

  Future<void> _loadPlacements(int skip) async {
    final limit = _chrome?.listPageSizeInt ?? 0;
    if (limit < 1) return;
    if (mounted) setState(() => _placementsLoading = true);
    try {
      final uri = Uri.parse(
        '${ApiConfig.baseUrl}/api/v1/players/${widget.playerId}/placements',
      ).replace(queryParameters: {
        'skip': '$skip',
        'limit': '$limit',
      });
      final res = await http.get(uri);
      if (res.statusCode >= 300) {
        if (mounted) setState(() => _placementsLoading = false);
        return;
      }
      final json = jsonDecode(res.body) as Map<String, dynamic>;
      final list = (json['tournament_placements'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(TournamentPlacementEntry.fromJson)
          .toList();
      final metaMap = json['meta'];
      final meta =
          metaMap is Map<String, dynamic> ? SkipMeta.fromJson(metaMap) : null;
      if (!mounted) return;
      setState(() {
        _placements = list;
        _placementsMeta = meta;
        _placementsLoading = false;
      });
      unawaited(SkipStore.write(
          'inspect_placements_${widget.playerId.trim()}', skip));
    } catch (_) {
      if (mounted) setState(() => _placementsLoading = false);
    }
  }

  Future<void> _load({required bool showSkeleton}) async {
    if (showSkeleton && mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/players/${widget.playerId}'),
      );
      if (res.statusCode >= 300) {
        if (!mounted) return;
        setState(() {
          _error = _chrome?.playerUnavailable ?? '';
          _loading = false;
        });
        return;
      }
      final detail = PlayerDetailResponse.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      QueryCache.write(CacheKeys.player(widget.playerId), detail);
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _loading = false;
        if (detail.player == null) {
          _error = _chrome?.playerUnavailable ?? '';
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = _chrome?.playerUnavailable ?? '';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final chrome = _chrome;
    final p = _detail?.player;
    final imageUrl = p?.displayImageUrl;

    if (_chromeLoading || chrome == null) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close),
                ),
              ),
              const PlayerInspectSkeleton(),
            ],
          ),
        ),
      );
    }

    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.9,
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_loading) ...[
                Align(
                  alignment: Alignment.centerRight,
                  child: IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close),
                  ),
                ),
                const PlayerInspectSkeleton(),
              ] else
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  p?.username ?? '',
                                  style: Theme.of(context).textTheme.titleLarge,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (p != null && p.rating > 0) ...[
                                const SizedBox(width: 6),
                                Text(
                                  '(${p.rating})',
                                  style: TextStyle(
                                    color: tokens.onSurfaceMuted,
                                    fontSize: 16,
                                  ),
                                ),
                              ],
                              const SizedBox(width: 6),
                              CountryFlag(code: p?.countryCode, height: 14),
                              const SizedBox(width: 6),
                              Flexible(
                                child: HostTrustBadge(
                                  label: p?.hostTrustBadge,
                                  tier: p?.hostTrustTier,
                                  fontSize: 10,
                                  dense: true,
                                ),
                              ),
                            ],
                          ),
                          ...(() {
                            final sep = chrome.hostRepMetaSeparator;
                            final card = p;
                            if (sep.isEmpty ||
                                chrome.hostRepFinishedLabel.trim().isEmpty ||
                                chrome.hostRepCancelledLabel.trim().isEmpty ||
                                chrome.hostRepReportsLabel.trim().isEmpty ||
                                card == null ||
                                card.hostFinishedPaidCups == null ||
                                card.hostCancelledPaidCups == null ||
                                card.hostOpenReports == null) {
                              return <Widget>[];
                            }
                            return <Widget>[
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(
                                  [
                                    '${chrome.hostRepFinishedLabel.trim()} ${card.hostFinishedPaidCups}',
                                    '${chrome.hostRepCancelledLabel.trim()} ${card.hostCancelledPaidCups}',
                                    '${chrome.hostRepReportsLabel.trim()} ${card.hostOpenReports}',
                                  ].join(sep),
                                  style: TextStyle(
                                    color: tokens.onSurfaceMuted,
                                    fontSize: 11,
                                  ),
                                ),
                              ),
                            ];
                          }()),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
              if (_error != null && _error!.isNotEmpty)
                Text(_error!,
                    style: TextStyle(color: damaColorsOf(context).danger)),
              if (!_loading && p != null) ...[
                const SizedBox(height: 12),
                SizedBox(
                  height: 220,
                  child: InteractiveViewer(
                    minScale: 1,
                    maxScale: 4,
                    child: Center(
                      child: DamaUserAvatar(
                        imageUrl:
                            imageUrl ?? p.avatarThumbUrl ?? p.avatarFullUrl,
                        radius: 72,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  chrome.zoomHint,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
                ),
                if (_railChrome != null) ...[
                  const SizedBox(height: 8),
                  Builder(
                    builder: (context) {
                      final rail = _railChrome!;
                      final status = p.playing
                          ? rail.playingLabel
                          : p.online
                              ? rail.onlineLabel
                              : rail.offlineLabel;
                      final color = p.playing
                          ? tokens.playing
                          : p.online
                              ? tokens.online
                              : tokens.offline;
                      return Row(
                        children: [
                          Container(
                            width: 10,
                            height: 10,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: color,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            status,
                            style: TextStyle(
                              color: color,
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ],
                if (_railChrome != null &&
                    context.read<AuthCubit>().state.isAuthenticated &&
                    context.read<AuthCubit>().state.userId != p.id) ...[
                  const SizedBox(height: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (p.playing &&
                          (p.playingGameId ?? '').trim().isNotEmpty) ...[
                        OutlinedButton.icon(
                          onPressed: () {
                            final gid = (p.playingGameId ?? '').trim();
                            if (gid.isEmpty) return;
                            final token = context.read<AuthCubit>().state.token;
                            final nav = Navigator.of(context);
                            nav.pop();
                            nav.push(
                              MaterialPageRoute(
                                builder: (_) => SpectatePage(
                                  accessToken: token,
                                  initialGameId: gid,
                                ),
                              ),
                            );
                          },
                          icon: const Icon(Icons.visibility_outlined, size: 18),
                          label: Text(
                            _railChrome!.watchGameAction,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(height: 8),
                      ],
                      if (_railChrome!.messageAction.isNotEmpty) ...[
                        OutlinedButton.icon(
                          onPressed: () {
                            final rail = _railChrome!;
                            final token =
                                context.read<AuthCubit>().state.token?.trim() ??
                                    '';
                            if (token.isEmpty) return;
                            final messenger = ScaffoldMessenger.of(context);
                            final navContext = context;
                            unawaited(() async {
                              final composed = await showComposeMessageSheet(
                                navContext,
                                chrome: rail,
                                accessToken: token,
                                toUserId: p.id,
                                username: p.username,
                                avatarThumbUrl: p.avatarThumbUrl,
                                hostTrustBadge: p.hostTrustBadge,
                                hostTrustTier: p.hostTrustTier,
                              );
                              if (composed == null || !mounted) return;
                              await followComposeMessageResult(
                                navContext,
                                chrome: rail,
                                accessToken: token,
                                userId: context
                                        .read<AuthCubit>()
                                        .state
                                        .userId
                                        ?.trim() ??
                                    '',
                                composed: composed,
                                messenger: messenger,
                              );
                            }());
                          },
                          icon: const Icon(Icons.mail_outline, size: 18),
                          label: Text(
                            _railChrome!.messageAction,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(height: 8),
                      ],
                      FilledButton.icon(
                        onPressed: () {
                          Navigator.of(context).pop(
                            PlayerChallengeRequest(
                              id: p.id,
                              username: p.username,
                              rating: p.rating,
                              countryCode: p.countryCode,
                              avatarThumbUrl: p.avatarThumbUrl,
                              hostTrustTier: p.hostTrustTier,
                              hostTrustBadge: p.hostTrustBadge,
                            ),
                          );
                        },
                        icon: const Icon(Icons.sports_martial_arts_outlined,
                            size: 18),
                        label: Text(
                          _railChrome!.challengeAction,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 16),
                if (_detail!.friendsCount != null)
                  Text(
                    '${_detail!.friendsCount}${chrome.labelValueSeparator}${chrome.friendsCountLabel}',
                    style:
                        TextStyle(color: tokens.onSurfaceMuted, fontSize: 13),
                  ),
                Text(
                    '${chrome.labelRating}${chrome.labelValueSeparator}${p.rating}${chrome.seatMetaSeparator}${chrome.labelXp}${chrome.labelValueSeparator}${p.xp}'),
                if (p.levelLabel != null && p.levelLabel!.isNotEmpty)
                  Text(
                      '${chrome.labelLevel}${chrome.labelValueSeparator}${p.levelLabel}'),
                Text(
                    '${chrome.wldLabel}${chrome.labelValueSeparator}${p.wins}${chrome.statsSeparator}${p.losses}${chrome.statsSeparator}${p.draws}'),
                if (p.countryCode != null && p.countryCode!.isNotEmpty)
                  Row(
                    children: [
                      Text(
                        '${chrome.labelCountry}${chrome.labelValueSeparator}',
                      ),
                      CountryFlag(code: p.countryCode),
                      Text(
                        '${chrome.flagCodeSeparator}${p.countryCode!.toUpperCase()}',
                      ),
                    ],
                  ),
                if (p.region != null)
                  Text(
                      '${chrome.labelRegion}${chrome.labelValueSeparator}${p.region}'),
                if (_detail!.regionalRank != null && _detail!.regionalRank! > 0)
                  Text(
                    _detail!.regionLabel != null &&
                            _detail!.regionLabel!.isNotEmpty
                        ? '${chrome.labelRegionalRank}${chrome.labelValueSeparator}${chrome.topPrefix}${chrome.rankPartsSeparator}${_detail!.regionalRank}${chrome.rankPartsSeparator}${_detail!.regionLabel}'
                        : '${chrome.labelRegionalRank}${chrome.labelValueSeparator}${chrome.topPrefix}${_detail!.regionalRank}',
                  ),
                const SizedBox(height: 16),
                Text(
                  _matchesMeta != null && _matchesMeta!.total > 0
                      ? '${chrome.recentMatchesTitle} (${_matchesMeta!.total})'
                      : chrome.recentMatchesTitle,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                if (_matches.isEmpty && !_matchesLoading)
                  Text(chrome.noMatches,
                      style: TextStyle(color: tokens.onSurfaceMuted))
                else
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final listH = MediaQuery.sizeOf(context).height < 700
                          ? 200.0
                          : 260.0;
                      return SizedBox(
                        height: listH,
                        width: constraints.maxWidth,
                        child: ListView.separated(
                          itemCount: _matches.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (context, i) {
                            final m = _matches[i];
                            final outcome = m.outcomeLabel(
                              p.id,
                              outcomeDraw: chrome.outcomeDraw,
                              outcomeWin: chrome.outcomeWin,
                              outcomeLoss: chrome.outcomeLoss,
                            );
                            final mode = m.mode?.trim() ?? '';
                            final p1 = m.player1?.username.trim() ?? '';
                            final p2 = m.player2?.username.trim() ?? '';
                            final moves = m.moveCount != null
                                ? '${m.moveCount}${chrome.labelValueSeparator}${chrome.gameHistoryMovesCol}'
                                : '';
                            return DecoratedBox(
                              decoration: BoxDecoration(
                                border: Border.all(color: tokens.border),
                                borderRadius: BorderRadius.circular(8),
                                color: tokens.card,
                              ),
                              child: Padding(
                                padding:
                                    const EdgeInsets.fromLTRB(12, 10, 12, 10),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    if (mode.isNotEmpty)
                                      Text(
                                        mode,
                                        style: TextStyle(
                                          color: tokens.onSurfaceMuted,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    if (p1.isNotEmpty)
                                      Text(p1, overflow: TextOverflow.ellipsis),
                                    HostTrustBadge(
                                      label: m.player1?.hostTrustBadge,
                                      tier: m.player1?.hostTrustTier,
                                      fontSize: 10,
                                      dense: true,
                                    ),
                                    if (p2.isNotEmpty)
                                      Text(p2, overflow: TextOverflow.ellipsis),
                                    HostTrustBadge(
                                      label: m.player2?.hostTrustBadge,
                                      tier: m.player2?.hostTrustTier,
                                      fontSize: 10,
                                      dense: true,
                                    ),
                                    const SizedBox(height: 6),
                                    Wrap(
                                      spacing: 8,
                                      runSpacing: 4,
                                      crossAxisAlignment:
                                          WrapCrossAlignment.center,
                                      children: [
                                        if (outcome.isNotEmpty)
                                          Text(
                                            outcome,
                                            style: TextStyle(
                                              color: tokens.gold,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        if (moves.isNotEmpty)
                                          Text(
                                            moves,
                                            style: TextStyle(
                                              color: tokens.onSurfaceMuted,
                                              fontSize: 12,
                                            ),
                                          ),
                                        if ((m.finishedAt ?? '').isNotEmpty)
                                          Text(
                                            m.finishedAt!,
                                            style: TextStyle(
                                              color: tokens.onSurfaceMuted,
                                              fontSize: 12,
                                            ),
                                          ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      );
                    },
                  ),
                if (_matchesMeta != null && _matchesMeta!.totalPages > 1)
                  SkipPaginationBar(
                    meta: _matchesMeta!,
                    busy: _matchesLoading,
                    padding: const EdgeInsets.only(top: 8),
                    onSkip: (skip) => unawaited(_loadMatches(skip)),
                  ),
                const SizedBox(height: 12),
                Text(chrome.tournamentPlacementsTitle,
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                if (_placements.isEmpty && !_placementsLoading)
                  Text(chrome.noPlacements,
                      style: TextStyle(color: tokens.onSurfaceMuted))
                else
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final listH = MediaQuery.sizeOf(context).height < 700
                          ? 180.0
                          : 240.0;
                      return SizedBox(
                        height: listH,
                        width: constraints.maxWidth,
                        child: ListView.separated(
                          itemCount: _placements.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (context, i) {
                            final t = _placements[i];
                            final free = t.isFree ? chrome.freeSuffix : '';
                            final status = t.entryStatus?.trim() ?? '';
                            return DecoratedBox(
                              decoration: BoxDecoration(
                                border: Border.all(color: tokens.border),
                                borderRadius: BorderRadius.circular(8),
                                color: tokens.card,
                              ),
                              child: Padding(
                                padding:
                                    const EdgeInsets.fromLTRB(12, 10, 12, 10),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    Text(
                                      t.title?.trim().isNotEmpty == true
                                          ? t.title!
                                          : '',
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w600),
                                    ),
                                    if (status.isNotEmpty || free.isNotEmpty)
                                      Text(
                                        '$status$free',
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          color: tokens.onSurfaceMuted,
                                          fontSize: 12,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      );
                    },
                  ),
                if (_placementsMeta != null && _placementsMeta!.totalPages > 1)
                  SkipPaginationBar(
                    meta: _placementsMeta!,
                    busy: _placementsLoading,
                    padding: const EdgeInsets.only(top: 8),
                    onSkip: (skip) => unawaited(_loadPlacements(skip)),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
