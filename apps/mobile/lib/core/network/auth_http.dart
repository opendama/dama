import 'package:dama_mobile/core/network/session_bounce.dart';
import 'package:http/http.dart' as http;

/// Authenticated REST helpers with web-parity 401 → session bounce.
Future<http.Response> authGet(
  Uri uri, {
  required String? token,
  Map<String, String>? headers,
}) async {
  final res = await http.get(uri, headers: _headers(token, headers));
  await _maybeBounce(res, token);
  return res;
}

Future<http.Response> authPost(
  Uri uri, {
  required String? token,
  Object? body,
  Map<String, String>? headers,
}) async {
  final res = await http.post(
    uri,
    headers: _headers(token, headers, json: true),
    body: body,
  );
  await _maybeBounce(res, token);
  return res;
}

Map<String, String> _headers(
  String? token,
  Map<String, String>? extra, {
  bool json = false,
}) {
  return {
    if (json) 'Content-Type': 'application/json',
    if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    ...?extra,
  };
}

Future<void> _maybeBounce(http.Response res, String? token) async {
  if (res.statusCode == 401 && token != null && token.isNotEmpty) {
    await bounceOnUnauthorized(hadToken: true);
  }
}
