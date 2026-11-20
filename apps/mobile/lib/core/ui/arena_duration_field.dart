import 'package:dama_mobile/core/arena_duration.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/ui/chrome_date_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class ArenaDurationFieldChrome {
  const ArenaDurationFieldChrome({
    required this.label,
    required this.requiredHint,
    required this.unitLabel,
    required this.unitMinutes,
    required this.unitHours,
    required this.unitDays,
    required this.unitWeeks,
    required this.unitMonths,
    required this.modeLength,
    required this.modeEndsAt,
    required this.endsAtLabel,
    required this.endsAtPlaceholder,
    required this.lengthPlaceholder,
    this.endsAtPast = '',
    this.blurb = '',
  });

  final String label;
  final String requiredHint;
  final String lengthPlaceholder;
  final String unitLabel;
  final String unitMinutes;
  final String unitHours;
  final String unitDays;
  final String unitWeeks;
  final String unitMonths;
  final String modeLength;
  final String modeEndsAt;
  final String endsAtLabel;
  final String endsAtPlaceholder;
  final String endsAtPast;
  final String blurb;

  bool get isReady =>
      label.trim().isNotEmpty &&
      requiredHint.trim().isNotEmpty &&
      unitLabel.trim().isNotEmpty &&
      unitMinutes.trim().isNotEmpty &&
      unitHours.trim().isNotEmpty &&
      unitDays.trim().isNotEmpty &&
      unitWeeks.trim().isNotEmpty &&
      unitMonths.trim().isNotEmpty &&
      modeLength.trim().isNotEmpty &&
      modeEndsAt.trim().isNotEmpty &&
      endsAtLabel.trim().isNotEmpty &&
      endsAtPlaceholder.trim().isNotEmpty &&
      lengthPlaceholder.trim().isNotEmpty;
}

/// Length (amount × unit) or Ends-at calendar → arena_duration_minutes.
class ArenaDurationField extends StatefulWidget {
  const ArenaDurationField({
    super.key,
    required this.chrome,
    required this.minutesValue,
    required this.onMinutesChanged,
    this.errorText,
    this.enabled = true,
    this.labelOverride,
  });

  final ArenaDurationFieldChrome chrome;
  final String minutesValue;
  final ValueChanged<String> onMinutesChanged;
  final String? errorText;
  final bool enabled;
  final String? labelOverride;

  @override
  State<ArenaDurationField> createState() => _ArenaDurationFieldState();
}

class _ArenaDurationFieldState extends State<ArenaDurationField> {
  // Calendar-first (ads Ends-at parity); Length is secondary.
  ArenaDurationMode _mode = ArenaDurationMode.endsAt;
  late final TextEditingController _amountCtrl;
  ArenaDurationUnit _unit = ArenaDurationUnit.hours;
  DateTime? _endsAt;
  bool _endsPast = false;

  @override
  void initState() {
    super.initState();
    final mins = int.tryParse(widget.minutesValue.trim());
    if (mins != null && mins > 0) {
      final split = splitMinutesToAmountUnit(mins);
      _amountCtrl = TextEditingController(text: split.amount);
      _unit = split.unit;
      _endsAt = dateTimeFromMinutesAhead(mins);
    } else {
      _amountCtrl = TextEditingController();
    }
  }

  @override
  void didUpdateWidget(covariant ArenaDurationField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.minutesValue == widget.minutesValue) return;
    final mins = int.tryParse(widget.minutesValue.trim());
    if (mins == null || mins < 1) {
      if (_mode == ArenaDurationMode.length && _amountCtrl.text.isNotEmpty) {
        _amountCtrl.text = '';
      }
      return;
    }
    final split = splitMinutesToAmountUnit(mins);
    final current = minutesFromAmountUnit(
      num.tryParse(_amountCtrl.text.trim()),
      _unit,
    );
    if (_mode == ArenaDurationMode.length && current != mins) {
      _amountCtrl.text = split.amount;
      _unit = split.unit;
    }
    if (_mode == ArenaDurationMode.endsAt) {
      final fromEnds = _endsAt == null ? null : minutesUntilDateTime(_endsAt!);
      if (fromEnds != mins) {
        setState(() {
          _endsAt = dateTimeFromMinutesAhead(mins);
          _endsPast = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    super.dispose();
  }

  String _unitLabel(ArenaDurationUnit unit) {
    switch (unit) {
      case ArenaDurationUnit.minutes:
        return widget.chrome.unitMinutes;
      case ArenaDurationUnit.hours:
        return widget.chrome.unitHours;
      case ArenaDurationUnit.days:
        return widget.chrome.unitDays;
      case ArenaDurationUnit.weeks:
        return widget.chrome.unitWeeks;
      case ArenaDurationUnit.months:
        return widget.chrome.unitMonths;
    }
  }

  void _emitLength() {
    final mins = minutesFromAmountUnit(
      num.tryParse(_amountCtrl.text.trim()),
      _unit,
    );
    widget.onMinutesChanged(mins != null ? '$mins' : '');
  }

  void _emitEnds(DateTime end) {
    final mins = minutesUntilDateTime(end);
    if (mins == null) {
      setState(() => _endsPast = widget.chrome.endsAtPast.trim().isNotEmpty);
      widget.onMinutesChanged('');
      return;
    }
    setState(() => _endsPast = false);
    widget.onMinutesChanged('$mins');
  }

  @override
  Widget build(BuildContext context) {
    final chrome = widget.chrome;
    if (!chrome.isReady) return const SizedBox.shrink();
    final tokens = damaColorsOf(context);
    final label = (widget.labelOverride ?? chrome.label).trim();
    final err = (widget.errorText ?? '').trim();
    final showErr =
        err.isNotEmpty ? err : (_endsPast ? chrome.endsAtPast.trim() : '');

    void switchMode(ArenaDurationMode v) {
      setState(() {
        _mode = v;
        final mins = int.tryParse(widget.minutesValue.trim());
        if (v == ArenaDurationMode.endsAt) {
          _endsAt =
              mins != null && mins > 0 ? dateTimeFromMinutesAhead(mins) : null;
          _endsPast = false;
        } else if (mins != null && mins > 0) {
          final split = splitMinutesToAmountUnit(mins);
          _amountCtrl.text = split.amount;
          _unit = split.unit;
        }
      });
    }

    final modeToggle = SegmentedButton<ArenaDurationMode>(
      segments: [
        ButtonSegment(
          value: ArenaDurationMode.endsAt,
          label: Text(chrome.modeEndsAt),
        ),
        ButtonSegment(
          value: ArenaDurationMode.length,
          label: Text(chrome.modeLength),
        ),
      ],
      selected: {_mode},
      onSelectionChanged:
          !widget.enabled ? null : (next) => switchMode(next.first),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (chrome.blurb.trim().isNotEmpty) ...[
          Text(
            chrome.blurb,
            style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
          ),
          const SizedBox(height: 8),
        ],
        modeToggle,
        const SizedBox(height: 8),
        if (_mode == ArenaDurationMode.endsAt)
          ChromeDateTimeField(
            label: chrome.endsAtLabel.trim().isNotEmpty
                ? chrome.endsAtLabel
                : label,
            valueText: _endsAt != null ? formatLocalDateTimeMask(_endsAt!) : '',
            hintText: chrome.endsAtPlaceholder,
            helperText: showErr.isNotEmpty ? showErr : null,
            enabled: widget.enabled,
            onPicked: (d) {
              setState(() => _endsAt = d);
              _emitEnds(d);
            },
          )
        else ...[
          Text(label, style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: TextField(
                  controller: _amountCtrl,
                  enabled: widget.enabled,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                  ],
                  decoration: InputDecoration(
                    labelText: chrome.requiredHint,
                    hintText: chrome.lengthPlaceholder,
                    border: const OutlineInputBorder(),
                    errorText: showErr.isNotEmpty ? showErr : null,
                  ),
                  onChanged: (_) => _emitLength(),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 120,
                child: InputDecorator(
                  decoration: InputDecoration(
                    labelText: chrome.unitLabel,
                    border: const OutlineInputBorder(),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<ArenaDurationUnit>(
                      value: _unit,
                      isExpanded: true,
                      isDense: true,
                      onChanged: !widget.enabled
                          ? null
                          : (v) {
                              if (v == null) return;
                              setState(() => _unit = v);
                              _emitLength();
                            },
                      items: ArenaDurationUnit.values
                          .map(
                            (u) => DropdownMenuItem(
                              value: u,
                              child: Text(_unitLabel(u)),
                            ),
                          )
                          .toList(),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
