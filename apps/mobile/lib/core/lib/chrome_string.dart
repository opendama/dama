/// DB chrome separators / paren wrappers may be intentional whitespace
/// (e.g. amount_currency_separator = single space). Never trim those.
bool isChromeSeparatorKey(String key) {
  return key.endsWith('_separator') ||
      key.endsWith('_joiner') ||
      key.endsWith('_space') ||
      key == 'paren_open' ||
      key == 'paren_close';
}

bool chromeStringPresent(String key, String raw) {
  if (isChromeSeparatorKey(key)) return raw.isNotEmpty;
  return raw.trim().isNotEmpty;
}

String chromeMapString(Map<String, String> chrome, String key) {
  final raw = chrome[key] ?? '';
  if (isChromeSeparatorKey(key)) return raw;
  return raw.trim();
}
