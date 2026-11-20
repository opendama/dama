import 'package:dama_mobile/graphql/schema_types.dart';

export 'package:dama_mobile/graphql/schema_types.dart' show GFeatureFlags;

/// Feature flags from GraphQL or matchmaking WebSocket (camelCase or snake_case).
class FeatureFlagsWire {
  const FeatureFlagsWire({
    required this.vsAiEnabled,
    required this.otpRequired,
    required this.cashRmgEnabled,
    required this.cashPhoneKycRequired,
    required this.cashPhoneOtpRequired,
    required this.cashRmgDisabledCountries,
    required this.hostedEventsEnabled,
    required this.publicEventsEnabled,
    required this.publicEventMatchesRated,
    required this.prizePoolDisplayEnabled,
    required this.prizePoolGuaranteeEnabled,
    required this.kycAutoApprove,
    required this.aiDepths,
  });

  final bool vsAiEnabled;
  final bool otpRequired;
  final bool cashRmgEnabled;
  final bool cashPhoneKycRequired;

  /// Fail closed: OTP required unless explicitly false.
  final bool cashPhoneOtpRequired;
  final List<String> cashRmgDisabledCountries;
  final bool hostedEventsEnabled;
  final bool publicEventsEnabled;
  final bool publicEventMatchesRated;
  final bool prizePoolDisplayEnabled;
  final bool prizePoolGuaranteeEnabled;
  final bool kycAutoApprove;
  final List<int> aiDepths;

  bool get hasPracticeDepths => aiDepths.isNotEmpty;

  /// Fail-closed: paid cash is off unless explicitly enabled and country not killed.
  bool cashAllowedForCountry(String countryCode) {
    if (!cashRmgEnabled) return false;
    final cc = countryCode.trim().toUpperCase();
    if (cc.isEmpty) return false;
    return !cashRmgDisabledCountries.any((c) => c.trim().toUpperCase() == cc);
  }

  factory FeatureFlagsWire.fromJson(Map<String, dynamic> json) {
    final rawDepths = json['aiDepths'] as List<dynamic>? ??
        json['ai_depths'] as List<dynamic>? ??
        const [];
    final rawDisabled = json['cashRmgDisabledCountries'] as List<dynamic>? ??
        json['cash_rmg_disabled_countries'] as List<dynamic>? ??
        const [];
    final otpRaw =
        json['cashPhoneOtpRequired'] ?? json['cash_phone_otp_required'];
    return FeatureFlagsWire(
      vsAiEnabled: json['vsAiEnabled'] == true || json['vs_ai_enabled'] == true,
      otpRequired: json['otpRequired'] == true || json['otp_required'] == true,
      cashRmgEnabled:
          json['cashRmgEnabled'] == true || json['cash_rmg_enabled'] == true,
      cashPhoneKycRequired: json['cashPhoneKycRequired'] == true ||
          json['cash_phone_kyc_required'] == true,
      cashPhoneOtpRequired: otpRaw == true,
      cashRmgDisabledCountries: rawDisabled.map((e) => e.toString()).toList(),
      hostedEventsEnabled: json['hostedEventsEnabled'] == true ||
          json['hosted_events_enabled'] == true,
      publicEventsEnabled: json['publicEventsEnabled'] == true ||
          json['public_events_enabled'] == true,
      publicEventMatchesRated: json['publicEventMatchesRated'] == true ||
          json['public_event_matches_rated'] == true,
      prizePoolDisplayEnabled: json['prizePoolDisplayEnabled'] == true ||
          json['prize_pool_display_enabled'] == true,
      prizePoolGuaranteeEnabled: json['prizePoolGuaranteeEnabled'] == true ||
          json['prize_pool_guarantee_enabled'] == true,
      kycAutoApprove:
          json['kycAutoApprove'] == true || json['kyc_auto_approve'] == true,
      aiDepths: rawDepths.map((e) => (e as num).toInt()).toList(),
    );
  }

  GFeatureFlags toGraphql() => GFeatureFlags(
        vsAiEnabled: vsAiEnabled,
        otpRequired: otpRequired,
        cashRmgEnabled: cashRmgEnabled,
        cashPhoneKycRequired: cashPhoneKycRequired,
        cashPhoneOtpRequired: cashPhoneOtpRequired,
        cashRmgDisabledCountries: cashRmgDisabledCountries,
        hostedEventsEnabled: hostedEventsEnabled,
        publicEventsEnabled: publicEventsEnabled,
        publicEventMatchesRated: publicEventMatchesRated,
        prizePoolDisplayEnabled: prizePoolDisplayEnabled,
        prizePoolGuaranteeEnabled: prizePoolGuaranteeEnabled,
        kycAutoApprove: kycAutoApprove,
        aiDepths: aiDepths,
      );
}
