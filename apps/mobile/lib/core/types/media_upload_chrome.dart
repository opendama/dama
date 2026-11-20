/// Chrome from GET /public/media-upload-chrome (shared dropzone copy).
class MediaUploadChrome {
  const MediaUploadChrome({
    required this.mediaUploadUnavailable,
    required this.dropTitle,
    required this.dropHint,
    required this.browseAction,
    required this.replaceAction,
    required this.removeAction,
    required this.uploadingLabel,
    required this.selectedLabel,
  });

  final String mediaUploadUnavailable;
  final String dropTitle;
  final String dropHint;
  final String browseAction;
  final String replaceAction;
  final String removeAction;
  final String uploadingLabel;
  final String selectedLabel;

  bool get isReady =>
      mediaUploadUnavailable.isNotEmpty &&
      dropTitle.isNotEmpty &&
      dropHint.isNotEmpty &&
      browseAction.isNotEmpty &&
      replaceAction.isNotEmpty &&
      removeAction.isNotEmpty &&
      uploadingLabel.isNotEmpty &&
      selectedLabel.isNotEmpty;

  static MediaUploadChrome? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    String s(String k) => (json[k] as String?)?.trim() ?? '';
    final chrome = MediaUploadChrome(
      mediaUploadUnavailable: s('media_upload_unavailable'),
      dropTitle: s('drop_title'),
      dropHint: s('drop_hint'),
      browseAction: s('browse_action'),
      replaceAction: s('replace_action'),
      removeAction: s('remove_action'),
      uploadingLabel: s('uploading_label'),
      selectedLabel: s('selected_label'),
    );
    return chrome.isReady ? chrome : null;
  }
}
