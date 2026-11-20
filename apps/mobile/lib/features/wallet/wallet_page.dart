import 'package:dama_mobile/core/errors/api_user_message.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/payout.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/chrome_date_field.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/core/ui/skip_pagination_bar.dart';
import 'package:dama_mobile/core/util/date_mask.dart';
import 'package:dama_mobile/core/util/sanitize_decimal_input.dart';
import 'package:dama_mobile/core/utils/payment_status_display.dart';
import 'package:dama_mobile/features/compliance/cash_compliance_panel.dart';
import 'package:dama_mobile/features/compliance/document_kyc_panel.dart';
import 'package:dama_mobile/features/notifications/notification_app_bar_actions.dart';
import 'package:dama_mobile/features/notifications/notification_href_nav.dart';
import 'package:dama_mobile/features/wallet/wallet_cubit.dart';
import 'package:dama_mobile/widgets/dama_brand_mark.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// Prefix portal money sibling hrefs (web `moneyHref` parity). Empty = player portal.
String moneyHref(String base, String path) {
  final b = base.trim().replaceAll(RegExp(r'/+$'), '');
  var p = path.trim();
  if (p.isEmpty) return b;
  if (!p.startsWith('/')) p = '/$p';
  return b.isEmpty ? p : '$b$p';
}

class WalletPage extends StatelessWidget {
  WalletPage({
    super.key,
    required this.token,
    this.showOrganizerPayoutBlurb = false,
    this.focusPayout = false,
    this.focusTopUp = false,
    this.focusPayoutHistoryId,
    this.moneyBasePath = '',
    ApiConfig? config,
  }) : config = config ?? ApiConfig.defaults;

  final String token;
  final ApiConfig config;

  /// When true (events/ads money portals), show organizer_payout_section_blurb.
  final bool showOrganizerPayoutBlurb;

  /// Deep-link `?focus=payout` scrolls/highlights payout request form.
  final bool focusPayout;

  /// Deep-link `?focus=topup` opens the top-up sheet (host fee / shortfall CTA).
  final bool focusTopUp;

  /// Deep-link `?id=` seeks payout history row (API id query).
  final String? focusPayoutHistoryId;

  /// Portal prefix for DB `link_*_href` (e.g. `/events`, `/ads`). Empty = player.
  final String moneyBasePath;

  @override
  Widget build(BuildContext context) {
    final historyId = (focusPayoutHistoryId ?? '').trim();
    return BlocProvider(
      create: (_) {
        final cubit = WalletCubit(
          accessToken: token,
          focusPayoutHistoryId: historyId,
          config: config,
        );
        unawaitedLoad(cubit);
        return cubit;
      },
      child: _WalletView(
        accessToken: token,
        showOrganizerPayoutBlurb: showOrganizerPayoutBlurb,
        focusPayout: focusPayout && historyId.isEmpty,
        focusTopUp: focusTopUp && historyId.isEmpty && !focusPayout,
        focusPayoutHistoryId: historyId,
        moneyBasePath: moneyBasePath,
      ),
    );
  }

  static void unawaitedLoad(WalletCubit cubit) {
    cubit.loadWalletChrome();
    cubit.loadCashGate();
    cubit.autoLocate();
  }
}

class _WalletView extends StatefulWidget {
  const _WalletView({
    required this.accessToken,
    this.showOrganizerPayoutBlurb = false,
    this.focusPayout = false,
    this.focusTopUp = false,
    this.focusPayoutHistoryId = '',
    this.moneyBasePath = '',
  });

  final String accessToken;
  final bool showOrganizerPayoutBlurb;
  final String moneyBasePath;
  final bool focusPayout;
  final bool focusTopUp;
  final String focusPayoutHistoryId;

  @override
  State<_WalletView> createState() => _WalletViewState();
}

class _WalletViewState extends State<_WalletView> {
  late final TextEditingController _amountCtrl;
  late final TextEditingController _providerCtrl;
  late final TextEditingController _accountCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _payoutAmountCtrl;
  late final TextEditingController _dobCtrl;
  final _payoutHistoryRowKeys = <String, GlobalKey>{};
  PayoutMethod? _activeMethod;
  bool _openedFocusPayoutSheet = false;
  bool _openedFocusTopUpSheet = false;
  bool _payoutHistoryFocused = false;
  bool _topUpAttempted = false;
  bool _ageAttempted = false;
  bool _payoutAttempted = false;
  bool _payoutMethodAttempted = false;

  static final _decimalFormatters = <TextInputFormatter>[
    FilteringTextInputFormatter.allow(RegExp(r'[\d.]')),
  ];

  @override
  void initState() {
    super.initState();
    _amountCtrl = TextEditingController();
    _providerCtrl = TextEditingController();
    _accountCtrl = TextEditingController();
    _phoneCtrl = TextEditingController();
    _payoutAmountCtrl = TextEditingController();
    _dobCtrl = TextEditingController();
  }

  GlobalKey _historyRowKey(String id) =>
      _payoutHistoryRowKeys.putIfAbsent(id, GlobalKey.new);

  void _scrollToHistoryRow(String id) {
    if (_payoutHistoryFocused || id.isEmpty) return;
    final ctx = _historyRowKey(id).currentContext;
    if (ctx == null) {
      WidgetsBinding.instance
          .addPostFrameCallback((_) => _scrollToHistoryRow(id));
      return;
    }
    _payoutHistoryFocused = true;
    Scrollable.ensureVisible(
      ctx,
      duration: const Duration(milliseconds: 350),
      alignment: 0.2,
    );
  }

  void _syncControllers(WalletState state) {
    if (_amountCtrl.text != state.amountText) {
      _amountCtrl.text = state.amountText;
    }
    if (_providerCtrl.text != state.payoutProvider) {
      _providerCtrl.text = state.payoutProvider;
    }
    if (_accountCtrl.text != state.payoutAccountName) {
      _accountCtrl.text = state.payoutAccountName;
    }
    if (_phoneCtrl.text != state.payoutPhone) {
      _phoneCtrl.text = state.payoutPhone;
    }
    if (_payoutAmountCtrl.text != state.payoutAmountText) {
      _payoutAmountCtrl.text = state.payoutAmountText;
    }
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    _providerCtrl.dispose();
    _accountCtrl.dispose();
    _phoneCtrl.dispose();
    _payoutAmountCtrl.dispose();
    _dobCtrl.dispose();
    super.dispose();
  }

  void _seedMethodFields(PayoutMethod? method) {
    _activeMethod = method;
    final provider = method?.provider ?? '';
    final account = method?.accountName ?? '';
    final phone = method?.phone ?? '';
    _providerCtrl.text = provider;
    _accountCtrl.text = account;
    _phoneCtrl.text = phone;
    context.read<WalletCubit>()
      ..setPayoutProvider(provider)
      ..setPayoutAccountName(account)
      ..setPayoutPhone(phone);
  }

  Widget _walletCard(
    BuildContext context, {
    required Widget child,
    bool highlight = false,
    Key? key,
  }) {
    final tokens = damaColorsOf(context);
    return Container(
      key: key,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: highlight ? tokens.gold : tokens.border,
          width: highlight ? 2 : 1,
        ),
      ),
      child: child,
    );
  }

  Future<void> _showFormSheet({
    required BuildContext context,
    required String title,
    required WidgetBuilder builder,
  }) {
    final cubit = context.read<WalletCubit>();
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        final pad = MediaQuery.viewInsetsOf(ctx).bottom;
        return BlocProvider.value(
          value: cubit,
          child: Padding(
            padding: EdgeInsets.only(bottom: pad),
            child: SafeArea(
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.sizeOf(ctx).height * 0.85,
                ),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 16),
                      builder(ctx),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  void _openTopUpSheet(
    BuildContext context,
    WalletState state,
    WalletChrome c,
  ) {
    _showFormSheet(
      context: context,
      title: c.topUpAction,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _amountCtrl,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: _decimalFormatters,
              decoration: InputDecoration(
                labelText: c.topUpAmountLabel,
                hintText: c.topUpAmountPlaceholder,
                border: const OutlineInputBorder(),
                errorText: _topUpAttempted &&
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
                    selection: TextSelection.collapsed(offset: s.length),
                  );
                }
                context.read<WalletCubit>().setAmountText(s);
                if (_topUpAttempted) setSheet(() {});
              },
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: state.cashActionBlocked || state.loading
                  ? null
                  : () async {
                      setSheet(() => _topUpAttempted = true);
                      if (parsePositiveDecimal(_amountCtrl.text) == null) {
                        return;
                      }
                      final result =
                          await context.read<WalletCubit>().checkout();
                      if (ctx.mounted) Navigator.of(ctx).pop();
                      if (!context.mounted || result == null) return;
                      final provider = (result.route?.provider ??
                              result.intent?.provider ??
                              '')
                          .trim()
                          .toLowerCase();
                      final status =
                          (result.intent?.status ?? '').trim().toLowerCase();
                      final manual = provider == 'manual_transfer' ||
                          provider == 'manual' ||
                          status == 'awaiting_receipt' ||
                          result.banks.isNotEmpty;
                      if (!manual) return;
                      // Defer so the top-up sheet fully closes before Manual Transfer opens.
                      await Future<void>.delayed(Duration.zero);
                      if (!context.mounted) return;
                      final href = (c.linkManualTransferHref).trim();
                      if (href.isEmpty) return;
                      final base = moneyHref(widget.moneyBasePath, href);
                      final params = <String, String>{};
                      final paid = result.intent?.amount;
                      if (paid != null && paid > 0) {
                        params['amount'] = '$paid';
                      }
                      final intentId = (result.intent?.id ?? '').trim();
                      if (intentId.isNotEmpty) {
                        params['intent_id'] = intentId;
                      }
                      final q = params.isEmpty
                          ? ''
                          : '?${Uri(queryParameters: params).query}';
                      navigateNotificationHref(
                        context,
                        href: '$base$q',
                        accessToken: widget.accessToken,
                      );
                    },
              child: Text(c.topUpAction),
            ),
          ],
        ),
      ),
    );
  }

  void _openMethodFormSheet(
    BuildContext context,
    WalletChrome c, {
    required String title,
    required bool isEdit,
  }) {
    _showFormSheet(
      context: context,
      title: title,
      builder: (ctx) => BlocBuilder<WalletCubit, WalletState>(
        builder: (ctx, live) {
          return StatefulBuilder(
            builder: (ctx, setSheet) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (widget.showOrganizerPayoutBlurb &&
                    c.organizerPayoutSectionBlurb.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      c.organizerPayoutSectionBlurb,
                      style: TextStyle(color: damaColorsOf(ctx).onSurfaceMuted),
                    ),
                  ),
                TextField(
                  controller: _providerCtrl,
                  decoration: InputDecoration(
                    labelText: c.payoutProviderLabel,
                    border: const OutlineInputBorder(),
                  ),
                  onChanged: ctx.read<WalletCubit>().setPayoutProvider,
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _accountCtrl,
                  decoration: InputDecoration(
                    labelText: c.payoutAccountLabel,
                    border: const OutlineInputBorder(),
                  ),
                  onChanged: ctx.read<WalletCubit>().setPayoutAccountName,
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _phoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    labelText:
                        '${c.payoutPhoneLabel} ${c.payoutRequiredMarker}',
                    hintText: c.payoutPhoneHint,
                    border: const OutlineInputBorder(),
                    errorText: _payoutMethodAttempted &&
                            _phoneCtrl.text.trim().length < 8
                        ? c.payoutPhoneRequired
                        : null,
                  ),
                  onChanged: (v) {
                    ctx.read<WalletCubit>().setPayoutPhone(v);
                    if (_payoutMethodAttempted) setSheet(() {});
                  },
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: live.loading
                      ? null
                      : () async {
                          setSheet(() => _payoutMethodAttempted = true);
                          if (_phoneCtrl.text.trim().length < 8) return;
                          final cubit = ctx.read<WalletCubit>();
                          final ok = isEdit
                              ? await cubit.updatePayoutMethod(
                                  _activeMethod?.id ?? '',
                                )
                              : await cubit.createPayoutMethod();
                          if (ok && ctx.mounted) Navigator.of(ctx).pop();
                        },
                  child: Text(c.payoutSaveAction),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _openMethodCreateSheet(BuildContext context, WalletChrome c) {
    _seedMethodFields(null);
    _openMethodFormSheet(context, c,
        title: c.payoutMethodAddAction, isEdit: false);
  }

  void _openMethodEditSheet(
    BuildContext context,
    WalletChrome c,
    PayoutMethod method,
  ) {
    _seedMethodFields(method);
    _openMethodFormSheet(context, c,
        title: c.payoutMethodEditAction, isEdit: true);
  }

  void _openMethodDeleteSheet(
    BuildContext context,
    WalletChrome c,
    PayoutMethod method,
  ) {
    _seedMethodFields(method);
    _showFormSheet(
      context: context,
      title: c.payoutMethodDeleteAction,
      builder: (ctx) => BlocBuilder<WalletCubit, WalletState>(
        builder: (ctx, live) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                c.payoutMethodDeleteConfirm,
                style: TextStyle(color: damaColorsOf(ctx).onSurfaceMuted),
              ),
              const SizedBox(height: 12),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: damaColorsOf(ctx).danger,
                ),
                onPressed: live.loading
                    ? null
                    : () async {
                        final ok = await ctx
                            .read<WalletCubit>()
                            .deletePayoutMethod(method.id);
                        if (ok && ctx.mounted) Navigator.of(ctx).pop();
                      },
                child: Text(c.payoutMethodDeleteAction),
              ),
            ],
          );
        },
      ),
    );
  }

  void _openAgeGateSheet(BuildContext context, WalletState state) {
    final cashChrome = state.cashRmgChrome;
    if (cashChrome == null || !cashChrome.isReady) {
      final msg =
          (cashChrome?.cashRmgUnavailable ?? state.cashDisabledError).trim();
      if (msg.isNotEmpty && context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
      return;
    }
    _showFormSheet(
      context: context,
      title: cashChrome.ageGateTitle,
      builder: (ctx) => BlocBuilder<WalletCubit, WalletState>(
        builder: (ctx, live) {
          return StatefulBuilder(
            builder: (ctx, setSheet) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  cashChrome.ageGateBlurb,
                  style: TextStyle(color: damaColorsOf(ctx).onSurfaceMuted),
                ),
                const SizedBox(height: 12),
                ChromeDateField(
                  label: cashChrome.ageGateDobLabel,
                  valueText: _dobCtrl.text,
                  hintText: cashChrome.ageGateDobPlaceholder.isNotEmpty
                      ? cashChrome.ageGateDobPlaceholder
                      : cashChrome.ageGateDobLabel,
                  enabled: !live.loading,
                  errorText: _ageAttempted && _dobCtrl.text.trim().isEmpty
                      ? (cashChrome.ageRequiredError.trim().isNotEmpty
                          ? cashChrome.ageRequiredError
                          : cashChrome.ageGateFailed)
                      : null,
                  firstDate: DateTime(DateTime.now().year - 120),
                  lastDate: DateTime.now(),
                  initialDate: parseFlexibleDate(_dobCtrl.text) ??
                      DateTime(
                        DateTime.now().year - 21,
                        DateTime.now().month,
                        DateTime.now().day,
                      ),
                  onPicked: (picked) {
                    setState(() {
                      _dobCtrl.text = formatUsDate(picked);
                      _ageAttempted = false;
                    });
                    setSheet(() {});
                  },
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: live.loading
                      ? null
                      : () async {
                          setSheet(() => _ageAttempted = true);
                          if (_dobCtrl.text.trim().isEmpty) return;
                          await ctx
                              .read<WalletCubit>()
                              .submitAgeGate(_dobCtrl.text);
                          if (ctx.mounted &&
                              !ctx.read<WalletCubit>().state.ageRequired) {
                            Navigator.of(ctx).pop();
                          }
                        },
                  child: Text(cashChrome.ageGateSubmitAction),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _openPayoutRequestSheet(
    BuildContext context,
    WalletState state,
    WalletChrome c,
  ) {
    _showFormSheet(
      context: context,
      title: c.payoutRequestSection,
      builder: (ctx) {
        return BlocBuilder<WalletCubit, WalletState>(
          builder: (ctx, live) {
            final tokens = damaColorsOf(ctx);
            final currency = (live.currencyLabel ?? '').trim();
            final payoutBlockedByKyc =
                live.cashRmgPolicy?.requireDocumentKycForPayout == true &&
                    !live.docKycApproved;
            return StatefulBuilder(
              builder: (ctx, setSheet) => Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (!live.payoutPhoneReady)
                    Text(
                      c.payoutMethodsEmpty,
                      style: TextStyle(color: tokens.onSurfaceMuted),
                    )
                  else ...[
                    Text(
                      live.firstPayoutMethod!.phone,
                      style:
                          TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
                    ),
                    if (live.firstPayoutMethod!.provider.trim().isNotEmpty)
                      Text(
                        '${c.parenOpen}${live.firstPayoutMethod!.provider}${c.parenClose}',
                        style: TextStyle(
                            color: tokens.onSurfaceMuted, fontSize: 12),
                      ),
                  ],
                  if (payoutBlockedByKyc)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        c.documentKycRequired,
                        style: TextStyle(color: tokens.onSurfaceMuted),
                      ),
                    ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _payoutAmountCtrl,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: _decimalFormatters,
                    decoration: InputDecoration(
                      labelText: currency.isEmpty
                          ? c.payoutAmountLabel
                          : '${c.payoutAmountLabel}${c.parenOpen}$currency${c.parenClose}',
                      hintText: c.payoutAmountPlaceholder,
                      border: const OutlineInputBorder(),
                      errorText: _payoutAttempted &&
                              (currency.isEmpty ||
                                  parsePositiveDecimal(
                                          _payoutAmountCtrl.text) ==
                                      null)
                          ? c.payoutAmountCurrencyRequired
                          : null,
                    ),
                    enabled: live.payoutPhoneReady && !payoutBlockedByKyc,
                    onChanged: (v) {
                      final s = sanitizeDecimalInput(v);
                      if (s != v) {
                        _payoutAmountCtrl.value = TextEditingValue(
                          text: s,
                          selection: TextSelection.collapsed(offset: s.length),
                        );
                      }
                      ctx.read<WalletCubit>().setPayoutAmountText(s);
                      if (_payoutAttempted) setSheet(() {});
                    },
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: live.cashActionBlocked ||
                            live.loading ||
                            !live.payoutPhoneReady ||
                            live.payoutMethodsLoading ||
                            payoutBlockedByKyc
                        ? null
                        : () async {
                            setSheet(() => _payoutAttempted = true);
                            if (currency.isEmpty ||
                                parsePositiveDecimal(_payoutAmountCtrl.text) ==
                                    null) {
                              return;
                            }
                            await ctx.read<WalletCubit>().requestPayout();
                            if (ctx.mounted) Navigator.of(ctx).pop();
                          },
                    child: Text(c.payoutRequestAction),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _openKycSheet(BuildContext context, String title) {
    _showFormSheet(
      context: context,
      title: title,
      builder: (ctx) => DocumentKycPanel(
        accessToken: widget.accessToken,
        onApprovedChange: (approved) {
          ctx.read<WalletCubit>().setDocKycApproved(approved);
        },
      ),
    );
  }

  void _openPhoneKycSheet(BuildContext context, WalletState state) {
    final cashChrome = state.cashRmgChrome;
    if (cashChrome == null || !cashChrome.isReady) {
      final msg = (cashChrome?.cashRmgUnavailable ?? '').trim();
      if (msg.isNotEmpty && context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
      return;
    }
    _showFormSheet(
      context: context,
      title: cashChrome.phoneKycTitle,
      builder: (ctx) => CashCompliancePanel(accessToken: widget.accessToken),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<WalletCubit, WalletState>(
      listenWhen: (p, n) =>
          p.checkoutMessage != n.checkoutMessage ||
          p.error != n.error ||
          p.country != n.country ||
          p.chrome != n.chrome ||
          p.chromeLoading != n.chromeLoading ||
          p.cashGateLoaded != n.cashGateLoaded ||
          p.locating != n.locating ||
          p.loading != n.loading ||
          p.amountText != n.amountText ||
          p.payoutProvider != n.payoutProvider ||
          p.payoutAccountName != n.payoutAccountName ||
          p.payoutPhone != n.payoutPhone ||
          p.payoutAmountText != n.payoutAmountText ||
          p.myPayouts != n.myPayouts ||
          p.payoutHistoryLoading != n.payoutHistoryLoading,
      listener: (context, state) {
        _syncControllers(state);
        final msg = chromeOnlyUserMessage(
          state.checkoutMessage ?? state.error,
        );
        // One snackbar only - never raw API JSON envelopes.
        if (msg != null) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(msg)));
        }
        final focusId = widget.focusPayoutHistoryId.trim();
        if (focusId.isNotEmpty &&
            !state.payoutHistoryLoading &&
            state.myPayouts.any((p) => p.id == focusId)) {
          WidgetsBinding.instance.addPostFrameCallback(
            (_) => _scrollToHistoryRow(focusId),
          );
        }
        if (widget.focusPayout &&
            !_openedFocusPayoutSheet &&
            state.chromeReady &&
            !state.initialHydrating &&
            state.country.trim().isNotEmpty) {
          _openedFocusPayoutSheet = true;
          final c = state.chrome!;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted) return;
            _openPayoutRequestSheet(context, state, c);
          });
        }
        if (widget.focusTopUp &&
            !_openedFocusTopUpSheet &&
            state.chromeReady &&
            !state.initialHydrating &&
            state.country.trim().isNotEmpty) {
          _openedFocusTopUpSheet = true;
          final c = state.chrome!;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted) return;
            _openTopUpSheet(context, state, c);
          });
        }
      },
      builder: (context, state) {
        _syncControllers(state);
        final tokens = damaColorsOf(context);
        final chrome = state.chrome;
        final chromeReady = state.chromeReady;
        final showHydrating =
            state.chromeLoading || (state.initialHydrating && !chromeReady);

        if (showHydrating) {
          return Scaffold(
            appBar: AppBar(
              title: chromeReady ? Text(chrome!.pageTitle) : null,
              actions: const [NotificationAppBarActions()],
            ),
            body: const Padding(
              padding: EdgeInsets.all(16),
              child: WalletSkeleton(),
            ),
          );
        }

        if (!chromeReady) {
          final unavailable = (state.error ?? '').trim();
          return Scaffold(
            appBar: AppBar(actions: const [NotificationAppBarActions()]),
            body: unavailable.isEmpty
                ? const SizedBox.shrink()
                : Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(
                      unavailable,
                      style: TextStyle(color: tokens.onSurfaceMuted),
                    ),
                  ),
          );
        }

        final c = chrome!;
        final sep = c.amountCurrencySeparator;
        final currency = (state.currencyLabel ?? '').trim();
        final panelBusy = state.initialHydrating;
        final kycTitle = (state.cashRmgChrome?.docKycTitle ?? '').trim();

        return Scaffold(
          appBar: AppBar(
            title: DamaBrandTitle(title: c.pageTitle),
            actions: const [NotificationAppBarActions()],
          ),
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if ((c.linkTransactionsLabel.isNotEmpty &&
                      c.linkTransactionsHref.isNotEmpty) ||
                  (c.linkReceiptsLabel.isNotEmpty &&
                      c.linkReceiptsHref.isNotEmpty) ||
                  (state.isManualTransfer &&
                      c.linkManualTransferLabel.isNotEmpty &&
                      c.linkManualTransferHref.isNotEmpty))
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (c.linkTransactionsLabel.isNotEmpty &&
                        c.linkTransactionsHref.isNotEmpty)
                      OutlinedButton(
                        onPressed: () {
                          navigateNotificationHref(
                            context,
                            href: moneyHref(
                              widget.moneyBasePath,
                              c.linkTransactionsHref,
                            ),
                            accessToken: widget.accessToken,
                          );
                        },
                        child: Text(c.linkTransactionsLabel),
                      ),
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
                    if (state.isManualTransfer &&
                        c.linkManualTransferLabel.isNotEmpty &&
                        c.linkManualTransferHref.isNotEmpty)
                      OutlinedButton(
                        onPressed: () {
                          navigateNotificationHref(
                            context,
                            href: moneyHref(
                              widget.moneyBasePath,
                              c.linkManualTransferHref,
                            ),
                            accessToken: widget.accessToken,
                          );
                        },
                        child: Text(c.linkManualTransferLabel),
                      ),
                  ],
                ),
              if (panelBusy) ...[
                const SizedBox(height: 8),
                const WalletSkeleton(),
              ],
              if (!panelBusy) ...[
                _walletCard(
                  context,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        c.balanceLabel,
                        style: TextStyle(color: tokens.onSurfaceMuted),
                      ),
                      if (state.balance != null && currency.isNotEmpty)
                        Text(
                          '${state.balance}$sep$currency',
                          style: TextStyle(
                            color: tokens.gold,
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        )
                      else
                        // Action errors (checkout/payout) use snackbar only - never dual UI.
                        Text(
                          c.balancePending,
                          style: TextStyle(color: tokens.onSurfaceMuted),
                        ),
                      if (state.routeProvider != null &&
                          state.routeCurrency != null &&
                          state.country.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(
                          '${c.paymentRoutePrefix}${c.paymentRouteSeparator}'
                          '${state.routeProvider}${c.paymentRouteSeparator}'
                          '${state.routeCurrency}${c.paymentRouteSeparator}'
                          '${state.country}',
                          style: TextStyle(
                            color: tokens.onSurfaceMuted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                      if (state.cashLocked &&
                          state.cashLockMessage.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(
                          state.cashLockMessage,
                          style: TextStyle(color: tokens.danger),
                        ),
                      ],
                    ],
                  ),
                ),
                if (state.ageRequired &&
                    (state.cashRmgChrome?.ageRequiredError ?? '')
                        .trim()
                        .isNotEmpty) ...[
                  _walletCard(
                    context,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          state.cashRmgChrome!.ageRequiredError.trim(),
                          style: TextStyle(color: tokens.danger),
                        ),
                        if (c.ageGateOpenAction.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          OutlinedButton(
                            onPressed: () => _openAgeGateSheet(context, state),
                            child: Text(c.ageGateOpenAction),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
                if (state.phoneRequired &&
                    (state.cashRmgChrome?.phoneKycRequiredError ?? '')
                        .trim()
                        .isNotEmpty) ...[
                  _walletCard(
                    context,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          state.cashRmgChrome!.phoneKycRequiredError.trim(),
                          style: TextStyle(color: tokens.danger),
                        ),
                        const SizedBox(height: 8),
                        OutlinedButton(
                          onPressed: () => _openPhoneKycSheet(context, state),
                          child: Text(state.cashRmgChrome!.phoneKycTitle),
                        ),
                      ],
                    ),
                  ),
                ],
                if ((state.country).trim().isEmpty) ...[
                  _walletCard(
                    context,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          c.locationCurrencyUnresolved.isNotEmpty
                              ? c.locationCurrencyUnresolved
                              : (c.locationUnavailable.isNotEmpty
                                  ? c.locationUnavailable
                                  : c.locationGeoFailed),
                          style: TextStyle(color: tokens.danger),
                        ),
                        const SizedBox(height: 8),
                        OutlinedButton(
                          onPressed: state.locating
                              ? null
                              : () => context.read<WalletCubit>().autoLocate(),
                          child: Text(c.detectLocationAction),
                        ),
                      ],
                    ),
                  ),
                ],
                if (state.country.trim().isNotEmpty) ...[
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      if (c.topUpAction.isNotEmpty)
                        FilledButton(
                          onPressed: state.cashLocked
                              ? null
                              : () {
                                  if (state.ageRequired) {
                                    _openAgeGateSheet(context, state);
                                    return;
                                  }
                                  if (state.phoneRequired) {
                                    _openPhoneKycSheet(context, state);
                                    return;
                                  }
                                  _openTopUpSheet(context, state, c);
                                },
                          child: Text(c.topUpAction),
                        ),
                      if (c.payoutRequestAction.isNotEmpty)
                        OutlinedButton(
                          onPressed: state.cashLocked
                              ? null
                              : () {
                                  if (state.ageRequired) {
                                    _openAgeGateSheet(context, state);
                                    return;
                                  }
                                  if (state.phoneRequired) {
                                    _openPhoneKycSheet(context, state);
                                    return;
                                  }
                                  _openPayoutRequestSheet(context, state, c);
                                },
                          child: Text(c.payoutRequestAction),
                        ),
                      if (state.isManualTransfer &&
                          c.submitReceiptAction.isNotEmpty &&
                          c.linkManualTransferHref.isNotEmpty)
                        OutlinedButton(
                          onPressed: state.cashLocked
                              ? null
                              : () {
                                  if (state.ageRequired) {
                                    _openAgeGateSheet(context, state);
                                    return;
                                  }
                                  if (state.phoneRequired) {
                                    _openPhoneKycSheet(context, state);
                                    return;
                                  }
                                  navigateNotificationHref(
                                    context,
                                    href: moneyHref(
                                      widget.moneyBasePath,
                                      c.linkManualTransferHref,
                                    ),
                                    accessToken: widget.accessToken,
                                  );
                                },
                          child: Text(c.submitReceiptAction),
                        ),
                      if (kycTitle.isNotEmpty)
                        OutlinedButton(
                          onPressed: () => _openKycSheet(context, kycTitle),
                          child: Text(kycTitle),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (c.payoutMethodsReady)
                    _PayoutMethodsSection(
                      chrome: c,
                      state: state,
                      onAdd: () => _openMethodCreateSheet(context, c),
                      onEdit: (m) => _openMethodEditSheet(context, c, m),
                      onDelete: (m) => _openMethodDeleteSheet(context, c, m),
                      onPrev: (skip) => context
                          .read<WalletCubit>()
                          .setPayoutMethodsSkip(skip),
                      onNext: (skip) => context
                          .read<WalletCubit>()
                          .setPayoutMethodsSkip(skip),
                    ),
                  if (c.payoutHistoryReady) ...[
                    const SizedBox(height: 12),
                    _PayoutHistorySection(
                      chrome: c,
                      state: state,
                      focusPayoutHistoryId: widget.focusPayoutHistoryId,
                      rowKeyFor: _historyRowKey,
                      onPrev: (skip) => context
                          .read<WalletCubit>()
                          .setPayoutHistorySkip(skip),
                      onNext: (skip) => context
                          .read<WalletCubit>()
                          .setPayoutHistorySkip(skip),
                    ),
                  ],
                ],
              ],
              if (!panelBusy && !state.locating && state.country.trim().isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    c.locationCurrencyUnresolved,
                    style: TextStyle(color: tokens.danger),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _SkipPager extends StatelessWidget {
  const _SkipPager({
    required this.meta,
    required this.loading,
    required this.onPrev,
    required this.onNext,
  });

  final PayoutListMeta? meta;
  final bool loading;
  final void Function(int skip) onPrev;
  final void Function(int skip) onNext;

  @override
  Widget build(BuildContext context) {
    final m = meta;
    if (m == null || m.totalPages <= 1) return const SizedBox.shrink();
    return SkipPrevNextBar(
      pageSummary: m.pageSummary,
      prevActionLabel: m.prevActionLabel,
      nextActionLabel: m.nextActionLabel,
      prevSkip: m.prevSkip,
      nextSkip: m.nextSkip,
      busy: loading,
      onSkip: (skip) {
        // Call sites wire onPrev/onNext to the same setSkip.
        if (m.prevSkip != null && skip == m.prevSkip) {
          onPrev(skip);
        } else {
          onNext(skip);
        }
      },
    );
  }
}

class _PayoutMethodsSection extends StatelessWidget {
  const _PayoutMethodsSection({
    required this.chrome,
    required this.state,
    required this.onAdd,
    required this.onEdit,
    required this.onDelete,
    required this.onPrev,
    required this.onNext,
  });

  final WalletChrome chrome;
  final WalletState state;
  final VoidCallback onAdd;
  final void Function(PayoutMethod method) onEdit;
  final void Function(PayoutMethod method) onDelete;
  final void Function(int skip) onPrev;
  final void Function(int skip) onNext;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    return _WalletListSectionShell(
      title: chrome.payoutMethodSection,
      trailing: chrome.payoutMethodAddAction.isNotEmpty
          ? OutlinedButton(
              onPressed: onAdd, child: Text(chrome.payoutMethodAddAction))
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Reserved 2px - never insert/remove progress (pager layout jump).
          SizedBox(
            height: 2,
            child: state.payoutMethodsLoading
                ? const LinearProgressIndicator(minHeight: 2)
                : const SizedBox.expand(),
          ),
          if (state.payoutMethodsError.isNotEmpty)
            Text(
              state.payoutMethodsError,
              style: TextStyle(color: tokens.danger),
            ),
          if (!state.payoutMethodsLoading &&
              state.payoutMethodsError.isEmpty &&
              state.payoutMethods.isEmpty)
            Text(
              chrome.payoutMethodsEmpty,
              style: TextStyle(color: tokens.onSurfaceMuted),
            ),
          if (state.payoutMethods.isNotEmpty) ...[
            _WalletTableHeader(
              columns: [
                chrome.payoutProviderLabel,
                chrome.payoutAccountLabel,
                chrome.payoutPhoneLabel,
                chrome.payoutMethodsActionsLabel,
              ],
            ),
            for (final m in state.payoutMethods)
              _WalletTableRow(
                borderColor: tokens.border,
                cells: [
                  m.provider.isNotEmpty ? m.provider : chrome.emptyValue,
                  m.accountName.isNotEmpty ? m.accountName : chrome.emptyValue,
                  m.phone.isNotEmpty ? m.phone : chrome.emptyValue,
                ],
                trailing: PopupMenuButton<String>(
                  tooltip: chrome.payoutMethodsActionsLabel,
                  onSelected: (key) {
                    if (key == 'edit') onEdit(m);
                    if (key == 'delete') onDelete(m);
                  },
                  itemBuilder: (ctx) => [
                    if (chrome.payoutMethodEditAction.isNotEmpty)
                      PopupMenuItem(
                        value: 'edit',
                        child: Text(chrome.payoutMethodEditAction),
                      ),
                    if (chrome.payoutMethodDeleteAction.isNotEmpty)
                      PopupMenuItem(
                        value: 'delete',
                        child: Text(chrome.payoutMethodDeleteAction),
                      ),
                  ],
                ),
              ),
          ],
          _SkipPager(
            meta: state.payoutMethodsMeta,
            loading: state.payoutMethodsLoading,
            onPrev: onPrev,
            onNext: onNext,
          ),
        ],
      ),
    );
  }
}

class _WalletListSectionShell extends StatelessWidget {
  const _WalletListSectionShell({
    required this.title,
    required this.child,
    this.trailing,
  });

  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    return Container(
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                if (trailing != null) trailing!,
              ],
            ),
          ),
          Divider(height: 1, color: tokens.border),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            child: child,
          ),
        ],
      ),
    );
  }
}

class _WalletTableHeader extends StatelessWidget {
  const _WalletTableHeader({required this.columns});

  final List<String> columns;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          for (var i = 0; i < columns.length; i++)
            Expanded(
              flex: i == columns.length - 1 ? 0 : 1,
              child: Text(
                columns[i],
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: tokens.onSurfaceMuted,
                ),
              ),
            ),
          const SizedBox(width: 40),
        ],
      ),
    );
  }
}

class _WalletTableRow extends StatelessWidget {
  const _WalletTableRow({
    required this.cells,
    required this.borderColor,
    this.cellColors,
    this.trailing,
    this.highlight = false,
    this.rowKey,
  });

  final List<String> cells;
  final Color borderColor;
  final List<Color?>? cellColors;
  final Widget? trailing;
  final bool highlight;
  final Key? rowKey;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    return Container(
      key: rowKey,
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: highlight ? tokens.gold : borderColor.withValues(alpha: 0.6),
            width: highlight ? 2 : 1,
          ),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < cells.length; i++)
            Expanded(
              child: Text(
                cells[i],
                style: TextStyle(
                  fontSize: 12,
                  color: (cellColors != null &&
                          i < cellColors!.length &&
                          cellColors![i] != null)
                      ? cellColors![i]
                      : tokens.onSurface,
                ),
              ),
            ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

class _PayoutHistorySection extends StatelessWidget {
  const _PayoutHistorySection({
    required this.chrome,
    required this.state,
    required this.focusPayoutHistoryId,
    required this.rowKeyFor,
    required this.onPrev,
    required this.onNext,
  });

  final WalletChrome chrome;
  final WalletState state;
  final String focusPayoutHistoryId;
  final GlobalKey Function(String id) rowKeyFor;
  final void Function(int skip) onPrev;
  final void Function(int skip) onNext;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final sep = chrome.amountCurrencySeparator;
    final focusId = focusPayoutHistoryId.trim();
    String amountCell(MyPayoutRequest p) {
      if (p.amount != null && p.currency.isNotEmpty) {
        return '${p.amount}$sep${p.currency}';
      }
      return chrome.emptyValue;
    }

    return _WalletListSectionShell(
      title: chrome.payoutHistoryTitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Reserved 2px - never insert/remove progress (pager layout jump).
          SizedBox(
            height: 2,
            child: state.payoutHistoryLoading
                ? const LinearProgressIndicator(minHeight: 2)
                : const SizedBox.expand(),
          ),
          if (state.payoutHistoryError.isNotEmpty)
            Text(
              state.payoutHistoryError,
              style: TextStyle(color: tokens.danger),
            ),
          if (!state.payoutHistoryLoading &&
              state.payoutHistoryError.isEmpty &&
              state.myPayouts.isEmpty)
            Text(
              chrome.payoutHistoryEmpty,
              style: TextStyle(color: tokens.onSurfaceMuted),
            ),
          if (state.myPayouts.isNotEmpty) ...[
            _WalletTableHeader(
              columns: [
                chrome.payoutHistoryAmountLabel,
                chrome.payoutHistoryStatusLabel,
                chrome.payoutHistoryDateLabel,
                chrome.payoutProviderLabel,
                chrome.payoutPhoneLabel,
                chrome.payoutHistoryNoteLabel,
              ],
            ),
            for (final p in state.myPayouts)
              _WalletTableRow(
                rowKey: rowKeyFor(p.id),
                highlight: focusId.isNotEmpty && focusId == p.id,
                borderColor: tokens.border,
                cellColors: [
                  null,
                  paidStatusForeground(p.status),
                  null,
                  null,
                  null,
                  null,
                ],
                cells: [
                  amountCell(p),
                  _statusLabel(p),
                  p.createdAt.isNotEmpty ? p.createdAt : chrome.emptyValue,
                  p.provider.isNotEmpty ? p.provider : chrome.emptyValue,
                  p.phone.isNotEmpty ? p.phone : chrome.emptyValue,
                  p.reviewNote.trim().isNotEmpty
                      ? p.reviewNote.trim()
                      : chrome.emptyValue,
                ],
              ),
          ],
          _SkipPager(
            meta: state.payoutHistoryMeta,
            loading: state.payoutHistoryLoading,
            onPrev: onPrev,
            onNext: onNext,
          ),
        ],
      ),
    );
  }

  String _statusLabel(MyPayoutRequest p) {
    final stamped = p.statusLabel.trim();
    if (stamped.isNotEmpty) return stamped;
    final labeled = chrome.statusLabel(p.status);
    return labeled.isNotEmpty ? labeled : chrome.emptyValue;
  }
}
