/// DB-backed player tournaments chrome from GET /public/tournaments-player-chrome.
class TournamentsPlayerChrome {
  const TournamentsPlayerChrome({
    required this.source,
    required this.unavailable,
    required this.pageTitle,
    required this.pageBlurb,
    required this.empty,
    required this.emptyValue,
    required this.freeEntryPrefix,
    required this.enrollAction,
    required this.joinAction,
    required this.watchAction,
    required this.resultsAction,
    required this.lobbyAction,
    required this.joiningAction,
    required this.enrollFailed,
    required this.joinedFree,
    required this.filterAllLabel,
    required this.filterFreeLabel,
    required this.filterPaidLabel,
    required this.filterEntryLabel,
    required this.filterLifecycleLabel,
    required this.filterLifecycleOpenLabel,
    required this.filterLifecycleLiveLabel,
    required this.filterLifecycleFinishedLabel,
    required this.filterMineLabel,
    required this.emptyLifecycleOpen,
    required this.emptyLifecycleLive,
    required this.emptyLifecycleFinished,
    required this.emptyMine,
    required this.myTournamentsTitle,
    required this.myTournamentsEmpty,
    required this.myTournamentsOpenAction,
    required this.myTournamentsPlaceLabel,
    required this.myTournamentsPointsLabel,
    required this.myTournamentsStreakLabel,
    required this.myTournamentsPrizeLabel,
    this.filterSourceLabel = '',
    this.filterSourceAllLabel = '',
    this.filterSourceOfficialLabel = '',
    this.filterSourceCommunityLabel = '',
    this.badgeOfficialLabel = '',
    this.badgeCommunityLabel = '',
    this.hostTournamentAction = '',
    this.hostTournamentHref = '',
    this.hostTournamentBlurb = '',
    this.emptyCommunity = '',
    this.emptyOfficial = '',
    required this.searchLabel,
    required this.searchPlaceholder,
    required this.filtersToggleLabel,
    required this.filtersToggleShowAria,
    required this.filtersToggleHideAria,
    required this.searchDebounceMs,
    required this.enrolledChargedPrefix,
    required this.enrolledChargedClose,
    required this.enrolledBare,
    required this.loadFailed,
    required this.metaSeparator,
    required this.amountCurrencySeparator,
    required this.playersLabel,
    required this.unlimitedPlayersLabel,
    required this.prizeLabel,
    required this.entryLabel,
    required this.freeLabel,
    required this.carouselAria,
    required this.prizePoolNowLabel,
    required this.prizePoolIfFullLabel,
    required this.prizePoolGuaranteedLabel,
    required this.prizePoolFrozenBlurb,
    required this.prizePoolDisplayLabel,
    required this.prizePoolEntryFeesNote,
    required this.listPageSize,
    required this.lobbyTitle,
    required this.lobbyBlurb,
    required this.lobbyUnavailable,
    required this.lobbyRosterTitle,
    required this.lobbyBracketTitle,
    required this.lobbyStandingsTitle,
    required this.lobbyNextMatchTitle,
    required this.lobbyWaitingStart,
    required this.lobbyOpenPlayAction,
    required this.lobbySpectateAction,
    this.lobbyNoLiveBoards = '',
    required this.lobbyPollIntervalMs,
    required this.checkInAction,
    required this.checkInPending,
    required this.checkInDone,
    required this.checkInClosed,
    required this.checkInNotOpen,
    required this.checkInSuccess,
    this.checkInRequiredBlurb = '',
    required this.readyAction,
    required this.readyPending,
    required this.readyDone,
    required this.readyWaitingOpponent,
    required this.readySuccess,
    this.readyTimeoutBlurb = '',
    required this.formatLabel,
    required this.prizeSettledBlurb,
    required this.prizePendingBlurb,
    required this.disputeWindowBlurb,
    this.reportAction = '',
    this.reportTitle = '',
    this.reportReasonLabel = '',
    this.reportNoteLabel = '',
    this.reportSubmitAction = '',
    this.reportToastSent = '',
    this.reportToastFailed = '',
    this.cancelAction = '',
    this.standingsPlayedLabel = '',
    this.standingsWinsLabel = '',
    this.standingsLossesLabel = '',
    this.standingsPointsLabel = '',
    this.standingsTableMinWidth = '',
    this.groupLabelTemplate = '',
    this.arenaLobbyTitle = '',
    this.arenaLobbyBlurb = '',
    this.arenaQueueAction = '',
    this.arenaQueuePending = '',
    this.arenaQueueDone = '',
    this.arenaLeaveQueueAction = '',
    this.arenaLeaveQueuePending = '',
    this.arenaClockLabel = '',
    this.arenaPointsLabel = '',
    this.arenaStreakLabel = '',
    this.arenaStandingsTitle = '',
    this.arenaWaitingPair = '',
    this.arenaFinishedBlurb = '',
    this.arenaNotStartedBlurb = '',
    this.arenaLeftBlurb = '',
    this.toastPointsAwardedFmt = '',
    this.toastArenaQueueFailed = '',
    this.estPrizeShareLabel = '',
    this.estPrizeShareBlurb = '',
  });

  final String source;
  final String unavailable;
  final String pageTitle;
  final String pageBlurb;
  final String empty;
  final String emptyValue;
  final String freeEntryPrefix;
  final String enrollAction;
  final String joinAction;
  final String watchAction;
  final String resultsAction;
  final String lobbyAction;
  final String joiningAction;
  final String enrollFailed;
  final String joinedFree;
  final String filterAllLabel;
  final String filterFreeLabel;
  final String filterPaidLabel;
  final String filterEntryLabel;
  final String filterLifecycleLabel;
  final String filterLifecycleOpenLabel;
  final String filterLifecycleLiveLabel;
  final String filterLifecycleFinishedLabel;
  final String filterMineLabel;
  final String emptyLifecycleOpen;
  final String emptyLifecycleLive;
  final String emptyLifecycleFinished;
  final String emptyMine;
  final String myTournamentsTitle;
  final String myTournamentsEmpty;
  final String myTournamentsOpenAction;
  final String myTournamentsPlaceLabel;
  final String myTournamentsPointsLabel;
  final String myTournamentsStreakLabel;
  final String myTournamentsPrizeLabel;
  final String filterSourceLabel;
  final String filterSourceAllLabel;
  final String filterSourceOfficialLabel;
  final String filterSourceCommunityLabel;
  final String badgeOfficialLabel;
  final String badgeCommunityLabel;
  final String hostTournamentAction;
  final String hostTournamentHref;
  final String hostTournamentBlurb;
  final String emptyCommunity;
  final String emptyOfficial;
  final String searchLabel;
  final String searchPlaceholder;
  final String filtersToggleLabel;
  final String filtersToggleShowAria;
  final String filtersToggleHideAria;
  final String searchDebounceMs;
  final String enrolledChargedPrefix;
  final String enrolledChargedClose;
  final String enrolledBare;
  final String loadFailed;
  final String metaSeparator;
  final String amountCurrencySeparator;
  final String playersLabel;
  final String unlimitedPlayersLabel;
  final String prizeLabel;
  final String entryLabel;
  final String freeLabel;
  final String carouselAria;
  final String prizePoolNowLabel;
  final String prizePoolIfFullLabel;
  final String prizePoolGuaranteedLabel;
  final String prizePoolFrozenBlurb;
  final String prizePoolDisplayLabel;
  final String prizePoolEntryFeesNote;
  final String listPageSize;
  final String lobbyTitle;
  final String lobbyBlurb;
  final String lobbyUnavailable;
  final String lobbyRosterTitle;
  final String lobbyBracketTitle;
  final String lobbyStandingsTitle;
  final String lobbyNextMatchTitle;
  final String lobbyWaitingStart;
  final String lobbyOpenPlayAction;
  final String lobbySpectateAction;
  final String lobbyNoLiveBoards;
  final String lobbyPollIntervalMs;
  final String checkInAction;
  final String checkInPending;
  final String checkInDone;
  final String checkInClosed;
  final String checkInNotOpen;
  final String checkInSuccess;
  final String checkInRequiredBlurb;
  final String readyAction;
  final String readyPending;
  final String readyDone;
  final String readyWaitingOpponent;
  final String readySuccess;
  final String readyTimeoutBlurb;
  final String formatLabel;
  final String prizeSettledBlurb;
  final String prizePendingBlurb;
  final String disputeWindowBlurb;
  final String reportAction;
  final String reportTitle;
  final String reportReasonLabel;
  final String reportNoteLabel;
  final String reportSubmitAction;
  final String reportToastSent;
  final String reportToastFailed;
  final String cancelAction;
  final String standingsPlayedLabel;
  final String standingsWinsLabel;
  final String standingsLossesLabel;
  final String standingsPointsLabel;
  final String standingsTableMinWidth;
  final String groupLabelTemplate;
  final String arenaLobbyTitle;
  final String arenaLobbyBlurb;
  final String arenaQueueAction;
  final String arenaQueuePending;
  final String arenaQueueDone;
  final String arenaLeaveQueueAction;
  final String arenaLeaveQueuePending;
  final String arenaClockLabel;
  final String arenaPointsLabel;
  final String arenaStreakLabel;
  final String arenaStandingsTitle;
  final String arenaWaitingPair;
  final String arenaFinishedBlurb;
  final String arenaNotStartedBlurb;
  final String arenaLeftBlurb;
  final String toastPointsAwardedFmt;

  /// Official arena queue/leave API error (mig 396); optional - not in isReady.
  final String toastArenaQueueFailed;
  final String estPrizeShareLabel;
  final String estPrizeShareBlurb;

  bool get isArenaLobbyReady =>
      arenaLobbyTitle.isNotEmpty &&
      arenaLobbyBlurb.isNotEmpty &&
      arenaQueueAction.isNotEmpty &&
      arenaQueuePending.isNotEmpty &&
      arenaQueueDone.isNotEmpty &&
      arenaLeaveQueueAction.isNotEmpty &&
      arenaLeaveQueuePending.isNotEmpty &&
      arenaClockLabel.isNotEmpty &&
      arenaPointsLabel.isNotEmpty &&
      arenaStreakLabel.isNotEmpty &&
      arenaStandingsTitle.isNotEmpty &&
      arenaWaitingPair.isNotEmpty &&
      arenaFinishedBlurb.isNotEmpty &&
      arenaNotStartedBlurb.isNotEmpty &&
      arenaLeftBlurb.isNotEmpty &&
      estPrizeShareLabel.isNotEmpty &&
      estPrizeShareBlurb.isNotEmpty;

  bool cupLobbyReadyForFormat({required bool isArena}) =>
      isReady && (!isArena || isArenaLobbyReady);

  int get listPageSizeInt {
    final n = int.tryParse(listPageSize.trim());
    return n != null && n > 0 ? n : 0;
  }

  int get lobbyPollIntervalMsInt {
    final n = int.tryParse(lobbyPollIntervalMs.trim());
    return n != null && n > 0 ? n : 0;
  }

  bool get isReady =>
      source.isNotEmpty &&
      unavailable.isNotEmpty &&
      pageTitle.isNotEmpty &&
      pageBlurb.isNotEmpty &&
      empty.isNotEmpty &&
      emptyValue.isNotEmpty &&
      freeEntryPrefix.isNotEmpty &&
      enrollAction.isNotEmpty &&
      joinAction.isNotEmpty &&
      watchAction.isNotEmpty &&
      resultsAction.isNotEmpty &&
      lobbyAction.isNotEmpty &&
      joiningAction.isNotEmpty &&
      enrollFailed.isNotEmpty &&
      joinedFree.isNotEmpty &&
      filterAllLabel.isNotEmpty &&
      filterFreeLabel.isNotEmpty &&
      filterPaidLabel.isNotEmpty &&
      filterEntryLabel.isNotEmpty &&
      filterLifecycleLabel.isNotEmpty &&
      filterLifecycleOpenLabel.isNotEmpty &&
      filterLifecycleLiveLabel.isNotEmpty &&
      filterLifecycleFinishedLabel.isNotEmpty &&
      filterMineLabel.isNotEmpty &&
      emptyLifecycleOpen.isNotEmpty &&
      emptyLifecycleLive.isNotEmpty &&
      emptyLifecycleFinished.isNotEmpty &&
      emptyMine.isNotEmpty &&
      myTournamentsTitle.isNotEmpty &&
      myTournamentsEmpty.isNotEmpty &&
      myTournamentsOpenAction.isNotEmpty &&
      myTournamentsPlaceLabel.isNotEmpty &&
      myTournamentsPointsLabel.isNotEmpty &&
      myTournamentsStreakLabel.isNotEmpty &&
      myTournamentsPrizeLabel.isNotEmpty &&
      // Official | Community | All + Host CTA (mig 376+) - fail closed.
      filterSourceLabel.isNotEmpty &&
      filterSourceAllLabel.isNotEmpty &&
      filterSourceOfficialLabel.isNotEmpty &&
      filterSourceCommunityLabel.isNotEmpty &&
      badgeOfficialLabel.isNotEmpty &&
      badgeCommunityLabel.isNotEmpty &&
      hostTournamentAction.isNotEmpty &&
      hostTournamentHref.isNotEmpty &&
      hostTournamentBlurb.isNotEmpty &&
      emptyOfficial.isNotEmpty &&
      emptyCommunity.isNotEmpty &&
      searchLabel.isNotEmpty &&
      searchPlaceholder.isNotEmpty &&
      filtersToggleLabel.isNotEmpty &&
      filtersToggleShowAria.isNotEmpty &&
      filtersToggleHideAria.isNotEmpty &&
      searchDebounceMs.isNotEmpty &&
      enrolledChargedPrefix.isNotEmpty &&
      enrolledChargedClose.isNotEmpty &&
      enrolledBare.isNotEmpty &&
      loadFailed.isNotEmpty &&
      metaSeparator.isNotEmpty &&
      amountCurrencySeparator.isNotEmpty &&
      playersLabel.isNotEmpty &&
      unlimitedPlayersLabel.isNotEmpty &&
      prizeLabel.isNotEmpty &&
      entryLabel.isNotEmpty &&
      freeLabel.isNotEmpty &&
      carouselAria.isNotEmpty &&
      prizePoolNowLabel.isNotEmpty &&
      prizePoolIfFullLabel.isNotEmpty &&
      prizePoolGuaranteedLabel.isNotEmpty &&
      prizePoolFrozenBlurb.isNotEmpty &&
      prizePoolDisplayLabel.isNotEmpty &&
      prizePoolEntryFeesNote.isNotEmpty &&
      listPageSizeInt > 0 &&
      lobbyTitle.isNotEmpty &&
      lobbyBlurb.isNotEmpty &&
      lobbyUnavailable.isNotEmpty &&
      lobbyRosterTitle.isNotEmpty &&
      lobbyBracketTitle.isNotEmpty &&
      lobbyStandingsTitle.isNotEmpty &&
      lobbyNextMatchTitle.isNotEmpty &&
      lobbyWaitingStart.isNotEmpty &&
      lobbyOpenPlayAction.isNotEmpty &&
      lobbySpectateAction.isNotEmpty &&
      lobbyPollIntervalMsInt > 0 &&
      checkInAction.isNotEmpty &&
      checkInPending.isNotEmpty &&
      checkInDone.isNotEmpty &&
      checkInClosed.isNotEmpty &&
      checkInNotOpen.isNotEmpty &&
      checkInSuccess.isNotEmpty &&
      readyAction.isNotEmpty &&
      readyPending.isNotEmpty &&
      readyDone.isNotEmpty &&
      readyWaitingOpponent.isNotEmpty &&
      readySuccess.isNotEmpty &&
      formatLabel.isNotEmpty &&
      prizeSettledBlurb.isNotEmpty &&
      prizePendingBlurb.isNotEmpty &&
      disputeWindowBlurb.isNotEmpty &&
      estPrizeShareLabel.isNotEmpty &&
      estPrizeShareBlurb.isNotEmpty;

  bool get isReportReady =>
      reportAction.isNotEmpty &&
      reportTitle.isNotEmpty &&
      reportReasonLabel.isNotEmpty &&
      reportNoteLabel.isNotEmpty &&
      reportSubmitAction.isNotEmpty &&
      reportToastSent.isNotEmpty &&
      reportToastFailed.isNotEmpty &&
      cancelAction.isNotEmpty;

  static TournamentsPlayerChrome? fromJson(Map<String, dynamic>? map) {
    if (map == null) return null;
    String raw(String k) => (map[k] as String?) ?? '';
    String s(String k) => raw(k).trim();
    final chrome = TournamentsPlayerChrome(
      source: s('source'),
      unavailable: s('tournaments_player_chrome_unavailable'),
      pageTitle: s('page_title'),
      pageBlurb: s('page_blurb'),
      empty: s('empty'),
      emptyValue: s('empty_value'),
      freeEntryPrefix: s('free_entry_prefix'),
      enrollAction: s('enroll_action'),
      joinAction: s('join_action'),
      watchAction: s('watch_action'),
      resultsAction: s('results_action'),
      lobbyAction: s('lobby_action'),
      joiningAction: s('joining_action'),
      enrollFailed: s('enroll_failed'),
      joinedFree: s('joined_free'),
      filterAllLabel: s('filter_all_label'),
      filterFreeLabel: s('filter_free_label'),
      filterPaidLabel: s('filter_paid_label'),
      filterEntryLabel: s('filter_entry_label'),
      filterLifecycleLabel: s('filter_lifecycle_label'),
      filterLifecycleOpenLabel: s('filter_lifecycle_open_label'),
      filterLifecycleLiveLabel: s('filter_lifecycle_live_label'),
      filterLifecycleFinishedLabel: s('filter_lifecycle_finished_label'),
      filterMineLabel: s('filter_mine_label'),
      emptyLifecycleOpen: s('empty_lifecycle_open'),
      emptyLifecycleLive: s('empty_lifecycle_live'),
      emptyLifecycleFinished: s('empty_lifecycle_finished'),
      emptyMine: s('empty_mine'),
      myTournamentsTitle: s('my_tournaments_title'),
      myTournamentsEmpty: s('my_tournaments_empty'),
      myTournamentsOpenAction: s('my_tournaments_open_action'),
      myTournamentsPlaceLabel: s('my_tournaments_place_label'),
      myTournamentsPointsLabel: s('my_tournaments_points_label'),
      myTournamentsStreakLabel: s('my_tournaments_streak_label'),
      myTournamentsPrizeLabel: s('my_tournaments_prize_label'),
      filterSourceLabel: s('filter_source_label'),
      filterSourceAllLabel: s('filter_source_all_label'),
      filterSourceOfficialLabel: s('filter_source_official_label'),
      filterSourceCommunityLabel: s('filter_source_community_label'),
      badgeOfficialLabel: s('badge_official_label'),
      badgeCommunityLabel: s('badge_community_label'),
      hostTournamentAction: s('host_tournament_action'),
      hostTournamentHref: s('host_tournament_href'),
      hostTournamentBlurb: s('host_tournament_blurb'),
      emptyCommunity: s('empty_community'),
      emptyOfficial: s('empty_official'),
      searchLabel: s('search_label'),
      searchPlaceholder: s('search_placeholder'),
      filtersToggleLabel: s('filters_toggle_label'),
      filtersToggleShowAria: s('filters_toggle_show_aria'),
      filtersToggleHideAria: s('filters_toggle_hide_aria'),
      searchDebounceMs: s('search_debounce_ms'),
      enrolledChargedPrefix: s('enrolled_charged_prefix'),
      enrolledChargedClose: s('enrolled_charged_close'),
      enrolledBare: s('enrolled_bare'),
      loadFailed: s('load_failed'),
      metaSeparator: raw('meta_separator'),
      amountCurrencySeparator: raw('amount_currency_separator'),
      playersLabel: s('players_label'),
      unlimitedPlayersLabel: s('unlimited_players_label'),
      prizeLabel: s('prize_label'),
      entryLabel: s('entry_label'),
      freeLabel: s('free_label'),
      carouselAria: s('carousel_aria'),
      prizePoolNowLabel: s('prize_pool_now_label'),
      prizePoolIfFullLabel: s('prize_pool_if_full_label'),
      prizePoolGuaranteedLabel: s('prize_pool_guaranteed_label'),
      prizePoolFrozenBlurb: s('prize_pool_frozen_blurb'),
      prizePoolDisplayLabel: s('prize_pool_display_label'),
      prizePoolEntryFeesNote: s('prize_pool_entry_fees_note'),
      listPageSize: s('list_page_size'),
      lobbyTitle: s('lobby_title'),
      lobbyBlurb: s('lobby_blurb'),
      lobbyUnavailable: s('lobby_unavailable'),
      lobbyRosterTitle: s('lobby_roster_title'),
      lobbyBracketTitle: s('lobby_bracket_title'),
      lobbyStandingsTitle: s('lobby_standings_title'),
      lobbyNextMatchTitle: s('lobby_next_match_title'),
      lobbyWaitingStart: s('lobby_waiting_start'),
      lobbyOpenPlayAction: s('lobby_open_play_action'),
      lobbySpectateAction: s('lobby_spectate_action'),
      lobbyNoLiveBoards: s('lobby_no_live_boards'),
      lobbyPollIntervalMs: s('lobby_poll_interval_ms'),
      checkInAction: s('check_in_action'),
      checkInPending: s('check_in_pending'),
      checkInDone: s('check_in_done'),
      checkInClosed: s('check_in_closed'),
      checkInNotOpen: s('check_in_not_open'),
      checkInSuccess: s('check_in_success'),
      checkInRequiredBlurb: s('check_in_required_blurb'),
      readyAction: s('ready_action'),
      readyPending: s('ready_pending'),
      readyDone: s('ready_done'),
      readyWaitingOpponent: s('ready_waiting_opponent'),
      readySuccess: s('ready_success'),
      readyTimeoutBlurb: s('ready_timeout_blurb'),
      formatLabel: s('format_label'),
      prizeSettledBlurb: s('prize_settled_blurb'),
      prizePendingBlurb: s('prize_pending_blurb'),
      disputeWindowBlurb: s('dispute_window_blurb'),
      reportAction: s('report_action'),
      reportTitle: s('report_title'),
      reportReasonLabel: s('report_reason_label'),
      reportNoteLabel: s('report_note_label'),
      reportSubmitAction: s('report_submit_action'),
      reportToastSent: s('report_toast_sent'),
      reportToastFailed: s('report_toast_failed'),
      cancelAction: s('cancel_action'),
      standingsPlayedLabel: s('standings_played_label'),
      standingsWinsLabel: s('standings_wins_label'),
      standingsLossesLabel: s('standings_losses_label'),
      standingsPointsLabel: s('standings_points_label'),
      standingsTableMinWidth: s('standings_table_min_width'),
      groupLabelTemplate: s('group_label_template'),
      arenaLobbyTitle: s('arena_lobby_title'),
      arenaLobbyBlurb: s('arena_lobby_blurb'),
      arenaQueueAction: s('arena_queue_action'),
      arenaQueuePending: s('arena_queue_pending'),
      arenaQueueDone: s('arena_queue_done'),
      arenaLeaveQueueAction: s('arena_leave_queue_action'),
      arenaLeaveQueuePending: s('arena_leave_queue_pending'),
      arenaClockLabel: s('arena_clock_label'),
      arenaPointsLabel: s('arena_points_label'),
      arenaStreakLabel: s('arena_streak_label'),
      arenaStandingsTitle: s('arena_standings_title'),
      arenaWaitingPair: s('arena_waiting_pair'),
      arenaFinishedBlurb: s('arena_finished_blurb'),
      arenaNotStartedBlurb: s('arena_not_started_blurb'),
      arenaLeftBlurb: s('arena_left_blurb'),
      toastPointsAwardedFmt: s('toast_points_awarded_fmt').trim(),
      toastArenaQueueFailed: s('toast_arena_queue_failed').trim(),
      estPrizeShareLabel: s('est_prize_share_label'),
      estPrizeShareBlurb: s('est_prize_share_blurb'),
    );
    return chrome.isReady ? chrome : null;
  }
}
