import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/auth/login_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// Fail-closed app gate: unauthenticated users see social login only (no shell).
class AuthGate extends StatelessWidget {
  const AuthGate({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthCubit, AuthState>(
      buildWhen: (prev, next) => prev.isAuthenticated != next.isAuthenticated,
      builder: (context, state) {
        if (!state.isAuthenticated) {
          return const LoginPage(asRoot: true);
        }
        return child;
      },
    );
  }
}
