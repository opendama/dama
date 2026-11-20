import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/cache/query_cache.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/supabase/supabase_init.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/features/auth/auth_providers.dart';
import 'package:dama_mobile/features/auth/otp_session.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart' as supa;

class AuthState extends Equatable {
  const AuthState({
    this.token,
    this.userId,
    this.username,
    this.role,
    this.displayName,
    this.avatarUrl,
    this.loading = false,
    this.error,
  });

  final String? token;
  final String? userId;
  final String? username;
  final String? role;

  /// Google / IdP full name for header chrome (may differ from username handle).
  final String? displayName;
  final String? avatarUrl;
  final bool loading;
  final String? error;

  bool get isAuthenticated => token != null && token!.isNotEmpty;

  AuthState copyWith({
    String? token,
    String? userId,
    String? username,
    String? role,
    String? displayName,
    String? avatarUrl,
    bool? loading,
    String? error,
    bool clearError = false,
    bool clearAvatar = false,
  }) {
    return AuthState(
      token: token ?? this.token,
      userId: userId ?? this.userId,
      username: username ?? this.username,
      role: role ?? this.role,
      displayName: displayName ?? this.displayName,
      avatarUrl: clearAvatar ? null : (avatarUrl ?? this.avatarUrl),
      loading: loading ?? this.loading,
      error: clearError ? null : (error ?? this.error),
    );
  }

  @override
  List<Object?> get props =>
      [token, userId, username, role, displayName, avatarUrl, loading, error];
}

class AuthCubit extends Cubit<AuthState> {
  AuthCubit({String? origin})
      : origin = origin ?? ApiConfig.baseUrl,
        super(const AuthState());

  final String origin;
  AuthProvidersChrome? _chrome;

  Future<AuthProvidersChrome?> _ensureChrome() async {
    _chrome ??= await fetchAuthProvidersChrome(origin: origin);
    return _chrome;
  }

  String _failMsg([String? preferred]) {
    final p = (preferred ?? '').trim();
    if (p.isNotEmpty) return p;
    return (_chrome?.loginFailedMessage ?? '').trim();
  }

  /// Smoke / integration: apply a dama JWT without Supabase (optional).
  void applyE2ESession({
    required String accessToken,
    String? userId,
    String? username,
    String? role,
  }) {
    QueryCache.clear();
    emit(AuthState(
      token: accessToken,
      userId: userId,
      username: username,
      role: role,
    ));
  }

  /// Social OAuth via Supabase (provider id from auth-providers DB items), then dama JWT.
  Future<void> signInWithProvider(String providerId) async {
    final chrome = await _ensureChrome();
    final id = providerId.trim().toLowerCase();
    if (!SupabaseConfig.isConfigured) {
      emit(state.copyWith(
        error: (chrome?.missingSupabaseEnv ?? '').trim().isNotEmpty
            ? chrome!.missingSupabaseEnv
            : (chrome?.authProvidersUnavailable ?? ''),
      ));
      return;
    }
    emit(state.copyWith(loading: true, clearError: true));
    try {
      if (chrome == null || id.isEmpty || !chrome.oauthReady(id)) {
        final miss = chrome?.oauthParamsMissing(id) ?? '';
        emit(state.copyWith(
          loading: false,
          error: miss.isNotEmpty ? miss : _failMsg(),
        ));
        return;
      }
      final oauthProvider = _oauthProviderFromId(id);
      if (oauthProvider == null) {
        emit(state.copyWith(loading: false, error: _failMsg()));
        return;
      }
      final params = chrome.oauthParamsByProvider[id]!;
      final auth = supabaseClient.auth;
      final redirectTo = SupabaseConfig.oauthRedirectUrl.trim();

      final launched = await auth.signInWithOAuth(
        oauthProvider,
        redirectTo: redirectTo.isEmpty ? null : redirectTo,
        queryParams: {
          'access_type': params.accessType,
          'prompt': params.prompt,
        },
      );
      if (!launched) {
        emit(state.copyWith(loading: false, error: _failMsg()));
        return;
      }

      final session = auth.currentSession ?? await _waitForSession(auth);
      if (session == null || session.accessToken.isEmpty) {
        emit(state.copyWith(loading: false, error: _failMsg()));
        return;
      }
      await exchangeSupabaseToken(session.accessToken);
    } catch (_) {
      emit(state.copyWith(loading: false, error: _failMsg()));
    }
  }

  /// Map DB provider id → Supabase OAuthProvider. Unknown ids fail closed (no invent).
  supa.OAuthProvider? _oauthProviderFromId(String id) {
    switch (id) {
      case 'google':
        return supa.OAuthProvider.google;
      default:
        return null;
    }
  }

  /// Hand off a Supabase session access_token (e.g. deep-link callback) for dama JWT exchange.
  Future<void> exchangeSupabaseToken(String supabaseAccessToken) async {
    await _ensureChrome();
    emit(state.copyWith(loading: true, clearError: true));
    try {
      final res = await http.post(
        Uri.parse('$origin/api/v1/auth/oauth/supabase'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'access_token': supabaseAccessToken}),
      );
      if (res.statusCode >= 300) {
        emit(state.copyWith(loading: false, error: _failMsg()));
        return;
      }
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      final token =
          map['access_token'] as String? ?? map['accessToken'] as String?;
      final user = map['user'] as Map<String, dynamic>? ?? {};
      final role = user['role'] as String?;
      if (await _isConsoleRole(role)) {
        emit(state.copyWith(loading: false, error: _failMsg()));
        return;
      }
      final meta = SupabaseConfig.isConfigured
          ? (supabaseClient.auth.currentUser?.userMetadata ??
              const <String, dynamic>{})
          : const <String, dynamic>{};
      String metaStr(List<String> keys) {
        for (final k in keys) {
          final v = meta[k];
          if (v is String && v.trim().isNotEmpty) return v.trim();
        }
        return '';
      }

      final googleName = metaStr(const ['full_name', 'name', 'user_name']);
      final googleAvatar = metaStr(const ['avatar_url', 'picture', 'avatar']);
      final apiAvatar = (user['avatar_thumb_url'] as String?)?.trim() ??
          (user['avatar_full_url'] as String?)?.trim() ??
          '';
      QueryCache.clear();
      emit(AuthState(
        token: token,
        userId: user['id'] as String?,
        username: user['username'] as String?,
        role: role,
        displayName: googleName.isNotEmpty ? googleName : null,
        // Prefer uploaded game avatar; fall back to OAuth photo.
        avatarUrl: apiAvatar.isNotEmpty
            ? apiAvatar
            : (googleAvatar.isNotEmpty ? googleAvatar : null),
      ));
    } catch (_) {
      emit(state.copyWith(loading: false, error: _failMsg()));
    }
  }

  Future<supa.Session?> _waitForSession(supa.GoTrueClient auth) async {
    if (auth.currentSession != null) return auth.currentSession;
    final completer = Completer<supa.Session?>();
    late final StreamSubscription<supa.AuthState> subscription;
    subscription = auth.onAuthStateChange.listen((event) {
      final session = event.session;
      if (session != null && !completer.isCompleted) {
        completer.complete(session);
        subscription.cancel();
      }
    });
    try {
      return await completer.future.timeout(
        const Duration(minutes: 5),
        onTimeout: () => auth.currentSession,
      );
    } finally {
      await subscription.cancel();
    }
  }

  /// Console roles come from GET /api/v1/platform/enums (database), never client string literals.
  Future<bool> _isConsoleRole(String? role) async {
    if (role == null || role.isEmpty) return false;
    try {
      final res = await http.get(Uri.parse('$origin/api/v1/platform/enums'));
      if (res.statusCode >= 300) {
        return true;
      }
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      final enums = ClientEnums.fromJson(map);
      if (enums.consoleRoles.isEmpty) return true;
      return enums.consoleRoles.contains(role);
    } catch (_) {
      return true;
    }
  }

  /// Instant shell refresh after avatar upload or WS `avatar_updated`.
  /// When both [thumbUrl] and [fullUrl] are provided and empty, clears (admin reset).
  void applyGameAvatar(String? thumbUrl, {String? fullUrl}) {
    final thumb = (thumbUrl ?? '').trim();
    final full = (fullUrl ?? '').trim();
    if (thumbUrl != null && fullUrl != null && thumb.isEmpty && full.isEmpty) {
      if (state.avatarUrl == null) return;
      emit(state.copyWith(clearAvatar: true));
      return;
    }
    final next = thumb.isNotEmpty ? thumb : full;
    if (next.isEmpty) return;
    // Always emit so Image widgets rebuild even if the URL string is unchanged
    // (same-second CDN path collision) or only whitespace/query differs.
    emit(state.copyWith(avatarUrl: next));
  }

  Future<void> logout() async {
    final token = state.token;
    final userId = state.userId;
    if (token != null) {
      try {
        await http.post(
          Uri.parse('$origin/api/v1/auth/logout'),
          headers: {'Authorization': 'Bearer $token'},
        );
      } catch (_) {}
    }
    if (SupabaseConfig.isConfigured) {
      try {
        await supabaseClient.auth.signOut();
      } catch (_) {}
    }
    if (userId != null) {
      await clearOtpSession(userId);
    }
    QueryCache.clear();
    emit(const AuthState());
  }
}
