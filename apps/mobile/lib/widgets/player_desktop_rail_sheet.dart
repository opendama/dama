import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/widgets/dama_brand_mark.dart';
import 'package:flutter/material.dart';

/// Side sheet mirroring web desktop left rail (tablet/phone hamburger parity).
Future<void> showPlayerDesktopRailSheet({
  required BuildContext context,
  required String brandName,
  required List<ClientNavLink> links,
  required Future<void> Function(ClientNavLink link) onSelect,
  String? selectedRouteKey,
}) {
  return showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
    barrierColor: Colors.black54,
    transitionDuration: const Duration(milliseconds: 220),
    pageBuilder: (ctx, anim, secondary) {
      return SafeArea(
        child: Align(
          alignment: Alignment.centerLeft,
          child: Material(
            elevation: 8,
            color: Theme.of(ctx).colorScheme.surface,
            child: SizedBox(
              width: 300,
              height: MediaQuery.sizeOf(ctx).height,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 8, 12),
                    child: Row(
                      children: [
                        Expanded(
                          child: brandName.trim().isNotEmpty
                              ? DamaBrandTitle(
                                  title: brandName.trim(), markSize: 28)
                              : const DamaBrandMark(size: 28),
                        ),
                        IconButton(
                          tooltip:
                              MaterialLocalizations.of(ctx).closeButtonTooltip,
                          onPressed: () => Navigator.of(ctx).pop(),
                          icon: const Icon(Icons.close, size: 20),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  Expanded(
                    child: ListView.builder(
                      padding: const EdgeInsets.symmetric(
                          vertical: 8, horizontal: 8),
                      itemCount: links.length,
                      itemBuilder: (context, i) {
                        final link = links[i];
                        final key = link.routeKey.trim();
                        final selected = selectedRouteKey != null &&
                            selectedRouteKey.trim() == key;
                        return ListTile(
                          selected: selected,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          title: Text(
                            link.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          onTap: () async {
                            Navigator.of(ctx).pop();
                            await onSelect(link);
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    },
    transitionBuilder: (ctx, anim, secondary, child) {
      final offset = Tween<Offset>(
        begin: const Offset(-1, 0),
        end: Offset.zero,
      ).animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic));
      return SlideTransition(position: offset, child: child);
    },
  );
}
