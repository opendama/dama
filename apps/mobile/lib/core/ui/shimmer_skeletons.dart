import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:flutter/material.dart';

/// Resolves skeleton surface from the active theme (light/dark/system).
Color kSkeletonSurfaceOf(BuildContext context) => damaColorsOf(context).card;

/// Track fill - admin `--dama-track: hsl(var(--muted))` literals (not theme lerp).
/// Light muted 240 4.8% 95.9% = #F4F4F5; dark muted 240 3.7% 15.9% = #27272A.
Color kSkeletonTrackOf(BuildContext context) {
  final isDark = Theme.of(context).brightness == Brightness.dark;
  return isDark ? const Color(0xFF27272A) : const Color(0xFFF4F4F5);
}

/// Wave mid - admin `--dama-shimmer-via: hsl(var(--muted-foreground) / 0.06)`.
/// Light mf #71717A; dark mf #A1A1AA.
Color kSkeletonShimmerViaOf(BuildContext context) {
  final isDark = Theme.of(context).brightness == Brightness.dark;
  final mid = isDark ? const Color(0xFFA1A1AA) : const Color(0xFF71717A);
  return mid.withValues(alpha: 0.06);
}

class _ShimmerScope extends InheritedWidget {
  const _ShimmerScope({
    required this.animation,
    required super.child,
  });

  final Animation<double> animation;

  static Animation<double> of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<_ShimmerScope>();
    assert(scope != null, 'ShimmerBox must be under a skeleton widget');
    return scope!.animation;
  }

  @override
  bool updateShouldNotify(_ShimmerScope oldWidget) =>
      oldWidget.animation != animation;
}

class _ShimmerScopeHost extends StatefulWidget {
  const _ShimmerScopeHost({required this.child});

  final Widget child;

  @override
  State<_ShimmerScopeHost> createState() => _ShimmerScopeHostState();
}

class _ShimmerScopeHostState extends State<_ShimmerScopeHost>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      // Admin/web `.dama-shimmer::after` / Trim: 1.6s ease-in-out.
      duration: const Duration(milliseconds: 1600),
    )..repeat();
    _animation = CurvedAnimation(parent: _controller, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _ShimmerScope(
      animation: _animation,
      child: widget.child,
    );
  }
}

/// Placeholder block: muted track + muted-foreground@6% sweep
/// (admin/web `.dama-shimmer` / Trim `.sm-shimmer`).
class ShimmerBox extends StatelessWidget {
  const ShimmerBox({
    super.key,
    this.width,
    this.height,
    this.borderRadius = BorderRadius.zero,
    this.color,
  });

  final double? width;
  final double? height;
  final BorderRadius borderRadius;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final animation = _ShimmerScope.of(context);
    final base = color ?? kSkeletonTrackOf(context);
    final via = kSkeletonShimmerViaOf(context);
    return AnimatedBuilder(
      animation: animation,
      builder: (context, _) {
        // CSS keyframes: translateX(-100%) → translateX(100%) over 1.6s.
        final t = animation.value;
        final dx = -1.0 + 2.0 * t;
        return ClipRRect(
          borderRadius: borderRadius,
          child: SizedBox(
            width: width,
            height: height,
            child: Stack(
              fit: StackFit.expand,
              children: [
                ColoredBox(color: base),
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment(dx - 1.0, 0),
                      end: Alignment(dx + 1.0, 0),
                      colors: [
                        Colors.transparent,
                        via,
                        Colors.transparent,
                      ],
                      stops: const [0.0, 0.5, 1.0],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

Widget _shimmerRoot(Widget child) => _ShimmerScopeHost(child: child);

/// Full Hall of Fame page while chrome hydrates (title + period tabs + podium/list).
class LeaderboardPageSkeleton extends StatelessWidget {
  const LeaderboardPageSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return _shimmerRoot(
      ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ShimmerBox(
              height: 14, width: 220, borderRadius: BorderRadius.circular(4)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final w in [88.0, 100.0, 88.0, 72.0])
                ShimmerBox(
                  height: 36,
                  width: w,
                  borderRadius: BorderRadius.circular(10),
                ),
            ],
          ),
          const SizedBox(height: 12),
          const LeaderboardSkeleton(wrapRoot: false),
        ],
      ),
    );
  }
}

class LeaderboardSkeleton extends StatelessWidget {
  const LeaderboardSkeleton(
      {super.key, this.itemCount = 5, this.wrapRoot = true});

  final int itemCount;

  /// When embedded in [LeaderboardPageSkeleton], skip nested shimmer scope.
  final bool wrapRoot;

  @override
  Widget build(BuildContext context) {
    final body = Column(
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(8, 16, 8, 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (final h in [56.0, 84.0, 44.0])
                Expanded(
                  child: Column(
                    children: [
                      ShimmerBox(
                        width: 28,
                        height: 28,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      const SizedBox(height: 8),
                      ShimmerBox(
                        width: h == 84 ? 68 : 56,
                        height: h == 84 ? 68 : 56,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      const SizedBox(height: 8),
                      ShimmerBox(
                        height: 12,
                        width: 64,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      const SizedBox(height: 4),
                      ShimmerBox(
                        height: 10,
                        width: 40,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      const SizedBox(height: 8),
                      ShimmerBox(
                        height: h,
                        width: double.infinity,
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(10),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Align(
            alignment: Alignment.centerLeft,
            child: ShimmerBox(
              height: 12,
              width: 96,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: Theme.of(context)
                      .extension<DamaColors>()
                      ?.gold
                      .withValues(alpha: 0.35) ??
                  const Color(0x59D4AF37),
            ),
          ),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final twoCol = constraints.maxWidth >= 560;
              final tile = (int i) => Row(
                    children: [
                      ShimmerBox(
                        width: 22,
                        height: 14,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      const SizedBox(width: 10),
                      ShimmerBox(
                        width: 32,
                        height: 32,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            ShimmerBox(
                              height: 12,
                              width: 100,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            const SizedBox(height: 6),
                            ShimmerBox(
                              height: 10,
                              width: 72,
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ],
                        ),
                      ),
                      ShimmerBox(
                        width: 28,
                        height: 12,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ],
                  );
              if (!twoCol) {
                return Column(
                  children: [
                    for (var i = 0; i < itemCount; i++) ...[
                      if (i > 0) const SizedBox(height: 8),
                      tile(i),
                    ],
                  ],
                );
              }
              return GridView(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisExtent: 56,
                  crossAxisSpacing: 8,
                  mainAxisSpacing: 8,
                ),
                children: List.generate(itemCount, tile),
              );
            },
          ),
        ),
        const SizedBox(height: 8),
        ShimmerBox(
          height: 48,
          width: double.infinity,
          borderRadius: BorderRadius.circular(12),
        ),
      ],
    );
    return wrapRoot ? _shimmerRoot(body) : body;
  }
}

/// Screenshot marketplace minicard skeleton (borderless, rounded media, 2-up).
class TournamentListSkeleton extends StatelessWidget {
  const TournamentListSkeleton({super.key, this.itemCount = 6});

  final int itemCount;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final crossAxisCount = width >= 1100
        ? 5
        : width >= 800
            ? 4
            : width >= 560
                ? 3
                : 2;
    return _shimmerRoot(
      GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: itemCount,
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: crossAxisCount,
          mainAxisSpacing: 20,
          crossAxisSpacing: 12,
          childAspectRatio: width >= 560 ? 0.72 : 0.62,
        ),
        itemBuilder: (_, __) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AspectRatio(
                aspectRatio: 1,
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    return ShimmerBox(
                      width: constraints.maxWidth,
                      height: constraints.maxHeight,
                      borderRadius: BorderRadius.circular(12),
                    );
                  },
                ),
              ),
              const SizedBox(height: 8),
              ShimmerBox(
                height: 14,
                width: 140,
                borderRadius: BorderRadius.circular(4),
              ),
              const SizedBox(height: 6),
              ShimmerBox(
                height: 14,
                width: 100,
                borderRadius: BorderRadius.circular(4),
              ),
              const Spacer(),
              ShimmerBox(
                height: 32,
                width: double.infinity,
                borderRadius: BorderRadius.circular(8),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Sticky filter bar shimmer (toggle / entry chips + search) - web TournamentFiltersSkeleton.
class TournamentFiltersSkeleton extends StatelessWidget {
  const TournamentFiltersSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ShimmerBox(
          height: 40,
          width: double.infinity,
          borderRadius: BorderRadius.circular(8),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            ShimmerBox(
                height: 32, width: 56, borderRadius: BorderRadius.circular(16)),
            const SizedBox(width: 8),
            ShimmerBox(
                height: 32, width: 56, borderRadius: BorderRadius.circular(16)),
            const SizedBox(width: 8),
            ShimmerBox(
                height: 32, width: 56, borderRadius: BorderRadius.circular(16)),
          ],
        ),
        const SizedBox(height: 12),
        ShimmerBox(
          height: 48,
          width: double.infinity,
          borderRadius: BorderRadius.circular(8),
        ),
      ],
    );
  }
}

/// Dedicated tournaments page loading shell (never PlayHub / board shimmer).
class TournamentsPageSkeleton extends StatelessWidget {
  const TournamentsPageSkeleton({super.key, this.itemCount = 6});

  final int itemCount;

  @override
  Widget build(BuildContext context) {
    return _shimmerRoot(
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ShimmerBox(
                  height: 14,
                  width: 220,
                  borderRadius: BorderRadius.circular(4),
                ),
                const SizedBox(height: 12),
                const TournamentFiltersSkeleton(),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TournamentListSkeleton(itemCount: itemCount),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 24, 16, 32),
            child: Row(
              children: [
                ShimmerBox(
                    height: 12,
                    width: 96,
                    borderRadius: BorderRadius.circular(4)),
                const Spacer(),
                ShimmerBox(
                    height: 32,
                    width: 52,
                    borderRadius: BorderRadius.circular(6)),
                const SizedBox(width: 6),
                ShimmerBox(
                    height: 32,
                    width: 52,
                    borderRadius: BorderRadius.circular(6)),
                const SizedBox(width: 6),
                ShimmerBox(
                    height: 32,
                    width: 52,
                    borderRadius: BorderRadius.circular(6)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ProfileSkeleton extends StatelessWidget {
  const ProfileSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return _shimmerRoot(
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              ShimmerBox(
                height: 28,
                width: 140,
                borderRadius: BorderRadius.circular(6),
              ),
              const Spacer(),
              ShimmerBox(
                height: 40,
                width: 88,
                borderRadius: BorderRadius.circular(8),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              ShimmerBox(
                width: 64,
                height: 64,
                borderRadius: BorderRadius.circular(32),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ShimmerBox(
                      height: 16,
                      width: 140,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    const SizedBox(height: 8),
                    ShimmerBox(
                      height: 12,
                      width: 180,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          ShimmerBox(
            height: 120,
            width: double.infinity,
            borderRadius: BorderRadius.circular(12),
          ),
        ],
      ),
    );
  }
}

class WalletSkeleton extends StatelessWidget {
  const WalletSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final border = damaColorsOf(context).borderSubtle;
    Widget tableBlock() {
      return DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: ShimmerBox(
                height: 14,
                width: 140,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            Divider(height: 1, color: border),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                children: [
                  Row(
                    children: [
                      for (var c = 0; c < 4; c++) ...[
                        if (c > 0) const SizedBox(width: 8),
                        Expanded(
                          child: ShimmerBox(
                            height: 10,
                            width: double.infinity,
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 10),
                  for (var r = 0; r < 5; r++) ...[
                    if (r > 0) const SizedBox(height: 8),
                    ShimmerBox(
                      height: 32,
                      width: double.infinity,
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      );
    }

    return _shimmerRoot(
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ShimmerBox(
            height: 88,
            width: double.infinity,
            borderRadius: BorderRadius.circular(12),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ShimmerBox(
                height: 40,
                width: 112,
                borderRadius: BorderRadius.circular(8),
              ),
              ShimmerBox(
                height: 40,
                width: 128,
                borderRadius: BorderRadius.circular(8),
              ),
              ShimmerBox(
                height: 40,
                width: 120,
                borderRadius: BorderRadius.circular(8),
              ),
            ],
          ),
          const SizedBox(height: 16),
          tableBlock(),
          const SizedBox(height: 16),
          tableBlock(),
        ],
      ),
    );
  }
}

/// Chess.com seat bar shimmer: square avatar · name · rating · flag | trailing · timer.
class BoardSeatBarSkeleton extends StatelessWidget {
  const BoardSeatBarSkeleton({
    super.key,
    this.showTrailing = false,
    this.clockActive = false,
    this.wrapRoot = true,
  });

  final bool showTrailing;
  final bool clockActive;
  final bool wrapRoot;

  @override
  Widget build(BuildContext context) {
    final body = Row(
      children: [
        Expanded(
          child: Row(
            children: [
              ShimmerBox(
                width: 32,
                height: 32,
                borderRadius: BorderRadius.circular(3),
              ),
              const SizedBox(width: 8),
              ShimmerBox(
                height: 14,
                width: 72,
                borderRadius: BorderRadius.circular(3),
              ),
              const SizedBox(width: 6),
              ShimmerBox(
                height: 12,
                width: 36,
                borderRadius: BorderRadius.circular(3),
              ),
              const SizedBox(width: 4),
              ShimmerBox(
                height: 12,
                width: 16,
                borderRadius: BorderRadius.circular(1),
              ),
            ],
          ),
        ),
        if (showTrailing) ...[
          const SizedBox(width: 6),
          ShimmerBox(
            height: 32,
            width: 72,
            borderRadius: BorderRadius.circular(6),
          ),
        ],
        const SizedBox(width: 6),
        Opacity(
          opacity: clockActive ? 0.95 : 0.7,
          child: ShimmerBox(
            height: 32,
            width: 76,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
      ],
    );
    return wrapRoot ? _shimmerRoot(body) : body;
  }
}

/// Checkerboard plane only (web [BoardAreaSkeleton]).
class BoardAreaSkeleton extends StatelessWidget {
  const BoardAreaSkeleton({super.key, this.wrapRoot = true, this.size = 8});

  final bool wrapRoot;
  final int size;

  @override
  Widget build(BuildContext context) {
    final grid = Column(
      children: [
        for (var r = 0; r < size; r++) ...[
          if (r > 0) const SizedBox(height: 2),
          Expanded(
            child: Row(
              children: [
                for (var col = 0; col < size; col++) ...[
                  if (col > 0) const SizedBox(width: 2),
                  Expanded(
                    child: Opacity(
                      opacity: (r + col).isOdd ? 0.9 : 0.55,
                      child: SizedBox.expand(
                        child: ShimmerBox(
                          borderRadius: BorderRadius.circular(1),
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
    final framed = DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(3),
        border: Border.all(
          color: damaColorsOf(context).borderSubtle,
        ),
      ),
      child: Padding(padding: const EdgeInsets.all(4), child: grid),
    );
    return wrapRoot ? _shimmerRoot(framed) : framed;
  }
}

/// Flush Chess.com column: top seat + square board + bottom seat (web BoardColumnSkeleton).
class BoardColumnSkeleton extends StatelessWidget {
  const BoardColumnSkeleton({
    super.key,
    this.showTopTrailing = true,
    this.bottomClockActive = true,
    this.wrapRoot = true,
  });

  final bool showTopTrailing;
  final bool bottomClockActive;
  final bool wrapRoot;

  static const double _seatGap = 2;
  static const double _seatRowH = 40;

  @override
  Widget build(BuildContext context) {
    final body = LayoutBuilder(
      builder: (context, constraints) {
        final maxW = constraints.maxWidth;
        final maxH = constraints.maxHeight;
        if (!maxW.isFinite || maxW <= 0) return const SizedBox.shrink();
        final reserved = _seatRowH * 2 + _seatGap * 2;
        final double side;
        if (maxH.isFinite && maxH > 0) {
          final availH = maxH - reserved;
          side = (maxW <= availH ? maxW : availH).clamp(0.0, double.infinity);
        } else {
          side = maxW;
        }
        if (side <= 0) return const SizedBox.shrink();
        return Center(
          child: SizedBox(
            width: side,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  height: _seatRowH,
                  child: BoardSeatBarSkeleton(
                    showTrailing: showTopTrailing,
                    wrapRoot: false,
                  ),
                ),
                const SizedBox(height: _seatGap),
                SizedBox(
                  width: side,
                  height: side,
                  child: const BoardAreaSkeleton(wrapRoot: false),
                ),
                const SizedBox(height: _seatGap),
                SizedBox(
                  height: _seatRowH,
                  child: BoardSeatBarSkeleton(
                    clockActive: bottomClockActive,
                    wrapRoot: false,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
    return wrapRoot ? _shimmerRoot(body) : body;
  }
}

/// Home play hub: Chess.com board column + rail (web PlayHubSkeleton).
class PlayHubSkeleton extends StatelessWidget {
  const PlayHubSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return _shimmerRoot(
      LayoutBuilder(
        builder: (context, constraints) {
          final wide = constraints.maxWidth >= 720;
          final boardAndSeats = const BoardColumnSkeleton(wrapRoot: false);
          final rail = Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  for (var i = 0; i < 3; i++) ...[
                    if (i > 0) const SizedBox(width: 6),
                    Expanded(
                      child: ShimmerBox(
                        height: 44,
                        width: double.infinity,
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 12),
              ShimmerBox(
                height: 12,
                width: 96,
                borderRadius: BorderRadius.circular(4),
              ),
              const SizedBox(height: 10),
              ShimmerBox(
                height: 40,
                width: double.infinity,
                borderRadius: BorderRadius.circular(8),
              ),
              const SizedBox(height: 10),
              ShimmerBox(
                height: 44,
                width: double.infinity,
                borderRadius: BorderRadius.circular(8),
              ),
              const SizedBox(height: 10),
              ShimmerBox(
                height: 36,
                width: double.infinity,
                borderRadius: BorderRadius.circular(8),
              ),
            ],
          );
          if (!wide) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: boardAndSeats),
                const SizedBox(height: 12),
                SizedBox(
                  height: (constraints.maxHeight.isFinite
                      ? (constraints.maxHeight * 0.42).clamp(280.0, 520.0)
                      : 320.0),
                  child: rail,
                ),
              ],
            );
          }
          return Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: boardAndSeats),
              const SizedBox(width: 16),
              SizedBox(width: 380, child: rail),
            ],
          );
        },
      ),
    );
  }
}

/// Right-rail Games / Players list rows (matches web [PlayRailListSkeleton]).
class PlayRailListSkeleton extends StatelessWidget {
  const PlayRailListSkeleton({
    super.key,
    this.rows = 6,
    this.variant = PlayRailListVariant.player,
  });

  final int rows;
  final PlayRailListVariant variant;

  @override
  Widget build(BuildContext context) {
    final tokens = Theme.of(context).extension<DamaColors>();
    final border = tokens?.borderSubtle ?? const Color(0x22FFFFFF);
    return _shimmerRoot(
      ListView.builder(
        physics: const NeverScrollableScrollPhysics(),
        itemCount: rows,
        itemBuilder: (_, i) {
          if (variant == PlayRailListVariant.game) {
            // Mirrors live row: seat stack | players(+TC) → viewers → game id.
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                border: Border(bottom: BorderSide(color: border)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 54,
                    height: 36,
                    child: Stack(
                      children: [
                        Positioned(
                          left: 18,
                          child: ShimmerBox(
                            width: 36,
                            height: 36,
                            borderRadius: BorderRadius.circular(18),
                          ),
                        ),
                        Positioned(
                          left: 0,
                          child: ShimmerBox(
                            width: 36,
                            height: 36,
                            borderRadius: BorderRadius.circular(18),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ShimmerBox(
                          height: 8,
                          width: 48,
                          borderRadius: BorderRadius.circular(3),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Expanded(
                              child: ShimmerBox(
                                height: 12,
                                width: 140,
                                borderRadius: BorderRadius.circular(3),
                              ),
                            ),
                            const SizedBox(width: 8),
                            ShimmerBox(
                              height: 10,
                              width: 36,
                              borderRadius: BorderRadius.circular(3),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            ShimmerBox(
                              height: 8,
                              width: 40,
                              borderRadius: BorderRadius.circular(3),
                            ),
                            const SizedBox(width: 6),
                            ShimmerBox(
                              width: 22,
                              height: 22,
                              borderRadius: BorderRadius.circular(11),
                            ),
                            Transform.translate(
                              offset: const Offset(-11, 0),
                              child: ShimmerBox(
                                width: 22,
                                height: 22,
                                borderRadius: BorderRadius.circular(11),
                              ),
                            ),
                            Transform.translate(
                              offset: const Offset(-22, 0),
                              child: ShimmerBox(
                                width: 22,
                                height: 22,
                                borderRadius: BorderRadius.circular(11),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        ShimmerBox(
                          height: 10,
                          width: 96,
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: border)),
            ),
            child: Row(
              children: [
                ShimmerBox(
                  width: 32,
                  height: 32,
                  borderRadius: BorderRadius.circular(6),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ShimmerBox(
                        height: 12,
                        width: 120,
                        borderRadius: BorderRadius.circular(3),
                      ),
                      const SizedBox(height: 6),
                      ShimmerBox(
                        height: 10,
                        width: 56,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ],
                  ),
                ),
                ShimmerBox(
                  height: 12,
                  width: 36,
                  borderRadius: BorderRadius.circular(3),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

enum PlayRailListVariant { player, game }

/** Spectate win-vote panel while tallies hydrate (mirrors web MatchVoteSkeleton). */
class MatchVoteSkeleton extends StatelessWidget {
  const MatchVoteSkeleton({super.key, this.showCastButtons = true});

  /// When false (e.g. seated player / anon loading), omit cast-button bars.
  final bool showCastButtons;

  @override
  Widget build(BuildContext context) {
    return _shimmerRoot(
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: Theme.of(context).extension<DamaColors>()?.borderSubtle ??
                const Color(0x22FFFFFF),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Title + half-overlap seat faces (parity with live MatchVotePanel).
            Row(
              children: [
                ShimmerBox(
                  height: 14,
                  width: 120,
                  borderRadius: BorderRadius.circular(4),
                ),
                const Spacer(),
                ShimmerBox(
                  width: 32,
                  height: 32,
                  borderRadius: BorderRadius.circular(16),
                ),
                Transform.translate(
                  offset: const Offset(-16, 0),
                  child: ShimmerBox(
                    width: 32,
                    height: 32,
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            for (var i = 0; i < 2; i++) ...[
              if (i > 0) const SizedBox(height: 10),
              Row(
                children: [
                  ShimmerBox(
                    height: 12,
                    width: 80,
                    borderRadius: BorderRadius.circular(3),
                  ),
                  const Spacer(),
                  ShimmerBox(
                    height: 12,
                    width: 56,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              ShimmerBox(
                height: 8,
                width: double.infinity,
                borderRadius: BorderRadius.circular(999),
              ),
              if (showCastButtons) ...[
                const SizedBox(height: 6),
                ShimmerBox(
                  height: 36,
                  width: double.infinity,
                  borderRadius: BorderRadius.circular(8),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

/** Finished-match correct voters list (title + blurb + ranked rows). */
class CorrectVotersSkeleton extends StatelessWidget {
  const CorrectVotersSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return _shimmerRoot(
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: Theme.of(context).extension<DamaColors>()?.borderSubtle ??
                const Color(0x22FFFFFF),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ShimmerBox(
              height: 14,
              width: 140,
              borderRadius: BorderRadius.circular(4),
            ),
            const SizedBox(height: 6),
            ShimmerBox(
              height: 10,
              width: 200,
              borderRadius: BorderRadius.circular(3),
            ),
            const SizedBox(height: 12),
            for (var i = 0; i < 6; i++) ...[
              if (i > 0) const SizedBox(height: 8),
              Row(
                children: [
                  ShimmerBox(
                    height: 12,
                    width: 18,
                    borderRadius: BorderRadius.circular(3),
                  ),
                  const SizedBox(width: 8),
                  ShimmerBox(
                    width: 28,
                    height: 28,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ShimmerBox(
                      height: 12,
                      width: double.infinity,
                      borderRadius: BorderRadius.circular(3),
                    ),
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

/** Live-game Watch sheet body: seats + QR preview + Join/Download. */
class LiveGameWatchSkeleton extends StatelessWidget {
  const LiveGameWatchSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return _shimmerRoot(
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ShimmerBox(
            height: 14,
            width: 120,
            borderRadius: BorderRadius.circular(4),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              ShimmerBox(
                width: 40,
                height: 40,
                borderRadius: BorderRadius.circular(20),
              ),
              Transform.translate(
                offset: const Offset(-20, 0),
                child: ShimmerBox(
                  width: 40,
                  height: 40,
                  borderRadius: BorderRadius.circular(20),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ShimmerBox(
                  height: 12,
                  width: double.infinity,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Center(
            child: ShimmerBox(
              width: 112,
              height: 112,
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          const SizedBox(height: 14),
          // Match real Watch sheet: stacked full-width Join then Download.
          ShimmerBox(
            height: 40,
            width: double.infinity,
            borderRadius: BorderRadius.circular(8),
          ),
          const SizedBox(height: 8),
          ShimmerBox(
            height: 40,
            width: double.infinity,
            borderRadius: BorderRadius.circular(8),
          ),
        ],
      ),
    );
  }
}

@Deprecated('Use PlayHubSkeleton')
class HomeShortcutsSkeleton extends StatelessWidget {
  const HomeShortcutsSkeleton({super.key});

  @override
  Widget build(BuildContext context) => const PlayHubSkeleton();
}

/// Spectate: blurb + connect fields + Chess.com board column (same as live).
class SpectatePageSkeleton extends StatelessWidget {
  const SpectatePageSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return _shimmerRoot(
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ShimmerBox(
            height: 28,
            width: 160,
            borderRadius: BorderRadius.circular(6),
          ),
          const SizedBox(height: 10),
          ShimmerBox(
            height: 14,
            width: double.infinity,
            borderRadius: BorderRadius.circular(4),
          ),
          const SizedBox(height: 16),
          ShimmerBox(
            height: 44,
            width: double.infinity,
            borderRadius: BorderRadius.circular(8),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: ShimmerBox(
                  height: 44,
                  width: double.infinity,
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ShimmerBox(
                  height: 44,
                  width: double.infinity,
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Expanded(
            child: BoardColumnSkeleton(
              wrapRoot: false,
              showTopTrailing: true,
              bottomClockActive: true,
            ),
          ),
        ],
      ),
    );
  }
}

/// Dashboard: blurb + panel cards + history list.
class DashboardPanelsSkeleton extends StatelessWidget {
  const DashboardPanelsSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return _shimmerRoot(
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ShimmerBox(
            height: 14,
            width: double.infinity,
            borderRadius: BorderRadius.circular(4),
          ),
          const SizedBox(height: 8),
          ShimmerBox(
            height: 14,
            width: 220,
            borderRadius: BorderRadius.circular(4),
          ),
          const SizedBox(height: 20),
          for (var i = 0; i < 4; i++) ...[
            ShimmerBox(
              height: 88,
              width: double.infinity,
              borderRadius: BorderRadius.circular(12),
            ),
            const SizedBox(height: 12),
          ],
          const SizedBox(height: 8),
          ShimmerBox(
            height: 18,
            width: 140,
            borderRadius: BorderRadius.circular(4),
          ),
          const SizedBox(height: 12),
          for (var i = 0; i < 3; i++) ...[
            ShimmerBox(
              height: 52,
              width: double.infinity,
              borderRadius: BorderRadius.circular(10),
            ),
            const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }
}

/// Full-screen shell bootstrap (replaces blank CircularProgressIndicator).
class ShellNavSkeleton extends StatelessWidget {
  const ShellNavSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return _shimmerRoot(
      SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ShimmerBox(
                height: 28,
                width: 160,
                borderRadius: BorderRadius.circular(6),
              ),
              const SizedBox(height: 16),
              ShimmerBox(
                height: 14,
                width: 220,
                borderRadius: BorderRadius.circular(4),
              ),
              const SizedBox(height: 24),
              Expanded(
                child: Column(
                  children: List.generate(5, (_) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: ShimmerBox(
                        height: 56,
                        width: double.infinity,
                        borderRadius: BorderRadius.circular(10),
                      ),
                    );
                  }),
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: List.generate(
                  4,
                  (_) => ShimmerBox(
                    height: 40,
                    width: 48,
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class PlayerInspectSkeleton extends StatelessWidget {
  const PlayerInspectSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return _shimmerRoot(
      Column(
        children: [
          ShimmerBox(
            width: 160,
            height: 160,
            borderRadius: BorderRadius.circular(12),
          ),
          const SizedBox(height: 16),
          ShimmerBox(
            height: 16,
            width: 120,
            borderRadius: BorderRadius.circular(4),
          ),
          const SizedBox(height: 20),
          for (var i = 0; i < 3; i++) ...[
            ShimmerBox(
              height: 14,
              width: double.infinity,
              borderRadius: BorderRadius.circular(4),
            ),
            const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }
}

class MatchSeatSkeleton extends StatelessWidget {
  const MatchSeatSkeleton({
    super.key,
    this.sideColumn = true,
    this.showTrailing = false,
    this.clockActive = false,
  });

  /// Chess.com top/bottom bar (default). When false, two wrap cards.
  final bool sideColumn;
  final bool showTrailing;
  final bool clockActive;

  @override
  Widget build(BuildContext context) {
    if (sideColumn) {
      return BoardSeatBarSkeleton(
        showTrailing: showTrailing,
        clockActive: clockActive,
      );
    }
    return _shimmerRoot(
      Row(
        children: [
          for (var i = 0; i < 2; i++) ...[
            if (i > 0) const SizedBox(width: 16),
            Expanded(
              child: Row(
                children: [
                  ShimmerBox(
                    width: 44,
                    height: 44,
                    borderRadius: BorderRadius.circular(22),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ShimmerBox(
                          height: 12,
                          width: 48,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        const SizedBox(height: 6),
                        ShimmerBox(
                          height: 14,
                          width: 90,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class MatchmakingSkeleton extends StatelessWidget {
  const MatchmakingSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return _shimmerRoot(
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ShimmerBox(
            height: 28,
            width: 180,
            borderRadius: BorderRadius.circular(6),
          ),
          const SizedBox(height: 10),
          ShimmerBox(
            height: 14,
            width: double.infinity,
            borderRadius: BorderRadius.circular(4),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              ShimmerBox(
                width: 56,
                height: 56,
                borderRadius: BorderRadius.circular(28),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ShimmerBox(
                      height: 16,
                      width: 140,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    const SizedBox(height: 8),
                    ShimmerBox(
                      height: 12,
                      width: 100,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: ShimmerBox(
                  height: 44,
                  width: double.infinity,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ShimmerBox(
                  height: 44,
                  width: double.infinity,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          ShimmerBox(
            height: 120,
            width: double.infinity,
            borderRadius: BorderRadius.circular(12),
          ),
          const SizedBox(height: 16),
          ShimmerBox(
            height: 14,
            width: 120,
            borderRadius: BorderRadius.circular(4),
          ),
          const SizedBox(height: 10),
          ShimmerBox(
            height: 44,
            width: double.infinity,
            borderRadius: BorderRadius.circular(8),
          ),
          const SizedBox(height: 10),
          ShimmerBox(
            height: 44,
            width: double.infinity,
            borderRadius: BorderRadius.circular(8),
          ),
        ],
      ),
    );
  }
}

/// Full Chess.com board column while match/spectate board hydrates.
class BoardGridSkeleton extends StatelessWidget {
  const BoardGridSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const BoardColumnSkeleton(
      showTopTrailing: true,
      bottomClockActive: true,
    );
  }
}

class FormCardSkeleton extends StatelessWidget {
  const FormCardSkeleton({super.key, this.fields = 3});

  final int fields;

  @override
  Widget build(BuildContext context) {
    return _shimmerRoot(
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < fields; i++) ...[
            ShimmerBox(
              height: 12,
              width: 80,
              borderRadius: BorderRadius.circular(4),
            ),
            const SizedBox(height: 8),
            ShimmerBox(
              height: 44,
              width: double.infinity,
              borderRadius: BorderRadius.circular(8),
            ),
            const SizedBox(height: 16),
          ],
          ShimmerBox(
            height: 44,
            width: double.infinity,
            borderRadius: BorderRadius.circular(8),
          ),
        ],
      ),
    );
  }
}

/// Legal doc: tab chips + title + section heading/body (matches LegalPage).
class LegalDocumentSkeleton extends StatelessWidget {
  const LegalDocumentSkeleton({super.key, this.sections = 4});

  final int sections;

  @override
  Widget build(BuildContext context) {
    return _shimmerRoot(
      ListView(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
        children: [
          Row(
            children: [
              for (final w in [72.0, 64.0, 80.0]) ...[
                ShimmerBox(
                  height: 36,
                  width: w,
                  borderRadius: BorderRadius.circular(8),
                ),
                const SizedBox(width: 8),
              ],
            ],
          ),
          const SizedBox(height: 24),
          ShimmerBox(
            height: 32,
            width: 200,
            borderRadius: BorderRadius.circular(6),
          ),
          const SizedBox(height: 28),
          for (var i = 0; i < sections; i++) ...[
            ShimmerBox(
              height: 20,
              width: 160,
              borderRadius: BorderRadius.circular(4),
            ),
            const SizedBox(height: 10),
            ShimmerBox(
              height: 12,
              width: double.infinity,
              borderRadius: BorderRadius.circular(4),
            ),
            const SizedBox(height: 6),
            ShimmerBox(
              height: 12,
              width: double.infinity,
              borderRadius: BorderRadius.circular(4),
            ),
            const SizedBox(height: 6),
            ShimmerBox(
              height: 12,
              width: 280,
              borderRadius: BorderRadius.circular(4),
            ),
            const SizedBox(height: 22),
          ],
        ],
      ),
    );
  }
}

/// Google-only auth login: centered title + subtitle + one CTA (not multi-field form).
class AuthLoginSkeleton extends StatelessWidget {
  const AuthLoginSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return _shimmerRoot(
      Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          ShimmerBox(
            height: 28,
            width: 200,
            borderRadius: BorderRadius.circular(6),
          ),
          const SizedBox(height: 12),
          ShimmerBox(
            height: 14,
            width: double.infinity,
            borderRadius: BorderRadius.circular(4),
          ),
          const SizedBox(height: 8),
          ShimmerBox(
            height: 14,
            width: 220,
            borderRadius: BorderRadius.circular(4),
          ),
          const SizedBox(height: 24),
          ShimmerBox(
            height: 48,
            width: double.infinity,
            borderRadius: BorderRadius.circular(8),
          ),
        ],
      ),
    );
  }
}

class GameLobbySkeleton extends StatelessWidget {
  const GameLobbySkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return _shimmerRoot(
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ShimmerBox(
            height: 20,
            width: 180,
            borderRadius: BorderRadius.circular(4),
          ),
          const SizedBox(height: 12),
          ShimmerBox(
            height: 14,
            width: 240,
            borderRadius: BorderRadius.circular(4),
          ),
          const SizedBox(height: 24),
          for (var i = 0; i < 3; i++) ...[
            ShimmerBox(
              height: 52,
              width: double.infinity,
              borderRadius: BorderRadius.circular(10),
            ),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}

class AvatarUploadSkeleton extends StatelessWidget {
  const AvatarUploadSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return _shimmerRoot(
      Column(
        children: [
          ShimmerBox(
            width: 160,
            height: 160,
            borderRadius: BorderRadius.circular(16),
          ),
          const SizedBox(height: 20),
          ShimmerBox(
            height: 44,
            width: 200,
            borderRadius: BorderRadius.circular(8),
          ),
        ],
      ),
    );
  }
}

/// Dedicated Status page shimmer (web [PlatformStatsPageSkeleton] parity).
/// Header + period + 9 KPI tiles + Usage-style chart card (title/subtitle/plane/legend).
class PlatformStatsPageSkeleton extends StatelessWidget {
  const PlatformStatsPageSkeleton(
      {super.key, this.tileCount = 9, this.wrapRoot = true});

  final int tileCount;
  final bool wrapRoot;

  @override
  Widget build(BuildContext context) {
    final n = tileCount < 1 ? 9 : tileCount;
    final border = damaColorsOf(context).borderSubtle;
    final body = Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ShimmerBox(
            height: 12,
            width: 220,
            borderRadius: BorderRadius.circular(4),
          ),
          const SizedBox(height: 16),
          ShimmerBox(
            height: 10,
            width: 72,
            borderRadius: BorderRadius.circular(3),
          ),
          const SizedBox(height: 6),
          ShimmerBox(
            height: 44,
            width: double.infinity,
            borderRadius: BorderRadius.circular(8),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (var i = 0; i < n; i++)
                SizedBox(
                  width: 112,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: kSkeletonSurfaceOf(context),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: border),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 12,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ShimmerBox(
                            height: 10,
                            width: 64,
                            borderRadius: BorderRadius.circular(3),
                          ),
                          const SizedBox(height: 8),
                          ShimmerBox(
                            height: 18,
                            width: 40,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 20),
          DecoratedBox(
            decoration: BoxDecoration(
              color: kSkeletonSurfaceOf(context),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: border),
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ShimmerBox(
                    height: 20,
                    width: 160,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  const SizedBox(height: 6),
                  ShimmerBox(
                    height: 12,
                    width: 200,
                    borderRadius: BorderRadius.circular(3),
                  ),
                  const SizedBox(height: 4),
                  ShimmerBox(
                    height: 10,
                    width: 64,
                    borderRadius: BorderRadius.circular(3),
                  ),
                  const SizedBox(height: 12),
                  ShimmerBox(
                    height: 220,
                    width: double.infinity,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  const SizedBox(height: 12),
                  for (var i = 0; i < 3; i++) ...[
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3),
                      child: Row(
                        children: [
                          ShimmerBox(
                            height: 8,
                            width: 8,
                            borderRadius: BorderRadius.circular(99),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: ShimmerBox(
                              height: 12,
                              width: 80,
                              borderRadius: BorderRadius.circular(3),
                            ),
                          ),
                          ShimmerBox(
                            height: 12,
                            width: 36,
                            borderRadius: BorderRadius.circular(3),
                          ),
                          const SizedBox(width: 8),
                          ShimmerBox(
                            height: 12,
                            width: 40,
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          const ActivityDashboardSectionsSkeleton(),
        ],
      ),
    );
    return wrapRoot ? _shimmerRoot(body) : body;
  }
}

/// Heatmap strip + cumulative plane + 3 breakdown cards (web ActivityDashboardSectionsSkeleton).
class ActivityDashboardSectionsSkeleton extends StatelessWidget {
  const ActivityDashboardSectionsSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final border = damaColorsOf(context).borderSubtle;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            color: kSkeletonSurfaceOf(context),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: border),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ShimmerBox(
                    height: 18,
                    width: 160,
                    borderRadius: BorderRadius.circular(4)),
                const SizedBox(height: 8),
                ShimmerBox(
                    height: 10,
                    width: 80,
                    borderRadius: BorderRadius.circular(3)),
                const SizedBox(height: 8),
                ShimmerBox(
                    height: 32,
                    width: 48,
                    borderRadius: BorderRadius.circular(4)),
                const SizedBox(height: 12),
                ShimmerBox(
                    height: 72,
                    width: double.infinity,
                    borderRadius: BorderRadius.circular(6)),
                const SizedBox(height: 12),
                // Live heatmap streak/peak stats row (2x2 → 4).
                Row(
                  children: [
                    for (var i = 0; i < 2; i++) ...[
                      if (i > 0) const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            ShimmerBox(
                                height: 10,
                                width: 72,
                                borderRadius: BorderRadius.circular(3)),
                            const SizedBox(height: 6),
                            ShimmerBox(
                                height: 14,
                                width: 40,
                                borderRadius: BorderRadius.circular(3)),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    for (var i = 0; i < 2; i++) ...[
                      if (i > 0) const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            ShimmerBox(
                                height: 10,
                                width: 72,
                                borderRadius: BorderRadius.circular(3)),
                            const SizedBox(height: 6),
                            ShimmerBox(
                                height: 14,
                                width: 40,
                                borderRadius: BorderRadius.circular(3)),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        DecoratedBox(
          decoration: BoxDecoration(
            color: kSkeletonSurfaceOf(context),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: border),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ShimmerBox(
                    height: 18,
                    width: 200,
                    borderRadius: BorderRadius.circular(4)),
                const SizedBox(height: 12),
                ShimmerBox(
                    height: 180,
                    width: double.infinity,
                    borderRadius: BorderRadius.circular(8)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        for (var i = 0; i < 3; i++) ...[
          if (i > 0) const SizedBox(height: 12),
          DecoratedBox(
            decoration: BoxDecoration(
              color: kSkeletonSurfaceOf(context),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: border),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  ShimmerBox(
                      height: 14,
                      width: 120,
                      borderRadius: BorderRadius.circular(3)),
                  const SizedBox(height: 16),
                  ShimmerBox(
                      height: 96,
                      width: 96,
                      borderRadius: BorderRadius.circular(99)),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

@Deprecated('Use PlatformStatsPageSkeleton - strip no longer on play hub')
class PlatformStatsStripSkeleton extends PlatformStatsPageSkeleton {
  const PlatformStatsStripSkeleton(
      {super.key, super.tileCount, super.wrapRoot});
}

class GeoAdSlotSkeleton extends StatelessWidget {
  const GeoAdSlotSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return _shimmerRoot(
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ShimmerBox(
            height: 12,
            width: 80,
            borderRadius: BorderRadius.circular(4),
          ),
          const SizedBox(height: 10),
          ShimmerBox(
            height: 96,
            width: double.infinity,
            borderRadius: BorderRadius.circular(10),
          ),
          const SizedBox(height: 8),
          ShimmerBox(
            height: 12,
            width: 120,
            borderRadius: BorderRadius.circular(4),
          ),
        ],
      ),
    );
  }
}
