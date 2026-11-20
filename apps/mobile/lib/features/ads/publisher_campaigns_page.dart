import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/cache/skip_store.dart';
import 'package:dama_mobile/core/geo/format_country_label.dart';
import 'package:dama_mobile/core/geo/nominatim_reverse.dart';
import 'package:dama_mobile/core/lib/chrome_string.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/media_upload_chrome.dart';
import 'package:dama_mobile/core/ui/chrome_date_field.dart';
import 'package:dama_mobile/core/ui/chrome_select_sheet.dart';
import 'package:dama_mobile/core/ui/gallery_carousel.dart';
import 'package:dama_mobile/core/ui/location_pin_field.dart';
import 'package:dama_mobile/core/ui/entity_media_editor.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/core/ui/skip_pagination_bar.dart';
import 'package:dama_mobile/core/util/date_mask.dart';
import 'package:dama_mobile/core/util/sanitize_decimal_input.dart';
import 'package:dama_mobile/features/ads/publisher_schedule_editor.dart';
import 'package:dama_mobile/features/ads/schedule_chrome_ready.dart';
import 'package:dama_mobile/features/ads/viewport_creatives_chrome_ready.dart';
import 'package:dama_mobile/features/ads/viewport_creatives_editor.dart';
import 'package:dama_mobile/features/leaderboard/leaderboard_cubit.dart'
    show SkipMeta;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';

/// Publisher campaigns CRUD - REST `/ads/campaigns` (web parity).
class PublisherCampaignsPage extends StatefulWidget {
  const PublisherCampaignsPage({
    super.key,
    required this.accessToken,
    this.initialCampaignId,
  });

  final String accessToken;

  /// When set (notification `?id=`), scroll/highlight and ensure the campaign is loaded.
  final String? initialCampaignId;

  @override
  State<PublisherCampaignsPage> createState() => _PublisherCampaignsPageState();
}

class _PublisherCampaignsPageState extends State<PublisherCampaignsPage> {
  Map<String, String> _chrome = const {};
  Map<String, dynamic> _bounds = const {};
  List<Map<String, dynamic>> _campaigns = const [];
  SkipMeta? _meta;
  static const _skipKey = 'ads_campaigns';
  int _skip = 0;
  List<String> _statuses = const [];
  Map<String, String> _statusLabels = const {};
  String _archivedStatus = '';
  String _defaultCreativeType = '';
  double? _createFeeAmount;
  String _createFeeCurrency = '';
  bool _loading = true;
  bool _busy = false;
  bool _createAttempted = false;
  String? _error;
  String _focusId = '';
  bool _focusResolved = false;
  final Set<String> _selectedIds = <String>{};
  String _bulkStatus = '';
  bool _bulkPending = false;
  static const _statusAll = '__all__';
  String _statusFilter = _statusAll;
  final _searchCtrl = TextEditingController();
  Timer? _searchDebounce;
  String _debouncedQ = '';
  final _focusKeys = <String, GlobalKey>{};
  final _listScroll = ScrollController();
  MediaUploadChrome? _dropzoneChrome;
  String _uploadingSlot = '';

  bool get _viewportCreativesChromeReady =>
      viewportCreativesChromeReady(_chrome);

  bool get _mediaChromeReady =>
      _c('thumbnail_label').isNotEmpty &&
      _c('gallery_label').isNotEmpty &&
      _c('gallery_empty').isNotEmpty &&
      _c('gallery_add_action').isNotEmpty &&
      _c('gallery_max_slots').isNotEmpty &&
      _c('gallery_slots_fmt').isNotEmpty &&
      _c('thumbnail_main_badge').isNotEmpty &&
      _c('thumbnail_empty_hint').isNotEmpty &&
      _c('thumbnail_hint').isNotEmpty &&
      _c('gallery_limit_reached').isNotEmpty &&
      _c('toast_thumbnail_saved').isNotEmpty &&
      _c('toast_gallery_saved').isNotEmpty &&
      _c('media_upload_failed').isNotEmpty &&
      _dropzoneChrome != null;

  bool get _mapChromeReady =>
      _c('map_location_section_title').isNotEmpty &&
      _c('map_pin_empty').isNotEmpty &&
      _c('map_use_device_location').isNotEmpty &&
      _c('map_clear_pin').isNotEmpty &&
      _c('map_helper_text').isNotEmpty &&
      _c('map_geolocation_unavailable').isNotEmpty &&
      _c('map_geolocation_failed').isNotEmpty &&
      _c('map_pin_required').isNotEmpty &&
      _c('map_pin_coords_fmt').isNotEmpty &&
      _c('map_listings_count_fmt').isNotEmpty &&
      _c('map_locate_failed').isNotEmpty;

  final _title = TextEditingController();
  final _country = TextEditingController();

  /// ISO-2 for create payload; [_country] shows "Name (CODE)".
  String _countryCode = '';
  final _region = TextEditingController();
  final _district = TextEditingController();
  double? _pinLat;
  double? _pinLng;
  String _mapPinError = '';
  bool _geoResolving = false;
  int _locateSeq = 0;
  final _cap = TextEditingController();
  final _endsAt = TextEditingController();

  @override
  void initState() {
    super.initState();
    _focusId = (widget.initialCampaignId ?? '').trim();
    if (_focusId.isEmpty) {
      _skip = SkipStore.read(_skipKey);
    }
    unawaited(_loadDropzoneChrome());
    _load(skip: _skip);
  }

  Future<void> _loadDropzoneChrome() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/public/media-upload-chrome'),
      );
      if (res.statusCode != 200 || !mounted) return;
      final body = jsonDecode(res.body);
      if (body is! Map<String, dynamic>) return;
      final chrome = MediaUploadChrome.fromJson(body);
      if (!mounted || chrome == null) return;
      setState(() => _dropzoneChrome = chrome);
    } catch (_) {}
  }

  Future<void> _refreshPricingAtPin(double? lat, double? lng) async {
    final pinOk = lat != null &&
        lng != null &&
        lat.isFinite &&
        lng.isFinite &&
        !(lat == 0 && lng == 0);
    final uri = pinOk
        ? Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/pricing').replace(
            queryParameters: {
              'lat': lat.toString(),
              'lng': lng.toString(),
            },
          )
        : Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/pricing');
    final pricing = await http.get(uri);
    if (pricing.statusCode != 200 || !mounted) return;
    final body = jsonDecode(pricing.body) as Map<String, dynamic>;
    final feeRaw = body['campaign_create_fee_amount'];
    setState(() {
      _createFeeAmount = feeRaw is num ? feeRaw.toDouble() : null;
      _createFeeCurrency =
          (body['campaign_create_fee_currency'] as String? ?? '')
              .trim()
              .toUpperCase();
    });
  }

  Future<void> _resolvePin(double lat, double lng) async {
    final seq = ++_locateSeq;
    setState(() {
      _pinLat = lat;
      _pinLng = lng;
      _mapPinError = '';
      _geoResolving = true;
    });
    try {
      // Match web campaigns: POST /geo/locate first, then Nominatim enrich.
      String? countryCode;
      String countryName = '';
      String region = '';
      String city = '';
      try {
        final res = await http.post(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/geo/locate'),
          headers: _authHeaders(json: true),
          body: jsonEncode({'latitude': lat, 'longitude': lng}),
        );
        if (seq != _locateSeq || !mounted) return;
        if (res.statusCode == 200) {
          final body = jsonDecode(res.body);
          if (body is Map<String, dynamic>) {
            final loc = body['location'];
            if (loc is Map<String, dynamic>) {
              final cc =
                  (loc['country_code'] ?? '').toString().trim().toUpperCase();
              if (cc.length == 2) {
                countryCode = cc;
                countryName = (loc['country_name'] ?? '').toString().trim();
                region = (loc['region'] ?? '').toString().trim();
                city = (loc['city'] ?? '').toString().trim();
              }
            }
          }
        }
      } catch (_) {
        /* fall through to client Nominatim */
      }
      if (seq != _locateSeq || !mounted) return;

      final needEnrich = countryCode == null ||
          region.isEmpty ||
          city.isEmpty ||
          countryName.isEmpty;
      if (needEnrich) {
        final g = await reverseGeocodeNominatim(lat, lng);
        if (seq != _locateSeq || !mounted) return;
        if (g != null && g.countryCode.length == 2) {
          countryCode ??= g.countryCode;
          if (countryName.isEmpty) countryName = g.countryName;
          if (region.isEmpty) region = g.region;
          if (city.isEmpty) city = g.city;
        }
      }

      if (countryCode == null || countryCode.length != 2) {
        setState(() {
          _countryCode = '';
          _country.clear();
          _region.clear();
          _district.clear();
          _mapPinError = _c('map_locate_failed');
          _geoResolving = false;
        });
        if (_mapPinError.isNotEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(_mapPinError)),
          );
        }
        return;
      }
      setState(() {
        _countryCode = countryCode!;
        _country.text = formatCountryLabel(countryCode, countryName);
        _region.text = region;
        _district.text = city;
        _geoResolving = false;
      });
      await _refreshPricingAtPin(lat, lng);
    } catch (_) {
      if (seq != _locateSeq || !mounted) return;
      setState(() {
        _countryCode = '';
        _country.clear();
        _region.clear();
        _district.clear();
        _mapPinError = _c('map_locate_failed');
        _geoResolving = false;
      });
      if (_mapPinError.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_mapPinError)),
        );
      }
    }
  }

  void _clearPin() {
    _locateSeq++;
    setState(() {
      _pinLat = null;
      _pinLng = null;
      _countryCode = '';
      _country.clear();
      _region.clear();
      _district.clear();
      _mapPinError = '';
      _geoResolving = false;
    });
    unawaited(_refreshPricingAtPin(null, null));
  }

  void _onSearchChanged() {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 250), () {
      if (!mounted) return;
      final next = _searchCtrl.text.trim();
      if (next == _debouncedQ) return;
      setState(() => _debouncedQ = next);
      _skip = 0;
      unawaited(SkipStore.clear(_skipKey));
      unawaited(_load(skip: 0));
    });
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _listScroll.dispose();
    _searchCtrl.dispose();
    _title.dispose();
    _country.dispose();
    _region.dispose();
    _district.dispose();
    _cap.dispose();
    _endsAt.dispose();
    super.dispose();
  }

  String _campaignStatusLabel(String code) {
    final fromEnum = (_statusLabels[code] ?? '').trim();
    if (fromEnum.isNotEmpty) return fromEnum;
    return _c('empty_value');
  }

  String _c(String key) => chromeMapString(_chrome, key);

  int get _listPageSize {
    final n = int.tryParse(_c('list_page_size'));
    return n != null && n > 0 ? n : 0;
  }

  Map<String, String> _authHeaders({bool json = false}) => {
        'Authorization': 'Bearer ${widget.accessToken}',
        if (json) 'Content-Type': 'application/json',
      };

  Future<void> _load({int? skip}) async {
    final nextSkip = skip ?? _skip;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final playback = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/playback'),
      );
      if (playback.statusCode == 200) {
        final body = jsonDecode(playback.body) as Map<String, dynamic>;
        _bounds = body;
        final sc = body['schedule_chrome'];
        if (sc is Map<String, dynamic>) {
          _chrome = sc.map((k, v) => MapEntry(k, v?.toString() ?? ''));
        }
      }
      if (!scheduleChromeReady(_chrome)) {
        if (!mounted) return;
        setState(() {
          _loading = false;
          _error = _c('playback_unavailable');
        });
        return;
      }
      final limit = _listPageSize;
      if (limit < 1) {
        if (!mounted) return;
        setState(() {
          _loading = false;
          _error = _c('playback_unavailable');
        });
        return;
      }
      final pricing = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/pricing'),
      );
      if (pricing.statusCode == 200) {
        final body = jsonDecode(pricing.body) as Map<String, dynamic>;
        final feeRaw = body['campaign_create_fee_amount'];
        _createFeeAmount = feeRaw is num ? feeRaw.toDouble() : null;
        _createFeeCurrency =
            (body['campaign_create_fee_currency'] as String? ?? '')
                .trim()
                .toUpperCase();
      }
      final enums = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/platform/enums'),
        headers: _authHeaders(),
      );
      if (enums.statusCode == 200) {
        final body = jsonDecode(enums.body) as Map<String, dynamic>;
        _statuses = (body['campaign_statuses'] as List<dynamic>? ?? [])
            .map((e) => e.toString())
            .where((s) => s.isNotEmpty)
            .toList();
        final labelsRaw = body['campaign_status_labels'];
        final labels = <String, String>{};
        if (labelsRaw is Map) {
          for (final e in labelsRaw.entries) {
            final k = e.key.toString().trim();
            final v = e.value.toString().trim();
            if (k.isNotEmpty && v.isNotEmpty) labels[k] = v;
          }
        }
        _statusLabels = labels;
        _defaultCreativeType =
            (body['default_creative_type'] as String? ?? '').trim();
        _archivedStatus =
            (body['archived_campaign_status'] as String? ?? '').trim();
      }
      final listParams = <String, String>{
        'skip': '$nextSkip',
        'limit': '$limit',
      };
      final q = _debouncedQ.trim();
      if (q.isNotEmpty) listParams['q'] = q;
      if (_statusFilter != _statusAll) listParams['status'] = _statusFilter;
      final list = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/campaigns').replace(
          queryParameters: listParams,
        ),
        headers: _authHeaders(),
      );
      if (list.statusCode >= 300) {
        if (!mounted) return;
        setState(() {
          _loading = false;
          _error = _c('toast_save_failed');
        });
        return;
      }
      final body = jsonDecode(list.body) as Map<String, dynamic>;
      final campaigns = (body['campaigns'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .toList();
      final metaRaw = body['meta'];
      final meta =
          metaRaw is Map<String, dynamic> ? SkipMeta.fromJson(metaRaw) : null;
      if (!mounted) return;
      setState(() {
        _campaigns = campaigns;
        _meta = meta;
        _skip = nextSkip;
        _loading = false;
      });
      unawaited(SkipStore.write(_skipKey, nextSkip));
      await _resolveFocusCampaign();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = _c('toast_save_failed');
      });
    }
  }

  void _scrollFocusIntoView(String id) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final ctx = _focusKeys[id]?.currentContext;
      if (ctx == null) return;
      Scrollable.ensureVisible(
        ctx,
        duration: const Duration(milliseconds: 350),
        alignment: 0.1,
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _resolveFocusCampaign() async {
    final id = _focusId.trim();
    if (id.isEmpty || _focusResolved) return;
    final onPage = _campaigns.any((c) => (c['id']?.toString() ?? '') == id);
    if (onPage) {
      _focusResolved = true;
      if (mounted) {
        setState(() {});
        _scrollFocusIntoView(id);
      }
      return;
    }
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/campaigns/$id'),
        headers: _authHeaders(),
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        _focusResolved = true;
        return;
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if ((body['id']?.toString() ?? '').isEmpty) {
        _focusResolved = true;
        return;
      }
      setState(() {
        _campaigns = [body, ..._campaigns];
        _focusResolved = true;
      });
      _scrollFocusIntoView(id);
    } catch (_) {
      _focusResolved = true;
    }
  }

  Future<void> _create() async {
    final title = _title.text.trim();
    final country = _countryCode.trim().toUpperCase();
    final pinLat = _pinLat;
    final pinLng = _pinLng;
    final pinOk = pinLat != null &&
        pinLng != null &&
        pinLat.isFinite &&
        pinLng.isFinite &&
        !(pinLat == 0 && pinLng == 0);
    final cap = num.tryParse(_cap.text.trim());
    final capOk = cap != null && cap > 0;
    setState(() => _createAttempted = true);
    if (title.isEmpty ||
        country.length != 2 ||
        _defaultCreativeType.isEmpty ||
        !_mapChromeReady ||
        !pinOk ||
        !capOk ||
        _geoResolving) {
      if (!pinOk) {
        final req = _c('map_pin_required');
        if (req.isNotEmpty && mounted) {
          setState(() => _mapPinError = req);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(req)),
          );
        }
      }
      if (!capOk) {
        final req = _c('err_daily_spend_cap_required');
        if (req.isNotEmpty && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(req)),
          );
        }
      }
      return;
    }
    setState(() => _busy = true);
    try {
      final target = <String, dynamic>{
        'country': country,
        'lat': pinLat,
        'lng': pinLng,
      };
      if (_region.text.trim().isNotEmpty)
        target['region'] = _region.text.trim();
      if (_district.text.trim().isNotEmpty) {
        target['district'] = _district.text.trim();
      }
      final body = <String, dynamic>{
        'title': title,
        'creative_type': _defaultCreativeType,
        'geo_targets': [target],
        'country_code': country,
        'daily_spend_cap': cap,
      };
      final endsRaw = _endsAt.text.trim();
      if (endsRaw.isNotEmpty) {
        final parsed = parseFlexibleDateTime(endsRaw);
        if (parsed != null) {
          body['ends_at'] = parsed.toUtc().toIso8601String();
        }
      }
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/campaigns'),
        headers: _authHeaders(json: true),
        body: jsonEncode(body),
      );
      if (res.statusCode >= 300) {
        var err = res.statusCode == 402
            ? _c('insufficient_campaign_create_fee')
            : _c('toast_save_failed');
        try {
          final decoded = jsonDecode(res.body);
          if (decoded is Map) {
            final key = decoded['error_key']?.toString().trim() ?? '';
            if (key.isNotEmpty) {
              final mapped = _c(key);
              if (mapped.isNotEmpty) err = mapped;
            }
            final msg = decoded['error']?.toString().trim() ?? '';
            if (msg.isNotEmpty) err = msg;
          }
        } catch (_) {}
        if (mounted) {
          setState(() {
            _busy = false;
            _error = err;
            if (err == _c('map_pin_required') ||
                err == _c('map_locate_failed')) {
              _mapPinError = err;
            }
          });
        }
        return;
      }
      String createdId = '';
      Map<String, dynamic>? createdCampaign;
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) {
          createdCampaign = decoded;
          createdId = (decoded['id']?.toString() ?? '').trim();
        } else if (decoded is Map) {
          createdCampaign = Map<String, dynamic>.from(decoded);
          createdId = (decoded['id']?.toString() ?? '').trim();
        }
      } catch (_) {}
      _title.clear();
      _countryCode = '';
      _country.clear();
      _region.clear();
      _district.clear();
      _pinLat = null;
      _pinLng = null;
      _mapPinError = '';
      _cap.clear();
      _endsAt.clear();
      _createAttempted = false;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_c('toast_campaign_created'))),
        );
        if (createdId.isNotEmpty) {
          setState(() {
            _focusId = createdId;
            _focusResolved = false;
          });
        }
      }
      await _load();
      if (!mounted) return;
      Map<String, dynamic>? detail = createdCampaign;
      if (createdId.isNotEmpty) {
        for (final c in _campaigns) {
          if ((c['id']?.toString() ?? '') == createdId) {
            detail = c;
            break;
          }
        }
      }
      if (detail != null && (detail['id']?.toString() ?? '').isNotEmpty) {
        await _openCampaignUploadSheet(detail);
      }
    } catch (_) {
      if (mounted) setState(() => _error = _c('toast_save_failed'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openCampaignUploadSheet(Map<String, dynamic> campaign) async {
    if (!mounted) return;
    final id = (campaign['id']?.toString() ?? '').trim();
    if (id.isEmpty) return;
    final title = (campaign['title']?.toString() ?? '').trim();
    final thumb = (campaign['thumbnail_url'] as String?)?.trim() ?? '';
    final gallery = (campaign['gallery'] as List<dynamic>? ?? const [])
        .map((e) => e.toString().trim())
        .where((u) => u.isNotEmpty)
        .toList();
    final closeLabel = _c('dialog_close_label').isNotEmpty
        ? _c('dialog_close_label')
        : _c('cancel_action');
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        final pad = MediaQuery.viewInsetsOf(ctx).bottom;
        final tokens = damaColorsOf(ctx);
        return Padding(
          padding: EdgeInsets.only(bottom: pad),
          child: SafeArea(
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.sizeOf(ctx).height * 0.92,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    child: Text(
                      title.isNotEmpty
                          ? title
                          : _c('publisher_campaigns_heading'),
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 17,
                        color: tokens.onSurface,
                      ),
                    ),
                  ),
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (_viewportCreativesChromeReady)
                            ViewportCreativesEditor(
                              accessToken: widget.accessToken,
                              campaign: campaign,
                              chrome: _chrome,
                              disabled: _busy,
                              onSaved: _load,
                            ),
                          if (_mediaChromeReady) ...[
                            const SizedBox(height: 12),
                            EntityMediaEditor(
                              thumbnailLabel: _c('thumbnail_label'),
                              galleryLabel: _c('gallery_label'),
                              galleryEmpty: _c('gallery_empty'),
                              galleryAddAction: _c('gallery_add_action'),
                              galleryMaxSlots: _c('gallery_max_slots'),
                              gallerySlotsFmt: _c('gallery_slots_fmt'),
                              thumbnailMainBadge: _c('thumbnail_main_badge'),
                              thumbnailEmptyHint: _c('thumbnail_empty_hint'),
                              thumbnailHint: _c('thumbnail_hint'),
                              dropzoneChrome: _dropzoneChrome!,
                              thumbnailUrl: thumb,
                              galleryUrls: gallery,
                              busyThumbnail:
                                  _busy && _uploadingSlot == 'thumb:$id',
                              busyGallery:
                                  _busy && _uploadingSlot == 'gallery:$id',
                              enabled: !_busy ||
                                  _uploadingSlot == 'thumb:$id' ||
                                  _uploadingSlot == 'gallery:$id',
                              onThumbnail: (file) => _uploadThumbnail(id, file),
                              onClearThumbnail: () => _clearThumbnail(id),
                              onGalleryFiles: (files) =>
                                  _uploadGallery(id, files),
                              onRemoveGallery: (index) =>
                                  _removeGalleryAt(id, index),
                            ),
                          ],
                          if (_bounds.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            PublisherScheduleEditor(
                              accessToken: widget.accessToken,
                              campaign: campaign,
                              chrome: _chrome,
                              bounds: _bounds,
                              onSaved: () => _load(),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  if (closeLabel.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                      child: OutlinedButton(
                        onPressed: () => Navigator.of(ctx).pop(),
                        child: Text(closeLabel),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Future<void> _deleteCampaign(String id) async {
    final confirmTitle = _c('delete_campaign_confirm_title');
    final confirmBody = _c('delete_campaign_confirm_description');
    final action = _c('delete_campaign_action');
    if (action.isEmpty) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(confirmTitle.isNotEmpty ? confirmTitle : action),
        content: confirmBody.isNotEmpty ? Text(confirmBody) : null,
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(_c('cancel_action').isNotEmpty
                ? _c('cancel_action')
                : _c('dialog_close_label')),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(action),
          ),
        ],
      ),
    );
    if (ok != true || _busy) return;
    setState(() => _busy = true);
    try {
      final res = await http.delete(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/campaigns/$id'),
        headers: _authHeaders(),
      );
      if (res.statusCode < 300) {
        if (mounted) {
          final toast = _c('toast_campaign_deleted');
          if (toast.isNotEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(toast)),
            );
          }
        }
        await _load();
      } else {
        var err = _c('toast_campaign_delete_failed');
        try {
          final decoded = jsonDecode(res.body);
          if (decoded is Map) {
            final msg = decoded['error']?.toString().trim() ?? '';
            if (msg.isNotEmpty) err = msg;
          }
        } catch (_) {}
        if (mounted && err.isNotEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(err)),
          );
        }
      }
    } catch (_) {
      final err = _c('toast_campaign_delete_failed');
      if (mounted && err.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(err)),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _updateTitle(String id, String title) async {
    final t = title.trim();
    if (t.isEmpty || _busy) return;
    setState(() => _busy = true);
    try {
      final res = await http.patch(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/campaigns/$id/title'),
        headers: _authHeaders(json: true),
        body: jsonEncode({'title': t}),
      );
      if (res.statusCode < 300) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(_c('toast_campaign_title_saved'))),
          );
        }
        await _load();
      } else if (mounted) {
        // Chrome-only (never invent API English bodies).
        final msg = _c('toast_save_failed');
        if (msg.isNotEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(msg)));
        }
      }
    } catch (_) {
      if (mounted) {
        final msg = _c('toast_save_failed');
        if (msg.isNotEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(msg)));
        }
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _promptEditTitle(String id, String current) async {
    final ctrl = TextEditingController(text: current);
    final save = _c('save_action');
    if (save.isEmpty) {
      ctrl.dispose();
      return;
    }
    final next = await showDialog<String>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text(_c('ph_title')),
          content: TextField(
            controller: ctrl,
            autofocus: true,
            decoration: InputDecoration(
              labelText: _c('ph_title'),
              border: const OutlineInputBorder(),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text(_c('dialog_close_label')),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(ctrl.text.trim()),
              child: Text(save),
            ),
          ],
        );
      },
    );
    ctrl.dispose();
    if (next == null || next.isEmpty || next == current.trim()) return;
    await _updateTitle(id, next);
  }

  Future<void> _applyBulkStatus() async {
    final status = _bulkStatus.trim();
    final ids = _selectedIds.where((id) => id.isNotEmpty).toList();
    if (status.isEmpty || ids.isEmpty || _bulkPending) return;
    setState(() => _bulkPending = true);
    try {
      for (final id in ids) {
        final res = await http.patch(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/campaigns/$id/status'),
          headers: _authHeaders(json: true),
          body: jsonEncode({'status': status}),
        );
        if (res.statusCode >= 300) {
          final msg = _c('toast_save_failed');
          if (mounted && msg.isNotEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(msg)),
            );
          }
          break;
        }
      }
      if (mounted) {
        final toast = _c('toast_campaign_status_updated');
        if (toast.isNotEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(toast)),
          );
        }
        setState(() {
          _selectedIds.clear();
          _bulkStatus = '';
        });
      }
      await _load();
    } finally {
      if (mounted) setState(() => _bulkPending = false);
    }
  }

  Future<void> _setStatus(String id, String status) async {
    setState(() => _busy = true);
    try {
      final res = await http.patch(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/campaigns/$id/status'),
        headers: _authHeaders(json: true),
        body: jsonEncode({'status': status}),
      );
      if (res.statusCode < 300) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(_c('toast_campaign_status_updated'))),
          );
        }
        await _load();
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _closeCampaign(String id) async {
    setState(() => _busy = true);
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/campaigns/$id/close'),
        headers: _authHeaders(json: true),
        body: '{}',
      );
      if (res.statusCode < 300) {
        final closed = _c('toast_campaign_closed');
        if (mounted && closed.isNotEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(closed)),
          );
        }
        await _load();
      } else if (mounted) {
        final msg = _c('toast_campaign_close_failed');
        if (msg.isEmpty) return;
        setState(() => _error = msg);
      }
    } catch (_) {
      final msg = _c('toast_campaign_close_failed');
      if (mounted && msg.isNotEmpty) setState(() => _error = msg);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reopenCampaign(String id) async {
    setState(() => _busy = true);
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/campaigns/$id/reopen'),
        headers: _authHeaders(json: true),
        body: '{}',
      );
      if (res.statusCode < 300) {
        final reopened = _c('toast_campaign_reopened');
        if (mounted && reopened.isNotEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(reopened)),
          );
        }
        await _load();
      } else if (mounted) {
        final msg = _c('toast_campaign_reopen_failed');
        if (msg.isEmpty) return;
        setState(() => _error = msg);
      }
    } catch (_) {
      final msg = _c('toast_campaign_reopen_failed');
      if (mounted && msg.isNotEmpty) setState(() => _error = msg);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _attachVideo(String id) async {
    final title = _c('video_upload_job_title');
    if (title.isEmpty) return;
    setState(() => _busy = true);
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/campaigns/$id/upload-job'),
        headers: _authHeaders(json: true),
        body: jsonEncode({'title': title, 'async': true}),
      );
      if (res.statusCode < 300 && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_c('toast_video_attached'))),
        );
        await _load();
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _clearLegacyVideo(String id) async {
    if (id.isEmpty) return;
    setState(() => _busy = true);
    try {
      final res = await http.delete(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/campaigns/$id/video'),
        headers: _authHeaders(),
      );
      if (!mounted) return;
      if (res.statusCode < 300) {
        final toast = _c('toast_legacy_video_cleared');
        if (toast.isNotEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(toast)));
        }
        await _load();
      } else {
        final msg = _c('media_upload_failed');
        if (msg.isNotEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(msg)));
        }
      }
    } catch (_) {
      if (!mounted) return;
      final msg = _c('media_upload_failed');
      if (msg.isNotEmpty) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Legacy replace-creative URL path removed: use viewport / entity media uploads only.
  /// Kept as no-op guard so accidental calls fail closed without a broken PATCH.
  Future<void> _replaceCreative(String id) async {
    if (_mediaChromeReady || _viewportCreativesChromeReady) return;
    final msg = _c('playback_unavailable');
    if (mounted && msg.isNotEmpty) setState(() => _error = msg);
  }

  Future<void> _uploadThumbnail(String id, XFile file) async {
    if (!_mediaChromeReady || id.isEmpty) return;
    setState(() {
      _busy = true;
      _uploadingSlot = 'thumb:$id';
    });
    try {
      final uri = Uri.parse(
        '${ApiConfig.baseUrl}/api/v1/ads/campaigns/$id/thumbnail',
      );
      final req = http.MultipartRequest('POST', uri);
      req.headers['Authorization'] = 'Bearer ${widget.accessToken}';
      req.files.add(await http.MultipartFile.fromPath(
        'file',
        file.path,
        contentType: MediaType('image', 'jpeg'),
        filename: file.name,
      ));
      final streamed = await req.send();
      if (streamed.statusCode < 300 && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_c('toast_thumbnail_saved'))),
        );
        await _load();
      } else if (mounted) {
        setState(() => _error = _c('media_upload_failed'));
      }
    } catch (_) {
      if (mounted) setState(() => _error = _c('media_upload_failed'));
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _uploadingSlot = '';
        });
      }
    }
  }

  Future<void> _uploadGallery(String id, List<XFile> files) async {
    if (!_mediaChromeReady || id.isEmpty || files.isEmpty) return;
    setState(() {
      _busy = true;
      _uploadingSlot = 'gallery:$id';
    });
    try {
      var ok = true;
      String? limitMsg;
      for (final file in files) {
        final uri = Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/ads/campaigns/$id/gallery',
        );
        final req = http.MultipartRequest('POST', uri);
        req.headers['Authorization'] = 'Bearer ${widget.accessToken}';
        req.files.add(await http.MultipartFile.fromPath(
          'file',
          file.path,
          contentType: MediaType('image', 'jpeg'),
          filename: file.name,
        ));
        final streamed = await req.send();
        if (streamed.statusCode >= 300) {
          ok = false;
          final body = await streamed.stream.bytesToString();
          try {
            final decoded = jsonDecode(body);
            if (decoded is Map && decoded['error'] is String) {
              final err = (decoded['error'] as String).trim();
              if (err.isNotEmpty) limitMsg = err;
            }
          } catch (_) {}
          break;
        }
      }
      if (ok && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_c('toast_gallery_saved'))),
        );
        await _load();
      } else if (mounted) {
        setState(() => _error = (limitMsg ?? '').isNotEmpty
            ? limitMsg!
            : _c('media_upload_failed'));
      }
    } catch (_) {
      if (mounted) setState(() => _error = _c('media_upload_failed'));
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _uploadingSlot = '';
        });
      }
    }
  }

  Future<void> _clearThumbnail(String id) async {
    if (!_mediaChromeReady || id.isEmpty) return;
    setState(() {
      _busy = true;
      _uploadingSlot = 'thumb:$id';
    });
    try {
      final res = await http.delete(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/campaigns/$id/thumbnail'),
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      if (res.statusCode < 300 && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_c('toast_thumbnail_saved'))),
        );
        await _load();
      } else if (mounted) {
        setState(() => _error = _c('media_upload_failed'));
      }
    } catch (_) {
      if (mounted) setState(() => _error = _c('media_upload_failed'));
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _uploadingSlot = '';
        });
      }
    }
  }

  Future<void> _removeGalleryAt(String id, int index) async {
    if (!_mediaChromeReady || id.isEmpty || index < 0) return;
    setState(() {
      _busy = true;
      _uploadingSlot = 'gallery:$id';
    });
    try {
      final res = await http.delete(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/ads/campaigns/$id/gallery/$index',
        ),
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      if (res.statusCode < 300 && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_c('toast_gallery_saved'))),
        );
        await _load();
      } else if (mounted) {
        setState(() => _error = _c('media_upload_failed'));
      }
    } catch (_) {
      if (mounted) setState(() => _error = _c('media_upload_failed'));
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _uploadingSlot = '';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final sep = _c('meta_separator');
    // Soft page changes keep list + pager mounted (no skeleton flash).
    if (_loading && _campaigns.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: WalletSkeleton(),
      );
    }
    return ListView(
      controller: _listScroll,
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          _c('publisher_page_title'),
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 8),
        Text(
          _c('publisher_page_body'),
          style: TextStyle(color: tokens.onSurfaceMuted),
        ),
        if (_error != null && _error!.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(_error!, style: TextStyle(color: tokens.danger)),
        ],
        const SizedBox(height: 16),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            SizedBox(
              width: 220,
              child: TextField(
                controller: _title,
                decoration: InputDecoration(
                  hintText: _c('ph_title'),
                  border: const OutlineInputBorder(),
                  errorText: _createAttempted && _title.text.trim().isEmpty
                      ? (_c('err_title_required').isNotEmpty
                          ? _c('err_title_required')
                          : null)
                      : null,
                ),
                onChanged: (_) {
                  if (_createAttempted) setState(() {});
                },
              ),
            ),
            // Web create order: title → map pin → country / region / district.
            if (_mapChromeReady)
              SizedBox(
                width: double.infinity,
                child: LocationPinField(
                  latitude: _pinLat,
                  longitude: _pinLng,
                  onPinChange: _resolvePin,
                  onPinClear: _clearPin,
                  pinTitle: _title.text.trim().isNotEmpty
                      ? _title.text.trim()
                      : _c('create_action'),
                  required: true,
                  resolving: _geoResolving,
                  error: _mapPinError,
                  sectionTitle: _c('map_location_section_title'),
                  mapPinEmpty: _c('map_pin_empty'),
                  mapPinRequiredHint: _c('map_pin_required'),
                  useDeviceLocation: _c('map_use_device_location'),
                  clearPin: _c('map_clear_pin'),
                  helperText: _c('map_helper_text'),
                  geolocationUnavailable: _c('map_geolocation_unavailable'),
                  geolocationFailed: _c('map_geolocation_failed'),
                  pinCoordsFmt: _c('map_pin_coords_fmt'),
                ),
              ),
            SizedBox(
              width: 220,
              child: TextField(
                controller: _country,
                readOnly: true,
                decoration: InputDecoration(
                  hintText: _c('ph_country'),
                  border: const OutlineInputBorder(),
                ),
              ),
            ),
            SizedBox(
              width: 140,
              child: TextField(
                controller: _region,
                readOnly: true,
                decoration: InputDecoration(
                  hintText: _c('ph_region'),
                  border: const OutlineInputBorder(),
                ),
              ),
            ),
            SizedBox(
              width: 140,
              child: TextField(
                controller: _district,
                readOnly: true,
                decoration: InputDecoration(
                  hintText: _c('ph_district'),
                  border: const OutlineInputBorder(),
                ),
              ),
            ),
            SizedBox(
              width: 220,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: _cap,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[\d.]')),
                    ],
                    decoration: InputDecoration(
                      hintText: _c('ph_daily_spend_cap'),
                      border: const OutlineInputBorder(),
                      errorText: _createAttempted &&
                              (num.tryParse(_cap.text.trim()) ?? 0) <= 0
                          ? (_c('err_daily_spend_cap_required').isNotEmpty
                              ? _c('err_daily_spend_cap_required')
                              : null)
                          : null,
                    ),
                    onChanged: (v) {
                      final s = sanitizeDecimalInput(v);
                      if (s != v) {
                        _cap.value = TextEditingValue(
                          text: s,
                          selection: TextSelection.collapsed(offset: s.length),
                        );
                      }
                      if (_createAttempted) setState(() {});
                    },
                  ),
                  if (_c('daily_spend_cap_required_hint').isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        _c('daily_spend_cap_required_hint'),
                        style: TextStyle(
                          fontSize: 12,
                          color: tokens.onSurfaceMuted,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            if (_c('ends_at_label').isNotEmpty)
              SizedBox(
                width: 280,
                child: ChromeDateTimeField(
                  label: _c('ends_at_label'),
                  valueText: _endsAt.text,
                  hintText:
                      _c('ph_ends_at').isNotEmpty ? _c('ph_ends_at') : null,
                  helperText: _c('ends_at_blurb').isNotEmpty
                      ? _c('ends_at_blurb')
                      : null,
                  firstDate: DateTime.now(),
                  lastDate: DateTime(DateTime.now().year + 5),
                  onPicked: (local) {
                    setState(() {
                      _endsAt.text = formatUsDateTime(local);
                    });
                  },
                ),
              ),
            if (_c('campaign_create_fee_label').isNotEmpty)
              SizedBox(
                width: 280,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _c('campaign_create_fee_label'),
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    if (_c('campaign_create_fee_blurb').isNotEmpty)
                      Text(
                        _c('campaign_create_fee_blurb'),
                        style: TextStyle(color: tokens.onSurfaceMuted),
                      ),
                    if (_createFeeAmount != null &&
                        _createFeeAmount! > 0 &&
                        _createFeeCurrency.isNotEmpty &&
                        _c('amount_currency_separator').isNotEmpty)
                      Text(
                        '${_createFeeAmount!}${_c('amount_currency_separator')}$_createFeeCurrency',
                        style: TextStyle(
                          color: tokens.gold,
                          fontWeight: FontWeight.w600,
                        ),
                      )
                    else
                      Text(
                        _c('publisher_pricing_unavailable'),
                        style: TextStyle(color: tokens.danger),
                      ),
                  ],
                ),
              ),
            FilledButton(
              onPressed: _busy ||
                      _geoResolving ||
                      !_mapChromeReady ||
                      _pinLat == null ||
                      _pinLng == null ||
                      !_pinLat!.isFinite ||
                      !_pinLng!.isFinite ||
                      (_pinLat == 0 && _pinLng == 0) ||
                      _country.text.trim().isEmpty ||
                      (num.tryParse(_cap.text.trim()) ?? 0) <= 0 ||
                      _createFeeAmount == null ||
                      _createFeeAmount! <= 0 ||
                      _createFeeCurrency.isEmpty
                  ? null
                  : _create,
              child: Text(_c('create_action')),
            ),
          ],
        ),
        const SizedBox(height: 24),
        if (_c('search_campaigns_label').isNotEmpty) ...[
          TextField(
            controller: _searchCtrl,
            decoration: InputDecoration(
              labelText: _c('search_campaigns_label'),
              hintText: _c('search_campaigns_placeholder'),
              border: const OutlineInputBorder(),
              prefixIcon: const Icon(Icons.search),
            ),
            onChanged: (_) => _onSearchChanged(),
          ),
          const SizedBox(height: 12),
        ],
        if (_statuses.isNotEmpty &&
            _c('filter_status_label').isNotEmpty &&
            _c('filter_status_all').isNotEmpty) ...[
          ChromeSelectField(
            label: _c('filter_status_label'),
            valueLabel: _statusFilter == _statusAll
                ? _c('filter_status_all')
                : _campaignStatusLabel(_statusFilter),
            onTap: () async {
              final options = <ChromeSelectOption<String>>[
                ChromeSelectOption(
                  value: _statusAll,
                  label: _c('filter_status_all'),
                ),
                for (final st in _statuses)
                  ChromeSelectOption(
                    value: st,
                    label: _campaignStatusLabel(st),
                  ),
              ];
              final picked = await showChromeOptionSheet<String>(
                context: context,
                title: _c('filter_status_label'),
                options: options,
                selected: _statusFilter,
              );
              if (picked != null && picked != _statusFilter) {
                setState(() => _statusFilter = picked);
                _skip = 0;
                unawaited(SkipStore.clear(_skipKey));
                unawaited(_load(skip: 0));
              }
            },
          ),
          const SizedBox(height: 16),
        ],
        if (_campaigns.isEmpty)
          Text(
            _c('publisher_no_campaigns'),
            style: TextStyle(color: tokens.onSurfaceMuted),
          )
        else ...[
          if (_c('select_all_label').isNotEmpty)
            Row(
              children: [
                Checkbox(
                  tristate: true,
                  value: _selectedIds.isEmpty
                      ? false
                      : (_selectedIds.length == _campaigns.length
                          ? true
                          : null),
                  onChanged: _bulkPending
                      ? null
                      : (v) {
                          setState(() {
                            if (v == true) {
                              _selectedIds
                                ..clear()
                                ..addAll(
                                  _campaigns
                                      .map((c) => c['id']?.toString() ?? '')
                                      .where((id) => id.isNotEmpty),
                                );
                            } else {
                              _selectedIds.clear();
                            }
                          });
                        },
                ),
                Expanded(child: Text(_c('select_all_label'))),
              ],
            ),
          if (_selectedIds.isNotEmpty &&
              _c('bulk_apply_status_action').isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  _c('selected_count_fmt').contains('{count}')
                      ? _c('selected_count_fmt').replaceAll(
                          '{count}',
                          '${_selectedIds.length}',
                        )
                      : '${_selectedIds.length}',
                ),
                for (final st in _statuses)
                  ChoiceChip(
                    label: Text(_campaignStatusLabel(st)),
                    selected: _bulkStatus == st,
                    onSelected: _bulkPending
                        ? null
                        : (sel) {
                            setState(() => _bulkStatus = sel ? st : '');
                          },
                  ),
                FilledButton(
                  onPressed: _bulkPending || _bulkStatus.isEmpty
                      ? null
                      : () => unawaited(_applyBulkStatus()),
                  child: Text(
                    _bulkPending && _c('bulk_status_pending').isNotEmpty
                        ? _c('bulk_status_pending')
                        : _c('bulk_apply_status_action'),
                  ),
                ),
                if (_c('clear_selection_action').isNotEmpty)
                  OutlinedButton(
                    onPressed: _bulkPending
                        ? null
                        : () => setState(() {
                              _selectedIds.clear();
                              _bulkStatus = '';
                            }),
                    child: Text(_c('clear_selection_action')),
                  ),
              ],
            ),
            const SizedBox(height: 8),
          ],
          ..._campaigns.map((c) {
            final id = c['id']?.toString() ?? '';
            final title = c['title']?.toString() ?? '';
            final status = c['status']?.toString() ?? '';
            final statusLabel = (c['status_label'] as String?)?.trim() ?? '';
            final statusDisp = statusLabel.isNotEmpty
                ? statusLabel
                : (_statusLabels[status] ?? '').trim().isNotEmpty
                    ? _statusLabels[status]!.trim()
                    : _c('empty_value');
            final autoClosed = c['auto_closed'] == true;
            final endsAt = (c['ends_at'] as String?)?.trim() ?? '';
            final creativeTypeLabel =
                (c['creative_type_label'] as String?)?.trim() ?? '';
            final creativeDisp = creativeTypeLabel.isNotEmpty
                ? creativeTypeLabel
                : _c('empty_value');
            final impressions =
                c['impressions'] is num ? c['impressions'] : _c('empty_value');
            final clicks = c['clicks'] is num ? c['clicks'] : _c('empty_value');
            final reach = c['unique_reach'];
            final videoId = c['video_id']?.toString();
            final cap = c['daily_spend_cap'];
            final thumb = (c['thumbnail_url'] as String?)?.trim() ?? '';
            final gallery = (c['gallery'] as List<dynamic>? ?? const [])
                .map((e) => e.toString().trim())
                .where((u) => u.isNotEmpty)
                .toList();
            final focused = _focusId.isNotEmpty && id == _focusId;
            final focusKey =
                focused ? _focusKeys.putIfAbsent(id, GlobalKey.new) : null;
            final selected = id.isNotEmpty && _selectedIds.contains(id);
            return Card(
              key: focusKey,
              margin: const EdgeInsets.only(bottom: 12),
              shape: focused
                  ? RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: tokens.gold, width: 2),
                    )
                  : null,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (_c('select_row_label').isNotEmpty)
                          Checkbox(
                            value: selected,
                            onChanged: _bulkPending || id.isEmpty
                                ? null
                                : (v) {
                                    setState(() {
                                      if (v == true) {
                                        _selectedIds.add(id);
                                      } else {
                                        _selectedIds.remove(id);
                                      }
                                    });
                                  },
                          ),
                        Expanded(
                          child: Text(
                            title,
                            style: TextStyle(
                              color: tokens.gold,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (_mediaChromeReady &&
                        (thumb.isNotEmpty || gallery.isNotEmpty)) ...[
                      const SizedBox(height: 8),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: GalleryCarousel(
                          images: [
                            if (thumb.isNotEmpty) thumb,
                            ...gallery.where((u) => u != thumb),
                          ],
                          semanticsLabel: _c('gallery_label'),
                        ),
                      ),
                    ],
                    const SizedBox(height: 4),
                    Text(
                      [
                        if (_c('status_label').isNotEmpty)
                          '${_c('status_label')}$sep$statusDisp'
                        else
                          statusDisp,
                        if (autoClosed && _c('auto_closed_badge').isNotEmpty)
                          _c('auto_closed_badge'),
                      ].where((s) => s.toString().trim().isNotEmpty).join(sep),
                      style: TextStyle(
                        color: tokens.onSurfaceMuted,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      creativeDisp,
                      style:
                          TextStyle(color: tokens.onSurfaceMuted, fontSize: 13),
                    ),
                    if (endsAt.isNotEmpty && _c('ends_at_label').isNotEmpty)
                      Text(
                        '${_c('ends_at_label')} $endsAt',
                        style: TextStyle(
                          color: tokens.onSurfaceMuted,
                          fontSize: 13,
                        ),
                      ),
                    Text(
                      cap is num &&
                              cap > 0 &&
                              _createFeeCurrency.isNotEmpty &&
                              _c('amount_currency_separator').isNotEmpty &&
                              _c('daily_spend_cap_suffix').isNotEmpty
                          ? '${_c('daily_spend_cap_suffix')} $cap${_c('amount_currency_separator')}$_createFeeCurrency'
                          : (cap is num &&
                                  cap > 0 &&
                                  _c('daily_spend_cap_label').isNotEmpty
                              ? '${_c('daily_spend_cap_label')}$sep$cap'
                              : _c('empty_value')),
                      style:
                          TextStyle(color: tokens.onSurfaceMuted, fontSize: 13),
                    ),
                    if (videoId != null &&
                        videoId.isNotEmpty &&
                        _c('video_attached_suffix').isNotEmpty)
                      Text(
                        _c('video_attached_suffix'),
                        style: TextStyle(
                          color: tokens.onSurfaceMuted,
                          fontSize: 13,
                        ),
                      ),
                    Text(
                      [
                        '$impressions ${_c('stats_impressions_suffix')}',
                        if (reach != null) '$reach ${_c('stats_reach_suffix')}',
                        '$clicks ${_c('stats_clicks_suffix')}',
                      ].where((s) => s.trim().isNotEmpty).join(sep),
                      style:
                          TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        if (!autoClosed &&
                            (_archivedStatus.isEmpty ||
                                status != _archivedStatus) &&
                            _c('save_action').isNotEmpty)
                          OutlinedButton(
                            onPressed: _busy
                                ? null
                                : () => _promptEditTitle(id, title),
                            child: Text(_c('save_action')),
                          ),
                        if (!autoClosed)
                          for (final st in _statuses)
                            OutlinedButton(
                              onPressed: _busy || status == st
                                  ? null
                                  : () => _setStatus(id, st),
                              style: status == st
                                  ? OutlinedButton.styleFrom(
                                      foregroundColor: tokens.gold,
                                    )
                                  : null,
                              child: Text(
                                (_statusLabels[st] ?? '').trim().isNotEmpty
                                    ? _statusLabels[st]!.trim()
                                    : _c('empty_value'),
                              ),
                            ),
                        if (_c('close_campaign_action').isNotEmpty &&
                            c['auto_closed'] != true &&
                            (_archivedStatus.isEmpty ||
                                status != _archivedStatus))
                          OutlinedButton(
                            onPressed: _busy ? null : () => _closeCampaign(id),
                            child: Text(_c('close_campaign_action')),
                          ),
                        if (_c('reopen_campaign_action').isNotEmpty &&
                            _archivedStatus.isNotEmpty &&
                            status == _archivedStatus &&
                            c['auto_closed'] != true)
                          OutlinedButton(
                            onPressed: _busy ? null : () => _reopenCampaign(id),
                            child: Text(_c('reopen_campaign_action')),
                          ),
                        if (!_mediaChromeReady &&
                            !_viewportCreativesChromeReady &&
                            c['auto_closed'] != true)
                          OutlinedButton(
                            onPressed: _busy || _defaultCreativeType.isEmpty
                                ? null
                                : () => _replaceCreative(id),
                            child: Text(_c('replace_creative_action')),
                          ),
                        if (!_viewportCreativesChromeReady &&
                            c['auto_closed'] != true)
                          FilledButton(
                            onPressed: _busy ? null : () => _attachVideo(id),
                            child: Text(_c('attach_video_action')),
                          ),
                        if (_c('delete_campaign_action').isNotEmpty &&
                            c['auto_closed'] != true &&
                            (impressions is! num || impressions == 0) &&
                            (clicks is! num || clicks == 0))
                          OutlinedButton(
                            onPressed: _busy ? null : () => _deleteCampaign(id),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: tokens.danger,
                            ),
                            child: Text(_c('delete_campaign_action')),
                          ),
                      ],
                    ),
                    if (_viewportCreativesChromeReady &&
                        c['auto_closed'] != true) ...[
                      const SizedBox(height: 12),
                      Divider(color: tokens.borderSubtle),
                      const SizedBox(height: 8),
                      ViewportCreativesEditor(
                        accessToken: widget.accessToken,
                        campaign: c,
                        chrome: _chrome,
                        disabled: _busy,
                        onSaved: _load,
                      ),
                    ],
                    if ((_viewportCreativesChromeReady || _mediaChromeReady) &&
                        !autoClosed &&
                        (videoId ?? '').trim().isNotEmpty &&
                        _c('clear_legacy_video_action').isNotEmpty) ...[
                      const SizedBox(height: 8),
                      OutlinedButton(
                        onPressed: _busy ? null : () => _clearLegacyVideo(id),
                        child: Text(_c('clear_legacy_video_action')),
                      ),
                    ],
                    if (_mediaChromeReady && c['auto_closed'] != true) ...[
                      const SizedBox(height: 12),
                      Divider(color: tokens.borderSubtle),
                      const SizedBox(height: 8),
                      EntityMediaEditor(
                        thumbnailLabel: _c('thumbnail_label'),
                        galleryLabel: _c('gallery_label'),
                        galleryEmpty: _c('gallery_empty'),
                        galleryAddAction: _c('gallery_add_action'),
                        galleryMaxSlots: _c('gallery_max_slots'),
                        gallerySlotsFmt: _c('gallery_slots_fmt'),
                        thumbnailMainBadge: _c('thumbnail_main_badge'),
                        thumbnailEmptyHint: _c('thumbnail_empty_hint'),
                        thumbnailHint: _c('thumbnail_hint'),
                        dropzoneChrome: _dropzoneChrome!,
                        thumbnailUrl: thumb,
                        galleryUrls: gallery,
                        busyThumbnail: _busy && _uploadingSlot == 'thumb:$id',
                        busyGallery: _busy && _uploadingSlot == 'gallery:$id',
                        enabled: !_busy ||
                            _uploadingSlot == 'thumb:$id' ||
                            _uploadingSlot == 'gallery:$id',
                        onThumbnail: (file) => _uploadThumbnail(id, file),
                        onClearThumbnail: () => _clearThumbnail(id),
                        onGalleryFiles: (files) => _uploadGallery(id, files),
                        onRemoveGallery: (index) => _removeGalleryAt(id, index),
                      ),
                    ],
                    if (_bounds.isNotEmpty)
                      PublisherScheduleEditor(
                        accessToken: widget.accessToken,
                        campaign: c,
                        chrome: _chrome,
                        bounds: _bounds,
                        onSaved: () => _load(),
                      ),
                  ],
                ),
              ),
            );
          }),
        ],
        if (_meta != null && _meta!.totalPages > 1)
          SkipPaginationBar(
            meta: _meta!,
            busy: _loading && _campaigns.isNotEmpty,
            onSkip: (skip) => unawaited(_load(skip: skip)),
          ),
      ],
    );
  }
}
