import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/theme_cubit.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;

/// Icon-only light/dark toggle (sun / moon). Tooltip from theme_chrome DB.
class ThemeToggleButton extends StatefulWidget {
  const ThemeToggleButton({super.key});

  @override
  State<ThemeToggleButton> createState() => _ThemeToggleButtonState();
}

class _ThemeToggleButtonState extends State<ThemeToggleButton> {
  ThemeChrome? _chrome;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadChrome();
  }

  Future<void> _loadChrome() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.defaults.restUrl}/public/theme-chrome'),
      );
      Map<String, dynamic>? map;
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) map = decoded;
      } catch (_) {}
      if (res.statusCode != 200) {
        if (!mounted) return;
        setState(() {
          _chrome = null;
          _loading = false;
        });
        return;
      }
      final chrome = ThemeChrome.fromJson(map);
      if (!mounted) return;
      setState(() {
        _chrome = chrome;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _chrome = null;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const SizedBox(
        width: 40,
        height: 40,
        child: Center(
          child: SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }
    final chrome = _chrome;
    if (chrome == null) {
      return const SizedBox.shrink();
    }
    return BlocBuilder<ThemeCubit, ThemeMode>(
      builder: (context, mode) {
        final isDark = mode == ThemeMode.dark;
        final current = isDark ? ThemeModeLabel.dark : ThemeModeLabel.light;
        final next = isDark ? ThemeModeLabel.light : ThemeModeLabel.dark;
        final currentLabel = chrome.labelFor(current);
        final nextLabel = chrome.labelFor(next);
        final tip = chrome.fillTemplate(
          chrome.titleTemplate,
          currentLabel,
          nextLabel,
        );
        return IconButton(
          tooltip: tip.isNotEmpty ? tip : chrome.ariaLabel,
          onPressed: () {
            context.read<ThemeCubit>().setMode(
                  isDark ? ThemeMode.light : ThemeMode.dark,
                );
          },
          // Sun when dark (switch to light); moon when light (switch to dark).
          icon:
              Icon(isDark ? Icons.wb_sunny_outlined : Icons.dark_mode_outlined),
        );
      },
    );
  }
}
