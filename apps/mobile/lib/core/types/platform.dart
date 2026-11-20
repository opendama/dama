/// DB-backed platform enums from GET /api/v1/platform/enums.
class EthiopiaPaymentModeOption {
  const EthiopiaPaymentModeOption({
    required this.mode,
    required this.label,
    required this.enabled,
  });

  final String mode;
  final String label;
  final bool enabled;

  factory EthiopiaPaymentModeOption.fromJson(Map<String, dynamic> json) {
    return EthiopiaPaymentModeOption(
      mode: json['mode']?.toString() ?? '',
      label: json['label']?.toString() ?? '',
      enabled: json['enabled'] == true,
    );
  }
}

class ClientEnums {
  const ClientEnums({
    required this.roles,
    required this.consoleRoles,
    required this.publisherRoles,
    required this.tournamentStatuses,
    required this.campaignStatuses,
    required this.ethiopiaPaymentModes,
  });

  final List<String> roles;
  final List<String> consoleRoles;
  final List<String> publisherRoles;
  final List<String> tournamentStatuses;
  final List<String> campaignStatuses;
  final List<EthiopiaPaymentModeOption> ethiopiaPaymentModes;

  factory ClientEnums.fromJson(Map<String, dynamic> json) {
    return ClientEnums(
      roles: (json['roles'] as List<dynamic>? ?? const [])
          .map((e) => e.toString())
          .toList(),
      consoleRoles: (json['console_roles'] as List<dynamic>? ?? const [])
          .map((e) => e.toString())
          .toList(),
      publisherRoles: (json['publisher_roles'] as List<dynamic>? ?? const [])
          .map((e) => e.toString())
          .toList(),
      tournamentStatuses:
          (json['tournament_statuses'] as List<dynamic>? ?? const [])
              .map((e) => e.toString())
              .toList(),
      campaignStatuses:
          (json['campaign_statuses'] as List<dynamic>? ?? const [])
              .map((e) => e.toString())
              .toList(),
      ethiopiaPaymentModes:
          (json['ethiopia_payment_modes'] as List<dynamic>? ?? const [])
              .whereType<Map<String, dynamic>>()
              .map(EthiopiaPaymentModeOption.fromJson)
              .toList(),
    );
  }
}

/// One link from platform_settings.client_nav.
class ClientNavLink {
  const ClientNavLink({
    required this.title,
    required this.routeKey,
    this.href,
    this.body,
    this.bodyWhenVsAi,
    this.cta,
  });

  final String title;
  final String routeKey;
  final String? href;
  final String? body;
  final String? bodyWhenVsAi;
  final String? cta;

  factory ClientNavLink.fromJson(Map<String, dynamic> json) {
    return ClientNavLink(
      title: json['title']?.toString() ?? '',
      routeKey: json['route_key']?.toString() ?? '',
      href: json['href']?.toString(),
      body: json['body']?.toString(),
      bodyWhenVsAi: json['body_when_vs_ai']?.toString(),
      cta: json['cta']?.toString(),
    );
  }
}

/// Bottom nav groups from client_nav.bottom_nav (DB only).
class ClientNavBottomNav {
  const ClientNavBottomNav({
    this.player = const [],
    this.mobile = const [],
    this.ads = const [],
    this.events = const [],
  });

  final List<ClientNavLink> player;
  final List<ClientNavLink> mobile;
  final List<ClientNavLink> ads;
  final List<ClientNavLink> events;

  factory ClientNavBottomNav.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const ClientNavBottomNav();
    List<ClientNavLink> parse(String key) {
      return (json[key] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ClientNavLink.fromJson)
          .where((e) => e.title.isNotEmpty && e.routeKey.isNotEmpty)
          .toList();
    }

    return ClientNavBottomNav(
      player: parse('player'),
      mobile: parse('mobile'),
      ads: parse('ads'),
      events: parse('events'),
    );
  }
}

bool _bottomNavLinksReady(List<ClientNavLink> links) {
  if (links.isEmpty) return false;
  return links
      .every((l) => l.title.trim().isNotEmpty && l.routeKey.trim().isNotEmpty);
}

bool isMobileBottomNavReady(ClientNavPayload? nav) {
  return nav != null && _bottomNavLinksReady(nav.bottomNav.mobile);
}

bool isAdsBottomNavReady(ClientNavPayload? nav) {
  return nav != null && _bottomNavLinksReady(nav.bottomNav.ads);
}

bool isEventsBottomNavReady(ClientNavPayload? nav) {
  return nav != null && _bottomNavLinksReady(nav.bottomNav.events);
}

/// Surfaces from GET /api/v1/platform/client-nav.
class ClientNavPayload {
  const ClientNavPayload({
    required this.player,
    required this.ads,
    required this.marketing,
    required this.mobile,
    required this.dashboard,
    required this.bottomNav,
    required this.mobileNavUnavailable,
    required this.brandName,
    required this.eventsBrandName,
    required this.eventsNavUnavailable,
    required this.dashboardPageTitle,
    required this.dashboardPageBlurb,
    required this.profileLoadFailed,
    required this.dashboardUnavailable,
    required this.dashboardHistoryTitle,
    required this.dashboardHistoryEmpty,
    required this.dashboardHistoryUnavailable,
    required this.dashboardProfileAction,
    required this.dashboardPlayAction,
    required this.dashboardWinRateLabel,
    required this.dashboardPercentSuffix,
    required this.dashboardMatchesSuffix,
    required this.dashboardMatchesJoiner,
    required this.dashboardWalletHref,
    required this.dashboardTransactionsAction,
    required this.dashboardTransactionsHref,
    required this.adsBrandName,
  });

  final List<ClientNavLink> player;
  final List<ClientNavLink> ads;
  final List<ClientNavLink> marketing;
  final List<ClientNavLink> mobile;
  final List<ClientNavLink> dashboard;
  final ClientNavBottomNav bottomNav;
  final String mobileNavUnavailable;
  final String brandName;
  final String eventsBrandName;
  final String eventsNavUnavailable;
  final String dashboardPageTitle;
  final String dashboardPageBlurb;
  final String profileLoadFailed;
  final String dashboardUnavailable;
  final String dashboardHistoryTitle;
  final String dashboardHistoryEmpty;
  final String dashboardHistoryUnavailable;
  final String dashboardProfileAction;
  final String dashboardPlayAction;
  final String dashboardWinRateLabel;
  final String dashboardPercentSuffix;
  final String dashboardMatchesSuffix;
  final String dashboardMatchesJoiner;
  final String dashboardWalletHref;
  final String dashboardTransactionsAction;
  final String dashboardTransactionsHref;
  final String adsBrandName;

  bool get isBrandReady => brandName.isNotEmpty;

  bool get isEventsBrandReady => eventsBrandName.isNotEmpty;

  bool get isDashboardChromeReady =>
      dashboardPageTitle.isNotEmpty &&
      dashboardUnavailable.isNotEmpty &&
      dashboardWinRateLabel.isNotEmpty &&
      dashboardPercentSuffix.isNotEmpty &&
      dashboardMatchesSuffix.isNotEmpty &&
      dashboardMatchesJoiner.trim().isNotEmpty &&
      dashboardProfileAction.isNotEmpty &&
      dashboardPlayAction.isNotEmpty &&
      dashboardWalletHref.isNotEmpty &&
      dashboardTransactionsAction.isNotEmpty &&
      dashboardTransactionsHref.isNotEmpty;

  factory ClientNavPayload.fromJson(Map<String, dynamic> json) {
    List<ClientNavLink> parse(String key) {
      return (json[key] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ClientNavLink.fromJson)
          .where((e) => e.title.isNotEmpty && e.routeKey.isNotEmpty)
          .toList();
    }

    String s(String k) => (json[k] as String?)?.trim() ?? '';
    String joiner(String k) {
      final raw = json[k] as String? ?? '';
      if (raw.trim().isEmpty) return '';
      return raw;
    }

    final bottomRaw = json['bottom_nav'];
    return ClientNavPayload(
      player: parse('player'),
      ads: parse('ads'),
      marketing: parse('marketing'),
      mobile: parse('mobile'),
      dashboard: parse('dashboard'),
      bottomNav: ClientNavBottomNav.fromJson(
        bottomRaw is Map<String, dynamic> ? bottomRaw : null,
      ),
      mobileNavUnavailable: s('mobile_nav_unavailable'),
      brandName: s('brand_name'),
      eventsBrandName: s('events_brand_name'),
      eventsNavUnavailable: s('events_nav_unavailable'),
      dashboardPageTitle: s('dashboard_page_title'),
      dashboardPageBlurb: s('dashboard_page_blurb'),
      profileLoadFailed: s('profile_load_failed'),
      dashboardUnavailable: s('dashboard_unavailable'),
      dashboardHistoryTitle: s('dashboard_history_title'),
      dashboardHistoryEmpty: s('dashboard_history_empty'),
      dashboardHistoryUnavailable: s('dashboard_history_unavailable'),
      dashboardProfileAction: s('dashboard_profile_action'),
      dashboardPlayAction: s('dashboard_play_action'),
      dashboardWinRateLabel: s('dashboard_win_rate_label'),
      dashboardPercentSuffix: s('dashboard_percent_suffix'),
      dashboardMatchesSuffix: s('dashboard_matches_suffix'),
      dashboardMatchesJoiner: joiner('dashboard_matches_joiner'),
      dashboardWalletHref: s('dashboard_wallet_href'),
      dashboardTransactionsAction: s('dashboard_transactions_action'),
      dashboardTransactionsHref: s('dashboard_transactions_href'),
      adsBrandName: s('ads_brand_name'),
    );
  }
}
