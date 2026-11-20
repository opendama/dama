export type AvatarChrome = {
  source?: string;
  avatar_chrome_unavailable?: string;
  page_title?: string;
  page_blurb?: string;
  choose_upload_action?: string;
  upload_action?: string;
  uploading_action?: string;
  upload_failed?: string;
  toast_updated?: string;
  tap_inspect_hint?: string;
  /** Accessible label for click-to-upload avatar control. */
  change_photo_aria?: string;
  profile_page_title?: string;
  profile_load_failed?: string;
  crop_canvas_unavailable?: string;
  crop_failed?: string;
};

const AVATAR_CHROME_KEYS: (keyof AvatarChrome)[] = [
  "source",
  "avatar_chrome_unavailable",
  "page_title",
  "page_blurb",
  "choose_upload_action",
  "upload_action",
  "uploading_action",
  "upload_failed",
  "toast_updated",
  "tap_inspect_hint",
  "change_photo_aria",
  "profile_page_title",
  "profile_load_failed",
  "crop_canvas_unavailable",
  "crop_failed",
];

export function isAvatarChromeReady(
  chrome: AvatarChrome | null | undefined,
): chrome is Required<AvatarChrome> {
  if (!chrome) return false;
  return AVATAR_CHROME_KEYS.every((k) => {
    const v = chrome[k];
    return typeof v === "string" && v.trim().length > 0;
  });
}
