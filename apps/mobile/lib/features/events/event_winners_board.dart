import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:flutter/material.dart';

/// Placed-entry winners list for event results (organizer + player surfaces).
class EventWinnersBoard extends StatelessWidget {
  const EventWinnersBoard({
    super.key,
    required this.title,
    required this.entries,
    required this.emptyValue,
    this.logoUrl,
    this.sponsorLogoUrl,
    this.sponsorName,
  });

  final String title;
  final List<HostedEventEntry> entries;
  final String emptyValue;
  final String? logoUrl;
  final String? sponsorLogoUrl;
  final String? sponsorName;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final placed = entries.where((e) => e.placement != null).toList()
      ..sort((a, b) => (a.placement ?? 999).compareTo(b.placement ?? 999));
    final titleText = title.trim();
    final logo = (logoUrl ?? '').trim();
    final sponsorLogo = (sponsorLogoUrl ?? '').trim();
    final sponsor = (sponsorName ?? '').trim();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (titleText.isNotEmpty) ...[
          Text(
            titleText,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
        ],
        if (logo.isNotEmpty ||
            sponsorLogo.isNotEmpty ||
            sponsor.isNotEmpty) ...[
          Wrap(
            spacing: 12,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if (logo.isNotEmpty)
                Image.network(
                  logo,
                  height: 40,
                  errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                ),
              if (sponsorLogo.isNotEmpty)
                Image.network(
                  sponsorLogo,
                  height: 32,
                  errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                ),
              if (sponsor.isNotEmpty)
                Text(
                  sponsor,
                  style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
                ),
            ],
          ),
          const SizedBox(height: 8),
        ],
        if (placed.isEmpty)
          Text(
            emptyValue,
            style: TextStyle(color: tokens.onSurfaceMuted),
          )
        else
          for (final e in placed)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  SizedBox(
                    width: 36,
                    child: Text(
                      '${e.placement}',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      e.username.trim().isNotEmpty
                          ? e.username.trim()
                          : emptyValue,
                    ),
                  ),
                ],
              ),
            ),
      ],
    );
  }
}
