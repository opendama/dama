import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

/// Telegram-style pin to the newest message (end of a top→bottom ListView).
void scrollChatToLatest(
  ScrollController controller, {
  bool animate = false,
}) {
  void apply() {
    if (!controller.hasClients) return;
    final max = controller.position.maxScrollExtent;
    if (animate) {
      controller.animateTo(
        max,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
      );
    } else {
      controller.jumpTo(max);
    }
  }

  apply();
  // After layout (new bubble height, date chip, composer collapse).
  SchedulerBinding.instance.addPostFrameCallback((_) {
    apply();
    SchedulerBinding.instance.addPostFrameCallback((_) => apply());
  });
}

bool isChatNearBottom(ScrollController controller, {double thresholdPx = 96}) {
  if (!controller.hasClients) return true;
  final pos = controller.position;
  return pos.maxScrollExtent - pos.pixels <= thresholdPx;
}
