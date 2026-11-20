import 'package:dama_mobile/features/home/home_page.dart';
import 'package:dama_mobile/features/player/player_inspect_sheet.dart';
import 'package:flutter/material.dart';

/// Navigate to Home Create Game with a fixed opponent chip (Chess.com Challenge).
Future<void> openCreateGameChallenge(
  BuildContext context,
  PlayerChallengeRequest req,
) async {
  await Navigator.of(context).push(
    MaterialPageRoute(
      builder: (_) => HomePage(
        launchUri: Uri(
          path: '/',
          queryParameters: {
            'view': 'match',
            'opponent': req.username,
            'opponentId': req.id,
            'opponentRating': '${req.rating}',
            if ((req.countryCode ?? '').trim().isNotEmpty)
              'opponentCountry': req.countryCode!.trim().toUpperCase(),
            if ((req.hostTrustBadge ?? '').trim().isNotEmpty)
              'opponentHostTrustBadge': req.hostTrustBadge!.trim(),
            if ((req.hostTrustTier ?? '').trim().isNotEmpty)
              'opponentHostTrustTier': req.hostTrustTier!.trim(),
          },
        ),
      ),
    ),
  );
}
