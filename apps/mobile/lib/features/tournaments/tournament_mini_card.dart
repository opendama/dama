import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/events.dart' show seatCapFillRight;
import 'package:dama_mobile/core/types/tournament.dart';
import 'package:dama_mobile/core/types/prize_pool_lines.dart';
import 'package:dama_mobile/core/ui/gallery_carousel.dart';
import 'package:flutter/material.dart';

/// Status = neutral white; fee = brand CTA (enroll/Join parity).
Widget _mediaBadge(
  String text, {
  required bool left,
  required bool fee,
  required Color brand,
  required Color onBrand,
}) {
  return Positioned(
    left: left ? 8 : null,
    right: left ? null : 8,
    top: 8,
    child: Container(
      constraints: const BoxConstraints(maxWidth: 130),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: fee ? brand : Colors.white,
        borderRadius: BorderRadius.circular(999),
        boxShadow: const [
          BoxShadow(
            color: Color(0x22000000),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Text(
        text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: fee ? onBrand : const Color(0xFF171717),
          fontSize: 11,
          fontWeight: FontWeight.w600,
          height: 1,
        ),
      ),
    ),
  );
}

/// Marketplace minicard: media badges (status + entry) · title · pot · fill · enroll.
class TournamentMiniCard extends StatelessWidget {
  const TournamentMiniCard({
    super.key,
    required this.tournament,
    required this.carouselAria,
    required this.playersLabel,
    this.unlimitedPlayersLabel = '',
    required this.entryLabel,
    required this.freeLabel,
    required this.ctaLabel,
    required this.onEnroll,
    required this.metaSeparator,
    required this.amountCurrencySeparator,
    this.emptyValue = '',
    this.statusLabel,
    this.sourceBadge,
    this.prizePoolLabels,
  });

  final RestTournament tournament;
  final String carouselAria;
  final String playersLabel;
  final String unlimitedPlayersLabel;
  final String entryLabel;
  final String freeLabel;
  final String ctaLabel;
  final VoidCallback? onEnroll;
  final String metaSeparator;
  final String amountCurrencySeparator;
  final String emptyValue;
  final String? statusLabel;

  /// Official | Community badge under title (unified Tournament discovery).
  final String? sourceBadge;
  final PrizePoolCardLabels? prizePoolLabels;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final images = tournament.carouselImages;
    final poolLines = prizePoolLabels != null
        ? restTournamentPrizePoolLines(tournament, prizePoolLabels!)
        : const <String>[];
    final feeAmt = tournament.entryFeeAmount;
    final feeCur = tournament.entryFeeCurrency.trim();
    final entry = tournament.isFree
        ? freeLabel
        : (feeAmt != null &&
                feeCur.isNotEmpty &&
                amountCurrencySeparator.isNotEmpty)
            ? '$feeAmt$amountCurrencySeparator$feeCur'
            : emptyValue;
    final status = (statusLabel ??
            (tournament.statusLabel.isNotEmpty
                ? tournament.statusLabel
                : tournament.status))
        .trim();
    final players = tournament.playersCount;
    final fillLeft = players != null
        ? '$players'
        : (emptyValue.isNotEmpty ? emptyValue : '');
    final fillRight = seatCapFillRight(
      tournament.maxPlayers,
      tournament.seatCapUnlimited,
      unlimitedPlayersLabel,
    );
    final playersLine = fillRight != null
        ? '$fillLeft/$fillRight $playersLabel'.trim()
        : '$fillLeft $playersLabel'.trim();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Stack(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: GalleryCarousel(
                images: images,
                semanticsLabel: carouselAria,
                aspectRatio: 1,
              ),
            ),
            if (status.isNotEmpty)
              _mediaBadge(
                status,
                left: true,
                fee: false,
                brand: tokens.brand,
                onBrand: tokens.onBrand,
              ),
            if (entry.isNotEmpty)
              _mediaBadge(
                entry,
                left: false,
                fee: true,
                brand: tokens.brand,
                onBrand: tokens.onBrand,
              ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          tournament.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
            fontWeight: FontWeight.w600,
            fontSize: 14,
            height: 1.2,
          ),
        ),
        if ((sourceBadge ?? '').trim().isNotEmpty) ...[
          const SizedBox(height: 2),
          Text(
            sourceBadge!.trim(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: tokens.onSurfaceMuted,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.4,
            ),
          ),
        ],
        if (tournament.formatLabel.trim().isNotEmpty) ...[
          const SizedBox(height: 2),
          Text(
            tournament.formatLabel.trim(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: tokens.onSurfaceMuted,
              fontSize: 12,
              fontWeight: FontWeight.w400,
            ),
          ),
        ],
        for (final line in poolLines) ...[
          const SizedBox(height: 2),
          Text(
            line,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurface,
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
        const SizedBox(height: 2),
        Text(
          playersLine,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: tokens.onSurfaceMuted,
            fontSize: 12,
            fontWeight: FontWeight.w400,
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 32,
          width: double.infinity,
          child: FilledButton(
            onPressed: onEnroll,
            style: FilledButton.styleFrom(
              padding: EdgeInsets.zero,
              backgroundColor: tokens.gold,
              foregroundColor: tokens.onGold,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              textStyle: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            child: Text(ctaLabel),
          ),
        ),
      ],
    );
  }
}

/// 2-up phones → denser on tablets (screenshot grid).
class TournamentMiniCardGrid extends StatelessWidget {
  const TournamentMiniCardGrid({
    super.key,
    required this.itemCount,
    required this.itemBuilder,
  });

  final int itemCount;
  final Widget Function(BuildContext context, int index) itemBuilder;

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
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: itemCount,
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        mainAxisSpacing: 20,
        crossAxisSpacing: 12,
        // Extra vertical room for stacked pot lines under 1:1 media.
        childAspectRatio: width >= 560 ? 0.62 : 0.52,
      ),
      itemBuilder: itemBuilder,
    );
  }
}
