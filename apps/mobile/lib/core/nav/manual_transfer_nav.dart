import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/types/platform.dart';
import 'package:http/http.dart' as http;

const _manualTransferRouteKeys = {
  'transfer',
  'ads_transfer',
  'events_transfer',
};

bool isManualTransferNavLink(ClientNavLink link) {
  final key = link.routeKey.trim();
  if (_manualTransferRouteKeys.contains(key)) return true;
  final href = (link.href ?? '').trim().split('?').first;
  return href == '/transfer' ||
      href.startsWith('/transfer/') ||
      href == '/ads/transfer' ||
      href.startsWith('/ads/transfer/') ||
      href == '/events/transfer' ||
      href.startsWith('/events/transfer/');
}

/// Keep Manual Transfer nav only when payment route is manual_transfer (ET geo).
List<ClientNavLink> filterManualTransferNavLinks(
  List<ClientNavLink> links,
  bool isManualTransferRoute,
) {
  if (isManualTransferRoute) return links;
  return links.where((l) => !isManualTransferNavLink(l)).toList();
}

/// GET /payments/route; server resolves payer country from request IP.
Future<bool> fetchIsManualTransferRoute({ApiConfig? config}) async {
  final base = (config ?? ApiConfig.defaults).restUrl;
  try {
    final res = await http.get(Uri.parse('$base/payments/route'));
    if (res.statusCode >= 300) return false;
    final body = jsonDecode(res.body);
    if (body is! Map<String, dynamic>) return false;
    return (body['provider'] ?? '').toString().trim() == 'manual_transfer';
  } catch (_) {
    return false;
  }
}
