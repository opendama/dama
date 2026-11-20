// Cup discovery lifecycle from server timestamps (status enums stay draft/open/archived).

enum CupLifecyclePhase { open, live, finished }

extension CupLifecyclePhaseApi on CupLifecyclePhase {
  String get apiValue => name;
}

/// Timestamps used for discovery lifecycle (official + community cups).
class CupLifecycleFields {
  const CupLifecycleFields({this.startedAt, this.finishedAt});

  final String? startedAt;
  final String? finishedAt;
}

CupLifecycleFields cupLifecycleFieldsFromJson(Map<String, dynamic>? json) {
  if (json == null) return const CupLifecycleFields();
  return CupLifecycleFields(
    startedAt: json['started_at']?.toString(),
    finishedAt: json['finished_at']?.toString(),
  );
}

CupLifecyclePhase cupLifecyclePhase(CupLifecycleFields? cup) {
  if (cup == null) return CupLifecyclePhase.open;
  if ((cup.finishedAt ?? '').trim().isNotEmpty) {
    return CupLifecyclePhase.finished;
  }
  if ((cup.startedAt ?? '').trim().isNotEmpty) {
    return CupLifecyclePhase.live;
  }
  return CupLifecyclePhase.open;
}

/// DB Status-filter chrome labels for discovery badges (not enum status_label).
class CupLifecycleLabelChrome {
  const CupLifecycleLabelChrome({
    this.openLabel = '',
    this.liveLabel = '',
    this.finishedLabel = '',
  });

  final String openLabel;
  final String liveLabel;
  final String finishedLabel;
}

/// Card/lobby status must match Status Open|Live|Finished filters.
/// Official cups keep enum status_label "Open" after start - never use that for discovery.
String cupLifecycleStatusLabel(
  CupLifecycleFields? cup,
  CupLifecycleLabelChrome? chrome, {
  String fallback = '',
}) {
  final phase = cupLifecyclePhase(cup);
  final fromChrome = switch (phase) {
    CupLifecyclePhase.finished => (chrome?.finishedLabel ?? '').trim(),
    CupLifecyclePhase.live => (chrome?.liveLabel ?? '').trim(),
    CupLifecyclePhase.open => (chrome?.openLabel ?? '').trim(),
  };
  if (fromChrome.isNotEmpty) return fromChrome;
  return fallback.trim();
}

enum CupCardCtaKind { enroll, joinLobby, watch, results }

class CupCardCtaLabels {
  const CupCardCtaLabels({
    required this.joinAction,
    required this.enrollAction,
    required this.lobbyAction,
    required this.watchAction,
    required this.resultsAction,
  });

  final String joinAction;
  final String enrollAction;
  final String lobbyAction;
  final String watchAction;
  final String resultsAction;
}

class ResolvedCupCardCta {
  const ResolvedCupCardCta({required this.kind, required this.label});

  final CupCardCtaKind kind;
  final String label;
}

/// Status-honest primary CTA: never Join on finished.
/// Watch only when [liveGameId] is set; otherwise Enter lobby (cup Live ≠ board live).
ResolvedCupCardCta resolveCupCardCta(
  CupLifecycleFields? cup, {
  required bool enrolled,
  required bool isFree,
  required CupCardCtaLabels labels,
  String? liveGameId,
}) {
  final phase = cupLifecyclePhase(cup);
  final boardId = (liveGameId ?? '').trim();

  if (phase == CupLifecyclePhase.finished) {
    final label = labels.resultsAction.trim().isNotEmpty
        ? labels.resultsAction.trim()
        : labels.lobbyAction.trim();
    return ResolvedCupCardCta(kind: CupCardCtaKind.results, label: label);
  }
  if (phase == CupLifecyclePhase.live) {
    if (enrolled) {
      final label = labels.lobbyAction.trim().isNotEmpty
          ? labels.lobbyAction.trim()
          : labels.joinAction.trim();
      return ResolvedCupCardCta(
        kind: CupCardCtaKind.joinLobby,
        label: label,
      );
    }
    if (boardId.isNotEmpty) {
      final label = labels.watchAction.trim().isNotEmpty
          ? labels.watchAction.trim()
          : labels.lobbyAction.trim();
      return ResolvedCupCardCta(kind: CupCardCtaKind.watch, label: label);
    }
    final label = labels.lobbyAction.trim().isNotEmpty
        ? labels.lobbyAction.trim()
        : labels.watchAction.trim();
    return ResolvedCupCardCta(kind: CupCardCtaKind.joinLobby, label: label);
  }
  // open
  if (enrolled) {
    final label = labels.lobbyAction.trim().isNotEmpty
        ? labels.lobbyAction.trim()
        : labels.joinAction.trim();
    return ResolvedCupCardCta(kind: CupCardCtaKind.joinLobby, label: label);
  }
  if (isFree) {
    return ResolvedCupCardCta(
      kind: CupCardCtaKind.enroll,
      label: labels.joinAction.trim(),
    );
  }
  final label = labels.enrollAction.trim().isNotEmpty
      ? labels.enrollAction.trim()
      : labels.joinAction.trim();
  return ResolvedCupCardCta(kind: CupCardCtaKind.enroll, label: label);
}

bool shouldOpenTournamentCupLobby({
  required bool enrolled,
  String? startedAt,
  String? finishedAt,
}) {
  if (enrolled) return true;
  if ((startedAt ?? '').trim().isNotEmpty) return true;
  if ((finishedAt ?? '').trim().isNotEmpty) return true;
  return false;
}

bool shouldOpenEventCupLobby({
  required bool joined,
  String? startedAt,
  String? finishedAt,
}) {
  if (joined) return true;
  if ((startedAt ?? '').trim().isNotEmpty) return true;
  if ((finishedAt ?? '').trim().isNotEmpty) return true;
  return false;
}
