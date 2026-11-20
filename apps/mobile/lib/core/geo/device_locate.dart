import 'dart:convert';

import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;

/// Device GPS (when permitted) + POST /geo/locate body.
/// Matches web `usePlayerGeoQuery` / smart-menu BranchLocationPinField device path.
class DeviceLocateResult {
  const DeviceLocateResult({
    required this.countryCode,
    this.region,
    this.city,
    this.latitude,
    this.longitude,
  });

  final String countryCode;
  final String? region;
  final String? city;
  final double? latitude;
  final double? longitude;
}

Future<(double?, double?)> readDeviceCoordinates() async {
  try {
    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) return (null, null);
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission != LocationPermission.whileInUse &&
        permission != LocationPermission.always) {
      return (null, null);
    }
    final pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 8),
      ),
    );
    return (pos.latitude, pos.longitude);
  } catch (_) {
    return (null, null);
  }
}

/// POST /geo/locate with optional GPS. Never invents country.
Future<DeviceLocateResult?> postGeoLocate({
  required String locateUrl,
  Map<String, String>? headers,
  double? latitude,
  double? longitude,
}) async {
  final body = <String, dynamic>{};
  if (latitude != null && longitude != null) {
    body['latitude'] = latitude;
    body['longitude'] = longitude;
  }
  final res = await http.post(
    Uri.parse(locateUrl),
    headers: {
      'Content-Type': 'application/json',
      ...?headers,
    },
    body: jsonEncode(body),
  );
  if (res.statusCode >= 300) return null;
  final decoded = jsonDecode(res.body);
  if (decoded is! Map<String, dynamic>) return null;
  final loc = decoded['location'];
  if (loc is! Map<String, dynamic>) return null;
  final cc = (loc['country_code'] ?? '').toString().trim().toUpperCase();
  if (cc.isEmpty) return null;
  final region = (loc['region'] ?? '').toString().trim();
  final city = (loc['city'] ?? '').toString().trim();
  return DeviceLocateResult(
    countryCode: cc,
    region: region.isEmpty ? null : region,
    city: city.isEmpty ? null : city,
    latitude: latitude,
    longitude: longitude,
  );
}

/// Read device GPS then locate (web player-geo parity).
Future<DeviceLocateResult?> locateWithDeviceGps({
  required String locateUrl,
  Map<String, String>? headers,
}) async {
  final (lat, lng) = await readDeviceCoordinates();
  return postGeoLocate(
    locateUrl: locateUrl,
    headers: headers,
    latitude: lat,
    longitude: lng,
  );
}
