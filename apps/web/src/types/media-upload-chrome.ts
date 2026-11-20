export type MediaUploadChrome = {
  media_upload_unavailable?: string;
  drop_title?: string;
  drop_hint?: string;
  browse_action?: string;
  replace_action?: string;
  remove_action?: string;
  uploading_label?: string;
  selected_label?: string;
};

const MEDIA_UPLOAD_CHROME_KEYS: (keyof MediaUploadChrome)[] = [
  "media_upload_unavailable",
  "drop_title",
  "drop_hint",
  "browse_action",
  "replace_action",
  "remove_action",
  "uploading_label",
  "selected_label",
];

export function isMediaUploadChromeReady(
  chrome: MediaUploadChrome | null | undefined,
): chrome is Required<MediaUploadChrome> {
  if (!chrome) return false;
  return MEDIA_UPLOAD_CHROME_KEYS.every((k) => {
    const v = chrome[k];
    return typeof v === "string" && v.trim().length > 0;
  });
}
