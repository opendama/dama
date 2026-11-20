import 'package:dama_mobile/core/types/events.dart';
import 'package:dama_mobile/core/types/events_organizer_chrome.dart';
import 'package:dama_mobile/core/types/events_player_chrome.dart';
import 'package:dama_mobile/core/types/home_chrome.dart';
import 'package:dama_mobile/core/types/tournament.dart';
import 'package:dama_mobile/core/types/tournaments_player_chrome.dart';

/// Chrome-backed prize pool summary segments (no invented labels).

class PrizePoolCardLabels {
  const PrizePoolCardLabels({
    required this.nowLabel,
    required this.ifFullLabel,
    required this.guaranteedLabel,
    required this.frozenBlurb,
    required this.metaSeparator,
    required this.amountCurrencySeparator,
  });

  final String nowLabel;
  final String ifFullLabel;
  final String guaranteedLabel;
  final String frozenBlurb;
  final String metaSeparator;
  final String amountCurrencySeparator;

  factory PrizePoolCardLabels.fromOrganizer(EventsOrganizerChrome c) {
    return PrizePoolCardLabels(
      nowLabel: c.prizePoolNowLabel,
      ifFullLabel: c.prizePoolIfFullLabel,
      guaranteedLabel: c.prizePoolGuaranteedLabel,
      frozenBlurb: c.prizePoolFrozenBlurb,
      metaSeparator: c.metaSeparator,
      amountCurrencySeparator: c.amountCurrencySeparator,
    );
  }

  factory PrizePoolCardLabels.fromPlayer(EventsPlayerChrome c) {
    return PrizePoolCardLabels(
      nowLabel: c.prizePoolNowLabel,
      ifFullLabel: c.prizePoolIfFullLabel,
      guaranteedLabel: c.prizePoolGuaranteedLabel,
      frozenBlurb: c.prizePoolFrozenBlurb,
      metaSeparator: c.metaSeparator,
      amountCurrencySeparator: c.amountCurrencySeparator,
    );
  }

  factory PrizePoolCardLabels.fromTournaments(TournamentsPlayerChrome c) {
    return PrizePoolCardLabels(
      nowLabel: c.prizePoolNowLabel,
      ifFullLabel: c.prizePoolIfFullLabel,
      guaranteedLabel: c.prizePoolGuaranteedLabel,
      frozenBlurb: c.prizePoolFrozenBlurb,
      metaSeparator: c.metaSeparator,
      amountCurrencySeparator: c.amountCurrencySeparator,
    );
  }

  factory PrizePoolCardLabels.fromHome(HomeSurfaceChrome c) {
    return PrizePoolCardLabels(
      nowLabel: c.prizePoolNowLabel,
      ifFullLabel: c.prizePoolIfFullLabel,
      guaranteedLabel: c.prizePoolGuaranteedLabel,
      frozenBlurb: c.prizePoolFrozenBlurb,
      metaSeparator: c.metaSeparator,
      amountCurrencySeparator: c.amountCurrencySeparator,
    );
  }
}

String _moneyLine(
  String label,
  double amount,
  String currency,
  PrizePoolCardLabels labels,
) {
  final cur = currency.trim();
  final amt = '$amount';
  final value = '$amt${labels.amountCurrencySeparator}$cur';
  return [label, value].join(labels.metaSeparator);
}

/// Lines for cards/lists when API attached prize pool fields (paid + display on).
List<String> buildPrizePoolLines({
  required bool isFree,
  required bool displayEnabled,
  required double? now,
  required double? ifFull,
  required bool guaranteeEnabled,
  bool? guaranteeHeld,
  required double? guaranteeAmount,
  required bool frozen,
  required String currency,
  required PrizePoolCardLabels labels,
}) {
  final cur = currency.trim();
  if (isFree || !displayEnabled || now == null || cur.isEmpty) {
    return const [];
  }
  final out = <String>[];
  if (labels.nowLabel.isNotEmpty) {
    out.add(_moneyLine(labels.nowLabel, now, cur, labels));
  }
  if (ifFull != null && labels.ifFullLabel.isNotEmpty) {
    out.add(_moneyLine(labels.ifFullLabel, ifFull, cur, labels));
  }
  // Guaranteed line only when funds are held (or tournament declared, held omitted).
  final showGuarantee = guaranteeEnabled &&
      guaranteeAmount != null &&
      guaranteeAmount > 0 &&
      guaranteeHeld != false &&
      labels.guaranteedLabel.isNotEmpty;
  if (showGuarantee) {
    out.add(
      _moneyLine(labels.guaranteedLabel, guaranteeAmount, cur, labels),
    );
  }
  if (frozen && labels.frozenBlurb.isNotEmpty) {
    out.add(labels.frozenBlurb);
  }
  return out;
}

List<String> hostedEventPrizePoolLines(
  HostedEvent ev,
  PrizePoolCardLabels labels,
) {
  return buildPrizePoolLines(
    isFree: ev.isFreeEntry,
    displayEnabled: ev.prizePoolDisplayEnabled,
    now: ev.prizePoolNow,
    ifFull: ev.prizePoolIfFull,
    guaranteeEnabled: ev.prizePoolGuaranteeEnabled,
    guaranteeHeld: ev.prizePoolGuaranteeHeld,
    guaranteeAmount: ev.prizePoolGuaranteeAmount,
    frozen: ev.prizePoolFrozen,
    currency: ev.prizePoolCurrency,
    labels: labels,
  );
}

List<String> restTournamentPrizePoolLines(
  RestTournament t,
  PrizePoolCardLabels labels,
) {
  return buildPrizePoolLines(
    isFree: t.isFree,
    displayEnabled: t.prizePoolDisplayEnabled,
    now: t.prizePoolNow,
    ifFull: t.prizePoolIfFull,
    guaranteeEnabled: t.prizePoolGuaranteeAmount != null &&
        (t.prizePoolGuaranteeAmount ?? 0) > 0,
    guaranteeAmount: t.prizePoolGuaranteeAmount,
    frozen: t.prizePoolFrozen,
    currency: (t.prizePoolCurrency ?? '').trim(),
    labels: labels,
  );
}
