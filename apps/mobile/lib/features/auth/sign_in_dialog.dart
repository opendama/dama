import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/auth/auth_providers.dart';
import 'package:dama_mobile/widgets/dama_brand_mark.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;

/// Simple centered social sign-in dialog (parity with web shadcn SignInModal).
Future<String?> showSignInDialog(BuildContext context) {
  return showDialog<String>(
    context: context,
    barrierDismissible: true,
    builder: (ctx) => const SignInDialog(),
  );
}

class SignInDialog extends StatefulWidget {
  const SignInDialog({super.key});

  @override
  State<SignInDialog> createState() => _SignInDialogState();
}

class _SignInDialogState extends State<SignInDialog> {
  AuthProvidersChrome? _chrome;
  String _brandName = '';
  bool _loadingChrome = true;

  @override
  void initState() {
    super.initState();
    _loadChrome();
  }

  Future<void> _loadChrome() async {
    final chrome = await fetchAuthProvidersChrome();
    var brand = '';
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/platform/client-nav'),
      );
      if (res.statusCode < 300) {
        final payload = ClientNavPayload.fromJson(
          jsonDecode(res.body) as Map<String, dynamic>,
        );
        brand = payload.brandName.trim();
      }
    } catch (_) {
      // Fail closed: mark-only when brand chrome unavailable.
    }
    if (!mounted) return;
    setState(() {
      _chrome = chrome;
      _brandName = brand;
      _loadingChrome = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final chrome = _chrome;
    final items = chrome?.items ?? const <AuthProviderItem>[];
    final title =
        (chrome?.loginTitle.isNotEmpty == true) ? chrome!.loginTitle : '';
    final subtitle = chrome?.loginSubtitle ?? '';
    final tokens = damaColorsOf(context);

    return BlocListener<AuthCubit, AuthState>(
      listener: (context, state) {
        if (state.isAuthenticated) {
          Navigator.of(context).pop(state.token);
        }
      },
      child: Dialog(
        backgroundColor: tokens.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: tokens.borderSubtle),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
            child: _loadingChrome
                ? const AuthLoginSkeleton()
                : BlocBuilder<AuthCubit, AuthState>(
                    builder: (context, state) {
                      final loading = state.loading;
                      return Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Center(child: DamaBrandMark(size: 40)),
                          if (_brandName.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Text(
                              _brandName,
                              textAlign: TextAlign.center,
                              style: Theme.of(context)
                                  .textTheme
                                  .titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                          ],
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: title.isNotEmpty
                                    ? Text(
                                        title,
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleLarge
                                            ?.copyWith(
                                                fontWeight: FontWeight.w700),
                                      )
                                    : const SizedBox.shrink(),
                              ),
                              IconButton(
                                tooltip: MaterialLocalizations.of(context)
                                    .closeButtonTooltip,
                                onPressed: () => Navigator.of(context).pop(),
                                icon: const Icon(Icons.close, size: 20),
                              ),
                            ],
                          ),
                          if (subtitle.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(
                              subtitle,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyMedium
                                  ?.copyWith(
                                    color: tokens.onSurfaceMuted,
                                  ),
                            ),
                          ],
                          if (chrome != null && chrome.items.isEmpty) ...[
                            const SizedBox(height: 12),
                            Text(
                              chrome.providersEmptyMessage,
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ],
                          if (state.error != null) ...[
                            const SizedBox(height: 12),
                            Text(
                              state.error!,
                              style: TextStyle(color: tokens.danger),
                            ),
                          ],
                          const SizedBox(height: 20),
                          for (final item in items) ...[
                            FilledButton.icon(
                              onPressed: loading || !chrome!.oauthReady(item.id)
                                  ? null
                                  : () => context
                                      .read<AuthCubit>()
                                      .signInWithProvider(item.id),
                              icon: loading
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2),
                                    )
                                  : const Icon(Icons.login),
                              label: Text(
                                loading ? item.pendingLabel : item.actionLabel,
                              ),
                            ),
                            const SizedBox(height: 8),
                          ],
                        ],
                      );
                    },
                  ),
          ),
        ),
      ),
    );
  }
}
