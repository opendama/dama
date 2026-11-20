import 'dart:convert';

import 'package:dama_mobile/core/errors/api_user_message.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/prize_pool_lines.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/util/sanitize_decimal_input.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/auth/auth_providers.dart';
import 'package:dama_mobile/features/auth/sign_in_dialog.dart';
import 'package:dama_mobile/features/events/community_player_chrome_soft.dart';
import 'package:dama_mobile/features/events/event_join_error.dart';
import 'package:dama_mobile/features/events/hosting_organizer_chrome_soft.dart';
import 'package:dama_mobile/features/legal/legal_page.dart';
import 'package:dama_mobile/features/notifications/notification_href_nav.dart';
import 'package:dama_mobile/features/wallet/portal_wallet_focus.dart';
import 'package:dama_mobile/features/wallet/wallet_cubit.dart';
import 'package:dama_mobile/features/wallet/wallet_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;

void _openTopUpHref(
  BuildContext context, {
  required String token,
  required String href,
}) {
  final raw = withWalletFocusParam(href.trim(), 'topup');
  if (raw.isEmpty) return;
  if (isWalletHrefPath(raw)) {
    final focus = portalWalletFocusFromHref(raw);
    final base = moneyBasePathFromHref(raw);
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => WalletPage(
          token: token,
          moneyBasePath: base,
          showOrganizerPayoutBlurb: base.isNotEmpty,
          focusPayout: focus.focusPayout,
          focusTopUp: focus.focusTopUp,
          focusPayoutHistoryId: focus.historyId,
        ),
      ),
    );
    return;
  }
  navigateNotificationHref(context, href: raw, accessToken: token);
}

/// Paid hosted-event join confirm (web PaymentEventJoinModal / tournament enroll parity).
/// Returns `true` when join succeeded or player was already seated.
Future<bool> showPaymentEventJoinDialog(
  BuildContext context, {
  required HostedEvent event,
  PrizePoolCardLabels? prizePoolLabels,
  required EventsPlayerChrome joinChrome,
}) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (_) => PaymentEventJoinDialog(
      event: event,
      prizePoolLabels: prizePoolLabels,
      joinChrome: joinChrome,
    ),
  );
  return ok == true;
}

class PaymentEventJoinDialog extends StatefulWidget {
  const PaymentEventJoinDialog({
    super.key,
    required this.event,
    this.prizePoolLabels,
    required this.joinChrome,
  });

  final HostedEvent event;
  final PrizePoolCardLabels? prizePoolLabels;
  final EventsPlayerChrome joinChrome;

  @override
  State<PaymentEventJoinDialog> createState() => _PaymentEventJoinDialogState();
}

class _PaymentEventJoinDialogState extends State<PaymentEventJoinDialog> {
  PaymentModalChrome? _chrome;
  LegalChrome? _legalChrome;
  CashRmgChrome? _cashChrome;
  FeatureFlagsWire? _flags;
  EventsCatalog? _catalog;
  bool _cashGateSettled = false;
  String _unavailable = '';
  bool _chromeLoading = true;
  bool _joining = false;
  AuthProvidersChrome? _authChrome;
  final _amountCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadChrome();
    _loadAuthChrome();
    _loadLegalChrome();
    _loadCashGate();
    _loadCatalog();
  }

  Future<void> _loadCatalog() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/catalog'),
      );
      if (res.statusCode >= 300) return;
      final catalog = EventsCatalog.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      if (!mounted) return;
      setState(() => _catalog = catalog);
    } catch (_) {}
  }

  Future<void> _loadCashGate() async {
    try {
      final results = await Future.wait([
        http.get(Uri.parse('${ApiConfig.baseUrl}/api/v1/feature-flags')),
        http.get(
            Uri.parse('${ApiConfig.baseUrl}/api/v1/public/cash-rmg-chrome')),
      ]);
      final flagsRes = results[0];
      final chromeRes = results[1];
      FeatureFlagsWire? flags;
      CashRmgChrome? cashChrome;
      if (flagsRes.statusCode == 200) {
        final map = jsonDecode(flagsRes.body);
        if (map is Map<String, dynamic>) {
          flags = FeatureFlagsWire.fromJson(map);
        }
      }
      if (chromeRes.statusCode == 200) {
        final map = jsonDecode(chromeRes.body);
        if (map is Map<String, dynamic>) {
          final chromeMap = map['chrome'];
          if (chromeMap is Map<String, dynamic>) {
            cashChrome = CashRmgChrome.fromJson(chromeMap);
          }
        }
      }
      if (!mounted) return;
      setState(() {
        _flags = flags;
        _cashChrome = cashChrome;
        _cashGateSettled = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _cashGateSettled = true;
      });
    }
  }

  bool _cashLocked(String countryCode) {
    if (widget.event.isFreeEntry) return false;
    if (!_cashGateSettled) return false;
    final flags = _flags;
    if (flags == null) return true;
    if (!flags.cashRmgEnabled) return true;
    final cc = countryCode.trim().toUpperCase();
    if (cc.isEmpty) return false;
    return flags.cashRmgDisabledCountries
        .any((c) => c.trim().toUpperCase() == cc);
  }

  String _cashLockMessage(String countryCode) {
    final chrome = _cashChrome;
    if (chrome == null) return '';
    final flags = _flags;
    if (flags != null &&
        flags.cashRmgEnabled &&
        countryCode.trim().isNotEmpty &&
        flags.cashRmgDisabledCountries.any(
          (c) => c.trim().toUpperCase() == countryCode.trim().toUpperCase(),
        )) {
      return chrome.jurisdictionBlockedError;
    }
    return chrome.cashDisabledError;
  }

  Future<void> _loadLegalChrome() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/public/legal-chrome'),
      );
      if (res.statusCode >= 300) return;
      final chrome = LegalChrome.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      if (!mounted) return;
      setState(() => _legalChrome = chrome);
    } catch (_) {}
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadAuthChrome() async {
    final chrome = await fetchAuthProvidersChrome();
    if (!mounted) return;
    setState(() => _authChrome = chrome);
  }

  Future<void> _loadChrome() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/public/payment-modal-chrome'),
      );
      if (res.statusCode >= 300) {
        if (!mounted) return;
        setState(() {
          _chromeLoading = false;
          _unavailable = '';
        });
        return;
      }
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      final chrome = PaymentModalChrome.fromJson(map);
      if (!mounted) return;
      setState(() {
        _chrome = chrome;
        _unavailable =
            (map['payment_modal_unavailable'] as String?)?.trim() ?? '';
        _chromeLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _chromeLoading = false);
    }
  }

  Future<void> _confirmJoin(
    String token,
    PaymentModalChrome chrome, {
    required String countryCode,
  }) async {
    final ev = widget.event;
    final joinChrome = widget.joinChrome;
    final code = ev.joinCode.trim().toUpperCase();
    if (code.isEmpty) return;
    final cc = countryCode.trim().toUpperCase();
    if (!ev.isFreeEntry && cc.isEmpty) {
      return;
    }
    if (!ev.isFreeEntry) {
      final flags = _flags;
      if (flags == null || !flags.cashAllowedForCountry(cc)) {
        final msg = _cashLockMessage(cc);
        if (msg.isNotEmpty && mounted) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(msg)));
        }
        return;
      }
    }
    setState(() => _joining = true);
    try {
      final body = <String, dynamic>{'code': code};
      if (cc.isNotEmpty) body['country_code'] = cc;
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/events/join'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(body),
      );
      if (!mounted) return;
      if (res.statusCode == 402) {
        final msg =
            softCommunityJoinStatusMessage(joinChrome.insufficientEntryFee);
        showEventJoinSnack(
          context,
          message: msg.isNotEmpty
              ? msg
              : softCommunityLoadFailed(joinChrome.loadFailed),
        );
        setState(() => _joining = false);
        return;
      }
      if (res.statusCode >= 300) {
        if (isAlreadyJoinedEventError(res)) {
          final msg = softCommunityJoinStatusMessage(
            joinChrome.alreadyJoined.trim().isNotEmpty
                ? joinChrome.alreadyJoined
                : joinChrome.approvedBlurb,
          );
          showEventJoinSnack(context, message: msg, success: true);
          if (!mounted) return;
          Navigator.of(context).pop(true);
          return;
        }
        showEventJoinSnack(
          context,
          message: eventJoinErrorChrome(joinChrome, res),
        );
        setState(() => _joining = false);
        return;
      }
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      final entryRaw = map['entry'];
      var blurb = joinChrome.approvedBlurb;
      if (entryRaw is Map<String, dynamic>) {
        final entry = HostedEventEntry.fromJson(entryRaw);
        final st = entry.status.trim();
        final pending = (_catalog?.hostedEventEntryPending ?? '').trim();
        if (pending.isNotEmpty && st == pending) {
          blurb = joinChrome.pendingApproval;
        }
      }
      showEventJoinSnack(
        context,
        message: softCommunityJoinStatusMessage(blurb),
        success: true,
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (_) {
      if (!mounted) return;
      showEventJoinSnack(
        context,
        message: softCommunityLoadFailed(joinChrome.loadFailed),
      );
      setState(() => _joining = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final ev = widget.event;
    final metaSepFallback = widget.joinChrome.metaSeparator;

    if (_chromeLoading) {
      return AlertDialog(
        content: SizedBox(
          height: 96,
          child: Center(
            child: CircularProgressIndicator(color: tokens.gold),
          ),
        ),
      );
    }

    final chrome = _chrome;
    if (chrome == null) {
      return AlertDialog(
        content: Text(
          _unavailable,
          style: TextStyle(color: tokens.danger),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Icon(Icons.close),
          ),
        ],
      );
    }

    final auth = context.watch<AuthCubit>().state;
    if (!auth.isAuthenticated) {
      final signIn = (_authChrome?.navSignInLabel ?? '').trim();
      return AlertDialog(
        title: Text(softPaymentModalTitle(chrome.title)),
        content: signIn.isEmpty
            ? const SizedBox.shrink()
            : TextButton(
                onPressed: () {
                  showSignInDialog(context);
                },
                child: Text(signIn),
              ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(softHostingCancelAction(chrome.cancelAction)),
          ),
        ],
      );
    }

    return BlocProvider(
      create: (_) {
        final cubit = WalletCubit(accessToken: auth.token!);
        WalletPage.unawaitedLoad(cubit);
        return cubit;
      },
      child: BlocConsumer<WalletCubit, WalletState>(
        listenWhen: (prev, next) =>
            prev.checkoutMessage != next.checkoutMessage ||
            prev.error != next.error,
        listener: (context, state) {
          final msg = chromeOnlyUserMessage(
            state.checkoutMessage ?? state.error,
          );
          if (msg == null) return;
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(msg)));
        },
        builder: (context, wallet) {
          final feeAmt = ev.entryFeeAmount;
          final feeCurrency = ev.entryFeeCurrency.trim();
          final moneySep = chrome.amountCurrencySeparator;
          final metaSep =
              widget.prizePoolLabels?.metaSeparator ?? metaSepFallback;
          final feeMoney = !ev.isFreeEntry &&
                  feeAmt != null &&
                  feeCurrency.isNotEmpty &&
                  moneySep.isNotEmpty
              ? '$feeAmt$moneySep$feeCurrency'
              : '';
          final feeLine = ev.isFreeEntry
              ? chrome.feeLabel
              : feeMoney.isNotEmpty
                  ? '${chrome.feeLabel}$metaSep$feeMoney'
                  : chrome.feeLabel;
          final balance = wallet.balance;
          final walletReady = balance != null;
          final balanceCurrency = (wallet.walletCurrency ?? '').trim();
          final country = wallet.country.trim();
          final resolving = !ev.isFreeEntry &&
              (!_cashGateSettled ||
                  wallet.locating ||
                  (country.isNotEmpty &&
                      (wallet.loading ||
                          !walletReady ||
                          balanceCurrency.isEmpty)));
          final countryMissing =
              !ev.isFreeEntry && !wallet.locating && country.isEmpty;
          final canAfford = ev.isFreeEntry ||
              (feeAmt != null && balance != null && balance >= feeAmt);
          final isManual = wallet.routeProvider == 'manual_transfer';
          final cashLocked = _cashLocked(wallet.country);
          final cashLockMsg = _cashLockMessage(wallet.country);
          final topUpValid = parsePositiveDecimal(_amountCtrl.text) != null;

          String blurb;
          if (cashLocked) {
            blurb = cashLockMsg.isNotEmpty
                ? cashLockMsg
                : softCommunityJoinStatusMessage(chrome.blurb);
          } else if (resolving) {
            blurb = chrome.balancePending;
          } else if (countryMissing) {
            blurb = chrome.countryRequiredHint;
          } else if (canAfford) {
            blurb = softCommunityJoinStatusMessage(chrome.blurb);
          } else {
            blurb = softCommunityJoinStatusMessage(chrome.insufficientBlurb);
          }

          return AlertDialog(
            title: Text(softPaymentModalTitle(chrome.title)),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    blurb,
                    style: TextStyle(
                      color: cashLocked || countryMissing
                          ? tokens.danger
                          : tokens.onSurfaceMuted,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    feeLine,
                    style: TextStyle(
                      color: tokens.gold,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (widget.prizePoolLabels != null) ...[
                    Builder(
                      builder: (context) {
                        final lines = hostedEventPrizePoolLines(
                          ev,
                          widget.prizePoolLabels!,
                        );
                        if (lines.isEmpty) return const SizedBox.shrink();
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 8),
                            Text(
                              lines.join(widget.prizePoolLabels!.metaSeparator),
                              style: TextStyle(
                                color: tokens.onSurfaceMuted,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                  ],
                  const SizedBox(height: 8),
                  if (resolving)
                    Row(
                      children: [
                        Text(
                          metaSep.isNotEmpty
                              ? '${chrome.balanceLabel}$metaSep'
                              : chrome.balanceLabel,
                        ),
                        SizedBox(
                          width: 72,
                          height: 14,
                          child: LinearProgressIndicator(
                            color: tokens.gold,
                            backgroundColor: tokens.border,
                          ),
                        ),
                      ],
                    )
                  else if (countryMissing)
                    Text(
                      '${chrome.balanceLabel}$metaSep${chrome.balancePending}',
                    )
                  else if (walletReady &&
                      balanceCurrency.isNotEmpty &&
                      moneySep.isNotEmpty)
                    Text(
                      '${chrome.balanceLabel}$metaSep$balance$moneySep$balanceCurrency',
                    )
                  else
                    Text(
                      '${chrome.balanceLabel}$metaSep${chrome.balancePending}',
                    ),
                  if (!cashLocked && countryMissing) ...[
                    const SizedBox(height: 16),
                    Text(
                      chrome.countryRequiredHint,
                      style: TextStyle(color: tokens.danger),
                    ),
                    const SizedBox(height: 8),
                    FilledButton(
                      onPressed: chrome.topUpHref.isEmpty
                          ? null
                          : () {
                              Navigator.of(context).pop();
                              _openTopUpHref(
                                context,
                                token: auth.token!,
                                href: chrome.topUpHref,
                              );
                            },
                      child: Text(chrome.topUpAction),
                    ),
                  ],
                  if (!cashLocked &&
                      !resolving &&
                      !countryMissing &&
                      !canAfford) ...[
                    const SizedBox(height: 16),
                    Text(
                      chrome.insufficientTitle,
                      style: TextStyle(
                        color: tokens.gold,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (isManual) ...[
                      const SizedBox(height: 8),
                      Text(
                        chrome.methodsBlurb,
                        style: TextStyle(color: tokens.onSurfaceMuted),
                      ),
                      const SizedBox(height: 8),
                      FilledButton(
                        onPressed: chrome.topUpHref.isEmpty
                            ? null
                            : () {
                                Navigator.of(context).pop();
                                _openTopUpHref(
                                  context,
                                  token: auth.token!,
                                  href: chrome.topUpHref,
                                );
                              },
                        child: Text(chrome.topUpAction),
                      ),
                    ] else ...[
                      const SizedBox(height: 8),
                      Text(
                        chrome.methodsTitle,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        chrome.methodsBlurb,
                        style: TextStyle(color: tokens.onSurfaceMuted),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _amountCtrl,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(RegExp(r'[\d.]')),
                        ],
                        decoration: InputDecoration(
                          labelText: chrome.amountLabel,
                          hintText: chrome.amountPlaceholder,
                          border: const OutlineInputBorder(),
                        ),
                        onChanged: (v) {
                          final s = sanitizeDecimalInput(v);
                          if (s != v) {
                            _amountCtrl.value = TextEditingValue(
                              text: s,
                              selection:
                                  TextSelection.collapsed(offset: s.length),
                            );
                          }
                          context.read<WalletCubit>().setAmountText(s);
                          setState(() {});
                        },
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          FilledButton(
                            onPressed: wallet.loading ||
                                    wallet.country.trim().isEmpty ||
                                    !topUpValid
                                ? null
                                : () => context.read<WalletCubit>().checkout(),
                            child: Text(chrome.checkoutAction),
                          ),
                          OutlinedButton(
                            onPressed: chrome.topUpHref.isEmpty
                                ? null
                                : () {
                                    Navigator.of(context).pop();
                                    _openTopUpHref(
                                      context,
                                      token: auth.token!,
                                      href: chrome.topUpHref,
                                    );
                                  },
                            child: Text(chrome.topUpAction),
                          ),
                        ],
                      ),
                    ],
                  ],
                  if (_legalChrome != null) ...[
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      children: [
                        TextButton(
                          onPressed: () =>
                              openLegalPage(context, LegalDocKind.privacy),
                          child: Text(_legalChrome!.privacyNavLabel),
                        ),
                        TextButton(
                          onPressed: () =>
                              openLegalPage(context, LegalDocKind.terms),
                          child: Text(_legalChrome!.termsNavLabel),
                        ),
                        TextButton(
                          onPressed: () =>
                              openLegalPage(context, LegalDocKind.refunds),
                          child: Text(_legalChrome!.refundsNavLabel),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            actions: [
              if (resolving && !cashLocked)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Text(
                    chrome.balancePending,
                    style:
                        TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
                  ),
                ),
              if (!cashLocked && canAfford && !resolving && !countryMissing)
                FilledButton(
                  onPressed: _joining ||
                          (!ev.isFreeEntry && wallet.country.trim().isEmpty)
                      ? null
                      : () => _confirmJoin(
                            auth.token!,
                            chrome,
                            countryCode: wallet.country,
                          ),
                  child: Text(
                    _joining ? chrome.confirmPending : chrome.confirmAction,
                  ),
                ),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text(softHostingCancelAction(chrome.cancelAction)),
              ),
            ],
          );
        },
      ),
    );
  }
}
