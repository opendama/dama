import 'package:flutter/foundation.dart';

/// Bottom-nav coordinator for deep links / notifs (web `/?view=tournaments` active-nav parity).
///
/// Prefer selecting the shell Tournaments tab over pushing a full-screen [TournamentsPage]
/// that covers [PlayerShell]'s NavigationBar.
class PlayerShellController extends ChangeNotifier {
  PlayerShellController._();
  static final PlayerShellController instance = PlayerShellController._();

  String? _routeKey;
  String? _tournamentsSource;
  String? _tournamentsFocusId;
  String? _tournamentsJoinCode;
  int _epoch = 0;

  String? get routeKey => _routeKey;
  String? get tournamentsSource => _tournamentsSource;
  String? get tournamentsFocusId => _tournamentsFocusId;
  String? get tournamentsJoinCode => _tournamentsJoinCode;
  int get epoch => _epoch;

  void openTournaments({
    String? source,
    String? focusId,
    String? joinCode,
  }) {
    final src = (source ?? '').trim().toLowerCase();
    _routeKey = 'tournaments';
    _tournamentsSource =
        (src == 'official' || src == 'community' || src == 'all') ? src : null;
    final id = (focusId ?? '').trim();
    _tournamentsFocusId = id.isEmpty ? null : id;
    final code = (joinCode ?? '').trim();
    _tournamentsJoinCode = code.isEmpty ? null : code;
    if (_tournamentsSource == null && code.isNotEmpty) {
      _tournamentsSource = 'community';
    }
    _epoch++;
    notifyListeners();
  }

  /// Leave Tournaments/other tabs and show Play home (web `/?` / VS-AI parity).
  void openHome() {
    _routeKey = 'home';
    _tournamentsSource = null;
    _tournamentsFocusId = null;
    _tournamentsJoinCode = null;
    _epoch++;
    notifyListeners();
  }
}
