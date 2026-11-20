import 'package:shared_preferences/shared_preferences.dart';

/// Persist list `skip` across rebuilds / process restarts (URL skip parity).
/// Keys should be stable per surface (e.g. `events_public`, `tournaments`).
/// Filter changes must call [clear] / [write](0) so page 1 is intentional.
abstract final class SkipStore {
  static const _prefix = 'dama.list_skip.';
  static final Map<String, int> _memory = <String, int>{};
  static SharedPreferences? _prefs;
  static Future<SharedPreferences>? _loading;

  static Future<SharedPreferences> _ensurePrefs() async {
    final existing = _prefs;
    if (existing != null) return existing;
    final pending = _loading ??= SharedPreferences.getInstance();
    final prefs = await pending;
    _prefs = prefs;
    _loading = null;
    return prefs;
  }

  /// Warm prefs so first [read] after cold start can hit disk synchronously via cache.
  /// Also seeds [_memory] for any previously stored list-skip keys.
  static Future<void> warm() async {
    try {
      final prefs = await _ensurePrefs();
      for (final key in prefs.getKeys()) {
        if (!key.startsWith(_prefix)) continue;
        final surface = key.substring(_prefix.length);
        if (surface.isEmpty) continue;
        final stored = prefs.getInt(key);
        if (stored == null || stored < 0) continue;
        if (stored == 0) continue;
        _memory[surface] = stored;
      }
    } catch (_) {}
  }

  static int read(String key) {
    final k = key.trim();
    if (k.isEmpty) return 0;
    final mem = _memory[k];
    if (mem != null) return mem < 0 ? 0 : mem;
    final prefs = _prefs;
    if (prefs == null) return 0;
    final stored = prefs.getInt('$_prefix$k');
    if (stored == null || stored < 0) return 0;
    _memory[k] = stored;
    return stored;
  }

  static Future<void> write(String key, int skip) async {
    final k = key.trim();
    if (k.isEmpty) return;
    final safe = skip < 0 ? 0 : skip;
    if (safe <= 0) {
      _memory.remove(k);
      try {
        final prefs = await _ensurePrefs();
        await prefs.remove('$_prefix$k');
      } catch (_) {}
      return;
    }
    _memory[k] = safe;
    try {
      final prefs = await _ensurePrefs();
      await prefs.setInt('$_prefix$k', safe);
    } catch (_) {}
  }

  static Future<void> clear(String key) => write(key, 0);
}
