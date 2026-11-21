import 'package:supabase_flutter/supabase_flutter.dart';

/// Supabase Auth (Google OAuth). Inject via --dart-define at build time.
class SupabaseConfig {
  const SupabaseConfig._();

  static const String url = String.fromEnvironment('DAMA_SUPABASE_URL');
  static const String anonKey =
      String.fromEnvironment('DAMA_SUPABASE_ANON_KEY');

  /// Optional local override only. Production OAuth redirect comes from DB
  /// `app_shell_chrome.mobile_oauth_redirect_url` (mig 540) via AuthCubit.
  static const String oauthRedirectUrl =
      String.fromEnvironment('DAMA_SUPABASE_OAUTH_REDIRECT');

  static bool get isConfigured => url.isNotEmpty && anonKey.isNotEmpty;
}

Future<void> initSupabase() async {
  if (!SupabaseConfig.isConfigured) {
    return;
  }
  await Supabase.initialize(
    url: SupabaseConfig.url,
    anonKey: SupabaseConfig.anonKey,
  );
}

SupabaseClient get supabaseClient => Supabase.instance.client;
