/// Prize payout helpers (parity with apps/web/src/lib/competition-payout.ts).
library;

String defaultPayoutModeForFormat(
  Map<String, dynamic>? enums,
  String formatId,
) {
  if (enums == null) return '';
  final id = formatId.trim();
  String enumStr(String k) => (enums[k] as String?)?.trim() ?? '';

  final ko = enumStr('hosted_event_knockout_format');
  if (id.isNotEmpty && id == ko) {
    return enumStr('competition_default_payout_mode_knockout');
  }
  final rr = enumStr('hosted_event_round_robin_format');
  if (id.isNotEmpty && id == rr) {
    return enumStr('competition_default_payout_mode_round_robin');
  }
  final arena = enumStr('hosted_event_arena_format');
  if (id.isNotEmpty && arena.isNotEmpty && id == arena) {
    return enumStr('competition_default_payout_mode_arena');
  }
  final swiss = enumStr('hosted_event_swiss_format');
  if (id.isNotEmpty && swiss.isNotEmpty && id == swiss) {
    return enumStr('competition_default_payout_mode_swiss');
  }
  final gk = enumStr('hosted_event_groups_knockout_format');
  if (id.isNotEmpty && gk.isNotEmpty && id == gk) {
    return enumStr('competition_default_payout_mode_groups_knockout');
  }
  return enumStr('competition_payout_mode_places_percent');
}

List<String> payoutModeOptions(
  Map<String, dynamic>? enums,
  String formatId,
) {
  if (enums == null) return const [];
  // formatId kept for call-site parity with web/admin (modes are format-agnostic).
  final rawModes = enums['competition_payout_modes'];
  if (formatId.isEmpty && rawModes == null) return const [];
  final raw = rawModes;
  if (raw is! List) return const [];
  final out = <String>[];
  for (final m in raw) {
    final v = (m is String ? m : m?.toString() ?? '').trim();
    if (v.isEmpty) continue;
    out.add(v);
  }
  return out;
}

Map<String, num>? buildPlacePercentsMap(String p1, String p2, String p3) {
  final out = <String, num>{};
  for (final entry in [
    ('1', p1),
    ('2', p2),
    ('3', p3),
  ]) {
    final trimmed = entry.$2.trim();
    if (trimmed.isEmpty) continue;
    final n = double.tryParse(trimmed);
    if (n == null || !n.isFinite || n <= 0) continue;
    out[entry.$1] = n;
  }
  return out.isNotEmpty ? out : null;
}

bool placePercentsSumInvalid(String p1, String p2, String p3) {
  var any = false;
  var sum = 0.0;
  for (final raw in [p1, p2, p3]) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) continue;
    final n = double.tryParse(trimmed);
    if (n == null || !n.isFinite || n <= 0) continue;
    any = true;
    sum += n;
  }
  return any && (sum < 99.999 || sum > 100.001);
}
