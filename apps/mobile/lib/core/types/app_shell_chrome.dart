import 'package:flutter/material.dart' show Color;

/// DB-backed splash / onboarding / 404 chrome from GET /public/app-shell-chrome.
class AppShellChrome {
  const AppShellChrome({
    required this.source,
    required this.appShellUnavailable,
    required this.splashHoldMs,
    required this.splashUnavailable,
    required this.splashBackgroundColor,
    required this.splashLogoInk,
    required this.brandMarkAlt,
    required this.notFoundCode,
    required this.notFoundTitle,
    required this.notFoundBlurb,
    required this.notFoundHomeAction,
    required this.notFoundHomeHref,
    required this.onboardingUnavailable,
    required this.skipAction,
    required this.nextAction,
    required this.doneAction,
    required this.slide1Title,
    required this.slide1Blurb,
    required this.slide2Title,
    required this.slide2Blurb,
    required this.slide3Title,
    required this.slide3Blurb,
  });

  final String source;
  final String appShellUnavailable;
  final int splashHoldMs;
  final String splashUnavailable;
  final String splashBackgroundColor;
  final String splashLogoInk;
  final String brandMarkAlt;
  final String notFoundCode;
  final String notFoundTitle;
  final String notFoundBlurb;
  final String notFoundHomeAction;
  final String notFoundHomeHref;
  final String onboardingUnavailable;
  final String skipAction;
  final String nextAction;
  final String doneAction;
  final String slide1Title;
  final String slide1Blurb;
  final String slide2Title;
  final String slide2Blurb;
  final String slide3Title;
  final String slide3Blurb;

  bool get isReady =>
      source.trim().isNotEmpty &&
      appShellUnavailable.trim().isNotEmpty &&
      splashHoldMs > 0 &&
      splashUnavailable.trim().isNotEmpty &&
      splashBackgroundColor.trim().isNotEmpty &&
      splashLogoInk.trim().isNotEmpty &&
      brandMarkAlt.trim().isNotEmpty &&
      notFoundCode.trim().isNotEmpty &&
      notFoundTitle.trim().isNotEmpty &&
      notFoundBlurb.trim().isNotEmpty &&
      notFoundHomeAction.trim().isNotEmpty &&
      notFoundHomeHref.trim().isNotEmpty &&
      onboardingUnavailable.trim().isNotEmpty &&
      skipAction.trim().isNotEmpty &&
      nextAction.trim().isNotEmpty &&
      doneAction.trim().isNotEmpty &&
      slide1Title.trim().isNotEmpty &&
      slide1Blurb.trim().isNotEmpty &&
      slide2Title.trim().isNotEmpty &&
      slide2Blurb.trim().isNotEmpty &&
      slide3Title.trim().isNotEmpty &&
      slide3Blurb.trim().isNotEmpty;

  bool get splashUsesWhiteMark => splashLogoInk.trim().toLowerCase() == 'white';

  List<({String title, String blurb})> get slides => [
        (title: slide1Title, blurb: slide1Blurb),
        (title: slide2Title, blurb: slide2Blurb),
        (title: slide3Title, blurb: slide3Blurb),
      ];

  /// Parse #RRGGBB from DB; returns null if invalid (fail closed).
  Color? parseSplashBackgroundColor() {
    final raw = splashBackgroundColor.trim();
    if (!RegExp(r'^#[0-9A-Fa-f]{6}$').hasMatch(raw)) return null;
    final v = int.tryParse(raw.substring(1), radix: 16);
    if (v == null) return null;
    return Color(0xFF000000 | v);
  }

  factory AppShellChrome.fromJson(Map<String, dynamic> json) {
    String s(String k) => (json[k]?.toString() ?? '').trim();
    int holdMs() {
      final raw = s('splash_hold_ms');
      final n = int.tryParse(raw);
      if (n == null || n <= 0) return 0;
      return n.clamp(400, 4000);
    }

    return AppShellChrome(
      source: s('source'),
      appShellUnavailable: s('app_shell_unavailable'),
      splashHoldMs: holdMs(),
      splashUnavailable: s('splash_unavailable'),
      splashBackgroundColor: s('splash_background_color'),
      splashLogoInk: s('splash_logo_ink'),
      brandMarkAlt: s('brand_mark_alt'),
      notFoundCode: s('not_found_code'),
      notFoundTitle: s('not_found_title'),
      notFoundBlurb: s('not_found_blurb'),
      notFoundHomeAction: s('not_found_home_action'),
      notFoundHomeHref: s('not_found_home_href'),
      onboardingUnavailable: s('onboarding_unavailable'),
      skipAction: s('skip_action'),
      nextAction: s('next_action'),
      doneAction: s('done_action'),
      slide1Title: s('slide_1_title'),
      slide1Blurb: s('slide_1_blurb'),
      slide2Title: s('slide_2_title'),
      slide2Blurb: s('slide_2_blurb'),
      slide3Title: s('slide_3_title'),
      slide3Blurb: s('slide_3_blurb'),
    );
  }
}
