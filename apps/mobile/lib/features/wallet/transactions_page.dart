import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/cache/skip_store.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/payout.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/skip_pagination_bar.dart';
import 'package:dama_mobile/core/utils/payment_status_display.dart';
import 'package:dama_mobile/features/notifications/notification_app_bar_actions.dart';
import 'package:dama_mobile/features/wallet/manual_transfer_page.dart';
import 'package:dama_mobile/features/wallet/receipts_page.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

/// Player transactions ledger (web `/transactions` parity).
class TransactionsPage extends StatefulWidget {
  const TransactionsPage({
    super.key,
    required this.accessToken,
    this.title = '',
    this.focusId,
  });

  final String accessToken;

  /// When empty, resolved from client-nav `transactions` link title (fail closed).
  final String title;

  /// Deep-link `?id=` (notification / URL); seeds list search when present.
  final String? focusId;

  @override
  State<TransactionsPage> createState() => _TransactionsPageState();
}

class _TransactionsPageState extends State<TransactionsPage> {
  final _items = <_TxnRow>[];
  final _searchCtrl = TextEditingController();
  Timer? _searchDebounce;
  String _debouncedQ = '';
  WalletChrome? _chrome;
  PayoutHistoryMeta? _meta;
  String _title = '';
  bool _loading = true;
  bool _failed = false;
  String? _openedFor;
  static const _skipKey = 'wallet_transactions';
  int _skip = 0;

  @override
  void initState() {
    super.initState();
    _title = widget.title.trim();
    final focus = (widget.focusId ?? '').trim();
    if (focus.isNotEmpty) {
      _searchCtrl.text = focus;
      _debouncedQ = focus;
    } else {
      _skip = SkipStore.read(_skipKey);
    }
    unawaited(_load());
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 250), () {
      if (!mounted) return;
      final next = _searchCtrl.text.trim();
      if (next == _debouncedQ) return;
      setState(() {
        _debouncedQ = next;
        _skip = 0;
      });
      unawaited(SkipStore.clear(_skipKey));
      unawaited(_load());
    });
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      final chromeRes = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/public/wallet-chrome'),
      );
      WalletChrome? chrome;
      if (chromeRes.statusCode < 300) {
        chrome = WalletChrome.fromJson(
          jsonDecode(chromeRes.body) as Map<String, dynamic>,
        );
      }
      var title = _title;
      if (title.isEmpty) {
        final navRes = await http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/platform/client-nav'),
        );
        if (navRes.statusCode < 300) {
          final payload = ClientNavPayload.fromJson(
            jsonDecode(navRes.body) as Map<String, dynamic>,
          );
          for (final link in [
            ...payload.dashboard,
            ...payload.player,
            ...payload.mobile,
          ]) {
            if (link.routeKey == 'transactions' &&
                link.title.trim().isNotEmpty) {
              title = link.title.trim();
              break;
            }
          }
        }
      }
      final focus = (widget.focusId ?? '').trim();
      final q = _debouncedQ.trim();
      final limit = chrome?.listPageSizeInt ?? 0;
      if (limit < 1) {
        if (!mounted) return;
        setState(() {
          _chrome = chrome;
          _title = title;
          _loading = false;
          _failed = true;
        });
        return;
      }
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/payments/transactions').replace(
          queryParameters: {
            'skip': '$_skip',
            'limit': '$limit',
            if (q.isNotEmpty) 'q': q,
          },
        ),
        headers: {
          'Authorization': 'Bearer ${widget.accessToken}',
          'Content-Type': 'application/json',
        },
      );
      if (!mounted) return;
      if (res.statusCode >= 300 || chrome == null || title.isEmpty) {
        setState(() {
          _chrome = chrome;
          _title = title;
          _loading = false;
          _failed = true;
        });
        return;
      }
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      final raw = map['transactions'] as List<dynamic>? ?? const [];
      final list = <_TxnRow>[];
      for (final r in raw) {
        if (r is Map<String, dynamic>) {
          final row = _TxnRow.fromJson(r);
          if (row.id.isNotEmpty) list.add(row);
        }
      }
      final metaRaw = map['meta'];
      final meta = metaRaw is Map<String, dynamic>
          ? PayoutListMeta.fromJson(metaRaw)
          : null;
      final metaSkip = metaRaw is Map<String, dynamic>
          ? (metaRaw['skip'] is num ? (metaRaw['skip'] as num).toInt() : null)
          : null;
      final adoptSeek =
          focus.isNotEmpty && _skip == 0 && metaSkip != null && metaSkip >= 0;
      setState(() {
        _chrome = chrome;
        _title = title;
        _meta = meta;
        if (adoptSeek) _skip = metaSkip;
        _items
          ..clear()
          ..addAll(list);
        _loading = false;
      });
      if (focus.isNotEmpty &&
          _openedFor != focus &&
          (chrome.listDetailTitle).trim().isNotEmpty &&
          (chrome.dialogCloseLabel).trim().isNotEmpty) {
        final match = list.where((e) => e.id == focus).toList();
        if (match.isNotEmpty) {
          _openedFor = focus;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) unawaited(_showDetail(match.first));
          });
        }
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _failed = true;
      });
    }
  }

  void _setSkip(int skip) {
    final next = skip < 0 ? 0 : skip;
    setState(() => _skip = next);
    unawaited(SkipStore.write(_skipKey, next));
    unawaited(_load());
  }

  Future<void> _showDetail(_TxnRow row) async {
    final chrome = _chrome;
    if (chrome == null) return;
    final tokens = damaColorsOf(context);
    final amountSep = chrome.amountCurrencySeparator;
    final empty = chrome.emptyValue.trim();
    final kindDisp = chrome.kindLabel(row.kind);
    final statusDisp = chrome.statusLabel(row.status);
    final proofLabel = chrome.receiptProofLabel.trim().isNotEmpty
        ? chrome.receiptProofLabel.trim()
        : chrome.receiptProofCaption.trim();
    final needsProof = row.kind.trim().toLowerCase() == 'topup' &&
        row.status.trim().toLowerCase() == 'awaiting_receipt' &&
        row.receiptId.trim().isEmpty;
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(chrome.listDetailTitle),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(chrome.listColAmount),
              Text(
                row.amount.isNotEmpty && row.currency.isNotEmpty
                    ? '${row.amount}$amountSep${row.currency}'
                    : empty,
                style: TextStyle(color: tokens.gold),
              ),
              const SizedBox(height: 8),
              Text(chrome.listColStatus),
              Text(
                statusDisp.isNotEmpty ? statusDisp : empty,
                style: TextStyle(
                  color: paidStatusForeground(row.status),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                kindDisp.isNotEmpty ? kindDisp : empty,
              ),
              const SizedBox(height: 8),
              Text(chrome.listColReference),
              Text(row.reference.isNotEmpty ? row.reference : empty),
              if (chrome.listColDate.trim().isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(chrome.listColDate),
                Text(row.createdAt.isNotEmpty ? row.createdAt : empty),
              ],
              if (proofLabel.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  proofLabel,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.4,
                    color: tokens.onSurfaceMuted,
                  ),
                ),
                const SizedBox(height: 8),
                if (row.receiptUrl.isNotEmpty)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.network(
                      row.receiptUrl,
                      fit: BoxFit.contain,
                      height: 220,
                      errorBuilder: (_, __, ___) => Text(empty),
                    ),
                  )
                else
                  Text(empty),
              ],
              if (needsProof && chrome.listAwaitingProofBlurb.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  chrome.listAwaitingProofBlurb,
                  style: TextStyle(color: tokens.onSurfaceMuted),
                ),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(chrome.dialogCloseLabel),
          ),
          if (needsProof && chrome.listActionSubmitReceipt.isNotEmpty)
            TextButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                unawaited(
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => ManualTransferPage(
                        accessToken: widget.accessToken,
                        initialAmount: row.amount,
                        intentId: row.id,
                      ),
                    ),
                  ),
                );
              },
              child: Text(chrome.listActionSubmitReceipt),
            ),
          if (row.receiptId.isNotEmpty &&
              chrome.receiptOpenDocumentAction.trim().isNotEmpty)
            TextButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                unawaited(
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => ReceiptsPage(
                        accessToken: widget.accessToken,
                        focusId: row.receiptId,
                      ),
                    ),
                  ),
                );
              },
              child: Text(chrome.receiptOpenDocumentAction),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final chrome = _chrome;
    final amountSep = chrome?.amountCurrencySeparator ?? '';
    final metaSep = (chrome?.metaSeparator ?? '').isNotEmpty
        ? chrome!.metaSeparator
        : amountSep;
    final meta = _meta;
    final showPager = meta != null && meta.totalPages > 1;
    final searchLabel = chrome?.listSearchLabel ?? '';
    final searchPh = chrome?.listSearchPlaceholder ?? '';
    return Scaffold(
      appBar: AppBar(
        title: Text(_title),
        actions: const [NotificationAppBarActions()],
      ),
      body: _loading && chrome == null
          ? const Center(child: CircularProgressIndicator())
          : _failed || chrome == null
              ? Center(
                  child: Text(
                    chrome?.walletLoadFailed ?? '',
                    style: TextStyle(color: tokens.danger),
                  ),
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                      child: TextField(
                        controller: _searchCtrl,
                        decoration: InputDecoration(
                          labelText:
                              searchLabel.isNotEmpty ? searchLabel : null,
                          hintText: searchPh.isNotEmpty ? searchPh : null,
                          border: const OutlineInputBorder(),
                          prefixIcon: const Icon(Icons.search),
                        ),
                        onChanged: (_) => _onSearchChanged(),
                      ),
                    ),
                    if (_loading && _items.isEmpty)
                      const Expanded(
                        child: Center(child: CircularProgressIndicator()),
                      )
                    else if (_items.isEmpty)
                      Expanded(
                        child: Center(
                          child: Text(
                            chrome.listEmptyTransactions,
                            style: TextStyle(color: tokens.onSurfaceMuted),
                          ),
                        ),
                      )
                    else
                      Expanded(
                        child: ListView(
                          padding: const EdgeInsets.all(16),
                          children: [
                            for (var i = 0; i < _items.length; i++) ...[
                              if (i > 0) const Divider(height: 1),
                              Builder(
                                builder: (context) {
                                  final row = _items[i];
                                  final muted = chrome.isMutedKind(row.kind);
                                  final statusDisp =
                                      chrome.statusLabel(row.status);
                                  final kindDisp = chrome.kindLabel(row.kind);
                                  final focused =
                                      (widget.focusId ?? '').trim() == row.id;
                                  final needsProof =
                                      row.kind.trim().toLowerCase() ==
                                              'topup' &&
                                          row.status.trim().toLowerCase() ==
                                              'awaiting_receipt' &&
                                          row.receiptId.trim().isEmpty;
                                  return ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    selected: focused,
                                    onTap: () => unawaited(_showDetail(row)),
                                    title: Text(
                                      row.amount.isNotEmpty &&
                                              row.currency.isNotEmpty
                                          ? '${row.amount}$amountSep${row.currency}'
                                          : chrome.emptyValue,
                                      style: TextStyle(
                                        color: muted
                                            ? tokens.onSurfaceMuted
                                            : tokens.gold,
                                      ),
                                    ),
                                    trailing: needsProof &&
                                            chrome.listActionSubmitReceipt
                                                .isNotEmpty
                                        ? TextButton(
                                            onPressed: () {
                                              unawaited(
                                                Navigator.of(context).push(
                                                  MaterialPageRoute<void>(
                                                    builder: (_) =>
                                                        ManualTransferPage(
                                                      accessToken:
                                                          widget.accessToken,
                                                      initialAmount: row.amount,
                                                      intentId: row.id,
                                                    ),
                                                  ),
                                                ),
                                              );
                                            },
                                            child: Text(
                                              chrome.listActionSubmitReceipt,
                                            ),
                                          )
                                        : null,
                                    subtitle: Text.rich(
                                      TextSpan(
                                        children: [
                                          TextSpan(
                                            text: kindDisp.isNotEmpty
                                                ? kindDisp
                                                : chrome.emptyValue,
                                          ),
                                          TextSpan(text: metaSep),
                                          TextSpan(
                                            text: statusDisp.isNotEmpty
                                                ? statusDisp
                                                : chrome.emptyValue,
                                            style: TextStyle(
                                              color: paidStatusForeground(
                                                row.status,
                                              ),
                                            ),
                                          ),
                                          TextSpan(
                                            text:
                                                '$metaSep${row.reference.isNotEmpty ? row.reference : chrome.emptyValue}',
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ],
                            if (showPager)
                              SkipPrevNextBar(
                                pageSummary: meta.pageSummary,
                                prevActionLabel: meta.prevActionLabel,
                                nextActionLabel: meta.nextActionLabel,
                                prevSkip: meta.prevSkip,
                                nextSkip: meta.nextSkip,
                                busy: _loading,
                                onSkip: _setSkip,
                              ),
                          ],
                        ),
                      ),
                  ],
                ),
    );
  }
}

class _TxnRow {
  const _TxnRow({
    required this.id,
    required this.kind,
    required this.amount,
    required this.currency,
    required this.status,
    required this.reference,
    this.createdAt = '',
    this.receiptUrl = '',
    this.receiptId = '',
  });

  final String id;
  final String kind;
  final String amount;
  final String currency;
  final String status;
  final String reference;
  final String createdAt;
  final String receiptUrl;
  final String receiptId;

  factory _TxnRow.fromJson(Map<String, dynamic> json) {
    final id = json['id']?.toString() ?? '';
    final kind = json['kind']?.toString() ?? '';
    final receiptId = (json['receipt_id'] as String?)?.trim() ?? '';
    final rawStatus = json['status']?.toString() ?? '';
    return _TxnRow(
      id: id,
      kind: kind,
      amount: json['amount'] is num
          ? '${json['amount']}'
          : (json['amount']?.toString().trim() ?? ''),
      currency: (json['currency'] as String?)?.trim() ?? '',
      status: txnDisplayStatusCode(
        kind: kind,
        id: id,
        status: rawStatus,
        receiptId: receiptId,
      ),
      reference: (json['reference'] as String?)?.trim() ?? '',
      createdAt: (json['created_at'] as String?)?.trim() ?? '',
      receiptUrl: (json['receipt_url'] as String?)?.trim() ?? '',
      receiptId: receiptId,
    );
  }
}
