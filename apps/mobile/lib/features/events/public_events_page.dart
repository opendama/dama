import 'package:dama_mobile/features/tournaments/tournaments_page.dart';
import 'package:flutter/material.dart';

/// Legacy `/events/public` entry → unified Tournaments Community (no second browse).
class PublicEventsPage extends StatelessWidget {
  const PublicEventsPage({
    super.key,
    required this.accessToken,
    this.initialJoinCode,
  });

  final String accessToken;
  final String? initialJoinCode;

  @override
  Widget build(BuildContext context) {
    return TournamentsPage(
      accessToken: accessToken,
      initialSource: 'community',
      initialJoinCode: initialJoinCode,
    );
  }
}
