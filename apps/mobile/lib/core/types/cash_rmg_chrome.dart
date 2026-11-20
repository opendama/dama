/// Chrome + policy from GET /public/cash-rmg-chrome (fail closed).
class CashRmgChrome {
  const CashRmgChrome({
    required this.cashRmgUnavailable,
    required this.ageGateTitle,
    required this.ageGateBlurb,
    required this.ageGateDobLabel,
    required this.ageGateDobPlaceholder,
    required this.ageGateSubmitAction,
    required this.ageGateSuccess,
    required this.ageGateFailed,
    required this.ageGateTooYoung,
    required this.ageRequiredError,
    required this.jurisdictionBlockedError,
    required this.cashDisabledError,
    required this.locateRequiredError,
    required this.locateStaleError,
    required this.countryRequiredError,
    required this.phoneKycTitle,
    required this.phoneKycBlurb,
    required this.phoneKycPhoneLabel,
    required this.phoneKycSaveAction,
    required this.phoneKycStartOtpAction,
    required this.phoneKycVerifyAction,
    required this.phoneKycCodeLabel,
    required this.phoneKycSuccess,
    required this.phoneKycFailed,
    required this.phoneKycRequiredError,
    required this.eligibleLabel,
    required this.notEligibleLabel,
    required this.docKycTitle,
    required this.docKycBlurb,
    required this.docKycTypeLabel,
    required this.docKycLegalNameLabel,
    required this.docKycFrontLabel,
    required this.docKycBackLabel,
    required this.docKycSelfieLabel,
    required this.docKycUploadAction,
    required this.docKycSaveDraftAction,
    required this.docKycSubmitAction,
    required this.docKycPendingLabel,
    required this.docKycApprovedLabel,
    required this.docKycRejectedLabel,
    required this.docKycSuccess,
    required this.docKycFailed,
    required this.docKycRequiredError,
    required this.docKycIncompleteError,
    required this.docKycTypePassport,
    required this.docKycTypeNationalId,
    required this.docKycTypeDriversLicense,
    required this.docKycCameraAction,
    required this.docKycGalleryAction,
  });

  final String cashRmgUnavailable;
  final String ageGateTitle;
  final String ageGateBlurb;
  final String ageGateDobLabel;
  final String ageGateDobPlaceholder;
  final String ageGateSubmitAction;
  final String ageGateSuccess;
  final String ageGateFailed;
  final String ageGateTooYoung;
  final String ageRequiredError;
  final String jurisdictionBlockedError;
  final String cashDisabledError;
  final String locateRequiredError;
  final String locateStaleError;
  final String countryRequiredError;
  final String phoneKycTitle;
  final String phoneKycBlurb;
  final String phoneKycPhoneLabel;
  final String phoneKycSaveAction;
  final String phoneKycStartOtpAction;
  final String phoneKycVerifyAction;
  final String phoneKycCodeLabel;
  final String phoneKycSuccess;
  final String phoneKycFailed;
  final String phoneKycRequiredError;
  final String eligibleLabel;
  final String notEligibleLabel;
  final String docKycTitle;
  final String docKycBlurb;
  final String docKycTypeLabel;
  final String docKycLegalNameLabel;
  final String docKycFrontLabel;
  final String docKycBackLabel;
  final String docKycSelfieLabel;
  final String docKycUploadAction;
  final String docKycSaveDraftAction;
  final String docKycSubmitAction;
  final String docKycPendingLabel;
  final String docKycApprovedLabel;
  final String docKycRejectedLabel;
  final String docKycSuccess;
  final String docKycFailed;
  final String docKycRequiredError;
  final String docKycIncompleteError;
  final String docKycTypePassport;
  final String docKycTypeNationalId;
  final String docKycTypeDriversLicense;
  final String docKycCameraAction;
  final String docKycGalleryAction;

  String typeLabel(String type) {
    switch (type) {
      case 'passport':
        return docKycTypePassport;
      case 'national_id':
        return docKycTypeNationalId;
      case 'drivers_license':
        return docKycTypeDriversLicense;
      default:
        return type;
    }
  }

  /// Fail-closed chrome only. Placeholders (*Placeholder) stay optional for older DBs / web parity.
  bool get isReady =>
      cashRmgUnavailable.isNotEmpty &&
      ageGateTitle.isNotEmpty &&
      ageGateBlurb.isNotEmpty &&
      ageGateDobLabel.isNotEmpty &&
      ageGateSubmitAction.isNotEmpty &&
      ageGateSuccess.isNotEmpty &&
      ageGateFailed.isNotEmpty &&
      ageGateTooYoung.isNotEmpty &&
      ageRequiredError.isNotEmpty &&
      jurisdictionBlockedError.isNotEmpty &&
      cashDisabledError.isNotEmpty &&
      locateRequiredError.isNotEmpty &&
      locateStaleError.isNotEmpty &&
      countryRequiredError.isNotEmpty &&
      phoneKycTitle.isNotEmpty &&
      phoneKycBlurb.isNotEmpty &&
      phoneKycPhoneLabel.isNotEmpty &&
      phoneKycSaveAction.isNotEmpty &&
      phoneKycStartOtpAction.isNotEmpty &&
      phoneKycVerifyAction.isNotEmpty &&
      phoneKycCodeLabel.isNotEmpty &&
      phoneKycSuccess.isNotEmpty &&
      phoneKycFailed.isNotEmpty &&
      phoneKycRequiredError.isNotEmpty &&
      eligibleLabel.isNotEmpty &&
      notEligibleLabel.isNotEmpty &&
      docKycTitle.isNotEmpty &&
      docKycBlurb.isNotEmpty &&
      docKycTypeLabel.isNotEmpty &&
      docKycLegalNameLabel.isNotEmpty &&
      docKycFrontLabel.isNotEmpty &&
      docKycBackLabel.isNotEmpty &&
      docKycSelfieLabel.isNotEmpty &&
      docKycUploadAction.isNotEmpty &&
      docKycSaveDraftAction.isNotEmpty &&
      docKycSubmitAction.isNotEmpty &&
      docKycPendingLabel.isNotEmpty &&
      docKycApprovedLabel.isNotEmpty &&
      docKycRejectedLabel.isNotEmpty &&
      docKycSuccess.isNotEmpty &&
      docKycFailed.isNotEmpty &&
      docKycRequiredError.isNotEmpty &&
      docKycIncompleteError.isNotEmpty &&
      docKycTypePassport.isNotEmpty &&
      docKycTypeNationalId.isNotEmpty &&
      docKycTypeDriversLicense.isNotEmpty &&
      docKycCameraAction.isNotEmpty &&
      docKycGalleryAction.isNotEmpty;

  /// Returns null when any fail-closed field is missing. Placeholders are optional.
  static CashRmgChrome? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    String s(String k) => (json[k] as String?)?.trim() ?? '';
    final chrome = CashRmgChrome(
      cashRmgUnavailable: s('cash_rmg_unavailable'),
      ageGateTitle: s('age_gate_title'),
      ageGateBlurb: s('age_gate_blurb'),
      ageGateDobLabel: s('age_gate_dob_label'),
      ageGateDobPlaceholder: s('age_gate_dob_placeholder'),
      ageGateSubmitAction: s('age_gate_submit_action'),
      ageGateSuccess: s('age_gate_success'),
      ageGateFailed: s('age_gate_failed'),
      ageGateTooYoung: s('age_gate_too_young'),
      ageRequiredError: s('age_required_error'),
      jurisdictionBlockedError: s('jurisdiction_blocked_error'),
      cashDisabledError: s('cash_disabled_error'),
      locateRequiredError: s('locate_required_error'),
      locateStaleError: s('locate_stale_error'),
      countryRequiredError: s('country_required_error'),
      phoneKycTitle: s('phone_kyc_title'),
      phoneKycBlurb: s('phone_kyc_blurb'),
      phoneKycPhoneLabel: s('phone_kyc_phone_label'),
      phoneKycSaveAction: s('phone_kyc_save_action'),
      phoneKycStartOtpAction: s('phone_kyc_start_otp_action'),
      phoneKycVerifyAction: s('phone_kyc_verify_action'),
      phoneKycCodeLabel: s('phone_kyc_code_label'),
      phoneKycSuccess: s('phone_kyc_success'),
      phoneKycFailed: s('phone_kyc_failed'),
      phoneKycRequiredError: s('phone_kyc_required_error'),
      eligibleLabel: s('eligible_label'),
      notEligibleLabel: s('not_eligible_label'),
      docKycTitle: s('doc_kyc_title'),
      docKycBlurb: s('doc_kyc_blurb'),
      docKycTypeLabel: s('doc_kyc_type_label'),
      docKycLegalNameLabel: s('doc_kyc_legal_name_label'),
      docKycFrontLabel: s('doc_kyc_front_label'),
      docKycBackLabel: s('doc_kyc_back_label'),
      docKycSelfieLabel: s('doc_kyc_selfie_label'),
      docKycUploadAction: s('doc_kyc_upload_action'),
      docKycSaveDraftAction: s('doc_kyc_save_draft_action'),
      docKycSubmitAction: s('doc_kyc_submit_action'),
      docKycPendingLabel: s('doc_kyc_pending_label'),
      docKycApprovedLabel: s('doc_kyc_approved_label'),
      docKycRejectedLabel: s('doc_kyc_rejected_label'),
      docKycSuccess: s('doc_kyc_success'),
      docKycFailed: s('doc_kyc_failed'),
      docKycRequiredError: s('doc_kyc_required_error'),
      docKycIncompleteError: s('doc_kyc_incomplete_error'),
      docKycTypePassport: s('doc_kyc_type_passport'),
      docKycTypeNationalId: s('doc_kyc_type_national_id'),
      docKycTypeDriversLicense: s('doc_kyc_type_drivers_license'),
      docKycCameraAction: s('doc_kyc_camera_action'),
      docKycGalleryAction: s('doc_kyc_gallery_action'),
    );
    return chrome.isReady ? chrome : null;
  }
}

class CashRmgPolicy {
  const CashRmgPolicy({
    required this.minAgeYears,
    required this.allowedCountryCodes,
    required this.locateMaxAgeSeconds,
    required this.requireLocateForCash,
    required this.otpPhoneChannel,
    required this.requireDocumentKycForPayout,
    required this.documentKycTypes,
    required this.documentKycStatuses,
    required this.documentKycDraftStatus,
    required this.documentKycPendingStatus,
    required this.documentKycApprovedStatus,
    required this.documentKycRejectedStatus,
    required this.documentKycPassportType,
  });

  final int minAgeYears;
  final List<String> allowedCountryCodes;
  final int locateMaxAgeSeconds;
  final bool requireLocateForCash;
  final String otpPhoneChannel;
  final bool requireDocumentKycForPayout;
  final List<String> documentKycTypes;
  final List<String> documentKycStatuses;
  final String documentKycDraftStatus;
  final String documentKycPendingStatus;
  final String documentKycApprovedStatus;
  final String documentKycRejectedStatus;
  final String documentKycPassportType;

  bool get isReady =>
      minAgeYears >= 1 &&
      allowedCountryCodes.isNotEmpty &&
      locateMaxAgeSeconds >= 1 &&
      otpPhoneChannel.isNotEmpty &&
      documentKycTypes.isNotEmpty &&
      documentKycStatuses.isNotEmpty &&
      documentKycDraftStatus.isNotEmpty &&
      documentKycPendingStatus.isNotEmpty &&
      documentKycApprovedStatus.isNotEmpty &&
      documentKycRejectedStatus.isNotEmpty &&
      documentKycPassportType.isNotEmpty;

  static CashRmgPolicy? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    final codesRaw = json['allowed_country_codes'];
    final codes = <String>[];
    if (codesRaw is List) {
      for (final c in codesRaw) {
        final s = c?.toString().trim().toUpperCase() ?? '';
        if (s.isNotEmpty) codes.add(s);
      }
    }
    final typesRaw = json['document_kyc_types'];
    final types = <String>[];
    if (typesRaw is List) {
      for (final t in typesRaw) {
        final s = t?.toString().trim() ?? '';
        if (s.isNotEmpty) types.add(s);
      }
    }
    final statusesRaw = json['document_kyc_statuses'];
    final statuses = <String>[];
    if (statusesRaw is List) {
      for (final t in statusesRaw) {
        final s = t?.toString().trim() ?? '';
        if (s.isNotEmpty) statuses.add(s);
      }
    }
    if (json['require_document_kyc_for_payout'] is! bool) {
      return null;
    }
    final minAge = json['min_age_years'];
    final maxAge = json['locate_max_age_seconds'];
    final policy = CashRmgPolicy(
      minAgeYears: minAge is int ? minAge : int.tryParse('$minAge') ?? 0,
      allowedCountryCodes: codes,
      locateMaxAgeSeconds:
          maxAge is int ? maxAge : int.tryParse('$maxAge') ?? 0,
      requireLocateForCash: json['require_locate_for_cash'] == true,
      otpPhoneChannel: (json['otp_phone_channel'] as String?)?.trim() ?? '',
      requireDocumentKycForPayout:
          json['require_document_kyc_for_payout'] == true,
      documentKycTypes: types,
      documentKycStatuses: statuses,
      documentKycDraftStatus:
          (json['document_kyc_draft_status'] as String?)?.trim() ?? '',
      documentKycPendingStatus:
          (json['document_kyc_pending_status'] as String?)?.trim() ?? '',
      documentKycApprovedStatus:
          (json['document_kyc_approved_status'] as String?)?.trim() ?? '',
      documentKycRejectedStatus:
          (json['document_kyc_rejected_status'] as String?)?.trim() ?? '',
      documentKycPassportType:
          (json['document_kyc_passport_type'] as String?)?.trim() ?? '',
    );
    return policy.isReady ? policy : null;
  }
}

/// GET /me/cash-eligibility (fail closed on missing fields when gating).
class CashEligibility {
  const CashEligibility({
    required this.ok,
    required this.errorKey,
    required this.ageVerified,
    required this.phoneKycVerified,
    this.documentKycApproved = false,
    this.dateOfBirth = '',
    this.primaryPhone = '',
  });

  final bool ok;
  final String errorKey;
  final bool ageVerified;
  final bool phoneKycVerified;
  final bool documentKycApproved;
  final String dateOfBirth;
  final String primaryPhone;

  factory CashEligibility.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const CashEligibility(
        ok: false,
        errorKey: '',
        ageVerified: false,
        phoneKycVerified: false,
      );
    }
    return CashEligibility(
      ok: json['ok'] == true,
      errorKey: (json['error_key'] as String?)?.trim() ?? '',
      ageVerified: json['age_verified'] == true,
      phoneKycVerified: json['phone_kyc_verified'] == true,
      documentKycApproved: json['document_kyc_approved'] == true,
      dateOfBirth: (json['date_of_birth'] as String?)?.trim() ?? '',
      primaryPhone: (json['primary_phone'] as String?)?.trim() ?? '',
    );
  }
}

class CashRmgPayload {
  const CashRmgPayload({required this.chrome, required this.policy});

  final CashRmgChrome chrome;
  final CashRmgPolicy policy;

  static CashRmgPayload? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    final chrome = CashRmgChrome.fromJson(
      json['chrome'] is Map<String, dynamic>
          ? json['chrome'] as Map<String, dynamic>
          : null,
    );
    final policy = CashRmgPolicy.fromJson(
      json['policy'] is Map<String, dynamic>
          ? json['policy'] as Map<String, dynamic>
          : null,
    );
    if (chrome == null || policy == null) return null;
    return CashRmgPayload(chrome: chrome, policy: policy);
  }
}
