import 'package:dama_mobile/core/ads/resolve_viewport_creative.dart';

const _viewportCreativesChromeKeys = [
  'viewport_creatives_title',
  'viewport_creatives_blurb',
  'viewport_desktop_label',
  'viewport_tablet_label',
  'viewport_mobile_label',
  'viewport_desktop_ratio_label',
  'viewport_tablet_ratio_label',
  'viewport_mobile_ratio_label',
  'viewport_desktop_hint',
  'viewport_tablet_hint',
  'viewport_mobile_hint',
  'viewport_upload_image_action',
  'viewport_upload_video_action',
  'viewport_replace_image_action',
  'viewport_clear_action',
  'viewport_preview_empty',
  'viewport_optional_badge',
  'viewport_video_badge',
  'viewport_image_badge',
  'viewport_breakpoint_mobile_max',
  'viewport_breakpoint_tablet_max',
  'viewport_aspect_tolerance',
  'viewport_max_video_bytes',
  'toast_viewport_creative_saved',
  'toast_viewport_creative_cleared',
  'toast_viewport_video_queued',
  'media_upload_failed',
];

/// Fail closed: per-viewport campaign creative upload chrome from schedule_chrome.
bool viewportCreativesChromeReady(Map<String, String> chrome) {
  for (final k in _viewportCreativesChromeKeys) {
    if ((chrome[k] ?? '').trim().isEmpty) return false;
  }
  if (viewportAspectRatioFromLabel(chrome['viewport_desktop_ratio_label']) ==
          null ||
      viewportAspectRatioFromLabel(chrome['viewport_tablet_ratio_label']) ==
          null ||
      viewportAspectRatioFromLabel(chrome['viewport_mobile_ratio_label']) ==
          null) {
    return false;
  }
  final mobileMax =
      int.tryParse((chrome['viewport_breakpoint_mobile_max'] ?? '').trim());
  final tabletMax =
      int.tryParse((chrome['viewport_breakpoint_tablet_max'] ?? '').trim());
  if (mobileMax == null ||
      mobileMax < 1 ||
      tabletMax == null ||
      tabletMax <= mobileMax) {
    return false;
  }
  final tol =
      double.tryParse((chrome['viewport_aspect_tolerance'] ?? '').trim());
  final maxBytes =
      int.tryParse((chrome['viewport_max_video_bytes'] ?? '').trim());
  if (tol == null || tol <= 0 || tol > 1) return false;
  if (maxBytes == null || maxBytes < 1) return false;
  return true;
}
