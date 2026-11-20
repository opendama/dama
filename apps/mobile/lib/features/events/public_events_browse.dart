import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/cache/skip_store.dart';
import 'package:dama_mobile/core/cup_lifecycle.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/skip_pagination_bar.dart';
import 'package:dama_mobile/features/events/community_player_chrome_soft.dart';
import 'package:dama_mobile/features/events/event_mini_card.dart';
import 'package:dama_mobile/features/events/hosting_organizer_chrome_soft.dart';
import 'package:dama_mobile/features/leaderboard/leaderboard_cubit.dart'
    show SkipMeta;
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

enum EventEntryFilter { all, free, paid }

/// Legacy standalone public cups grid (`GET /events/public`).
/// Player discovery is unified under Tournaments → Community - do not mount
/// this as a second browse. Kept for [EventEntryFilter] reuse; unused in routes.
class PublicEventsBrowse extends StatefulWidget {
  const PublicEventsBrowse({
    super.key,
    required this.listTitle,
    required this.listBlurb,
    required this.listEmpty,
    required this.joinOpenAction,
    required this.loadFailed,
    required this.metaSeparator,
    required this.listPageSize,
    required this.emptyValue,
    required this.filterAllLabel,
    required this.filterFreeLabel,
    required this.filterPaidLabel,
    required this.filterEntryLabel,
    required this.searchLabel,
    required this.searchPlaceholder,
    this.reportAction = '',
    this.watchAction = '',
    this.resultsAction = '',
    this.lobbyAction = '',
    this.joinedIds,
    this.prizePoolLabels,
    this.carouselAria = '',
    this.playersLabel = '',
    this.unlimitedPlayersLabel = '',
    this.entryLabel = '',
    this.freeLabel = '',
    this.hostedByLabel = '',
    this.amountCurrencySeparator = '',
    this.hostRepFinishedLabel = '',
    this.hostRepCancelledLabel = '',
    this.hostRepReportsLabel = '',
    this.hostRepMetaSeparator = '',
    this.searchDebounceMs = '',
    this.filtersToggleLabel = '',
    this.filtersToggleShowAria = '',
    this.filtersToggleHideAria = '',
    this.onJoin,
    this.onOpen,
    this.onReport,
  });

  final String listTitle;
  final String listBlurb;
  final String listEmpty;
  final String joinOpenAction;
  final String watchAction;
  final String resultsAction;
  final String lobbyAction;
  final Set<String>? joinedIds;
  final String loadFailed;
  final String metaSeparator;

  /// Positive page size from DB chrome `list_page_size`.
  final int listPageSize;
  final String emptyValue;
  final String filterAllLabel;
  final String filterFreeLabel;
  final String filterPaidLabel;
  final String filterEntryLabel;
  final String searchLabel;
  final String searchPlaceholder;
  final String reportAction;
  final PrizePoolCardLabels? prizePoolLabels;
  final String carouselAria;
  final String playersLabel;
  final String unlimitedPlayersLabel;
  final String entryLabel;
  final String freeLabel;
  final String hostedByLabel;
  final String amountCurrencySeparator;
  final String hostRepFinishedLabel;
  final String hostRepCancelledLabel;
  final String hostRepReportsLabel;
  final String hostRepMetaSeparator;

  /// Chrome `search_debounce_ms` (fail-closed: empty → 0).
  final String searchDebounceMs;
  final String filtersToggleLabel;
  final String filtersToggleShowAria;
  final String filtersToggleHideAria;
  final void Function(HostedEvent event)? onJoin;
  final void Function(HostedEvent event)? onOpen;
  final void Function(HostedEvent event)? onReport;

  @override
  State<PublicEventsBrowse> createState() => _PublicEventsBrowseState();
}

class _PublicEventsBrowseState extends State<PublicEventsBrowse> {
  bool _loading = true;
  bool _softFetching = false;
  bool _filtersVisible = true;
  String _error = '';
  List<HostedEvent> _events = const [];
  SkipMeta? _meta;
  static const _skipKey = 'events_public';
  int _skip = 0;
  EventEntryFilter _entryFilter = EventEntryFilter.all;
  String _searchQ = '';
  final _searchCtrl = TextEditingController();
  Timer? _searchDebounce;

  int get _debounceMs {
    final n = int.tryParse(widget.searchDebounceMs.trim());
    return n != null && n >= 0 ? n : 0;
  }

  bool get _hasFilterToggle =>
      widget.filtersToggleLabel.trim().isNotEmpty &&
      widget.filtersToggleShowAria.trim().isNotEmpty &&
      widget.filtersToggleHideAria.trim().isNotEmpty;

  @override
  void initState() {
    super.initState();
    _skip = SkipStore.read(_skipKey);
    _load(skip: _skip);
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _setEntryFilter(EventEntryFilter filter) async {
    if (_entryFilter == filter) return;
    setState(() {
      _entryFilter = filter;
      _skip = 0;
    });
    unawaited(SkipStore.clear(_skipKey));
    await _load(skip: 0, soft: true);
  }

  void _onSearchChanged(String raw) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(Duration(milliseconds: _debounceMs), () {
      if (!mounted) return;
      unawaited(_applySearch(raw));
    });
  }

  Future<void> _applySearch(String raw) async {
    final next = raw.trim();
    if (_searchQ == next) return;
    setState(() {
      _searchQ = next;
      _skip = 0;
    });
    unawaited(SkipStore.clear(_skipKey));
    await _load(skip: 0, soft: true);
  }

  Future<void> _load({int? skip, bool soft = false}) async {
    final nextSkip = skip ?? _skip;
    // Persist before fetch so dispose mid-request still restores navigated page.
    if (skip != null) {
      _skip = nextSkip;
      unawaited(SkipStore.write(_skipKey, nextSkip));
    }
    final limit = widget.listPageSize;
    setState(() {
      if (soft && _events.isNotEmpty) {
        _softFetching = true;
      } else {
        _loading = true;
        _softFetching = false;
      }
      _error = '';
    });
    if (limit < 1) {
      setState(() {
        _loading = false;
        _softFetching = false;
        _error = softCommunityLoadFailed(widget.loadFailed);
        _events = const [];
      });
      return;
    }
    try {
      final params = <String, String>{
        'skip': '$nextSkip',
        'limit': '$limit',
      };
      switch (_entryFilter) {
        case EventEntryFilter.free:
          params['is_free_entry'] = 'true';
          break;
        case EventEntryFilter.paid:
          params['is_free_entry'] = 'false';
          break;
        case EventEntryFilter.all:
          break;
      }
      final q = _searchQ.trim();
      if (q.isNotEmpty) params['q'] = q;
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/public').replace(
          queryParameters: params,
        ),
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        setState(() {
          _loading = false;
          _softFetching = false;
          _error = softCommunityLoadFailed(widget.loadFailed);
          _events = const [];
        });
        return;
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final rows = (body['events'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(HostedEvent.fromJson)
          .where((e) => e.id.isNotEmpty)
          .toList();
      final metaRaw = body['meta'];
      final meta =
          metaRaw is Map<String, dynamic> ? SkipMeta.fromJson(metaRaw) : null;
      setState(() {
        _events = rows;
        _meta = meta;
        _skip = nextSkip;
        _loading = false;
        _softFetching = false;
      });
      unawaited(SkipStore.write(_skipKey, nextSkip));
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _softFetching = false;
        _error = softCommunityLoadFailed(widget.loadFailed);
      });
    }
  }

  Widget _filterPanel(DamaColors tokens) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          softTournamentsFilterEntryLabel(widget.filterEntryLabel),
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
            for (final f in EventEntryFilter.values)
              ChoiceChip(
                label: Text(
                  switch (f) {
                    EventEntryFilter.all =>
                      softTournamentsFilterEntryAll(widget.filterAllLabel),
                    EventEntryFilter.free =>
                      softTournamentsFilterEntryFree(widget.filterFreeLabel),
                    EventEntryFilter.paid =>
                      softTournamentsFilterEntryPaid(widget.filterPaidLabel),
                  },
                ),
                selected: _entryFilter == f,
                onSelected: _loading || _softFetching
                    ? null
                    : (_) => _setEntryFilter(f),
              ),
          ],
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _searchCtrl,
          decoration: InputDecoration(
            labelText: softCommunitySearchLabel(widget.searchLabel),
            hintText: softCommunitySearchPlaceholder(widget.searchPlaceholder),
            border: const OutlineInputBorder(),
            suffixIcon: IconButton(
              icon: const Icon(Icons.search),
              onPressed: _loading || _softFetching
                  ? null
                  : () {
                      _searchDebounce?.cancel();
                      unawaited(_applySearch(_searchCtrl.text));
                    },
            ),
          ),
          textInputAction: TextInputAction.search,
          onChanged: _loading || _softFetching ? null : _onSearchChanged,
          onSubmitted: _loading || _softFetching
              ? null
              : (v) {
                  _searchDebounce?.cancel();
                  unawaited(_applySearch(v));
                },
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final showReport =
        widget.onReport != null && widget.reportAction.trim().isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          softCommunityPublicListTitle(widget.listTitle),
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 4),
        Text(
          softCommunityPublicListBlurb(widget.listBlurb),
          style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 13),
        ),
        const SizedBox(height: 12),
        if (_hasFilterToggle)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () =>
                  setState(() => _filtersVisible = !_filtersVisible),
              icon: Icon(
                _filtersVisible ? Icons.expand_less : Icons.expand_more,
                size: 18,
              ),
              label: Text(
                softTournamentsFiltersToggleLabel(widget.filtersToggleLabel),
              ),
              style: TextButton.styleFrom(
                visualDensity: VisualDensity.compact,
              ),
            ),
          ),
        ClipRect(
          child: AnimatedAlign(
            duration: const Duration(milliseconds: 280),
            curve: Curves.easeOutCubic,
            heightFactor: (!_hasFilterToggle || _filtersVisible) ? 1 : 0,
            alignment: Alignment.topCenter,
            child: ExcludeSemantics(
              excluding: _hasFilterToggle && !_filtersVisible,
              child: _filterPanel(tokens),
            ),
          ),
        ),
        // Reserved 2px slot - never insert/remove progress (pagination layout jump).
        SizedBox(
          height: 2,
          child: _softFetching
              ? const LinearProgressIndicator(minHeight: 2)
              : const SizedBox.expand(),
        ),
        const SizedBox(height: 12),
        if (_loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (_error.isNotEmpty)
          Text(_error, style: TextStyle(color: tokens.danger))
        else if (_events.isEmpty)
          Text(
            softHostingPublicListEmpty(widget.listEmpty),
            style: TextStyle(color: tokens.onSurfaceMuted),
          )
        else
          Opacity(
            opacity: _softFetching ? 0.7 : 1,
            child: EventMiniCardGrid(
              itemCount: _events.length,
              itemBuilder: (context, i) {
                final ev = _events[i];
                final joinOpen =
                    softTournamentsJoinAction(widget.joinOpenAction);
                final seated = widget.joinedIds?.contains(ev.id) == true;
                final cta = resolveCupCardCta(
                  CupLifecycleFields(
                    startedAt: ev.startedAt,
                    finishedAt: ev.finishedAt,
                  ),
                  enrolled: seated,
                  isFree: ev.isFreeEntry,
                  labels: CupCardCtaLabels(
                    joinAction: joinOpen,
                    enrollAction: joinOpen,
                    lobbyAction: widget.lobbyAction.trim(),
                    watchAction: widget.watchAction.trim(),
                    resultsAction: widget.resultsAction.trim(),
                  ),
                );
                final ctaLabel =
                    cta.label.trim().isNotEmpty ? cta.label.trim() : joinOpen;
                return EventMiniCard(
                  event: ev,
                  carouselAria: widget.carouselAria,
                  playersLabel:
                      softTournamentsPlayersLabel(widget.playersLabel),
                  unlimitedPlayersLabel: widget.unlimitedPlayersLabel,
                  entryLabel:
                      softTournamentsFilterEntryLabel(widget.entryLabel),
                  freeLabel: softTournamentsFreeLabel(widget.freeLabel),
                  ctaLabel: ctaLabel,
                  hostedByLabel:
                      softTournamentsHostedByLabel(widget.hostedByLabel),
                  metaSeparator: widget.metaSeparator,
                  amountCurrencySeparator: widget.amountCurrencySeparator,
                  emptyValue: widget.emptyValue,
                  hostRepFinishedLabel: widget.hostRepFinishedLabel,
                  hostRepCancelledLabel: widget.hostRepCancelledLabel,
                  hostRepReportsLabel: widget.hostRepReportsLabel,
                  hostRepMetaSeparator: widget.hostRepMetaSeparator,
                  statusLabel:
                      ev.statusLabel.isNotEmpty ? ev.statusLabel : ev.status,
                  prizePoolLabels: widget.prizePoolLabels,
                  onOpen: widget.onOpen != null
                      ? () => widget.onOpen!(ev)
                      : (widget.onJoin != null
                          ? () => widget.onJoin!(ev)
                          : null),
                  onJoin:
                      widget.onJoin != null ? () => widget.onJoin!(ev) : null,
                  ctaSlot: showReport
                      ? Row(
                          children: [
                            Expanded(
                              child: FilledButton(
                                onPressed: widget.onJoin != null
                                    ? () => widget.onJoin!(ev)
                                    : null,
                                style: FilledButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  backgroundColor: tokens.gold,
                                  foregroundColor: tokens.onGold,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  textStyle: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                child: Text(ctaLabel),
                              ),
                            ),
                            const SizedBox(width: 8),
                            OutlinedButton(
                              onPressed: () => widget.onReport!(ev),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                ),
                                minimumSize: const Size(0, 32),
                                textStyle: const TextStyle(fontSize: 12),
                              ),
                              child: Text(
                                softCommunityReportAction(widget.reportAction),
                              ),
                            ),
                          ],
                        )
                      : null,
                );
              },
            ),
          ),
        // Outside Opacity - stable pagination chrome (no flicker).
        if (_meta != null && _meta!.totalPages > 1)
          SkipPaginationBar(
            meta: _meta!,
            busy: _softFetching,
            onSkip: (skip) => unawaited(_load(skip: skip, soft: true)),
          ),
      ],
    );
  }
}
