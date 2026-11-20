import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/country_flag.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/chat/compose_message_sheet.dart';
import 'package:dama_mobile/features/game/matchmaking_realtime.dart';
import 'package:dama_mobile/features/player/player_inspect_sheet.dart';
import 'package:dama_mobile/widgets/dama_user_avatar.dart';
import 'package:dama_mobile/widgets/host_trust_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;

/// Live spectator win votes + finished correct-voters list (DB-backed).
class MatchVotePanel extends StatefulWidget {
  const MatchVotePanel({
    super.key,
    required this.chrome,
    required this.gameId,
    required this.player1Id,
    required this.player1Name,
    required this.player2Id,
    required this.player2Name,
    this.player1Avatar,
    this.player2Avatar,
    this.accessToken,
    this.finished = false,
    this.paused = false,
    this.liveVotes,
    this.railChrome,
    this.compact = false,
  });

  final SpectateChrome chrome;
  final String gameId;
  final String? player1Id;
  final String player1Name;
  final String? player2Id;
  final String player2Name;
  final String? player1Avatar;
  final String? player2Avatar;
  final String? accessToken;
  final bool finished;

  /// When true, cast buttons stay hidden (server also rejects while paused).
  final bool paused;

  /// Optional WS `vote_update` payload applied from parent.
  final Map<String, dynamic>? liveVotes;

  /// Optional play-rail chrome for seat bio (games played / W-L-D labels).
  final PlayRailChrome? railChrome;

  /// Focus mode: one-line title · scores strip (no cast UI).
  final bool compact;

  @override
  State<MatchVotePanel> createState() => _MatchVotePanelState();
}

class _MatchVotePanelState extends State<MatchVotePanel> {
  bool _loading = true;
  bool _seatsHydrating = true;
  String? _error;
  int _total = 0;
  String? _myVote;
  List<_Tally> _tallies = const [];
  List<_Voter> _correct = const [];
  String? _p1Name;
  String? _p2Name;
  String? _p1Avatar;
  String? _p2Avatar;
  PublicPlayerCard? _p1Card;
  PublicPlayerCard? _p2Card;
  bool _casting = false;
  String? _castingPlayerId;
  MatchmakingRealtimeController? _avatarRt;
  int _seenAvatarSeq = 0;

  @override
  void initState() {
    super.initState();
    unawaited(_hydrateSeats());
    unawaited(_load());
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
    if (uid.isEmpty) return;
    final thumb = (rt.lastAvatarThumbUrl ?? '').trim();
    final full = (rt.lastAvatarFullUrl ?? '').trim();
    final clear = thumb.isEmpty && full.isEmpty;
    final next = clear ? null : (thumb.isNotEmpty ? thumb : full);
    setState(() {
      if (uid == (widget.player1Id ?? '').trim()) {
        _p1Avatar = next;
        final c = _p1Card;
        if (c != null) {
          _p1Card = c.copyWith(
            clearAvatar: clear,
            avatarThumbUrl: next,
            avatarFullUrl: clear ? null : (full.isNotEmpty ? full : null),
          );
        }
      }
      if (uid == (widget.player2Id ?? '').trim()) {
        _p2Avatar = next;
        final c = _p2Card;
        if (c != null) {
          _p2Card = c.copyWith(
            clearAvatar: clear,
            avatarThumbUrl: next,
            avatarFullUrl: clear ? null : (full.isNotEmpty ? full : null),
          );
        }
      }
    });
  }

  @override
  void didUpdateWidget(covariant MatchVotePanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.liveVotes != null && widget.liveVotes != oldWidget.liveVotes) {
      _applyVotes(widget.liveVotes!, fromLiveRoom: true);
    }
    if (widget.player1Id != oldWidget.player1Id ||
        widget.player2Id != oldWidget.player2Id) {
      unawaited(_hydrateSeats());
    }
    final authChanged = (widget.accessToken ?? '').trim() !=
        (oldWidget.accessToken ?? '').trim();
    if (authChanged) {
      setState(() => _myVote = null);
      unawaited(_load());
      return;
    }
    if (widget.finished != oldWidget.finished ||
        widget.gameId != oldWidget.gameId) {
      unawaited(_load());
    }
  }

  Future<void> _hydrateSeats() async {
    if (mounted) setState(() => _seatsHydrating = true);
    Future<PublicPlayerCard?> fetchOne(String? id) async {
      final sid = id?.trim() ?? '';
      if (sid.isEmpty) return null;
      try {
        final res = await http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/players/$sid'),
        );
        if (res.statusCode >= 300) return null;
        final map = jsonDecode(res.body);
        if (map is! Map<String, dynamic>) return null;
        return PlayerDetailResponse.fromJson(map).player;
      } catch (_) {
        return null;
      }
    }

    final results = await Future.wait([
      fetchOne(widget.player1Id),
      fetchOne(widget.player2Id),
    ]);
    if (!mounted) return;
    setState(() {
      _p1Card = results[0];
      _p2Card = results[1];
      _p1Name = results[0]?.username.trim();
      _p1Avatar = results[0]?.avatarThumbUrl;
      _p2Name = results[1]?.username.trim();
      _p2Avatar = results[1]?.avatarThumbUrl;
      _seatsHydrating = false;
    });
  }

  void _showSeatBio(
    PublicPlayerCard? card,
    String fallbackName,
    String? fallbackAvatar, {
    String? fallbackUserId,
  }) {
    final rail = widget.railChrome;
    if (rail == null || !rail.isReady) return;
    final tokens = damaColorsOf(context);
    final name = (card?.username ?? fallbackName).trim();
    if (name.isEmpty) return;
    final thumb = (card?.avatarThumbUrl ?? fallbackAvatar)?.trim() ?? '';
    final peerId = (card?.id ?? fallbackUserId ?? '').trim();
    final token = (widget.accessToken ?? '').trim();
    final myId = context.read<AuthCubit>().state.userId?.trim() ?? '';
    final showMessage = rail.messageAction.isNotEmpty &&
        token.isNotEmpty &&
        peerId.isNotEmpty &&
        peerId != myId;
    // Fail-closed: only paint W/L/D from a hydrated public-player card (never invent 0).
    final hasRecord = card != null;
    final wins = card?.wins;
    final losses = card?.losses;
    final draws = card?.draws;
    final rating = card?.rating;
    final played = hasRecord && wins != null && losses != null && draws != null
        ? wins + losses + draws
        : null;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: tokens.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    DamaUserAvatar(
                      imageUrl: thumb.isNotEmpty ? thumb : null,
                      radius: 28,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            name,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 16,
                            ),
                          ),
                          if (rating != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              '${rail.labelRating} $rating',
                              style: TextStyle(
                                color: tokens.onSurfaceMuted,
                                fontSize: 12,
                              ),
                            ),
                          ],
                          if (played != null) ...[
                            const SizedBox(height: 6),
                            Text(
                              '$played${rail.gamesPlayedAbbr}'
                              '${rail.statsSeparator}$wins${rail.winsAbbr}'
                              '${rail.statsSeparator}$losses${rail.lossesAbbr}'
                              '${rail.statsSeparator}$draws${rail.drawsAbbr}',
                              style: TextStyle(
                                color: tokens.onSurfaceMuted,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
                if (showMessage) ...[
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: () {
                      Navigator.of(ctx).pop();
                      final messenger = ScaffoldMessenger.of(context);
                      final navContext = context;
                      unawaited(() async {
                        final composed = await showComposeMessageSheet(
                          navContext,
                          chrome: rail,
                          accessToken: token,
                          toUserId: peerId,
                          username: name,
                          avatarThumbUrl: thumb.isEmpty ? null : thumb,
                          hostTrustBadge: card?.hostTrustBadge,
                          hostTrustTier: card?.hostTrustTier,
                        );
                        if (composed == null || !mounted) return;
                        await followComposeMessageResult(
                          navContext,
                          chrome: rail,
                          accessToken: token,
                          userId:
                              context.read<AuthCubit>().state.userId?.trim() ??
                                  '',
                          composed: composed,
                          messenger: messenger,
                        );
                      }());
                    },
                    icon: const Icon(Icons.mail_outline, size: 16),
                    label: Text(rail.messageAction),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _seatFace({
    required String name,
    required String? avatar,
    required VoidCallback? onTap,
  }) {
    final tokens = damaColorsOf(context);
    final thumb = (avatar ?? '').trim();
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: tokens.card, width: 2),
        ),
        clipBehavior: Clip.antiAlias,
        child: DamaUserAvatar(
          imageUrl: thumb.isNotEmpty ? thumb : null,
          radius: 16,
        ),
      ),
    );
  }

  Future<void> _load() async {
    final id = widget.gameId.trim();
    if (id.isEmpty) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      if (widget.finished) {
        final res = await http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/games/$id/votes/correct'),
        );
        if (res.statusCode >= 300) {
          throw Exception('correct');
        }
        final map = jsonDecode(res.body) as Map<String, dynamic>;
        final raw = map['voters'];
        final list = <_Voter>[];
        if (raw is List) {
          for (final row in raw) {
            if (row is! Map) continue;
            list.add(
              _Voter(
                id: row['id']?.toString() ?? '',
                username: row['username']?.toString() ?? '',
                avatarThumbUrl: row['avatar_thumb_url'] as String?,
                rating: (row['rating'] as num?)?.toInt(),
                countryCode: (row['country_code'] as String?)?.trim(),
                hostTrustTier: (row['host_trust_tier'] as String?)?.trim(),
                hostTrustBadge: (row['host_trust_badge'] as String?)?.trim(),
              ),
            );
          }
        }
        if (!mounted) return;
        setState(() {
          _correct = list;
          _loading = false;
        });
        return;
      }
      final headers = <String, String>{};
      final token = widget.accessToken?.trim();
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/games/$id/votes'),
        headers: headers,
      );
      if (res.statusCode >= 300) {
        throw Exception('votes');
      }
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      if (!mounted) return;
      _applyVotes(map);
      setState(() => _loading = false);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = widget.chrome.voteUnavailable;
      });
    }
  }

  void _applyVotes(Map<String, dynamic> map, {bool fromLiveRoom = false}) {
    final raw = map['players'];
    final list = <_Tally>[];
    if (raw is List) {
      for (final row in raw) {
        if (row is! Map) continue;
        list.add(
          _Tally(
            playerId: row['player_id']?.toString() ?? '',
            count: (row['count'] as num?)?.toInt() ?? 0,
            percent: (row['percent'] as num?)?.toDouble() ?? 0,
          ),
        );
      }
    }
    setState(() {
      _tallies = list;
      _total = (map['total'] as num?)?.toInt() ?? 0;
      if (fromLiveRoom) {
        // Room WS is public tallies only - never clear/set this client's pick here.
        return;
      }
      final picked = map['my_vote']?.toString().trim() ?? '';
      _myVote = picked.isEmpty ? null : picked;
    });
  }

  Future<void> _cast(String playerId) async {
    final token = widget.accessToken?.trim();
    if (token == null || token.isEmpty) return;
    if (_casting) return;
    final id = widget.gameId.trim();
    setState(() {
      _casting = true;
      _castingPlayerId = playerId;
    });
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/games/$id/votes'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'voted_player_id': playerId}),
      );
      if (res.statusCode >= 300) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(widget.chrome.voteCastFailed)),
        );
        return;
      }
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      if (!mounted) return;
      _applyVotes(map);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(widget.chrome.voteCastFailed)),
      );
    } finally {
      if (mounted) {
        setState(() {
          _casting = false;
          _castingPlayerId = null;
        });
      }
    }
  }

  _Tally? _for(String? playerId) {
    if (playerId == null || playerId.isEmpty) return null;
    for (final t in _tallies) {
      if (t.playerId == playerId) return t;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final chrome = widget.chrome;
    final tokens = damaColorsOf(context);
    final p1 = widget.player1Id?.trim() ?? '';
    final p2 = widget.player2Id?.trim() ?? '';

    if (widget.finished) {
      if (_loading) {
        if (widget.compact) {
          return _compactChip(tokens, chrome.voteCorrectTitle);
        }
        return const CorrectVotersSkeleton();
      }
      if (_error != null) {
        return Card(
          color: tokens.card,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Text(
              chrome.voteUnavailable,
              style: TextStyle(color: tokens.danger),
            ),
          ),
        );
      }
      if (widget.compact) {
        return _compactChip(
          tokens,
          '${chrome.voteCorrectTitle}${chrome.voteMetaSeparator}${_correct.length}',
        );
      }
      return Card(
        color: tokens.card,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                chrome.voteCorrectTitle,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(
                chrome.voteCorrectBlurb,
                style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
              ),
              const SizedBox(height: 10),
              if (_correct.isEmpty)
                Text(
                  chrome.voteCorrectEmpty,
                  style: TextStyle(color: tokens.onSurfaceMuted),
                )
              else
                ..._correct.asMap().entries.map((e) {
                  final i = e.key;
                  final v = e.value;
                  final openInspect = v.id.isEmpty
                      ? null
                      : () => unawaited(showPlayerInspectSheet(context, v.id));
                  return ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    // Inspect: avatar + name (not the whole row / rank).
                    leading: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 22,
                          child: Text(
                            '${i + 1}',
                            style: TextStyle(
                              color: tokens.gold,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        InkWell(
                          onTap: openInspect,
                          customBorder: const CircleBorder(),
                          child: DamaUserAvatar(
                            imageUrl: v.avatarThumbUrl,
                            radius: 14,
                          ),
                        ),
                      ],
                    ),
                    title: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: InkWell(
                                onTap: openInspect,
                                child: Text(
                                  v.username,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ),
                            if (v.rating != null) ...[
                              const SizedBox(width: 6),
                              Text(
                                '(${v.rating})',
                                style: TextStyle(
                                  color: tokens.onSurfaceMuted,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                            const SizedBox(width: 6),
                            CountryFlag(code: v.countryCode),
                          ],
                        ),
                        HostTrustBadge(
                          label: v.hostTrustBadge,
                          tier: v.hostTrustTier,
                          fontSize: 10,
                          dense: true,
                        ),
                      ],
                    ),
                  );
                }),
            ],
          ),
        ),
      );
    }

    if (p1.isEmpty || p2.isEmpty) return const SizedBox.shrink();

    final signedIn =
        widget.accessToken != null && widget.accessToken!.trim().isNotEmpty;
    final myId = context.read<AuthCubit>().state.userId?.trim() ?? '';
    final viewerIsSeated = myId.isNotEmpty && (myId == p1 || myId == p2);
    final canVote = signedIn && !viewerIsSeated && !widget.paused;
    final seatName1 = (_p1Name ?? '').trim();
    final seatName2 = (_p2Name ?? '').trim();

    if (_seatsHydrating || _loading) {
      if (widget.compact) {
        return _compactChip(tokens, chrome.voteSectionTitle);
      }
      return MatchVoteSkeleton(showCastButtons: canVote);
    }
    if (seatName1.isEmpty || seatName2.isEmpty) {
      return Card(
        color: tokens.card,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Text(
            chrome.voteUnavailable,
            style: TextStyle(color: tokens.danger),
          ),
        ),
      );
    }
    if (_error != null) {
      return Card(
        color: tokens.card,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Text(
            chrome.voteUnavailable,
            style: TextStyle(color: tokens.danger),
          ),
        ),
      );
    }

    if (widget.compact) {
      final c1 = _for(p1)?.count ?? 0;
      final c2 = _for(p2)?.count ?? 0;
      return _compactChip(
        tokens,
        '${chrome.voteSectionTitle}${chrome.voteMetaSeparator}$c1${chrome.voteScoreSeparator}$c2',
      );
    }

    return Card(
      color: tokens.card,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    chrome.voteSectionTitle,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                SizedBox(
                  width: 52,
                  height: 32,
                  child: Stack(
                    children: [
                      Positioned(
                        left: 16,
                        child: _seatFace(
                          name: seatName2,
                          avatar: _p2Avatar,
                          onTap: widget.railChrome != null
                              ? () => _showSeatBio(
                                    _p2Card,
                                    seatName2,
                                    _p2Avatar,
                                    fallbackUserId: widget.player2Id,
                                  )
                              : null,
                        ),
                      ),
                      Positioned(
                        left: 0,
                        child: _seatFace(
                          name: seatName1,
                          avatar: _p1Avatar,
                          onTap: widget.railChrome != null
                              ? () => _showSeatBio(
                                    _p1Card,
                                    seatName1,
                                    _p1Avatar,
                                    fallbackUserId: widget.player1Id,
                                  )
                              : null,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            _seatVote(
              tokens,
              chrome,
              id: p1,
              name: seatName1,
              avatar: _p1Avatar,
              card: _p1Card,
              tally: _for(p1),
              canVote: canVote,
            ),
            const SizedBox(height: 10),
            _seatVote(
              tokens,
              chrome,
              id: p2,
              name: seatName2,
              avatar: _p2Avatar,
              card: _p2Card,
              tally: _for(p2),
              canVote: canVote,
            ),
            if (viewerIsSeated) ...[
              const SizedBox(height: 8),
              Text(
                chrome.votePlayersCannot,
                style: TextStyle(color: tokens.onSurfaceMuted),
              ),
            ] else if (!signedIn) ...[
              const SizedBox(height: 8),
              Text(
                chrome.voteSignIn,
                style: TextStyle(color: tokens.onSurfaceMuted),
              ),
            ],
            if (_total > 0) ...[
              const SizedBox(height: 8),
              Text(
                '$_total ${chrome.voteCountSuffix}',
                textAlign: TextAlign.center,
                style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _seatVote(
    DamaColors tokens,
    SpectateChrome chrome, {
    required String id,
    required String name,
    required String? avatar,
    required PublicPlayerCard? card,
    required _Tally? tally,
    required bool canVote,
  }) {
    final percent = tally?.percent ?? 0;
    final count = tally?.count ?? 0;
    final selected = _myVote == id;
    final locked = _myVote != null && _myVote!.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              // Bio: seat name (faces open bio from the stack above; not the whole vote row).
              child: InkWell(
                onTap: widget.railChrome == null
                    ? null
                    : () => _showSeatBio(
                          card,
                          name,
                          avatar,
                          fallbackUserId: id,
                        ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    HostTrustBadge(
                      label: card?.hostTrustBadge,
                      tier: card?.hostTrustTier,
                      fontSize: 10,
                      dense: true,
                    ),
                  ],
                ),
              ),
            ),
            Text(
              '${percent.round()}${chrome.votePercentSuffix}'
              '${chrome.voteMetaSeparator}$count ${chrome.voteCountSuffix}',
              style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: (percent / 100).clamp(0.0, 1.0),
            minHeight: 8,
            backgroundColor: tokens.surfaceMuted,
            color: tokens.brand,
          ),
        ),
        if (canVote) ...[
          const SizedBox(height: 6),
          SizedBox(
            height: 36,
            child: FilledButton(
              onPressed: locked || _casting ? null : () => unawaited(_cast(id)),
              style: FilledButton.styleFrom(
                backgroundColor: selected ? tokens.brand : null,
              ),
              child: _casting && _castingPlayerId == id
                  ? Text(
                      chrome.voteCastingPending,
                      style: const TextStyle(fontSize: 12),
                    )
                  : Text(
                      selected ? chrome.voteLockedLabel : chrome.votePickAction,
                      style: const TextStyle(fontSize: 12),
                    ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _compactChip(DamaColors tokens, String line) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: tokens.borderSubtle.withValues(alpha: 0.6)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Text(
          line,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            fontFeatures: [FontFeature.tabularFigures()],
          ),
        ),
      ),
    );
  }
}

class _Tally {
  const _Tally({
    required this.playerId,
    required this.count,
    required this.percent,
  });
  final String playerId;
  final int count;
  final double percent;
}

class _Voter {
  const _Voter({
    required this.id,
    required this.username,
    this.avatarThumbUrl,
    this.rating,
    this.countryCode,
    this.hostTrustTier,
    this.hostTrustBadge,
  });
  final String id;
  final String username;
  final String? avatarThumbUrl;
  final int? rating;
  final String? countryCode;
  final String? hostTrustTier;
  final String? hostTrustBadge;
}
