import 'package:flutter/material.dart';

/// DB-backed AlertDialog shell metrics (fail closed when incomplete/invalid).
class EventsDialogShell {
  const EventsDialogShell({
    required this.maxHeightRatio,
    required this.maxWidth,
    required this.insetH,
    required this.insetV,
    required this.loadingHeight,
  });

  final double maxHeightRatio;
  final double maxWidth;
  final double insetH;
  final double insetV;
  final double loadingHeight;

  static EventsDialogShell? tryParse({
    required String maxHeightRatio,
    required String maxWidth,
    required String insetH,
    required String insetV,
    required String loadingHeight,
  }) {
    final ratio = double.tryParse(maxHeightRatio.trim());
    final width = double.tryParse(maxWidth.trim());
    final h = double.tryParse(insetH.trim());
    final v = double.tryParse(insetV.trim());
    final loading = double.tryParse(loadingHeight.trim());
    if (ratio == null ||
        ratio <= 0 ||
        ratio > 1 ||
        width == null ||
        width <= 0 ||
        h == null ||
        h < 0 ||
        v == null ||
        v < 0 ||
        loading == null ||
        loading <= 0) {
      return null;
    }
    return EventsDialogShell(
      maxHeightRatio: ratio,
      maxWidth: width,
      insetH: h,
      insetV: v,
      loadingHeight: loading,
    );
  }

  EdgeInsets get insetPadding =>
      EdgeInsets.symmetric(horizontal: insetH, vertical: insetV);

  /// Page / list padding from the same DB inset keys (fail closed).
  static EdgeInsets? pageInsets({
    required String insetH,
    required String insetV,
  }) {
    final h = double.tryParse(insetH.trim());
    final v = double.tryParse(insetV.trim());
    if (h == null || h < 0 || v == null || v < 0) return null;
    return EdgeInsets.symmetric(horizontal: h, vertical: v);
  }

  BoxConstraints constraintsFor(Size media) {
    final maxH = media.height * maxHeightRatio;
    final maxW = (media.width - insetH * 2).clamp(0.0, maxWidth);
    return BoxConstraints(maxWidth: maxW, maxHeight: maxH);
  }
}
