/// DB-backed leaderboard chrome from GET /public/leaderboard-chrome.
class LeaderboardChrome {
  const LeaderboardChrome({
    required this.source,
    required this.unavailable,
    required this.pageTitle,
    required this.pageBlurb,
    required this.empty,
    required this.loadFailed,
    required this.onlineLabel,
    required this.playingLabel,
    required this.offlineLabel,
    required this.inspectAriaPrefix,
    required this.winsAbbr,
    required this.lossesAbbr,
    required this.drawsAbbr,
    required this.statsSeparator,
    required this.metaSeparator,
    required this.rankPrefix,
    required this.xpSuffix,
    required this.hallOfFameTitle,
    required this.periodWeek,
    required this.periodMonth,
    required this.periodYear,
    required this.periodAll,
    required this.defaultPeriod,
    required this.listPageSize,
    required this.ptsSuffix,
    required this.yourRankPrefix,
    required this.viewFullLeaderboard,
    required this.podiumFirstAria,
    required this.podiumSecondAria,
    required this.podiumThirdAria,
    required this.rankListTitle,
    required this.unrankedLabel,
    required this.podiumFirstCrown,
    required this.podiumSecondCrown,
    required this.podiumThirdCrown,
  });

  final String source;
  final String unavailable;
  final String pageTitle;
  final String pageBlurb;
  final String empty;
  final String loadFailed;
  final String onlineLabel;
  final String playingLabel;
  final String offlineLabel;
  final String inspectAriaPrefix;
  final String winsAbbr;
  final String lossesAbbr;
  final String drawsAbbr;
  final String statsSeparator;
  final String metaSeparator;
  final String rankPrefix;
  final String xpSuffix;
  final String hallOfFameTitle;
  final String periodWeek;
  final String periodMonth;
  final String periodYear;
  final String periodAll;

  /// API period key: week | month | year | all (DB-driven).
  final String defaultPeriod;

  /// Positive decimal string for skip/limit page size.
  final String listPageSize;
  final String ptsSuffix;
  final String yourRankPrefix;
  final String viewFullLeaderboard;
  final String podiumFirstAria;
  final String podiumSecondAria;
  final String podiumThirdAria;
  final String rankListTitle;
  final String unrankedLabel;
  final String podiumFirstCrown;
  final String podiumSecondCrown;
  final String podiumThirdCrown;

  bool get isReady =>
      source.isNotEmpty &&
      unavailable.isNotEmpty &&
      pageTitle.isNotEmpty &&
      pageBlurb.isNotEmpty &&
      empty.isNotEmpty &&
      loadFailed.isNotEmpty &&
      onlineLabel.isNotEmpty &&
      playingLabel.isNotEmpty &&
      offlineLabel.isNotEmpty &&
      inspectAriaPrefix.isNotEmpty &&
      winsAbbr.isNotEmpty &&
      lossesAbbr.isNotEmpty &&
      drawsAbbr.isNotEmpty &&
      statsSeparator.isNotEmpty &&
      metaSeparator.isNotEmpty &&
      rankPrefix.isNotEmpty &&
      xpSuffix.isNotEmpty &&
      hallOfFameTitle.isNotEmpty &&
      periodWeek.isNotEmpty &&
      periodMonth.isNotEmpty &&
      periodYear.isNotEmpty &&
      periodAll.isNotEmpty &&
      defaultPeriod.isNotEmpty &&
      listPageSize.isNotEmpty &&
      ptsSuffix.isNotEmpty &&
      yourRankPrefix.isNotEmpty &&
      viewFullLeaderboard.isNotEmpty &&
      podiumFirstAria.isNotEmpty &&
      podiumSecondAria.isNotEmpty &&
      podiumThirdAria.isNotEmpty &&
      rankListTitle.isNotEmpty &&
      unrankedLabel.isNotEmpty &&
      podiumFirstCrown.isNotEmpty &&
      podiumSecondCrown.isNotEmpty &&
      podiumThirdCrown.isNotEmpty;

  static LeaderboardChrome? fromJson(Map<String, dynamic>? map) {
    if (map == null) return null;
    String s(String k) => (map[k] as String?)?.trim() ?? '';
    final chrome = LeaderboardChrome(
      source: s('source'),
      unavailable: s('leaderboard_chrome_unavailable'),
      pageTitle: s('page_title'),
      pageBlurb: s('page_blurb'),
      empty: s('empty'),
      loadFailed: s('load_failed'),
      onlineLabel: s('online_label'),
      playingLabel: s('playing_label'),
      offlineLabel: s('offline_label'),
      inspectAriaPrefix: s('inspect_aria_prefix'),
      winsAbbr: s('wins_abbr'),
      lossesAbbr: s('losses_abbr'),
      drawsAbbr: s('draws_abbr'),
      statsSeparator: s('stats_separator'),
      metaSeparator: s('meta_separator'),
      rankPrefix: s('rank_prefix'),
      xpSuffix: s('xp_suffix'),
      hallOfFameTitle: s('hall_of_fame_title'),
      periodWeek: s('period_week'),
      periodMonth: s('period_month'),
      periodYear: s('period_year'),
      periodAll: s('period_all'),
      defaultPeriod: s('default_period'),
      listPageSize: s('list_page_size'),
      ptsSuffix: s('pts_suffix'),
      yourRankPrefix: s('your_rank_prefix'),
      viewFullLeaderboard: s('view_full_leaderboard'),
      podiumFirstAria: s('podium_first_aria'),
      podiumSecondAria: s('podium_second_aria'),
      podiumThirdAria: s('podium_third_aria'),
      rankListTitle: s('rank_list_title'),
      unrankedLabel: s('unranked_label'),
      podiumFirstCrown: s('podium_first_crown'),
      podiumSecondCrown: s('podium_second_crown'),
      podiumThirdCrown: s('podium_third_crown'),
    );
    return chrome.isReady ? chrome : null;
  }
}
