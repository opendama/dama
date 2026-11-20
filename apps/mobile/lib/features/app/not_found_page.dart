import 'dart:async';

import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/app_shell_chrome.dart';
import 'package:dama_mobile/features/app/app_shell_chrome_store.dart';
import 'package:dama_mobile/widgets/dama_brand_mark.dart';
import 'package:flutter/material.dart';

/// Branded in-app 404 (DB app_shell_chrome).
class NotFoundPage extends StatefulWidget {
  const NotFoundPage({super.key, this.onHome});

  final VoidCallback? onHome;

  @override
  State<NotFoundPage> createState() => _NotFoundPageState();
}

class _NotFoundPageState extends State<NotFoundPage> {
  AppShellChrome? _chrome;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    final chrome = await fetchAppShellChrome();
    if (!mounted) return;
    setState(() {
      _chrome = chrome;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final chrome = _chrome;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: _loading
              ? const DamaBrandMark(size: 56)
              : chrome == null || !chrome.isReady
                  ? Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const DamaBrandMark(size: 56),
                        const SizedBox(height: 16),
                        Text(
                          (chrome?.appShellUnavailable ?? '').trim(),
                          textAlign: TextAlign.center,
                          style: TextStyle(color: tokens.danger),
                        ),
                      ],
                    )
                  : Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        DamaBrandMark(
                          size: 64,
                          semanticLabel: chrome.brandMarkAlt,
                        ),
                        if (chrome.brandMarkAlt.trim().isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Text(
                            chrome.brandMarkAlt.trim(),
                            textAlign: TextAlign.center,
                            style: Theme.of(context)
                                .textTheme
                                .headlineSmall
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                        ],
                        const SizedBox(height: 20),
                        Text(
                          chrome.notFoundCode,
                          style: TextStyle(
                            color: tokens.brand,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 3,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          chrome.notFoundTitle,
                          textAlign: TextAlign.center,
                          style: Theme.of(context)
                              .textTheme
                              .headlineSmall
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          chrome.notFoundBlurb,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              color: tokens.onSurfaceMuted, height: 1.45),
                        ),
                        const SizedBox(height: 28),
                        FilledButton(
                          onPressed: () {
                            if (widget.onHome != null) {
                              widget.onHome!();
                              return;
                            }
                            Navigator.of(context).popUntil((r) => r.isFirst);
                          },
                          child: Text(chrome.notFoundHomeAction),
                        ),
                      ],
                    ),
        ),
      ),
    );
  }
}
