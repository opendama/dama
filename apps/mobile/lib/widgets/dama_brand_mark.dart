import 'package:flutter/material.dart';

/// Theme-aware dama crown mark (burgundy on light, white on dark).
class DamaBrandMark extends StatelessWidget {
  const DamaBrandMark({
    super.key,
    this.size = 28,
    this.semanticLabel,

    /// Force white mark (splash / burgundy plates).
    this.forceWhite = false,
  });

  final double size;
  final String? semanticLabel;
  final bool forceWhite;

  static const lightAsset = 'assets/brand/dama-mark.png';
  static const darkAsset = 'assets/brand/dama-mark-white.png';

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final asset = forceWhite || dark ? darkAsset : lightAsset;
    return Image.asset(
      asset,
      width: size,
      height: size,
      fit: BoxFit.contain,
      semanticLabel: semanticLabel,
      filterQuality: FilterQuality.high,
    );
  }
}

/// Mark + brand title row for AppBars and shells.
class DamaBrandTitle extends StatelessWidget {
  const DamaBrandTitle({
    super.key,
    required this.title,
    this.markSize = 28,
  });

  final String title;
  final double markSize;

  @override
  Widget build(BuildContext context) {
    if (title.trim().isEmpty) return const SizedBox.shrink();
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        DamaBrandMark(size: markSize, semanticLabel: null),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            title,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
      ],
    );
  }
}
