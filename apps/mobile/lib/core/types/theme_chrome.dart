/// DB-backed theme toggle chrome from GET /public/theme-chrome.
class ThemeChrome {
  const ThemeChrome({
    required this.source,
    required this.unavailable,
    required this.ariaLabel,
    required this.labelSystem,
    required this.labelLight,
    required this.labelDark,
    required this.labelSystemResolvedPrefix,
    required this.ariaTemplate,
    required this.titleTemplate,
    required this.resolvedParenOpen,
    required this.resolvedParenClose,
  });

  final String source;
  final String unavailable;
  final String ariaLabel;
  final String labelSystem;
  final String labelLight;
  final String labelDark;
  final String labelSystemResolvedPrefix;
  final String ariaTemplate;
  final String titleTemplate;
  final String resolvedParenOpen;
  final String resolvedParenClose;

  bool get isReady =>
      source.isNotEmpty &&
      unavailable.isNotEmpty &&
      ariaLabel.isNotEmpty &&
      labelSystem.isNotEmpty &&
      labelLight.isNotEmpty &&
      labelDark.isNotEmpty &&
      labelSystemResolvedPrefix.isNotEmpty &&
      ariaTemplate.isNotEmpty &&
      titleTemplate.isNotEmpty &&
      resolvedParenOpen.isNotEmpty &&
      resolvedParenClose.isNotEmpty;

  static ThemeChrome? fromJson(Map<String, dynamic>? map) {
    if (map == null) return null;
    String s(String k) => (map[k] as String?)?.trim() ?? '';
    final chrome = ThemeChrome(
      source: s('source'),
      unavailable: s('theme_chrome_unavailable'),
      ariaLabel: s('aria_label'),
      labelSystem: s('label_system'),
      labelLight: s('label_light'),
      labelDark: s('label_dark'),
      labelSystemResolvedPrefix: s('label_system_resolved_prefix'),
      ariaTemplate: s('aria_template'),
      titleTemplate: s('title_template'),
      resolvedParenOpen: s('resolved_paren_open'),
      resolvedParenClose: s('resolved_paren_close'),
    );
    return chrome.isReady ? chrome : null;
  }

  String labelFor(ThemeModeLabel mode, {String? resolved}) {
    switch (mode) {
      case ThemeModeLabel.light:
        return labelLight;
      case ThemeModeLabel.dark:
        return labelDark;
      case ThemeModeLabel.system:
        final r = (resolved ?? '').trim();
        if (r.isEmpty) return labelSystem;
        return '$labelSystemResolvedPrefix$resolvedParenOpen$r$resolvedParenClose';
    }
  }

  String fillTemplate(String template, String current, String next) {
    return template.replaceAll('{current}', current).replaceAll('{next}', next);
  }
}

enum ThemeModeLabel { system, light, dark }
