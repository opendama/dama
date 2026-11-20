import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/features/events/community_player_chrome_soft.dart';

/// Ops keys never belong on the public desktop rail (web player-nav.ts parity).
const _opsRouteKeys = <String>{
  'dashboard',
  'overview',
  'wallet',
  'profile',
  'ads',
  'ads_dashboard',
  'events_dashboard',
  'avatar',
  'receipts',
  'transactions',
  'settings',
  'history',
  'matches',
};

bool _isEventsBrowse(ClientNavLink link) {
  final key = link.routeKey.trim();
  if (key == 'events' || key == 'events_public') return true;
  final path = (link.href ?? '').trim().split('?').first;
  return path == '/events/public' || path.startsWith('/events/public/');
}

List<ClientNavLink> _dedupeByRouteKey(List<ClientNavLink> links) {
  final seen = <String>{};
  final out = <ClientNavLink>[];
  for (final link in links) {
    final key = link.routeKey.trim().isNotEmpty
        ? link.routeKey.trim()
        : (link.href ?? '').trim();
    if (key.isEmpty || seen.contains(key)) continue;
    if ((link.href ?? '').trim().isEmpty || link.title.trim().isEmpty) continue;
    seen.add(key);
    out.add(link);
  }
  return out;
}

/// Public-only: drop Home duplicate + ops + legacy Events browse.
List<ClientNavLink> filterPlayerNavLinks(List<ClientNavLink> links) {
  final hasPlay = links.any((l) => l.routeKey.trim() == 'play');
  return links.where((l) {
    final key = l.routeKey.trim();
    if (_opsRouteKeys.contains(key)) return false;
    if (hasPlay && key == 'home') return false;
    if (_isEventsBrowse(l)) return false;
    return true;
  }).toList();
}

List<ClientNavLink> mapPlayerNavDisplayTitles(List<ClientNavLink> links) {
  return links.map((l) {
    if (l.routeKey.trim() != 'tournaments') return l;
    final next = softTournamentsPageTitle(l.title);
    if (next == l.title) return l;
    return ClientNavLink(
      title: next,
      routeKey: l.routeKey,
      href: l.href,
      body: l.body,
      bodyWhenVsAi: l.bodyWhenVsAi,
      cta: l.cta,
    );
  }).toList();
}

/// Desktop left rail parity: full public discovery from `client_nav.player`.
List<ClientNavLink> pickDesktopRailLinks(ClientNavPayload nav) {
  final fromPlayer = mapPlayerNavDisplayTitles(
    filterPlayerNavLinks(_dedupeByRouteKey(nav.player)),
  );
  if (fromPlayer.isNotEmpty) return fromPlayer;
  return mapPlayerNavDisplayTitles(
    filterPlayerNavLinks(_dedupeByRouteKey(nav.bottomNav.mobile)),
  );
}
