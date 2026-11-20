// Arena length helpers. Backend stores arena_duration_minutes only.

enum ArenaDurationUnit { minutes, hours, days, weeks, months }

enum ArenaDurationMode { length, endsAt }

/// Calendar-month length used for Arena duration (30×24×60).
const int arenaDurationMonthMinutes = 30 * 1440;

int arenaUnitMinutesFactor(ArenaDurationUnit unit) {
  switch (unit) {
    case ArenaDurationUnit.minutes:
      return 1;
    case ArenaDurationUnit.hours:
      return 60;
    case ArenaDurationUnit.days:
      return 1440;
    case ArenaDurationUnit.weeks:
      return 10080;
    case ArenaDurationUnit.months:
      return arenaDurationMonthMinutes;
  }
}

int? minutesFromAmountUnit(num? amount, ArenaDurationUnit unit) {
  if (amount == null || !amount.isFinite || amount <= 0) return null;
  final minutes = (amount * arenaUnitMinutesFactor(unit)).round();
  return minutes >= 1 ? minutes : null;
}

({String amount, ArenaDurationUnit unit}) splitMinutesToAmountUnit(
    int minutes) {
  if (minutes < 1) {
    return (amount: '', unit: ArenaDurationUnit.minutes);
  }
  if (minutes % arenaDurationMonthMinutes == 0) {
    return (
      amount: '${minutes ~/ arenaDurationMonthMinutes}',
      unit: ArenaDurationUnit.months,
    );
  }
  if (minutes % 10080 == 0) {
    return (amount: '${minutes ~/ 10080}', unit: ArenaDurationUnit.weeks);
  }
  if (minutes % 1440 == 0) {
    return (amount: '${minutes ~/ 1440}', unit: ArenaDurationUnit.days);
  }
  if (minutes % 60 == 0) {
    return (amount: '${minutes ~/ 60}', unit: ArenaDurationUnit.hours);
  }
  return (amount: '$minutes', unit: ArenaDurationUnit.minutes);
}

int? minutesUntilDateTime(DateTime end, {DateTime? now}) {
  final base = now ?? DateTime.now();
  final mins = end.difference(base).inMinutes;
  return mins >= 1 ? mins : null;
}

DateTime dateTimeFromMinutesAhead(int minutes, {DateTime? now}) {
  final base = now ?? DateTime.now();
  return base.add(Duration(minutes: minutes < 1 ? 1 : minutes));
}

String formatLocalDateTimeMask(DateTime d) {
  final m = d.month.toString().padLeft(2, '0');
  final day = d.day.toString().padLeft(2, '0');
  var h = d.hour;
  final ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h == 0) h = 12;
  final mm = d.minute.toString().padLeft(2, '0');
  return '$m/$day/${d.year} ${h.toString().padLeft(2, '0')}:$mm $ampm';
}
