import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/features/chat/chat_media_url.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

/// Put the caret in the message field when a chat/DM sheet opens
/// (Telegram/WhatsApp: ready to type without an extra tap).
///
/// Multi-retry after sheet enter animation - first focus is often stolen by
/// the modal route / keyboard inset animation.
void requestChatComposerFocus(
  FocusNode focus, {
  required bool enabled,
  required bool Function() mounted,
}) {
  if (!enabled) return;
  void tryFocus() {
    if (!mounted()) return;
    if (!focus.canRequestFocus) return;
    if (!focus.hasFocus) focus.requestFocus();
  }

  SchedulerBinding.instance.addPostFrameCallback((_) {
    tryFocus();
    for (final ms in const [100, 250, 400]) {
      Future<void>.delayed(Duration(milliseconds: ms), tryFocus);
    }
  });
}

/// Shared professional chat composer (reply bar + image + pill input).
class ChatComposerBar extends StatelessWidget {
  const ChatComposerBar({
    super.key,
    required this.controller,
    required this.enabled,
    required this.busy,
    required this.uploading,
    required this.placeholder,
    required this.sendLabel,
    required this.sendingLabel,
    required this.wordsLabel,
    required this.wordCount,
    required this.attachAria,
    required this.emojiAria,
    required this.removeImageAria,
    required this.replyCancelAria,
    required this.onSend,
    required this.onAttach,
    required this.onEmoji,
    required this.onChanged,
    required this.imageFallbackLabel,
    this.focusNode,
    this.autofocus = false,
    this.emojiEnabled = true,
    this.replyUsername,
    this.replyBody,
    this.onClearReply,
    this.imageUrl,
    this.onClearImage,
  });

  final TextEditingController controller;
  final FocusNode? focusNode;

  /// First-frame caret (pair with [requestChatComposerFocus] for sheet animation).
  final bool autofocus;
  final bool enabled;
  final bool busy;
  final bool uploading;
  final String placeholder;
  final String sendLabel;
  final String sendingLabel;
  final String wordsLabel;
  final int wordCount;
  final String attachAria;
  final String emojiAria;
  final String removeImageAria;
  final String replyCancelAria;
  final VoidCallback onSend;
  final VoidCallback onAttach;
  final VoidCallback onEmoji;
  final ValueChanged<String> onChanged;

  /// DB chrome `chat_image_fallback_label` - never invent English.
  final String imageFallbackLabel;
  final bool emojiEnabled;
  final String? replyUsername;
  final String? replyBody;
  final VoidCallback? onClearReply;
  final String? imageUrl;
  final VoidCallback? onClearImage;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final hasReply = (replyUsername ?? '').trim().isNotEmpty;
    final img = resolveChatMediaUrl(imageUrl ?? '');
    final canSend = enabled &&
        !busy &&
        (controller.text.trim().isNotEmpty || img.isNotEmpty);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: tokens.card,
        border: Border(top: BorderSide(color: tokens.borderSubtle)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (hasReply)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 4, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.only(left: 8),
                      decoration: BoxDecoration(
                        border: Border(
                          left: BorderSide(color: tokens.brand, width: 3),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            replyUsername!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: tokens.brand,
                            ),
                          ),
                          Text(
                            (replyBody ?? '').trim().isEmpty
                                ? imageFallbackLabel.trim()
                                : replyBody!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12,
                              color: tokens.onSurfaceMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: replyCancelAria,
                    onPressed: onClearReply,
                    icon: const Icon(Icons.close, size: 16),
                  ),
                ],
              ),
            ),
          if (img.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 4, 0),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.network(img,
                        height: 56, width: 56, fit: BoxFit.cover),
                  ),
                  IconButton(
                    tooltip: removeImageAria,
                    onPressed: onClearImage,
                    icon: const Icon(Icons.close, size: 16),
                  ),
                ],
              ),
            ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              10,
              8,
              10,
              4 + MediaQuery.paddingOf(context).bottom,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: tokens.surfaceMuted,
                      borderRadius: BorderRadius.circular(22),
                      border: Border.all(color: tokens.borderSubtle),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        IconButton(
                          tooltip: attachAria,
                          onPressed: !enabled || uploading ? null : onAttach,
                          icon: uploading
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.image_outlined, size: 20),
                        ),
                        IconButton(
                          tooltip: emojiAria,
                          onPressed: !enabled || !emojiEnabled ? null : onEmoji,
                          icon: const Icon(Icons.emoji_emotions_outlined,
                              size: 20),
                        ),
                        Expanded(
                          child: TextField(
                            controller: controller,
                            focusNode: focusNode,
                            autofocus: autofocus && enabled,
                            // Keep field enabled while sending (Telegram keep-focus).
                            enabled: enabled,
                            minLines: 1,
                            maxLines: 4,
                            decoration: InputDecoration(
                              hintText: placeholder,
                              isDense: true,
                              border: InputBorder.none,
                              contentPadding: const EdgeInsets.symmetric(
                                vertical: 10,
                                horizontal: 2,
                              ),
                            ),
                            onChanged: onChanged,
                            onSubmitted: (_) {
                              if (canSend) onSend();
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Tooltip(
                  message: busy ? sendingLabel : sendLabel,
                  child: Material(
                    color: canSend ? tokens.brand : tokens.surfaceMuted,
                    shape: const CircleBorder(),
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: canSend ? onSend : null,
                      child: SizedBox(
                        width: 42,
                        height: 42,
                        child: busy
                            ? Padding(
                                padding: const EdgeInsets.all(11),
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: tokens.onBrand,
                                ),
                              )
                            : Icon(
                                Icons.send_rounded,
                                size: 20,
                                color: canSend
                                    ? tokens.onBrand
                                    : tokens.onSurfaceMuted,
                              ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 4),
            child: Align(
              alignment: Alignment.centerRight,
              child: Text(
                '$wordsLabel: $wordCount',
                style: TextStyle(
                  color: tokens.onSurfaceMuted,
                  fontSize: 10,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
