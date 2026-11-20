import 'dart:convert';

import 'package:dama_mobile/core/lib/chrome_string.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

/// In-match schedule editor for a campaign (web PublisherScheduleEditor parity).
class PublisherScheduleEditor extends StatefulWidget {
  const PublisherScheduleEditor({
    super.key,
    required this.accessToken,
    required this.campaign,
    required this.chrome,
    required this.bounds,
    this.onSaved,
  });

  final String accessToken;
  final Map<String, dynamic> campaign;
  final Map<String, String> chrome;
  final Map<String, dynamic> bounds;
  final VoidCallback? onSaved;

  @override
  State<PublisherScheduleEditor> createState() =>
      _PublisherScheduleEditorState();
}

class _PublisherScheduleEditorState extends State<PublisherScheduleEditor> {
  late bool _enabled;
  late final TextEditingController _firstShow;
  late final TextEditingController _interval;
  late final TextEditingController _nonSkip;
  late final TextEditingController _daily;
  late final TextEditingController _weekly;
  late final TextEditingController _monthly;
  late final TextEditingController _yearly;
  bool _busy = false;

  String _c(String key) => chromeMapString(widget.chrome, key);

  String _opt(dynamic v) => v == null ? '' : v.toString();

  @override
  void initState() {
    super.initState();
    final c = widget.campaign;
    _enabled = c['schedule_enabled'] == true;
    _firstShow =
        TextEditingController(text: _opt(c['first_show_after_seconds']));
    _interval = TextEditingController(text: _opt(c['interval_seconds']));
    _nonSkip = TextEditingController(text: _opt(c['non_skippable_seconds']));
    _daily = TextEditingController(text: _opt(c['daily_impression_cap']));
    _weekly = TextEditingController(text: _opt(c['weekly_impression_cap']));
    _monthly = TextEditingController(text: _opt(c['monthly_impression_cap']));
    _yearly = TextEditingController(text: _opt(c['yearly_impression_cap']));
  }

  @override
  void dispose() {
    _firstShow.dispose();
    _interval.dispose();
    _nonSkip.dispose();
    _daily.dispose();
    _weekly.dispose();
    _monthly.dispose();
    _yearly.dispose();
    super.dispose();
  }

  int? _parse(String raw) {
    final t = raw.trim();
    if (t.isEmpty) return null;
    return int.tryParse(t);
  }

  Future<void> _save() async {
    final id = widget.campaign['id']?.toString() ?? '';
    if (id.isEmpty) return;
    setState(() => _busy = true);
    try {
      final res = await http.patch(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/ads/campaigns/$id/schedule'),
        headers: {
          'Authorization': 'Bearer ${widget.accessToken}',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'schedule_enabled': _enabled,
          'first_show_after_seconds': _parse(_firstShow.text),
          'interval_seconds': _parse(_interval.text),
          'non_skippable_seconds': _parse(_nonSkip.text),
          'daily_impression_cap': _parse(_daily.text),
          'weekly_impression_cap': _parse(_weekly.text),
          'monthly_impression_cap': _parse(_monthly.text),
          'yearly_impression_cap': _parse(_yearly.text),
        }),
      );
      if (!mounted) return;
      if (res.statusCode < 300) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_c('toast_schedule_saved'))),
        );
        widget.onSaved?.call();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_c('toast_save_failed'))),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_c('toast_save_failed'))),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _field(String label, TextEditingController ctrl, String placeholder) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: TextField(
        controller: ctrl,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        decoration: InputDecoration(
          labelText: label,
          hintText: placeholder,
          border: const OutlineInputBorder(),
          isDense: true,
        ),
        onChanged: (v) {
          final s = v.replaceAll(RegExp(r'\D'), '');
          if (s != v) {
            ctrl.value = TextEditingValue(
              text: s,
              selection: TextSelection.collapsed(offset: s.length),
            );
          }
        },
      ),
    );
  }

  /// Bounds from `/ads/playback` keep schedule values within platform limits.
  bool get _boundsReady =>
      widget.bounds.containsKey('first_show_min') ||
      widget.bounds.containsKey('interval_min') ||
      widget.bounds.containsKey('impression_cap_min');

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final platformPh = _c('platform_default_placeholder');
    final unlimitedPh = _c('unlimited_cap_placeholder');
    if (!_boundsReady) {
      return const SizedBox.shrink();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Divider(height: 24),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          value: _enabled,
          onChanged: (v) => setState(() => _enabled = v ?? false),
          title: Text(_c('schedule_enabled_label')),
          controlAffinity: ListTileControlAffinity.leading,
        ),
        _field(_c('first_show_label'), _firstShow, platformPh),
        _field(_c('interval_label'), _interval, platformPh),
        _field(_c('non_skippable_label'), _nonSkip, platformPh),
        _field(_c('daily_cap_label'), _daily, unlimitedPh),
        _field(_c('weekly_cap_label'), _weekly, unlimitedPh),
        _field(_c('monthly_cap_label'), _monthly, unlimitedPh),
        _field(_c('yearly_cap_label'), _yearly, unlimitedPh),
        Align(
          alignment: Alignment.centerLeft,
          child: FilledButton(
            onPressed: _busy ? null : _save,
            style: FilledButton.styleFrom(backgroundColor: tokens.gold),
            child: Text(_c('save_campaign_schedule_action')),
          ),
        ),
      ],
    );
  }
}
