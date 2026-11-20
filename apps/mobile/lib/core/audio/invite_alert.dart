import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/services.dart';

/// Incoming match invite ringtone (web invite-alert.ts parity).
/// Loops until [stop] / resolved chime (accept, decline, or cancel).
class InviteAlert {
  InviteAlert._();

  static AudioPlayer? _ringtone;
  static Timer? _hapticTimer;

  static const _chimeUrl =
      'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3';
  static const _sentUrl =
      'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3';

  static Future<void> stop() async {
    _hapticTimer?.cancel();
    _hapticTimer = null;
    final player = _ringtone;
    _ringtone = null;
    if (player != null) {
      await player.stop();
      await player.dispose();
    }
  }

  /// Looping challenge ringtone while an invite is pending accept/decline.
  static Future<void> start() async {
    await stop();
    try {
      final player = AudioPlayer();
      _ringtone = player;
      await player.setReleaseMode(ReleaseMode.loop);
      await player.setVolume(0.48);
      await player.play(AssetSource('sounds/invite-ring.wav'));
      Future<void> pulse() async {
        await HapticFeedback.lightImpact();
        await Future<void>.delayed(const Duration(milliseconds: 160));
        await HapticFeedback.selectionClick();
      }

      unawaited(pulse());
      _hapticTimer = Timer.periodic(const Duration(milliseconds: 2400), (_) {
        unawaited(pulse());
      });
    } catch (_) {
      /* optional */
    }
  }

  static Future<void> playResolvedChime() async {
    await stop();
    try {
      final player = AudioPlayer();
      await player.setVolume(0.75);
      await player.play(UrlSource(_chimeUrl));
      player.onPlayerComplete.listen((_) => player.dispose());
    } catch (_) {
      /* optional */
    }
  }

  /// Short chime when an outgoing invite is successfully sent (web playInviteSentAlert).
  static Future<void> playSent() async {
    try {
      final player = AudioPlayer();
      await player.setVolume(0.55);
      await player.play(UrlSource(_sentUrl));
      player.onPlayerComplete.listen((_) => player.dispose());
    } catch (_) {
      /* optional */
    }
  }
}
