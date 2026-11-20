import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

/// Normalize ISO-3166 alpha-2 from API; empty when missing/invalid (never invent).
String normalizeCountryCode(String? code) {
  final cc = (code ?? '').trim().toUpperCase();
  if (cc.length != 2) return '';
  final a = cc.codeUnitAt(0);
  final b = cc.codeUnitAt(1);
  if (a < 65 || a > 90 || b < 65 || b > 90) return '';
  return cc;
}

/// Build colored flag URL from DB chrome template + ISO-2 (`{code}` placeholder).
String countryFlagImageUrl(String? code, String? imageUrlTemplate) {
  final cc = normalizeCountryCode(code);
  final tmpl = (imageUrlTemplate ?? '').trim();
  if (cc.isEmpty || !tmpl.contains('{code}')) return '';
  return tmpl.replaceAll('{code}', cc.toLowerCase());
}

/// Cached DB template from `GET /public/country-flag-chrome` (fail closed).
class CountryFlagChromeCache {
  CountryFlagChromeCache._();
  static String? _template;
  static Future<String?>? _inflight;

  static String? get template => _template;

  static Future<String?> ensureLoaded() {
    if (_template != null && _template!.contains('{code}')) {
      return Future.value(_template);
    }
    return _inflight ??= () async {
      try {
        final res = await http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/public/country-flag-chrome'),
        );
        if (res.statusCode >= 300) {
          _inflight = null;
          return null;
        }
        final map = jsonDecode(res.body);
        if (map is! Map<String, dynamic>) {
          _inflight = null;
          return null;
        }
        final tmpl = (map['image_url_template'] as String?)?.trim() ?? '';
        if (!tmpl.contains('{code}')) {
          _inflight = null;
          return null;
        }
        _template = tmpl;
        return tmpl;
      } catch (_) {
        _inflight = null;
        return null;
      }
    }();
  }
}

/// Inline colored country flag after username/rating. Empty when no ISO-2 + DB template.
class CountryFlag extends StatefulWidget {
  const CountryFlag({
    super.key,
    required this.code,
    this.height = 12,
    this.imageUrlTemplate,
  });

  final String? code;
  final double height;

  /// Optional template from play_rail / profile chrome (`countryFlagImageUrlTemplate`).
  final String? imageUrlTemplate;

  @override
  State<CountryFlag> createState() => _CountryFlagState();
}

class _CountryFlagState extends State<CountryFlag> {
  String? _tmpl;

  @override
  void initState() {
    super.initState();
    final passed = (widget.imageUrlTemplate ?? '').trim();
    if (passed.contains('{code}')) {
      _tmpl = passed;
    } else {
      _tmpl = CountryFlagChromeCache.template;
      if (_tmpl == null || !_tmpl!.contains('{code}')) {
        CountryFlagChromeCache.ensureLoaded().then((t) {
          if (!mounted) return;
          setState(() => _tmpl = t);
        });
      }
    }
  }

  @override
  void didUpdateWidget(covariant CountryFlag oldWidget) {
    super.didUpdateWidget(oldWidget);
    final passed = (widget.imageUrlTemplate ?? '').trim();
    if (passed.contains('{code}') && passed != _tmpl) {
      _tmpl = passed;
    }
  }

  @override
  Widget build(BuildContext context) {
    final src = countryFlagImageUrl(widget.code, _tmpl);
    if (src.isEmpty) return const SizedBox.shrink();
    final width = widget.height * 4 / 3;
    return ClipRRect(
      borderRadius: BorderRadius.circular(1),
      child: Image.network(
        src,
        width: width,
        height: widget.height,
        fit: BoxFit.cover,
        filterQuality: FilterQuality.medium,
        errorBuilder: (_, __, ___) => const SizedBox.shrink(),
        loadingBuilder: (context, child, progress) {
          if (progress == null) return child;
          return SizedBox(width: width, height: widget.height);
        },
      ),
    );
  }
}
