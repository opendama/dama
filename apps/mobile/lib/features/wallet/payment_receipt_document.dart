import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/wallet_chrome.dart';
import 'package:dama_mobile/core/utils/payment_status_display.dart';
import 'package:dama_mobile/core/utils/receipt_date.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

/// Trim-parity payment receipt document (view / download / share-print).
class PaymentReceiptDocumentSheet extends StatefulWidget {
  const PaymentReceiptDocumentSheet({
    super.key,
    required this.accessToken,
    required this.chrome,
    required this.id,
    required this.amount,
    required this.currency,
    required this.status,
    required this.reference,
    required this.createdAt,
    this.reviewedAt = '',
    this.provider = '',
    this.receiptUrl = '',
    this.billToName = '',
    this.autoDownload = false,
  });

  final String accessToken;
  final WalletChrome chrome;
  final String id;
  final String amount;
  final String currency;
  final String status;
  final String reference;
  final String createdAt;
  final String reviewedAt;
  final String provider;
  final String receiptUrl;
  final String billToName;

  /// Trim list `?download=1` parity - fetch+share PDF once after open.
  final bool autoDownload;

  @override
  State<PaymentReceiptDocumentSheet> createState() =>
      _PaymentReceiptDocumentSheetState();
}

class _PaymentReceiptDocumentSheetState
    extends State<PaymentReceiptDocumentSheet> {
  bool _busy = false;
  bool _autoDownloadOnce = false;
  bool _detailLoading = true;
  late String _amount;
  late String _currency;
  late String _status;
  late String _reference;
  late String _createdAt;
  late String _reviewedAt;
  late String _provider;
  late String _receiptUrl;
  late String _billToName;
  String _billToEmail = '';

  @override
  void initState() {
    super.initState();
    _amount = widget.amount;
    _currency = widget.currency;
    _status = receiptDisplayStatusCode(status: widget.status);
    _reference = widget.reference;
    _createdAt = widget.createdAt;
    _reviewedAt = widget.reviewedAt;
    _provider = widget.provider;
    _receiptUrl = widget.receiptUrl;
    _billToName = widget.billToName.trim();
    // Trim/web parity: hydrate bill-to + fields from GET /payments/receipts/{id}.
    unawaited(_loadDetailThenMaybeAutoDownload());
  }

  Future<void> _loadDetailThenMaybeAutoDownload() async {
    try {
      final uri = Uri.parse(
        '${ApiConfig.defaults.restUrl}/payments/receipts/${Uri.encodeComponent(widget.id)}',
      );
      final res = await http.get(
        uri,
        headers: {
          'Authorization': 'Bearer ${widget.accessToken}',
          'Accept': 'application/json',
        },
      );
      if (!mounted) return;
      if (res.statusCode < 300) {
        final map = jsonDecode(res.body);
        if (map is Map<String, dynamic>) {
          final name = (map['username'] as String?)?.trim() ?? '';
          final email = (map['email'] as String?)?.trim() ?? '';
          final amount = map['amount'] is num
              ? '${map['amount']}'
              : (map['amount']?.toString().trim() ?? '');
          final currency = (map['currency'] as String?)?.trim() ?? '';
          final status = receiptDisplayStatusCode(
            displayStatus: (map['display_status'] as String?)?.trim() ?? '',
            status: (map['status'] as String?)?.trim() ?? '',
          );
          final reference = (map['reference'] as String?)?.trim() ?? '';
          final created = (map['created_at'] as String?)?.trim() ?? '';
          final reviewed = (map['reviewed_at'] as String?)?.trim() ?? '';
          final provider = (map['provider'] as String?)?.trim() ?? '';
          final receiptUrl = (map['receipt_url'] as String?)?.trim() ?? '';
          setState(() {
            if (name.isNotEmpty) _billToName = name;
            if (email.isNotEmpty) _billToEmail = email;
            if (amount.isNotEmpty) _amount = amount;
            if (currency.isNotEmpty) _currency = currency;
            if (status.isNotEmpty) _status = status;
            if (reference.isNotEmpty) _reference = reference;
            if (created.isNotEmpty) _createdAt = created;
            if (reviewed.isNotEmpty) _reviewedAt = reviewed;
            if (provider.isNotEmpty) _provider = provider;
            if (receiptUrl.isNotEmpty) _receiptUrl = receiptUrl;
          });
        }
      }
    } catch (_) {
      /* keep list-row seed; fail open for offline view */
    }
    if (!mounted) return;
    setState(() => _detailLoading = false);
    if (widget.autoDownload && !_autoDownloadOnce) {
      _autoDownloadOnce = true;
      unawaited(_downloadOrShare(asPrint: false));
    }
  }

  String get _amountFmt {
    final sep = widget.chrome.amountCurrencySeparator;
    final empty = widget.chrome.emptyValue;
    if (_amount.isEmpty || _currency.isEmpty || sep.isEmpty) {
      return empty;
    }
    // Trim formatMoney uses fixed 2 decimals; keep currency code for Dama.
    final n = double.tryParse(_amount);
    if (n == null) return '$_amount$sep$_currency';
    return '${n.toStringAsFixed(2)}$sep$_currency';
  }

  String get _currencyCode {
    final empty = widget.chrome.emptyValue;
    final c = _currency.trim().toUpperCase();
    return c.isNotEmpty ? c : empty;
  }

  /// Trim header meta date: reviewed (paid) else submitted - ordinal day, no time.
  String get _headerMetaDate {
    final empty = widget.chrome.emptyValue;
    if (_reviewedAt.trim().isNotEmpty) {
      return formatReceiptDay(_reviewedAt, empty: empty);
    }
    if (_createdAt.trim().isNotEmpty) {
      return formatReceiptDay(_createdAt, empty: empty);
    }
    return empty;
  }

  String get _payMethod => paymentMethodDisplay(_provider);

  String get _productCol {
    final empty = widget.chrome.emptyValue;
    final product = widget.chrome.receiptColProduct.trim();
    if (product.isNotEmpty) return product;
    final desc = widget.chrome.receiptColDescription.trim();
    return desc.isNotEmpty ? desc : empty;
  }

  String get _statusDisp {
    final labeled = widget.chrome.statusLabel(_status);
    if (labeled.isNotEmpty) return labeled;
    final empty = widget.chrome.emptyValue;
    return _status.isNotEmpty ? _status : empty;
  }

  /// Dama payment receipts have no separate tax line - Trim VAT row shows 0.00 until tax exists.
  String get _taxFmt {
    final sep = widget.chrome.amountCurrencySeparator;
    final empty = widget.chrome.emptyValue;
    if (_currency.isEmpty || sep.isEmpty) return empty;
    return '0.00$sep$_currency';
  }

  Widget _totalsRow(
    String label,
    String value,
    DamaColors tokens, {
    bool muted = false,
    bool bold = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: tokens.border),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: bold ? 15 : 13,
              fontWeight: bold ? FontWeight.w800 : FontWeight.w400,
              color: muted ? tokens.onSurfaceMuted : tokens.onSurface,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: bold ? 15 : 13,
              fontWeight: bold ? FontWeight.w800 : FontWeight.w400,
              fontFeatures: const [FontFeature.tabularFigures()],
              color: muted ? tokens.onSurfaceMuted : tokens.onSurface,
            ),
          ),
        ],
      ),
    );
  }

  /// Web `resolvePublicMediaUrl` parity for transfer-proof images.
  String get _proofUrl {
    final raw = _receiptUrl.trim();
    if (raw.isEmpty) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    if (raw.startsWith('/api/v1/media/')) {
      return '${ApiConfig.defaults.origin}$raw';
    }
    return raw;
  }

  Future<void> _downloadOrShare({required bool asPrint}) async {
    final chrome = widget.chrome;
    final failed = chrome.receiptDownloadFailed.trim();
    setState(() => _busy = true);
    try {
      final uri = Uri.parse(
        '${ApiConfig.defaults.restUrl}/payments/receipts/${Uri.encodeComponent(widget.id)}/pdf',
      );
      final res = await http.get(
        uri,
        headers: {
          'Authorization': 'Bearer ${widget.accessToken}',
          'Accept': 'application/pdf',
        },
      );
      if (!mounted) return;
      if (res.statusCode >= 300 || res.bodyBytes.length < 5) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(failed)),
        );
        return;
      }
      final head = String.fromCharCodes(res.bodyBytes.take(5));
      if (!head.startsWith('%PDF')) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(failed)),
        );
        return;
      }
      var name = chrome.receiptDownloadFilenameFmt
          .replaceAll('{id}', widget.id)
          .replaceAll(RegExp(r'[\\/:*?"<>|]+'), '-');
      if (!name.toLowerCase().endsWith('.pdf')) name = '$name.pdf';
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/$name');
      await file.writeAsBytes(Uint8List.fromList(res.bodyBytes), flush: true);
      await Share.shareXFiles(
        [XFile(file.path, mimeType: 'application/pdf', name: name)],
        subject: chrome.receiptDocumentTitle,
        text:
            asPrint ? chrome.receiptPrintAction : chrome.receiptDownloadAction,
      );
      if (!mounted) return;
      final done = chrome.receiptDownloadDone.trim();
      if (!asPrint && done.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(done)),
        );
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(failed)),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _labeled(String label, String value, DamaColors tokens) {
    if (label.trim().isEmpty || value.trim().isEmpty) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: '$label: ',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: tokens.onSurface,
                fontSize: 13,
              ),
            ),
            TextSpan(
              text: value,
              style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final chrome = widget.chrome;
    final tokens = damaColorsOf(context);
    final empty = chrome.emptyValue;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final markAsset = isDark
        ? 'assets/brand/dama-mark-white.png'
        : 'assets/brand/dama-mark.png';

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 12,
          bottom: 16 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    chrome.receiptDocumentTitle,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
                if (_busy && !_detailLoading)
                  const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                OutlinedButton(
                  onPressed: _busy
                      ? null
                      : () => unawaited(_downloadOrShare(asPrint: false)),
                  child: Text(chrome.receiptDownloadAction),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: _busy
                      ? null
                      : () => unawaited(_downloadOrShare(asPrint: true)),
                  child: Text(chrome.receiptPrintAction),
                ),
                const Spacer(),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: Text(chrome.dialogCloseLabel),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Expanded(
              child: _detailLoading
                  ? _ReceiptLetterheadSkeleton(
                      tokens: tokens,
                      chrome: chrome,
                    )
                  : SingleChildScrollView(
                      child: DecoratedBox(
                        // Flat letterhead (Trim/web article) - no card radius.
                        decoration: BoxDecoration(
                          color: tokens.surface,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Container(
                              padding:
                                  const EdgeInsets.fromLTRB(20, 24, 20, 20),
                              color: tokens.surfaceMuted,
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Wrap(
                                          spacing: 8,
                                          runSpacing: 6,
                                          crossAxisAlignment:
                                              WrapCrossAlignment.center,
                                          children: [
                                            Text(
                                              chrome.receiptDocumentTitle,
                                              style: const TextStyle(
                                                fontSize: 20,
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                            Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                horizontal: 8,
                                                vertical: 2,
                                              ),
                                              decoration: BoxDecoration(
                                                color: isPaidStatusCode(_status)
                                                    ? kPaymentPaidGreen
                                                    : tokens.gold,
                                                borderRadius:
                                                    BorderRadius.circular(4),
                                              ),
                                              child: Text(
                                                _statusDisp.toUpperCase(),
                                                style: TextStyle(
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.w800,
                                                  color: tokens.onGold,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                        if (_headerMetaDate.isNotEmpty ||
                                            _amountFmt.isNotEmpty)
                                          Padding(
                                            padding:
                                                const EdgeInsets.only(top: 6),
                                            child: Text.rich(
                                              TextSpan(
                                                style: TextStyle(
                                                  fontSize: 13,
                                                  color: tokens.onSurfaceMuted,
                                                ),
                                                children: [
                                                  if (_headerMetaDate
                                                      .isNotEmpty)
                                                    TextSpan(
                                                        text: _headerMetaDate),
                                                  if (_headerMetaDate
                                                          .isNotEmpty &&
                                                      _amountFmt.isNotEmpty)
                                                    TextSpan(
                                                      text: chrome
                                                          .receiptHeaderMetaSeparator,
                                                    ),
                                                  if (_amountFmt.isNotEmpty)
                                                    TextSpan(
                                                      text: _amountFmt,
                                                      style: TextStyle(
                                                        fontWeight:
                                                            FontWeight.w600,
                                                        color: tokens.onSurface,
                                                      ),
                                                    ),
                                                ],
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Image.asset(
                                        markAsset,
                                        height: 48,
                                        fit: BoxFit.contain,
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        chrome.receiptBrandName,
                                        style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                      if (chrome.receiptMerchantVia.isNotEmpty)
                                        Text(
                                          chrome.receiptMerchantVia,
                                          style: TextStyle(
                                            fontSize: 11,
                                            color: tokens.onSurfaceMuted,
                                          ),
                                        ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        if (chrome
                                            .receiptSectionBillTo.isNotEmpty)
                                          Text(
                                            chrome.receiptSectionBillTo,
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                        if (_billToEmail.isNotEmpty)
                                          Text(_billToEmail)
                                        else if (_billToName.isNotEmpty)
                                          Text(_billToName),
                                        if (chrome.receiptSectionPayment
                                                .isNotEmpty &&
                                            _payMethod.isNotEmpty)
                                          Padding(
                                            padding:
                                                const EdgeInsets.only(top: 8),
                                            child: Text(
                                              '${chrome.receiptSectionPayment}: $_payMethod',
                                              style: TextStyle(
                                                fontSize: 13,
                                                color: tokens.onSurfaceMuted,
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        if (chrome
                                            .receiptSectionFrom.isNotEmpty)
                                          Text(
                                            chrome.receiptSectionFrom,
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                        Text(chrome.receiptBrandName),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (chrome.receiptSectionDetails.isNotEmpty)
                              Padding(
                                padding:
                                    const EdgeInsets.fromLTRB(20, 8, 20, 8),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      chrome.receiptSectionDetails,
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    _labeled(
                                      chrome.receiptLabelReference,
                                      _reference.isNotEmpty
                                          ? _reference
                                          : empty,
                                      tokens,
                                    ),
                                    if (chrome.receiptLabelBillingPeriod
                                            .isNotEmpty &&
                                        chrome.receiptBillingPeriod.isNotEmpty)
                                      _labeled(
                                        chrome.receiptLabelBillingPeriod,
                                        chrome.receiptBillingPeriod,
                                        tokens,
                                      ),
                                    _labeled(
                                      chrome.receiptLabelId,
                                      widget.id,
                                      tokens,
                                    ),
                                    _labeled(
                                      chrome.receiptLabelCurrency,
                                      _currencyCode,
                                      tokens,
                                    ),
                                  ],
                                ),
                              ),
                            // Trim always paints transaction + Subtotal/VAT/Total/Amount paid.
                            ...[
                              Padding(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 20),
                                child: Divider(height: 1, color: tokens.border),
                              ),
                              Padding(
                                padding:
                                    const EdgeInsets.fromLTRB(20, 20, 20, 16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      chrome.receiptSectionTransaction
                                              .isNotEmpty
                                          ? chrome.receiptSectionTransaction
                                          : empty,
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                    const SizedBox(height: 16),
                                    // Web overflow-x-auto + min-w-[520px] parity.
                                    SingleChildScrollView(
                                      scrollDirection: Axis.horizontal,
                                      child: ConstrainedBox(
                                        constraints:
                                            const BoxConstraints(minWidth: 520),
                                        child: Column(
                                          children: [
                                            Row(
                                              children: [
                                                Expanded(
                                                  child: Text(
                                                    _productCol,
                                                    style: const TextStyle(
                                                      fontSize: 12,
                                                      fontWeight:
                                                          FontWeight.w700,
                                                    ),
                                                  ),
                                                ),
                                                SizedBox(
                                                  width: 36,
                                                  child: Text(
                                                    chrome.receiptColQty
                                                            .isNotEmpty
                                                        ? chrome.receiptColQty
                                                        : empty,
                                                    textAlign: TextAlign.right,
                                                    style: const TextStyle(
                                                      fontSize: 12,
                                                      fontWeight:
                                                          FontWeight.w700,
                                                    ),
                                                  ),
                                                ),
                                                SizedBox(
                                                  width: 64,
                                                  child: Text(
                                                    chrome.receiptColUnit
                                                            .isNotEmpty
                                                        ? chrome.receiptColUnit
                                                        : empty,
                                                    textAlign: TextAlign.right,
                                                    style: const TextStyle(
                                                      fontSize: 12,
                                                      fontWeight:
                                                          FontWeight.w700,
                                                    ),
                                                  ),
                                                ),
                                                SizedBox(
                                                  width: 40,
                                                  child: Text(
                                                    chrome.receiptColTaxRate
                                                            .isNotEmpty
                                                        ? chrome
                                                            .receiptColTaxRate
                                                        : empty,
                                                    textAlign: TextAlign.right,
                                                    style: const TextStyle(
                                                      fontSize: 12,
                                                      fontWeight:
                                                          FontWeight.w700,
                                                    ),
                                                  ),
                                                ),
                                                SizedBox(
                                                  width: 72,
                                                  child: Text(
                                                    chrome.receiptColAmount
                                                            .isNotEmpty
                                                        ? chrome
                                                            .receiptColAmount
                                                        : empty,
                                                    textAlign: TextAlign.right,
                                                    style: const TextStyle(
                                                      fontSize: 12,
                                                      fontWeight:
                                                          FontWeight.w700,
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const Divider(),
                                            Row(
                                              children: [
                                                Expanded(
                                                  child: Text(
                                                    chrome.receiptLineDescription
                                                            .isNotEmpty
                                                        ? chrome
                                                            .receiptLineDescription
                                                        : empty,
                                                    style: const TextStyle(
                                                      fontWeight:
                                                          FontWeight.w700,
                                                    ),
                                                  ),
                                                ),
                                                const SizedBox(
                                                  width: 36,
                                                  child: Text(
                                                    '1',
                                                    textAlign: TextAlign.right,
                                                    style:
                                                        TextStyle(fontSize: 13),
                                                  ),
                                                ),
                                                SizedBox(
                                                  width: 64,
                                                  child: Text(
                                                    _amountFmt,
                                                    textAlign: TextAlign.right,
                                                    style: TextStyle(
                                                      fontSize: 13,
                                                      color:
                                                          tokens.onSurfaceMuted,
                                                    ),
                                                  ),
                                                ),
                                                SizedBox(
                                                  width: 40,
                                                  child: Text(
                                                    chrome.receiptTaxRateDisplay
                                                            .isNotEmpty
                                                        ? chrome
                                                            .receiptTaxRateDisplay
                                                        : empty,
                                                    textAlign: TextAlign.right,
                                                    style: TextStyle(
                                                      fontSize: 13,
                                                      color:
                                                          tokens.onSurfaceMuted,
                                                    ),
                                                  ),
                                                ),
                                                SizedBox(
                                                  width: 72,
                                                  child: Text(
                                                    _amountFmt,
                                                    textAlign: TextAlign.right,
                                                    style: const TextStyle(
                                                      fontWeight:
                                                          FontWeight.w700,
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Align(
                                      alignment: Alignment.centerRight,
                                      child: SizedBox(
                                        width: 240,
                                        child: Column(
                                          children: [
                                            _totalsRow(
                                              chrome.receiptLabelSubtotal
                                                      .isNotEmpty
                                                  ? chrome.receiptLabelSubtotal
                                                  : empty,
                                              _amountFmt,
                                              tokens,
                                              muted: true,
                                            ),
                                            _totalsRow(
                                              chrome.receiptLabelTax.isNotEmpty
                                                  ? chrome.receiptLabelTax
                                                  : empty,
                                              _taxFmt,
                                              tokens,
                                              muted: true,
                                            ),
                                            _totalsRow(
                                              chrome.receiptLabelTotal
                                                      .isNotEmpty
                                                  ? chrome.receiptLabelTotal
                                                  : empty,
                                              _amountFmt,
                                              tokens,
                                            ),
                                            _totalsRow(
                                              chrome.receiptLabelAmountPaid
                                                      .isNotEmpty
                                                  ? chrome
                                                      .receiptLabelAmountPaid
                                                  : empty,
                                              _amountFmt,
                                              tokens,
                                              bold: true,
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                    ...[
                                      const SizedBox(height: 24),
                                      SizedBox(
                                        width: 240,
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              chrome.receiptSectionTaxBreakdown
                                                      .isNotEmpty
                                                  ? chrome
                                                      .receiptSectionTaxBreakdown
                                                  : empty,
                                              style: const TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                            const SizedBox(height: 8),
                                            Row(
                                              mainAxisAlignment:
                                                  MainAxisAlignment
                                                      .spaceBetween,
                                              children: [
                                                Text(
                                                  chrome.receiptLabelTaxPercent
                                                          .isNotEmpty
                                                      ? chrome
                                                          .receiptLabelTaxPercent
                                                      : empty,
                                                  style: const TextStyle(
                                                    fontSize: 12,
                                                    fontWeight: FontWeight.w700,
                                                  ),
                                                ),
                                                Text(
                                                  chrome.receiptLabelTax
                                                          .isNotEmpty
                                                      ? chrome.receiptLabelTax
                                                      : empty,
                                                  style: const TextStyle(
                                                    fontSize: 12,
                                                    fontWeight: FontWeight.w700,
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const Divider(height: 12),
                                            Row(
                                              mainAxisAlignment:
                                                  MainAxisAlignment
                                                      .spaceBetween,
                                              children: [
                                                Text(
                                                  chrome.receiptTaxRateDisplay
                                                          .isNotEmpty
                                                      ? chrome
                                                          .receiptTaxRateDisplay
                                                      : empty,
                                                  style: TextStyle(
                                                    fontSize: 13,
                                                    color:
                                                        tokens.onSurfaceMuted,
                                                  ),
                                                ),
                                                Text(
                                                  _taxFmt,
                                                  style: TextStyle(
                                                    fontSize: 13,
                                                    color:
                                                        tokens.onSurfaceMuted,
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 8),
                                            Row(
                                              mainAxisAlignment:
                                                  MainAxisAlignment
                                                      .spaceBetween,
                                              children: [
                                                Text(
                                                  chrome.receiptLabelTaxTotal
                                                          .isNotEmpty
                                                      ? chrome
                                                          .receiptLabelTaxTotal
                                                      : empty,
                                                  style: const TextStyle(
                                                    fontWeight: FontWeight.w800,
                                                  ),
                                                ),
                                                Text(
                                                  _taxFmt,
                                                  style: const TextStyle(
                                                    fontWeight: FontWeight.w800,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ],
                            if (_proofUrl.isNotEmpty) ...[
                              Padding(
                                padding:
                                    const EdgeInsets.fromLTRB(20, 0, 20, 8),
                                child: Text(
                                  chrome.receiptSectionProof.isNotEmpty
                                      ? chrome.receiptSectionProof
                                      : chrome.receiptProofCaption,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                              Padding(
                                padding:
                                    const EdgeInsets.fromLTRB(20, 0, 20, 16),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: Image.network(
                                    _proofUrl,
                                    fit: BoxFit.contain,
                                    errorBuilder: (_, __, ___) => Text(
                                      chrome.receiptProofCaption.isNotEmpty
                                          ? chrome.receiptProofCaption
                                          : _proofUrl,
                                      style: TextStyle(color: tokens.gold),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                            if (chrome.receiptFooter.isNotEmpty)
                              Container(
                                width: double.infinity,
                                // Trim/web print:py-7 letterhead band padding.
                                padding:
                                    const EdgeInsets.fromLTRB(20, 28, 20, 28),
                                color: tokens.surfaceMuted,
                                child: Column(
                                  children: [
                                    // Trim footer order: copy → md mark (22) → brand locality.
                                    Text(
                                      chrome.receiptFooter,
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: tokens.onSurfaceMuted,
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                    Opacity(
                                      opacity: 0.7,
                                      child: Image.asset(
                                        markAsset,
                                        height: 28,
                                        fit: BoxFit.contain,
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                    Text(
                                      chrome.receiptBrandName,
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: tokens.onSurfaceMuted,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Letterhead-shaped loading shell matching web ReceiptDetailSkeleton topology.
class _ReceiptLetterheadSkeleton extends StatelessWidget {
  const _ReceiptLetterheadSkeleton({
    required this.tokens,
    required this.chrome,
  });

  final DamaColors tokens;
  final WalletChrome chrome;

  Widget _bar(double h, double w) => Container(
        height: h,
        width: w,
        decoration: BoxDecoration(
          color: tokens.border.withValues(alpha: 0.45),
          borderRadius: BorderRadius.circular(4),
        ),
      );

  Widget _headingOrBar(String label, double w) {
    if (label.trim().isNotEmpty) {
      return Text(
        label.trim(),
        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
      );
    }
    return _bar(13, w);
  }

  @override
  Widget build(BuildContext context) {
    final title = chrome.receiptDocumentTitle.trim();
    final brand = chrome.receiptBrandName.trim();
    final via = chrome.receiptMerchantVia.trim();
    final totals = <(String, bool)>[
      (chrome.receiptLabelSubtotal, false),
      (chrome.receiptLabelTax, false),
      (chrome.receiptLabelTotal, false),
      (chrome.receiptLabelAmountPaid, true),
    ];
    return SingleChildScrollView(
      child: ColoredBox(
        color: tokens.surface,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
              color: tokens.surfaceMuted,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            if (title.isNotEmpty)
                              Text(
                                title,
                                style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800,
                                ),
                              )
                            else
                              _bar(22, 140),
                            const SizedBox(width: 10),
                            _bar(18, 56),
                          ],
                        ),
                        const SizedBox(height: 8),
                        _bar(13, 180),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      // Live mark lg = 28 / footer sm = 18.
                      _bar(28, 28),
                      const SizedBox(height: 4),
                      if (brand.isNotEmpty)
                        Text(
                          brand,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                          ),
                        )
                      else
                        _bar(15, 48),
                      const SizedBox(height: 4),
                      if (via.isNotEmpty)
                        Text(
                          via,
                          style: TextStyle(
                            fontSize: 11,
                            color: tokens.onSurfaceMuted,
                          ),
                        )
                      else
                        _bar(11, 72),
                    ],
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _headingOrBar(chrome.receiptSectionBillTo, 64),
                        const SizedBox(height: 8),
                        _bar(13, 120),
                        const SizedBox(height: 4),
                        _bar(13, 160),
                      ],
                    ),
                  ),
                  const SizedBox(width: 24),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _headingOrBar(chrome.receiptSectionFrom, 72),
                        const SizedBox(height: 8),
                        _bar(13, 80),
                        const SizedBox(height: 4),
                        _bar(13, 140),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _headingOrBar(chrome.receiptSectionDetails, 96),
                  const SizedBox(height: 12),
                  _bar(13, 220),
                  const SizedBox(height: 4),
                  _bar(13, 200),
                  const SizedBox(height: 4),
                  _bar(13, 180),
                  const SizedBox(height: 4),
                  _bar(13, 160),
                  const SizedBox(height: 4),
                  _bar(13, 140),
                  const SizedBox(height: 4),
                  _bar(13, 120),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Divider(height: 1, color: tokens.border),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _headingOrBar(chrome.receiptSectionTransaction, 88),
                  const SizedBox(height: 16),
                  _bar(12, double.infinity),
                  const SizedBox(height: 12),
                  _bar(13, double.infinity),
                  const SizedBox(height: 8),
                  _bar(13, 180),
                  const SizedBox(height: 16),
                  Align(
                    alignment: Alignment.centerRight,
                    child: SizedBox(
                      width: 240,
                      child: Column(
                        children: [
                          for (final row in totals) ...[
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              child: Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  if (row.$1.trim().isNotEmpty)
                                    Text(
                                      row.$1.trim(),
                                      style: TextStyle(
                                        fontSize: row.$2 ? 15 : 13,
                                        fontWeight: row.$2
                                            ? FontWeight.w800
                                            : FontWeight.w500,
                                        color: row.$2
                                            ? null
                                            : tokens.onSurfaceMuted,
                                      ),
                                    )
                                  else
                                    _bar(row.$2 ? 15 : 13, row.$2 ? 96 : 64),
                                  _bar(row.$2 ? 15 : 13, row.$2 ? 56 : 48),
                                ],
                              ),
                            ),
                            Divider(height: 1, color: tokens.border),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: 240,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _headingOrBar(chrome.receiptSectionTaxBreakdown, 100),
                        const SizedBox(height: 8),
                        _bar(13, 240),
                        const SizedBox(height: 8),
                        _bar(13, 240),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
              color: tokens.surfaceMuted,
              child: Column(
                children: [
                  if (chrome.receiptFooter.trim().isNotEmpty)
                    Text(
                      chrome.receiptFooter.trim(),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12,
                        color: tokens.onSurfaceMuted,
                      ),
                    )
                  else
                    _bar(12, 220),
                  const SizedBox(height: 12),
                  _bar(18, 18),
                  const SizedBox(height: 8),
                  _bar(11, 160),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
