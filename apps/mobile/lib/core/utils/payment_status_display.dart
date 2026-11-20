import 'package:flutter/material.dart';

/// Shared paid/settled status display (parity with web/admin `--dama-success`).
const Color kPaymentPaidGreen = Color(0xFF27A644);

/// Prefer API `display_status`; map settled `approved` proofs to `paid`.
String receiptDisplayStatusCode({
  String? displayStatus,
  String? status,
}) {
  final display = (displayStatus ?? '').trim();
  if (display.isNotEmpty) return display;
  final raw = (status ?? '').trim();
  if (raw.toLowerCase() == 'approved') return 'paid';
  return raw;
}

/// Orphan manual receipt topups (id == receiptId, status approved) display as paid.
/// Never rewrite payout `approved`.
String txnDisplayStatusCode({
  required String kind,
  required String id,
  required String status,
  String receiptId = '',
}) {
  final st = status.trim();
  final k = kind.trim().toLowerCase();
  final rowId = id.trim();
  final rid = receiptId.trim();
  if (k == 'topup' &&
      rid.isNotEmpty &&
      rowId.isNotEmpty &&
      rid == rowId &&
      st.toLowerCase() == 'approved') {
    return 'paid';
  }
  return st;
}

bool isPaidStatusCode(String code) => code.trim().toLowerCase() == 'paid';

Color? paidStatusForeground(String code, {Color? fallback}) {
  if (isPaidStatusCode(code)) return kPaymentPaidGreen;
  return fallback;
}
