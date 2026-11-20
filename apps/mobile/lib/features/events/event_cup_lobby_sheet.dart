import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/cup_lifecycle.dart';
import 'package:dama_mobile/core/lib/competition_arena.dart';
import 'package:dama_mobile/core/lib/est_prize_share.dart';
import 'package:dama_mobile/core/types/prize_pool_lines.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/types/arena_standing.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/ui/gallery_carousel.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/core/types/events.dart';
import 'package:dama_mobile/core/types/events_player_chrome.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/events/community_player_chrome_soft.dart';
import 'package:dama_mobile/features/events/hosting_organizer_chrome_soft.dart';
import 'package:dama_mobile/features/events/event_report_dialog.dart';
import 'package:dama_mobile/features/events/event_standings.dart';
import 'package:dama_mobile/features/game/match_board_page.dart';
import 'package:dama_mobile/features/game/spectate_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;

enum _CheckInWindowState { open, notOpen, closed, none }

_CheckInWindowState _checkInWindow(HostedEvent? ev) {
  if (ev == null) return _CheckInWindowState.none;
  final opens = (ev.checkInOpensAt ?? '').trim();
  final closes = (ev.checkInClosesAt ?? '').trim();
  if (opens.isEmpty && closes.isEmpty) return _CheckInWindowState.open;
  final now = DateTime.now().toUtc();
  if (opens.isNotEmpty) {
    final o = DateTime.tryParse(opens);
    if (o != null && now.isBefore(o)) return _CheckInWindowState.notOpen;
  }
  if (closes.isNotEmpty) {
    final c = DateTime.tryParse(closes);
    if (c != null && now.isAfter(c)) return _CheckInWindowState.closed;
  }
  return _CheckInWindowState.open;
}

bool _cupStarted(HostedEvent? ev) => (ev?.startedAt ?? '').trim().isNotEmpty;

/// Prefer server chrome `error` body (writeEventsPlayerErr); else fallback.
/// Scrubs Event-sport API text (web cupLobbyPlayerErrMsg / join-error parity).
String _playerApiErrSnack(http.Response res, String fallback) {
  try {
    final decoded = jsonDecode(res.body);
    if (decoded is Map && decoded['error'] is String) {
      var msg = (decoded['error'] as String).trim();
      if (msg.startsWith('{') || msg.startsWith('[')) msg = '';
      if (msg.isNotEmpty) {
        final scrubbed = softCommunityJoinStatusMessage(msg);
        return scrubbed.isNotEmpty ? scrubbed : fallback.trim();
      }
    }
  } catch (_) {}
  return softCommunityLoadFailed(fallback);
}

HostedBracketMatch? _pickNextMatch(
  List<HostedBracketMatch> bracket,
  String userId,
) {
  final id = userId.trim();
  if (id.isEmpty) return null;
  final mine = bracket
      .where(
        (m) =>
            !m.isBye &&
            ((m.playerAId ?? '').trim() == id ||
                (m.playerBId ?? '').trim() == id) &&
            (m.finishedAt ?? '').trim().isEmpty,
      )
      .toList()
    ..sort((a, b) {
      if (a.roundIndex != b.roundIndex) {
        return a.roundIndex.compareTo(b.roundIndex);
      }
      return a.matchIndex.compareTo(b.matchIndex);
    });
  return mine.isEmpty ? null : mine.first;
}

Future<void> showEventCupLobbySheet(
  BuildContext context, {
  required String eventId,
  required String accessToken,
  required EventsPlayerChrome chrome,
  ApiConfig? config,
}) async {
  final id = eventId.trim();
  if (id.isEmpty || !chrome.isCupLobbyReady) return;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: damaColorsOf(context).card,
    builder: (ctx) => _EventCupLobbySheet(
      eventId: id,
      accessToken: accessToken,
      chrome: chrome,
      config: config ?? ApiConfig.defaults,
    ),
  );
}

class _EventCupLobbySheet extends StatefulWidget {
  const _EventCupLobbySheet({
    required this.eventId,
    required this.accessToken,
    required this.chrome,
    required this.config,
  });

  final String eventId;
  final String accessToken;
  final EventsPlayerChrome chrome;
  final ApiConfig config;

  @override
  State<_EventCupLobbySheet> createState() => _EventCupLobbySheetState();
}

class _EventCupLobbySheetState extends State<_EventCupLobbySheet> {
  HostedEvent? _event;
  List<HostedEventEntry> _entries = const [];
  List<HostedBracketMatch> _bracket = const [];
  List<HostedStandingRow> _standings = const [];
  List<ArenaStandingRow> _arenaStandings = const [];
  EventsCatalog? _catalog;
  Map<String, dynamic>? _platformEnums;
  bool _usesStandingsTable = false;
  bool _isArena = false;
  bool _arenaQueued = false;
  bool _arenaQueueBusy = false;
  bool _loading = true;
  bool _checkInBusy = false;
  bool _readyBusy = false;
  bool _startGameBusy = false;
  String? _loadError;
  Timer? _pollTimer;
  String _autoOpenedGameId = '';

  /// Stop poll/setState while the sheet exit animation runs (web close-flicker parity).
  bool _closing = false;

  Map<String, String> get _headers => {
        'Authorization': 'Bearer ${widget.accessToken}',
        'Content-Type': 'application/json',
      };

  @override
  void initState() {
    super.initState();
    unawaited(_load());
    _startPoll();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  void _startPoll() {
    _pollTimer?.cancel();
    final ms = widget.chrome.lobbyPollIntervalMsInt;
    if (ms <= 0) return;
    _pollTimer = Timer.periodic(Duration(milliseconds: ms), (_) {
      if (!mounted || _closing || _loading) return;
      unawaited(_load(silent: true));
    });
  }

  void _beginClose() {
    if (_closing) return;
    _closing = true;
    _pollTimer?.cancel();
  }

  Future<void> _load({bool silent = false}) async {
    if (_closing) return;
    if (!silent) {
      setState(() {
        _loading = true;
        _loadError = null;
      });
    }
    try {
      final base = widget.config.restUrl;
      final id = widget.eventId;
      final results = await Future.wait([
        http.get(Uri.parse('$base/events/$id'), headers: _headers),
        http.get(Uri.parse('$base/events/$id/bracket'), headers: _headers),
        http.get(Uri.parse('$base/events/$id/entries'), headers: _headers),
      ]);
      if (!mounted || _closing) return;
      if (results[0].statusCode >= 300) {
        if (silent) return;
        setState(() {
          _loading = false;
          _loadError = softCommunityLoadFailed(widget.chrome.loadFailed);
        });
        return;
      }
      final detailBody =
          jsonDecode(results[0].body) as Map<String, dynamic>? ?? {};
      final eventRaw = detailBody['event'];
      final Map<String, dynamic> eMap =
          eventRaw is Map<String, dynamic> ? eventRaw : detailBody;
      final ev = HostedEvent.fromJson(eMap);
      List<HostedBracketMatch> bracket = const [];
      if (results[1].statusCode < 300) {
        final bBody =
            jsonDecode(results[1].body) as Map<String, dynamic>? ?? {};
        bracket = (bBody['bracket'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(HostedBracketMatch.fromJson)
            .toList();
      }
      List<HostedEventEntry> entries = const [];
      if (results[2].statusCode < 300) {
        final eBody =
            jsonDecode(results[2].body) as Map<String, dynamic>? ?? {};
        entries = (eBody['entries'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(HostedEventEntry.fromJson)
            .toList();
      }
      var standings = const <HostedStandingRow>[];
      var arenaStandings = const <ArenaStandingRow>[];
      var usesTable = false;
      var isArena = false;
      EventsCatalog? catalog = _catalog;
      Map<String, dynamic>? enums;
      if (_cupStarted(ev)) {
        final enumRes = await http.get(
          Uri.parse('${widget.config.restUrl}/platform/enums'),
          headers: _headers,
        );
        if (enumRes.statusCode < 300) {
          enums = jsonDecode(enumRes.body) as Map<String, dynamic>? ?? {};
        }
        isArena = tournamentFormatIsArena(ev.formatId, enums);
        if (isArena) {
          final arRes = await http.get(
            Uri.parse('${widget.config.restUrl}/events/$id/arena/standings'),
            headers: _headers,
          );
          if (arRes.statusCode < 300) {
            final arBody =
                jsonDecode(arRes.body) as Map<String, dynamic>? ?? {};
            arenaStandings = (arBody['standings'] as List<dynamic>? ?? const [])
                .whereType<Map<String, dynamic>>()
                .map(ArenaStandingRow.fromJson)
                .toList();
          }
        } else {
          final catRes = await http.get(
            Uri.parse('${widget.config.restUrl}/events/catalog'),
            headers: _headers,
          );
          if (catRes.statusCode < 300) {
            final catBody =
                jsonDecode(catRes.body) as Map<String, dynamic>? ?? {};
            catalog = EventsCatalog.fromJson(catBody);
            final ko =
                (catBody['hosted_event_knockout_format'] as String?)?.trim() ??
                    '';
            final fid = (ev.formatId).trim();
            usesTable = fid.isNotEmpty && (ko.isEmpty || fid != ko);
          }
          // KO hides the standings table, but score_share / dual_purse still need Pts for est. share.
          final mode = ev.prizePayoutMode.trim();
          final scoreMode =
              (enums?['competition_payout_mode_score_share'] as String?)
                      ?.trim() ??
                  '';
          final dualMode =
              (enums?['competition_payout_mode_dual_purse'] as String?)
                      ?.trim() ??
                  '';
          final needsStandingsPts =
              (scoreMode.isNotEmpty && mode == scoreMode) ||
                  (dualMode.isNotEmpty && mode == dualMode);
          if (usesTable || needsStandingsPts) {
            final stRes = await http.get(
              Uri.parse('${widget.config.restUrl}/events/$id/standings'),
              headers: _headers,
            );
            if (stRes.statusCode < 300) {
              final stBody =
                  jsonDecode(stRes.body) as Map<String, dynamic>? ?? {};
              standings = (stBody['standings'] as List<dynamic>? ?? const [])
                  .whereType<Map<String, dynamic>>()
                  .map(HostedStandingRow.fromJson)
                  .toList();
            }
          }
        }
      }
      if (!mounted) return;
      setState(() {
        _event = ev;
        _bracket = bracket;
        _entries = entries;
        _standings = standings;
        _arenaStandings = arenaStandings;
        _catalog = catalog;
        _platformEnums = enums;
        _isArena = isArena;
        _usesStandingsTable = usesTable;
        _arenaQueued = ev.viewerArenaQueued;
        _loading = false;
      });
      _maybeAutoOpenBoard(bracket);
    } catch (_) {
      if (!mounted) return;
      if (silent) return;
      setState(() {
        _loading = false;
        _loadError = softCommunityLoadFailed(widget.chrome.loadFailed);
      });
    }
  }

  void _maybeAutoOpenBoard(List<HostedBracketMatch> bracket) {
    final uid = (context.read<AuthCubit>().state.userId ?? '').trim();
    if (uid.isEmpty) return;
    final next = _pickNextMatch(bracket, uid);
    final gid = (next?.gameId ?? '').trim();
    if (gid.isEmpty || gid == _autoOpenedGameId) return;
    _autoOpenedGameId = gid;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _openBoard(gid);
    });
  }

  Future<void> _startMatchGame(HostedBracketMatch match) async {
    setState(() => _startGameBusy = true);
    try {
      final res = await http.post(
        Uri.parse(
          '${widget.config.restUrl}/events/${widget.eventId}/bracket/${match.id}/start-game',
        ),
        headers: _headers,
        body: '{}',
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        final msg = _playerApiErrSnack(
            res, softCommunityLoadFailed(widget.chrome.loadFailed));
        if (msg.isNotEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(msg)));
        }
        return;
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>? ?? {};
      final gameId = (body['game_id'] as String?)?.trim() ??
          ((body['match'] is Map)
              ? ((body['match'] as Map)['game_id']?.toString().trim())
              : null);
      await _load(silent: true);
      if (!mounted) return;
      if (gameId != null && gameId.isNotEmpty) {
        _autoOpenedGameId = gameId;
        _openBoard(gameId);
      }
    } finally {
      if (mounted) setState(() => _startGameBusy = false);
    }
  }

  Future<void> _openReport() async {
    final chrome = widget.chrome;
    final catalog = _catalog;
    if (!chrome.isReportReady ||
        catalog == null ||
        catalog.reportReasonCodes.isEmpty) {
      return;
    }
    await showEventReportDialog(
      context,
      accessToken: widget.accessToken,
      eventId: widget.eventId,
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

  Future<void> _checkIn() async {
    setState(() => _checkInBusy = true);
    try {
      final res = await http.post(
        Uri.parse('${widget.config.restUrl}/events/${widget.eventId}/check-in'),
        headers: _headers,
        body: '{}',
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        // Web EventCupLobby parity: map error_key, never always "not open".
        var key = '';
        try {
          final decoded = jsonDecode(res.body);
          if (decoded is Map && decoded['error_key'] is String) {
            key = (decoded['error_key'] as String).trim();
          }
        } catch (_) {}
        final chrome = widget.chrome;
        final msg = key == 'check_in_not_open'
            ? softCommunityJoinStatusMessage(chrome.checkInNotOpen)
            : key == 'check_in_closed'
                ? softCommunityJoinStatusMessage(chrome.checkInClosed)
                : softCommunityLoadFailed(chrome.loadFailed).trim();
        if (msg.isNotEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(msg)));
        }
      } else {
        final ok = softCommunityJoinStatusMessage(widget.chrome.checkInSuccess);
        if (ok.isNotEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(ok)));
        }
        await _load();
      }
    } finally {
      if (mounted) setState(() => _checkInBusy = false);
    }
  }

  Future<void> _markReady(HostedBracketMatch match) async {
    setState(() => _readyBusy = true);
    try {
      final res = await http.post(
        Uri.parse(
          '${widget.config.restUrl}/events/${widget.eventId}/bracket/${match.id}/ready',
        ),
        headers: _headers,
        body: '{}',
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        final msg = _playerApiErrSnack(
            res, softCommunityLoadFailed(widget.chrome.loadFailed));
        if (msg.isNotEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(msg)));
        }
        return;
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>? ?? {};
      final ok = softCommunityJoinStatusMessage(widget.chrome.readySuccess);
      if (ok.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ok)));
      }
      final gameId = (body['game_id'] as String?)?.trim() ??
          ((body['match'] is Map)
              ? ((body['match'] as Map)['game_id']?.toString().trim())
              : null);
      await _load();
      if (!mounted) return;
      if (gameId != null && gameId.isNotEmpty) {
        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => MatchBoardPage(
              accessToken: widget.accessToken,
              gameId: gameId,
              mode: 'pvp',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _readyBusy = false);
    }
  }

  Future<void> _joinArenaQueue() async {
    setState(() => _arenaQueueBusy = true);
    try {
      final res = await http.post(
        Uri.parse(
          '${widget.config.restUrl}/events/${widget.eventId}/arena/queue',
        ),
        headers: _headers,
        body: '{}',
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        var key = '';
        var apiErr = '';
        try {
          final decoded = jsonDecode(res.body);
          if (decoded is Map) {
            if (decoded['error_key'] is String) {
              key = (decoded['error_key'] as String).trim();
            }
            if (decoded['error'] is String) {
              apiErr = (decoded['error'] as String).trim();
              if (apiErr.startsWith('{') || apiErr.startsWith('[')) {
                apiErr = '';
              }
            }
          }
        } catch (_) {}
        final chrome = widget.chrome;
        final msg = key == 'toast_arena_queue_failed'
            ? (chrome.toastArenaQueueFailed.isNotEmpty
                ? softCommunityJoinStatusMessage(chrome.toastArenaQueueFailed)
                : (apiErr.isNotEmpty
                    ? softCommunityJoinStatusMessage(apiErr)
                    : softCommunityLoadFailed(chrome.loadFailed)))
            : (apiErr.isNotEmpty
                ? softCommunityJoinStatusMessage(apiErr)
                : softCommunityLoadFailed(chrome.loadFailed));
        if (msg.trim().isNotEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(msg.trim())));
        }
        return;
      }
      setState(() => _arenaQueued = true);
      final ok = softCommunityJoinStatusMessage(widget.chrome.arenaQueueDone);
      if (ok.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ok)));
      }
      await _load(silent: true);
    } finally {
      if (mounted) setState(() => _arenaQueueBusy = false);
    }
  }

  Future<void> _leaveArenaQueue() async {
    setState(() => _arenaQueueBusy = true);
    try {
      final res = await http.post(
        Uri.parse(
          '${widget.config.restUrl}/events/${widget.eventId}/arena/queue/leave',
        ),
        headers: _headers,
        body: '{}',
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        var key = '';
        var apiErr = '';
        try {
          final decoded = jsonDecode(res.body);
          if (decoded is Map) {
            if (decoded['error_key'] is String) {
              key = (decoded['error_key'] as String).trim();
            }
            if (decoded['error'] is String) {
              apiErr = (decoded['error'] as String).trim();
              if (apiErr.startsWith('{') || apiErr.startsWith('[')) {
                apiErr = '';
              }
            }
          }
        } catch (_) {}
        final chrome = widget.chrome;
        final msg = key == 'toast_arena_queue_failed'
            ? (chrome.toastArenaQueueFailed.isNotEmpty
                ? softCommunityJoinStatusMessage(chrome.toastArenaQueueFailed)
                : (apiErr.isNotEmpty
                    ? softCommunityJoinStatusMessage(apiErr)
                    : softCommunityLoadFailed(chrome.loadFailed)))
            : (apiErr.isNotEmpty
                ? softCommunityJoinStatusMessage(apiErr)
                : softCommunityLoadFailed(chrome.loadFailed));
        if (msg.trim().isNotEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(msg.trim())));
        }
        return;
      }
      setState(() => _arenaQueued = false);
      final ok = softCommunityJoinStatusMessage(widget.chrome.arenaLeftBlurb);
      if (ok.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ok)));
      }
      await _load(silent: true);
    } finally {
      if (mounted) setState(() => _arenaQueueBusy = false);
    }
  }

  String? _estPrizeShareLine(HostedEvent? ev, String myUserId) {
    if (ev == null) return null;
    final chrome = widget.chrome;
    final poolLines = hostedEventPrizePoolLines(
      ev,
      PrizePoolCardLabels.fromPlayer(chrome),
    );
    if (poolLines.isEmpty || ev.prizePayoutMode.trim().isEmpty) return null;
    if (chrome.estPrizeShareLabel.trim().isEmpty ||
        chrome.estPrizeShareBlurb.trim().isEmpty) {
      return null;
    }
    final enums = _platformEnums;
    if (enums == null) return null;
    final placesMode =
        (enums['competition_payout_mode_places_percent'] as String?)?.trim() ??
            '';
    final scoreMode =
        (enums['competition_payout_mode_score_share'] as String?)?.trim() ?? '';
    final dualMode =
        (enums['competition_payout_mode_dual_purse'] as String?)?.trim() ?? '';
    final dualPlacePursePercent = double.tryParse(
      (enums['competition_dual_purse_place_percent'] as String?)?.trim() ?? '',
    );
    double? myPoints;
    var totalPoints = 0.0;
    if (_isArena) {
      for (final r in _arenaStandings) {
        final pts = r.arenaPoints;
        if (!pts.isFinite || pts <= 0) continue;
        totalPoints += pts;
        if (r.userId.trim() == myUserId) myPoints = pts;
      }
    } else {
      for (final r in _standings) {
        final pts = r.points.toDouble();
        if (!pts.isFinite || pts <= 0) continue;
        totalPoints += pts;
        if (r.userId.trim() == myUserId) myPoints = pts;
      }
    }
    int? placement;
    for (final e in _entries) {
      if (e.userId.trim() == myUserId && e.placement != null) {
        placement = e.placement;
        break;
      }
    }
    if (placement == null && _isArena) {
      final arenaIdx =
          _arenaStandings.indexWhere((r) => r.userId.trim() == myUserId);
      if (arenaIdx >= 0) {
        placement = _arenaStandings[arenaIdx].placement ?? (arenaIdx + 1);
      }
    }
    if (placement == null && !_isArena) {
      for (final r in _standings) {
        if (r.userId.trim() == myUserId && r.placement != null) {
          placement = r.placement;
          break;
        }
      }
    }
    final amount = computeEstPrizeShare(
      mode: ev.prizePayoutMode,
      placesMode: placesMode,
      scoreMode: scoreMode,
      dualMode: dualMode,
      dualPlacePursePercent: dualPlacePursePercent,
      potNow: ev.prizePoolNow,
      myPoints: myPoints,
      totalPoints: totalPoints > 0 ? totalPoints : null,
      myPlacement: placement,
      placePercents: ev.prizePlacePercents,
    );
    if (amount == null) return null;
    final line = formatEstPrizeShareLine(
      label: chrome.estPrizeShareLabel.trim(),
      amount: amount,
      currency: ev.prizePoolCurrency.trim(),
      amountCurrencySeparator: chrome.amountCurrencySeparator,
      metaSeparator: chrome.metaSeparator,
    );
    if (line == null) return null;
    return '$line - ${softCommunityEstPrizeShareBlurb(chrome.estPrizeShareBlurb)}';
  }

  void _openBoard(String gameId) {
    final gid = gameId.trim();
    if (gid.isEmpty) return;
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => MatchBoardPage(
          accessToken: widget.accessToken,
          gameId: gid,
          mode: 'pvp',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final chrome = widget.chrome;
    final tokens = damaColorsOf(context);
    final empty = chrome.emptyValue.trim();
    final sep = chrome.metaSeparator;
    final myUserId = (context.read<AuthCubit>().state.userId ?? '').trim();
    final ev = _event;
    final started = _cupStarted(ev);
    final isArena = _isArena;
    final arenaActive = arenaClockActive(ev?.arenaEndsAt);
    // Only server finished_at counts - timer expiry alone must not fake a finished cup.
    final arenaFinished =
        isArena && started && (ev?.finishedAt ?? '').trim().isNotEmpty;
    final checkInState = _checkInWindow(ev);
    HostedEventEntry? myEntry;
    for (final e in _entries) {
      if (e.userId.trim() == myUserId) {
        myEntry = e;
        break;
      }
    }
    final checkedIn = (myEntry?.checkedInAt ?? '').trim().isNotEmpty;
    final next = _pickNextMatch(_bracket, myUserId);
    final gameId = (next?.gameId ?? '').trim();
    final estShareLine = _estPrizeShareLine(ev, myUserId);
    final lifecycleStatus = cupLifecycleStatusLabel(
      CupLifecycleFields(
        startedAt: ev?.startedAt,
        finishedAt: ev?.finishedAt,
      ),
      CupLifecycleLabelChrome(
        openLabel: chrome.filterLifecycleOpenLabel,
        liveLabel: chrome.filterLifecycleLiveLabel,
        finishedLabel: chrome.filterLifecycleFinishedLabel,
      ),
      fallback: (ev?.statusLabel ?? ev?.status ?? '').trim(),
    );

    var myReady = false;
    var oppReady = false;
    if (next != null && myUserId.isNotEmpty) {
      if ((next.playerAId ?? '').trim() == myUserId) {
        myReady = (next.playerAReadyAt ?? '').trim().isNotEmpty;
        oppReady = (next.playerBReadyAt ?? '').trim().isNotEmpty;
      } else if ((next.playerBId ?? '').trim() == myUserId) {
        myReady = (next.playerBReadyAt ?? '').trim().isNotEmpty;
        oppReady = (next.playerAReadyAt ?? '').trim().isNotEmpty;
      }
    }

    final h = MediaQuery.sizeOf(context).height * 0.92;

    if (isArena && !chrome.cupLobbyReadyForFormat(isArena: true)) {
      return PopScope(
        onPopInvokedWithResult: (didPop, _) {
          if (didPop) _beginClose();
        },
        child: SizedBox(
          height: h,
          child: Center(
            child: Text(softCommunityLobbyUnavailable(chrome.lobbyUnavailable)),
          ),
        ),
      );
    }

    return PopScope(
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) _beginClose();
      },
      child: SizedBox(
        height: h,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isArena
                              ? softCommunityArenaLobbyTitle(
                                  chrome.arenaLobbyTitle)
                              : softCommunityLobbyTitle(chrome.lobbyTitle),
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        if ((isArena
                                ? chrome.arenaLobbyBlurb
                                : chrome.lobbyBlurb)
                            .isNotEmpty)
                          Text(
                            isArena
                                ? softCommunityArenaLobbyBlurb(
                                    chrome.arenaLobbyBlurb)
                                : softCommunityLobbyBlurb(chrome.lobbyBlurb),
                            style: TextStyle(
                              color: tokens.onSurfaceMuted,
                              fontSize: 12,
                            ),
                          ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () {
                      _beginClose();
                      Navigator.of(context).pop();
                    },
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: _loading
                  ? const Padding(
                      padding: EdgeInsets.all(16),
                      child: GameLobbySkeleton(),
                    )
                  : _loadError != null
                      ? Center(child: Text(_loadError!))
                      : ListView(
                          padding: const EdgeInsets.all(16),
                          children: [
                            if (ev != null) ...[
                              Builder(
                                builder: (context) {
                                  final images = ev.carouselImages;
                                  final brand = (ev.brandColor ?? '').trim();
                                  Color fallback = tokens.surfaceMuted;
                                  if (brand.isNotEmpty) {
                                    final hex = brand.startsWith('#')
                                        ? brand.substring(1)
                                        : brand;
                                    final parsed = int.tryParse(
                                      hex.length == 6 ? 'FF$hex' : hex,
                                      radix: 16,
                                    );
                                    if (parsed != null) {
                                      fallback = Color(parsed);
                                    }
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
                                              child:
                                                  ColoredBox(color: fallback),
                                            )
                                          : GalleryCarousel(
                                              images: images,
                                              semanticsLabel:
                                                  softCommunityCarouselAria(
                                                chrome.carouselAria,
                                              ),
                                              aspectRatio: 16 / 10,
                                            ),
                                    ),
                                  );
                                },
                              ),
                            ],
                            Text(
                              (ev?.title ?? '').trim().isNotEmpty
                                  ? ev!.title.trim()
                                  : empty,
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 16,
                              ),
                            ),
                            if (lifecycleStatus.isNotEmpty)
                              Text(
                                lifecycleStatus,
                                style: TextStyle(color: tokens.onSurfaceMuted),
                              ),
                            if ((ev?.description ?? '').trim().isNotEmpty) ...[
                              const SizedBox(height: 8),
                              if (chrome.detailDescriptionLabel
                                  .trim()
                                  .isNotEmpty)
                                Text(
                                  chrome.detailDescriptionLabel.trim(),
                                  style: TextStyle(
                                    color: tokens.onSurfaceMuted,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              Text(
                                ev!.description.trim(),
                                style: TextStyle(
                                  color:
                                      Theme.of(context).colorScheme.onSurface,
                                  fontSize: 13,
                                  height: 1.35,
                                ),
                              ),
                            ],
                            if (estShareLine != null) ...[
                              const SizedBox(height: 6),
                              Text(
                                estShareLine,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: tokens.brand,
                                ),
                              ),
                            ],
                            // Escrow opened (paid pot). Free/no-escrow finishes omit disputeWindowEndsAt.
                            if ((ev?.prizeSettledAt ?? '')
                                .trim()
                                .isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Text(
                                softCommunityJoinStatusMessage(
                                  chrome.prizeSettledBlurb,
                                ),
                                style: TextStyle(
                                  fontSize: 13,
                                  color: tokens.brand,
                                ),
                              ),
                            ] else if ((ev?.disputeWindowEndsAt ?? '')
                                .trim()
                                .isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Text(
                                softCommunityPrizePendingBlurb(
                                  chrome.prizePendingBlurb,
                                ),
                                style: TextStyle(
                                  fontSize: 13,
                                  color: tokens.onSurfaceMuted,
                                ),
                              ),
                            ],
                            if (myEntry != null &&
                                started &&
                                chrome.isReportReady &&
                                (_catalog?.reportReasonCodes.isNotEmpty ??
                                    false)) ...[
                              const SizedBox(height: 12),
                              OutlinedButton(
                                onPressed: _openReport,
                                child: Text(
                                  softHostingReportAction(chrome.reportAction),
                                ),
                              ),
                            ],
                            if (!started && myEntry != null) ...[
                              const SizedBox(height: 12),
                              if (softCommunityJoinStatusMessage(
                                chrome.checkInRequiredBlurb,
                              ).isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 8),
                                  child: Text(
                                    softCommunityJoinStatusMessage(
                                      chrome.checkInRequiredBlurb,
                                    ),
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: tokens.onSurfaceMuted,
                                    ),
                                  ),
                                ),
                              if (checkedIn)
                                Text(
                                  chrome.checkInDone,
                                  style: TextStyle(color: tokens.brand),
                                )
                              else if (checkInState ==
                                  _CheckInWindowState.notOpen)
                                Text(
                                  softCommunityJoinStatusMessage(
                                    chrome.checkInNotOpen,
                                  ),
                                  style:
                                      TextStyle(color: tokens.onSurfaceMuted),
                                )
                              else if (checkInState ==
                                  _CheckInWindowState.closed)
                                Text(
                                  softCommunityJoinStatusMessage(
                                    chrome.checkInClosed,
                                  ),
                                  style:
                                      TextStyle(color: tokens.onSurfaceMuted),
                                )
                              else
                                FilledButton(
                                  onPressed: _checkInBusy ? null : _checkIn,
                                  child: Text(
                                    _checkInBusy
                                        ? chrome.checkInPending
                                        : chrome.checkInAction,
                                  ),
                                ),
                            ],
                            if (isArena && started && myEntry != null) ...[
                              const SizedBox(height: 12),
                              if (arenaFinished)
                                Text(
                                  chrome.arenaFinishedBlurb,
                                  style:
                                      TextStyle(color: tokens.onSurfaceMuted),
                                )
                              else ...[
                                if (arenaActive &&
                                    formatArenaClock(ev?.arenaEndsAt)
                                        .isNotEmpty)
                                  Text(
                                    '${chrome.arenaClockLabel} ${formatArenaClock(ev?.arenaEndsAt)}',
                                    style: TextStyle(color: tokens.brand),
                                  ),
                                if (arenaActive) const SizedBox(height: 8),
                                if (gameId.isNotEmpty)
                                  FilledButton(
                                    onPressed: () => _openBoard(gameId),
                                    child: Text(chrome.lobbyOpenPlayAction),
                                  )
                                else if (arenaActive && _arenaQueued)
                                  Wrap(
                                    spacing: 8,
                                    crossAxisAlignment:
                                        WrapCrossAlignment.center,
                                    children: [
                                      Text(
                                        chrome.arenaWaitingPair,
                                        style: TextStyle(
                                          color: tokens.onSurfaceMuted,
                                        ),
                                      ),
                                      OutlinedButton(
                                        onPressed: _arenaQueueBusy
                                            ? null
                                            : _leaveArenaQueue,
                                        child: Text(
                                          _arenaQueueBusy
                                              ? chrome.arenaLeaveQueuePending
                                              : chrome.arenaLeaveQueueAction,
                                        ),
                                      ),
                                    ],
                                  )
                                else if (arenaActive)
                                  FilledButton(
                                    onPressed: _arenaQueueBusy
                                        ? null
                                        : _joinArenaQueue,
                                    child: Text(
                                      _arenaQueueBusy
                                          ? chrome.arenaQueuePending
                                          : chrome.arenaQueueAction,
                                    ),
                                  ),
                              ],
                            ],
                            if (!isArena &&
                                started &&
                                next == null &&
                                gameId.isEmpty) ...[
                              const SizedBox(height: 12),
                              Text(
                                chrome.lobbyWaitingStart,
                                style: TextStyle(color: tokens.onSurfaceMuted),
                              ),
                            ],
                            if (!isArena && next != null) ...[
                              const SizedBox(height: 16),
                              Text(
                                chrome.lobbyNextMatchTitle,
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  color: tokens.brand,
                                ),
                              ),
                              Text(
                                '${(next.playerAUsername).trim().isNotEmpty ? next.playerAUsername.trim() : empty}$sep${(next.playerBUsername).trim().isNotEmpty ? next.playerBUsername.trim() : empty}',
                                style: TextStyle(color: tokens.onSurfaceMuted),
                              ),
                              const SizedBox(height: 8),
                              if (gameId.isEmpty &&
                                  softCommunityJoinStatusMessage(
                                    chrome.readyTimeoutBlurb,
                                  ).isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 8),
                                  child: Text(
                                    softCommunityJoinStatusMessage(
                                      chrome.readyTimeoutBlurb,
                                    ),
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: tokens.onSurfaceMuted,
                                    ),
                                  ),
                                ),
                              if (gameId.isNotEmpty)
                                FilledButton(
                                  onPressed: () => _openBoard(gameId),
                                  child: Text(chrome.lobbyOpenPlayAction),
                                )
                              else if (myReady && oppReady)
                                FilledButton(
                                  onPressed: _startGameBusy
                                      ? null
                                      : () => unawaited(_startMatchGame(next)),
                                  child: Text(
                                    _startGameBusy
                                        ? chrome.readyPending
                                        : chrome.lobbyOpenPlayAction,
                                  ),
                                )
                              else if (myReady)
                                Text(
                                  softCommunityJoinStatusMessage(
                                    chrome.readyWaitingOpponent,
                                  ),
                                  style: TextStyle(color: tokens.brand),
                                )
                              else
                                OutlinedButton(
                                  onPressed: _readyBusy
                                      ? null
                                      : () => unawaited(_markReady(next)),
                                  child: Text(
                                    _readyBusy
                                        ? chrome.readyPending
                                        : chrome.readyAction,
                                  ),
                                ),
                            ],
                            if (_entries.isNotEmpty) ...[
                              const SizedBox(height: 16),
                              Text(
                                softCommunityRosterTitle(
                                    chrome.lobbyRosterTitle),
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  color: tokens.brand,
                                ),
                              ),
                              ..._entries.map(
                                (e) => ListTile(
                                  dense: true,
                                  title: Text(
                                    e.username.trim().isNotEmpty
                                        ? e.username.trim()
                                        : empty,
                                  ),
                                  trailing:
                                      (e.checkedInAt ?? '').trim().isNotEmpty
                                          ? Text(
                                              chrome.checkInDone,
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: tokens.brand,
                                              ),
                                            )
                                          : null,
                                ),
                              ),
                            ],
                            if (isArena && _arenaStandings.isNotEmpty) ...[
                              const SizedBox(height: 16),
                              Text(
                                softCompetitionArenaStandingsTitle(
                                  chrome.arenaStandingsTitle,
                                ),
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  color: tokens.brand,
                                ),
                              ),
                              ..._arenaStandings.map(
                                (r) => ListTile(
                                  dense: true,
                                  title: Text(
                                    r.username.trim().isNotEmpty
                                        ? r.username.trim()
                                        : empty,
                                  ),
                                  trailing: Text(
                                    '${softCompetitionPointsLabel(chrome.arenaPointsLabel)} ${r.arenaPoints}  ${softCompetitionArenaStreakLabel(chrome.arenaStreakLabel)} ${r.arenaStreak}',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: tokens.onSurfaceMuted,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                            if (_usesStandingsTable &&
                                _standings.isNotEmpty) ...[
                              const SizedBox(height: 16),
                              EventStandingsView(
                                standings: _standings,
                                standingsTitle: chrome.lobbyStandingsTitle,
                                playedLabel: chrome.standingsPlayedLabel,
                                winsLabel: chrome.standingsWinsLabel,
                                lossesLabel: chrome.standingsLossesLabel,
                                pointsLabel: chrome.standingsPointsLabel,
                                emptyValue: chrome.emptyValue,
                                groupLabelTemplate: chrome.groupLabelTemplate,
                              ),
                            ] else if (_entries
                                .any((e) => e.placement != null)) ...[
                              const SizedBox(height: 16),
                              Text(
                                chrome.lobbyStandingsTitle,
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  color: tokens.brand,
                                ),
                              ),
                              ...() {
                                final placed = _entries
                                    .where((e) => e.placement != null)
                                    .toList()
                                  ..sort(
                                    (a, b) => (a.placement ?? 0)
                                        .compareTo(b.placement ?? 0),
                                  );
                                return placed.map(
                                  (e) => ListTile(
                                    dense: true,
                                    leading: Text('${e.placement}'),
                                    title: Text(
                                      e.username.trim().isNotEmpty
                                          ? e.username.trim()
                                          : empty,
                                    ),
                                  ),
                                );
                              }(),
                            ],
                            if (_bracket.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Text(
                                softCommunityBracketTitle(
                                    chrome.lobbyBracketTitle),
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  color: tokens.brand,
                                ),
                              ),
                              ..._bracket.map(
                                (m) {
                                  final gid = (m.gameId ?? '').trim();
                                  return ListTile(
                                    dense: true,
                                    title: Text(
                                      '${m.roundIndex + 1}/${m.matchIndex + 1} ${(m.statusLabel).trim().isNotEmpty ? m.statusLabel.trim() : empty}',
                                    ),
                                    subtitle: m.isBye
                                        ? null
                                        : Text(
                                            '${m.playerAUsername.trim().isNotEmpty ? m.playerAUsername.trim() : empty}$sep${m.playerBUsername.trim().isNotEmpty ? m.playerBUsername.trim() : empty}',
                                          ),
                                    trailing: gid.isEmpty
                                        ? null
                                        : TextButton(
                                            onPressed: () {
                                              Navigator.of(context).push(
                                                MaterialPageRoute<void>(
                                                  builder: (_) => SpectatePage(
                                                    accessToken:
                                                        widget.accessToken,
                                                    initialGameId: gid,
                                                  ),
                                                ),
                                              );
                                            },
                                            child: Text(
                                              softCommunitySpectateAction(
                                                chrome.spectateAction,
                                              ),
                                            ),
                                          ),
                                  );
                                },
                              ),
                              if (started &&
                                  !_bracket.any(
                                    (m) => (m.gameId ?? '').trim().isNotEmpty,
                                  ) &&
                                  chrome.lobbyNoLiveBoards.trim().isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(top: 8),
                                  child: Text(
                                    chrome.lobbyNoLiveBoards.trim(),
                                    style: TextStyle(
                                      color: tokens.onSurfaceMuted,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                            ],
                          ],
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
