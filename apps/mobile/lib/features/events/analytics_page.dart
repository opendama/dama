import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/features/events/events_dialog_shell.dart';
import 'package:dama_mobile/features/events/hosting_organizer_chrome_soft.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

/// Organizer events analytics from GET /events/analytics.
class EventsAnalyticsPage extends StatefulWidget {
  const EventsAnalyticsPage({super.key, required this.accessToken});

  final String accessToken;

  @override
  State<EventsAnalyticsPage> createState() => _EventsAnalyticsPageState();
}

class _EventsAnalyticsPageState extends State<EventsAnalyticsPage> {
  EventsOrganizerChrome? _chrome;
  EventsAnalyticsPayload? _payload;
  String _error = '';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
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
      if (chrome == null) {
        if (!mounted) return;
        setState(() {
          _chrome = null;
          _loading = false;
          _error = softHostingChromeUnavailable(unavailable);
        });
        return;
      }
      // Catalog hosted_events_enabled == false → Hosting analytics gated (web parity).
      try {
        final catRes = await http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/events/catalog'),
          headers: {'Authorization': 'Bearer ${widget.accessToken}'},
        );
        if (catRes.statusCode < 300) {
          final catMap = jsonDecode(catRes.body);
          if (catMap is Map<String, dynamic> &&
              catMap.containsKey('hosted_events_enabled') &&
              catMap['hosted_events_enabled'] != true) {
            if (!mounted) return;
            final ready = chrome;
            setState(() {
              _chrome = ready;
              _loading = false;
              _error = softHostingFeatureDisabled(ready.featureDisabled);
            });
            return;
          }
        }
      } catch (_) {}
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/analytics'),
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      if (!mounted) return;
      final ready = chrome;
      if (res.statusCode == 503) {
        setState(() {
          _chrome = ready;
          _loading = false;
          _error = softHostingFeatureDisabled(ready.featureDisabled);
        });
        return;
      }
      if (res.statusCode >= 300) {
        setState(() {
          _chrome = ready;
          _loading = false;
          _error = softHostingFeatureDisabled(ready.featureDisabled);
        });
        return;
      }
      final payload = EventsAnalyticsPayload.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      setState(() {
        _chrome = ready;
        _payload = payload;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = softHostingFeatureDisabled(_chrome?.featureDisabled ?? '');
      });
    }
  }

  String _numCell(String emptyValue, num? n) {
    if (n == null) return emptyValue;
    return '$n';
  }

  String _money(EventsOrganizerChrome c, double? amount, String currency) {
    if (amount == null) return c.emptyValue;
    final cur = currency.trim();
    final sep = c.amountCurrencySeparator;
    if (cur.isEmpty || sep.isEmpty) return c.emptyValue;
    return '$amount$sep$cur';
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.zero,
        child: WalletSkeleton(),
      );
    }
    final chrome = _chrome;
    if (chrome == null) {
      return Center(
        child: Padding(
          padding: EdgeInsets.zero,
          child: Text(_error, style: TextStyle(color: tokens.danger)),
        ),
      );
    }
    final pagePad = EventsDialogShell.pageInsets(
      insetH: chrome.dialogShellInsetH,
      insetV: chrome.dialogShellInsetV,
    );
    if (pagePad == null) return const SizedBox.shrink();
    final payload = _payload;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: pagePad,
        children: [
          Text(
            softHostingAnalyticsTitle(chrome.analyticsTitle),
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            softHostingAnalyticsBlurb(chrome.analyticsBlurb),
            style: TextStyle(color: tokens.onSurfaceMuted),
          ),
          const SizedBox(height: 8),
          Text(
            chrome.analyticsMetricsNote,
            style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
          ),
          if (_error.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(_error, style: TextStyle(color: tokens.danger)),
          ],
          if (payload != null) ...[
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                _chip(
                  context,
                  chrome.analyticsPlayersLabel,
                  _numCell(chrome.emptyValue, payload.totals.playersJoined),
                ),
                _chip(
                  context,
                  chrome.analyticsStartedLabel,
                  _numCell(chrome.emptyValue, payload.totals.eventsStarted),
                ),
                _chip(
                  context,
                  chrome.analyticsCompletionLabel,
                  _numCell(chrome.emptyValue, payload.totals.eventsFinished),
                ),
                _chip(
                  context,
                  chrome.analyticsHostFeeLabel,
                  _money(
                    chrome,
                    payload.totals.hostFeeSum,
                    payload.totals.hostFeeCurrency,
                  ),
                ),
                _chip(
                  context,
                  chrome.analyticsEntryFeesLabel,
                  _money(
                    chrome,
                    payload.totals.entryFeesSum,
                    payload.totals.entryFeeCurrency,
                  ),
                ),
                _chip(
                  context,
                  chrome.analyticsCommissionLabel,
                  _money(
                    chrome,
                    payload.totals.entryCommissionSum,
                    payload.totals.entryFeeCurrency,
                  ),
                ),
                _chip(
                  context,
                  chrome.analyticsEntryNetLabel,
                  _money(
                    chrome,
                    payload.totals.entryNetSum,
                    payload.totals.entryFeeCurrency,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            if (payload.events.isEmpty)
              Text(
                softHostingAnalyticsEmpty(chrome.analyticsEmpty),
                style: TextStyle(color: tokens.onSurfaceMuted),
              )
            else
              for (final row in payload.events)
                Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    title: Text(row.title),
                    subtitle: Text(
                      [
                        row.statusLabel.isNotEmpty
                            ? row.statusLabel
                            : chrome.emptyValue,
                        '${chrome.analyticsPlayersLabel}${chrome.metaSeparator}${_numCell(chrome.emptyValue, row.playersJoined)}',
                        '${chrome.analyticsHostFeeLabel}${chrome.metaSeparator}${_money(chrome, row.hostFee, row.hostFeeCurrency)}',
                        '${chrome.analyticsEntryFeesLabel}${chrome.metaSeparator}${_money(chrome, row.entryFeesSum, row.entryFeeCurrency)}',
                        '${chrome.analyticsCommissionLabel}${chrome.metaSeparator}${_money(chrome, row.entryCommissionSum, row.entryFeeCurrency)}',
                        '${chrome.analyticsEntryNetLabel}${chrome.metaSeparator}${_money(chrome, row.entryNetSum, row.entryFeeCurrency)}',
                      ].join(chrome.metaSeparator),
                      style: TextStyle(
                        color: tokens.onSurfaceMuted,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ),
          ],
        ],
      ),
    );
  }

  Widget _chip(BuildContext context, String label, String value) {
    if (label.trim().isEmpty || value.trim().isEmpty) {
      return const SizedBox.shrink();
    }
    final chrome = _chrome;
    if (chrome == null) return const SizedBox.shrink();
    final padH = double.tryParse(chrome.analyticsChipPadH.trim());
    final padV = double.tryParse(chrome.analyticsChipPadV.trim());
    final radius = double.tryParse(chrome.analyticsChipRadius.trim());
    final gap = double.tryParse(chrome.pageCardGap.trim());
    if (padH == null ||
        padH < 0 ||
        padV == null ||
        padV < 0 ||
        radius == null ||
        radius < 0 ||
        gap == null ||
        gap < 0) {
      return const SizedBox.shrink();
    }
    final tokens = damaColorsOf(context);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: padH, vertical: padV),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: tokens.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(color: tokens.onSurfaceMuted),
          ),
          SizedBox(height: gap),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
