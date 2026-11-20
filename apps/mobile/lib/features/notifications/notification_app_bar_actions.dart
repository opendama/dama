import 'dart:async';

import 'package:dama_mobile/core/theme/theme_toggle_button.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/notifications/notification_bell.dart';
import 'package:dama_mobile/features/notifications/notification_href_nav.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// Shared AppBar trailing actions: notification bell (when signed in) + theme.
class NotificationAppBarActions extends StatelessWidget {
  const NotificationAppBarActions({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthCubit, AuthState>(
      buildWhen: (a, b) =>
          a.token != b.token || a.isAuthenticated != b.isAuthenticated,
      builder: (context, state) {
        final token = (state.token ?? '').trim();
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (state.isAuthenticated && token.isNotEmpty)
              NotificationBellButton(
                accessToken: token,
                onNavigateHref: (href) {
                  unawaited(
                    navigateNotificationHref(
                      context,
                      href: href,
                      accessToken: token,
                    ),
                  );
                },
              ),
            const ThemeToggleButton(),
          ],
        );
      },
    );
  }
}
