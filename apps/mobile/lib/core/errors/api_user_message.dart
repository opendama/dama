import 'dart:convert';

/// User-facing API/chrome messaging helpers (web/admin chromeOnlyToast parity).

/// True when [msg] looks like a raw API JSON envelope - never show in UI.
bool isRawApiJsonEnvelope(String msg) {
  final t = msg.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return false;
  return t.contains('"error"') ||
      t.contains("'error'") ||
      t.contains('"error_key"') ||
      t.contains("'error_key'");
}

/// Returns trimmed chrome/user copy, or null when empty / JSON envelope.
String? chromeOnlyUserMessage(String? msg) {
  final t = (msg ?? '').trim();
  if (t.isEmpty || isRawApiJsonEnvelope(t)) return null;
  return t;
}

/// Map checkout provider `error_key` → wallet chrome (single professional string).
String checkoutChromeMessage({
  required String responseBody,
  required String? checkoutFailed,
  required String? checkoutUnavailable,
}) {
  final failed = (checkoutFailed ?? '').trim();
  final unavailable = (checkoutUnavailable ?? '').trim();
  final fallback = failed.isNotEmpty ? failed : unavailable;
  try {
    final decoded = _tryDecodeMap(responseBody);
    if (decoded == null) return fallback;
    final key = (decoded['error_key']?.toString() ?? '').trim();
    if (key == 'checkout_unavailable' || key == 'checkout_failed') {
      if (failed.isNotEmpty) return failed;
      if (unavailable.isNotEmpty) return unavailable;
    }
    // Never surface raw `error` JSON body - chrome fallback only.
    return fallback;
  } catch (_) {
    return fallback;
  }
}

Map<String, dynamic>? _tryDecodeMap(String raw) {
  final t = raw.trim();
  if (!t.startsWith('{')) return null;
  final parsed = jsonDecode(t);
  if (parsed is Map<String, dynamic>) return parsed;
  if (parsed is Map) {
    return parsed.map((k, v) => MapEntry(k.toString(), v));
  }
  return null;
}
