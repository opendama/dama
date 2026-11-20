String hostedEventArenaFormatId(
  Map<String, dynamic>? enums, [
  Map<String, dynamic>? catalog,
]) {
  final fromEnums =
      (enums?['hosted_event_arena_format'] as String?)?.trim() ?? '';
  if (fromEnums.isNotEmpty) return fromEnums;
  return (catalog?['hosted_event_arena_format'] as String?)?.trim() ?? '';
}

bool tournamentFormatIsArena(
  String formatId,
  Map<String, dynamic>? enums, [
  Map<String, dynamic>? catalog,
]) {
  final fid = formatId.trim();
  if (fid.isEmpty) return false;
  final arenaId = hostedEventArenaFormatId(enums, catalog);
  return arenaId.isNotEmpty && fid == arenaId;
}

int arenaRemainingMs(String? arenaEndsAt) {
  final raw = (arenaEndsAt ?? '').trim();
  if (raw.isEmpty) return 0;
  final end = DateTime.tryParse(raw);
  if (end == null) return 0;
  return end
      .toUtc()
      .difference(DateTime.now().toUtc())
      .inMilliseconds
      .clamp(0, 1 << 31);
}

bool arenaClockActive(String? arenaEndsAt) => arenaRemainingMs(arenaEndsAt) > 0;

String formatArenaClock(String? arenaEndsAt) {
  final ms = arenaRemainingMs(arenaEndsAt);
  if (ms <= 0) return '';
  final totalSec = (ms + 999) ~/ 1000;
  final m = totalSec ~/ 60;
  final s = totalSec % 60;
  return '$m:${s.toString().padLeft(2, '0')}';
}
