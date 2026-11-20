import 'dart:math' as math;

import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:flutter/material.dart';

enum MatchResultTone { win, loss, draw }

/// Full-board cinematic result overlay (win / loss / draw).
class MatchResultOverlay extends StatefulWidget {
  const MatchResultOverlay({
    super.key,
    required this.tone,
    required this.title,
    required this.message,
    required this.ariaLabel,
    required this.durationMs,
    required this.onDone,
  });

  final MatchResultTone tone;
  final String title;
  final String message;
  final String ariaLabel;
  final int durationMs;
  final VoidCallback onDone;

  @override
  State<MatchResultOverlay> createState() => _MatchResultOverlayState();
}

class _MatchResultOverlayState extends State<MatchResultOverlay>
    with TickerProviderStateMixin {
  late final AnimationController _pulse;
  late final AnimationController _burst;
  late final List<_Spark> _sparks;

  @override
  void initState() {
    super.initState();
    final rng = math.Random(7);
    _sparks = List.generate(28, (i) {
      final angle = (i / 28) * math.pi * 2 + rng.nextDouble() * 0.4;
      return _Spark(
        angle: angle,
        dist: 40 + rng.nextDouble() * 110,
        size: 3 + rng.nextDouble() * 5,
        delay: rng.nextDouble() * 0.35,
      );
    });
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _burst = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..forward();
    if (widget.durationMs <= 0) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onDone();
      });
      return;
    }
    Future<void>.delayed(Duration(milliseconds: widget.durationMs), () {
      if (mounted) widget.onDone();
    });
  }

  @override
  void dispose() {
    _pulse.dispose();
    _burst.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final win = widget.tone == MatchResultTone.win;
    final loss = widget.tone == MatchResultTone.loss;
    final accent = win
        ? tokens.brand
        : loss
            ? const Color(0xFF8B1E2D)
            : tokens.onSurfaceMuted;
    final theme = Theme.of(context);
    final surface = theme.colorScheme.surface;
    final onSurface = theme.colorScheme.onSurface;
    // Web parity: no BackdropFilter on game-over (avoids seam glitch). Tone scrims only.
    final scrim = loss
        ? Colors.black.withValues(alpha: 0.80)
        : theme.scaffoldBackgroundColor.withValues(alpha: win ? 0.88 : 0.90);

    return Semantics(
      label: widget.ariaLabel,
      child: AbsorbPointer(
        child: SizedBox.expand(
          child: ColoredBox(
            color: scrim,
            child: Stack(
              children: [
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: RadialGradient(
                        center: Alignment.center,
                        radius: 0.85,
                        colors: [
                          accent.withValues(alpha: win ? 0.4 : 0.22),
                          Colors.transparent,
                        ],
                      ),
                    ),
                  ),
                ),
                if (win)
                  Positioned.fill(
                    child: AnimatedBuilder(
                      animation: _burst,
                      builder: (context, _) {
                        return CustomPaint(
                          painter: _WinBurstPainter(
                            progress: _burst.value,
                            sparks: _sparks,
                            color: tokens.brand,
                          ),
                        );
                      },
                    ),
                  ),
                if (win)
                  Center(
                    child: ScaleTransition(
                      scale: Tween(begin: 0.9, end: 1.35).animate(_pulse),
                      child: Container(
                        width: 160,
                        height: 160,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: tokens.brand.withValues(alpha: 0.12),
                        ),
                      ),
                    ),
                  ),
                Center(
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 28),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 28, vertical: 26),
                    decoration: BoxDecoration(
                      color: surface.withValues(alpha: 0.92),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: accent, width: 1.5),
                      boxShadow: [
                        BoxShadow(
                          color: accent.withValues(alpha: 0.35),
                          blurRadius: 28,
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          widget.title.toUpperCase(),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 2.8,
                            color: accent,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          widget.message,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.w900,
                            color: onSurface,
                            shadows: win
                                ? [
                                    Shadow(
                                      color:
                                          tokens.brand.withValues(alpha: 0.55),
                                      blurRadius: 16,
                                    ),
                                  ]
                                : null,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Spark {
  const _Spark({
    required this.angle,
    required this.dist,
    required this.size,
    required this.delay,
  });

  final double angle;
  final double dist;
  final double size;
  final double delay;
}

class _WinBurstPainter extends CustomPainter {
  _WinBurstPainter({
    required this.progress,
    required this.sparks,
    required this.color,
  });

  final double progress;
  final List<_Spark> sparks;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final paint = Paint()..style = PaintingStyle.fill;
    for (final s in sparks) {
      final t = ((progress - s.delay) / (1 - s.delay)).clamp(0.0, 1.0);
      if (t <= 0) continue;
      final r = s.dist * Curves.easeOutCubic.transform(t);
      final opacity = (1 - t) * 0.9;
      paint.color = color.withValues(alpha: opacity);
      canvas.drawCircle(
        Offset(
          center.dx + math.cos(s.angle) * r,
          center.dy + math.sin(s.angle) * r,
        ),
        s.size * (1.1 - t * 0.4),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _WinBurstPainter oldDelegate) =>
      oldDelegate.progress != progress;
}
