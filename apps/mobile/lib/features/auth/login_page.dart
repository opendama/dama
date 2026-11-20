import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/theme/theme_toggle_button.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/auth/auth_providers.dart';
import 'package:dama_mobile/widgets/dama_brand_mark.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, this.asRoot = false});

  /// When true (AuthGate), success is handled by rebuilding the tree - do not pop.
  final bool asRoot;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
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
      // Fail closed: mark-only login when brand chrome unavailable.
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

    return Scaffold(
      appBar: AppBar(
        title: const SizedBox.shrink(),
        automaticallyImplyLeading: !widget.asRoot,
        actions: const [ThemeToggleButton()],
      ),
      body: BlocConsumer<AuthCubit, AuthState>(
        listener: (context, state) {
          if (state.isAuthenticated && !widget.asRoot) {
            Navigator.of(context).pop(state.token);
          }
        },
        builder: (context, state) {
          final loading = state.loading || _loadingChrome;
          return SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: _loadingChrome
                      ? const AuthLoginSkeleton()
                      : Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const Center(child: DamaBrandMark(size: 56)),
                            if (_brandName.isNotEmpty) ...[
                              const SizedBox(height: 12),
                              Text(
                                _brandName,
                                textAlign: TextAlign.center,
                                style: Theme.of(context)
                                    .textTheme
                                    .headlineSmall
                                    ?.copyWith(fontWeight: FontWeight.w700),
                              ),
                            ],
                            const SizedBox(height: 20),
                            if (title.isNotEmpty)
                              Text(
                                title,
                                textAlign: TextAlign.center,
                                style: Theme.of(context)
                                    .textTheme
                                    .headlineSmall
                                    ?.copyWith(
                                      fontWeight: FontWeight.w700,
                                    ),
                              ),
                            if (subtitle.isNotEmpty) ...[
                              const SizedBox(height: 12),
                              Text(
                                subtitle,
                                textAlign: TextAlign.center,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodyMedium
                                    ?.copyWith(
                                      color:
                                          damaColorsOf(context).onSurfaceMuted,
                                    ),
                              ),
                            ],
                            if (chrome != null && chrome.items.isEmpty) ...[
                              const SizedBox(height: 12),
                              Text(
                                chrome.providersEmptyMessage,
                                textAlign: TextAlign.center,
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                            ],
                            if (state.error != null) ...[
                              const SizedBox(height: 16),
                              Text(
                                state.error!,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                    color: damaColorsOf(context).danger),
                              ),
                            ],
                            const SizedBox(height: 28),
                            for (final item in items) ...[
                              FilledButton.icon(
                                onPressed:
                                    loading || !chrome!.oauthReady(item.id)
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
                                  loading
                                      ? item.pendingLabel
                                      : item.actionLabel,
                                ),
                              ),
                              const SizedBox(height: 8),
                            ],
                          ],
                        ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
