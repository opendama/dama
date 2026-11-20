import 'dart:async';

/// Fan-out for live DM WS events (`dm_message`, `dm_reaction`, `dm_read`).
class DmThreadLive {
  DmThreadLive._();

  static final StreamController<String> _ctrl =
      StreamController<String>.broadcast();

  static Stream<String> get stream => _ctrl.stream;

  static void notify(String threadId) {
    final id = threadId.trim();
    if (id.isEmpty) return;
    _ctrl.add(id);
  }
}
