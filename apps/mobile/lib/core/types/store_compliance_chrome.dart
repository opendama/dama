/// Chrome from GET /public/store-compliance-chrome (fail closed).
class StoreComplianceChrome {
  const StoreComplianceChrome({
    required this.accountSectionTitle,
    required this.deleteAccountTitle,
    required this.deleteAccountBlurb,
    required this.deleteAccountAction,
    required this.deleteAccountConfirm,
    required this.deleteAccountConfirmToken,
    required this.deleteAccountPending,
    required this.deleteAccountFailed,
    required this.deleteAccountSuccess,
    required this.exportDataTitle,
    required this.exportDataBlurb,
    required this.exportDataAction,
    required this.exportDataFailed,
    required this.exportFilename,
    required this.privacyLinkLabel,
    required this.termsLinkLabel,
    required this.refundsLinkLabel,
    required this.storeComplianceUnavailable,
  });

  final String accountSectionTitle;
  final String deleteAccountTitle;
  final String deleteAccountBlurb;
  final String deleteAccountAction;
  final String deleteAccountConfirm;
  final String deleteAccountConfirmToken;
  final String deleteAccountPending;
  final String deleteAccountFailed;
  final String deleteAccountSuccess;
  final String exportDataTitle;
  final String exportDataBlurb;
  final String exportDataAction;
  final String exportDataFailed;
  final String exportFilename;
  final String privacyLinkLabel;
  final String termsLinkLabel;
  final String refundsLinkLabel;
  final String storeComplianceUnavailable;

  bool get isReady =>
      accountSectionTitle.isNotEmpty &&
      deleteAccountTitle.isNotEmpty &&
      deleteAccountBlurb.isNotEmpty &&
      deleteAccountAction.isNotEmpty &&
      deleteAccountConfirm.isNotEmpty &&
      deleteAccountConfirmToken.isNotEmpty &&
      deleteAccountPending.isNotEmpty &&
      deleteAccountFailed.isNotEmpty &&
      deleteAccountSuccess.isNotEmpty &&
      exportDataTitle.isNotEmpty &&
      exportDataBlurb.isNotEmpty &&
      exportDataAction.isNotEmpty &&
      exportDataFailed.isNotEmpty &&
      exportFilename.isNotEmpty &&
      privacyLinkLabel.isNotEmpty &&
      termsLinkLabel.isNotEmpty &&
      refundsLinkLabel.isNotEmpty &&
      storeComplianceUnavailable.isNotEmpty;

  /// Returns null when any required field is missing (fail closed).
  static StoreComplianceChrome? fromJson(Map<String, dynamic> json) {
    String s(String k) => (json[k] as String?)?.trim() ?? '';
    final chrome = StoreComplianceChrome(
      accountSectionTitle: s('account_section_title'),
      deleteAccountTitle: s('delete_account_title'),
      deleteAccountBlurb: s('delete_account_blurb'),
      deleteAccountAction: s('delete_account_action'),
      deleteAccountConfirm: s('delete_account_confirm'),
      deleteAccountConfirmToken: s('delete_account_confirm_token'),
      deleteAccountPending: s('delete_account_pending'),
      deleteAccountFailed: s('delete_account_failed'),
      deleteAccountSuccess: s('delete_account_success'),
      exportDataTitle: s('export_data_title'),
      exportDataBlurb: s('export_data_blurb'),
      exportDataAction: s('export_data_action'),
      exportDataFailed: s('export_data_failed'),
      exportFilename: s('export_filename'),
      privacyLinkLabel: s('privacy_link_label'),
      termsLinkLabel: s('terms_link_label'),
      refundsLinkLabel: s('refunds_link_label'),
      storeComplianceUnavailable: s('store_compliance_unavailable'),
    );
    return chrome.isReady ? chrome : null;
  }
}
