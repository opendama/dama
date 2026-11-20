import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:flutter/material.dart';

/// Exact Dama brand mark as default face when [imageUrl] is empty or fails.
/// Light theme → burgundy mark; dark theme → white mark (same assets as web).
class DamaUserAvatar extends StatelessWidget {
  const DamaUserAvatar({
    super.key,
    this.imageUrl,
    this.radius = 16,
    this.pieceSideLight,
    this.showMarkPlate = true,
  });

  final String? imageUrl;
  final double radius;

  /// When set (board seats), pick mark contrast from piece color, not app theme.
  /// `true` = light pieces → burgundy mark; `false` = dark pieces → white mark.
  final bool? pieceSideLight;
  final bool showMarkPlate;

  static const _markLight = 'assets/brand/dama-mark.png';
  static const _markDark = 'assets/brand/dama-mark-white.png';

  @override
  Widget build(BuildContext context) {
    final thumb = (imageUrl ?? '').trim();
    final tokens = damaColorsOf(context);
    final brightness = Theme.of(context).brightness;
    final useLightMark = pieceSideLight ?? (brightness == Brightness.light);
    final markAsset = useLightMark ? _markLight : _markDark;
    final plate = showMarkPlate ? tokens.surfaceMuted : Colors.transparent;
    final size = radius * 2;
    // ~84% of face - exact logo, modest inset for circular clips.
    final inset = size * 0.08;

    Widget markFace() {
      return ColoredBox(
        color: plate,
        child: Padding(
          padding: EdgeInsets.all(inset),
          child: Image.asset(markAsset, fit: BoxFit.contain),
        ),
      );
    }

    return ClipOval(
      child: SizedBox(
        width: size,
        height: size,
        child: thumb.isEmpty
            ? markFace()
            : Image.network(
                thumb,
                fit: BoxFit.cover,
                width: size,
                height: size,
                errorBuilder: (_, __, ___) => markFace(),
              ),
      ),
    );
  }
}
