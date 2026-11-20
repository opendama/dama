import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/types/app_shell_chrome.dart';
import 'package:http/http.dart' as http;

/// Shared fetch for splash / onboarding / not-found chrome (fail closed).
Future<AppShellChrome?> fetchAppShellChrome() async {
  try {
    final res = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/v1/public/app-shell-chrome'),
    );
    if (res.statusCode >= 300) return null;
    final doc = AppShellChrome.fromJson(
      jsonDecode(res.body) as Map<String, dynamic>,
    );
    return doc.isReady ? doc : null;
  } catch (_) {
    return null;
  }
}
