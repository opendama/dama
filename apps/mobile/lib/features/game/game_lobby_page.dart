import 'dart:convert';

import 'package:dama_mobile/core/cache/query_cache.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/features/notifications/notification_app_bar_actions.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/chrome_select_sheet.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/auth/sign_in_dialog.dart';
import 'package:dama_mobile/features/game/cubit/feature_flags_cubit.dart';
import 'package:dama_mobile/features/game/match_board_page.dart';
import 'package:dama_mobile/features/game/matchmaking_page.dart';
import 'package:dama_mobile/widgets/player_rail_menu_leading.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;

class GameLobbyPage extends StatefulWidget {
  const GameLobbyPage({super.key});

  @override
  State<GameLobbyPage> createState() => _GameLobbyPageState();
}

class _GameLobbyPageState extends State<GameLobbyPage> {
  int? _selectedDepth;
  PlayChrome? _chrome;
  String? _chromeError;
  bool _chromeLoading = true;

  @override
  void initState() {
    super.initState();
    _loadPlayChrome();
  }

  Future<void> _loadPlayChrome() async {
    // Platform-tier paint first (web play-chrome / lists parity): no remount shimmer.
    final cached = QueryCache.read<PlayChrome>(
      CacheKeys.playChrome,
      maxAge: QueryCache.platformTtl,
      allowStale: true,
    );
    if (cached != null && mounted) {
      setState(() {
        _chrome = cached;
        _chromeLoading = false;
        _chromeError = null;
      });
    }
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.defaults.restUrl}/public/play-chrome'),
      );
      Map<String, dynamic>? map;
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) map = decoded;
      } catch (_) {}
      final fromBody =
          (map?['play_chrome_unavailable'] as String?)?.trim() ?? '';
      if (res.statusCode != 200) {
        if (cached != null) return;
        if (!mounted) return;
        setState(() {
          _chromeLoading = false;
          _chromeError = fromBody.isNotEmpty
              ? fromBody
              : ((map?['error'] as String?)?.trim() ?? '');
        });
        return;
      }
      final chrome = PlayChrome.fromJson(map);
      if (chrome != null) {
        QueryCache.write(CacheKeys.playChrome, chrome);
      }
      if (!mounted) return;
      setState(() {
        _chrome = chrome;
        _chromeLoading = false;
        _chromeError = chrome == null ? fromBody : null;
      });
    } catch (_) {
      if (cached != null) return;
      if (!mounted) return;
      setState(() {
        _chromeLoading = false;
        _chromeError = '';
      });
    }
  }

  Future<String?> _ensureToken() async {
    var token = context.read<AuthCubit>().state.token;
    if (token == null || token.isEmpty) {
      token = await showSignInDialog(context);
    }
    return token;
  }

  @override
  Widget build(BuildContext context) {
    final chrome = _chrome;
    if (_chromeLoading || chrome == null) {
      return Scaffold(
        appBar: AppBar(
          leading: PlayerRailMenuLeading.maybe(context),
          actions: const [NotificationAppBarActions()],
        ),
        body: _chromeError != null
            ? Center(child: Text(_chromeError!))
            : const GameLobbySkeleton(),
      );
    }

    return BlocProvider(
      create: (ctx) {
        final token = ctx.read<AuthCubit>().state.token;
        return FeatureFlagsCubit()..load(accessToken: token);
      },
      child: Scaffold(
        appBar: AppBar(
          leading: PlayerRailMenuLeading.maybe(context),
          title: Text(chrome.lobbyTitle),
          actions: const [NotificationAppBarActions()],
        ),
        body: BlocConsumer<FeatureFlagsCubit, FeatureFlagsState>(
          listener: (context, state) {
            if (state.aiDepths.isEmpty) {
              setState(() => _selectedDepth = null);
              return;
            }
            if (_selectedDepth == null ||
                !state.aiDepths.contains(_selectedDepth)) {
              setState(() => _selectedDepth = state.aiDepths.first);
            }
          },
          builder: (context, state) {
            if (state.loading) {
              return const GameLobbySkeleton();
            }
            if (state.error != null) {
              return Center(child: Text(state.error!));
            }
            return Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    chrome.lobbyModesBlurb,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: () async {
                      final token = await _ensureToken();
                      if (!context.mounted || token == null || token.isEmpty)
                        return;
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => MatchmakingPage(token: token),
                        ),
                      );
                    },
                    child: Text(chrome.find1v1Action),
                  ),
                  const SizedBox(height: 16),
                  if (state.vsAiEnabled) ...[
                    ChromeSelectField(
                      label: chrome.practiceDepthLabel,
                      valueLabel: _selectedDepth == null
                          ? ''
                          : '${chrome.depthOptionPrefix} $_selectedDepth',
                      enabled: state.aiDepths.isNotEmpty,
                      onTap: () async {
                        final picked = await showChromeOptionSheet<int>(
                          context: context,
                          title: chrome.practiceDepthLabel,
                          options: [
                            for (final d in state.aiDepths)
                              ChromeSelectOption(
                                value: d,
                                label: '${chrome.depthOptionPrefix} $d',
                              ),
                          ],
                          selected: _selectedDepth,
                        );
                        if (picked != null) {
                          setState(() => _selectedDepth = picked);
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _selectedDepth == null
                          ? null
                          : () async {
                              final token = await _ensureToken();
                              if (!context.mounted ||
                                  token == null ||
                                  token.isEmpty) {
                                return;
                              }
                              final depth = _selectedDepth;
                              if (depth == null) return;
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => MatchBoardPage(
                                    accessToken: token,
                                    aiDepth: depth,
                                  ),
                                ),
                              );
                            },
                      child: Text(chrome.playComputerAction),
                    ),
                  ] else
                    Text(chrome.practiceUnavailableShort),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
