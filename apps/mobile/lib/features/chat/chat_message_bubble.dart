import 'dart:async';

import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/ui/country_flag.dart';
import 'package:dama_mobile/features/chat/chat_emoji_catalog.dart';
import 'package:dama_mobile/features/chat/chat_emoji_picker.dart';
import 'package:dama_mobile/features/chat/chat_emoji_style.dart';
import 'package:dama_mobile/features/chat/chat_media_lightbox.dart';
import 'package:dama_mobile/features/chat/chat_media_url.dart';
import 'package:dama_mobile/features/chat/chat_time.dart';
import 'package:dama_mobile/widgets/dama_user_avatar.dart';
import 'package:flutter/material.dart';

class ChatReactionAgg {
  const ChatReactionAgg({
    required this.emoji,
    required this.count,
    required this.reacted,
  });

  final String emoji;
  final int count;
  final bool reacted;

  static ChatReactionAgg? fromJson(Map<String, dynamic> json) {
    final emoji = (json['emoji'] as String?)?.trim() ?? '';
    if (emoji.isEmpty) return null;
    final count = json['count'] is num ? (json['count'] as num).toInt() : 0;
    return ChatReactionAgg(
      emoji: emoji,
      count: count,
      reacted: json['reacted'] == true,
    );
  }
}

/// Sent (mine) on the left; received on the right.
class ChatMessageBubble extends StatelessWidget {
  const ChatMessageBubble({
    super.key,
    required this.messageId,
    required this.username,
    required this.mine,
    required this.replyActionLabel,
    this.body,
    this.imageUrl,
    this.replyPreview,
    this.replyToId,
    this.avatarThumbUrl,
    this.countryCode,
    this.reactions = const [],
    this.receipt,
    this.seenCount = 0,
    this.seenTotal = 0,
    this.showReceipt = false,
    this.showSeenCount = false,
    this.highlighted = false,
    this.onSenderTap,
    this.onReply,
    this.onJumpToReply,
    this.onReact,
    this.canReact = false,
    this.emojiCatalog,
    this.youLabel = '',
    this.replyPreviewLabel = '',
    this.reactActionLabel = '',
    this.reactMoreAria = '',
    this.emojiSearchPlaceholder = '',
    this.emojiSearchEmpty = '',
    this.emojiResultsPrefix = '',
    this.receiptSentAria = '',
    this.receiptSeenAria = '',
    this.receiptDeliveredAria = '',
    this.seenByPrefix = '',
    this.receiptSentGlyph = '',
    this.receiptReadGlyph = '',
    this.receiptDeliveredGlyph = '',
    this.seenCountGlyph = '',
    this.receiptPendingAria = '',
    this.receiptPendingGlyph = '',
    this.receiptFailedAria = '',
    this.receiptFailedGlyph = '',
    this.receiptRetryAction = '',
    this.onRetry,
    this.mediaLightboxTitle = '',
    this.mediaLightboxCloseAria = '',
    this.createdAt,
  });

  final String messageId;
  final String username;
  final bool mine;
  final String replyActionLabel;
  final String? body;
  final String? imageUrl;
  final String? replyPreview;
  final String? replyToId;
  final String? avatarThumbUrl;
  final String? countryCode;
  final List<ChatReactionAgg> reactions;
  final String? receipt;
  final int seenCount;
  final int seenTotal;
  final bool showReceipt;
  final bool showSeenCount;
  final bool highlighted;

  /// Opens player inspect sheet (friend / message / challenge) - web hover-card parity.
  final VoidCallback? onSenderTap;
  final VoidCallback? onReply;
  final void Function(String replyToId)? onJumpToReply;
  final void Function(String emoji)? onReact;
  final bool canReact;
  final ChatEmojiCatalog? emojiCatalog;
  final String youLabel;
  final String replyPreviewLabel;
  final String reactActionLabel;
  final String reactMoreAria;
  final String emojiSearchPlaceholder;
  final String emojiSearchEmpty;
  final String emojiResultsPrefix;
  final String receiptSentAria;
  final String receiptSeenAria;
  final String receiptDeliveredAria;
  final String seenByPrefix;
  final String receiptSentGlyph;
  final String receiptReadGlyph;
  final String receiptDeliveredGlyph;
  final String seenCountGlyph;

  /// Required (non-empty chrome) when showing outbox pending/failed states.
  final String receiptPendingAria;
  final String receiptPendingGlyph;
  final String receiptFailedAria;
  final String receiptFailedGlyph;
  final String receiptRetryAction;

  /// Failed outbox bubble tap → retry same clientId.
  final VoidCallback? onRetry;
  final String mediaLightboxTitle;
  final String mediaLightboxCloseAria;

  /// ISO timestamp from API (`created_at`) for Telegram-style bubble clock.
  final String? createdAt;

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final preview = (replyPreview ?? '').trim();
    final jumpId = (replyToId ?? '').trim();
    final you = youLabel.trim();
    final replyLabel = replyPreviewLabel.trim();
    final resolvedImage = resolveChatMediaUrl(imageUrl ?? '');
    final wallpaperPeer = Color.lerp(tokens.surfaceMuted, tokens.bone, 0.35)!;
    final mineBg = tokens.card;
    final peerBg = wallpaperPeer;
    final seenNums = seenTotal > 0 && seenTotal >= seenCount
        ? '$seenCount/$seenTotal'
        : '$seenCount';
    final seenPrefix = seenByPrefix.trim();
    final seenSemantics =
        seenPrefix.isEmpty ? seenNums : '$seenPrefix $seenNums';
    final timeLabel = formatChatMessageTime(createdAt);
    // 1:1 ticks: ✓ sent until peer read; ✓✓ brand when read.
    // "delivered" must not look like premature seen - same single tick as sent.
    final receiptStatus = (receipt ?? '').trim();
    final receiptPending =
        receiptStatus == 'pending' || receiptStatus == 'sending';
    final receiptFailed = receiptStatus == 'failed';
    final receiptIsRead = receiptStatus == 'read';
    final receiptIsDelivered = receiptStatus == 'delivered';
    final receiptKnown =
        receiptStatus == 'sent' || receiptIsDelivered || receiptIsRead;
    final receiptGlyph =
        receiptIsRead ? receiptReadGlyph.trim() : receiptSentGlyph.trim();
    final receiptSemantics =
        receiptIsRead ? receiptSeenAria.trim() : receiptSentAria.trim();
    final pendingGlyph = receiptPendingGlyph.trim();
    final pendingAria = receiptPendingAria.trim();
    final failedGlyph = receiptFailedGlyph.trim();
    final failedAria = receiptFailedAria.trim();
    final retryAction = receiptRetryAction.trim();
    final canRetryFailed = mine && receiptFailed && onRetry != null;
    final showMetaRow = timeLabel.isNotEmpty ||
        (showReceipt && mine) ||
        showSeenCount ||
        (mine && (receiptPending || receiptFailed));

    final avatarFace = DamaUserAvatar(imageUrl: avatarThumbUrl, radius: 14);
    final avatar = onSenderTap == null
        ? avatarFace
        : InkWell(
            onTap: onSenderTap,
            customBorder: const CircleBorder(),
            child: avatarFace,
          );

    final bubble = AnimatedContainer(
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOut,
      decoration: BoxDecoration(
        color: highlighted
            ? tokens.brand.withValues(alpha: 0.12)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      child: Row(
        mainAxisAlignment:
            mine ? MainAxisAlignment.start : MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (mine) ...[avatar, const SizedBox(width: 8)],
          Flexible(
            child: Column(
              crossAxisAlignment:
                  mine ? CrossAxisAlignment.start : CrossAxisAlignment.end,
              children: [
                Padding(
                  padding: const EdgeInsets.only(left: 4, bottom: 2, right: 4),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Flexible(
                        child: Text(
                          mine && you.isNotEmpty ? you : username,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: tokens.onSurfaceMuted,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (!mine && (countryCode ?? '').trim().isNotEmpty) ...[
                        const SizedBox(width: 4),
                        CountryFlag(code: countryCode, height: 10),
                      ],
                    ],
                  ),
                ),
                Container(
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.sizeOf(context).width * 0.72,
                  ),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: mine ? mineBg : peerBg,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(16),
                      topRight: const Radius.circular(16),
                      bottomLeft: Radius.circular(mine ? 4 : 16),
                      bottomRight: Radius.circular(mine ? 16 : 4),
                    ),
                    border: Border.all(color: tokens.borderSubtle),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (preview.isNotEmpty)
                        InkWell(
                          onTap: jumpId.isNotEmpty && onJumpToReply != null
                              ? () => onJumpToReply!(jumpId)
                              : null,
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            width: double.infinity,
                            margin: const EdgeInsets.only(bottom: 6),
                            padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
                            decoration: BoxDecoration(
                              color: tokens.surfaceMuted.withValues(alpha: 0.7),
                              borderRadius: BorderRadius.circular(8),
                              border: Border(
                                left: BorderSide(color: tokens.brand, width: 3),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (replyLabel.isNotEmpty)
                                  Text(
                                    replyLabel,
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: tokens.brand,
                                    ),
                                  ),
                                Text(
                                  preview,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                      fontSize: 11,
                                      color: tokens.onSurfaceMuted),
                                ),
                              ],
                            ),
                          ),
                        ),
                      if (resolvedImage.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: GestureDetector(
                            onTap: () => showChatMediaLightbox(
                              context,
                              resolvedImage,
                              title: mediaLightboxTitle,
                              closeAria: mediaLightboxCloseAria,
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.network(
                                resolvedImage,
                                height: 140,
                                fit: BoxFit.cover,
                              ),
                            ),
                          ),
                        ),
                      if ((body ?? '').trim().isNotEmpty)
                        Text(
                          _telegramSoftWrap(body!),
                          softWrap: true,
                          style: const TextStyle(fontSize: 14, height: 1.35),
                        ),
                      if (showMetaRow)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (showSeenCount &&
                                  seenCount > 0 &&
                                  seenCountGlyph.trim().isNotEmpty) ...[
                                Semantics(
                                  label: seenSemantics,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: tokens.surfaceMuted,
                                      borderRadius: BorderRadius.circular(999),
                                      border: Border.all(
                                          color: tokens.borderSubtle),
                                    ),
                                    child: Text(
                                      '${seenCountGlyph.trim()} $seenNums',
                                      style: TextStyle(
                                          fontSize: 10,
                                          color: tokens.onSurfaceMuted),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 6),
                              ],
                              if (timeLabel.isNotEmpty) ...[
                                Text(
                                  timeLabel,
                                  style: TextStyle(
                                    fontSize: 10,
                                    height: 1,
                                    color: tokens.onSurfaceMuted
                                        .withValues(alpha: 0.9),
                                    fontFeatures: const [
                                      FontFeature.tabularFigures()
                                    ],
                                  ),
                                ),
                                if (showReceipt && mine)
                                  const SizedBox(width: 4),
                              ],
                              if (mine &&
                                  receiptPending &&
                                  pendingGlyph.isNotEmpty &&
                                  pendingAria.isNotEmpty)
                                Semantics(
                                  label: pendingAria,
                                  child: Text(
                                    pendingGlyph,
                                    style: TextStyle(
                                      fontSize: 11,
                                      height: 1,
                                      color: tokens.onSurfaceMuted
                                          .withValues(alpha: 0.9),
                                    ),
                                  ),
                                )
                              else if (mine &&
                                  receiptFailed &&
                                  failedGlyph.isNotEmpty &&
                                  failedAria.isNotEmpty)
                                Semantics(
                                  label: retryAction.isNotEmpty
                                      ? '$failedAria. $retryAction'
                                      : failedAria,
                                  button: canRetryFailed,
                                  child: Text(
                                    failedGlyph,
                                    style: TextStyle(
                                      fontSize: 11,
                                      height: 1,
                                      fontWeight: FontWeight.w700,
                                      color: tokens.danger,
                                    ),
                                  ),
                                )
                              else if (showReceipt &&
                                  mine &&
                                  receiptKnown &&
                                  receiptGlyph.isNotEmpty &&
                                  receiptSemantics.isNotEmpty)
                                Semantics(
                                  label: receiptSemantics,
                                  child: Text(
                                    receiptGlyph,
                                    style: TextStyle(
                                      fontSize: 11,
                                      height: 1,
                                      letterSpacing: -1.2,
                                      color: receiptIsRead
                                          ? tokens.brand
                                          : tokens.onSurfaceMuted,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                if (reactions.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Wrap(
                      spacing: 4,
                      runSpacing: 4,
                      alignment: mine ? WrapAlignment.start : WrapAlignment.end,
                      children: [
                        for (final r in reactions)
                          // Own reaction: tap deletes anytime. Peer chips are display-only
                          // (add/replace via React → full emoji picker; one per user).
                          InkWell(
                            onTap: canReact && onReact != null && r.reacted
                                ? () => onReact!(r.emoji)
                                : null,
                            borderRadius: BorderRadius.circular(999),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: r.reacted
                                    ? tokens.brand.withValues(alpha: 0.15)
                                    : tokens.card.withValues(alpha: 0.9),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(
                                  color: r.reacted
                                      ? tokens.brand.withValues(alpha: 0.45)
                                      : tokens.borderSubtle,
                                ),
                              ),
                              child: Text(
                                '${r.emoji} ${r.count}',
                                style: chatEmojiTextStyle(fontSize: 11),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                if (onReply != null ||
                    (canReact &&
                        onReact != null &&
                        emojiCatalog != null &&
                        reactActionLabel.trim().isNotEmpty))
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (onReply != null)
                          TextButton.icon(
                            onPressed: onReply,
                            icon: Icon(Icons.reply,
                                size: 14, color: tokens.brand),
                            label: Text(
                              replyActionLabel,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: tokens.brand,
                              ),
                            ),
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 4),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              visualDensity: VisualDensity.compact,
                            ),
                          ),
                        if (canReact &&
                            onReact != null &&
                            emojiCatalog != null &&
                            reactActionLabel.trim().isNotEmpty)
                          TextButton.icon(
                            onPressed: () =>
                                unawaited(_openReactPicker(context)),
                            icon: Icon(
                              Icons.add_reaction_outlined,
                              size: 14,
                              color: tokens.onSurfaceMuted,
                            ),
                            label: Text(
                              reactActionLabel,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: tokens.onSurfaceMuted,
                              ),
                            ),
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 4),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              visualDensity: VisualDensity.compact,
                            ),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          if (!mine) ...[const SizedBox(width: 8), avatar],
        ],
      ),
    );

    if (!canRetryFailed) return bubble;
    return Semantics(
      button: true,
      label: retryAction.isNotEmpty
          ? (failedAria.isNotEmpty ? '$failedAria. $retryAction' : retryAction)
          : failedAria,
      child: GestureDetector(
        onTap: onRetry,
        behavior: HitTestBehavior.opaque,
        child: bubble,
      ),
    );
  }

  /// Same full catalog sheet as the composer emoji control (search + categories).
  Future<void> _openReactPicker(BuildContext context) async {
    final catalog = emojiCatalog;
    if (catalog == null || onReact == null) return;
    final label = reactActionLabel.trim().isNotEmpty
        ? reactActionLabel.trim()
        : reactMoreAria.trim();
    // Fail-closed: chrome must supply react aria (no English hardcoded fallback).
    if (label.isEmpty) return;
    await showChatEmojiPicker(
      context,
      catalog: catalog,
      searchPlaceholder: emojiSearchPlaceholder,
      searchEmptyLabel: emojiSearchEmpty,
      resultsPrefix: emojiResultsPrefix,
      ariaLabel: label,
      onPick: onReact!,
    );
  }
}

/// Insert zero-width spaces so unbroken runs wrap inside the bubble (Telegram-style).
String _telegramSoftWrap(String input) {
  final buf = StringBuffer();
  var run = 0;
  for (final rune in input.runes) {
    final ch = String.fromCharCode(rune);
    if (ch.trim().isEmpty || ch == '\n') {
      run = 0;
      buf.write(ch);
      continue;
    }
    run += 1;
    buf.write(ch);
    if (run >= 24) {
      buf.write('\u200b');
      run = 0;
    }
  }
  return buf.toString();
}
