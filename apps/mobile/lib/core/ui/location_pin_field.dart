import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

/// Flutter equivalent of smart-menu `BranchLocationPinField` + Leaflet OSM map.
/// Zoom after pick = 10 (Smart Menu Leaflet fitBounds maxZoom 10, not OpenLayers 12).
class LocationPinField extends StatefulWidget {
  const LocationPinField({
    super.key,
    required this.latitude,
    required this.longitude,
    required this.onPinChange,
    required this.sectionTitle,
    required this.mapPinEmpty,
    required this.mapPinRequiredHint,
    required this.useDeviceLocation,
    required this.clearPin,
    required this.helperText,
    required this.geolocationUnavailable,
    required this.geolocationFailed,
    required this.pinCoordsFmt,
    this.onPinClear,
    this.pinTitle = '',
    this.required = false,
    this.error,
    this.height = 240,
    this.resolving = false,
  });

  final double? latitude;
  final double? longitude;
  final void Function(double latitude, double longitude) onPinChange;
  final VoidCallback? onPinClear;
  final String sectionTitle;
  final String mapPinEmpty;

  /// Shown when [required] and no pin (web `mapPinRequiredHint` / `map_pin_required`).
  final String mapPinRequiredHint;
  final String useDeviceLocation;
  final String clearPin;
  final String helperText;
  final String geolocationUnavailable;
  final String geolocationFailed;
  final String pinCoordsFmt;
  final String pinTitle;
  final bool required;
  final String? error;
  final double height;

  /// True while parent runs `/geo/locate` + Nominatim (web create pin spinner path).
  final bool resolving;

  @override
  State<LocationPinField> createState() => _LocationPinFieldState();
}

class _LocationPinFieldState extends State<LocationPinField>
    with SingleTickerProviderStateMixin {
  final _mapController = MapController();
  late final AnimationController _pulse;

  /// Smart Menu Leaflet pin: fitBounds maxZoom 10.
  static const double _pinZoom = 10;

  bool get _hasPin => widget.latitude != null && widget.longitude != null;

  LatLng get _center {
    if (_hasPin) {
      return LatLng(widget.latitude!, widget.longitude!);
    }
    return const LatLng(0, 0);
  }

  String get _coordsLabel {
    if (!_hasPin) {
      if (widget.required) {
        final hint = widget.mapPinRequiredHint.trim();
        if (hint.isNotEmpty) return hint;
      }
      return widget.mapPinEmpty;
    }
    final fmt = widget.pinCoordsFmt.trim();
    if (fmt.isEmpty) return '';
    return fmt
        .replaceAll('{lat}', widget.latitude!.toStringAsFixed(6))
        .replaceAll('{lng}', widget.longitude!.toStringAsFixed(6));
  }

  void _syncPulse() {
    if (_hasPin) {
      _pulse.stop();
      _pulse.value = 1;
    } else if (!_pulse.isAnimating) {
      _pulse.repeat(reverse: true);
    }
  }

  void _moveToPin() {
    if (_hasPin) {
      _mapController.move(
          LatLng(widget.latitude!, widget.longitude!), _pinZoom);
    } else {
      _mapController.move(const LatLng(0, 0), 2);
    }
  }

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _syncPulse();
  }

  @override
  void didUpdateWidget(LocationPinField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.latitude != oldWidget.latitude ||
        widget.longitude != oldWidget.longitude) {
      _moveToPin();
      _syncPulse();
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    _mapController.dispose();
    super.dispose();
  }

  Future<void> _useDeviceLocation() async {
    final messenger = ScaffoldMessenger.maybeOf(context);
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      final msg = widget.geolocationUnavailable.trim();
      if (msg.isNotEmpty) {
        messenger?.showSnackBar(SnackBar(content: Text(msg)));
      }
      return;
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      final msg = widget.geolocationFailed.trim();
      if (msg.isNotEmpty) {
        messenger?.showSnackBar(SnackBar(content: Text(msg)));
      }
      return;
    }
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 12),
        ),
      );
      widget.onPinChange(pos.latitude, pos.longitude);
      _mapController.move(LatLng(pos.latitude, pos.longitude), _pinZoom);
    } catch (_) {
      final msg = widget.geolocationFailed.trim();
      if (msg.isNotEmpty) {
        messenger?.showSnackBar(SnackBar(content: Text(msg)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // Smart Menu / web Leaflet chrome (not theme-only - visual parity).
    const mapBorder = Color(0xFFD0D7DE);
    const mapBg = Color(0xFFEEF2F7);
    final markers = <Marker>[];
    if (_hasPin) {
      markers.add(
        Marker(
          point: LatLng(widget.latitude!, widget.longitude!),
          width: 40,
          height: 40,
          // Tip of Icons.location_on sits on the lat/lng (same idea as Leaflet iconAnchor).
          alignment: Alignment.bottomCenter,
          child: Tooltip(
            message: widget.pinTitle,
            child: const Icon(
              Icons.location_on,
              // Same blue as web Leaflet SVG pin - Material icon (no image asset).
              color: Color(0xFF2A81CB),
              size: 40,
              shadows: [
                Shadow(
                    color: Color(0x59000000),
                    blurRadius: 3,
                    offset: Offset(0, 1)),
              ],
            ),
          ),
        ),
      );
    }

    final locateIcon = Icon(
      Icons.my_location,
      size: 16,
      color: theme.colorScheme.tertiary,
    );

    final listingsLabel = '${_hasPin ? 1 : 0} listings';

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        // Smart Menu BranchLocationPinField: bg-black/5 + border.
        color: theme.brightness == Brightness.dark
            ? Colors.white.withValues(alpha: 0.05)
            : Colors.black.withValues(alpha: 0.05),
        border: Border.all(color: theme.dividerColor),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(
                      TextSpan(
                        text: widget.sectionTitle,
                        style: theme.textTheme.labelLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                        children: [
                          if (widget.required)
                            TextSpan(
                              text: ' *',
                              style: TextStyle(color: theme.colorScheme.error),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _coordsLabel,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.hintColor,
                      ),
                    ),
                  ],
                ),
              ),
              if (_hasPin && widget.onPinClear != null)
                TextButton.icon(
                  onPressed: widget.resolving ? null : widget.onPinClear,
                  icon: const Icon(Icons.restart_alt, size: 16),
                  label: Text(widget.clearPin),
                ),
              TextButton.icon(
                onPressed: widget.resolving ? null : _useDeviceLocation,
                icon: widget.resolving
                    ? SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: theme.colorScheme.tertiary,
                        ),
                      )
                    : (_hasPin
                        ? locateIcon
                        : FadeTransition(
                            opacity: Tween<double>(begin: 0.45, end: 1).animate(
                              CurvedAnimation(
                                parent: _pulse,
                                curve: Curves.easeInOut,
                              ),
                            ),
                            child: locateIcon,
                          )),
                label: Text(widget.useDeviceLocation),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              height: widget.height,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: mapBg,
                  border: Border.all(color: mapBorder),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Stack(
                  children: [
                    FlutterMap(
                      mapController: _mapController,
                      options: MapOptions(
                        initialCenter: _center,
                        initialZoom: _hasPin ? _pinZoom : 2,
                        onTap: (tapPos, latLng) {
                          if (widget.resolving) return;
                          widget.onPinChange(latLng.latitude, latLng.longitude);
                          _mapController.move(latLng, _pinZoom);
                        },
                      ),
                      children: [
                        TileLayer(
                          urlTemplate:
                              'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                          subdomains: const ['a', 'b', 'c'],
                          userAgentPackageName: 'com.dama.mobile',
                        ),
                        MarkerLayer(markers: markers),
                      ],
                    ),
                    // Smart Menu map-leaflet always shows "N listings".
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Material(
                        color: Colors.white.withValues(alpha: 0.9),
                        elevation: 1,
                        borderRadius: BorderRadius.circular(6),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          child: Text(
                            listingsLabel,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF111111),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (widget.helperText.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              widget.helperText.trim(),
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.hintColor,
              ),
            ),
          ],
          if ((widget.error ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              widget.error!.trim(),
              style: theme.textTheme.labelSmall?.copyWith(
                color: theme.colorScheme.error,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
