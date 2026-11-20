import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:dama_mobile/core/cache/query_cache.dart';
import 'package:dama_mobile/core/geo/device_locate.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/ads/resolve_viewport_creative.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/features/ads/viewport_ad_creative.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Player-facing geo ad slot: serve + one-shot impression from backend only.
class GeoAdSlot extends StatefulWidget {
  const GeoAdSlot({super.key});

  @override
  State<GeoAdSlot> createState() => _GeoAdSlotState();
}

class _GeoAdSlotState extends State<GeoAdSlot> {
  ServedAdCampaign? _ad;
  String? _impressedId;
  String? _lobbyPlacement;
  ViewportBreakpoints? _viewportBreakpoints;
  Map<String, String>? _scheduleChrome;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    unawaited(_load(showSkeleton: true));
  }

  Future<bool> _loadPlacement() async {
    final playback = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/playback'),
    );
    if (playback.statusCode >= 300) return false;
    final pb = jsonDecode(playback.body) as Map<String, dynamic>;
    final chrome = pb['player_chrome'] as Map<String, dynamic>?;
    final place = (chrome?['placement_lobby']?.toString() ?? '').trim();
    if (place.isEmpty) return false;
    _lobbyPlacement = place;
    final scheduleRaw = pb['schedule_chrome'];
    if (scheduleRaw is Map<String, dynamic>) {
      final scheduleChrome = scheduleRaw.map(
        (k, v) => MapEntry(k, v?.toString() ?? ''),
      );
      _viewportBreakpoints = parseViewportBreakpoints(scheduleChrome);
      _scheduleChrome = scheduleChrome;
    }
    return true;
  }

  Future<void> _load({required bool showSkeleton}) async {
    if (showSkeleton && _ad == null && mounted) {
      setState(() => _loading = true);
    }
    try {
      if (!await _loadPlacement()) {
        if (mounted) setState(() => _loading = false);
        return;
      }
      final located = await locateWithDeviceGps(
        locateUrl: '${ApiConfig.baseUrl}/api/v1/geo/locate',
      );
      if (located == null || located.countryCode.isEmpty) {
        if (mounted) setState(() => _loading = false);
        return;
      }
      final country = located.countryCode;
      final region = (located.region ?? '').toLowerCase();
      final district = (located.city ?? '').toLowerCase();
      final qs = <String, String>{};
      if (located.latitude != null) {
        qs['lat'] = located.latitude!.toString();
      }
      if (located.longitude != null) {
        qs['lng'] = located.longitude!.toString();
      }

      final cacheKey = CacheKeys.geoAd(country, region, district);
      final cachedAd = QueryCache.read<ServedAdCampaign>(
        cacheKey,
        maxAge: QueryCache.sessionTtl,
        allowStale: true,
      );
      if (cachedAd != null && mounted) {
        setState(() {
          _ad = cachedAd;
          _loading = false;
        });
        unawaited(_fetchAndApply(qs, cacheKey, recordImpression: false));
        return;
      }

      await _fetchAndApply(qs, cacheKey, recordImpression: true);
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _fetchAndApply(
    Map<String, String> qs,
    String cacheKey, {
    required bool recordImpression,
  }) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/serve')
        .replace(queryParameters: qs.isEmpty ? null : qs);
    final serve = await http.get(uri);
    if (serve.statusCode >= 300 || !mounted) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    final served = AdsServeResponse.fromJson(
      jsonDecode(serve.body) as Map<String, dynamic>,
    );
    final bp = _viewportBreakpoints;
    ServedAdCampaign? chosen;
    if (bp != null && mounted) {
      final width = MediaQuery.sizeOf(context).width;
      final slot = resolveViewportSlot(width, bp);
      for (final c in served.campaigns) {
        if ((c.title ?? '').trim().isEmpty) continue;
        final picked = pickCampaignCreative(
          viewportSourceFromServed(c),
          slot,
        );
        final videoId =
            isStubVideoId(picked.videoId.trim()) ? '' : picked.videoId.trim();
        final imageUrl = resolvePublicMediaUrl(picked.imageUrl);
        if (videoId.isNotEmpty || imageUrl.isNotEmpty) {
          chosen = c;
          break;
        }
      }
    }
    if (chosen == null) {
      QueryCache.invalidate(cacheKey);
      if (mounted) {
        setState(() {
          _ad = null;
          _loading = false;
        });
      }
      return;
    }
    QueryCache.write(cacheKey, chosen);
    if (!mounted) return;
    setState(() {
      _ad = chosen;
      _loading = false;
    });
    if (!recordImpression) return;
    if (_impressedId == chosen.id) return;
    final placement = (_lobbyPlacement ?? '').trim();
    if (placement.isEmpty) return;
    _impressedId = chosen.id;
    final viewer = await _stableViewerKey();
    await http.post(
      Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/ads/campaigns/${chosen.id}/impression'),
      headers: {'Content-Type': 'application/json', 'X-Device-Id': viewer},
      body: jsonEncode({
        'viewer_key': viewer,
        'placement': placement,
      }),
    );
  }

  Future<String> _stableViewerKey() async {
    const key = 'dama_ad_viewer';
    final prefs = await SharedPreferences.getInstance();
    final existing = prefs.getString(key);
    if (existing != null && existing.isNotEmpty) return existing;
    final created =
        'mobile_${DateTime.now().microsecondsSinceEpoch}_${Random().nextInt(1 << 30)}';
    await prefs.setString(key, created);
    return created;
  }

  Future<void> _onTap() async {
    final id = _ad?.id;
    if (id == null || id.isEmpty) return;
    try {
      await http.post(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/campaigns/$id/click'));
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    if (_loading) return const GeoAdSlotSkeleton();
    final ad = _ad;
    final title = ad?.title;
    if (ad == null || title == null || title.isEmpty) {
      return const SizedBox.shrink();
    }
    final bp = _viewportBreakpoints;
    if (bp == null) {
      return const SizedBox.shrink();
    }
    final source = viewportSourceFromServed(ad);
    final width = MediaQuery.sizeOf(context).width;
    final picked = pickCampaignCreative(
      source,
      resolveViewportSlot(width, bp),
    );
    var videoId = picked.videoId.trim();
    if (isStubVideoId(videoId)) videoId = '';
    final imageUrl = resolvePublicMediaUrl(picked.imageUrl);
    final hasCreative = videoId.isNotEmpty || imageUrl.isNotEmpty;
    // Exact-slot serve: hide lobby tile when this screen has no creative.
    if (!hasCreative) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Material(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: _onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: TextStyle(
                        color: tokens.gold, fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                ViewportAdCreative(
                  source: source,
                  breakpoints: _viewportBreakpoints,
                  scheduleChrome: _scheduleChrome,
                  maxWidth: double.infinity,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
