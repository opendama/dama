import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/types/ads.dart';

enum ViewportCreativeSlot { desktop, tablet, mobile }

class ViewportBreakpoints {
  const ViewportBreakpoints({
    required this.mobileMax,
    required this.tabletMax,
  });

  final int mobileMax;
  final int tabletMax;
}

class PickedViewportCreative {
  const PickedViewportCreative({
    required this.imageUrl,
    required this.videoId,
    required this.usedSlot,
    required this.requestedSlot,
  });

  final String imageUrl;
  final String videoId;
  final Object usedSlot;
  final ViewportCreativeSlot requestedSlot;
}

String _trim(String? v) => (v ?? '').trim();

bool isStubVideoId(String id) => id.startsWith('stub_');

/// Requires DB breakpoints from [parseViewportBreakpoints]. Do not invent defaults.
ViewportCreativeSlot resolveViewportSlot(
  double width,
  ViewportBreakpoints breakpoints,
) {
  if (width <= breakpoints.mobileMax) return ViewportCreativeSlot.mobile;
  if (width <= breakpoints.tabletMax) return ViewportCreativeSlot.tablet;
  return ViewportCreativeSlot.desktop;
}

ViewportBreakpoints? parseViewportBreakpoints(Map<String, String> chrome) {
  final mobileMax =
      int.tryParse((chrome['viewport_breakpoint_mobile_max'] ?? '').trim());
  final tabletMax =
      int.tryParse((chrome['viewport_breakpoint_tablet_max'] ?? '').trim());
  if (mobileMax == null ||
      mobileMax < 1 ||
      tabletMax == null ||
      tabletMax <= mobileMax) {
    return null;
  }
  return ViewportBreakpoints(mobileMax: mobileMax, tabletMax: tabletMax);
}

({String imageUrl, String videoId}) _slotPair(
  ViewportCreativeSource source,
  ViewportCreativeSlot slot,
) {
  switch (slot) {
    case ViewportCreativeSlot.desktop:
      return (
        imageUrl: _trim(source.creativeDesktopUrl),
        videoId: _trim(source.videoIdDesktop),
      );
    case ViewportCreativeSlot.tablet:
      return (
        imageUrl: _trim(source.creativeTabletUrl),
        videoId: _trim(source.videoIdTablet),
      );
    case ViewportCreativeSlot.mobile:
      return (
        imageUrl: _trim(source.creativeMobileUrl),
        videoId: _trim(source.videoIdMobile),
      );
  }
}

bool _hasAnyViewportCreative(ViewportCreativeSource campaign) {
  for (final slot in ViewportCreativeSlot.values) {
    final pair = _slotPair(campaign, slot);
    if (pair.imageUrl.isNotEmpty || pair.videoId.isNotEmpty) return true;
  }
  return false;
}

/// Exact slot only. Legacy only when no viewport slot is filled.
PickedViewportCreative pickCampaignCreative(
  ViewportCreativeSource? campaign,
  ViewportCreativeSlot slot,
) {
  if (campaign == null) {
    return PickedViewportCreative(
      imageUrl: '',
      videoId: '',
      usedSlot: '',
      requestedSlot: slot,
    );
  }
  final exact = _slotPair(campaign, slot);
  if (exact.imageUrl.isNotEmpty || exact.videoId.isNotEmpty) {
    return PickedViewportCreative(
      imageUrl: exact.imageUrl,
      videoId: exact.videoId,
      usedSlot: slot,
      requestedSlot: slot,
    );
  }
  if (_hasAnyViewportCreative(campaign)) {
    return PickedViewportCreative(
      imageUrl: '',
      videoId: '',
      usedSlot: '',
      requestedSlot: slot,
    );
  }
  final legacyImg = _trim(campaign.creativeUrl);
  final legacyVid = _trim(campaign.videoId);
  if (legacyImg.isNotEmpty || legacyVid.isNotEmpty) {
    return PickedViewportCreative(
      imageUrl: legacyImg,
      videoId: legacyVid,
      usedSlot: 'legacy',
      requestedSlot: slot,
    );
  }
  return PickedViewportCreative(
    imageUrl: '',
    videoId: '',
    usedSlot: '',
    requestedSlot: slot,
  );
}

ViewportCreativeSlot displayViewportSlot(
  Object usedSlot,
  ViewportCreativeSlot requested,
) {
  if (usedSlot is ViewportCreativeSlot) return usedSlot;
  return requested;
}

/// Aspect ratio from DB chrome label (e.g. "16:9"). Fail closed: null when invalid.
double? viewportAspectRatioFromLabel(String? ratioLabel) {
  final raw = (ratioLabel ?? '').trim().replaceAll(RegExp(r'\s+'), '');
  final parts = raw.contains(':') ? raw.split(':') : raw.split('/');
  if (parts.length != 2) return null;
  final w = int.tryParse(parts[0]);
  final h = int.tryParse(parts[1]);
  if (w == null || w < 1 || h == null || h < 1) return null;
  return w / h;
}

String viewportRatioLabelForSlot(
  Map<String, String>? chrome,
  ViewportCreativeSlot slot,
) {
  if (chrome == null) return '';
  switch (slot) {
    case ViewportCreativeSlot.desktop:
      return (chrome['viewport_desktop_ratio_label'] ?? '').trim();
    case ViewportCreativeSlot.tablet:
      return (chrome['viewport_tablet_ratio_label'] ?? '').trim();
    case ViewportCreativeSlot.mobile:
      return (chrome['viewport_mobile_ratio_label'] ?? '').trim();
  }
}

/// Web `resolvePublicMediaUrl` parity for campaign creative paths.
String resolvePublicMediaUrl(String raw) {
  final t = raw.trim();
  if (t.isEmpty) return '';
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  if (t.startsWith('/api/v1/media/')) {
    return '${ApiConfig.baseUrl}$t';
  }
  return t;
}

ViewportCreativeSource viewportSourceFromServed(ServedAdCampaign c) {
  return ViewportCreativeSource(
    creativeUrl: c.creativeUrl,
    videoId: c.videoId,
    creativeDesktopUrl: c.creativeDesktopUrl,
    creativeTabletUrl: c.creativeTabletUrl,
    creativeMobileUrl: c.creativeMobileUrl,
    videoIdDesktop: c.videoIdDesktop,
    videoIdTablet: c.videoIdTablet,
    videoIdMobile: c.videoIdMobile,
  );
}

ViewportCreativeSource viewportSourceFromCampaignJson(Map<String, dynamic> c) {
  return ViewportCreativeSource(
    creativeUrl: c['creative_url']?.toString(),
    videoId: c['video_id']?.toString(),
    creativeDesktopUrl: c['creative_desktop_url']?.toString(),
    creativeTabletUrl: c['creative_tablet_url']?.toString(),
    creativeMobileUrl: c['creative_mobile_url']?.toString(),
    videoIdDesktop: c['video_id_desktop']?.toString(),
    videoIdTablet: c['video_id_tablet']?.toString(),
    videoIdMobile: c['video_id_mobile']?.toString(),
  );
}
