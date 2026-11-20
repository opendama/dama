import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Active play resume (web `dama-active-play` / sessionStorage parity).
const playSessionPrefsKey = 'dama-active-play';

class StoredPlaySession {
  const StoredPlaySession({
    required this.gameId,
    required this.mode,
    required this.phase,
    this.paused = false,
    this.pauseExpiresAtUnixMs = 0,
    this.pauseKind = '',
    required this.updatedAt,
  });

  final String gameId;
  final String mode;

  /// `playing` or `finished`.
  final String phase;

  /// Set when the seated player froze the match (or the server reports it paused).
  final bool paused;

  /// Server `pause_expires_at_unix_ms` for floating countdown while browsing.
  final int pauseExpiresAtUnixMs;

  /// `player` or `official` when paused; empty otherwise.
  final String pauseKind;
  final String updatedAt;

  bool get isOfficialPause => paused && pauseKind.trim() == 'official';

  Map<String, dynamic> toJson() => {
        'gameId': gameId,
        'mode': mode,
        'phase': phase,
        'paused': paused,
        if (pauseExpiresAtUnixMs > 0)
          'pauseExpiresAtUnixMs': pauseExpiresAtUnixMs,
        if (pauseKind.trim().isNotEmpty) 'pauseKind': pauseKind.trim(),
        'updatedAt': updatedAt,
      };

  static StoredPlaySession? fromJson(Map<String, dynamic> map) {
    final id = (map['gameId'] as String?)?.trim() ?? '';
    if (id.isEmpty) return null;
    final phase = (map['phase'] as String?)?.trim() ?? '';
    if (phase != 'playing' && phase != 'finished') return null;
    final mode = (map['mode'] as String?)?.trim() ?? '';
    final expires = (map['pauseExpiresAtUnixMs'] as num?)?.toInt() ?? 0;
    final kind = (map['pauseKind'] as String?)?.trim() ?? '';
    return StoredPlaySession(
      gameId: id,
      mode: mode,
      phase: phase,
      paused: map['paused'] == true,
      pauseExpiresAtUnixMs: expires > 0 ? expires : 0,
      pauseKind: kind,
      updatedAt: (map['updatedAt'] as String?)?.trim() ?? '',
    );
  }

  StoredPlaySession copyWith({
    String? mode,
    String? phase,
    bool? paused,
    int? pauseExpiresAtUnixMs,
    bool clearPauseExpires = false,
    String? pauseKind,
    bool clearPauseKind = false,
    String? updatedAt,
  }) {
    return StoredPlaySession(
      gameId: gameId,
      mode: mode ?? this.mode,
      phase: phase ?? this.phase,
      paused: paused ?? this.paused,
      pauseExpiresAtUnixMs: clearPauseExpires
          ? 0
          : (pauseExpiresAtUnixMs ?? this.pauseExpiresAtUnixMs),
      pauseKind: clearPauseKind ? '' : (pauseKind ?? this.pauseKind),
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

/// In-memory + SharedPreferences active play session.
/// Notifies shell nav and the floating resume control after writes.
class PlaySessionStore extends ChangeNotifier {
  PlaySessionStore._();
  static final PlaySessionStore instance = PlaySessionStore._();

  StoredPlaySession? _session;
  String? _activeBoardGameId;
  int _writeGen = 0;
  Future<void>? _loadFuture;
  bool _manualResume = false;
  bool _notifyScheduled = false;

  StoredPlaySession? get session => _session;

  /// Game id of the match board currently mounted, if any.
  String? get activeBoardGameId => _activeBoardGameId;

  Future<void> ensureLoaded() {
    return _loadFuture ??= _load();
  }

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (_writeGen != 0) return;
      final raw = prefs.getString(playSessionPrefsKey);
      if (raw == null || raw.isEmpty) return;
      final decoded = jsonDecode(raw);
      Map<String, dynamic>? map;
      if (decoded is Map<String, dynamic>) {
        map = decoded;
      } else if (decoded is Map) {
        map = Map<String, dynamic>.from(decoded);
      }
      if (map == null || _writeGen != 0) return;
      final next = StoredPlaySession.fromJson(map);
      if (_writeGen != 0) return;
      _session = next;
      if (next != null) _notify();
    } catch (_) {
      // Fail closed: no session.
    }
  }

  bool _same(StoredPlaySession a, StoredPlaySession b) {
    return a.gameId == b.gameId &&
        a.mode == b.mode &&
        a.phase == b.phase &&
        a.paused == b.paused &&
        a.pauseExpiresAtUnixMs == b.pauseExpiresAtUnixMs &&
        a.pauseKind == b.pauseKind;
  }

  Future<void> store(StoredPlaySession session) async {
    await ensureLoaded();
    final current = _session;
    if (current != null && _same(current, session)) return;
    _writeGen++;
    final gen = _writeGen;
    _session = session;
    _notify();
    final prefs = await SharedPreferences.getInstance();
    if (gen != _writeGen) return;
    await prefs.setString(playSessionPrefsKey, jsonEncode(session.toJson()));
    if (gen != _writeGen && _session != null) {
      await prefs.setString(
        playSessionPrefsKey,
        jsonEncode(_session!.toJson()),
      );
    }
  }

  /// Keep phase/mode and flip the paused flag on the current playing session.
  Future<void> patchPaused(
    bool paused, {
    int? pauseExpiresAtUnixMs,
    String? pauseKind,
  }) async {
    await ensureLoaded();
    final current = _session;
    if (current == null || current.phase != 'playing') return;
    final nextExpires =
        paused ? (pauseExpiresAtUnixMs ?? current.pauseExpiresAtUnixMs) : 0;
    final nextKind = paused ? (pauseKind ?? current.pauseKind).trim() : '';
    if (current.paused == paused &&
        current.pauseExpiresAtUnixMs == nextExpires &&
        current.pauseKind == nextKind) {
      return;
    }
    await store(
      current.copyWith(
        paused: paused,
        pauseExpiresAtUnixMs: nextExpires,
        clearPauseExpires: !paused || nextExpires <= 0,
        pauseKind: nextKind,
        clearPauseKind: !paused || nextKind.isEmpty,
        updatedAt: DateTime.now().toUtc().toIso8601String(),
      ),
    );
  }

  Future<void> clear() async {
    if (_session == null) return;
    _writeGen++;
    final gen = _writeGen;
    _session = null;
    _notify();
    final prefs = await SharedPreferences.getInstance();
    if (gen != _writeGen) return;
    await prefs.remove(playSessionPrefsKey);
  }

  void setActiveBoardGameId(String? gameId) {
    final next = (gameId ?? '').trim();
    final value = next.isEmpty ? null : next;
    if (_activeBoardGameId == value) return;
    _activeBoardGameId = value;
    _notify();
  }

  /// Defer so initState/dispose can update the session during a parent build.
  void _notify() {
    if (_notifyScheduled) return;
    _notifyScheduled = true;
    scheduleMicrotask(() {
      _notifyScheduled = false;
      if (hasListeners) notifyListeners();
    });
  }

  void markManualResume() {
    _manualResume = true;
  }

  /// True once after a seated Resume click, then clears.
  /// Auto-resume toasts skip that turn.
  bool takeManualResume() {
    final pending = _manualResume;
    _manualResume = false;
    return pending;
  }
}
