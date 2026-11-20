import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/theme/theme_toggle_button.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

/// Privacy / Terms / Refunds - tabs + DB document body.
class LegalPage extends StatefulWidget {
  LegalPage({super.key, required this.kind, ApiConfig? config})
      : config = config ?? ApiConfig.defaults;

  final LegalDocKind kind;
  final ApiConfig config;

  @override
  State<LegalPage> createState() => _LegalPageState();
}

class _LegalPageState extends State<LegalPage> {
  LegalChrome? _chrome;
  LegalDocument? _doc;
  String _unavailable = '';
  bool _loading = true;
  late LegalDocKind _kind;

  @override
  void initState() {
    super.initState();
    _kind = widget.kind;
    _load();
  }

  @override
  void didUpdateWidget(covariant LegalPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.kind != widget.kind) {
      _kind = widget.kind;
      _load();
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final chromeRes = await http.get(
        Uri.parse('${widget.config.restUrl}/public/legal-chrome'),
      );
      LegalChrome? chrome;
      String unavailable = '';
      if (chromeRes.statusCode < 300) {
        final map = jsonDecode(chromeRes.body) as Map<String, dynamic>;
        chrome = LegalChrome.fromJson(map);
        unavailable = (map['legal_unavailable'] as String?)?.trim() ?? '';
      }

      LegalDocument? doc;
      if (chrome != null) {
        final docRes = await http.get(
          Uri.parse(
            '${widget.config.restUrl}/public/legal/${_kind.pathSegment}',
          ),
        );
        if (docRes.statusCode < 300) {
          final map = jsonDecode(docRes.body) as Map<String, dynamic>;
          doc = LegalDocument.fromJson(map);
        }
      }

      if (!mounted) return;
      setState(() {
        _chrome = chrome;
        _doc = doc;
        _unavailable = unavailable;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _chrome = null;
        _doc = null;
        _loading = false;
      });
    }
  }

  void _selectTab(LegalDocKind kind) {
    if (kind == _kind) return;
    setState(() => _kind = kind);
    _load();
  }

  Widget _tabs(LegalChrome chrome) {
    final tokens = damaColorsOf(context);
    final items = <(LegalDocKind, String)>[
      (LegalDocKind.privacy, chrome.privacyNavLabel),
      (LegalDocKind.terms, chrome.termsNavLabel),
      (LegalDocKind.refunds, chrome.refundsNavLabel),
    ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final (kind, label) in items)
            if (label.trim().isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(label.trim()),
                  selected: kind == _kind,
                  onSelected: (_) => _selectTab(kind),
                  selectedColor: tokens.surfaceMuted,
                  labelStyle: TextStyle(
                    color: kind == _kind ? tokens.gold : tokens.onSurfaceMuted,
                    fontWeight:
                        kind == _kind ? FontWeight.w600 : FontWeight.w500,
                  ),
                ),
              ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final chrome = _chrome;
    final doc = _doc;
    final title = chrome?.titleFor(_kind) ?? '';

    return Scaffold(
      appBar: AppBar(
        title: Text(title.isNotEmpty ? title : chrome?.privacyNavLabel ?? ''),
        actions: const [ThemeToggleButton()],
      ),
      body: _loading
          ? const LegalDocumentSkeleton()
          : chrome == null || doc == null
              ? ListView(
                  padding: const EdgeInsets.all(24),
                  children: [
                    if (chrome != null) ...[
                      _tabs(chrome),
                      const SizedBox(height: 24),
                    ],
                    Text(
                      _unavailable,
                      textAlign: TextAlign.center,
                      style: TextStyle(color: tokens.danger),
                    ),
                  ],
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
                    children: [
                      _tabs(chrome),
                      const SizedBox(height: 24),
                      Text(
                        title,
                        style: Theme.of(context)
                            .textTheme
                            .headlineMedium
                            ?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      const SizedBox(height: 24),
                      for (final section in doc.sections) ...[
                        if (section.heading.isNotEmpty) ...[
                          Text(
                            section.heading,
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(
                                  color: tokens.gold,
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                          const SizedBox(height: 8),
                        ],
                        Text(
                          section.body,
                          style: TextStyle(
                            color: tokens.onSurfaceMuted,
                            height: 1.5,
                          ),
                        ),
                        if (section.usesSupportEmail &&
                            doc.supportEmail.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text.rich(
                            TextSpan(
                              style: TextStyle(color: tokens.onSurfaceMuted),
                              children: [
                                if (section.contactLead.isNotEmpty)
                                  TextSpan(text: '${section.contactLead} '),
                                TextSpan(
                                  text: doc.supportEmail,
                                  style: TextStyle(color: tokens.gold),
                                ),
                                if (section.contactTrail.isNotEmpty)
                                  TextSpan(text: ' ${section.contactTrail}'),
                              ],
                            ),
                          ),
                        ],
                        const SizedBox(height: 20),
                      ],
                    ],
                  ),
                ),
    );
  }
}

void openLegalPage(BuildContext context, LegalDocKind kind) {
  Navigator.of(context).push(
    MaterialPageRoute(builder: (_) => LegalPage(kind: kind)),
  );
}
