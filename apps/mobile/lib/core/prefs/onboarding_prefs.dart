import 'package:shared_preferences/shared_preferences.dart';

const _kOnboardingCompleted = 'dama_onboarding_completed';

Future<bool> isOnboardingCompleted() async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getString(_kOnboardingCompleted) == '1';
}

Future<void> markOnboardingCompleted() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(_kOnboardingCompleted, '1');
}

Future<void> clearOnboardingCompleted() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.remove(_kOnboardingCompleted);
}
