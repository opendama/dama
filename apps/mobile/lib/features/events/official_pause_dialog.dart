import 'package:dama_mobile/core/types/official_pause_chrome.dart';
import 'package:flutter/material.dart';

enum OfficialPauseDialogMode { pause, resume, meta }

/// Reason + optional note dialog for official pause / resume / meta (DB chrome only).
Future<({String reasonKey, String note})?> showOfficialPauseDialog(
  BuildContext context, {
  required OfficialPauseChrome chrome,
  required OfficialPauseDialogMode mode,
  @Deprecated('Use mode') bool? resume,
  String titleOverride = '',
  String descriptionOverride = '',
  String confirmOverride = '',
  String pendingOverride = '',
  String initialReasonKey = '',
  String initialNote = '',
}) async {
  final effective = resume == null
      ? mode
      : (resume
          ? OfficialPauseDialogMode.resume
          : OfficialPauseDialogMode.pause);
  if (!chrome.isReady) return null;
  final reasons = chrome.reasons;
  final needsReason = effective == OfficialPauseDialogMode.pause ||
      effective == OfficialPauseDialogMode.meta;
  if (needsReason && reasons.isEmpty) return null;
  if (effective == OfficialPauseDialogMode.meta &&
      chrome.metaAction.trim().isEmpty) {
    return null;
  }

  final seededReason = initialReasonKey.trim();
  var reasonKey = seededReason.isNotEmpty
      ? seededReason
      : (reasons.isNotEmpty ? reasons.first.key : '');
  final noteCtrl = TextEditingController(text: initialNote.trim());

  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) {
      return StatefulBuilder(
        builder: (ctx, setLocal) {
          final title = titleOverride.trim().isNotEmpty
              ? titleOverride.trim()
              : switch (effective) {
                  OfficialPauseDialogMode.resume => chrome.confirmResumeTitle,
                  OfficialPauseDialogMode.meta => chrome.metaAction,
                  OfficialPauseDialogMode.pause => chrome.confirmPauseTitle,
                };
          final description = descriptionOverride.trim().isNotEmpty
              ? descriptionOverride.trim()
              : switch (effective) {
                  OfficialPauseDialogMode.resume =>
                    chrome.confirmResumeDescription,
                  OfficialPauseDialogMode.meta =>
                    chrome.confirmPauseDescription,
                  OfficialPauseDialogMode.pause =>
                    chrome.confirmPauseDescription,
                };
          final confirm = confirmOverride.trim().isNotEmpty
              ? confirmOverride.trim()
              : switch (effective) {
                  OfficialPauseDialogMode.resume => chrome.confirmResume,
                  OfficialPauseDialogMode.meta => chrome.metaAction,
                  OfficialPauseDialogMode.pause => chrome.confirmPause,
                };
          // pendingOverride reserved for callers that show pending outside dialog.
          final _ = pendingOverride;
          return AlertDialog(
            title: Text(title),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(description),
                  if (needsReason) ...[
                    const SizedBox(height: 12),
                    Text(chrome.reasonLabel),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      value: reasonKey.isEmpty ? null : reasonKey,
                      decoration: InputDecoration(
                        hintText: chrome.reasonPlaceholder,
                      ),
                      items: [
                        for (final r in reasons)
                          DropdownMenuItem(value: r.key, child: Text(r.label)),
                      ],
                      onChanged: (v) {
                        setLocal(() => reasonKey = (v ?? '').trim());
                      },
                    ),
                  ],
                  const SizedBox(height: 12),
                  Text(chrome.noteLabel),
                  const SizedBox(height: 6),
                  TextField(
                    controller: noteCtrl,
                    maxLines: 3,
                    decoration: InputDecoration(
                      hintText: chrome.notePlaceholder,
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: Text(chrome.confirmCancel),
              ),
              FilledButton(
                onPressed: () {
                  if (needsReason && reasonKey.trim().isEmpty) return;
                  Navigator.of(ctx).pop(true);
                },
                child: Text(confirm),
              ),
            ],
          );
        },
      );
    },
  );

  final note = noteCtrl.text.trim();
  noteCtrl.dispose();
  if (result != true) return null;
  if (needsReason && reasonKey.trim().isEmpty) return null;
  return (reasonKey: reasonKey.trim(), note: note);
}
