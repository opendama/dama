import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/media_upload_chrome.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/media_dropzone.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/core/util/sanitize_decimal_input.dart';
import 'package:dama_mobile/features/notifications/notification_app_bar_actions.dart';
import 'package:dama_mobile/features/notifications/notification_href_nav.dart';
import 'package:dama_mobile/features/wallet/wallet_cubit.dart';
import 'package:dama_mobile/features/wallet/wallet_page.dart';
import 'package:dama_mobile/widgets/dama_brand_mark.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;

/// Domestic manual-transfer top-up (banks + receipt). Web ManualTransferWorkspace parity.
class ManualTransferPage extends StatelessWidget {
  ManualTransferPage({
    super.key,
    required this.accessToken,
    this.moneyBasePath = '',
    this.initialAmount = '',
    this.intentId = '',
    ApiConfig? config,
  }) : config = config ?? ApiConfig.defaults;

  final String accessToken;
  final String moneyBasePath;
  final String initialAmount;
  final String intentId;
  final ApiConfig config;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) {
        final cubit = WalletCubit(
          accessToken: accessToken,
          config: config,
        );
        final prefill = initialAmount.trim();
        if (prefill.isNotEmpty) {
          cubit.setAmountText(prefill);
        }
        WalletPage.unawaitedLoad(cubit);
        return cubit;
      },
      child: _ManualTransferView(
        accessToken: accessToken,
        moneyBasePath: moneyBasePath,
        initialAmount: initialAmount,
        intentId: intentId,
      ),
    );
  }
}

class _ManualTransferView extends StatefulWidget {
  const _ManualTransferView({
    required this.accessToken,
    required this.moneyBasePath,
    this.initialAmount = '',
    this.intentId = '',
  });

  final String accessToken;
  final String moneyBasePath;
  final String initialAmount;
  final String intentId;

  @override
  State<_ManualTransferView> createState() => _ManualTransferViewState();
}

class _ManualTransferViewState extends State<_ManualTransferView> {
  late final TextEditingController _amountCtrl;
  MediaUploadChrome? _mediaChrome;
  bool _attempted = false;

  static final _decimalFormatters = <TextInputFormatter>[
    FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
  ];

  @override
  void initState() {
    super.initState();
    final prefill = widget.initialAmount.trim();
    _amountCtrl = TextEditingController(text: prefill);
    unawaited(_loadMediaChrome());
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadMediaChrome() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/public/media-upload-chrome'),
      );
      if (res.statusCode >= 300 || !mounted) return;
      final body = jsonDecode(res.body);
      if (body is! Map<String, dynamic>) return;
      final chrome = MediaUploadChrome.fromJson(body);
      if (chrome == null || !mounted) return;
      setState(() => _mediaChrome = chrome);
    } catch (_) {}
  }

  Widget _bankCopyRow({
    required BuildContext context,
    required WalletChrome c,
    required DamaColors tokens,
    required String prefix,
    required String value,
    required String copyLabel,
  }) {
    final v = value.trim();
    if (v.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        children: [
          Expanded(
            child: Text(
              '$prefix $v',
              style: TextStyle(fontSize: 13, color: tokens.onSurface),
            ),
          ),
          if (copyLabel.isNotEmpty && c.copyAction.isNotEmpty)
            TextButton(
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: v));
                if (!context.mounted) return;
                final msg =
                    c.toastCopied.trim().isNotEmpty ? c.toastCopied : copyLabel;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(msg)),
                );
              },
              child: Text(copyLabel.isNotEmpty ? copyLabel : c.copyAction),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    return BlocBuilder<WalletCubit, WalletState>(
      builder: (context, state) {
        final c = state.chrome;
        final title = (c?.manualTransferPageTitle ?? '').trim().isNotEmpty
            ? c!.manualTransferPageTitle.trim()
            : (c?.linkManualTransferLabel ?? '').trim();
        final blurb = (c?.manualTransferPageBlurb ?? '').trim();
        final unavailable = (c?.manualTransferUnavailable ?? '').trim();
        final panelBusy = state.initialHydrating || c == null || title.isEmpty;

        return Scaffold(
          appBar: AppBar(
            title: title.isNotEmpty
                ? DamaBrandTitle(title: title, markSize: 26)
                : const SizedBox.shrink(),
            actions: const [NotificationAppBarActions()],
          ),
          body: panelBusy
              ? const WalletSkeleton()
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (blurb.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(
                          blurb,
                          style: TextStyle(color: tokens.onSurfaceMuted),
                        ),
                      ),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        if (c.linkReceiptsLabel.isNotEmpty &&
                            c.linkReceiptsHref.isNotEmpty)
                          OutlinedButton(
                            onPressed: () {
                              navigateNotificationHref(
                                context,
                                href: moneyHref(
                                  widget.moneyBasePath,
                                  c.linkReceiptsHref,
                                ),
                                accessToken: widget.accessToken,
                              );
                            },
                            child: Text(c.linkReceiptsLabel),
                          ),
                        if (c.pageTitle.isNotEmpty &&
                            c.linkWalletHref.isNotEmpty)
                          OutlinedButton(
                            onPressed: () {
                              navigateNotificationHref(
                                context,
                                href: moneyHref(
                                  widget.moneyBasePath,
                                  c.linkWalletHref,
                                ),
                                accessToken: widget.accessToken,
                              );
                            },
                            child: Text(c.pageTitle),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (!state.isManualTransfer) ...[
                      if (unavailable.isNotEmpty)
                        Text(
                          unavailable,
                          style: TextStyle(color: tokens.onSurfaceMuted),
                        ),
                    ] else ...[
                      Text(
                        c.manualAccountsTitle,
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: tokens.onSurface,
                        ),
                      ),
                      const SizedBox(height: 8),
                      if (state.banksLoading)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 8),
                          child: LinearProgressIndicator(),
                        ),
                      if (!state.banksLoading && state.banks.isEmpty)
                        Text(
                          c.banksEmpty,
                          style: TextStyle(color: tokens.danger),
                        ),
                      for (final b in state.banks)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: tokens.card,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: tokens.border),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  b.label,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                _bankCopyRow(
                                  context: context,
                                  c: c,
                                  tokens: tokens,
                                  prefix: c.bankNamePrefix,
                                  value: b.accountName ?? '',
                                  copyLabel: c.bankCopyNameLabel,
                                ),
                                _bankCopyRow(
                                  context: context,
                                  c: c,
                                  tokens: tokens,
                                  prefix: c.bankAccountPrefix,
                                  value: b.accountNumber ?? '',
                                  copyLabel: c.bankCopyAccountLabel,
                                ),
                                _bankCopyRow(
                                  context: context,
                                  c: c,
                                  tokens: tokens,
                                  prefix: c.bankMobilePrefix,
                                  value: b.mobileCode ?? '',
                                  copyLabel: c.bankCopyMobileLabel,
                                ),
                                Padding(
                                  padding: const EdgeInsets.only(top: 6),
                                  child: Text(
                                    '${c.bankCurrencyPrefix} ${b.currency}',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: tokens.onSurfaceMuted,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _amountCtrl,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        inputFormatters: _decimalFormatters,
                        decoration: InputDecoration(
                          labelText: c.topUpAmountLabel,
                          hintText: c.topUpAmountPlaceholder,
                          border: const OutlineInputBorder(),
                          errorText: _attempted &&
                                  parsePositiveDecimal(_amountCtrl.text) == null
                              ? c.invalidTopUpAmount
                              : null,
                        ),
                        enabled: !state.cashActionBlocked,
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
                          if (_attempted) setState(() {});
                        },
                      ),
                      const SizedBox(height: 12),
                      if (_mediaChrome != null)
                        MediaDropzone(
                          label: c.receiptImageLabel,
                          chrome: _mediaChrome!,
                          previewUrl: state.receiptUrl,
                          busy: state.loading,
                          enabled: !state.cashActionBlocked,
                          errorText:
                              _attempted && state.receiptUrl.trim().isEmpty
                                  ? c.receiptSubmitFailed
                                  : null,
                          onClear: state.cashActionBlocked
                              ? null
                              : () =>
                                  context.read<WalletCubit>().clearReceiptUrl(),
                          onPicked: (file) => context
                              .read<WalletCubit>()
                              .uploadReceiptFile(file),
                        )
                      else
                        OutlinedButton(
                          onPressed: state.cashActionBlocked || state.loading
                              ? null
                              : () => context
                                  .read<WalletCubit>()
                                  .pickAndUploadReceipt(),
                          child: Text(c.receiptImageLabel),
                        ),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: state.cashActionBlocked || state.loading
                            ? null
                            : () async {
                                setState(() => _attempted = true);
                                if (state.receiptUrl.trim().isEmpty ||
                                    parsePositiveDecimal(_amountCtrl.text) ==
                                        null) {
                                  return;
                                }
                                await context.read<WalletCubit>().submitReceipt(
                                      intentId: widget.intentId,
                                    );
                              },
                        child: Text(c.submitReceiptAction),
                      ),
                    ],
                  ],
                ),
        );
      },
    );
  }
}
