/// Display label for a resolved country: "{name} ({ISO2})".
/// Prefer [countryName] from `/geo/locate` or Nominatim; else ISO-2 alone.
String formatCountryLabel(String countryCode, [String? countryName]) {
  final cc = countryCode.trim().toUpperCase();
  if (cc.length != 2) return '';
  final name = (countryName ?? '').trim();
  // Do not use contains(cc) - "Ethiopia" contains "ET".
  final alreadyCoded = RegExp(r'\([A-Z]{2}\)\s*$').hasMatch(name);
  if (name.isNotEmpty && name.toUpperCase() != cc && !alreadyCoded) {
    return '$name ($cc)';
  }
  if (name.isNotEmpty) return name;
  return cc;
}
