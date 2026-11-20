export 'package:dama_mobile/graphql/schema_types.dart'
    show GAdCampaign, GPublisherDashboard;

/// Viewport creative fields on campaign list/detail and served payloads.
class ViewportCreativeSource {
  const ViewportCreativeSource({
    this.creativeUrl,
    this.videoId,
    this.creativeDesktopUrl,
    this.creativeTabletUrl,
    this.creativeMobileUrl,
    this.videoIdDesktop,
    this.videoIdTablet,
    this.videoIdMobile,
  });

  final String? creativeUrl;
  final String? videoId;
  final String? creativeDesktopUrl;
  final String? creativeTabletUrl;
  final String? creativeMobileUrl;
  final String? videoIdDesktop;
  final String? videoIdTablet;
  final String? videoIdMobile;
}

/// Geo-targeted ad row from `GET /ads/serve`.
class ServedAdCampaign {
  const ServedAdCampaign({
    required this.id,
    this.title,
    this.creativeUrl,
    this.videoId,
    this.creativeDesktopUrl,
    this.creativeTabletUrl,
    this.creativeMobileUrl,
    this.videoIdDesktop,
    this.videoIdTablet,
    this.videoIdMobile,
  });

  final String id;
  final String? title;
  final String? creativeUrl;
  final String? videoId;
  final String? creativeDesktopUrl;
  final String? creativeTabletUrl;
  final String? creativeMobileUrl;
  final String? videoIdDesktop;
  final String? videoIdTablet;
  final String? videoIdMobile;

  factory ServedAdCampaign.fromJson(Map<String, dynamic> json) {
    return ServedAdCampaign(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString(),
      creativeUrl: json['creative_url']?.toString(),
      videoId: json['video_id']?.toString(),
      creativeDesktopUrl: json['creative_desktop_url']?.toString(),
      creativeTabletUrl: json['creative_tablet_url']?.toString(),
      creativeMobileUrl: json['creative_mobile_url']?.toString(),
      videoIdDesktop: json['video_id_desktop']?.toString(),
      videoIdTablet: json['video_id_tablet']?.toString(),
      videoIdMobile: json['video_id_mobile']?.toString(),
    );
  }
}

class AdsServeResponse {
  const AdsServeResponse({this.campaigns = const []});

  final List<ServedAdCampaign> campaigns;

  ServedAdCampaign? get firstOrNull =>
      campaigns.isEmpty ? null : campaigns.first;

  factory AdsServeResponse.fromJson(Map<String, dynamic> json) {
    final list = json['campaigns'] as List<dynamic>? ?? [];
    return AdsServeResponse(
      campaigns: list
          .whereType<Map<String, dynamic>>()
          .map(ServedAdCampaign.fromJson)
          .where((c) => c.id.isNotEmpty)
          .toList(),
    );
  }
}
