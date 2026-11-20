import 'package:flutter/material.dart';

/// Opens the tablet/phone side menu that mirrors the web desktop left rail.
class PlayerShellRailAccess extends InheritedWidget {
  const PlayerShellRailAccess({
    super.key,
    required this.openRailMenu,
    required super.child,
  });

  final VoidCallback openRailMenu;

  static PlayerShellRailAccess? maybeOf(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<PlayerShellRailAccess>();
  }

  @override
  bool updateShouldNotify(PlayerShellRailAccess oldWidget) =>
      openRailMenu != oldWidget.openRailMenu;
}
