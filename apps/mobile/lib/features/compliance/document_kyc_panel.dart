import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/cash_rmg_chrome.dart';
import 'package:dama_mobile/core/types/media_upload_chrome.dart';
import 'package:dama_mobile/core/ui/chrome_select_sheet.dart';
import 'package:dama_mobile/core/ui/media_dropzone.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';

/// Government-ID document KYC for payouts (type + legal name + photo uploads).
class DocumentKycPanel extends StatefulWidget {
  const DocumentKycPanel({
    super.key,
    required this.accessToken,
    this.onApprovedChange,
  });

  final String accessToken;
  final ValueChanged<bool>? onApprovedChange;

  @override
  State<DocumentKycPanel> createState() => _DocumentKycPanelState();
}

class _DocumentKycPanelState extends State<DocumentKycPanel> {
  CashRmgPayload? _payload;
  MediaUploadChrome? _mediaChrome;
  String _unavailable = '';
  bool _loading = true;

  /// Which form action is in flight - only that button shows loading.
  String _busyAction = ''; // '', 'draft', 'submit'
  String _uploadingSlot = '';

  /// After attempt: `draft` = name/type only; `submit` = + required media.
  String _errorMode = ''; // '', 'draft', 'submit'
  bool get _busy => _busyAction.isNotEmpty || _uploadingSlot.isNotEmpty;
  String _docType = 'national_id';
  String _front = '';
  String _back = '';
  String _selfie = '';
  String? _submissionId;
  String? _status;
  String? _reviewNote;
  bool _serverApproved = false;
  final _nameCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    CashRmgPayload? payload;
    MediaUploadChrome? mediaChrome;
    var unavailable = '';
    try {
      final results = await Future.wait([
        http.get(
            Uri.parse('${ApiConfig.baseUrl}/api/v1/public/cash-rmg-chrome')),
        http.get(
          Uri.parse('${ApiConfig.baseUrl}/api/v1/public/media-upload-chrome'),
        ),
      ]);
      final cashRes = results[0];
      final mediaRes = results[1];
      if (cashRes.statusCode == 200) {
        final body = jsonDecode(cashRes.body);
        if (body is Map<String, dynamic>) {
          payload = CashRmgPayload.fromJson(body);
          if (payload == null) {
            final chromeMap = body['chrome'];
            if (chromeMap is Map<String, dynamic>) {
              unavailable =
                  (chromeMap['cash_rmg_unavailable'] as String?)?.trim() ?? '';
            }
          }
        }
      }
      if (mediaRes.statusCode == 200) {
        final body = jsonDecode(mediaRes.body);
        if (body is Map<String, dynamic>) {
          mediaChrome = MediaUploadChrome.fromJson(body);
          if (mediaChrome == null) {
            unavailable = (body['media_upload_unavailable'] as String?)
                        ?.trim()
                        .isNotEmpty ==
                    true
                ? (body['media_upload_unavailable'] as String).trim()
                : unavailable;
          }
        }
      }
    } catch (_) {
      payload = null;
      mediaChrome = null;
    }
    if (!mounted) return;
    setState(() {
      _payload = payload;
      _mediaChrome = mediaChrome;
      _unavailable = unavailable;
      _loading = false;
      if (payload != null && payload.policy.documentKycTypes.isNotEmpty) {
        _docType = payload.policy.documentKycTypes.first;
      }
    });
    if (payload != null) {
      await _loadMine();
    }
  }

  Future<void> _loadMine() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/kyc/documents/me'),
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      if (res.statusCode != 200) return;
      final body = jsonDecode(res.body);
      if (body is! Map<String, dynamic>) return;
      final approved = body['approved'] == true;
      widget.onApprovedChange?.call(approved);
      final sub = body['submission'];
      if (sub is! Map<String, dynamic>) {
        if (!mounted) return;
        setState(() => _serverApproved = approved);
        return;
      }
      if (!mounted) return;
      setState(() {
        _serverApproved = approved;
        _submissionId = sub['id']?.toString();
        _docType = (sub['document_type']?.toString() ?? _docType).trim();
        _nameCtrl.text = (sub['legal_name']?.toString() ?? '').trim();
        _front = (sub['id_front_url']?.toString() ?? '').trim();
        _back = (sub['id_back_url']?.toString() ?? '').trim();
        _selfie = (sub['selfie_url']?.toString() ?? '').trim();
        _status = (sub['status']?.toString() ?? '').trim();
        _reviewNote = (sub['review_note']?.toString() ?? '').trim();
      });
    } catch (_) {}
  }

  Future<String> _upload(XFile file) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/api/v1/kyc/documents/upload');
    final req = http.MultipartRequest('POST', uri);
    req.headers['Authorization'] = 'Bearer ${widget.accessToken}';
    final bytes = await file.readAsBytes();
    final name = file.name.isNotEmpty ? file.name : 'kyc.jpg';
    req.files.add(
      http.MultipartFile.fromBytes(
        'file',
        bytes,
        filename: name,
        contentType: MediaType('image', 'jpeg'),
      ),
    );
    final streamed = await req.send();
    final resp = await http.Response.fromStream(streamed);
    Map<String, dynamic>? json;
    try {
      final decoded = jsonDecode(resp.body);
      if (decoded is Map<String, dynamic>) json = decoded;
    } catch (_) {}
    final url = (json?['url']?.toString() ?? '').trim();
    if (resp.statusCode >= 300 || url.isEmpty) {
      // Chrome-only - never surface raw API JSON / error bodies to UI.
      throw Exception(_payload?.chrome.docKycFailed ?? '');
    }
    return url;
  }

  Future<void> _onPickedSlot(String slot, XFile file) async {
    setState(() => _uploadingSlot = slot);
    try {
      final url = await _upload(file);
      if (!mounted) return;
      setState(() {
        // Keep errorMode sticky until successful save/submit so remaining
        // empty required slots stay highlighted.
        switch (slot) {
          case 'front':
            _front = url;
            break;
          case 'back':
            _back = url;
            break;
          case 'selfie':
            _selfie = url;
            break;
        }
      });
    } catch (_) {
      if (!mounted) return;
      final fail = (_payload?.chrome.docKycFailed ?? '').trim();
      if (fail.isNotEmpty) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(fail)));
      }
    } finally {
      if (mounted) setState(() => _uploadingSlot = '');
    }
  }

  bool _isIncompleteApiError(String errBody, CashRmgChrome chrome) {
    final body = errBody.trim();
    if (body.isEmpty) return false;
    final incomplete = chrome.docKycIncompleteError.trim();
    if (incomplete.isNotEmpty && body == incomplete) return true;
    final lower = body.toLowerCase();
    return lower == 'complete identity documents before submitting' ||
        lower == 'complete all required identity fields before submitting.' ||
        lower.contains('complete all required identity') ||
        lower.contains('complete identity documents');
  }

  Future<String?> _persistDraft() async {
    final chrome = _payload?.chrome;
    if (chrome == null) return null;
    final res = await http.put(
      Uri.parse('${ApiConfig.baseUrl}/api/v1/kyc/documents/draft'),
      headers: {
        'Authorization': 'Bearer ${widget.accessToken}',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'document_type': _docType,
        'legal_name': _nameCtrl.text.trim(),
        'id_front_url': _front,
        'id_back_url': _back,
        'selfie_url': _selfie,
      }),
    );
    final body = jsonDecode(res.body);
    final map = body is Map<String, dynamic> ? body : <String, dynamic>{};
    if (res.statusCode >= 300) {
      final err = (map['error']?.toString() ?? '').trim();
      if (_isIncompleteApiError(err, chrome)) {
        throw _IncompleteKyc();
      }
      throw Exception(chrome.docKycFailed);
    }
    final sub = map['submission'];
    if (sub is Map<String, dynamic> && mounted) {
      setState(() {
        _submissionId = sub['id']?.toString();
        _status = sub['status']?.toString();
      });
    }
    return (sub is Map<String, dynamic> ? sub['id']?.toString() : null)
            ?.trim() ??
        (_submissionId ?? '');
  }

  void _toastIncomplete(CashRmgChrome chrome, {required String mode}) {
    setState(() => _errorMode = mode);
    final msg = chrome.docKycIncompleteError.trim().isNotEmpty
        ? chrome.docKycIncompleteError
        : chrome.docKycFailed;
    if (msg.trim().isEmpty || !mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _saveDraft() async {
    final chrome = _payload?.chrome;
    if (chrome == null) return;
    final missingLegal = _nameCtrl.text.trim().isEmpty;
    final missingType = _docType.trim().isEmpty;
    if (missingLegal || missingType) {
      _toastIncomplete(chrome, mode: 'draft');
      return;
    }
    setState(() => _busyAction = 'draft');
    try {
      await _persistDraft();
      if (!mounted) return;
      setState(() => _errorMode = '');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(chrome.docKycSuccess)),
      );
    } on _IncompleteKyc {
      if (!mounted) return;
      _toastIncomplete(chrome, mode: 'draft');
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(chrome.docKycFailed)),
      );
    } finally {
      if (mounted) setState(() => _busyAction = '');
    }
  }

  Future<void> _submit() async {
    final chrome = _payload?.chrome;
    final policy = _payload?.policy;
    if (chrome == null || policy == null) return;
    final needsBack = _docType != policy.documentKycPassportType;
    final missingLegal = _nameCtrl.text.trim().isEmpty;
    final missingFront = _front.trim().isEmpty;
    final missingBack = needsBack && _back.trim().isEmpty;
    final missingSelfie = _selfie.trim().isEmpty;
    if (missingLegal || missingFront || missingBack || missingSelfie) {
      _toastIncomplete(chrome, mode: 'submit');
      return;
    }
    setState(() => _busyAction = 'submit');
    try {
      final id = await _persistDraft();
      if (id == null || id.isEmpty) {
        if (!mounted) return;
        _toastIncomplete(chrome, mode: 'submit');
        return;
      }
      final res = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/kyc/documents/submit'),
        headers: {
          'Authorization': 'Bearer ${widget.accessToken}',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'id': id}),
      );
      final body = jsonDecode(res.body);
      final map = body is Map<String, dynamic> ? body : <String, dynamic>{};
      if (res.statusCode >= 300) {
        if (!mounted) return;
        final err = (map['error']?.toString() ?? '').trim();
        if (_isIncompleteApiError(err, chrome)) {
          _toastIncomplete(chrome, mode: 'submit');
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(chrome.docKycFailed)),
          );
        }
        return;
      }
      final sub = map['submission'];
      if (sub is Map<String, dynamic> && mounted) {
        setState(() {
          _submissionId = sub['id']?.toString();
          _status = sub['status']?.toString();
          _reviewNote = (sub['review_note']?.toString() ?? '').trim();
          _errorMode = '';
        });
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(chrome.docKycSuccess)),
      );
    } on _IncompleteKyc {
      if (!mounted) return;
      _toastIncomplete(chrome, mode: 'submit');
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(chrome.docKycFailed)),
      );
    } finally {
      if (mounted) setState(() => _busyAction = '');
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    if (_loading) {
      return const LinearProgressIndicator(minHeight: 2);
    }
    final payload = _payload;
    if (payload == null) {
      if (_unavailable.isNotEmpty) {
        return Text(
          _unavailable,
          style: TextStyle(color: tokens.danger),
        );
      }
      return const SizedBox.shrink();
    }
    final chrome = payload.chrome;
    final policy = payload.policy;
    final locked = _status == policy.documentKycPendingStatus ||
        (_status == policy.documentKycApprovedStatus && _serverApproved);
    final needsBack = _docType != policy.documentKycPassportType;
    final showDraftErrors = _errorMode == 'draft' || _errorMode == 'submit';
    final showSubmitErrors = _errorMode == 'submit';
    final incompleteMsg = chrome.docKycIncompleteError.trim().isNotEmpty
        ? chrome.docKycIncompleteError
        : chrome.docKycFailed;
    String? statusLabel;
    if (_status == policy.documentKycApprovedStatus) {
      statusLabel = chrome.docKycApprovedLabel;
    } else if (_status == policy.documentKycPendingStatus) {
      statusLabel = chrome.docKycPendingLabel;
    } else if (_status == policy.documentKycRejectedStatus) {
      statusLabel = chrome.docKycRejectedLabel;
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              chrome.docKycTitle,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
            ),
            const SizedBox(height: 4),
            Text(chrome.docKycBlurb,
                style: TextStyle(color: tokens.onSurfaceMuted)),
            if (statusLabel != null) ...[
              const SizedBox(height: 8),
              Text(
                (_reviewNote != null && _reviewNote!.isNotEmpty)
                    ? '$statusLabel - $_reviewNote'
                    : statusLabel,
                style: const TextStyle(fontWeight: FontWeight.w500),
              ),
            ],
            const SizedBox(height: 12),
            ChromeSelectField(
              label: chrome.docKycTypeLabel,
              valueLabel: chrome.typeLabel(
                policy.documentKycTypes.contains(_docType)
                    ? _docType
                    : policy.documentKycTypes.first,
              ),
              enabled: !locked && !_busy,
              onTap: () async {
                final picked = await showChromeOptionSheet<String>(
                  context: context,
                  title: chrome.docKycTypeLabel,
                  selected: policy.documentKycTypes.contains(_docType)
                      ? _docType
                      : policy.documentKycTypes.first,
                  options: policy.documentKycTypes
                      .map(
                        (t) => ChromeSelectOption(
                          value: t,
                          label: chrome.typeLabel(t),
                        ),
                      )
                      .toList(),
                );
                if (picked == null || !mounted) return;
                setState(() => _docType = picked);
              },
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _nameCtrl,
              enabled: !locked && !_busy,
              decoration: InputDecoration(
                labelText: chrome.docKycLegalNameLabel,
                border: const OutlineInputBorder(),
                errorText: showDraftErrors && _nameCtrl.text.trim().isEmpty
                    ? incompleteMsg
                    : null,
              ),
            ),
            const SizedBox(height: 12),
            if (_mediaChrome != null) ...[
              MediaDropzone(
                label: chrome.docKycFrontLabel,
                chrome: _mediaChrome!,
                previewUrl: _front,
                busy: _uploadingSlot == 'front',
                invalid: showSubmitErrors && _front.trim().isEmpty,
                errorText: showSubmitErrors && _front.trim().isEmpty
                    ? incompleteMsg
                    : null,
                enabled: !locked &&
                    (_uploadingSlot == 'front' ||
                        (_uploadingSlot.isEmpty && !_busy)),
                preferFrontCamera: false,
                onClear:
                    locked || _busy ? null : () => setState(() => _front = ''),
                onPicked: (file) => _onPickedSlot('front', file),
              ),
              if (needsBack) ...[
                const SizedBox(height: 12),
                MediaDropzone(
                  label: chrome.docKycBackLabel,
                  chrome: _mediaChrome!,
                  previewUrl: _back,
                  busy: _uploadingSlot == 'back',
                  invalid: showSubmitErrors && _back.trim().isEmpty,
                  errorText: showSubmitErrors && _back.trim().isEmpty
                      ? incompleteMsg
                      : null,
                  enabled: !locked &&
                      (_uploadingSlot == 'back' ||
                          (_uploadingSlot.isEmpty && !_busy)),
                  onClear:
                      locked || _busy ? null : () => setState(() => _back = ''),
                  onPicked: (file) => _onPickedSlot('back', file),
                ),
              ],
              const SizedBox(height: 12),
              MediaDropzone(
                label: chrome.docKycSelfieLabel,
                chrome: _mediaChrome!,
                previewUrl: _selfie,
                busy: _uploadingSlot == 'selfie',
                invalid: showSubmitErrors && _selfie.trim().isEmpty,
                errorText: showSubmitErrors && _selfie.trim().isEmpty
                    ? incompleteMsg
                    : null,
                enabled: !locked &&
                    (_uploadingSlot == 'selfie' ||
                        (_uploadingSlot.isEmpty && !_busy)),
                preferFrontCamera: true,
                onClear:
                    locked || _busy ? null : () => setState(() => _selfie = ''),
                onPicked: (file) => _onPickedSlot('selfie', file),
              ),
            ] else if ((_mediaChrome == null) && !_loading) ...[
              Text(
                _unavailable.isNotEmpty ? _unavailable : chrome.docKycFailed,
                style: TextStyle(color: tokens.danger),
              ),
            ],
            if (!locked) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed:
                          _busy && _busyAction != 'draft' ? null : _saveDraft,
                      child: _busyAction == 'draft'
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(chrome.docKycSaveDraftAction),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton(
                      onPressed:
                          _busy && _busyAction != 'submit' ? null : _submit,
                      child: _busyAction == 'submit'
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(chrome.docKycSubmitAction),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _IncompleteKyc implements Exception {}
