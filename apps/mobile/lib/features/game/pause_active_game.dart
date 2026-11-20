import 'dart:convert';

import 'package:dama_mobile/core/cache/query_cache.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/network/auth_http.dart';
import 'package:dama_mobile/core/prefs/play_session_store.dart';
import 'package:dama_mobile/core/types/types.dart';

final _pauseInflight = <String>{};

bool isPauseInflight(String gameId) => _pauseInflight.contains(gameId.trim());

enum PauseFailKind { pause, resume }

class PauseGameException implements Exception {
  PauseGameException(this.errorKey);
  final String errorKey;
}

/// Legacy helper: body English must never invent keys.
/// Prefer REST `error_key`; return empty when absent (clients use toast_* chrome).
String pauseErrorKeyFromBody(String error) {
  return '';
}

/// Leave-pause errors that must not snackbar (match ended / wrong seat / auth / OTP).
bool isLeavePauseSilentError(String errorKey) {
  final key = errorKey.trim().toLowerCase();
  return key == 'game_finished' ||
      key == 'not_a_seat' ||
      key == 'unauthorized' ||
      key == 'err_unauthorized' ||
      key == 'err_verification_required' ||
      key == 'err_verification_unavailable';
}

/// Chrome string for a pause/resume failure. Empty when chrome has no copy.
String pauseFailureLabel(
  PlayChrome? chrome,
  String errorKey,
  PauseFailKind kind,
) {
  final key = errorKey.trim();
  var specific = '';
  if (key == 'pause_disabled') {
    specific = (chrome?.pauseDisabled ?? '').trim();
    if (specific.isEmpty) {
      specific = (chrome?.errPauseDisabled ?? '').trim();
    }
  } else if (key == 'already_paused') {
    specific = (chrome?.errAlreadyPaused ?? '').trim();
  } else if (key == 'not_paused') {
    specific = (chrome?.errNotPaused ?? '').trim();
  } else if (key == 'game_paused' || key == 'err_game_paused') {
    specific = (chrome?.errGamePaused ?? '').trim();
  } else if (key == 'err_officially_paused' || key == 'officially_paused') {
    specific = (chrome?.errOfficiallyPaused ?? '').trim();
  }
  if (specific.isNotEmpty) return specific;
  final fallback = kind == PauseFailKind.resume
      ? chrome?.toastResumeFailed
      : chrome?.toastPauseFailed;
  return (fallback ?? '').trim();
}

Future<GameStatePayload> postGamePause(String token, String gameId) {
  return _postGameAction(token, gameId, 'pause');
}

Future<GameStatePayload> postGameResume(String token, String gameId) {
  return _postGameAction(token, gameId, 'resume');
}

/// GET /games/{id}/state for FAB auto-resume sync after pause duration elapses.
Future<GameStatePayload> fetchPausedGameState(
    String token, String gameId) async {
  final id = gameId.trim();
  if (token.trim().isEmpty || id.isEmpty) {
    throw PauseGameException('unauthorized');
  }
  final res = await authGet(
    Uri.parse(
      '${ApiConfig.baseUrl}/api/v1/games/${Uri.encodeComponent(id)}/state',
    ),
    token: token,
  );
  Map<String, dynamic>? map;
  try {
    final decoded = jsonDecode(res.body);
    if (decoded is Map<String, dynamic>) {
      map = decoded;
    } else if (decoded is Map) {
      map = Map<String, dynamic>.from(decoded);
    }
  } catch (_) {}
  if (res.statusCode >= 300 || map == null) {
    throw PauseGameException('');
  }
  final payload = GameStatePayload.fromJson(map);
  final gid = (payload.gameId ?? id).trim();
  if (gid.isNotEmpty) {
    QueryCache.write(CacheKeys.gameState(gid), payload);
  }
  return payload;
}

Future<GameStatePayload> _postGameAction(
  String token,
  String gameId,
  String action,
) async {
  final id = gameId.trim();
  if (token.trim().isEmpty || id.isEmpty) {
    throw PauseGameException('unauthorized');
  }
  final res = await authPost(
    Uri.parse(
      '${ApiConfig.baseUrl}/api/v1/games/${Uri.encodeComponent(id)}/$action',
    ),
    token: token,
    body: '{}',
  );
  Map<String, dynamic>? map;
  try {
    final decoded = jsonDecode(res.body);
    if (decoded is Map<String, dynamic>) {
      map = decoded;
    } else if (decoded is Map) {
      map = Map<String, dynamic>.from(decoded);
    }
  } catch (_) {}
  if (res.statusCode >= 300) {
    final errKey = (map?['error_key'] as String?)?.trim() ?? '';
    final err = map?['error']?.toString() ?? '';
    final key = errKey.isNotEmpty ? errKey : pauseErrorKeyFromBody(err);
    throw PauseGameException(key);
  }
  if (map == null) throw PauseGameException('');
  final payload = GameStatePayload.fromJson(map);
  final gid = (payload.gameId ?? id).trim();
  if (gid.isNotEmpty) {
    QueryCache.write(CacheKeys.gameState(gid), payload);
  }
  return payload;
}

/// Pause a live match when the player leaves the board.
/// Marks the stored session paused immediately and reverts if the request fails.
/// No-ops when a pause for this id is already in flight or the session is not a live unpaused game.
Future<GameStatePayload?> pauseGameOnLeave(
  String token,
  String gameId, {
  String? mode,
}) async {
  final id = gameId.trim();
  if (token.trim().isEmpty || id.isEmpty || _pauseInflight.contains(id)) {
    return null;
  }
  final store = PlaySessionStore.instance;
  await store.ensureLoaded();
  final session = store.session;
  if (session != null && session.gameId != id) return null;
  if (session != null && (session.phase != 'playing' || session.paused)) {
    return null;
  }
  // Official pause already freezes the board; do not attempt a player leave-pause.
  if (session != null && session.pauseKind.trim() == 'official') {
    return null;
  }
  String resolvedMode([String? fallback]) {
    final raw = (session?.mode ?? fallback ?? mode ?? 'ai').trim();
    return raw.isEmpty ? 'ai' : raw;
  }

  final cached = QueryCache.read<GameStatePayload>(
    CacheKeys.gameState(id),
    maxAge: QueryCache.sessionTtl,
    allowStale: true,
  );
  // Official pause: players cannot leave-pause or clear it.
  if (cached != null && cached.isOfficialPause) return null;
  if (cached != null &&
      (cached.outcome != null || cached.draw || session?.phase == 'finished')) {
    await store.store(
      StoredPlaySession(
        gameId: id,
        mode: resolvedMode(),
        phase: 'finished',
        updatedAt: DateTime.now().toUtc().toIso8601String(),
      ),
    );
    return null;
  }
  _pauseInflight.add(id);
  if (session == null) {
    await store.store(
      StoredPlaySession(
        gameId: id,
        mode: resolvedMode(),
        phase: 'playing',
        paused: true,
        updatedAt: DateTime.now().toUtc().toIso8601String(),
      ),
    );
  } else {
    await store.patchPaused(true);
  }
  try {
    final payload = await postGamePause(token, id);
    if (payload.outcome != null || payload.draw) {
      await store.store(
        StoredPlaySession(
          gameId: id,
          mode: resolvedMode(),
          phase: 'finished',
          updatedAt: DateTime.now().toUtc().toIso8601String(),
        ),
      );
      return null;
    }
    final expires = payload.pauseExpiresAtUnixMs;
    await store.patchPaused(
      true,
      pauseExpiresAtUnixMs: expires > 0 ? expires : null,
      pauseKind: payload.pauseKind,
    );
    return payload;
  } catch (err) {
    // Race: board flipped to official while leave-pause was in flight. Keep session;
    // mark official so FAB hides (do not clear / unpause).
    if (err is PauseGameException &&
        (err.errorKey == 'err_officially_paused' ||
            err.errorKey == 'officially_paused')) {
      await store.patchPaused(true, pauseKind: 'official');
      return null;
    }
    if (err is PauseGameException && isLeavePauseSilentError(err.errorKey)) {
      final key = err.errorKey.trim().toLowerCase();
      final otpOrAuth = key == 'unauthorized' ||
          key == 'err_unauthorized' ||
          key == 'err_verification_required' ||
          key == 'err_verification_unavailable';
      if (otpOrAuth) {
        await store.patchPaused(false);
      } else if (key == 'game_finished') {
        await store.store(
          StoredPlaySession(
            gameId: id,
            mode: resolvedMode(),
            phase: 'finished',
            updatedAt: DateTime.now().toUtc().toIso8601String(),
          ),
        );
      } else {
        await store.clear();
      }
      return null;
    }
    await store.patchPaused(false);
    rethrow;
  } finally {
    _pauseInflight.remove(id);
  }
}
