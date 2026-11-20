import 'package:dama_mobile/core/lib/est_prize_share.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const places = 'places_percent';
  const score = 'score_share';
  const dual = 'dual_purse';
  final percents = <String, dynamic>{'1': 50, '2': 30, '3': 20};

  test('places_percent pays finish share of full pot', () {
    expect(
      computeEstPrizeShare(
        mode: places,
        placesMode: places,
        scoreMode: score,
        potNow: 200,
        myPlacement: 1,
        placePercents: percents,
        myPoints: null,
        totalPoints: null,
      ),
      100,
    );
  });

  test('score_share pays pot×points/total', () {
    expect(
      computeEstPrizeShare(
        mode: score,
        placesMode: places,
        scoreMode: score,
        potNow: 180,
        myPoints: 2,
        totalPoints: 3,
        myPlacement: null,
        placePercents: null,
      ),
      120,
    );
  });

  test('dual_purse merges place purse + performance purse', () {
    expect(
      computeEstPrizeShare(
        mode: dual,
        placesMode: places,
        scoreMode: score,
        dualMode: dual,
        dualPlacePursePercent: 50,
        potNow: 200,
        myPlacement: 1,
        placePercents: percents,
        myPoints: 2,
        totalPoints: 3,
      ),
      116.67,
    );
  });

  test('dual_purse pays performance-only when not in the money', () {
    expect(
      computeEstPrizeShare(
        mode: dual,
        placesMode: places,
        scoreMode: score,
        dualMode: dual,
        dualPlacePursePercent: 50,
        potNow: 200,
        myPlacement: 4,
        placePercents: percents,
        myPoints: 1,
        totalPoints: 1,
      ),
      100,
    );
  });

  test('dual_purse fail-closes without place-purse percent', () {
    expect(
      computeEstPrizeShare(
        mode: dual,
        placesMode: places,
        scoreMode: score,
        dualMode: dual,
        dualPlacePursePercent: null,
        potNow: 200,
        myPlacement: 1,
        placePercents: percents,
        myPoints: 1,
        totalPoints: 1,
      ),
      isNull,
    );
  });

  test(
      'dual_purse with zero total points uses full-pot places% (server parity)',
      () {
    expect(
      computeEstPrizeShare(
        mode: dual,
        placesMode: places,
        scoreMode: score,
        dualMode: dual,
        dualPlacePursePercent: 50,
        potNow: 200,
        myPlacement: 1,
        placePercents: percents,
        myPoints: 0,
        totalPoints: 0,
      ),
      100,
    );
  });
}
