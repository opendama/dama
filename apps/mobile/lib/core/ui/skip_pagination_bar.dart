import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/features/leaderboard/leaderboard_cubit.dart'
    show SkipMeta;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class _NavAvailability {
  const _NavAvailability({
    required this.firstOk,
    required this.prevOk,
    required this.nextOk,
    required this.lastOk,
  });

  final bool firstOk;
  final bool prevOk;
  final bool nextOk;
  final bool lastOk;

  factory _NavAvailability.fromMeta(SkipMeta meta) {
    return _NavAvailability(
      firstOk: meta.firstSkip != null,
      prevOk: meta.prevSkip != null,
      nextOk: meta.hasMore && meta.nextSkip != null,
      lastOk: meta.lastSkip != null,
    );
  }

  factory _NavAvailability.fromPage(int page, int totalPages) {
    final p = page < 1 ? 1 : page;
    final max = totalPages < 1 ? 1 : totalPages;
    return _NavAvailability(
      firstOk: p > 1,
      prevOk: p > 1,
      nextOk: p < max,
      lastOk: p < max,
    );
  }
}

/// Rewrite the leading page digit in an API `page_summary` (e.g. "Page 2 of 5 (123)").
String _summaryWithPage(String template, int page) {
  if (template.isEmpty) return '';
  return template.replaceFirst(RegExp(r'\d+'), '$page');
}

/// Stable skip pagination (web SkipPagination parity).
///
/// While [busy], re-clicks are absorbed without graying every control.
/// Summary + First/Prev/Next/Last chrome freeze until the fetch settles.
class SkipPaginationBar extends StatefulWidget {
  const SkipPaginationBar({
    super.key,
    required this.meta,
    required this.onSkip,
    this.busy = false,
    this.padding = const EdgeInsets.fromLTRB(0, 16, 0, 8),
  });

  final SkipMeta meta;
  final void Function(int skip) onSkip;
  final bool busy;
  final EdgeInsetsGeometry padding;

  @override
  State<SkipPaginationBar> createState() => _SkipPaginationBarState();
}

class _SkipPaginationBarState extends State<SkipPaginationBar> {
  late final TextEditingController _pageCtrl;
  final _pageFocus = FocusNode();
  _NavAvailability? _frozenNav;
  String? _displaySummary;

  @override
  void initState() {
    super.initState();
    _pageCtrl = TextEditingController(text: '${widget.meta.page}');
    _displaySummary = widget.meta.pageSummary;
  }

  @override
  void didUpdateWidget(covariant SkipPaginationBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.busy && !widget.busy) {
      _frozenNav = null;
      _displaySummary = widget.meta.pageSummary;
    } else if (!widget.busy &&
        widget.meta.pageSummary != oldWidget.meta.pageSummary) {
      _displaySummary = widget.meta.pageSummary;
    }
    if (_pageFocus.hasFocus) return;
    final next = '${widget.meta.page}';
    if (_pageCtrl.text != next) {
      _pageCtrl.value = TextEditingValue(
        text: next,
        selection: TextSelection.collapsed(offset: next.length),
      );
    }
  }

  @override
  void dispose() {
    _pageFocus.dispose();
    _pageCtrl.dispose();
    super.dispose();
  }

  void _applyOptimistic(int skip) {
    final meta = widget.meta;
    final limit = meta.limit;
    final page = limit > 0 ? (skip ~/ limit) + 1 : meta.page;
    final text = '$page';
    if (_pageCtrl.text != text) {
      _pageCtrl.value = TextEditingValue(
        text: text,
        selection: TextSelection.collapsed(offset: text.length),
      );
    }
    setState(() {
      _frozenNav = _NavAvailability.fromPage(page, meta.totalPages);
      _displaySummary = _summaryWithPage(meta.pageSummary, page);
    });
  }

  void _goSkip(int? skip) {
    if (widget.busy || skip == null) return;
    _applyOptimistic(skip);
    widget.onSkip(skip);
  }

  void _goPage() {
    if (widget.busy) return;
    final meta = widget.meta;
    final page = int.tryParse(_pageCtrl.text.trim());
    if (page == null || page < 1 || page > meta.totalPages || meta.limit < 1) {
      return;
    }
    _goSkip((page - 1) * meta.limit);
  }

  Widget _btn(String label, {required bool enabled, VoidCallback? onPressed}) {
    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: IgnorePointer(
        ignoring: !enabled,
        child: SizedBox(
          height: 32,
          child: OutlinedButton(
            onPressed: onPressed,
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              minimumSize: const Size(56, 32),
              textStyle:
                  const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
            ),
            child: Text(label),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final meta = widget.meta;
    final busy = widget.busy;
    final nav = _frozenNav ?? _NavAvailability.fromMeta(meta);
    final summary = _displaySummary ?? meta.pageSummary;

    return Padding(
      padding: widget.padding,
      child: AbsorbPointer(
        absorbing: busy,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: 18,
              child: summary.isNotEmpty
                  ? Text(
                      summary,
                      style: TextStyle(
                        fontSize: 12,
                        color: tokens.onSurfaceMuted,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (meta.firstActionLabel.isNotEmpty)
                  _btn(
                    meta.firstActionLabel,
                    enabled: nav.firstOk,
                    onPressed: () => _goSkip(meta.firstSkip),
                  ),
                if (meta.prevActionLabel.isNotEmpty)
                  _btn(
                    meta.prevActionLabel,
                    enabled: nav.prevOk,
                    onPressed: () => _goSkip(meta.prevSkip),
                  ),
                SizedBox(
                  width: 52,
                  height: 32,
                  child: TextField(
                    controller: _pageCtrl,
                    focusNode: _pageFocus,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                    ],
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 12,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                    decoration: const InputDecoration(
                      isDense: true,
                      contentPadding:
                          EdgeInsets.symmetric(horizontal: 6, vertical: 6),
                      border: OutlineInputBorder(),
                    ),
                    onSubmitted: (_) => _goPage(),
                  ),
                ),
                if (meta.skipToActionLabel.isNotEmpty)
                  _btn(
                    meta.skipToActionLabel,
                    enabled: true,
                    onPressed: _goPage,
                  ),
                if (meta.nextActionLabel.isNotEmpty)
                  _btn(
                    meta.nextActionLabel,
                    enabled: nav.nextOk,
                    onPressed: () => _goSkip(meta.nextSkip),
                  ),
                if (meta.lastActionLabel.isNotEmpty)
                  _btn(
                    meta.lastActionLabel,
                    enabled: nav.lastOk,
                    onPressed: () => _goSkip(meta.lastSkip),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Compact Prev/Next strip (wallet receipts/transactions/payouts).
class SkipPrevNextBar extends StatefulWidget {
  const SkipPrevNextBar({
    super.key,
    required this.pageSummary,
    required this.prevActionLabel,
    required this.nextActionLabel,
    required this.prevSkip,
    required this.nextSkip,
    required this.onSkip,
    this.busy = false,
    this.padding = const EdgeInsets.fromLTRB(0, 12, 0, 0),
  });

  final String pageSummary;
  final String prevActionLabel;
  final String nextActionLabel;
  final int? prevSkip;
  final int? nextSkip;
  final void Function(int skip) onSkip;
  final bool busy;
  final EdgeInsetsGeometry padding;

  @override
  State<SkipPrevNextBar> createState() => _SkipPrevNextBarState();
}

class _SkipPrevNextBarState extends State<SkipPrevNextBar> {
  bool? _frozenPrevOk;
  bool? _frozenNextOk;
  String? _frozenSummary;

  @override
  void didUpdateWidget(covariant SkipPrevNextBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.busy && !widget.busy) {
      _frozenPrevOk = null;
      _frozenNextOk = null;
      _frozenSummary = null;
    }
  }

  void _go(int? skip) {
    if (widget.busy || skip == null) return;
    setState(() {
      _frozenPrevOk = widget.prevSkip != null;
      _frozenNextOk = widget.nextSkip != null;
      _frozenSummary = widget.pageSummary;
    });
    widget.onSkip(skip);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final busy = widget.busy;
    final summary = (busy && (_frozenSummary?.isNotEmpty ?? false))
        ? _frozenSummary!
        : widget.pageSummary;
    final prevOk = _frozenPrevOk ?? widget.prevSkip != null;
    final nextOk = _frozenNextOk ?? widget.nextSkip != null;

    return Padding(
      padding: widget.padding,
      child: AbsorbPointer(
        absorbing: busy,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: 18,
              child: summary.isNotEmpty
                  ? Text(
                      summary,
                      style: TextStyle(
                        fontSize: 12,
                        color: tokens.onSurfaceMuted,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                if (widget.prevActionLabel.isNotEmpty)
                  Opacity(
                    opacity: prevOk ? 1 : 0.5,
                    child: IgnorePointer(
                      ignoring: !prevOk,
                      child: SizedBox(
                        height: 32,
                        child: OutlinedButton(
                          onPressed: () => _go(widget.prevSkip),
                          child: Text(widget.prevActionLabel),
                        ),
                      ),
                    ),
                  ),
                const Spacer(),
                if (widget.nextActionLabel.isNotEmpty)
                  Opacity(
                    opacity: nextOk ? 1 : 0.5,
                    child: IgnorePointer(
                      ignoring: !nextOk,
                      child: SizedBox(
                        height: 32,
                        child: OutlinedButton(
                          onPressed: () => _go(widget.nextSkip),
                          child: Text(widget.nextActionLabel),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
