import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/cache/skip_store.dart';
import 'package:dama_mobile/core/lib/competition_arena.dart';
import 'package:dama_mobile/core/lib/competition_payout.dart';
import 'package:dama_mobile/core/errors/api_user_message.dart';
import 'package:dama_mobile/core/io/share_bytes.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/media_upload_chrome.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/arena_duration_field.dart';
import 'package:dama_mobile/core/ui/entity_media_editor.dart';
import 'package:dama_mobile/core/ui/chrome_select_sheet.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/core/ui/skip_pagination_bar.dart';
import 'package:dama_mobile/core/util/sanitize_decimal_input.dart';
import 'package:dama_mobile/features/events/community_player_chrome_soft.dart';
import 'package:dama_mobile/features/events/event_bracket.dart';
import 'package:dama_mobile/features/events/event_invite_share_url.dart';
import 'package:dama_mobile/features/events/event_result_card.dart';
import 'package:dama_mobile/features/events/event_standings.dart';
import 'package:dama_mobile/features/events/event_winners_board.dart';
import 'package:dama_mobile/features/events/events_dialog_shell.dart';
import 'package:dama_mobile/features/events/hosting_organizer_chrome_soft.dart';
import 'package:dama_mobile/features/events/official_pause_dialog.dart';
import 'package:dama_mobile/features/game/match_board_page.dart';
import 'package:dama_mobile/features/game/spectate_page.dart';
import 'package:dama_mobile/features/player/player_inspect_sheet.dart';
import 'package:dama_mobile/features/leaderboard/leaderboard_cubit.dart'
    show SkipMeta;
import 'package:dama_mobile/features/notifications/notification_app_bar_actions.dart';
import 'package:dama_mobile/features/notifications/notification_href_nav.dart';
import 'package:dama_mobile/features/wallet/portal_wallet_focus.dart';
import 'package:dama_mobile/features/wallet/wallet_cubit.dart';
import 'package:dama_mobile/features/wallet/wallet_page.dart';
import 'package:dama_mobile/widgets/host_trust_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';
import 'package:share_plus/share_plus.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

/// Fail-closed BuildMeta check for Manage Players/Payments/Live (no invent).
bool _apiSkipMetaReady(Map<String, dynamic> meta) {
  if (meta['skip'] is! num || (meta['skip'] as num).toInt() < 0) return false;
  if (meta['limit'] is! num || (meta['limit'] as num).toInt() < 1) return false;
  if (meta['total'] is! num || (meta['total'] as num).toInt() < 0) return false;
  if (meta['page'] is! num || (meta['page'] as num).toInt() < 1) return false;
  if (meta['total_pages'] is! num || (meta['total_pages'] as num).toInt() < 0) {
    return false;
  }
  if (meta['has_more'] is! bool) return false;
  final summary = (meta['page_summary'] as String?)?.trim() ?? '';
  final next = (meta['next_action_label'] as String?)?.trim() ?? '';
  return summary.isNotEmpty && next.isNotEmpty;
}

/// Organizer list + create + manage (chrome from events-organizer-chrome).
class EventsPage extends StatefulWidget {
  const EventsPage({
    super.key,
    required this.accessToken,
    this.initialEventId,
    this.initialOpenCreate = false,
  });

  final String accessToken;
  final String? initialEventId;

  /// Host CTA `/events/events?create=1` - open create flow once chrome is ready.
  final bool initialOpenCreate;

  @override
  State<EventsPage> createState() => _EventsPageState();
}

class _EventsPageState extends State<EventsPage> {
  EventsOrganizerChrome? _chrome;
  String _unavailable = '';
  bool _loading = true;
  bool _softFetching = false;
  bool _bulkPending = false;
  final Set<String> _selectedIds = <String>{};
  List<HostedEvent> _events = const [];
  SkipMeta? _meta;
  static const _skipKey = 'events_organizer';
  int _skip = 0;
  final _searchCtrl = TextEditingController();
  String _searchQ = '';
  static const _statusAll = '__all__';
  String _statusFilter = _statusAll;

  /// all | free | paid - server-side is_free_entry.
  String _entryFilter = 'all';
  List<String> _statusCodes = const [];
  Map<String, String> _statusLabels = const {};
  bool _focusOpened = false;
  bool _createOpened = false;
  String _sharePathTemplate = '';
  EventsDashboardStats? _hostStats;

  @override
  void initState() {
    super.initState();
    _skip = SkipStore.read(_skipKey);
    _load(skip: _skip);
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load({int? skip}) async {
    final nextSkip = skip ?? _skip;
    // Persist before the network round-trip so tab switch / process kill mid-fetch
    // still restores the page the user navigated to (web ?skip= parity).
    if (skip != null) {
      _skip = nextSkip;
      unawaited(SkipStore.write(_skipKey, nextSkip));
    }
    final soft = _chrome != null && _events.isNotEmpty;
    setState(() {
      if (soft) {
        _softFetching = true;
      } else {
        _loading = true;
      }
    });
    try {
      final chromeRes = await http.get(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/public/events-organizer-chrome',
        ),
      );
      EventsOrganizerChrome? chrome;
      String unavailable = '';
      if (chromeRes.statusCode < 300) {
        final map = jsonDecode(chromeRes.body) as Map<String, dynamic>;
        chrome = EventsOrganizerChrome.fromJson(map);
        unavailable =
            (map['events_organizer_chrome_unavailable'] as String?)?.trim() ??
                '';
      }
      if (chrome == null || chrome.listPageSizeInt < 1) {
        if (!mounted) return;
        setState(() {
          _chrome = null;
          _unavailable = softHostingChromeUnavailable(unavailable);
          _loading = false;
          _softFetching = false;
        });
        return;
      }
      // Catalog hosted_events_enabled == false → Hosting list gated (web parity).
      try {
        final catRes = await http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/events/catalog'),
          headers: {'Authorization': 'Bearer ${widget.accessToken}'},
        );
        if (catRes.statusCode < 300) {
          final cat = EventsCatalog.fromJson(
            jsonDecode(catRes.body) as Map<String, dynamic>,
          );
          _sharePathTemplate = cat.sharePathTemplate.trim();
          if (cat.hostedEventsEnabled == false) {
            if (!mounted) return;
            final ready = chrome;
            setState(() {
              _chrome = ready;
              _unavailable = softHostingFeatureDisabled(ready.featureDisabled);
              _loading = false;
              _softFetching = false;
              _events = const [];
            });
            return;
          }
        }
      } catch (_) {}
      final limit = chrome.listPageSizeInt;
      final enumsRes = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/platform/enums'),
      );
      List<String> statusCodes = const [];
      Map<String, String> statusLabels = const {};
      if (enumsRes.statusCode < 300) {
        try {
          final enumsBody = jsonDecode(enumsRes.body) as Map<String, dynamic>;
          statusCodes =
              (enumsBody['hosted_event_statuses'] as List<dynamic>? ?? const [])
                  .map((e) => e.toString().trim())
                  .where((s) => s.isNotEmpty)
                  .toList();
          final labelsRaw = enumsBody['hosted_event_status_labels'];
          if (labelsRaw is Map) {
            statusLabels = labelsRaw.map(
              (k, v) => MapEntry(k.toString(), (v?.toString() ?? '').trim()),
            );
          }
        } catch (_) {}
      }
      final params = <String, String>{
        'skip': '$nextSkip',
        'limit': '$limit',
      };
      final q = _searchQ.trim();
      if (q.isNotEmpty) params['q'] = q;
      if (_statusFilter != _statusAll && _statusFilter.trim().isNotEmpty) {
        params['status'] = _statusFilter.trim();
      }
      if (_entryFilter == 'free') params['is_free_entry'] = 'true';
      if (_entryFilter == 'paid') params['is_free_entry'] = 'false';
      final listRes = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/').replace(
          queryParameters: params,
        ),
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      if (!mounted) return;
      final ready = chrome;
      if (listRes.statusCode >= 300) {
        setState(() {
          _chrome = ready;
          _statusCodes = statusCodes;
          _statusLabels = statusLabels;
          _loading = false;
          _softFetching = false;
          _unavailable = softHostingFeatureDisabled(ready.featureDisabled);
        });
        return;
      }
      final body = jsonDecode(listRes.body) as Map<String, dynamic>;
      final rows = (body['events'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(HostedEvent.fromJson)
          .where((e) => e.id.isNotEmpty)
          .toList();
      final metaRaw = body['meta'];
      final meta =
          metaRaw is Map<String, dynamic> ? SkipMeta.fromJson(metaRaw) : null;
      EventsDashboardStats? hostStats;
      try {
        final dashRes = await http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/events/dashboard'),
          headers: {'Authorization': 'Bearer ${widget.accessToken}'},
        );
        if (dashRes.statusCode < 300) {
          hostStats = EventsDashboardStats.fromJson(
            jsonDecode(dashRes.body) as Map<String, dynamic>,
          );
        }
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _chrome = ready;
        _statusCodes = statusCodes;
        _statusLabels = statusLabels;
        _events = rows;
        _meta = meta;
        _hostStats = hostStats;
        _skip = nextSkip;
        _selectedIds.clear();
        _bulkPending = false;
        _loading = false;
        _softFetching = false;
        _unavailable = '';
      });
      unawaited(SkipStore.write(_skipKey, nextSkip));
      await _openFocusEventIfNeeded();
      await _openCreateIfRequested();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _softFetching = false;
        _unavailable =
            softHostingFeatureDisabled(_chrome?.featureDisabled ?? '');
      });
    }
  }

  Future<void> _openCreateIfRequested() async {
    if (!widget.initialOpenCreate || _createOpened || _chrome == null) return;
    final focusId = (widget.initialEventId ?? '').trim();
    if (focusId.isNotEmpty) return;
    _createOpened = true;
    // Host CTA → Community path: prefer Public when public cups enabled.
    await _openCreate(preferPublicVisibility: true);
  }

  Future<void> _openFocusEventIfNeeded() async {
    final id = (widget.initialEventId ?? '').trim();
    if (id.isEmpty || _focusOpened || _chrome == null) return;
    _focusOpened = true;
    HostedEvent? hit;
    for (final e in _events) {
      if (e.id == id) {
        hit = e;
        break;
      }
    }
    if (hit == null) {
      try {
        final res = await http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/events/$id'),
          headers: {'Authorization': 'Bearer ${widget.accessToken}'},
        );
        if (!mounted || res.statusCode >= 300) return;
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        hit = HostedEvent.fromJson(body);
        if (hit.id.isEmpty) return;
      } catch (_) {
        return;
      }
    }
    // After the null-fetch branch, [hit] is promoted non-null or we already returned.
    if (!mounted) return;
    await _openManage(hit);
  }

  List<String> get _statusOptions {
    if (_statusCodes.isNotEmpty) return _statusCodes;
    final seen = <String>{};
    final out = <String>[];
    for (final e in _events) {
      final st = e.status.trim();
      if (st.isEmpty || seen.contains(st)) continue;
      seen.add(st);
      out.add(st);
    }
    return out;
  }

  String _labelForStatus(String code) {
    final fromEnum = (_statusLabels[code] ?? '').trim();
    if (fromEnum.isNotEmpty) return fromEnum;
    final fromRow = _events
        .where((e) => e.status == code)
        .map((e) => e.statusLabel.trim())
        .firstWhere((l) => l.isNotEmpty, orElse: () => '');
    if (fromRow.isNotEmpty) return fromRow;
    return _chrome?.emptyValue ?? '';
  }

  Future<void> _openCreate({bool preferPublicVisibility = false}) async {
    final chrome = _chrome;
    if (chrome == null) return;
    final created = await showDialog<HostedEvent>(
      context: context,
      builder: (_) => _CreateEventDialog(
        accessToken: widget.accessToken,
        chrome: chrome,
        preferPublicVisibility: preferPublicVisibility,
      ),
    );
    if (created == null || !mounted) return;
    await _load();
    if (!mounted) return;
    // SnackBar on list scaffold after dialog pops (dialog messenger is gone).
    final vis = created.visibility.trim();
    final communityHref = chrome.portalPublicListHref.trim();
    final communityLabel = softHostingPortalPublicListLabel(
      chrome.portalPublicListLabel,
    );
    // Web parity: compare to catalog public visibility code (not hardcoded "public").
    var pubCode = 'public';
    try {
      final catRes = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/catalog'),
      );
      if (catRes.statusCode < 300) {
        final cat = EventsCatalog.fromJson(
          jsonDecode(catRes.body) as Map<String, dynamic>,
        );
        final fromCat = cat.hostedEventPublicVisibility.trim();
        if (fromCat.isNotEmpty) pubCode = fromCat;
      }
    } catch (_) {}
    if (!mounted) return;
    final showCommunity = vis.isNotEmpty &&
        communityHref.isNotEmpty &&
        communityLabel.isNotEmpty &&
        vis == pubCode;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(softHostingToastCreated(chrome.toastCreated)),
        action: showCommunity
            ? SnackBarAction(
                label: communityLabel,
                onPressed: () {
                  navigateNotificationHref(
                    context,
                    href: communityHref,
                    accessToken: widget.accessToken,
                  );
                },
              )
            : null,
      ),
    );
  }

  Future<void> _openManage(HostedEvent ev) async {
    final chrome = _chrome;
    if (chrome == null) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => _ManageEventPage(
          accessToken: widget.accessToken,
          chrome: chrome,
          eventId: ev.id,
        ),
      ),
    );
    await _load();
  }

  Future<void> _copyFromList(
    String value,
    EventsOrganizerChrome chrome,
  ) async {
    final next = value.trim();
    // Never copy bare origin - that opens home instead of an invite.
    if (next.isEmpty ||
        RegExp(r'^https?:\/\/[^/]+\/?$', caseSensitive: false).hasMatch(next)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(chrome.toastCopyFailed)),
      );
      return;
    }
    try {
      await Clipboard.setData(ClipboardData(text: next));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(chrome.copiedBlurb)),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(chrome.toastCopyFailed)),
      );
    }
  }

  Future<void> _downloadQrFromList(
    HostedEvent ev,
    EventsOrganizerChrome chrome,
  ) async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/${ev.id}/qr.png'),
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      if (res.statusCode != 200) throw Exception('qr');
      final cd = res.headers['content-disposition'] ?? '';
      final match = RegExp(
        r'filename="?([^";]+)"?',
        caseSensitive: false,
      ).firstMatch(cd);
      final filename = (match?.group(1) ?? '').trim();
      if (filename.isEmpty) throw Exception('qr filename');
      await shareBytesAsFile(
        bytes: res.bodyBytes,
        filename: filename,
        mimeType: 'image/png',
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            chrome.toastQrDownloadFailed.isNotEmpty
                ? chrome.toastQrDownloadFailed
                : chrome.qrUnavailable,
          ),
        ),
      );
    }
  }

  bool _canCloseHosted(HostedEvent ev) {
    return (ev.startedAt ?? '').isEmpty &&
        (ev.finishedAt ?? '').isEmpty &&
        (ev.cancelledAt ?? '').isEmpty;
  }

  bool _canReopenHosted(HostedEvent ev) {
    return (ev.cancelledAt ?? '').isNotEmpty &&
        (ev.startedAt ?? '').isEmpty &&
        (ev.finishedAt ?? '').isEmpty;
  }

  Future<bool> _closeFromList(
    HostedEvent ev, {
    bool reload = true,
    bool toastSuccess = true,
  }) async {
    final chrome = _chrome;
    if (chrome == null || chrome.closeAction.isEmpty) return false;
    final res = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/v1/events/${ev.id}/close'),
      headers: {'Authorization': 'Bearer ${widget.accessToken}'},
    );
    if (!mounted) return false;
    final messenger = ScaffoldMessenger.of(context);
    if (res.statusCode >= 300) {
      final msg = softHostingToastCloseFailed(chrome.toastCloseFailed);
      if (msg.isNotEmpty) {
        messenger.showSnackBar(
          SnackBar(content: Text(msg)),
        );
      }
      return false;
    }
    if (toastSuccess) {
      final closed = softHostingToastClosed(chrome.toastClosed);
      if (closed.isNotEmpty) {
        messenger.showSnackBar(
          SnackBar(content: Text(closed)),
        );
      }
    }
    if (reload) await _load();
    return true;
  }

  Future<void> _bulkCloseSelected() async {
    final chrome = _chrome;
    if (chrome == null || chrome.bulkCloseAction.isEmpty || _bulkPending) {
      return;
    }
    final targets = _events
        .where((e) => _selectedIds.contains(e.id) && _canCloseHosted(e))
        .toList();
    if (targets.isEmpty) return;
    setState(() => _bulkPending = true);
    var closedCount = 0;
    try {
      for (final ev in targets) {
        final ok = await _closeFromList(
          ev,
          reload: false,
          toastSuccess: false,
        );
        if (!ok) break;
        closedCount += 1;
      }
      if (mounted && closedCount > 0) {
        final closed = softHostingToastClosed(chrome.toastClosed);
        if (closed.isNotEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(closed)),
          );
        }
      }
      await _load();
    } finally {
      if (mounted) {
        setState(() {
          _selectedIds.clear();
          _bulkPending = false;
        });
      }
    }
  }

  Future<void> _bulkReopenSelected() async {
    final chrome = _chrome;
    if (chrome == null || chrome.bulkReopenAction.isEmpty || _bulkPending) {
      return;
    }
    final targets = _events
        .where((e) => _selectedIds.contains(e.id) && _canReopenHosted(e))
        .toList();
    if (targets.isEmpty) return;
    setState(() => _bulkPending = true);
    var reopenedCount = 0;
    try {
      for (final ev in targets) {
        final ok = await _reopenFromList(
          ev,
          reload: false,
          toastSuccess: false,
        );
        if (!ok) break;
        reopenedCount += 1;
      }
      if (mounted && reopenedCount > 0) {
        final reopened = softHostingToastReopened(chrome.toastReopened);
        if (reopened.isNotEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(reopened)),
          );
        }
      }
      await _load();
    } finally {
      if (mounted) {
        setState(() {
          _selectedIds.clear();
          _bulkPending = false;
        });
      }
    }
  }

  Future<bool> _reopenFromList(
    HostedEvent ev, {
    bool reload = true,
    bool toastSuccess = true,
  }) async {
    final chrome = _chrome;
    if (chrome == null || chrome.reopenAction.isEmpty) return false;
    final res = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/v1/events/${ev.id}/reopen'),
      headers: {'Authorization': 'Bearer ${widget.accessToken}'},
    );
    if (!mounted) return false;
    final messenger = ScaffoldMessenger.of(context);
    if (res.statusCode >= 300) {
      var msg = softHostingToastReopenFailed(chrome.toastReopenFailed);
      var walletShortfall = false;
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map) {
          final key = (decoded['error_key'] as String?)?.trim() ?? '';
          final guarantee = key == 'insufficient_prize_guarantee' ||
              key == 'err_reopen_guarantee_hold_failed';
          final hostFeeShort = key == 'insufficient_host_fee';
          walletShortfall = guarantee || hostFeeShort;
          final hostTrustMsg = key == 'err_host_guarantee_requires_document_kyc'
              ? chrome.errHostGuaranteeRequiresDocumentKyc.trim()
              : key == 'err_host_paid_requires_phone_kyc'
                  ? chrome.errHostPaidRequiresPhoneKyc.trim()
                  : key == 'err_host_concurrent_open_paid_cap'
                      ? chrome.errHostConcurrentOpenPaidCap.trim()
                      : key == 'err_host_reputation_blocked'
                          ? chrome.errHostReputationBlocked.trim()
                          : guarantee
                              ? chrome.insufficientPrizeGuarantee.trim()
                              : hostFeeShort
                                  ? chrome.insufficientHostFee.trim()
                                  : '';
          if (hostTrustMsg.isNotEmpty) {
            msg = hostTrustMsg;
          } else {
            final err = (decoded['error'] as String?)?.trim() ?? '';
            if (err.isNotEmpty) msg = err;
          }
        }
      } catch (_) {}
      if (msg.isNotEmpty) {
        final topUp = chrome.topUpAction.trim();
        final href =
            withWalletFocusParam(chrome.portalWalletHref.trim(), 'topup');
        messenger.showSnackBar(
          SnackBar(
            content: Text(msg),
            action: walletShortfall && topUp.isNotEmpty && href.isNotEmpty
                ? SnackBarAction(
                    label: topUp,
                    onPressed: () {
                      if (isWalletHrefPath(href)) {
                        final focus = portalWalletFocusFromHref(href);
                        final base = moneyBasePathFromHref(href);
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => WalletPage(
                              token: widget.accessToken,
                              moneyBasePath: base,
                              showOrganizerPayoutBlurb: true,
                              focusPayout: focus.focusPayout,
                              focusTopUp: focus.focusTopUp,
                              focusPayoutHistoryId: focus.historyId,
                            ),
                          ),
                        );
                      } else {
                        navigateNotificationHref(
                          context,
                          href: href,
                          accessToken: widget.accessToken,
                        );
                      }
                    },
                  )
                : null,
          ),
        );
      }
      return false;
    }
    if (toastSuccess) {
      final reopened = softHostingToastReopened(chrome.toastReopened);
      if (reopened.isNotEmpty) {
        messenger.showSnackBar(
          SnackBar(content: Text(reopened)),
        );
      }
    }
    if (reload) await _load();
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    // Soft page changes keep the list + pager mounted (no skeleton flash).
    if (_loading && _chrome == null) {
      return const Padding(
        padding: EdgeInsets.zero,
        child: TournamentListSkeleton(),
      );
    }
    final chrome = _chrome;
    if (chrome == null) {
      return Center(
        child: Padding(
          padding: EdgeInsets.zero,
          child: Text(
            softHostingChromeUnavailable(_unavailable),
            style: TextStyle(color: tokens.danger),
          ),
        ),
      );
    }
    final pagePad = EventsDialogShell.pageInsets(
      insetH: chrome.dialogShellInsetH,
      insetV: chrome.dialogShellInsetV,
    );
    final blurbMax = double.tryParse(chrome.listBlurbMaxWidth.trim());
    final searchMax = double.tryParse(chrome.searchFieldMaxWidth.trim());
    if (pagePad == null ||
        blurbMax == null ||
        blurbMax <= 0 ||
        searchMax == null ||
        searchMax <= 0) {
      return const SizedBox.shrink();
    }
    final rows = _events;
    final meta = _meta;
    return RefreshIndicator(
      onRefresh: () => _load(skip: _skip),
      child: ListView(
        padding: pagePad,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Text(
                  softHostingListTitle(chrome.listTitle),
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
              ),
              HostTrustBadge(
                label: _hostStats?.hostTrustBadge,
                tier: _hostStats?.hostTrustTier,
                fontSize: 10,
                dense: true,
              ),
            ],
          ),
          if (() {
            final sep = chrome.hostRepMetaSeparator;
            final s = _hostStats;
            return sep.isNotEmpty &&
                chrome.hostRepFinishedLabel.trim().isNotEmpty &&
                chrome.hostRepCancelledLabel.trim().isNotEmpty &&
                chrome.hostRepReportsLabel.trim().isNotEmpty &&
                s != null &&
                s.hostFinishedPaidCups != null &&
                s.hostCancelledPaidCups != null &&
                s.hostOpenReports != null;
          }()) ...[
            const SizedBox(height: 6),
            Text(
              [
                '${chrome.hostRepFinishedLabel.trim()} ${_hostStats!.hostFinishedPaidCups}',
                '${chrome.hostRepCancelledLabel.trim()} ${_hostStats!.hostCancelledPaidCups}',
                '${chrome.hostRepReportsLabel.trim()} ${_hostStats!.hostOpenReports}',
              ].join(chrome.hostRepMetaSeparator),
              style: TextStyle(
                color: tokens.onSurfaceMuted,
                fontSize: 11,
              ),
            ),
          ],
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: BoxConstraints(maxWidth: blurbMax),
            child: Text(
              softHostingListBlurb(chrome.listBlurb),
              style: TextStyle(color: tokens.onSurfaceMuted),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _openCreate,
            icon: const Icon(Icons.add),
            label: Text(softHostingCreateAction(chrome.createAction)),
          ),
          const SizedBox(height: 12),
          Text(
            chrome.filterEntryLabel,
            style: TextStyle(
              color: tokens.onSurfaceMuted,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final f in const ['all', 'free', 'paid'])
                ChoiceChip(
                  label: Text(
                    switch (f) {
                      'free' => chrome.filterFreeLabel,
                      'paid' => chrome.filterPaidLabel,
                      _ => chrome.filterAllLabel,
                    },
                  ),
                  selected: _entryFilter == f,
                  onSelected: _loading
                      ? null
                      : (_) {
                          if (_entryFilter == f) return;
                          setState(() => _entryFilter = f);
                          unawaited(SkipStore.clear(_skipKey));
                          _load(skip: 0);
                        },
                ),
            ],
          ),
          const SizedBox(height: 12),
          ConstrainedBox(
            constraints: BoxConstraints(maxWidth: searchMax),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                labelText: softHostingSearchLabel(chrome.searchLabel),
                hintText:
                    softHostingSearchPlaceholder(chrome.searchPlaceholder),
                border: const OutlineInputBorder(),
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.search),
                  onPressed: _loading
                      ? null
                      : () {
                          final next = _searchCtrl.text.trim();
                          if (_searchQ == next) return;
                          setState(() => _searchQ = next);
                          unawaited(SkipStore.clear(_skipKey));
                          _load(skip: 0);
                        },
                ),
              ),
              textInputAction: TextInputAction.search,
              onSubmitted: _loading
                  ? null
                  : (v) {
                      final next = v.trim();
                      if (_searchQ == next) return;
                      setState(() => _searchQ = next);
                      unawaited(SkipStore.clear(_skipKey));
                      _load(skip: 0);
                    },
            ),
          ),
          if (_statusOptions.isNotEmpty) ...[
            const SizedBox(height: 12),
            ChromeSelectField(
              label: chrome.statusFilterLabel,
              valueLabel: _statusFilter == _statusAll
                  ? chrome.filterStatusAll
                  : _labelForStatus(_statusFilter),
              onTap: () async {
                final options = <ChromeSelectOption<String>>[
                  ChromeSelectOption(
                    value: _statusAll,
                    label: chrome.filterStatusAll,
                  ),
                  for (final st in _statusOptions)
                    ChromeSelectOption(
                      value: st,
                      label: _labelForStatus(st),
                    ),
                ];
                final picked = await showChromeOptionSheet<String>(
                  context: context,
                  title: chrome.statusFilterLabel,
                  options: options,
                  selected: _statusFilter,
                );
                if (picked != null && picked != _statusFilter) {
                  setState(() => _statusFilter = picked);
                  unawaited(SkipStore.clear(_skipKey));
                  await _load(skip: 0);
                }
              },
            ),
          ],
          const SizedBox(height: 16),
          if (rows.isEmpty)
            Text(
              softHostingEmptyList(chrome.emptyList),
              style: TextStyle(color: tokens.onSurfaceMuted),
            )
          else ...[
            if (chrome.selectAllLabel.isNotEmpty &&
                chrome.selectRowLabel.isNotEmpty)
              Row(
                children: [
                  Checkbox(
                    tristate: true,
                    value: _selectedIds.isEmpty
                        ? false
                        : (_selectedIds.length == rows.length ? true : null),
                    onChanged: _bulkPending
                        ? null
                        : (v) {
                            setState(() {
                              if (v == true) {
                                _selectedIds
                                  ..clear()
                                  ..addAll(
                                    rows
                                        .map((e) => e.id)
                                        .where((id) => id.isNotEmpty),
                                  );
                              } else {
                                _selectedIds.clear();
                              }
                            });
                          },
                  ),
                  Expanded(child: Text(chrome.selectAllLabel)),
                ],
              ),
            if (_selectedIds.isNotEmpty &&
                chrome.selectAllLabel.isNotEmpty &&
                chrome.selectRowLabel.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    chrome.selectedCountFmt.contains('{count}')
                        ? chrome.selectedCountFmt.replaceAll(
                            '{count}',
                            '${_selectedIds.length}',
                          )
                        : '${_selectedIds.length}',
                  ),
                  if (chrome.bulkCloseAction.isNotEmpty)
                    FilledButton(
                      onPressed: _bulkPending ||
                              !_events.any(
                                (e) =>
                                    _selectedIds.contains(e.id) &&
                                    _canCloseHosted(e),
                              )
                          ? null
                          : () => unawaited(_bulkCloseSelected()),
                      child: Text(
                        _bulkPending
                            ? chrome.bulkActionPending
                            : chrome.bulkCloseAction,
                      ),
                    ),
                  if (chrome.bulkReopenAction.isNotEmpty)
                    FilledButton(
                      onPressed: _bulkPending ||
                              !_events.any(
                                (e) =>
                                    _selectedIds.contains(e.id) &&
                                    _canReopenHosted(e),
                              )
                          ? null
                          : () => unawaited(_bulkReopenSelected()),
                      child: Text(
                        _bulkPending
                            ? chrome.bulkActionPending
                            : chrome.bulkReopenAction,
                      ),
                    ),
                  if (chrome.clearSelectionAction.isNotEmpty)
                    OutlinedButton(
                      onPressed: _bulkPending
                          ? null
                          : () => setState(() => _selectedIds.clear()),
                      child: Text(chrome.clearSelectionAction),
                    ),
                ],
              ),
              const SizedBox(height: 8),
            ],
            for (final ev in rows)
              Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  leading: chrome.selectAllLabel.isNotEmpty &&
                          chrome.selectRowLabel.isNotEmpty
                      ? Checkbox(
                          value: _selectedIds.contains(ev.id),
                          onChanged: _bulkPending
                              ? null
                              : (v) {
                                  setState(() {
                                    if (v == true) {
                                      _selectedIds.add(ev.id);
                                    } else {
                                      _selectedIds.remove(ev.id);
                                    }
                                  });
                                },
                        )
                      : null,
                  title: Text(ev.title),
                  subtitle: Builder(
                    builder: (context) {
                      final poolLines = hostedEventPrizePoolLines(
                        ev,
                        PrizePoolCardLabels.fromOrganizer(chrome),
                      );
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            [
                              ev.statusLabel.isNotEmpty
                                  ? ev.statusLabel
                                  : chrome.emptyValue,
                              if ((ev.finishedAt ?? '').isNotEmpty &&
                                  chrome.autoClosedBadge.isNotEmpty)
                                chrome.autoClosedBadge,
                              () {
                                final left = ev.approvedCount != null
                                    ? '${ev.approvedCount}'
                                    : chrome.emptyValue;
                                final fillRight = seatCapFillRight(
                                  ev.maxPlayers,
                                  ev.seatCapUnlimited,
                                  chrome.unlimitedPlayersLabel,
                                );
                                // Space before players suffix (web/player parity; not metaSeparator).
                                if (fillRight != null) {
                                  return '$left/$fillRight ${chrome.playersCountSuffix}'
                                      .trim();
                                }
                                return '$left ${chrome.playersCountSuffix}'
                                    .trim();
                              }(),
                              ev.joinCode,
                              ...poolLines,
                            ].join(chrome.metaSeparator),
                            style: TextStyle(
                              color: tokens.onSurfaceMuted,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                  trailing: Builder(
                    builder: (context) {
                      final canClose =
                          _canCloseHosted(ev) && chrome.closeAction.isNotEmpty;
                      final canReopen = _canReopenHosted(ev) &&
                          softHostingReopenAction(chrome.reopenAction)
                              .isNotEmpty;
                      return PopupMenuButton<String>(
                        tooltip: chrome.rowActionsLabel.isNotEmpty
                            ? chrome.rowActionsLabel
                            : chrome.manageAction,
                        onSelected: (value) {
                          switch (value) {
                            case 'manage':
                              _openManage(ev);
                              break;
                            case 'copy_link':
                              final baseOrigin = Uri.base.origin.trim();
                              final originForFallback =
                                  baseOrigin.startsWith('http://') ||
                                          baseOrigin.startsWith('https://')
                                      ? baseOrigin
                                      : '';
                              final link = resolveEventInviteShareUrl(
                                shareUrl: ev.shareUrl,
                                joinCode: ev.joinCode,
                                sharePathTemplate: _sharePathTemplate,
                                origin: originForFallback,
                              );
                              if (link.isNotEmpty) {
                                unawaited(_copyFromList(link, chrome));
                              }
                              break;
                            case 'download_qr':
                              unawaited(_downloadQrFromList(ev, chrome));
                              break;
                            case 'close':
                              unawaited(_closeFromList(ev));
                              break;
                            case 'reopen':
                              unawaited(_reopenFromList(ev));
                              break;
                          }
                        },
                        itemBuilder: (context) => [
                          PopupMenuItem(
                            value: 'manage',
                            child: Text(chrome.manageAction),
                          ),
                          if ((ev.shareUrl ?? '').trim().isNotEmpty &&
                              chrome.copyLinkAction.isNotEmpty)
                            PopupMenuItem(
                              value: 'copy_link',
                              child: Text(chrome.copyLinkAction),
                            ),
                          if (chrome.downloadQrAction.isNotEmpty)
                            PopupMenuItem(
                              value: 'download_qr',
                              child: Text(chrome.downloadQrAction),
                            ),
                          if (canClose)
                            PopupMenuItem(
                              value: 'close',
                              child: Text(
                                softHostingCloseAction(chrome.closeAction),
                              ),
                            ),
                          if (canReopen)
                            PopupMenuItem(
                              value: 'reopen',
                              child: Text(
                                softHostingReopenAction(chrome.reopenAction),
                              ),
                            ),
                        ],
                      );
                    },
                  ),
                ),
              ),
          ],
          if (meta != null && meta.totalPages > 1)
            SkipPaginationBar(
              meta: meta,
              busy: _softFetching,
              onSkip: (skip) => unawaited(_load(skip: skip)),
            ),
        ],
      ),
    );
  }
}

class _CreateEventDialog extends StatefulWidget {
  const _CreateEventDialog({
    required this.accessToken,
    required this.chrome,
    this.preferPublicVisibility = false,
  });

  final String accessToken;
  final EventsOrganizerChrome chrome;

  /// Host CTA: seed Public so the cup can appear under Community tournaments.
  final bool preferPublicVisibility;

  @override
  State<_CreateEventDialog> createState() => _CreateEventDialogState();
}

class _CreateEventDialogState extends State<_CreateEventDialog>
    with WidgetsBindingObserver {
  EventsCatalog? _catalog;
  PaymentModalChrome? _payChrome;
  bool _loading = true;
  bool _submitting = false;
  bool _attempted = false;
  String _error = '';
  final _titleCtrl = TextEditingController();
  final _descriptionCtrl = TextEditingController();
  final _entryFeeCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();
  final _brandColorCtrl = TextEditingController();
  String? _formatId;
  String? _sizeId;
  String _visibility = '';
  bool _freeEntry = true;
  bool _prizePoolDisplay = false;
  bool _prizePoolGuarantee = false;
  double? _quoteCommission;
  double? _quoteNet;
  double? _quotePercent;
  final _guaranteeAmountCtrl = TextEditingController();
  final _arenaDurationCtrl = TextEditingController();
  final _prizePercent1Ctrl = TextEditingController();
  final _prizePercent2Ctrl = TextEditingController();
  final _prizePercent3Ctrl = TextEditingController();
  String _payoutMode = '';
  Map<String, dynamic>? _clientEnums;
  WebSocketChannel? _flagsWs;
  StreamSubscription? _flagsSub;

  /// Host CTA: keep prefer across a stale public_events_enabled=false catalog.
  bool _preferPublicPending = false;

  final _topUpSectionKey = GlobalKey();
  final _createScrollCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _preferPublicPending = widget.preferPublicVisibility;
    _bootstrap();
    unawaited(_listenFeatureFlags());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Mid-dialog Public gate: refresh catalog when returning to Host create.
      unawaited(_reloadCatalogGate());
    }
  }

  void _applyCatalogVisibilityGate(EventsCatalog catalog) {
    final pub = catalog.hostedEventPublicVisibility.trim();
    final priv = catalog.hostedEventPrivateVisibility.trim();
    final def = catalog.defaultVisibility.trim();
    if (_preferPublicPending && pub.isNotEmpty && catalog.publicEventsEnabled) {
      _visibility = pub;
      _preferPublicPending = false;
      return;
    }
    if (pub.isNotEmpty && _visibility == pub && !catalog.publicEventsEnabled) {
      _visibility = priv.isNotEmpty ? priv : def;
    }
  }

  Future<void> _reloadCatalogGate() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/catalog'),
      );
      if (!mounted || res.statusCode >= 300) return;
      final catalog = EventsCatalog.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      if (!mounted) return;
      setState(() {
        _catalog = catalog;
        _applyCatalogVisibilityGate(catalog);
      });
    } catch (_) {}
  }

  Future<void> _listenFeatureFlags() async {
    await _flagsSub?.cancel();
    await _flagsWs?.sink.close();
    _flagsWs = null;
    _flagsSub = null;
    final token = widget.accessToken.trim();
    if (token.isEmpty) return;
    try {
      final origin = ApiConfig.baseUrl.replaceFirst(RegExp(r'^http'), 'ws');
      final uri = Uri.parse(
        '$origin/ws/matchmaking?token=${Uri.encodeComponent(token)}',
      );
      _flagsWs = WebSocketChannel.connect(uri);
      _flagsSub = _flagsWs!.stream.listen((event) {
        if (event is! String) return;
        try {
          final msg = jsonDecode(event) as Map<String, dynamic>;
          if (msg['type'] != 'feature_flags') return;
          unawaited(_reloadCatalogGate());
        } catch (_) {}
      });
    } catch (_) {}
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    final sub = _flagsSub;
    final ws = _flagsWs;
    _flagsSub = null;
    _flagsWs = null;
    unawaited(sub?.cancel() ?? Future<void>.value());
    unawaited(ws?.sink.close() ?? Future<void>.value());
    _titleCtrl.dispose();
    _descriptionCtrl.dispose();
    _entryFeeCtrl.dispose();
    _amountCtrl.dispose();
    _brandColorCtrl.dispose();
    _guaranteeAmountCtrl.dispose();
    _arenaDurationCtrl.dispose();
    _prizePercent1Ctrl.dispose();
    _prizePercent2Ctrl.dispose();
    _prizePercent3Ctrl.dispose();
    _createScrollCtrl.dispose();
    super.dispose();
  }

  bool get _placesPercentPayoutMode {
    final enums = _clientEnums;
    if (enums == null) return false;
    final places =
        (enums['competition_payout_mode_places_percent'] as String?)?.trim() ??
            '';
    final dual =
        (enums['competition_payout_mode_dual_purse'] as String?)?.trim() ?? '';
    final mode = _payoutMode.trim();
    return (places.isNotEmpty && mode == places) ||
        (dual.isNotEmpty && mode == dual);
  }

  void _applyPayoutDefaults() {
    final enums = _clientEnums;
    if (!_prizePoolDisplay || enums == null) return;
    if (_payoutMode.trim().isEmpty) {
      final def = defaultPayoutModeForFormat(enums, _formatId ?? '');
      if (def.isNotEmpty) _payoutMode = def;
    }
    if (_prizePercent1Ctrl.text.trim().isEmpty) {
      _prizePercent1Ctrl.text =
          (enums['competition_default_place_percent_1'] as String?)?.trim() ??
              '';
      _prizePercent2Ctrl.text =
          (enums['competition_default_place_percent_2'] as String?)?.trim() ??
              '';
      _prizePercent3Ctrl.text =
          (enums['competition_default_place_percent_3'] as String?)?.trim() ??
              '';
    }
  }

  String _payoutModeOptionLabel(String value, EventsOrganizerChrome chrome) {
    final enums = _clientEnums;
    if (enums == null) return value;
    final places =
        (enums['competition_payout_mode_places_percent'] as String?)?.trim() ??
            '';
    final score =
        (enums['competition_payout_mode_score_share'] as String?)?.trim() ?? '';
    final dual =
        (enums['competition_payout_mode_dual_purse'] as String?)?.trim() ?? '';
    if (value == places && chrome.payoutModePlacesPercentLabel.isNotEmpty) {
      return chrome.payoutModePlacesPercentLabel;
    }
    if (value == score && chrome.payoutModeScoreShareLabel.isNotEmpty) {
      return chrome.payoutModeScoreShareLabel;
    }
    if (value == dual && chrome.payoutModeDualPurseLabel.isNotEmpty) {
      return chrome.payoutModeDualPurseLabel;
    }
    return value;
  }

  bool get _arenaFormatSelected {
    final fid = (_formatId ?? '').trim();
    return fid.isNotEmpty && tournamentFormatIsArena(fid, _clientEnums);
  }

  double _walletNeedForCreate(double hostFee) {
    // Host and guarantee use host_fee_currency on create; never invent cross-currency sums.
    var need = hostFee > 0 ? hostFee : 0.0;
    if (_prizeGuaranteeActive) {
      final g = parsePositiveDecimal(_guaranteeAmountCtrl.text);
      if (g != null && g > 0) need += g;
    }
    return need;
  }

  bool get _prizeGuaranteeActive {
    final catalog = _catalog;
    return !_freeEntry &&
        catalog != null &&
        catalog.prizePoolDisplayEnabled &&
        _prizePoolDisplay &&
        catalog.prizePoolGuaranteeEnabled &&
        _prizePoolGuarantee;
  }

  Future<void> _refreshEntryFeeQuote() async {
    final raw = _entryFeeCtrl.text.trim();
    final fee = double.tryParse(raw);
    if (_freeEntry || fee == null || fee <= 0) {
      if (!mounted) return;
      setState(() {
        _quoteCommission = null;
        _quoteNet = null;
        _quotePercent = null;
      });
      return;
    }
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/entry-fee-quote')
            .replace(queryParameters: {'amount': raw}),
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        setState(() {
          _quoteCommission = null;
          _quoteNet = null;
          _quotePercent = null;
        });
        return;
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      setState(() {
        _quoteCommission = (body['commission'] as num?)?.toDouble();
        _quoteNet = (body['organizer_net'] as num?)?.toDouble();
        _quotePercent = (body['commission_percent'] as num?)?.toDouble();
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _quoteCommission = null;
        _quoteNet = null;
        _quotePercent = null;
      });
    }
  }

  Future<void> _bootstrap() async {
    try {
      final results = await Future.wait([
        http.get(Uri.parse('${ApiConfig.baseUrl}/api/v1/events/catalog')),
        http.get(
          Uri.parse(
            '${ApiConfig.baseUrl}/api/v1/public/payment-modal-chrome',
          ),
        ),
        http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/platform/enums'),
          headers: {'Authorization': 'Bearer ${widget.accessToken}'},
        ),
      ]);
      EventsCatalog? catalog;
      if (results[0].statusCode < 300) {
        catalog = EventsCatalog.fromJson(
          jsonDecode(results[0].body) as Map<String, dynamic>,
        );
      }
      PaymentModalChrome? pay;
      if (results[1].statusCode < 300) {
        pay = PaymentModalChrome.fromJson(
          jsonDecode(results[1].body) as Map<String, dynamic>,
        );
      }
      Map<String, dynamic>? enums;
      if (results[2].statusCode < 300) {
        enums = jsonDecode(results[2].body) as Map<String, dynamic>?;
      }
      if (!mounted) return;
      setState(() {
        _catalog = catalog;
        _payChrome = pay;
        _clientEnums = enums;
        final pub = (catalog?.hostedEventPublicVisibility ?? '').trim();
        final priv = (catalog?.hostedEventPrivateVisibility ?? '').trim();
        final defVis = (catalog?.defaultVisibility ?? '').trim();
        if (_preferPublicPending &&
            pub.isNotEmpty &&
            catalog?.publicEventsEnabled == true) {
          _visibility = pub;
          _preferPublicPending = false;
        } else if (pub.isNotEmpty &&
            defVis == pub &&
            catalog?.publicEventsEnabled == true) {
          _visibility = pub;
        } else if (priv.isNotEmpty) {
          // Prefer stays pending when gate looked off - WS/resume can upgrade.
          _visibility = priv;
        } else if (defVis.isNotEmpty) {
          _visibility = defVis;
        } else if ((catalog?.hostedEventVisibilities ?? const []).isNotEmpty) {
          _visibility = catalog!.hostedEventVisibilities.first;
        } else {
          _visibility = '';
        }
        if (catalog != null && catalog.formats.isNotEmpty) {
          _formatId = catalog.formats.first.id;
          final allowed = catalog.sizes
              .where((s) => s.allowedFormatIds.contains(_formatId))
              .toList();
          _sizeId = allowed.isNotEmpty ? allowed.first.id : null;
        }
        _loading = false;
        if (catalog == null) {
          _error = softHostingFeatureDisabled(widget.chrome.featureDisabled);
        }
        _applyPayoutDefaults();
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = softHostingFeatureDisabled(widget.chrome.featureDisabled);
      });
    }
  }

  EventsCatalogSize? get _selectedSize {
    final id = _sizeId;
    final cat = _catalog;
    if (id == null || cat == null) return null;
    for (final s in cat.sizes) {
      if (s.id == id) return s;
    }
    return null;
  }

  Future<void> _submit(WalletCubit wallet) async {
    final chrome = widget.chrome;
    final title = _titleCtrl.text.trim();
    final formatId = (_formatId ?? '').trim();
    final sizeId = (_sizeId ?? '').trim();
    setState(() => _attempted = true);
    if (title.isEmpty || formatId.isEmpty || sizeId.isEmpty) return;
    if (_arenaFormatSelected) {
      final durChrome = ArenaDurationFieldChrome(
        label: chrome.arenaDurationLabel,
        requiredHint: chrome.arenaDurationRequired,
        unitLabel: chrome.arenaDurationUnitLabel,
        unitMinutes: chrome.arenaDurationUnitMinutes,
        unitHours: chrome.arenaDurationUnitHours,
        unitDays: chrome.arenaDurationUnitDays,
        unitWeeks: chrome.arenaDurationUnitWeeks,
        unitMonths: chrome.arenaDurationUnitMonths,
        modeLength: chrome.arenaDurationModeLength,
        modeEndsAt: chrome.arenaDurationModeEndsAt,
        endsAtLabel: chrome.arenaDurationEndsAtLabel,
        endsAtPlaceholder: chrome.arenaDurationEndsAtPlaceholder,
        lengthPlaceholder: chrome.arenaDurationLengthPlaceholder,
        endsAtPast: chrome.arenaDurationEndsAtPast,
        blurb: chrome.arenaDurationBlurb,
      );
      if (!durChrome.isReady) {
        setState(() =>
            _error = softHostingToastCreateFailed(chrome.toastCreateFailed));
        return;
      }
      final mins = int.tryParse(_arenaDurationCtrl.text.trim());
      if (mins == null || mins < 1) {
        setState(() => _error = chrome.arenaDurationRequired);
        return;
      }
    }
    final country = wallet.state.country.trim().toUpperCase();
    if (country.isEmpty) {
      setState(() =>
          _error = softHostingToastCreateFailed(chrome.toastCreateFailed));
      return;
    }
    setState(() {
      _submitting = true;
      _error = '';
    });
    try {
      final body = <String, dynamic>{
        'title': title,
        'format_id': formatId,
        'size_id': sizeId,
        'auto_approve': true,
        'is_free_entry': _freeEntry,
        'country_code': country,
      };
      final catalogGate = _catalog;
      final pubGate = (catalogGate?.hostedEventPublicVisibility ?? '').trim();
      if (pubGate.isNotEmpty &&
          _visibility.trim() == pubGate &&
          catalogGate?.publicEventsEnabled != true) {
        final priv = (catalogGate?.hostedEventPrivateVisibility ?? '').trim();
        final def = (catalogGate?.defaultVisibility ?? '').trim();
        setState(() {
          _visibility = priv.isNotEmpty ? priv : def;
          _submitting = false;
          _error = softHostingPublicDisabled(chrome.publicDisabled);
        });
        return;
      }
      if (_visibility.trim().isNotEmpty) {
        body['visibility'] = _visibility.trim();
      }
      final brandColor = _brandColorCtrl.text.trim();
      if (brandColor.isNotEmpty) {
        body['brand_color'] = brandColor;
      }
      final description = _descriptionCtrl.text.trim();
      if (description.isNotEmpty) {
        body['description'] = description;
      }
      if (!_freeEntry) {
        final fee = parsePositiveDecimal(_entryFeeCtrl.text);
        if (fee == null) {
          setState(() {
            _submitting = false;
            _error = softHostingToastCreateFailed(chrome.toastCreateFailed);
          });
          return;
        }
        body['entry_fee_amount'] = fee;
        final size = _selectedSize;
        if (size != null) body['entry_fee_currency'] = size.hostFeeCurrency;
      }
      final catalog = _catalog;
      if (_arenaFormatSelected) {
        body['arena_duration_minutes'] =
            int.parse(_arenaDurationCtrl.text.trim());
      }
      if (!_freeEntry && catalog != null && catalog.prizePoolDisplayEnabled) {
        body['prize_pool_display_enabled'] = _prizePoolDisplay;
        if (_prizePoolDisplay && catalog.prizePoolGuaranteeEnabled) {
          body['prize_pool_guarantee_enabled'] = _prizePoolGuarantee;
          if (_prizePoolGuarantee) {
            final guarantee = parsePositiveDecimal(_guaranteeAmountCtrl.text);
            if (guarantee == null) {
              setState(() {
                _submitting = false;
                _error = softHostingToastCreateFailed(chrome.toastCreateFailed);
              });
              return;
            }
            body['prize_pool_guarantee_amount'] = guarantee;
          }
        }
        if (_prizePoolDisplay) {
          final mode = _payoutMode.trim();
          if (mode.isNotEmpty) {
            final enums = _clientEnums;
            final options = payoutModeOptions(enums, formatId);
            if (options.isNotEmpty && !options.contains(mode)) {
              setState(() {
                _submitting = false;
                _error = chrome.errPayoutModeInvalid.trim().isNotEmpty
                    ? chrome.errPayoutModeInvalid
                    : softHostingToastCreateFailed(chrome.toastCreateFailed);
              });
              return;
            }
            body['prize_payout_mode'] = mode;
            final placesMode =
                (enums?['competition_payout_mode_places_percent'] as String?)
                        ?.trim() ??
                    '';
            final dualMode =
                (enums?['competition_payout_mode_dual_purse'] as String?)
                        ?.trim() ??
                    '';
            if ((placesMode.isNotEmpty && mode == placesMode) ||
                (dualMode.isNotEmpty && mode == dualMode)) {
              if (placePercentsSumInvalid(
                _prizePercent1Ctrl.text,
                _prizePercent2Ctrl.text,
                _prizePercent3Ctrl.text,
              )) {
                setState(() {
                  _submitting = false;
                  _error = chrome.errPrizePlacePercentsSum.trim().isNotEmpty
                      ? chrome.errPrizePlacePercentsSum
                      : softHostingToastCreateFailed(chrome.toastCreateFailed);
                });
                return;
              }
              final percents = buildPlacePercentsMap(
                _prizePercent1Ctrl.text,
                _prizePercent2Ctrl.text,
                _prizePercent3Ctrl.text,
              );
              if (percents != null) {
                body['prize_place_percents'] = percents;
              }
            }
          }
        }
      }
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/'),
        headers: {
          'Authorization': 'Bearer ${widget.accessToken}',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(body),
      );
      if (!mounted) return;
      if (res.statusCode == 402) {
        var key = '';
        try {
          final decoded = jsonDecode(res.body);
          if (decoded is Map) {
            key = (decoded['error_key'] as String?)?.trim() ?? '';
          }
        } catch (_) {}
        final guaranteeShort = key == 'insufficient_prize_guarantee' ||
            key == 'err_reopen_guarantee_hold_failed';
        final msg = guaranteeShort
            ? chrome.insufficientPrizeGuarantee
            : chrome.insufficientHostFee;
        setState(() {
          _submitting = false;
          _error = msg;
        });
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          final ctx = _topUpSectionKey.currentContext;
          if (ctx != null) {
            Scrollable.ensureVisible(
              ctx,
              duration: const Duration(milliseconds: 280),
              alignment: 0.2,
              curve: Curves.easeOut,
            );
          }
          final topUp = chrome.topUpAction.trim();
          final href = withWalletFocusParam(
            chrome.portalWalletHref.trim(),
            'topup',
          );
          if (msg.trim().isEmpty) return;
          final messenger = ScaffoldMessenger.of(context);
          final nav = Navigator.of(context);
          messenger.showSnackBar(
            SnackBar(
              content: Text(msg),
              action: topUp.isNotEmpty && href.isNotEmpty
                  ? SnackBarAction(
                      label: topUp,
                      onPressed: () {
                        nav.pop();
                        if (isWalletHrefPath(href)) {
                          final focus = portalWalletFocusFromHref(href);
                          final base = moneyBasePathFromHref(href);
                          nav.push(
                            MaterialPageRoute(
                              builder: (_) => WalletPage(
                                token: widget.accessToken,
                                moneyBasePath: base,
                                showOrganizerPayoutBlurb: true,
                                focusPayout: focus.focusPayout,
                                focusTopUp: focus.focusTopUp,
                                focusPayoutHistoryId: focus.historyId,
                              ),
                            ),
                          );
                        } else {
                          navigateNotificationHref(
                            context,
                            href: href,
                            accessToken: widget.accessToken,
                          );
                        }
                      },
                    )
                  : null,
            ),
          );
        });
        return;
      }
      if (res.statusCode >= 300) {
        var hostKey = '';
        try {
          final decoded = jsonDecode(res.body);
          if (decoded is Map) {
            hostKey = (decoded['error_key'] as String?)?.trim() ?? '';
          }
        } catch (_) {}
        // Host-trust create gates: organizer chrome only (never invent English).
        final hostTrustMsg =
            hostKey == 'err_host_guarantee_requires_document_kyc'
                ? chrome.errHostGuaranteeRequiresDocumentKyc.trim()
                : hostKey == 'err_host_paid_requires_phone_kyc'
                    ? chrome.errHostPaidRequiresPhoneKyc.trim()
                    : hostKey == 'err_host_concurrent_open_paid_cap'
                        ? chrome.errHostConcurrentOpenPaidCap.trim()
                        : hostKey == 'err_host_reputation_blocked'
                            ? chrome.errHostReputationBlocked.trim()
                            : '';
        // Map cash gates (phone_kyc, …) to wallet cash chrome - never raw API JSON/English.
        final cashMsg = wallet.cashGateMessageForBody(
          res.body,
          softHostingToastCreateFailed(chrome.toastCreateFailed),
        );
        setState(() {
          _submitting = false;
          _error = hostTrustMsg.isNotEmpty ? hostTrustMsg : cashMsg;
        });
        return;
      }
      final ev = HostedEvent.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      if (!mounted) return;
      // Parent list shows toast + optional Community action after pop.
      Navigator.of(context).pop(ev);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = softHostingToastCreateFailed(chrome.toastCreateFailed);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final chrome = widget.chrome;
    final tokens = damaColorsOf(context);
    final media = MediaQuery.sizeOf(context);
    final shell = EventsDialogShell.tryParse(
      maxHeightRatio: chrome.dialogShellMaxHeightRatio,
      maxWidth: chrome.dialogShellMaxWidth,
      insetH: chrome.dialogShellInsetH,
      insetV: chrome.dialogShellInsetV,
      loadingHeight: chrome.dialogShellLoadingHeight,
    );
    if (shell == null) {
      return AlertDialog(
        content: Text(softHostingChromeUnavailable(chrome.unavailable)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(
              chrome.dialogCloseLabel.trim().isNotEmpty
                  ? chrome.dialogCloseLabel
                  : softHostingCancelAction(chrome.cancelAction),
            ),
          ),
        ],
      );
    }
    final shellConstraints = shell.constraintsFor(media);
    if (_loading) {
      return AlertDialog(
        insetPadding: shell.insetPadding,
        content: ConstrainedBox(
          constraints: shellConstraints,
          child: SizedBox(
            height: shell.loadingHeight,
            child: Center(
              child: CircularProgressIndicator(color: tokens.gold),
            ),
          ),
        ),
      );
    }
    final catalog = _catalog;
    if (catalog == null) {
      return AlertDialog(
        insetPadding: shell.insetPadding,
        content: ConstrainedBox(
          constraints: shellConstraints,
          child: SingleChildScrollView(
            child: Text(_error, style: TextStyle(color: tokens.danger)),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(
              chrome.dialogCloseLabel.trim().isNotEmpty
                  ? chrome.dialogCloseLabel
                  : softHostingCancelAction(chrome.cancelAction),
            ),
          ),
        ],
      );
    }
    final size = _selectedSize;
    final hostFee =
        size == null ? null : catalog.effectiveHostFee(size, _visibility);
    final hostCur = size?.hostFeeCurrency ?? '';
    final emptyCell = chrome.emptyValue;

    return BlocProvider(
      create: (_) {
        final cubit = WalletCubit(accessToken: widget.accessToken);
        WalletPage.unawaitedLoad(cubit);
        return cubit;
      },
      child: BlocConsumer<WalletCubit, WalletState>(
        listenWhen: (p, n) =>
            p.checkoutMessage != n.checkoutMessage ||
            p.error != n.error ||
            p.balance != n.balance,
        listener: (context, state) {
          final msg = chromeOnlyUserMessage(
            state.checkoutMessage ?? state.error,
          );
          if (msg != null) {
            ScaffoldMessenger.of(context)
                .showSnackBar(SnackBar(content: Text(msg)));
          }
          final bal = state.balance;
          final fee = hostFee;
          if (bal == null || fee == null || fee <= 0) return;
          final need = _walletNeedForCreate(fee);
          if (bal >= need) return;
          if (_amountCtrl.text.trim().isNotEmpty) return;
          final shortfall = need - bal;
          if (shortfall <= 0) return;
          final s = sanitizeDecimalInput(shortfall.toString());
          if (s.isEmpty) return;
          _amountCtrl.value = TextEditingValue(
            text: s,
            selection: TextSelection.collapsed(offset: s.length),
          );
          context.read<WalletCubit>().setAmountText(s);
        },
        builder: (context, wallet) {
          final balance = wallet.balance;
          final walletNeed = hostFee != null && hostFee > 0
              ? _walletNeedForCreate(hostFee)
              : null;
          final canAfford = balance != null &&
              walletNeed != null &&
              walletNeed > 0 &&
              balance >= walletNeed;
          final countryMissing =
              !wallet.locating && wallet.country.trim().isEmpty;
          final pay = _payChrome;

          return AlertDialog(
            insetPadding: shell.insetPadding,
            title: Text(softHostingCreateTitle(chrome.createTitle)),
            content: ConstrainedBox(
              constraints: shellConstraints,
              child: SingleChildScrollView(
                controller: _createScrollCtrl,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      softHostingCreateBlurb(chrome.createBlurb),
                      style: TextStyle(color: tokens.onSurfaceMuted),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _titleCtrl,
                      decoration: InputDecoration(
                        labelText: softHostingTitleLabel(chrome.titleLabel),
                        hintText: chrome.titlePlaceholder,
                        border: const OutlineInputBorder(),
                        errorText: _attempted && _titleCtrl.text.trim().isEmpty
                            ? (chrome.errTitleRequired.isNotEmpty
                                ? chrome.errTitleRequired
                                : null)
                            : null,
                      ),
                      onChanged: (_) {
                        if (_attempted) setState(() {});
                      },
                    ),
                    if (chrome.descriptionLabel.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      TextField(
                        controller: _descriptionCtrl,
                        maxLines: 4,
                        decoration: InputDecoration(
                          labelText: chrome.descriptionLabel,
                          hintText: chrome.descriptionPlaceholder,
                          border: const OutlineInputBorder(),
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    ChromeSelectField(
                      label: chrome.formatLabel,
                      valueLabel: () {
                        final id = _formatId;
                        if (id == null) return '';
                        for (final f in catalog.formats) {
                          if (f.id == id) return f.label;
                        }
                        return '';
                      }(),
                      onTap: () async {
                        final picked = await showChromeOptionSheet<String>(
                          context: context,
                          title: chrome.formatLabel,
                          selected: _formatId,
                          options: [
                            for (final f in catalog.formats)
                              if (f.label.isNotEmpty)
                                ChromeSelectOption(
                                  value: f.id,
                                  label: f.label,
                                ),
                          ],
                        );
                        if (picked != null) {
                          setState(() {
                            _formatId = picked;
                            final allowed = catalog.sizes
                                .where(
                                    (s) => s.allowedFormatIds.contains(picked))
                                .toList();
                            if (_sizeId == null ||
                                !allowed.any((s) => s.id == _sizeId)) {
                              _sizeId =
                                  allowed.isNotEmpty ? allowed.first.id : null;
                            }
                            if (_prizePoolDisplay) {
                              final options =
                                  payoutModeOptions(_clientEnums, picked);
                              final cur = _payoutMode.trim();
                              if (cur.isEmpty ||
                                  (options.isNotEmpty &&
                                      !options.contains(cur))) {
                                _payoutMode = defaultPayoutModeForFormat(
                                  _clientEnums,
                                  picked,
                                );
                              }
                            }
                          });
                        }
                      },
                    ),
                    if (_attempted &&
                        (_formatId ?? '').trim().isEmpty &&
                        chrome.errFormatSizeRequired.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        chrome.errFormatSizeRequired,
                        style: TextStyle(
                          color: tokens.danger,
                          fontSize: 12,
                        ),
                      ),
                    ],
                    if (_arenaFormatSelected) ...[
                      const SizedBox(height: 12),
                      ArenaDurationField(
                        chrome: ArenaDurationFieldChrome(
                          label: chrome.arenaDurationLabel,
                          requiredHint: chrome.arenaDurationRequired,
                          unitLabel: chrome.arenaDurationUnitLabel,
                          unitMinutes: chrome.arenaDurationUnitMinutes,
                          unitHours: chrome.arenaDurationUnitHours,
                          unitDays: chrome.arenaDurationUnitDays,
                          unitWeeks: chrome.arenaDurationUnitWeeks,
                          unitMonths: chrome.arenaDurationUnitMonths,
                          modeLength: chrome.arenaDurationModeLength,
                          modeEndsAt: chrome.arenaDurationModeEndsAt,
                          endsAtLabel: chrome.arenaDurationEndsAtLabel,
                          endsAtPlaceholder:
                              chrome.arenaDurationEndsAtPlaceholder,
                          lengthPlaceholder:
                              chrome.arenaDurationLengthPlaceholder,
                          endsAtPast: chrome.arenaDurationEndsAtPast,
                          blurb: chrome.arenaDurationBlurb,
                        ),
                        minutesValue: _arenaDurationCtrl.text,
                        errorText: _attempted &&
                                (int.tryParse(_arenaDurationCtrl.text.trim()) ??
                                        0) <
                                    1
                            ? chrome.arenaDurationRequired
                            : null,
                        onMinutesChanged: (v) {
                          _arenaDurationCtrl.text = v;
                          if (_attempted) setState(() {});
                        },
                      ),
                    ],
                    const SizedBox(height: 12),
                    ChromeSelectField(
                      label: chrome.sizeLabel,
                      valueLabel: () {
                        final id = _sizeId;
                        if (id == null) return '';
                        for (final s in catalog.sizes) {
                          if (s.id == id && s.label.isNotEmpty) {
                            final fee =
                                catalog.effectiveHostFee(s, _visibility);
                            final feeText = fee != null ? '$fee' : emptyCell;
                            final maxText = formatSeatCapDisplay(
                              s.maxPlayers,
                              catalog.swissRoundsByMaxPlayers,
                              chrome.unlimitedPlayersLabel,
                              emptyCell,
                            );
                            // Avoid "Unlimited · Unlimited" when catalog label already is Unlimited chrome.
                            final seatSeg =
                                maxText.isNotEmpty && maxText != s.label
                                    ? '${chrome.metaSeparator}$maxText'
                                    : '';
                            return '${s.label}$seatSeg${chrome.metaSeparator}$feeText${chrome.amountCurrencySeparator}${s.hostFeeCurrency}';
                          }
                        }
                        return '';
                      }(),
                      onTap: () async {
                        final fmt = _formatId;
                        final sizeOptions = [
                          for (final s in catalog.sizes)
                            if (s.label.isNotEmpty &&
                                fmt != null &&
                                s.allowedFormatIds.contains(fmt))
                              ChromeSelectOption(
                                value: s.id,
                                label: () {
                                  final maxText = formatSeatCapDisplay(
                                    s.maxPlayers,
                                    catalog.swissRoundsByMaxPlayers,
                                    chrome.unlimitedPlayersLabel,
                                    emptyCell,
                                  );
                                  final seatSeg =
                                      maxText.isNotEmpty && maxText != s.label
                                          ? '${chrome.metaSeparator}$maxText'
                                          : '';
                                  return '${s.label}$seatSeg${chrome.metaSeparator}${catalog.effectiveHostFee(s, _visibility) ?? emptyCell}${chrome.amountCurrencySeparator}${s.hostFeeCurrency}';
                                }(),
                              ),
                        ];
                        final picked = await showChromeOptionSheet<String>(
                          context: context,
                          title: chrome.sizeLabel,
                          selected: _sizeId,
                          options: sizeOptions,
                        );
                        if (picked != null) {
                          setState(() => _sizeId = picked);
                        }
                      },
                    ),
                    if (_attempted &&
                        (_sizeId ?? '').trim().isEmpty &&
                        chrome.errFormatSizeRequired.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        chrome.errFormatSizeRequired,
                        style: TextStyle(
                          color: tokens.danger,
                          fontSize: 12,
                        ),
                      ),
                    ],
                    if (size != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        '${chrome.maxPlayersLabel}${chrome.metaSeparator}${formatSeatCapDisplay(size.maxPlayers, catalog.swissRoundsByMaxPlayers, chrome.unlimitedPlayersLabel, emptyCell)}',
                        style: TextStyle(color: tokens.onSurfaceMuted),
                      ),
                      Text(
                        '${chrome.hostFeeLabel}${chrome.metaSeparator}${hostFee ?? emptyCell}${chrome.amountCurrencySeparator}$hostCur',
                        style: TextStyle(
                          color: tokens.gold,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                    Text(
                      softCommunityJoinStatusMessage(
                          chrome.forceAutoApproveNote),
                      style: TextStyle(color: tokens.onSurfaceMuted),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _brandColorCtrl,
                      decoration: InputDecoration(
                        labelText: chrome.brandColorLabel,
                        hintText: chrome.brandColorPlaceholder,
                        border: const OutlineInputBorder(),
                      ),
                    ),
                    if (catalog.hostedEventVisibilities.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      ChromeSelectField(
                        label: chrome.visibilityLabel,
                        valueLabel: () {
                          final v = _visibility;
                          final pub =
                              catalog.hostedEventPublicVisibility.trim();
                          final priv =
                              catalog.hostedEventPrivateVisibility.trim();
                          if (pub.isNotEmpty && v == pub) {
                            return chrome.visibilityPublicLabel;
                          }
                          if (priv.isNotEmpty && v == priv) {
                            return chrome.visibilityPrivateLabel;
                          }
                          return chrome.emptyValue;
                        }(),
                        onTap: () async {
                          final options = <ChromeSelectOption<String>>[];
                          final pub =
                              catalog.hostedEventPublicVisibility.trim();
                          final priv =
                              catalog.hostedEventPrivateVisibility.trim();
                          for (final v in catalog.hostedEventVisibilities) {
                            if (pub.isNotEmpty &&
                                v == pub &&
                                !catalog.publicEventsEnabled) {
                              continue;
                            }
                            final label = (pub.isNotEmpty && v == pub)
                                ? chrome.visibilityPublicLabel
                                : (priv.isNotEmpty && v == priv)
                                    ? chrome.visibilityPrivateLabel
                                    : chrome.emptyValue;
                            if (label.isEmpty) continue;
                            options.add(
                              ChromeSelectOption(
                                value: v,
                                label: label,
                              ),
                            );
                          }
                          if (options.isEmpty) return;
                          final picked = await showChromeOptionSheet<String>(
                            context: context,
                            title: chrome.visibilityLabel,
                            selected: _visibility,
                            options: options,
                          );
                          if (picked != null) {
                            setState(() {
                              _visibility = picked;
                              // Manual pick cancels Host CTA prefer upgrade.
                              _preferPublicPending = false;
                            });
                          }
                        },
                      ),
                      const SizedBox(height: 4),
                      Text(
                        () {
                          final pub =
                              catalog.hostedEventPublicVisibility.trim();
                          if (pub.isNotEmpty && _visibility == pub) {
                            return catalog.publicEventsEnabled
                                ? softHostingVisibilityPublicBlurb(
                                    chrome.visibilityPublicBlurb,
                                  )
                                : softHostingPublicDisabled(
                                    chrome.publicDisabled);
                          }
                          return softHostingVisibilityPrivateBlurb(
                            chrome.visibilityPrivateBlurb,
                          );
                        }(),
                        style: TextStyle(
                          color: tokens.onSurfaceMuted,
                          fontSize: 12,
                        ),
                      ),
                      if (() {
                        final pub = catalog.hostedEventPublicVisibility.trim();
                        return pub.isNotEmpty &&
                            _visibility == pub &&
                            catalog.publicEventsEnabled;
                      }()) ...[
                        const SizedBox(height: 4),
                        Text(
                          softCommunityJoinStatusMessage(
                            catalog.publicEventMatchesRated
                                ? chrome.publicRatedOnBlurb
                                : chrome.publicRatedOffBlurb,
                          ),
                          style: TextStyle(
                            color: tokens.onSurfaceMuted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ],
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(chrome.entryFreeLabel),
                      value: _freeEntry,
                      onChanged: (v) {
                        setState(() {
                          _freeEntry = v;
                          if (v) {
                            _prizePoolDisplay = false;
                            _prizePoolGuarantee = false;
                            _payoutMode = '';
                            _prizePercent1Ctrl.clear();
                            _prizePercent2Ctrl.clear();
                            _prizePercent3Ctrl.clear();
                            _quoteCommission = null;
                            _quoteNet = null;
                            _quotePercent = null;
                          }
                        });
                        if (!v) {
                          _refreshEntryFeeQuote();
                        }
                      },
                    ),
                    if (!_freeEntry) ...[
                      TextField(
                        controller: _entryFeeCtrl,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(RegExp(r'[\d.]')),
                        ],
                        decoration: InputDecoration(
                          labelText: chrome.entryFeeLabel,
                          hintText: chrome.entryFeePlaceholder,
                          border: const OutlineInputBorder(),
                        ),
                        onChanged: (_) {
                          setState(() {});
                          _refreshEntryFeeQuote();
                        },
                      ),
                      const SizedBox(height: 6),
                      if (_quotePercent != null) ...[
                        Text(
                          [
                            chrome.commissionPercentLabel,
                            chrome.metaSeparator,
                            '$_quotePercent',
                          ].join(),
                          style: TextStyle(
                            color: tokens.onSurfaceMuted,
                            fontSize: 12,
                          ),
                        ),
                        Text(
                          chrome.commissionBlurbTemplate.replaceAll(
                            '{percent}',
                            '$_quotePercent',
                          ),
                          style: TextStyle(
                            color: tokens.onSurfaceMuted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                      if (_quoteCommission != null && _quoteNet != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            [
                              chrome.paymentsCommissionLabel,
                              chrome.metaSeparator,
                              '$_quoteCommission',
                              chrome.metaSeparator,
                              chrome.paymentsOrganizerNetLabel,
                              chrome.metaSeparator,
                              '$_quoteNet',
                            ].join(),
                            style: TextStyle(
                              color: tokens.onSurfaceMuted,
                              fontSize: 12,
                              fontFeatures: const [
                                FontFeature.tabularFigures(),
                              ],
                            ),
                          ),
                        ),
                    ],
                    if (!_freeEntry && (catalog.prizePoolDisplayEnabled)) ...[
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(chrome.prizePoolDisplayLabel),
                        subtitle: Text(
                          chrome.prizePoolDisplayBlurb,
                          style: TextStyle(
                            color: tokens.onSurfaceMuted,
                            fontSize: 12,
                          ),
                        ),
                        value: _prizePoolDisplay,
                        onChanged: (v) {
                          setState(() {
                            _prizePoolDisplay = v;
                            if (!v) {
                              _prizePoolGuarantee = false;
                              _payoutMode = '';
                              _prizePercent1Ctrl.clear();
                              _prizePercent2Ctrl.clear();
                              _prizePercent3Ctrl.clear();
                            } else {
                              _applyPayoutDefaults();
                            }
                          });
                        },
                      ),
                      if (_prizePoolDisplay && _clientEnums != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          chrome.payoutModeLabel,
                          style: const TextStyle(fontWeight: FontWeight.w500),
                        ),
                        if (chrome.payoutModeBlurb.trim().isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            chrome.payoutModeBlurb,
                            style: TextStyle(
                              color: tokens.onSurfaceMuted,
                              fontSize: 12,
                            ),
                          ),
                        ],
                        const SizedBox(height: 8),
                        ChromeSelectField(
                          label: chrome.payoutModeLabel,
                          valueLabel: _payoutMode.trim().isEmpty
                              ? ''
                              : _payoutModeOptionLabel(
                                  _payoutMode.trim(),
                                  chrome,
                                ),
                          onTap: () async {
                            final fmt = (_formatId ?? '').trim();
                            final options = [
                              for (final m in payoutModeOptions(
                                _clientEnums,
                                fmt,
                              ))
                                ChromeSelectOption(
                                  value: m,
                                  label: _payoutModeOptionLabel(m, chrome),
                                ),
                            ];
                            if (options.isEmpty) return;
                            final picked = await showChromeOptionSheet<String>(
                              context: context,
                              title: chrome.payoutModeLabel,
                              selected: _payoutMode.trim().isEmpty
                                  ? null
                                  : _payoutMode.trim(),
                              options: options,
                            );
                            if (picked != null) {
                              setState(() => _payoutMode = picked);
                            }
                          },
                        ),
                        if (_placesPercentPayoutMode &&
                            chrome.prizePlacePercentsSectionLabel
                                .trim()
                                .isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Text(
                            chrome.prizePlacePercentsSectionLabel,
                            style: const TextStyle(fontWeight: FontWeight.w500),
                          ),
                          if (chrome.prizePlacePercentsBlurb.trim().isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                chrome.prizePlacePercentsBlurb,
                                style: TextStyle(
                                  color: tokens.onSurfaceMuted,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          const SizedBox(height: 8),
                          if (chrome.prizePlacePercent1Label.trim().isNotEmpty)
                            TextField(
                              controller: _prizePercent1Ctrl,
                              keyboardType:
                                  const TextInputType.numberWithOptions(
                                decimal: true,
                              ),
                              inputFormatters: [
                                FilteringTextInputFormatter.allow(
                                  RegExp(r'[\d.]'),
                                ),
                              ],
                              decoration: InputDecoration(
                                labelText: chrome.prizePlacePercent1Label,
                                hintText: chrome.prizePlacePercent1Placeholder,
                                border: const OutlineInputBorder(),
                              ),
                              onChanged: (_) {
                                if (_attempted) setState(() {});
                              },
                            ),
                          if (chrome.prizePlacePercent2Label.trim().isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: TextField(
                                controller: _prizePercent2Ctrl,
                                keyboardType:
                                    const TextInputType.numberWithOptions(
                                  decimal: true,
                                ),
                                inputFormatters: [
                                  FilteringTextInputFormatter.allow(
                                    RegExp(r'[\d.]'),
                                  ),
                                ],
                                decoration: InputDecoration(
                                  labelText: chrome.prizePlacePercent2Label,
                                  hintText:
                                      chrome.prizePlacePercent2Placeholder,
                                  border: const OutlineInputBorder(),
                                ),
                                onChanged: (_) {
                                  if (_attempted) setState(() {});
                                },
                              ),
                            ),
                          if (chrome.prizePlacePercent3Label.trim().isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: TextField(
                                controller: _prizePercent3Ctrl,
                                keyboardType:
                                    const TextInputType.numberWithOptions(
                                  decimal: true,
                                ),
                                inputFormatters: [
                                  FilteringTextInputFormatter.allow(
                                    RegExp(r'[\d.]'),
                                  ),
                                ],
                                decoration: InputDecoration(
                                  labelText: chrome.prizePlacePercent3Label,
                                  hintText:
                                      chrome.prizePlacePercent3Placeholder,
                                  border: const OutlineInputBorder(),
                                ),
                                onChanged: (_) {
                                  if (_attempted) setState(() {});
                                },
                              ),
                            ),
                          if (_attempted &&
                              placePercentsSumInvalid(
                                _prizePercent1Ctrl.text,
                                _prizePercent2Ctrl.text,
                                _prizePercent3Ctrl.text,
                              ) &&
                              chrome.errPrizePlacePercentsSum
                                  .trim()
                                  .isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              chrome.errPrizePlacePercentsSum,
                              style: TextStyle(
                                color: tokens.danger,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ],
                      ],
                      if (_prizePoolDisplay &&
                          catalog.prizePoolGuaranteeEnabled) ...[
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(chrome.prizePoolGuaranteeLabel),
                          subtitle: Text(
                            chrome.prizePoolGuaranteeBlurb,
                            style: TextStyle(
                              color: tokens.onSurfaceMuted,
                              fontSize: 12,
                            ),
                          ),
                          value: _prizePoolGuarantee,
                          onChanged: (v) =>
                              setState(() => _prizePoolGuarantee = v),
                        ),
                        if (_prizePoolGuarantee) ...[
                          const SizedBox(height: 4),
                          TextField(
                            controller: _guaranteeAmountCtrl,
                            keyboardType: const TextInputType.numberWithOptions(
                              decimal: true,
                            ),
                            inputFormatters: [
                              FilteringTextInputFormatter.allow(
                                RegExp(r'[\d.]'),
                              ),
                            ],
                            decoration: InputDecoration(
                              labelText: chrome.prizePoolGuaranteeAmountLabel,
                              hintText:
                                  chrome.prizePoolGuaranteeAmountPlaceholder,
                              border: const OutlineInputBorder(),
                            ),
                            onChanged: (_) => setState(() {}),
                          ),
                        ],
                      ],
                    ],
                    if (pay != null) ...[
                      const SizedBox(height: 8),
                      if (wallet.locating || wallet.loading)
                        Text(
                          pay.balancePending,
                          style: TextStyle(color: tokens.onSurfaceMuted),
                        )
                      else if (countryMissing)
                        Text(
                          pay.countryRequiredHint,
                          style: TextStyle(color: tokens.danger),
                        )
                      else
                        Text(
                          () {
                            if (balance == null) return pay.balancePending;
                            final cur = (wallet.walletCurrency ?? '').trim();
                            final sep = chrome.amountCurrencySeparator;
                            if (cur.isEmpty || sep.isEmpty) {
                              return pay.balancePending;
                            }
                            return '${pay.balanceLabel} $balance$sep$cur';
                          }(),
                        ),
                    ],
                    if (!canAfford && balance != null) ...[
                      KeyedSubtree(
                        key: _topUpSectionKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const SizedBox(height: 8),
                            Text(
                              () {
                                // Prefight: if fee alone fits but fee+guarantee does not, show guarantee chrome.
                                final fee = hostFee ?? 0.0;
                                final g = _prizeGuaranteeActive
                                    ? (parsePositiveDecimal(
                                            _guaranteeAmountCtrl.text) ??
                                        0.0)
                                    : 0.0;
                                if (g > 0 &&
                                    balance >= fee &&
                                    balance < fee + g) {
                                  return chrome.insufficientPrizeGuarantee;
                                }
                                return chrome.insufficientHostFee;
                              }(),
                              style: TextStyle(color: tokens.danger),
                            ),
                            if (pay != null &&
                                wallet.routeProvider != 'manual_transfer') ...[
                              const SizedBox(height: 8),
                              TextField(
                                controller: _amountCtrl,
                                keyboardType:
                                    const TextInputType.numberWithOptions(
                                  decimal: true,
                                ),
                                inputFormatters: [
                                  FilteringTextInputFormatter.allow(
                                    RegExp(r'[\d.]'),
                                  ),
                                ],
                                decoration: InputDecoration(
                                  labelText: pay.amountLabel,
                                  hintText: pay.amountPlaceholder,
                                  border: const OutlineInputBorder(),
                                ),
                                onChanged: (v) {
                                  final s = sanitizeDecimalInput(v);
                                  if (s != v) {
                                    _amountCtrl.value = TextEditingValue(
                                      text: s,
                                      selection: TextSelection.collapsed(
                                        offset: s.length,
                                      ),
                                    );
                                  }
                                  context.read<WalletCubit>().setAmountText(s);
                                  setState(() {});
                                },
                              ),
                              const SizedBox(height: 8),
                              FilledButton(
                                onPressed: wallet.loading ||
                                        wallet.country.trim().isEmpty ||
                                        parsePositiveDecimal(
                                              _amountCtrl.text,
                                            ) ==
                                            null
                                    ? null
                                    : () =>
                                        context.read<WalletCubit>().checkout(),
                                child: Text(pay.checkoutAction),
                              ),
                            ],
                            if (chrome.portalWalletHref.trim().isNotEmpty &&
                                chrome.topUpAction.trim().isNotEmpty) ...[
                              const SizedBox(height: 8),
                              OutlinedButton(
                                onPressed: () {
                                  // Web parity: portal_wallet_href + focus=topup.
                                  final href = withWalletFocusParam(
                                    chrome.portalWalletHref.trim(),
                                    'topup',
                                  );
                                  Navigator.of(context).pop();
                                  if (isWalletHrefPath(href)) {
                                    final focus =
                                        portalWalletFocusFromHref(href);
                                    final base = moneyBasePathFromHref(href);
                                    Navigator.of(context).push(
                                      MaterialPageRoute(
                                        builder: (_) => WalletPage(
                                          token: widget.accessToken,
                                          moneyBasePath: base,
                                          showOrganizerPayoutBlurb: true,
                                          focusPayout: focus.focusPayout,
                                          focusTopUp: focus.focusTopUp,
                                          focusPayoutHistoryId: focus.historyId,
                                        ),
                                      ),
                                    );
                                  } else {
                                    navigateNotificationHref(
                                      context,
                                      href: href,
                                      accessToken: widget.accessToken,
                                    );
                                  }
                                },
                                child: Text(chrome.topUpAction),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                    if (_error.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(_error, style: TextStyle(color: tokens.danger)),
                    ],
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text(
                  chrome.dialogCloseLabel.trim().isNotEmpty
                      ? chrome.dialogCloseLabel
                      : softHostingCancelAction(chrome.cancelAction),
                ),
              ),
              FilledButton(
                onPressed: _submitting
                    ? null
                    : () => _submit(context.read<WalletCubit>()),
                child: Text(
                  _submitting ? chrome.createPending : chrome.payCreateAction,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ManageEventPage extends StatefulWidget {
  const _ManageEventPage({
    required this.accessToken,
    required this.chrome,
    required this.eventId,
  });

  final String accessToken;
  final EventsOrganizerChrome chrome;
  final String eventId;

  @override
  State<_ManageEventPage> createState() => _ManageEventPageState();
}

/// Manage TabBar/IndexedStack order: overview, join, players, bracket, live, branding, payments, results.
const int _kManageLiveTabIndex = 4;

class _ManageEventPageState extends State<_ManageEventPage>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  EdgeInsets? get _pagePad => EventsDialogShell.pageInsets(
        insetH: widget.chrome.dialogShellInsetH,
        insetV: widget.chrome.dialogShellInsetV,
      );

  late final TabController _tabs;
  int _tabIndex = 0;
  HostedEvent? _event;

  /// Full unpaged roster for Results (and legacy helpers). Players/Payments use [_rosterEntries].
  List<HostedEventEntry> _entries = const [];
  List<HostedEventEntry> _rosterEntries = const [];
  SkipMeta? _rosterMeta;
  int _rosterSkip = 0;
  bool _rosterSoftFetching = false;
  double? _entryFeesGross;
  double? _entryFeesCommission;
  double? _entryFeesOrganizerNet;
  int? _entryFeesPaidCount;
  String? _entryFeesCurrency;
  List<HostedBracketMatch> _bracket = const [];
  List<HostedBracketMatch> _liveMatches = const [];
  SkipMeta? _liveMeta;
  int _liveSkip = 0;
  bool _liveSoftFetching = false;
  int? _officiallyPausedCountApi;
  List<HostedStandingRow> _standings = const [];
  bool _standingsLoading = false;
  bool _loading = true;
  bool _busy = false;
  String _error = '';
  final _titleCtrl = TextEditingController();
  final _descriptionCtrl = TextEditingController();
  final _sponsorCtrl = TextEditingController();
  final _brandColorCtrl = TextEditingController();
  final _managePct1Ctrl = TextEditingController();
  final _managePct2Ctrl = TextEditingController();
  final _managePct3Ctrl = TextEditingController();
  String _managePayoutMode = '';
  Map<String, dynamic>? _clientEnums;
  bool _publicEventsEnabled = false;
  String _privateVis = '';
  String _publicVis = '';
  String _phaseGroupId = '';
  String _phaseKnockoutId = '';
  String _phaseSwissId = '';
  String _phaseRoundRobinId = '';
  EventsCatalog? _catalog;
  bool _qrDownloading = false;
  WebSocketChannel? _flagsWs;
  StreamSubscription? _flagsSub;
  OfficialPauseChrome? _officialPauseChrome;
  Set<String> _officiallyPausedGameIds = {};
  Set<String> _liveSelectedGameIds = {};
  Map<String, GameStatePayload> _officialPauseByGameId = {};
  bool _liveOfficialPausedOnly = false;
  String _activityGameId = '';
  List<Map<String, dynamic>> _pauseActivity = const [];
  Timer? _officialPausePoll;
  MediaUploadChrome? _dropzoneChrome;
  String _prizeMediaUploadSlot = '';

  /// Stop poll/setState while the route exit animation runs (web manage close parity).
  bool _closing = false;

  bool get _prizeMediaChromeReady {
    final c = widget.chrome;
    return c.isPrizeMediaChromeComplete && _dropzoneChrome != null;
  }

  bool get _managePlacesPercentMode {
    final places =
        (_clientEnums?['competition_payout_mode_places_percent'] as String?)
                ?.trim() ??
            '';
    final dual =
        (_clientEnums?['competition_payout_mode_dual_purse'] as String?)
                ?.trim() ??
            '';
    final mode = _managePayoutMode.trim();
    return (places.isNotEmpty && mode == places) ||
        (dual.isNotEmpty && mode == dual);
  }

  String _managePayoutModeOptionLabel(
    String value,
    EventsOrganizerChrome chrome,
  ) {
    final enums = _clientEnums;
    if (enums == null) return value;
    final places =
        (enums['competition_payout_mode_places_percent'] as String?)?.trim() ??
            '';
    final score =
        (enums['competition_payout_mode_score_share'] as String?)?.trim() ?? '';
    final dual =
        (enums['competition_payout_mode_dual_purse'] as String?)?.trim() ?? '';
    if (value == places && chrome.payoutModePlacesPercentLabel.isNotEmpty) {
      return chrome.payoutModePlacesPercentLabel;
    }
    if (value == score && chrome.payoutModeScoreShareLabel.isNotEmpty) {
      return chrome.payoutModeScoreShareLabel;
    }
    if (value == dual && chrome.payoutModeDualPurseLabel.isNotEmpty) {
      return chrome.payoutModeDualPurseLabel;
    }
    return value;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _tabs = TabController(length: 8, vsync: this);
    _tabIndex = _tabs.index;
    _tabs.addListener(() {
      if (!mounted || _closing || _tabs.indexIsChanging) return;
      if (_tabIndex == _tabs.index) return;
      setState(() => _tabIndex = _tabs.index);
    });
    _load();
    unawaited(_loadMediaUploadChrome());
    unawaited(_listenFeatureFlags());
    // Cross-operator pause/resume/meta: poll while manage is open (admin control room cadence).
    _officialPausePoll = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted || _closing) return;
      if (_tabIndex == _kManageLiveTabIndex) {
        unawaited(_loadLiveBoardsPage(skip: _liveSkip));
        return;
      }
      if (_bracket.isEmpty) return;
      unawaited(_refreshOfficialPauseStates(_bracket));
    });
  }

  void _beginClose() {
    if (_closing) return;
    _closing = true;
    _officialPausePoll?.cancel();
    _officialPausePoll = null;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(_reloadPublicGate());
      if (_tabIndex == _kManageLiveTabIndex) {
        unawaited(_loadLiveBoardsPage(skip: _liveSkip));
      } else if (_bracket.isNotEmpty) {
        unawaited(_refreshOfficialPauseStates(_bracket));
      }
    }
  }

  Future<void> _reloadPublicGate() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/catalog'),
      );
      if (!mounted || res.statusCode >= 300) return;
      final cat = EventsCatalog.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      if (!mounted) return;
      setState(() {
        _catalog = cat;
        _publicEventsEnabled = cat.publicEventsEnabled;
        _privateVis = cat.hostedEventPrivateVisibility.trim();
        _publicVis = cat.hostedEventPublicVisibility.trim();
      });
    } catch (_) {}
  }

  Future<void> _listenFeatureFlags() async {
    await _flagsSub?.cancel();
    await _flagsWs?.sink.close();
    _flagsWs = null;
    _flagsSub = null;
    final token = widget.accessToken.trim();
    if (token.isEmpty) return;
    try {
      final origin = ApiConfig.baseUrl.replaceFirst(RegExp(r'^http'), 'ws');
      final uri = Uri.parse(
        '$origin/ws/matchmaking?token=${Uri.encodeComponent(token)}',
      );
      _flagsWs = WebSocketChannel.connect(uri);
      _flagsSub = _flagsWs!.stream.listen((event) {
        if (event is! String) return;
        try {
          final msg = jsonDecode(event) as Map<String, dynamic>;
          if (msg['type'] != 'feature_flags') return;
          unawaited(_reloadPublicGate());
        } catch (_) {}
      });
    } catch (_) {}
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _officialPausePoll?.cancel();
    _officialPausePoll = null;
    final sub = _flagsSub;
    final ws = _flagsWs;
    _flagsSub = null;
    _flagsWs = null;
    unawaited(sub?.cancel() ?? Future<void>.value());
    unawaited(ws?.sink.close() ?? Future<void>.value());
    _tabs.dispose();
    _titleCtrl.dispose();
    _descriptionCtrl.dispose();
    _sponsorCtrl.dispose();
    _brandColorCtrl.dispose();
    _managePct1Ctrl.dispose();
    _managePct2Ctrl.dispose();
    _managePct3Ctrl.dispose();
    super.dispose();
  }

  Map<String, String> get _authHeaders => {
        'Authorization': 'Bearer ${widget.accessToken}',
      };

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final id = widget.eventId;
      final results = await Future.wait([
        http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/events/$id'),
          headers: _authHeaders,
        ),
        http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/events/$id/entries'),
          headers: _authHeaders,
        ),
        http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/events/$id/bracket'),
        ),
        http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/events/$id/standings'),
        ),
        http.get(Uri.parse('${ApiConfig.baseUrl}/api/v1/events/catalog')),
        http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/platform/enums'),
          headers: _authHeaders,
        ),
      ]);
      if (!mounted) return;
      if (results[0].statusCode >= 300) {
        setState(() {
          _loading = false;
          _error = softHostingFeatureDisabled(widget.chrome.featureDisabled);
        });
        return;
      }
      final ev = HostedEvent.fromJson(
        jsonDecode(results[0].body) as Map<String, dynamic>,
      );
      Map<String, dynamic>? enums;
      if (results[5].statusCode < 300) {
        final raw = jsonDecode(results[5].body);
        if (raw is Map<String, dynamic>) enums = raw;
      }
      List<HostedEventEntry> entries = const [];
      if (results[1].statusCode < 300) {
        final body = jsonDecode(results[1].body);
        final list = body is Map
            ? (body['entries'] as List<dynamic>? ?? const [])
            : (body is List ? body : const []);
        entries = list
            .whereType<Map<String, dynamic>>()
            .map(HostedEventEntry.fromJson)
            .toList();
      }
      List<HostedBracketMatch> bracket = const [];
      if (results[2].statusCode < 300) {
        final body = jsonDecode(results[2].body) as Map<String, dynamic>;
        bracket = (body['bracket'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(HostedBracketMatch.fromJson)
            .toList();
      }
      List<HostedStandingRow> standings = const [];
      if (results[3].statusCode < 300) {
        final body = jsonDecode(results[3].body) as Map<String, dynamic>;
        standings = (body['standings'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(HostedStandingRow.fromJson)
            .toList();
      }
      var publicEnabled = false;
      var privateVis = '';
      var publicVis = '';
      var phaseGroup = '';
      var phaseKo = '';
      var phaseSwiss = '';
      var phaseRr = '';
      EventsCatalog? catalog;
      if (results[4].statusCode < 300) {
        final cat = EventsCatalog.fromJson(
          jsonDecode(results[4].body) as Map<String, dynamic>,
        );
        catalog = cat;
        publicEnabled = cat.publicEventsEnabled;
        privateVis = cat.hostedEventPrivateVisibility.trim();
        publicVis = cat.hostedEventPublicVisibility.trim();
        phaseGroup = cat.hostedEventPhaseGroup.trim();
        phaseKo = cat.hostedEventPhaseKnockout.trim();
        phaseSwiss = cat.hostedEventPhaseSwiss.trim();
        phaseRr = cat.hostedEventPhaseRoundRobin.trim();
      }
      _titleCtrl.text = ev.title;
      _descriptionCtrl.text = ev.description;
      _sponsorCtrl.text = ev.sponsorName ?? '';
      _brandColorCtrl.text = ev.brandColor ?? '';
      _managePayoutMode = ev.prizePayoutMode.trim();
      final pp = ev.prizePlacePercents;
      _managePct1Ctrl.text = pp['1'] != null ? '${pp['1']}' : '';
      _managePct2Ctrl.text = pp['2'] != null ? '${pp['2']}' : '';
      _managePct3Ctrl.text = pp['3'] != null ? '${pp['3']}' : '';
      setState(() {
        _event = ev;
        _clientEnums = enums;
        _entries = entries;
        _bracket = bracket;
        _standings = standings;
        _standingsLoading = false;
        _publicEventsEnabled = publicEnabled;
        _privateVis = privateVis;
        _publicVis = publicVis;
        _phaseGroupId = phaseGroup;
        _phaseKnockoutId = phaseKo;
        _phaseSwissId = phaseSwiss;
        _phaseRoundRobinId = phaseRr;
        _catalog = catalog;
        _loading = false;
      });
      unawaited(_ensureOfficialPauseChrome());
      unawaited(_refreshOfficialPauseStates(bracket));
      unawaited(_loadRosterPage(skip: _rosterSkip));
      unawaited(_loadLiveBoardsPage(skip: _liveSkip));
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = softHostingFeatureDisabled(widget.chrome.featureDisabled);
      });
    }
  }

  Future<void> _loadRosterPage({int? skip}) async {
    final limit = widget.chrome.listPageSizeInt;
    if (limit < 1) return;
    final nextSkip = skip ?? _rosterSkip;
    if (skip != null) _rosterSkip = nextSkip;
    if (mounted) setState(() => _rosterSoftFetching = true);
    try {
      final id = widget.eventId;
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/$id/entries').replace(
          queryParameters: {
            'skip': '$nextSkip',
            'limit': '$limit',
          },
        ),
        headers: _authHeaders,
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        setState(() => _rosterSoftFetching = false);
        return;
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final metaRaw = body['meta'];
      if (metaRaw is! Map<String, dynamic> || !_apiSkipMetaReady(metaRaw)) {
        setState(() => _rosterSoftFetching = false);
        return;
      }
      if (body['entries'] is! List ||
          body['entry_fees_gross'] is! num ||
          body['entry_fees_commission'] is! num ||
          body['entry_fees_organizer_net'] is! num ||
          body['entry_fees_paid_count'] is! num ||
          body['entry_fees_currency'] is! String) {
        setState(() => _rosterSoftFetching = false);
        return;
      }
      final list = (body['entries'] as List<dynamic>)
          .whereType<Map<String, dynamic>>()
          .map(HostedEventEntry.fromJson)
          .toList();
      final meta = SkipMeta.fromJson(metaRaw);
      setState(() {
        _rosterEntries = list;
        _rosterMeta = meta;
        _rosterSkip = nextSkip;
        _entryFeesGross = (body['entry_fees_gross'] as num).toDouble();
        _entryFeesCommission =
            (body['entry_fees_commission'] as num).toDouble();
        _entryFeesOrganizerNet =
            (body['entry_fees_organizer_net'] as num).toDouble();
        _entryFeesPaidCount = (body['entry_fees_paid_count'] as num).toInt();
        _entryFeesCurrency = (body['entry_fees_currency'] as String).trim();
        _rosterSoftFetching = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _rosterSoftFetching = false);
    }
  }

  Future<void> _loadLiveBoardsPage({int? skip}) async {
    final limit = widget.chrome.listPageSizeInt;
    if (limit < 1) return;
    final nextSkip = skip ?? _liveSkip;
    if (skip != null) _liveSkip = nextSkip;
    if (mounted) setState(() => _liveSoftFetching = true);
    try {
      final id = widget.eventId;
      final params = <String, String>{
        'skip': '$nextSkip',
        'limit': '$limit',
      };
      if (_liveOfficialPausedOnly) params['official_only'] = '1';
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/$id/live-boards')
            .replace(queryParameters: params),
        headers: _authHeaders,
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        setState(() => _liveSoftFetching = false);
        return;
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final metaRaw = body['meta'];
      if (metaRaw is! Map<String, dynamic> ||
          !_apiSkipMetaReady(metaRaw) ||
          body['matches'] is! List ||
          body['officially_paused_count'] is! num) {
        setState(() => _liveSoftFetching = false);
        return;
      }
      final matches = (body['matches'] as List<dynamic>)
          .whereType<Map<String, dynamic>>()
          .map(HostedBracketMatch.fromJson)
          .toList();
      final meta = SkipMeta.fromJson(metaRaw);
      final pausedCount = (body['officially_paused_count'] as num).toInt();
      setState(() {
        _liveMatches = matches;
        _liveMeta = meta;
        _liveSkip = nextSkip;
        _officiallyPausedCountApi = pausedCount;
        _liveSoftFetching = false;
      });
      unawaited(_refreshOfficialPauseStates(matches));
    } catch (_) {
      if (!mounted) return;
      setState(() => _liveSoftFetching = false);
    }
  }

  Future<void> _toast(String msg) async {
    if (!mounted || msg.isEmpty) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  /// Fail-closed: map error_key → organizer chrome, else fallback (never API English invent).
  Future<String> _apiError(http.Response res, String fallback) async {
    try {
      final decoded = jsonDecode(res.body);
      if (decoded is Map) {
        final key = (decoded['error_key'] as String?)?.trim() ?? '';
        if (key.isNotEmpty) {
          // Prefer keyed chrome fields over toast invent (start-cup / reopen parity).
          final chrome = widget.chrome;
          final mapped = switch (key) {
            'not_enough_players' => chrome.notEnoughPlayers.trim(),
            'already_started' => chrome.alreadyStarted.trim(),
            'format_unavailable' => chrome.formatUnavailable.trim(),
            'err_host_guarantee_requires_document_kyc' =>
              chrome.errHostGuaranteeRequiresDocumentKyc.trim(),
            'err_host_paid_requires_phone_kyc' =>
              chrome.errHostPaidRequiresPhoneKyc.trim(),
            'err_host_concurrent_open_paid_cap' =>
              chrome.errHostConcurrentOpenPaidCap.trim(),
            'err_host_reputation_blocked' =>
              chrome.errHostReputationBlocked.trim(),
            'insufficient_prize_guarantee' =>
              chrome.insufficientPrizeGuarantee.trim(),
            'err_reopen_guarantee_hold_failed' =>
              chrome.insufficientPrizeGuarantee.trim(),
            'insufficient_host_fee' => chrome.insufficientHostFee.trim(),
            _ => '',
          };
          if (mapped.isNotEmpty) return mapped;
        }
      }
    } catch (_) {}
    return fallback;
  }

  /// Official pause/resume/meta: map error_key via ops chrome, else toast fallback.
  Future<String> _officialPauseApiError(
    http.Response res,
    OfficialPauseChrome? ops,
    String fallback,
  ) async {
    try {
      final decoded = jsonDecode(res.body);
      if (decoded is Map) {
        final key = (decoded['error_key'] as String?)?.trim() ?? '';
        if (key.isNotEmpty && ops != null) {
          final mapped = ops.labelForErrorKey(key).trim();
          if (mapped.isNotEmpty) return mapped;
        }
      }
    } catch (_) {}
    return fallback;
  }

  Future<void> _copy(String value) async {
    final chrome = widget.chrome;
    final next = value.trim();
    if (next.isEmpty ||
        RegExp(r'^https?:\/\/[^/]+\/?$', caseSensitive: false).hasMatch(next)) {
      await _toast(chrome.toastCopyFailed);
      return;
    }
    try {
      await Clipboard.setData(ClipboardData(text: next));
      await _toast(chrome.copiedBlurb);
    } catch (_) {
      await _toast(chrome.toastCopyFailed);
    }
  }

  Future<void> _downloadQr() async {
    final chrome = widget.chrome;
    final ev = _event;
    if (ev == null) return;
    setState(() => _qrDownloading = true);
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/${ev.id}/qr.png'),
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      if (res.statusCode != 200) throw Exception('qr');
      final cd = res.headers['content-disposition'] ?? '';
      final match = RegExp(
        r'filename="?([^";]+)"?',
        caseSensitive: false,
      ).firstMatch(cd);
      final filename = (match?.group(1) ?? '').trim();
      if (filename.isEmpty) throw Exception('qr filename');
      await shareBytesAsFile(
        bytes: res.bodyBytes,
        filename: filename,
        mimeType: 'image/png',
      );
    } catch (_) {
      await _toast(chrome.toastQrDownloadFailed.isNotEmpty
          ? chrome.toastQrDownloadFailed
          : chrome.qrUnavailable);
    } finally {
      if (mounted) setState(() => _qrDownloading = false);
    }
  }

  Future<void> _patch({String? visibility, bool payoutOnly = false}) async {
    final chrome = widget.chrome;
    final ev = _event;
    if (ev == null) return;
    setState(() => _busy = true);
    try {
      final body = <String, dynamic>{};
      if (payoutOnly) {
        final mode = _managePayoutMode.trim();
        if (mode.isEmpty) {
          setState(() => _busy = false);
          return;
        }
        body['prize_payout_mode'] = mode;
        if (_managePlacesPercentMode) {
          if (placePercentsSumInvalid(
            _managePct1Ctrl.text,
            _managePct2Ctrl.text,
            _managePct3Ctrl.text,
          )) {
            final msg = chrome.errPrizePlacePercentsSum.trim();
            if (msg.isNotEmpty) await _toast(msg);
            setState(() => _busy = false);
            return;
          }
          final percents = buildPlacePercentsMap(
            _managePct1Ctrl.text,
            _managePct2Ctrl.text,
            _managePct3Ctrl.text,
          );
          if (percents == null) {
            setState(() => _busy = false);
            return;
          }
          body['prize_place_percents'] = percents;
        } else {
          body['prize_place_percents'] = <String, num>{};
        }
      } else {
        if (visibility != null && visibility.trim().isNotEmpty) {
          body['visibility'] = visibility.trim();
        }
        final defStatus = (_catalog?.hostedEventDefaultStatus ?? '').trim();
        // Fail-closed: missing catalog default status locks title (no invent unlock).
        final titleLocked = defStatus.isEmpty || ev.status.trim() != defStatus;
        final title = _titleCtrl.text.trim();
        if (!titleLocked && title.isNotEmpty && title != ev.title) {
          body['title'] = title;
        }
        final sponsor = _sponsorCtrl.text.trim();
        body['sponsor_name'] = sponsor;
        body['description'] = _descriptionCtrl.text.trim();
        final color = _brandColorCtrl.text.trim();
        if (color.isNotEmpty) body['brand_color'] = color;
      }
      final res = await http.patch(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/${ev.id}'),
        headers: {
          ..._authHeaders,
          'Content-Type': 'application/json',
        },
        body: jsonEncode(body),
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        await _toast(
          await _apiError(
              res, softHostingToastSaveFailed(chrome.toastSaveFailed)),
        );
        setState(() => _busy = false);
        return;
      }
      await _toast(softHostingToastSaved(chrome.toastSaved));
      setState(() => _busy = false);
      await _load();
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
      await _toast(softHostingToastSaveFailed(chrome.toastSaveFailed));
    }
  }

  Future<void> _upload(String path, {required bool sponsor}) async {
    final chrome = widget.chrome;
    final ev = _event;
    if (ev == null) return;
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery);
    if (file == null) return;
    setState(() => _busy = true);
    try {
      final req = http.MultipartRequest(
        'POST',
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/${ev.id}/$path'),
      );
      req.headers['Authorization'] = 'Bearer ${widget.accessToken}';
      req.files.add(await http.MultipartFile.fromPath('file', file.path));
      final streamed = await req.send();
      final res = await http.Response.fromStream(streamed);
      if (!mounted) return;
      if (res.statusCode >= 300) {
        await _toast(
          await _apiError(
            res,
            sponsor
                ? softHostingUploadSponsorFailed(chrome.uploadSponsorFailed)
                : softHostingUploadLogoFailed(chrome.uploadLogoFailed),
          ),
        );
        setState(() => _busy = false);
        return;
      }
      await _toast(softHostingToastSaved(chrome.toastSaved));
      setState(() => _busy = false);
      await _load();
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
      await _toast(
        sponsor
            ? softHostingUploadSponsorFailed(chrome.uploadSponsorFailed)
            : softHostingUploadLogoFailed(chrome.uploadLogoFailed),
      );
    }
  }

  Future<void> _loadMediaUploadChrome() async {
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

  String _prizeMediaFailureMessage({String? apiError}) {
    final chrome = widget.chrome;
    final key = (apiError ?? '').trim();
    if (key == 'gallery_limit_reached' &&
        chrome.galleryLimitReached.isNotEmpty) {
      return chrome.galleryLimitReached;
    }
    return chrome.mediaUploadFailed;
  }

  Future<void> _uploadPrizeImage(XFile file) async {
    final chrome = widget.chrome;
    final ev = _event;
    if (ev == null || !_prizeMediaChromeReady) return;
    setState(() {
      _busy = true;
      _prizeMediaUploadSlot = 'prize';
    });
    try {
      final req = http.MultipartRequest(
        'POST',
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/${ev.id}/prize-image'),
      );
      req.headers['Authorization'] = 'Bearer ${widget.accessToken}';
      req.files.add(await http.MultipartFile.fromPath(
        'file',
        file.path,
        contentType: MediaType('image', 'jpeg'),
        filename: file.name,
      ));
      final streamed = await req.send();
      final res = await http.Response.fromStream(streamed);
      if (!mounted) return;
      if (res.statusCode < 300) {
        await _toast(chrome.toastThumbnailSaved);
        await _load();
      } else {
        var errKey = '';
        try {
          final decoded = jsonDecode(res.body);
          if (decoded is Map) {
            errKey = (decoded['error'] as String?)?.trim() ??
                (decoded['error_key'] as String?)?.trim() ??
                '';
          }
        } catch (_) {}
        await _toast(
          await _apiError(
            res,
            _prizeMediaFailureMessage(apiError: errKey),
          ),
        );
      }
    } catch (_) {
      if (mounted) await _toast(_prizeMediaFailureMessage());
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _prizeMediaUploadSlot = '';
        });
      }
    }
  }

  Future<void> _clearPrizeImage() async {
    final chrome = widget.chrome;
    final ev = _event;
    if (ev == null || !_prizeMediaChromeReady) return;
    setState(() {
      _busy = true;
      _prizeMediaUploadSlot = 'prize';
    });
    try {
      final res = await http.delete(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/${ev.id}/prize-image'),
        headers: _authHeaders,
      );
      if (!mounted) return;
      if (res.statusCode < 300) {
        await _toast(chrome.toastThumbnailSaved);
        await _load();
      } else {
        await _toast(
          await _apiError(res, _prizeMediaFailureMessage()),
        );
      }
    } catch (_) {
      if (mounted) await _toast(_prizeMediaFailureMessage());
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _prizeMediaUploadSlot = '';
        });
      }
    }
  }

  Future<void> _uploadEventGallery(List<XFile> files) async {
    final chrome = widget.chrome;
    final ev = _event;
    if (ev == null || !_prizeMediaChromeReady || files.isEmpty) return;
    setState(() {
      _busy = true;
      _prizeMediaUploadSlot = 'gallery';
    });
    try {
      var ok = true;
      String? errKey;
      for (final file in files) {
        final req = http.MultipartRequest(
          'POST',
          Uri.parse('${ApiConfig.baseUrl}/api/v1/events/${ev.id}/gallery'),
        );
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
            if (decoded is Map) {
              errKey = (decoded['error'] as String?)?.trim() ??
                  (decoded['error_key'] as String?)?.trim();
            }
          } catch (_) {}
          break;
        }
      }
      if (!mounted) return;
      if (ok) {
        await _toast(chrome.toastGallerySaved);
        await _load();
      } else {
        await _toast(_prizeMediaFailureMessage(apiError: errKey));
      }
    } catch (_) {
      if (mounted) await _toast(_prizeMediaFailureMessage());
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _prizeMediaUploadSlot = '';
        });
      }
    }
  }

  Future<void> _removeEventGalleryAt(int index) async {
    final chrome = widget.chrome;
    final ev = _event;
    if (ev == null || !_prizeMediaChromeReady || index < 0) return;
    setState(() {
      _busy = true;
      _prizeMediaUploadSlot = 'gallery';
    });
    try {
      final res = await http.delete(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/events/${ev.id}/gallery/$index',
        ),
        headers: _authHeaders,
      );
      if (!mounted) return;
      if (res.statusCode < 300) {
        await _toast(chrome.toastGallerySaved);
        await _load();
      } else {
        await _toast(
          await _apiError(res, _prizeMediaFailureMessage()),
        );
      }
    } catch (_) {
      if (mounted) await _toast(_prizeMediaFailureMessage());
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _prizeMediaUploadSlot = '';
        });
      }
    }
  }

  Future<void> _entryAction(String userId, String action) async {
    final chrome = widget.chrome;
    final ev = _event;
    if (ev == null) return;
    // Product: joins are always auto-approved. Only kick (with refund) is allowed.
    if (action != 'kick') return;
    setState(() => _busy = true);
    try {
      final res = await http.post(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/events/${ev.id}/entries/$userId/kick',
        ),
        headers: _authHeaders,
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        await _toast(
          await _apiError(
              res, softHostingToastSaveFailed(chrome.toastSaveFailed)),
        );
      }
      setState(() => _busy = false);
      await _load();
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
    }
  }

  Future<void> _start() async {
    final chrome = widget.chrome;
    final ev = _event;
    if (ev == null) return;
    setState(() => _busy = true);
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/${ev.id}/start'),
        headers: _authHeaders,
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        // Fail closed: keyed chrome (e.g. not_enough_players) or toast_start_failed.
        await _toast(await _apiError(res, chrome.toastStartFailed.trim()));
        setState(() => _busy = false);
        return;
      }
      await _toast(softHostingToastStarted(chrome.toastStarted));
      setState(() => _busy = false);
      await _load();
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
      await _toast(chrome.toastStartFailed.trim());
    }
  }

  bool _isArenaCup(HostedEvent ev) {
    final fromEnums = tournamentFormatIsArena(ev.formatId, _clientEnums);
    final arenaId = (_catalog?.hostedEventArenaFormat ?? '').trim();
    final fromCatalog = arenaId.isNotEmpty && ev.formatId.trim() == arenaId;
    if (fromEnums || fromCatalog) return true;
    // Arena clock is set only for Arena starts.
    return (ev.arenaEndsAt ?? '').trim().isNotEmpty;
  }

  String _arenaFinishBlocked(HostedEvent ev) {
    final chrome = widget.chrome;
    if ((ev.finishedAt ?? '').trim().isNotEmpty) {
      return chrome.arenaFinishAlreadyFinished;
    }
    if ((ev.startedAt ?? '').trim().isEmpty) {
      return chrome.arenaFinishRequiresStarted;
    }
    return '';
  }

  Future<void> _finishArena() async {
    final chrome = widget.chrome;
    final ev = _event;
    if (ev == null) return;
    final blocked = _arenaFinishBlocked(ev);
    if (blocked.isNotEmpty) {
      await _toast(blocked);
      return;
    }
    setState(() => _busy = true);
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/${ev.id}/arena/finish'),
        headers: _authHeaders,
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        await _toast(await _apiError(res, chrome.toastArenaFinishFailed));
        setState(() => _busy = false);
        return;
      }
      if (chrome.toastArenaFinished.isNotEmpty) {
        await _toast(chrome.toastArenaFinished);
      }
      setState(() => _busy = false);
      await _load();
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
      if (chrome.toastArenaFinishFailed.isNotEmpty) {
        await _toast(chrome.toastArenaFinishFailed);
      }
    }
  }

  Future<void> _cancel() async {
    final chrome = widget.chrome;
    final ev = _event;
    if (ev == null) return;
    setState(() => _busy = true);
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/${ev.id}/close'),
        headers: _authHeaders,
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        final msg = await _apiError(
            res, softHostingToastCloseFailed(chrome.toastCloseFailed));
        if (msg.isNotEmpty) await _toast(msg);
        setState(() => _busy = false);
        return;
      }
      final closed = softHostingToastClosed(chrome.toastClosed);
      if (closed.isNotEmpty) {
        await _toast(closed);
      }
      setState(() => _busy = false);
      if (mounted) Navigator.of(context).pop();
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
    }
  }

  Future<void> _reopen() async {
    final chrome = widget.chrome;
    final ev = _event;
    if (ev == null) return;
    setState(() => _busy = true);
    try {
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/${ev.id}/reopen'),
        headers: _authHeaders,
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        var key = '';
        try {
          final decoded = jsonDecode(res.body);
          if (decoded is Map) {
            key = (decoded['error_key'] as String?)?.trim() ?? '';
          }
        } catch (_) {}
        final walletShortfall = key == 'insufficient_host_fee' ||
            key == 'insufficient_prize_guarantee' ||
            key == 'err_reopen_guarantee_hold_failed';
        final msg = await _apiError(
            res, softHostingToastReopenFailed(chrome.toastReopenFailed));
        if (msg.isNotEmpty) {
          final topUp = chrome.topUpAction.trim();
          final href =
              withWalletFocusParam(chrome.portalWalletHref.trim(), 'topup');
          if (walletShortfall && topUp.isNotEmpty && href.isNotEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(msg),
                action: SnackBarAction(
                  label: topUp,
                  onPressed: () {
                    if (isWalletHrefPath(href)) {
                      final focus = portalWalletFocusFromHref(href);
                      final base = moneyBasePathFromHref(href);
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => WalletPage(
                            token: widget.accessToken,
                            moneyBasePath: base,
                            showOrganizerPayoutBlurb: true,
                            focusPayout: focus.focusPayout,
                            focusTopUp: focus.focusTopUp,
                            focusPayoutHistoryId: focus.historyId,
                          ),
                        ),
                      );
                    } else {
                      navigateNotificationHref(
                        context,
                        href: href,
                        accessToken: widget.accessToken,
                      );
                    }
                  },
                ),
              ),
            );
          } else {
            await _toast(msg);
          }
        }
        setState(() => _busy = false);
        return;
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      setState(() {
        _event = HostedEvent.fromJson(body);
        _busy = false;
      });
      final reopened = softHostingToastReopened(chrome.toastReopened);
      if (reopened.isNotEmpty) {
        await _toast(reopened);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
      if (softHostingToastReopenFailed(chrome.toastReopenFailed).isNotEmpty) {
        await _toast(softHostingToastReopenFailed(chrome.toastReopenFailed));
      }
    }
  }

  Future<void> _forfeitMatch(
      HostedBracketMatch match, String loserUserId) async {
    final chrome = widget.chrome;
    final ev = _event;
    final uid = loserUserId.trim();
    if (ev == null || uid.isEmpty) return;
    setState(() => _busy = true);
    try {
      final res = await http.post(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/events/${ev.id}/bracket/${match.id}/forfeit',
        ),
        headers: _authHeaders,
        body: jsonEncode({'user_id': uid}),
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        await _toast(await _apiError(res, chrome.toastForfeitFailed));
        setState(() => _busy = false);
        return;
      }
      setState(() => _busy = false);
      await _load();
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
      if (chrome.toastForfeitFailed.isNotEmpty) {
        await _toast(chrome.toastForfeitFailed);
      }
    }
  }

  Future<void> _rematchMatch(HostedBracketMatch match) async {
    final chrome = widget.chrome;
    final ev = _event;
    if (ev == null) return;
    setState(() => _busy = true);
    try {
      final res = await http.post(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/events/${ev.id}/bracket/${match.id}/rematch',
        ),
        headers: _authHeaders,
        body: '{}',
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        await _toast(await _apiError(res, chrome.toastRematchFailed));
        setState(() => _busy = false);
        return;
      }
      setState(() => _busy = false);
      await _load();
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
      if (chrome.toastRematchFailed.isNotEmpty) {
        await _toast(chrome.toastRematchFailed);
      }
    }
  }

  Future<OfficialPauseChrome?> _ensureOfficialPauseChrome() async {
    final cached = _officialPauseChrome;
    if (cached != null && cached.isReady) return cached;
    try {
      final res = await http.get(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/public/official-pause-chrome',
        ),
      );
      Map<String, dynamic>? map;
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) map = decoded;
      } catch (_) {}
      final chrome = OfficialPauseChrome.fromJson(map);
      if (!mounted) return chrome;
      setState(() => _officialPauseChrome = chrome);
      return chrome;
    } catch (_) {
      return null;
    }
  }

  Future<void> _refreshOfficialPauseStates(
      List<HostedBracketMatch> bracket) async {
    if (_closing) return;
    final ids = <String>{};
    for (final m in bracket) {
      final gid = (m.gameId ?? '').trim();
      if (gid.isEmpty || m.isBye || (m.finishedAt ?? '').trim().isNotEmpty) {
        continue;
      }
      ids.add(gid);
    }
    if (ids.isEmpty) {
      if (!mounted || _closing) return;
      setState(() {
        _officiallyPausedGameIds = {};
        _officialPauseByGameId = {};
        _pauseActivity = const [];
      });
      return;
    }
    final paused = <String>{};
    final byId = <String, GameStatePayload>{};
    await Future.wait(ids.map((gid) async {
      try {
        final res = await http.get(
          Uri.parse(
            '${ApiConfig.baseUrl}/api/v1/games/${Uri.encodeComponent(gid)}/state',
          ),
          headers: _authHeaders,
        );
        if (res.statusCode >= 300) return;
        final map = jsonDecode(res.body);
        if (map is! Map<String, dynamic>) return;
        final payload = GameStatePayload.fromJson(map);
        byId[gid] = payload;
        if (payload.isOfficialPause) paused.add(gid);
      } catch (_) {}
    }));
    if (!mounted || _closing) return;
    final activityId = paused.isNotEmpty
        ? paused.first
        : (_activityGameId.isNotEmpty && ids.contains(_activityGameId)
            ? _activityGameId
            : ids.first);
    setState(() {
      _officiallyPausedGameIds = paused;
      _officialPauseByGameId = byId;
      _activityGameId = activityId;
    });
    await _loadPauseActivity(activityId);
  }

  Future<void> _loadPauseActivity(String gameId) async {
    final gid = gameId.trim();
    if (gid.isEmpty) return;
    try {
      final res = await http.get(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/games/${Uri.encodeComponent(gid)}/official-pause-events',
        ),
        headers: _authHeaders,
      );
      if (!mounted || res.statusCode >= 300) return;
      final map = jsonDecode(res.body);
      if (map is! Map<String, dynamic>) return;
      final raw = map['events'];
      final events = <Map<String, dynamic>>[];
      if (raw is List) {
        for (final item in raw) {
          if (item is Map<String, dynamic>) events.add(item);
        }
      }
      setState(() => _pauseActivity = events);
    } catch (_) {}
  }

  Future<void> _officialPauseMatch(HostedBracketMatch match) async {
    final chrome = widget.chrome;
    final gid = (match.gameId ?? '').trim();
    if (gid.isEmpty || chrome.officialPauseAction.trim().isEmpty) return;
    final ops = await _ensureOfficialPauseChrome();
    if (!mounted) return;
    if (ops == null || !ops.isReady) {
      final msg = (ops?.unavailable ?? '').trim();
      if (msg.isNotEmpty) await _toast(msg);
      return;
    }
    final choice = await showOfficialPauseDialog(
      context,
      chrome: ops,
      mode: OfficialPauseDialogMode.pause,
    );
    if (choice == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final body = <String, dynamic>{'reason_key': choice.reasonKey};
      if (choice.note.isNotEmpty) body['note'] = choice.note;
      final res = await http.post(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/games/${Uri.encodeComponent(gid)}/official-pause',
        ),
        headers: _authHeaders,
        body: jsonEncode(body),
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        await _toast(
          await _officialPauseApiError(
              res, ops, chrome.toastOfficialPauseFailed),
        );
        setState(() => _busy = false);
        return;
      }
      setState(() {
        _busy = false;
        _officiallyPausedGameIds = {..._officiallyPausedGameIds, gid};
        _activityGameId = gid;
      });
      unawaited(_refreshOfficialPauseStates(_bracket));
      unawaited(_loadLiveBoardsPage(skip: _liveSkip));
      if (chrome.toastOfficialPaused.isNotEmpty) {
        await _toast(chrome.toastOfficialPaused);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
      if (chrome.toastOfficialPauseFailed.isNotEmpty) {
        await _toast(chrome.toastOfficialPauseFailed);
      }
    }
  }

  Future<void> _officialResumeMatch(HostedBracketMatch match) async {
    final chrome = widget.chrome;
    final gid = (match.gameId ?? '').trim();
    if (gid.isEmpty || chrome.officialResumeAction.trim().isEmpty) return;
    final ops = await _ensureOfficialPauseChrome();
    if (!mounted) return;
    if (ops == null || !ops.isReady) {
      final msg = (ops?.unavailable ?? '').trim();
      if (msg.isNotEmpty) await _toast(msg);
      return;
    }
    final choice = await showOfficialPauseDialog(
      context,
      chrome: ops,
      mode: OfficialPauseDialogMode.resume,
    );
    if (choice == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final body = <String, dynamic>{};
      if (choice.note.isNotEmpty) body['note'] = choice.note;
      final res = await http.post(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/games/${Uri.encodeComponent(gid)}/official-resume',
        ),
        headers: _authHeaders,
        body: jsonEncode(body),
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        await _toast(
          await _officialPauseApiError(
              res, ops, chrome.toastOfficialResumeFailed),
        );
        setState(() => _busy = false);
        return;
      }
      setState(() {
        _busy = false;
        _officiallyPausedGameIds = {..._officiallyPausedGameIds}..remove(gid);
        _activityGameId = gid;
      });
      unawaited(_refreshOfficialPauseStates(_bracket));
      unawaited(_loadLiveBoardsPage(skip: _liveSkip));
      if (chrome.toastOfficialResumed.isNotEmpty) {
        await _toast(chrome.toastOfficialResumed);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
      if (chrome.toastOfficialResumeFailed.isNotEmpty) {
        await _toast(chrome.toastOfficialResumeFailed);
      }
    }
  }

  Future<void> _copyLiveGameId(HostedBracketMatch match) async {
    final gid = (match.gameId ?? '').trim();
    final ops = _officialPauseChrome;
    if (gid.isEmpty || ops == null) return;
    await Clipboard.setData(ClipboardData(text: gid));
    if (!mounted) return;
    final toast = ops.toastCopiedGameId.trim();
    if (toast.isNotEmpty) await _toast(toast);
  }

  Future<void> _bulkOfficialPauseSelected() async {
    final ops = await _ensureOfficialPauseChrome();
    if (!mounted) return;
    if (ops == null || !ops.isReady) {
      final msg = (ops?.unavailable ?? '').trim();
      if (msg.isNotEmpty) await _toast(msg);
      return;
    }
    if (ops.bulkSelectedPauseAction.trim().isEmpty) return;
    final ids = _liveSelectedGameIds
        .where((id) => !_officiallyPausedGameIds.contains(id))
        .toList(growable: false);
    if (ids.isEmpty) return;
    final choice = await showOfficialPauseDialog(
      context,
      chrome: ops,
      mode: OfficialPauseDialogMode.pause,
      titleOverride: ops.bulkSelectedConfirmTitle,
      descriptionOverride: ops.bulkSelectedConfirmDescription,
      confirmOverride: ops.bulkSelectedConfirm,
      pendingOverride: ops.bulkSelectedPausePending,
    );
    if (choice == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final body = <String, dynamic>{
        'game_ids': ids,
        'reason_key': choice.reasonKey,
      };
      if (choice.note.isNotEmpty) body['note'] = choice.note;
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/games/official-pause/bulk'),
        headers: _authHeaders,
        body: jsonEncode(body),
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        await _toast(
          await _officialPauseApiError(res, ops, ops.toastBulkFailed),
        );
        setState(() => _busy = false);
        return;
      }
      final decoded = jsonDecode(res.body);
      var ok = 0;
      var skipped = 0;
      var failed = 0;
      if (decoded is Map) {
        ok = (decoded['ok'] as num?)?.toInt() ?? 0;
        skipped = (decoded['skipped_count'] as num?)?.toInt() ?? 0;
        failed = (decoded['failed_count'] as num?)?.toInt() ?? 0;
      }
      setState(() {
        _busy = false;
        _liveSelectedGameIds = {};
      });
      unawaited(_refreshOfficialPauseStates(_bracket));
      unawaited(_loadLiveBoardsPage(skip: _liveSkip));
      if ((skipped > 0 || failed > 0) &&
          ops.toastBulkPartial.trim().isNotEmpty) {
        await _toast(
          ops.toastBulkPartial
              .replaceAll('{ok}', '$ok')
              .replaceAll('{skipped}', '$skipped')
              .replaceAll('{failed}', '$failed'),
        );
      } else if (ops.toastBulkPaused.trim().isNotEmpty) {
        await _toast(ops.toastBulkPaused.replaceAll('{ok}', '$ok'));
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
      if (ops.toastBulkFailed.trim().isNotEmpty) {
        await _toast(ops.toastBulkFailed);
      }
    }
  }

  Future<void> _bulkOfficialResumeSelected() async {
    final ops = await _ensureOfficialPauseChrome();
    if (!mounted) return;
    if (ops == null || !ops.isReady) {
      final msg = (ops?.unavailable ?? '').trim();
      if (msg.isNotEmpty) await _toast(msg);
      return;
    }
    if (ops.bulkSelectedResumeAction.trim().isEmpty) return;
    final ids = _liveSelectedGameIds
        .where((id) => _officiallyPausedGameIds.contains(id))
        .toList(growable: false);
    if (ids.isEmpty) return;
    final choice = await showOfficialPauseDialog(
      context,
      chrome: ops,
      mode: OfficialPauseDialogMode.resume,
      titleOverride: ops.bulkSelectedResumeConfirmTitle,
      descriptionOverride: ops.bulkSelectedResumeConfirmDescription,
      confirmOverride: ops.bulkSelectedResumeConfirm,
      pendingOverride: ops.bulkSelectedResumePending,
    );
    if (choice == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final body = <String, dynamic>{'game_ids': ids};
      if (choice.note.isNotEmpty) body['note'] = choice.note;
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/games/official-resume/bulk'),
        headers: _authHeaders,
        body: jsonEncode(body),
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        await _toast(
          await _officialPauseApiError(res, ops, ops.toastBulkResumeFailed),
        );
        setState(() => _busy = false);
        return;
      }
      final decoded = jsonDecode(res.body);
      var ok = 0;
      var skipped = 0;
      var failed = 0;
      if (decoded is Map) {
        ok = (decoded['ok'] as num?)?.toInt() ?? 0;
        skipped = (decoded['skipped_count'] as num?)?.toInt() ?? 0;
        failed = (decoded['failed_count'] as num?)?.toInt() ?? 0;
      }
      setState(() {
        _busy = false;
        _liveSelectedGameIds = {};
      });
      unawaited(_refreshOfficialPauseStates(_bracket));
      unawaited(_loadLiveBoardsPage(skip: _liveSkip));
      if ((skipped > 0 || failed > 0) &&
          ops.toastBulkResumePartial.trim().isNotEmpty) {
        await _toast(
          ops.toastBulkResumePartial
              .replaceAll('{ok}', '$ok')
              .replaceAll('{skipped}', '$skipped')
              .replaceAll('{failed}', '$failed'),
        );
      } else if (ops.toastBulkResumed.trim().isNotEmpty) {
        await _toast(ops.toastBulkResumed.replaceAll('{ok}', '$ok'));
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
      if (ops.toastBulkResumeFailed.trim().isNotEmpty) {
        await _toast(ops.toastBulkResumeFailed);
      }
    }
  }

  Future<void> _bulkOfficialPauseRound(int roundIndex) async {
    final chrome = widget.chrome;
    final ev = _event;
    if (ev == null || chrome.officialPauseAction.trim().isEmpty) return;
    final ops = await _ensureOfficialPauseChrome();
    if (!mounted) return;
    if (ops == null || !ops.isReady || ops.bulkPauseAction.trim().isEmpty) {
      final msg = (ops?.unavailable ?? '').trim();
      if (msg.isNotEmpty) await _toast(msg);
      return;
    }
    final choice = await showOfficialPauseDialog(
      context,
      chrome: ops,
      mode: OfficialPauseDialogMode.pause,
      titleOverride: ops.bulkConfirmTitle,
      descriptionOverride: ops.bulkConfirmDescription,
      confirmOverride: ops.bulkConfirm,
      pendingOverride: ops.bulkPausePending,
    );
    if (choice == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final body = <String, dynamic>{
        'event_id': ev.id,
        'round_index': roundIndex,
        'reason_key': choice.reasonKey,
      };
      if (choice.note.isNotEmpty) body['note'] = choice.note;
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/games/official-pause/bulk'),
        headers: _authHeaders,
        body: jsonEncode(body),
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        await _toast(
          await _officialPauseApiError(res, ops, ops.toastBulkFailed),
        );
        setState(() => _busy = false);
        return;
      }
      final decoded = jsonDecode(res.body);
      var ok = 0;
      var skipped = 0;
      var failed = 0;
      if (decoded is Map) {
        ok = (decoded['ok'] as num?)?.toInt() ?? 0;
        skipped = (decoded['skipped_count'] as num?)?.toInt() ?? 0;
        failed = (decoded['failed_count'] as num?)?.toInt() ?? 0;
      }
      setState(() => _busy = false);
      unawaited(_refreshOfficialPauseStates(_bracket));
      unawaited(_loadLiveBoardsPage(skip: _liveSkip));
      if ((skipped > 0 || failed > 0) &&
          ops.toastBulkPartial.trim().isNotEmpty) {
        await _toast(
          ops.toastBulkPartial
              .replaceAll('{ok}', '$ok')
              .replaceAll('{skipped}', '$skipped')
              .replaceAll('{failed}', '$failed'),
        );
      } else if (ops.toastBulkPaused.trim().isNotEmpty) {
        await _toast(ops.toastBulkPaused.replaceAll('{ok}', '$ok'));
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
      if (ops.toastBulkFailed.trim().isNotEmpty) {
        await _toast(ops.toastBulkFailed);
      }
    }
  }

  Future<void> _officialPauseMetaMatch(HostedBracketMatch match) async {
    final gid = (match.gameId ?? '').trim();
    final ops = await _ensureOfficialPauseChrome();
    if (!mounted) return;
    if (gid.isEmpty || ops == null || !ops.isReady) {
      final msg = (ops?.unavailable ?? '').trim();
      if (msg.isNotEmpty) await _toast(msg);
      return;
    }
    if (ops.metaAction.trim().isEmpty) return;
    final live = _officialPauseByGameId[gid];
    final choice = await showOfficialPauseDialog(
      context,
      chrome: ops,
      mode: OfficialPauseDialogMode.meta,
      initialReasonKey: (live?.pauseReasonKey ?? '').trim(),
      initialNote: (live?.pauseNote ?? '').trim(),
    );
    if (choice == null || !mounted) return;
    setState(() => _busy = true);
    try {
      // Always send note on meta so empty clears intentionally; omit wiped notes via API.
      final body = <String, dynamic>{
        'reason_key': choice.reasonKey,
        'note': choice.note,
      };
      final res = await http.post(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/games/${Uri.encodeComponent(gid)}/official-pause-meta',
        ),
        headers: _authHeaders,
        body: jsonEncode(body),
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        await _toast(
          await _officialPauseApiError(res, ops, ops.toastMetaFailed),
        );
        setState(() => _busy = false);
        return;
      }
      setState(() {
        _busy = false;
        _activityGameId = gid;
      });
      unawaited(_refreshOfficialPauseStates(_bracket));
      unawaited(_loadLiveBoardsPage(skip: _liveSkip));
      if (ops.toastMeta.trim().isNotEmpty) {
        await _toast(ops.toastMeta);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
      if (ops.toastMetaFailed.trim().isNotEmpty) {
        await _toast(ops.toastMetaFailed);
      }
    }
  }

  Future<void> _startGame(HostedBracketMatch match) async {
    final chrome = widget.chrome;
    final ev = _event;
    if (ev == null) return;
    setState(() => _busy = true);
    try {
      final res = await http.post(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/events/${ev.id}/bracket/${match.id}/start-game',
        ),
        headers: _authHeaders,
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        await _toast(await _apiError(res, chrome.toastStartFailed.trim()));
        setState(() => _busy = false);
        return;
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final gameId = body['game_id']?.toString() ?? '';
      setState(() => _busy = false);
      await _load();
      if (gameId.isNotEmpty && mounted) {
        await Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => MatchBoardPage(
              accessToken: widget.accessToken,
              gameId: gameId,
              mode: 'pvp',
            ),
          ),
        );
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final chrome = widget.chrome;
    final tokens = damaColorsOf(context);
    if (_pagePad == null) {
      return const Scaffold(body: SizedBox.shrink());
    }
    final labels = [
      chrome.overviewTab,
      chrome.joinTab,
      chrome.playersTab,
      chrome.bracketTab,
      chrome.liveBoardTab,
      chrome.brandingTab,
      chrome.paymentsTab,
      chrome.resultsTab,
    ];
    final manageBadge = (_event?.organizerHostTrustBadge ?? '').trim();
    return PopScope(
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) _beginClose();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Row(
            children: [
              Expanded(
                child: Text(
                  (_event?.title ?? '').trim(),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              HostTrustBadge(
                label: manageBadge,
                tier: _event?.organizerHostTrustTier,
                fontSize: 10,
                dense: true,
              ),
            ],
          ),
          actions: const [NotificationAppBarActions()],
          bottom: TabBar(
            controller: _tabs,
            isScrollable: true,
            tabs: [for (final l in labels) Tab(text: l)],
          ),
        ),
        body: _loading
            ? const WalletSkeleton()
            : _event == null
                ? Center(
                    child: Text(_error, style: TextStyle(color: tokens.danger)),
                  )
                // IndexedStack keeps every tab mounted (web fixed-shell parity - no rebuild flicker).
                : IndexedStack(
                    index: _tabIndex,
                    sizing: StackFit.expand,
                    children: [
                      _overviewTab(tokens),
                      _joinTab(tokens),
                      _playersTab(tokens),
                      _bracketTab(),
                      _liveBoardTab(),
                      _brandingTab(tokens),
                      _paymentsTab(tokens),
                      _resultsTab(),
                    ],
                  ),
      ),
    );
  }

  Widget _overviewTab(DamaColors tokens) {
    final chrome = widget.chrome;
    final ev = _event!;
    final hostBadge = ev.organizerHostTrustBadge.trim();
    final repSep = chrome.hostRepMetaSeparator;
    final showRep = repSep.isNotEmpty &&
        chrome.hostRepFinishedLabel.trim().isNotEmpty &&
        chrome.hostRepCancelledLabel.trim().isNotEmpty &&
        chrome.hostRepReportsLabel.trim().isNotEmpty &&
        ev.organizerFinishedPaidCups != null &&
        ev.organizerCancelledPaidCups != null &&
        ev.organizerOpenReports != null;
    return ListView(
      padding: _pagePad!,
      children: [
        if (hostBadge.isNotEmpty || showRep) ...[
          if (hostBadge.isNotEmpty)
            Align(
              alignment: Alignment.centerLeft,
              child: HostTrustBadge(
                label: hostBadge,
                tier: ev.organizerHostTrustTier,
                fontSize: 10,
                dense: true,
              ),
            ),
          if (showRep) ...[
            if (hostBadge.isNotEmpty) const SizedBox(height: 6),
            Text(
              [
                '${chrome.hostRepFinishedLabel.trim()} ${ev.organizerFinishedPaidCups}',
                '${chrome.hostRepCancelledLabel.trim()} ${ev.organizerCancelledPaidCups}',
                '${chrome.hostRepReportsLabel.trim()} ${ev.organizerOpenReports}',
              ].join(repSep),
              style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 11),
            ),
          ],
          const SizedBox(height: 12),
        ],
        Text(
          () {
            final left = ev.approvedCount != null
                ? '${ev.approvedCount}'
                : chrome.emptyValue;
            final fillRight = seatCapFillRight(
              ev.maxPlayers,
              ev.seatCapUnlimited,
              chrome.unlimitedPlayersLabel,
            );
            // Space before players suffix (web/player parity; not metaSeparator).
            final playersLine = fillRight != null
                ? '$left/$fillRight ${chrome.playersCountSuffix}'.trim()
                : '$left ${chrome.playersCountSuffix}'.trim();
            final size = ev.sizeLabel.trim();
            final showSize = size.isNotEmpty &&
                size != chrome.unlimitedPlayersLabel.trim() &&
                size != (fillRight ?? '').trim();
            return [
              ev.statusLabel.isNotEmpty ? ev.statusLabel : chrome.emptyValue,
              playersLine,
              if (ev.formatLabel.isNotEmpty) ev.formatLabel,
              if (showSize) size,
              ...hostedEventPrizePoolLines(
                ev,
                PrizePoolCardLabels.fromOrganizer(chrome),
              ),
            ].join(chrome.metaSeparator);
          }(),
          style: TextStyle(color: tokens.onSurfaceMuted),
        ),
        const SizedBox(height: 12),
        Builder(
          builder: (context) {
            final defStatus = (_catalog?.hostedEventDefaultStatus ?? '').trim();
            final titleLocked =
                defStatus.isEmpty || ev.status.trim() != defStatus;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _titleCtrl,
                  enabled: !titleLocked && !_busy,
                  decoration: InputDecoration(
                    labelText: softHostingTitleLabel(chrome.titleLabel),
                    border: const OutlineInputBorder(),
                    helperText: titleLocked
                        ? softHostingPatchTitleLocked(chrome.patchTitleLocked)
                        : null,
                  ),
                ),
                const SizedBox(height: 8),
              ],
            );
          },
        ),
        Text(
          softCommunityJoinStatusMessage(chrome.forceAutoApproveNote),
          style: TextStyle(color: tokens.onSurfaceMuted),
        ),
        const SizedBox(height: 8),
        Text(
          chrome.visibilityLabel,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 4),
        Text(
          ev.visibilityLabel.isNotEmpty
              ? ev.visibilityLabel
              : chrome.emptyValue,
          style: TextStyle(color: tokens.onSurfaceMuted),
        ),
        const SizedBox(height: 4),
        Text(
          ev.visibility == _publicVis
              ? softHostingVisibilityPublicBlurb(chrome.visibilityPublicBlurb)
              : softHostingVisibilityPrivateBlurb(
                  chrome.visibilityPrivateBlurb),
          style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            if (ev.visibility != _publicVis)
              OutlinedButton(
                onPressed: _busy || !_publicEventsEnabled
                    ? null
                    : () => _patch(visibility: _publicVis),
                child: Text(
                  _publicEventsEnabled
                      ? chrome.makePublicAction
                      : softHostingPublicDisabled(chrome.publicDisabled),
                ),
              ),
            if (ev.visibility == _publicVis)
              OutlinedButton(
                onPressed: _busy ? null : () => _patch(visibility: _privateVis),
                child: Text(chrome.makePrivateAction),
              ),
            Builder(
              builder: (context) {
                final defStatus =
                    (_catalog?.hostedEventDefaultStatus ?? '').trim();
                final titleLocked =
                    defStatus.isEmpty || ev.status.trim() != defStatus;
                final titleDirty = _titleCtrl.text.trim() != ev.title.trim();
                return FilledButton(
                  onPressed: _busy || (titleLocked && titleDirty)
                      ? null
                      : () => _patch(),
                  child: Text(_busy ? chrome.savePending : chrome.saveAction),
                );
              },
            ),
            if ((ev.startedAt ?? '').trim().isEmpty &&
                (ev.finishedAt ?? '').trim().isEmpty &&
                (ev.cancelledAt ?? '').trim().isEmpty)
              FilledButton(
                onPressed: _busy ? null : _start,
                child: Text(softHostingStartAction(chrome.startAction)),
              ),
            if (_isArenaCup(ev) && chrome.arenaFinishAction.isNotEmpty)
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  OutlinedButton(
                    onPressed: _busy ? null : _finishArena,
                    child: Text(
                      _busy
                          ? chrome.arenaFinishPending
                          : chrome.arenaFinishAction,
                    ),
                  ),
                  if (_arenaFinishBlocked(ev).isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        _arenaFinishBlocked(ev),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurface
                                  .withValues(alpha: 0.65),
                            ),
                      ),
                    ),
                ],
              ),
            if ((ev.startedAt ?? '').isEmpty &&
                (ev.finishedAt ?? '').isEmpty &&
                (ev.cancelledAt ?? '').isEmpty)
              OutlinedButton(
                onPressed: _busy ? null : _cancel,
                child: Text(softHostingCloseAction(chrome.closeAction)),
              ),
            if ((ev.cancelledAt ?? '').isNotEmpty &&
                (ev.startedAt ?? '').isEmpty &&
                (ev.finishedAt ?? '').isEmpty &&
                softHostingReopenAction(chrome.reopenAction).isNotEmpty)
              OutlinedButton(
                onPressed: _busy ? null : _reopen,
                child: Text(softHostingReopenAction(chrome.reopenAction)),
              ),
          ],
        ),
      ],
    );
  }

  Widget _joinTab(DamaColors tokens) {
    final chrome = widget.chrome;
    final ev = _event!;
    final baseOrigin = Uri.base.origin.trim();
    final originForFallback =
        baseOrigin.startsWith('http://') || baseOrigin.startsWith('https://')
            ? baseOrigin
            : '';
    final share = resolveEventInviteShareUrl(
      shareUrl: ev.shareUrl,
      joinCode: ev.joinCode,
      sharePathTemplate: _catalog?.sharePathTemplate,
      origin: originForFallback,
    );
    return ListView(
      padding: _pagePad!,
      children: [
        Text(chrome.joinCodeLabel,
            style: const TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        SelectableText(ev.joinCode),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: () => _copy(ev.joinCode),
          child: Text(chrome.copyCodeAction),
        ),
        const SizedBox(height: 16),
        Text(chrome.joinLinkLabel,
            style: const TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        if (share.isNotEmpty) ...[
          SelectableText(share,
              style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 13)),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () => _copy(share),
            child: Text(chrome.copyLinkAction),
          ),
        ],
        const SizedBox(height: 16),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            FilledButton.icon(
              onPressed: _qrDownloading ? null : _downloadQr,
              icon: _qrDownloading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.qr_code_2),
              label: Text(chrome.downloadQrAction),
            ),
            OutlinedButton(
              onPressed: ev.joinCode.isEmpty || share.isEmpty
                  ? null
                  : () {
                      final text = chrome.inviteTextTemplate
                          .replaceAll('{code}', ev.joinCode)
                          .replaceAll('{link}', share);
                      _copy(text);
                    },
              child: Text(chrome.copyInviteAction),
            ),
          ],
        ),
      ],
    );
  }

  Widget _playersTab(DamaColors tokens) {
    final chrome = widget.chrome;
    final catalog = _catalog;
    final pendingCode = (catalog?.hostedEventEntryPending ?? '').trim();
    final approvedCode = (catalog?.hostedEventEntryApproved ?? '').trim();
    final rejectedCode = (catalog?.hostedEventEntryRejected ?? '').trim();
    final kickedCode = (catalog?.hostedEventEntryKicked ?? '').trim();
    final pageSize = chrome.listPageSizeInt;

    List<HostedEventEntry> ofExact(String status) {
      if (status.isEmpty) return const [];
      return _rosterEntries.where((e) => e.status.trim() == status).toList();
    }

    final pending = ofExact(pendingCode);
    final approved = ofExact(approvedCode);
    final rejected = [
      ...ofExact(rejectedCode),
      ...ofExact(kickedCode),
    ];

    Widget section(String title, List<HostedEventEntry> rows,
        {bool canKick = false}) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          if (rows.isEmpty)
            Text(softHostingEmptyList(chrome.emptyList),
                style: TextStyle(color: tokens.onSurfaceMuted))
          else
            for (final e in rows)
              Builder(
                builder: (context) {
                  final status = e.statusLabel.isNotEmpty
                      ? e.statusLabel
                      : chrome.emptyValue;
                  final checkedLabel = chrome.playersCheckedInLabel.trim();
                  final checked = (e.checkedInAt ?? '').trim().isNotEmpty &&
                      checkedLabel.isNotEmpty;
                  var subtitle = checked
                      ? '$status${chrome.metaSeparator}$checkedLabel'
                      : status;
                  if (e.placement != null) {
                    subtitle = '$subtitle${chrome.metaSeparator}${e.placement}';
                  }
                  final openLabel = chrome.playersOpenPlayerLabel.trim();
                  return Card(
                    child: ListTile(
                      title: Text(
                        e.username.isNotEmpty ? e.username : chrome.emptyValue,
                      ),
                      subtitle: Text(subtitle),
                      onTap: e.userId.trim().isEmpty
                          ? null
                          : () => unawaited(
                                showPlayerInspectSheet(
                                    context, e.userId.trim()),
                              ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (openLabel.isNotEmpty &&
                              e.userId.trim().isNotEmpty)
                            TextButton(
                              onPressed: () => unawaited(
                                showPlayerInspectSheet(
                                  context,
                                  e.userId.trim(),
                                ),
                              ),
                              child: Text(openLabel),
                            ),
                          if (canKick)
                            TextButton(
                              onPressed: _busy
                                  ? null
                                  : () => _entryAction(e.userId, 'kick'),
                              child: Text(chrome.kickAction),
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
          const SizedBox(height: 16),
        ],
      );
    }

    final approveNote =
        softCommunityJoinStatusMessage(chrome.forceAutoApproveNote);
    final meta = _rosterMeta;
    return ListView(
      padding: _pagePad!,
      children: [
        if (approveNote.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              approveNote,
              style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 13),
            ),
          ),
        section(chrome.playersPendingLabel, pending),
        section(chrome.playersApprovedLabel, approved, canKick: true),
        section(chrome.playersRejectedLabel, rejected),
        if (pageSize > 0 && meta != null)
          SkipPaginationBar(
            meta: meta,
            busy: _rosterSoftFetching,
            onSkip: (skip) => unawaited(_loadRosterPage(skip: skip)),
          ),
      ],
    );
  }

  bool _showStandingsSection() {
    final ev = _event;
    if (ev == null) return false;
    if ((ev.finishedAt ?? '').trim().isNotEmpty) return true;
    if ((ev.startedAt ?? '').trim().isNotEmpty) return true;
    return _bracket.isNotEmpty;
  }

  Widget _standingsSection(EventsOrganizerChrome chrome) {
    if (!_showStandingsSection()) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 16),
        if (_standingsLoading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: LinearProgressIndicator(),
          )
        else
          EventStandingsView(
            standings: _standings,
            standingsTitle: chrome.standingsTitle,
            playedLabel: chrome.standingsPlayedLabel,
            winsLabel: chrome.standingsWinsLabel,
            lossesLabel: chrome.standingsLossesLabel,
            pointsLabel: chrome.standingsPointsLabel,
            emptyValue: chrome.emptyValue,
            groupLabelTemplate: chrome.groupLabelTemplate,
          ),
      ],
    );
  }

  bool get _resultCardImageReady {
    final c = widget.chrome;
    return c.resultCardShareImageAction.trim().isNotEmpty &&
        c.resultCardDownloadAction.trim().isNotEmpty &&
        c.resultCardFilename.trim().isNotEmpty &&
        c.resultCardImageFailed.trim().isNotEmpty &&
        c.resultCardSponsorPrefix.trim().isNotEmpty &&
        c.resultCardBgColor.trim().isNotEmpty &&
        c.resultCardFgColor.trim().isNotEmpty &&
        c.resultCardMutedColor.trim().isNotEmpty &&
        c.resultCardRowWashColor.trim().isNotEmpty &&
        c.resultCardTitleFont.trim().isNotEmpty &&
        c.resultCardWinnersFont.trim().isNotEmpty &&
        c.resultCardSponsorFont.trim().isNotEmpty &&
        c.resultCardPlacementFont.trim().isNotEmpty &&
        c.resultCardNameFont.trim().isNotEmpty &&
        c.resultCardHeaderWashAlpha.trim().isNotEmpty &&
        c.resultCardWidth.trim().isNotEmpty &&
        c.resultCardRowHeight.trim().isNotEmpty &&
        c.resultCardHeaderHeight.trim().isNotEmpty &&
        c.resultCardSponsorHeight.trim().isNotEmpty &&
        c.resultCardPlacementsMax.trim().isNotEmpty &&
        c.resultCardRowRadius.trim().isNotEmpty &&
        c.resultCardPad.trim().isNotEmpty &&
        c.resultCardLogoSize.trim().isNotEmpty &&
        c.resultCardTitleY.trim().isNotEmpty &&
        c.resultCardWinnersY.trim().isNotEmpty &&
        c.resultCardBodyGap.trim().isNotEmpty &&
        c.resultCardRowsTopGap.trim().isNotEmpty &&
        c.resultCardBottomPad.trim().isNotEmpty &&
        c.resultCardRowInset.trim().isNotEmpty &&
        c.resultCardRowInnerGap.trim().isNotEmpty &&
        c.resultCardPlacementX.trim().isNotEmpty &&
        c.resultCardNameX.trim().isNotEmpty &&
        c.resultCardRowTextY.trim().isNotEmpty &&
        c.resultCardSponsorLogoW.trim().isNotEmpty &&
        c.resultCardSponsorLogoH.trim().isNotEmpty &&
        c.resultCardSponsorLogoGap.trim().isNotEmpty &&
        c.resultCardLogoTextGap.trim().isNotEmpty;
  }

  List<ResultCardPlacement> get _resultCardPlacements {
    final placed = _entries.where((e) => e.placement != null).toList()
      ..sort((a, b) => (a.placement ?? 999).compareTo(b.placement ?? 999));
    return placed
        .map(
          (e) => ResultCardPlacement(
            placement: e.placement!,
            username: e.username.trim(),
          ),
        )
        .toList();
  }

  Widget _bracketTab() {
    final chrome = widget.chrome;
    return ListView(
      padding: _pagePad!,
      children: [
        EventBracketView(
          matches: _bracket,
          bracketTitle: softCommunityBracketTitle(chrome.bracketTitle),
          startGameAction: chrome.startGameAction,
          openMatchAction: chrome.openMatchAction,
          metaSeparator: chrome.metaSeparator,
          byeLabel: chrome.bracketByeLabel,
          vsLabel: chrome.bracketVsLabel,
          emptySeatLabel: chrome.bracketEmptySeat,
          emptyValue: chrome.emptyValue,
          phaseGroupLabel: chrome.phaseGroupLabel,
          phaseKnockoutLabel: chrome.phaseKnockoutLabel,
          phaseSwissLabel: chrome.phaseSwissLabel,
          phaseRoundRobinLabel: chrome.phaseRoundRobinLabel,
          groupLabelTemplate: chrome.groupLabelTemplate,
          swissRoundLabelTemplate: chrome.swissRoundLabelTemplate,
          phaseGroupId: _phaseGroupId,
          phaseKnockoutId: _phaseKnockoutId,
          phaseSwissId: _phaseSwissId,
          phaseRoundRobinId: _phaseRoundRobinId,
          pageCardPad: chrome.pageCardPad,
          pageCardGap: chrome.pageCardGap,
          canManage: true,
          forfeitAction: chrome.forfeitAction,
          rematchAction: chrome.rematchAction,
          officialPauseAction: chrome.officialPauseAction,
          officialResumeAction: chrome.officialResumeAction,
          officialPauseMetaAction: (_officialPauseChrome?.metaAction ?? ''),
          officialPauseStatusLabel: chrome.officialPauseStatusLabel,
          officiallyPausedGameIds: _officiallyPausedGameIds,
          officialPauseByGameId: _officialPauseByGameId,
          officialPauseChrome: _officialPauseChrome,
          onStartGame: _startGame,
          onForfeit: _forfeitMatch,
          onRematch: _rematchMatch,
          onOfficialPause: _officialPauseMatch,
          onOfficialResume: _officialResumeMatch,
          onOfficialPauseMeta: _officialPauseMetaMatch,
          onCopyGameId: _copyLiveGameId,
          onOpenMatch: (m) {
            final gid = (m.gameId ?? '').trim();
            if (gid.isEmpty) return;
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => SpectatePage(
                  accessToken: widget.accessToken,
                  initialGameId: gid,
                ),
              ),
            );
          },
        ),
        _standingsSection(chrome),
      ],
    );
  }

  Widget _liveBoardTab() {
    final chrome = widget.chrome;
    final tokens = damaColorsOf(context);
    final ops = _officialPauseChrome;
    final live = _liveMatches;
    final pageSize = chrome.listPageSizeInt;
    final activityTitle = chrome.activitySectionTitle.trim().isNotEmpty
        ? chrome.activitySectionTitle.trim()
        : (ops?.activityTitle ?? '').trim();
    final bulkRoundIndexes = <int>{};
    if ((ops?.bulkPauseAction ?? '').trim().isNotEmpty) {
      for (final m in _bracket) {
        final gid = (m.gameId ?? '').trim();
        if (gid.isEmpty || m.isBye || (m.finishedAt ?? '').trim().isNotEmpty) {
          continue;
        }
        bulkRoundIndexes.add(m.roundIndex);
      }
    }
    final bulkRounds = bulkRoundIndexes.toList()..sort();
    final sep = chrome.metaSeparator;
    final liveOfficialCount =
        _liveMeta != null ? _officiallyPausedCountApi : null;
    // KPI only when live page meta + API count both present (no invent 0).
    // Completed avg lives on organizer dashboard (API official_pause_avg_seconds).
    return ListView(
      padding: _pagePad!,
      children: [
        if (liveOfficialCount != null &&
            chrome.kpiPausedBoardsLabel.trim().isNotEmpty &&
            (ops?.kpiCountSeparator ?? '').trim().isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Wrap(
              spacing: 12,
              runSpacing: 4,
              children: [
                Text(
                  '${chrome.kpiPausedBoardsLabel.trim()}${ops!.kpiCountSeparator}$liveOfficialCount',
                  style: TextStyle(
                    color: tokens.onSurfaceMuted,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        if ((ops?.filterAll ?? '').trim().isNotEmpty ||
            (ops?.filterOfficialPaused ?? '').trim().isNotEmpty ||
            bulkRounds.isNotEmpty)
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: [
              if ((ops?.filterAll ?? '').trim().isNotEmpty)
                ChoiceChip(
                  label: Text(ops!.filterAll),
                  selected: !_liveOfficialPausedOnly,
                  onSelected: (_) {
                    setState(() {
                      _liveOfficialPausedOnly = false;
                      _liveSelectedGameIds = {};
                      _liveSkip = 0;
                    });
                    unawaited(_loadLiveBoardsPage(skip: 0));
                  },
                ),
              if ((ops?.filterOfficialPaused ?? '').trim().isNotEmpty)
                ChoiceChip(
                  label: Text(ops!.filterOfficialPaused),
                  selected: _liveOfficialPausedOnly,
                  onSelected: (_) {
                    setState(() {
                      _liveOfficialPausedOnly = true;
                      _liveSelectedGameIds = {};
                      _liveSkip = 0;
                    });
                    unawaited(_loadLiveBoardsPage(skip: 0));
                  },
                ),
              for (final r in bulkRounds)
                TextButton(
                  onPressed: _busy
                      ? null
                      : () => unawaited(_bulkOfficialPauseRound(r)),
                  child: Text(
                    '${ops!.bulkPauseAction}$sep${r + 1}',
                    style: TextStyle(color: tokens.brand),
                  ),
                ),
            ],
          ),
        if ((ops?.selectAllLabel ?? '').trim().isNotEmpty &&
            (ops?.selectRowLabel ?? '').trim().isNotEmpty &&
            live.isNotEmpty) ...[
          const SizedBox(height: 8),
          Builder(builder: (context) {
            final visibleGids = live
                .map((m) => (m.gameId ?? '').trim())
                .where((id) => id.isNotEmpty)
                .toList(growable: false);
            final selectedOnPage = visibleGids
                .where((id) => _liveSelectedGameIds.contains(id))
                .length;
            final allOn =
                visibleGids.isNotEmpty && selectedOnPage == visibleGids.length;
            return CheckboxListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              title: Text(
                ops!.selectAllLabel,
                style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
              ),
              value: allOn ? true : (selectedOnPage > 0 ? null : false),
              tristate: true,
              onChanged: (v) {
                setState(() {
                  final next = Set<String>.from(_liveSelectedGameIds);
                  if (v == true) {
                    next.addAll(visibleGids);
                  } else {
                    next.removeAll(visibleGids);
                  }
                  _liveSelectedGameIds = next;
                });
              },
              controlAffinity: ListTileControlAffinity.leading,
            );
          }),
        ],
        if ((ops?.selectAllLabel ?? '').trim().isNotEmpty &&
            (ops?.selectRowLabel ?? '').trim().isNotEmpty &&
            _liveSelectedGameIds.isNotEmpty) ...[
          Wrap(
            spacing: 8,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if ((ops?.selectedCountFmt ?? '').trim().contains('{count}'))
                Text(
                  ops!.selectedCountFmt.replaceAll(
                    '{count}',
                    '${_liveSelectedGameIds.length}',
                  ),
                  style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
                ),
              if ((ops?.bulkSelectedPauseAction ?? '').trim().isNotEmpty &&
                  _liveSelectedGameIds.any(
                    (id) => !_officiallyPausedGameIds.contains(id),
                  ))
                TextButton(
                  onPressed: _busy
                      ? null
                      : () => unawaited(_bulkOfficialPauseSelected()),
                  child: Text(
                    ops!.bulkSelectedPauseAction,
                    style: TextStyle(color: tokens.brand),
                  ),
                ),
              if ((ops?.bulkSelectedResumeAction ?? '').trim().isNotEmpty &&
                  _liveSelectedGameIds.any(
                    (id) => _officiallyPausedGameIds.contains(id),
                  ))
                TextButton(
                  onPressed: _busy
                      ? null
                      : () => unawaited(_bulkOfficialResumeSelected()),
                  child: Text(
                    ops!.bulkSelectedResumeAction,
                    style: TextStyle(color: tokens.brand),
                  ),
                ),
              if ((ops?.clearSelectionAction ?? '').trim().isNotEmpty)
                TextButton(
                  onPressed: () => setState(() => _liveSelectedGameIds = {}),
                  child: Text(ops!.clearSelectionAction),
                ),
            ],
          ),
        ],
        if (activityTitle.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            activityTitle,
            style: TextStyle(
              color: tokens.onSurfaceMuted,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          if (_pauseActivity.isEmpty)
            Text(
              (ops?.activityEmpty ?? '').trim(),
              style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
            )
          else
            ..._pauseActivity.take(5).map((ev) {
              final action = (ev['action'] as String?)?.trim() ?? '';
              final role =
                  ops?.roleLabel((ev['actor_role'] as String?) ?? '') ?? '';
              final name = (ev['actor_display_name'] as String?)?.trim() ?? '';
              final reason = (ev['reason_label'] as String?)?.trim() ?? '';
              final note = (ev['note'] as String?)?.trim() ?? '';
              final fmt = action == 'resume'
                  ? (ops?.activityResumeFmt ?? '')
                  : action == 'meta'
                      ? (ops?.activityMetaFmt ?? '')
                      : (ops?.activityPauseFmt ?? '');
              if (fmt.trim().isEmpty) return const SizedBox.shrink();
              // Fail closed: never show hollow "by ·" (fmt needs both role and name).
              if (role.isEmpty || name.isEmpty) return const SizedBox.shrink();
              final line = fmt
                  .replaceAll('{role}', role)
                  .replaceAll('{name}', name)
                  .replaceAll('{reason}', reason)
                  .replaceAll('{note}', note)
                  .trim();
              if (line.isEmpty) return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(line, style: const TextStyle(fontSize: 12)),
              );
            }),
          const SizedBox(height: 12),
        ],
        if (live.isEmpty &&
            pageSize > 0 &&
            !_liveSoftFetching &&
            _liveMeta != null &&
            _liveMeta!.total < 1 &&
            (ops?.liveBoardsEmpty ?? '').trim().isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 8),
            child: Text(
              ops!.liveBoardsEmpty.trim(),
              style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
            ),
          ),
        EventBracketView(
          matches: live,
          bracketTitle: chrome.livePausedSectionTitle.trim().isNotEmpty
              ? chrome.livePausedSectionTitle.trim()
              : chrome.liveBoardTab,
          startGameAction: chrome.startGameAction,
          openMatchAction: chrome.openMatchAction,
          metaSeparator: chrome.metaSeparator,
          byeLabel: chrome.bracketByeLabel,
          vsLabel: chrome.bracketVsLabel,
          emptySeatLabel: chrome.bracketEmptySeat,
          emptyValue: chrome.emptyValue,
          phaseGroupLabel: chrome.phaseGroupLabel,
          phaseKnockoutLabel: chrome.phaseKnockoutLabel,
          phaseSwissLabel: chrome.phaseSwissLabel,
          phaseRoundRobinLabel: chrome.phaseRoundRobinLabel,
          groupLabelTemplate: chrome.groupLabelTemplate,
          swissRoundLabelTemplate: chrome.swissRoundLabelTemplate,
          phaseGroupId: _phaseGroupId,
          phaseKnockoutId: _phaseKnockoutId,
          phaseSwissId: _phaseSwissId,
          phaseRoundRobinId: _phaseRoundRobinId,
          pageCardPad: chrome.pageCardPad,
          pageCardGap: chrome.pageCardGap,
          canManage: true,
          forfeitAction: chrome.forfeitAction,
          rematchAction: chrome.rematchAction,
          officialPauseAction: chrome.officialPauseAction,
          officialResumeAction: chrome.officialResumeAction,
          officialPauseMetaAction: (_officialPauseChrome?.metaAction ?? ''),
          officialPauseStatusLabel: chrome.officialPauseStatusLabel,
          officiallyPausedGameIds: _officiallyPausedGameIds,
          officialPauseByGameId: _officialPauseByGameId,
          officialPauseChrome: _officialPauseChrome,
          onStartGame: _startGame,
          onForfeit: _forfeitMatch,
          onRematch: _rematchMatch,
          onOfficialPause: _officialPauseMatch,
          onOfficialResume: _officialResumeMatch,
          onOfficialPauseMeta: _officialPauseMetaMatch,
          onCopyGameId: _copyLiveGameId,
          selectedGameIds: _liveSelectedGameIds,
          onToggleSelectGameId: (gid, selected) {
            setState(() {
              final next = Set<String>.from(_liveSelectedGameIds);
              if (selected) {
                next.add(gid);
              } else {
                next.remove(gid);
              }
              _liveSelectedGameIds = next;
            });
          },
          onOpenMatch: (m) {
            final gid = (m.gameId ?? '').trim();
            if (gid.isEmpty) return;
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => SpectatePage(
                  accessToken: widget.accessToken,
                  initialGameId: gid,
                ),
              ),
            );
          },
        ),
        if (pageSize > 0 && _liveMeta != null)
          SkipPaginationBar(
            meta: _liveMeta!,
            busy: _liveSoftFetching,
            onSkip: (skip) => unawaited(_loadLiveBoardsPage(skip: skip)),
          ),
      ],
    );
  }

  Widget _paymentsTab(DamaColors tokens) {
    final chrome = widget.chrome;
    final ev = _event!;
    final sep = chrome.amountCurrencySeparator;
    final empty = chrome.emptyValue;
    final pageSize = chrome.listPageSizeInt;
    final hostAmt = ev.hostFeeAmount;
    final hostCur = ev.hostFeeCurrency.trim();
    final hostLine = hostAmt == null
        ? empty
        : hostCur.isEmpty
            ? '$hostAmt'
            : '$hostAmt$sep$hostCur';
    final paidCount = _entryFeesPaidCount;
    final gross = _entryFeesGross;
    final net = _entryFeesOrganizerNet;
    final commissionSum = _entryFeesCommission;
    final feesCurrency = (_entryFeesCurrency ?? '').trim();
    final cur = feesCurrency.isNotEmpty ? feesCurrency : empty;
    final commission = ev.entryFeeCommissionPercent;
    return ListView(
      padding: _pagePad!,
      children: [
        Text(
          chrome.hostFeePaidLabel,
          style: TextStyle(color: tokens.onSurfaceMuted),
        ),
        const SizedBox(height: 4),
        Text(
          hostLine,
          style: TextStyle(
            color: tokens.gold,
            fontWeight: FontWeight.w600,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
        const SizedBox(height: 16),
        if (ev.isFreeEntry ||
            _rosterMeta == null ||
            paidCount == null ||
            paidCount < 1 ||
            gross == null ||
            net == null ||
            commissionSum == null) ...[
          Text(
            chrome.entryFeesCollectedLabel,
            style: TextStyle(color: tokens.onSurfaceMuted),
          ),
          const SizedBox(height: 4),
          Text(
            empty,
            style: TextStyle(
              color: tokens.gold,
              fontWeight: FontWeight.w600,
            ),
          ),
        ] else ...[
          Text(
            chrome.entryFeesGrossLabel,
            style: TextStyle(color: tokens.onSurfaceMuted),
          ),
          const SizedBox(height: 4),
          Text(
            '$gross$sep$cur',
            style: TextStyle(
              color: tokens.gold,
              fontWeight: FontWeight.w600,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(height: 12),
          Text(
            chrome.paymentsCommissionLabel,
            style: TextStyle(color: tokens.onSurfaceMuted),
          ),
          const SizedBox(height: 4),
          Text(
            '$commissionSum$sep$cur',
            style: TextStyle(
              color: tokens.gold,
              fontWeight: FontWeight.w600,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(height: 12),
          Text(
            chrome.paymentsOrganizerNetLabel,
            style: TextStyle(color: tokens.onSurfaceMuted),
          ),
          const SizedBox(height: 4),
          Text(
            '$net$sep$cur',
            style: TextStyle(
              color: tokens.gold,
              fontWeight: FontWeight.w600,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '$paidCount$sep${chrome.playersCountSuffix}',
            style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
          ),
        ],
        if (pageSize > 0 && _rosterEntries.isNotEmpty) ...[
          const SizedBox(height: 16),
          for (final e in _rosterEntries)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(
                e.username.trim().isNotEmpty ? e.username.trim() : empty,
              ),
              trailing: Text(
                (e.feePaid != null && e.feePaid! > 0)
                    ? '${e.feePaid}$sep${(e.feeCurrency.trim().isNotEmpty ? e.feeCurrency.trim() : empty)}'
                    : empty,
                style: TextStyle(
                  color: tokens.gold,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ),
        ],
        if (pageSize > 0 && _rosterMeta != null)
          SkipPaginationBar(
            meta: _rosterMeta!,
            busy: _rosterSoftFetching,
            onSkip: (skip) => unawaited(_loadRosterPage(skip: skip)),
          ),
        if (!ev.isFreeEntry) ...[
          const SizedBox(height: 16),
          Text(
            chrome.commissionPercentLabel,
            style: TextStyle(color: tokens.onSurfaceMuted),
          ),
          const SizedBox(height: 4),
          Text(
            commission == null ? empty : '$commission',
            style: TextStyle(
              color: tokens.gold,
              fontWeight: FontWeight.w600,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          if (commission != null) ...[
            const SizedBox(height: 8),
            Text(
              chrome.commissionBlurbTemplate.replaceAll(
                '{percent}',
                '$commission',
              ),
              style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
            ),
          ],
        ],
        if (ev.prizePoolDisplayEnabled &&
            !ev.isFreeEntry &&
            (ev.startedAt == null || (ev.startedAt ?? '').trim().isEmpty) &&
            !ev.prizePoolFrozen &&
            _clientEnums != null &&
            chrome.payoutModeLabel.trim().isNotEmpty &&
            chrome.payoutModeBlurb.trim().isNotEmpty) ...[
          const SizedBox(height: 20),
          Text(
            chrome.payoutModeLabel,
            style: const TextStyle(fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 4),
          Text(
            chrome.payoutModeBlurb,
            style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
          ),
          const SizedBox(height: 8),
          ChromeSelectField(
            label: chrome.payoutModeLabel,
            valueLabel: _managePayoutMode.trim().isEmpty
                ? ''
                : _managePayoutModeOptionLabel(
                    _managePayoutMode.trim(),
                    chrome,
                  ),
            onTap: () async {
              final options = [
                for (final m in payoutModeOptions(
                  _clientEnums,
                  ev.formatId,
                ))
                  ChromeSelectOption(
                    value: m,
                    label: _managePayoutModeOptionLabel(m, chrome),
                  ),
              ];
              if (options.isEmpty) return;
              final picked = await showChromeOptionSheet<String>(
                context: context,
                title: chrome.payoutModeLabel,
                selected: _managePayoutMode.trim().isEmpty
                    ? null
                    : _managePayoutMode.trim(),
                options: options,
              );
              if (picked != null) {
                setState(() => _managePayoutMode = picked);
              }
            },
          ),
          if (_managePlacesPercentMode &&
              chrome.prizePlacePercentsSectionLabel.trim().isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              chrome.prizePlacePercentsSectionLabel,
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
            if (chrome.prizePlacePercentsBlurb.trim().isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  chrome.prizePlacePercentsBlurb,
                  style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
                ),
              ),
            if (chrome.prizePlacePercent1Label.trim().isNotEmpty) ...[
              const SizedBox(height: 8),
              TextField(
                controller: _managePct1Ctrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: chrome.prizePlacePercent1Label,
                  border: const OutlineInputBorder(),
                ),
              ),
            ],
            if (chrome.prizePlacePercent2Label.trim().isNotEmpty) ...[
              const SizedBox(height: 8),
              TextField(
                controller: _managePct2Ctrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: chrome.prizePlacePercent2Label,
                  border: const OutlineInputBorder(),
                ),
              ),
            ],
            if (chrome.prizePlacePercent3Label.trim().isNotEmpty) ...[
              const SizedBox(height: 8),
              TextField(
                controller: _managePct3Ctrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: chrome.prizePlacePercent3Label,
                  border: const OutlineInputBorder(),
                ),
              ),
            ],
            if (placePercentsSumInvalid(
                  _managePct1Ctrl.text,
                  _managePct2Ctrl.text,
                  _managePct3Ctrl.text,
                ) &&
                chrome.errPrizePlacePercentsSum.trim().isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  chrome.errPrizePlacePercentsSum,
                  style: TextStyle(color: tokens.danger, fontSize: 12),
                ),
              ),
          ],
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _busy ||
                    _managePayoutMode.trim().isEmpty ||
                    (_managePlacesPercentMode &&
                        (placePercentsSumInvalid(
                              _managePct1Ctrl.text,
                              _managePct2Ctrl.text,
                              _managePct3Ctrl.text,
                            ) ||
                            buildPlacePercentsMap(
                                  _managePct1Ctrl.text,
                                  _managePct2Ctrl.text,
                                  _managePct3Ctrl.text,
                                ) ==
                                null))
                ? null
                : () => _patch(payoutOnly: true),
            child: Text(_busy ? chrome.savePending : chrome.saveAction),
          ),
        ],
      ],
    );
  }

  Widget _brandingTab(DamaColors tokens) {
    final chrome = widget.chrome;
    final ev = _event!;
    final prizeThumb = (ev.prizeImageUrl ?? '').trim();
    final prizeGallery = ev.gallery;
    return ListView(
      padding: _pagePad!,
      children: [
        if (chrome.descriptionLabel.isNotEmpty)
          TextField(
            controller: _descriptionCtrl,
            maxLines: 5,
            decoration: InputDecoration(
              labelText: chrome.descriptionLabel,
              hintText: chrome.descriptionPlaceholder,
              border: const OutlineInputBorder(),
            ),
          ),
        if (chrome.descriptionLabel.isNotEmpty) const SizedBox(height: 16),
        if (chrome.prizeMediaSectionTitle.isNotEmpty)
          Text(
            chrome.prizeMediaSectionTitle,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 15,
              color: Theme.of(context).colorScheme.onSurface,
            ),
          ),
        if (chrome.prizeMediaSectionBlurb.isNotEmpty) ...[
          if (chrome.prizeMediaSectionTitle.isNotEmpty)
            const SizedBox(height: 4),
          Text(
            chrome.prizeMediaSectionBlurb,
            style: TextStyle(
              fontSize: 13,
              color: tokens.onSurfaceMuted,
              height: 1.4,
            ),
          ),
        ],
        if (_prizeMediaChromeReady) ...[
          const SizedBox(height: 12),
          EntityMediaEditor(
            thumbnailLabel: chrome.thumbnailLabel,
            galleryLabel: chrome.galleryLabel,
            galleryEmpty: chrome.galleryEmpty,
            galleryAddAction: chrome.galleryAddAction,
            galleryMaxSlots: chrome.galleryMaxSlots,
            gallerySlotsFmt: chrome.gallerySlotsFmt,
            thumbnailMainBadge: chrome.thumbnailMainBadge,
            thumbnailEmptyHint: chrome.thumbnailEmptyHint,
            thumbnailHint: chrome.thumbnailHint,
            dropzoneChrome: _dropzoneChrome!,
            thumbnailUrl: prizeThumb.isNotEmpty ? prizeThumb : null,
            galleryUrls: prizeGallery,
            busyThumbnail: _busy && _prizeMediaUploadSlot == 'prize',
            busyGallery: _busy && _prizeMediaUploadSlot == 'gallery',
            enabled: !_busy ||
                _prizeMediaUploadSlot == 'prize' ||
                _prizeMediaUploadSlot == 'gallery',
            onThumbnail: _uploadPrizeImage,
            onClearThumbnail: _clearPrizeImage,
            onGalleryFiles: _uploadEventGallery,
            onRemoveGallery: _removeEventGalleryAt,
          ),
        ],
        const SizedBox(height: 16),
        TextField(
          controller: _sponsorCtrl,
          decoration: InputDecoration(
            labelText: chrome.sponsorNameLabel,
            hintText: chrome.sponsorNamePlaceholder,
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _brandColorCtrl,
          decoration: InputDecoration(
            labelText: chrome.brandColorLabel,
            hintText: chrome.brandColorPlaceholder,
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        Builder(
          builder: (context) {
            final previewH =
                double.tryParse(chrome.brandingPreviewHeight.trim());
            final previewMaxW =
                double.tryParse(chrome.brandingPreviewMaxWidth.trim());
            if (previewH == null ||
                previewH <= 0 ||
                previewMaxW == null ||
                previewMaxW <= 0) {
              return const SizedBox.shrink();
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if ((ev.logoUrl ?? '').isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Image.network(ev.logoUrl!, height: previewH),
                  ),
                OutlinedButton(
                  onPressed:
                      _busy ? null : () => _upload('logo', sponsor: false),
                  child: Text(chrome.uploadLogoAction),
                ),
                const SizedBox(height: 8),
                if ((ev.sponsorLogoUrl ?? '').isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: ConstrainedBox(
                      constraints: BoxConstraints(maxWidth: previewMaxW),
                      child: Image.network(
                        ev.sponsorLogoUrl!,
                        height: previewH,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                OutlinedButton(
                  onPressed: _busy
                      ? null
                      : () => _upload('sponsor-logo', sponsor: true),
                  child: Text(chrome.uploadSponsorAction),
                ),
                const SizedBox(height: 12),
              ],
            );
          },
        ),
        FilledButton(
          onPressed: _busy ? null : _patch,
          child: Text(_busy ? chrome.savePending : chrome.saveAction),
        ),
      ],
    );
  }

  Future<void> _shareResultCardImage({required bool preferShare}) async {
    final chrome = widget.chrome;
    final ev = _event;
    if (ev == null || !_resultCardImageReady) return;
    final placements = _resultCardPlacements;
    if (placements.isEmpty) return;
    try {
      await shareResultCardImage(
        title: ev.title.trim(),
        winnersTitle: softCommunityWinnersTitle(chrome.winnersTitle),
        sponsorPrefix: chrome.resultCardSponsorPrefix,
        emptyValue: chrome.emptyValue,
        imageFailed: chrome.resultCardImageFailed,
        filename: chrome.resultCardFilename,
        bgColor: chrome.resultCardBgColor,
        fgColor: chrome.resultCardFgColor,
        mutedColor: chrome.resultCardMutedColor,
        rowWashColor: chrome.resultCardRowWashColor,
        titleFont: chrome.resultCardTitleFont,
        winnersFont: chrome.resultCardWinnersFont,
        sponsorFont: chrome.resultCardSponsorFont,
        placementFont: chrome.resultCardPlacementFont,
        nameFont: chrome.resultCardNameFont,
        headerWashAlpha: chrome.resultCardHeaderWashAlpha,
        widthRaw: chrome.resultCardWidth,
        rowHeightRaw: chrome.resultCardRowHeight,
        headerHeightRaw: chrome.resultCardHeaderHeight,
        sponsorHeightRaw: chrome.resultCardSponsorHeight,
        placementsMaxRaw: chrome.resultCardPlacementsMax,
        rowRadiusRaw: chrome.resultCardRowRadius,
        padRaw: chrome.resultCardPad,
        logoSizeRaw: chrome.resultCardLogoSize,
        titleYRaw: chrome.resultCardTitleY,
        winnersYRaw: chrome.resultCardWinnersY,
        bodyGapRaw: chrome.resultCardBodyGap,
        rowsTopGapRaw: chrome.resultCardRowsTopGap,
        bottomPadRaw: chrome.resultCardBottomPad,
        rowInsetRaw: chrome.resultCardRowInset,
        rowInnerGapRaw: chrome.resultCardRowInnerGap,
        placementXRaw: chrome.resultCardPlacementX,
        nameXRaw: chrome.resultCardNameX,
        rowTextYRaw: chrome.resultCardRowTextY,
        sponsorLogoWRaw: chrome.resultCardSponsorLogoW,
        sponsorLogoHRaw: chrome.resultCardSponsorLogoH,
        sponsorLogoGapRaw: chrome.resultCardSponsorLogoGap,
        logoTextGapRaw: chrome.resultCardLogoTextGap,
        placements: placements,
        logoUrl: ev.logoUrl,
        sponsorName: ev.sponsorName,
        sponsorLogoUrl: ev.sponsorLogoUrl,
        brandColor: ev.brandColor,
        preferShare: preferShare,
      );
    } catch (_) {
      await _toast(chrome.resultCardImageFailed);
    }
  }

  Future<void> _shareResultsText() async {
    final chrome = widget.chrome;
    final ev = _event;
    if (ev == null) return;
    final placed = _entries.where((e) => e.placement != null).toList()
      ..sort((a, b) => (a.placement ?? 999).compareTo(b.placement ?? 999));
    if (placed.isEmpty) return;
    final sep = chrome.metaSeparator;
    final lines = placed
        .map(
          (e) =>
              '${e.placement}$sep${e.username.isNotEmpty ? e.username : chrome.emptyValue}',
        )
        .toList();
    final header = <String>[
      if (ev.title.trim().isNotEmpty) ev.title.trim(),
      softCommunityWinnersTitle(chrome.winnersTitle),
    ];
    final extras = <String>[];
    final logo = (ev.logoUrl ?? '').trim();
    if (logo.isNotEmpty) extras.add(logo);
    final sponsor = (ev.sponsorName ?? '').trim();
    if (sponsor.isNotEmpty) {
      extras.add('${chrome.sponsorNameLabel}$sep$sponsor');
    }
    final sponsorLogo = (ev.sponsorLogoUrl ?? '').trim();
    if (sponsorLogo.isNotEmpty) extras.add(sponsorLogo);
    final text = [...header, ...extras, ...lines].join('\n');
    try {
      await Share.share(text);
    } catch (_) {
      try {
        await Clipboard.setData(ClipboardData(text: text));
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(chrome.copiedBlurb)),
        );
      } catch (_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(chrome.toastCopyFailed)),
        );
      }
    }
  }

  Future<void> _shareResults() async {
    if (_resultCardImageReady && _resultCardPlacements.isNotEmpty) {
      await _shareResultCardImage(preferShare: true);
      return;
    }
    await _shareResultsText();
  }

  Widget _resultsTab() {
    final chrome = widget.chrome;
    final ev = _event;
    final hasPlaced = _entries.any((e) => e.placement != null);
    return ListView(
      padding: _pagePad!,
      children: [
        if (hasPlaced)
          Wrap(
            alignment: WrapAlignment.end,
            spacing: 8,
            runSpacing: 8,
            children: [
              if (softCommunityShareResultAction(chrome.shareResultAction)
                  .isNotEmpty)
                OutlinedButton(
                  onPressed: _busy ? null : _shareResults,
                  child: Text(
                    softCommunityShareResultAction(chrome.shareResultAction),
                  ),
                ),
              if (_resultCardImageReady) ...[
                OutlinedButton(
                  onPressed: _busy
                      ? null
                      : () => _shareResultCardImage(preferShare: true),
                  child: Text(
                    softCommunityResultCardShareImageAction(
                      chrome.resultCardShareImageAction,
                    ),
                  ),
                ),
                OutlinedButton(
                  onPressed: _busy
                      ? null
                      : () => _shareResultCardImage(preferShare: false),
                  child: Text(
                    softCommunityResultCardDownloadAction(
                      chrome.resultCardDownloadAction,
                    ),
                  ),
                ),
              ],
            ],
          ),
        if (ev != null)
          EventWinnersBoard(
            title: softCommunityWinnersTitle(chrome.winnersTitle),
            entries: _entries,
            emptyValue: chrome.emptyValue,
            logoUrl: ev.logoUrl,
            sponsorLogoUrl: ev.sponsorLogoUrl,
            sponsorName: ev.sponsorName,
          ),
        if (!hasPlaced)
          Text(
            chrome.emptyValue,
            style: TextStyle(color: damaColorsOf(context).onSurfaceMuted),
          ),
        _standingsSection(chrome),
      ],
    );
  }
}
