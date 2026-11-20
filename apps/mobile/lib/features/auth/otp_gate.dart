import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/cache/query_cache.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/network/graphql_client.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/theme/theme_toggle_button.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/auth/otp_session.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;
import 'package:web_socket_channel/web_socket_channel.dart';

/// Blocks player flows when admin enables global OTP verification.
class OtpGate extends StatefulWidget {
  const OtpGate({super.key, required this.child});

  final Widget child;

  @override
  State<OtpGate> createState() => _OtpGateState();
}

class _OtpGateState extends State<OtpGate> {
  /// null = still loading (do not block UI); true/false from flags.
  bool? _otpRequired;
  bool _flagsFailed = false;
  bool _verified = false;
  String? _challengeId;
  String _code = '';
  String? _error;
  bool _attempted = false;
  bool _busy = false;
  bool _started = false;
  WebSocketChannel? _ws;
  StreamSubscription? _wsSub;
  OtpChrome? _chrome;
  String? _boundUserId;

  @override
  void initState() {
    super.initState();
    unawaited(_loadChrome());
    WidgetsBinding.instance.addPostFrameCallback((_) => _hydrate());
  }

  Future<void> _loadChrome() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/public/otp-chrome'),
      );
      if (res.statusCode != 200) return;
      final map = jsonDecode(res.body);
      if (map is! Map<String, dynamic>) return;
      final chrome = OtpChrome.fromJson(map);
      if (!mounted || chrome == null) return;
      setState(() => _chrome = chrome);
    } catch (_) {}
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    _ws?.sink.close();
    super.dispose();
  }

  Future<void> _hydrate() async {
    final auth = context.read<AuthCubit>().state;
    final token = auth.token;
    if (token == null || token.isEmpty) {
      setState(() {
        _otpRequired = false;
        _flagsFailed = false;
        _verified = false;
        _started = false;
        _challengeId = null;
      });
      return;
    }
    final alreadyVerified = await isOtpSessionVerified(auth.userId);
    if (alreadyVerified) {
      if (mounted) setState(() => _verified = true);
    }
    try {
      final cached = QueryCache.read<FeatureFlagsWire>(
        CacheKeys.featureFlags,
        maxAge: QueryCache.platformTtl,
        allowStale: true,
      );
      if (cached != null && mounted) {
        setState(() {
          _otpRequired = cached.otpRequired;
          _flagsFailed = false;
        });
      }
      final gql = GraphqlClient(accessToken: token);
      final data = await gql.query(featureFlagsQuery);
      final flags = data['featureFlags'] as Map<String, dynamic>?;
      if (flags != null) {
        final wire = FeatureFlagsWire.fromJson(flags);
        QueryCache.write(CacheKeys.featureFlags, wire);
        if (!mounted) return;
        setState(() {
          _otpRequired = wire.otpRequired;
          _flagsFailed = false;
        });
        if (wire.otpRequired && !alreadyVerified && !_verified && !_started) {
          await _startChallenge(token);
        }
      } else if (mounted && _otpRequired == null) {
        setState(() {
          _otpRequired = false;
          _flagsFailed = true;
        });
      }
      await _connectFlagsWs(token);
    } catch (_) {
      // Fail open while flags cannot hydrate - never flash OTP randomly.
      if (mounted && _otpRequired == null) {
        setState(() {
          _otpRequired = false;
          _flagsFailed = true;
        });
      }
    }
  }

  Future<void> _connectFlagsWs(String token) async {
    await _wsSub?.cancel();
    await _ws?.sink.close();
    final origin = ApiConfig.baseUrl.replaceFirst(RegExp(r'^http'), 'ws');
    final uri = Uri.parse(
      '$origin/ws/matchmaking?token=${Uri.encodeComponent(token)}',
    );
    _ws = WebSocketChannel.connect(uri);
    _wsSub = _ws!.stream.listen((event) {
      if (event is! String) return;
      try {
        final msg = jsonDecode(event) as Map<String, dynamic>;
        if (msg['type'] == 'feature_flags') {
          final flags = msg['flags'] as Map<String, dynamic>?;
          final required =
              flags?['otp_required'] == true || flags?['otpRequired'] == true;
          if (!mounted) return;
          setState(() {
            _otpRequired = required;
            _flagsFailed = false;
            if (!required) {
              _verified = true;
            }
          });
          if (required && !_verified && !_started) {
            // Re-check session before starting (avoid race after restore).
            unawaited(() async {
              final userId = context.read<AuthCubit>().state.userId;
              if (await isOtpSessionVerified(userId)) {
                if (mounted) setState(() => _verified = true);
                return;
              }
              if (!_started) await _startChallenge(token);
            }());
          }
        }
      } catch (_) {}
    });
  }

  Future<void> _startChallenge(String token) async {
    _started = true;
    if (mounted) {
      setState(() {
        _error = null;
        _challengeId = null;
        _busy = true;
      });
    }
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/auth/otp/start'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'channel': 'email'}),
      );
      if (res.statusCode >= 300) {
        if (mounted) {
          setState(() {
            _error = _apiError(res,
                _chrome?.verificationStartFailed ?? _chrome?.startFailed ?? '');
            _started = false;
            _busy = false;
          });
        }
        return;
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if (mounted) {
        setState(() {
          _challengeId = body['challenge_id']?.toString();
          _error = null;
          _busy = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = _chrome?.startFailed ?? '';
          _started = false;
          _busy = false;
        });
      }
    }
  }

  Future<void> _retryStart() async {
    final token = context.read<AuthCubit>().state.token;
    if (token == null || token.isEmpty) return;
    _started = false;
    await _startChallenge(token);
  }

  Future<void> _verify() async {
    final token = context.read<AuthCubit>().state.token;
    final chrome = _chrome;
    if (token == null || _challengeId == null || chrome == null) return;
    setState(() => _attempted = true);
    if (_code.trim().isEmpty) {
      setState(() => _error = chrome.errChallengeRequired);
      return;
    }
    if (_code.length < 6) {
      setState(() => _error = chrome.invalidCode);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/auth/otp/verify'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'challenge_id': _challengeId, 'code': _code}),
      );
      if (res.statusCode >= 300) {
        setState(
          () => _error = _apiError(res, _chrome?.invalidCode ?? ''),
        );
        return;
      }
      final userId = context.read<AuthCubit>().state.userId;
      await markOtpSessionVerified(userId);
      setState(() => _verified = true);
    } catch (_) {
      setState(() => _error = _chrome?.invalidCode ?? '');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _apiError(http.Response res, String fallback) => fallback;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final chrome = _chrome;
    final gateOpen = _otpRequired == true && !_verified;
    return BlocListener<AuthCubit, AuthState>(
      listenWhen: (prev, next) =>
          prev.token != next.token || prev.userId != next.userId,
      listener: (context, state) {
        // Only reset OTP on logout or real account switch - not JWT refresh
        // (token string change with same userId was flashing OTP randomly).
        final loggedOut = state.token == null || state.token!.isEmpty;
        final userSwitched = _boundUserId != null &&
            state.userId != null &&
            _boundUserId != state.userId;
        if (userSwitched && _boundUserId != null) {
          unawaited(clearOtpSession(_boundUserId));
        }
        _boundUserId = state.userId;
        if (loggedOut || userSwitched) {
          setState(() {
            _started = false;
            _verified = false;
            _challengeId = null;
            _code = '';
            _error = null;
            _otpRequired = null;
            _flagsFailed = false;
          });
        }
        unawaited(_hydrate());
      },
      child: Stack(
        children: [
          widget.child,
          if (gateOpen && chrome == null)
            Positioned.fill(
              child: ColoredBox(
                color: tokens.overlayScrim,
                child: const Center(child: FormCardSkeleton(fields: 1)),
              ),
            ),
          if (gateOpen && chrome != null)
            Positioned.fill(
              child: ColoredBox(
                color: tokens.overlayScrim,
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 360),
                    child: Material(
                      color: tokens.card,
                      borderRadius: BorderRadius.circular(12),
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    chrome.verifyTitle,
                                    style:
                                        Theme.of(context).textTheme.titleLarge,
                                  ),
                                ),
                                const ThemeToggleButton(),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              chrome.enterCodeBlurb,
                              style: TextStyle(color: tokens.onSurfaceMuted),
                            ),
                            const SizedBox(height: 16),
                            if (_otpRequired == null && !_flagsFailed)
                              const FormCardSkeleton(fields: 1)
                            else if (_otpRequired == null && _flagsFailed) ...[
                              Text(
                                chrome.flagsUnavailable,
                                style: TextStyle(color: tokens.onSurfaceMuted),
                              ),
                              const SizedBox(height: 12),
                              FilledButton(
                                onPressed: _busy
                                    ? null
                                    : () {
                                        setState(() => _flagsFailed = false);
                                        unawaited(_hydrate());
                                      },
                                child: Text(chrome.retryAction),
                              ),
                            ] else if (_challengeId == null && _error == null)
                              const FormCardSkeleton(fields: 1)
                            else if (_challengeId == null) ...[
                              Text(
                                chrome.verificationStartFailed,
                                style: TextStyle(color: tokens.onSurfaceMuted),
                              ),
                              if (_error != null) ...[
                                const SizedBox(height: 8),
                                Text(_error!,
                                    style: TextStyle(
                                        color: damaColorsOf(context).danger)),
                              ],
                              const SizedBox(height: 12),
                              FilledButton(
                                onPressed: _busy ? null : _retryStart,
                                child: Text(
                                  _busy
                                      ? chrome.startingAction
                                      : chrome.retryOtpAction,
                                ),
                              ),
                            ] else ...[
                              TextField(
                                keyboardType: TextInputType.number,
                                maxLength: 6,
                                enabled: !_busy,
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                ],
                                decoration: InputDecoration(
                                  labelText: chrome.codeLabel,
                                  hintText: chrome.codePlaceholder.isNotEmpty
                                      ? chrome.codePlaceholder
                                      : '000000',
                                  border: const OutlineInputBorder(),
                                  counterText: '',
                                  errorText: _attempted &&
                                          (_code.trim().isEmpty ||
                                              _code.length < 6)
                                      ? (_code.trim().isEmpty
                                          ? chrome.errChallengeRequired
                                          : chrome.invalidCode)
                                      : null,
                                ),
                                onChanged: (v) => setState(() {
                                  _code = v.replaceAll(RegExp(r'\D'), '');
                                  if (_attempted &&
                                      _code.trim().isNotEmpty &&
                                      _code.length >= 6) {
                                    _error = null;
                                  }
                                }),
                              ),
                              if (_error != null) ...[
                                const SizedBox(height: 8),
                                Text(_error!,
                                    style: TextStyle(
                                        color: damaColorsOf(context).danger)),
                              ],
                              const SizedBox(height: 12),
                              FilledButton(
                                onPressed: _busy ? null : _verify,
                                child: Text(
                                  _busy
                                      ? chrome.verifyingAction
                                      : chrome.verifyAction,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
