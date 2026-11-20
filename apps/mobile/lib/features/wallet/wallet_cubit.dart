import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/cache/query_cache.dart';
import 'package:dama_mobile/core/cache/skip_store.dart';
import 'package:dama_mobile/core/errors/api_user_message.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/util/date_mask.dart';
import 'package:dama_mobile/core/util/sanitize_decimal_input.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

class WalletState extends Equatable {
  const WalletState({
    this.country = '',
    this.amountText = '',
    this.balance,
    this.walletCurrency,
    this.routeProvider,
    this.routeCurrency,
    this.payoutProvider = '',
    this.payoutAccountName = '',
    this.payoutPhone = '',
    this.payoutAmountText = '',
    this.payoutMethods = const [],
    this.payoutMethodsLoading = false,
    this.payoutMethodsError = '',
    this.payoutMethodsSkip = 0,
    this.payoutMethodsMeta,
    this.cashEligibilityLoaded = false,
    this.cashEligibility,
    this.banks = const [],
    this.banksLoading = false,
    this.receiptUrl = '',
    this.chrome,
    this.chromeLoading = false,
    this.cashGateLoaded = false,
    this.cashRmgEnabled = false,
    this.cashRmgDisabledCountries = const <String>[],
    this.cashDisabledError = '',
    this.jurisdictionBlockedError = '',
    this.cashRmgPolicy,
    this.cashRmgChrome,
    this.docKycApproved = false,
    this.locating = false,
    this.loading = false,
    this.error,
    this.checkoutMessage,
    this.myPayouts = const [],
    this.payoutHistoryLoading = false,
    this.payoutHistoryError = '',
    this.payoutHistorySkip = 0,
    this.payoutHistoryMeta,
  });

  final String country;
  final String amountText;
  final double? balance;
  final String? walletCurrency;
  final String? routeProvider;
  final String? routeCurrency;
  final String payoutProvider;
  final String payoutAccountName;
  final String payoutPhone;
  final String payoutAmountText;
  final List<PayoutMethod> payoutMethods;
  final bool payoutMethodsLoading;
  final String payoutMethodsError;
  final int payoutMethodsSkip;
  final PayoutListMeta? payoutMethodsMeta;
  final bool cashEligibilityLoaded;
  final CashEligibility? cashEligibility;
  final List<PaymentBank> banks;
  final bool banksLoading;
  final String receiptUrl;
  final WalletChrome? chrome;
  final bool chromeLoading;
  final bool cashGateLoaded;
  final bool cashRmgEnabled;
  final List<String> cashRmgDisabledCountries;
  final String cashDisabledError;
  final String jurisdictionBlockedError;
  final CashRmgPolicy? cashRmgPolicy;
  final CashRmgChrome? cashRmgChrome;
  final bool docKycApproved;
  final bool locating;
  final bool loading;
  final String? error;
  final String? checkoutMessage;
  final List<MyPayoutRequest> myPayouts;
  final bool payoutHistoryLoading;
  final String payoutHistoryError;
  final int payoutHistorySkip;
  final PayoutHistoryMeta? payoutHistoryMeta;

  /// Fail-closed after flags settle - not while cash gate is still loading.
  bool get cashLocked {
    if (!cashGateLoaded) return false;
    if (!cashRmgEnabled) return true;
    final cc = country.trim().toUpperCase();
    if (cc.isEmpty) return false;
    return cashRmgDisabledCountries.any((c) => c.trim().toUpperCase() == cc);
  }

  String get cashLockMessage {
    final cc = country.trim().toUpperCase();
    if (cashRmgEnabled &&
        cc.isNotEmpty &&
        cashRmgDisabledCountries.any((c) => c.trim().toUpperCase() == cc)) {
      return jurisdictionBlockedError.isNotEmpty
          ? jurisdictionBlockedError
          : cashDisabledError;
    }
    return cashDisabledError;
  }

  bool get initialHydrating =>
      chromeLoading ||
      !cashGateLoaded ||
      !cashEligibilityLoaded ||
      locating ||
      (loading && balance == null && routeProvider == null);

  bool get ageRequired =>
      cashEligibilityLoaded &&
      (cashEligibility?.errorKey.trim() ?? '') == 'age_required';

  bool get phoneRequired =>
      cashEligibilityLoaded &&
      (cashEligibility?.errorKey.trim() ?? '') == 'phone_kyc';

  bool get cashActionBlocked => cashLocked || ageRequired || phoneRequired;

  PayoutMethod? get firstPayoutMethod =>
      payoutMethods.isNotEmpty ? payoutMethods.first : null;

  String? get currencyLabel => walletCurrency ?? routeCurrency;

  bool get payoutPhoneReady =>
      firstPayoutMethod != null && firstPayoutMethod!.id.isNotEmpty;

  bool get chromeReady => chrome != null && chrome!.isReady;

  bool get isManualTransfer => routeProvider == 'manual_transfer';

  WalletState copyWith({
    String? country,
    String? amountText,
    double? balance,
    String? walletCurrency,
    String? routeProvider,
    String? routeCurrency,
    String? payoutProvider,
    String? payoutAccountName,
    String? payoutPhone,
    String? payoutAmountText,
    List<PayoutMethod>? payoutMethods,
    bool? payoutMethodsLoading,
    String? payoutMethodsError,
    int? payoutMethodsSkip,
    PayoutListMeta? payoutMethodsMeta,
    bool? cashEligibilityLoaded,
    CashEligibility? cashEligibility,
    List<PaymentBank>? banks,
    bool? banksLoading,
    String? receiptUrl,
    WalletChrome? chrome,
    bool? chromeLoading,
    bool? cashGateLoaded,
    bool? cashRmgEnabled,
    List<String>? cashRmgDisabledCountries,
    String? cashDisabledError,
    String? jurisdictionBlockedError,
    CashRmgPolicy? cashRmgPolicy,
    CashRmgChrome? cashRmgChrome,
    bool? docKycApproved,
    bool? locating,
    bool? loading,
    String? error,
    String? checkoutMessage,
    List<MyPayoutRequest>? myPayouts,
    bool? payoutHistoryLoading,
    String? payoutHistoryError,
    int? payoutHistorySkip,
    PayoutHistoryMeta? payoutHistoryMeta,
    bool clearPayoutHistoryError = false,
    bool clearPayoutHistoryMeta = false,
    bool clearPayoutMethodsError = false,
    bool clearPayoutMethodsMeta = false,
    bool clearCashEligibility = false,
    bool clearError = false,
    bool clearCheckoutMessage = false,
    bool clearBalance = false,
    bool clearChrome = false,
    bool clearReceiptUrl = false,
  }) {
    return WalletState(
      country: country ?? this.country,
      amountText: amountText ?? this.amountText,
      balance: clearBalance ? null : (balance ?? this.balance),
      walletCurrency: walletCurrency ?? this.walletCurrency,
      routeProvider: routeProvider ?? this.routeProvider,
      routeCurrency: routeCurrency ?? this.routeCurrency,
      payoutProvider: payoutProvider ?? this.payoutProvider,
      payoutAccountName: payoutAccountName ?? this.payoutAccountName,
      payoutPhone: payoutPhone ?? this.payoutPhone,
      payoutAmountText: payoutAmountText ?? this.payoutAmountText,
      payoutMethods: payoutMethods ?? this.payoutMethods,
      payoutMethodsLoading: payoutMethodsLoading ?? this.payoutMethodsLoading,
      payoutMethodsError: clearPayoutMethodsError
          ? ''
          : (payoutMethodsError ?? this.payoutMethodsError),
      payoutMethodsSkip: payoutMethodsSkip ?? this.payoutMethodsSkip,
      payoutMethodsMeta: clearPayoutMethodsMeta
          ? null
          : (payoutMethodsMeta ?? this.payoutMethodsMeta),
      cashEligibilityLoaded:
          cashEligibilityLoaded ?? this.cashEligibilityLoaded,
      cashEligibility: clearCashEligibility
          ? null
          : (cashEligibility ?? this.cashEligibility),
      banks: banks ?? this.banks,
      banksLoading: banksLoading ?? this.banksLoading,
      receiptUrl: clearReceiptUrl ? '' : (receiptUrl ?? this.receiptUrl),
      chrome: clearChrome ? null : (chrome ?? this.chrome),
      chromeLoading: chromeLoading ?? this.chromeLoading,
      cashGateLoaded: cashGateLoaded ?? this.cashGateLoaded,
      cashRmgEnabled: cashRmgEnabled ?? this.cashRmgEnabled,
      cashRmgDisabledCountries:
          cashRmgDisabledCountries ?? this.cashRmgDisabledCountries,
      cashDisabledError: cashDisabledError ?? this.cashDisabledError,
      jurisdictionBlockedError:
          jurisdictionBlockedError ?? this.jurisdictionBlockedError,
      cashRmgPolicy: cashRmgPolicy ?? this.cashRmgPolicy,
      cashRmgChrome: cashRmgChrome ?? this.cashRmgChrome,
      docKycApproved: docKycApproved ?? this.docKycApproved,
      locating: locating ?? this.locating,
      loading: loading ?? this.loading,
      error: clearError ? null : (error ?? this.error),
      checkoutMessage: clearCheckoutMessage
          ? null
          : (checkoutMessage ?? this.checkoutMessage),
      myPayouts: myPayouts ?? this.myPayouts,
      payoutHistoryLoading: payoutHistoryLoading ?? this.payoutHistoryLoading,
      payoutHistoryError: clearPayoutHistoryError
          ? ''
          : (payoutHistoryError ?? this.payoutHistoryError),
      payoutHistorySkip: payoutHistorySkip ?? this.payoutHistorySkip,
      payoutHistoryMeta: clearPayoutHistoryMeta
          ? null
          : (payoutHistoryMeta ?? this.payoutHistoryMeta),
    );
  }

  @override
  List<Object?> get props => [
        country,
        amountText,
        balance,
        walletCurrency,
        routeProvider,
        routeCurrency,
        payoutProvider,
        payoutAccountName,
        payoutPhone,
        payoutAmountText,
        payoutMethods,
        payoutMethodsLoading,
        payoutMethodsError,
        payoutMethodsSkip,
        payoutMethodsMeta,
        cashEligibilityLoaded,
        cashEligibility,
        banks,
        banksLoading,
        receiptUrl,
        chrome,
        chromeLoading,
        cashGateLoaded,
        cashRmgEnabled,
        cashRmgDisabledCountries,
        cashDisabledError,
        jurisdictionBlockedError,
        cashRmgPolicy,
        cashRmgChrome,
        docKycApproved,
        locating,
        loading,
        error,
        checkoutMessage,
        myPayouts,
        payoutHistoryLoading,
        payoutHistoryError,
        payoutHistorySkip,
        payoutHistoryMeta,
      ];
}

/// Owns geo locate, payment route, wallet balance, checkout, banks, receipt + QueryCache.
class WalletCubit extends Cubit<WalletState> {
  WalletCubit({
    required this.accessToken,
    this.focusPayoutHistoryId = '',
    ApiConfig? config,
    ImagePicker? picker,
  })  : _config = config ?? ApiConfig.defaults,
        _picker = picker ?? ImagePicker(),
        super(
          WalletState(
            payoutHistorySkip: SkipStore.read(_payoutsSkipKey),
            payoutMethodsSkip: SkipStore.read(_methodsSkipKey),
          ),
        );

  static const _payoutsSkipKey = 'wallet_payouts';
  static const _methodsSkipKey = 'wallet_methods';

  final String accessToken;

  /// Deep-link `/wallet?id=` seeks this payout in history (API `id` query).
  final String focusPayoutHistoryId;
  final ApiConfig _config;
  final ImagePicker _picker;

  void setAmountText(String value) {
    emit(state.copyWith(amountText: sanitizeDecimalInput(value)));
  }

  void setPayoutProvider(String value) {
    emit(state.copyWith(payoutProvider: value));
  }

  void setPayoutAccountName(String value) {
    emit(state.copyWith(payoutAccountName: value));
  }

  void setPayoutPhone(String value) {
    emit(state.copyWith(payoutPhone: value));
  }

  void setPayoutAmountText(String value) {
    emit(state.copyWith(payoutAmountText: sanitizeDecimalInput(value)));
  }

  Future<void> loadWalletChrome() async {
    emit(state.copyWith(chromeLoading: true, clearError: true));
    try {
      final res = await http.get(
        Uri.parse('${_config.restUrl}/public/wallet-chrome'),
        headers: {'Accept': 'application/json'},
      );
      if (res.statusCode >= 300) {
        // 503 body.error is wallet_chrome_unavailable from DB (chrome bootstrap).
        String unavailable = '';
        try {
          final body = jsonDecode(res.body);
          if (body is Map && body['error'] is String) {
            unavailable = (body['error'] as String).trim();
          }
        } catch (_) {}
        emit(state.copyWith(
          chromeLoading: false,
          clearChrome: true,
          error: unavailable.isNotEmpty ? unavailable : null,
        ));
        return;
      }
      final chrome = WalletChrome.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      if (chrome == null || !chrome.isReady) {
        emit(state.copyWith(
          chromeLoading: false,
          clearChrome: true,
          error: chrome?.walletChromeUnavailable,
        ));
        return;
      }
      emit(state.copyWith(
          chrome: chrome, chromeLoading: false, clearError: true));
      unawaited(loadMyPayouts());
      unawaited(loadPayoutMethods());
      unawaited(loadCashEligibility());
    } catch (_) {
      emit(state.copyWith(chromeLoading: false, clearChrome: true));
    }
  }

  void setPayoutHistorySkip(int skip) {
    final next = skip < 0 ? 0 : skip;
    emit(state.copyWith(payoutHistorySkip: next));
    unawaited(SkipStore.write(_payoutsSkipKey, next));
    unawaited(loadMyPayouts());
  }

  Future<void> loadMyPayouts({String? focusId}) async {
    if (accessToken.isEmpty) return;
    final chrome = state.chrome;
    if (chrome == null || !chrome.payoutHistoryReady) return;
    final limit = chrome.payoutHistoryPageSizeInt;
    if (limit <= 0) return;
    final seekId = (focusId ?? focusPayoutHistoryId).trim();
    emit(state.copyWith(
      payoutHistoryLoading: true,
      clearPayoutHistoryError: true,
    ));
    try {
      final skip = state.payoutHistorySkip;
      final q = <String, String>{
        'skip': '$skip',
        'limit': '$limit',
        if (seekId.isNotEmpty) 'id': seekId,
      };
      final res = await http.get(
        Uri.parse('${_config.restUrl}/payouts/mine')
            .replace(queryParameters: q),
        headers: {'Authorization': 'Bearer $accessToken'},
      );
      if (res.statusCode >= 300) {
        emit(state.copyWith(
          payoutHistoryLoading: false,
          payoutHistoryError: chrome.payoutHistoryLoadFailed,
          myPayouts: const [],
          clearPayoutHistoryMeta: true,
        ));
        return;
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final list = (body['payouts'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(MyPayoutRequest.fromJson)
          .where((p) => p.id.isNotEmpty)
          .toList();
      final metaRaw = body['meta'];
      final meta = metaRaw is Map<String, dynamic>
          ? PayoutListMeta.fromJson(metaRaw)
          : null;
      final metaSkip = metaRaw is Map<String, dynamic>
          ? (metaRaw['skip'] is num ? (metaRaw['skip'] as num).toInt() : null)
          : null;
      // Adopt API seek skip only when we asked from skip 0 with a focus id.
      final adoptSeek =
          seekId.isNotEmpty && skip == 0 && metaSkip != null && metaSkip >= 0;
      emit(state.copyWith(
        payoutHistoryLoading: false,
        myPayouts: list,
        payoutHistoryMeta: meta,
        payoutHistorySkip: adoptSeek ? metaSkip : state.payoutHistorySkip,
        clearPayoutHistoryError: true,
      ));
    } catch (_) {
      emit(state.copyWith(
        payoutHistoryLoading: false,
        payoutHistoryError: chrome.payoutHistoryLoadFailed,
        myPayouts: const [],
        clearPayoutHistoryMeta: true,
      ));
    }
  }

  /// Public: map API `error_key` → cash chrome for callers outside this cubit
  /// (e.g. organizer create-event). Never surfaces raw JSON `error` bodies.
  String cashGateMessageForBody(String responseBody, String fallback) {
    return _cashGateChromeError(responseBody, fallback) ?? fallback.trim();
  }

  /// Map API `error_key` to cash / wallet chrome (never surface raw JSON bodies).
  String? _cashGateChromeError(String responseBody, String fallback) {
    final fb = fallback.trim();
    try {
      final map = jsonDecode(responseBody);
      if (map is! Map) return fb;
      final key = (map['error_key']?.toString() ?? '').trim();
      // Checkout provider failures → single checkout_failed chrome (not JSON / dual copy).
      if (key == 'checkout_unavailable' || key == 'checkout_failed') {
        final failed = state.chrome?.checkoutFailed.trim() ?? '';
        if (failed.isNotEmpty) return failed;
        final unavailable = state.chrome?.checkoutUnavailable.trim() ?? '';
        return unavailable.isNotEmpty ? unavailable : fb;
      }
      final c = state.cashRmgChrome;
      if (c == null || key.isEmpty) return fb;
      switch (key) {
        case 'age_required':
          return c.ageRequiredError.trim().isNotEmpty
              ? c.ageRequiredError.trim()
              : fb;
        case 'cash_disabled':
          return c.cashDisabledError.trim().isNotEmpty
              ? c.cashDisabledError.trim()
              : fb;
        case 'jurisdiction':
          return c.jurisdictionBlockedError.trim().isNotEmpty
              ? c.jurisdictionBlockedError.trim()
              : fb;
        case 'country_required':
          return c.countryRequiredError.trim().isNotEmpty
              ? c.countryRequiredError.trim()
              : fb;
        case 'locate_required':
          return c.locateRequiredError.trim().isNotEmpty
              ? c.locateRequiredError.trim()
              : fb;
        case 'locate_stale':
          return c.locateStaleError.trim().isNotEmpty
              ? c.locateStaleError.trim()
              : fb;
        case 'phone_kyc':
          return c.phoneKycRequiredError.trim().isNotEmpty
              ? c.phoneKycRequiredError.trim()
              : fb;
        default:
          return fb;
      }
    } catch (_) {
      return fb;
    }
  }

  /// Live kill switch + cash chrome errors (DB only, fail closed).
  Future<void> loadCashGate() async {
    try {
      final results = await Future.wait([
        http.get(Uri.parse('${_config.restUrl}/feature-flags')),
        http.get(Uri.parse('${_config.restUrl}/public/cash-rmg-chrome')),
      ]);
      bool enabled = false;
      var disabled = const <String>[];
      var cashDisabled = '';
      var jurisBlocked = '';
      CashRmgPolicy? policy;
      CashRmgChrome? cashChrome;
      if (results[0].statusCode == 200) {
        final map = jsonDecode(results[0].body);
        if (map is Map<String, dynamic>) {
          final flags = FeatureFlagsWire.fromJson(map);
          enabled = flags.cashRmgEnabled;
          disabled = flags.cashRmgDisabledCountries;
        }
      }
      if (results[1].statusCode == 200) {
        final map = jsonDecode(results[1].body);
        if (map is Map<String, dynamic>) {
          final payload = CashRmgPayload.fromJson(map);
          if (payload != null) {
            cashChrome = payload.chrome;
            cashDisabled = payload.chrome.cashDisabledError;
            jurisBlocked = payload.chrome.jurisdictionBlockedError;
            policy = payload.policy;
          } else {
            // Chrome incomplete: still surface DB unavailable copy (never invent).
            final chromeMap = map['chrome'];
            if (chromeMap is Map<String, dynamic>) {
              final unavailable =
                  (chromeMap['cash_rmg_unavailable'] as String?)?.trim() ?? '';
              if (unavailable.isNotEmpty) {
                cashDisabled = unavailable;
              }
            }
          }
        }
      }
      emit(state.copyWith(
        cashGateLoaded: true,
        cashRmgEnabled: enabled,
        cashRmgDisabledCountries: disabled,
        cashDisabledError: cashDisabled,
        jurisdictionBlockedError: jurisBlocked,
        cashRmgPolicy: policy,
        cashRmgChrome: cashChrome,
      ));
    } catch (_) {
      emit(state.copyWith(cashGateLoaded: true, cashRmgEnabled: false));
    }
  }

  void setDocKycApproved(bool approved) {
    emit(state.copyWith(docKycApproved: approved));
  }

  void setPayoutMethodsSkip(int skip) {
    final next = skip < 0 ? 0 : skip;
    emit(state.copyWith(payoutMethodsSkip: next));
    unawaited(SkipStore.write(_methodsSkipKey, next));
    unawaited(loadPayoutMethods());
  }

  Future<void> loadPayoutMethods() async {
    if (accessToken.isEmpty) return;
    final chrome = state.chrome;
    if (chrome == null || !chrome.payoutMethodsReady) return;
    final limit = chrome.payoutMethodsPageSizeInt;
    if (limit <= 0) return;
    emit(state.copyWith(
      payoutMethodsLoading: true,
      clearPayoutMethodsError: true,
    ));
    try {
      final skip = state.payoutMethodsSkip;
      final res = await http.get(
        Uri.parse('${_config.restUrl}/payouts/methods').replace(
          queryParameters: {'skip': '$skip', 'limit': '$limit'},
        ),
        headers: {'Authorization': 'Bearer $accessToken'},
      );
      if (res.statusCode >= 300) {
        emit(state.copyWith(
          payoutMethodsLoading: false,
          payoutMethodsError: chrome.payoutMethodsLoadFailed,
          payoutMethods: const [],
          clearPayoutMethodsMeta: true,
        ));
        return;
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final list = (body['methods'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(PayoutMethod.fromJson)
          .where((m) => m.id.isNotEmpty)
          .toList();
      final metaRaw = body['meta'];
      final meta = metaRaw is Map<String, dynamic>
          ? PayoutListMeta.fromJson(metaRaw)
          : null;
      emit(state.copyWith(
        payoutMethodsLoading: false,
        payoutMethods: list,
        payoutMethodsMeta: meta,
        clearPayoutMethodsError: true,
      ));
    } catch (_) {
      emit(state.copyWith(
        payoutMethodsLoading: false,
        payoutMethodsError: chrome.payoutMethodsLoadFailed,
        payoutMethods: const [],
        clearPayoutMethodsMeta: true,
      ));
    }
  }

  Future<void> loadCashEligibility() async {
    if (accessToken.isEmpty) {
      emit(state.copyWith(
          cashEligibilityLoaded: true, clearCashEligibility: true));
      return;
    }
    try {
      final cc = state.country.trim();
      final q = cc.isNotEmpty ? '?country_code=${Uri.encodeComponent(cc)}' : '';
      final res = await http.get(
        Uri.parse('${_config.restUrl}/me/cash-eligibility$q'),
        headers: {'Authorization': 'Bearer $accessToken'},
      );
      if (res.statusCode >= 300) {
        emit(state.copyWith(
          cashEligibilityLoaded: true,
          cashEligibility: const CashEligibility(
            ok: false,
            errorKey: '',
            ageVerified: false,
            phoneKycVerified: false,
          ),
          docKycApproved: false,
        ));
        return;
      }
      final body = jsonDecode(res.body);
      final eligibility = body is Map<String, dynamic>
          ? CashEligibility.fromJson(body)
          : const CashEligibility(
              ok: false,
              errorKey: '',
              ageVerified: false,
              phoneKycVerified: false,
            );
      emit(state.copyWith(
        cashEligibilityLoaded: true,
        cashEligibility: eligibility,
        docKycApproved: eligibility.documentKycApproved,
      ));
    } catch (_) {
      emit(state.copyWith(
        cashEligibilityLoaded: true,
        cashEligibility: const CashEligibility(
          ok: false,
          errorKey: '',
          ageVerified: false,
          phoneKycVerified: false,
        ),
        docKycApproved: false,
      ));
    }
  }

  Future<void> submitAgeGate(String dateOfBirthText) async {
    if (accessToken.isEmpty) {
      emit(state.copyWith(error: state.chrome?.signInRequired));
      return;
    }
    final cashChrome = state.cashRmgChrome;
    if (cashChrome == null || !cashChrome.isReady) {
      emit(state.copyWith(error: cashChrome?.cashRmgUnavailable));
      return;
    }
    final dobRaw = dateOfBirthText.trim();
    if (dobRaw.isEmpty) return;
    final parsed = parseFlexibleDate(dobRaw);
    final isoDob = parsed != null ? toIsoDate(parsed) : dobRaw;
    emit(state.copyWith(
        loading: true, clearError: true, clearCheckoutMessage: true));
    try {
      final locateHeaders = {
        'Authorization': 'Bearer $accessToken',
        'Content-Type': 'application/json',
      };
      await http.post(
        Uri.parse('${_config.restUrl}/geo/locate'),
        headers: locateHeaders,
        body: '{}',
      );
      final res = await http.put(
        Uri.parse('${_config.restUrl}/me/age-gate'),
        headers: locateHeaders,
        body: jsonEncode({'date_of_birth': isoDob}),
      );
      Map<String, dynamic>? json;
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) json = decoded;
      } catch (_) {}
      if (res.statusCode >= 300) {
        final errBody = (json?['error']?.toString() ?? '').trim();
        final tooYoung = cashChrome.ageGateTooYoung.trim();
        emit(state.copyWith(
          loading: false,
          error: tooYoung.isNotEmpty && errBody == tooYoung
              ? tooYoung
              : cashChrome.ageGateFailed,
        ));
        return;
      }
      emit(state.copyWith(
        loading: false,
        checkoutMessage: cashChrome.ageGateSuccess,
        clearError: true,
      ));
      await loadCashEligibility();
    } catch (_) {
      emit(state.copyWith(loading: false, error: cashChrome.ageGateFailed));
    }
  }

  Future<bool> createPayoutMethod() async {
    if (accessToken.isEmpty) {
      emit(state.copyWith(error: state.chrome?.signInRequired));
      return false;
    }
    final chrome = state.chrome;
    if (chrome == null || !chrome.isReady) {
      emit(state.copyWith(error: chrome?.walletChromeUnavailable));
      return false;
    }
    final provider = state.payoutProvider.trim();
    final accountName = state.payoutAccountName.trim();
    final phone = state.payoutPhone.trim();
    if (provider.isEmpty || accountName.isEmpty || phone.length < 8) {
      emit(state.copyWith(error: chrome.payoutPhoneRequired));
      return false;
    }
    emit(state.copyWith(
        loading: true, clearError: true, clearCheckoutMessage: true));
    try {
      final res = await http.post(
        Uri.parse('${_config.restUrl}/payouts/methods'),
        headers: {
          'Authorization': 'Bearer $accessToken',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'provider': provider,
          'account_name': accountName,
          'phone': phone,
        }),
      );
      if (res.statusCode >= 300) {
        emit(state.copyWith(
            loading: false, error: chrome.payoutMethodSaveFailed));
        return false;
      }
      emit(state.copyWith(
        loading: false,
        checkoutMessage: chrome.payoutMethodSaved,
        clearError: true,
      ));
      unawaited(loadPayoutMethods());
      return true;
    } catch (_) {
      emit(
          state.copyWith(loading: false, error: chrome.payoutMethodSaveFailed));
      return false;
    }
  }

  Future<bool> updatePayoutMethod(String id) async {
    if (accessToken.isEmpty) {
      emit(state.copyWith(error: state.chrome?.signInRequired));
      return false;
    }
    final chrome = state.chrome;
    if (chrome == null || !chrome.isReady) {
      emit(state.copyWith(error: chrome?.walletChromeUnavailable));
      return false;
    }
    final methodId = id.trim();
    if (methodId.isEmpty) return false;
    final provider = state.payoutProvider.trim();
    final accountName = state.payoutAccountName.trim();
    final phone = state.payoutPhone.trim();
    if (provider.isEmpty || accountName.isEmpty || phone.length < 8) {
      emit(state.copyWith(error: chrome.payoutPhoneRequired));
      return false;
    }
    emit(state.copyWith(
        loading: true, clearError: true, clearCheckoutMessage: true));
    try {
      final res = await http.patch(
        Uri.parse('${_config.restUrl}/payouts/methods/$methodId'),
        headers: {
          'Authorization': 'Bearer $accessToken',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'provider': provider,
          'account_name': accountName,
          'phone': phone,
        }),
      );
      if (res.statusCode >= 300) {
        emit(state.copyWith(
            loading: false, error: chrome.payoutMethodSaveFailed));
        return false;
      }
      emit(state.copyWith(
        loading: false,
        checkoutMessage: chrome.payoutMethodUpdated,
        clearError: true,
      ));
      unawaited(loadPayoutMethods());
      return true;
    } catch (_) {
      emit(
          state.copyWith(loading: false, error: chrome.payoutMethodSaveFailed));
      return false;
    }
  }

  Future<bool> deletePayoutMethod(String id) async {
    if (accessToken.isEmpty) {
      emit(state.copyWith(error: state.chrome?.signInRequired));
      return false;
    }
    final chrome = state.chrome;
    if (chrome == null || !chrome.isReady) {
      emit(state.copyWith(error: chrome?.walletChromeUnavailable));
      return false;
    }
    final methodId = id.trim();
    if (methodId.isEmpty) return false;
    emit(state.copyWith(
        loading: true, clearError: true, clearCheckoutMessage: true));
    try {
      final res = await http.delete(
        Uri.parse('${_config.restUrl}/payouts/methods/$methodId'),
        headers: {'Authorization': 'Bearer $accessToken'},
      );
      if (res.statusCode >= 300) {
        emit(state.copyWith(
            loading: false, error: chrome.payoutMethodDeleteFailed));
        return false;
      }
      emit(state.copyWith(
        loading: false,
        checkoutMessage: chrome.payoutMethodDeleted,
        clearError: true,
      ));
      unawaited(loadPayoutMethods());
      return true;
    } catch (_) {
      emit(state.copyWith(
          loading: false, error: chrome.payoutMethodDeleteFailed));
      return false;
    }
  }

  Future<void> loadBanks() async {
    if (!state.isManualTransfer) {
      emit(state.copyWith(banks: const [], banksLoading: false));
      return;
    }
    emit(state.copyWith(banksLoading: true));
    try {
      final res = await http.get(
        Uri.parse('${_config.restUrl}/payments/banks'),
        headers: {'Accept': 'application/json'},
      );
      if (res.statusCode >= 300) {
        emit(state.copyWith(banks: const [], banksLoading: false));
        return;
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final list = (body['banks'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(PaymentBank.fromJson)
          .where((b) => b.id.isNotEmpty)
          .toList();
      emit(state.copyWith(banks: list, banksLoading: false));
    } catch (_) {
      emit(state.copyWith(banks: const [], banksLoading: false));
    }
  }

  Future<void> requestPayout() async {
    if (accessToken.isEmpty) {
      emit(state.copyWith(error: state.chrome?.signInRequired));
      return;
    }
    if (state.cashLocked) {
      emit(state.copyWith(error: state.cashLockMessage));
      return;
    }
    if (state.ageRequired) {
      final msg = state.cashRmgChrome?.ageRequiredError.trim() ?? '';
      if (msg.isNotEmpty) emit(state.copyWith(error: msg));
      return;
    }
    if (state.phoneRequired) {
      final msg = state.cashRmgChrome?.phoneKycRequiredError.trim() ?? '';
      if (msg.isNotEmpty) emit(state.copyWith(error: msg));
      return;
    }
    final chrome = state.chrome;
    if (chrome == null || !chrome.isReady) {
      emit(state.copyWith(error: chrome?.walletChromeUnavailable));
      return;
    }
    final methodId = (state.firstPayoutMethod?.id ?? '').trim();
    if (methodId.isEmpty) {
      emit(state.copyWith(error: chrome.payoutPhoneRequired));
      return;
    }
    if (state.cashRmgPolicy?.requireDocumentKycForPayout == true &&
        !state.docKycApproved) {
      emit(state.copyWith(error: chrome.documentKycRequired));
      return;
    }
    final amount = double.tryParse(state.payoutAmountText.trim());
    final currency = (state.currencyLabel ?? '').trim().toUpperCase();
    if (amount == null || amount <= 0 || currency.isEmpty) {
      emit(state.copyWith(error: chrome.payoutAmountCurrencyRequired));
      return;
    }
    emit(state.copyWith(
        loading: true, clearError: true, clearCheckoutMessage: true));
    try {
      final res = await http.post(
        Uri.parse('${_config.restUrl}/payouts/request'),
        headers: {
          'Authorization': 'Bearer $accessToken',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'amount': amount,
          'currency': currency,
          'country_code': state.country.trim().toUpperCase(),
          'method_id': methodId,
        }),
      );
      if (res.statusCode >= 300) {
        emit(state.copyWith(
          loading: false,
          error: _cashGateChromeError(res.body, chrome.payoutRequestFailed),
        ));
        return;
      }
      QueryCache.invalidatePrefix('session:wallet');
      emit(state.copyWith(
        loading: false,
        checkoutMessage: chrome.payoutRequestSubmitted,
        clearError: true,
      ));
      unawaited(loadMyPayouts());
      await refresh(force: true);
    } catch (_) {
      emit(state.copyWith(loading: false, error: chrome.payoutRequestFailed));
    }
  }

  Future<void> autoLocate() async {
    final cachedCountry = QueryCache.read<String>(
      CacheKeys.lastGeoCountry(accessToken),
      maxAge: QueryCache.geoTtl,
      allowStale: true,
    );
    if (cachedCountry != null && cachedCountry.isNotEmpty) {
      emit(state.copyWith(
          country: cachedCountry, locating: false, clearError: true));
      final walletCached = QueryCache.read<WalletCacheSnapshot>(
        CacheKeys.wallet(accessToken, cachedCountry),
        maxAge: QueryCache.sessionTtl,
        allowStale: true,
      );
      if (walletCached != null) {
        emit(state.copyWith(
          country: cachedCountry,
          balance: walletCached.balance,
          walletCurrency: walletCached.walletCurrency,
          routeProvider: walletCached.routeProvider,
          routeCurrency: walletCached.routeCurrency,
          locating: false,
          loading: false,
          clearError: true,
        ));
        unawaited(refresh(force: true));
        return;
      }
    }

    emit(state.copyWith(locating: true, clearError: true));
    try {
      final headers = <String, String>{'Content-Type': 'application/json'};
      if (accessToken.isNotEmpty) {
        headers['Authorization'] = 'Bearer $accessToken';
      }
      final res = await http.post(
        Uri.parse('${_config.restUrl}/geo/locate'),
        headers: headers,
        body: '{}',
      );
      if (res.statusCode == 200) {
        final locate = GeoLocateResponse.fromJson(
          jsonDecode(res.body) as Map<String, dynamic>,
        );
        // Server geo only (reference pay chain; no profile-country fallback).
        final cc = (locate.location?.countryCode ?? '').trim().toUpperCase();
        if (cc.length == 2) {
          QueryCache.write(CacheKeys.lastGeoCountry(accessToken), cc);
          emit(state.copyWith(
            country: cc,
            routeProvider: locate.route?.provider,
            routeCurrency: locate.route?.currency,
            locating: false,
            clearError: true,
          ));
          await refresh();
          unawaited(loadPayoutMethods());
          unawaited(loadCashEligibility());
          return;
        }
        emit(state.copyWith(
          locating: false,
          error: state.chrome?.locationCurrencyUnresolved ??
              state.chrome?.locationGeoFailed ??
              '',
        ));
        return;
      }
      emit(state.copyWith(
          locating: false, error: state.chrome?.locationUnavailable ?? ''));
    } catch (_) {
      emit(state.copyWith(
          locating: false, error: state.chrome?.locationUnavailable ?? ''));
    }
  }

  Future<void> refresh({bool force = false}) async {
    final country = state.country.trim().toUpperCase();
    if (country.isEmpty) {
      emit(state.copyWith(error: state.chrome?.countryUnresolved ?? ''));
      return;
    }
    final cacheKey = CacheKeys.wallet(accessToken, country);
    if (!force) {
      final cached = QueryCache.read<WalletCacheSnapshot>(
        cacheKey,
        maxAge: QueryCache.sessionTtl,
        allowStale: true,
      );
      if (cached != null) {
        emit(state.copyWith(
          balance: cached.balance,
          walletCurrency: cached.walletCurrency,
          routeProvider: cached.routeProvider,
          routeCurrency: cached.routeCurrency,
          loading: false,
          clearError: true,
        ));
        unawaited(refresh(force: true));
        return;
      }
    }
    final showSkeleton = state.balance == null && state.routeProvider == null;
    emit(state.copyWith(loading: showSkeleton, clearError: true));
    try {
      String? routeProvider = state.routeProvider;
      String? routeCurrency = state.routeCurrency;
      double? balance = state.balance;
      String? walletCurrency = state.walletCurrency;
      String? error;

      // Server resolves payer country from request IP (reference pay chain).
      final routeRes = await http.get(
        Uri.parse('${_config.restUrl}/payments/route'),
      );
      if (routeRes.statusCode == 200) {
        final route = PaymentRoute.fromJson(
          jsonDecode(routeRes.body) as Map<String, dynamic>,
        );
        routeProvider = route.provider;
        routeCurrency = route.currency;
      } else {
        error = state.chrome?.paymentRouteUnavailable ?? '';
      }
      if (accessToken.isNotEmpty) {
        final walletRes = await http.get(
          Uri.parse('${_config.restUrl}/payments/wallet'),
          headers: {'Authorization': 'Bearer $accessToken'},
        );
        if (walletRes.statusCode == 200) {
          final wallet = WalletSnapshot.fromJson(
            jsonDecode(walletRes.body) as Map<String, dynamic>,
          );
          balance = wallet.balance;
          walletCurrency = wallet.currency;
        } else {
          error = state.chrome?.walletUnavailable ?? '';
        }
      }
      QueryCache.write(
        cacheKey,
        WalletCacheSnapshot(
          country: country,
          balance: balance,
          walletCurrency: walletCurrency,
          routeProvider: routeProvider,
          routeCurrency: routeCurrency,
        ),
      );
      emit(state.copyWith(
        balance: balance,
        walletCurrency: walletCurrency,
        routeProvider: routeProvider,
        routeCurrency: routeCurrency,
        loading: false,
        error: error,
        clearError: error == null,
      ));
      if (routeProvider == 'manual_transfer') {
        unawaited(loadBanks());
      } else {
        emit(state.copyWith(banks: const [], banksLoading: false));
      }
    } catch (_) {
      emit(state.copyWith(
        loading: false,
        error: state.chrome?.walletLoadFailed ?? '',
      ));
    }
  }

  /// Returns the checkout payload on success (manual banks / gateway URL), else null.
  Future<CheckoutResponse?> checkout() async {
    if (accessToken.isEmpty) {
      emit(state.copyWith(error: state.chrome?.signInRequiredCheckout));
      return null;
    }
    if (state.cashLocked) {
      emit(state.copyWith(error: state.cashLockMessage));
      return null;
    }
    if (state.ageRequired) {
      final msg = state.cashRmgChrome?.ageRequiredError.trim() ?? '';
      if (msg.isNotEmpty) emit(state.copyWith(error: msg));
      return null;
    }
    if (state.phoneRequired) {
      final msg = state.cashRmgChrome?.phoneKycRequiredError.trim() ?? '';
      if (msg.isNotEmpty) emit(state.copyWith(error: msg));
      return null;
    }
    final country = state.country.trim().toUpperCase();
    if (country.isEmpty) {
      emit(state.copyWith(error: state.chrome?.countryRequiredCheckout));
      return null;
    }
    final amount = double.tryParse(state.amountText.trim());
    if (amount == null || amount <= 0) {
      emit(state.copyWith(error: state.chrome?.invalidTopUpAmount));
      return null;
    }
    emit(state.copyWith(
        loading: true, clearError: true, clearCheckoutMessage: true));
    try {
      final res = await http.post(
        Uri.parse('${_config.restUrl}/payments/checkout'),
        headers: {
          'Authorization': 'Bearer $accessToken',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'amount': amount,
          'purpose': 'wallet_topup',
          'country_code': country,
        }),
      );
      if (res.statusCode >= 300) {
        // Chrome-only - prefer checkout_failed; never surface raw JSON bodies.
        emit(state.copyWith(
          loading: false,
          error: checkoutChromeMessage(
            responseBody: res.body,
            checkoutFailed: state.chrome?.checkoutFailed,
            checkoutUnavailable: state.chrome?.checkoutUnavailable,
          ),
        ));
        return null;
      }
      final checkout = CheckoutResponse.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      final cur = checkout.route?.currency ?? '';
      final ready = state.chrome?.checkoutReady ?? '';
      final open = state.chrome?.parenOpen ?? '';
      final close = state.chrome?.parenClose ?? '';
      QueryCache.invalidatePrefix('session:wallet');

      final url = (checkout.intent?.checkoutUrl ?? '').trim();
      final manual = _isManualCheckout(checkout);
      if (!manual && url.isNotEmpty) {
        final uri = Uri.tryParse(url);
        if (uri != null) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        }
      }
      if (checkout.banks.isNotEmpty) {
        emit(state.copyWith(banks: checkout.banks));
      }

      emit(state.copyWith(
        loading: false,
        checkoutMessage: cur.isEmpty || open.isEmpty || close.isEmpty
            ? ready
            : '$ready$open$cur$close',
        clearError: true,
      ));
      await refresh(force: true);
      return checkout;
    } catch (_) {
      final fail = (state.chrome?.checkoutFailed.trim().isNotEmpty == true)
          ? state.chrome!.checkoutFailed.trim()
          : (state.chrome?.checkoutUnavailable ?? '');
      emit(state.copyWith(loading: false, error: fail));
      return null;
    }
  }

  static bool _isManualCheckout(CheckoutResponse checkout) {
    final provider =
        (checkout.route?.provider ?? checkout.intent?.provider ?? '')
            .trim()
            .toLowerCase();
    if (provider == 'manual_transfer' || provider == 'manual') return true;
    final status = (checkout.intent?.status ?? '').trim().toLowerCase();
    if (status == 'awaiting_receipt') return true;
    return checkout.banks.isNotEmpty;
  }

  void clearReceiptUrl() {
    emit(state.copyWith(clearReceiptUrl: true, clearError: true));
  }

  Future<void> pickAndUploadReceipt() async {
    final file = await _picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 2048,
      maxHeight: 2048,
      imageQuality: 90,
    );
    if (file == null) return;
    await uploadReceiptFile(file);
  }

  Future<void> uploadReceiptFile(XFile file) async {
    final chrome = state.chrome;
    if (accessToken.isEmpty || chrome == null || !chrome.isReady) return;
    emit(state.copyWith(loading: true, clearError: true));
    try {
      final uri = Uri.parse('${_config.restUrl}/payments/receipts/upload');
      final req = http.MultipartRequest('POST', uri);
      req.headers['Authorization'] = 'Bearer $accessToken';
      req.files.add(await http.MultipartFile.fromPath(
        'file',
        file.path,
        contentType: MediaType('image', 'jpeg'),
        filename: file.name,
      ));
      final streamed = await req.send();
      final body = await streamed.stream.bytesToString();
      if (streamed.statusCode >= 300) {
        emit(state.copyWith(loading: false, error: chrome.receiptUploadFailed));
        return;
      }
      final map = jsonDecode(body) as Map<String, dynamic>;
      final url = (map['receipt_url'] as String? ?? '').trim();
      if (url.isEmpty) {
        emit(state.copyWith(loading: false, error: chrome.receiptUploadFailed));
        return;
      }
      emit(state.copyWith(
        loading: false,
        receiptUrl: url,
        checkoutMessage: '${chrome.receiptUploadedPrefix} $url',
        clearError: true,
      ));
    } catch (_) {
      emit(state.copyWith(loading: false, error: chrome.receiptUploadFailed));
    }
  }

  Future<void> submitReceipt({String intentId = ''}) async {
    final chrome = state.chrome;
    if (accessToken.isEmpty || chrome == null || !chrome.isReady) return;
    final country = state.country.trim().toUpperCase();
    final amount = double.tryParse(state.amountText.trim());
    final receiptUrl = state.receiptUrl.trim();
    final claimIntentId = intentId.trim();
    if (amount == null ||
        amount <= 0 ||
        receiptUrl.isEmpty ||
        country.isEmpty) {
      emit(state.copyWith(error: chrome.receiptSubmitFailed));
      return;
    }
    emit(state.copyWith(
        loading: true, clearError: true, clearCheckoutMessage: true));
    try {
      final body = <String, dynamic>{
        'amount': amount,
        'currency': state.routeCurrency,
        'receipt_url': receiptUrl,
        'country_code': country,
      };
      if (claimIntentId.isNotEmpty) {
        body['intent_id'] = claimIntentId;
      }
      final res = await http.post(
        Uri.parse('${_config.restUrl}/payments/receipts'),
        headers: {
          'Authorization': 'Bearer $accessToken',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(body),
      );
      if (res.statusCode >= 300) {
        final unavailable =
            res.statusCode == 409 && chrome.receiptIntentUnavailable.isNotEmpty;
        emit(state.copyWith(
          loading: false,
          error: unavailable
              ? chrome.receiptIntentUnavailable
              : chrome.receiptSubmitFailed,
        ));
        return;
      }
      QueryCache.invalidatePrefix('session:wallet');
      emit(state.copyWith(
        loading: false,
        checkoutMessage: chrome.receiptSubmitted,
        clearReceiptUrl: true,
        clearError: true,
      ));
      await refresh(force: true);
    } catch (_) {
      emit(state.copyWith(loading: false, error: chrome.receiptSubmitFailed));
    }
  }
}
