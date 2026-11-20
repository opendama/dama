import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/util/date_mask.dart';
import 'package:flutter/material.dart';

ThemeData _pickerTheme(BuildContext context) {
  final tokens = damaColorsOf(context);
  final base = Theme.of(context);
  return base.copyWith(
    colorScheme: base.colorScheme.copyWith(
      primary: tokens.brand,
      onPrimary: tokens.onBrand,
      secondary: tokens.brand,
      onSecondary: tokens.onBrand,
      tertiary: tokens.brand,
      onTertiary: tokens.onBrand,
      surfaceTint: Colors.transparent,
    ),
    // Material time dial can still pick seed-blue without an explicit theme.
    timePickerTheme: TimePickerThemeData(
      backgroundColor: tokens.card,
      dialHandColor: tokens.brand,
      dialBackgroundColor: tokens.surfaceMuted,
      dialTextColor: WidgetStateColor.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return tokens.onBrand;
        return base.colorScheme.onSurface;
      }),
      hourMinuteColor: WidgetStateColor.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return tokens.brand;
        return tokens.brandMuted;
      }),
      hourMinuteTextColor: WidgetStateColor.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return tokens.onBrand;
        return tokens.brand;
      }),
      dayPeriodColor: WidgetStateColor.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return tokens.brand;
        return tokens.surfaceMuted;
      }),
      dayPeriodTextColor: WidgetStateColor.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return tokens.onBrand;
        return tokens.brand;
      }),
      dayPeriodBorderSide: BorderSide(color: tokens.brand),
      entryModeIconColor: tokens.brand,
      cancelButtonStyle:
          TextButton.styleFrom(foregroundColor: tokens.onSurfaceMuted),
      confirmButtonStyle: TextButton.styleFrom(foregroundColor: tokens.brand),
    ),
    datePickerTheme: DatePickerThemeData(
      headerBackgroundColor: tokens.brand,
      headerForegroundColor: tokens.onBrand,
      todayForegroundColor: WidgetStateProperty.all(tokens.brand),
      todayBorder: BorderSide(color: tokens.brand),
      // Match time-picker selected fill (solid brand + onBrand label).
      dayOverlayColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return tokens.brand.withValues(alpha: 0.16);
        }
        if (states.contains(WidgetState.pressed) ||
            states.contains(WidgetState.hovered) ||
            states.contains(WidgetState.focused)) {
          return tokens.brand.withValues(alpha: 0.1);
        }
        return null;
      }),
      dayBackgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return tokens.brand;
        return null;
      }),
      dayForegroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return tokens.onBrand;
        return null;
      }),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  );
}

/// Trailing-calendar date field (web DateField parity).
/// Whole field opens the picker - no nested IconButton (avoids frozen taps).
class ChromeDateField extends StatelessWidget {
  const ChromeDateField({
    super.key,
    required this.label,
    required this.valueText,
    required this.onPicked,
    this.hintText,
    this.errorText,
    this.enabled = true,
    this.firstDate,
    this.lastDate,
    this.initialDate,
  });

  final String label;
  final String valueText;
  final ValueChanged<DateTime> onPicked;
  final String? hintText;
  /** Chrome-owned validation copy after a submit attempt. */
  final String? errorText;
  final bool enabled;
  final DateTime? firstDate;
  final DateTime? lastDate;
  final DateTime? initialDate;

  Future<void> _open(BuildContext context) async {
    if (!enabled) return;
    final now = DateTime.now();
    final first = firstDate ?? DateTime(now.year - 120);
    final last = lastDate ?? DateTime(now.year + 40);
    var initial = initialDate ?? parseFlexibleDate(valueText) ?? now;
    if (initial.isBefore(first)) initial = first;
    if (initial.isAfter(last)) initial = last;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: first,
      lastDate: last,
      builder: (ctx, child) => Theme(data: _pickerTheme(ctx), child: child!),
    );
    if (picked == null) return;
    onPicked(picked);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final empty = valueText.trim().isEmpty;
    final hint = (hintText ?? '').trim();
    final err = (errorText ?? '').trim();
    final display = empty ? (hint.isNotEmpty ? hint : ' ') : valueText;
    return Material(
      type: MaterialType.transparency,
      child: InkWell(
        onTap: enabled ? () => _open(context) : null,
        borderRadius: BorderRadius.circular(8),
        child: InputDecorator(
          isEmpty: empty,
          decoration: InputDecoration(
            labelText: label,
            hintText: hint.isNotEmpty ? hint : null,
            errorText: err.isNotEmpty ? err : null,
            border: const OutlineInputBorder(),
            // Icon only - whole field InkWell handles the tap (no nested button freeze).
            suffixIcon: Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Icon(
                Icons.calendar_today_outlined,
                color: enabled
                    ? tokens.onSurfaceMuted
                    : tokens.onSurfaceMuted.withValues(alpha: 0.4),
              ),
            ),
            suffixIconConstraints: const BoxConstraints(
              minWidth: 40,
              minHeight: 40,
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

/// Date + time field (web DateTimeField parity).
class ChromeDateTimeField extends StatelessWidget {
  const ChromeDateTimeField({
    super.key,
    required this.label,
    required this.valueText,
    required this.onPicked,
    this.hintText,
    this.helperText,
    this.enabled = true,
    this.firstDate,
    this.lastDate,
  });

  final String label;
  final String valueText;
  final ValueChanged<DateTime> onPicked;
  final String? hintText;
  final String? helperText;
  final bool enabled;
  final DateTime? firstDate;
  final DateTime? lastDate;

  Future<void> _open(BuildContext context) async {
    if (!enabled) return;
    final now = DateTime.now();
    final first = firstDate ?? now;
    final last = lastDate ?? DateTime(now.year + 5);
    final parsed = parseFlexibleDateTime(valueText.trim());
    var initialDate = parsed ?? now.add(const Duration(days: 7));
    if (initialDate.isBefore(first)) initialDate = first;
    if (initialDate.isAfter(last)) initialDate = last;
    // Date first, then time only after confirm - mirrors web click-to-open time.
    final day = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: first,
      lastDate: last,
      useRootNavigator: true,
      builder: (ctx, child) {
        final mq = MediaQuery.of(ctx);
        final pad = mq.viewPadding;
        return MediaQuery(
          data: mq.copyWith(
            // Keep dialogs inside short / keyboard-inset viewports.
            padding: EdgeInsets.only(
              left: pad.left,
              top: pad.top,
              right: pad.right,
              bottom: pad.bottom,
            ),
          ),
          child: Theme(data: _pickerTheme(ctx), child: child!),
        );
      },
    );
    if (day == null || !context.mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(parsed ?? initialDate),
      useRootNavigator: true,
      builder: (ctx, child) {
        // Match admin/web 12h + AM/PM; brand colors come from _pickerTheme.
        final mq = MediaQuery.of(ctx);
        return MediaQuery(
          data: mq.copyWith(alwaysUse24HourFormat: false),
          child: Theme(data: _pickerTheme(ctx), child: child!),
        );
      },
    );
    if (time == null || !context.mounted) return;
    onPicked(DateTime(day.year, day.month, day.day, time.hour, time.minute));
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final empty = valueText.trim().isEmpty;
    final hint = (hintText ?? '').trim();
    final display = empty ? (hint.isNotEmpty ? hint : ' ') : valueText;
    return Material(
      type: MaterialType.transparency,
      child: InkWell(
        onTap: enabled ? () => _open(context) : null,
        borderRadius: BorderRadius.circular(8),
        child: InputDecorator(
          isEmpty: empty,
          decoration: InputDecoration(
            labelText: label,
            hintText: hint.isNotEmpty ? hint : null,
            helperText: helperText,
            border: const OutlineInputBorder(),
            suffixIcon: Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Icon(
                Icons.calendar_today_outlined,
                color: enabled
                    ? tokens.onSurfaceMuted
                    : tokens.onSurfaceMuted.withValues(alpha: 0.4),
              ),
            ),
            suffixIconConstraints: const BoxConstraints(
              minWidth: 40,
              minHeight: 40,
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
