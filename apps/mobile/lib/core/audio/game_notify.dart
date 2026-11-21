import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/services.dart';

/// Immersive audio / haptic cues for match events.
class GameNotify {
  GameNotify._();

  static AudioPlayer? _landPlayer;
  static AudioPlayer? _messagePlayer;
  static DateTime? _lastMessageAt;
  static DateTime? _lastLandAt;
  static bool _landConfigured = false;

  static Future<AudioPlayer> _ensureLandPlayer() async {
    final player = _landPlayer ??= AudioPlayer();
    if (!_landConfigured) {
      await player.setReleaseMode(ReleaseMode.stop);
      await player.setPlayerMode(PlayerMode.lowLatency);
      _landConfigured = true;
    }
    return player;
  }

  /// Soft delivery chime for incoming chat (recipient only).
  static Future<void> playMessageDelivered() async {
    final now = DateTime.now();
    final last = _lastMessageAt;
    if (last != null && now.difference(last).inMilliseconds < 350) return;
    _lastMessageAt = now;
    try {
      final player = _messagePlayer ??= AudioPlayer();
      await player.stop();
      await player.setVolume(0.72);
      await player.play(AssetSource('sounds/message.wav'));
    } catch (_) {
      // Fail closed: no SystemSound invent when asset unavailable.
    }
  }

  /// Chess.com-style put-down: move / capture / promote (king).
  /// Call only when the piece lands - never during travel.
  static Future<void> playPieceLand(String kind) async {
    final now = DateTime.now();
    final last = _lastLandAt;
    // Avoid clipping/dropout when multi-jump land events fire back-to-back.
    if (last != null && now.difference(last).inMilliseconds < 40) return;
    _lastLandAt = now;
    final asset = switch (kind) {
      'capture' => 'sounds/capture.mp3',
      'promote' => 'sounds/promote.mp3',
      _ => 'sounds/move.mp3',
    };
    try {
      final player = await _ensureLandPlayer();
      // seek(0)+play is faster and clearer than stop()+play under load.
      await player.setVolume(kind == 'capture' ? 0.9 : 0.8);
      await player.play(AssetSource(asset));
      await HapticFeedback.selectionClick();
    } catch (_) {
      await SystemSound.play(SystemSoundType.click);
      await HapticFeedback.selectionClick();
    }
  }

  /// Convenience: promote > capture > move.
  static Future<void> playPiecePlace({
    bool captured = false,
    bool promoted = false,
  }) async {
    if (promoted) {
      await playPieceLand('promote');
      return;
    }
    if (captured) {
      await playPieceLand('capture');
      return;
    }
    await playPieceLand('move');
  }

  static Future<void> play(String event) async {
    switch (event) {
      case 'move':
        await playPieceLand('move');
        return;
      case 'capture':
        await playPieceLand('capture');
        return;
      case 'promote':
        await playPieceLand('promote');
        return;
      case 'game_start':
      case 'match_found':
        try {
          final player = await _ensureLandPlayer();
          await player.setVolume(0.85);
          await player.play(AssetSource('sounds/game-start.mp3'));
          await HapticFeedback.mediumImpact();
        } catch (_) {
          await SystemSound.play(SystemSoundType.click);
          await HapticFeedback.mediumImpact();
        }
        return;
      case 'win':
        await SystemSound.play(SystemSoundType.click);
        await HapticFeedback.mediumImpact();
        await Future<void>.delayed(const Duration(milliseconds: 90));
        await HapticFeedback.lightImpact();
        await Future<void>.delayed(const Duration(milliseconds: 90));
        await HapticFeedback.mediumImpact();
        break;
      case 'loss':
        await SystemSound.play(SystemSoundType.alert);
        await HapticFeedback.heavyImpact();
        await Future<void>.delayed(const Duration(milliseconds: 120));
        await HapticFeedback.heavyImpact();
        break;
      case 'your_turn':
      case 'info':
        await SystemSound.play(SystemSoundType.click);
        await HapticFeedback.mediumImpact();
        break;
      case 'error':
        await SystemSound.play(SystemSoundType.alert);
        await HapticFeedback.heavyImpact();
        break;
      default:
        await SystemSound.play(SystemSoundType.click);
        await HapticFeedback.selectionClick();
    }
  }
}
