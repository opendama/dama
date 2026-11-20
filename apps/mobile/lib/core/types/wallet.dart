/// Geo resolve location fragment.
class GeoLocation {
  const GeoLocation({this.countryCode, this.region, this.city});

  final String? countryCode;
  final String? region;
  final String? city;

  factory GeoLocation.fromJson(Map<String, dynamic> json) {
    return GeoLocation(
      countryCode:
          (json['country_code'] as String? ?? json['countryCode'] as String?)
              ?.trim()
              .toUpperCase(),
      region: json['region'] as String?,
      city: json['city'] as String?,
    );
  }
}

/// Payment routing for a country.
class PaymentRoute {
  const PaymentRoute({this.provider, this.currency});

  final String? provider;
  final String? currency;

  bool get isManualTransfer => provider == 'manual_transfer';

  factory PaymentRoute.fromJson(Map<String, dynamic> json) {
    return PaymentRoute(
      provider: json['provider'] as String?,
      currency: json['currency'] as String?,
    );
  }
}

/// Public bank account for manual transfer top-ups.
class PaymentBank {
  const PaymentBank({
    required this.id,
    required this.provider,
    required this.label,
    required this.currency,
    this.accountName,
    this.accountNumber,
    this.mobileCode,
  });

  final String id;
  final String provider;
  final String label;
  final String currency;
  final String? accountName;
  final String? accountNumber;
  final String? mobileCode;

  factory PaymentBank.fromJson(Map<String, dynamic> json) {
    return PaymentBank(
      id: json['id']?.toString() ?? '',
      provider: json['provider']?.toString() ?? '',
      label: json['label']?.toString() ?? '',
      currency: json['currency']?.toString() ?? '',
      accountName:
          json['account_name'] as String? ?? json['accountName'] as String?,
      accountNumber:
          json['account_number'] as String? ?? json['accountNumber'] as String?,
      mobileCode:
          json['mobile_code'] as String? ?? json['mobileCode'] as String?,
    );
  }
}

/// Wallet balance for a country.
class WalletSnapshot {
  const WalletSnapshot({this.balance, this.currency});

  final double? balance;
  final String? currency;

  factory WalletSnapshot.fromJson(Map<String, dynamic> json) {
    return WalletSnapshot(
      balance: (json['balance'] as num?)?.toDouble(),
      currency: json['currency'] as String?,
    );
  }
}

/// Wallet screen snapshot for TTL reuse across geo + balance + route.
class WalletCacheSnapshot {
  const WalletCacheSnapshot({
    required this.country,
    this.balance,
    this.walletCurrency,
    this.routeProvider,
    this.routeCurrency,
  });

  final String country;
  final double? balance;
  final String? walletCurrency;
  final String? routeProvider;
  final String? routeCurrency;
}

/// `POST /geo/locate` response.
class GeoLocateResponse {
  const GeoLocateResponse({this.location, this.route});

  final GeoLocation? location;
  final PaymentRoute? route;

  factory GeoLocateResponse.fromJson(Map<String, dynamic> json) {
    final loc = json['location'];
    final route = json['route'];
    return GeoLocateResponse(
      location: loc is Map<String, dynamic> ? GeoLocation.fromJson(loc) : null,
      route:
          route is Map<String, dynamic> ? PaymentRoute.fromJson(route) : null,
    );
  }
}

/// Checkout intent (Chapa / Paddle / manual).
class CheckoutIntent {
  const CheckoutIntent({
    this.id,
    this.amount,
    this.currency,
    this.provider,
    this.txRef,
    this.checkoutUrl,
    this.status,
  });

  final String? id;
  final double? amount;
  final String? currency;
  final String? provider;
  final String? txRef;
  final String? checkoutUrl;
  final String? status;

  factory CheckoutIntent.fromJson(Map<String, dynamic> json) {
    return CheckoutIntent(
      id: json['id']?.toString(),
      amount: (json['amount'] as num?)?.toDouble(),
      currency: json['currency'] as String?,
      provider: json['provider'] as String?,
      txRef: json['tx_ref'] as String? ?? json['txRef'] as String?,
      checkoutUrl:
          json['checkout_url'] as String? ?? json['checkoutUrl'] as String?,
      status: json['status'] as String?,
    );
  }
}

/// Checkout success payload (route + intent + optional banks).
class CheckoutResponse {
  const CheckoutResponse({this.route, this.intent, this.banks = const []});

  final PaymentRoute? route;
  final CheckoutIntent? intent;
  final List<PaymentBank> banks;

  factory CheckoutResponse.fromJson(Map<String, dynamic> json) {
    final route = json['route'];
    final intent = json['intent'];
    final banksRaw = json['banks'] as List<dynamic>? ?? const [];
    return CheckoutResponse(
      route:
          route is Map<String, dynamic> ? PaymentRoute.fromJson(route) : null,
      intent: intent is Map<String, dynamic>
          ? CheckoutIntent.fromJson(intent)
          : null,
      banks: banksRaw
          .whereType<Map<String, dynamic>>()
          .map(PaymentBank.fromJson)
          .where((b) => b.id.isNotEmpty)
          .toList(),
    );
  }
}
