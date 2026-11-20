export 'package:dama_mobile/core/models/player_profile.dart';
export 'package:dama_mobile/graphql/schema_types.dart'
    show GMatchSummary, GPlayer;

/// Incoming match invite payload from raw Go WebSocket matchmaking.
class MatchInvite {
  const MatchInvite({
    required this.id,
    this.fromUsername,
    this.fromUserId,
    this.fromRating,
    this.fromHostTrustTier,
    this.fromHostTrustBadge,
    this.rated,
    this.preferredColor,
    this.timeControlSeconds,
    this.expiresAt,
  });

  final String id;
  final String? fromUsername;
  final String? fromUserId;
  final int? fromRating;
  final String? fromHostTrustTier;
  final String? fromHostTrustBadge;
  final bool? rated;
  final String? preferredColor;
  final int? timeControlSeconds;
  final String? expiresAt;

  factory MatchInvite.fromJson(Map<String, dynamic> json) {
    return MatchInvite(
      id: (json['id'] ?? '').toString(),
      fromUsername:
          json['from_username']?.toString() ?? json['fromUsername']?.toString(),
      fromUserId:
          json['from_user_id']?.toString() ?? json['fromUserId']?.toString(),
      fromRating: (json['from_rating'] as num?)?.toInt() ??
          (json['fromRating'] as num?)?.toInt(),
      fromHostTrustTier: (json['from_host_trust_tier'] as String?)?.trim() ??
          (json['fromHostTrustTier'] as String?)?.trim(),
      fromHostTrustBadge: (json['from_host_trust_badge'] as String?)?.trim() ??
          (json['fromHostTrustBadge'] as String?)?.trim(),
      rated: json['rated'] is bool ? json['rated'] as bool : null,
      preferredColor: json['preferred_color']?.toString() ??
          json['preferredColor']?.toString(),
      timeControlSeconds: (json['time_control_seconds'] as num?)?.toInt() ??
          (json['timeControlSeconds'] as num?)?.toInt(),
      expiresAt:
          json['expires_at']?.toString() ?? json['expiresAt']?.toString(),
    );
  }
}

/// REST matchmaking self card (snake_case from join/status payloads).
class MatchmakingSelfCard {
  const MatchmakingSelfCard({
    required this.id,
    required this.username,
    this.rating = 0,
    this.avatarThumbUrl,
    this.countryCode,
    this.hostTrustTier,
    this.hostTrustBadge,
  });

  final String id;
  final String username;
  final int rating;
  final String? avatarThumbUrl;
  final String? countryCode;
  final String? hostTrustTier;
  final String? hostTrustBadge;

  MatchmakingSelfCard copyWith(
      {String? avatarThumbUrl, bool clearAvatar = false}) {
    return MatchmakingSelfCard(
      id: id,
      username: username,
      rating: rating,
      avatarThumbUrl:
          clearAvatar ? null : (avatarThumbUrl ?? this.avatarThumbUrl),
      countryCode: countryCode,
      hostTrustTier: hostTrustTier,
      hostTrustBadge: hostTrustBadge,
    );
  }

  factory MatchmakingSelfCard.fromJson(Map<String, dynamic> json) {
    return MatchmakingSelfCard(
      id: (json['id'] ?? '').toString(),
      username: (json['username'] ?? '').toString(),
      rating: (json['rating'] as num?)?.toInt() ?? 0,
      avatarThumbUrl: json['avatar_thumb_url'] as String?,
      countryCode: json['country_code'] as String?,
      hostTrustTier: (json['host_trust_tier'] as String?)?.trim() ??
          (json['hostTrustTier'] as String?)?.trim(),
      hostTrustBadge: (json['host_trust_badge'] as String?)?.trim() ??
          (json['hostTrustBadge'] as String?)?.trim(),
    );
  }
}

/// Soft-remount cache for matchmaking status (WS remains live source of truth).
class MatchmakingCacheSnapshot {
  const MatchmakingCacheSnapshot({
    required this.queueSize,
    required this.queued,
    this.self,
  });

  final int queueSize;
  final bool queued;
  final MatchmakingSelfCard? self;
}

/// REST `GET /players/{id}` player object (snake_case or camelCase).
class PublicPlayerCard {
  const PublicPlayerCard({
    required this.id,
    required this.username,
    this.rating = 0,
    this.xp = 0,
    this.wins = 0,
    this.losses = 0,
    this.draws = 0,
    this.points,
    this.avatarThumbUrl,
    this.avatarFullUrl,
    this.region,
    this.countryCode,
    this.online = false,
    this.playing = false,
    this.playingGameId,
    this.levelLabel,
    this.regionalRank,
    this.hostTrustTier,
    this.hostTrustBadge,
    this.hostFinishedPaidCups,
    this.hostCancelledPaidCups,
    this.hostOpenReports,
  });

  final String id;
  final String username;
  final int rating;
  final int xp;
  final int wins;
  final int losses;
  final int draws;

  /// Period points (Hall of Fame) when present; else null.
  final int? points;
  final String? avatarThumbUrl;
  final String? avatarFullUrl;
  final String? region;
  final String? countryCode;
  final bool online;

  /// Active PvP game - Chess.com-style red “Playing” badge.
  final bool playing;
  final String? playingGameId;
  final String? levelLabel;
  final int? regionalRank;
  final String? hostTrustTier;
  final String? hostTrustBadge;
  final int? hostFinishedPaidCups;
  final int? hostCancelledPaidCups;
  final int? hostOpenReports;

  String? get displayImageUrl {
    final full = avatarFullUrl;
    if (full != null && full.isNotEmpty) return full;
    final thumb = avatarThumbUrl;
    if (thumb != null && thumb.isNotEmpty) return thumb;
    return null;
  }

  /// Avatar / presence patches must preserve host-trust fields from the prior card.
  PublicPlayerCard copyWith({
    String? id,
    String? username,
    int? rating,
    int? xp,
    int? wins,
    int? losses,
    int? draws,
    int? points,
    String? avatarThumbUrl,
    String? avatarFullUrl,
    bool clearAvatar = false,
    String? region,
    String? countryCode,
    bool? online,
    bool? playing,
    String? playingGameId,
    String? levelLabel,
    int? regionalRank,
    String? hostTrustTier,
    String? hostTrustBadge,
    int? hostFinishedPaidCups,
    int? hostCancelledPaidCups,
    int? hostOpenReports,
  }) {
    return PublicPlayerCard(
      id: id ?? this.id,
      username: username ?? this.username,
      rating: rating ?? this.rating,
      xp: xp ?? this.xp,
      wins: wins ?? this.wins,
      losses: losses ?? this.losses,
      draws: draws ?? this.draws,
      points: points ?? this.points,
      avatarThumbUrl:
          clearAvatar ? null : (avatarThumbUrl ?? this.avatarThumbUrl),
      avatarFullUrl: clearAvatar ? null : (avatarFullUrl ?? this.avatarFullUrl),
      region: region ?? this.region,
      countryCode: countryCode ?? this.countryCode,
      online: online ?? this.online,
      playing: playing ?? this.playing,
      playingGameId: playingGameId ?? this.playingGameId,
      levelLabel: levelLabel ?? this.levelLabel,
      regionalRank: regionalRank ?? this.regionalRank,
      hostTrustTier: hostTrustTier ?? this.hostTrustTier,
      hostTrustBadge: hostTrustBadge ?? this.hostTrustBadge,
      hostFinishedPaidCups: hostFinishedPaidCups ?? this.hostFinishedPaidCups,
      hostCancelledPaidCups:
          hostCancelledPaidCups ?? this.hostCancelledPaidCups,
      hostOpenReports: hostOpenReports ?? this.hostOpenReports,
    );
  }

  factory PublicPlayerCard.fromJson(Map<String, dynamic> json) {
    return PublicPlayerCard(
      id: json['id']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
      rating: (json['rating'] as num?)?.toInt() ?? 0,
      xp: (json['xp'] as num?)?.toInt() ?? 0,
      wins: (json['wins'] as num?)?.toInt() ?? 0,
      losses: (json['losses'] as num?)?.toInt() ?? 0,
      draws: (json['draws'] as num?)?.toInt() ?? 0,
      points: (json['points'] as num?)?.toInt(),
      avatarThumbUrl: json['avatar_thumb_url'] as String? ??
          json['avatarThumbUrl'] as String?,
      avatarFullUrl: json['avatar_full_url'] as String? ??
          json['avatarFullUrl'] as String?,
      region: json['region'] as String?,
      countryCode:
          json['country_code'] as String? ?? json['countryCode'] as String?,
      online: json['online'] == true,
      playing: json['playing'] == true,
      playingGameId: (json['playing_game_id'] as String?)?.trim() ??
          (json['playingGameId'] as String?)?.trim(),
      levelLabel:
          json['level_label'] as String? ?? json['levelLabel'] as String?,
      regionalRank: (json['regional_rank'] as num?)?.toInt() ??
          (json['regionalRank'] as num?)?.toInt(),
      hostTrustTier: (json['host_trust_tier'] as String?)?.trim() ??
          (json['hostTrustTier'] as String?)?.trim(),
      hostTrustBadge: (json['host_trust_badge'] as String?)?.trim() ??
          (json['hostTrustBadge'] as String?)?.trim(),
      hostFinishedPaidCups:
          (json['host_finished_paid_cups'] as num?)?.toInt() ??
              (json['hostFinishedPaidCups'] as num?)?.toInt(),
      hostCancelledPaidCups:
          (json['host_cancelled_paid_cups'] as num?)?.toInt() ??
              (json['hostCancelledPaidCups'] as num?)?.toInt(),
      hostOpenReports: (json['host_open_reports'] as num?)?.toInt() ??
          (json['hostOpenReports'] as num?)?.toInt(),
    );
  }
}

/// REST match row on player inspect.
class RestMatchSummary {
  const RestMatchSummary({
    this.id,
    this.mode,
    this.isDraw = false,
    this.isFree = false,
    this.winnerId,
    this.finishedAt,
    this.moveCount,
    this.player1,
    this.player2,
  });

  final String? id;
  final String? mode;
  final bool isDraw;
  final bool isFree;
  final String? winnerId;
  final String? finishedAt;
  final int? moveCount;
  final PublicPlayerCard? player1;
  final PublicPlayerCard? player2;

  factory RestMatchSummary.fromJson(Map<String, dynamic> json) {
    PublicPlayerCard? seat(String snake, String camel) {
      final raw = json[snake] ?? json[camel];
      if (raw is Map<String, dynamic>) return PublicPlayerCard.fromJson(raw);
      return null;
    }

    return RestMatchSummary(
      id: json['id']?.toString(),
      mode: json['mode']?.toString(),
      isDraw: json['is_draw'] == true || json['isDraw'] == true,
      isFree: json['is_free'] == true || json['isFree'] == true,
      winnerId: json['winner_id']?.toString() ?? json['winnerId']?.toString(),
      finishedAt:
          json['finished_at']?.toString() ?? json['finishedAt']?.toString(),
      moveCount: (json['move_count'] as num?)?.toInt() ??
          (json['moveCount'] as num?)?.toInt(),
      player1: seat('player1', 'player1'),
      player2: seat('player2', 'player2'),
    );
  }

  String outcomeLabel(
    String playerId, {
    required String outcomeDraw,
    required String outcomeWin,
    required String outcomeLoss,
  }) {
    if (isDraw) return outcomeDraw;
    final winner = winnerId;
    if (winner == null || winner.isEmpty) return '';
    if (winner == playerId) return outcomeWin;
    return outcomeLoss;
  }
}

class TournamentPlacementEntry {
  const TournamentPlacementEntry({
    this.title,
    this.isFree = false,
    this.entryStatus,
  });

  final String? title;
  final bool isFree;
  final String? entryStatus;

  factory TournamentPlacementEntry.fromJson(Map<String, dynamic> json) {
    return TournamentPlacementEntry(
      title: json['title']?.toString(),
      isFree: json['is_free'] == true || json['isFree'] == true,
      entryStatus:
          json['entry_status']?.toString() ?? json['entryStatus']?.toString(),
    );
  }
}

/// Full REST payload for `GET /players/{id}`.
class PlayerDetailResponse {
  const PlayerDetailResponse({
    this.player,
    this.matches = const [],
    this.placements = const [],
    this.regionalRank,
    this.regionLabel,
    this.friendsCount,
    this.friendsPreview = const [],
  });

  final PublicPlayerCard? player;
  final List<RestMatchSummary> matches;
  final List<TournamentPlacementEntry> placements;
  final int? regionalRank;
  final String? regionLabel;
  final int? friendsCount;
  final List<PublicPlayerCard> friendsPreview;

  factory PlayerDetailResponse.fromJson(Map<String, dynamic> json) {
    final playerMap = json['player'];
    PublicPlayerCard? player;
    if (playerMap is Map<String, dynamic>) {
      // Merge top-level presence when nested player omits them.
      final merged = Map<String, dynamic>.from(playerMap);
      merged['online'] = merged['online'] ?? json['online'];
      merged['playing'] = merged['playing'] ?? json['playing'];
      merged['playing_game_id'] = merged['playing_game_id'] ??
          merged['playingGameId'] ??
          json['playing_game_id'] ??
          json['playingGameId'];
      player = PublicPlayerCard.fromJson(merged);
    }
    return PlayerDetailResponse(
      player: player,
      matches: (json['matches'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(RestMatchSummary.fromJson)
          .toList(),
      placements: (json['tournament_placements'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(TournamentPlacementEntry.fromJson)
          .toList(),
      regionalRank: (json['regional_rank'] as num?)?.toInt() ??
          (json['regionalRank'] as num?)?.toInt(),
      regionLabel:
          json['region_label'] as String? ?? json['regionLabel'] as String?,
      friendsCount: (json['friends_count'] as num?)?.toInt() ??
          (json['friendsCount'] as num?)?.toInt(),
      friendsPreview: (json['friends_preview'] as List<dynamic>? ??
              json['friendsPreview'] as List<dynamic>? ??
              [])
          .whereType<Map<String, dynamic>>()
          .map(PublicPlayerCard.fromJson)
          .toList(),
    );
  }
}
