/// DB-backed play UI chrome from GET /public/play-chrome.
class PlayChrome {
  const PlayChrome({
    required this.source,
    required this.pageTitle,
    required this.lobbyTitle,
    required this.lobbyModesBlurb,
    required this.find1v1Action,
    required this.practiceDepthLabel,
    required this.depthOptionPrefix,
    required this.playComputerAction,
    required this.practiceUnavailableShort,
    required this.playChromeUnavailable,
    required this.liveBoardTitle,
    required this.matchClockPrefix,
    required this.statusPrefix,
    required this.statusStarting,
    required this.incrementSuffix,
    required this.seatMetaSeparator,
    required this.labelGame,
    required this.labelMoves,
    required this.labelHalfmove,
    required this.labelRules,
    required this.labelPieces,
    required this.labelWhite,
    required this.labelBlack,
    required this.toastIllegalSquare,
    required this.toastLoadFailed,
    required this.toastStartFailed,
    required this.toastMoveFailed,
    required this.toastClockFlag,
    required this.toastClockFlagFailed,
    required this.youWonOnTimeMessage,
    required this.youLostOnTimeMessage,
    required this.youDrewOnTimeMessage,
    required this.matchResultWinOnTimeAria,
    required this.matchResultLossOnTimeAria,
    required this.matchResultDrawOnTimeAria,
    required this.toastDifficultyUnavailable,
    required this.toastOptionsLoadFailed,
    required this.statusMatched,
    required this.statusWsPrefix,
    required this.statusSyncedMovesPrefix,
    required this.toastAiDepthRequired,
    required this.statusStarted,
    required this.toastWsConnectionError,
    required this.parenOpen,
    required this.parenClose,
    required this.incrementParenOpen,
    required this.boardSizeSeparator,
    required this.labelValueSeparator,
    required this.idTruncateSuffix,
    required this.idTruncateChars,
    required this.pieceCountSeparator,
    required this.glyphKing,
    required this.glyphMan,
    required this.liveLabel,
    required this.historyLabel,
    required this.statusReplay,
    required this.statusYourTurn,
    required this.statusOpponentTurn,
    required this.statusDraw,
    required this.gameOverTitle,
    required this.youWonMessage,
    required this.youLostMessage,
    required this.restartAction,
    required this.stopGameAction,
    required this.stopGameConfirmTitle,
    required this.stopGameConfirmDescription,
    required this.stopGameConfirmCancel,
    required this.stopGameConfirmConfirm,
    required this.stopGamePending,
    required this.stopGameSuccess,
    this.stopGameFailed = '',
    required this.historySkipFirst,
    required this.historySkipPrev,
    required this.historySkipNext,
    required this.historySkipLast,
    required this.historySkipGo,
    required this.historySkipPageOf,
    this.toastPointsAwardedFmt = '',
    this.pauseGameAction = '',
    this.resumeGameAction = '',
    this.pauseGamePending = '',
    this.resumeGamePending = '',
    this.toastPaused = '',
    this.toastResumed = '',
    this.toastPauseFailed = '',
    this.toastResumeFailed = '',
    this.toastAutoResumed = '',
    this.pauseDisabled = '',
    this.gamePausedBlurb = '',
    this.pauseRemainingFmt = '',
    this.floatingResumeLabel = '',
    this.floatingResumeAria = '',
    this.navPausedLabel = '',
    this.errPauseDisabled = '',
    this.errAlreadyPaused = '',
    this.errNotPaused = '',
    this.errGamePaused = '',
    this.officialPausedBlurb = '',
    this.officialPausedByFmt = '',
    this.officialPausedReasonFmt = '',
    this.officialPausedNoteFmt = '',
    this.officialResumedToastFmt = '',
    this.errOfficiallyPaused = '',
    this.pauseKindPlayer = '',
    this.pauseKindOfficial = '',
    this.pauseOverlayAria = '',
    this.pauseOverlayUntilResume = '',
    this.playerPausedByFmt = '',
    this.rolePlayerLabel = '',
    this.matchIntroVsLabel = '',
  });

  final String source;
  final String pageTitle;
  final String lobbyTitle;
  final String lobbyModesBlurb;
  final String find1v1Action;
  final String practiceDepthLabel;
  final String depthOptionPrefix;
  final String playComputerAction;
  final String practiceUnavailableShort;
  final String playChromeUnavailable;
  final String liveBoardTitle;
  final String matchClockPrefix;
  final String statusPrefix;
  final String statusStarting;
  final String incrementSuffix;
  final String seatMetaSeparator;
  final String labelGame;
  final String labelMoves;
  final String labelHalfmove;
  final String labelRules;
  final String labelPieces;
  final String labelWhite;
  final String labelBlack;
  final String toastIllegalSquare;
  final String toastLoadFailed;
  final String toastStartFailed;
  final String toastMoveFailed;
  final String toastClockFlag;
  final String toastClockFlagFailed;
  final String youWonOnTimeMessage;
  final String youLostOnTimeMessage;
  final String youDrewOnTimeMessage;
  final String matchResultWinOnTimeAria;
  final String matchResultLossOnTimeAria;
  final String matchResultDrawOnTimeAria;
  final String toastDifficultyUnavailable;
  final String toastOptionsLoadFailed;
  final String statusMatched;
  final String statusWsPrefix;
  final String statusSyncedMovesPrefix;
  final String toastAiDepthRequired;
  final String statusStarted;
  final String toastWsConnectionError;
  final String parenOpen;
  final String parenClose;
  final String incrementParenOpen;
  final String boardSizeSeparator;
  final String labelValueSeparator;
  final String idTruncateSuffix;

  /// Decimal string from DB - leading chars of game id to show.
  final String idTruncateChars;
  final String pieceCountSeparator;
  final String glyphKing;
  final String glyphMan;
  final String liveLabel;
  final String historyLabel;
  final String statusReplay;
  final String statusYourTurn;
  final String statusOpponentTurn;
  final String statusDraw;
  final String gameOverTitle;
  final String youWonMessage;
  final String youLostMessage;
  final String restartAction;
  final String stopGameAction;
  final String stopGameConfirmTitle;
  final String stopGameConfirmDescription;
  final String stopGameConfirmCancel;
  final String stopGameConfirmConfirm;
  final String stopGamePending;
  final String stopGameSuccess;

  /// Optional until migration 432 hydrates; abandon errors fall back to stopGameAction.
  final String stopGameFailed;
  final String historySkipFirst;
  final String historySkipPrev;
  final String historySkipNext;
  final String historySkipLast;
  final String historySkipGo;
  final String historySkipPageOf;

  /// Optional: +{points} toast when competition_points present on game payload.
  final String toastPointsAwardedFmt;

  /// Pause/resume copy. Empty when the key is absent (no invented labels).
  final String pauseGameAction;
  final String resumeGameAction;
  final String pauseGamePending;
  final String resumeGamePending;
  final String toastPaused;
  final String toastResumed;
  final String toastPauseFailed;
  final String toastResumeFailed;
  final String toastAutoResumed;
  final String pauseDisabled;
  final String gamePausedBlurb;
  final String pauseRemainingFmt;
  final String floatingResumeLabel;
  final String floatingResumeAria;
  final String navPausedLabel;
  final String errPauseDisabled;
  final String errAlreadyPaused;
  final String errNotPaused;
  final String errGamePaused;

  /// Official pause banner / errors. Empty when absent (no invented labels).
  final String officialPausedBlurb;
  final String officialPausedByFmt;
  final String officialPausedReasonFmt;
  final String officialPausedNoteFmt;
  final String officialResumedToastFmt;
  final String errOfficiallyPaused;
  final String pauseKindPlayer;
  final String pauseKindOfficial;

  /// Board cover aria while paused (player or official).
  final String pauseOverlayAria;

  /// Official pause footer when there is no auto-resume.
  final String pauseOverlayUntilResume;

  /// `{role}` `{name}` for player-initiated pause.
  final String playerPausedByFmt;

  /// Seat player role label for pause overlay by-line (DB play_chrome).
  final String rolePlayerLabel;

  /// Soft-fill VS label when rail chrome lags (pause overlay parity with web).
  final String matchIntroVsLabel;

  bool get isReady =>
      source.isNotEmpty &&
      pageTitle.isNotEmpty &&
      lobbyTitle.isNotEmpty &&
      lobbyModesBlurb.isNotEmpty &&
      find1v1Action.isNotEmpty &&
      practiceDepthLabel.isNotEmpty &&
      depthOptionPrefix.isNotEmpty &&
      playComputerAction.isNotEmpty &&
      practiceUnavailableShort.isNotEmpty &&
      playChromeUnavailable.isNotEmpty &&
      liveBoardTitle.isNotEmpty &&
      matchClockPrefix.isNotEmpty &&
      statusPrefix.isNotEmpty &&
      statusStarting.isNotEmpty &&
      incrementSuffix.isNotEmpty &&
      seatMetaSeparator.isNotEmpty &&
      labelGame.isNotEmpty &&
      labelMoves.isNotEmpty &&
      labelHalfmove.isNotEmpty &&
      labelRules.isNotEmpty &&
      labelPieces.isNotEmpty &&
      labelWhite.isNotEmpty &&
      labelBlack.isNotEmpty &&
      toastIllegalSquare.isNotEmpty &&
      toastLoadFailed.isNotEmpty &&
      toastStartFailed.isNotEmpty &&
      toastMoveFailed.isNotEmpty &&
      toastClockFlag.isNotEmpty &&
      toastClockFlagFailed.isNotEmpty &&
      youWonOnTimeMessage.isNotEmpty &&
      youLostOnTimeMessage.isNotEmpty &&
      youDrewOnTimeMessage.isNotEmpty &&
      matchResultWinOnTimeAria.isNotEmpty &&
      matchResultLossOnTimeAria.isNotEmpty &&
      matchResultDrawOnTimeAria.isNotEmpty &&
      toastDifficultyUnavailable.isNotEmpty &&
      toastOptionsLoadFailed.isNotEmpty &&
      statusMatched.isNotEmpty &&
      statusWsPrefix.isNotEmpty &&
      statusSyncedMovesPrefix.isNotEmpty &&
      toastAiDepthRequired.isNotEmpty &&
      statusStarted.isNotEmpty &&
      toastWsConnectionError.isNotEmpty &&
      parenOpen.isNotEmpty &&
      parenClose.isNotEmpty &&
      incrementParenOpen.isNotEmpty &&
      boardSizeSeparator.isNotEmpty &&
      labelValueSeparator.isNotEmpty &&
      idTruncateSuffix.isNotEmpty &&
      idTruncateChars.isNotEmpty &&
      pieceCountSeparator.isNotEmpty &&
      glyphKing.isNotEmpty &&
      glyphMan.isNotEmpty &&
      liveLabel.isNotEmpty &&
      historyLabel.isNotEmpty &&
      statusReplay.isNotEmpty &&
      statusYourTurn.isNotEmpty &&
      statusOpponentTurn.isNotEmpty &&
      statusDraw.isNotEmpty &&
      gameOverTitle.isNotEmpty &&
      youWonMessage.isNotEmpty &&
      youLostMessage.isNotEmpty &&
      restartAction.isNotEmpty &&
      stopGameAction.isNotEmpty &&
      stopGameConfirmTitle.isNotEmpty &&
      stopGameConfirmDescription.isNotEmpty &&
      stopGameConfirmCancel.isNotEmpty &&
      stopGameConfirmConfirm.isNotEmpty &&
      stopGamePending.isNotEmpty &&
      stopGameSuccess.isNotEmpty &&
      historySkipFirst.isNotEmpty &&
      historySkipPrev.isNotEmpty &&
      historySkipNext.isNotEmpty &&
      historySkipLast.isNotEmpty &&
      historySkipGo.isNotEmpty &&
      historySkipPageOf.isNotEmpty &&
      gamePausedBlurb.isNotEmpty &&
      officialPausedBlurb.isNotEmpty &&
      officialPausedByFmt.isNotEmpty &&
      officialPausedReasonFmt.isNotEmpty &&
      officialPausedNoteFmt.isNotEmpty &&
      officialResumedToastFmt.isNotEmpty &&
      errOfficiallyPaused.isNotEmpty &&
      pauseKindPlayer.isNotEmpty &&
      pauseKindOfficial.isNotEmpty &&
      pauseOverlayAria.isNotEmpty &&
      pauseOverlayUntilResume.isNotEmpty &&
      playerPausedByFmt.isNotEmpty &&
      rolePlayerLabel.isNotEmpty &&
      matchIntroVsLabel.isNotEmpty &&
      pauseRemainingFmt.isNotEmpty;

  static PlayChrome? fromJson(Map<String, dynamic>? map) {
    if (map == null) return null;
    String s(String k) => (map[k] as String?) ?? '';
    final chrome = PlayChrome(
      source: s('source').trim(),
      pageTitle: s('page_title').trim(),
      lobbyTitle: s('lobby_title').trim(),
      lobbyModesBlurb: s('lobby_modes_blurb').trim(),
      find1v1Action: s('find_1v1_action').trim(),
      practiceDepthLabel: s('practice_depth_label').trim(),
      depthOptionPrefix: s('depth_option_prefix').trim(),
      playComputerAction: s('play_computer_action').trim(),
      practiceUnavailableShort: s('practice_unavailable_short').trim(),
      playChromeUnavailable: s('play_chrome_unavailable').trim(),
      liveBoardTitle: s('live_board_title').trim(),
      matchClockPrefix: s('match_clock_prefix').trim(),
      statusPrefix: s('status_prefix').trim(),
      statusStarting: s('status_starting').trim(),
      incrementSuffix: s('increment_suffix').trim(),
      seatMetaSeparator: s('seat_meta_separator'),
      labelGame: s('label_game').trim(),
      labelMoves: s('label_moves').trim(),
      labelHalfmove: s('label_halfmove').trim(),
      labelRules: s('label_rules').trim(),
      labelPieces: s('label_pieces').trim(),
      labelWhite: s('label_white').trim(),
      labelBlack: s('label_black').trim(),
      toastIllegalSquare: s('toast_illegal_square').trim(),
      toastLoadFailed: s('toast_load_failed').trim(),
      toastStartFailed: s('toast_start_failed').trim(),
      toastMoveFailed: s('toast_move_failed').trim(),
      toastClockFlag: s('toast_clock_flag').trim(),
      toastClockFlagFailed: s('toast_clock_flag_failed').trim(),
      youWonOnTimeMessage: s('you_won_on_time_message').trim(),
      youLostOnTimeMessage: s('you_lost_on_time_message').trim(),
      youDrewOnTimeMessage: s('you_drew_on_time_message').trim(),
      matchResultWinOnTimeAria: s('match_result_win_on_time_aria').trim(),
      matchResultLossOnTimeAria: s('match_result_loss_on_time_aria').trim(),
      matchResultDrawOnTimeAria: s('match_result_draw_on_time_aria').trim(),
      toastDifficultyUnavailable: s('toast_difficulty_unavailable').trim(),
      toastOptionsLoadFailed: s('toast_options_load_failed').trim(),
      statusMatched: s('status_matched').trim(),
      statusWsPrefix: s('status_ws_prefix').trim(),
      statusSyncedMovesPrefix: s('status_synced_moves_prefix').trim(),
      toastAiDepthRequired: s('toast_ai_depth_required').trim(),
      statusStarted: s('status_started').trim(),
      toastWsConnectionError: s('toast_ws_connection_error').trim(),
      parenOpen: s('paren_open'),
      parenClose: s('paren_close'),
      incrementParenOpen: s('increment_paren_open'),
      boardSizeSeparator: s('board_size_separator'),
      labelValueSeparator: s('label_value_separator'),
      idTruncateSuffix: s('id_truncate_suffix').trim(),
      idTruncateChars: s('id_truncate_chars').trim(),
      pieceCountSeparator: s('piece_count_separator'),
      glyphKing: s('glyph_king').trim(),
      glyphMan: s('glyph_man').trim(),
      liveLabel: s('live_label').trim(),
      historyLabel: s('history_label').trim(),
      statusReplay: s('status_replay').trim(),
      statusYourTurn: s('status_your_turn').trim(),
      statusOpponentTurn: s('status_opponent_turn').trim(),
      statusDraw: s('status_draw').trim(),
      gameOverTitle: s('game_over_title').trim(),
      youWonMessage: s('you_won_message').trim(),
      youLostMessage: s('you_lost_message').trim(),
      restartAction: s('restart_action').trim(),
      stopGameAction: s('stop_game_action').trim(),
      stopGameConfirmTitle: s('stop_game_confirm_title').trim(),
      stopGameConfirmDescription: s('stop_game_confirm_description').trim(),
      stopGameConfirmCancel: s('stop_game_confirm_cancel').trim(),
      stopGameConfirmConfirm: s('stop_game_confirm_confirm').trim(),
      stopGamePending: s('stop_game_pending').trim(),
      stopGameSuccess: s('stop_game_success').trim(),
      stopGameFailed: s('stop_game_failed').trim(),
      historySkipFirst: s('history_skip_first').trim(),
      historySkipPrev: s('history_skip_prev').trim(),
      historySkipNext: s('history_skip_next').trim(),
      historySkipLast: s('history_skip_last').trim(),
      historySkipGo: s('history_skip_go').trim(),
      historySkipPageOf: s('history_skip_page_of').trim(),
      toastPointsAwardedFmt: s('toast_points_awarded_fmt').trim(),
      pauseGameAction: s('pause_game_action').trim(),
      resumeGameAction: s('resume_game_action').trim(),
      pauseGamePending: s('pause_game_pending').trim(),
      resumeGamePending: s('resume_game_pending').trim(),
      toastPaused: s('toast_paused').trim(),
      toastResumed: s('toast_resumed').trim(),
      toastPauseFailed: s('toast_pause_failed').trim(),
      toastResumeFailed: s('toast_resume_failed').trim(),
      toastAutoResumed: s('toast_auto_resumed').trim(),
      pauseDisabled: s('pause_disabled').trim(),
      gamePausedBlurb: s('game_paused_blurb').trim(),
      pauseRemainingFmt: s('pause_remaining_fmt').trim(),
      floatingResumeLabel: s('floating_resume_label').trim(),
      floatingResumeAria: s('floating_resume_aria').trim(),
      navPausedLabel: s('nav_paused_label').trim(),
      errPauseDisabled: s('err_pause_disabled').trim(),
      errAlreadyPaused: s('err_already_paused').trim(),
      errNotPaused: s('err_not_paused').trim(),
      errGamePaused: s('err_game_paused').trim(),
      officialPausedBlurb: s('official_paused_blurb').trim(),
      officialPausedByFmt: s('official_paused_by_fmt').trim(),
      officialPausedReasonFmt: s('official_paused_reason_fmt').trim(),
      officialPausedNoteFmt: s('official_paused_note_fmt').trim(),
      officialResumedToastFmt: s('official_resumed_toast_fmt').trim(),
      errOfficiallyPaused: s('err_officially_paused').trim(),
      pauseKindPlayer: s('pause_kind_player').trim(),
      pauseKindOfficial: s('pause_kind_official').trim(),
      pauseOverlayAria: s('pause_overlay_aria').trim(),
      pauseOverlayUntilResume: s('pause_overlay_until_resume').trim(),
      playerPausedByFmt: s('player_paused_by_fmt').trim(),
      rolePlayerLabel: s('role_player_label').trim(),
      matchIntroVsLabel: s('match_intro_vs_label').trim(),
    );
    return chrome.isReady ? chrome : null;
  }
}
