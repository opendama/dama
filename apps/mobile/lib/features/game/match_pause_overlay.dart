import 'dart:async';

import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/features/chat/match_intro_overlay.dart';
import 'package:flutter/material.dart';

/// Persistent board cover while a match is paused (player or official).
/// Same blur / VS / seats language as [MatchIntroOverlay]; stays until resume.
class MatchPauseOverlay extends StatefulWidget {
  const MatchPauseOverlay({
    super.key,
    required this.vsLabel,
    required this.ariaLabel,
    required this.statusLabel,
    required this.top,
    required this.bottom,
    this.bannerLine = '',
    this.byLine = '',
    this.reasonLine = '',
    this.noteLine = '',
    this.sinceLine = '',
    this.footerLine = '',
    this.footerLineFmt = '',
    this.expiresAtUnixMs = 0,
  });

  final String vsLabel;
  final String ariaLabel;

  /// Eyebrow: Player pause / Official pause (DB chrome).
  final String statusLabel;

  /// Pause banner blurb on the blurred cover (official or player).
  final String bannerLine;

  /// Who paused (role · name).
  final String byLine;
  final String reasonLine;
  final String noteLine;

  /// Official pause: banner_since_fmt with wall time.
  final String sinceLine;

  /// Static footer (e.g. official until-resume).
  final String footerLine;

  /// Player pause: play_chrome.pause_remaining_fmt with `{time}` → m:ss.
  final String footerLineFmt;
  final int expiresAtUnixMs;
  final MatchIntroPlayer top;
  final MatchIntroPlayer bottom;

  @override
  State<MatchPauseOverlay> createState() => _MatchPauseOverlayState();
}

class _MatchPauseOverlayState extends State<MatchPauseOverlay> {
  Timer? _tick;
  int _nowMs = 0;

  bool get _tickCountdown {
    final fmt = widget.footerLineFmt.trim();
    return fmt.isNotEmpty && widget.expiresAtUnixMs > 0;
  }

  @override
  void initState() {
    super.initState();
    _nowMs = DateTime.now().millisecondsSinceEpoch;
    _syncTick();
  }

  @override
  void didUpdateWidget(covariant MatchPauseOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.footerLineFmt != widget.footerLineFmt ||
        oldWidget.expiresAtUnixMs != widget.expiresAtUnixMs) {
      _syncTick();
    }
  }

  @override
  void dispose() {
    _tick?.cancel();
    _tick = null;
    super.dispose();
  }

  void _syncTick() {
    _tick?.cancel();
    _tick = null;
    if (!_tickCountdown) return;
    _nowMs = DateTime.now().millisecondsSinceEpoch;
    _tick = Timer.periodic(const Duration(milliseconds: 250), (_) {
      if (!mounted) return;
      setState(() => _nowMs = DateTime.now().millisecondsSinceEpoch);
    });
  }

  String _formatRemainingMs(int ms) {
    final total = (ms / 1000).ceil().clamp(0, 1 << 31);
    final m = total ~/ 60;
    final s = total % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  String get _countdownLine {
    final fmt = widget.footerLineFmt.trim();
    if (!_tickCountdown || fmt.isEmpty) return '';
    final remain = (widget.expiresAtUnixMs - _nowMs).clamp(0, 1 << 31).toInt();
    return fmt.replaceAll('{time}', _formatRemainingMs(remain)).trim();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final theme = Theme.of(context);
    final status = widget.statusLabel.trim();
    final vs = widget.vsLabel.trim();
    final aria = widget.ariaLabel.trim();
    if (vs.isEmpty || aria.isEmpty || status.isEmpty) {
      return const SizedBox.shrink();
    }

    final banner = widget.bannerLine.trim();
    final by = widget.byLine.trim();
    final reason = widget.reasonLine.trim();
    final note = widget.noteLine.trim();
    final since = widget.sinceLine.trim();
    final footer =
        (_countdownLine.isNotEmpty ? _countdownLine : widget.footerLine.trim())
            .trim();
    final metaLines =
        [banner, by, reason, note, since].where((l) => l.isNotEmpty).toList();
    final hasDetails = metaLines.isNotEmpty || footer.isNotEmpty;

    return Stack(
      fit: StackFit.expand,
      children: [
        MatchIntroOverlay(
          vsLabel: vs,
          ariaLabel: aria,
          startingLabel: status,
          durationMs: 0,
          persistent: true,
          top: widget.top,
          bottom: widget.bottom,
        ),
        if (hasDetails)
          Positioned(
            left: 12,
            right: 12,
            bottom: 12,
            child: IgnorePointer(
              child: Align(
                alignment: Alignment.bottomCenter,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      // Solid card (no glass) so countdown stays readable in dark/light.
                      color: tokens.card,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: tokens.border, width: 2),
                      boxShadow: [
                        BoxShadow(
                          color: tokens.onSurface.withValues(alpha: 0.18),
                          blurRadius: 18,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          for (var i = 0; i < metaLines.length; i++) ...[
                            if (i > 0) const SizedBox(height: 4),
                            Text(
                              metaLines[i],
                              textAlign: TextAlign.center,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurface,
                                fontWeight: FontWeight.w600,
                                height: 1.35,
                                letterSpacing: -0.1,
                              ),
                            ),
                          ],
                          if (footer.isNotEmpty) ...[
                            if (metaLines.isNotEmpty) const SizedBox(height: 4),
                            Text(
                              footer,
                              textAlign: TextAlign.center,
                              style: theme.textTheme.bodyMedium?.copyWith(
                                // Light: brand. Dark: primary text (readable on zinc shell).
                                color: theme.brightness == Brightness.dark
                                    ? theme.colorScheme.onSurface
                                    : tokens.brand,
                                fontWeight: FontWeight.w700,
                                height: 1.35,
                                letterSpacing: -0.1,
                                fontFeatures: const [
                                  FontFeature.tabularFigures(),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
