import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/ui/chrome_select_sheet.dart';
import 'package:dama_mobile/features/events/events_dialog_shell.dart';
import 'package:dama_mobile/features/events/community_player_chrome_soft.dart';
import 'package:dama_mobile/features/events/hosting_organizer_chrome_soft.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

/// Report hosted event dialog - chrome strings only (fail closed).
Future<void> showEventReportDialog(
  BuildContext context, {
  required String accessToken,
  required String eventId,
  required List<String> reasonCodes,
  Map<String, String> reasonLabels = const {},
  String emptyValue = '',
  required String title,
  required String reasonLabel,
  required String noteLabel,
  required String submitAction,
  required String toastSent,
  required String toastFailed,
  required String cancelAction,
  required String dialogShellMaxHeightRatio,
  required String dialogShellMaxWidth,
  required String dialogShellInsetH,
  required String dialogShellInsetV,
  required String dialogShellLoadingHeight,
}) async {
  if (reasonCodes.isEmpty) return;
  final shell = EventsDialogShell.tryParse(
    maxHeightRatio: dialogShellMaxHeightRatio,
    maxWidth: dialogShellMaxWidth,
    insetH: dialogShellInsetH,
    insetV: dialogShellInsetV,
    loadingHeight: dialogShellLoadingHeight,
  );
  if (shell == null) return;
  final noteCtrl = TextEditingController();
  String? reason = reasonCodes.first;
  var submitting = false;
  String labelFor(String code) {
    final l = (reasonLabels[code] ?? '').trim();
    if (l.isNotEmpty) return l;
    return emptyValue.trim();
  }

  await showDialog<void>(
    context: context,
    builder: (ctx) {
      return StatefulBuilder(
        builder: (ctx, setLocal) {
          final media = MediaQuery.sizeOf(ctx);
          return AlertDialog(
            insetPadding: shell.insetPadding,
            title: Text(softHostingReportTitle(title)),
            content: ConstrainedBox(
              constraints: shell.constraintsFor(media),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    ChromeSelectField(
                      label: softCommunityReportReasonLabel(reasonLabel),
                      valueLabel:
                          reason != null ? labelFor(reason!) : emptyValue,
                      onTap: () async {
                        final picked = await showChromeOptionSheet<String>(
                          context: ctx,
                          title: softCommunityReportReasonLabel(reasonLabel),
                          selected: reason,
                          options: [
                            for (final c in reasonCodes)
                              if (labelFor(c).isNotEmpty)
                                ChromeSelectOption(
                                    value: c, label: labelFor(c)),
                          ],
                        );
                        if (picked != null) setLocal(() => reason = picked);
                      },
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: noteCtrl,
                      maxLines: 3,
                      decoration: InputDecoration(
                        labelText: softCommunityReportNoteLabel(noteLabel),
                        border: const OutlineInputBorder(),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: submitting ? null : () => Navigator.of(ctx).pop(),
                child: Text(softHostingCancelAction(cancelAction)),
              ),
              FilledButton(
                onPressed: submitting || reason == null
                    ? null
                    : () async {
                        setLocal(() => submitting = true);
                        try {
                          final res = await http.post(
                            Uri.parse(
                              '${ApiConfig.baseUrl}/api/v1/events/${Uri.encodeComponent(eventId)}/report',
                            ),
                            headers: {
                              'Authorization': 'Bearer $accessToken',
                              'Content-Type': 'application/json',
                            },
                            body: jsonEncode({
                              'reason_code': reason,
                              'note': noteCtrl.text.trim(),
                            }),
                          );
                          if (!ctx.mounted) return;
                          if (res.statusCode >= 300) {
                            ScaffoldMessenger.of(ctx).showSnackBar(
                              SnackBar(content: Text(toastFailed)),
                            );
                            setLocal(() => submitting = false);
                            return;
                          }
                          Navigator.of(ctx).pop();
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(toastSent)),
                          );
                        } catch (_) {
                          if (!ctx.mounted) return;
                          ScaffoldMessenger.of(ctx).showSnackBar(
                            SnackBar(content: Text(toastFailed)),
                          );
                          setLocal(() => submitting = false);
                        }
                      },
                child: Text(softCommunityReportSubmitAction(submitAction)),
              ),
            ],
          );
        },
      );
    },
  );
  noteCtrl.dispose();
}
