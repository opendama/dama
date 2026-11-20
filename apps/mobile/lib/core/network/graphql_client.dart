import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/network/session_bounce.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:http/http.dart' as http;

/// Typed API client for dashboards and profiles.
/// Documents mirror lib/graphql/operations.graphql; types mirror schema.graphql.
class GraphqlClient {
  GraphqlClient({ApiConfig? config, this.accessToken})
      : config = config ?? ApiConfig.defaults;

  final ApiConfig config;
  final String? accessToken;

  Future<Map<String, dynamic>> query(
    String document, {
    Map<String, dynamic>? variables,
  }) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      if (accessToken != null && accessToken!.isNotEmpty)
        'Authorization': 'Bearer $accessToken',
    };
    final hadToken = accessToken != null && accessToken!.isNotEmpty;
    final res = await http.post(
      Uri.parse(config.graphqlUrl),
      headers: headers,
      body: jsonEncode({
        'query': document,
        if (variables != null) 'variables': variables,
      }),
    );
    if (res.statusCode == 401 && hadToken) {
      await bounceOnUnauthorized(hadToken: true);
      throw Exception('unauthorized');
    }
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    if (body['errors'] is List && (body['errors'] as List).isNotEmpty) {
      final msgs = (body['errors'] as List)
          .map((e) => e is Map ? (e['message']?.toString() ?? '') : '')
          .join('; ');
      if (hadToken &&
          RegExp(r'unauthorized|unauthenticated', caseSensitive: false)
              .hasMatch(msgs)) {
        await bounceOnUnauthorized(hadToken: true);
      }
      throw Exception(msgs.isNotEmpty ? msgs : 'Request failed');
    }
    final data = body['data'];
    if (data is Map<String, dynamic>) return data;
    throw Exception('Empty API response');
  }

  Future<GPlayer?> fetchMe() async {
    final data = await query(meQuery);
    final me = data['me'];
    if (me is Map<String, dynamic>) return GPlayer.fromJson(me);
    return null;
  }

  Future<GFeatureFlags> fetchFeatureFlags() async {
    final data = await query(featureFlagsQuery);
    final flags = data['featureFlags'];
    if (flags is Map<String, dynamic>) return GFeatureFlags.fromJson(flags);
    throw Exception('featureFlags missing from API');
  }

  Future<List<GTournament>> fetchTournaments() async {
    final data = await query(tournamentsQuery);
    final list = data['tournaments'] as List<dynamic>? ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(GTournament.fromJson)
        .toList();
  }
}

const String meQuery = r'''
  query Me {
    me {
      id
      username
      role
      rating
      xp
      wins
      losses
      draws
      avatarThumbUrl
      avatarFullUrl
      online
      region
      countryCode
      levelLabel
      hostTrustTier
      hostTrustBadge
      hostFinishedPaidCups
      hostCancelledPaidCups
      hostOpenReports
      recentMatches {
        id
        mode
        isDraw
        moveCount
        isFree
        finishedAt
      }
    }
  }
''';

const String leaderboardQuery = r'''
  query Leaderboard($limit: Int) {
    leaderboard(limit: $limit) {
      id
      username
      rating
      xp
      wins
      losses
      online
      regionalRank
      regionLabel
      levelLabel
      avatarThumbUrl
      countryCode
      hostTrustTier
      hostTrustBadge
    }
  }
''';

const String featureFlagsQuery = r'''
  query FeatureFlags {
    featureFlags {
      vsAiEnabled
      otpRequired
      cashRmgEnabled
      cashPhoneKycRequired
      cashPhoneOtpRequired
      cashRmgDisabledCountries
      hostedEventsEnabled
      publicEventsEnabled
      publicEventMatchesRated
      prizePoolDisplayEnabled
      prizePoolGuaranteeEnabled
      kycAutoApprove
      aiDepths
    }
  }
''';

const String tournamentsQuery = r'''
  query Tournaments {
    tournaments {
      id
      title
      description
      isFree
      entryFeeAmount
      entryFeeCurrency
      prizePoolAmount
      prizePoolCurrency
      prizeImageUrl
      gallery
      playersCount
      status
      prizePoolDisplayEnabled
      prizePoolNow
      prizePoolIfFull
      prizePoolGuaranteeAmount
      prizePoolFrozen
      maxPlayers
      seatCapUnlimited
    }
  }
''';

const String publisherDashboardQuery = r'''
  query PublisherDashboard {
    publisherDashboard {
      me {
        id
        username
      }
      campaigns {
        id
        title
        status
        statusLabel
        impressions
        clicks
        uniqueReach
        videoCompletions
        creativeUrl
        thumbnailUrl
        gallery
      }
      totalImpressions
      totalClicks
      totalUniqueReach
      totalVideoCompletions
      ctrPercent
      cpc
      cpcCurrency
      completionPercent
      createFeeSpendSum
      createFeeSpendCurrency
    }
  }
''';

extension PublisherDashboardClient on GraphqlClient {
  Future<GPublisherDashboard> fetchPublisherDashboard() async {
    final data = await query(publisherDashboardQuery);
    final dash = data['publisherDashboard'];
    if (dash is Map<String, dynamic>) {
      return GPublisherDashboard.fromJson(dash);
    }
    throw Exception('publisherDashboard missing from API');
  }
}
