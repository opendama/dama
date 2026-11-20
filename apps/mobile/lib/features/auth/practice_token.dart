import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

const _practiceKey = 'dama_practice_token';

/// Ephemeral guest JWT for free VS-AI (not a signed-in account).
Future<String?> ensurePracticeToken({ApiConfig? config}) async {
  final cfg = config ?? ApiConfig.defaults;
  final prefs = await SharedPreferences.getInstance();
  final existing = (prefs.getString(_practiceKey) ?? '').trim();
  if (existing.isNotEmpty) return existing;
  try {
    final res = await http.post(Uri.parse('${cfg.restUrl}/auth/guest'));
    if (res.statusCode >= 300) return null;
    final map = jsonDecode(res.body) as Map<String, dynamic>;
    final token = (map['access_token'] as String?)?.trim() ?? '';
    if (token.isEmpty) return null;
    await prefs.setString(_practiceKey, token);
    return token;
  } catch (_) {
    return null;
  }
}
