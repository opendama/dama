import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

/// Live board WebSocket client for 10x10 match moves.
class GameWsClient {
  GameWsClient({
    String? origin,
    this.connectionErrorMessage = '',
  }) : origin = origin ?? ApiConfig.baseUrl;

  final String origin;
  String connectionErrorMessage;
  WebSocketChannel? _channel;
  StreamSubscription? _sub;
  Timer? _pingTimer;
  final _controller = StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get messages => _controller.stream;

  /// True while a channel is open (best-effort; sink errors still fail closed).
  bool get isConnected => _channel != null;

  void _startPing() {
    _pingTimer?.cancel();
    // Keepalive: proxy idle kills ~2–3m silent sockets → mid-game move failures.
    _pingTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      if (_channel == null) return;
      try {
        ping();
      } catch (_) {}
    });
  }

  Future<void> connectGame({
    required String token,
    required String gameId,
  }) async {
    await disconnect();
    final uri = Uri.parse(
      origin.replaceFirst('http', 'ws') +
          '/ws/game?token=$token&game_id=$gameId',
    );
    _channel = WebSocketChannel.connect(uri);
    _startPing();
    _sub = _channel!.stream.listen(
      (event) {
        if (event is String) {
          try {
            final map = jsonDecode(event) as Map<String, dynamic>;
            if (map['type'] == 'pong') return;
            _controller.add(map);
          } catch (_) {
            _controller.add({'type': 'raw', 'data': event});
          }
        }
      },
      onError: (_) => _controller.add({
        'type': 'error',
        'error': connectionErrorMessage,
      }),
      onDone: () => _controller.add({'type': 'closed'}),
    );
  }

  Future<void> connectSpectate({required String gameId, String? token}) async {
    await disconnect();
    final q = StringBuffer('/ws/spectate?game_id=$gameId');
    if (token != null && token.isNotEmpty) {
      q.write('&token=$token');
    }
    final uri = Uri.parse(origin.replaceFirst('http', 'ws') + q.toString());
    _channel = WebSocketChannel.connect(uri);
    _startPing();
    _sub = _channel!.stream.listen((event) {
      if (event is String) {
        try {
          final map = jsonDecode(event) as Map<String, dynamic>;
          if (map['type'] == 'pong') return;
          _controller.add(map);
        } catch (_) {}
      }
    });
  }

  void sendMove(Map<String, dynamic> move) {
    _channel?.sink.add(jsonEncode({'type': 'move', ...move}));
  }

  /// Raw game-room envelope (e.g. `clock_flag`). No-op when disconnected.
  void send(Map<String, dynamic> payload) {
    _channel?.sink.add(jsonEncode(payload));
  }

  void ping() => _channel?.sink.add('ping');

  Future<void> disconnect() async {
    _pingTimer?.cancel();
    _pingTimer = null;
    await _sub?.cancel();
    _sub = null;
    await _channel?.sink.close();
    _channel = null;
  }

  Future<void> dispose() async {
    await disconnect();
    await _controller.close();
  }
}
