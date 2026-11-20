import 'package:flutter/material.dart';

/// App-wide observer so MatchBoardPage can pause when covered by a pushed route
/// (Events/Ads/Leaderboard/etc) without waiting for dispose.
final RouteObserver<ModalRoute<void>> damaRouteObserver =
    RouteObserver<ModalRoute<void>>();
