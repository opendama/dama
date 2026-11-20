import 'dart:convert';

import 'package:http/http.dart' as http;

/// Client Nominatim reverse - mirrors smart-menu `reverseGeocodeWithGeoapify`
/// (zoom 18 → 16). English labels only. region = city, city = subCity.
class NominatimReverseResult {
  const NominatimReverseResult({
    required this.countryCode,
    required this.region,
    required this.city,
    this.countryName = '',
  });

  final String countryCode;
  final String countryName;
  final String region;
  final String city;
}

String _firstNonEmpty(List<String?> vals) {
  for (final v in vals) {
    final s = (v ?? '').trim();
    if (s.isNotEmpty) return s;
  }
  return '';
}

({String city, String subCity}) _cityAndSubCity(Map<String, dynamic> address) {
  final city = _firstNonEmpty([
    address['state_district']?.toString(),
    address['city']?.toString(),
    address['town']?.toString(),
    address['municipality']?.toString(),
    address['state']?.toString(),
    address['region']?.toString(),
    address['village']?.toString(),
  ]);
  final subOpts = [
    address['neighbourhood']?.toString(),
    address['suburb']?.toString(),
    address['quarter']?.toString(),
    address['ward']?.toString(),
    address['city_district']?.toString(),
    address['district']?.toString(),
    address['county']?.toString(),
    address['hamlet']?.toString(),
    address['village']?.toString(),
  ];
  var subCity = '';
  for (final opt in subOpts) {
    final s = (opt ?? '').trim();
    if (s.isNotEmpty && s.toLowerCase() != city.toLowerCase()) {
      subCity = s;
      break;
    }
  }
  return (city: city, subCity: subCity);
}

Future<NominatimReverseResult?> _nominatimOnce(
  double lat,
  double lng,
  int zoom,
) async {
  final uri = Uri.https('nominatim.openstreetmap.org', '/reverse', {
    'format': 'json',
    'lat': '$lat',
    'lon': '$lng',
    'zoom': '$zoom',
    'addressdetails': '1',
    'extratags': '1',
    'namedetails': '1',
    'accept-language': 'en',
  });
  final res = await http.get(
    uri,
    headers: {
      'Accept': 'application/json',
      'Accept-Language': 'en',
      'User-Agent': 'dama-mobile/1 (map-pin-reverse)',
    },
  ).timeout(const Duration(seconds: 4));
  if (res.statusCode < 200 || res.statusCode >= 300) return null;
  final body = jsonDecode(res.body);
  if (body is! Map<String, dynamic>) return null;
  final address = body['address'];
  if (address is! Map<String, dynamic>) return null;
  final cc = (address['country_code'] ?? '').toString().trim().toUpperCase();
  if (cc.length != 2) return null;
  final parsed = _cityAndSubCity(address);
  if (parsed.city.isEmpty) return null;
  return NominatimReverseResult(
    countryCode: cc,
    countryName: (address['country'] ?? '').toString().trim(),
    region: parsed.city,
    city: parsed.subCity,
  );
}

Future<NominatimReverseResult?> reverseGeocodeNominatim(
  double lat,
  double lng,
) async {
  try {
    final primary = await _nominatimOnce(lat, lng, 18);
    if (primary != null) return primary;
    await Future<void>.delayed(const Duration(milliseconds: 100));
    return await _nominatimOnce(lat, lng, 16);
  } catch (_) {
    return null;
  }
}
