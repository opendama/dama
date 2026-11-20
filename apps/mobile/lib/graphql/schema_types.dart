// GENERATED CONTRACT MIRROR of apps/api/graphql/schema.graphql
// Keep in sync via: powershell -File scripts/sync-graphql-schema.ps1
// Prefer regenerating with: dart run build_runner build --delete-conflicting-outputs
// when Flutter SDK is available (graphql_codegen).

class GMatchSummary {
  const GMatchSummary({
    required this.id,
    required this.mode,
    required this.isDraw,
    required this.moveCount,
    required this.isFree,
    required this.finishedAt,
  });

  final String id;
  final String mode;
  final bool isDraw;
  final int moveCount;
  final bool isFree;
  final String finishedAt;

  factory GMatchSummary.fromJson(Map<String, dynamic> json) => GMatchSummary(
        id: json['id'] as String,
        mode: json['mode'] as String,
        isDraw: json['isDraw'] == true,
        moveCount: (json['moveCount'] as num?)?.toInt() ?? 0,
        isFree: json['isFree'] == true,
        finishedAt: json['finishedAt'] as String? ?? '',
      );
}

class GPlayer {
  const GPlayer({
    required this.id,
    required this.username,
    required this.role,
    required this.rating,
    required this.xp,
    required this.wins,
    required this.losses,
    required this.draws,
    required this.online,
    required this.recentMatches,
    this.avatarThumbUrl,
    this.avatarFullUrl,
    this.region,
    this.countryCode,
    this.regionalRank,
    this.regionLabel,
    this.levelLabel,
    this.hostTrustTier,
    this.hostTrustBadge,
    this.hostFinishedPaidCups,
    this.hostCancelledPaidCups,
    this.hostOpenReports,
  });

  final String id;
  final String username;
  final String role;
  final int rating;
  final int xp;
  final int wins;
  final int losses;
  final int draws;
  final String? avatarThumbUrl;
  final String? avatarFullUrl;
  final String? region;
  final String? countryCode;
  final bool online;
  final int? regionalRank;
  final String? regionLabel;
  final String? levelLabel;
  final String? hostTrustTier;
  final String? hostTrustBadge;
  final int? hostFinishedPaidCups;
  final int? hostCancelledPaidCups;
  final int? hostOpenReports;
  final List<GMatchSummary> recentMatches;

  factory GPlayer.fromJson(Map<String, dynamic> json) => GPlayer(
        id: json['id'] as String,
        username: json['username'] as String,
        role: json['role'] as String? ?? '',
        rating: (json['rating'] as num?)?.toInt() ?? 0,
        xp: (json['xp'] as num?)?.toInt() ?? 0,
        wins: (json['wins'] as num?)?.toInt() ?? 0,
        losses: (json['losses'] as num?)?.toInt() ?? 0,
        draws: (json['draws'] as num?)?.toInt() ?? 0,
        avatarThumbUrl: json['avatarThumbUrl'] as String?,
        avatarFullUrl: json['avatarFullUrl'] as String?,
        region: json['region'] as String?,
        countryCode: json['countryCode'] as String?,
        online: json['online'] == true,
        regionalRank: (json['regionalRank'] as num?)?.toInt(),
        regionLabel: json['regionLabel'] as String?,
        levelLabel: json['levelLabel'] as String?,
        hostTrustTier: (json['hostTrustTier'] as String?)?.trim(),
        hostTrustBadge: (json['hostTrustBadge'] as String?)?.trim(),
        hostFinishedPaidCups: (json['hostFinishedPaidCups'] as num?)?.toInt(),
        hostCancelledPaidCups: (json['hostCancelledPaidCups'] as num?)?.toInt(),
        hostOpenReports: (json['hostOpenReports'] as num?)?.toInt(),
        recentMatches: (json['recentMatches'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .map(GMatchSummary.fromJson)
            .toList(),
      );
}

class GFeatureFlags {
  const GFeatureFlags({
    required this.vsAiEnabled,
    required this.otpRequired,
    required this.cashRmgEnabled,
    required this.cashPhoneKycRequired,
    required this.cashPhoneOtpRequired,
    required this.cashRmgDisabledCountries,
    required this.hostedEventsEnabled,
    required this.publicEventsEnabled,
    required this.publicEventMatchesRated,
    required this.prizePoolDisplayEnabled,
    required this.prizePoolGuaranteeEnabled,
    required this.kycAutoApprove,
    required this.aiDepths,
  });

  final bool vsAiEnabled;
  final bool otpRequired;
  final bool cashRmgEnabled;
  final bool cashPhoneKycRequired;
  final bool cashPhoneOtpRequired;
  final List<String> cashRmgDisabledCountries;
  final bool hostedEventsEnabled;
  final bool publicEventsEnabled;
  final bool publicEventMatchesRated;
  final bool prizePoolDisplayEnabled;
  final bool prizePoolGuaranteeEnabled;
  final bool kycAutoApprove;
  final List<int> aiDepths;

  factory GFeatureFlags.fromJson(Map<String, dynamic> json) => GFeatureFlags(
        vsAiEnabled: json['vsAiEnabled'] == true,
        otpRequired: json['otpRequired'] == true,
        cashRmgEnabled: json['cashRmgEnabled'] == true,
        cashPhoneKycRequired: json['cashPhoneKycRequired'] == true,
        cashPhoneOtpRequired: json['cashPhoneOtpRequired'] == true,
        cashRmgDisabledCountries:
            (json['cashRmgDisabledCountries'] as List<dynamic>? ?? [])
                .map((e) => e.toString())
                .toList(),
        hostedEventsEnabled: json['hostedEventsEnabled'] == true,
        publicEventsEnabled: json['publicEventsEnabled'] == true,
        publicEventMatchesRated: json['publicEventMatchesRated'] == true,
        prizePoolDisplayEnabled: json['prizePoolDisplayEnabled'] == true,
        prizePoolGuaranteeEnabled: json['prizePoolGuaranteeEnabled'] == true,
        kycAutoApprove: json['kycAutoApprove'] == true,
        aiDepths: (json['aiDepths'] as List<dynamic>? ?? [])
            .map((e) => (e as num).toInt())
            .toList(),
      );
}

class GTournament {
  const GTournament({
    required this.id,
    required this.title,
    required this.isFree,
    this.entryFeeAmount,
    required this.entryFeeCurrency,
    this.prizePoolAmount,
    required this.status,
    required this.gallery,
    this.playersCount,
    this.description,
    this.prizePoolCurrency,
    this.prizeImageUrl,
    this.prizePoolDisplayEnabled = false,
    this.prizePoolNow,
    this.prizePoolIfFull,
    this.prizePoolGuaranteeAmount,
    this.prizePoolFrozen = false,
    this.maxPlayers,
    this.seatCapUnlimited = false,
  });

  final String id;
  final String title;
  final String? description;
  final bool isFree;
  final double? entryFeeAmount;
  final String entryFeeCurrency;
  final double? prizePoolAmount;
  final String? prizePoolCurrency;
  final String? prizeImageUrl;
  final List<String> gallery;
  final int? playersCount;
  final String status;
  final bool prizePoolDisplayEnabled;
  final double? prizePoolNow;
  final double? prizePoolIfFull;
  final double? prizePoolGuaranteeAmount;
  final bool prizePoolFrozen;
  final int? maxPlayers;

  /// API seatCapUnlimited: null Unlimited or high Arena safety ceiling.
  final bool seatCapUnlimited;

  factory GTournament.fromJson(Map<String, dynamic> json) => GTournament(
        id: json['id'] as String,
        title: json['title'] as String,
        description: json['description'] as String?,
        isFree: json['isFree'] == true,
        entryFeeAmount: (json['entryFeeAmount'] as num?)?.toDouble(),
        entryFeeCurrency: json['entryFeeCurrency'] as String? ?? '',
        prizePoolAmount: (json['prizePoolAmount'] as num?)?.toDouble(),
        prizePoolCurrency: json['prizePoolCurrency'] as String?,
        prizeImageUrl: json['prizeImageUrl'] as String?,
        gallery: (json['gallery'] as List<dynamic>? ?? const [])
            .map((e) => e.toString())
            .where((s) => s.trim().isNotEmpty)
            .toList(),
        playersCount: (json['playersCount'] as num?)?.toInt(),
        status: json['status'] as String? ?? '',
        prizePoolDisplayEnabled: json['prizePoolDisplayEnabled'] == true,
        prizePoolNow: (json['prizePoolNow'] as num?)?.toDouble(),
        prizePoolIfFull: (json['prizePoolIfFull'] as num?)?.toDouble(),
        prizePoolGuaranteeAmount:
            (json['prizePoolGuaranteeAmount'] as num?)?.toDouble(),
        prizePoolFrozen: json['prizePoolFrozen'] == true,
        maxPlayers: (json['maxPlayers'] as num?)?.toInt(),
        seatCapUnlimited: json['seatCapUnlimited'] == true,
      );

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
}

class GAdCampaign {
  const GAdCampaign({
    required this.id,
    required this.title,
    required this.status,
    this.statusLabel,
    this.impressions,
    this.clicks,
    this.uniqueReach,
    this.videoCompletions,
    this.creativeUrl,
    this.thumbnailUrl,
    this.gallery = const [],
  });

  final String id;
  final String title;
  final String status;
  final String? statusLabel;

  /// Null when GraphQL omitted the field (UI uses chrome empty_value).
  final int? impressions;
  final int? clicks;
  final int? uniqueReach;
  final int? videoCompletions;
  final String? creativeUrl;
  final String? thumbnailUrl;
  final List<String> gallery;

  factory GAdCampaign.fromJson(Map<String, dynamic> json) => GAdCampaign(
        id: json['id'] as String,
        title: json['title'] as String,
        status: json['status'] as String? ?? '',
        statusLabel: (json['statusLabel'] as String?)?.trim() ??
            (json['status_label'] as String?)?.trim(),
        impressions: (json['impressions'] as num?)?.toInt(),
        clicks: (json['clicks'] as num?)?.toInt(),
        uniqueReach: (json['uniqueReach'] as num?)?.toInt() ??
            (json['unique_reach'] as num?)?.toInt(),
        videoCompletions: (json['videoCompletions'] as num?)?.toInt() ??
            (json['video_completions'] as num?)?.toInt(),
        creativeUrl:
            json['creativeUrl'] as String? ?? json['creative_url'] as String?,
        thumbnailUrl:
            json['thumbnailUrl'] as String? ?? json['thumbnail_url'] as String?,
        gallery: (json['gallery'] as List<dynamic>? ?? const [])
            .map((e) => e.toString())
            .where((s) => s.trim().isNotEmpty)
            .toList(),
      );
}

class GPublisherDashboard {
  const GPublisherDashboard({
    required this.campaigns,
    required this.totalImpressions,
    required this.totalClicks,
    required this.totalUniqueReach,
    required this.totalVideoCompletions,
    required this.ctrPercent,
    required this.cpc,
    this.cpcCurrency = '',
    required this.completionPercent,
    required this.createFeeSpendSum,
    this.createFeeSpendCurrency = '',
    this.meUsername,
  });

  final List<GAdCampaign> campaigns;

  /// Null when GraphQL omitted; UI uses chrome empty_value (never invent 0).
  final int? totalImpressions;
  final int? totalClicks;
  final int? totalUniqueReach;
  final int? totalVideoCompletions;
  final double? ctrPercent;
  final double? cpc;
  final String cpcCurrency;
  final double? completionPercent;
  final double? createFeeSpendSum;
  final String createFeeSpendCurrency;
  final String? meUsername;

  factory GPublisherDashboard.fromJson(Map<String, dynamic> json) {
    final me = json['me'];
    int? asInt(dynamic v) => v is num ? v.toInt() : null;
    double? asDouble(dynamic v) => v is num ? v.toDouble() : null;
    return GPublisherDashboard(
      campaigns: (json['campaigns'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(GAdCampaign.fromJson)
          .toList(),
      totalImpressions: asInt(json['totalImpressions']),
      totalClicks: asInt(json['totalClicks']),
      totalUniqueReach: asInt(json['totalUniqueReach']),
      totalVideoCompletions: asInt(json['totalVideoCompletions']),
      ctrPercent: asDouble(json['ctrPercent']),
      cpc: asDouble(json['cpc']),
      cpcCurrency: (json['cpcCurrency'] as String?)?.trim() ?? '',
      completionPercent: asDouble(json['completionPercent']),
      createFeeSpendSum: asDouble(json['createFeeSpendSum']),
      createFeeSpendCurrency:
          (json['createFeeSpendCurrency'] as String?)?.trim() ?? '',
      meUsername: me is Map<String, dynamic> ? me['username'] as String? : null,
    );
  }
}
