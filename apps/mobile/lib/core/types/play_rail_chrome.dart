/// DB-backed Play rail strings from GET /public/play-rail-chrome.
class PlayRailChrome {
  const PlayRailChrome({
    required this.source,
    required this.playRailChromeUnavailable,
    required this.tabNewGame,
    required this.tabGames,
    required this.tabPlayers,
    required this.subPlayAi,
    required this.subChallenge,
    required this.subWatch,
    required this.subHistory,
    required this.subFriends,
    required this.subFriendRequests,
    required this.subAllPlayers,
    required this.subDms,
    required this.dmsRequestsCountAria,
    required this.dmUnreadBadgeMax,
    required this.dmUnreadBadgeOverflowFmt,
    required this.dmsUnreadCountAria,
    required this.messageAction,
    required this.dmModalTitle,
    required this.dmSendAction,
    required this.dmSending,
    required this.dmInputPlaceholder,
    required this.dmEmptyRequests,
    required this.dmRequestPendingLabel,
    required this.dmRequestOutgoingLabel,
    required this.dmRequestDeniedLabel,
    required this.dmRequestCancelledLabel,
    required this.dmAcceptAction,
    required this.dmAccepting,
    required this.dmDenyAction,
    required this.dmDenying,
    required this.dmCancelAction,
    required this.dmCancelling,
    required this.dmPreviewMaxChars,
    required this.dmPreviewTruncateSuffix,
    required this.dmImagePreviewLabel,
    required this.chatReplyPreviewMaxChars,
    required this.chatLoading,
    required this.dmChatLoading,
    required this.chatPollIntervalMs,
    required this.dmPollIntervalMs,
    required this.dmRequestsPollIntervalMs,
    required this.moreOptionsAria,
    required this.chatEmojiSet,
    required this.dmToastSent,
    required this.dmToastAccepted,
    required this.dmToastDenied,
    required this.dmToastCancelled,
    required this.dmToastFailed,
    required this.dmChatEmpty,
    required this.dmReplyAction,
    required this.dmReplyCancel,
    required this.dmAttachImageAria,
    required this.dmEmojiAria,
    required this.dmWordsLabel,
    required this.removeImageAria,
    required this.watchTabMoves,
    required this.watchTabChat,
    required this.watchTabInfo,
    required this.watchPanelBackAction,
    required this.watchPanelBackAria,
    required this.voteScoreSeparator,
    required this.observingGameLabel,
    required this.chatDisabledLabel,
    required this.chatEnabledLabel,
    required this.chatDisableAction,
    required this.chatEnableAction,
    required this.chatDisablePending,
    required this.chatEnablePending,
    required this.chatInputPlaceholder,
    required this.chatSendAction,
    required this.chatSending,
    required this.chatReplyAction,
    required this.chatReplyCancel,
    required this.chatAttachImageAria,
    required this.chatEmpty,
    required this.chatImageOnlyHint,
    required this.chatToastDisabled,
    required this.chatToastSendFailed,
    required this.chatToastToggleFailed,
    required this.chatEmojiAria,
    required this.chatJoinRequiredLabel,
    required this.chatLoadFailedLabel,
    required this.dmOpenFailed,
    required this.dmLoadFailedLabel,
    required this.chatEmojiSearchPlaceholder,
    required this.chatEmojiSearchEmpty,
    required this.chatEmojiResultsPrefix,
    required this.chatReactAction,
    required this.chatReactMoreAria,
    required this.chatYouLabel,
    required this.chatReplyLabel,
    required this.chatReceiptSentAria,
    required this.chatReceiptSeenAria,
    required this.chatReceiptDeliveredAria,
    required this.chatSeenByPrefix,
    required this.chatImageFallbackLabel,
    required this.chatReceiptSentGlyph,
    required this.chatReceiptReadGlyph,
    required this.chatReceiptDeliveredGlyph,
    required this.chatSeenCountGlyph,
    required this.chatReceiptPendingAria,
    required this.chatReceiptPendingGlyph,
    required this.chatReceiptFailedAria,
    required this.chatReceiptFailedGlyph,
    required this.chatReceiptRetryAction,
    required this.chatMediaLightboxTitle,
    required this.chatMediaLightboxCloseAria,
    required this.chatDateToday,
    required this.chatDateYesterday,
    required this.matchIntroVsLabel,
    required this.matchIntroDurationMs,
    required this.matchIntroAria,
    this.matchIntroStartingLabel = '',
    this.matchResultDurationMs = '',
    this.matchResultWinAria = '',
    this.matchResultLossAria = '',
    this.matchResultDrawAria = '',
    this.matchResultWinOnTimeAria = '',
    this.matchResultLossOnTimeAria = '',
    this.matchResultDrawOnTimeAria = '',
    required this.labelOpponent,
    required this.labelTime,
    required this.labelIPlayAs,
    required this.labelRated,
    required this.labelUnrated,
    required this.labelColors,
    required this.labelBoard,
    required this.labelPieces,
    required this.labelRating,
    required this.searchUsernamePlaceholder,
    required this.searchOpponentPlaceholder,
    required this.sendChallengeAction,
    required this.sendingChallenge,
    required this.challengeLinkAction,
    required this.copiedAction,
    required this.copiedShareBlurb,
    required this.signInToChallenge,
    required this.findMatchmakingAction,
    required this.watchGameAction,
    required this.challengeAction,
    required this.addFriendAction,
    required this.removeFriendAction,
    required this.removingFriend,
    required this.sendFriendRequestAction,
    required this.sendingFriendRequest,
    required this.acceptFriendRequestAction,
    required this.acceptingFriendRequest,
    required this.denyFriendRequestAction,
    required this.denyingFriendRequest,
    required this.cancelFriendRequestAction,
    required this.cancellingFriendRequest,
    required this.friendRequestPendingLabel,
    required this.friendRequestOutgoingLabel,
    required this.friendRequestDeniedLabel,
    required this.emptyFriendRequests,
    required this.toastFriendRequestSent,
    required this.toastFriendRequestAccepted,
    required this.toastFriendRequestDenied,
    required this.toastFriendRequestCancelled,
    required this.toastFriendRequestFailed,
    required this.friendRequestAlreadyFriends,
    required this.viewProfileAction,
    required this.friendRequestsCountAria,
    required this.countryFlagImageUrlTemplate,
    required this.onlineLabel,
    required this.playingLabel,
    required this.offlineLabel,
    required this.emptyLiveGames,
    required this.emptyHistory,
    required this.emptyFriends,
    required this.emptyPlayers,
    required this.loadingLive,
    required this.loadingHistory,
    required this.loadingPlayers,
    required this.signInHistory,
    required this.signInFriends,
    required this.outcomeWin,
    required this.outcomeLoss,
    required this.outcomeDraw,
    required this.movesSuffix,
    required this.metaSeparator,
    required this.statsSeparator,
    required this.winsAbbr,
    required this.lossesAbbr,
    required this.modeAi,
    required this.modePvp,
    required this.ratingParenOpen,
    required this.ratingParenClose,
    required this.toastEnterUsername,
    required this.toastSignInChallenge,
    required this.toastChallengeSentPrefix,
    required this.toastChallengeFailed,
    required this.toastInviteYourself,
    required this.toastCopyFailed,
    required this.toastSendLinkFirst,
    required this.toastFriendAdded,
    required this.toastFriendRemoved,
    required this.toastFriendFailed,
    required this.toastTimeControlUnavailable,
    required this.toastChallengeAcceptFailed,
    required this.toastGameUnavailable,
    required this.ariaColorWhite,
    required this.ariaColorBlack,
    required this.ariaColorRandom,
    required this.colorPrefNote,
    required this.boardView2d,
    required this.boardView3d,
    required this.shareWatchAction,
    required this.flipBoardAria,
    required this.shareGameAria,
    required this.createGameTitle,
    required this.resumeGameAction,
    required this.newGameModesAria,
    required this.webAppOrigin,
    required this.labelPlayers,
    required this.labelViewers,
    required this.labelGameId,
    required this.vsSeparator,
    required this.viewersOverflowPrefix,
    required this.joinGameAction,
    required this.downloadQrAction,
    required this.downloadQrPending,
    required this.qrPreviewAria,
    required this.qrLightboxCloseAria,
    required this.qrUnavailable,
    required this.toastQrDownloadFailed,
    required this.liveGamePopoverTitle,
    required this.gamesPlayedAbbr,
    required this.drawsAbbr,
    required this.idTruncateChars,
    required this.idTruncateSuffix,
    required this.viewersEmptyCount,
    required this.searchDebounceMs,
    required this.livePlayerNameMaxChars,
    required this.nameTruncateSuffix,
    required this.liveViewersTitle,
    required this.backToLiveGames,
    required this.emptyLiveViewers,
    required this.loadingLiveViewers,
    required this.listPageSize,
    required this.loadingMore,
  });

  final String source;
  final String playRailChromeUnavailable;
  final String tabNewGame;
  final String tabGames;
  final String tabPlayers;
  final String subPlayAi;
  final String subChallenge;
  final String subWatch;
  final String subHistory;
  final String subFriends;
  final String subFriendRequests;
  final String subAllPlayers;
  final String subDms;
  final String dmsRequestsCountAria;
  final String dmUnreadBadgeMax;
  final String dmUnreadBadgeOverflowFmt;
  final String dmsUnreadCountAria;
  final String messageAction;
  final String dmModalTitle;
  final String dmSendAction;
  final String dmSending;
  final String dmInputPlaceholder;
  final String dmEmptyRequests;
  final String dmRequestPendingLabel;
  final String dmRequestOutgoingLabel;
  final String dmRequestDeniedLabel;
  final String dmRequestCancelledLabel;
  final String dmAcceptAction;
  final String dmAccepting;
  final String dmDenyAction;
  final String dmDenying;
  final String dmCancelAction;
  final String dmCancelling;
  final String dmPreviewMaxChars;
  final String dmPreviewTruncateSuffix;
  final String dmImagePreviewLabel;
  final String chatReplyPreviewMaxChars;
  final String chatLoading;
  final String dmChatLoading;
  final String chatPollIntervalMs;
  final String dmPollIntervalMs;
  final String dmRequestsPollIntervalMs;
  final String moreOptionsAria;
  final String chatEmojiSet;
  final String dmToastSent;
  final String dmToastAccepted;
  final String dmToastDenied;
  final String dmToastCancelled;
  final String dmToastFailed;
  final String dmChatEmpty;
  final String dmReplyAction;
  final String dmReplyCancel;
  final String dmAttachImageAria;
  final String dmEmojiAria;
  final String dmWordsLabel;
  final String removeImageAria;
  final String watchTabMoves;
  final String watchTabChat;
  final String watchTabInfo;
  final String watchPanelBackAction;
  final String watchPanelBackAria;
  final String voteScoreSeparator;
  final String observingGameLabel;
  final String chatDisabledLabel;
  final String chatEnabledLabel;
  final String chatDisableAction;
  final String chatEnableAction;
  final String chatDisablePending;
  final String chatEnablePending;
  final String chatInputPlaceholder;
  final String chatSendAction;
  final String chatSending;
  final String chatReplyAction;
  final String chatReplyCancel;
  final String chatAttachImageAria;
  final String chatEmpty;
  final String chatImageOnlyHint;
  final String chatToastDisabled;
  final String chatToastSendFailed;
  final String chatToastToggleFailed;
  final String chatEmojiAria;
  final String chatJoinRequiredLabel;
  final String chatLoadFailedLabel;
  final String dmOpenFailed;
  final String dmLoadFailedLabel;
  final String chatEmojiSearchPlaceholder;
  final String chatEmojiSearchEmpty;
  final String chatEmojiResultsPrefix;
  final String chatReactAction;
  final String chatReactMoreAria;
  final String chatYouLabel;
  final String chatReplyLabel;
  final String chatReceiptSentAria;
  final String chatReceiptSeenAria;
  final String chatReceiptDeliveredAria;
  final String chatSeenByPrefix;
  final String chatImageFallbackLabel;
  final String chatReceiptSentGlyph;
  final String chatReceiptReadGlyph;
  final String chatReceiptDeliveredGlyph;
  final String chatSeenCountGlyph;
  final String chatReceiptPendingAria;
  final String chatReceiptPendingGlyph;
  final String chatReceiptFailedAria;
  final String chatReceiptFailedGlyph;
  final String chatReceiptRetryAction;
  final String chatMediaLightboxTitle;
  final String chatMediaLightboxCloseAria;
  final String chatDateToday;
  final String chatDateYesterday;
  final String matchIntroVsLabel;
  final String matchIntroDurationMs;
  final String matchIntroAria;
  final String matchIntroStartingLabel;
  final String matchResultDurationMs;
  final String matchResultWinAria;
  final String matchResultLossAria;
  final String matchResultDrawAria;
  final String matchResultWinOnTimeAria;
  final String matchResultLossOnTimeAria;
  final String matchResultDrawOnTimeAria;
  final String labelOpponent;
  final String labelTime;
  final String labelIPlayAs;
  final String labelRated;
  final String labelUnrated;
  final String labelColors;
  final String labelBoard;
  final String labelPieces;
  final String labelRating;
  final String searchUsernamePlaceholder;
  final String searchOpponentPlaceholder;
  final String sendChallengeAction;
  final String sendingChallenge;
  final String challengeLinkAction;
  final String copiedAction;
  final String copiedShareBlurb;
  final String signInToChallenge;
  final String findMatchmakingAction;
  final String watchGameAction;
  final String challengeAction;
  final String addFriendAction;
  final String removeFriendAction;
  final String removingFriend;
  final String sendFriendRequestAction;
  final String sendingFriendRequest;
  final String acceptFriendRequestAction;
  final String acceptingFriendRequest;
  final String denyFriendRequestAction;
  final String denyingFriendRequest;
  final String cancelFriendRequestAction;
  final String cancellingFriendRequest;
  final String friendRequestPendingLabel;
  final String friendRequestOutgoingLabel;
  final String friendRequestDeniedLabel;
  final String emptyFriendRequests;
  final String toastFriendRequestSent;
  final String toastFriendRequestAccepted;
  final String toastFriendRequestDenied;
  final String toastFriendRequestCancelled;
  final String toastFriendRequestFailed;
  final String friendRequestAlreadyFriends;
  final String viewProfileAction;
  final String friendRequestsCountAria;

  /// Colored flag URL template with `{code}` (ISO-2 lowercase).
  final String countryFlagImageUrlTemplate;
  final String onlineLabel;
  final String playingLabel;
  final String offlineLabel;
  final String emptyLiveGames;
  final String emptyHistory;
  final String emptyFriends;
  final String emptyPlayers;
  final String loadingLive;
  final String loadingHistory;
  final String loadingPlayers;
  final String signInHistory;
  final String signInFriends;
  final String outcomeWin;
  final String outcomeLoss;
  final String outcomeDraw;
  final String movesSuffix;
  final String metaSeparator;
  final String statsSeparator;
  final String winsAbbr;
  final String lossesAbbr;
  final String modeAi;
  final String modePvp;
  final String ratingParenOpen;
  final String ratingParenClose;
  final String toastEnterUsername;
  final String toastSignInChallenge;
  final String toastChallengeSentPrefix;
  final String toastChallengeFailed;
  final String toastInviteYourself;
  final String toastCopyFailed;
  final String toastSendLinkFirst;
  final String toastFriendAdded;
  final String toastFriendRemoved;
  final String toastFriendFailed;
  final String toastTimeControlUnavailable;
  final String toastChallengeAcceptFailed;
  final String toastGameUnavailable;
  final String ariaColorWhite;
  final String ariaColorBlack;
  final String ariaColorRandom;
  final String colorPrefNote;
  final String boardView2d;
  final String boardView3d;
  final String shareWatchAction;
  final String flipBoardAria;
  final String shareGameAria;
  final String createGameTitle;
  final String resumeGameAction;
  final String newGameModesAria;

  /// Absolute https origin for challenge/share deep links (platform_settings).
  final String webAppOrigin;
  final String labelPlayers;
  final String labelViewers;
  final String labelGameId;
  final String vsSeparator;
  final String viewersOverflowPrefix;
  final String joinGameAction;
  final String downloadQrAction;
  final String downloadQrPending;
  final String qrPreviewAria;
  final String qrLightboxCloseAria;
  final String qrUnavailable;
  final String toastQrDownloadFailed;
  final String liveGamePopoverTitle;
  final String gamesPlayedAbbr;
  final String drawsAbbr;
  final String idTruncateChars;
  final String idTruncateSuffix;
  final String viewersEmptyCount;
  final String searchDebounceMs;
  final String livePlayerNameMaxChars;
  final String nameTruncateSuffix;
  final String liveViewersTitle;
  final String backToLiveGames;
  final String emptyLiveViewers;
  final String loadingLiveViewers;
  final String listPageSize;
  final String loadingMore;

  bool get isReady =>
      source.isNotEmpty &&
      playRailChromeUnavailable.isNotEmpty &&
      tabNewGame.isNotEmpty &&
      tabGames.isNotEmpty &&
      tabPlayers.isNotEmpty &&
      subPlayAi.isNotEmpty &&
      subChallenge.isNotEmpty &&
      subWatch.isNotEmpty &&
      subHistory.isNotEmpty &&
      subFriends.isNotEmpty &&
      subFriendRequests.isNotEmpty &&
      subAllPlayers.isNotEmpty &&
      subDms.isNotEmpty &&
      dmsRequestsCountAria.isNotEmpty &&
      dmUnreadBadgeMax.isNotEmpty &&
      dmUnreadBadgeOverflowFmt.isNotEmpty &&
      dmsUnreadCountAria.isNotEmpty &&
      messageAction.isNotEmpty &&
      dmModalTitle.isNotEmpty &&
      dmSendAction.isNotEmpty &&
      dmSending.isNotEmpty &&
      dmInputPlaceholder.isNotEmpty &&
      dmEmptyRequests.isNotEmpty &&
      dmRequestPendingLabel.isNotEmpty &&
      dmRequestOutgoingLabel.isNotEmpty &&
      dmRequestDeniedLabel.isNotEmpty &&
      dmRequestCancelledLabel.isNotEmpty &&
      dmAcceptAction.isNotEmpty &&
      dmAccepting.isNotEmpty &&
      dmDenyAction.isNotEmpty &&
      dmDenying.isNotEmpty &&
      dmCancelAction.isNotEmpty &&
      dmCancelling.isNotEmpty &&
      dmPreviewMaxChars.isNotEmpty &&
      dmPreviewTruncateSuffix.isNotEmpty &&
      dmImagePreviewLabel.isNotEmpty &&
      chatReplyPreviewMaxChars.isNotEmpty &&
      chatLoading.isNotEmpty &&
      dmChatLoading.isNotEmpty &&
      chatPollIntervalMs.isNotEmpty &&
      dmPollIntervalMs.isNotEmpty &&
      dmRequestsPollIntervalMs.isNotEmpty &&
      moreOptionsAria.isNotEmpty &&
      chatEmojiSet.isNotEmpty &&
      dmToastSent.isNotEmpty &&
      dmToastAccepted.isNotEmpty &&
      dmToastDenied.isNotEmpty &&
      dmToastCancelled.isNotEmpty &&
      dmToastFailed.isNotEmpty &&
      dmChatEmpty.isNotEmpty &&
      dmReplyAction.isNotEmpty &&
      dmReplyCancel.isNotEmpty &&
      dmAttachImageAria.isNotEmpty &&
      dmEmojiAria.isNotEmpty &&
      dmWordsLabel.isNotEmpty &&
      removeImageAria.isNotEmpty &&
      watchTabMoves.isNotEmpty &&
      watchTabChat.isNotEmpty &&
      watchTabInfo.isNotEmpty &&
      watchPanelBackAction.isNotEmpty &&
      watchPanelBackAria.isNotEmpty &&
      voteScoreSeparator.isNotEmpty &&
      observingGameLabel.isNotEmpty &&
      chatDisabledLabel.isNotEmpty &&
      chatEnabledLabel.isNotEmpty &&
      chatDisableAction.isNotEmpty &&
      chatEnableAction.isNotEmpty &&
      chatDisablePending.isNotEmpty &&
      chatEnablePending.isNotEmpty &&
      chatInputPlaceholder.isNotEmpty &&
      chatSendAction.isNotEmpty &&
      chatSending.isNotEmpty &&
      chatReplyAction.isNotEmpty &&
      chatReplyCancel.isNotEmpty &&
      chatAttachImageAria.isNotEmpty &&
      chatEmpty.isNotEmpty &&
      chatImageOnlyHint.isNotEmpty &&
      chatToastDisabled.isNotEmpty &&
      chatToastSendFailed.isNotEmpty &&
      chatToastToggleFailed.isNotEmpty &&
      chatEmojiAria.isNotEmpty &&
      chatJoinRequiredLabel.isNotEmpty &&
      chatLoadFailedLabel.isNotEmpty &&
      dmOpenFailed.isNotEmpty &&
      dmLoadFailedLabel.isNotEmpty &&
      chatEmojiSearchPlaceholder.isNotEmpty &&
      chatEmojiSearchEmpty.isNotEmpty &&
      chatEmojiResultsPrefix.isNotEmpty &&
      chatReactAction.isNotEmpty &&
      chatReactMoreAria.isNotEmpty &&
      chatYouLabel.isNotEmpty &&
      chatReplyLabel.isNotEmpty &&
      chatReceiptSentAria.isNotEmpty &&
      chatReceiptSeenAria.isNotEmpty &&
      chatReceiptDeliveredAria.isNotEmpty &&
      chatSeenByPrefix.isNotEmpty &&
      chatImageFallbackLabel.isNotEmpty &&
      chatReceiptSentGlyph.isNotEmpty &&
      chatReceiptReadGlyph.isNotEmpty &&
      chatReceiptDeliveredGlyph.isNotEmpty &&
      chatSeenCountGlyph.isNotEmpty &&
      chatReceiptPendingAria.isNotEmpty &&
      chatReceiptPendingGlyph.isNotEmpty &&
      chatReceiptFailedAria.isNotEmpty &&
      chatReceiptFailedGlyph.isNotEmpty &&
      chatReceiptRetryAction.isNotEmpty &&
      chatMediaLightboxTitle.isNotEmpty &&
      chatMediaLightboxCloseAria.isNotEmpty &&
      chatDateToday.isNotEmpty &&
      chatDateYesterday.isNotEmpty &&
      matchIntroVsLabel.isNotEmpty &&
      matchIntroDurationMs.isNotEmpty &&
      matchIntroAria.isNotEmpty &&
      matchIntroStartingLabel.isNotEmpty &&
      matchResultDurationMs.isNotEmpty &&
      matchResultWinAria.isNotEmpty &&
      matchResultLossAria.isNotEmpty &&
      matchResultDrawAria.isNotEmpty &&
      matchResultWinOnTimeAria.isNotEmpty &&
      matchResultLossOnTimeAria.isNotEmpty &&
      matchResultDrawOnTimeAria.isNotEmpty &&
      labelOpponent.isNotEmpty &&
      labelTime.isNotEmpty &&
      labelIPlayAs.isNotEmpty &&
      labelRated.isNotEmpty &&
      labelUnrated.isNotEmpty &&
      labelColors.isNotEmpty &&
      labelBoard.isNotEmpty &&
      labelPieces.isNotEmpty &&
      labelRating.isNotEmpty &&
      searchUsernamePlaceholder.isNotEmpty &&
      searchOpponentPlaceholder.isNotEmpty &&
      sendChallengeAction.isNotEmpty &&
      sendingChallenge.isNotEmpty &&
      challengeLinkAction.isNotEmpty &&
      copiedAction.isNotEmpty &&
      copiedShareBlurb.isNotEmpty &&
      signInToChallenge.isNotEmpty &&
      findMatchmakingAction.isNotEmpty &&
      watchGameAction.isNotEmpty &&
      challengeAction.isNotEmpty &&
      addFriendAction.isNotEmpty &&
      removeFriendAction.isNotEmpty &&
      removingFriend.isNotEmpty &&
      sendFriendRequestAction.isNotEmpty &&
      sendingFriendRequest.isNotEmpty &&
      acceptFriendRequestAction.isNotEmpty &&
      acceptingFriendRequest.isNotEmpty &&
      denyFriendRequestAction.isNotEmpty &&
      denyingFriendRequest.isNotEmpty &&
      cancelFriendRequestAction.isNotEmpty &&
      cancellingFriendRequest.isNotEmpty &&
      friendRequestPendingLabel.isNotEmpty &&
      friendRequestOutgoingLabel.isNotEmpty &&
      friendRequestDeniedLabel.isNotEmpty &&
      emptyFriendRequests.isNotEmpty &&
      toastFriendRequestSent.isNotEmpty &&
      toastFriendRequestAccepted.isNotEmpty &&
      toastFriendRequestDenied.isNotEmpty &&
      toastFriendRequestCancelled.isNotEmpty &&
      toastFriendRequestFailed.isNotEmpty &&
      friendRequestAlreadyFriends.isNotEmpty &&
      viewProfileAction.isNotEmpty &&
      friendRequestsCountAria.isNotEmpty &&
      countryFlagImageUrlTemplate.contains('{code}') &&
      onlineLabel.isNotEmpty &&
      playingLabel.isNotEmpty &&
      offlineLabel.isNotEmpty &&
      emptyLiveGames.isNotEmpty &&
      emptyHistory.isNotEmpty &&
      emptyFriends.isNotEmpty &&
      emptyPlayers.isNotEmpty &&
      loadingLive.isNotEmpty &&
      loadingHistory.isNotEmpty &&
      loadingPlayers.isNotEmpty &&
      signInHistory.isNotEmpty &&
      signInFriends.isNotEmpty &&
      outcomeWin.isNotEmpty &&
      outcomeLoss.isNotEmpty &&
      outcomeDraw.isNotEmpty &&
      movesSuffix.isNotEmpty &&
      metaSeparator.isNotEmpty &&
      statsSeparator.isNotEmpty &&
      winsAbbr.isNotEmpty &&
      lossesAbbr.isNotEmpty &&
      modeAi.isNotEmpty &&
      modePvp.isNotEmpty &&
      ratingParenOpen.isNotEmpty &&
      ratingParenClose.isNotEmpty &&
      toastEnterUsername.isNotEmpty &&
      toastSignInChallenge.isNotEmpty &&
      toastChallengeSentPrefix.isNotEmpty &&
      toastChallengeFailed.isNotEmpty &&
      toastInviteYourself.isNotEmpty &&
      toastCopyFailed.isNotEmpty &&
      toastSendLinkFirst.isNotEmpty &&
      toastFriendAdded.isNotEmpty &&
      toastFriendRemoved.isNotEmpty &&
      toastFriendFailed.isNotEmpty &&
      toastTimeControlUnavailable.isNotEmpty &&
      toastChallengeAcceptFailed.isNotEmpty &&
      toastGameUnavailable.isNotEmpty &&
      ariaColorWhite.isNotEmpty &&
      ariaColorBlack.isNotEmpty &&
      ariaColorRandom.isNotEmpty &&
      colorPrefNote.isNotEmpty &&
      boardView2d.isNotEmpty &&
      boardView3d.isNotEmpty &&
      shareWatchAction.isNotEmpty &&
      flipBoardAria.isNotEmpty &&
      shareGameAria.isNotEmpty &&
      createGameTitle.isNotEmpty &&
      resumeGameAction.isNotEmpty &&
      newGameModesAria.isNotEmpty &&
      labelPlayers.isNotEmpty &&
      labelViewers.isNotEmpty &&
      labelGameId.isNotEmpty &&
      vsSeparator.isNotEmpty &&
      viewersOverflowPrefix.isNotEmpty &&
      joinGameAction.isNotEmpty &&
      downloadQrAction.isNotEmpty &&
      downloadQrPending.isNotEmpty &&
      qrPreviewAria.isNotEmpty &&
      qrLightboxCloseAria.isNotEmpty &&
      qrUnavailable.isNotEmpty &&
      toastQrDownloadFailed.isNotEmpty &&
      liveGamePopoverTitle.isNotEmpty &&
      gamesPlayedAbbr.isNotEmpty &&
      drawsAbbr.isNotEmpty &&
      idTruncateChars.isNotEmpty &&
      idTruncateSuffix.isNotEmpty &&
      viewersEmptyCount.isNotEmpty &&
      searchDebounceMs.isNotEmpty &&
      livePlayerNameMaxChars.isNotEmpty &&
      nameTruncateSuffix.isNotEmpty &&
      liveViewersTitle.isNotEmpty &&
      backToLiveGames.isNotEmpty &&
      emptyLiveViewers.isNotEmpty &&
      loadingLiveViewers.isNotEmpty &&
      listPageSize.isNotEmpty &&
      loadingMore.isNotEmpty;
  // webAppOrigin may be empty - share/challenge URL builders fail closed.

  static PlayRailChrome? fromJson(Map<String, dynamic>? map) {
    if (map == null) return null;
    String s(String k) => (map[k] as String?) ?? '';
    final chrome = PlayRailChrome(
      source: s('source').trim(),
      playRailChromeUnavailable: s('play_rail_chrome_unavailable').trim(),
      tabNewGame: s('tab_new_game').trim(),
      tabGames: s('tab_games').trim(),
      tabPlayers: s('tab_players').trim(),
      subPlayAi: s('sub_play_ai').trim(),
      subChallenge: s('sub_challenge').trim(),
      subWatch: s('sub_watch').trim(),
      subHistory: s('sub_history').trim(),
      subFriends: s('sub_friends').trim(),
      subFriendRequests: s('sub_friend_requests').trim(),
      subAllPlayers: s('sub_all_players').trim(),
      subDms: s('sub_dms').trim(),
      dmsRequestsCountAria: s('dms_requests_count_aria').trim(),
      dmUnreadBadgeMax: s('dm_unread_badge_max').trim(),
      dmUnreadBadgeOverflowFmt: s('dm_unread_badge_overflow_fmt').trim(),
      dmsUnreadCountAria: s('dms_unread_count_aria').trim(),
      messageAction: s('message_action').trim(),
      dmModalTitle: s('dm_modal_title').trim(),
      dmSendAction: s('dm_send_action').trim(),
      dmSending: s('dm_sending').trim(),
      dmInputPlaceholder: s('dm_input_placeholder').trim(),
      dmEmptyRequests: s('dm_empty_requests').trim(),
      dmRequestPendingLabel: s('dm_request_pending_label').trim(),
      dmRequestOutgoingLabel: s('dm_request_outgoing_label').trim(),
      dmRequestDeniedLabel: s('dm_request_denied_label').trim(),
      dmRequestCancelledLabel: s('dm_request_cancelled_label').trim(),
      dmAcceptAction: s('dm_accept_action').trim(),
      dmAccepting: s('dm_accepting').trim(),
      dmDenyAction: s('dm_deny_action').trim(),
      dmDenying: s('dm_denying').trim(),
      dmCancelAction: s('dm_cancel_action').trim(),
      dmCancelling: s('dm_cancelling').trim(),
      dmPreviewMaxChars: s('dm_preview_max_chars').trim(),
      dmPreviewTruncateSuffix: s('dm_preview_truncate_suffix').trim(),
      dmImagePreviewLabel: s('dm_image_preview_label').trim(),
      chatReplyPreviewMaxChars: s('chat_reply_preview_max_chars').trim(),
      chatLoading: s('chat_loading').trim(),
      dmChatLoading: s('dm_chat_loading').trim(),
      chatPollIntervalMs: s('chat_poll_interval_ms').trim(),
      dmPollIntervalMs: s('dm_poll_interval_ms').trim(),
      dmRequestsPollIntervalMs: s('dm_requests_poll_interval_ms').trim(),
      moreOptionsAria: s('more_options_aria').trim(),
      chatEmojiSet: s('chat_emoji_set').trim(),
      dmToastSent: s('dm_toast_sent').trim(),
      dmToastAccepted: s('dm_toast_accepted').trim(),
      dmToastDenied: s('dm_toast_denied').trim(),
      dmToastCancelled: s('dm_toast_cancelled').trim(),
      dmToastFailed: s('dm_toast_failed').trim(),
      dmChatEmpty: s('dm_chat_empty').trim(),
      dmReplyAction: s('dm_reply_action').trim(),
      dmReplyCancel: s('dm_reply_cancel').trim(),
      dmAttachImageAria: s('dm_attach_image_aria').trim(),
      dmEmojiAria: s('dm_emoji_aria').trim(),
      dmWordsLabel: s('dm_words_label').trim(),
      removeImageAria: s('remove_image_aria').trim(),
      watchTabMoves: s('watch_tab_moves').trim(),
      watchTabChat: s('watch_tab_chat').trim(),
      watchTabInfo: s('watch_tab_info').trim(),
      watchPanelBackAction: s('watch_panel_back_action').trim(),
      watchPanelBackAria: s('watch_panel_back_aria').trim(),
      voteScoreSeparator: s('vote_score_separator').trim(),
      observingGameLabel: s('observing_game_label').trim(),
      chatDisabledLabel: s('chat_disabled_label').trim(),
      chatEnabledLabel: s('chat_enabled_label').trim(),
      chatDisableAction: s('chat_disable_action').trim(),
      chatEnableAction: s('chat_enable_action').trim(),
      chatDisablePending: s('chat_disable_pending').trim(),
      chatEnablePending: s('chat_enable_pending').trim(),
      chatInputPlaceholder: s('chat_input_placeholder').trim(),
      chatSendAction: s('chat_send_action').trim(),
      chatSending: s('chat_sending').trim(),
      chatReplyAction: s('chat_reply_action').trim(),
      chatReplyCancel: s('chat_reply_cancel').trim(),
      chatAttachImageAria: s('chat_attach_image_aria').trim(),
      chatEmpty: s('chat_empty').trim(),
      chatImageOnlyHint: s('chat_image_only_hint').trim(),
      chatToastDisabled: s('chat_toast_disabled').trim(),
      chatToastSendFailed: s('chat_toast_send_failed').trim(),
      chatToastToggleFailed: s('chat_toast_toggle_failed').trim(),
      chatEmojiAria: s('chat_emoji_aria').trim(),
      chatJoinRequiredLabel: s('chat_join_required_label').trim(),
      chatLoadFailedLabel: s('chat_load_failed_label').trim(),
      dmOpenFailed: s('dm_open_failed').trim(),
      dmLoadFailedLabel: s('dm_load_failed_label').trim(),
      chatEmojiSearchPlaceholder: s('chat_emoji_search_placeholder').trim(),
      chatEmojiSearchEmpty: s('chat_emoji_search_empty').trim(),
      chatEmojiResultsPrefix: s('chat_emoji_results_prefix').trim(),
      chatReactAction: s('chat_react_action').trim(),
      chatReactMoreAria: s('chat_react_more_aria').trim(),
      chatYouLabel: s('chat_you_label').trim(),
      chatReplyLabel: s('chat_reply_label').trim(),
      chatReceiptSentAria: s('chat_receipt_sent_aria').trim(),
      chatReceiptSeenAria: s('chat_receipt_seen_aria').trim(),
      chatReceiptDeliveredAria: s('chat_receipt_delivered_aria').trim(),
      chatSeenByPrefix: s('chat_seen_by_prefix').trim(),
      chatImageFallbackLabel: s('chat_image_fallback_label').trim(),
      chatReceiptSentGlyph: s('chat_receipt_sent_glyph').trim(),
      chatReceiptReadGlyph: s('chat_receipt_read_glyph').trim(),
      chatReceiptDeliveredGlyph: s('chat_receipt_delivered_glyph').trim(),
      chatSeenCountGlyph: s('chat_seen_count_glyph').trim(),
      chatReceiptPendingAria: s('chat_receipt_pending_aria').trim(),
      chatReceiptPendingGlyph: s('chat_receipt_pending_glyph').trim(),
      chatReceiptFailedAria: s('chat_receipt_failed_aria').trim(),
      chatReceiptFailedGlyph: s('chat_receipt_failed_glyph').trim(),
      chatReceiptRetryAction: s('chat_receipt_retry_action').trim(),
      chatMediaLightboxTitle: s('chat_media_lightbox_title').trim(),
      chatMediaLightboxCloseAria: s('chat_media_lightbox_close_aria').trim(),
      chatDateToday: s('chat_date_today').trim(),
      chatDateYesterday: s('chat_date_yesterday').trim(),
      matchIntroVsLabel: s('match_intro_vs_label').trim(),
      matchIntroDurationMs: s('match_intro_duration_ms').trim(),
      matchIntroAria: s('match_intro_aria').trim(),
      matchIntroStartingLabel: s('match_intro_starting_label').trim(),
      matchResultDurationMs: s('match_result_duration_ms').trim(),
      matchResultWinAria: s('match_result_win_aria').trim(),
      matchResultLossAria: s('match_result_loss_aria').trim(),
      matchResultDrawAria: s('match_result_draw_aria').trim(),
      matchResultWinOnTimeAria: s('match_result_win_on_time_aria').trim(),
      matchResultLossOnTimeAria: s('match_result_loss_on_time_aria').trim(),
      matchResultDrawOnTimeAria: s('match_result_draw_on_time_aria').trim(),
      labelOpponent: s('label_opponent').trim(),
      labelTime: s('label_time').trim(),
      labelIPlayAs: s('label_i_play_as').trim(),
      labelRated: s('label_rated').trim(),
      labelUnrated: s('label_unrated').trim(),
      labelColors: s('label_colors').trim(),
      labelBoard: s('label_board').trim(),
      labelPieces: s('label_pieces').trim(),
      labelRating: s('label_rating').trim(),
      searchUsernamePlaceholder: s('search_username_placeholder').trim(),
      searchOpponentPlaceholder: s('search_opponent_placeholder').trim(),
      sendChallengeAction: s('send_challenge_action').trim(),
      sendingChallenge: s('sending_challenge').trim(),
      challengeLinkAction: s('challenge_link_action').trim(),
      copiedAction: s('copied_action').trim(),
      copiedShareBlurb: s('copied_share_blurb').trim(),
      signInToChallenge: s('sign_in_to_challenge').trim(),
      findMatchmakingAction: s('find_matchmaking_action').trim(),
      watchGameAction: s('watch_game_action').trim(),
      challengeAction: s('challenge_action').trim(),
      addFriendAction: s('add_friend_action').trim(),
      removeFriendAction: s('remove_friend_action').trim(),
      removingFriend: s('removing_friend').trim(),
      sendFriendRequestAction: s('send_friend_request_action').trim(),
      sendingFriendRequest: s('sending_friend_request').trim(),
      acceptFriendRequestAction: s('accept_friend_request_action').trim(),
      acceptingFriendRequest: s('accepting_friend_request').trim(),
      denyFriendRequestAction: s('deny_friend_request_action').trim(),
      denyingFriendRequest: s('denying_friend_request').trim(),
      cancelFriendRequestAction: s('cancel_friend_request_action').trim(),
      cancellingFriendRequest: s('cancelling_friend_request').trim(),
      friendRequestPendingLabel: s('friend_request_pending_label').trim(),
      friendRequestOutgoingLabel: s('friend_request_outgoing_label').trim(),
      friendRequestDeniedLabel: s('friend_request_denied_label').trim(),
      emptyFriendRequests: s('empty_friend_requests').trim(),
      toastFriendRequestSent: s('toast_friend_request_sent').trim(),
      toastFriendRequestAccepted: s('toast_friend_request_accepted').trim(),
      toastFriendRequestDenied: s('toast_friend_request_denied').trim(),
      toastFriendRequestCancelled: s('toast_friend_request_cancelled').trim(),
      toastFriendRequestFailed: s('toast_friend_request_failed').trim(),
      friendRequestAlreadyFriends: s('friend_request_already_friends').trim(),
      viewProfileAction: s('view_profile_action').trim(),
      friendRequestsCountAria: s('friend_requests_count_aria').trim(),
      countryFlagImageUrlTemplate: s('country_flag_image_url_template').trim(),
      onlineLabel: s('online_label').trim(),
      playingLabel: s('playing_label').trim(),
      offlineLabel: s('offline_label').trim(),
      emptyLiveGames: s('empty_live_games').trim(),
      emptyHistory: s('empty_history').trim(),
      emptyFriends: s('empty_friends').trim(),
      emptyPlayers: s('empty_players').trim(),
      loadingLive: s('loading_live').trim(),
      loadingHistory: s('loading_history').trim(),
      loadingPlayers: s('loading_players').trim(),
      signInHistory: s('sign_in_history').trim(),
      signInFriends: s('sign_in_friends').trim(),
      outcomeWin: s('outcome_win').trim(),
      outcomeLoss: s('outcome_loss').trim(),
      outcomeDraw: s('outcome_draw').trim(),
      movesSuffix: s('moves_suffix').trim(),
      metaSeparator: s('meta_separator').trim(),
      statsSeparator: s('stats_separator').trim(),
      winsAbbr: s('wins_abbr').trim(),
      lossesAbbr: s('losses_abbr').trim(),
      modeAi: s('mode_ai').trim(),
      modePvp: s('mode_pvp').trim(),
      ratingParenOpen: s('rating_paren_open').trim(),
      ratingParenClose: s('rating_paren_close').trim(),
      toastEnterUsername: s('toast_enter_username').trim(),
      toastSignInChallenge: s('toast_sign_in_challenge').trim(),
      toastChallengeSentPrefix: s('toast_challenge_sent_prefix').trim(),
      toastChallengeFailed: s('toast_challenge_failed').trim(),
      toastInviteYourself: s('toast_invite_yourself').trim(),
      toastCopyFailed: s('toast_copy_failed').trim(),
      toastSendLinkFirst: s('toast_send_link_first').trim(),
      toastFriendAdded: s('toast_friend_added').trim(),
      toastFriendRemoved: s('toast_friend_removed').trim(),
      toastFriendFailed: s('toast_friend_failed').trim(),
      toastTimeControlUnavailable: s('toast_time_control_unavailable').trim(),
      toastChallengeAcceptFailed: s('toast_challenge_accept_failed').trim(),
      toastGameUnavailable: s('toast_game_unavailable').trim(),
      ariaColorWhite: s('aria_color_white').trim(),
      ariaColorBlack: s('aria_color_black').trim(),
      ariaColorRandom: s('aria_color_random').trim(),
      colorPrefNote: s('color_pref_note').trim(),
      boardView2d: s('board_view_2d').trim(),
      boardView3d: s('board_view_3d').trim(),
      shareWatchAction: s('share_watch_action').trim(),
      flipBoardAria: s('flip_board_aria').trim(),
      shareGameAria: s('share_game_aria').trim(),
      createGameTitle: s('create_game_title').trim(),
      resumeGameAction: s('resume_game_action').trim(),
      newGameModesAria: s('new_game_modes_aria').trim(),
      webAppOrigin: s('web_app_origin').trim().replaceAll(RegExp(r'/$'), ''),
      labelPlayers: s('label_players').trim(),
      labelViewers: s('label_viewers').trim(),
      labelGameId: s('label_game_id').trim(),
      vsSeparator: s('vs_separator').trim(),
      viewersOverflowPrefix: s('viewers_overflow_prefix').trim(),
      joinGameAction: s('join_game_action').trim(),
      downloadQrAction: s('download_qr_action').trim(),
      downloadQrPending: s('download_qr_pending').trim(),
      qrPreviewAria: s('qr_preview_aria').trim(),
      qrLightboxCloseAria: s('qr_lightbox_close_aria').trim(),
      qrUnavailable: s('qr_unavailable').trim(),
      toastQrDownloadFailed: s('toast_qr_download_failed').trim(),
      liveGamePopoverTitle: s('live_game_popover_title').trim(),
      gamesPlayedAbbr: s('games_played_abbr').trim(),
      drawsAbbr: s('draws_abbr').trim(),
      idTruncateChars: s('id_truncate_chars').trim(),
      idTruncateSuffix: s('id_truncate_suffix').trim(),
      viewersEmptyCount: s('viewers_empty_count').trim(),
      searchDebounceMs: s('search_debounce_ms').trim(),
      livePlayerNameMaxChars: s('live_player_name_max_chars').trim(),
      nameTruncateSuffix: s('name_truncate_suffix').trim(),
      liveViewersTitle: s('live_viewers_title').trim(),
      backToLiveGames: s('back_to_live_games').trim(),
      emptyLiveViewers: s('empty_live_viewers').trim(),
      loadingLiveViewers: s('loading_live_viewers').trim(),
      listPageSize: s('list_page_size').trim(),
      loadingMore: s('loading_more').trim(),
    );
    return chrome.isReady ? chrome : null;
  }

  /// Fail-closed unavailable line from a partial API payload.
  static String unavailableFrom(Map<String, dynamic>? map) {
    if (map == null) return '';
    return (map['play_rail_chrome_unavailable'] as String?)?.trim() ?? '';
  }
}
