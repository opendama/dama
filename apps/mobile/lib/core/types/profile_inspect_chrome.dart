/// DB-backed public player inspect chrome from GET /public/profile-inspect-chrome.
class ProfileInspectChrome {
  const ProfileInspectChrome({
    required this.source,
    required this.unavailable,
    required this.loadFailed,
    required this.srDescription,
    required this.inspectAction,
    required this.zoomTitle,
    required this.noAvatar,
    required this.avatarAltSuffix,
    required this.labelRating,
    required this.labelXp,
    required this.labelLevel,
    required this.labelWins,
    required this.labelLosses,
    required this.labelDraws,
    required this.labelCountry,
    required this.labelRegion,
    required this.labelRegionalRank,
    required this.topPrefix,
    required this.recentMatchesTitle,
    required this.noMatches,
    required this.tournamentPlacementsTitle,
    required this.noPlacements,
    required this.outcomeDraw,
    required this.outcomeWin,
    required this.outcomeLoss,
    required this.freeSuffix,
    required this.piecesLeftSuffix,
    required this.capturedSuffix,
    required this.seatMetaSeparator,
    required this.statsSeparator,
    required this.labelValueSeparator,
    required this.flagCodeSeparator,
    required this.rankPartsSeparator,
    required this.pageTitle,
    required this.zoomHint,
    required this.wldLabel,
    required this.movesSuffix,
    required this.playerUnavailable,
    required this.friendsCountLabel,
    required this.onlineNowLabel,
    required this.offlineNowLabel,
    required this.playingNowLabel,
    required this.overviewTab,
    required this.gamesTab,
    required this.gameHistoryPlayersCol,
    required this.gameHistoryResultCol,
    required this.gameHistoryMovesCol,
    required this.gameHistoryDateCol,
    required this.friendsSectionTitle,
    required this.joinedLabel,
    required this.noFriends,
    required this.emptyValue,
    required this.listPageSize,
    this.hostRepFinishedLabel = '',
    this.hostRepCancelledLabel = '',
    this.hostRepReportsLabel = '',
    this.hostRepMetaSeparator = '',
  });

  final String source;
  final String unavailable;
  final String loadFailed;
  final String srDescription;
  final String inspectAction;
  final String zoomTitle;
  final String noAvatar;
  final String avatarAltSuffix;
  final String labelRating;
  final String labelXp;
  final String labelLevel;
  final String labelWins;
  final String labelLosses;
  final String labelDraws;
  final String labelCountry;
  final String labelRegion;
  final String labelRegionalRank;
  final String topPrefix;
  final String recentMatchesTitle;
  final String noMatches;
  final String tournamentPlacementsTitle;
  final String noPlacements;
  final String outcomeDraw;
  final String outcomeWin;
  final String outcomeLoss;
  final String freeSuffix;
  final String piecesLeftSuffix;
  final String capturedSuffix;
  final String seatMetaSeparator;
  final String statsSeparator;
  final String labelValueSeparator;
  final String flagCodeSeparator;
  final String rankPartsSeparator;
  final String pageTitle;
  final String zoomHint;
  final String wldLabel;
  final String movesSuffix;
  final String playerUnavailable;
  final String friendsCountLabel;
  final String onlineNowLabel;
  final String offlineNowLabel;
  final String playingNowLabel;
  final String overviewTab;
  final String gamesTab;
  final String gameHistoryPlayersCol;
  final String gameHistoryResultCol;
  final String gameHistoryMovesCol;
  final String gameHistoryDateCol;
  final String friendsSectionTitle;
  final String joinedLabel;
  final String noFriends;
  final String emptyValue;
  final String listPageSize;
  final String hostRepFinishedLabel;
  final String hostRepCancelledLabel;
  final String hostRepReportsLabel;
  final String hostRepMetaSeparator;

  int get listPageSizeInt {
    final n = int.tryParse(listPageSize.trim());
    return (n != null && n > 0) ? n : 0;
  }

  bool get isReady =>
      source.isNotEmpty &&
      unavailable.isNotEmpty &&
      loadFailed.isNotEmpty &&
      pageTitle.isNotEmpty &&
      zoomHint.isNotEmpty &&
      wldLabel.isNotEmpty &&
      movesSuffix.isNotEmpty &&
      playerUnavailable.isNotEmpty &&
      friendsCountLabel.isNotEmpty &&
      onlineNowLabel.isNotEmpty &&
      offlineNowLabel.isNotEmpty &&
      playingNowLabel.isNotEmpty &&
      overviewTab.isNotEmpty &&
      gamesTab.isNotEmpty &&
      gameHistoryPlayersCol.isNotEmpty &&
      gameHistoryResultCol.isNotEmpty &&
      gameHistoryMovesCol.isNotEmpty &&
      gameHistoryDateCol.isNotEmpty &&
      friendsSectionTitle.isNotEmpty &&
      joinedLabel.isNotEmpty &&
      noFriends.isNotEmpty &&
      emptyValue.isNotEmpty &&
      listPageSizeInt > 0 &&
      recentMatchesTitle.isNotEmpty &&
      noMatches.isNotEmpty &&
      tournamentPlacementsTitle.isNotEmpty &&
      noPlacements.isNotEmpty &&
      outcomeDraw.isNotEmpty &&
      outcomeWin.isNotEmpty &&
      outcomeLoss.isNotEmpty &&
      freeSuffix.isNotEmpty &&
      labelRating.isNotEmpty &&
      labelXp.isNotEmpty &&
      labelWins.isNotEmpty &&
      labelLosses.isNotEmpty &&
      labelDraws.isNotEmpty &&
      labelCountry.isNotEmpty &&
      labelRegion.isNotEmpty &&
      labelRegionalRank.isNotEmpty &&
      topPrefix.isNotEmpty &&
      piecesLeftSuffix.isNotEmpty &&
      capturedSuffix.isNotEmpty &&
      seatMetaSeparator.isNotEmpty &&
      statsSeparator.isNotEmpty &&
      labelValueSeparator.isNotEmpty &&
      flagCodeSeparator.isNotEmpty &&
      rankPartsSeparator.isNotEmpty &&
      hostRepFinishedLabel.isNotEmpty &&
      hostRepCancelledLabel.isNotEmpty &&
      hostRepReportsLabel.isNotEmpty &&
      hostRepMetaSeparator.isNotEmpty;

  static ProfileInspectChrome? fromJson(Map<String, dynamic>? map) {
    if (map == null) return null;
    String raw(String k) => (map[k] as String?) ?? '';
    String s(String k) => raw(k).trim();
    final chrome = ProfileInspectChrome(
      source: s('source'),
      unavailable: s('profile_inspect_chrome_unavailable'),
      loadFailed: s('load_failed'),
      srDescription: s('sr_description'),
      inspectAction: s('inspect_action'),
      zoomTitle: s('zoom_title'),
      noAvatar: s('no_avatar'),
      avatarAltSuffix: s('avatar_alt_suffix'),
      labelRating: s('label_rating'),
      labelXp: s('label_xp'),
      labelLevel: s('label_level'),
      labelWins: s('label_wins'),
      labelLosses: s('label_losses'),
      labelDraws: s('label_draws'),
      labelCountry: s('label_country'),
      labelRegion: s('label_region'),
      labelRegionalRank: s('label_regional_rank'),
      topPrefix: s('top_prefix'),
      recentMatchesTitle: s('recent_matches_title'),
      noMatches: s('no_matches'),
      tournamentPlacementsTitle: s('tournament_placements_title'),
      noPlacements: s('no_placements'),
      outcomeDraw: s('outcome_draw'),
      outcomeWin: s('outcome_win'),
      outcomeLoss: s('outcome_loss'),
      freeSuffix: s('free_suffix'),
      piecesLeftSuffix: s('pieces_left_suffix'),
      capturedSuffix: s('captured_suffix'),
      seatMetaSeparator: raw('seat_meta_separator'),
      statsSeparator: raw('stats_separator'),
      labelValueSeparator: raw('label_value_separator'),
      flagCodeSeparator: raw('flag_code_separator'),
      rankPartsSeparator: raw('rank_parts_separator'),
      pageTitle: s('page_title'),
      zoomHint: s('zoom_hint'),
      wldLabel: s('wld_label'),
      movesSuffix: s('moves_suffix'),
      playerUnavailable: s('player_unavailable'),
      friendsCountLabel: s('friends_count_label'),
      onlineNowLabel: s('online_now_label'),
      offlineNowLabel: s('offline_now_label'),
      playingNowLabel: s('playing_now_label'),
      overviewTab: s('overview_tab'),
      gamesTab: s('games_tab'),
      gameHistoryPlayersCol: s('game_history_players_col'),
      gameHistoryResultCol: s('game_history_result_col'),
      gameHistoryMovesCol: s('game_history_moves_col'),
      gameHistoryDateCol: s('game_history_date_col'),
      friendsSectionTitle: s('friends_section_title'),
      joinedLabel: s('joined_label'),
      noFriends: s('no_friends'),
      emptyValue: s('empty_value'),
      listPageSize: s('list_page_size'),
      hostRepFinishedLabel: s('host_rep_finished_label'),
      hostRepCancelledLabel: s('host_rep_cancelled_label'),
      hostRepReportsLabel: s('host_rep_reports_label'),
      hostRepMetaSeparator: raw('host_rep_meta_separator'),
    );
    return chrome.isReady ? chrome : null;
  }
}
