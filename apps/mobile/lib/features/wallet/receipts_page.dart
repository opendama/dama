import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/cache/skip_store.dart';
import 'package:dama_mobile/core/nav/manual_transfer_nav.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/payout.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/skip_pagination_bar.dart';
import 'package:dama_mobile/core/utils/payment_status_display.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/notifications/notification_app_bar_actions.dart';
import 'package:dama_mobile/features/notifications/notification_href_nav.dart';
import 'package:dama_mobile/features/wallet/payment_receipt_document.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;

/// Player receipts list (web `/receipts` parity) with optional deep-link focus.
/// All copy from `GET /public/wallet-chrome` + client-nav (fail closed).
class ReceiptsPage extends StatefulWidget {
  const ReceiptsPage({
    super.key,
    required this.accessToken,
    this.focusId,
  });

  final String accessToken;
  final String? focusId;

  @override
  State<ReceiptsPage> createState() => _ReceiptsPageState();
}

class _ReceiptsPageState extends State<ReceiptsPage> {
  final _items = <_ReceiptRow>[];
  final _searchCtrl = TextEditingController();
  Timer? _searchDebounce;
  String _debouncedQ = '';
  WalletChrome? _chrome;
  PayoutHistoryMeta? _meta;
  String _title = '';
  bool _loading = true;
  bool _failed = false;
  bool _isManualTransfer = false;
  String? _openedFor;
  static const _skipKey = 'wallet_receipts';
  int _skip = 0;

  @override
  void initState() {
    super.initState();
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
      final isManual = await fetchIsManualTransferRoute();

      var title = '';
      if ((chrome?.linkReceiptsLabel ?? '').trim().isNotEmpty) {
        title = chrome!.linkReceiptsLabel.trim();
      } else {
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
            if (link.routeKey == 'receipts' && link.title.trim().isNotEmpty) {
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
          _isManualTransfer = isManual;
          _loading = false;
          _failed = true;
        });
        return;
      }
      final uri =
          Uri.parse('${ApiConfig.defaults.restUrl}/payments/receipts/mine')
              .replace(
        queryParameters: {
          'skip': '$_skip',
          'limit': '$limit',
          if (q.isNotEmpty) 'q': q,
        },
      );
      final res = await http.get(
        uri,
        headers: {
          'Authorization': 'Bearer ${widget.accessToken}',
          'Content-Type': 'application/json',
        },
      );
      if (!mounted) return;
      final receiptsReady = chrome != null &&
          title.isNotEmpty &&
          chrome.listEmptyReceipts.trim().isNotEmpty &&
          chrome.listDetailTitle.trim().isNotEmpty &&
          chrome.dialogCloseLabel.trim().isNotEmpty &&
          chrome.listColStatus.trim().isNotEmpty &&
          chrome.listColAmount.trim().isNotEmpty &&
          chrome.listColDate.trim().isNotEmpty;
      if (res.statusCode >= 300 || !receiptsReady) {
        setState(() {
          _chrome = chrome;
          _title = title;
          _isManualTransfer = isManual;
          _loading = false;
          _failed = true;
        });
        return;
      }
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      final raw = (map['receipts'] as List<dynamic>? ?? const []);
      final list = <_ReceiptRow>[];
      for (final r in raw) {
        final row = _ReceiptRow.fromJson(r as Map<String, dynamic>?);
        if (row != null) list.add(row);
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
        _isManualTransfer = isManual;
        _meta = meta;
        if (adoptSeek) _skip = metaSkip;
        _items
          ..clear()
          ..addAll(list);
        _loading = false;
      });
      if (focus.isNotEmpty && _openedFor != focus) {
        final match = list.where((e) => e.id == focus).toList();
        if (match.isNotEmpty) {
          _openedFor = focus;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) unawaited(_showDetail(match.first));
          });
        }
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _failed = true;
        });
      }
    }
  }

  void _setSkip(int skip) {
    final next = skip < 0 ? 0 : skip;
    setState(() => _skip = next);
    unawaited(SkipStore.write(_skipKey, next));
    unawaited(_load());
  }

  Future<void> _showDocument(_ReceiptRow row, {bool download = false}) async {
    final chrome = _chrome;
    if (chrome == null) return;
    var billToName = '';
    try {
      billToName = (context.read<AuthCubit>().state.username ?? '').trim();
    } catch (_) {
      /* sheet still hydrates bill-to from GET /payments/receipts/{id} */
    }
    if (!chrome.receiptDocumentReady) {
      final msg = (chrome.walletLoadFailed).trim();
      if (msg.isNotEmpty && context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
      return;
    }
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => SizedBox(
        height: MediaQuery.sizeOf(ctx).height * 0.92,
        child: PaymentReceiptDocumentSheet(
          accessToken: widget.accessToken,
          chrome: chrome,
          id: row.id,
          amount: row.amount,
          currency: row.currency,
          status: row.status,
          reference: row.reference,
          createdAt: row.createdAt,
          reviewedAt: row.reviewedAt,
          provider: row.provider,
          receiptUrl: row.receiptUrl,
          billToName: billToName,
          autoDownload: download,
        ),
      ),
    );
  }

  Future<_ReceiptRow> _hydrateReceipt(_ReceiptRow seed) async {
    try {
      final res = await http.get(
        Uri.parse(
          '${ApiConfig.defaults.restUrl}/payments/receipts/${Uri.encodeComponent(seed.id)}',
        ),
        headers: {
          'Authorization': 'Bearer ${widget.accessToken}',
          'Content-Type': 'application/json',
        },
      );
      if (res.statusCode >= 300) return seed;
      final parsed = _ReceiptRow.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>?,
      );
      return parsed ?? seed;
    } catch (_) {
      return seed;
    }
  }

  Future<void> _showDetail(_ReceiptRow seed, {bool download = false}) async {
    if (download) {
      await _showDocument(seed, download: true);
      return;
    }
    final chrome = _chrome;
    if (chrome == null) return;
    final row = await _hydrateReceipt(seed);
    if (!mounted) return;
    final tokens = damaColorsOf(context);
    final empty = chrome.emptyValue.trim();
    final amountSep = chrome.amountCurrencySeparator;
    final statusCode = receiptDisplayStatusCode(status: row.status);
    final statusDisp = chrome.statusLabel(statusCode);
    final title = chrome.listDetailTitle.trim().isNotEmpty
        ? chrome.listDetailTitle.trim()
        : chrome.receiptDocumentTitle.trim();
    final closeLabel = chrome.dialogCloseLabel.trim().isNotEmpty
        ? chrome.dialogCloseLabel.trim()
        : chrome.cancelAction.trim();
    final openDoc = chrome.receiptOpenDocumentAction.trim().isNotEmpty
        ? chrome.receiptOpenDocumentAction.trim()
        : chrome.receiptDocumentTitle.trim();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) {
        Widget rowKV(String label, String value, {Color? valueColor}) {
          if (label.trim().isEmpty) return const SizedBox.shrink();
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.trim(),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.4,
                    color: tokens.onSurfaceMuted,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value.trim().isNotEmpty ? value.trim() : empty,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: valueColor,
                  ),
                ),
              ],
            ),
          );
        }

        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.72,
          minChildSize: 0.4,
          maxChildSize: 0.92,
          builder: (ctx, scroll) => Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                    ),
                    if (closeLabel.isNotEmpty)
                      TextButton(
                        onPressed: () => Navigator.of(ctx).pop(),
                        child: Text(closeLabel),
                      ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  controller: scroll,
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  children: [
                    rowKV(chrome.receiptLabelId, row.id),
                    rowKV(
                      chrome.listColAmount,
                      row.amount.isNotEmpty && row.currency.isNotEmpty
                          ? '${row.amount}$amountSep${row.currency}'
                          : empty,
                    ),
                    rowKV(
                      chrome.listColStatus,
                      statusDisp.isNotEmpty ? statusDisp : empty,
                      valueColor: paidStatusForeground(statusCode),
                    ),
                    rowKV(chrome.listColReference, row.reference),
                    rowKV(
                      chrome.receiptProviderLabel.trim().isNotEmpty
                          ? chrome.receiptProviderLabel
                          : chrome.receiptSectionPayment,
                      row.provider,
                    ),
                    rowKV(
                      chrome.receiptIntentIdLabel.trim().isNotEmpty
                          ? chrome.receiptIntentIdLabel
                          : '',
                      row.intentId,
                    ),
                    rowKV(chrome.listColDate, row.createdAt),
                    rowKV(
                      chrome.receiptReviewedAtLabel.trim().isNotEmpty
                          ? chrome.receiptReviewedAtLabel
                          : chrome.receiptLabelPaidAt,
                      row.reviewedAt,
                    ),
                    if (chrome.receiptProofLabel.trim().isNotEmpty ||
                        chrome.receiptProofCaption.trim().isNotEmpty ||
                        row.receiptUrl.isNotEmpty) ...[
                      Text(
                        chrome.receiptProofLabel.trim().isNotEmpty
                            ? chrome.receiptProofLabel.trim()
                            : (chrome.receiptProofCaption.trim().isNotEmpty
                                ? chrome.receiptProofCaption.trim()
                                : chrome.receiptSectionProof.trim()),
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
                      const SizedBox(height: 16),
                    ],
                    if (chrome.receiptDocumentReady && openDoc.isNotEmpty)
                      FilledButton(
                        onPressed: () {
                          Navigator.of(ctx).pop();
                          unawaited(_showDocument(row));
                        },
                        child: Text(openDoc),
                      ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final chrome = _chrome;
    final failMsg = (chrome?.walletLoadFailed ?? '').trim();
    final emptyMsg = (chrome?.listEmptyReceipts ?? '').trim();
    final meta = _meta;
    final showPager = meta != null && meta.totalPages > 1;
    final searchLabel = chrome?.listSearchLabel ?? '';
    final searchPh = chrome?.listSearchPlaceholder ?? '';
    final transferLabel = (chrome?.linkManualTransferLabel ?? '').trim();
    final transferHref = (chrome?.linkManualTransferHref ?? '').trim();
    final showTransferCta = _isManualTransfer &&
        transferLabel.isNotEmpty &&
        transferHref.isNotEmpty;
    return Scaffold(
      appBar: AppBar(
        title: Text(_title),
        actions: [
          if (showTransferCta)
            TextButton(
              onPressed: () {
                unawaited(
                  navigateNotificationHref(
                    context,
                    href: transferHref,
                    accessToken: widget.accessToken,
                  ),
                );
              },
              child: Text(transferLabel),
            ),
          const NotificationAppBarActions(),
        ],
      ),
      body: _loading && chrome == null
          ? const Center(child: CircularProgressIndicator())
          : _failed
              ? Center(
                  child: Text(
                    failMsg,
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
                            emptyMsg,
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
                                  final focused =
                                      (widget.focusId ?? '').trim() == row.id;
                                  final amountSep =
                                      (chrome?.amountCurrencySeparator ?? '');
                                  final metaSep =
                                      (chrome?.metaSeparator ?? '').isNotEmpty
                                          ? chrome!.metaSeparator
                                          : amountSep;
                                  final empty =
                                      (chrome?.emptyValue ?? '').trim();
                                  final statusCode = receiptDisplayStatusCode(
                                    status: row.status,
                                  );
                                  final statusDisp = chrome == null
                                      ? ''
                                      : chrome.statusLabel(statusCode);
                                  final statusColor =
                                      paidStatusForeground(statusCode);
                                  return ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    selected: focused,
                                    title: Text(
                                      row.amount.isNotEmpty &&
                                              row.currency.isNotEmpty
                                          ? '${row.amount}$amountSep${row.currency}'
                                          : empty,
                                    ),
                                    subtitle: Text.rich(
                                      TextSpan(
                                        children: [
                                          TextSpan(
                                            text: statusDisp.isNotEmpty
                                                ? statusDisp
                                                : empty,
                                            style: statusColor != null
                                                ? TextStyle(color: statusColor)
                                                : null,
                                          ),
                                          TextSpan(
                                            text:
                                                '$metaSep${row.reference.isNotEmpty ? row.reference : empty}',
                                          ),
                                        ],
                                      ),
                                    ),
                                    onTap: () => unawaited(_showDetail(row)),
                                    trailing: chrome != null &&
                                            chrome.receiptDocumentReady &&
                                            chrome.receiptDownloadAction
                                                .trim()
                                                .isNotEmpty
                                        ? IconButton(
                                            tooltip:
                                                chrome.receiptDownloadAction,
                                            icon: Icon(
                                              Icons.download_outlined,
                                              color: tokens.gold,
                                            ),
                                            onPressed: () => unawaited(
                                              _showDetail(row, download: true),
                                            ),
                                          )
                                        : null,
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

class _ReceiptRow {
  const _ReceiptRow({
    required this.id,
    required this.amount,
    required this.currency,
    required this.status,
    required this.reference,
    required this.createdAt,
    this.reviewedAt = '',
    this.provider = '',
    this.receiptUrl = '',
    this.intentId = '',
  });

  final String id;
  final String amount;
  final String currency;
  final String status;
  final String reference;
  final String createdAt;
  final String reviewedAt;
  final String provider;
  final String receiptUrl;
  final String intentId;

  static _ReceiptRow? fromJson(Map<String, dynamic>? map) {
    if (map == null) return null;
    final id = (map['id'] as String?)?.trim() ?? '';
    if (id.isEmpty) return null;
    return _ReceiptRow(
      id: id,
      amount: map['amount'] is num
          ? '${map['amount']}'
          : (map['amount']?.toString().trim() ?? ''),
      currency: (map['currency'] as String?)?.trim() ?? '',
      status: receiptDisplayStatusCode(
        displayStatus: (map['display_status'] as String?)?.trim() ?? '',
        status: (map['status'] as String?)?.trim() ?? '',
      ),
      reference: (map['reference'] as String?)?.trim() ?? '',
      createdAt: (map['created_at'] as String?)?.trim() ?? '',
      reviewedAt: (map['reviewed_at'] as String?)?.trim() ?? '',
      provider: (map['provider'] as String?)?.trim() ?? '',
      receiptUrl: (map['receipt_url'] as String?)?.trim() ?? '',
      intentId: (map['intent_id'] as String?)?.trim() ?? '',
    );
  }
}
