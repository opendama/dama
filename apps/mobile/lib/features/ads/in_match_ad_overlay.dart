import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/geo/device_locate.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/ads/resolve_viewport_creative.dart';
import 'package:dama_mobile/core/types/ads.dart';
import 'package:dama_mobile/features/ads/viewport_ad_creative.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Full-screen in-match ad driven by POST /ads/in-match/eligibility (DB-backed).
class InMatchAdOverlay extends StatefulWidget {
  const InMatchAdOverlay({
    super.key,
    required this.active,
    required this.gameStartedAt,
  });

  final bool active;
  final DateTime? gameStartedAt;

  @override
  State<InMatchAdOverlay> createState() => _InMatchAdOverlayState();
}

class _InMatchAdOverlayState extends State<InMatchAdOverlay> {
  Timer? _checkTimer;
  Timer? _countdownTimer;
  DateTime? _lastShownAt;
  int? _nextIntervalSec;
  bool _open = false;
  bool _checking = false;
  ServedAdCampaign? _campaign;
  int? _nonSkippable;
  int? _remaining;
  int? _intervalMin;
  int? _nonSkipMin;
  Map<String, dynamic>? _geo;
  Map<String, dynamic>? _playerChrome;
  ViewportBreakpoints? _viewportBreakpoints;
  Map<String, String>? _scheduleChrome;

  @override
  void initState() {
    super.initState();
    unawaited(_boot());
  }

  @override
  void didUpdateWidget(covariant InMatchAdOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!widget.active || widget.gameStartedAt == null) {
      _reset();
      return;
    }
    if (oldWidget.gameStartedAt != widget.gameStartedAt ||
        oldWidget.active != widget.active) {
      unawaited(_check());
    }
  }

  @override
  void dispose() {
    _checkTimer?.cancel();
    _countdownTimer?.cancel();
    super.dispose();
  }

  Future<void> _boot() async {
    try {
      final playback = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/playback'),
      );
      if (playback.statusCode < 300) {
        final pb = jsonDecode(playback.body) as Map<String, dynamic>;
        final chrome = pb['player_chrome'] as Map<String, dynamic>?;
        final scheduleRaw = pb['schedule_chrome'];
        if (scheduleRaw is Map<String, dynamic>) {
          final scheduleChrome = scheduleRaw.map(
            (k, v) => MapEntry(k, v?.toString() ?? ''),
          );
          _viewportBreakpoints = parseViewportBreakpoints(scheduleChrome);
          _scheduleChrome = scheduleChrome;
        }
        final intervalMin = (pb['interval_min'] as num?)?.toInt();
        final nonSkip = (pb['non_skippable_seconds'] as num?)?.toInt();
        final nonSkipMin = (pb['non_skippable_min'] as num?)?.toInt();
        final nonSkipMax = (pb['non_skippable_max'] as num?)?.toInt();
        if (chrome != null &&
            intervalMin != null &&
            intervalMin >= 1 &&
            nonSkip != null &&
            nonSkipMin != null &&
            nonSkipMax != null &&
            nonSkipMin >= 1 &&
            nonSkipMax >= nonSkipMin &&
            nonSkip >= nonSkipMin &&
            nonSkip <= nonSkipMax &&
            (chrome['sponsored_label']?.toString() ?? '').isNotEmpty &&
            (chrome['skip_in_template']?.toString() ?? '').isNotEmpty &&
            (chrome['can_continue_label']?.toString() ?? '').isNotEmpty &&
            (chrome['continue_action']?.toString() ?? '').isNotEmpty &&
            (chrome['placement_in_match']?.toString() ?? '').isNotEmpty &&
            (chrome['placement_lobby']?.toString() ?? '').isNotEmpty) {
          _playerChrome = chrome;
          _intervalMin = intervalMin;
          _nonSkipMin = nonSkipMin;
        }
      }
      final located = await locateWithDeviceGps(
        locateUrl: '${ApiConfig.baseUrl}/api/v1/geo/locate',
      );
      if (located == null) return;
      _geo = <String, dynamic>{
        'country_code': located.countryCode,
        if (located.region != null) 'region': located.region,
        if (located.city != null) 'city': located.city,
        if (located.latitude != null) 'lat': located.latitude,
        if (located.longitude != null) 'lng': located.longitude,
      };
      if (widget.active && widget.gameStartedAt != null) {
        await _check();
      }
    } catch (_) {}
  }

  void _reset() {
    _checkTimer?.cancel();
    _countdownTimer?.cancel();
    if (!mounted) return;
    setState(() {
      _open = false;
      _campaign = null;
      _nonSkippable = null;
      _remaining = null;
      _lastShownAt = null;
    });
  }

  Future<String> _viewerKey() async {
    const key = 'dama_ad_viewer';
    final prefs = await SharedPreferences.getInstance();
    var v = prefs.getString(key);
    if (v == null || v.isEmpty) {
      v = DateTime.now().microsecondsSinceEpoch.toString();
      await prefs.setString(key, v);
    }
    return v;
  }

  void _schedule(int seconds) {
    final wait = seconds < 1 ? 1 : seconds;
    _checkTimer?.cancel();
    _checkTimer = Timer(Duration(seconds: wait), () {
      unawaited(_check());
    });
  }

  Future<void> _check() async {
    if (!widget.active ||
        widget.gameStartedAt == null ||
        _open ||
        _checking ||
        _geo == null ||
        _playerChrome == null ||
        _intervalMin == null ||
        _nonSkipMin == null) {
      return;
    }
    _checking = true;
    try {
      final elapsed =
          DateTime.now().difference(widget.gameStartedAt!).inSeconds;
      final sinceLast = _lastShownAt == null
          ? null
          : DateTime.now().difference(_lastShownAt!).inSeconds;
      final viewer = await _viewerKey();
      // Server resolves match geo from IP/GPS; optional lat/lng only.
      final body = <String, dynamic>{
        'game_elapsed_seconds': elapsed,
        'viewer_key': viewer,
        if (_geo!['lat'] != null) 'lat': _geo!['lat'],
        if (_geo!['lng'] != null) 'lng': _geo!['lng'],
        if (sinceLast != null) 'seconds_since_last_ad': sinceLast,
      };
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/in-match/eligibility'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        final backoff = _intervalMin != null && _intervalMin! > 0 ? _intervalMin! : 30;
        _schedule(backoff < 30 ? 30 : backoff);
        return;
      }
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final interval = (data['interval_seconds'] as num?)?.toInt();
      if (interval != null && interval >= _intervalMin!) {
        _nextIntervalSec = interval;
      }
      final show = data['show'] == true;
      final campaignJson = data['campaign'] as Map<String, dynamic>?;
      final nonSkip = (data['non_skippable_seconds'] as num?)?.toInt();
      if (show &&
          campaignJson != null &&
          nonSkip != null &&
          nonSkip >= _nonSkipMin!) {
        final campaign = ServedAdCampaign.fromJson(campaignJson);
        final placement =
            (_playerChrome!['placement_in_match']?.toString() ?? '').trim();
        if (campaign.id.isEmpty ||
            (campaign.title ?? '').isEmpty ||
            placement.isEmpty) {
          return;
        }
        final bp = _viewportBreakpoints;
        if (bp == null) {
          final wait = (data['next_check_after_seconds'] as num?)?.toInt();
          if (wait != null && wait > 0) {
            _schedule(wait);
          } else if (_nextIntervalSec != null && _nextIntervalSec! > 0) {
            _schedule(_nextIntervalSec!);
          }
          return;
        }
        final width = MediaQuery.maybeSizeOf(context)?.width ??
            bp.tabletMax.toDouble() + 1;
        final picked = pickCampaignCreative(
          viewportSourceFromServed(campaign),
          resolveViewportSlot(width, bp),
        );
        final videoId =
            isStubVideoId(picked.videoId.trim()) ? '' : picked.videoId.trim();
        final imageUrl = resolvePublicMediaUrl(picked.imageUrl);
        if (videoId.isEmpty && imageUrl.isEmpty) {
          // Exact-slot only: no creative for this screen; do not block the match.
          if (_nextIntervalSec != null && _nextIntervalSec! > 0) {
            _schedule(_nextIntervalSec!);
          }
          return;
        }
        setState(() {
          _open = true;
          _campaign = campaign;
          _nonSkippable = nonSkip;
          _remaining = nonSkip;
          _lastShownAt = DateTime.now();
        });
        _startCountdown();
        unawaited(
          http.post(
            Uri.parse(
              '${ApiConfig.baseUrl}/api/v1/ads/campaigns/${campaign.id}/impression',
            ),
            headers: {
              'Content-Type': 'application/json',
              'X-Device-Id': viewer,
            },
            body: jsonEncode({
              'viewer_key': viewer,
              'placement': placement,
            }),
          ),
        );
        return;
      }
      final wait = (data['next_check_after_seconds'] as num?)?.toInt();
      if (wait != null && wait > 0) {
        _schedule(wait);
      } else if (_nextIntervalSec != null && _nextIntervalSec! > 0) {
        _schedule(_nextIntervalSec!);
      } else if (_intervalMin != null && _intervalMin! > 0) {
        _schedule(_intervalMin!);
      }
    } catch (_) {
      // Fail closed with backoff so eligibility never spins during live play.
      final backoff = _intervalMin != null && _intervalMin! > 0 ? _intervalMin! : 30;
      _schedule(backoff < 30 ? 30 : backoff);
    } finally {
      _checking = false;
    }
  }

  void _startCountdown() {
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _remaining == null) return;
      if (_remaining! <= 0) {
        _countdownTimer?.cancel();
        return;
      }
      setState(() => _remaining = _remaining! - 1);
    });
  }

  void _close() {
    _countdownTimer?.cancel();
    setState(() {
      _open = false;
      _campaign = null;
      _nonSkippable = null;
      _remaining = null;
    });
    final interval = _nextIntervalSec;
    if (interval != null &&
        interval > 0 &&
        widget.active &&
        widget.gameStartedAt != null) {
      _schedule(interval);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_open ||
        _campaign == null ||
        _nonSkippable == null ||
        _remaining == null ||
        _playerChrome == null ||
        _viewportBreakpoints == null) {
      return const SizedBox.shrink();
    }
    final canSkip = _remaining! <= 0;
    final tokens = damaColorsOf(context);
    final chrome = _playerChrome!;
    final skipLabel = (chrome['skip_in_template']?.toString() ?? '')
        .replaceAll('{seconds}', '$_remaining');
    final source = viewportSourceFromServed(_campaign!);
    final width = MediaQuery.sizeOf(context).width;
    final bp = _viewportBreakpoints!;
    final picked = pickCampaignCreative(
      source,
      resolveViewportSlot(width, bp),
    );
    var videoId = picked.videoId.trim();
    if (isStubVideoId(videoId)) videoId = '';
    final imageUrl = resolvePublicMediaUrl(picked.imageUrl);
    final hasCreative = videoId.isNotEmpty || imageUrl.isNotEmpty;
    // Exact-slot serve: never block play with a title-only overlay.
    if (!hasCreative) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _open) _close();
      });
      return const SizedBox.shrink();
    }
    return Positioned.fill(
      child: Material(
        color: tokens.overlayScrim,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: tokens.card,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: tokens.borderSubtle),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    chrome['sponsored_label']?.toString() ?? '',
                    style: TextStyle(
                      fontSize: 11,
                      letterSpacing: 1.2,
                      color: tokens.onSurfaceMuted,
                    ),
                  ),
                  const SizedBox(height: 12),
                  ViewportAdCreative(
                    source: source,
                    breakpoints: _viewportBreakpoints,
                    scheduleChrome: _scheduleChrome,
                    maxWidth: 420,
                  ),
                  const SizedBox(height: 12),
                  Text(_campaign!.title ?? ''),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          canSkip
                              ? (chrome['can_continue_label']?.toString() ?? '')
                              : skipLabel,
                          style: TextStyle(color: tokens.onSurfaceMuted),
                        ),
                      ),
                      FilledButton(
                        onPressed: canSkip ? _close : null,
                        child:
                            Text(chrome['continue_action']?.toString() ?? ''),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
