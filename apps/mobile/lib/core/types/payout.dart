class PayoutMethod {
  const PayoutMethod({
    required this.id,
    required this.provider,
    required this.accountName,
    required this.phone,
  });

  final String id;
  final String provider;
  final String accountName;
  final String phone;

  factory PayoutMethod.fromJson(Map<String, dynamic> json) {
    return PayoutMethod(
      id: (json['id']?.toString() ?? '').trim(),
      provider: (json['provider'] as String?)?.trim() ?? '',
      accountName: (json['account_name'] as String?)?.trim() ?? '',
      phone: (json['phone'] as String?)?.trim() ?? '',
    );
  }

  bool get hasPrimaryPhone => phone.trim().length >= 8;
}

/// Skip pager meta from list endpoints (`methods`, `payouts/mine`, …).
class PayoutListMeta {
  const PayoutListMeta({
    this.prevSkip,
    this.nextSkip,
    this.totalPages = 0,
    this.prevActionLabel = '',
    this.nextActionLabel = '',
    this.pageSummary = '',
  });

  final int? prevSkip;
  final int? nextSkip;
  final int totalPages;
  final String prevActionLabel;
  final String nextActionLabel;
  final String pageSummary;

  factory PayoutListMeta.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const PayoutListMeta();
    int? asInt(dynamic v) => v is num ? v.toInt() : null;
    return PayoutListMeta(
      prevSkip: asInt(json['prev_skip']),
      nextSkip: asInt(json['next_skip']),
      totalPages: asInt(json['total_pages']) ?? 0,
      prevActionLabel: (json['prev_action_label'] as String?)?.trim() ?? '',
      nextActionLabel: (json['next_action_label'] as String?)?.trim() ?? '',
      pageSummary: (json['page_summary'] as String?)?.trim() ?? '',
    );
  }
}

class MyPayoutRequest {
  const MyPayoutRequest({
    required this.id,
    this.amount,
    required this.currency,
    required this.status,
    required this.createdAt,
    this.provider = '',
    this.phone = '',
    this.statusLabel = '',
    this.reviewNote = '',
    this.reviewedAt = '',
  });

  final String id;

  /// Null when API omits amount (never invent 0).
  final double? amount;
  final String currency;
  final String status;
  final String createdAt;
  final String provider;
  final String phone;

  /// API-stamped wallet_chrome list_status_* (fail closed empty).
  final String statusLabel;

  /// Admin review note from payout_requests.review_note.
  final String reviewNote;

  /// When admin completed review (ISO from API).
  final String reviewedAt;

  factory MyPayoutRequest.fromJson(Map<String, dynamic> json) {
    final amountRaw = json['amount'];
    return MyPayoutRequest(
      id: json['id']?.toString() ?? '',
      amount: amountRaw is num ? amountRaw.toDouble() : null,
      currency: (json['currency'] as String?)?.trim() ?? '',
      status: (json['status'] as String?)?.trim() ?? '',
      createdAt: (json['created_at'] as String?)?.trim() ?? '',
      provider: (json['provider'] as String?)?.trim() ?? '',
      phone: (json['phone'] as String?)?.trim() ?? '',
      statusLabel: (json['status_label'] as String?)?.trim() ?? '',
      reviewNote: (json['review_note'] as String?)?.trim() ?? '',
      reviewedAt: (json['reviewed_at'] as String?)?.trim() ?? '',
    );
  }
}

typedef PayoutHistoryMeta = PayoutListMeta;
