import 'package:dama_mobile/core/network/api_config.dart';

/// Resolve API-relative chat media paths (mirrors web `resolveChatMediaUrl`).
String resolveChatMediaUrl(String raw) {
  final u = raw.trim();
  if (u.isEmpty) return '';
  if (RegExp(r'^https?://', caseSensitive: false).hasMatch(u)) return u;
  final rest = ApiConfig.defaults.restUrl.replaceAll(RegExp(r'/$'), '');
  final origin = rest.replaceAll(RegExp(r'/api/v1$', caseSensitive: false), '');
  if (u.startsWith('/api/v1/') || u.startsWith('/')) {
    return '$origin$u';
  }
  return u;
}
