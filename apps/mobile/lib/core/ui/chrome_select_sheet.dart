import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:flutter/material.dart';

class ChromeSelectOption<T> {
  const ChromeSelectOption({required this.value, required this.label});
  final T value;
  final String label;
}

/// shadcn Select–parity field: opens a modal sheet (not a native dropdown).
/// Empty state shows muted [hintText] (defaults to [label]) - never a blank trigger.
class ChromeSelectField extends StatelessWidget {
  const ChromeSelectField({
    super.key,
    required this.label,
    required this.valueLabel,
    required this.onTap,
    this.hintText,
    this.enabled = true,
    this.leading,
  });

  final String label;
  final String valueLabel;

  /// Shown when [valueLabel] is empty (backend chrome / field label).
  final String? hintText;
  final VoidCallback onTap;
  final bool enabled;
  final Widget? leading;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final empty = valueLabel.trim().isEmpty;
    final hint = (hintText ?? label).trim();
    final display = empty ? (hint.isNotEmpty ? hint : ' ') : valueLabel;
    return Material(
      type: MaterialType.transparency,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(8),
        child: InputDecorator(
          isEmpty: empty,
          decoration: InputDecoration(
            labelText: label,
            hintText: hint.isNotEmpty ? hint : null,
            prefixIcon: leading,
            border: const OutlineInputBorder(),
            suffixIcon: Icon(
              Icons.expand_more,
              color: enabled
                  ? tokens.onSurfaceMuted
                  : tokens.onSurfaceMuted.withValues(alpha: 0.4),
            ),
          ),
          child: Text(
            display,
            style: TextStyle(
              color: empty
                  ? tokens.onSurfaceMuted
                  : (enabled ? tokens.onSurface : tokens.onSurfaceMuted),
            ),
          ),
        ),
      ),
    );
  }
}

Future<T?> showChromeOptionSheet<T>({
  required BuildContext context,
  required String title,
  required List<ChromeSelectOption<T>> options,
  T? selected,
}) {
  return showModalBottomSheet<T>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (ctx) {
      final tokens = damaColorsOf(ctx);
      if (options.isEmpty) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            child: Text(
              title,
              style: TextStyle(color: tokens.onSurfaceMuted),
            ),
          ),
        );
      }
      return SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(ctx).height * 0.55,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                child: Text(
                  title,
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 16),
                ),
              ),
              Flexible(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: options.length,
                  itemBuilder: (_, i) {
                    final o = options[i];
                    final on = selected == o.value;
                    return ListTile(
                      title: Text(o.label),
                      leading: on
                          ? Icon(Icons.check, color: tokens.brand, size: 20)
                          : const SizedBox(width: 20),
                      onTap: () => Navigator.of(ctx).pop(o.value),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}
