import 'dart:async';

import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/app_shell_chrome.dart';
import 'package:dama_mobile/features/app/app_shell_chrome_store.dart';
import 'package:dama_mobile/widgets/dama_brand_mark.dart';
import 'package:flutter/material.dart';

/// Native splash handoff: branded animated mark, then [child].
class SplashGate extends StatefulWidget {
  const SplashGate({super.key, required this.child});

  final Widget child;

  @override
  State<SplashGate> createState() => _SplashGateState();
}

class _SplashGateState extends State<SplashGate>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _fade;
  late final Animation<double> _scale;
  AppShellChrome? _chrome;
  bool _done = false;
  String _unavailable = '';

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic);
    _scale = Tween<double>(begin: 0.86, end: 1).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeOutBack),
    );
    unawaited(_run());
  }

  Future<void> _run() async {
    final chrome = await fetchAppShellChrome();
    if (!mounted) return;
    if (chrome == null || !chrome.isReady) {
      setState(() {
        _unavailable = chrome?.appShellUnavailable.trim().isNotEmpty == true
            ? chrome!.appShellUnavailable
            : (chrome?.splashUnavailable.trim().isNotEmpty == true
                ? chrome!.splashUnavailable
                : '');
        _done = true;
      });
      return;
    }
    setState(() => _chrome = chrome);
    await _ctrl.forward();
    final hold = Duration(milliseconds: chrome.splashHoldMs);
    await Future<void>.delayed(hold);
    if (!mounted) return;
    setState(() => _done = true);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_done) {
      if (_chrome == null && _unavailable.isNotEmpty) {
        final tokens = damaColorsOf(context);
        return Scaffold(
          backgroundColor: Theme.of(context).scaffoldBackgroundColor,
          body: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const DamaBrandMark(size: 56),
                  const SizedBox(height: 16),
                  Text(
                    _unavailable,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: tokens.danger),
                  ),
                ],
              ),
            ),
          ),
        );
      }
      return widget.child;
    }

    final chrome = _chrome;
    final bg = chrome?.parseSplashBackgroundColor();
    // Fail closed: wait for chrome before painting splash plate (native splash covers until then).
    if (chrome == null || bg == null) {
      return const Scaffold(body: SizedBox.shrink());
    }

    final brand = chrome.brandMarkAlt.trim();
    final markInk =
        chrome.splashUsesWhiteMark ? Colors.white : const Color(0xFFFAFAFA);

    return Scaffold(
      backgroundColor: bg,
      body: Center(
        child: FadeTransition(
          opacity: _fade,
          child: ScaleTransition(
            scale: _scale,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DamaBrandMark(
                  size: 72,
                  forceWhite: chrome.splashUsesWhiteMark,
                  semanticLabel: brand,
                ),
                if (brand.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(
                    brand,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: markInk,
                      fontSize: 28,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.2,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
