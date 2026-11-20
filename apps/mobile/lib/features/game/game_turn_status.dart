import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:flutter/material.dart';

String _seatTurnInner(String hint) {
  return hint
      .trim()
      .replaceAll(RegExp(r'^\(+'), '')
      .replaceAll(RegExp(r'\)+$'), '')
      .trim();
}

class GameTurnStatus extends StatelessWidget {
  const GameTurnStatus({
    super.key,
    required this.yourName,
    required this.opponentName,
    required this.yourTurnLabel,
    required this.opponentTurnLabel,
    required this.replayLabel,
    required this.vsSeparator,
    required this.mode,
    required this.yourPlayer,
    required this.turn,
    required this.yourCaptures,
    required this.opponentCaptures,
    required this.isBusy,
    this.opponentThinking = false,
    this.replayIndex,
    required this.historyLength,
    this.yourOnline,
    this.yourPlaying,
    this.opponentOnline,
    this.opponentPlaying,
    this.suppressTurnHints = false,
    this.statusBanner,
  });

  final String yourName;
  final String opponentName;
  final String yourTurnLabel;
  final String opponentTurnLabel;
  final String replayLabel;
  final String vsSeparator;
  final String mode;
  final int? yourPlayer;
  final int turn;
  final int yourCaptures;
  final int opponentCaptures;
  final bool isBusy;
  final bool opponentThinking;
  final int? replayIndex;
  final int historyLength;
  final bool? yourOnline;
  final bool? yourPlaying;
  final bool? opponentOnline;
  final bool? opponentPlaying;

  /// Clock-owned endings: never show Your turn / opponent turn.
  final bool suppressTurnHints;

  /// Optional on-time / result strip (DB copy only).
  final String? statusBanner;

  @override
  Widget build(BuildContext context) {
    final isYourTurn =
        !suppressTurnHints && yourPlayer != null && turn == yourPlayer;
    final isOpponentTurn =
        !suppressTurnHints && yourPlayer != null && turn != yourPlayer;

    if (replayIndex != null) {
      final label = replayIndex! <= 0
          ? replayLabel
          : '$replayLabel · $replayIndex/$historyLength';
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _ReplayBanner(label: label),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _PlayerSlot(
                  name: yourName,
                  turnHint: null,
                  captures: yourCaptures,
                  active: false,
                  icon: Icons.person_outline,
                  busy: false,
                  online: yourOnline,
                  playing: yourPlaying,
                  pieceSideLight: yourPlayer != 2,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _PlayerSlot(
                  name: opponentName,
                  turnHint: null,
                  captures: opponentCaptures,
                  active: false,
                  icon: mode == 'ai'
                      ? Icons.smart_toy_outlined
                      : Icons.person_outline,
                  busy: false,
                  online: opponentOnline,
                  playing: opponentPlaying,
                  pieceSideLight: yourPlayer == 2,
                ),
              ),
            ],
          ),
        ],
      );
    }

    final banner = (statusBanner ?? '').trim();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (banner.isNotEmpty) ...[
          _ReplayBanner(label: banner),
          const SizedBox(height: 8),
        ],
        Text(
          '$yourName$vsSeparator$opponentName',
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: damaColorsOf(context).onSurfaceMuted,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: _PlayerSlot(
                name: yourName,
                turnHint: isYourTurn ? yourTurnLabel : null,
                captures: yourCaptures,
                active: isYourTurn,
                icon: Icons.person_outline,
                busy: isBusy && isYourTurn,
                online: yourOnline,
                playing: yourPlaying,
                pieceSideLight: yourPlayer != 2,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _PlayerSlot(
                name: opponentName,
                turnHint: isOpponentTurn ? opponentTurnLabel : null,
                captures: opponentCaptures,
                active: isOpponentTurn,
                icon: mode == 'ai'
                    ? Icons.smart_toy_outlined
                    : Icons.person_outline,
                busy: opponentThinking && isOpponentTurn,
                online: opponentOnline,
                playing: opponentPlaying,
                pieceSideLight: yourPlayer == 2,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _ReplayBanner extends StatelessWidget {
  const _ReplayBanner({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: tokens.borderSubtle,
          style: BorderStyle.solid,
        ),
        color: tokens.surfaceMuted.withValues(alpha: 0.4),
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 14, color: tokens.onSurfaceMuted),
      ),
    );
  }
}

class _PlayerSlot extends StatelessWidget {
  const _PlayerSlot({
    required this.name,
    required this.turnHint,
    required this.captures,
    required this.active,
    required this.icon,
    required this.busy,
    this.online,
    this.playing,
    this.pieceSideLight = true,
  });

  final String name;
  final String? turnHint;
  final int captures;
  final bool active;
  final IconData icon;
  final bool busy;
  final bool? online;
  final bool? playing;
  final bool pieceSideLight;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final fg = active ? tokens.onGold : tokens.gold;
    final bg = active ? tokens.gold : tokens.card;
    final border = active ? tokens.gold : tokens.borderSubtle;
    final muted =
        active ? tokens.onGold.withValues(alpha: 0.9) : tokens.onSurfaceMuted;
    // Seat swatch = that seat's piece color (web BoardSeatBar parity).
    final swatch = pieceSideLight ? tokens.pieceLight : tokens.pieceDark;
    final onSwatch = pieceSideLight ? tokens.pieceDark : tokens.pieceLight;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: border),
        color: bg,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    width: 18,
                    height: 18,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: swatch,
                      border: Border.all(
                        color: active
                            ? fg.withValues(alpha: 0.5)
                            : const Color(0x33000000),
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Icon(icon, size: 11, color: onSwatch),
                  ),
                  if (online != null || playing != null)
                    Positioned(
                      right: -2,
                      top: -2,
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: (playing == true)
                              ? tokens.playing
                              : (online == true)
                                  ? tokens.online
                                  : tokens.offline,
                          border: Border.all(color: bg, width: 2),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Row(
                  children: [
                    Flexible(
                      child: Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: fg,
                        ),
                      ),
                    ),
                    if (turnHint != null && turnHint!.trim().isNotEmpty) ...[
                      const SizedBox(width: 4),
                      Text(
                        '(${_seatTurnInner(turnHint!)})',
                        maxLines: 1,
                        softWrap: false,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w400,
                          color: muted,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (busy)
                SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: active ? fg.withValues(alpha: 0.8) : muted,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: Container(
              constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
              padding: const EdgeInsets.symmetric(horizontal: 6),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(6),
                color: active
                    ? tokens.boneBright.withValues(alpha: 0.2)
                    : tokens.surfaceMuted,
              ),
              alignment: Alignment.center,
              child: Text(
                '$captures',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  fontFeatures: const [FontFeature.tabularFigures()],
                  color: active ? fg : muted,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
