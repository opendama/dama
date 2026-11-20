export 'package:dama_mobile/graphql/schema_types.dart' show GTournament;

/// REST tournament row from GET /tournaments (home cards, enroll modal).
class RestTournament {
  const RestTournament({
    required this.id,
    required this.title,
    required this.isFree,
    this.entryFeeAmount,
    required this.entryFeeCurrency,
    required this.status,
    this.statusLabel = '',
    this.description,
    this.prizePoolTotal,
    this.prizePoolCurrency,
    this.prizePoolDisplayEnabled = false,
    this.prizePoolNow,
    this.prizePoolIfFull,
    this.prizePoolGuaranteeAmount,
    this.prizePoolFrozen = false,
    this.prizePayoutMode = '',
    this.prizePlacePercents = const {},
    this.prizeImageUrl,
    this.gallery = const [],
    this.playersCount,
    this.maxPlayers,
    this.seatCapUnlimited = false,
    this.formatId = '',
    this.formatLabel = '',
    this.viewerEnrolled = false,
    this.viewerArenaQueued = false,
    this.viewerPlacement,
    this.viewerArenaPoints,
    this.viewerArenaStreak,
    this.viewerPrizeAmount,
    this.viewerPrizeCurrency,
    this.startedAt,
    this.liveGameId,
    this.checkInOpensAt,
    this.checkInClosesAt,
    this.prizeSettledAt,
    this.disputeWindowEndsAt,
    this.finishedAt,
    this.arenaEndsAt,
  });

  final String id;
  final String title;
  final String? description;
  final bool isFree;

  /// Catalog format id (knockout / round_robin / swiss / groups_knockout).
  final String formatId;

  /// Catalog format label when API stamps it (never invent from id).
  final String formatLabel;

  /// Null when API omits entry fee amount (never invent 0).
  final double? entryFeeAmount;
  final String entryFeeCurrency;
  final double? prizePoolTotal;
  final String? prizePoolCurrency;
  final bool prizePoolDisplayEnabled;
  final double? prizePoolNow;
  final double? prizePoolIfFull;
  final double? prizePoolGuaranteeAmount;
  final bool prizePoolFrozen;
  final String prizePayoutMode;
  final Map<String, dynamic> prizePlacePercents;
  final String? prizeImageUrl;
  final List<String> gallery;

  /// Null when API omits players_count (never invent 0).
  final int? playersCount;

  /// Null when API omits max_players (never invent).
  final int? maxPlayers;

  /// API seat_cap_unlimited: null Unlimited or high Arena safety ceiling.
  final bool seatCapUnlimited;

  /// True when API attaches viewer_enrolled for the authenticated player.
  final bool viewerEnrolled;
  final bool viewerArenaQueued;
  final int? viewerPlacement;
  final num? viewerArenaPoints;
  final int? viewerArenaStreak;
  final num? viewerPrizeAmount;
  final String? viewerPrizeCurrency;
  final String status;

  /// DB label from client_enums.tournament_status_labels when present.
  final String statusLabel;
  final String? startedAt;

  /// Unfinished live bracket board - Watch deep-link (omit when none).
  final String? liveGameId;
  final String? checkInOpensAt;
  final String? checkInClosesAt;
  final String? prizeSettledAt;
  final String? disputeWindowEndsAt;
  final String? finishedAt;
  final String? arenaEndsAt;

  /// prize_image_url first, then gallery (deduped).
  List<String> get carouselImages {
    final out = <String>[];
    final prize = (prizeImageUrl ?? '').trim();
    if (prize.isNotEmpty) out.add(prize);
    for (final url in gallery) {
      final u = url.trim();
      if (u.isNotEmpty && !out.contains(u)) out.add(u);
    }
    return out;
  }

  factory RestTournament.fromJson(Map<String, dynamic> json) {
    double? poolTotal;
    // Live pot currency is top-level prize_pool_currency (entry-fee currency).
    // Nested prize_pool.currency is declared-prize only; never override live.
    String? poolCurrency = json['prize_pool_currency']?.toString() ??
        json['prizePoolCurrency']?.toString();
    final pool = json['prize_pool'] ?? json['prizePool'];
    if (pool is Map<String, dynamic>) {
      final t = pool['total'];
      if (t is num) poolTotal = t.toDouble();
      if ((poolCurrency ?? '').trim().isEmpty) {
        poolCurrency = pool['currency']?.toString();
      }
    } else {
      final amount = json['prize_pool_amount'] ?? json['prizePoolAmount'];
      if (amount is num) poolTotal = amount.toDouble();
    }
    final galleryRaw = json['gallery'];
    final gallery = galleryRaw is List
        ? galleryRaw
            .map((e) => e.toString())
            .where((s) => s.trim().isNotEmpty)
            .toList()
        : const <String>[];
    final players = json['players_count'] ?? json['playersCount'];
    final maxRaw = json['max_players'] ?? json['maxPlayers'];
    double? asDouble(dynamic v) {
      if (v is num) return v.toDouble();
      if (v is String && v.trim().isNotEmpty) {
        return double.tryParse(v.trim());
      }
      return null;
    }

    int? asInt(dynamic v) {
      if (v is num) return v.toInt();
      if (v is String && v.trim().isNotEmpty) {
        return int.tryParse(v.trim());
      }
      return null;
    }

    num? asNum(dynamic v) {
      if (v is num) return v;
      if (v is String && v.trim().isNotEmpty) {
        return num.tryParse(v.trim());
      }
      return null;
    }

    final displayEnabled = json['prize_pool_display_enabled'] == true;
    final percentsRaw = json['prize_place_percents'];
    final percents = percentsRaw is Map<String, dynamic>
        ? Map<String, dynamic>.from(percentsRaw)
        : const <String, dynamic>{};
    return RestTournament(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString(),
      isFree: json['is_free'] == true || json['isFree'] == true,
      entryFeeAmount: asDouble(json['entry_fee_amount']) ??
          asDouble(json['entryFeeAmount']),
      entryFeeCurrency: json['entry_fee_currency']?.toString() ??
          json['entryFeeCurrency']?.toString() ??
          '',
      prizePoolTotal: poolTotal,
      prizePoolCurrency: poolCurrency,
      prizePoolDisplayEnabled: displayEnabled,
      prizePoolNow: asDouble(json['prize_pool_now']),
      prizePoolIfFull: asDouble(json['prize_pool_if_full']),
      prizePoolGuaranteeAmount: asDouble(json['prize_pool_guarantee_amount']),
      prizePoolFrozen: json['prize_pool_frozen'] == true,
      prizePayoutMode: (json['prize_payout_mode'] as String?)?.trim() ?? '',
      prizePlacePercents: percents,
      prizeImageUrl: json['prize_image_url']?.toString() ??
          json['prizeImageUrl']?.toString(),
      gallery: gallery,
      playersCount: asInt(players),
      maxPlayers: asInt(maxRaw),
      seatCapUnlimited: json['seat_cap_unlimited'] == true ||
          json['seatCapUnlimited'] == true,
      formatId:
          (json['format_id'] ?? json['formatId'])?.toString().trim() ?? '',
      formatLabel:
          (json['format_label'] ?? json['formatLabel'])?.toString().trim() ??
              '',
      viewerEnrolled:
          json['viewer_enrolled'] == true || json['viewerEnrolled'] == true,
      viewerArenaQueued: json['viewer_arena_queued'] == true,
      viewerPlacement:
          asInt(json['viewer_placement'] ?? json['viewerPlacement']),
      viewerArenaPoints:
          asNum(json['viewer_arena_points'] ?? json['viewerArenaPoints']),
      viewerArenaStreak:
          asInt(json['viewer_arena_streak'] ?? json['viewerArenaStreak']),
      viewerPrizeAmount:
          asNum(json['viewer_prize_amount'] ?? json['viewerPrizeAmount']),
      viewerPrizeCurrency:
          (json['viewer_prize_currency'] ?? json['viewerPrizeCurrency'])
              ?.toString(),
      status: json['status']?.toString() ?? '',
      statusLabel:
          (json['status_label'] ?? json['statusLabel'])?.toString().trim() ??
              '',
      startedAt: json['started_at']?.toString(),
      liveGameId: (json['live_game_id'] ?? json['liveGameId'])?.toString(),
      checkInOpensAt: json['check_in_opens_at']?.toString(),
      checkInClosesAt: json['check_in_closes_at']?.toString(),
      prizeSettledAt: json['prize_settled_at']?.toString(),
      disputeWindowEndsAt: json['dispute_window_ends_at']?.toString(),
      finishedAt: json['finished_at']?.toString(),
      arenaEndsAt: json['arena_ends_at']?.toString(),
    );
  }
}

/// Roster row from GET /tournaments/{id}/entries.
class TournamentRosterEntry {
  const TournamentRosterEntry({
    required this.userId,
    this.username = '',
    this.checkedInAt,
    this.placement,
  });

  final String userId;
  final String username;
  final String? checkedInAt;
  final int? placement;

  factory TournamentRosterEntry.fromJson(Map<String, dynamic> json) {
    int? placement;
    final p = json['placement'];
    if (p is num) placement = p.toInt();
    return TournamentRosterEntry(
      userId: json['user_id']?.toString() ?? '',
      username: (json['username'] as String?)?.trim() ?? '',
      checkedInAt: json['checked_in_at']?.toString(),
      placement: placement,
    );
  }
}

/// Bracket match from GET /tournaments/{id}/bracket.
class TournamentBracketMatch {
  const TournamentBracketMatch({
    required this.id,
    required this.roundIndex,
    required this.matchIndex,
    required this.status,
    this.playerAId,
    this.playerBId,
    this.playerAUsername = '',
    this.playerBUsername = '',
    this.winnerUsername = '',
    this.gameId,
    this.isBye = false,
    this.playerAReadyAt,
    this.playerBReadyAt,
    this.finishedAt,
    this.statusLabel = '',
  });

  final String id;
  final int roundIndex;
  final int matchIndex;
  final String status;
  final String statusLabel;
  final String? playerAId;
  final String? playerBId;
  final String playerAUsername;
  final String playerBUsername;
  final String winnerUsername;
  final String? gameId;
  final bool isBye;
  final String? playerAReadyAt;
  final String? playerBReadyAt;
  final String? finishedAt;

  factory TournamentBracketMatch.fromJson(Map<String, dynamic> json) {
    return TournamentBracketMatch(
      id: json['id']?.toString() ?? '',
      roundIndex: (json['round_index'] as num?)?.toInt() ?? 0,
      matchIndex: (json['match_index'] as num?)?.toInt() ?? 0,
      status: json['status']?.toString() ?? '',
      statusLabel: (json['status_label'] as String?)?.trim() ?? '',
      playerAId: json['player_a_id']?.toString(),
      playerBId: json['player_b_id']?.toString(),
      playerAUsername: (json['player_a_username'] as String?)?.trim() ?? '',
      playerBUsername: (json['player_b_username'] as String?)?.trim() ?? '',
      winnerUsername: (json['winner_username'] as String?)?.trim() ?? '',
      gameId: json['game_id']?.toString(),
      isBye: json['is_bye'] == true,
      playerAReadyAt: json['player_a_ready_at']?.toString(),
      playerBReadyAt: json['player_b_ready_at']?.toString(),
      finishedAt: json['finished_at']?.toString(),
    );
  }
}

/// REST `POST /tournaments/{id}/enroll` response.
class TournamentEnrollResult {
  const TournamentEnrollResult({
    this.isFree = false,
    this.charged,
    this.chargedCurrency = '',
  });

  final bool isFree;
  final double? charged;
  final String chargedCurrency;

  factory TournamentEnrollResult.fromJson(Map<String, dynamic> json) {
    final chargedRaw = json['charged'];
    return TournamentEnrollResult(
      isFree: json['is_free'] == true || json['isFree'] == true,
      charged: chargedRaw is num ? chargedRaw.toDouble() : null,
      chargedCurrency: json['charged_currency']?.toString() ??
          json['chargedCurrency']?.toString() ??
          '',
    );
  }
}
