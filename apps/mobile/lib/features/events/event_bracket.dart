import 'dart:async';

import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:flutter/material.dart';

class _BracketSection {
  const _BracketSection({
    required this.key,
    required this.title,
    required this.matches,
  });
  final String key;
  final String title;
  final List<HostedBracketMatch> matches;
}

String _applyTemplate(String template, int n) {
  final t = template.trim();
  if (t.isEmpty) return '';
  return t.replaceAll('{n}', '$n');
}

List<_BracketSection> _buildSections({
  required List<HostedBracketMatch> matches,
  required String phaseGroupLabel,
  required String phaseKnockoutLabel,
  required String phaseSwissLabel,
  required String phaseRoundRobinLabel,
  required String groupLabelTemplate,
  required String swissRoundLabelTemplate,
  required String metaSeparator,
  required String phaseGroupId,
  required String phaseKnockoutId,
  required String phaseSwissId,
  required String phaseRoundRobinId,
}) {
  if (matches.isEmpty) return const [];
  final hasPhase = matches.any((m) => m.phase.trim().isNotEmpty);
  if (!hasPhase) {
    return [
      _BracketSection(key: 'all', title: '', matches: List.of(matches)),
    ];
  }
  final sep = metaSeparator;
  String joinTitle(List<String> parts) {
    final clean = parts.where((p) => p.trim().isNotEmpty).toList();
    if (clean.isEmpty) return '';
    if (sep.isEmpty) return clean.join();
    return clean.join(sep);
  }

  final ordered = List<HostedBracketMatch>.of(matches)
    ..sort((a, b) {
      final pa = a.phase.trim();
      final pb = b.phase.trim();
      if (pa != pb) return pa.compareTo(pb);
      if (a.groupIndex != b.groupIndex) {
        return a.groupIndex.compareTo(b.groupIndex);
      }
      if (a.roundIndex != b.roundIndex) {
        return a.roundIndex.compareTo(b.roundIndex);
      }
      return a.matchIndex.compareTo(b.matchIndex);
    });

  final phases = <String>[];
  for (final m in ordered) {
    final p = m.phase.trim();
    if (p.isNotEmpty && !phases.contains(p)) phases.add(p);
  }
  final sections = <_BracketSection>[];

  for (final phase in phases) {
    final phaseMatches = ordered.where((m) => m.phase.trim() == phase).toList();
    final groupIndexes = phaseMatches.map((m) => m.groupIndex).toSet().toList()
      ..sort();
    final hasGroups = groupIndexes.any((g) => g >= 0);

    final pg = phaseGroupId.trim();
    final pk = phaseKnockoutId.trim();
    final ps = phaseSwissId.trim();
    final pr = phaseRoundRobinId.trim();

    var phaseTitle = '';
    if (pg.isNotEmpty && phase == pg) {
      phaseTitle = phaseGroupLabel.trim();
    } else if (pk.isNotEmpty && phase == pk) {
      phaseTitle = phaseKnockoutLabel.trim();
    } else if (ps.isNotEmpty && phase == ps) {
      phaseTitle = phaseSwissLabel.trim();
    } else if (pr.isNotEmpty && phase == pr) {
      phaseTitle = phaseRoundRobinLabel.trim();
    }
    // Unknown phase id: fail closed (empty title). Never invent knockout label.

    if (hasGroups) {
      for (final gi in groupIndexes) {
        final groupMatches =
            phaseMatches.where((m) => m.groupIndex == gi).toList();
        final parts = <String>[];
        if (phaseTitle.isNotEmpty) parts.add(phaseTitle);
        if (gi >= 0) {
          final gl = _applyTemplate(groupLabelTemplate, gi + 1);
          if (gl.isNotEmpty) parts.add(gl);
        }
        sections.add(
          _BracketSection(
            key: '$phase:g$gi',
            title: joinTitle(parts),
            matches: groupMatches,
          ),
        );
      }
      continue;
    }

    final roundIndexes = phaseMatches.map((m) => m.roundIndex).toSet().toList()
      ..sort();
    final roundTpl = swissRoundLabelTemplate.trim();
    final isSwiss = ps.isNotEmpty && phase == ps;
    if (isSwiss && roundTpl.isNotEmpty && roundIndexes.length > 1) {
      for (final ri in roundIndexes) {
        final roundMatches =
            phaseMatches.where((m) => m.roundIndex == ri).toList();
        final parts = <String>[];
        if (phaseTitle.isNotEmpty) parts.add(phaseTitle);
        final rl = _applyTemplate(roundTpl, ri + 1);
        if (rl.isNotEmpty) parts.add(rl);
        sections.add(
          _BracketSection(
            key: '$phase:r$ri',
            title: joinTitle(parts),
            matches: roundMatches,
          ),
        );
      }
      continue;
    }

    sections.add(
      _BracketSection(
        key: phase.isEmpty ? 'phase' : phase,
        title: phaseTitle,
        matches: phaseMatches,
      ),
    );
  }
  return sections;
}

/// Bracket list grouped by phase / group / swiss round (organizer + player).
class EventBracketView extends StatelessWidget {
  const EventBracketView({
    super.key,
    required this.matches,
    required this.bracketTitle,
    required this.startGameAction,
    required this.openMatchAction,
    required this.metaSeparator,
    required this.byeLabel,
    required this.vsLabel,
    required this.emptySeatLabel,
    required this.emptyValue,
    this.phaseGroupLabel = '',
    this.phaseKnockoutLabel = '',
    this.phaseSwissLabel = '',
    this.phaseRoundRobinLabel = '',
    this.groupLabelTemplate = '',
    this.swissRoundLabelTemplate = '',
    this.phaseGroupId = '',
    this.phaseKnockoutId = '',
    this.phaseSwissId = '',
    this.phaseRoundRobinId = '',
    required this.pageCardPad,
    required this.pageCardGap,
    this.onStartGame,
    this.onForfeit,
    this.forfeitAction = '',
    this.onRematch,
    this.rematchAction = '',
    this.onOfficialPause,
    this.officialPauseAction = '',
    this.onOfficialResume,
    this.officialResumeAction = '',
    this.onOfficialPauseMeta,
    this.officialPauseMetaAction = '',
    this.officialPauseStatusLabel = '',
    this.officiallyPausedGameIds = const {},
    this.officialPauseByGameId = const {},
    this.officialPauseChrome,
    this.onOpenMatch,
    this.onCopyGameId,
    this.selectedGameIds = const {},
    this.onToggleSelectGameId,
    this.canManage = false,
  });

  final List<HostedBracketMatch> matches;
  final String bracketTitle;
  final String startGameAction;
  final String openMatchAction;
  final String forfeitAction;
  final Future<void> Function(HostedBracketMatch match, String loserUserId)?
      onForfeit;
  final Future<void> Function(HostedBracketMatch match)? onRematch;
  final String rematchAction;
  final Future<void> Function(HostedBracketMatch match)? onOfficialPause;
  final String officialPauseAction;
  final Future<void> Function(HostedBracketMatch match)? onOfficialResume;
  final String officialResumeAction;
  final Future<void> Function(HostedBracketMatch match)? onOfficialPauseMeta;
  final String officialPauseMetaAction;
  final String officialPauseStatusLabel;

  /// Game ids currently under official pause (server state). Empty = unknown.
  final Set<String> officiallyPausedGameIds;
  final Map<String, GameStatePayload> officialPauseByGameId;
  final OfficialPauseChrome? officialPauseChrome;
  final Future<void> Function(HostedBracketMatch match)? onCopyGameId;
  final Set<String> selectedGameIds;
  final void Function(String gameId, bool selected)? onToggleSelectGameId;
  final String metaSeparator;
  final String byeLabel;
  final String vsLabel;
  final String emptySeatLabel;
  final String emptyValue;
  final String phaseGroupLabel;
  final String phaseKnockoutLabel;
  final String phaseSwissLabel;
  final String phaseRoundRobinLabel;
  final String groupLabelTemplate;
  final String swissRoundLabelTemplate;
  final String phaseGroupId;
  final String phaseKnockoutId;
  final String phaseSwissId;
  final String phaseRoundRobinId;
  final String pageCardPad;
  final String pageCardGap;
  final Future<void> Function(HostedBracketMatch match)? onStartGame;
  final void Function(HostedBracketMatch match)? onOpenMatch;
  final bool canManage;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    if (matches.isEmpty) {
      return const SizedBox.shrink();
    }
    final cardPad = double.tryParse(pageCardPad.trim());
    final cardGap = double.tryParse(pageCardGap.trim());
    if (cardPad == null || cardPad < 0 || cardGap == null || cardGap < 0) {
      return const SizedBox.shrink();
    }
    final sections = _buildSections(
      matches: matches,
      phaseGroupLabel: phaseGroupLabel,
      phaseKnockoutLabel: phaseKnockoutLabel,
      phaseSwissLabel: phaseSwissLabel,
      phaseRoundRobinLabel: phaseRoundRobinLabel,
      groupLabelTemplate: groupLabelTemplate,
      swissRoundLabelTemplate: swissRoundLabelTemplate,
      metaSeparator: metaSeparator,
      phaseGroupId: phaseGroupId,
      phaseKnockoutId: phaseKnockoutId,
      phaseSwissId: phaseSwissId,
      phaseRoundRobinId: phaseRoundRobinId,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (bracketTitle.isNotEmpty)
          Padding(
            padding: EdgeInsets.only(bottom: cardGap),
            child: Text(
              bracketTitle,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        for (final section in sections) ...[
          if (section.title.isNotEmpty)
            Text(
              section.title,
              style: TextStyle(
                color: tokens.gold,
                fontWeight: FontWeight.w600,
              ),
            ),
          if (section.title.isNotEmpty) SizedBox(height: cardGap),
          for (final m
              in (List<HostedBracketMatch>.of(section.matches)
                ..sort((a, b) => a.matchIndex.compareTo(b.matchIndex))))
            _BracketMatchTile(
              match: m,
              startGameAction: startGameAction,
              openMatchAction: openMatchAction,
              forfeitAction: forfeitAction,
              rematchAction: rematchAction,
              officialPauseAction: officialPauseAction,
              officialResumeAction: officialResumeAction,
              officialPauseMetaAction: officialPauseMetaAction,
              officialPauseStatusLabel: officialPauseStatusLabel,
              officiallyPaused:
                  officiallyPausedGameIds.contains((m.gameId ?? '').trim()),
              pausePayload: officialPauseByGameId[(m.gameId ?? '').trim()],
              officialPauseChrome: officialPauseChrome,
              metaSeparator: metaSeparator,
              byeLabel: byeLabel,
              vsLabel: vsLabel,
              emptySeatLabel: emptySeatLabel,
              emptyValue: emptyValue,
              canManage: canManage,
              cardPad: cardPad,
              cardGap: cardGap,
              onStartGame: onStartGame,
              onForfeit: onForfeit,
              onRematch: onRematch,
              onOfficialPause: onOfficialPause,
              onOfficialResume: onOfficialResume,
              onOfficialPauseMeta: onOfficialPauseMeta,
              onOpenMatch: onOpenMatch,
              onCopyGameId: onCopyGameId,
              selected: selectedGameIds.contains((m.gameId ?? '').trim()),
              onToggleSelect: onToggleSelectGameId,
            ),
          SizedBox(height: cardPad),
        ],
      ],
    );
  }
}

class _BracketMatchTile extends StatelessWidget {
  const _BracketMatchTile({
    required this.match,
    required this.startGameAction,
    required this.openMatchAction,
    required this.forfeitAction,
    required this.rematchAction,
    required this.officialPauseAction,
    required this.officialResumeAction,
    this.officialPauseMetaAction = '',
    this.officialPauseStatusLabel = '',
    this.officiallyPaused = false,
    this.pausePayload,
    this.officialPauseChrome,
    required this.metaSeparator,
    required this.byeLabel,
    required this.vsLabel,
    required this.emptySeatLabel,
    required this.emptyValue,
    required this.canManage,
    required this.cardPad,
    required this.cardGap,
    this.onStartGame,
    this.onForfeit,
    this.onRematch,
    this.onOfficialPause,
    this.onOfficialResume,
    this.onOfficialPauseMeta,
    this.onOpenMatch,
    this.onCopyGameId,
    this.selected = false,
    this.onToggleSelect,
  });

  final HostedBracketMatch match;
  final String startGameAction;
  final String openMatchAction;
  final String forfeitAction;
  final String rematchAction;
  final String officialPauseAction;
  final String officialResumeAction;
  final String officialPauseMetaAction;
  final String officialPauseStatusLabel;
  final bool officiallyPaused;
  final GameStatePayload? pausePayload;
  final Future<void> Function(HostedBracketMatch match)? onCopyGameId;
  final bool selected;
  final void Function(String gameId, bool selected)? onToggleSelect;
  final OfficialPauseChrome? officialPauseChrome;
  final String metaSeparator;
  final String byeLabel;
  final String vsLabel;
  final String emptySeatLabel;
  final String emptyValue;
  final bool canManage;
  final double cardPad;
  final double cardGap;
  final Future<void> Function(HostedBracketMatch match)? onStartGame;
  final Future<void> Function(HostedBracketMatch match, String loserUserId)?
      onForfeit;
  final Future<void> Function(HostedBracketMatch match)? onRematch;
  final Future<void> Function(HostedBracketMatch match)? onOfficialPause;
  final Future<void> Function(HostedBracketMatch match)? onOfficialResume;
  final Future<void> Function(HostedBracketMatch match)? onOfficialPauseMeta;
  final void Function(HostedBracketMatch match)? onOpenMatch;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final a = match.playerAUsername.trim().isNotEmpty
        ? match.playerAUsername.trim()
        : emptySeatLabel;
    final b = match.isBye
        ? byeLabel
        : (match.playerBUsername.trim().isNotEmpty
            ? match.playerBUsername.trim()
            : emptySeatLabel);
    final status = match.statusLabel.trim().isNotEmpty
        ? match.statusLabel.trim()
        : (match.status.trim().isNotEmpty ? match.status.trim() : emptyValue);
    final line =
        '$a$metaSeparator$vsLabel$metaSeparator$b$metaSeparator$status';
    final aId = (match.playerAId ?? '').trim();
    final bId = (match.playerBId ?? '').trim();
    final finished = (match.finishedAt ?? '').trim().isNotEmpty;
    final showRematch = canManage &&
        !match.isBye &&
        !finished &&
        aId.isNotEmpty &&
        bId.isNotEmpty &&
        rematchAction.trim().isNotEmpty &&
        onRematch != null;
    final showForfeit = canManage &&
        !match.isBye &&
        !finished &&
        aId.isNotEmpty &&
        bId.isNotEmpty &&
        forfeitAction.trim().isNotEmpty &&
        onForfeit != null;
    final gid = (match.gameId ?? '').trim();
    final ops = officialPauseChrome;
    final payload = pausePayload;
    // Fail-closed: no pause/resume CTA until /state snapshot is present.
    final stateReady = payload != null;
    final showOfficialPause = canManage &&
        !match.isBye &&
        !finished &&
        gid.isNotEmpty &&
        stateReady &&
        !officiallyPaused &&
        officialPauseAction.trim().isNotEmpty &&
        onOfficialPause != null;
    final showOfficialResume = canManage &&
        !match.isBye &&
        !finished &&
        gid.isNotEmpty &&
        stateReady &&
        officiallyPaused &&
        officialResumeAction.trim().isNotEmpty &&
        onOfficialResume != null;
    final showOfficialMeta = canManage &&
        !match.isBye &&
        !finished &&
        gid.isNotEmpty &&
        stateReady &&
        officiallyPaused &&
        officialPauseMetaAction.trim().isNotEmpty &&
        onOfficialPauseMeta != null;
    final playerPaused =
        payload != null && payload.paused && !payload.isOfficialPause;
    final boardPaused = officiallyPaused || playerPaused;
    final pauseStatus = () {
      if (ops == null) {
        return officiallyPaused ? officialPauseStatusLabel.trim() : '';
      }
      if (payload != null && payload.isOfficialPause) {
        return ops.statusOfficialPause.trim();
      }
      if (playerPaused) return ops.statusPlayerPause.trim();
      if (payload != null && !finished && gid.isNotEmpty && !payload.paused) {
        return ops.statusLive.trim();
      }
      if (finished) return ops.statusFinished.trim();
      if (officiallyPaused) return officialPauseStatusLabel.trim();
      return '';
    }();
    final statusExtra =
        pauseStatus.isNotEmpty ? '$metaSeparator$pauseStatus' : '';
    final detailBits = <String>[];
    if (boardPaused && payload != null && ops != null) {
      final byLabel = ops.colPausedBy.trim();
      final role = ops.roleLabel(payload.pauseActorRole);
      final name = payload.pauseActorDisplayName.trim();
      // Fail closed: never show hollow paused-by (needs both role and name).
      if (byLabel.isNotEmpty && role.isNotEmpty && name.isNotEmpty) {
        detailBits.add(
          '$byLabel$metaSeparator$role$metaSeparator$name',
        );
      }
      if (officiallyPaused) {
        final reasonLabel = ops.colReason.trim();
        final reason = payload.pauseReasonLabel.trim();
        if (reasonLabel.isNotEmpty && reason.isNotEmpty) {
          detailBits.add('$reasonLabel$metaSeparator$reason');
        }
      }
      final frozen = ops.clockFrozen.trim();
      if (frozen.isNotEmpty) detailBits.add(frozen);
      final sinceFmt = ops.bannerSinceFmt.trim();
      if (sinceFmt.isNotEmpty && payload.pausedAtUnixMs > 0) {
        final dt = DateTime.fromMillisecondsSinceEpoch(payload.pausedAtUnixMs)
            .toLocal();
        final hh = dt.hour.toString().padLeft(2, '0');
        final mm = dt.minute.toString().padLeft(2, '0');
        final since = sinceFmt.replaceAll('{time}', '$hh:$mm').trim();
        if (since.isNotEmpty) detailBits.add(since);
      }
      final durLabel = ops.colDuration.trim();
      if (durLabel.isNotEmpty && payload.pausedAtUnixMs > 0) {
        final secs =
            ((DateTime.now().millisecondsSinceEpoch - payload.pausedAtUnixMs) /
                    1000)
                .floor()
                .clamp(0, 1 << 31);
        // Unit-free seconds (parity with web formatPauseDurationSeconds).
        detailBits.add('$durLabel$metaSeparator$secs');
      }
    }
    final selectRowLabel = (ops?.selectRowLabel ?? '').trim();
    final canSelect = gid.isNotEmpty &&
        selectRowLabel.isNotEmpty &&
        onToggleSelect != null &&
        (ops?.selectAllLabel ?? '').trim().isNotEmpty;
    final menuLabel = (ops?.actionsMenuLabel ?? '').trim();
    final copyLabel = (ops?.copyGameIdAction ?? '').trim();
    final showPauseMenu = showOfficialPause ||
        showOfficialResume ||
        showOfficialMeta ||
        (copyLabel.isNotEmpty && onCopyGameId != null && gid.isNotEmpty);
    return Card(
      margin: EdgeInsets.only(bottom: cardGap),
      child: Padding(
        padding: EdgeInsets.all(cardPad),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (canSelect)
                  Padding(
                    padding: EdgeInsets.only(right: cardGap / 2),
                    child: Checkbox(
                      value: selected,
                      semanticLabel: selectRowLabel,
                      onChanged: (v) => onToggleSelect!(gid, v == true),
                    ),
                  ),
                Expanded(
                  child: Text(
                    '$line$statusExtra',
                    style: TextStyle(
                      color: boardPaused ? tokens.brand : tokens.onSurface,
                    ),
                  ),
                ),
                if (showPauseMenu && menuLabel.isNotEmpty)
                  PopupMenuButton<String>(
                    tooltip: menuLabel,
                    onSelected: (value) {
                      if (value == 'copy' && onCopyGameId != null) {
                        unawaited(onCopyGameId!(match));
                      } else if (value == 'pause' && onOfficialPause != null) {
                        unawaited(onOfficialPause!(match));
                      } else if (value == 'meta' &&
                          onOfficialPauseMeta != null) {
                        unawaited(onOfficialPauseMeta!(match));
                      } else if (value == 'resume' &&
                          onOfficialResume != null) {
                        unawaited(onOfficialResume!(match));
                      }
                    },
                    itemBuilder: (context) => [
                      if (copyLabel.isNotEmpty && onCopyGameId != null)
                        PopupMenuItem(value: 'copy', child: Text(copyLabel)),
                      if (showOfficialPause)
                        PopupMenuItem(
                          value: 'pause',
                          child: Text(officialPauseAction),
                        ),
                      if (showOfficialMeta)
                        PopupMenuItem(
                          value: 'meta',
                          child: Text(officialPauseMetaAction),
                        ),
                      if (showOfficialResume)
                        PopupMenuItem(
                          value: 'resume',
                          child: Text(officialResumeAction),
                        ),
                    ],
                  ),
              ],
            ),
            if (detailBits.isNotEmpty)
              Padding(
                padding: EdgeInsets.only(top: cardGap / 2),
                child: Text(
                  detailBits.join(metaSeparator),
                  style: TextStyle(
                    color: tokens.onSurfaceMuted,
                    fontSize: 12,
                  ),
                ),
              ),
            if (canManage &&
                match.gameId == null &&
                !match.isBye &&
                match.playerAId != null &&
                match.playerBId != null &&
                onStartGame != null) ...[
              SizedBox(height: cardGap),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () => onStartGame!(match),
                  child: Text(startGameAction),
                ),
              ),
            ],
            if (match.gameId != null &&
                match.gameId!.trim().isNotEmpty &&
                onOpenMatch != null) ...[
              SizedBox(height: cardGap),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () => onOpenMatch!(match),
                  child: Text(openMatchAction),
                ),
              ),
            ],
            if (showRematch) ...[
              SizedBox(height: cardGap),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () => onRematch!(match),
                  child: Text(rematchAction),
                ),
              ),
            ],
            if (showForfeit) ...[
              SizedBox(height: cardGap),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  TextButton(
                    onPressed: () => onForfeit!(match, aId),
                    child: Text('$forfeitAction$metaSeparator$a'),
                  ),
                  TextButton(
                    onPressed: () => onForfeit!(match, bId),
                    child: Text('$forfeitAction$metaSeparator$b'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
