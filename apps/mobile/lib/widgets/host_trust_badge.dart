import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/trust/host_trust_tier.dart';
import 'package:flutter/material.dart';

/// Compact trust chip for host cards / profiles.
/// Document-verified → fintech KYC green + check.
/// Phone-verified → brand burgundy soft chip + check.
/// Unverified / unknown → muted metadata chip.
class HostTrustBadge extends StatelessWidget {
  const HostTrustBadge({
    super.key,
    this.label,
    this.tier,
    this.fontSize = 10,
    this.onMedia = false,
    this.dense = false,
  });

  /// Server-resolved badge label from host trust chrome.
  final String? label;

  /// Server host_trust_tier: unverified | phone_verified | document_verified.
  final String? tier;

  final double fontSize;

  /// High-contrast tones for badges on brand/media overlays.
  final bool onMedia;

  /// Slightly tighter padding for dense lists.
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final text = (label ?? '').trim();
    if (text.isEmpty) return const SizedBox.shrink();

    final tokens = damaColorsOf(context);
    final code = normalizeHostTrustTier(tier);
    final showIcon = hostTrustTierShowsCheck(tier);

    late final Color fg;
    late final Color bg;
    late final Color border;
    switch (code) {
      case HostTrustTierCode.documentVerified:
        fg = tokens.verified;
        bg = onMedia
            ? tokens.verified.withValues(alpha: 0.22)
            : tokens.verifiedBg;
        border = onMedia
            ? tokens.verified.withValues(alpha: 0.55)
            : tokens.verifiedBorder;
      case HostTrustTierCode.phoneVerified:
        fg = tokens.brand;
        bg = onMedia ? tokens.brand.withValues(alpha: 0.22) : tokens.brandMuted;
        border = onMedia
            ? tokens.brand.withValues(alpha: 0.50)
            : Color.lerp(tokens.brand, tokens.border, 0.65)!;
      case HostTrustTierCode.unverified:
      case HostTrustTierCode.unknown:
        fg = tokens.onSurfaceMuted;
        bg = tokens.surface;
        border = tokens.border;
    }

    final padH = dense ? 5.0 : 6.0;
    final padV = dense ? 2.0 : 2.0;
    final iconSize = fontSize + 1;

    return Container(
      padding: EdgeInsets.symmetric(horizontal: padH, vertical: padV),
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showIcon) ...[
            Icon(
              Icons.verified,
              size: iconSize,
              color: fg,
            ),
            const SizedBox(width: 3),
          ],
          Flexible(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: fg,
                fontSize: fontSize,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.3,
                height: 1.1,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
