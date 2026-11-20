import 'dart:async';

import 'package:dama_mobile/core/prefs/onboarding_prefs.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/theme/theme_toggle_button.dart';
import 'package:dama_mobile/core/types/app_shell_chrome.dart';
import 'package:dama_mobile/features/app/app_shell_chrome_store.dart';
import 'package:dama_mobile/widgets/dama_brand_mark.dart';
import 'package:flutter/material.dart';

/// First-run onboarding (DB app_shell_chrome slides). Skip/complete persist prefs.
class OnboardingGate extends StatefulWidget {
  const OnboardingGate({super.key, required this.child});

  final Widget child;

  @override
  State<OnboardingGate> createState() => _OnboardingGateState();
}

class _OnboardingGateState extends State<OnboardingGate> {
  bool _loading = true;
  bool _completed = false;
  AppShellChrome? _chrome;
  int _index = 0;
  final _pageCtrl = PageController();

  @override
  void initState() {
    super.initState();
    unawaited(_boot());
  }

  Future<void> _boot() async {
    final done = await isOnboardingCompleted();
    if (done) {
      if (!mounted) return;
      setState(() {
        _completed = true;
        _loading = false;
      });
      return;
    }
    final chrome = await fetchAppShellChrome();
    if (!mounted) return;
    setState(() {
      _chrome = chrome;
      _loading = false;
    });
  }

  Future<void> _finish() async {
    await markOnboardingCompleted();
    if (!mounted) return;
    setState(() => _completed = true);
  }

  @override
  void dispose() {
    _pageCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        body: const Center(child: DamaBrandMark(size: 48)),
      );
    }
    if (_completed) return widget.child;

    final chrome = _chrome;
    final tokens = damaColorsOf(context);
    if (chrome == null || !chrome.isReady) {
      return Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const DamaBrandMark(size: 48),
                const SizedBox(height: 16),
                Text(
                  (chrome?.onboardingUnavailable ??
                          chrome?.appShellUnavailable ??
                          '')
                      .trim(),
                  textAlign: TextAlign.center,
                  style: TextStyle(color: tokens.danger),
                ),
                const SizedBox(height: 16),
                // Fail closed: no invent skip; allow retry by completing only when chrome ready.
                FilledButton(
                  onPressed: () => unawaited(_boot()),
                  child: const Icon(Icons.refresh),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final slides = chrome.slides;
    final last = _index >= slides.length - 1;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          const ThemeToggleButton(),
          TextButton(
            onPressed: () => unawaited(_finish()),
            child: Text(chrome.skipAction),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 12),
            const DamaBrandMark(size: 64),
            if (chrome.brandMarkAlt.trim().isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                chrome.brandMarkAlt.trim(),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ],
            const SizedBox(height: 24),
            Expanded(
              child: PageView.builder(
                controller: _pageCtrl,
                itemCount: slides.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (context, i) {
                  final slide = slides[i];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 28),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          slide.title,
                          textAlign: TextAlign.center,
                          style: Theme.of(context)
                              .textTheme
                              .headlineSmall
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          slide.blurb,
                          textAlign: TextAlign.center,
                          style:
                              Theme.of(context).textTheme.bodyLarge?.copyWith(
                                    color: tokens.onSurfaceMuted,
                                    height: 1.45,
                                  ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(slides.length, (i) {
                final active = i == _index;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  width: active ? 22 : 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: active ? tokens.brand : tokens.borderSubtle,
                    borderRadius: BorderRadius.circular(99),
                  ),
                );
              }),
            ),
            const SizedBox(height: 28),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {
                    if (last) {
                      unawaited(_finish());
                      return;
                    }
                    _pageCtrl.nextPage(
                      duration: const Duration(milliseconds: 320),
                      curve: Curves.easeOutCubic,
                    );
                  },
                  child: Text(last ? chrome.doneAction : chrome.nextAction),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
