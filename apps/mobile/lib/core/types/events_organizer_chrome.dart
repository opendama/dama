/// DB-backed organizer chrome from GET /public/events-organizer-chrome.
class EventsOrganizerChrome {
  const EventsOrganizerChrome({
    required this.source,
    required this.unavailable,
    required this.brandName,
    required this.dashboardTitle,
    required this.dashboardBlurb,
    required this.listTitle,
    required this.listBlurb,
    required this.createAction,
    required this.createPending,
    required this.createTitle,
    required this.createBlurb,
    required this.titleLabel,
    required this.titlePlaceholder,
    required this.formatLabel,
    required this.sizeLabel,
    required this.maxPlayersLabel,
    required this.unlimitedPlayersLabel,
    required this.entryFeeLabel,
    required this.entryFeePlaceholder,
    required this.entryFreeLabel,
    required this.autoApproveLabel,
    required this.hostFeeLabel,
    required this.payCreateAction,
    required this.cancelAction,
    required this.dialogCloseLabel,
    required this.closeAction,
    required this.reopenAction,
    required this.cannotReopenBlurb,
    required this.toastClosed,
    required this.toastReopened,
    required this.toastCloseFailed,
    required this.toastReopenFailed,
    required this.autoClosedBadge,
    required this.searchLabel,
    required this.searchPlaceholder,
    required this.statusFilterLabel,
    required this.filterStatusAll,
    required this.filterAllLabel,
    required this.filterFreeLabel,
    required this.filterPaidLabel,
    required this.filterEntryLabel,
    required this.publicRatedOnBlurb,
    required this.publicRatedOffBlurb,
    required this.emptyList,
    required this.manageAction,
    required this.rowActionsLabel,
    required this.selectAllLabel,
    required this.selectRowLabel,
    required this.selectedCountFmt,
    required this.clearSelectionAction,
    required this.bulkCloseAction,
    required this.bulkReopenAction,
    required this.bulkActionPending,
    required this.overviewTab,
    required this.joinTab,
    required this.playersTab,
    required this.bracketTab,
    required this.liveBoardTab,
    required this.brandingTab,
    required this.paymentsTab,
    required this.resultsTab,
    required this.joinCodeLabel,
    required this.joinLinkLabel,
    required this.copyCodeAction,
    required this.copyLinkAction,
    required this.copyInviteAction,
    required this.inviteTextTemplate,
    required this.downloadQrAction,
    required this.hostFeePaidLabel,
    required this.entryFeesCollectedLabel,
    required this.entryFeesGrossLabel,
    required this.copiedBlurb,
    required this.toastCopyFailed,
    required this.qrUnavailable,
    required this.toastQrDownloadFailed,
    required this.approveAction,
    required this.rejectAction,
    required this.kickAction,
    required this.startAction,
    required this.startGameAction,
    this.forfeitAction = '',
    this.forfeitPending = '',
    this.toastForfeitFailed = '',
    this.rematchAction = '',
    this.rematchPending = '',
    this.toastRematchFailed = '',
    this.officialPauseAction = '',
    this.officialPausePending = '',
    this.officialResumeAction = '',
    this.officialResumePending = '',
    this.toastOfficialPaused = '',
    this.toastOfficialResumed = '',
    this.toastOfficialPauseFailed = '',
    this.toastOfficialResumeFailed = '',
    this.officialPauseStatusLabel = '',
    required this.openMatchAction,
    required this.playersPendingLabel,
    required this.playersApprovedLabel,
    required this.playersRejectedLabel,
    this.playersCheckedInLabel = '',
    this.playersOpenPlayerLabel = '',
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
    this.wideDialogMaxWidth = '',
    this.searchFieldMaxWidth = '',
    this.listBlurbMaxWidth = '',
    this.standingsTableMinWidth = '',
    this.pageCardPad = '',
    this.pageCardGap = '',
    this.dashboardTilePad = '',
    this.dashboardTileRadius = '',
    this.analyticsChipPadH = '',
    this.analyticsChipPadV = '',
    this.analyticsChipRadius = '',
    required this.sponsorNameLabel,
    required this.sponsorNamePlaceholder,
    required this.sponsorLogoLabel,
    required this.logoLabel,
    required this.brandColorLabel,
    required this.brandColorPlaceholder,
    required this.uploadLogoAction,
    required this.uploadSponsorAction,
    required this.toastCreated,
    required this.toastCreateFailed,
    required this.toastStarted,
    required this.toastStartFailed,
    required this.toastSaved,
    required this.toastSaveFailed,
    required this.saveAction,
    required this.savePending,
    required this.toastCancelled,
    required this.insufficientHostFee,
    required this.topUpAction,
    required this.topUpHref,
    required this.listPageSize,
    required this.emptyValue,
    required this.featureDisabled,
    required this.notOrganizer,
    required this.notEnoughPlayers,
    required this.formatUnavailable,
    required this.sizeUnavailable,
    required this.alreadyStarted,
    required this.cannotJoinStatus,
    required this.eventFull,
    required this.metaSeparator,
    required this.bracketByeLabel,
    required this.bracketVsLabel,
    required this.bracketEmptySeat,
    required this.playersCountSuffix,
    required this.amountCurrencySeparator,
    required this.kpiActiveLabel,
    required this.kpiUpcomingLabel,
    required this.kpiPlayersWeekLabel,
    this.kpiPausedBoardsLabel = '',
    this.kpiPausedAvgLabel = '',
    this.livePausedSectionTitle = '',
    this.activitySectionTitle = '',
    required this.kpiHostFeeRevenueLabel,
    required this.kpiEntryFeeRevenueLabel,
    required this.kpiEntryFeeGrossLabel,
    required this.kpiEntryFeeCommissionLabel,
    required this.kpiEntryFeeNetLabel,
    required this.commissionPercentLabel,
    required this.commissionBlurbTemplate,
    required this.paymentsCommissionLabel,
    required this.paymentsOrganizerNetLabel,
    required this.kpiLastShareLabel,
    required this.analyticsTitle,
    required this.analyticsBlurb,
    required this.analyticsPlayersLabel,
    required this.analyticsCompletionLabel,
    required this.analyticsStartedLabel,
    required this.analyticsHostFeeLabel,
    required this.analyticsEntryFeesLabel,
    required this.analyticsCommissionLabel,
    required this.analyticsEntryNetLabel,
    required this.analyticsEmpty,
    required this.analyticsMetricsNote,
    required this.patchTitleLocked,
    required this.uploadLogoFailed,
    required this.visibilityLabel,
    required this.visibilityPrivateLabel,
    required this.visibilityPublicLabel,
    required this.visibilityPrivateBlurb,
    required this.visibilityPublicBlurb,
    required this.publicDisabled,
    required this.makePublicAction,
    required this.makePrivateAction,
    required this.visibilityChangeBlocked,
    required this.reportAction,
    required this.reportTitle,
    required this.reportReasonLabel,
    required this.reportNoteLabel,
    required this.reportSubmitAction,
    required this.reportToastSent,
    required this.reportToastFailed,
    required this.portalWalletLabel,
    required this.portalReceiptsLabel,
    required this.portalTransactionsLabel,
    required this.portalOverviewLabel,
    required this.portalCreateLabel,
    required this.portalPublicListLabel,
    required this.portalMoneySectionTitle,
    required this.portalPayoutLabel,
    required this.portalPayoutBlurb,
    required this.portalWalletHref,
    required this.portalReceiptsHref,
    required this.portalTransactionsHref,
    required this.portalPayoutHref,
    required this.portalOverviewHref,
    required this.portalCreateHref,
    required this.portalPublicListHref,
    required this.publicListTitle,
    required this.publicListBlurb,
    required this.publicListEmpty,
    required this.joinOpenAction,
    required this.forceAutoApproveNote,
    required this.uploadSponsorFailed,
    required this.prizePoolDisplayLabel,
    required this.prizePoolDisplayBlurb,
    required this.prizePoolGuaranteeLabel,
    required this.prizePoolGuaranteeBlurb,
    required this.prizePoolGuaranteeAmountLabel,
    this.prizePoolGuaranteeAmountPlaceholder = '',
    required this.prizePoolNowLabel,
    required this.prizePoolIfFullLabel,
    required this.prizePoolGuaranteedLabel,
    required this.prizePoolFrozenBlurb,
    required this.prizePoolEntryFeesNote,
    required this.insufficientPrizeGuarantee,
    required this.prizePoolUnavailable,
    this.errHostGuaranteeRequiresDocumentKyc = '',
    this.errHostPaidRequiresPhoneKyc = '',
    this.errHostConcurrentOpenPaidCap = '',
    this.errHostReputationBlocked = '',
    this.hostRepFinishedLabel = '',
    this.hostRepCancelledLabel = '',
    this.hostRepReportsLabel = '',
    this.hostRepMetaSeparator = '',
    this.payoutModeLabel = '',
    this.payoutModeBlurb = '',
    this.payoutModePlacesPercentLabel = '',
    this.payoutModeScoreShareLabel = '',
    this.payoutModeDualPurseLabel = '',
    this.prizePlacePercentsSectionLabel = '',
    this.prizePlacePercentsBlurb = '',
    this.prizePlacePercent1Label = '',
    this.prizePlacePercent1Placeholder = '',
    this.prizePlacePercent2Label = '',
    this.prizePlacePercent2Placeholder = '',
    this.prizePlacePercent3Label = '',
    this.prizePlacePercent3Placeholder = '',
    this.errPrizePlacePercentsSum = '',
    this.errPayoutModeInvalid = '',
    this.errPayoutModeScoreShareKnockout = '',
    this.errTitleRequired = '',
    this.errFormatSizeRequired = '',
    this.arenaDurationLabel = '',
    this.arenaDurationRequired = '',
    this.arenaDurationLengthPlaceholder = '',
    this.arenaDurationUnitLabel = '',
    this.arenaDurationUnitMinutes = '',
    this.arenaDurationUnitHours = '',
    this.arenaDurationUnitDays = '',
    this.arenaDurationUnitWeeks = '',
    this.arenaDurationUnitMonths = '',
    this.arenaDurationModeLength = '',
    this.arenaDurationModeEndsAt = '',
    this.arenaDurationEndsAtLabel = '',
    this.arenaDurationEndsAtPlaceholder = '',
    this.arenaDurationEndsAtPast = '',
    this.arenaDurationBlurb = '',
    this.arenaFinishAction = '',
    this.arenaFinishPending = '',
    this.toastArenaFinished = '',
    this.toastArenaFinishFailed = '',
    this.arenaFinishRequiresStarted = '',
    this.arenaFinishAlreadyFinished = '',
    this.descriptionLabel = '',
    this.descriptionPlaceholder = '',
    this.prizeMediaSectionTitle = '',
    this.prizeMediaSectionBlurb = '',
    this.thumbnailLabel = '',
    this.galleryLabel = '',
    this.galleryAddAction = '',
    this.galleryEmpty = '',
    this.thumbnailUploadAction = '',
    this.thumbnailUploadPending = '',
    this.galleryUploadPending = '',
    this.toastThumbnailSaved = '',
    this.toastGallerySaved = '',
    this.mediaUploadFailed = '',
    this.galleryMaxSlots = '',
    this.gallerySlotsFmt = '',
    this.thumbnailMainBadge = '',
    this.thumbnailEmptyHint = '',
    this.thumbnailHint = '',
    this.galleryLimitReached = '',
  });

  final String source;
  final String unavailable;
  final String brandName;
  final String dashboardTitle;
  final String dashboardBlurb;
  final String listTitle;
  final String listBlurb;
  final String createAction;
  final String createPending;
  final String createTitle;
  final String createBlurb;
  final String titleLabel;
  final String titlePlaceholder;
  final String formatLabel;
  final String sizeLabel;
  final String maxPlayersLabel;
  final String unlimitedPlayersLabel;
  final String entryFeeLabel;
  final String entryFeePlaceholder;
  final String entryFreeLabel;
  final String autoApproveLabel;
  final String hostFeeLabel;
  final String payCreateAction;
  final String cancelAction;
  final String dialogCloseLabel;
  final String closeAction;
  final String reopenAction;
  final String cannotReopenBlurb;
  final String toastClosed;
  final String toastReopened;
  final String toastCloseFailed;
  final String toastReopenFailed;
  final String autoClosedBadge;
  final String searchLabel;
  final String searchPlaceholder;
  final String statusFilterLabel;
  final String filterStatusAll;
  final String filterAllLabel;
  final String filterFreeLabel;
  final String filterPaidLabel;
  final String filterEntryLabel;
  final String publicRatedOnBlurb;
  final String publicRatedOffBlurb;
  final String emptyList;
  final String manageAction;
  final String rowActionsLabel;
  final String selectAllLabel;
  final String selectRowLabel;
  final String selectedCountFmt;
  final String clearSelectionAction;
  final String bulkCloseAction;
  final String bulkReopenAction;
  final String bulkActionPending;
  final String overviewTab;
  final String joinTab;
  final String playersTab;
  final String bracketTab;
  final String liveBoardTab;
  final String brandingTab;
  final String paymentsTab;
  final String resultsTab;
  final String joinCodeLabel;
  final String joinLinkLabel;
  final String copyCodeAction;
  final String copyLinkAction;
  final String copyInviteAction;
  final String inviteTextTemplate;
  final String downloadQrAction;
  final String hostFeePaidLabel;
  final String entryFeesCollectedLabel;
  final String entryFeesGrossLabel;
  final String copiedBlurb;
  final String toastCopyFailed;
  final String qrUnavailable;
  final String toastQrDownloadFailed;
  final String approveAction;
  final String rejectAction;
  final String kickAction;
  final String startAction;
  final String startGameAction;
  final String forfeitAction;
  final String forfeitPending;
  final String rematchAction;
  final String rematchPending;
  final String toastRematchFailed;
  final String toastForfeitFailed;
  final String officialPauseAction;
  final String officialPausePending;
  final String officialResumeAction;
  final String officialResumePending;
  final String toastOfficialPaused;
  final String toastOfficialResumed;
  final String toastOfficialPauseFailed;
  final String toastOfficialResumeFailed;
  final String officialPauseStatusLabel;
  final String openMatchAction;
  final String playersPendingLabel;
  final String playersApprovedLabel;
  final String playersRejectedLabel;
  final String playersCheckedInLabel;
  final String playersOpenPlayerLabel;
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
  final String wideDialogMaxWidth;
  final String searchFieldMaxWidth;
  final String listBlurbMaxWidth;
  final String standingsTableMinWidth;
  final String pageCardPad;
  final String pageCardGap;
  final String dashboardTilePad;
  final String dashboardTileRadius;
  final String analyticsChipPadH;
  final String analyticsChipPadV;
  final String analyticsChipRadius;
  final String sponsorNameLabel;
  final String sponsorNamePlaceholder;
  final String sponsorLogoLabel;
  final String logoLabel;
  final String brandColorLabel;
  final String brandColorPlaceholder;
  final String uploadLogoAction;
  final String uploadSponsorAction;
  final String toastCreated;
  final String toastCreateFailed;
  final String toastStarted;
  final String toastStartFailed;
  final String toastSaved;
  final String toastSaveFailed;

  /// Primary save button label (not toastSaved).
  final String saveAction;
  final String savePending;
  final String toastCancelled;
  final String insufficientHostFee;
  final String topUpAction;
  final String topUpHref;
  final String listPageSize;
  final String emptyValue;
  final String featureDisabled;

  int get listPageSizeInt {
    final n = int.tryParse(listPageSize.trim());
    return n != null && n > 0 ? n : 0;
  }

  final String notOrganizer;
  final String notEnoughPlayers;
  final String formatUnavailable;
  final String sizeUnavailable;
  final String alreadyStarted;
  final String cannotJoinStatus;
  final String eventFull;
  final String metaSeparator;
  final String bracketByeLabel;
  final String bracketVsLabel;
  final String bracketEmptySeat;
  final String playersCountSuffix;
  final String amountCurrencySeparator;
  final String kpiActiveLabel;
  final String kpiUpcomingLabel;
  final String kpiPlayersWeekLabel;
  final String kpiPausedBoardsLabel;
  final String kpiPausedAvgLabel;
  final String livePausedSectionTitle;
  final String activitySectionTitle;
  final String kpiHostFeeRevenueLabel;
  final String kpiEntryFeeRevenueLabel;
  final String kpiEntryFeeGrossLabel;
  final String kpiEntryFeeCommissionLabel;
  final String kpiEntryFeeNetLabel;
  final String commissionPercentLabel;
  final String commissionBlurbTemplate;
  final String paymentsCommissionLabel;
  final String paymentsOrganizerNetLabel;
  final String kpiLastShareLabel;
  final String analyticsTitle;
  final String analyticsBlurb;
  final String analyticsPlayersLabel;
  final String analyticsCompletionLabel;
  final String analyticsStartedLabel;
  final String analyticsHostFeeLabel;
  final String analyticsEntryFeesLabel;
  final String analyticsCommissionLabel;
  final String analyticsEntryNetLabel;
  final String analyticsEmpty;
  final String analyticsMetricsNote;
  final String patchTitleLocked;
  final String uploadLogoFailed;
  final String visibilityLabel;
  final String visibilityPrivateLabel;
  final String visibilityPublicLabel;
  final String visibilityPrivateBlurb;
  final String visibilityPublicBlurb;
  final String publicDisabled;
  final String makePublicAction;
  final String makePrivateAction;
  final String visibilityChangeBlocked;
  final String reportAction;
  final String reportTitle;
  final String reportReasonLabel;
  final String reportNoteLabel;
  final String reportSubmitAction;
  final String reportToastSent;
  final String reportToastFailed;
  final String portalWalletLabel;
  final String portalReceiptsLabel;
  final String portalTransactionsLabel;
  final String portalOverviewLabel;
  final String portalCreateLabel;
  final String portalPublicListLabel;
  final String portalMoneySectionTitle;
  final String portalPayoutLabel;
  final String portalPayoutBlurb;
  final String portalWalletHref;
  final String portalReceiptsHref;
  final String portalTransactionsHref;
  final String portalPayoutHref;
  final String portalOverviewHref;
  final String portalCreateHref;
  final String portalPublicListHref;
  final String publicListTitle;
  final String publicListBlurb;
  final String publicListEmpty;
  final String joinOpenAction;
  final String forceAutoApproveNote;
  final String uploadSponsorFailed;
  final String prizePoolDisplayLabel;
  final String prizePoolDisplayBlurb;
  final String prizePoolGuaranteeLabel;
  final String prizePoolGuaranteeBlurb;
  final String prizePoolGuaranteeAmountLabel;
  final String prizePoolGuaranteeAmountPlaceholder;
  final String prizePoolNowLabel;
  final String prizePoolIfFullLabel;
  final String prizePoolGuaranteedLabel;
  final String prizePoolFrozenBlurb;
  final String prizePoolEntryFeesNote;
  final String insufficientPrizeGuarantee;
  final String prizePoolUnavailable;
  final String errHostGuaranteeRequiresDocumentKyc;
  final String errHostPaidRequiresPhoneKyc;
  final String errHostConcurrentOpenPaidCap;
  final String errHostReputationBlocked;
  final String hostRepFinishedLabel;
  final String hostRepCancelledLabel;
  final String hostRepReportsLabel;
  final String hostRepMetaSeparator;
  final String payoutModeLabel;
  final String payoutModeBlurb;
  final String payoutModePlacesPercentLabel;
  final String payoutModeScoreShareLabel;
  final String payoutModeDualPurseLabel;
  final String prizePlacePercentsSectionLabel;
  final String prizePlacePercentsBlurb;
  final String prizePlacePercent1Label;
  final String prizePlacePercent1Placeholder;
  final String prizePlacePercent2Label;
  final String prizePlacePercent2Placeholder;
  final String prizePlacePercent3Label;
  final String prizePlacePercent3Placeholder;
  final String errPrizePlacePercentsSum;
  final String errPayoutModeInvalid;
  final String errPayoutModeScoreShareKnockout;
  final String errTitleRequired;
  final String errFormatSizeRequired;
  final String arenaDurationLabel;
  final String arenaDurationRequired;
  final String arenaDurationLengthPlaceholder;
  final String arenaDurationUnitLabel;
  final String arenaDurationUnitMinutes;
  final String arenaDurationUnitHours;
  final String arenaDurationUnitDays;
  final String arenaDurationUnitWeeks;
  final String arenaDurationUnitMonths;
  final String arenaDurationModeLength;
  final String arenaDurationModeEndsAt;
  final String arenaDurationEndsAtLabel;
  final String arenaDurationEndsAtPlaceholder;
  final String arenaDurationEndsAtPast;
  final String arenaDurationBlurb;
  final String arenaFinishAction;
  final String arenaFinishPending;
  final String toastArenaFinished;
  final String toastArenaFinishFailed;
  final String arenaFinishRequiresStarted;
  final String arenaFinishAlreadyFinished;
  final String descriptionLabel;
  final String descriptionPlaceholder;
  final String prizeMediaSectionTitle;
  final String prizeMediaSectionBlurb;
  final String thumbnailLabel;
  final String galleryLabel;
  final String galleryAddAction;
  final String galleryEmpty;
  final String thumbnailUploadAction;
  final String thumbnailUploadPending;
  final String galleryUploadPending;
  final String toastThumbnailSaved;
  final String toastGallerySaved;
  final String mediaUploadFailed;
  final String galleryMaxSlots;
  final String gallerySlotsFmt;
  final String thumbnailMainBadge;
  final String thumbnailEmptyHint;
  final String thumbnailHint;
  final String galleryLimitReached;

  int get galleryMaxSlotsInt {
    final n = int.tryParse(galleryMaxSlots.trim());
    return n != null && n > 0 ? n : 0;
  }

  /// EntityMediaEditor + prize/description chrome (DB fail-closed).
  bool get isPrizeMediaChromeComplete =>
      descriptionLabel.isNotEmpty &&
      descriptionPlaceholder.isNotEmpty &&
      prizeMediaSectionTitle.isNotEmpty &&
      prizeMediaSectionBlurb.isNotEmpty &&
      thumbnailLabel.isNotEmpty &&
      galleryLabel.isNotEmpty &&
      galleryEmpty.isNotEmpty &&
      galleryAddAction.isNotEmpty &&
      galleryMaxSlotsInt > 0 &&
      gallerySlotsFmt.isNotEmpty &&
      thumbnailMainBadge.isNotEmpty &&
      thumbnailEmptyHint.isNotEmpty &&
      thumbnailHint.isNotEmpty &&
      galleryLimitReached.isNotEmpty &&
      thumbnailUploadAction.isNotEmpty &&
      thumbnailUploadPending.isNotEmpty &&
      galleryUploadPending.isNotEmpty &&
      toastThumbnailSaved.isNotEmpty &&
      toastGallerySaved.isNotEmpty &&
      mediaUploadFailed.isNotEmpty;

  bool get isReady =>
      source.isNotEmpty &&
      unavailable.isNotEmpty &&
      brandName.isNotEmpty &&
      dashboardTitle.isNotEmpty &&
      dashboardBlurb.isNotEmpty &&
      listTitle.isNotEmpty &&
      listBlurb.isNotEmpty &&
      createAction.isNotEmpty &&
      createPending.isNotEmpty &&
      createTitle.isNotEmpty &&
      createBlurb.isNotEmpty &&
      titleLabel.isNotEmpty &&
      formatLabel.isNotEmpty &&
      sizeLabel.isNotEmpty &&
      payCreateAction.isNotEmpty &&
      joinCodeLabel.isNotEmpty &&
      joinLinkLabel.isNotEmpty &&
      downloadQrAction.isNotEmpty &&
      startAction.isNotEmpty &&
      startGameAction.isNotEmpty &&
      approveAction.isNotEmpty &&
      rejectAction.isNotEmpty &&
      kickAction.isNotEmpty &&
      featureDisabled.isNotEmpty &&
      bracketByeLabel.isNotEmpty &&
      bracketVsLabel.isNotEmpty &&
      bracketEmptySeat.isNotEmpty &&
      insufficientHostFee.isNotEmpty &&
      qrUnavailable.isNotEmpty &&
      toastCreateFailed.isNotEmpty &&
      toastSaved.isNotEmpty &&
      toastSaveFailed.isNotEmpty &&
      toastCreated.isNotEmpty &&
      saveAction.isNotEmpty &&
      savePending.isNotEmpty &&
      titlePlaceholder.isNotEmpty &&
      entryFeeLabel.isNotEmpty &&
      entryFeePlaceholder.isNotEmpty &&
      entryFreeLabel.isNotEmpty &&
      hostFeeLabel.isNotEmpty &&
      maxPlayersLabel.isNotEmpty &&
      unlimitedPlayersLabel.isNotEmpty &&
      searchLabel.isNotEmpty &&
      statusFilterLabel.isNotEmpty &&
      filterStatusAll.isNotEmpty &&
      filterAllLabel.isNotEmpty &&
      filterFreeLabel.isNotEmpty &&
      filterPaidLabel.isNotEmpty &&
      filterEntryLabel.isNotEmpty &&
      publicRatedOnBlurb.isNotEmpty &&
      publicRatedOffBlurb.isNotEmpty &&
      overviewTab.isNotEmpty &&
      joinTab.isNotEmpty &&
      playersTab.isNotEmpty &&
      bracketTab.isNotEmpty &&
      brandingTab.isNotEmpty &&
      resultsTab.isNotEmpty &&
      winnersTitle.isNotEmpty &&
      shareResultAction.isNotEmpty &&
      toastStarted.isNotEmpty &&
      toastStartFailed.isNotEmpty &&
      metaSeparator.isNotEmpty &&
      amountCurrencySeparator.isNotEmpty &&
      topUpAction.isNotEmpty &&
      topUpHref.isNotEmpty &&
      listPageSizeInt > 0 &&
      emptyValue.isNotEmpty &&
      emptyList.isNotEmpty &&
      manageAction.isNotEmpty &&
      rowActionsLabel.isNotEmpty &&
      selectAllLabel.isNotEmpty &&
      selectRowLabel.isNotEmpty &&
      selectedCountFmt.isNotEmpty &&
      clearSelectionAction.isNotEmpty &&
      bulkCloseAction.isNotEmpty &&
      bulkReopenAction.isNotEmpty &&
      bulkActionPending.isNotEmpty &&
      kpiActiveLabel.isNotEmpty &&
      kpiUpcomingLabel.isNotEmpty &&
      kpiPlayersWeekLabel.isNotEmpty &&
      kpiPausedBoardsLabel.isNotEmpty &&
      kpiPausedAvgLabel.isNotEmpty &&
      livePausedSectionTitle.isNotEmpty &&
      activitySectionTitle.isNotEmpty &&
      kpiHostFeeRevenueLabel.isNotEmpty &&
      kpiEntryFeeRevenueLabel.isNotEmpty &&
      kpiEntryFeeGrossLabel.isNotEmpty &&
      kpiEntryFeeCommissionLabel.isNotEmpty &&
      kpiEntryFeeNetLabel.isNotEmpty &&
      commissionPercentLabel.isNotEmpty &&
      commissionBlurbTemplate.isNotEmpty &&
      paymentsCommissionLabel.isNotEmpty &&
      paymentsOrganizerNetLabel.isNotEmpty &&
      kpiLastShareLabel.isNotEmpty &&
      analyticsTitle.isNotEmpty &&
      analyticsBlurb.isNotEmpty &&
      analyticsPlayersLabel.isNotEmpty &&
      analyticsCompletionLabel.isNotEmpty &&
      analyticsStartedLabel.isNotEmpty &&
      analyticsHostFeeLabel.isNotEmpty &&
      analyticsEntryFeesLabel.isNotEmpty &&
      analyticsCommissionLabel.isNotEmpty &&
      analyticsEntryNetLabel.isNotEmpty &&
      analyticsEmpty.isNotEmpty &&
      analyticsMetricsNote.isNotEmpty &&
      cancelAction.isNotEmpty &&
      dialogCloseLabel.isNotEmpty &&
      closeAction.isNotEmpty &&
      reopenAction.isNotEmpty &&
      cannotReopenBlurb.isNotEmpty &&
      toastClosed.isNotEmpty &&
      toastReopened.isNotEmpty &&
      toastCloseFailed.isNotEmpty &&
      toastReopenFailed.isNotEmpty &&
      autoClosedBadge.isNotEmpty &&
      portalPayoutLabel.isNotEmpty &&
      portalPayoutBlurb.isNotEmpty &&
      portalWalletHref.isNotEmpty &&
      portalReceiptsHref.isNotEmpty &&
      portalTransactionsHref.isNotEmpty &&
      portalPayoutHref.isNotEmpty &&
      portalOverviewHref.isNotEmpty &&
      portalCreateHref.isNotEmpty &&
      portalPublicListHref.isNotEmpty &&
      portalMoneySectionTitle.isNotEmpty &&
      patchTitleLocked.isNotEmpty &&
      sponsorNameLabel.isNotEmpty &&
      sponsorNamePlaceholder.isNotEmpty &&
      sponsorLogoLabel.isNotEmpty &&
      logoLabel.isNotEmpty &&
      brandColorLabel.isNotEmpty &&
      brandColorPlaceholder.isNotEmpty &&
      uploadLogoAction.isNotEmpty &&
      uploadSponsorAction.isNotEmpty &&
      uploadLogoFailed.isNotEmpty &&
      uploadSponsorFailed.isNotEmpty &&
      isPrizeMediaChromeComplete &&
      paymentsTab.isNotEmpty &&
      liveBoardTab.isNotEmpty &&
      hostFeePaidLabel.isNotEmpty &&
      entryFeesCollectedLabel.isNotEmpty &&
      entryFeesGrossLabel.isNotEmpty &&
      copyInviteAction.isNotEmpty &&
      inviteTextTemplate.isNotEmpty &&
      visibilityLabel.isNotEmpty &&
      visibilityPrivateLabel.isNotEmpty &&
      visibilityPublicLabel.isNotEmpty &&
      visibilityPrivateBlurb.isNotEmpty &&
      visibilityPublicBlurb.isNotEmpty &&
      publicDisabled.isNotEmpty &&
      makePublicAction.isNotEmpty &&
      makePrivateAction.isNotEmpty &&
      visibilityChangeBlocked.isNotEmpty &&
      reportAction.isNotEmpty &&
      reportTitle.isNotEmpty &&
      reportReasonLabel.isNotEmpty &&
      reportNoteLabel.isNotEmpty &&
      reportSubmitAction.isNotEmpty &&
      reportToastSent.isNotEmpty &&
      reportToastFailed.isNotEmpty &&
      portalWalletLabel.isNotEmpty &&
      portalReceiptsLabel.isNotEmpty &&
      portalTransactionsLabel.isNotEmpty &&
      portalOverviewLabel.isNotEmpty &&
      portalCreateLabel.isNotEmpty &&
      portalPublicListLabel.isNotEmpty &&
      publicListTitle.isNotEmpty &&
      publicListBlurb.isNotEmpty &&
      publicListEmpty.isNotEmpty &&
      joinOpenAction.isNotEmpty &&
      forceAutoApproveNote.isNotEmpty &&
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
      wideDialogMaxWidth.isNotEmpty &&
      searchFieldMaxWidth.isNotEmpty &&
      listBlurbMaxWidth.isNotEmpty &&
      standingsTableMinWidth.isNotEmpty &&
      pageCardPad.isNotEmpty &&
      pageCardGap.isNotEmpty &&
      dashboardTilePad.isNotEmpty &&
      dashboardTileRadius.isNotEmpty &&
      analyticsChipPadH.isNotEmpty &&
      analyticsChipPadV.isNotEmpty &&
      analyticsChipRadius.isNotEmpty &&
      prizePoolDisplayLabel.isNotEmpty &&
      prizePoolDisplayBlurb.isNotEmpty &&
      prizePoolGuaranteeLabel.isNotEmpty &&
      prizePoolGuaranteeBlurb.isNotEmpty &&
      prizePoolGuaranteeAmountLabel.isNotEmpty &&
      prizePoolGuaranteeAmountPlaceholder.isNotEmpty &&
      prizePoolNowLabel.isNotEmpty &&
      prizePoolIfFullLabel.isNotEmpty &&
      prizePoolGuaranteedLabel.isNotEmpty &&
      prizePoolFrozenBlurb.isNotEmpty &&
      prizePoolEntryFeesNote.isNotEmpty &&
      insufficientPrizeGuarantee.isNotEmpty &&
      prizePoolUnavailable.isNotEmpty &&
      arenaDurationLabel.isNotEmpty &&
      arenaDurationRequired.isNotEmpty &&
      arenaDurationLengthPlaceholder.isNotEmpty &&
      arenaDurationUnitLabel.isNotEmpty &&
      arenaDurationUnitMinutes.isNotEmpty &&
      arenaDurationUnitHours.isNotEmpty &&
      arenaDurationUnitDays.isNotEmpty &&
      arenaDurationUnitWeeks.isNotEmpty &&
      arenaDurationUnitMonths.isNotEmpty &&
      arenaDurationModeLength.isNotEmpty &&
      arenaDurationModeEndsAt.isNotEmpty &&
      arenaDurationEndsAtLabel.isNotEmpty &&
      arenaDurationEndsAtPlaceholder.isNotEmpty &&
      arenaDurationEndsAtPast.isNotEmpty &&
      arenaDurationBlurb.isNotEmpty &&
      arenaFinishAction.isNotEmpty &&
      arenaFinishPending.isNotEmpty &&
      arenaFinishRequiresStarted.isNotEmpty &&
      arenaFinishAlreadyFinished.isNotEmpty &&
      payoutModeLabel.isNotEmpty &&
      payoutModeBlurb.isNotEmpty &&
      payoutModePlacesPercentLabel.isNotEmpty &&
      payoutModeScoreShareLabel.isNotEmpty &&
      payoutModeDualPurseLabel.isNotEmpty &&
      errHostGuaranteeRequiresDocumentKyc.isNotEmpty &&
      errHostPaidRequiresPhoneKyc.isNotEmpty &&
      errHostConcurrentOpenPaidCap.isNotEmpty &&
      errHostReputationBlocked.isNotEmpty &&
      hostRepFinishedLabel.isNotEmpty &&
      hostRepCancelledLabel.isNotEmpty &&
      hostRepReportsLabel.isNotEmpty &&
      hostRepMetaSeparator.isNotEmpty;

  static EventsOrganizerChrome? fromJson(Map<String, dynamic>? map) {
    if (map == null) return null;
    String raw(String k) => (map[k] as String?) ?? '';
    String s(String k) => raw(k).trim();
    final chrome = EventsOrganizerChrome(
      source: s('source'),
      unavailable: s('events_organizer_chrome_unavailable'),
      brandName: s('brand_name'),
      dashboardTitle: s('dashboard_title'),
      dashboardBlurb: s('dashboard_blurb'),
      listTitle: s('list_title'),
      listBlurb: s('list_blurb'),
      createAction: s('create_action'),
      createPending: s('create_pending'),
      createTitle: s('create_title'),
      createBlurb: s('create_blurb'),
      titleLabel: s('title_label'),
      titlePlaceholder: s('title_placeholder'),
      formatLabel: s('format_label'),
      sizeLabel: s('size_label'),
      maxPlayersLabel: s('max_players_label'),
      unlimitedPlayersLabel: s('unlimited_players_label'),
      entryFeeLabel: s('entry_fee_label'),
      entryFeePlaceholder: s('entry_fee_placeholder'),
      entryFreeLabel: s('entry_free_label'),
      autoApproveLabel: s('auto_approve_label'),
      hostFeeLabel: s('host_fee_label'),
      payCreateAction: s('pay_create_action'),
      cancelAction: s('cancel_action'),
      dialogCloseLabel: s('dialog_close_label'),
      closeAction: s('close_action'),
      reopenAction: s('reopen_action'),
      cannotReopenBlurb: s('cannot_reopen_blurb'),
      toastClosed: s('toast_closed'),
      toastReopened: s('toast_reopened'),
      toastCloseFailed: s('toast_close_failed'),
      toastReopenFailed: s('toast_reopen_failed'),
      autoClosedBadge: s('auto_closed_badge'),
      searchLabel: s('search_label'),
      searchPlaceholder: s('search_placeholder'),
      statusFilterLabel: s('status_filter_label'),
      filterStatusAll: s('filter_status_all'),
      filterAllLabel: s('filter_all_label'),
      filterFreeLabel: s('filter_free_label'),
      filterPaidLabel: s('filter_paid_label'),
      filterEntryLabel: s('filter_entry_label'),
      publicRatedOnBlurb: s('public_rated_on_blurb'),
      publicRatedOffBlurb: s('public_rated_off_blurb'),
      emptyList: s('empty_list'),
      manageAction: s('manage_action'),
      rowActionsLabel: s('row_actions_label'),
      selectAllLabel: s('select_all_label'),
      selectRowLabel: s('select_row_label'),
      selectedCountFmt: s('selected_count_fmt'),
      clearSelectionAction: s('clear_selection_action'),
      bulkCloseAction: s('bulk_close_action'),
      bulkReopenAction: s('bulk_reopen_action'),
      bulkActionPending: s('bulk_action_pending'),
      overviewTab: s('overview_tab'),
      joinTab: s('join_tab'),
      playersTab: s('players_tab'),
      bracketTab: s('bracket_tab'),
      liveBoardTab: s('live_board_tab'),
      brandingTab: s('branding_tab'),
      paymentsTab: s('payments_tab'),
      resultsTab: s('results_tab'),
      joinCodeLabel: s('join_code_label'),
      joinLinkLabel: s('join_link_label'),
      copyCodeAction: s('copy_code_action'),
      copyLinkAction: s('copy_link_action'),
      copyInviteAction: s('copy_invite_action'),
      inviteTextTemplate: raw('invite_text_template'),
      downloadQrAction: s('download_qr_action'),
      hostFeePaidLabel: s('host_fee_paid_label'),
      entryFeesCollectedLabel: s('entry_fees_collected_label'),
      entryFeesGrossLabel: s('entry_fees_gross_label'),
      copiedBlurb: s('copied_blurb'),
      toastCopyFailed: s('toast_copy_failed'),
      qrUnavailable: s('qr_unavailable'),
      toastQrDownloadFailed: s('toast_qr_download_failed'),
      approveAction: s('approve_action'),
      rejectAction: s('reject_action'),
      kickAction: s('kick_action'),
      startAction: s('start_action'),
      startGameAction: s('start_game_action'),
      forfeitAction: s('forfeit_action'),
      forfeitPending: s('forfeit_pending'),
      toastForfeitFailed: s('toast_forfeit_failed'),
      rematchAction: s('rematch_action'),
      rematchPending: s('rematch_pending'),
      toastRematchFailed: s('toast_rematch_failed'),
      officialPauseAction: s('official_pause_action'),
      officialPausePending: s('official_pause_pending'),
      officialResumeAction: s('official_resume_action'),
      officialResumePending: s('official_resume_pending'),
      toastOfficialPaused: s('toast_official_paused'),
      toastOfficialResumed: s('toast_official_resumed'),
      toastOfficialPauseFailed: s('toast_official_pause_failed'),
      toastOfficialResumeFailed: s('toast_official_resume_failed'),
      officialPauseStatusLabel: s('official_pause_status_label'),
      openMatchAction: s('open_match_action'),
      playersPendingLabel: s('players_pending_label'),
      playersApprovedLabel: s('players_approved_label'),
      playersRejectedLabel: s('players_rejected_label'),
      playersCheckedInLabel: s('players_checked_in_label'),
      playersOpenPlayerLabel: s('players_open_player_label'),
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
      wideDialogMaxWidth: s('wide_dialog_max_width'),
      searchFieldMaxWidth: s('search_field_max_width'),
      listBlurbMaxWidth: s('list_blurb_max_width'),
      standingsTableMinWidth: s('standings_table_min_width'),
      pageCardPad: s('page_card_pad'),
      pageCardGap: s('page_card_gap'),
      dashboardTilePad: s('dashboard_tile_pad'),
      dashboardTileRadius: s('dashboard_tile_radius'),
      analyticsChipPadH: s('analytics_chip_pad_h'),
      analyticsChipPadV: s('analytics_chip_pad_v'),
      analyticsChipRadius: s('analytics_chip_radius'),
      sponsorNameLabel: s('sponsor_name_label'),
      sponsorNamePlaceholder: s('sponsor_name_placeholder'),
      sponsorLogoLabel: s('sponsor_logo_label'),
      logoLabel: s('logo_label'),
      brandColorLabel: s('brand_color_label'),
      brandColorPlaceholder: s('brand_color_placeholder'),
      uploadLogoAction: s('upload_logo_action'),
      uploadSponsorAction: s('upload_sponsor_action'),
      toastCreated: s('toast_created'),
      toastCreateFailed: s('toast_create_failed'),
      toastStarted: s('toast_started'),
      toastStartFailed: s('toast_start_failed'),
      toastSaved: s('toast_saved'),
      toastSaveFailed: s('toast_save_failed'),
      saveAction: s('save_action'),
      savePending: s('save_pending'),
      toastCancelled: s('toast_cancelled'),
      insufficientHostFee: s('insufficient_host_fee'),
      topUpAction: s('top_up_action'),
      topUpHref: s('top_up_href'),
      listPageSize: s('list_page_size'),
      emptyValue: s('empty_value'),
      featureDisabled: s('feature_disabled'),
      notOrganizer: s('not_organizer'),
      notEnoughPlayers: s('not_enough_players'),
      formatUnavailable: s('format_unavailable'),
      sizeUnavailable: s('size_unavailable'),
      alreadyStarted: s('already_started'),
      cannotJoinStatus: s('cannot_join_status'),
      eventFull: s('event_full'),
      metaSeparator: raw('meta_separator'),
      bracketByeLabel: s('bracket_bye_label'),
      bracketVsLabel: s('bracket_vs_label'),
      bracketEmptySeat: s('bracket_empty_seat'),
      playersCountSuffix: s('players_count_suffix'),
      amountCurrencySeparator: raw('amount_currency_separator'),
      kpiActiveLabel: s('kpi_active_label'),
      kpiUpcomingLabel: s('kpi_upcoming_label'),
      kpiPlayersWeekLabel: s('kpi_players_week_label'),
      kpiPausedBoardsLabel: s('kpi_paused_boards_label'),
      kpiPausedAvgLabel: s('kpi_paused_avg_label'),
      livePausedSectionTitle: s('live_paused_section_title'),
      activitySectionTitle: s('activity_section_title'),
      kpiHostFeeRevenueLabel: s('kpi_host_fee_revenue_label'),
      kpiEntryFeeRevenueLabel: s('kpi_entry_fee_revenue_label'),
      kpiEntryFeeGrossLabel: s('kpi_entry_fee_gross_label'),
      kpiEntryFeeCommissionLabel: s('kpi_entry_fee_commission_label'),
      kpiEntryFeeNetLabel: s('kpi_entry_fee_net_label'),
      commissionPercentLabel: s('commission_percent_label'),
      commissionBlurbTemplate: raw('commission_blurb_template'),
      paymentsCommissionLabel: s('payments_commission_label'),
      paymentsOrganizerNetLabel: s('payments_organizer_net_label'),
      kpiLastShareLabel: s('kpi_last_share_label'),
      analyticsTitle: s('analytics_title'),
      analyticsBlurb: s('analytics_blurb'),
      analyticsPlayersLabel: s('analytics_players_label'),
      analyticsCompletionLabel: s('analytics_completion_label'),
      analyticsStartedLabel: s('analytics_started_label'),
      analyticsHostFeeLabel: s('analytics_host_fee_label'),
      analyticsEntryFeesLabel: s('analytics_entry_fees_label'),
      analyticsCommissionLabel: s('analytics_commission_label'),
      analyticsEntryNetLabel: s('analytics_entry_net_label'),
      analyticsEmpty: s('analytics_empty'),
      analyticsMetricsNote: s('analytics_metrics_note'),
      patchTitleLocked: s('patch_title_locked'),
      uploadLogoFailed: s('upload_logo_failed'),
      visibilityLabel: s('visibility_label'),
      visibilityPrivateLabel: s('visibility_private_label'),
      visibilityPublicLabel: s('visibility_public_label'),
      visibilityPrivateBlurb: s('visibility_private_blurb'),
      visibilityPublicBlurb: s('visibility_public_blurb'),
      publicDisabled: s('public_disabled'),
      makePublicAction: s('make_public_action'),
      makePrivateAction: s('make_private_action'),
      visibilityChangeBlocked: s('visibility_change_blocked'),
      reportAction: s('report_action'),
      reportTitle: s('report_title'),
      reportReasonLabel: s('report_reason_label'),
      reportNoteLabel: s('report_note_label'),
      reportSubmitAction: s('report_submit_action'),
      reportToastSent: s('report_toast_sent'),
      reportToastFailed: s('report_toast_failed'),
      portalWalletLabel: s('portal_wallet_label'),
      portalReceiptsLabel: s('portal_receipts_label'),
      portalTransactionsLabel: s('portal_transactions_label'),
      portalOverviewLabel: s('portal_overview_label'),
      portalCreateLabel: s('portal_create_label'),
      portalPublicListLabel: s('portal_public_list_label'),
      portalMoneySectionTitle: s('portal_money_section_title'),
      portalPayoutLabel: s('portal_payout_label'),
      portalPayoutBlurb: s('portal_payout_blurb'),
      portalWalletHref: s('portal_wallet_href'),
      portalReceiptsHref: s('portal_receipts_href'),
      portalTransactionsHref: s('portal_transactions_href'),
      portalPayoutHref: s('portal_payout_href'),
      portalOverviewHref: s('portal_overview_href'),
      portalCreateHref: s('portal_create_href'),
      portalPublicListHref: s('portal_public_list_href'),
      publicListTitle: s('public_list_title'),
      publicListBlurb: s('public_list_blurb'),
      publicListEmpty: s('public_list_empty'),
      joinOpenAction: s('join_open_action'),
      forceAutoApproveNote: s('force_auto_approve_note'),
      uploadSponsorFailed: s('upload_sponsor_failed'),
      prizePoolDisplayLabel: s('prize_pool_display_label'),
      prizePoolDisplayBlurb: s('prize_pool_display_blurb'),
      prizePoolGuaranteeLabel: s('prize_pool_guarantee_label'),
      prizePoolGuaranteeBlurb: s('prize_pool_guarantee_blurb'),
      prizePoolGuaranteeAmountLabel: s('prize_pool_guarantee_amount_label'),
      prizePoolGuaranteeAmountPlaceholder:
          s('prize_pool_guarantee_amount_placeholder'),
      prizePoolNowLabel: s('prize_pool_now_label'),
      prizePoolIfFullLabel: s('prize_pool_if_full_label'),
      prizePoolGuaranteedLabel: s('prize_pool_guaranteed_label'),
      prizePoolFrozenBlurb: s('prize_pool_frozen_blurb'),
      prizePoolEntryFeesNote: s('prize_pool_entry_fees_note'),
      insufficientPrizeGuarantee: s('insufficient_prize_guarantee'),
      prizePoolUnavailable: s('prize_pool_unavailable'),
      errHostGuaranteeRequiresDocumentKyc:
          s('err_host_guarantee_requires_document_kyc'),
      errHostPaidRequiresPhoneKyc: s('err_host_paid_requires_phone_kyc'),
      errHostConcurrentOpenPaidCap: s('err_host_concurrent_open_paid_cap'),
      errHostReputationBlocked: s('err_host_reputation_blocked'),
      hostRepFinishedLabel: s('host_rep_finished_label'),
      hostRepCancelledLabel: s('host_rep_cancelled_label'),
      hostRepReportsLabel: s('host_rep_reports_label'),
      hostRepMetaSeparator: s('host_rep_meta_separator'),
      payoutModeLabel: s('payout_mode_label'),
      payoutModeBlurb: s('payout_mode_blurb'),
      payoutModePlacesPercentLabel: s('payout_mode_places_percent_label'),
      payoutModeScoreShareLabel: s('payout_mode_score_share_label'),
      payoutModeDualPurseLabel: s('payout_mode_dual_purse_label'),
      prizePlacePercentsSectionLabel: s('prize_place_percents_section_label'),
      prizePlacePercentsBlurb: s('prize_place_percents_blurb'),
      prizePlacePercent1Label: s('prize_place_percent_1_label'),
      prizePlacePercent1Placeholder: s('prize_place_percent_1_placeholder'),
      prizePlacePercent2Label: s('prize_place_percent_2_label'),
      prizePlacePercent2Placeholder: s('prize_place_percent_2_placeholder'),
      prizePlacePercent3Label: s('prize_place_percent_3_label'),
      prizePlacePercent3Placeholder: s('prize_place_percent_3_placeholder'),
      errPrizePlacePercentsSum: s('err_prize_place_percents_sum'),
      errPayoutModeInvalid: s('err_payout_mode_invalid'),
      errPayoutModeScoreShareKnockout:
          s('err_payout_mode_score_share_knockout'),
      errTitleRequired: s('err_title_required'),
      errFormatSizeRequired: s('err_format_size_required'),
      arenaDurationLabel: s('arena_duration_label'),
      arenaDurationRequired: s('arena_duration_required'),
      arenaDurationLengthPlaceholder: s('arena_duration_length_placeholder'),
      arenaDurationUnitLabel: s('arena_duration_unit_label'),
      arenaDurationUnitMinutes: s('arena_duration_unit_minutes'),
      arenaDurationUnitHours: s('arena_duration_unit_hours'),
      arenaDurationUnitDays: s('arena_duration_unit_days'),
      arenaDurationUnitWeeks: s('arena_duration_unit_weeks'),
      arenaDurationUnitMonths: s('arena_duration_unit_months'),
      arenaDurationModeLength: s('arena_duration_mode_length'),
      arenaDurationModeEndsAt: s('arena_duration_mode_ends_at'),
      arenaDurationEndsAtLabel: s('arena_duration_ends_at_label'),
      arenaDurationEndsAtPlaceholder: s('arena_duration_ends_at_placeholder'),
      arenaDurationEndsAtPast: s('arena_duration_ends_at_past'),
      arenaDurationBlurb: s('arena_duration_blurb'),
      arenaFinishAction: s('arena_finish_action'),
      arenaFinishPending: s('arena_finish_pending'),
      toastArenaFinished: s('toast_arena_finished'),
      toastArenaFinishFailed: s('toast_arena_finish_failed'),
      arenaFinishRequiresStarted: s('arena_finish_requires_started'),
      arenaFinishAlreadyFinished: s('arena_finish_already_finished'),
      descriptionLabel: s('description_label'),
      descriptionPlaceholder: s('description_placeholder'),
      prizeMediaSectionTitle: s('prize_media_section_title'),
      prizeMediaSectionBlurb: s('prize_media_section_blurb'),
      thumbnailLabel: s('thumbnail_label'),
      galleryLabel: s('gallery_label'),
      galleryAddAction: s('gallery_add_action'),
      galleryEmpty: s('gallery_empty'),
      thumbnailUploadAction: s('thumbnail_upload_action'),
      thumbnailUploadPending: s('thumbnail_upload_pending'),
      galleryUploadPending: s('gallery_upload_pending'),
      toastThumbnailSaved: s('toast_thumbnail_saved'),
      toastGallerySaved: s('toast_gallery_saved'),
      mediaUploadFailed: s('media_upload_failed'),
      galleryMaxSlots: s('gallery_max_slots'),
      gallerySlotsFmt: s('gallery_slots_fmt'),
      thumbnailMainBadge: s('thumbnail_main_badge'),
      thumbnailEmptyHint: s('thumbnail_empty_hint'),
      thumbnailHint: s('thumbnail_hint'),
      galleryLimitReached: s('gallery_limit_reached'),
    );
    return chrome.isReady ? chrome : null;
  }
}
