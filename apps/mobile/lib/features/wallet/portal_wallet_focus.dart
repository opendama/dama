/// Parse wallet deep-link focus from a DB portal href (web Link parity).
///
/// `?focus=payout` opens the request form. `?focus=topup` opens top-up.
/// `?id=` seeks payout history. When id is present, history id wins (web parity).
class PortalWalletFocus {
  const PortalWalletFocus({
    this.focusPayout = false,
    this.focusTopUp = false,
    this.historyId,
  });

  final bool focusPayout;
  final bool focusTopUp;
  final String? historyId;
}

PortalWalletFocus portalWalletFocusFromHref(String href) {
  final raw = href.trim();
  if (raw.isEmpty) return const PortalWalletFocus();
  final uri = Uri.tryParse(raw);
  if (uri == null) return const PortalWalletFocus();
  final id = (uri.queryParameters['id'] ?? '').trim();
  if (id.isNotEmpty) {
    return PortalWalletFocus(historyId: id);
  }
  final focus = (uri.queryParameters['focus'] ?? '').trim().toLowerCase();
  return PortalWalletFocus(
    focusPayout: focus == 'payout',
    focusTopUp: focus == 'topup',
  );
}

/// True when the DB href path is a wallet surface (`/wallet` or `.../wallet`).
bool isWalletHrefPath(String href) {
  final uri = Uri.tryParse(href.trim());
  if (uri == null) return false;
  final path = uri.path;
  return path == '/wallet' || path.endsWith('/wallet');
}

/// Portal money prefix for sibling `link_*_href` (web `moneyBasePath` parity).
String moneyBasePathFromHref(String href) {
  final uri = Uri.tryParse(href.trim());
  if (uri == null) return '';
  final path = uri.path;
  if (path == '/events' || path.startsWith('/events/')) return '/events';
  if (path == '/ads' || path.startsWith('/ads/')) return '/ads';
  return '';
}

/// Append/replace `focus=` on a DB portal wallet href.
String withWalletFocusParam(String href, String focus) {
  final raw = href.trim();
  if (raw.isEmpty) return '';
  final uri = Uri.tryParse(raw);
  if (uri == null) return '';
  final next = Map<String, String>.from(uri.queryParameters);
  next['focus'] = focus.trim().toLowerCase();
  return uri.replace(queryParameters: next).toString();
}
