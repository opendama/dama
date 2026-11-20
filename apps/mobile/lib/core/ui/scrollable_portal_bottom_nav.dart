import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:flutter/material.dart';

/// Horizontal-scrolling portal bottom bar for ads/events (many DB tabs).
/// Material [NavigationBar] does not scroll and clips destinations on narrow screens.
class ScrollablePortalBottomNav extends StatelessWidget {
  const ScrollablePortalBottomNav({
    super.key,
    required this.selectedIndex,
    required this.onDestinationSelected,
    required this.destinations,
  });

  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final List<NavigationDestination> destinations;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final theme = Theme.of(context);
    final idx = selectedIndex.clamp(
        0, destinations.isEmpty ? 0 : destinations.length - 1);

    return Material(
      color: theme.navigationBarTheme.backgroundColor ??
          theme.colorScheme.surfaceContainer,
      elevation: theme.navigationBarTheme.elevation ?? 3,
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 64,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 4),
            itemCount: destinations.length,
            itemBuilder: (context, i) {
              final d = destinations[i];
              final selected = i == idx;
              final labelColor = selected
                  ? (theme.navigationBarTheme.indicatorColor != null
                      ? theme.colorScheme.onSurface
                      : tokens.gold)
                  : tokens.onSurfaceMuted;
              return InkWell(
                onTap: () => onDestinationSelected(i),
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  width: 72,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconTheme(
                        data: IconThemeData(
                          size: 24,
                          color: labelColor,
                        ),
                        child: selected ? (d.selectedIcon ?? d.icon) : d.icon,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        d.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: labelColor,
                          fontWeight:
                              selected ? FontWeight.w600 : FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
