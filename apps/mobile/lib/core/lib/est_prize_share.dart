double _roundMoney2(double v) => (v * 100).roundToDouble() / 100;

Map<int, double>? placePercentsForEst(Map<String, dynamic>? raw) {
  if (raw == null || raw.isEmpty) return null;
  final out = <int, double>{};
  var sum = 0.0;
  for (final e in raw.entries) {
    final place = int.tryParse(e.key.trim());
    if (place == null || place < 1) continue;
    final v = e.value;
    double? pct;
    if (v is num) pct = v.toDouble();
    if (pct == null || !pct.isFinite || pct <= 0) continue;
    out[place] = pct;
    sum += pct;
  }
  if (sum < 99.999 || sum > 100.001) return null;
  return out;
}

double? _placesAmount(
  double pot,
  int? myPlacement,
  Map<String, dynamic>? placePercents,
) {
  final place = myPlacement;
  if (place == null || place < 1) return null;
  final percents = placePercentsForEst(placePercents);
  if (percents == null) return null;
  final pct = percents[place];
  if (pct == null || pct <= 0) return null;
  return _roundMoney2(pot * pct / 100);
}

double? _scoreShareAmount(double pot, double? myPoints, double? totalPoints) {
  final myPts = myPoints;
  final total = totalPoints;
  if (myPts == null ||
      total == null ||
      !myPts.isFinite ||
      !total.isFinite ||
      myPts <= 0 ||
      total <= 0) {
    return null;
  }
  return _roundMoney2(pot * myPts / total);
}

double? computeEstPrizeShare({
  required String mode,
  required String placesMode,
  required String scoreMode,
  String dualMode = '',
  double? dualPlacePursePercent,
  required double? potNow,
  required double? myPoints,
  required double? totalPoints,
  required int? myPlacement,
  required Map<String, dynamic>? placePercents,
}) {
  final m = mode.trim();
  final places = placesMode.trim();
  final score = scoreMode.trim();
  final dual = dualMode.trim();
  if (m.isEmpty || (m != places && m != score && m != dual)) return null;
  final pot = potNow;
  if (pot == null || !pot.isFinite || pot <= 0) return null;

  if (m == places) {
    return _placesAmount(pot, myPlacement, placePercents);
  }

  if (m == score) {
    return _scoreShareAmount(pot, myPoints, totalPoints);
  }

  // dual_purse: place purse + performance purse.
  // When nobody has points (totalPts null/<=0), mirror server fail-closed: full-pot places%.
  final placePursePct = dualPlacePursePercent;
  if (placePursePct == null ||
      !placePursePct.isFinite ||
      placePursePct <= 0 ||
      placePursePct >= 100) {
    return null;
  }
  final totalPts = totalPoints;
  if (totalPts == null || !totalPts.isFinite || totalPts <= 0) {
    return _placesAmount(pot, myPlacement, placePercents);
  }
  final placePurse = _roundMoney2(pot * placePursePct / 100);
  final perfPurse = _roundMoney2(pot - placePurse);
  final placePart = _placesAmount(placePurse, myPlacement, placePercents);
  final perfPart = _scoreShareAmount(perfPurse, myPoints, totalPts);
  if (placePart == null && perfPart == null) return null;
  return _roundMoney2((placePart ?? 0) + (perfPart ?? 0));
}

String? formatEstPrizeShareLine({
  required String label,
  required double amount,
  required String currency,
  required String amountCurrencySeparator,
  required String metaSeparator,
}) {
  final cur = currency.trim();
  if (cur.isEmpty || amount <= 0) return null;
  final formatted = '$amount$amountCurrencySeparator$cur';
  final sep = metaSeparator;
  return sep.isNotEmpty ? '$label$sep$formatted' : '$label $formatted';
}
