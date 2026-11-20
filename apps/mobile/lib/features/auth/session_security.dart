import 'dart:async';
import 'dart:convert';
import 'dart:ui' as ui;

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;

/// Presence heartbeat + device fingerprint upsert (parity with web SessionSecurity).
class SessionSecurity extends StatefulWidget {
  const SessionSecurity({super.key, required this.child});

  final Widget child;

  @override
  State<SessionSecurity> createState() => _SessionSecurityState();
}

class _SessionSecurityState extends State<SessionSecurity> {
  Timer? _heartbeat;
  String? _activeToken;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _bind(context.read<AuthCubit>().state.token);
    });
  }

  @override
  void dispose() {
    _heartbeat?.cancel();
    super.dispose();
  }

  void _bind(String? token) {
    if (token == _activeToken) return;
    _heartbeat?.cancel();
    _heartbeat = null;
    _activeToken = token;
    if (token == null || token.isEmpty) return;
    unawaited(_upsertFingerprint(token));
    _beat(token);
    _heartbeat =
        Timer.periodic(const Duration(seconds: 25), (_) => _beat(token));
  }

  Future<void> _beat(String token) async {
    try {
      await http.post(
        Uri.parse('${ApiConfig.defaults.restUrl}/presence/heartbeat'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: '{}',
      );
    } catch (_) {}
  }

  String _deviceFingerprint() {
    final views = ui.PlatformDispatcher.instance.views;
    final size = views.isEmpty ? Size.zero : views.first.physicalSize;
    final parts = [
      defaultTargetPlatform.name,
      ui.PlatformDispatcher.instance.locale.toLanguageTag(),
      '${size.width.round()}x${size.height.round()}',
      DateTime.now().timeZoneName,
      kIsWeb ? 'web' : 'mobile',
    ];
    final raw = parts.join('|');
    var h = 0;
    for (var i = 0; i < raw.length; i++) {
      h = (31 * h + raw.codeUnitAt(i)) & 0x7fffffff;
    }
    return 'mobile_${h.toRadixString(16)}_${raw.length}';
  }

  Future<void> _upsertFingerprint(String token) async {
    try {
      await http.post(
        Uri.parse('${ApiConfig.defaults.restUrl}/devices/fingerprint'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'fingerprint': _deviceFingerprint(),
          'platform': 'mobile',
          'user_agent': 'dama_mobile/${defaultTargetPlatform.name}',
        }),
      );
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthCubit, AuthState>(
      listenWhen: (prev, next) => prev.token != next.token,
      listener: (context, state) => _bind(state.token),
      child: widget.child,
    );
  }
}
