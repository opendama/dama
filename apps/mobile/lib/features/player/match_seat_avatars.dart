import 'dart:convert';

import 'package:dama_mobile/core/cache/query_cache.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/country_flag.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/features/game/matchmaking_realtime.dart';
import 'package:dama_mobile/features/player/player_inspect_sheet.dart';
import 'package:dama_mobile/widgets/dama_user_avatar.dart';
import 'package:dama_mobile/widgets/host_trust_badge.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

enum MatchSeatBarLayout { wrap, sideColumn }

enum MatchSideSeatSlot { top, bottom }

/// Live match seats hydrated from GET /players/{id}. Tap opens inspect sheet.
/// Seat labels and piece meta come from play_chrome / profile_inspect_chrome.
class MatchSeatAvatars extends StatefulWidget {
  const MatchSeatAvatars({
    super.key,
    this.player1Id,
    this.player2Id,
    this.whitePieces,
    this.blackPieces,
    this.piecesPerSide,
    this.clockLabel,
    this.labelWhite,
    this.labelBlack,
    this.piecesLeftSuffix,
    this.capturedSuffix,
    this.seatMetaSeparator,
    this.onChallenge,
    this.layout = MatchSeatBarLayout.wrap,
    this.yourPlayer,
    this.sideSlot,
    this.trailing,
    this.clockActive = false,
    this.ratingParenOpen,
    this.ratingParenClose,
  });

  final String? player1Id;
  final String? player2Id;
  final int? whitePieces;
  final int? blackPieces;
  final int? piecesPerSide;
  final String? clockLabel;
  final String? labelWhite;
  final String? labelBlack;
  final String? piecesLeftSuffix;
  final String? capturedSuffix;
  final String? seatMetaSeparator;

  /// When Challenge is tapped in inspect, open Create Game with this opponent.
  final ValueChanged<PlayerChallengeRequest>? onChallenge;
  final MatchSeatBarLayout layout;

  /// 1 or 2: opponent stacks above you in [MatchSeatBarLayout.sideColumn].
  final int? yourPlayer;
  final MatchSideSeatSlot? sideSlot;

  /// Left of the clock (e.g. 2D/3D); keeps timer flush with the board edge.
  final Widget? trailing;

  /// Chess.com white timer when this seat is to move.
  final bool clockActive;

  /// From play_rail_chrome (fail closed - hide rating without both).
  final String? ratingParenOpen;
  final String? ratingParenClose;

  @override
  State<MatchSeatAvatars> createState() => _MatchSeatAvatarsState();
}

class _MatchSeatAvatarsState extends State<MatchSeatAvatars> {
  final Map<String, PublicPlayerCard> _cards = {};
  bool _hydrating = false;
  String? _labelWhite;
  String? _labelBlack;
  String? _piecesLeftSuffix;
  String? _capturedSuffix;
  String? _seatMetaSeparator;
  bool _chromeLoading = true;
  bool _chromeFailed = false;
  MatchmakingRealtimeController? _avatarRt;
  int _seenAvatarSeq = 0;

  bool get _propsChromeReady {
    final w = widget.labelWhite?.trim() ?? '';
    final b = widget.labelBlack?.trim() ?? '';
    final p = widget.piecesLeftSuffix?.trim() ?? '';
    final c = widget.capturedSuffix?.trim() ?? '';
    final s = widget.seatMetaSeparator?.trim() ?? '';
    return w.isNotEmpty &&
        b.isNotEmpty &&
        p.isNotEmpty &&
        c.isNotEmpty &&
        s.isNotEmpty;
  }

  bool get _chromeReady {
    if (_propsChromeReady) return true;
    final w = _labelWhite?.trim() ?? '';
    final b = _labelBlack?.trim() ?? '';
    final p = _piecesLeftSuffix?.trim() ?? '';
    final c = _capturedSuffix?.trim() ?? '';
    final s = _seatMetaSeparator?.trim() ?? '';
    return w.isNotEmpty &&
        b.isNotEmpty &&
        p.isNotEmpty &&
        c.isNotEmpty &&
        s.isNotEmpty;
  }

  String get _effectiveLabelWhite =>
      (widget.labelWhite?.trim().isNotEmpty ?? false)
          ? widget.labelWhite!.trim()
          : (_labelWhite ?? '');

  String get _effectiveLabelBlack =>
      (widget.labelBlack?.trim().isNotEmpty ?? false)
          ? widget.labelBlack!.trim()
          : (_labelBlack ?? '');

  String get _effectivePiecesLeftSuffix =>
      (widget.piecesLeftSuffix?.trim().isNotEmpty ?? false)
          ? widget.piecesLeftSuffix!.trim()
          : (_piecesLeftSuffix ?? '');

  String get _effectiveCapturedSuffix =>
      (widget.capturedSuffix?.trim().isNotEmpty ?? false)
          ? widget.capturedSuffix!.trim()
          : (_capturedSuffix ?? '');

  String get _effectiveSeatMetaSeparator =>
      (widget.seatMetaSeparator?.trim().isNotEmpty ?? false)
          ? widget.seatMetaSeparator!.trim()
          : (_seatMetaSeparator ?? '');

  @override
  void initState() {
    super.initState();
    if (_propsChromeReady) {
      _chromeLoading = false;
    } else {
      _loadSeatChrome();
    }
    _hydrate();
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
    if (uid != widget.player1Id && uid != widget.player2Id) return;
    final thumb = (rt.lastAvatarThumbUrl ?? '').trim();
    final full = (rt.lastAvatarFullUrl ?? '').trim();
    final clear = thumb.isEmpty && full.isEmpty;
    final existing = _cards[uid];
    if (existing == null) {
      _hydrate();
      return;
    }
    setState(() {
      _cards[uid] = existing.copyWith(
        clearAvatar: clear,
        avatarThumbUrl: clear ? null : (thumb.isNotEmpty ? thumb : full),
        avatarFullUrl: clear ? null : (full.isNotEmpty ? full : null),
      );
    });
  }

  @override
  void didUpdateWidget(covariant MatchSeatAvatars oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_propsChromeReady && (_chromeLoading || _chromeFailed)) {
      setState(() {
        _chromeLoading = false;
        _chromeFailed = false;
      });
    }
    if (oldWidget.player1Id != widget.player1Id ||
        oldWidget.player2Id != widget.player2Id) {
      _hydrate();
    }
  }

  Future<void> _loadSeatChrome() async {
    try {
      final playRes = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/public/play-chrome'),
      );
      final profileRes = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/public/profile-inspect-chrome'),
      );
      Map<String, dynamic>? playMap;
      Map<String, dynamic>? profileMap;
      try {
        final decoded = jsonDecode(playRes.body);
        if (decoded is Map<String, dynamic>) playMap = decoded;
      } catch (_) {}
      try {
        final decoded = jsonDecode(profileRes.body);
        if (decoded is Map<String, dynamic>) profileMap = decoded;
      } catch (_) {}
      final play =
          playRes.statusCode == 200 ? PlayChrome.fromJson(playMap) : null;
      final profile = profileRes.statusCode == 200
          ? ProfileInspectChrome.fromJson(profileMap)
          : null;
      if (!mounted) return;
      if (play == null || profile == null) {
        setState(() {
          _chromeLoading = false;
          _chromeFailed = true;
        });
        return;
      }
      setState(() {
        _labelWhite = play.labelWhite;
        _labelBlack = play.labelBlack;
        _piecesLeftSuffix = profile.piecesLeftSuffix;
        _capturedSuffix = profile.capturedSuffix;
        _seatMetaSeparator = profile.seatMetaSeparator.isNotEmpty
            ? profile.seatMetaSeparator
            : play.seatMetaSeparator;
        _chromeLoading = false;
        _chromeFailed = !_chromeReady;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _chromeLoading = false;
        _chromeFailed = true;
      });
    }
  }

  Future<void> _hydrate() async {
    final ids = <String>[
      if (widget.player1Id != null && widget.player1Id!.isNotEmpty)
        widget.player1Id!,
      if (widget.player2Id != null && widget.player2Id!.isNotEmpty)
        widget.player2Id!,
    ];
    if (ids.isEmpty) {
      if (mounted) {
        setState(() {
          _cards.clear();
          _hydrating = false;
        });
      }
      return;
    }
    final next = <String, PublicPlayerCard>{};
    for (final id in ids) {
      final cached = QueryCache.read<PlayerDetailResponse>(
        CacheKeys.player(id),
        maxAge: QueryCache.sessionTtl,
        allowStale: true,
      );
      final player = cached?.player;
      if (player != null) next[id] = player;
    }
    final missing = ids.where((id) => !next.containsKey(id)).toList();
    if (mounted) {
      setState(() {
        _cards
          ..clear()
          ..addAll(next);
        _hydrating = missing.isNotEmpty;
      });
    }
    if (missing.isEmpty) return;
    for (final id in missing) {
      try {
        final res = await http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/players/$id'),
        );
        if (res.statusCode >= 300) continue;
        final detail = PlayerDetailResponse.fromJson(
          jsonDecode(res.body) as Map<String, dynamic>,
        );
        QueryCache.write(CacheKeys.player(id), detail);
        final player = detail.player;
        if (player != null) next[id] = player;
      } catch (_) {}
    }
    if (mounted) {
      setState(() {
        _cards
          ..clear()
          ..addAll(next);
        _hydrating = false;
      });
    }
  }

  bool get _needsSeatSkeleton {
    if (!_hydrating) return false;
    final ids = <String>[
      if (widget.player1Id != null && widget.player1Id!.isNotEmpty)
        widget.player1Id!,
      if (widget.player2Id != null && widget.player2Id!.isNotEmpty)
        widget.player2Id!,
    ];
    for (final id in ids) {
      if (!_cards.containsKey(id)) return true;
    }
    return false;
  }

  int? _captured(int? remaining) {
    final start = widget.piecesPerSide;
    if (start == null || start <= 0 || remaining == null) return null;
    final n = start - remaining;
    return n < 0 ? 0 : n;
  }

  Widget _compactSideSeat(String label, String? id, {required bool lightSide}) {
    if (id == null || id.isEmpty) return const SizedBox.shrink();
    final tokens = damaColorsOf(context);
    final p = _cards[id];
    final thumb = p?.avatarThumbUrl;
    final name = (p?.username ?? '').trim();
    final displayName = name.isNotEmpty ? name : label.trim();
    final country = p?.countryCode;
    final presenceReady = p != null;
    final online = p?.online ?? false;
    final playing = p?.playing ?? false;
    final presenceColor = playing
        ? tokens.playing
        : online
            ? tokens.online
            : tokens.offline;
    // Seat swatch = that seat's piece color (web BoardSeatBar parity).
    final swatch = lightSide ? tokens.pieceLight : tokens.pieceDark;
    final clockText = (widget.clockLabel ?? '').trim();
    final open = (widget.ratingParenOpen ?? '').trim();
    final close = (widget.ratingParenClose ?? '').trim();
    final ratingText = p != null && open.isNotEmpty && close.isNotEmpty
        ? '$open${p.rating}$close'
        : '';
    final active = widget.clockActive;

    Future<void> openInspect() async {
      final req = await showPlayerInspectSheet(context, id);
      if (req == null || !mounted) return;
      widget.onChallenge?.call(req);
    }

    // Inspect: avatar + name (not the whole seat chip / clock).
    return Row(
      children: [
        Expanded(
          child: Row(
            children: [
              InkWell(
                onTap: openInspect,
                borderRadius: BorderRadius.circular(4),
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: (thumb == null || thumb.isEmpty) ? swatch : null,
                        borderRadius: BorderRadius.circular(3),
                        border: Border.all(color: const Color(0x4D000000)),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: DamaUserAvatar(
                        imageUrl: thumb,
                        radius: 16,
                        pieceSideLight: lightSide,
                        showMarkPlate: false,
                      ),
                    ),
                    if (presenceReady)
                      Positioned(
                        right: -1,
                        bottom: -1,
                        child: Container(
                          width: 9,
                          height: 9,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: presenceColor,
                            border: Border.all(color: tokens.card, width: 1.5),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Row(
                  children: [
                    Flexible(
                      child: InkWell(
                        onTap: openInspect,
                        child: Text(
                          displayName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Theme.of(context).colorScheme.onSurface,
                          ),
                        ),
                      ),
                    ),
                    if (ratingText.isNotEmpty)
                      Text(
                        ' $ratingText',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w400,
                          color: tokens.onSurfaceMuted,
                        ),
                      ),
                  ],
                ),
              ),
              if ((country ?? '').trim().isNotEmpty) ...[
                const SizedBox(width: 4),
                CountryFlag(code: country),
              ],
            ],
          ),
        ),
        const SizedBox(width: 6),
        Flexible(
          child: HostTrustBadge(
            label: p?.hostTrustBadge,
            tier: p?.hostTrustTier,
            fontSize: 10,
            dense: true,
          ),
        ),
        if (widget.trailing != null) ...[
          const SizedBox(width: 6),
          widget.trailing!,
        ],
        if (clockText.isNotEmpty) ...[
          const SizedBox(width: 6),
          Container(
            // Icon slot always reserved - keep min width wide enough for icon + m:ss.
            constraints: const BoxConstraints(minWidth: 88),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: active ? Colors.white : tokens.surfaceMuted,
              borderRadius: BorderRadius.circular(3),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Always reserve icon width so turn flips don't shift the timer.
                Icon(
                  Icons.schedule,
                  size: 14,
                  color: active
                      ? Colors.black.withValues(alpha: 0.75)
                      : Colors.transparent,
                ),
                const SizedBox(width: 4),
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

  Widget _seat(String label, String? id, int? remaining,
      {required bool lightSide}) {
    if (id == null || id.isEmpty) return const SizedBox.shrink();
    final tokens = damaColorsOf(context);
    final p = _cards[id];
    final thumb = p?.avatarThumbUrl;
    final name = p?.username ?? '';
    final country = p?.countryCode;
    final level = p?.levelLabel;
    // Hide presence until public card loads (avoid Offline flash).
    final presenceReady = p != null;
    final online = p?.online ?? false;
    final playing = p?.playing ?? false;
    final presenceColor = playing
        ? tokens.playing
        : online
            ? tokens.online
            : tokens.offline;
    final captured = _captured(remaining);
    final sep = _effectiveSeatMetaSeparator;
    final piecesSuffix = _effectivePiecesLeftSuffix;
    final capturedSuffix = _effectiveCapturedSuffix;
    // Seat swatch = that seat's piece color (web BoardSeatBar parity).
    final swatch = lightSide ? tokens.pieceLight : tokens.pieceDark;
    Future<void> openInspect() async {
      final req = await showPlayerInspectSheet(context, id);
      if (req == null || !mounted) return;
      widget.onChallenge?.call(req);
    }

    // Inspect: avatar + name (not the whole seat card).
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.borderSubtle),
        color: tokens.card,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          InkWell(
            onTap: openInspect,
            customBorder: const CircleBorder(),
            child: Stack(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: (thumb == null || thumb.isEmpty) ? swatch : null,
                  ),
                  child: DamaUserAvatar(
                    imageUrl: thumb,
                    radius: 18,
                    pieceSideLight: lightSide,
                    showMarkPlate: false,
                  ),
                ),
                if (presenceReady)
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: presenceColor,
                        border: Border.all(color: tokens.card),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    margin: const EdgeInsets.only(right: 4),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: swatch,
                      border: Border.all(color: const Color(0x33000000)),
                    ),
                  ),
                  Text(
                    label,
                    style:
                        TextStyle(fontSize: 11, color: tokens.onSurfaceMuted),
                  ),
                ],
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  InkWell(
                    onTap: openInspect,
                    child: Text(name,
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                  ),
                  if (p != null)
                    Text(
                      ' (${p.rating})',
                      style: TextStyle(
                        fontSize: 11,
                        color: tokens.onSurfaceMuted,
                      ),
                    ),
                  const SizedBox(width: 4),
                  CountryFlag(code: country),
                ],
              ),
              HostTrustBadge(
                label: p?.hostTrustBadge,
                tier: p?.hostTrustTier,
                fontSize: 10,
                dense: true,
              ),
              Text(
                [
                  if (level != null && level.isNotEmpty) level,
                  if (remaining != null) '$remaining $piecesSuffix',
                  if (captured != null) '$captured $capturedSuffix',
                ].join(sep),
                style: TextStyle(fontSize: 11, color: tokens.onSurfaceMuted),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    if ((widget.player1Id == null || widget.player1Id!.isEmpty) &&
        (widget.player2Id == null || widget.player2Id!.isEmpty)) {
      return const SizedBox.shrink();
    }
    if (_chromeLoading || _needsSeatSkeleton) {
      return MatchSeatSkeleton(
        sideColumn: widget.layout == MatchSeatBarLayout.sideColumn,
        showTrailing: widget.trailing != null,
        clockActive: widget.clockActive,
      );
    }
    if (_chromeFailed || !_chromeReady) {
      return const SizedBox.shrink();
    }
    if (widget.layout == MatchSeatBarLayout.sideColumn) {
      final slot = widget.sideSlot;
      if (slot == null) return const SizedBox.shrink();
      final yp = widget.yourPlayer;
      // Opponent on top, you on bottom (Chess.com). yourPlayer==1 → top is black (p2).
      final topIsP1 = yp == 2;
      final isTop = slot == MatchSideSeatSlot.top;
      final id = isTop
          ? (topIsP1 ? widget.player1Id : widget.player2Id)
          : (topIsP1 ? widget.player2Id : widget.player1Id);
      final label = isTop
          ? (topIsP1 ? _effectiveLabelWhite : _effectiveLabelBlack)
          : (topIsP1 ? _effectiveLabelBlack : _effectiveLabelWhite);
      final lightSide = isTop ? topIsP1 : !topIsP1;
      return _compactSideSeat(label, id, lightSide: lightSide);
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 12,
            runSpacing: 8,
            children: [
              _seat(
                _effectiveLabelWhite,
                widget.player1Id,
                widget.whitePieces,
                lightSide: true,
              ),
              _seat(
                _effectiveLabelBlack,
                widget.player2Id,
                widget.blackPieces,
                lightSide: false,
              ),
            ],
          ),
          if (widget.clockLabel != null && widget.clockLabel!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              widget.clockLabel!,
              style: TextStyle(color: tokens.gold, fontWeight: FontWeight.w600),
            ),
          ],
        ],
      ),
    );
  }
}
