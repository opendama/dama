// Telegram-style chat clocks + day separators (locale-aware; labels from DB chrome).

String formatChatMessageTime(String? iso) {
  final raw = (iso ?? '').trim();
  if (raw.isEmpty) return '';
  final dt = DateTime.tryParse(raw)?.toLocal();
  if (dt == null) return '';
  final h = dt.hour;
  final m = dt.minute.toString().padLeft(2, '0');
  final hour12 = h % 12 == 0 ? 12 : h % 12;
  final ampm = h >= 12 ? 'PM' : 'AM';
  return '$hour12:$m $ampm';
}

String chatDayKey(String? iso) {
  final raw = (iso ?? '').trim();
  if (raw.isEmpty) return '';
  final dt = DateTime.tryParse(raw)?.toLocal();
  if (dt == null) return '';
  final y = dt.year.toString().padLeft(4, '0');
  final m = dt.month.toString().padLeft(2, '0');
  final d = dt.day.toString().padLeft(2, '0');
  return '$y-$m-$d';
}

String formatChatDateSeparator(
  String? iso, {
  required String todayLabel,
  required String yesterdayLabel,
}) {
  final raw = (iso ?? '').trim();
  if (raw.isEmpty) return '';
  final dt = DateTime.tryParse(raw)?.toLocal();
  if (dt == null) return '';
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final msgDay = DateTime(dt.year, dt.month, dt.day);
  final diff = today.difference(msgDay).inDays;
  if (diff == 0) return todayLabel.trim();
  if (diff == 1) return yesterdayLabel.trim();
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
  const weekdays = <String>['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  final wd = weekdays[(dt.weekday - 1).clamp(0, 6)];
  final mon = months[(dt.month - 1).clamp(0, 11)];
  return '$wd, $mon ${dt.day}, ${dt.year}';
}

class ChatTimelineItem<T> {
  const ChatTimelineItem.date({required this.key, required this.label})
      : message = null,
        isDate = true;
  const ChatTimelineItem.message(this.message)
      : key = null,
        label = null,
        isDate = false;

  final bool isDate;
  final String? key;
  final String? label;
  final T? message;
}

List<ChatTimelineItem<T>> buildChatTimeline<T>({
  required List<T> messages,
  required String Function(T) createdAtOf,
  required String todayLabel,
  required String yesterdayLabel,
}) {
  final out = <ChatTimelineItem<T>>[];
  var prevDay = '';
  for (final msg in messages) {
    final iso = createdAtOf(msg);
    final day = chatDayKey(iso);
    if (day.isNotEmpty && day != prevDay) {
      final label = formatChatDateSeparator(
        iso,
        todayLabel: todayLabel,
        yesterdayLabel: yesterdayLabel,
      );
      if (label.isNotEmpty) {
        out.add(ChatTimelineItem.date(key: 'date-$day', label: label));
      }
      prevDay = day;
    }
    out.add(ChatTimelineItem.message(msg));
  }
  return out;
}
