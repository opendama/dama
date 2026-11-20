import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/prefs/play_session_store.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/features/home/floating_resume_button.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

/// App-wide floating resume host so Events/Ads pushed routes still show Resume.
class FloatingResumeHost extends StatefulWidget {
  const FloatingResumeHost({super.key});

  @override
  State<FloatingResumeHost> createState() => _FloatingResumeHostState();
}

class _FloatingResumeHostState extends State<FloatingResumeHost> {
  PlayChrome? _chrome;
  StoredPlaySession? _session;

  @override
  void initState() {
    super.initState();
    _session = PlaySessionStore.instance.session;
    PlaySessionStore.instance.addListener(_onSession);
    unawaited(_loadChrome());
  }

  @override
  void dispose() {
    PlaySessionStore.instance.removeListener(_onSession);
    super.dispose();
  }

  void _onSession() {
    if (!mounted) return;
    setState(() => _session = PlaySessionStore.instance.session);
  }

  Future<void> _loadChrome() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/public/play-chrome'),
      );
      if (res.statusCode >= 300) return;
      final chrome = PlayChrome.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      if (!mounted) return;
      setState(() => _chrome = chrome);
    } catch (_) {
      // Fail closed: hide until chrome loads.
    }
  }

  bool _visible() {
    final session = _session;
    if (session == null || session.phase != 'playing' || !session.paused) {
      return false;
    }
    // Official pause: players cannot resume; hide the seated resume FAB.
    if (session.isOfficialPause) return false;
    final active = PlaySessionStore.instance.activeBoardGameId?.trim() ?? '';
    if (active.isNotEmpty && active == session.gameId.trim()) return false;
    final label = (_chrome?.floatingResumeLabel ?? '').trim();
    final aria = (_chrome?.floatingResumeAria ?? '').trim();
    return label.isNotEmpty || aria.isNotEmpty;
  }

  @override
  Widget build(BuildContext context) {
    if (!_visible()) return const SizedBox.shrink();
    final bottom = MediaQuery.paddingOf(context).bottom;
    // Sit above typical phone bottom nav; desktop rail has no bottom nav.
    final lift = MediaQuery.sizeOf(context).width >= 900 ? 12.0 : 92.0;
    return Positioned(
      right: 16,
      bottom: bottom + lift,
      child: FloatingResumeButton(chrome: _chrome),
    );
  }
}
