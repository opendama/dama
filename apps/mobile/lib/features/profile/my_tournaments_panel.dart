import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/cache/skip_store.dart';
import 'package:dama_mobile/core/cup_lifecycle.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/skip_pagination_bar.dart';
import 'package:dama_mobile/features/leaderboard/leaderboard_cubit.dart'
    show SkipMeta;
import 'package:dama_mobile/features/tournaments/tournaments_page.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

/// Profile/dashboard tournament memory: cups the viewer joined → same lobby deep link.
/// Complements match history with place / points / streak / prize from the API.
class MyTournamentsPanel extends StatefulWidget {
  MyTournamentsPanel({
    super.key,
    required this.accessToken,
    ApiConfig? config,
    this.skipStoreKey = 'profile_my_cups',
  }) : config = config ?? ApiConfig.defaults;

  final String accessToken;
  final ApiConfig config;
  final String skipStoreKey;

  @override
  State<MyTournamentsPanel> createState() => MyTournamentsPanelState();
}

class MyTournamentsPanelState extends State<MyTournamentsPanel> {
  TournamentsPlayerChrome? _chrome;
  List<RestTournament> _rows = const [];
  SkipMeta? _meta;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    unawaited(_bootstrap());
  }

  Future<void> reload() => _bootstrap();

  bool _sectionVisible(TournamentsPlayerChrome? c) {
    if (c == null || !c.isReady) return false;
    return c.myTournamentsTitle.isNotEmpty &&
        c.myTournamentsEmpty.isNotEmpty &&
        c.myTournamentsOpenAction.isNotEmpty &&
        c.myTournamentsPlaceLabel.isNotEmpty &&
        c.myTournamentsPointsLabel.isNotEmpty &&
        c.myTournamentsStreakLabel.isNotEmpty &&
        c.myTournamentsPrizeLabel.isNotEmpty;
  }

  CupCardCtaLabels _ctaLabels(TournamentsPlayerChrome chrome) {
    return CupCardCtaLabels(
      joinAction: chrome.joinAction,
      enrollAction: chrome.enrollAction,
      lobbyAction: chrome.lobbyAction,
      watchAction: chrome.watchAction,
      resultsAction: chrome.resultsAction,
    );
  }

  String _lifecycleLabel(
      TournamentsPlayerChrome chrome, CupLifecyclePhase phase) {
    switch (phase) {
      case CupLifecyclePhase.open:
        return chrome.filterLifecycleOpenLabel;
      case CupLifecyclePhase.live:
        return chrome.filterLifecycleLiveLabel;
      case CupLifecyclePhase.finished:
        return chrome.filterLifecycleFinishedLabel;
    }
  }

  Future<void> _bootstrap() async {
    try {
      final res = await http.get(
        Uri.parse('${widget.config.restUrl}/public/tournaments-player-chrome'),
      );
      Map<String, dynamic>? map;
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) map = decoded;
      } catch (_) {}
      final chrome = TournamentsPlayerChrome.fromJson(map);
      if (!mounted) return;
      setState(() {
        _chrome = chrome;
        _loading = false;
      });
      if (_sectionVisible(chrome) && chrome!.listPageSizeInt > 0) {
        await _load(SkipStore.read(widget.skipStoreKey));
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _load(int skip) async {
    final chrome = _chrome;
    if (!_sectionVisible(chrome)) return;
    final limit = chrome!.listPageSizeInt;
    if (limit < 1) return;
    if (mounted) setState(() => _loading = true);
    try {
      final uri = Uri.parse('${widget.config.restUrl}/tournaments').replace(
        queryParameters: {
          'skip': '$skip',
          'limit': '$limit',
          'lifecycle': 'all',
          'mine': '1',
        },
      );
      final res = await http.get(
        uri,
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      if (res.statusCode >= 300) {
        if (mounted) setState(() => _loading = false);
        return;
      }
      final json = jsonDecode(res.body) as Map<String, dynamic>;
      final list = (json['tournaments'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(RestTournament.fromJson)
          .where((t) => t.id.isNotEmpty)
          .toList();
      final metaMap = json['meta'];
      final meta =
          metaMap is Map<String, dynamic> ? SkipMeta.fromJson(metaMap) : null;
      if (!mounted) return;
      setState(() {
        _rows = list;
        _meta = meta;
        _loading = false;
      });
      unawaited(SkipStore.write(widget.skipStoreKey, skip));
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _open(RestTournament t) {
    if (t.id.isEmpty) return;
    unawaited(
      Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => TournamentsPage(
            accessToken: widget.accessToken,
            config: widget.config,
            focusId: t.id,
            initialSource: 'official',
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final chrome = _chrome;
    if (!_sectionVisible(chrome)) return const SizedBox.shrink();
    final tokens = damaColorsOf(context);
    final tChrome = chrome!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          tChrome.myTournamentsTitle,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        if (_rows.isEmpty && !_loading)
          Text(
            tChrome.myTournamentsEmpty,
            style: TextStyle(color: tokens.onSurfaceMuted),
          )
        else
          SizedBox(
            height: 220,
            child: ListView.separated(
              itemCount: _rows.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final t = _rows[i];
                final phase = cupLifecyclePhase(
                  CupLifecycleFields(
                    startedAt: t.startedAt,
                    finishedAt: t.finishedAt,
                  ),
                );
                final status = _lifecycleLabel(tChrome, phase);
                final metaParts = <String>[];
                if (status.trim().isNotEmpty) metaParts.add(status);
                final placement = t.viewerPlacement;
                if (placement != null && placement > 0) {
                  metaParts
                      .add('${tChrome.myTournamentsPlaceLabel} $placement');
                }
                final points = t.viewerArenaPoints;
                if (points != null) {
                  metaParts.add('${tChrome.myTournamentsPointsLabel} $points');
                }
                final streak = t.viewerArenaStreak;
                if (streak != null && streak > 0) {
                  metaParts.add('${tChrome.myTournamentsStreakLabel} $streak');
                }
                final prizeAmt = t.viewerPrizeAmount;
                if (prizeAmt != null && prizeAmt > 0) {
                  final cur = (t.viewerPrizeCurrency ?? '').trim();
                  final sep = tChrome.amountCurrencySeparator;
                  final amt = cur.isNotEmpty && sep.isNotEmpty
                      ? '$prizeAmt$sep$cur'
                      : '$prizeAmt';
                  metaParts.add('${tChrome.myTournamentsPrizeLabel} $amt');
                }
                final sep = tChrome.metaSeparator;
                final metaSubtitle = sep.isNotEmpty && metaParts.isNotEmpty
                    ? metaParts.join(sep)
                    : '';
                final cta = resolveCupCardCta(
                  CupLifecycleFields(
                    startedAt: t.startedAt,
                    finishedAt: t.finishedAt,
                  ),
                  enrolled: true,
                  isFree: t.isFree,
                  labels: _ctaLabels(tChrome),
                );
                final actionLabel = cta.label.trim().isNotEmpty
                    ? cta.label
                    : tChrome.myTournamentsOpenAction;
                return ListTile(
                  dense: true,
                  title: Text(t.title, overflow: TextOverflow.ellipsis),
                  subtitle: metaSubtitle.isEmpty
                      ? null
                      : Text(
                          metaSubtitle,
                          style: TextStyle(
                            color: tokens.onSurfaceMuted,
                            fontSize: 12,
                          ),
                        ),
                  trailing: OutlinedButton(
                    onPressed: () => _open(t),
                    child: Text(actionLabel),
                  ),
                );
              },
            ),
          ),
        if (_meta != null && _meta!.totalPages > 1)
          SkipPaginationBar(
            meta: _meta!,
            busy: _loading,
            padding: const EdgeInsets.only(top: 8),
            onSkip: (skip) => unawaited(_load(skip)),
          ),
      ],
    );
  }
}
