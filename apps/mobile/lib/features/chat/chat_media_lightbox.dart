import 'package:dama_mobile/features/chat/chat_media_url.dart';
import 'package:flutter/material.dart';

/// Telegram-style full-screen media preview (chrome-driven close aria).
Future<void> showChatMediaLightbox(
  BuildContext context,
  String url, {
  required String title,
  required String closeAria,
}) {
  final src = resolveChatMediaUrl(url);
  final titleText = title.trim();
  final closeText = closeAria.trim();
  if (src.isEmpty || titleText.isEmpty || closeText.isEmpty) {
    return Future.value();
  }
  return showDialog<void>(
    context: context,
    barrierColor: Colors.black.withValues(alpha: 0.92),
    builder: (ctx) {
      return GestureDetector(
        onTap: () => Navigator.of(ctx).pop(),
        child: Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.all(12),
          child: Semantics(
            label: titleText,
            child: Stack(
              alignment: Alignment.center,
              children: [
                InteractiveViewer(
                  minScale: 0.8,
                  maxScale: 4,
                  child: Image.network(src, fit: BoxFit.contain),
                ),
                Positioned(
                  top: 0,
                  right: 0,
                  child: IconButton(
                    tooltip: closeText,
                    onPressed: () => Navigator.of(ctx).pop(),
                    icon: const Icon(Icons.close, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}
