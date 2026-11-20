// REST models for hosted Dama Events (`/api/v1/events/...`). Snake_case only.

class EventsCatalogFormat {
  const EventsCatalogFormat({
    required this.id,
    required this.enabled,
    required this.label,
  });

  final String id;
  final bool enabled;
  final String label;

  factory EventsCatalogFormat.fromJson(Map<String, dynamic> json) {
    return EventsCatalogFormat(
      id: json['id']?.toString() ?? '',
      enabled: json['enabled'] == true,
      label: (json['label'] as String?)?.trim() ?? '',
    );
  }
}

class EventsCatalogSize {
  const EventsCatalogSize({
    required this.id,
    required this.enabled,
    this.maxPlayers,
    this.hostFeeAmount,
    required this.hostFeeCurrency,
    required this.label,
    this.publicHostFeeAmount,
    this.allowedFormatIds = const [],
  });

  final String id;
  final bool enabled;
  final int? maxPlayers;
  final double? hostFeeAmount;

  /// Server-computed base * public_host_fee_multiplier for create UI.
  /// Null when catalog omitted the field (fail closed; never invent 0).
  final double? publicHostFeeAmount;
  final String hostFeeCurrency;
  final List<String> allowedFormatIds;
  final String label;

  factory EventsCatalogSize.fromJson(Map<String, dynamic> json) {
    final allowed = json['allowed_format_ids'];
    final publicFeeRaw = json['public_host_fee_amount'];
    int? asInt(dynamic v) => v is num ? v.toInt() : null;
    double? asDouble(dynamic v) => v is num ? v.toDouble() : null;
    return EventsCatalogSize(
      id: json['id']?.toString() ?? '',
      enabled: json['enabled'] == true,
      maxPlayers: asInt(json['max_players']),
      hostFeeAmount: asDouble(json['host_fee_amount']),
      publicHostFeeAmount: publicFeeRaw is num ? publicFeeRaw.toDouble() : null,
      hostFeeCurrency: (json['host_fee_currency'] as String?)?.trim() ?? '',
      allowedFormatIds: allowed is List
          ? allowed.map((e) => e.toString()).where((s) => s.isNotEmpty).toList()
          : const [],
      label: (json['label'] as String?)?.trim() ?? '',
    );
  }
}

class EventsCatalog {
  const EventsCatalog({
    required this.formats,
    required this.sizes,
    required this.autoApproveDefault,
    this.forceAutoApprove = false,
    this.hostedEventsEnabled,
    this.publicEventsEnabled = false,
    this.defaultVisibility = '',
    this.reportReasonCodes = const [],
    this.reportReasonLabels = const {},
    this.hostedEventVisibilities = const [],
    this.hostedEventPublicVisibility = '',
    this.hostedEventPrivateVisibility = '',
    this.hostedEventPhaseKnockout = '',
    this.hostedEventPhaseRoundRobin = '',
    this.hostedEventPhaseSwiss = '',
    this.hostedEventPhaseGroup = '',
    this.hostedEventEntryPending = '',
    this.hostedEventEntryApproved = '',
    this.hostedEventEntryRejected = '',
    this.hostedEventEntryKicked = '',
    this.entryFeeCommissionPercent,
    this.publicHostFeeMultiplier,
    this.minPlayersToStart = const {},
    this.sharePathTemplate = '',
    this.hostedEventDefaultStatus = '',
    this.publicEventMatchesRated = false,
    this.prizePoolDisplayEnabled = false,
    this.prizePoolGuaranteeEnabled = false,
    this.hostedEventArenaFormat = '',
    this.swissRoundsByMaxPlayers = const {},
  });

  final List<EventsCatalogFormat> formats;
  final List<EventsCatalogSize> sizes;
  final bool autoApproveDefault;
  final bool forceAutoApprove;

  /// Null when catalog omitted the key (legacy API). False = Community/Host gated off.
  final bool? hostedEventsEnabled;
  final bool publicEventsEnabled;
  final String defaultVisibility;

  /// Status that allows title PATCH (from client_enums via catalog).
  final String hostedEventDefaultStatus;
  final bool publicEventMatchesRated;
  final List<String> reportReasonCodes;
  final Map<String, String> reportReasonLabels;
  final List<String> hostedEventVisibilities;
  final String hostedEventPublicVisibility;
  final String hostedEventPrivateVisibility;
  final String hostedEventPhaseKnockout;
  final String hostedEventPhaseRoundRobin;
  final String hostedEventPhaseSwiss;
  final String hostedEventPhaseGroup;
  final String hostedEventEntryPending;
  final String hostedEventEntryApproved;
  final String hostedEventEntryRejected;
  final String hostedEventEntryKicked;

  /// Null when catalog omitted (never invent 0).
  final double? entryFeeCommissionPercent;

  /// From catalog; informational. Prefer size.publicHostFeeAmount for display.
  final double? publicHostFeeMultiplier;
  final Map<String, int> minPlayersToStart;
  final String sharePathTemplate;
  final bool prizePoolDisplayEnabled;
  final bool prizePoolGuaranteeEnabled;
  final String hostedEventArenaFormat;

  /// DB classic seat table; used to label Unlimited / high safety ceilings.
  final Map<String, int> swissRoundsByMaxPlayers;

  /// Host fee for create UI: private uses base; public uses server public_host_fee_amount.
  /// Null when fee is missing from catalog (caller must fail closed).
  double? effectiveHostFee(EventsCatalogSize size, String visibility) {
    final pub = hostedEventPublicVisibility.trim();
    if (pub.isNotEmpty && visibility == pub) return size.publicHostFeeAmount;
    return size.hostFeeAmount;
  }

  factory EventsCatalog.fromJson(Map<String, dynamic> json) {
    double? asDouble(dynamic v) => v is num ? v.toDouble() : null;
    final minRaw = json['min_players_to_start'];
    final minMap = <String, int>{};
    if (minRaw is Map) {
      for (final e in minRaw.entries) {
        final v = e.value;
        if (v is num) minMap[e.key.toString()] = v.toInt();
      }
    }
    final reasons = json['report_reason_codes'];
    final reasonLabelsRaw = json['report_reason_labels'];
    final reasonLabels = <String, String>{};
    if (reasonLabelsRaw is Map) {
      for (final e in reasonLabelsRaw.entries) {
        final k = e.key.toString().trim();
        final v = e.value.toString().trim();
        if (k.isNotEmpty && v.isNotEmpty) reasonLabels[k] = v;
      }
    }
    final vis = json['hosted_event_visibilities'];
    final swissRaw = json['swiss_rounds_by_max_players'];
    final swissMap = <String, int>{};
    if (swissRaw is Map) {
      for (final e in swissRaw.entries) {
        final v = e.value;
        if (v is num) swissMap[e.key.toString()] = v.toInt();
      }
    }
    return EventsCatalog(
      formats: (json['formats'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(EventsCatalogFormat.fromJson)
          .where((f) => f.id.isNotEmpty && f.label.isNotEmpty)
          .toList(),
      sizes: (json['sizes'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(EventsCatalogSize.fromJson)
          .where((s) => s.id.isNotEmpty && s.label.isNotEmpty)
          .toList(),
      autoApproveDefault: json['auto_approve_default'] == true ||
          json['force_auto_approve'] == true,
      forceAutoApprove: json['force_auto_approve'] == true,
      hostedEventsEnabled: json.containsKey('hosted_events_enabled')
          ? json['hosted_events_enabled'] == true
          : null,
      publicEventsEnabled: json['public_events_enabled'] == true,
      defaultVisibility: (json['default_visibility'] as String?)?.trim() ?? '',
      reportReasonCodes: reasons is List
          ? reasons.map((e) => e.toString()).where((s) => s.isNotEmpty).toList()
          : const [],
      reportReasonLabels: reasonLabels,
      hostedEventVisibilities: vis is List
          ? vis.map((e) => e.toString()).where((s) => s.isNotEmpty).toList()
          : const [],
      hostedEventPublicVisibility:
          (json['hosted_event_public_visibility'] as String?)?.trim() ?? '',
      hostedEventPrivateVisibility:
          (json['hosted_event_private_visibility'] as String?)?.trim() ?? '',
      hostedEventPhaseKnockout:
          (json['hosted_event_phase_knockout'] as String?)?.trim() ?? '',
      hostedEventPhaseRoundRobin:
          (json['hosted_event_phase_round_robin'] as String?)?.trim() ?? '',
      hostedEventPhaseSwiss:
          (json['hosted_event_phase_swiss'] as String?)?.trim() ?? '',
      hostedEventPhaseGroup:
          (json['hosted_event_phase_group'] as String?)?.trim() ?? '',
      hostedEventEntryPending:
          (json['hosted_event_entry_pending'] as String?)?.trim() ?? '',
      hostedEventEntryApproved:
          (json['hosted_event_entry_approved'] as String?)?.trim() ?? '',
      hostedEventEntryRejected:
          (json['hosted_event_entry_rejected'] as String?)?.trim() ?? '',
      hostedEventEntryKicked:
          (json['hosted_event_entry_kicked'] as String?)?.trim() ?? '',
      entryFeeCommissionPercent: asDouble(json['entry_fee_commission_percent']),
      publicHostFeeMultiplier: asDouble(json['public_host_fee_multiplier']),
      minPlayersToStart: minMap,
      sharePathTemplate: (json['share_path_template'] as String?)?.trim() ?? '',
      hostedEventDefaultStatus:
          (json['hosted_event_default_status'] as String?)?.trim() ?? '',
      publicEventMatchesRated: json['public_event_matches_rated'] == true,
      prizePoolDisplayEnabled: json['prize_pool_display_enabled'] == true,
      prizePoolGuaranteeEnabled: json['prize_pool_guarantee_enabled'] == true,
      hostedEventArenaFormat:
          (json['hosted_event_arena_format'] as String?)?.trim() ?? '',
      swissRoundsByMaxPlayers: swissMap,
    );
  }
}

/// Null Unlimited or high safety ceiling above the DB classic seat table.
bool sizeIsUnlimitedMode(int? maxPlayers, Map<String, int> swissRoundsByMax) {
  // Present but under 2 is invalid, not Unlimited.
  if (maxPlayers == null) return true;
  if (maxPlayers < 2) return false;
  var ceiling = 0;
  for (final key in swissRoundsByMax.keys) {
    final n = int.tryParse(key.trim());
    if (n != null && n >= 2 && n > ceiling) ceiling = n;
  }
  if (ceiling < 2) return false;
  return maxPlayers > ceiling;
}

/// Organizer display: Unlimited for null/high; high also shows (N).
String formatSeatCapDisplay(
  int? maxPlayers,
  Map<String, int> swissRoundsByMax,
  String unlimitedLabel,
  String empty,
) {
  final unlimLabel =
      unlimitedLabel.trim().isNotEmpty ? unlimitedLabel.trim() : empty;
  final capped = (maxPlayers != null && maxPlayers >= 2) ? maxPlayers : null;
  if (sizeIsUnlimitedMode(maxPlayers, swissRoundsByMax)) {
    return capped != null ? '$unlimLabel ($capped)' : unlimLabel;
  }
  if (capped != null) return '$capped';
  if (maxPlayers != null) return '$maxPlayers';
  return empty;
}

/// Player fill right side: API seat_cap_unlimited or null max → Unlimited label.
String? seatCapFillRight(
  int? maxPlayers,
  bool seatCapUnlimited,
  String unlimitedLabel,
) {
  final unlimited = unlimitedLabel.trim();
  final capped = (maxPlayers != null && maxPlayers >= 2) ? maxPlayers : null;
  if (seatCapUnlimited) {
    return unlimited.isNotEmpty ? unlimited : null;
  }
  if (maxPlayers == null) {
    return unlimited.isNotEmpty ? unlimited : null;
  }
  if (capped != null) return '$capped';
  // Present but under 2: never invent Unlimited label.
  return '$maxPlayers';
}

class HostedEvent {
  const HostedEvent({
    required this.id,
    required this.organizerId,
    required this.title,
    required this.formatId,
    this.formatLabel = '',
    required this.sizeId,
    this.sizeLabel = '',
    this.maxPlayers,
    this.seatCapUnlimited = false,
    this.hostFeeAmount,
    required this.hostFeeCurrency,
    this.entryFeeAmount,
    required this.entryFeeCurrency,
    this.entryFeeCommissionPercent,
    required this.isFreeEntry,
    required this.autoApprove,
    required this.joinCode,
    required this.status,
    this.statusLabel = '',
    this.visibility = '',
    this.visibilityLabel = '',
    this.approvedCount,
    this.pendingCount,
    this.description = '',
    this.prizeImageUrl,
    this.gallery = const [],
    this.logoUrl,
    this.brandColor,
    this.sponsorLogoUrl,
    this.sponsorName,
    this.winnerId,
    this.shareUrl,
    this.startedAt,
    this.liveGameId,
    this.finishedAt,
    this.arenaEndsAt,
    this.cancelledAt,
    this.checkInOpensAt,
    this.checkInClosesAt,
    this.prizeSettledAt,
    this.disputeWindowEndsAt,
    this.createdAt,
    this.prizePoolDisplayEnabled = false,
    this.prizePoolGuaranteeEnabled = false,
    this.prizePoolGuaranteeAmount,
    this.prizePoolGuaranteeHeld = false,
    this.prizePoolGuaranteeCaptured = false,
    this.prizePoolNow,
    this.prizePoolIfFull,
    this.prizePoolFrozen = false,
    this.prizePoolCurrency = '',
    this.prizePayoutMode = '',
    this.prizePlacePercents = const {},
    this.organizerUsername = '',
    this.organizerAvatarUrl = '',
    this.organizerRating,
    this.organizerHostTrustTier = '',
    this.organizerHostTrustBadge = '',
    this.organizerFinishedPaidCups,
    this.organizerCancelledPaidCups,
    this.organizerOpenReports,
    this.viewerArenaQueued = false,
  });

  final String id;
  final String organizerId;
  final String title;
  final String formatId;
  final String formatLabel;
  final String sizeId;
  final String sizeLabel;

  /// Null when API omitted (UI uses chrome empty_value; never invent 0).
  final int? maxPlayers;

  /// API seat_cap_unlimited: null Unlimited or high Arena safety ceiling.
  final bool seatCapUnlimited;
  final double? hostFeeAmount;
  final String hostFeeCurrency;
  final double? entryFeeAmount;
  final String entryFeeCurrency;
  final double? entryFeeCommissionPercent;
  final bool isFreeEntry;
  final bool autoApprove;
  final String visibility;

  /// DB label from hosted_event_visibility_labels; empty → chrome emptyValue.
  final String visibilityLabel;
  final String joinCode;
  final String status;

  /// DB label from hosted_event_status_labels; empty → chrome emptyValue.
  final String statusLabel;
  final int? approvedCount;
  final int? pendingCount;
  final String description;
  final String? prizeImageUrl;
  final List<String> gallery;
  final String? logoUrl;
  final String? brandColor;
  final String? sponsorLogoUrl;
  final String? sponsorName;
  final String? winnerId;
  final String? shareUrl;
  final String? startedAt;

  /// Unfinished live bracket board - Watch deep-link (omit when none).
  final String? liveGameId;
  final String? finishedAt;
  final String? arenaEndsAt;
  final String? cancelledAt;
  final String? checkInOpensAt;
  final String? checkInClosesAt;
  final String? prizeSettledAt;
  final String? disputeWindowEndsAt;
  final String? createdAt;
  final bool prizePoolDisplayEnabled;
  final bool prizePoolGuaranteeEnabled;
  final double? prizePoolGuaranteeAmount;
  final bool prizePoolGuaranteeHeld;
  final bool prizePoolGuaranteeCaptured;
  final double? prizePoolNow;
  final double? prizePoolIfFull;
  final bool prizePoolFrozen;
  final String prizePoolCurrency;
  final String prizePayoutMode;
  final Map<String, dynamic> prizePlacePercents;

  /// Public host card from MapOrganizerPublicCards (omit when API skipped).
  final String organizerUsername;
  final String organizerAvatarUrl;

  /// Null when API omitted rating (never invent 0).
  final int? organizerRating;

  /// DB-driven host trust tier code + server-resolved badge label.
  final String organizerHostTrustTier;
  final String organizerHostTrustBadge;
  final int? organizerFinishedPaidCups;
  final int? organizerCancelledPaidCups;
  final int? organizerOpenReports;
  final bool viewerArenaQueued;

  /// prize_image_url, gallery (deduped), then logo/sponsor when prize media empty.
  List<String> get carouselImages {
    final out = <String>[];
    final prize = (prizeImageUrl ?? '').trim();
    if (prize.isNotEmpty) out.add(prize);
    for (final url in gallery) {
      final u = url.trim();
      if (u.isNotEmpty && !out.contains(u)) out.add(u);
    }
    if (out.isEmpty) {
      final logo = (logoUrl ?? '').trim();
      if (logo.isNotEmpty) out.add(logo);
      final sponsor = (sponsorLogoUrl ?? '').trim();
      if (sponsor.isNotEmpty && !out.contains(sponsor)) out.add(sponsor);
    }
    return out;
  }

  factory HostedEvent.fromJson(Map<String, dynamic> json) {
    int? asInt(dynamic v) => v is num ? v.toInt() : null;
    double? asDouble(dynamic v) => v is num ? v.toDouble() : null;
    return HostedEvent(
      id: json['id']?.toString() ?? '',
      organizerId: json['organizer_id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      formatId: json['format_id']?.toString() ?? '',
      formatLabel: (json['format_label'] as String?)?.trim() ?? '',
      sizeId: json['size_id']?.toString() ?? '',
      sizeLabel: (json['size_label'] as String?)?.trim() ?? '',
      maxPlayers: asInt(json['max_players']),
      seatCapUnlimited: json['seat_cap_unlimited'] == true,
      hostFeeAmount: asDouble(json['host_fee_amount']),
      hostFeeCurrency: (json['host_fee_currency'] as String?)?.trim() ?? '',
      entryFeeAmount: asDouble(json['entry_fee_amount']),
      entryFeeCurrency: (json['entry_fee_currency'] as String?)?.trim() ?? '',
      entryFeeCommissionPercent: asDouble(json['entry_fee_commission_percent']),
      isFreeEntry: json['is_free_entry'] == true,
      autoApprove: json['auto_approve'] == true,
      visibility: (json['visibility'] as String?)?.trim() ?? '',
      visibilityLabel: (json['visibility_label'] as String?)?.trim() ?? '',
      joinCode: json['join_code']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      statusLabel: (json['status_label'] as String?)?.trim() ?? '',
      approvedCount: asInt(json['approved_count']),
      pendingCount: asInt(json['pending_count']),
      description: (json['description'] as String?)?.trim() ?? '',
      prizeImageUrl: (json['prize_image_url'] as String?)?.trim(),
      gallery: json['gallery'] is List
          ? (json['gallery'] as List)
              .map((e) => e.toString())
              .where((s) => s.trim().isNotEmpty)
              .toList()
          : const <String>[],
      logoUrl: (json['logo_url'] as String?)?.trim(),
      brandColor: (json['brand_color'] as String?)?.trim(),
      sponsorLogoUrl: (json['sponsor_logo_url'] as String?)?.trim(),
      sponsorName: (json['sponsor_name'] as String?)?.trim(),
      winnerId: json['winner_id']?.toString(),
      shareUrl: (json['share_url'] as String?)?.trim(),
      startedAt: json['started_at']?.toString(),
      liveGameId: (json['live_game_id'] ?? json['liveGameId'])?.toString(),
      finishedAt: json['finished_at']?.toString(),
      arenaEndsAt: json['arena_ends_at']?.toString(),
      cancelledAt: json['cancelled_at']?.toString(),
      checkInOpensAt: json['check_in_opens_at']?.toString(),
      checkInClosesAt: json['check_in_closes_at']?.toString(),
      prizeSettledAt: json['prize_settled_at']?.toString(),
      disputeWindowEndsAt: json['dispute_window_ends_at']?.toString(),
      createdAt: json['created_at']?.toString(),
      prizePoolDisplayEnabled: json['prize_pool_display_enabled'] == true,
      prizePoolGuaranteeEnabled: json['prize_pool_guarantee_enabled'] == true,
      prizePoolGuaranteeAmount: asDouble(json['prize_pool_guarantee_amount']),
      prizePoolGuaranteeHeld: json['prize_pool_guarantee_held'] == true,
      prizePoolGuaranteeCaptured: json['prize_pool_guarantee_captured'] == true,
      prizePoolNow: asDouble(json['prize_pool_now']),
      prizePoolIfFull: asDouble(json['prize_pool_if_full']),
      prizePoolFrozen: json['prize_pool_frozen'] == true,
      prizePoolCurrency: (json['prize_pool_currency'] as String?)?.trim() ?? '',
      prizePayoutMode: (json['prize_payout_mode'] as String?)?.trim() ?? '',
      prizePlacePercents: json['prize_place_percents'] is Map<String, dynamic>
          ? Map<String, dynamic>.from(
              json['prize_place_percents'] as Map<String, dynamic>,
            )
          : const <String, dynamic>{},
      organizerUsername: (json['organizer_username'] as String?)?.trim() ?? '',
      organizerAvatarUrl:
          (json['organizer_avatar_url'] as String?)?.trim() ?? '',
      organizerRating: asInt(json['organizer_rating']),
      organizerHostTrustTier:
          (json['organizer_host_trust_tier'] as String?)?.trim() ?? '',
      organizerHostTrustBadge:
          (json['organizer_host_trust_badge'] as String?)?.trim() ?? '',
      organizerFinishedPaidCups: json['organizer_finished_paid_cups'] is num
          ? (json['organizer_finished_paid_cups'] as num).toInt()
          : null,
      organizerCancelledPaidCups: json['organizer_cancelled_paid_cups'] is num
          ? (json['organizer_cancelled_paid_cups'] as num).toInt()
          : null,
      organizerOpenReports: json['organizer_open_reports'] is num
          ? (json['organizer_open_reports'] as num).toInt()
          : null,
      viewerArenaQueued: json['viewer_arena_queued'] == true,
    );
  }
}

class HostedEventEntry {
  const HostedEventEntry({
    required this.id,
    required this.eventId,
    required this.userId,
    required this.status,
    this.statusLabel = '',
    this.username = '',
    this.rating,
    this.feePaid,
    this.platformCommission,
    this.organizerNet,
    this.feeCurrency = '',
    this.eliminated = false,
    this.placement,
    this.checkedInAt,
  });

  final String id;
  final String eventId;
  final String userId;
  final String status;

  /// DB label from hosted_event_entry_status_labels; empty → chrome emptyValue.
  final String statusLabel;
  final String username;

  /// Null when API omitted (omitempty); never invent 0.
  final int? rating;
  final double? feePaid;
  final double? platformCommission;
  final double? organizerNet;
  final String feeCurrency;
  final bool eliminated;
  final int? placement;
  final String? checkedInAt;

  factory HostedEventEntry.fromJson(Map<String, dynamic> json) {
    int? asInt(dynamic v) => v is num ? v.toInt() : null;
    double? asDouble(dynamic v) => v is num ? v.toDouble() : null;
    return HostedEventEntry(
      id: json['id']?.toString() ?? '',
      eventId: json['event_id']?.toString() ?? '',
      userId: json['user_id']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      statusLabel: (json['status_label'] as String?)?.trim() ?? '',
      username: (json['username'] as String?)?.trim() ?? '',
      rating: asInt(json['rating']),
      feePaid: asDouble(json['fee_paid']),
      platformCommission: asDouble(json['platform_commission']),
      organizerNet: asDouble(json['organizer_net']),
      feeCurrency: (json['fee_currency'] as String?)?.trim() ?? '',
      eliminated: json['eliminated'] == true,
      placement: asInt(json['placement']),
      checkedInAt: json['checked_in_at']?.toString(),
    );
  }
}

class HostedBracketMatch {
  const HostedBracketMatch({
    required this.id,
    required this.eventId,
    required this.roundIndex,
    required this.matchIndex,
    required this.status,
    this.phase = '',
    this.groupIndex = -1,
    this.statusLabel = '',
    this.playerAId,
    this.playerBId,
    this.winnerId,
    this.playerAUsername = '',
    this.playerBUsername = '',
    this.winnerUsername = '',
    this.gameId,
    this.isBye = false,
    this.playerAReadyAt,
    this.playerBReadyAt,
    this.finishedAt,
  });

  final String id;
  final String eventId;

  /// DB phase code; empty on legacy rows.
  final String phase;

  /// Group index within phase; -1 when not in a group stage.
  final int groupIndex;
  final int roundIndex;
  final int matchIndex;
  final String status;

  /// DB label from hosted_event_bracket_status_labels; empty → chrome emptyValue.
  final String statusLabel;
  final String? playerAId;
  final String? playerBId;
  final String? winnerId;
  final String playerAUsername;
  final String playerBUsername;
  final String winnerUsername;
  final String? gameId;
  final bool isBye;
  final String? playerAReadyAt;
  final String? playerBReadyAt;
  final String? finishedAt;

  factory HostedBracketMatch.fromJson(Map<String, dynamic> json) {
    return HostedBracketMatch(
      id: json['id']?.toString() ?? '',
      eventId: json['event_id']?.toString() ?? '',
      phase: (json['phase'] as String?)?.trim() ?? '',
      groupIndex: (json['group_index'] as num?)?.toInt() ?? -1,
      roundIndex: (json['round_index'] as num?)?.toInt() ?? 0,
      matchIndex: (json['match_index'] as num?)?.toInt() ?? 0,
      status: json['status']?.toString() ?? '',
      statusLabel: (json['status_label'] as String?)?.trim() ?? '',
      playerAId: json['player_a_id']?.toString(),
      playerBId: json['player_b_id']?.toString(),
      winnerId: json['winner_id']?.toString(),
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

/// Computed standings from GET /events/{id}/standings.
class HostedStandingRow {
  const HostedStandingRow({
    required this.userId,
    required this.played,
    required this.wins,
    required this.losses,
    required this.points,
    this.username = '',
    this.groupIndex = -1,
    this.placement,
  });

  final String userId;
  final String username;
  final int played;
  final int wins;
  final int losses;
  final int points;
  final int groupIndex;
  final int? placement;

  factory HostedStandingRow.fromJson(Map<String, dynamic> json) {
    return HostedStandingRow(
      userId: json['user_id']?.toString() ?? '',
      username: (json['username'] as String?)?.trim() ?? '',
      played: (json['played'] as num?)?.toInt() ?? 0,
      wins: (json['wins'] as num?)?.toInt() ?? 0,
      losses: (json['losses'] as num?)?.toInt() ?? 0,
      points: (json['points'] as num?)?.toInt() ?? 0,
      groupIndex: (json['group_index'] as num?)?.toInt() ?? -1,
      placement: (json['placement'] as num?)?.toInt(),
    );
  }
}

class EventsDashboardStats {
  const EventsDashboardStats({
    this.activeCount,
    this.upcomingCount,
    this.playersJoinedThisWeek,
    this.officiallyPausedCount,
    this.officialPauseAvgSeconds,
    this.hostFeeRevenueSum,
    this.hostFeeCurrency = '',
    this.entryFeeNetSum,
    this.entryFeeGrossSum,
    this.entryFeeCommissionSum,
    this.entryFeeCurrency = '',
    this.hostTrustTier = '',
    this.hostTrustBadge = '',
    this.hostFinishedPaidCups,
    this.hostCancelledPaidCups,
    this.hostOpenReports,
    this.lastEventId,
    this.lastEventJoinCode,
    this.lastEventShareUrl,
  });

  /// Null when API omitted the field (UI uses chrome empty_value; never invent 0).
  final int? activeCount;
  final int? upcomingCount;
  final int? playersJoinedThisWeek;
  final int? officiallyPausedCount;
  final int? officialPauseAvgSeconds;
  final double? hostFeeRevenueSum;
  final String hostFeeCurrency;
  final double? entryFeeNetSum;
  final double? entryFeeGrossSum;
  final double? entryFeeCommissionSum;
  final String entryFeeCurrency;
  final String hostTrustTier;
  final String hostTrustBadge;
  final int? hostFinishedPaidCups;
  final int? hostCancelledPaidCups;
  final int? hostOpenReports;
  final String? lastEventId;
  final String? lastEventJoinCode;
  final String? lastEventShareUrl;

  factory EventsDashboardStats.fromJson(Map<String, dynamic> json) {
    int? asInt(dynamic v) => v is num ? v.toInt() : null;
    double? asDouble(dynamic v) => v is num ? v.toDouble() : null;
    final netRaw = json['entry_fee_net_sum'] ?? json['entry_fee_revenue_sum'];
    return EventsDashboardStats(
      activeCount: asInt(json['active_count']),
      upcomingCount: asInt(json['upcoming_count']),
      playersJoinedThisWeek: asInt(json['players_joined_this_week']),
      officiallyPausedCount: asInt(json['officially_paused_count']),
      officialPauseAvgSeconds: asInt(json['official_pause_avg_seconds']),
      hostFeeRevenueSum: asDouble(json['host_fee_revenue_sum']),
      hostFeeCurrency: (json['host_fee_currency'] as String?)?.trim() ?? '',
      entryFeeNetSum: asDouble(netRaw),
      entryFeeGrossSum: asDouble(json['entry_fee_gross_sum']),
      entryFeeCommissionSum: asDouble(json['entry_fee_commission_sum']),
      entryFeeCurrency: (json['entry_fee_currency'] as String?)?.trim() ?? '',
      hostTrustTier: (json['host_trust_tier'] as String?)?.trim() ?? '',
      hostTrustBadge: (json['host_trust_badge'] as String?)?.trim() ?? '',
      hostFinishedPaidCups: asInt(json['host_finished_paid_cups']),
      hostCancelledPaidCups: asInt(json['host_cancelled_paid_cups']),
      hostOpenReports: asInt(json['host_open_reports']),
      lastEventId: json['last_event_id']?.toString(),
      lastEventJoinCode: json['last_event_join_code']?.toString(),
      lastEventShareUrl: (json['last_event_share_url'] as String?)?.trim(),
    );
  }
}

class EventsAnalyticsRow {
  const EventsAnalyticsRow({
    required this.eventId,
    required this.title,
    required this.status,
    this.statusLabel = '',
    required this.joinCode,
    this.playersJoined,
    required this.started,
    required this.finished,
    this.hostFee,
    this.hostFeeCurrency = '',
    this.entryFeesSum,
    this.entryCommissionSum,
    this.entryNetSum,
    this.entryFeeCurrency = '',
    this.shareUrl,
  });

  final String eventId;
  final String title;
  final String status;
  final String statusLabel;
  final String joinCode;
  final int? playersJoined;
  final bool started;
  final bool finished;
  final double? hostFee;
  final String hostFeeCurrency;
  final double? entryFeesSum;
  final double? entryCommissionSum;
  final double? entryNetSum;
  final String entryFeeCurrency;
  final String? shareUrl;

  factory EventsAnalyticsRow.fromJson(Map<String, dynamic> json) {
    int? asInt(dynamic v) => v is num ? v.toInt() : null;
    double? asDouble(dynamic v) => v is num ? v.toDouble() : null;
    return EventsAnalyticsRow(
      eventId: json['event_id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      statusLabel: (json['status_label'] as String?)?.trim() ?? '',
      joinCode: json['join_code']?.toString() ?? '',
      playersJoined: asInt(json['players_joined']),
      started: json['started'] == true,
      finished: json['finished'] == true,
      hostFee: asDouble(json['host_fee']),
      hostFeeCurrency: (json['host_fee_currency'] as String?)?.trim() ?? '',
      entryFeesSum: asDouble(json['entry_fees_sum']),
      entryCommissionSum: asDouble(json['entry_commission_sum']),
      entryNetSum: asDouble(json['entry_net_sum']),
      entryFeeCurrency: (json['entry_fee_currency'] as String?)?.trim() ?? '',
      shareUrl: (json['share_url'] as String?)?.trim(),
    );
  }
}

class EventsAnalyticsTotals {
  const EventsAnalyticsTotals({
    this.playersJoined,
    this.eventsStarted,
    this.eventsFinished,
    this.hostFeeSum,
    this.hostFeeCurrency = '',
    this.entryFeesSum,
    this.entryCommissionSum,
    this.entryNetSum,
    this.entryFeeCurrency = '',
  });

  final int? playersJoined;
  final int? eventsStarted;
  final int? eventsFinished;
  final double? hostFeeSum;
  final String hostFeeCurrency;
  final double? entryFeesSum;
  final double? entryCommissionSum;
  final double? entryNetSum;
  final String entryFeeCurrency;

  factory EventsAnalyticsTotals.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const EventsAnalyticsTotals();
    }
    int? asInt(dynamic v) => v is num ? v.toInt() : null;
    double? asDouble(dynamic v) => v is num ? v.toDouble() : null;
    return EventsAnalyticsTotals(
      playersJoined: asInt(json['players_joined']),
      eventsStarted: asInt(json['events_started']),
      eventsFinished: asInt(json['events_finished']),
      hostFeeSum: asDouble(json['host_fee_sum']),
      hostFeeCurrency: (json['host_fee_currency'] as String?)?.trim() ?? '',
      entryFeesSum: asDouble(json['entry_fees_sum']),
      entryCommissionSum: asDouble(json['entry_commission_sum']),
      entryNetSum: asDouble(json['entry_net_sum']),
      entryFeeCurrency: (json['entry_fee_currency'] as String?)?.trim() ?? '',
    );
  }
}

class EventsAnalyticsPayload {
  const EventsAnalyticsPayload({
    required this.events,
    required this.totals,
    this.shareClicksTracked = false,
  });

  final List<EventsAnalyticsRow> events;
  final EventsAnalyticsTotals totals;
  final bool shareClicksTracked;

  factory EventsAnalyticsPayload.fromJson(Map<String, dynamic> json) {
    return EventsAnalyticsPayload(
      events: (json['events'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(EventsAnalyticsRow.fromJson)
          .where((e) => e.eventId.isNotEmpty)
          .toList(),
      totals: EventsAnalyticsTotals.fromJson(
        json['totals'] is Map<String, dynamic>
            ? json['totals'] as Map<String, dynamic>
            : null,
      ),
      shareClicksTracked: json['share_clicks_tracked'] == true,
    );
  }
}
