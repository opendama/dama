/// DB-backed matchmaking UI chrome from GET /public/matchmaking-chrome.
class MatchmakingChrome {
  const MatchmakingChrome({
    required this.source,
    required this.title,
    required this.blurb,
    required this.findMatchAction,
    required this.leaveQueueAction,
    required this.playersWaitingTitle,
    required this.queuedYes,
    required this.queuedNo,
    required this.directInviteTitle,
    required this.directInviteBlurb,
    required this.invitePlaceholder,
    required this.sendInviteAction,
    required this.acceptAction,
    required this.declineAction,
    required this.inviteFromPrefix,
    required this.matchedOpening,
    required this.ratingLabel,
    required this.searchingSuffix,
    required this.toastMatchFound,
    required this.toastMatchedInstantly,
    required this.toastWaitingOpponent,
    required this.toastJoinFailed,
    required this.toastInviteSent,
    required this.toastInviteFailed,
    required this.toastInviteYourself,
    required this.toastInviteReceived,
    required this.toastInviteAccepted,
    required this.toastInviteDeclined,
    required this.toastLiveRequired,
    required this.matchmakingChromeUnavailable,
    required this.metaSeparator,
    required this.joinPending,
    required this.leavePending,
    required this.sendInvitePending,
    required this.acceptPending,
    required this.declinePending,
    required this.outgoingInviteTitle,
    required this.outgoingInviteBlurb,
    required this.outgoingKeepWaitingAction,
    required this.outgoingCancelAction,
    required this.outgoingCancelPending,
    required this.toastInviteCancelled,
  });

  final String source;
  final String title;
  final String blurb;
  final String findMatchAction;
  final String leaveQueueAction;
  final String playersWaitingTitle;
  final String queuedYes;
  final String queuedNo;
  final String directInviteTitle;
  final String directInviteBlurb;
  final String invitePlaceholder;
  final String sendInviteAction;
  final String acceptAction;
  final String declineAction;
  final String inviteFromPrefix;
  final String matchedOpening;
  final String ratingLabel;
  final String searchingSuffix;
  final String toastMatchFound;
  final String toastMatchedInstantly;
  final String toastWaitingOpponent;
  final String toastJoinFailed;
  final String toastInviteSent;
  final String toastInviteFailed;
  final String toastInviteYourself;
  final String toastInviteReceived;
  final String toastInviteAccepted;
  final String toastInviteDeclined;
  final String toastLiveRequired;
  final String matchmakingChromeUnavailable;
  final String metaSeparator;
  final String joinPending;
  final String leavePending;
  final String sendInvitePending;
  final String acceptPending;
  final String declinePending;
  final String outgoingInviteTitle;
  final String outgoingInviteBlurb;
  final String outgoingKeepWaitingAction;
  final String outgoingCancelAction;
  final String outgoingCancelPending;
  final String toastInviteCancelled;

  bool get isReady =>
      source.isNotEmpty &&
      title.isNotEmpty &&
      blurb.isNotEmpty &&
      findMatchAction.isNotEmpty &&
      leaveQueueAction.isNotEmpty &&
      playersWaitingTitle.isNotEmpty &&
      queuedYes.isNotEmpty &&
      queuedNo.isNotEmpty &&
      directInviteTitle.isNotEmpty &&
      directInviteBlurb.isNotEmpty &&
      invitePlaceholder.isNotEmpty &&
      sendInviteAction.isNotEmpty &&
      acceptAction.isNotEmpty &&
      declineAction.isNotEmpty &&
      inviteFromPrefix.isNotEmpty &&
      matchedOpening.isNotEmpty &&
      ratingLabel.isNotEmpty &&
      searchingSuffix.isNotEmpty &&
      toastMatchFound.isNotEmpty &&
      toastMatchedInstantly.isNotEmpty &&
      toastWaitingOpponent.isNotEmpty &&
      toastJoinFailed.isNotEmpty &&
      toastInviteSent.isNotEmpty &&
      toastInviteFailed.isNotEmpty &&
      toastInviteYourself.isNotEmpty &&
      toastInviteReceived.isNotEmpty &&
      toastInviteAccepted.isNotEmpty &&
      toastInviteDeclined.isNotEmpty &&
      toastLiveRequired.isNotEmpty &&
      matchmakingChromeUnavailable.isNotEmpty &&
      metaSeparator.isNotEmpty &&
      joinPending.isNotEmpty &&
      leavePending.isNotEmpty &&
      sendInvitePending.isNotEmpty &&
      acceptPending.isNotEmpty &&
      declinePending.isNotEmpty &&
      outgoingInviteTitle.isNotEmpty &&
      outgoingInviteBlurb.isNotEmpty &&
      outgoingKeepWaitingAction.isNotEmpty &&
      outgoingCancelAction.isNotEmpty &&
      outgoingCancelPending.isNotEmpty &&
      toastInviteCancelled.isNotEmpty;

  static String _s(Map<String, dynamic> map, String key) =>
      (map[key] as String?)?.trim() ?? '';

  static MatchmakingChrome? fromJson(Map<String, dynamic>? map) {
    if (map == null) return null;
    final chrome = MatchmakingChrome(
      source: _s(map, 'source'),
      title: _s(map, 'title'),
      blurb: _s(map, 'blurb'),
      findMatchAction: _s(map, 'find_match_action'),
      leaveQueueAction: _s(map, 'leave_queue_action'),
      playersWaitingTitle: _s(map, 'players_waiting_title'),
      queuedYes: _s(map, 'queued_yes'),
      queuedNo: _s(map, 'queued_no'),
      directInviteTitle: _s(map, 'direct_invite_title'),
      directInviteBlurb: _s(map, 'direct_invite_blurb'),
      invitePlaceholder: _s(map, 'invite_placeholder'),
      sendInviteAction: _s(map, 'send_invite_action'),
      acceptAction: _s(map, 'accept_action'),
      declineAction: _s(map, 'decline_action'),
      inviteFromPrefix: _s(map, 'invite_from_prefix'),
      matchedOpening: _s(map, 'matched_opening'),
      ratingLabel: _s(map, 'rating_label'),
      searchingSuffix: _s(map, 'searching_suffix'),
      toastMatchFound: _s(map, 'toast_match_found'),
      toastMatchedInstantly: _s(map, 'toast_matched_instantly'),
      toastWaitingOpponent: _s(map, 'toast_waiting_opponent'),
      toastJoinFailed: _s(map, 'toast_join_failed'),
      toastInviteSent: _s(map, 'toast_invite_sent'),
      toastInviteFailed: _s(map, 'toast_invite_failed'),
      toastInviteYourself: _s(map, 'toast_invite_yourself'),
      toastInviteReceived: _s(map, 'toast_invite_received'),
      toastInviteAccepted: _s(map, 'toast_invite_accepted'),
      toastInviteDeclined: _s(map, 'toast_invite_declined'),
      toastLiveRequired: _s(map, 'toast_live_required'),
      matchmakingChromeUnavailable: _s(map, 'matchmaking_chrome_unavailable'),
      metaSeparator: _s(map, 'meta_separator'),
      joinPending: _s(map, 'join_pending'),
      leavePending: _s(map, 'leave_pending'),
      sendInvitePending: _s(map, 'send_invite_pending'),
      acceptPending: _s(map, 'accept_pending'),
      declinePending: _s(map, 'decline_pending'),
      outgoingInviteTitle: _s(map, 'outgoing_invite_title'),
      outgoingInviteBlurb: _s(map, 'outgoing_invite_blurb'),
      outgoingKeepWaitingAction: _s(map, 'outgoing_keep_waiting_action'),
      outgoingCancelAction: _s(map, 'outgoing_cancel_action'),
      outgoingCancelPending: _s(map, 'outgoing_cancel_pending'),
      toastInviteCancelled: _s(map, 'toast_invite_cancelled'),
    );
    return chrome.isReady ? chrome : null;
  }
}
