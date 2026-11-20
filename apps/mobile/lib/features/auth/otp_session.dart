import 'dart:async';

import 'package:shared_preferences/shared_preferences.dart';

/// Client OTP verify marker (mirrors web otp-session / SessionSecurity).
String otpSessionKey(String userId) => 'dama_otp_ok_$userId';

final StreamController<void> _otpSessionBus =
    StreamController<void>.broadcast();

/// Fires after [markOtpSessionVerified] / [clearOtpSession] (web `subscribeOtpSession` parity).
Stream<void> get otpSessionChanges => _otpSessionBus.stream;

Future<bool> isOtpSessionVerified(String? userId) async {
  if (userId == null || userId.isEmpty) return false;
  final prefs = await SharedPreferences.getInstance();
  return prefs.getString(otpSessionKey(userId)) == '1';
}

Future<void> markOtpSessionVerified(String? userId) async {
  if (userId == null || userId.isEmpty) return;
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(otpSessionKey(userId), '1');
  if (!_otpSessionBus.isClosed) _otpSessionBus.add(null);
}

Future<void> clearOtpSession(String? userId) async {
  if (userId == null || userId.isEmpty) return;
  final prefs = await SharedPreferences.getInstance();
  await prefs.remove(otpSessionKey(userId));
  if (!_otpSessionBus.isClosed) _otpSessionBus.add(null);
}
