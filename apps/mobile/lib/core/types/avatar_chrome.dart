/// DB-backed avatar/profile upload chrome from GET /public/avatar-chrome.
class AvatarChrome {
  const AvatarChrome({
    required this.source,
    required this.unavailable,
    required this.pageTitle,
    required this.pageBlurb,
    required this.chooseUploadAction,
    required this.uploadAction,
    required this.uploadingAction,
    required this.uploadFailed,
    required this.toastUpdated,
    required this.tapInspectHint,
    required this.changePhotoAria,
    required this.profilePageTitle,
    required this.profileLoadFailed,
  });

  final String source;
  final String unavailable;
  final String pageTitle;
  final String pageBlurb;
  final String chooseUploadAction;
  final String uploadAction;
  final String uploadingAction;
  final String uploadFailed;
  final String toastUpdated;
  final String tapInspectHint;
  final String changePhotoAria;
  final String profilePageTitle;
  final String profileLoadFailed;

  bool get isReady =>
      source.isNotEmpty &&
      unavailable.isNotEmpty &&
      pageTitle.isNotEmpty &&
      pageBlurb.isNotEmpty &&
      chooseUploadAction.isNotEmpty &&
      uploadAction.isNotEmpty &&
      uploadingAction.isNotEmpty &&
      uploadFailed.isNotEmpty &&
      toastUpdated.isNotEmpty &&
      tapInspectHint.isNotEmpty &&
      changePhotoAria.isNotEmpty &&
      profilePageTitle.isNotEmpty &&
      profileLoadFailed.isNotEmpty;

  static AvatarChrome? fromJson(Map<String, dynamic>? map) {
    if (map == null) return null;
    String s(String k) => (map[k] as String?)?.trim() ?? '';
    final chrome = AvatarChrome(
      source: s('source'),
      unavailable: s('avatar_chrome_unavailable'),
      pageTitle: s('page_title'),
      pageBlurb: s('page_blurb'),
      chooseUploadAction: s('choose_upload_action'),
      uploadAction: s('upload_action'),
      uploadingAction: s('uploading_action'),
      uploadFailed: s('upload_failed'),
      toastUpdated: s('toast_updated'),
      tapInspectHint: s('tap_inspect_hint'),
      changePhotoAria: s('change_photo_aria'),
      profilePageTitle: s('profile_page_title'),
      profileLoadFailed: s('profile_load_failed'),
    );
    return chrome.isReady ? chrome : null;
  }
}
