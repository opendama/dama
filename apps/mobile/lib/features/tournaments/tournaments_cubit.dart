import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/cache/query_cache.dart';
import 'package:dama_mobile/core/cup_lifecycle.dart';
import 'package:dama_mobile/core/cache/skip_store.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/features/events/community_player_chrome_soft.dart';
import 'package:dama_mobile/features/leaderboard/leaderboard_cubit.dart'
    show SkipMeta;
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;

enum TournamentEntryFilter { all, free, paid }

class TournamentsState extends Equatable {
  const TournamentsState({
    this.loading = false,
    this.softFetching = false,
    this.busy = false,
    this.rows = const <RestTournament>[],
    this.meta,
    this.skip = 0,
    this.entryFilter = TournamentEntryFilter.all,
    this.lifecycle = CupLifecyclePhase.open,
    this.mine = false,
    this.searchQ = '',
    this.error,
    this.enrollMessage,
    this.alreadyEnrolled = false,
  });

  final bool loading;

  /// Filter/search/page refetch without wiping the card grid (leaderboard soft-fetch parity).
  final bool softFetching;
  final bool busy;
  final List<RestTournament> rows;
  final SkipMeta? meta;
  final int skip;
  final TournamentEntryFilter entryFilter;
  final CupLifecyclePhase lifecycle;
  final bool mine;
  final String searchQ;
  final String? error;
  final String? enrollMessage;
  final bool alreadyEnrolled;

  TournamentsState copyWith({
    bool? loading,
    bool? softFetching,
    bool? busy,
    List<RestTournament>? rows,
    SkipMeta? meta,
    bool clearMeta = false,
    int? skip,
    TournamentEntryFilter? entryFilter,
    CupLifecyclePhase? lifecycle,
    bool? mine,
    String? searchQ,
    String? error,
    String? enrollMessage,
    bool? alreadyEnrolled,
    bool clearError = false,
    bool clearEnrollMessage = false,
  }) {
    return TournamentsState(
      loading: loading ?? this.loading,
      softFetching: softFetching ?? this.softFetching,
      busy: busy ?? this.busy,
      rows: rows ?? this.rows,
      meta: clearMeta ? null : (meta ?? this.meta),
      skip: skip ?? this.skip,
      entryFilter: entryFilter ?? this.entryFilter,
      lifecycle: lifecycle ?? this.lifecycle,
      mine: mine ?? this.mine,
      searchQ: searchQ ?? this.searchQ,
      error: clearError ? null : (error ?? this.error),
      enrollMessage:
          clearEnrollMessage ? null : (enrollMessage ?? this.enrollMessage),
      alreadyEnrolled: alreadyEnrolled ?? this.alreadyEnrolled,
    );
  }

  @override
  List<Object?> get props => [
        loading,
        softFetching,
        busy,
        rows,
        meta,
        skip,
        entryFilter,
        lifecycle,
        mine,
        searchQ,
        error,
        enrollMessage,
        alreadyEnrolled,
      ];
}

/// Owns tournaments REST list (DB page size + filters) + REST enroll/join.
class TournamentsCubit extends Cubit<TournamentsState> {
  TournamentsCubit({
    required this.accessToken,
    required this.chrome,
    ApiConfig? config,
  })  : _config = config ?? ApiConfig.defaults,
        super(TournamentsState(skip: SkipStore.read(_skipKey)));

  static const _skipKey = 'tournaments';

  final String accessToken;
  final TournamentsPlayerChrome chrome;
  final ApiConfig _config;

  Future<void> load() async {
    await _fetch(showSkeleton: true);
  }

  Future<void> refresh() async {
    QueryCache.invalidate(CacheKeys.tournaments);
    await _fetch(showSkeleton: false);
  }

  Future<void> setEntryFilter(TournamentEntryFilter filter) async {
    if (state.entryFilter == filter) return;
    emit(state.copyWith(entryFilter: filter, skip: 0));
    unawaited(SkipStore.clear(_skipKey));
    await _fetch(showSkeleton: false);
  }

  Future<void> setSearchQ(String q) async {
    final next = q.trim();
    if (state.searchQ == next) return;
    emit(state.copyWith(searchQ: next, skip: 0));
    unawaited(SkipStore.clear(_skipKey));
    await _fetch(showSkeleton: false);
  }

  Future<void> setLifecycle(CupLifecyclePhase phase) async {
    if (state.lifecycle == phase) return;
    emit(state.copyWith(lifecycle: phase, skip: 0));
    unawaited(SkipStore.clear(_skipKey));
    await _fetch(showSkeleton: false);
  }

  Future<void> setMine(bool mine) async {
    if (state.mine == mine) return;
    if (mine && accessToken.trim().isEmpty) return;
    emit(state.copyWith(mine: mine, skip: 0));
    unawaited(SkipStore.clear(_skipKey));
    await _fetch(showSkeleton: false);
  }

  Future<void> goSkip(int skip) async {
    if (skip < 0 || skip == state.skip) return;
    emit(state.copyWith(skip: skip));
    unawaited(SkipStore.write(_skipKey, skip));
    await _fetch(showSkeleton: false);
  }

  /// Free cup join (no payment modal). Returns true when caller should open cup lobby.
  /// [bearerToken] overrides cubit token after guest sign-in (web enroll parity).
  Future<bool> joinFree(String id, {String? bearerToken}) async {
    final token = (bearerToken ?? accessToken).trim();
    emit(state.copyWith(
      busy: true,
      clearError: true,
      clearEnrollMessage: true,
      alreadyEnrolled: false,
    ));
    try {
      final res = await http.post(
        Uri.parse('${_config.restUrl}/tournaments/$id/enroll'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: '{}',
      );
      if (res.statusCode == 409) {
        emit(state.copyWith(
          busy: false,
          clearError: true,
          alreadyEnrolled: true,
        ));
        return true;
      }
      if (res.statusCode >= 300) {
        emit(state.copyWith(
          busy: false,
          error: softCommunityJoinStatusMessage(chrome.enrollFailed),
        ));
        return false;
      }
      QueryCache.invalidate(CacheKeys.tournaments);
      QueryCache.invalidatePrefix('session:wallet');
      QueryCache.invalidate(CacheKeys.me(token));
      emit(state.copyWith(
        busy: false,
        enrollMessage: softCommunityJoinStatusMessage(chrome.joinedFree),
        clearError: true,
        alreadyEnrolled: false,
      ));
      await _fetch(showSkeleton: false);
      return true;
    } catch (_) {
      emit(state.copyWith(
        busy: false,
        error: softCommunityJoinStatusMessage(chrome.enrollFailed),
      ));
      return false;
    }
  }

  Future<void> enroll(String id) async {
    emit(state.copyWith(
      busy: true,
      clearError: true,
      clearEnrollMessage: true,
      alreadyEnrolled: false,
    ));
    try {
      final res = await http.post(
        Uri.parse('${_config.restUrl}/tournaments/$id/enroll'),
        headers: {
          'Authorization': 'Bearer $accessToken',
          'Content-Type': 'application/json',
        },
        body: '{}',
      );
      if (res.statusCode == 409) {
        emit(state.copyWith(
          busy: false,
          alreadyEnrolled: true,
          clearError: true,
        ));
        return;
      }
      if (res.statusCode >= 300) {
        emit(state.copyWith(
          busy: false,
          error: softCommunityJoinStatusMessage(chrome.enrollFailed),
        ));
        return;
      }
      final enroll = TournamentEnrollResult.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      QueryCache.invalidate(CacheKeys.tournaments);
      QueryCache.invalidatePrefix('session:wallet');
      QueryCache.invalidate(CacheKeys.me(accessToken));
      final cur = enroll.chargedCurrency.trim();
      final sep = chrome.amountCurrencySeparator;
      final message = softCommunityJoinStatusMessage(
        enroll.isFree
            ? chrome.joinedFree
            : (enroll.charged != null && cur.isNotEmpty && sep.isNotEmpty)
                ? '${chrome.enrolledChargedPrefix}${enroll.charged}$sep$cur${chrome.enrolledChargedClose}'
                : chrome.enrolledBare,
      );
      emit(state.copyWith(
        busy: false,
        enrollMessage: message,
        clearError: true,
        alreadyEnrolled: false,
      ));
      await _fetch(showSkeleton: false);
    } catch (_) {
      emit(state.copyWith(
        busy: false,
        error: softCommunityJoinStatusMessage(chrome.enrollFailed),
      ));
    }
  }

  Future<void> _fetch({required bool showSkeleton}) async {
    final limit = chrome.listPageSizeInt;
    if (limit < 1) {
      emit(state.copyWith(
        loading: false,
        error: softCommunityLoadFailed(chrome.loadFailed),
        rows: const [],
        clearMeta: true,
      ));
      return;
    }
    if (showSkeleton) {
      emit(
          state.copyWith(loading: true, softFetching: false, clearError: true));
    } else {
      emit(state.copyWith(softFetching: true, clearError: true));
    }
    if (state.mine && accessToken.trim().isEmpty) {
      emit(state.copyWith(
        loading: false,
        softFetching: false,
        rows: const [],
        clearMeta: true,
        clearError: true,
      ));
      return;
    }
    try {
      final params = <String, String>{
        'skip': '${state.skip}',
        'limit': '$limit',
        'lifecycle': state.lifecycle.apiValue,
      };
      switch (state.entryFilter) {
        case TournamentEntryFilter.free:
          params['is_free'] = 'true';
          break;
        case TournamentEntryFilter.paid:
          params['is_free'] = 'false';
          break;
        case TournamentEntryFilter.all:
          break;
      }
      final q = state.searchQ.trim();
      if (q.isNotEmpty) params['q'] = q;
      if (state.mine) params['mine'] = '1';
      final headers = <String, String>{};
      final token = accessToken.trim();
      if (token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
      final res = await http.get(
        Uri.parse('${_config.restUrl}/tournaments').replace(
          queryParameters: params,
        ),
        headers: headers,
      );
      if (res.statusCode >= 300) {
        emit(state.copyWith(
          loading: false,
          softFetching: false,
          error: softCommunityLoadFailed(chrome.loadFailed),
          rows: const [],
          clearMeta: true,
        ));
        return;
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final rows = (body['tournaments'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(RestTournament.fromJson)
          .where((t) => t.id.isNotEmpty)
          .toList();
      final metaRaw = body['meta'];
      final meta =
          metaRaw is Map<String, dynamic> ? SkipMeta.fromJson(metaRaw) : null;
      QueryCache.write(CacheKeys.tournaments, rows);
      emit(state.copyWith(
        rows: rows,
        meta: meta,
        loading: false,
        softFetching: false,
        clearError: true,
      ));
      unawaited(SkipStore.write(_skipKey, state.skip));
    } catch (_) {
      emit(state.copyWith(
        loading: false,
        softFetching: false,
        error: softCommunityLoadFailed(chrome.loadFailed),
      ));
    }
  }
}
