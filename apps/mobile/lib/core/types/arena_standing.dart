class ArenaStandingRow {
  const ArenaStandingRow({
    required this.userId,
    this.username = '',
    required this.arenaPoints,
    required this.arenaStreak,
    this.placement,
  });

  final String userId;
  final String username;
  final double arenaPoints;
  final int arenaStreak;
  final int? placement;

  factory ArenaStandingRow.fromJson(Map<String, dynamic> json) {
    double asDouble(dynamic v) {
      if (v is num) return v.toDouble();
      if (v is String) return double.tryParse(v.trim()) ?? 0;
      return 0;
    }

    int? placement;
    final p = json['placement'];
    if (p is num) placement = p.toInt();

    return ArenaStandingRow(
      userId: json['user_id']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
      arenaPoints: asDouble(json['arena_points']),
      arenaStreak: (json['arena_streak'] is num)
          ? (json['arena_streak'] as num).toInt()
          : int.tryParse('${json['arena_streak']}') ?? 0,
      placement: placement,
    );
  }
}
