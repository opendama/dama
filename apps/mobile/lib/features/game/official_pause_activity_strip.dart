import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

/// Compact pause/resume/meta timeline from GET /games/{id}/official-pause-events.
class OfficialPauseActivityStrip extends StatefulWidget {
  const OfficialPauseActivityStrip({
    super.key,
    required this.accessToken,
    required this.gameId,
    required this.chrome,
    this.enabled = true,
    this.refreshToken = 0,
  });

  final String accessToken;
  final String gameId;
  final OfficialPauseChrome? chrome;
  final bool enabled;
  final int refreshToken;

  @override
  State<OfficialPauseActivityStrip> createState() =>
      _OfficialPauseActivityStripState();
}

class _OfficialPauseActivityStripState
    extends State<OfficialPauseActivityStrip> {
  List<Map<String, dynamic>> _events = const [];
  String _loadedFor = '';
  bool _forbidden = false;

  @override
  void initState() {
    super.initState();
    unawaited(_load(force: true));
  }

  @override
  void didUpdateWidget(covariant OfficialPauseActivityStrip oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.gameId != widget.gameId ||
        oldWidget.enabled != widget.enabled ||
        oldWidget.accessToken != widget.accessToken ||
        oldWidget.refreshToken != widget.refreshToken) {
      unawaited(_load(force: true));
    }
  }

  Future<void> _load({bool force = false}) async {
    final gid = widget.gameId.trim();
    final title = (widget.chrome?.activityTitle ?? '').trim();
    if (!widget.enabled || gid.isEmpty || title.isEmpty) {
      if (mounted) {
        setState(() {
          _events = const [];
          _loadedFor = '';
          _forbidden = false;
        });
      }
      return;
    }
    if (!force && _loadedFor == gid) return;
    try {
      final res = await http.get(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/games/${Uri.encodeComponent(gid)}/official-pause-events',
        ),
        headers: {
          'Authorization': 'Bearer ${widget.accessToken}',
          'Accept': 'application/json',
        },
      );
      if (!mounted) return;
      // Pure spectators are forbidden; hide the shell (blur cover only).
      if (res.statusCode == 401 || res.statusCode == 403) {
        setState(() {
          _events = const [];
          _loadedFor = gid;
          _forbidden = true;
        });
        return;
      }
      if (res.statusCode >= 300) {
        setState(() {
          _events = const [];
          _loadedFor = '';
          _forbidden = true;
        });
        return;
      }
      final map = jsonDecode(res.body);
      if (map is! Map<String, dynamic>) return;
      final raw = map['events'];
      final events = <Map<String, dynamic>>[];
      if (raw is List) {
        for (final item in raw) {
          if (item is Map<String, dynamic>) events.add(item);
        }
      }
      setState(() {
        _events = events;
        _loadedFor = gid;
        _forbidden = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _forbidden = true;
          _events = const [];
        });
      }
    }
  }

  String _line(Map<String, dynamic> ev) {
    final chrome = widget.chrome;
    if (chrome == null) return '';
    final action = (ev['action'] as String?)?.trim() ?? '';
    final role = chrome.roleLabel((ev['actor_role'] as String?) ?? '');
    final name = (ev['actor_display_name'] as String?)?.trim() ?? '';
    final reason = (ev['reason_label'] as String?)?.trim() ?? '';
    final note = (ev['note'] as String?)?.trim() ?? '';
    final fmt = action == 'resume'
        ? chrome.activityResumeFmt
        : action == 'meta'
            ? chrome.activityMetaFmt
            : chrome.activityPauseFmt;
    if (fmt.trim().isEmpty) return '';
    // Fail closed: never show hollow "by ·" (fmt needs both role and name).
    if (role.isEmpty || name.isEmpty) return '';
    return fmt
        .replaceAll('{role}', role)
        .replaceAll('{name}', name)
        .replaceAll('{reason}', reason)
        .replaceAll('{note}', note)
        .trim();
  }

  @override
  Widget build(BuildContext context) {
    final chrome = widget.chrome;
    final title = (chrome?.activityTitle ?? '').trim();
    if (!widget.enabled || title.isEmpty || _forbidden) {
      return const SizedBox.shrink();
    }
    final tokens = damaColorsOf(context);
    final empty = (chrome?.activityEmpty ?? '').trim();
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border.all(color: tokens.border),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                title,
                style: TextStyle(
                  color: tokens.onSurfaceMuted,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
              if (_events.isEmpty)
                Text(
                  empty,
                  style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
                )
              else
                ..._events.take(5).map((ev) {
                  final line = _line(ev);
                  if (line.isEmpty) return const SizedBox.shrink();
                  return Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(line, style: const TextStyle(fontSize: 12)),
                  );
                }),
            ],
          ),
        ),
      ),
    );
  }
}
