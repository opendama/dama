import 'package:dama_mobile/features/home/player_shell_rail_access.dart';
import 'package:flutter/material.dart';

/// AppBar leading that opens the desktop-rail mirror sheet when under PlayerShell.
/// Returns null outside the shell so AppBar keeps its default back leading.
class PlayerRailMenuLeading {
  PlayerRailMenuLeading._();

  static Widget? maybe(BuildContext context) {
    final access = PlayerShellRailAccess.maybeOf(context);
    if (access == null) return null;
    return IconButton(
      tooltip: MaterialLocalizations.of(context).openAppDrawerTooltip,
      onPressed: access.openRailMenu,
      icon: const Icon(Icons.menu),
    );
  }
}
