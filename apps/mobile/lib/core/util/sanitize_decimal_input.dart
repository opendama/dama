/// Digits + optional single decimal - rejects letters (web/admin parity).
String sanitizeDecimalInput(String raw, {int maxDecimals = 2}) {
  var s = raw.replaceAll(RegExp(r'[^\d.]'), '');
  final dot = s.indexOf('.');
  if (dot != -1) {
    final whole = s.substring(0, dot + 1);
    final frac = s.substring(dot + 1).replaceAll('.', '');
    s = frac.length > maxDecimals
        ? '$whole${frac.substring(0, maxDecimals)}'
        : '$whole$frac';
  }
  if (s.startsWith('.')) s = '0$s';
  return s;
}

double? parsePositiveDecimal(String raw) {
  final n = double.tryParse(raw.trim());
  if (n == null || !n.isFinite || n <= 0) return null;
  return n;
}
