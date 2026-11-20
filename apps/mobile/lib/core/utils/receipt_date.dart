/// Trim / Paddle invoice day: "10th October 2026" (UTC calendar day, no time).
String formatReceiptDay(String? raw, {String empty = ''}) {
  final t = (raw ?? '').trim();
  if (t.isEmpty) return empty;
  final d = DateTime.tryParse(t);
  if (d == null) return empty;
  final utc = d.toUtc();
  const months = <String>[
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  final day = utc.day;
  return '$day${englishDayOrdinal(day)} ${months[utc.month - 1]} ${utc.year}';
}

String englishDayOrdinal(int d) {
  if (d % 100 >= 11 && d % 100 <= 13) return 'th';
  switch (d % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

/// Human payment-method line (never the raw channel slug).
String paymentMethodDisplay(String? provider) {
  switch ((provider ?? '').trim().toLowerCase()) {
    case 'manual_transfer':
    case 'manual':
      return 'Manual bank transfer';
    case 'local_checkout':
    case 'chapa':
      return 'Local checkout';
    case 'international_checkout':
    case 'paddle':
      return 'Card payment';
    default:
      return '';
  }
}
