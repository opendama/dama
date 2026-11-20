/// DB-backed OTP gate chrome from GET /public/otp-chrome.
class OtpChrome {
  const OtpChrome({
    required this.source,
    required this.unavailable,
    required this.verifyTitle,
    required this.startFailed,
    required this.invalidCode,
    required this.enterCodeBlurb,
    required this.flagsUnavailable,
    required this.verificationStartFailed,
    required this.codeLabel,
    this.codePlaceholder = '',
    required this.retryAction,
    required this.retryOtpAction,
    required this.startingAction,
    required this.verifyAction,
    required this.verifyingAction,
    required this.errUnauthorized,
    required this.errNotRequired,
    required this.errChallengeRequired,
    required this.errVerificationRequired,
    required this.errVerificationUnavailable,
  });

  final String source;
  final String unavailable;
  final String verifyTitle;
  final String startFailed;
  final String invalidCode;
  final String enterCodeBlurb;
  final String flagsUnavailable;
  final String verificationStartFailed;
  final String codeLabel;

  /// Optional Trim-style OTP hint; empty falls back to `000000` in UI.
  final String codePlaceholder;
  final String retryAction;
  final String retryOtpAction;
  final String startingAction;
  final String verifyAction;
  final String verifyingAction;
  final String errUnauthorized;
  final String errNotRequired;
  final String errChallengeRequired;
  final String errVerificationRequired;
  final String errVerificationUnavailable;

  bool get isReady =>
      source.isNotEmpty &&
      unavailable.isNotEmpty &&
      verifyTitle.isNotEmpty &&
      startFailed.isNotEmpty &&
      invalidCode.isNotEmpty &&
      enterCodeBlurb.isNotEmpty &&
      flagsUnavailable.isNotEmpty &&
      verificationStartFailed.isNotEmpty &&
      codeLabel.isNotEmpty &&
      retryAction.isNotEmpty &&
      retryOtpAction.isNotEmpty &&
      startingAction.isNotEmpty &&
      verifyAction.isNotEmpty &&
      verifyingAction.isNotEmpty &&
      errUnauthorized.isNotEmpty &&
      errNotRequired.isNotEmpty &&
      errChallengeRequired.isNotEmpty &&
      errVerificationRequired.isNotEmpty &&
      errVerificationUnavailable.isNotEmpty;

  static OtpChrome? fromJson(Map<String, dynamic>? map) {
    if (map == null) return null;
    String s(String k) => (map[k] as String?)?.trim() ?? '';
    final chrome = OtpChrome(
      source: s('source'),
      unavailable: s('otp_chrome_unavailable'),
      verifyTitle: s('verify_title'),
      startFailed: s('start_failed'),
      invalidCode: s('invalid_code'),
      enterCodeBlurb: s('enter_code_blurb'),
      flagsUnavailable: s('flags_unavailable'),
      verificationStartFailed: s('verification_start_failed'),
      codeLabel: s('code_label'),
      codePlaceholder: s('code_placeholder'),
      retryAction: s('retry_action'),
      retryOtpAction: s('retry_otp_action'),
      startingAction: s('starting_action'),
      verifyAction: s('verify_action'),
      verifyingAction: s('verifying_action'),
      errUnauthorized: s('err_unauthorized'),
      errNotRequired: s('err_not_required'),
      errChallengeRequired: s('err_challenge_required'),
      errVerificationRequired: s('err_verification_required'),
      errVerificationUnavailable: s('err_verification_unavailable'),
    );
    return chrome.isReady ? chrome : null;
  }
}
