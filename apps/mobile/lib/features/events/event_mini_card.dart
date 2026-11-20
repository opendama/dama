import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/events.dart';
import 'package:dama_mobile/core/types/prize_pool_lines.dart';
import 'package:dama_mobile/core/ui/gallery_carousel.dart';
import 'package:dama_mobile/features/player/player_inspect_sheet.dart';
import 'package:dama_mobile/widgets/dama_user_avatar.dart';
import 'package:dama_mobile/widgets/host_trust_badge.dart';
import 'package:flutter/material.dart';

/// Status = neutral white; fee = brand CTA (enroll/Join parity).
Widget _eventMediaBadge(
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

/// Marketplace minicard: media badges · title · host · pot · fill · Join.
/// No join_code, host fee, pending, or raw IDs on the card.
class EventMiniCard extends StatelessWidget {
  const EventMiniCard({
    super.key,
    required this.event,
    required this.carouselAria,
    required this.playersLabel,
    this.unlimitedPlayersLabel = '',
    required this.entryLabel,
    required this.freeLabel,
    required this.ctaLabel,
    required this.hostedByLabel,
    required this.onJoin,
    required this.onOpen,
    required this.metaSeparator,
    required this.amountCurrencySeparator,
    this.emptyValue = '',
    this.statusLabel,
    this.sourceBadge,
    this.prizePoolLabels,
    this.ctaSlot,
    this.hostRepFinishedLabel = '',
    this.hostRepCancelledLabel = '',
    this.hostRepReportsLabel = '',
    this.hostRepMetaSeparator = '',
    this.detailDescriptionLabel = '',
  });

  final HostedEvent event;
  final String carouselAria;
  final String playersLabel;
  final String unlimitedPlayersLabel;
  final String entryLabel;
  final String freeLabel;
  final String ctaLabel;
  final String hostedByLabel;
  final VoidCallback? onJoin;
  final VoidCallback? onOpen;
  final String metaSeparator;
  final String amountCurrencySeparator;
  final String emptyValue;
  final String? statusLabel;

  /// Community badge under title (unified Tournament discovery).
  final String? sourceBadge;
  final PrizePoolCardLabels? prizePoolLabels;

  /// Web `ctaSlot` parity (e.g. Join + Report row). When set, replaces default Join.
  final Widget? ctaSlot;
  final String hostRepFinishedLabel;
  final String hostRepCancelledLabel;
  final String hostRepReportsLabel;
  final String hostRepMetaSeparator;
  final String detailDescriptionLabel;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final images = event.carouselImages;
    final poolLines = prizePoolLabels != null
        ? hostedEventPrizePoolLines(event, prizePoolLabels!)
        : const <String>[];
    final feeAmt = event.entryFeeAmount;
    final feeCur = event.entryFeeCurrency.trim();
    final entry = event.isFreeEntry
        ? freeLabel
        : (feeAmt != null &&
                feeCur.isNotEmpty &&
                amountCurrencySeparator.isNotEmpty)
            ? '$feeAmt$amountCurrencySeparator$feeCur'
            : emptyValue;
    final status = (statusLabel ??
            (event.statusLabel.isNotEmpty ? event.statusLabel : event.status))
        .trim();
    final approved = event.approvedCount;
    final fillLeft = approved != null
        ? '$approved'
        : (emptyValue.isNotEmpty ? emptyValue : '');
    final fillRight = seatCapFillRight(
      event.maxPlayers,
      event.seatCapUnlimited,
      unlimitedPlayersLabel,
    );
    final playersLine = fillRight != null
        ? '$fillLeft/$fillRight $playersLabel'.trim()
        : '$fillLeft $playersLabel'.trim();
    final hostName = event.organizerUsername.trim();
    final hostTrustBadge = event.organizerHostTrustBadge.trim();
    final hostAvatar = event.organizerAvatarUrl.trim();
    final hostRepSep = hostRepMetaSeparator;
    final hostRepLine = (hostRepSep.isNotEmpty &&
            hostRepFinishedLabel.trim().isNotEmpty &&
            hostRepCancelledLabel.trim().isNotEmpty &&
            hostRepReportsLabel.trim().isNotEmpty &&
            event.organizerFinishedPaidCups != null &&
            event.organizerCancelledPaidCups != null &&
            event.organizerOpenReports != null)
        ? [
            '${hostRepFinishedLabel.trim()} ${event.organizerFinishedPaidCups}',
            '${hostRepCancelledLabel.trim()} ${event.organizerCancelledPaidCups}',
            '${hostRepReportsLabel.trim()} ${event.organizerOpenReports}',
          ].join(hostRepSep)
        : '';
    final formatSize = [
      event.formatLabel.trim(),
      event.sizeLabel.trim(),
    ].where((s) => s.isNotEmpty).join(
          metaSeparator.isNotEmpty ? metaSeparator : ' · ',
        );

    return InkWell(
      onTap: onOpen,
      borderRadius: BorderRadius.circular(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: images.isEmpty
                    ? AspectRatio(
                        aspectRatio: 1,
                        child: ColoredBox(
                          color: () {
                            final brand = (event.brandColor ?? '').trim();
                            if (brand.isEmpty) return tokens.surfaceMuted;
                            final hex = brand.startsWith('#')
                                ? brand.substring(1)
                                : brand;
                            final parsed = int.tryParse(
                              hex.length == 6 ? 'FF$hex' : hex,
                              radix: 16,
                            );
                            return parsed != null
                                ? Color(parsed)
                                : tokens.surfaceMuted;
                          }(),
                        ),
                      )
                    : GalleryCarousel(
                        images: images,
                        semanticsLabel: carouselAria,
                        aspectRatio: 1,
                      ),
              ),
              if (status.isNotEmpty)
                _eventMediaBadge(
                  status,
                  left: true,
                  fee: false,
                  brand: tokens.brand,
                  onBrand: tokens.onBrand,
                ),
              if (entry.isNotEmpty)
                _eventMediaBadge(
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
            event.title,
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
          if (hostName.isNotEmpty) ...[
            const SizedBox(height: 4),
            InkWell(
              onTap: event.organizerId.trim().isEmpty
                  ? null
                  : () {
                      showPlayerInspectSheet(
                        context,
                        event.organizerId.trim(),
                      );
                    },
              borderRadius: BorderRadius.circular(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      DamaUserAvatar(
                        imageUrl: hostAvatar.isNotEmpty ? hostAvatar : null,
                        radius: 10,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text.rich(
                          TextSpan(
                            children: [
                              TextSpan(
                                text: '$hostedByLabel ',
                                style: TextStyle(
                                  color: tokens.onSurfaceMuted,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              TextSpan(
                                text: hostName,
                                style: TextStyle(
                                  color:
                                      Theme.of(context).colorScheme.onSurface,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  decoration:
                                      event.organizerId.trim().isNotEmpty
                                          ? TextDecoration.underline
                                          : TextDecoration.none,
                                  decorationColor: tokens.onSurfaceMuted,
                                ),
                              ),
                            ],
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Flexible(
                        child: HostTrustBadge(
                          label: hostTrustBadge,
                          tier: event.organizerHostTrustTier,
                          fontSize: 9,
                          dense: true,
                        ),
                      ),
                    ],
                  ),
                  if (hostRepLine.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      hostRepLine,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: tokens.onSurfaceMuted,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
          if (formatSize.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              formatSize,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: tokens.onSurfaceMuted,
                fontSize: 12,
                fontWeight: FontWeight.w400,
              ),
            ),
          ],
          if (event.description.trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            if (detailDescriptionLabel.trim().isNotEmpty)
              Text(
                detailDescriptionLabel.trim(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: tokens.onSurfaceMuted,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.4,
                ),
              ),
            Text(
              event.description.trim(),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
                fontSize: 12,
                height: 1.35,
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
            child: ctaSlot ??
                FilledButton(
                  onPressed: onJoin,
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
      ),
    );
  }
}

/// 2-up phones → denser on tablets (tournament grid parity + host row).
class EventMiniCardGrid extends StatelessWidget {
  const EventMiniCardGrid({
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
        // Extra room for host + stacked pot lines under 1:1 media.
        childAspectRatio: width >= 560 ? 0.56 : 0.46,
      ),
      itemBuilder: itemBuilder,
    );
  }
}
