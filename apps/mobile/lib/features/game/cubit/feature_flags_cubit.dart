import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/cache/query_cache.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;
import 'package:web_socket_channel/web_socket_channel.dart';

class FeatureFlagsState extends Equatable {
  const FeatureFlagsState({
    this.loading = false,
    this.vsAiEnabled = false,
    this.cashRmgEnabled = false,
    this.cashPhoneKycRequired = false,
    this.cashPhoneOtpRequired = false,
    this.cashRmgDisabledCountries = const <String>[],
    this.aiDepths = const <int>[],
    this.error,
  });

  final bool loading;
  final bool vsAiEnabled;
  final bool cashRmgEnabled;
  final bool cashPhoneKycRequired;
  final bool cashPhoneOtpRequired;
  final List<String> cashRmgDisabledCountries;
  final List<int> aiDepths;
  final String? error;

  FeatureFlagsState copyWith({
    bool? loading,
    bool? vsAiEnabled,
    bool? cashRmgEnabled,
    bool? cashPhoneKycRequired,
    bool? cashPhoneOtpRequired,
    List<String>? cashRmgDisabledCountries,
    List<int>? aiDepths,
    String? error,
  }) {
    return FeatureFlagsState(
      loading: loading ?? this.loading,
      vsAiEnabled: vsAiEnabled ?? this.vsAiEnabled,
      cashRmgEnabled: cashRmgEnabled ?? this.cashRmgEnabled,
      cashPhoneKycRequired: cashPhoneKycRequired ?? this.cashPhoneKycRequired,
      cashPhoneOtpRequired: cashPhoneOtpRequired ?? this.cashPhoneOtpRequired,
      cashRmgDisabledCountries:
          cashRmgDisabledCountries ?? this.cashRmgDisabledCountries,
      aiDepths: aiDepths ?? this.aiDepths,
      error: error,
    );
  }

  @override
  List<Object?> get props => [
        loading,
        vsAiEnabled,
        cashRmgEnabled,
        cashPhoneKycRequired,
        cashPhoneOtpRequired,
        cashRmgDisabledCountries,
        aiDepths,
        error,
      ];
}

class FeatureFlagsCubit extends Cubit<FeatureFlagsState> {
  FeatureFlagsCubit({ApiConfig? config})
      : _config = config ?? ApiConfig.defaults,
        super(const FeatureFlagsState());

  final ApiConfig _config;
  WebSocketChannel? _flagsWs;
  StreamSubscription? _flagsSub;
  PlayChrome? _playChrome;

  Future<PlayChrome?> _ensurePlayChrome() async {
    if (_playChrome != null) return _playChrome;
    try {
      final res =
          await http.get(Uri.parse('${_config.restUrl}/public/play-chrome'));
      if (res.statusCode != 200) return null;
      final map = jsonDecode(res.body);
      if (map is! Map<String, dynamic>) return null;
      _playChrome = PlayChrome.fromJson(map);
      return _playChrome;
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> _fetchRestFlags() async {
    final res = await http.get(Uri.parse('${_config.restUrl}/feature-flags'));
    if (res.statusCode != 200) return null;
    final map = jsonDecode(res.body);
    if (map is! Map<String, dynamic>) return null;
    return map;
  }

  Future<void> load({String? accessToken}) async {
    final chrome = await _ensurePlayChrome();
    final cached = QueryCache.read<FeatureFlagsWire>(
      CacheKeys.featureFlags,
      maxAge: QueryCache.platformTtl,
      allowStale: true,
    );
    if (cached != null && cached.hasPracticeDepths) {
      _applyFlags(cached);
      unawaited(_listenForLiveUpdates(accessToken));
      unawaited(_refreshInBackground(accessToken));
      return;
    }

    emit(state.copyWith(loading: true, error: null));
    try {
      final raw = await _fetchRestFlags();
      if (raw == null) {
        emit(state.copyWith(
          loading: false,
          error: chrome?.toastDifficultyUnavailable ?? '',
        ));
        return;
      }
      final applied = _applyFlags(FeatureFlagsWire.fromJson(raw));
      if (!applied) {
        emit(state.copyWith(
          loading: false,
          error: chrome?.toastDifficultyUnavailable ?? '',
        ));
        return;
      }
      await _listenForLiveUpdates(accessToken);
    } catch (e) {
      emit(state.copyWith(
        loading: false,
        error: chrome?.toastOptionsLoadFailed ?? '',
      ));
    }
  }

  Future<void> _refreshInBackground(String? accessToken) async {
    try {
      final raw = await _fetchRestFlags();
      if (raw != null) {
        _applyFlags(FeatureFlagsWire.fromJson(raw));
      }
    } catch (_) {}
    await _listenForLiveUpdates(accessToken);
  }

  bool _applyFlags(FeatureFlagsWire flags) {
    if (!flags.hasPracticeDepths) {
      return false;
    }
    QueryCache.write(CacheKeys.featureFlags, flags);
    emit(state.copyWith(
      loading: false,
      vsAiEnabled: flags.vsAiEnabled,
      cashRmgEnabled: flags.cashRmgEnabled,
      cashPhoneKycRequired: flags.cashPhoneKycRequired,
      cashPhoneOtpRequired: flags.cashPhoneOtpRequired,
      cashRmgDisabledCountries: flags.cashRmgDisabledCountries,
      aiDepths: flags.aiDepths,
      error: null,
    ));
    return true;
  }

  /// Instant hide/show when admin toggles VS-AI (same WS broadcast as web).
  Future<void> _listenForLiveUpdates(String? accessToken) async {
    await _flagsSub?.cancel();
    await _flagsWs?.sink.close();
    if (accessToken == null || accessToken.isEmpty) return;
    final origin = _config.origin.replaceFirst(RegExp(r'^http'), 'ws');
    final uri = Uri.parse(
      '$origin/ws/matchmaking?token=${Uri.encodeComponent(accessToken)}',
    );
    _flagsWs = WebSocketChannel.connect(uri);
    _flagsSub = _flagsWs!.stream.listen((event) {
      if (event is! String) return;
      try {
        final msg = jsonDecode(event) as Map<String, dynamic>;
        if (msg['type'] != 'feature_flags') return;
        final flags = msg['flags'];
        if (flags is Map<String, dynamic>) {
          _applyFlags(FeatureFlagsWire.fromJson(flags));
        }
      } catch (_) {}
    });
  }

  @override
  Future<void> close() async {
    await _flagsSub?.cancel();
    await _flagsWs?.sink.close();
    return super.close();
  }
}
