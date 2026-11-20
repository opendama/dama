/// `GET /game/rules` payload.
class GameRules {
  const GameRules({this.piecesPerSide, this.variant});

  final int? piecesPerSide;
  final String? variant;

  factory GameRules.fromJson(Map<String, dynamic> json) {
    return GameRules(
      piecesPerSide: (json['pieces_per_side'] as num?)?.toInt(),
      variant: json['variant']?.toString(),
    );
  }
}

/// One selectable time control from `match_clock.presets`.
class MatchClockPreset {
  const MatchClockPreset({required this.seconds, required this.label});

  final int seconds;
  final String label;

  static MatchClockPreset? fromJson(Map<String, dynamic> json) {
    final seconds = (json['seconds'] as num?)?.toInt() ?? 0;
    final label = (json['label'] as String?)?.trim() ?? '';
    if (seconds <= 0 || label.isEmpty) return null;
    return MatchClockPreset(seconds: seconds, label: label);
  }
}

/// Match clock from `GET /progression`.
class MatchClockSettings {
  const MatchClockSettings({
    required this.enabled,
    required this.initialSeconds,
    required this.incrementSeconds,
    this.presets = const [],
    this.inviteTtlSeconds = 0,
    this.pauseEnabled = false,
    this.pauseDurationSeconds = 0,
  });

  final bool enabled;
  final int initialSeconds;
  final int incrementSeconds;
  final List<MatchClockPreset> presets;

  /// Pending invite / challenge-link lifetime from `match_clock.invite_ttl_seconds`.
  final int inviteTtlSeconds;

  /// Admin Progression: seated players may freeze the match.
  /// Fail-open when the field is absent (web LeaveBoardPauseHost parity).
  final bool pauseEnabled;

  /// Admin Progression: max pause length in seconds.
  final int pauseDurationSeconds;

  bool get active => enabled && initialSeconds > 0;

  factory MatchClockSettings.fromJson(Map<String, dynamic> json) {
    final raw = json['presets'];
    final presets = <MatchClockPreset>[];
    if (raw is List) {
      for (final item in raw) {
        if (item is Map<String, dynamic>) {
          final p = MatchClockPreset.fromJson(item);
          if (p != null) presets.add(p);
        }
      }
    }
    return MatchClockSettings(
      enabled: json['enabled'] == true,
      initialSeconds: (json['initial_seconds'] as num?)?.toInt() ?? 0,
      incrementSeconds: (json['increment_seconds'] as num?)?.toInt() ?? 0,
      presets: presets,
      inviteTtlSeconds: (json['invite_ttl_seconds'] as num?)?.toInt() ?? 0,
      pauseEnabled: json['pause_enabled'] == true,
      pauseDurationSeconds:
          (json['pause_duration_seconds'] as num?)?.toInt() ?? 0,
    );
  }
}

class ProgressionConfig {
  const ProgressionConfig({this.matchClock});

  final MatchClockSettings? matchClock;

  factory ProgressionConfig.fromJson(Map<String, dynamic> json) {
    final clock = json['match_clock'];
    return ProgressionConfig(
      matchClock: clock is Map<String, dynamic>
          ? MatchClockSettings.fromJson(clock)
          : null,
    );
  }
}

/// Parsed legal move `[fromRow, fromCol, toRow, toCol, captureCount]`.
typedef BoardLegalMove = List<int>;

/// Full legal move (captures + promote) for optimistic local apply.
class LegalMoveDetail {
  const LegalMoveDetail({
    required this.fromR,
    required this.fromC,
    required this.toR,
    required this.toC,
    this.captures = const [],
    this.promotes = false,
  });

  final int fromR;
  final int fromC;
  final int toR;
  final int toC;
  final List<List<int>> captures;
  final bool promotes;

  BoardLegalMove get asBoardLegalMove =>
      [fromR, fromC, toR, toC, captures.length];
}

/// One ply from API `move_history` (smart-menu / web parity).
class MoveHistoryEntry {
  const MoveHistoryEntry({
    required this.from,
    required this.to,
    this.captures = const [],
    this.player = 1,
    this.boardAfter,
  });

  final List<int> from;
  final List<int> to;
  final List<List<int>> captures;
  final int player;
  final List<List<dynamic>>? boardAfter;

  factory MoveHistoryEntry.fromJson(Map<String, dynamic> json) {
    List<int> pair(dynamic raw) {
      if (raw is! List || raw.length < 2) return const [0, 0];
      return [(raw[0] as num).toInt(), (raw[1] as num).toInt()];
    }

    final caps = <List<int>>[];
    final rawCaps = json['captures'];
    if (rawCaps is List) {
      for (final c in rawCaps) {
        if (c is List && c.length >= 2) {
          caps.add([(c[0] as num).toInt(), (c[1] as num).toInt()]);
        }
      }
    }
    List<List<dynamic>>? boardAfter;
    final ba = json['board_after'];
    if (ba is List) {
      boardAfter = ba.map((row) => (row as List<dynamic>).toList()).toList();
    }
    return MoveHistoryEntry(
      from: pair(json['from']),
      to: pair(json['to']),
      captures: caps,
      player: (json['player'] as num?)?.toInt() ?? 1,
      boardAfter: boardAfter,
    );
  }
}

/// Live game state from REST or WebSocket `game` object.
/// BoardLegalMove layout: [fromR, fromC, toR, toC, captureCount].
class GameStatePayload {
  const GameStatePayload({
    this.board,
    this.size = 0,
    this.player1Id,
    this.player2Id,
    this.moveCount = 0,
    this.hasMoveCount = false,
    this.halfmoveClock,
    this.turn = 1,
    this.legalMoves = const [],
    this.legalMoveDetails = const [],
    this.mustContinue,
    this.piecesPerSide,
    this.draw = false,
    this.outcome,
    this.gameId,
    this.moveHistory = const [],
    this.timeControlSeconds,
    this.rated,
    this.endReason,
    this.clockActive = false,
    this.clockIncrementSeconds = 0,
    this.clockP1RemainingMs = 0,
    this.clockP2RemainingMs = 0,
    this.clockServerNowMs = 0,
    this.clockLastTickUnixMs = 0,
    this.paused = false,
    this.pausedAtUnixMs = 0,
    this.pauseExpiresAtUnixMs = 0,
    this.pausedByUserId,
    this.pauseRemainingMs = 0,
    this.pauseKind = '',
    this.pauseReasonKey = '',
    this.pauseReasonLabel = '',
    this.pauseNote = '',
    this.pauseActorRole = '',
    this.pauseActorDisplayName = '',
  });

  final List<List<dynamic>>? board;
  final int size;
  final String? player1Id;
  final String? player2Id;
  final int moveCount;

  /// True only when JSON included a numeric `move_count` (fail-closed for match intro).
  final bool hasMoveCount;
  final int? halfmoveClock;
  final int turn;
  final List<BoardLegalMove> legalMoves;
  final List<LegalMoveDetail> legalMoveDetails;

  /// Forced multi-jump square `[row, col]` when present.
  final List<int>? mustContinue;
  final int? piecesPerSide;
  final bool draw;
  final dynamic outcome;
  final String? gameId;
  final List<MoveHistoryEntry> moveHistory;

  /// Per-game TC from invite/matchmaking; drives board clock when > 0.
  final int? timeControlSeconds;
  final bool? rated;

  /// Server end reason when forced (e.g. `clock_flag`).
  final String? endReason;
  final bool clockActive;
  final int clockIncrementSeconds;
  final int clockP1RemainingMs;
  final int clockP2RemainingMs;
  final int clockServerNowMs;
  final int clockLastTickUnixMs;

  /// Server froze the clock and blocked moves.
  final bool paused;
  final int pausedAtUnixMs;
  final int pauseExpiresAtUnixMs;
  final String? pausedByUserId;
  final int pauseRemainingMs;

  /// `player` or `official` when paused; empty otherwise.
  final String pauseKind;
  final String pauseReasonKey;
  final String pauseReasonLabel;
  final String pauseNote;
  final String pauseActorRole;
  final String pauseActorDisplayName;

  bool get isOfficialPause => paused && pauseKind.trim() == 'official';

  static String? _asId(dynamic v) {
    if (v is String && v.isNotEmpty) return v;
    return null;
  }

  static List<int>? _parseMustContinue(dynamic raw) {
    if (raw is! List || raw.length < 2) return null;
    return [(raw[0] as num).toInt(), (raw[1] as num).toInt()];
  }

  static List<LegalMoveDetail> _parseLegalMoveDetails(List<dynamic>? legal) {
    if (legal == null) return const [];
    final moves = <LegalMoveDetail>[];
    for (final raw in legal) {
      if (raw is! Map) continue;
      final from = raw['from'];
      final to = raw['to'];
      if (from is! List || to is! List || from.length < 2 || to.length < 2) {
        continue;
      }
      final caps = <List<int>>[];
      final rawCaps = raw['captures'];
      if (rawCaps is List) {
        for (final c in rawCaps) {
          if (c is List && c.length >= 2) {
            caps.add([(c[0] as num).toInt(), (c[1] as num).toInt()]);
          }
        }
      }
      moves.add(
        LegalMoveDetail(
          fromR: (from[0] as num).toInt(),
          fromC: (from[1] as num).toInt(),
          toR: (to[0] as num).toInt(),
          toC: (to[1] as num).toInt(),
          captures: caps,
          promotes: raw['promotes'] == true,
        ),
      );
    }
    return moves;
  }

  factory GameStatePayload.fromJson(Map<String, dynamic> map) {
    final boardRaw = map['board'] as List<dynamic>?;
    final board =
        boardRaw?.map((row) => (row as List<dynamic>).toList()).toList();
    final sizeRaw = map['size'];
    final size = sizeRaw is num ? sizeRaw.toInt() : (board?.length ?? 0);
    final pieces = map['pieces_per_side'];
    final histRaw = map['move_history'];
    final moveHistory = <MoveHistoryEntry>[];
    if (histRaw is List) {
      for (final e in histRaw) {
        if (e is Map<String, dynamic>) {
          moveHistory.add(MoveHistoryEntry.fromJson(e));
        } else if (e is Map) {
          moveHistory
              .add(MoveHistoryEntry.fromJson(Map<String, dynamic>.from(e)));
        }
      }
    }
    final details =
        _parseLegalMoveDetails(map['legal_moves'] as List<dynamic>?);
    return GameStatePayload(
      board: board,
      size: size,
      player1Id: _asId(map['player1_id']),
      player2Id: _asId(map['player2_id']),
      moveCount: (map['move_count'] as num?)?.toInt() ?? 0,
      hasMoveCount: map['move_count'] is num,
      halfmoveClock: (map['halfmove_clock'] as num?)?.toInt(),
      turn: (map['turn'] as num?)?.toInt() ?? 1,
      legalMoves: details.map((m) => m.asBoardLegalMove).toList(),
      legalMoveDetails: details,
      mustContinue: _parseMustContinue(map['must_continue']),
      piecesPerSide: pieces is num ? pieces.toInt() : null,
      draw: map['draw'] == true,
      outcome: map['outcome'],
      gameId: _asId(map['id']) ?? _asId(map['game_id']),
      moveHistory: moveHistory,
      timeControlSeconds: (map['time_control_seconds'] as num?)?.toInt(),
      rated: map['rated'] is bool ? map['rated'] as bool : null,
      endReason: () {
        final v = map['end_reason'];
        if (v is String && v.trim().isNotEmpty) return v.trim();
        return null;
      }(),
      clockActive: map['clock_active'] == true,
      clockIncrementSeconds:
          (map['clock_increment_seconds'] as num?)?.toInt() ?? 0,
      clockP1RemainingMs: (map['clock_p1_remaining_ms'] as num?)?.toInt() ?? 0,
      clockP2RemainingMs: (map['clock_p2_remaining_ms'] as num?)?.toInt() ?? 0,
      clockServerNowMs: (map['clock_server_now_ms'] as num?)?.toInt() ?? 0,
      clockLastTickUnixMs:
          (map['clock_last_tick_unix_ms'] as num?)?.toInt() ?? 0,
      paused: map['paused'] == true,
      pausedAtUnixMs: (map['paused_at_unix_ms'] as num?)?.toInt() ?? 0,
      pauseExpiresAtUnixMs:
          (map['pause_expires_at_unix_ms'] as num?)?.toInt() ?? 0,
      pausedByUserId: _asId(map['paused_by_user_id']),
      pauseRemainingMs: (map['pause_remaining_ms'] as num?)?.toInt() ?? 0,
      pauseKind: () {
        final v = map['pause_kind'];
        return v is String ? v.trim() : '';
      }(),
      pauseReasonKey: () {
        final v = map['pause_reason_key'];
        return v is String ? v.trim() : '';
      }(),
      pauseReasonLabel: () {
        final v = map['pause_reason_label'];
        return v is String ? v.trim() : '';
      }(),
      pauseNote: () {
        final v = map['pause_note'];
        return v is String ? v.trim() : '';
      }(),
      pauseActorRole: () {
        final v = map['pause_actor_role'];
        return v is String ? v.trim() : '';
      }(),
      pauseActorDisplayName: () {
        final v = map['pause_actor_display_name'];
        return v is String ? v.trim() : '';
      }(),
    );
  }

  static int countPlayerPieces(List<List<dynamic>>? board, int player) {
    if (board == null) return 0;
    var n = 0;
    for (final row in board) {
      for (final cell in row) {
        if (cell is Map && cell['p'] == player) n++;
      }
    }
    return n;
  }
}
