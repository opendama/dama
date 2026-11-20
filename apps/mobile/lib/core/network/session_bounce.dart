import 'package:dama_mobile/features/auth/auth_cubit.dart';

/// Global 401 handler (wired from [main] with [AuthCubit]).
Future<void> Function()? _onUnauthorized;

void setUnauthorizedHandler(Future<void> Function()? handler) {
  _onUnauthorized = handler;
}

/// Clear session when an authenticated request returns 401 (web session-bounce parity).
Future<void> bounceOnUnauthorized({required bool hadToken}) async {
  if (!hadToken) return;
  final handler = _onUnauthorized;
  if (handler != null) {
    await handler();
    return;
  }
}

/// Convenience for AuthCubit wiring.
Future<void> bounceUnauthorizedWithCubit(AuthCubit cubit,
    {required bool hadToken}) async {
  if (!hadToken) return;
  await cubit.logout();
}
