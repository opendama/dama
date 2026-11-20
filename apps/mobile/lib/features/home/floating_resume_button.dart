import 'dart:async';

import 'package:dama_mobile/core/prefs/play_session_store.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/auth/practice_token.dart';
import 'package:dama_mobile/features/auth/sign_in_dialog.dart';
import 'package:dama_mobile/features/game/match_board_page.dart';
import 'package:dama_mobile/features/game/pause_active_game.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// Brand resume control above the shell bottom nav when a match is paused
/// and this screen is not that match's board.
class FloatingResumeButton extends StatefulWidget {
  const FloatingResumeButton({super.key, this.chrome});

  final PlayChrome? chrome;

  @override
  State<FloatingResumeButton> createState() => _FloatingResumeButtonState();
}

class _FloatingResumeButtonState extends State<FloatingResumeButton>
    with WidgetsBindingObserver {
  bool _pending = false;
  int _remainingMs = 0;
  Timer? _tick;
  Timer? _retrySync;
  String _expirySyncKey = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    PlaySessionStore.instance.addListener(_onSession);
    _syncCountdown();
    unawaited(_syncOfficialIfNeeded());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    PlaySessionStore.instance.removeListener(_onSession);
    _tick?.cancel();
    _retrySync?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _syncCountdown();
      unawaited(_syncOfficialIfNeeded());
      final session = PlaySessionStore.instance.session;
      final expires = session?.pauseExpiresAtUnixMs ?? 0;
      if (session != null &&
          session.paused &&
          (expires <= 0 || expires <= DateTime.now().millisecondsSinceEpoch)) {
        unawaited(_syncAutoResume(force: true));
      }
    }
  }

  void _onSession() {
    if (!mounted) return;
    _syncCountdown();
    unawaited(_syncOfficialIfNeeded());
  }

  /// Web FloatingResumeFab parity: while paused (player or official), poll /state so
  /// rematch/forfeit/resume clears the session and official pause keeps FAB hidden.
  Future<void> _syncOfficialIfNeeded() async {
    final session = PlaySessionStore.instance.session;
    if (session == null || !session.paused) return;
    final token =
        await _tokenFor(session.mode.toLowerCase(), interactive: false);
    if (!mounted || token == null || token.trim().isEmpty) return;
    try {
      final payload = await fetchPausedGameState(token, session.gameId);
      if (!mounted) return;
      if (payload.outcome != null || payload.draw || !payload.paused) {
        await PlaySessionStore.instance.clear();
        return;
      }
      if (payload.isOfficialPause) {
        await PlaySessionStore.instance.patchPaused(
          true,
          pauseKind: payload.pauseKind,
        );
      }
    } catch (_) {
      // Fail closed: leave FAB until expiry sync or next resume.
    }
  }

  void _syncCountdown() {
    final expires =
        PlaySessionStore.instance.session?.pauseExpiresAtUnixMs ?? 0;
    _tick?.cancel();
    _tick = null;
    if (expires <= 0) {
      if (_remainingMs != 0) setState(() => _remainingMs = 0);
      return;
    }
    void apply() {
      final next =
          (expires - DateTime.now().millisecondsSinceEpoch).clamp(0, 1 << 31);
      if (!mounted) return;
      if (next != _remainingMs) setState(() => _remainingMs = next);
      if (next <= 0) {
        _tick?.cancel();
        _tick = null;
        unawaited(_syncAutoResume());
      }
    }

    apply();
    if (_remainingMs > 0) {
      _tick = Timer.periodic(const Duration(milliseconds: 250), (_) => apply());
    }
  }

  Future<String?> _tokenFor(String mode, {bool interactive = true}) async {
    final authToken = context.read<AuthCubit>().state.token?.trim() ?? '';
    if (authToken.isNotEmpty) return authToken;
    if (mode == 'pvp') {
      if (!interactive) return null;
      return showSignInDialog(context);
    }
    return ensurePracticeToken();
  }

  void _scheduleRetrySync() {
    _retrySync?.cancel();
    _retrySync = Timer(const Duration(seconds: 3), () {
      if (!mounted) return;
      unawaited(_syncAutoResume(force: true));
    });
  }

  Future<void> _syncAutoResume({bool force = false}) async {
    final session = PlaySessionStore.instance.session;
    if (session == null || !session.paused) return;
    final expires = session.pauseExpiresAtUnixMs;
    final key = '${session.gameId}:$expires';
    if (!force && _expirySyncKey == key) return;
    _expirySyncKey = key;
    final token =
        await _tokenFor(session.mode.toLowerCase(), interactive: false);
    if (!mounted) return;
    if (token == null || token.trim().isEmpty) {
      _expirySyncKey = '';
      _scheduleRetrySync();
      return;
    }
    try {
      final payload = await fetchPausedGameState(token, session.gameId);
      if (!mounted) return;
      if (!payload.paused) {
        await PlaySessionStore.instance.patchPaused(false);
        final msg = (widget.chrome?.toastAutoResumed ?? '').trim();
        if (msg.isNotEmpty && mounted) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(msg)));
        }
        return;
      }
      if (payload.isOfficialPause) {
        await PlaySessionStore.instance.patchPaused(
          true,
          pauseKind: payload.pauseKind,
        );
        _expirySyncKey = '';
        return;
      }
      final nextExpires = payload.pauseExpiresAtUnixMs;
      final now = DateTime.now().millisecondsSinceEpoch;
      if (nextExpires > now) {
        await PlaySessionStore.instance.patchPaused(
          true,
          pauseExpiresAtUnixMs: nextExpires,
          pauseKind: payload.pauseKind,
        );
        _expirySyncKey = '';
        return;
      }
      // Still paused but expiry already elapsed: server sweeper lag - retry.
      _expirySyncKey = '';
      _scheduleRetrySync();
    } catch (_) {
      _expirySyncKey = '';
      _scheduleRetrySync();
    }
  }

  String _remainingLine() {
    final fmt = (widget.chrome?.pauseRemainingFmt ?? '').trim();
    if (fmt.isEmpty || _remainingMs <= 0) return '';
    final total = (_remainingMs / 1000).ceil().clamp(0, 1 << 31);
    final m = total ~/ 60;
    final s = total % 60;
    final time = '$m:${s.toString().padLeft(2, '0')}';
    return fmt.replaceAll('{time}', time).trim();
  }

  Future<void> _resumeAndOpen() async {
    final session = PlaySessionStore.instance.session;
    if (session == null || _pending) return;
    if (session.isOfficialPause) {
      final msg = (widget.chrome?.errOfficiallyPaused ?? '').trim();
      if (msg.isNotEmpty && mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
      return;
    }
    final nav = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final token = await _tokenFor(session.mode.toLowerCase());
    if (!mounted || token == null || token.trim().isEmpty) return;
    setState(() => _pending = true);
    PlaySessionStore.instance.markManualResume();
    var resumeOk = false;
    try {
      await postGameResume(token, session.gameId);
      await PlaySessionStore.instance.patchPaused(false);
      resumeOk = true;
      final msg = (widget.chrome?.toastResumed ?? '').trim();
      if (msg.isNotEmpty) {
        messenger.showSnackBar(SnackBar(content: Text(msg)));
      }
    } on PauseGameException catch (e) {
      PlaySessionStore.instance.takeManualResume();
      final msg = pauseFailureLabel(
        widget.chrome,
        e.errorKey,
        PauseFailKind.resume,
      );
      if (msg.isNotEmpty) {
        messenger.showSnackBar(SnackBar(content: Text(msg)));
      }
    } catch (_) {
      PlaySessionStore.instance.takeManualResume();
      final msg = pauseFailureLabel(widget.chrome, '', PauseFailKind.resume);
      if (msg.isNotEmpty) {
        messenger.showSnackBar(SnackBar(content: Text(msg)));
      }
    }
    if (mounted) setState(() => _pending = false);
    // Only open the board after a successful resume (parity with web FAB).
    if (!resumeOk || !mounted) return;
    final mode = session.mode.toLowerCase() == 'pvp' ? 'pvp' : 'ai';
    await nav.push(
      MaterialPageRoute(
        builder: (_) => MatchBoardPage(
          accessToken: token,
          gameId: session.gameId,
          mode: mode,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final theme = Theme.of(context);
    final label = (widget.chrome?.floatingResumeLabel ?? '').trim();
    final aria = (widget.chrome?.floatingResumeAria ?? '').trim();
    final pendingLabel = (widget.chrome?.resumeGamePending ?? '').trim();
    // Fail-closed: no unlabeled brand control while chrome is unavailable.
    if (label.isEmpty && aria.isEmpty) return const SizedBox.shrink();
    final shown = _pending && pendingLabel.isNotEmpty ? pendingLabel : label;
    final remainingLine = _remainingLine();
    final semantics =
        aria.isNotEmpty ? aria : (shown.isNotEmpty ? shown : null);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        if (remainingLine.isNotEmpty) ...[
          Material(
            color: tokens.card,
            elevation: 2,
            shadowColor: theme.colorScheme.onSurface.withValues(alpha: 0.18),
            shape: StadiumBorder(
              side: BorderSide(color: tokens.border),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              child: Text(
                remainingLine,
                style: TextStyle(
                  // Light: brand. Dark: primary text.
                  color: theme.brightness == Brightness.dark
                      ? theme.colorScheme.onSurface
                      : tokens.brand,
                  fontWeight: FontWeight.w700,
                  fontFeatures: const [FontFeature.tabularFigures()],
                  fontSize: 12,
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),
        ],
        Semantics(
          button: true,
          label: semantics,
          child: Material(
            color: tokens.brand,
            elevation: 6,
            shadowColor: tokens.brand.withValues(alpha: 0.35),
            shape: const StadiumBorder(),
            child: InkWell(
              customBorder: const StadiumBorder(),
              onTap: _pending ? null : () => _resumeAndOpen(),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.play_arrow, size: 18, color: tokens.onBrand),
                    if (shown.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 200),
                        child: Text(
                          shown,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: tokens.onBrand,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
