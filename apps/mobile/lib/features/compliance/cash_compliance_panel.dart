import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/cash_rmg_chrome.dart';
import 'package:dama_mobile/core/types/feature_flags.dart';
import 'package:dama_mobile/core/ui/chrome_date_field.dart';
import 'package:dama_mobile/core/util/date_mask.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

/// Age gate + phone KYC panel (DB chrome from GET /public/cash-rmg-chrome).
class CashCompliancePanel extends StatefulWidget {
  const CashCompliancePanel({super.key, required this.accessToken});

  final String accessToken;

  @override
  State<CashCompliancePanel> createState() => _CashCompliancePanelState();
}

class _CashCompliancePanelState extends State<CashCompliancePanel> {
  CashRmgPayload? _payload;
  CashEligibility? _eligibility;
  String _unavailable = '';
  bool _loading = true;
  bool _busy = false;

  /// Fail closed: OTP required until flags say otherwise.
  bool _otpRequired = false;
  String? _challengeId;
  bool _ageAttempted = false;
  bool _phoneAttempted = false;
  bool _codeAttempted = false;
  final _dobCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _codeCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _dobCtrl.dispose();
    _phoneCtrl.dispose();
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    CashRmgPayload? payload;
    CashEligibility? eligibility;
    var unavailable = '';
    var otpRequired = false;
    try {
      final chromeFut = http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/public/cash-rmg-chrome'),
      );
      final flagsFut = http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/feature-flags'),
      );
      final eligFut = http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/me/cash-eligibility'),
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      final results = await Future.wait([chromeFut, flagsFut, eligFut]);
      final chromeRes = results[0];
      final flagsRes = results[1];
      final eligRes = results[2];
      if (chromeRes.statusCode == 200) {
        final body = jsonDecode(chromeRes.body);
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
      if (flagsRes.statusCode == 200) {
        final body = jsonDecode(flagsRes.body);
        if (body is Map<String, dynamic>) {
          otpRequired = FeatureFlagsWire.fromJson(body).cashPhoneOtpRequired;
        }
      }
      if (eligRes.statusCode == 200) {
        final body = jsonDecode(eligRes.body);
        if (body is Map<String, dynamic>) {
          eligibility = CashEligibility.fromJson(body);
        }
      }
    } catch (_) {
      payload = null;
    }
    if (mounted) {
      final existingPhone = eligibility?.primaryPhone.trim() ?? '';
      if (existingPhone.isNotEmpty && _phoneCtrl.text.trim().isEmpty) {
        _phoneCtrl.text = existingPhone;
      }
      setState(() {
        _payload = payload;
        _eligibility = eligibility;
        _unavailable = unavailable;
        _otpRequired = otpRequired;
        _loading = false;
      });
    }
  }

  Future<Map<String, dynamic>?> _authJson(
    String path, {
    required String method,
    Object? body,
    required String failMessage,
  }) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/api/v1$path');
    final headers = {
      'Authorization': 'Bearer ${widget.accessToken}',
      'Content-Type': 'application/json',
    };
    final encoded = body == null ? null : jsonEncode(body);
    late http.Response resp;
    switch (method) {
      case 'PUT':
        resp = await http.put(uri, headers: headers, body: encoded);
        break;
      case 'POST':
        resp = await http.post(uri, headers: headers, body: encoded);
        break;
      default:
        resp = await http.get(uri, headers: headers);
    }
    Map<String, dynamic>? json;
    try {
      final decoded = jsonDecode(resp.body);
      if (decoded is Map<String, dynamic>) json = decoded;
    } catch (_) {}
    if (resp.statusCode >= 300) {
      // Chrome-only failMessage - never throw raw API JSON / error bodies into UI.
      throw Exception(failMessage);
    }
    return json;
  }

  Future<void> _refreshEligibility() async {
    try {
      final resp = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/me/cash-eligibility'),
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      if (resp.statusCode == 200) {
        final body = jsonDecode(resp.body);
        if (body is Map<String, dynamic> && mounted) {
          setState(() {
            _eligibility = CashEligibility.fromJson(body);
          });
        }
      }
    } catch (_) {}
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
    final ageVerified = _eligibility?.ageVerified == true;
    final phoneVerified = _eligibility?.phoneKycVerified == true;
    final verifiedDob = _eligibility?.dateOfBirth.trim() ?? '';
    final verifiedPhone = _eligibility?.primaryPhone.trim() ?? '';
    final saveLabel = chrome.phoneKycSaveAction.trim().isNotEmpty
        ? chrome.phoneKycSaveAction
        : chrome.phoneKycStartOtpAction;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              chrome.ageGateTitle,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
            ),
            const SizedBox(height: 4),
            if (ageVerified) ...[
              Text(
                chrome.ageGateSuccess,
                style: TextStyle(color: tokens.onSurfaceMuted),
              ),
              if (verifiedDob.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(verifiedDob),
              ],
            ] else ...[
              Text(chrome.ageGateBlurb,
                  style: TextStyle(color: tokens.onSurfaceMuted)),
              const SizedBox(height: 12),
              ChromeDateField(
                label: chrome.ageGateDobLabel,
                valueText: _dobCtrl.text,
                hintText: chrome.ageGateDobPlaceholder.isNotEmpty
                    ? chrome.ageGateDobPlaceholder
                    : chrome.ageGateDobLabel,
                enabled: !_busy,
                errorText: _ageAttempted && _dobCtrl.text.trim().isEmpty
                    ? (chrome.ageRequiredError.trim().isNotEmpty
                        ? chrome.ageRequiredError
                        : chrome.ageGateFailed)
                    : null,
                firstDate: DateTime(DateTime.now().year - 120),
                lastDate: DateTime.now(),
                initialDate: parseFlexibleDate(_dobCtrl.text) ??
                    DateTime(DateTime.now().year - 21, DateTime.now().month,
                        DateTime.now().day),
                onPicked: (picked) {
                  setState(() {
                    _dobCtrl.text = formatUsDate(picked);
                    _ageAttempted = false;
                  });
                },
              ),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: _busy
                    ? null
                    : () async {
                        setState(() => _ageAttempted = true);
                        if (_dobCtrl.text.trim().isEmpty) {
                          final msg = chrome.ageRequiredError.trim().isNotEmpty
                              ? chrome.ageRequiredError
                              : chrome.ageGateFailed;
                          if (msg.trim().isNotEmpty && context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(msg)),
                            );
                          }
                          return;
                        }
                        setState(() => _busy = true);
                        try {
                          await _authJson(
                            '/geo/locate',
                            method: 'POST',
                            body: {},
                            failMessage: chrome.locateRequiredError,
                          );
                          await _authJson(
                            '/me/age-gate',
                            method: 'PUT',
                            body: {
                              'date_of_birth': () {
                                final d = parseFlexibleDate(_dobCtrl.text);
                                return d != null
                                    ? toIsoDate(d)
                                    : _dobCtrl.text.trim();
                              }(),
                            },
                            failMessage: chrome.ageGateFailed,
                          );
                          await _refreshEligibility();
                          if (!context.mounted) return;
                          setState(() => _ageAttempted = false);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(chrome.ageGateSuccess)),
                          );
                        } catch (_) {
                          if (!context.mounted) return;
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(chrome.ageGateFailed)),
                          );
                        } finally {
                          if (mounted) setState(() => _busy = false);
                        }
                      },
                child: Text(chrome.ageGateSubmitAction),
              ),
            ],
            const Divider(height: 32),
            Text(
              chrome.phoneKycTitle,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
            ),
            const SizedBox(height: 4),
            if (phoneVerified) ...[
              Text(
                chrome.phoneKycSuccess,
                style: TextStyle(color: tokens.onSurfaceMuted),
              ),
              if (verifiedPhone.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(verifiedPhone),
              ],
            ] else ...[
              Text(chrome.phoneKycBlurb,
                  style: TextStyle(color: tokens.onSurfaceMuted)),
              const SizedBox(height: 12),
              TextField(
                controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  labelText: chrome.phoneKycPhoneLabel,
                  border: const OutlineInputBorder(),
                  errorText:
                      _phoneAttempted && _phoneCtrl.text.trim().length < 8
                          ? (chrome.phoneKycRequiredError.trim().isNotEmpty
                              ? chrome.phoneKycRequiredError
                              : chrome.phoneKycFailed)
                          : null,
                ),
                onChanged: (_) {
                  if (_phoneAttempted && _phoneCtrl.text.trim().length >= 8) {
                    setState(() => _phoneAttempted = false);
                  } else {
                    setState(() {});
                  }
                },
              ),
              const SizedBox(height: 8),
              Builder(
                builder: (context) {
                  final onPressed = _busy
                      ? null
                      : () async {
                          setState(() => _phoneAttempted = true);
                          if (_phoneCtrl.text.trim().length < 8) {
                            final msg =
                                chrome.phoneKycRequiredError.trim().isNotEmpty
                                    ? chrome.phoneKycRequiredError
                                    : chrome.phoneKycFailed;
                            if (msg.trim().isNotEmpty && context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(msg)),
                              );
                            }
                            return;
                          }
                          setState(() => _busy = true);
                          try {
                            final saved = await _authJson(
                              '/me/phone-kyc',
                              method: 'PUT',
                              body: {'phone': _phoneCtrl.text.trim()},
                              failMessage: chrome.phoneKycFailed,
                            );
                            if (saved?['status']?.toString() == 'verified' ||
                                !_otpRequired) {
                              if (!context.mounted) return;
                              if (saved?['status']?.toString() == 'verified') {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                      content: Text(chrome.phoneKycSuccess)),
                                );
                                setState(() {
                                  _challengeId = null;
                                  _codeCtrl.clear();
                                  _phoneAttempted = false;
                                });
                                await _refreshEligibility();
                              } else {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                      content: Text(chrome.phoneKycFailed)),
                                );
                              }
                              return;
                            }
                            final started = await _authJson(
                              '/me/phone-kyc/otp/start',
                              method: 'POST',
                              body: {},
                              failMessage: chrome.phoneKycFailed,
                            );
                            if (!mounted) return;
                            setState(() {
                              _challengeId =
                                  started?['challenge_id']?.toString();
                            });
                          } catch (_) {
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(chrome.phoneKycFailed)),
                            );
                          } finally {
                            if (mounted) setState(() => _busy = false);
                          }
                        };
                  final label = Text(
                    _otpRequired ? chrome.phoneKycStartOtpAction : saveLabel,
                  );
                  return _otpRequired
                      ? OutlinedButton(onPressed: onPressed, child: label)
                      : FilledButton(onPressed: onPressed, child: label);
                },
              ),
              if (_challengeId != null) ...[
                const SizedBox(height: 8),
                TextField(
                  controller: _codeCtrl,
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(8),
                  ],
                  decoration: InputDecoration(
                    labelText: chrome.phoneKycCodeLabel,
                    border: const OutlineInputBorder(),
                    errorText: _codeAttempted && _codeCtrl.text.trim().isEmpty
                        ? chrome.phoneKycFailed
                        : null,
                  ),
                  onChanged: (v) {
                    final s = v.replaceAll(RegExp(r'\D'), '');
                    if (s != v) {
                      _codeCtrl.value = TextEditingValue(
                        text: s,
                        selection: TextSelection.collapsed(offset: s.length),
                      );
                    }
                    if (_codeAttempted && s.isNotEmpty) {
                      setState(() => _codeAttempted = false);
                    } else {
                      setState(() {});
                    }
                  },
                ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: _busy
                      ? null
                      : () async {
                          setState(() => _codeAttempted = true);
                          if (_codeCtrl.text.trim().isEmpty) {
                            if (chrome.phoneKycFailed.trim().isNotEmpty &&
                                context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(chrome.phoneKycFailed)),
                              );
                            }
                            return;
                          }
                          setState(() => _busy = true);
                          try {
                            await _authJson(
                              '/me/phone-kyc/otp/verify',
                              method: 'POST',
                              body: {
                                'challenge_id': _challengeId,
                                'code': _codeCtrl.text.trim(),
                              },
                              failMessage: chrome.phoneKycFailed,
                            );
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(chrome.phoneKycSuccess)),
                            );
                            setState(() {
                              _challengeId = null;
                              _codeCtrl.clear();
                              _codeAttempted = false;
                            });
                            await _refreshEligibility();
                          } catch (_) {
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(chrome.phoneKycFailed)),
                            );
                          } finally {
                            if (mounted) setState(() => _busy = false);
                          }
                        },
                  child: Text(chrome.phoneKycVerifyAction),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}
