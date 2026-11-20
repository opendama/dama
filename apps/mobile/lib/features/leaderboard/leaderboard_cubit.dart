import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/cache/query_cache.dart';
import 'package:dama_mobile/core/cache/skip_store.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;

class SkipMeta {
  const SkipMeta({
    required this.skip,
    required this.limit,
    required this.page,
    required this.totalPages,
    required this.total,
    required this.hasMore,
    this.prevSkip,
    this.nextSkip,
    this.firstSkip,
    this.lastSkip,
    this.prevActionLabel = '',
    this.nextActionLabel = '',
    this.firstActionLabel = '',
    this.lastActionLabel = '',
    this.skipToActionLabel = '',
    this.pageSummary = '',
  });

  final int skip;
  final int limit;
  final int page;
  final int totalPages;
  final int total;
  final bool hasMore;
  final int? prevSkip;
  final int? nextSkip;
  final int? firstSkip;
  final int? lastSkip;
  final String prevActionLabel;
  final String nextActionLabel;
  final String firstActionLabel;
  final String lastActionLabel;
  final String skipToActionLabel;
  final String pageSummary;

  factory SkipMeta.fromJson(Map<String, dynamic> json) {
    int? asInt(dynamic v) => v is num ? v.toInt() : null;
    return SkipMeta(
      skip: asInt(json['skip']) ?? 0,
      // Fail-closed: never invent page size - API meta.limit required.
      limit: asInt(json['limit']) ?? 0,
      page: asInt(json['page']) ?? 1,
      totalPages: asInt(json['total_pages']) ?? 1,
      total: asInt(json['total']) ?? 0,
      hasMore: json['has_more'] == true,
      prevSkip: asInt(json['prev_skip']),
      nextSkip: asInt(json['next_skip']),
      firstSkip: asInt(json['first_skip']),
      lastSkip: asInt(json['last_skip']),
      prevActionLabel: (json['prev_action_label'] as String?)?.trim() ?? '',
      nextActionLabel: (json['next_action_label'] as String?)?.trim() ?? '',
      firstActionLabel: (json['first_action_label'] as String?)?.trim() ?? '',
      lastActionLabel: (json['last_action_label'] as String?)?.trim() ?? '',
      skipToActionLabel:
          (json['skip_to_action_label'] as String?)?.trim() ?? '',
      pageSummary: (json['page_summary'] as String?)?.trim() ?? '',
    );
  }
}

class LeaderboardMe {
  const LeaderboardMe({required this.rank, required this.points});
  final int rank;
  final int points;
}

class LeaderboardState extends Equatable {
  const LeaderboardState({
    this.loading = false,
    this.softFetching = false,
    this.rows = const <PublicPlayerCard>[],
    this.meta,
    this.skip = 0,
    this.period = '',

    /// Period that matches [rows] scores (may lag tab [period] during soft fetch).
    this.paintedPeriod = '',
    this.me,
    this.error,
  });

  final bool loading;

  /// Period/page refetch while prior rows stay painted (Status soft-fetch parity).
  final bool softFetching;
  final List<PublicPlayerCard> rows;
  final SkipMeta? meta;
  final int skip;
  final String period;
  final String paintedPeriod;
  final LeaderboardMe? me;
  final String? error;

  LeaderboardState copyWith({
    bool? loading,
    bool? softFetching,
    List<PublicPlayerCard>? rows,
    SkipMeta? meta,
    int? skip,
    String? period,
    String? paintedPeriod,
    LeaderboardMe? me,
    bool clearMe = false,
    bool clearRows = false,
    bool clearMeta = false,
    String? error,
    bool clearError = false,
  }) {
    return LeaderboardState(
      loading: loading ?? this.loading,
      softFetching: softFetching ?? this.softFetching,
      rows: clearRows ? const <PublicPlayerCard>[] : (rows ?? this.rows),
      meta: clearMeta ? null : (meta ?? this.meta),
      skip: skip ?? this.skip,
      period: period ?? this.period,
      paintedPeriod: paintedPeriod ?? this.paintedPeriod,
      me: clearMe ? null : (me ?? this.me),
      error: clearError ? null : (error ?? this.error),
    );
  }

  @override
  List<Object?> get props => [
        loading,
        softFetching,
        rows,
        meta,
        skip,
        period,
        paintedPeriod,
        me,
        error
      ];
}

/// Owns leaderboard REST fetch + period-scoped QueryCache soft paint.
class LeaderboardCubit extends Cubit<LeaderboardState> {
  LeaderboardCubit({
    ApiConfig? config,
    required this.loadFailedMessage,
    required this.pageSize,
    required String initialPeriod,
    this.accessToken,
  })  : _config = config ?? ApiConfig.defaults,
        super(LeaderboardState(
          period: initialPeriod.trim(),
          paintedPeriod: initialPeriod.trim(),
          skip: SkipStore.read(_skipKeyFor(initialPeriod.trim())),
        ));

  final ApiConfig _config;
  final String loadFailedMessage;
  final int pageSize;
  final String? accessToken;

  static String _skipKeyFor(String period) {
    final p = period.trim();
    return p.isEmpty ? 'leaderboard' : 'leaderboard_$p';
  }

  String _cacheKeyFor(String period) =>
      CacheKeys.leaderboard(accessToken, period);

  Future<void> load() async {
    if (pageSize <= 0 || state.period.trim().isEmpty) {
      emit(state.copyWith(
          loading: false, softFetching: false, clearError: true));
      return;
    }
    final periodKey = state.period.trim();
    final restoredSkip = SkipStore.read(_skipKeyFor(periodKey));
    final cached = QueryCache.read<Map<String, dynamic>>(
      _cacheKeyFor(periodKey),
      maxAge: QueryCache.sessionTtl,
      allowStale: true,
    );
    if (cached != null) {
      final rows = (cached['rows'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(PublicPlayerCard.fromJson)
          .toList();
      final metaRaw = cached['meta'];
      final cachedSkip = (cached['skip'] as num?)?.toInt() ?? restoredSkip;
      LeaderboardMe? me;
      final meRaw = cached['me'];
      if (meRaw is Map<String, dynamic>) {
        me = LeaderboardMe(
          rank: (meRaw['rank'] as num?)?.toInt() ?? 0,
          points: (meRaw['points'] as num?)?.toInt() ?? 0,
        );
      }
      emit(
        state.copyWith(
          rows: rows,
          meta: metaRaw is Map<String, dynamic>
              ? SkipMeta.fromJson(metaRaw)
              : null,
          skip: cachedSkip,
          period: periodKey,
          paintedPeriod: periodKey,
          me: me,
          clearMe: me == null,
          loading: false,
          softFetching: false,
          clearError: true,
        ),
      );
      unawaited(
        _fetch(skip: cachedSkip, period: periodKey, showSkeleton: false),
      );
      return;
    }
    await _fetch(
      skip: restoredSkip,
      period: periodKey,
      showSkeleton: true,
    );
  }

  Future<void> refresh() async {
    QueryCache.invalidate(_cacheKeyFor(state.period));
    await _fetch(skip: state.skip, period: state.period, showSkeleton: false);
  }

  Future<void> goToSkip(int skip) async {
    final safe = skip < 0 ? 0 : skip;
    unawaited(SkipStore.write(_skipKeyFor(state.period), safe));
    await _fetch(skip: safe, period: state.period, showSkeleton: false);
  }

  Future<void> setPeriod(String period) async {
    final p = period.trim();
    // Fail-closed: ignore empty period (never invent "week").
    if (p.isEmpty) return;
    if (p == state.period.trim()) return;

    final restoredSkip = SkipStore.read(_skipKeyFor(p));
    // Cache hit for this tab → instant paint, no skeleton flash.
    final cached = QueryCache.read<Map<String, dynamic>>(
      _cacheKeyFor(p),
      maxAge: QueryCache.sessionTtl,
      allowStale: true,
    );
    if (cached != null) {
      final rows = (cached['rows'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(PublicPlayerCard.fromJson)
          .toList();
      final metaRaw = cached['meta'];
      // Prefer disk skip (refresh persistence) over session cache skip.
      final cachedSkip = restoredSkip > 0
          ? restoredSkip
          : ((cached['skip'] as num?)?.toInt() ?? 0);
      LeaderboardMe? me;
      final meRaw = cached['me'];
      if (meRaw is Map<String, dynamic>) {
        me = LeaderboardMe(
          rank: (meRaw['rank'] as num?)?.toInt() ?? 0,
          points: (meRaw['points'] as num?)?.toInt() ?? 0,
        );
      }
      emit(
        state.copyWith(
          rows: rows,
          meta: metaRaw is Map<String, dynamic>
              ? SkipMeta.fromJson(metaRaw)
              : null,
          skip: cachedSkip,
          period: p,
          paintedPeriod: p,
          me: me,
          clearMe: me == null,
          loading: false,
          softFetching: false,
          clearError: true,
        ),
      );
      unawaited(_fetch(skip: cachedSkip, period: p, showSkeleton: false));
      return;
    }

    // Soft fetch: keep prior rows; score labels stay on paintedPeriod until ready.
    await _fetch(
      skip: restoredSkip,
      period: p,
      showSkeleton: false,
      softPeriodSwitch: true,
    );
  }

  Future<void> _fetch({
    required int skip,
    required bool showSkeleton,
    String? period,
    bool softPeriodSwitch = false,
  }) async {
    final raw = (period ?? state.period).trim();
    // Fail-closed: require a real period from UI/API chrome - never invent "week".
    if (raw.isEmpty) {
      if (showSkeleton) {
        emit(state.copyWith(
            loading: false, softFetching: false, clearError: true));
      }
      return;
    }
    final periodKey = raw;
    if (showSkeleton) {
      emit(
        state.copyWith(
          loading: true,
          softFetching: false,
          period: periodKey,
          paintedPeriod: periodKey,
          skip: skip,
          clearRows: true,
          clearMeta: true,
          clearMe: true,
          clearError: true,
        ),
      );
    } else if (softPeriodSwitch) {
      emit(
        state.copyWith(
          loading: false,
          softFetching: true,
          period: periodKey,
          skip: skip,
          clearError: true,
        ),
      );
    } else {
      emit(state.copyWith(softFetching: true, clearError: true));
    }
    try {
      final uri = Uri.parse('${_config.restUrl}/leaderboard').replace(
        queryParameters: {
          'skip': '$skip',
          'limit': '$pageSize',
          'period': periodKey,
        },
      );
      final headers = <String, String>{};
      final tok = accessToken?.trim() ?? '';
      if (tok.isNotEmpty) {
        headers['Authorization'] = 'Bearer $tok';
      }
      final res = await http.get(uri, headers: headers);
      if (res.statusCode >= 300) {
        throw Exception('leaderboard failed');
      }
      final json = jsonDecode(res.body) as Map<String, dynamic>;
      final echoed = (json['period'] as String?)?.trim() ?? '';
      // Fail-closed: never score/label with a mismatched period payload.
      if (echoed != periodKey) {
        throw Exception('leaderboard period mismatch');
      }
      final list = json['leaderboard'] as List<dynamic>? ?? [];
      final rows = list
          .whereType<Map<String, dynamic>>()
          .map(PublicPlayerCard.fromJson)
          .toList();
      final metaRaw = json['meta'];
      final meta =
          metaRaw is Map<String, dynamic> ? SkipMeta.fromJson(metaRaw) : null;
      LeaderboardMe? me;
      final meRaw = json['me'];
      if (meRaw is Map<String, dynamic>) {
        me = LeaderboardMe(
          rank: (meRaw['rank'] as num?)?.toInt() ?? 0,
          points: (meRaw['points'] as num?)?.toInt() ?? 0,
        );
      }
      QueryCache.write(_cacheKeyFor(periodKey), {
        'rows': list,
        'meta': metaRaw,
        'skip': skip,
        'period': periodKey,
        'me': meRaw,
      });
      emit(
        state.copyWith(
          rows: rows,
          meta: meta,
          skip: skip,
          period: periodKey,
          paintedPeriod: periodKey,
          me: me,
          clearMe: me == null,
          loading: false,
          softFetching: false,
          clearError: true,
        ),
      );
      unawaited(SkipStore.write(_skipKeyFor(periodKey), skip));
    } catch (_) {
      emit(
        state.copyWith(
          loading: false,
          softFetching: false,
          error: loadFailedMessage,
          // Keep prior rows on soft period failure; wipe only on hard first load.
          clearRows: showSkeleton,
          clearMeta: showSkeleton,
          clearMe: showSkeleton,
        ),
      );
    }
  }

  /// Instant row patch from WS `avatar_updated` (no full refetch).
  void patchAvatar(String userId, String? thumbUrl, String? fullUrl) {
    final uid = userId.trim();
    if (uid.isEmpty) return;
    final thumb = (thumbUrl ?? '').trim();
    final full = (fullUrl ?? '').trim();
    final clear = thumb.isEmpty && full.isEmpty;
    final nextUrl = clear ? null : (thumb.isNotEmpty ? thumb : full);
    var touched = false;
    final rows = state.rows.map((p) {
      if (p.id != uid) return p;
      touched = true;
      return p.copyWith(
        clearAvatar: clear,
        avatarThumbUrl: nextUrl,
        avatarFullUrl: clear ? null : (full.isNotEmpty ? full : null),
      );
    }).toList();
    if (!touched) return;
    emit(state.copyWith(rows: rows));
  }
}
