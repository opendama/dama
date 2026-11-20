import 'dart:convert';

import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/features/events/community_player_chrome_soft.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

/// Map POST /events/join failures to events_player_chrome (web / tournament enroll parity).
/// Never surface raw JSON or load_failed for seat conflicts.
String eventJoinErrorChrome(EventsPlayerChrome chrome, http.Response res) {
  String apiMsg = '';
  String key = '';
  try {
    final decoded = jsonDecode(res.body);
    if (decoded is Map) {
      final err = decoded['error'];
      if (err is String) apiMsg = err.trim();
      final ek = decoded['error_key'];
      if (ek is String) key = ek.trim();
    }
  } catch (_) {}
  // Never toast / blurb transport JSON blobs.
  if (apiMsg.startsWith('{') || apiMsg.startsWith('[')) apiMsg = '';
  final lower = apiMsg.toLowerCase();

  if (key == 'already_joined' ||
      lower.contains('already joined') ||
      (res.statusCode == 409 && lower.contains('already'))) {
    final m = softCommunityJoinStatusMessage(chrome.alreadyJoined);
    if (m.isNotEmpty) return m;
    return softCommunityJoinStatusMessage(apiMsg);
  }
  if (key == 'event_full' || lower.contains('full')) {
    final m = softCommunityJoinStatusMessage(chrome.eventFull);
    if (m.isNotEmpty) return m;
    return softCommunityJoinStatusMessage(apiMsg);
  }
  if (key == 'event_not_joinable' || lower.contains('not joinable')) {
    final m = softCommunityJoinStatusMessage(chrome.eventNotJoinable);
    if (m.isNotEmpty) return m;
    return softCommunityJoinStatusMessage(apiMsg);
  }
  if (res.statusCode == 402 || key == 'insufficient_entry_fee') {
    final m = softCommunityJoinStatusMessage(chrome.insufficientEntryFee);
    if (m.isNotEmpty) return m;
    return softCommunityJoinStatusMessage(apiMsg);
  }
  // Legacy / unmapped API text - scrub Event-sport before surfacing.
  if (apiMsg.isNotEmpty) {
    final scrubbed = softCommunityJoinStatusMessage(apiMsg);
    return scrubbed.isNotEmpty
        ? scrubbed
        : softCommunityLoadFailed(chrome.loadFailed);
  }
  return softCommunityLoadFailed(chrome.loadFailed);
}

bool isAlreadyJoinedEventError(http.Response res) {
  String apiMsg = '';
  String key = '';
  try {
    final decoded = jsonDecode(res.body);
    if (decoded is Map) {
      final err = decoded['error'];
      if (err is String) apiMsg = err.trim();
      final ek = decoded['error_key'];
      if (ek is String) key = ek.trim();
    }
  } catch (_) {}
  final lower = apiMsg.toLowerCase();
  return key == 'already_joined' ||
      lower.contains('already joined') ||
      (res.statusCode == 409 && lower.contains('already'));
}

/// Soft-success / error SnackBars (web toast.success / toast.error parity).
void showEventJoinSnack(
  BuildContext context, {
  required String message,
  bool success = false,
  SnackBarAction? action,
}) {
  final msg = message.trim();
  if (msg.isEmpty) return;
  final tokens = damaColorsOf(context);
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(
        msg,
        style: TextStyle(
          color: success ? tokens.onGold : Colors.white,
        ),
      ),
      backgroundColor: success ? tokens.gold : tokens.danger,
      action: action,
    ),
  );
}
