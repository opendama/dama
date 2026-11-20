/// Runtime API endpoints. Production must inject via --dart-define=DAMA_API_ORIGIN=...
class ApiConfig {
  const ApiConfig({
    required this.graphqlUrl,
    required this.restUrl,
    required this.wsUrl,
    required this.origin,
  });

  final String graphqlUrl;
  final String restUrl;
  final String wsUrl;
  final String origin;

  static const String _originDefine = String.fromEnvironment('DAMA_API_ORIGIN');
  static const String _webOriginDefine =
      String.fromEnvironment('DAMA_WEB_ORIGIN');

  /// Origin used by multipart uploads that build their own path.
  static String get baseUrl {
    if (_originDefine.isEmpty) {
      throw StateError(
        'DAMA_API_ORIGIN is required (flutter run --dart-define=DAMA_API_ORIGIN=https://api.example.com)',
      );
    }
    return _originDefine.replaceAll(RegExp(r'/$'), '');
  }

  /// Public web app origin for share / challenge deep links (fail-closed empty).
  static String get webOrigin {
    if (_webOriginDefine.isEmpty) return '';
    return _webOriginDefine.replaceAll(RegExp(r'/$'), '');
  }

  static ApiConfig get defaults {
    final origin = baseUrl;
    return ApiConfig(
      graphqlUrl: '$origin/graphql',
      restUrl: '$origin/api/v1',
      wsUrl: '${origin.replaceFirst(RegExp(r'^http'), 'ws')}/ws/game',
      origin: origin,
    );
  }
}
