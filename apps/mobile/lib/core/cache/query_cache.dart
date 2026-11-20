/// In-memory TTL cache so Flutter screens do not re-shimmer on back/forward.
/// Mutations call [invalidate] / [invalidatePrefix] after writes.
class QueryCache {
  QueryCache._();

  static final Map<String, _Entry> _entries = <String, _Entry>{};

  static const Duration platformTtl = Duration(minutes: 5);
  static const Duration sessionTtl = Duration(minutes: 1);
  static const Duration geoTtl = Duration(minutes: 5);
  static const Duration liveTtl = Duration.zero;

  /// Returns cached value when fresh. When [allowStale] is true, returns expired
  /// entries so screens can paint immediately while a background refresh runs.
  static T? read<T>(
    String key, {
    Duration maxAge = sessionTtl,
    bool allowStale = false,
  }) {
    final entry = _entries[key];
    if (entry == null) return null;
    final expired =
        maxAge == Duration.zero || DateTime.now().difference(entry.at) > maxAge;
    if (expired) {
      if (!allowStale) {
        _entries.remove(key);
        return null;
      }
    }
    final value = entry.value;
    if (value is! T) return null;
    return value as T;
  }

  static void write(String key, Object? value) {
    if (value == null) {
      _entries.remove(key);
      return;
    }
    _entries[key] = _Entry(value, DateTime.now());
  }

  static void invalidate(String key) {
    _entries.remove(key);
  }

  static void invalidatePrefix(String prefix) {
    _entries.removeWhere((k, _) => k == prefix || k.startsWith('$prefix:'));
  }

  /// Snapshot of keys (safe to mutate cache while iterating a copy).
  static List<String> keysWithPrefix(String prefix) {
    return _entries.keys
        .where((k) => k == prefix || k.startsWith(prefix))
        .toList(growable: false);
  }

  static void clear() => _entries.clear();
}

class _Entry {
  _Entry(this.value, this.at);
  final Object value;
  final DateTime at;
}

/// Stable cache keys used across feature screens.
abstract final class CacheKeys {
  static const clientNav = 'platform:client-nav';
  static const boardRules = 'platform:board-rules';
  static const boardRulesPayload = 'platform:board-rules-payload';
  static const progression = 'platform:progression';
  static const featureFlags = 'platform:feature-flags';
  static const playChrome = 'platform:play-chrome';
  static const spectateChrome = 'platform:spectate-chrome';
  static const playRailChrome = 'platform:play-rail-chrome';
  static String me(String token) => 'session:me:$token';

  /// Auth + period scoped so tab switches cache-hit and never wipe the prior paint.
  static String leaderboard(String? token, [String period = '']) {
    final auth = (token ?? '').trim().isEmpty ? 'anon' : (token ?? '').trim();
    final p = period.trim();
    return p.isEmpty
        ? 'session:leaderboard:$auth'
        : 'session:leaderboard:$auth:$p';
  }

  static const tournaments = 'session:tournaments';
  static String wallet(String token, String country) =>
      'session:wallet:$token:$country';
  static String lastGeoCountry(String token) => 'session:geo-country:$token';
  static String matchmaking(String token) => 'live:matchmaking:$token';
  static String player(String id) => 'session:player:$id';

  /// Play / spectate / tournament / PvP board hydrate (web game-state session tier).
  static String gameState(String id) => 'session:game-state:$id';
  static String geoAd(String country, String region, String district) =>
      'session:geo-ad:$country:$region:$district';
}
