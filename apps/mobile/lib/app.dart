import 'dart:convert';

import 'package:dama_mobile/core/nav/dama_route_observer.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/network/session_bounce.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/theme/theme_cubit.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/features/app/onboarding_gate.dart';
import 'package:dama_mobile/features/app/splash_gate.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/auth/auth_gate.dart';
import 'package:dama_mobile/features/auth/otp_gate.dart';
import 'package:dama_mobile/features/auth/session_security.dart';
import 'package:dama_mobile/features/game/matchmaking_realtime.dart';
import 'package:dama_mobile/features/home/floating_resume_host.dart';
import 'package:dama_mobile/features/home/player_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;

class DamaApp extends StatefulWidget {
  const DamaApp({super.key});

  @override
  State<DamaApp> createState() => _DamaAppState();
}

class _DamaAppState extends State<DamaApp> {
  String _brandName = '';

  @override
  void initState() {
    super.initState();
    _loadBrand();
  }

  Future<void> _loadBrand() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/platform/client-nav'),
      );
      if (res.statusCode >= 300) return;
      final payload = ClientNavPayload.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      if (!mounted) return;
      setState(() => _brandName = payload.brandName);
    } catch (_) {
      // Fail closed: empty MaterialApp title when brand chrome is unavailable.
    }
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(
          create: (ctx) {
            final cubit = AuthCubit();
            setUnauthorizedHandler(() => cubit.logout());
            return cubit;
          },
        ),
        BlocProvider(create: (_) => ThemeCubit()),
      ],
      child: BlocBuilder<ThemeCubit, ThemeMode>(
        builder: (context, themeMode) {
          return MaterialApp(
            title: _brandName,
            debugShowCheckedModeBanner: false,
            theme: buildDamaTheme(Brightness.light),
            darkTheme: buildDamaTheme(Brightness.dark),
            themeMode: themeMode,
            navigatorObservers: [damaRouteObserver],
            builder: (context, child) {
              return Stack(
                fit: StackFit.expand,
                children: [
                  if (child != null) Positioned.fill(child: child),
                  const FloatingResumeHost(),
                ],
              );
            },
            home: const SplashGate(
              child: OnboardingGate(
                child: AuthGate(
                  child: SessionSecurity(
                    child: OtpGate(
                      child: MatchmakingRealtimeHost(child: PlayerShell()),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
