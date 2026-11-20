import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:http/http.dart' as http;

/// Chrome from GET /public/auth-providers (database only; fail closed when empty).
class AuthProvidersChrome {
  const AuthProvidersChrome({
    required this.loginTitle,
    required this.loginSubtitle,
    required this.items,
    required this.loginFailedMessage,
    required this.providersEmptyMessage,
    required this.authProvidersUnavailable,
    required this.missingSupabaseEnv,
    required this.oauthParamsByProvider,
    required this.oauthParamsMissingByProvider,
    required this.navSignInLabel,
    required this.signOutActionLabel,
    required this.signOutPending,
  });

  final String loginTitle;
  final String loginSubtitle;
  final List<AuthProviderItem> items;
  final String loginFailedMessage;
  final String providersEmptyMessage;
  final String authProvidersUnavailable;
  final String missingSupabaseEnv;

  /// `{id}` → access_type / prompt from `{id}_oauth_*` chrome keys.
  final Map<String, ({String accessType, String prompt})> oauthParamsByProvider;
  final Map<String, String> oauthParamsMissingByProvider;
  final String navSignInLabel;
  final String signOutActionLabel;
  final String signOutPending;

  bool oauthReady(String providerId) {
    final p = oauthParamsByProvider[providerId.trim().toLowerCase()];
    return p != null && p.accessType.isNotEmpty && p.prompt.isNotEmpty;
  }

  String oauthParamsMissing(String providerId) {
    return oauthParamsMissingByProvider[providerId.trim().toLowerCase()] ?? '';
  }

  static AuthProvidersChrome? fromJson(Map<String, dynamic>? map) {
    if (map == null) return null;
    final rawItems = map['items'];
    final items = <AuthProviderItem>[];
    if (rawItems is List) {
      for (final row in rawItems) {
        if (row is! Map) continue;
        final id = (row['id'] as String?)?.trim() ?? '';
        final action = (row['action_label'] as String?)?.trim() ?? '';
        final pending = (row['pending_label'] as String?)?.trim() ?? '';
        if (id.isEmpty || action.isEmpty || pending.isEmpty) continue;
        items.add(AuthProviderItem(
            id: id, actionLabel: action, pendingLabel: pending));
      }
    }
    final oauthParams = <String, ({String accessType, String prompt})>{};
    final oauthMissing = <String, String>{};
    for (final item in items) {
      final id = item.id.toLowerCase();
      final access = (map['${id}_oauth_access_type'] as String?)?.trim() ?? '';
      final prompt = (map['${id}_oauth_prompt'] as String?)?.trim() ?? '';
      if (access.isNotEmpty && prompt.isNotEmpty) {
        oauthParams[id] = (accessType: access, prompt: prompt);
      }
      final miss = (map['${id}_oauth_params_missing'] as String?)?.trim() ?? '';
      if (miss.isNotEmpty) oauthMissing[id] = miss;
    }
    return AuthProvidersChrome(
      loginTitle: (map['login_title'] as String?)?.trim() ?? '',
      loginSubtitle: (map['login_subtitle'] as String?)?.trim() ?? '',
      items: items,
      loginFailedMessage:
          (map['login_failed_message'] as String?)?.trim() ?? '',
      providersEmptyMessage:
          (map['providers_empty_message'] as String?)?.trim() ?? '',
      authProvidersUnavailable:
          (map['login_auth_providers_unavailable'] as String?)?.trim() ?? '',
      missingSupabaseEnv:
          (map['login_missing_supabase_env'] as String?)?.trim() ?? '',
      oauthParamsByProvider: oauthParams,
      oauthParamsMissingByProvider: oauthMissing,
      navSignInLabel: (map['nav_sign_in_label'] as String?)?.trim() ?? '',
      signOutActionLabel:
          (map['sign_out_action_label'] as String?)?.trim() ?? '',
      signOutPending: (map['sign_out_pending'] as String?)?.trim() ?? '',
    );
  }
}

class AuthProviderItem {
  const AuthProviderItem({
    required this.id,
    required this.actionLabel,
    required this.pendingLabel,
  });

  final String id;
  final String actionLabel;
  final String pendingLabel;
}

Future<AuthProvidersChrome?> fetchAuthProvidersChrome({String? origin}) async {
  final base = (origin ?? ApiConfig.baseUrl).replaceAll(RegExp(r'/$'), '');
  try {
    final res = await http.get(
      Uri.parse('$base/api/v1/public/auth-providers'),
      headers: {'Accept': 'application/json'},
    );
    if (res.statusCode >= 300) return null;
    final map = jsonDecode(res.body) as Map<String, dynamic>;
    return AuthProvidersChrome.fromJson(map);
  } catch (_) {
    return null;
  }
}
