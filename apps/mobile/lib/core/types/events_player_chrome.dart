/// DB-backed player chrome from GET /public/events-player-chrome.
class EventsPlayerChrome {
  const EventsPlayerChrome({
    required this.source,
    required this.unavailable,
    required this.pageTitle,
    required this.pageBlurb,
    required this.filtersToggleLabel,
    required this.filtersToggleShowAria,
    required this.filtersToggleHideAria,
    required this.searchDebounceMs,
    required this.hostedByLabel,
    required this.carouselAria,
    required this.freeLabel,
    required this.playersLabel,
    required this.unlimitedPlayersLabel,
    required this.entryLabel,
    required this.viewAction,
    required this.shareAction,
    required this.copiedBlurb,
    required this.toastCopyFailed,
    required this.detailJoinAction,
    required this.joinCodeSectionTitle,
    required this.joinCodeSectionBlurb,
    required this.rosterTitle,
    required this.formatLabel,
    required this.sizeLabel,
    required this.emptyWeb,
    required this.detailUnavailable,
    required this.joinTitle,
    required this.joinBlurb,
    required this.codeLabel,
    required this.codePlaceholder,
    required this.joinAction,
    required this.watchAction,
    required this.resultsAction,
    required this.lobbyAction,
    required this.eventFull,
    required this.eventNotJoinable,
    required this.alreadyJoined,
    required this.pendingApproval,
    required this.approvedBlurb,
    required this.rejectedBlurb,
    required this.kickedBlurb,
    required this.spectateAction,
    required this.bracketTitle,
    required this.winnersTitle,
    required this.shareResultAction,
    this.standingsTitle = '',
    this.standingsPlayedLabel = '',
    this.standingsWinsLabel = '',
    this.standingsLossesLabel = '',
    this.standingsPointsLabel = '',
    this.groupLabelTemplate = '',
    this.swissRoundLabelTemplate = '',
    this.phaseGroupLabel = '',
    this.phaseKnockoutLabel = '',
    this.phaseSwissLabel = '',
    this.phaseRoundRobinLabel = '',
    this.resultCardShareImageAction = '',
    this.resultCardDownloadAction = '',
    this.resultCardFilename = '',
    this.resultCardImageFailed = '',
    this.resultCardSponsorPrefix = '',
    this.resultCardBgColor = '',
    this.resultCardFgColor = '',
    this.resultCardMutedColor = '',
    this.resultCardRowWashColor = '',
    this.resultCardTitleFont = '',
    this.resultCardWinnersFont = '',
    this.resultCardSponsorFont = '',
    this.resultCardPlacementFont = '',
    this.resultCardNameFont = '',
    this.resultCardHeaderWashAlpha = '',
    this.resultCardWidth = '',
    this.resultCardRowHeight = '',
    this.resultCardHeaderHeight = '',
    this.resultCardSponsorHeight = '',
    this.resultCardPlacementsMax = '',
    this.resultCardRowRadius = '',
    this.resultCardPad = '',
    this.resultCardLogoSize = '',
    this.resultCardTitleY = '',
    this.resultCardWinnersY = '',
    this.resultCardBodyGap = '',
    this.resultCardRowsTopGap = '',
    this.resultCardBottomPad = '',
    this.resultCardRowInset = '',
    this.resultCardRowInnerGap = '',
    this.resultCardPlacementX = '',
    this.resultCardNameX = '',
    this.resultCardRowTextY = '',
    this.resultCardSponsorLogoW = '',
    this.resultCardSponsorLogoH = '',
    this.resultCardSponsorLogoGap = '',
    this.resultCardLogoTextGap = '',
    this.dialogShellMaxHeightRatio = '',
    this.dialogShellMaxWidth = '',
    this.dialogShellInsetH = '',
    this.dialogShellInsetV = '',
    this.dialogShellLoadingHeight = '',
    this.brandingPreviewHeight = '',
    this.brandingPreviewMaxWidth = '',
    this.dialogScrollMaxHeight = '',
    this.panelMaxWidth = '',
    this.browseMaxWidth = '',
    this.standingsTableMinWidth = '',
    this.pageCardPad = '',
    this.pageCardGap = '',
    required this.featureDisabled,
    required this.publicDisabled,
    required this.insufficientEntryFee,
    required this.topUpAction,
    required this.topUpHref,
    required this.listPageSize,
    required this.emptyValue,
    required this.playersCountSuffix,
    required this.amountCurrencySeparator,
    required this.metaSeparator,
    required this.bracketByeLabel,
    required this.bracketVsLabel,
    required this.bracketEmptySeat,
    required this.reportAction,
    required this.reportTitle,
    required this.reportReasonLabel,
    required this.reportNoteLabel,
    required this.reportSubmitAction,
    required this.reportToastSent,
    required this.reportToastFailed,
    required this.publicListTitle,
    required this.publicListBlurb,
    required this.publicListEmpty,
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
    required this.searchLabel,
    required this.searchPlaceholder,
    required this.visibilityPrivateBlurb,
    required this.visibilityPublicBlurb,
    required this.publicRatedOnBlurb,
    required this.publicRatedOffBlurb,
    required this.entryFeePayBlurb,
    required this.loadFailed,
    required this.dialogCloseLabel,
    required this.cancelAction,
    required this.prizePoolNowLabel,
    required this.prizePoolIfFullLabel,
    required this.prizePoolGuaranteedLabel,
    required this.prizePoolFrozenBlurb,
    required this.prizePoolEntryFeesNote,
    this.hostRepFinishedLabel = '',
    this.hostRepCancelledLabel = '',
    this.hostRepReportsLabel = '',
    this.hostRepMetaSeparator = '',
    required this.lobbyTitle,
    required this.lobbyBlurb,
    required this.lobbyUnavailable,
    required this.lobbyRosterTitle,
    required this.lobbyBracketTitle,
    required this.lobbyStandingsTitle,
    required this.lobbyNextMatchTitle,
    required this.lobbyWaitingStart,
    required this.lobbyOpenPlayAction,
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
    required this.prizeSettledBlurb,
    required this.prizePendingBlurb,
    required this.disputeWindowBlurb,
    this.errCodeRequired = '',
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
    this.detailDescriptionLabel = '',
  });

  final String source;
  final String unavailable;
  final String pageTitle;
  final String pageBlurb;
  final String filtersToggleLabel;
  final String filtersToggleShowAria;
  final String filtersToggleHideAria;
  final String searchDebounceMs;
  final String hostedByLabel;
  final String carouselAria;
  final String freeLabel;
  final String playersLabel;
  final String unlimitedPlayersLabel;
  final String entryLabel;
  final String viewAction;
  final String shareAction;
  final String copiedBlurb;
  final String toastCopyFailed;
  final String detailJoinAction;
  final String joinCodeSectionTitle;
  final String joinCodeSectionBlurb;
  final String rosterTitle;
  final String formatLabel;
  final String sizeLabel;
  final String emptyWeb;
  final String detailUnavailable;
  final String joinTitle;
  final String joinBlurb;
  final String codeLabel;
  final String codePlaceholder;
  final String joinAction;
  final String watchAction;
  final String resultsAction;
  final String lobbyAction;
  final String eventFull;
  final String eventNotJoinable;
  final String alreadyJoined;
  final String pendingApproval;
  final String approvedBlurb;
  final String rejectedBlurb;
  final String kickedBlurb;
  final String spectateAction;
  final String bracketTitle;
  final String winnersTitle;
  final String shareResultAction;
  final String standingsTitle;
  final String standingsPlayedLabel;
  final String standingsWinsLabel;
  final String standingsLossesLabel;
  final String standingsPointsLabel;
  final String groupLabelTemplate;
  final String swissRoundLabelTemplate;
  final String phaseGroupLabel;
  final String phaseKnockoutLabel;
  final String phaseSwissLabel;
  final String phaseRoundRobinLabel;
  final String resultCardShareImageAction;
  final String resultCardDownloadAction;
  final String resultCardFilename;
  final String resultCardImageFailed;
  final String resultCardSponsorPrefix;
  final String resultCardBgColor;
  final String resultCardFgColor;
  final String resultCardMutedColor;
  final String resultCardRowWashColor;
  final String resultCardTitleFont;
  final String resultCardWinnersFont;
  final String resultCardSponsorFont;
  final String resultCardPlacementFont;
  final String resultCardNameFont;
  final String resultCardHeaderWashAlpha;
  final String resultCardWidth;
  final String resultCardRowHeight;
  final String resultCardHeaderHeight;
  final String resultCardSponsorHeight;
  final String resultCardPlacementsMax;
  final String resultCardRowRadius;
  final String resultCardPad;
  final String resultCardLogoSize;
  final String resultCardTitleY;
  final String resultCardWinnersY;
  final String resultCardBodyGap;
  final String resultCardRowsTopGap;
  final String resultCardBottomPad;
  final String resultCardRowInset;
  final String resultCardRowInnerGap;
  final String resultCardPlacementX;
  final String resultCardNameX;
  final String resultCardRowTextY;
  final String resultCardSponsorLogoW;
  final String resultCardSponsorLogoH;
  final String resultCardSponsorLogoGap;
  final String resultCardLogoTextGap;
  final String dialogShellMaxHeightRatio;
  final String dialogShellMaxWidth;
  final String dialogShellInsetH;
  final String dialogShellInsetV;
  final String dialogShellLoadingHeight;
  final String brandingPreviewHeight;
  final String brandingPreviewMaxWidth;
  final String dialogScrollMaxHeight;
  final String panelMaxWidth;
  final String browseMaxWidth;
  final String standingsTableMinWidth;
  final String pageCardPad;
  final String pageCardGap;
  final String featureDisabled;
  final String publicDisabled;
  final String insufficientEntryFee;
  final String topUpAction;
  final String topUpHref;
  final String listPageSize;
  final String emptyValue;
  final String playersCountSuffix;
  final String amountCurrencySeparator;
  final String metaSeparator;

  int get listPageSizeInt {
    final n = int.tryParse(listPageSize.trim());
    return n != null && n > 0 ? n : 0;
  }

  final String bracketByeLabel;
  final String bracketVsLabel;
  final String bracketEmptySeat;
  final String reportAction;
  final String reportTitle;
  final String reportReasonLabel;
  final String reportNoteLabel;
  final String reportSubmitAction;
  final String reportToastSent;
  final String reportToastFailed;
  final String publicListTitle;
  final String publicListBlurb;
  final String publicListEmpty;
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
  final String searchLabel;
  final String searchPlaceholder;
  final String visibilityPrivateBlurb;
  final String visibilityPublicBlurb;
  final String publicRatedOnBlurb;
  final String publicRatedOffBlurb;
  final String entryFeePayBlurb;
  final String loadFailed;
  final String dialogCloseLabel;
  final String cancelAction;
  final String prizePoolNowLabel;
  final String prizePoolIfFullLabel;
  final String prizePoolGuaranteedLabel;
  final String prizePoolFrozenBlurb;
  final String hostRepFinishedLabel;
  final String hostRepCancelledLabel;
  final String hostRepReportsLabel;
  final String hostRepMetaSeparator;
  final String prizePoolEntryFeesNote;
  final String lobbyTitle;
  final String lobbyBlurb;
  final String lobbyUnavailable;
  final String lobbyRosterTitle;
  final String lobbyBracketTitle;
  final String lobbyStandingsTitle;
  final String lobbyNextMatchTitle;
  final String lobbyWaitingStart;
  final String lobbyOpenPlayAction;
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
  final String prizeSettledBlurb;
  final String prizePendingBlurb;
  final String disputeWindowBlurb;
  final String errCodeRequired;
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

  /// Community arena queue/leave API error (mig 395); optional - not in isReady.
  final String toastArenaQueueFailed;
  final String estPrizeShareLabel;
  final String estPrizeShareBlurb;
  final String detailDescriptionLabel;

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
      isCupLobbyReady && (!isArena || isArenaLobbyReady);

  int get lobbyPollIntervalMsInt {
    final n = int.tryParse(lobbyPollIntervalMs.trim());
    return n != null && n > 0 ? n : 0;
  }

  /// Fail closed for event cup lobby sheet (subset of player chrome).
  bool get isCupLobbyReady =>
      lobbyTitle.isNotEmpty &&
      lobbyBlurb.isNotEmpty &&
      lobbyUnavailable.isNotEmpty &&
      lobbyRosterTitle.isNotEmpty &&
      lobbyBracketTitle.isNotEmpty &&
      lobbyNextMatchTitle.isNotEmpty &&
      lobbyWaitingStart.isNotEmpty &&
      lobbyOpenPlayAction.isNotEmpty &&
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
      emptyValue.isNotEmpty &&
      metaSeparator.isNotEmpty &&
      loadFailed.isNotEmpty &&
      estPrizeShareLabel.isNotEmpty &&
      estPrizeShareBlurb.isNotEmpty;

  /// Fail closed for cup lobby report CTA (tournament lobby parity).
  bool get isReportReady =>
      reportAction.isNotEmpty &&
      reportTitle.isNotEmpty &&
      reportReasonLabel.isNotEmpty &&
      reportNoteLabel.isNotEmpty &&
      reportSubmitAction.isNotEmpty &&
      reportToastSent.isNotEmpty &&
      reportToastFailed.isNotEmpty &&
      cancelAction.isNotEmpty;

  bool get isReady =>
      source.isNotEmpty &&
      unavailable.isNotEmpty &&
      pageTitle.isNotEmpty &&
      pageBlurb.isNotEmpty &&
      filtersToggleLabel.isNotEmpty &&
      filtersToggleShowAria.isNotEmpty &&
      filtersToggleHideAria.isNotEmpty &&
      searchDebounceMs.isNotEmpty &&
      hostedByLabel.isNotEmpty &&
      carouselAria.isNotEmpty &&
      freeLabel.isNotEmpty &&
      playersLabel.isNotEmpty &&
      unlimitedPlayersLabel.isNotEmpty &&
      entryLabel.isNotEmpty &&
      viewAction.isNotEmpty &&
      shareAction.isNotEmpty &&
      // copiedBlurb / toastCopyFailed optional until migration 299; Share still copies.
      detailJoinAction.isNotEmpty &&
      joinCodeSectionTitle.isNotEmpty &&
      joinCodeSectionBlurb.isNotEmpty &&
      rosterTitle.isNotEmpty &&
      formatLabel.isNotEmpty &&
      sizeLabel.isNotEmpty &&
      emptyWeb.isNotEmpty &&
      detailUnavailable.isNotEmpty &&
      joinTitle.isNotEmpty &&
      joinBlurb.isNotEmpty &&
      codeLabel.isNotEmpty &&
      codePlaceholder.isNotEmpty &&
      joinAction.isNotEmpty &&
      watchAction.isNotEmpty &&
      resultsAction.isNotEmpty &&
      lobbyAction.isNotEmpty &&
      eventFull.isNotEmpty &&
      eventNotJoinable.isNotEmpty &&
      alreadyJoined.isNotEmpty &&
      pendingApproval.isNotEmpty &&
      approvedBlurb.isNotEmpty &&
      rejectedBlurb.isNotEmpty &&
      kickedBlurb.isNotEmpty &&
      spectateAction.isNotEmpty &&
      featureDisabled.isNotEmpty &&
      publicDisabled.isNotEmpty &&
      loadFailed.isNotEmpty &&
      insufficientEntryFee.isNotEmpty &&
      topUpAction.isNotEmpty &&
      topUpHref.isNotEmpty &&
      listPageSizeInt > 0 &&
      emptyValue.isNotEmpty &&
      playersCountSuffix.isNotEmpty &&
      amountCurrencySeparator.isNotEmpty &&
      metaSeparator.isNotEmpty &&
      bracketByeLabel.isNotEmpty &&
      bracketVsLabel.isNotEmpty &&
      bracketEmptySeat.isNotEmpty &&
      reportAction.isNotEmpty &&
      reportTitle.isNotEmpty &&
      reportReasonLabel.isNotEmpty &&
      reportNoteLabel.isNotEmpty &&
      reportSubmitAction.isNotEmpty &&
      reportToastSent.isNotEmpty &&
      reportToastFailed.isNotEmpty &&
      publicListTitle.isNotEmpty &&
      publicListBlurb.isNotEmpty &&
      publicListEmpty.isNotEmpty &&
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
      searchLabel.isNotEmpty &&
      searchPlaceholder.isNotEmpty &&
      visibilityPrivateBlurb.isNotEmpty &&
      visibilityPublicBlurb.isNotEmpty &&
      publicRatedOnBlurb.isNotEmpty &&
      publicRatedOffBlurb.isNotEmpty &&
      entryFeePayBlurb.isNotEmpty &&
      dialogCloseLabel.isNotEmpty &&
      cancelAction.isNotEmpty &&
      bracketTitle.isNotEmpty &&
      winnersTitle.isNotEmpty &&
      shareResultAction.isNotEmpty &&
      standingsTitle.isNotEmpty &&
      standingsPlayedLabel.isNotEmpty &&
      standingsWinsLabel.isNotEmpty &&
      standingsLossesLabel.isNotEmpty &&
      standingsPointsLabel.isNotEmpty &&
      groupLabelTemplate.isNotEmpty &&
      swissRoundLabelTemplate.isNotEmpty &&
      phaseGroupLabel.isNotEmpty &&
      phaseKnockoutLabel.isNotEmpty &&
      phaseSwissLabel.isNotEmpty &&
      phaseRoundRobinLabel.isNotEmpty &&
      resultCardShareImageAction.isNotEmpty &&
      resultCardDownloadAction.isNotEmpty &&
      resultCardFilename.isNotEmpty &&
      resultCardImageFailed.isNotEmpty &&
      resultCardSponsorPrefix.isNotEmpty &&
      resultCardBgColor.isNotEmpty &&
      resultCardFgColor.isNotEmpty &&
      resultCardMutedColor.isNotEmpty &&
      resultCardRowWashColor.isNotEmpty &&
      resultCardTitleFont.isNotEmpty &&
      resultCardWinnersFont.isNotEmpty &&
      resultCardSponsorFont.isNotEmpty &&
      resultCardPlacementFont.isNotEmpty &&
      resultCardNameFont.isNotEmpty &&
      resultCardHeaderWashAlpha.isNotEmpty &&
      resultCardWidth.isNotEmpty &&
      resultCardRowHeight.isNotEmpty &&
      resultCardHeaderHeight.isNotEmpty &&
      resultCardSponsorHeight.isNotEmpty &&
      resultCardPlacementsMax.isNotEmpty &&
      resultCardRowRadius.isNotEmpty &&
      resultCardPad.isNotEmpty &&
      resultCardLogoSize.isNotEmpty &&
      resultCardTitleY.isNotEmpty &&
      resultCardWinnersY.isNotEmpty &&
      resultCardBodyGap.isNotEmpty &&
      resultCardRowsTopGap.isNotEmpty &&
      resultCardBottomPad.isNotEmpty &&
      resultCardRowInset.isNotEmpty &&
      resultCardRowInnerGap.isNotEmpty &&
      resultCardPlacementX.isNotEmpty &&
      resultCardNameX.isNotEmpty &&
      resultCardRowTextY.isNotEmpty &&
      resultCardSponsorLogoW.isNotEmpty &&
      resultCardSponsorLogoH.isNotEmpty &&
      resultCardSponsorLogoGap.isNotEmpty &&
      resultCardLogoTextGap.isNotEmpty &&
      dialogShellMaxHeightRatio.isNotEmpty &&
      dialogShellMaxWidth.isNotEmpty &&
      dialogShellInsetH.isNotEmpty &&
      dialogShellInsetV.isNotEmpty &&
      dialogShellLoadingHeight.isNotEmpty &&
      brandingPreviewHeight.isNotEmpty &&
      brandingPreviewMaxWidth.isNotEmpty &&
      dialogScrollMaxHeight.isNotEmpty &&
      panelMaxWidth.isNotEmpty &&
      browseMaxWidth.isNotEmpty &&
      standingsTableMinWidth.isNotEmpty &&
      pageCardPad.isNotEmpty &&
      pageCardGap.isNotEmpty &&
      prizePoolNowLabel.isNotEmpty &&
      prizePoolIfFullLabel.isNotEmpty &&
      prizePoolGuaranteedLabel.isNotEmpty &&
      prizePoolFrozenBlurb.isNotEmpty &&
      prizePoolEntryFeesNote.isNotEmpty &&
      lobbyTitle.isNotEmpty &&
      lobbyBlurb.isNotEmpty &&
      lobbyUnavailable.isNotEmpty &&
      lobbyRosterTitle.isNotEmpty &&
      lobbyBracketTitle.isNotEmpty &&
      lobbyStandingsTitle.isNotEmpty &&
      lobbyNextMatchTitle.isNotEmpty &&
      lobbyWaitingStart.isNotEmpty &&
      lobbyOpenPlayAction.isNotEmpty &&
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
      prizeSettledBlurb.isNotEmpty &&
      prizePendingBlurb.isNotEmpty &&
      disputeWindowBlurb.isNotEmpty &&
      hostRepFinishedLabel.isNotEmpty &&
      hostRepCancelledLabel.isNotEmpty &&
      hostRepReportsLabel.isNotEmpty &&
      hostRepMetaSeparator.isNotEmpty &&
      detailDescriptionLabel.isNotEmpty;

  static EventsPlayerChrome? fromJson(Map<String, dynamic>? map) {
    if (map == null) return null;
    String s(String k) => ((map[k] as String?) ?? '').trim();
    final chrome = EventsPlayerChrome(
      source: s('source'),
      unavailable: s('events_player_chrome_unavailable'),
      pageTitle: s('page_title'),
      pageBlurb: s('page_blurb'),
      filtersToggleLabel: s('filters_toggle_label'),
      filtersToggleShowAria: s('filters_toggle_show_aria'),
      filtersToggleHideAria: s('filters_toggle_hide_aria'),
      searchDebounceMs: s('search_debounce_ms'),
      hostedByLabel: s('hosted_by_label'),
      carouselAria: s('carousel_aria'),
      freeLabel: s('free_label'),
      playersLabel: s('players_label'),
      unlimitedPlayersLabel: s('unlimited_players_label'),
      entryLabel: s('entry_label'),
      viewAction: s('view_action'),
      shareAction: s('share_action'),
      copiedBlurb: s('copied_blurb'),
      toastCopyFailed: s('toast_copy_failed'),
      detailJoinAction: s('detail_join_action'),
      joinCodeSectionTitle: s('join_code_section_title'),
      joinCodeSectionBlurb: s('join_code_section_blurb'),
      rosterTitle: s('roster_title'),
      formatLabel: s('format_label'),
      sizeLabel: s('size_label'),
      emptyWeb: s('empty_web'),
      detailUnavailable: s('detail_unavailable'),
      joinTitle: s('join_title'),
      joinBlurb: s('join_blurb'),
      codeLabel: s('code_label'),
      codePlaceholder: s('code_placeholder'),
      joinAction: s('join_action'),
      watchAction: s('watch_action'),
      resultsAction: s('results_action'),
      lobbyAction: s('lobby_action'),
      eventFull: s('event_full'),
      eventNotJoinable: s('event_not_joinable'),
      alreadyJoined: s('already_joined'),
      pendingApproval: s('pending_approval'),
      approvedBlurb: s('approved_blurb'),
      rejectedBlurb: s('rejected_blurb'),
      kickedBlurb: s('kicked_blurb'),
      spectateAction: s('spectate_action'),
      bracketTitle: s('bracket_title'),
      winnersTitle: s('winners_title'),
      shareResultAction: s('share_result_action'),
      standingsTitle: s('standings_title'),
      standingsPlayedLabel: s('standings_played_label'),
      standingsWinsLabel: s('standings_wins_label'),
      standingsLossesLabel: s('standings_losses_label'),
      standingsPointsLabel: s('standings_points_label'),
      groupLabelTemplate: s('group_label_template'),
      swissRoundLabelTemplate: s('swiss_round_label_template'),
      phaseGroupLabel: s('phase_group_label'),
      phaseKnockoutLabel: s('phase_knockout_label'),
      phaseSwissLabel: s('phase_swiss_label'),
      phaseRoundRobinLabel: s('phase_round_robin_label'),
      resultCardShareImageAction: s('result_card_share_image_action'),
      resultCardDownloadAction: s('result_card_download_action'),
      resultCardFilename: s('result_card_filename'),
      resultCardImageFailed: s('result_card_image_failed'),
      resultCardSponsorPrefix: s('result_card_sponsor_prefix'),
      resultCardBgColor: s('result_card_bg_color'),
      resultCardFgColor: s('result_card_fg_color'),
      resultCardMutedColor: s('result_card_muted_color'),
      resultCardRowWashColor: s('result_card_row_wash_color'),
      resultCardTitleFont: s('result_card_title_font'),
      resultCardWinnersFont: s('result_card_winners_font'),
      resultCardSponsorFont: s('result_card_sponsor_font'),
      resultCardPlacementFont: s('result_card_placement_font'),
      resultCardNameFont: s('result_card_name_font'),
      resultCardHeaderWashAlpha: s('result_card_header_wash_alpha'),
      resultCardWidth: s('result_card_width'),
      resultCardRowHeight: s('result_card_row_height'),
      resultCardHeaderHeight: s('result_card_header_height'),
      resultCardSponsorHeight: s('result_card_sponsor_height'),
      resultCardPlacementsMax: s('result_card_placements_max'),
      resultCardRowRadius: s('result_card_row_radius'),
      resultCardPad: s('result_card_pad'),
      resultCardLogoSize: s('result_card_logo_size'),
      resultCardTitleY: s('result_card_title_y'),
      resultCardWinnersY: s('result_card_winners_y'),
      resultCardBodyGap: s('result_card_body_gap'),
      resultCardRowsTopGap: s('result_card_rows_top_gap'),
      resultCardBottomPad: s('result_card_bottom_pad'),
      resultCardRowInset: s('result_card_row_inset'),
      resultCardRowInnerGap: s('result_card_row_inner_gap'),
      resultCardPlacementX: s('result_card_placement_x'),
      resultCardNameX: s('result_card_name_x'),
      resultCardRowTextY: s('result_card_row_text_y'),
      resultCardSponsorLogoW: s('result_card_sponsor_logo_w'),
      resultCardSponsorLogoH: s('result_card_sponsor_logo_h'),
      resultCardSponsorLogoGap: s('result_card_sponsor_logo_gap'),
      resultCardLogoTextGap: s('result_card_logo_text_gap'),
      dialogShellMaxHeightRatio: s('dialog_shell_max_height_ratio'),
      dialogShellMaxWidth: s('dialog_shell_max_width'),
      dialogShellInsetH: s('dialog_shell_inset_h'),
      dialogShellInsetV: s('dialog_shell_inset_v'),
      dialogShellLoadingHeight: s('dialog_shell_loading_height'),
      brandingPreviewHeight: s('branding_preview_height'),
      brandingPreviewMaxWidth: s('branding_preview_max_width'),
      dialogScrollMaxHeight: s('dialog_scroll_max_height'),
      panelMaxWidth: s('panel_max_width'),
      browseMaxWidth: s('browse_max_width'),
      standingsTableMinWidth: s('standings_table_min_width'),
      pageCardPad: s('page_card_pad'),
      pageCardGap: s('page_card_gap'),
      featureDisabled: s('feature_disabled'),
      publicDisabled: s('public_disabled'),
      insufficientEntryFee: s('insufficient_entry_fee'),
      topUpAction: s('top_up_action'),
      topUpHref: s('top_up_href'),
      listPageSize: s('list_page_size'),
      emptyValue: s('empty_value'),
      playersCountSuffix: s('players_count_suffix'),
      amountCurrencySeparator: s('amount_currency_separator'),
      metaSeparator: s('meta_separator'),
      bracketByeLabel: s('bracket_bye_label'),
      bracketVsLabel: s('bracket_vs_label'),
      bracketEmptySeat: s('bracket_empty_seat'),
      reportAction: s('report_action'),
      reportTitle: s('report_title'),
      reportReasonLabel: s('report_reason_label'),
      reportNoteLabel: s('report_note_label'),
      reportSubmitAction: s('report_submit_action'),
      reportToastSent: s('report_toast_sent'),
      reportToastFailed: s('report_toast_failed'),
      publicListTitle: s('public_list_title'),
      publicListBlurb: s('public_list_blurb'),
      publicListEmpty: s('public_list_empty'),
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
      searchLabel: s('search_label'),
      searchPlaceholder: s('search_placeholder'),
      visibilityPrivateBlurb: s('visibility_private_blurb'),
      visibilityPublicBlurb: s('visibility_public_blurb'),
      publicRatedOnBlurb: s('public_rated_on_blurb'),
      publicRatedOffBlurb: s('public_rated_off_blurb'),
      entryFeePayBlurb: s('entry_fee_pay_blurb'),
      loadFailed: s('load_failed'),
      dialogCloseLabel: s('dialog_close_label'),
      cancelAction: s('cancel_action'),
      prizePoolNowLabel: s('prize_pool_now_label'),
      prizePoolIfFullLabel: s('prize_pool_if_full_label'),
      prizePoolGuaranteedLabel: s('prize_pool_guaranteed_label'),
      prizePoolFrozenBlurb: s('prize_pool_frozen_blurb'),
      hostRepFinishedLabel: s('host_rep_finished_label'),
      hostRepCancelledLabel: s('host_rep_cancelled_label'),
      hostRepReportsLabel: s('host_rep_reports_label'),
      hostRepMetaSeparator: s('host_rep_meta_separator'),
      prizePoolEntryFeesNote: s('prize_pool_entry_fees_note'),
      lobbyTitle: s('lobby_title'),
      lobbyBlurb: s('lobby_blurb'),
      lobbyUnavailable: s('lobby_unavailable'),
      lobbyRosterTitle: s('lobby_roster_title'),
      lobbyBracketTitle: s('lobby_bracket_title'),
      lobbyStandingsTitle: s('lobby_standings_title'),
      lobbyNextMatchTitle: s('lobby_next_match_title'),
      lobbyWaitingStart: s('lobby_waiting_start'),
      lobbyOpenPlayAction: s('lobby_open_play_action'),
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
      prizeSettledBlurb: s('prize_settled_blurb'),
      prizePendingBlurb: s('prize_pending_blurb'),
      disputeWindowBlurb: s('dispute_window_blurb'),
      errCodeRequired: s('err_code_required'),
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
      detailDescriptionLabel: s('detail_description_label'),
    );
    return chrome.isReady ? chrome : null;
  }
}
