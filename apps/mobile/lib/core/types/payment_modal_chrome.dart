/// DB-backed payment/enroll modal chrome from GET /public/payment-modal-chrome.
class PaymentModalChrome {
  const PaymentModalChrome({
    required this.title,
    required this.blurb,
    required this.balanceLabel,
    required this.feeLabel,
    required this.confirmAction,
    required this.cancelAction,
    required this.insufficientTitle,
    required this.insufficientBlurb,
    required this.topUpAction,
    required this.topUpHref,
    required this.methodsTitle,
    required this.methodsBlurb,
    required this.checkoutAction,
    required this.amountLabel,
    required this.amountPlaceholder,
    required this.balancePending,
    required this.countryRequiredHint,
    required this.enrollSuccess,
    required this.enrollFailed,
    required this.alreadyEnrolled,
    required this.confirmPending,
    required this.checkoutPending,
    required this.amountCurrencySeparator,
  });

  final String title;
  final String blurb;
  final String balanceLabel;
  final String feeLabel;
  final String confirmAction;
  final String cancelAction;
  final String insufficientTitle;
  final String insufficientBlurb;
  final String topUpAction;
  final String topUpHref;
  final String methodsTitle;
  final String methodsBlurb;
  final String checkoutAction;
  final String amountLabel;
  final String amountPlaceholder;
  final String balancePending;
  final String countryRequiredHint;
  final String enrollSuccess;
  final String enrollFailed;
  final String alreadyEnrolled;
  final String confirmPending;
  final String checkoutPending;
  final String amountCurrencySeparator;

  bool get isReady =>
      title.isNotEmpty &&
      blurb.isNotEmpty &&
      balanceLabel.isNotEmpty &&
      feeLabel.isNotEmpty &&
      confirmAction.isNotEmpty &&
      cancelAction.isNotEmpty &&
      insufficientTitle.isNotEmpty &&
      insufficientBlurb.isNotEmpty &&
      topUpAction.isNotEmpty &&
      topUpHref.isNotEmpty &&
      methodsTitle.isNotEmpty &&
      methodsBlurb.isNotEmpty &&
      checkoutAction.isNotEmpty &&
      amountLabel.isNotEmpty &&
      amountPlaceholder.isNotEmpty &&
      balancePending.isNotEmpty &&
      countryRequiredHint.isNotEmpty &&
      enrollSuccess.isNotEmpty &&
      enrollFailed.isNotEmpty &&
      alreadyEnrolled.isNotEmpty &&
      confirmPending.isNotEmpty &&
      checkoutPending.isNotEmpty &&
      amountCurrencySeparator.isNotEmpty;

  static PaymentModalChrome? fromJson(Map<String, dynamic>? map) {
    if (map == null) return null;
    String raw(String k) => (map[k] as String?) ?? '';
    String s(String k) => raw(k).trim();
    final chrome = PaymentModalChrome(
      title: s('title'),
      blurb: s('blurb'),
      balanceLabel: s('balance_label'),
      feeLabel: s('fee_label'),
      confirmAction: s('confirm_action'),
      cancelAction: s('cancel_action'),
      insufficientTitle: s('insufficient_title'),
      insufficientBlurb: s('insufficient_blurb'),
      topUpAction: s('top_up_action'),
      topUpHref: s('top_up_href'),
      methodsTitle: s('methods_title'),
      methodsBlurb: s('methods_blurb'),
      checkoutAction: s('checkout_action'),
      amountLabel: s('amount_label'),
      amountPlaceholder: s('amount_placeholder'),
      balancePending: s('balance_pending'),
      countryRequiredHint: s('country_required_hint'),
      enrollSuccess: s('enroll_success'),
      enrollFailed: s('enroll_failed'),
      alreadyEnrolled: s('already_enrolled'),
      confirmPending: s('confirm_pending'),
      checkoutPending: s('checkout_pending'),
      amountCurrencySeparator: raw('amount_currency_separator'),
    );
    return chrome.isReady ? chrome : null;
  }
}
