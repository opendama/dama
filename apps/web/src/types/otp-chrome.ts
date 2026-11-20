export type OtpChrome = {
  source?: string;
  otp_chrome_unavailable?: string;
  verify_title?: string;
  start_failed?: string;
  invalid_code?: string;
  enter_code_blurb?: string;
  enter_code_blurb_web?: string;
  flags_unavailable?: string;
  verification_start_failed?: string;
  code_label?: string;
  code_placeholder?: string;
  retry_action?: string;
  retry_otp_action?: string;
  starting_action?: string;
  verify_action?: string;
  verifying_action?: string;
  err_unauthorized?: string;
  err_not_required?: string;
  err_challenge_required?: string;
  err_verification_required?: string;
  err_verification_unavailable?: string;
};

const OTP_CHROME_KEYS: (keyof OtpChrome)[] = [
  "source",
  "otp_chrome_unavailable",
  "verify_title",
  "start_failed",
  "invalid_code",
  "enter_code_blurb",
  "enter_code_blurb_web",
  "flags_unavailable",
  "verification_start_failed",
  "code_label",
  "code_placeholder",
  "retry_action",
  "retry_otp_action",
  "starting_action",
  "verify_action",
  "verifying_action",
  "err_unauthorized",
  "err_not_required",
  "err_challenge_required",
  "err_verification_required",
  "err_verification_unavailable",
];

export function isOtpChromeReady(
  chrome: OtpChrome | null | undefined,
): chrome is Required<OtpChrome> {
  if (!chrome) return false;
  return OTP_CHROME_KEYS.every((k) => {
    const v = chrome[k];
    return typeof v === "string" && v.trim().length > 0;
  });
}
