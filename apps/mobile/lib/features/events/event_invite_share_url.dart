/// Resolve a copyable event invite URL (organizer copy-link parity).
/// Fail closed: bare origin (e.g. http://localhost:3000/) is never returned.
/// Legacy `view=events` / `/events/public` / `/events/join` → Community tournaments
/// (one player word).
String resolveEventInviteShareUrl({
  String? shareUrl,
  String? joinCode,
  String? sharePathTemplate,
  String? origin,
}) {
  final code = (joinCode ?? '').trim().toUpperCase();
  if (code.isEmpty) return '';

  final raw = (shareUrl ?? '').trim();
  if (_isValidInviteUrl(raw, code)) {
    return _normalizeInviteDiscoveryUrl(raw, code);
  }

  final tpl = (sharePathTemplate ?? '').trim();
  var base = (origin ?? '').trim();
  while (base.endsWith('/')) {
    base = base.substring(0, base.length - 1);
  }
  if (base.isEmpty || !tpl.contains('{code}')) return '';

  var path = tpl.replaceAll('{code}', code);
  if (!path.startsWith('/')) path = '/$path';
  if (path == '/' || !path.toUpperCase().contains(code)) return '';

  final built = '$base$path';
  if (!_isValidInviteUrl(built, code)) return '';
  return _normalizeInviteDiscoveryUrl(built, code);
}

String _normalizeInviteDiscoveryUrl(String url, String joinCodeUpper) {
  final u = url.trim();
  final uri = Uri.tryParse(u);
  if (uri == null || !uri.hasScheme) return u;

  final view = (uri.queryParameters['view'] ?? '').trim().toLowerCase();
  final path = uri.path;
  final isLegacyEventsBrowse = view == 'events' ||
      path.contains('/events/public') ||
      path.contains('/events/join');
  if (!isLegacyEventsBrowse) return u;

  final params = Map<String, String>.from(uri.queryParameters);
  params.remove('view');
  params['view'] = 'tournaments';
  params['source'] = 'community';
  // Keep join code from input when query omitted it.
  if ((params['code'] ?? '').trim().isEmpty) {
    params['code'] = joinCodeUpper;
  } else {
    params['code'] = params['code']!.trim().toUpperCase();
  }

  final out = uri.replace(path: '/', queryParameters: params).toString();
  return _isValidInviteUrl(out, joinCodeUpper) ? out : u;
}

bool _isValidInviteUrl(String url, String joinCodeUpper) {
  final u = url.trim();
  if (u.isEmpty) return false;
  if (RegExp(r'^https?:\/\/[^/]+\/?$', caseSensitive: false).hasMatch(u)) {
    return false;
  }
  return u.toUpperCase().contains(joinCodeUpper);
}
