/// DB-backed spectate chrome from GET /public/spectate-chrome.
class SpectateChrome {
  const SpectateChrome({
    required this.source,
    required this.unavailable,
    required this.pageTitle,
    required this.pageBlurb,
    required this.gameIdRequired,
    required this.gameIdLabel,
    required this.waitingGameState,
    required this.unableToSpectate,
    required this.startAction,
    required this.disconnectAction,
    required this.waitingBoard,
    required this.boardAfterConnect,
    required this.connectingStatus,
    required this.disconnectedStatus,
    required this.statusLiveMovesPrefix,
    required this.glyphKing,
    required this.glyphMan,
    required this.liveLabel,
    required this.historyLabel,
    required this.statusReplay,
    required this.seatMetaSeparator,
    required this.statusYourTurn,
    required this.statusOpponentTurn,
    required this.labelWhite,
    required this.labelBlack,
    required this.voteSectionTitle,
    required this.votePickAction,
    required this.voteLockedLabel,
    required this.voteSignIn,
    required this.voteUnavailable,
    required this.voteCastFailed,
    required this.voteCastingPending,
    required this.votePercentSuffix,
    required this.voteCountSuffix,
    required this.voteCorrectTitle,
    required this.voteCorrectEmpty,
    required this.voteCorrectBlurb,
    required this.voteMetaSeparator,
    required this.viewersOverflowPrefix,
    required this.votePlayersCannot,
    required this.watchPanelBackAction,
    required this.watchPanelBackAria,
    required this.voteScoreSeparator,
    required this.statusDraw,
    required this.statusP1Wins,
    required this.statusP2Wins,
    required this.statusP1WinsOnTime,
    required this.statusP2WinsOnTime,
    required this.statusDrawOnTime,
  });

  final String source;
  final String unavailable;
  final String pageTitle;
  final String pageBlurb;
  final String gameIdRequired;
  final String gameIdLabel;
  final String waitingGameState;
  final String unableToSpectate;
  final String startAction;
  final String disconnectAction;
  final String waitingBoard;
  final String boardAfterConnect;
  final String connectingStatus;
  final String disconnectedStatus;
  final String statusLiveMovesPrefix;
  final String glyphKing;
  final String glyphMan;
  final String liveLabel;
  final String historyLabel;
  final String statusReplay;
  final String seatMetaSeparator;
  final String statusYourTurn;
  final String statusOpponentTurn;
  final String labelWhite;
  final String labelBlack;
  final String voteSectionTitle;
  final String votePickAction;
  final String voteLockedLabel;
  final String voteSignIn;
  final String voteUnavailable;
  final String voteCastFailed;
  final String voteCastingPending;
  final String votePercentSuffix;
  final String voteCountSuffix;
  final String voteCorrectTitle;
  final String voteCorrectEmpty;
  final String voteCorrectBlurb;
  final String voteMetaSeparator;
  final String viewersOverflowPrefix;
  final String votePlayersCannot;
  final String watchPanelBackAction;
  final String watchPanelBackAria;
  final String voteScoreSeparator;
  final String statusDraw;
  final String statusP1Wins;
  final String statusP2Wins;
  final String statusP1WinsOnTime;
  final String statusP2WinsOnTime;
  final String statusDrawOnTime;

  bool get isReady =>
      source.isNotEmpty &&
      unavailable.isNotEmpty &&
      pageTitle.isNotEmpty &&
      pageBlurb.isNotEmpty &&
      gameIdRequired.isNotEmpty &&
      gameIdLabel.isNotEmpty &&
      waitingGameState.isNotEmpty &&
      unableToSpectate.isNotEmpty &&
      startAction.isNotEmpty &&
      disconnectAction.isNotEmpty &&
      waitingBoard.isNotEmpty &&
      boardAfterConnect.isNotEmpty &&
      connectingStatus.isNotEmpty &&
      disconnectedStatus.isNotEmpty &&
      statusLiveMovesPrefix.isNotEmpty &&
      glyphKing.isNotEmpty &&
      glyphMan.isNotEmpty &&
      liveLabel.isNotEmpty &&
      historyLabel.isNotEmpty &&
      statusReplay.isNotEmpty &&
      seatMetaSeparator.isNotEmpty &&
      statusYourTurn.isNotEmpty &&
      statusOpponentTurn.isNotEmpty &&
      labelWhite.isNotEmpty &&
      labelBlack.isNotEmpty &&
      voteSectionTitle.isNotEmpty &&
      votePickAction.isNotEmpty &&
      voteLockedLabel.isNotEmpty &&
      voteSignIn.isNotEmpty &&
      voteUnavailable.isNotEmpty &&
      voteCastFailed.isNotEmpty &&
      voteCastingPending.isNotEmpty &&
      votePercentSuffix.isNotEmpty &&
      voteCountSuffix.isNotEmpty &&
      voteCorrectTitle.isNotEmpty &&
      voteCorrectEmpty.isNotEmpty &&
      voteCorrectBlurb.isNotEmpty &&
      voteMetaSeparator.isNotEmpty &&
      viewersOverflowPrefix.isNotEmpty &&
      votePlayersCannot.isNotEmpty &&
      watchPanelBackAction.isNotEmpty &&
      watchPanelBackAria.isNotEmpty &&
      voteScoreSeparator.isNotEmpty &&
      statusDraw.isNotEmpty &&
      statusP1Wins.isNotEmpty &&
      statusP2Wins.isNotEmpty &&
      statusP1WinsOnTime.isNotEmpty &&
      statusP2WinsOnTime.isNotEmpty &&
      statusDrawOnTime.isNotEmpty;

  static SpectateChrome? fromJson(Map<String, dynamic>? map) {
    if (map == null) return null;
    String s(String k) => (map[k] as String?)?.trim() ?? '';
    final chrome = SpectateChrome(
      source: s('source'),
      unavailable: s('spectate_chrome_unavailable'),
      pageTitle: s('page_title'),
      pageBlurb: s('page_blurb'),
      gameIdRequired: s('game_id_required'),
      gameIdLabel: s('game_id_label'),
      waitingGameState: s('waiting_game_state'),
      unableToSpectate: s('unable_to_spectate'),
      startAction: s('start_action'),
      disconnectAction: s('disconnect_action'),
      waitingBoard: s('waiting_board'),
      boardAfterConnect: s('board_after_connect'),
      connectingStatus: s('connecting_status'),
      disconnectedStatus: s('disconnected_status'),
      statusLiveMovesPrefix: s('status_live_moves_prefix'),
      glyphKing: s('glyph_king'),
      glyphMan: s('glyph_man'),
      liveLabel: s('live_label'),
      historyLabel: s('history_label'),
      statusReplay: s('status_replay'),
      seatMetaSeparator: s('seat_meta_separator'),
      statusYourTurn: s('status_your_turn'),
      statusOpponentTurn: s('status_opponent_turn'),
      labelWhite: s('label_white'),
      labelBlack: s('label_black'),
      voteSectionTitle: s('vote_section_title'),
      votePickAction: s('vote_pick_action'),
      voteLockedLabel: s('vote_locked_label'),
      voteSignIn: s('vote_sign_in'),
      voteUnavailable: s('vote_unavailable'),
      voteCastFailed: s('vote_cast_failed'),
      voteCastingPending: s('vote_casting_pending'),
      votePercentSuffix: s('vote_percent_suffix'),
      voteCountSuffix: s('vote_count_suffix'),
      voteCorrectTitle: s('vote_correct_title'),
      voteCorrectEmpty: s('vote_correct_empty'),
      voteCorrectBlurb: s('vote_correct_blurb'),
      voteMetaSeparator: s('vote_meta_separator'),
      viewersOverflowPrefix: s('viewers_overflow_prefix'),
      votePlayersCannot: s('vote_players_cannot'),
      watchPanelBackAction: s('watch_panel_back_action'),
      watchPanelBackAria: s('watch_panel_back_aria'),
      voteScoreSeparator: s('vote_score_separator'),
      statusDraw: s('status_draw'),
      statusP1Wins: s('status_p1_wins'),
      statusP2Wins: s('status_p2_wins'),
      statusP1WinsOnTime: s('status_p1_wins_on_time'),
      statusP2WinsOnTime: s('status_p2_wins_on_time'),
      statusDrawOnTime: s('status_draw_on_time'),
    );
    return chrome.isReady ? chrome : null;
  }
}
