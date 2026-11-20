/// DB-backed official pause ops chrome from GET /public/official-pause-chrome.
class OfficialPauseReason {
  const OfficialPauseReason({required this.key, required this.label});

  final String key;
  final String label;
}

class OfficialPauseChrome {
  const OfficialPauseChrome({
    required this.source,
    required this.unavailable,
    required this.pauseAction,
    required this.pausePending,
    required this.resumeAction,
    required this.resumePending,
    required this.reasonLabel,
    required this.reasonPlaceholder,
    required this.noteLabel,
    required this.notePlaceholder,
    required this.confirmPauseTitle,
    required this.confirmPauseDescription,
    required this.confirmResumeTitle,
    required this.confirmResumeDescription,
    required this.confirmCancel,
    required this.confirmPause,
    required this.confirmResume,
    required this.toastPaused,
    required this.toastResumed,
    required this.toastPauseFailed,
    required this.toastResumeFailed,
    required this.roleAdminLabel,
    required this.roleOrganizerLabel,
    required this.rolePlayerLabel,
    required this.errForbidden,
    required this.errReasonRequired,
    required this.errReasonInvalid,
    required this.errPlayerResumeBlocked,
    required this.reasons,
    this.filterAll = '',
    this.filterOfficialPaused = '',
    this.kpiCountSeparator = '',
    this.activityTitle = '',
    this.activityEmpty = '',
    this.activityPauseFmt = '',
    this.activityResumeFmt = '',
    this.colPausedBy = '',
    this.colReason = '',
    this.colPausedAt = '',
    this.colDuration = '',
    this.clockFrozen = '',
    this.bannerSinceFmt = '',
    this.bannerResumedFmt = '',
    this.statusLive = '',
    this.statusPlayerPause = '',
    this.statusOfficialPause = '',
    this.statusFinished = '',
    this.metaAction = '',
    this.metaPending = '',
    this.toastMeta = '',
    this.toastMetaFailed = '',
    this.activityMetaFmt = '',
    this.errRateLimited = '',
    this.errAuditFailed = '',
    this.errMetaNotPaused = '',
    this.errNoteTooLong = '',
    this.errNotLive = '',
    this.errGameFinished = '',
    this.errAlreadyOfficial = '',
    this.errNotOfficial = '',
    this.errListFailed = '',
    this.errBulkRoundInvalid = '',
    this.errBulkEmpty = '',
    this.errUpdateFailed = '',
    this.errOtp = '',
    this.errInvalidBody = '',
    this.bulkPauseAction = '',
    this.bulkPausePending = '',
    this.bulkConfirmTitle = '',
    this.bulkConfirmDescription = '',
    this.bulkConfirm = '',
    this.toastBulkPaused = '',
    this.toastBulkPartial = '',
    this.toastBulkFailed = '',
    this.liveBoardsEmpty = '',
    this.actionsMenuLabel = '',
    this.selectAllLabel = '',
    this.selectRowLabel = '',
    this.selectedCountFmt = '',
    this.clearSelectionAction = '',
    this.bulkSelectedPauseAction = '',
    this.bulkSelectedPausePending = '',
    this.bulkSelectedConfirmTitle = '',
    this.bulkSelectedConfirmDescription = '',
    this.bulkSelectedConfirm = '',
    this.bulkSelectedResumeAction = '',
    this.bulkSelectedResumePending = '',
    this.bulkSelectedResumeConfirmTitle = '',
    this.bulkSelectedResumeConfirmDescription = '',
    this.bulkSelectedResumeConfirm = '',
    this.toastBulkResumed = '',
    this.toastBulkResumePartial = '',
    this.toastBulkResumeFailed = '',
    this.copyGameIdAction = '',
    this.toastCopiedGameId = '',
  });

  final String source;
  final String unavailable;
  final String pauseAction;
  final String pausePending;
  final String resumeAction;
  final String resumePending;
  final String reasonLabel;
  final String reasonPlaceholder;
  final String noteLabel;
  final String notePlaceholder;
  final String confirmPauseTitle;
  final String confirmPauseDescription;
  final String confirmResumeTitle;
  final String confirmResumeDescription;
  final String confirmCancel;
  final String confirmPause;
  final String confirmResume;
  final String toastPaused;
  final String toastResumed;
  final String toastPauseFailed;
  final String toastResumeFailed;
  final String roleAdminLabel;
  final String roleOrganizerLabel;
  final String rolePlayerLabel;
  final String errForbidden;
  final String errReasonRequired;
  final String errReasonInvalid;
  final String errPlayerResumeBlocked;
  final List<OfficialPauseReason> reasons;
  final String filterAll;
  final String filterOfficialPaused;
  final String kpiCountSeparator;
  final String activityTitle;
  final String activityEmpty;
  final String activityPauseFmt;
  final String activityResumeFmt;
  final String colPausedBy;
  final String colReason;
  final String colPausedAt;
  final String colDuration;
  final String clockFrozen;
  final String bannerSinceFmt;
  final String bannerResumedFmt;
  final String statusLive;
  final String statusPlayerPause;
  final String statusOfficialPause;
  final String statusFinished;
  final String metaAction;
  final String metaPending;
  final String toastMeta;
  final String toastMetaFailed;
  final String activityMetaFmt;
  final String errRateLimited;
  final String errAuditFailed;
  final String errMetaNotPaused;
  final String errNoteTooLong;
  final String errNotLive;
  final String errGameFinished;
  final String errAlreadyOfficial;
  final String errNotOfficial;
  final String errListFailed;
  final String errBulkRoundInvalid;
  final String errBulkEmpty;
  final String errUpdateFailed;
  final String errOtp;
  final String errInvalidBody;
  final String bulkPauseAction;
  final String bulkPausePending;
  final String bulkConfirmTitle;
  final String bulkConfirmDescription;
  final String bulkConfirm;
  final String toastBulkPaused;
  final String toastBulkPartial;
  final String toastBulkFailed;
  final String liveBoardsEmpty;
  final String actionsMenuLabel;
  final String selectAllLabel;
  final String selectRowLabel;
  final String selectedCountFmt;
  final String clearSelectionAction;
  final String bulkSelectedPauseAction;
  final String bulkSelectedPausePending;
  final String bulkSelectedConfirmTitle;
  final String bulkSelectedConfirmDescription;
  final String bulkSelectedConfirm;
  final String bulkSelectedResumeAction;
  final String bulkSelectedResumePending;
  final String bulkSelectedResumeConfirmTitle;
  final String bulkSelectedResumeConfirmDescription;
  final String bulkSelectedResumeConfirm;
  final String toastBulkResumed;
  final String toastBulkResumePartial;
  final String toastBulkResumeFailed;
  final String copyGameIdAction;
  final String toastCopiedGameId;

  bool get isReady =>
      source.isNotEmpty &&
      unavailable.isNotEmpty &&
      pauseAction.isNotEmpty &&
      pausePending.isNotEmpty &&
      resumeAction.isNotEmpty &&
      resumePending.isNotEmpty &&
      reasonLabel.isNotEmpty &&
      reasonPlaceholder.isNotEmpty &&
      noteLabel.isNotEmpty &&
      notePlaceholder.isNotEmpty &&
      confirmPauseTitle.isNotEmpty &&
      confirmPauseDescription.isNotEmpty &&
      confirmResumeTitle.isNotEmpty &&
      confirmResumeDescription.isNotEmpty &&
      confirmCancel.isNotEmpty &&
      confirmPause.isNotEmpty &&
      confirmResume.isNotEmpty &&
      toastPaused.isNotEmpty &&
      toastResumed.isNotEmpty &&
      toastPauseFailed.isNotEmpty &&
      toastResumeFailed.isNotEmpty &&
      roleAdminLabel.isNotEmpty &&
      roleOrganizerLabel.isNotEmpty &&
      rolePlayerLabel.isNotEmpty &&
      errForbidden.isNotEmpty &&
      errReasonRequired.isNotEmpty &&
      errReasonInvalid.isNotEmpty &&
      errPlayerResumeBlocked.isNotEmpty &&
      errRateLimited.isNotEmpty &&
      errAuditFailed.isNotEmpty &&
      errUpdateFailed.isNotEmpty &&
      errMetaNotPaused.isNotEmpty &&
      errAlreadyOfficial.isNotEmpty &&
      errNotOfficial.isNotEmpty &&
      errListFailed.isNotEmpty &&
      errNotLive.isNotEmpty &&
      errGameFinished.isNotEmpty &&
      errNoteTooLong.isNotEmpty &&
      errBulkRoundInvalid.isNotEmpty &&
      errBulkEmpty.isNotEmpty &&
      filterAll.isNotEmpty &&
      filterOfficialPaused.isNotEmpty &&
      activityTitle.isNotEmpty &&
      activityEmpty.isNotEmpty &&
      activityPauseFmt.isNotEmpty &&
      activityResumeFmt.isNotEmpty &&
      metaAction.isNotEmpty &&
      metaPending.isNotEmpty &&
      toastMeta.isNotEmpty &&
      toastMetaFailed.isNotEmpty &&
      activityMetaFmt.isNotEmpty &&
      bulkPauseAction.isNotEmpty &&
      bulkPausePending.isNotEmpty &&
      bulkConfirmTitle.isNotEmpty &&
      bulkConfirmDescription.isNotEmpty &&
      bulkConfirm.isNotEmpty &&
      toastBulkPaused.isNotEmpty &&
      toastBulkPartial.isNotEmpty &&
      toastBulkFailed.isNotEmpty &&
      liveBoardsEmpty.isNotEmpty &&
      clockFrozen.isNotEmpty &&
      bannerSinceFmt.isNotEmpty &&
      bannerResumedFmt.isNotEmpty &&
      statusLive.isNotEmpty &&
      statusPlayerPause.isNotEmpty &&
      statusOfficialPause.isNotEmpty &&
      statusFinished.isNotEmpty &&
      actionsMenuLabel.isNotEmpty &&
      selectAllLabel.isNotEmpty &&
      selectRowLabel.isNotEmpty &&
      selectedCountFmt.isNotEmpty &&
      clearSelectionAction.isNotEmpty &&
      bulkSelectedPauseAction.isNotEmpty &&
      bulkSelectedPausePending.isNotEmpty &&
      bulkSelectedConfirmTitle.isNotEmpty &&
      bulkSelectedConfirmDescription.isNotEmpty &&
      bulkSelectedConfirm.isNotEmpty &&
      bulkSelectedResumeAction.isNotEmpty &&
      bulkSelectedResumePending.isNotEmpty &&
      bulkSelectedResumeConfirmTitle.isNotEmpty &&
      bulkSelectedResumeConfirmDescription.isNotEmpty &&
      bulkSelectedResumeConfirm.isNotEmpty &&
      toastBulkResumed.isNotEmpty &&
      toastBulkResumePartial.isNotEmpty &&
      toastBulkResumeFailed.isNotEmpty &&
      copyGameIdAction.isNotEmpty &&
      toastCopiedGameId.isNotEmpty &&
      reasons.isNotEmpty;

  String roleLabel(String role) {
    final r = role.trim().toLowerCase();
    if (r == 'admin') return roleAdminLabel;
    if (r == 'organizer') return roleOrganizerLabel;
    if (r == 'player') return rolePlayerLabel;
    return '';
  }

  /// Map API error_key onto DB chrome (fail closed empty when unknown).
  String labelForErrorKey(String key) {
    var k = key.trim();
    // OTP middleware uses otp_chrome keys; map onto official_pause err_otp copy.
    if (k == 'err_verification_required' ||
        k == 'err_verification_unavailable' ||
        k == 'err_unauthorized') {
      k = 'err_otp';
    }
    switch (k) {
      case 'err_forbidden':
        return errForbidden;
      case 'err_reason_required':
        return errReasonRequired;
      case 'err_reason_invalid':
        return errReasonInvalid;
      case 'err_player_resume_blocked':
        return errPlayerResumeBlocked;
      case 'err_rate_limited':
        return errRateLimited;
      case 'err_audit_failed':
        return errAuditFailed;
      case 'err_meta_not_paused':
        return errMetaNotPaused;
      case 'err_note_too_long':
        return errNoteTooLong;
      case 'err_not_live':
        return errNotLive;
      case 'err_game_finished':
        return errGameFinished;
      case 'err_already_official':
        return errAlreadyOfficial;
      case 'err_not_official':
        return errNotOfficial;
      case 'err_list_failed':
        return errListFailed;
      case 'err_bulk_round_invalid':
        return errBulkRoundInvalid;
      case 'err_bulk_empty':
        return errBulkEmpty;
      case 'err_update_failed':
        return errUpdateFailed;
      case 'err_otp':
        return errOtp;
      case 'err_invalid_body':
        return errInvalidBody;
      default:
        return '';
    }
  }

  static OfficialPauseChrome? fromJson(Map<String, dynamic>? map) {
    if (map == null) return null;
    String s(String k) => ((map[k] as String?) ?? '').trim();
    final rawReasons = map['reasons'];
    final reasons = <OfficialPauseReason>[];
    if (rawReasons is List) {
      for (final item in rawReasons) {
        if (item is! Map) continue;
        final key = (item['key'] as String?)?.trim() ?? '';
        final label = (item['label'] as String?)?.trim() ?? '';
        if (key.isEmpty || label.isEmpty) continue;
        reasons.add(OfficialPauseReason(key: key, label: label));
      }
    }
    final chrome = OfficialPauseChrome(
      source: s('source'),
      unavailable: s('official_pause_chrome_unavailable'),
      pauseAction: s('pause_action'),
      pausePending: s('pause_pending'),
      resumeAction: s('resume_action'),
      resumePending: s('resume_pending'),
      reasonLabel: s('reason_label'),
      reasonPlaceholder: s('reason_placeholder'),
      noteLabel: s('note_label'),
      notePlaceholder: s('note_placeholder'),
      confirmPauseTitle: s('confirm_pause_title'),
      confirmPauseDescription: s('confirm_pause_description'),
      confirmResumeTitle: s('confirm_resume_title'),
      confirmResumeDescription: s('confirm_resume_description'),
      confirmCancel: s('confirm_cancel'),
      confirmPause: s('confirm_pause'),
      confirmResume: s('confirm_resume'),
      toastPaused: s('toast_paused'),
      toastResumed: s('toast_resumed'),
      toastPauseFailed: s('toast_pause_failed'),
      toastResumeFailed: s('toast_resume_failed'),
      roleAdminLabel: s('role_admin_label'),
      roleOrganizerLabel: s('role_organizer_label'),
      rolePlayerLabel: s('role_player_label'),
      errForbidden: s('err_forbidden'),
      errReasonRequired: s('err_reason_required'),
      errReasonInvalid: s('err_reason_invalid'),
      errPlayerResumeBlocked: s('err_player_resume_blocked'),
      reasons: reasons,
      filterAll: s('filter_all'),
      filterOfficialPaused: s('filter_official_paused'),
      kpiCountSeparator: s('kpi_count_separator'),
      activityTitle: s('activity_title'),
      activityEmpty: s('activity_empty'),
      activityPauseFmt: s('activity_pause_fmt'),
      activityResumeFmt: s('activity_resume_fmt'),
      colPausedBy: s('col_paused_by'),
      colReason: s('col_reason'),
      colPausedAt: s('col_paused_at'),
      colDuration: s('col_duration'),
      clockFrozen: s('clock_frozen_label'),
      bannerSinceFmt: s('banner_since_fmt'),
      bannerResumedFmt: s('banner_resumed_fmt'),
      statusLive: s('status_live'),
      statusPlayerPause: s('status_player_pause'),
      statusOfficialPause: s('status_official_pause'),
      statusFinished: s('status_finished'),
      metaAction: s('meta_action'),
      metaPending: s('meta_pending'),
      toastMeta: s('toast_meta_saved'),
      toastMetaFailed: s('toast_meta_failed'),
      activityMetaFmt: s('activity_meta_fmt'),
      errRateLimited: s('err_rate_limited'),
      errAuditFailed: s('err_audit_failed'),
      errMetaNotPaused: s('err_meta_not_paused'),
      errNoteTooLong: s('err_note_too_long'),
      errNotLive: s('err_not_live'),
      errGameFinished: s('err_game_finished'),
      errAlreadyOfficial: s('err_already_official'),
      errNotOfficial: s('err_not_official'),
      errListFailed: s('err_list_failed'),
      errBulkRoundInvalid: s('err_bulk_round_invalid'),
      errBulkEmpty: s('err_bulk_empty'),
      errUpdateFailed: s('err_update_failed'),
      errOtp: s('err_otp'),
      errInvalidBody: s('err_invalid_body'),
      bulkPauseAction: s('bulk_pause_action'),
      bulkPausePending: s('bulk_pause_pending'),
      bulkConfirmTitle: s('bulk_confirm_title'),
      bulkConfirmDescription: s('bulk_confirm_description'),
      bulkConfirm: s('bulk_confirm'),
      toastBulkPaused: s('toast_bulk_paused'),
      toastBulkPartial: s('toast_bulk_partial'),
      toastBulkFailed: s('toast_bulk_failed'),
      liveBoardsEmpty: s('live_boards_empty'),
      actionsMenuLabel: s('actions_menu_label'),
      selectAllLabel: s('select_all_label'),
      selectRowLabel: s('select_row_label'),
      selectedCountFmt: s('selected_count_fmt'),
      clearSelectionAction: s('clear_selection_action'),
      bulkSelectedPauseAction: s('bulk_selected_pause_action'),
      bulkSelectedPausePending: s('bulk_selected_pause_pending'),
      bulkSelectedConfirmTitle: s('bulk_selected_confirm_title'),
      bulkSelectedConfirmDescription: s('bulk_selected_confirm_description'),
      bulkSelectedConfirm: s('bulk_selected_confirm'),
      bulkSelectedResumeAction: s('bulk_selected_resume_action'),
      bulkSelectedResumePending: s('bulk_selected_resume_pending'),
      bulkSelectedResumeConfirmTitle: s('bulk_selected_resume_confirm_title'),
      bulkSelectedResumeConfirmDescription:
          s('bulk_selected_resume_confirm_description'),
      bulkSelectedResumeConfirm: s('bulk_selected_resume_confirm'),
      toastBulkResumed: s('toast_bulk_resumed'),
      toastBulkResumePartial: s('toast_bulk_resume_partial'),
      toastBulkResumeFailed: s('toast_bulk_resume_failed'),
      copyGameIdAction: s('copy_game_id_action'),
      toastCopiedGameId: s('toast_copied_game_id'),
    );
    return chrome.isReady ? chrome : null;
  }
}
