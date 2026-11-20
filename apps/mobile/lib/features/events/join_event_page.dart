import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/gallery_carousel.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/core/util/sanitize_decimal_input.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/auth/auth_providers.dart';
import 'package:dama_mobile/features/auth/sign_in_dialog.dart';
import 'package:dama_mobile/features/events/community_player_chrome_soft.dart';
import 'package:dama_mobile/features/events/event_bracket.dart';
import 'package:dama_mobile/features/events/event_cup_lobby_sheet.dart';
import 'package:dama_mobile/features/events/event_join_error.dart';
import 'package:dama_mobile/features/events/payment_event_join_dialog.dart';
import 'package:dama_mobile/features/events/event_result_card.dart';
import 'package:dama_mobile/features/events/event_standings.dart';
import 'package:dama_mobile/features/events/event_winners_board.dart';
import 'package:dama_mobile/features/events/event_report_dialog.dart';
import 'package:dama_mobile/features/game/spectate_page.dart';
import 'package:dama_mobile/features/notifications/notification_href_nav.dart';
import 'package:dama_mobile/features/wallet/portal_wallet_focus.dart';
import 'package:dama_mobile/features/wallet/wallet_cubit.dart';
import 'package:dama_mobile/features/wallet/wallet_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;
import 'package:share_plus/share_plus.dart';

Future<void> showJoinEventDialog(
  BuildContext context, {
  required String accessToken,
  String? initialCode,
}) {
  return showDialog<void>(
    context: context,
    builder: (_) => Dialog.fullscreen(
      child: JoinEventPage(
        accessToken: accessToken,
        initialCode: initialCode,
        embedded: true,
      ),
    ),
  );
}

/// Player join surface - chrome from GET /public/events-player-chrome.
class JoinEventPage extends StatefulWidget {
  const JoinEventPage({
    super.key,
    required this.accessToken,
    this.initialCode,
    this.embedded = false,
  });

  final String accessToken;
  final String? initialCode;
  final bool embedded;

  @override
  State<JoinEventPage> createState() => _JoinEventPageState();
}

class _JoinEventPageState extends State<JoinEventPage> {
  EventsPlayerChrome? _chrome;
  PaymentModalChrome? _payChrome;
  EventsCatalog? _catalog;

  /// True when catalog says hosted off, or GET /events/catalog returned 503.
  bool _catalogFeatureOff = false;
  String _unavailable = '';
  bool _chromeLoading = true;
  bool _joining = false;
  bool _joinAttempted = false;
  bool _loadingEvent = false;
  bool _needsTopUp = false;
  bool _statusIsError = false;
  HostedEvent? _event;
  List<HostedBracketMatch> _bracket = const [];
  List<HostedEventEntry> _entries = const [];
  List<HostedStandingRow> _standings = const [];
  bool _standingsLoading = false;
  String _statusBlurb = '';
  final _codeCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();
  Timer? _codeLookupDebounce;

  @override
  void initState() {
    super.initState();
    final code = (widget.initialCode ?? '').trim();
    if (code.isNotEmpty) _codeCtrl.text = code.toUpperCase();
    _loadChrome();
    if (code.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        unawaitedLookup(code);
      });
    }
  }

  void unawaitedLookup(String code) {
    _lookup(code);
  }

  /// Web JoinPanel: typing clears seat/top-up; auto lookup when code length ≥ 3.
  void _onCodeChanged(String raw) {
    final next = raw.toUpperCase();
    if (_codeCtrl.text != next) {
      _codeCtrl.value = TextEditingValue(
        text: next,
        selection: TextSelection.collapsed(offset: next.length),
      );
    }
    setState(() {
      _statusBlurb = '';
      _statusIsError = false;
      _needsTopUp = false;
      if (next.trim().isNotEmpty) _joinAttempted = false;
    });
    _codeLookupDebounce?.cancel();
    final code = next.trim();
    if (code.length < 3) {
      setState(() {
        _event = null;
        _bracket = const [];
        _entries = const [];
        _standings = const [];
      });
      return;
    }
    final ms = int.tryParse((_chrome?.searchDebounceMs ?? '').trim());
    final debounce = (ms != null && ms >= 0) ? ms : 0;
    _codeLookupDebounce = Timer(Duration(milliseconds: debounce), () {
      if (!mounted) return;
      unawaited(_lookup(code));
    });
  }

  @override
  void dispose() {
    _codeLookupDebounce?.cancel();
    _codeCtrl.dispose();
    _amountCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadChrome() async {
    try {
      final results = await Future.wait([
        http.get(
          Uri.parse(
            '${ApiConfig.baseUrl}/api/v1/public/events-player-chrome',
          ),
        ),
        http.get(
          Uri.parse(
            '${ApiConfig.baseUrl}/api/v1/public/payment-modal-chrome',
          ),
        ),
        http.get(Uri.parse('${ApiConfig.baseUrl}/api/v1/events/catalog')),
      ]);
      final chromeRes = results[0];
      final payRes = results[1];
      final catalogRes = results[2];
      EventsPlayerChrome? chrome;
      String unavailable = '';
      if (chromeRes.statusCode < 300) {
        final map = jsonDecode(chromeRes.body) as Map<String, dynamic>;
        chrome = EventsPlayerChrome.fromJson(map);
        unavailable = softCommunityChromeUnavailable(
          (map['events_player_chrome_unavailable'] as String?)?.trim() ?? '',
        );
      }
      PaymentModalChrome? pay;
      if (payRes.statusCode < 300) {
        pay = PaymentModalChrome.fromJson(
          jsonDecode(payRes.body) as Map<String, dynamic>,
        );
      }
      EventsCatalog? catalog;
      var catalogFeatureOff = false;
      if (catalogRes.statusCode < 300) {
        catalog = EventsCatalog.fromJson(
          jsonDecode(catalogRes.body) as Map<String, dynamic>,
        );
        catalogFeatureOff = catalog.hostedEventsEnabled == false;
      } else if (catalogRes.statusCode == 503) {
        catalogFeatureOff = true;
      }
      if (!mounted) return;
      setState(() {
        _chrome = chrome;
        _payChrome = pay;
        _catalog = catalog;
        _catalogFeatureOff = catalogFeatureOff;
        _unavailable = unavailable;
        _chromeLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _chromeLoading = false);
    }
  }

  Future<void> _report(HostedEvent ev) async {
    final chrome = _chrome;
    final catalog = _catalog;
    if (chrome == null || catalog == null) return;
    if (catalog.reportReasonCodes.isEmpty) return;
    await showEventReportDialog(
      context,
      accessToken: widget.accessToken,
      eventId: ev.id,
      reasonCodes: catalog.reportReasonCodes,
      reasonLabels: catalog.reportReasonLabels,
      emptyValue: chrome.emptyValue,
      title: softCommunityReportTitle(chrome.reportTitle),
      reasonLabel: chrome.reportReasonLabel,
      noteLabel: chrome.reportNoteLabel,
      submitAction: chrome.reportSubmitAction,
      toastSent: chrome.reportToastSent,
      toastFailed: chrome.reportToastFailed,
      cancelAction: chrome.cancelAction,
      dialogShellMaxHeightRatio: chrome.dialogShellMaxHeightRatio,
      dialogShellMaxWidth: chrome.dialogShellMaxWidth,
      dialogShellInsetH: chrome.dialogShellInsetH,
      dialogShellInsetV: chrome.dialogShellInsetV,
      dialogShellLoadingHeight: chrome.dialogShellLoadingHeight,
    );
  }

  Future<void> _lookup(String rawCode, {bool clearStatus = true}) async {
    final chrome = _chrome;
    if (chrome == null) return;
    final code = rawCode.trim().toUpperCase();
    if (code.isEmpty) return;
    setState(() {
      _loadingEvent = true;
      if (clearStatus) {
        _statusBlurb = '';
        _statusIsError = false;
        _needsTopUp = false;
      }
      _event = null;
      _bracket = const [];
      _entries = const [];
      _standings = const [];
    });
    try {
      final res = await http.get(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/events/by-code/${Uri.encodeComponent(code)}',
        ),
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        setState(() {
          _loadingEvent = false;
          if (clearStatus) {
            _statusIsError = true;
            _statusBlurb = softCommunityLoadFailed(chrome.loadFailed);
          }
        });
        return;
      }
      final ev = HostedEvent.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      List<HostedBracketMatch> bracket = const [];
      List<HostedEventEntry> entries = const [];
      try {
        final bRes = await http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/events/${ev.id}/bracket'),
        );
        if (bRes.statusCode < 300) {
          final body = jsonDecode(bRes.body) as Map<String, dynamic>;
          bracket = (body['bracket'] as List<dynamic>? ?? const [])
              .whereType<Map<String, dynamic>>()
              .map(HostedBracketMatch.fromJson)
              .toList();
        }
      } catch (_) {}
      try {
        final eRes = await http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/events/${ev.id}/entries'),
          headers: widget.accessToken.trim().isNotEmpty
              ? {'Authorization': 'Bearer ${widget.accessToken}'}
              : const {},
        );
        if (eRes.statusCode < 300) {
          final body = jsonDecode(eRes.body) as Map<String, dynamic>;
          entries = (body['entries'] as List<dynamic>? ?? const [])
              .whereType<Map<String, dynamic>>()
              .map(HostedEventEntry.fromJson)
              .toList();
        }
      } catch (_) {}
      List<HostedStandingRow> standings = const [];
      final placedCount = entries.where((e) => e.placement != null).length;
      final fetchStandings = (ev.finishedAt ?? '').trim().isNotEmpty ||
          placedCount > 0 ||
          bracket.isNotEmpty;
      if (fetchStandings) {
        try {
          setState(() => _standingsLoading = true);
          final sRes = await http.get(
            Uri.parse(
              '${ApiConfig.baseUrl}/api/v1/events/${ev.id}/standings',
            ),
          );
          if (sRes.statusCode < 300) {
            final body = jsonDecode(sRes.body) as Map<String, dynamic>;
            standings = (body['standings'] as List<dynamic>? ?? const [])
                .whereType<Map<String, dynamic>>()
                .map(HostedStandingRow.fromJson)
                .toList();
          }
        } catch (_) {}
      }
      if (!mounted) return;
      setState(() {
        _event = ev;
        _bracket = bracket;
        _entries = entries;
        _standings = standings;
        _standingsLoading = false;
        _loadingEvent = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingEvent = false;
        if (clearStatus) {
          _statusIsError = true;
          _statusBlurb = softCommunityLoadFailed(chrome.loadFailed);
        }
      });
    }
  }

  bool _resultCardImageReady(EventsPlayerChrome chrome) =>
      chrome.resultCardShareImageAction.trim().isNotEmpty &&
      chrome.resultCardDownloadAction.trim().isNotEmpty &&
      chrome.resultCardFilename.trim().isNotEmpty &&
      chrome.resultCardImageFailed.trim().isNotEmpty &&
      chrome.resultCardSponsorPrefix.trim().isNotEmpty &&
      chrome.resultCardBgColor.trim().isNotEmpty &&
      chrome.resultCardFgColor.trim().isNotEmpty &&
      chrome.resultCardMutedColor.trim().isNotEmpty &&
      chrome.resultCardRowWashColor.trim().isNotEmpty &&
      chrome.resultCardTitleFont.trim().isNotEmpty &&
      chrome.resultCardWinnersFont.trim().isNotEmpty &&
      chrome.resultCardSponsorFont.trim().isNotEmpty &&
      chrome.resultCardPlacementFont.trim().isNotEmpty &&
      chrome.resultCardNameFont.trim().isNotEmpty &&
      chrome.resultCardHeaderWashAlpha.trim().isNotEmpty &&
      chrome.resultCardWidth.trim().isNotEmpty &&
      chrome.resultCardRowHeight.trim().isNotEmpty &&
      chrome.resultCardHeaderHeight.trim().isNotEmpty &&
      chrome.resultCardSponsorHeight.trim().isNotEmpty &&
      chrome.resultCardPlacementsMax.trim().isNotEmpty &&
      chrome.resultCardRowRadius.trim().isNotEmpty &&
      chrome.resultCardPad.trim().isNotEmpty &&
      chrome.resultCardLogoSize.trim().isNotEmpty &&
      chrome.resultCardTitleY.trim().isNotEmpty &&
      chrome.resultCardWinnersY.trim().isNotEmpty &&
      chrome.resultCardBodyGap.trim().isNotEmpty &&
      chrome.resultCardRowsTopGap.trim().isNotEmpty &&
      chrome.resultCardBottomPad.trim().isNotEmpty &&
      chrome.resultCardRowInset.trim().isNotEmpty &&
      chrome.resultCardRowInnerGap.trim().isNotEmpty &&
      chrome.resultCardPlacementX.trim().isNotEmpty &&
      chrome.resultCardNameX.trim().isNotEmpty &&
      chrome.resultCardRowTextY.trim().isNotEmpty &&
      chrome.resultCardSponsorLogoW.trim().isNotEmpty &&
      chrome.resultCardSponsorLogoH.trim().isNotEmpty &&
      chrome.resultCardSponsorLogoGap.trim().isNotEmpty &&
      chrome.resultCardLogoTextGap.trim().isNotEmpty;

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

  Future<void> _shareResultCardImage(
    EventsPlayerChrome chrome, {
    required bool preferShare,
  }) async {
    final ev = _event;
    if (ev == null || !_resultCardImageReady(chrome)) return;
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
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(chrome.resultCardImageFailed)),
      );
    }
  }

  Future<void> _shareWinnersText(EventsPlayerChrome chrome) async {
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
    final ev = _event;
    final header = <String>[
      if (ev != null && ev.title.trim().isNotEmpty) ev.title.trim(),
      softCommunityWinnersTitle(chrome.winnersTitle),
    ];
    final extras = <String>[];
    final logo = (ev?.logoUrl ?? '').trim();
    if (logo.isNotEmpty) extras.add(logo);
    final sponsor = (ev?.sponsorName ?? '').trim();
    if (sponsor.isNotEmpty) extras.add(sponsor);
    final sponsorLogo = (ev?.sponsorLogoUrl ?? '').trim();
    if (sponsorLogo.isNotEmpty) extras.add(sponsorLogo);
    final text = [...header, ...extras, ...lines].join('\n');
    try {
      await Share.share(text);
    } catch (_) {
      try {
        await Clipboard.setData(ClipboardData(text: text));
      } catch (_) {}
    }
  }

  bool _showStandingsSection() {
    final ev = _event;
    if (ev == null) return false;
    if ((ev.finishedAt ?? '').trim().isNotEmpty) return true;
    return _entries.any((e) => e.placement != null);
  }

  /// Approved / already seated → event cup lobby (never bare Play home).
  Future<void> _openSeatedCupLobby(String eventId) async {
    final id = eventId.trim();
    if (!mounted || id.isEmpty) return;
    final chrome = _chrome;
    final token = (context.read<AuthCubit>().state.token ?? '').trim();
    if (chrome != null && chrome.isCupLobbyReady && token.isNotEmpty) {
      await showEventCupLobbySheet(
        context,
        eventId: id,
        accessToken: token,
        chrome: chrome,
      );
      return;
    }
    if (!mounted || token.isEmpty) return;
    // Cup lobby chrome missing → Community tab with focus (not a second browse).
    navigateNotificationHref(
      context,
      href: '/?view=tournaments&source=community&id=${Uri.encodeComponent(id)}',
      accessToken: token,
    );
  }

  Future<void> _join(WalletCubit? wallet) async {
    final chrome = _chrome;
    if (chrome == null) return;
    final auth = context.read<AuthCubit>().state;
    if (!auth.isAuthenticated) {
      await showSignInDialog(context);
      return;
    }
    final code = _codeCtrl.text.trim().toUpperCase();
    setState(() => _joinAttempted = true);
    if (code.isEmpty) return;
    final ev = _event;
    if (ev != null && !ev.isFreeEntry) {
      final ok = await showPaymentEventJoinDialog(
        context,
        event: ev,
        prizePoolLabels: PrizePoolCardLabels.fromPlayer(chrome),
        joinChrome: chrome,
      );
      if (!mounted) return;
      if (ok) {
        await _openSeatedCupLobby(ev.id);
      }
      return;
    }
    // Web JoinPanel posts even when country is empty (server geo resolves payer).
    final country = (wallet?.state.country ?? '').trim().toUpperCase();
    setState(() {
      _joining = true;
      _needsTopUp = false;
      _statusIsError = false;
      _statusBlurb = '';
    });
    try {
      final body = <String, dynamic>{'code': code};
      if (country.isNotEmpty) body['country_code'] = country;
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/join'),
        headers: {
          'Authorization': 'Bearer ${auth.token}',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(body),
      );
      if (!mounted) return;
      if (res.statusCode == 402) {
        // Web: setNeedsTopUp(true) - force inline top-up (not gold-only blurb).
        setState(() {
          _joining = false;
          _needsTopUp = true;
          _statusIsError = true;
          _statusBlurb = eventJoinErrorChrome(chrome, res);
        });
        if (wallet != null) WalletPage.unawaitedLoad(wallet);
        return;
      }
      if (res.statusCode >= 300) {
        if (isAlreadyJoinedEventError(res)) {
          // Hub/web join parity: soft already-joined / approved blurbs.
          final msg = softCommunityJoinStatusMessage(
            chrome.alreadyJoined.trim().isNotEmpty
                ? chrome.alreadyJoined
                : chrome.approvedBlurb,
          );
          setState(() {
            _joining = false;
            _statusIsError = false;
            _statusBlurb = msg;
          });
          showEventJoinSnack(context, message: msg, success: true);
          // Already seated → cup lobby.
          if (!mounted) return;
          final seatedId = (_event?.id ?? '').trim();
          if (seatedId.isNotEmpty) {
            await _openSeatedCupLobby(seatedId);
          }
          return;
        }
        setState(() {
          _joining = false;
          _statusIsError = true;
          _statusBlurb = eventJoinErrorChrome(chrome, res);
        });
        return;
      }
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      final entryRaw = map['entry'];
      final eventRaw = map['event'];
      String blurb = softCommunityJoinStatusMessage(chrome.approvedBlurb);
      var goPlay = true;
      if (entryRaw is Map<String, dynamic>) {
        final entry = HostedEventEntry.fromJson(entryRaw);
        final st = entry.status.trim();
        final pending = (_catalog?.hostedEventEntryPending ?? '').trim();
        final rejected = (_catalog?.hostedEventEntryRejected ?? '').trim();
        final kicked = (_catalog?.hostedEventEntryKicked ?? '').trim();
        final approved = (_catalog?.hostedEventEntryApproved ?? '').trim();
        if (pending.isNotEmpty && st == pending) {
          blurb = softCommunityJoinStatusMessage(chrome.pendingApproval);
          goPlay = false;
        } else if (rejected.isNotEmpty && st == rejected) {
          blurb = softCommunityJoinStatusMessage(chrome.rejectedBlurb);
          goPlay = false;
        } else if (kicked.isNotEmpty && st == kicked) {
          blurb = softCommunityKickedBlurb(chrome.kickedBlurb);
          goPlay = false;
        } else if (approved.isNotEmpty && st == approved) {
          blurb = softCommunityJoinStatusMessage(chrome.approvedBlurb);
        }
      }
      HostedEvent? updated;
      if (eventRaw is Map<String, dynamic>) {
        updated = HostedEvent.fromJson(eventRaw);
      }
      setState(() {
        _joining = false;
        _statusIsError = false;
        _statusBlurb = blurb;
        if (updated != null) _event = updated;
      });
      showEventJoinSnack(context, message: blurb, success: true);
      if (goPlay) {
        // Approved seat → cup lobby.
        if (!mounted) return;
        final seatedId = (updated?.id ?? _event?.id ?? '').trim();
        if (seatedId.isNotEmpty) {
          await _openSeatedCupLobby(seatedId);
        }
      } else {
        unawaited(_lookup(code, clearStatus: false));
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _joining = false;
        _statusIsError = true;
        _statusBlurb = softCommunityLoadFailed(chrome.loadFailed);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    if (_chromeLoading) {
      return const Padding(
        padding: EdgeInsets.zero,
        child: WalletSkeleton(),
      );
    }
    final chrome = _chrome;
    if (chrome == null) {
      final body = Center(
        child: Padding(
          padding: EdgeInsets.zero,
          child: Text(
            softCommunityChromeUnavailable(_unavailable),
            style: TextStyle(color: tokens.danger),
          ),
        ),
      );
      if (widget.embedded) {
        return Scaffold(
          appBar: AppBar(
            // Chrome unavailable: system back only (no invent English title).
            automaticallyImplyLeading: true,
          ),
          body: body,
        );
      }
      return body;
    }

    // Hosting Join = community-cup join - gate when hosted cups feature is off (web parity).
    if (_catalogFeatureOff || _catalog?.hostedEventsEnabled == false) {
      final gated = Center(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Text(
            softCommunityFeatureDisabled(chrome.featureDisabled),
            style: TextStyle(color: tokens.onSurfaceMuted),
          ),
        ),
      );
      if (widget.embedded) {
        return Scaffold(
          appBar: AppBar(
            title: Text(softCommunityJoinTitle(chrome.joinTitle)),
            automaticallyImplyLeading: true,
          ),
          body: gated,
        );
      }
      return gated;
    }

    final auth = context.watch<AuthCubit>().state;
    final content = BlocProvider(
      create: (_) {
        final cubit = WalletCubit(accessToken: widget.accessToken);
        if (auth.isAuthenticated) WalletPage.unawaitedLoad(cubit);
        return cubit;
      },
      child: BlocConsumer<WalletCubit, WalletState>(
        listenWhen: (p, n) => p.balance != n.balance,
        listener: (context, state) {
          final ev = _event;
          if (ev == null || ev.isFreeEntry) return;
          final fee = ev.entryFeeAmount;
          final bal = state.balance;
          if (bal == null || fee == null || fee <= 0 || bal >= fee) return;
          if (_amountCtrl.text.trim().isNotEmpty) return;
          final shortfall = fee - bal;
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
          final ev = _event;
          final fee = ev == null || ev.isFreeEntry ? null : ev.entryFeeAmount;
          final bal = wallet.balance;
          final canAfford =
              fee == null || fee <= 0 || (bal != null && bal >= fee);
          final showTopUp = _needsTopUp ||
              (fee != null && fee > 0 && bal != null && !canAfford);

          // Full-width portal body (same as other player pages). Dialog
          // panel_max_width is for modals only - do not shrink this surface.
          final insetH = double.tryParse(chrome.dialogShellInsetH.trim());
          final insetV = double.tryParse(chrome.dialogShellInsetV.trim());
          if (insetH == null || insetH < 0 || insetV == null || insetV < 0) {
            return const SizedBox.shrink();
          }
          return ListView(
            padding: EdgeInsets.symmetric(horizontal: insetH, vertical: insetV),
            children: [
              Text(
                softCommunityJoinTitle(chrome.joinTitle),
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                softCommunityJoinBlurb(chrome.joinBlurb),
                style: TextStyle(color: tokens.onSurfaceMuted),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _codeCtrl,
                textCapitalization: TextCapitalization.characters,
                decoration: InputDecoration(
                  labelText: softCommunityCodeLabel(chrome.codeLabel),
                  hintText:
                      softCommunityCodePlaceholder(chrome.codePlaceholder),
                  border: const OutlineInputBorder(),
                  errorText: _joinAttempted && _codeCtrl.text.trim().isEmpty
                      ? (chrome.errCodeRequired.isNotEmpty
                          ? softCommunityErrCodeRequired(chrome.errCodeRequired)
                          : null)
                      : null,
                  suffixIcon: _loadingEvent
                      ? const Padding(
                          padding: EdgeInsets.all(12),
                          child: SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : null,
                ),
                onChanged: _onCodeChanged,
                onSubmitted: (_) => _lookup(_codeCtrl.text),
              ),
              if (ev != null && !ev.isFreeEntry) ...[
                const SizedBox(height: 12),
                Text(
                  [
                    ev.entryFeeAmount != null
                        ? '${ev.entryFeeAmount}'
                        : chrome.emptyValue,
                    chrome.amountCurrencySeparator,
                    ev.entryFeeCurrency.trim().isNotEmpty
                        ? ev.entryFeeCurrency
                        : chrome.emptyValue,
                  ].join(),
                  style: TextStyle(
                    color: tokens.gold,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                Builder(
                  builder: (context) {
                    final payBlurb = softCommunityJoinStatusMessage(
                      chrome.entryFeePayBlurb,
                    );
                    if (payBlurb.isEmpty) return const SizedBox.shrink();
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 4),
                        Text(
                          payBlurb,
                          style: TextStyle(
                            color: tokens.onSurfaceMuted,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ],
              if (showTopUp) ...[
                const SizedBox(height: 12),
                Text(
                  softCommunityJoinStatusMessage(chrome.insufficientEntryFee),
                  style: TextStyle(color: tokens.danger),
                ),
                const SizedBox(height: 8),
                if (_payChrome != null &&
                    wallet.routeProvider != 'manual_transfer') ...[
                  TextField(
                    controller: _amountCtrl,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[\d.]')),
                    ],
                    decoration: InputDecoration(
                      labelText: _payChrome!.amountLabel,
                      hintText: _payChrome!.amountPlaceholder,
                      border: const OutlineInputBorder(),
                    ),
                    onChanged: (v) {
                      final s = sanitizeDecimalInput(v);
                      if (s != v) {
                        _amountCtrl.value = TextEditingValue(
                          text: s,
                          selection: TextSelection.collapsed(offset: s.length),
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
                            parsePositiveDecimal(_amountCtrl.text) == null
                        ? null
                        : () => context.read<WalletCubit>().checkout(),
                    child: Text(
                      wallet.loading
                          ? (_payChrome!.checkoutPending.trim().isNotEmpty
                              ? _payChrome!.checkoutPending
                              : _payChrome!.checkoutAction)
                          : _payChrome!.checkoutAction,
                    ),
                  ),
                ],
                const SizedBox(height: 8),
                if (chrome.topUpHref.trim().isNotEmpty)
                  OutlinedButton(
                    onPressed: () {
                      final href = withWalletFocusParam(
                        chrome.topUpHref.trim(),
                        'topup',
                      );
                      if (isWalletHrefPath(href)) {
                        final focus = portalWalletFocusFromHref(href);
                        final base = moneyBasePathFromHref(href);
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => WalletPage(
                              token: widget.accessToken,
                              moneyBasePath: base,
                              showOrganizerPayoutBlurb: base.isNotEmpty,
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
              if (_statusBlurb.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  _statusBlurb,
                  style: TextStyle(
                    color: _statusIsError ? tokens.danger : tokens.gold,
                  ),
                ),
              ],
              // Web JoinPanel: Join CTA after event card / top-up (not above).
              const SizedBox(height: 12),
              if (!auth.isAuthenticated)
                FutureBuilder<AuthProvidersChrome?>(
                  future: fetchAuthProvidersChrome(),
                  builder: (context, snap) {
                    final label = (snap.data?.navSignInLabel ?? '').trim();
                    if (label.isEmpty) return const SizedBox.shrink();
                    return TextButton(
                      onPressed: () => showSignInDialog(context),
                      child: Text(label),
                    );
                  },
                )
              else
                FilledButton(
                  onPressed: _joining
                      ? null
                      : () => _join(context.read<WalletCubit>()),
                  child: _joining
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(softTournamentsJoinAction(chrome.joinAction)),
                ),
              if (ev != null) ...[
                const SizedBox(height: 20),
                Builder(
                  builder: (context) {
                    final images = ev.carouselImages;
                    final brand = (ev.brandColor ?? '').trim();
                    Color fallback = tokens.surfaceMuted;
                    if (brand.isNotEmpty) {
                      final hex =
                          brand.startsWith('#') ? brand.substring(1) : brand;
                      final parsed = int.tryParse(
                        hex.length == 6 ? 'FF$hex' : hex,
                        radix: 16,
                      );
                      if (parsed != null) fallback = Color(parsed);
                    }
                    if (images.isEmpty && brand.isEmpty) {
                      return const SizedBox.shrink();
                    }
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: images.isEmpty
                            ? AspectRatio(
                                aspectRatio: 16 / 10,
                                child: ColoredBox(color: fallback),
                              )
                            : GalleryCarousel(
                                images: images,
                                semanticsLabel: softCommunityCarouselAria(
                                  chrome.carouselAria,
                                ),
                                aspectRatio: 16 / 10,
                              ),
                      ),
                    );
                  },
                ),
                Text(
                  ev.title,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                Text(
                  ev.statusLabel.isNotEmpty
                      ? ev.statusLabel
                      : chrome.emptyValue,
                  style: TextStyle(color: tokens.onSurfaceMuted),
                ),
                if (ev.description.trim().isNotEmpty) ...[
                  const SizedBox(height: 8),
                  if (chrome.detailDescriptionLabel.trim().isNotEmpty)
                    Text(
                      chrome.detailDescriptionLabel.trim(),
                      style: TextStyle(
                        color: tokens.onSurfaceMuted,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  Text(
                    ev.description.trim(),
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontSize: 13,
                      height: 1.35,
                    ),
                  ),
                ],
                Builder(
                  builder: (context) {
                    final poolLines = hostedEventPrizePoolLines(
                      ev,
                      PrizePoolCardLabels.fromPlayer(chrome),
                    );
                    final empty = chrome.emptyValue;
                    final approved = ev.approvedCount != null
                        ? '${ev.approvedCount}'
                        : empty;
                    final playersLbl =
                        softTournamentsPlayersLabel(chrome.playersLabel);
                    final fillRight = seatCapFillRight(
                      ev.maxPlayers,
                      ev.seatCapUnlimited,
                      chrome.unlimitedPlayersLabel,
                    );
                    final playersLine = fillRight != null
                        ? '$approved/$fillRight $playersLbl'.trim()
                        : '$approved $playersLbl'.trim();
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (final line in poolLines) ...[
                          const SizedBox(height: 4),
                          Text(
                            line,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onSurface,
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                        const SizedBox(height: 4),
                        Text(
                          playersLine,
                          style: TextStyle(
                            color: tokens.onSurfaceMuted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    );
                  },
                ),
                if (() {
                  final pub =
                      (_catalog?.hostedEventPublicVisibility ?? '').trim();
                  final priv =
                      (_catalog?.hostedEventPrivateVisibility ?? '').trim();
                  return (pub.isNotEmpty && ev.visibility == pub) ||
                      (priv.isNotEmpty && ev.visibility == priv);
                }()) ...[
                  const SizedBox(height: 4),
                  Text(
                    () {
                      final pub =
                          (_catalog?.hostedEventPublicVisibility ?? '').trim();
                      if (pub.isNotEmpty && ev.visibility == pub) {
                        return softCommunityVisibilityPublicBlurb(
                          chrome.visibilityPublicBlurb,
                        );
                      }
                      return softCommunityVisibilityPrivateBlurb(
                        chrome.visibilityPrivateBlurb,
                      );
                    }(),
                    style: TextStyle(
                      color: tokens.onSurfaceMuted,
                      fontSize: 12,
                    ),
                  ),
                ],
                if (() {
                  final pub =
                      (_catalog?.hostedEventPublicVisibility ?? '').trim();
                  return pub.isNotEmpty && ev.visibility == pub;
                }()) ...[
                  const SizedBox(height: 4),
                  Text(
                    softCommunityJoinStatusMessage(
                      (_catalog?.publicEventMatchesRated ?? false)
                          ? chrome.publicRatedOnBlurb
                          : chrome.publicRatedOffBlurb,
                    ),
                    style: TextStyle(
                      color: tokens.onSurfaceMuted,
                      fontSize: 12,
                    ),
                  ),
                ],
                if (auth.isAuthenticated) ...[
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: () => _report(ev),
                    child: Text(softCommunityReportAction(chrome.reportAction)),
                  ),
                ],
                if (_entries.any((e) => e.placement != null)) ...[
                  const SizedBox(height: 16),
                  Text(
                    softCommunityWinnersTitle(chrome.winnersTitle),
                    style: Theme.of(context)
                        .textTheme
                        .titleSmall
                        ?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      if (chrome.shareResultAction.isNotEmpty)
                        OutlinedButton(
                          onPressed: () => _shareWinnersText(chrome),
                          child: Text(
                            softCommunityShareResultAction(
                                chrome.shareResultAction),
                          ),
                        ),
                      if (_resultCardImageReady(chrome)) ...[
                        OutlinedButton(
                          onPressed: () =>
                              _shareResultCardImage(chrome, preferShare: true),
                          child: Text(
                            softCommunityResultCardShareImageAction(
                              chrome.resultCardShareImageAction,
                            ),
                          ),
                        ),
                        OutlinedButton(
                          onPressed: () =>
                              _shareResultCardImage(chrome, preferShare: false),
                          child: Text(
                            softCommunityResultCardDownloadAction(
                              chrome.resultCardDownloadAction,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 8),
                  EventWinnersBoard(
                    title: '',
                    entries: _entries,
                    emptyValue: chrome.emptyValue,
                    logoUrl: _event?.logoUrl,
                    sponsorLogoUrl: _event?.sponsorLogoUrl,
                    sponsorName: _event?.sponsorName,
                  ),
                ],
                if (_showStandingsSection()) ...[
                  const SizedBox(height: 16),
                  if (_standingsLoading)
                    const LinearProgressIndicator()
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
                if (_bracket.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  EventBracketView(
                    matches: _bracket,
                    bracketTitle:
                        softCommunityBracketTitle(chrome.bracketTitle),
                    startGameAction: '',
                    openMatchAction:
                        softCommunitySpectateAction(chrome.spectateAction),
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
                    phaseGroupId: _catalog?.hostedEventPhaseGroup ?? '',
                    phaseKnockoutId: _catalog?.hostedEventPhaseKnockout ?? '',
                    phaseSwissId: _catalog?.hostedEventPhaseSwiss ?? '',
                    phaseRoundRobinId:
                        _catalog?.hostedEventPhaseRoundRobin ?? '',
                    pageCardPad: chrome.pageCardPad,
                    pageCardGap: chrome.pageCardGap,
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
                ],
              ],
              if (_catalog?.publicEventsEnabled == true &&
                  softCommunityPublicListTitle(chrome.publicListTitle)
                      .isNotEmpty) ...[
                const SizedBox(height: 28),
                // Browse lives on Tournaments → Community (no second public list).
                if (softCommunityPublicListBlurb(chrome.publicListBlurb)
                    .isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      softCommunityPublicListBlurb(chrome.publicListBlurb),
                      style: TextStyle(
                        color: damaColorsOf(context).onSurfaceMuted,
                        fontSize: 13,
                      ),
                    ),
                  ),
                OutlinedButton(
                  onPressed: () {
                    navigateNotificationHref(
                      context,
                      href: '/?view=tournaments&source=community',
                      accessToken: widget.accessToken,
                    );
                  },
                  child: Text(
                    softCommunityPublicListTitle(chrome.publicListTitle),
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );

    if (widget.embedded) {
      return Scaffold(
        appBar: AppBar(
          title: Text(softCommunityJoinTitle(chrome.joinTitle)),
          leading: IconButton(
            icon: const Icon(Icons.close),
            tooltip: chrome.dialogCloseLabel,
            onPressed: () => Navigator.of(context).pop(),
          ),
        ),
        body: content,
      );
    }
    return content;
  }
}
