import 'package:shared_preferences/shared_preferences.dart';

/// Durable challenge-link accept marker (mirrors web sessionStorage `dama.chal.accept:<tok>` = done).
String challengeAcceptDoneKey(String token) => 'dama.chal.accept:$token';

Future<bool> isChallengeAcceptDone(String? token) async {
  final tok = (token ?? '').trim();
  if (tok.isEmpty) return false;
  final prefs = await SharedPreferences.getInstance();
  return prefs.getString(challengeAcceptDoneKey(tok)) == 'done';
}

Future<void> markChallengeAcceptDone(String? token) async {
  final tok = (token ?? '').trim();
  if (tok.isEmpty) return;
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(challengeAcceptDoneKey(tok), 'done');
}
