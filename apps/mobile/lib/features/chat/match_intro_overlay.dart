import 'dart:ui';

import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/ui/country_flag.dart';
import 'package:dama_mobile/widgets/dama_user_avatar.dart';
import 'package:dama_mobile/widgets/host_trust_badge.dart';
import 'package:flutter/material.dart';

class MatchIntroPlayer {
  const MatchIntroPlayer({
    required this.username,
    this.avatarUrl,
    this.countryCode,
    this.hostTrustTier,
    this.hostTrustBadge,
  });

  final String username;
  final String? avatarUrl;
  final String? countryCode;
  final String? hostTrustTier;
  final String? hostTrustBadge;
}

/// Full-board esports VS intro for [durationMs], then calls [onDone].
/// When [persistent] is true, stays until the widget is removed (no auto-dismiss).
class MatchIntroOverlay extends StatefulWidget {
  const MatchIntroOverlay({
    super.key,
    required this.vsLabel,
    required this.ariaLabel,
    required this.durationMs,
    required this.top,
    required this.bottom,
    this.onDone,
    this.startingLabel = '',
    this.onShow,
    this.persistent = false,
  });

  final String vsLabel;
  final String ariaLabel;
  final String startingLabel;
  final int durationMs;
  final MatchIntroPlayer top;
  final MatchIntroPlayer bottom;
  final VoidCallback? onDone;
  final VoidCallback? onShow;

  /// Pause cover: ignore [durationMs] auto-dismiss; stay until unmounted.
  final bool persistent;

  @override
  State<MatchIntroOverlay> createState() => _MatchIntroOverlayState();
}

class _MatchIntroOverlayState extends State<MatchIntroOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    if (widget.persistent) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        widget.onShow?.call();
      });
      return;
    }
    // Fail closed: duration must come from DB chrome (no invented default).
    if (widget.durationMs <= 0) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onDone?.call();
      });
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      widget.onShow?.call();
    });
    Future<void>.delayed(Duration(milliseconds: widget.durationMs), () {
      if (mounted) widget.onDone?.call();
    });
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  Widget _seat(
    MatchIntroPlayer p,
    DamaColors tokens,
    Color onSurface, {
    required bool isDark,
  }) {
    final thumb = (p.avatarUrl ?? '').trim();
    // Light: white. Dark: primary text (seat / who-vs-who names).
    final nameColor = isDark ? onSurface : Colors.white;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 92,
          height: 92,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: tokens.brand, width: 2.5),
            boxShadow: [
              BoxShadow(
                color: tokens.brand.withValues(alpha: 0.45),
                blurRadius: 22,
                spreadRadius: 1,
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: DamaUserAvatar(
            imageUrl: thumb.isNotEmpty ? thumb : null,
            radius: 46,
          ),
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            CountryFlag(code: p.countryCode, height: 14),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                p.username,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: nameColor,
                ),
              ),
            ),
          ],
        ),
        if ((p.hostTrustBadge ?? '').trim().isNotEmpty) ...[
          const SizedBox(height: 4),
          HostTrustBadge(
            label: p.hostTrustBadge,
            tier: p.hostTrustTier,
            fontSize: 11,
            onMedia: true,
            dense: true,
          ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final theme = Theme.of(context);
    final starting = widget.startingLabel.trim();
    return Semantics(
      label: widget.ariaLabel,
      child: AbsorbPointer(
        // Web parity: blur fills the whole board panel (Positioned.fill / cover host).
        child: SizedBox.expand(
          child: ClipRect(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
              child: ColoredBox(
                color: theme.scaffoldBackgroundColor.withValues(alpha: 0.90),
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: RadialGradient(
                            center: const Alignment(0, -0.1),
                            radius: 0.9,
                            colors: [
                              tokens.brand.withValues(alpha: 0.28),
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                    ),
                    Align(
                      alignment: Alignment.center,
                      child: FadeTransition(
                        opacity: Tween(begin: 0.25, end: 0.85).animate(_pulse),
                        child: Container(
                          height: 1.5,
                          margin: const EdgeInsets.symmetric(horizontal: 36),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                Colors.transparent,
                                tokens.brand.withValues(alpha: 0.9),
                                Colors.transparent,
                              ],
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: tokens.brand.withValues(alpha: 0.55),
                                blurRadius: 16,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (starting.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 18),
                              child: FadeTransition(
                                opacity: Tween(begin: 0.55, end: 1.0)
                                    .animate(_pulse),
                                child: Text(
                                  starting.toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 3.2,
                                    // Light: brand. Dark: primary text for clear visibility.
                                    color: theme.brightness == Brightness.dark
                                        ? theme.colorScheme.onSurface
                                        : tokens.brand,
                                  ),
                                ),
                              ),
                            ),
                          _seat(
                            widget.top,
                            tokens,
                            theme.colorScheme.onSurface,
                            isDark: theme.brightness == Brightness.dark,
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 18),
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                ScaleTransition(
                                  scale: Tween(begin: 0.85, end: 1.25)
                                      .animate(_pulse),
                                  child: Container(
                                    width: 72,
                                    height: 72,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color:
                                          tokens.brand.withValues(alpha: 0.18),
                                    ),
                                  ),
                                ),
                                Stack(
                                  alignment: Alignment.center,
                                  children: [
                                    Text(
                                      widget.vsLabel.toUpperCase(),
                                      style: TextStyle(
                                        fontSize: 32,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 5,
                                        foreground: Paint()
                                          ..style = PaintingStyle.stroke
                                          ..strokeWidth = 5
                                          // Theme card (not hard white) for dark/light pause+intro.
                                          ..color = tokens.card,
                                      ),
                                    ),
                                    Text(
                                      widget.vsLabel.toUpperCase(),
                                      style: TextStyle(
                                        fontSize: 32,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 5,
                                        color: tokens.brand,
                                        shadows: [
                                          Shadow(
                                            color: tokens.brand
                                                .withValues(alpha: 0.7),
                                            blurRadius: 18,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          _seat(
                            widget.bottom,
                            tokens,
                            theme.colorScheme.onSurface,
                            isDark: theme.brightness == Brightness.dark,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
