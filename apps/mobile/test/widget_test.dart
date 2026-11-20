import 'package:dama_mobile/app.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('DamaApp builds', (WidgetTester tester) async {
    await tester.pumpWidget(const DamaApp());
    expect(find.byType(DamaApp), findsOneWidget);
  });
}
