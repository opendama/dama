// US-style date masks for calendar fields (parity with web shadcn DateField).
// Internal/API values stay ISO (`YYYY-MM-DD` / ISO-8601); UI shows `mm/dd/yyyy`.

String formatUsDate(DateTime d) {
  final m = d.month.toString().padLeft(2, '0');
  final day = d.day.toString().padLeft(2, '0');
  return '$m/$day/${d.year}';
}

String formatUsDateTime(DateTime d) {
  final date = formatUsDate(d);
  var h = d.hour;
  final ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h == 0) h = 12;
  final mm = d.minute.toString().padLeft(2, '0');
  return '$date ${h.toString().padLeft(2, '0')}:$mm $ampm';
}

String toIsoDate(DateTime d) {
  final y = d.year.toString().padLeft(4, '0');
  final m = d.month.toString().padLeft(2, '0');
  final day = d.day.toString().padLeft(2, '0');
  return '$y-$m-$day';
}

/// Accepts `YYYY-MM-DD`, ISO-8601, or `mm/dd/yyyy`.
DateTime? parseFlexibleDate(String raw) {
  final t = raw.trim();
  if (t.isEmpty) return null;
  final mask = RegExp(r'^(\d{2})/(\d{2})/(\d{4})$').firstMatch(t);
  if (mask != null) {
    final mo = int.tryParse(mask.group(1)!);
    final day = int.tryParse(mask.group(2)!);
    final y = int.tryParse(mask.group(3)!);
    if (mo == null || day == null || y == null) return null;
    return DateTime(y, mo, day);
  }
  final iso = DateTime.tryParse(t);
  if (iso == null) return null;
  return DateTime(iso.year, iso.month, iso.day);
}

/// Accepts ISO-8601 or `mm/dd/yyyy hh:mm AM/PM`.
DateTime? parseFlexibleDateTime(String raw) {
  final t = raw.trim();
  if (t.isEmpty) return null;
  final mask = RegExp(
    r'^(\d{2})/(\d{2})/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$',
    caseSensitive: false,
  ).firstMatch(t);
  if (mask != null) {
    final mo = int.tryParse(mask.group(1)!);
    final day = int.tryParse(mask.group(2)!);
    final y = int.tryParse(mask.group(3)!);
    var h = int.tryParse(mask.group(4)!);
    final mi = int.tryParse(mask.group(5)!);
    final ap = (mask.group(6) ?? '').toUpperCase();
    if (mo == null || day == null || y == null || h == null || mi == null) {
      return null;
    }
    if (ap == 'PM' && h < 12) h += 12;
    if (ap == 'AM' && h == 12) h = 0;
    return DateTime(y, mo, day, h, mi);
  }
  return DateTime.tryParse(t);
}
