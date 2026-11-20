/// DB-backed wallet/payout UI chrome from GET /public/wallet-chrome.
class WalletChrome {
  const WalletChrome({
    required this.payoutMethodSaved,
    required this.payoutRequestSubmitted,
    required this.payoutPhoneRequired,
    required this.payoutMethodSection,
    required this.payoutRequestSection,
    required this.payoutPhoneLabel,
    required this.payoutProviderLabel,
    required this.payoutAccountLabel,
    required this.payoutSaveAction,
    required this.payoutRequestAction,
    required this.payoutAmountLabel,
    required this.payoutPhoneHint,
    required this.payoutMethodSaveFailed,
    required this.payoutRequestFailed,
    required this.payoutAmountCurrencyRequired,
    required this.walletChromeUnavailable,
    required this.signInRequired,
    required this.signInRequiredCheckout,
    required this.pageTitle,
    required this.balanceLabel,
    required this.balancePending,
    required this.countryCodeLabel,
    required this.countryCodeHint,
    required this.topUpAmountLabel,
    required this.topUpAmountPlaceholder,
    required this.payoutAmountPlaceholder,
    required this.topUpAction,
    required this.refreshAction,
    required this.detectLocationAction,
    required this.locationUnavailable,
    required this.locationGeoFailed,
    required this.countryUnresolved,
    required this.paymentRouteUnavailable,
    required this.paymentRoutePrefix,
    required this.paymentRouteSeparator,
    required this.payoutRequiredMarker,
    required this.walletUnavailable,
    required this.walletLoadFailed,
    required this.countryRequiredCheckout,
    required this.invalidTopUpAmount,
    required this.checkoutUnavailable,
    required this.checkoutReady,
    required this.manualAccountsTitle,
    required this.banksLoading,
    required this.banksEmpty,
    required this.bankNamePrefix,
    required this.bankAccountPrefix,
    required this.bankMobilePrefix,
    required this.bankCurrencyPrefix,
    this.copyAction = '',
    this.toastCopied = '',
    this.toastCopyFailed = '',
    this.bankCopyAccountLabel = '',
    this.bankCopyMobileLabel = '',
    this.bankCopyNameLabel = '',
    this.cancelAction = '',
    required this.submitReceiptTitle,
    this.referenceLabel = '',
    required this.receiptImageLabel,
    required this.receiptUploadedPrefix,
    required this.submitReceiptAction,
    required this.receiptUploadFailed,
    required this.receiptSubmitted,
    required this.receiptSubmitFailed,
    required this.checkoutFailed,
    required this.locationCurrencyUnresolved,
    required this.documentKycRequired,
    required this.parenOpen,
    required this.parenClose,
    required this.amountCurrencySeparator,
    this.metaSeparator = '',
    this.listKindLabels = const {},
    this.listStatusLabels = const {},
    this.organizerPayoutSectionBlurb = '',
    this.linkReceiptsLabel = '',
    this.linkTransactionsLabel = '',
    this.linkReceiptsHref = '',
    this.linkTransactionsHref = '',
    this.linkWalletHref = '',
    this.linkManualTransferLabel = '',
    this.linkManualTransferHref = '',
    this.manualTransferPageTitle = '',
    this.manualTransferPageBlurb = '',
    this.manualTransferUnavailable = '',
    this.listActionSubmitReceipt = '',
    this.listAwaitingProofBlurb = '',
    this.receiptIntentUnavailable = '',
    this.listEmptyReceipts = '',
    this.listEmptyTransactions = '',
    this.listDetailTitle = '',
    this.dialogCloseLabel = '',
    this.receiptViewDetail = '',
    this.receiptReviewedAtLabel = '',
    this.receiptIntentIdLabel = '',
    this.receiptProviderLabel = '',
    this.receiptProofLabel = '',
    this.receiptOpenDocumentAction = '',
    this.listColStatus = '',
    this.listColAmount = '',
    this.listColDate = '',
    this.listColReference = '',
    this.listPageSize = '',
    this.listSearchLabel = '',
    this.listSearchPlaceholder = '',
    this.emptyValue = '',
    this.listMutedKinds = const [],
    this.payoutHistoryTitle = '',
    this.payoutHistoryEmpty = '',
    this.payoutHistoryAmountLabel = '',
    this.payoutHistoryStatusLabel = '',
    this.payoutHistoryDateLabel = '',
    this.payoutHistoryNoteLabel = '',
    this.payoutHistoryReviewedLabel = '',
    this.payoutHistoryLoadFailed = '',
    this.payoutHistoryPageSize = '',
    this.payoutMethodsEmpty = '',
    this.payoutMethodsLoadFailed = '',
    this.payoutMethodAddAction = '',
    this.payoutMethodEditAction = '',
    this.payoutMethodDeleteAction = '',
    this.payoutMethodDeleteConfirm = '',
    this.payoutMethodDeleted = '',
    this.payoutMethodDeleteFailed = '',
    this.payoutMethodUpdated = '',
    this.payoutMethodsPageSize = '',
    this.payoutMethodsActionsLabel = '',
    this.ageGateOpenAction = '',
    this.receiptDocumentTitle = '',
    this.receiptBrandName = '',
    this.receiptSectionBillTo = '',
    this.receiptSectionFrom = '',
    this.receiptSectionDetails = '',
    this.receiptSectionPayment = '',
    this.receiptSectionTransaction = '',
    this.receiptSectionProof = '',
    this.receiptLabelReference = '',
    this.receiptLabelAmount = '',
    this.receiptLabelCurrency = '',
    this.receiptLabelStatus = '',
    this.receiptLabelChannel = '',
    this.receiptLabelDate = '',
    this.receiptLabelId = '',
    this.receiptLabelPaidAt = '',
    this.receiptLabelBillingPeriod = '',
    this.receiptBillingPeriod = '',
    this.receiptHeaderMetaSeparator = ' - ',
    this.receiptLabelSubtotal = '',
    this.receiptLabelTax = '',
    this.receiptLabelTotal = '',
    this.receiptLabelAmountPaid = '',
    this.receiptColDescription = '',
    this.receiptColProduct = '',
    this.receiptColAmount = '',
    this.receiptColQty = '',
    this.receiptColUnit = '',
    this.receiptColTaxRate = '',
    this.receiptLineDescription = '',
    this.receiptSectionTaxBreakdown = '',
    this.receiptLabelTaxPercent = '',
    this.receiptLabelTaxTotal = '',
    this.receiptTaxRateDisplay = '',
    this.receiptMerchantVia = '',
    this.receiptFooter = '',
    this.receiptPrintAction = '',
    this.receiptPrintPending = '',
    this.receiptDownloadAction = '',
    this.receiptDownloadPending = '',
    this.receiptDownloadFailed = '',
    this.receiptDownloadDone = '',
    this.receiptDownloadFilenameFmt = '',
    this.receiptProofCaption = '',
    this.receiptSupportEmail = '',
  });

  final String payoutMethodSaved;
  final String payoutRequestSubmitted;
  final String payoutPhoneRequired;
  final String payoutMethodSection;
  final String payoutRequestSection;
  final String payoutPhoneLabel;
  final String payoutProviderLabel;
  final String payoutAccountLabel;
  final String payoutSaveAction;
  final String payoutRequestAction;
  final String payoutAmountLabel;
  final String payoutPhoneHint;
  final String payoutMethodSaveFailed;
  final String payoutRequestFailed;
  final String payoutAmountCurrencyRequired;
  final String walletChromeUnavailable;
  final String signInRequired;
  final String signInRequiredCheckout;
  final String pageTitle;
  final String balanceLabel;
  final String balancePending;
  final String countryCodeLabel;
  final String countryCodeHint;
  final String topUpAmountLabel;
  final String topUpAmountPlaceholder;
  final String payoutAmountPlaceholder;
  final String topUpAction;
  final String refreshAction;
  final String detectLocationAction;
  final String locationUnavailable;
  final String locationGeoFailed;
  final String countryUnresolved;
  final String paymentRouteUnavailable;
  final String paymentRoutePrefix;
  final String paymentRouteSeparator;
  final String payoutRequiredMarker;
  final String walletUnavailable;
  final String walletLoadFailed;
  final String countryRequiredCheckout;
  final String invalidTopUpAmount;
  final String checkoutUnavailable;
  final String checkoutReady;
  final String manualAccountsTitle;
  final String banksLoading;
  final String banksEmpty;
  final String bankNamePrefix;
  final String bankAccountPrefix;
  final String bankMobilePrefix;
  final String bankCurrencyPrefix;
  final String copyAction;
  final String toastCopied;
  final String toastCopyFailed;
  final String bankCopyAccountLabel;
  final String bankCopyMobileLabel;
  final String bankCopyNameLabel;
  final String cancelAction;
  final String submitReceiptTitle;
  final String referenceLabel;
  final String receiptImageLabel;
  final String receiptUploadedPrefix;
  final String submitReceiptAction;
  final String receiptUploadFailed;
  final String receiptSubmitted;
  final String receiptSubmitFailed;
  final String checkoutFailed;
  final String locationCurrencyUnresolved;
  final String documentKycRequired;
  final String parenOpen;
  final String parenClose;
  final String amountCurrencySeparator;

  /// List row meta joiner from DB (not amount_currency_separator).
  final String metaSeparator;

  /// Keys are ledger/txn kinds (e.g. topup, event_entry_paid); values from list_kind_*.
  final Map<String, String> listKindLabels;

  /// Keys are ledger/receipt status codes; values from list_status_*.
  final Map<String, String> listStatusLabels;

  /// Shown on events/ads money shells (same payout APIs as player wallet).
  final String organizerPayoutSectionBlurb;
  final String linkReceiptsLabel;
  final String linkTransactionsLabel;
  final String linkReceiptsHref;
  final String linkTransactionsHref;
  final String linkWalletHref;
  final String linkManualTransferLabel;
  final String linkManualTransferHref;
  final String manualTransferPageTitle;
  final String manualTransferPageBlurb;
  final String manualTransferUnavailable;
  final String listActionSubmitReceipt;
  final String listAwaitingProofBlurb;
  final String receiptIntentUnavailable;
  final String listEmptyReceipts;
  final String listEmptyTransactions;
  final String listDetailTitle;
  final String dialogCloseLabel;
  final String receiptViewDetail;
  final String receiptReviewedAtLabel;
  final String receiptIntentIdLabel;
  final String receiptProviderLabel;
  final String receiptProofLabel;
  final String receiptOpenDocumentAction;
  final String listColStatus;
  final String listColAmount;
  final String listColDate;
  final String listColReference;
  final String listPageSize;
  final String listSearchLabel;
  final String listSearchPlaceholder;

  /// Empty cell / missing reference (DB only; never invent "-").
  final String emptyValue;

  /// Informational ledger kinds (e.g. platform commission) shown muted.
  final List<String> listMutedKinds;
  final String payoutHistoryTitle;
  final String payoutHistoryEmpty;
  final String payoutHistoryAmountLabel;
  final String payoutHistoryStatusLabel;
  final String payoutHistoryDateLabel;
  final String payoutHistoryNoteLabel;
  final String payoutHistoryReviewedLabel;
  final String payoutHistoryLoadFailed;
  final String payoutHistoryPageSize;
  final String payoutMethodsEmpty;
  final String payoutMethodsLoadFailed;
  final String payoutMethodAddAction;
  final String payoutMethodEditAction;
  final String payoutMethodDeleteAction;
  final String payoutMethodDeleteConfirm;
  final String payoutMethodDeleted;
  final String payoutMethodDeleteFailed;
  final String payoutMethodUpdated;
  final String payoutMethodsPageSize;
  final String payoutMethodsActionsLabel;
  final String ageGateOpenAction;
  final String receiptDocumentTitle;
  final String receiptBrandName;
  final String receiptSectionBillTo;
  final String receiptSectionFrom;
  final String receiptSectionDetails;
  final String receiptSectionPayment;
  final String receiptSectionTransaction;
  final String receiptSectionProof;
  final String receiptLabelReference;
  final String receiptLabelAmount;
  final String receiptLabelCurrency;
  final String receiptLabelStatus;
  final String receiptLabelChannel;
  final String receiptLabelDate;
  final String receiptLabelId;
  final String receiptLabelPaidAt;
  final String receiptLabelBillingPeriod;
  final String receiptBillingPeriod;
  final String receiptHeaderMetaSeparator;
  final String receiptLabelSubtotal;
  final String receiptLabelTax;
  final String receiptLabelTotal;
  final String receiptLabelAmountPaid;
  final String receiptColDescription;
  final String receiptColProduct;
  final String receiptColAmount;
  final String receiptColQty;
  final String receiptColUnit;
  final String receiptColTaxRate;
  final String receiptLineDescription;
  final String receiptSectionTaxBreakdown;
  final String receiptLabelTaxPercent;
  final String receiptLabelTaxTotal;
  final String receiptTaxRateDisplay;
  final String receiptMerchantVia;
  final String receiptFooter;
  final String receiptPrintAction;
  final String receiptPrintPending;
  final String receiptDownloadAction;
  final String receiptDownloadPending;
  final String receiptDownloadFailed;
  final String receiptDownloadDone;
  final String receiptDownloadFilenameFmt;
  final String receiptProofCaption;
  final String receiptSupportEmail;

  /// Trim-parity professional receipt document chrome (fail-closed incl. totals/tax).
  bool get receiptDocumentReady =>
      receiptDocumentTitle.trim().isNotEmpty &&
      receiptBrandName.trim().isNotEmpty &&
      receiptDownloadAction.trim().isNotEmpty &&
      receiptPrintAction.trim().isNotEmpty &&
      receiptDownloadFailed.trim().isNotEmpty &&
      receiptDownloadFilenameFmt.trim().isNotEmpty &&
      receiptLabelSubtotal.trim().isNotEmpty &&
      receiptLabelTax.trim().isNotEmpty &&
      receiptLabelTotal.trim().isNotEmpty &&
      receiptLabelAmountPaid.trim().isNotEmpty &&
      receiptLabelCurrency.trim().isNotEmpty &&
      receiptHeaderMetaSeparator.isNotEmpty &&
      (receiptColProduct.trim().isNotEmpty ||
          receiptColDescription.trim().isNotEmpty) &&
      receiptColAmount.trim().isNotEmpty &&
      receiptColQty.trim().isNotEmpty &&
      receiptColUnit.trim().isNotEmpty &&
      receiptColTaxRate.trim().isNotEmpty &&
      receiptSectionTaxBreakdown.trim().isNotEmpty &&
      receiptLabelTaxPercent.trim().isNotEmpty &&
      receiptLabelTaxTotal.trim().isNotEmpty &&
      receiptTaxRateDisplay.trim().isNotEmpty;

  int get payoutMethodsPageSizeInt {
    final n = int.tryParse(payoutMethodsPageSize.trim());
    return n != null && n > 0 ? n : 0;
  }

  bool get payoutMethodsReady =>
      payoutMethodsEmpty.isNotEmpty &&
      payoutMethodsLoadFailed.isNotEmpty &&
      payoutMethodAddAction.isNotEmpty &&
      payoutMethodEditAction.isNotEmpty &&
      payoutMethodDeleteAction.isNotEmpty &&
      payoutMethodDeleteConfirm.isNotEmpty &&
      payoutMethodDeleted.isNotEmpty &&
      payoutMethodDeleteFailed.isNotEmpty &&
      payoutMethodUpdated.isNotEmpty &&
      payoutMethodsActionsLabel.isNotEmpty &&
      ageGateOpenAction.isNotEmpty &&
      payoutMethodsPageSizeInt > 0;

  int get payoutHistoryPageSizeInt {
    final n = int.tryParse(payoutHistoryPageSize.trim());
    return n != null && n > 0 ? n : 0;
  }

  bool get payoutHistoryReady =>
      payoutHistoryTitle.isNotEmpty &&
      payoutHistoryEmpty.isNotEmpty &&
      payoutHistoryAmountLabel.isNotEmpty &&
      payoutHistoryStatusLabel.isNotEmpty &&
      payoutHistoryDateLabel.isNotEmpty &&
      payoutHistoryNoteLabel.isNotEmpty &&
      payoutHistoryReviewedLabel.isNotEmpty &&
      payoutHistoryLoadFailed.isNotEmpty &&
      payoutHistoryPageSizeInt > 0;

  int get listPageSizeInt {
    final n = int.tryParse(listPageSize.trim());
    return n != null && n > 0 ? n : 0;
  }

  String kindLabel(String kind) {
    final k = kind.trim();
    if (k.isEmpty) return '';
    return (listKindLabels[k] ?? '').trim();
  }

  String statusLabel(String status) {
    final s = status.trim();
    if (s.isEmpty) return '';
    return (listStatusLabels[s] ?? '').trim();
  }

  bool isMutedKind(String kind) => listMutedKinds.contains(kind.trim());

  bool get isReady =>
      payoutMethodSaved.isNotEmpty &&
      payoutRequestSubmitted.isNotEmpty &&
      payoutPhoneRequired.isNotEmpty &&
      payoutMethodSection.isNotEmpty &&
      payoutRequestSection.isNotEmpty &&
      payoutPhoneLabel.isNotEmpty &&
      payoutProviderLabel.isNotEmpty &&
      payoutAccountLabel.isNotEmpty &&
      payoutSaveAction.isNotEmpty &&
      payoutRequestAction.isNotEmpty &&
      payoutAmountLabel.isNotEmpty &&
      payoutPhoneHint.isNotEmpty &&
      payoutMethodSaveFailed.isNotEmpty &&
      payoutRequestFailed.isNotEmpty &&
      payoutAmountCurrencyRequired.isNotEmpty &&
      walletChromeUnavailable.isNotEmpty &&
      signInRequired.isNotEmpty &&
      signInRequiredCheckout.isNotEmpty &&
      pageTitle.isNotEmpty &&
      balanceLabel.isNotEmpty &&
      balancePending.isNotEmpty &&
      countryCodeLabel.isNotEmpty &&
      countryCodeHint.isNotEmpty &&
      topUpAmountLabel.isNotEmpty &&
      topUpAmountPlaceholder.isNotEmpty &&
      payoutAmountPlaceholder.isNotEmpty &&
      topUpAction.isNotEmpty &&
      refreshAction.isNotEmpty &&
      detectLocationAction.isNotEmpty &&
      locationUnavailable.isNotEmpty &&
      locationGeoFailed.isNotEmpty &&
      countryUnresolved.isNotEmpty &&
      paymentRouteUnavailable.isNotEmpty &&
      paymentRoutePrefix.isNotEmpty &&
      paymentRouteSeparator.isNotEmpty &&
      payoutRequiredMarker.isNotEmpty &&
      walletUnavailable.isNotEmpty &&
      walletLoadFailed.isNotEmpty &&
      countryRequiredCheckout.isNotEmpty &&
      invalidTopUpAmount.isNotEmpty &&
      checkoutUnavailable.isNotEmpty &&
      checkoutReady.isNotEmpty &&
      manualAccountsTitle.isNotEmpty &&
      banksLoading.isNotEmpty &&
      banksEmpty.isNotEmpty &&
      bankNamePrefix.isNotEmpty &&
      bankAccountPrefix.isNotEmpty &&
      bankMobilePrefix.isNotEmpty &&
      bankCurrencyPrefix.isNotEmpty &&
      copyAction.isNotEmpty &&
      toastCopied.isNotEmpty &&
      toastCopyFailed.isNotEmpty &&
      bankCopyAccountLabel.isNotEmpty &&
      bankCopyMobileLabel.isNotEmpty &&
      bankCopyNameLabel.isNotEmpty &&
      cancelAction.isNotEmpty &&
      submitReceiptTitle.isNotEmpty &&
      receiptImageLabel.isNotEmpty &&
      receiptUploadedPrefix.isNotEmpty &&
      submitReceiptAction.isNotEmpty &&
      receiptUploadFailed.isNotEmpty &&
      receiptSubmitted.isNotEmpty &&
      receiptSubmitFailed.isNotEmpty &&
      checkoutFailed.isNotEmpty &&
      locationCurrencyUnresolved.isNotEmpty &&
      documentKycRequired.isNotEmpty &&
      organizerPayoutSectionBlurb.isNotEmpty &&
      linkReceiptsLabel.isNotEmpty &&
      linkTransactionsLabel.isNotEmpty &&
      linkReceiptsHref.isNotEmpty &&
      linkTransactionsHref.isNotEmpty &&
      linkWalletHref.isNotEmpty &&
      linkManualTransferLabel.isNotEmpty &&
      linkManualTransferHref.isNotEmpty &&
      manualTransferPageTitle.isNotEmpty &&
      manualTransferPageBlurb.isNotEmpty &&
      manualTransferUnavailable.isNotEmpty &&
      listActionSubmitReceipt.isNotEmpty &&
      listAwaitingProofBlurb.isNotEmpty &&
      receiptIntentUnavailable.isNotEmpty &&
      parenOpen.isNotEmpty &&
      parenClose.isNotEmpty &&
      amountCurrencySeparator.isNotEmpty &&
      listPageSizeInt > 0 &&
      emptyValue.isNotEmpty &&
      listEmptyTransactions.isNotEmpty &&
      listEmptyReceipts.isNotEmpty &&
      statusLabel('posted').isNotEmpty &&
      statusLabel('pending').isNotEmpty &&
      statusLabel('approved').isNotEmpty &&
      statusLabel('rejected').isNotEmpty &&
      statusLabel('paid').isNotEmpty &&
      statusLabel('awaiting_receipt').isNotEmpty &&
      statusLabel('cancelled').isNotEmpty &&
      metaSeparator.isNotEmpty &&
      kindLabel('topup').isNotEmpty &&
      kindLabel('payout').isNotEmpty &&
      kindLabel('event_host_fee').isNotEmpty &&
      kindLabel('event_entry_paid').isNotEmpty &&
      kindLabel('event_entry_earned').isNotEmpty &&
      kindLabel('campaign_create_fee').isNotEmpty &&
      kindLabel('event_entry_commission').isNotEmpty &&
      kindLabel('event_entry_refund').isNotEmpty &&
      kindLabel('event_entry_clawback').isNotEmpty &&
      kindLabel('prize_pool_guarantee_hold').isNotEmpty &&
      kindLabel('prize_pool_guarantee_release').isNotEmpty &&
      kindLabel('prize_pool_guarantee_capture').isNotEmpty &&
      kindLabel('competition_prize_payout').isNotEmpty &&
      payoutHistoryReady &&
      payoutMethodsReady;

  static WalletChrome? fromJson(Map<String, dynamic>? map) {
    if (map == null) return null;
    String raw(String k) => (map[k] as String?) ?? '';
    String s(String k) => raw(k).trim();
    const kindPrefix = 'list_kind_';
    const statusPrefix = 'list_status_';
    final kinds = <String, String>{};
    final statuses = <String, String>{};
    for (final e in map.entries) {
      final key = e.key;
      final label = (e.value as String?)?.trim() ?? '';
      if (label.isEmpty) continue;
      if (key.startsWith(kindPrefix)) {
        final kind = key.substring(kindPrefix.length).trim();
        if (kind.isNotEmpty) kinds[kind] = label;
      } else if (key.startsWith(statusPrefix)) {
        final st = key.substring(statusPrefix.length).trim();
        if (st.isNotEmpty) statuses[st] = label;
      }
    }
    final chrome = WalletChrome(
      payoutMethodSaved: s('payout_method_saved'),
      payoutRequestSubmitted: s('payout_request_submitted'),
      payoutPhoneRequired: s('payout_phone_required'),
      payoutMethodSection: s('payout_method_section'),
      payoutRequestSection: s('payout_request_section'),
      payoutPhoneLabel: s('payout_phone_label'),
      payoutProviderLabel: s('payout_provider_label'),
      payoutAccountLabel: s('payout_account_label'),
      payoutSaveAction: s('payout_save_action'),
      payoutRequestAction: s('payout_request_action'),
      payoutAmountLabel: s('payout_amount_label'),
      payoutPhoneHint: s('payout_phone_hint'),
      payoutMethodSaveFailed: s('payout_method_save_failed'),
      payoutRequestFailed: s('payout_request_failed'),
      payoutAmountCurrencyRequired: s('payout_amount_currency_required'),
      walletChromeUnavailable: s('wallet_chrome_unavailable'),
      signInRequired: s('sign_in_required'),
      signInRequiredCheckout: s('sign_in_required_checkout'),
      pageTitle: s('page_title'),
      balanceLabel: s('balance_label'),
      balancePending: s('balance_pending'),
      countryCodeLabel: s('country_code_label'),
      countryCodeHint: s('country_code_hint'),
      topUpAmountLabel: s('top_up_amount_label'),
      topUpAmountPlaceholder: s('top_up_amount_placeholder'),
      payoutAmountPlaceholder: s('payout_amount_placeholder'),
      topUpAction: s('top_up_action'),
      refreshAction: s('refresh_action'),
      detectLocationAction: s('detect_location_action'),
      locationUnavailable: s('location_unavailable'),
      locationGeoFailed: s('location_geo_failed'),
      countryUnresolved: s('country_unresolved'),
      paymentRouteUnavailable: s('payment_route_unavailable'),
      paymentRoutePrefix: s('payment_route_prefix'),
      paymentRouteSeparator: raw('payment_route_separator'),
      payoutRequiredMarker: s('payout_required_marker'),
      walletUnavailable: s('wallet_unavailable'),
      walletLoadFailed: s('wallet_load_failed'),
      countryRequiredCheckout: s('country_required_checkout'),
      invalidTopUpAmount: s('invalid_top_up_amount'),
      checkoutUnavailable: s('checkout_unavailable'),
      checkoutReady: s('checkout_ready'),
      manualAccountsTitle: s('manual_accounts_title'),
      banksLoading: s('banks_loading'),
      banksEmpty: s('banks_empty'),
      bankNamePrefix: s('bank_name_prefix'),
      bankAccountPrefix: s('bank_account_prefix'),
      bankMobilePrefix: s('bank_mobile_prefix'),
      bankCurrencyPrefix: s('bank_currency_prefix'),
      copyAction: s('copy_action'),
      toastCopied: s('toast_copied'),
      toastCopyFailed: s('toast_copy_failed'),
      bankCopyAccountLabel: s('bank_copy_account_label'),
      bankCopyMobileLabel: s('bank_copy_mobile_label'),
      bankCopyNameLabel: s('bank_copy_name_label'),
      cancelAction: s('cancel_action'),
      submitReceiptTitle: s('submit_receipt_title'),
      referenceLabel: s('reference_label'),
      receiptImageLabel: s('receipt_image_label'),
      receiptUploadedPrefix: s('receipt_uploaded_prefix'),
      submitReceiptAction: s('submit_receipt_action'),
      receiptUploadFailed: s('receipt_upload_failed'),
      receiptSubmitted: s('receipt_submitted'),
      receiptSubmitFailed: s('receipt_submit_failed'),
      checkoutFailed: s('checkout_failed'),
      locationCurrencyUnresolved: s('location_currency_unresolved'),
      documentKycRequired: s('document_kyc_required'),
      parenOpen: raw('paren_open'),
      parenClose: raw('paren_close'),
      amountCurrencySeparator: raw('amount_currency_separator'),
      metaSeparator: raw('meta_separator'),
      listKindLabels: kinds,
      listStatusLabels: statuses,
      organizerPayoutSectionBlurb: s('organizer_payout_section_blurb'),
      linkReceiptsLabel: s('link_receipts_label'),
      linkTransactionsLabel: s('link_transactions_label'),
      linkReceiptsHref: s('link_receipts_href'),
      linkTransactionsHref: s('link_transactions_href'),
      linkWalletHref: s('link_wallet_href'),
      linkManualTransferLabel: s('link_manual_transfer_label'),
      linkManualTransferHref: s('link_manual_transfer_href'),
      manualTransferPageTitle: s('manual_transfer_page_title'),
      manualTransferPageBlurb: s('manual_transfer_page_blurb'),
      manualTransferUnavailable: s('manual_transfer_unavailable'),
      listActionSubmitReceipt: s('list_action_submit_receipt'),
      listAwaitingProofBlurb: s('list_awaiting_proof_blurb'),
      receiptIntentUnavailable: s('receipt_intent_unavailable'),
      listEmptyReceipts: s('list_empty_receipts'),
      listEmptyTransactions: s('list_empty_transactions'),
      listDetailTitle: s('list_detail_title'),
      dialogCloseLabel: s('dialog_close_label'),
      receiptViewDetail: s('receipt_view_detail'),
      receiptReviewedAtLabel: s('receipt_reviewed_at_label'),
      receiptIntentIdLabel: s('receipt_intent_id_label'),
      receiptProviderLabel: s('receipt_provider_label'),
      receiptProofLabel: s('receipt_proof_label'),
      receiptOpenDocumentAction: s('receipt_open_document_action'),
      listColStatus: s('list_col_status'),
      listColAmount: s('list_col_amount'),
      listColDate: s('list_col_date'),
      listColReference: s('list_col_reference'),
      listPageSize: s('list_page_size'),
      listSearchLabel: s('list_search_label'),
      listSearchPlaceholder: s('list_search_placeholder'),
      emptyValue: s('empty_value'),
      listMutedKinds: () {
        final rawMuted = map['list_muted_kinds'];
        if (rawMuted is! List) return const <String>[];
        return rawMuted
            .map((e) => e.toString().trim())
            .where((s) => s.isNotEmpty)
            .toList(growable: false);
      }(),
      payoutHistoryTitle: s('payout_history_title'),
      payoutHistoryEmpty: s('payout_history_empty'),
      payoutHistoryAmountLabel: s('payout_history_amount_label'),
      payoutHistoryStatusLabel: s('payout_history_status_label'),
      payoutHistoryDateLabel: s('payout_history_date_label'),
      payoutHistoryNoteLabel: s('payout_history_note_label'),
      payoutHistoryReviewedLabel: s('payout_history_reviewed_label'),
      payoutHistoryLoadFailed: s('payout_history_load_failed'),
      payoutHistoryPageSize: s('payout_history_page_size'),
      payoutMethodsEmpty: s('payout_methods_empty'),
      payoutMethodsLoadFailed: s('payout_methods_load_failed'),
      payoutMethodAddAction: s('payout_method_add_action'),
      payoutMethodEditAction: s('payout_method_edit_action'),
      payoutMethodDeleteAction: s('payout_method_delete_action'),
      payoutMethodDeleteConfirm: s('payout_method_delete_confirm'),
      payoutMethodDeleted: s('payout_method_deleted'),
      payoutMethodDeleteFailed: s('payout_method_delete_failed'),
      payoutMethodUpdated: s('payout_method_updated'),
      payoutMethodsPageSize: s('payout_methods_page_size'),
      payoutMethodsActionsLabel: s('payout_methods_actions_label'),
      ageGateOpenAction: s('age_gate_open_action'),
      receiptDocumentTitle: s('receipt_document_title'),
      receiptBrandName: s('receipt_brand_name'),
      receiptSectionBillTo: s('receipt_section_bill_to'),
      receiptSectionFrom: s('receipt_section_from'),
      receiptSectionDetails: s('receipt_section_details'),
      receiptSectionPayment: s('receipt_section_payment'),
      receiptSectionTransaction: s('receipt_section_transaction'),
      receiptSectionProof: s('receipt_section_proof'),
      receiptLabelReference: s('receipt_label_reference'),
      receiptLabelAmount: s('receipt_label_amount'),
      receiptLabelCurrency: s('receipt_label_currency'),
      receiptLabelStatus: s('receipt_label_status'),
      receiptLabelChannel: s('receipt_label_channel'),
      receiptLabelDate: s('receipt_label_date'),
      receiptLabelId: s('receipt_label_id'),
      receiptLabelPaidAt: s('receipt_label_paid_at'),
      receiptLabelBillingPeriod: s('receipt_label_billing_period'),
      receiptBillingPeriod: s('receipt_billing_period'),
      receiptHeaderMetaSeparator: () {
        final v = raw('receipt_header_meta_separator');
        return v.isNotEmpty ? v : ' - ';
      }(),
      receiptLabelSubtotal: s('receipt_label_subtotal'),
      receiptLabelTax: s('receipt_label_tax'),
      receiptLabelTotal: s('receipt_label_total'),
      receiptLabelAmountPaid: s('receipt_label_amount_paid'),
      receiptColDescription: s('receipt_col_description'),
      receiptColProduct: s('receipt_col_product'),
      receiptColAmount: s('receipt_col_amount'),
      receiptColQty: s('receipt_col_qty'),
      receiptColUnit: s('receipt_col_unit'),
      receiptColTaxRate: s('receipt_col_tax_rate'),
      receiptLineDescription: s('receipt_line_description'),
      receiptSectionTaxBreakdown: s('receipt_section_tax_breakdown'),
      receiptLabelTaxPercent: s('receipt_label_tax_percent'),
      receiptLabelTaxTotal: s('receipt_label_tax_total'),
      receiptTaxRateDisplay: s('receipt_tax_rate_display'),
      receiptMerchantVia: s('receipt_merchant_via'),
      receiptFooter: s('receipt_footer'),
      receiptPrintAction: s('receipt_print_action'),
      receiptPrintPending: s('receipt_print_pending'),
      receiptDownloadAction: s('receipt_download_action'),
      receiptDownloadPending: s('receipt_download_pending'),
      receiptDownloadFailed: s('receipt_download_failed'),
      receiptDownloadDone: s('receipt_download_done'),
      receiptDownloadFilenameFmt: s('receipt_download_filename_fmt'),
      receiptProofCaption: s('receipt_proof_caption'),
      receiptSupportEmail: s('receipt_support_email'),
    );
    return chrome.isReady ? chrome : null;
  }
}
