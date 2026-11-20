import 'dart:async';

import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/play_rail_chrome.dart';
import 'package:dama_mobile/features/chat/chat_composer_bar.dart';
import 'package:dama_mobile/features/chat/chat_emoji_catalog.dart';
import 'package:dama_mobile/features/chat/chat_emoji_catalog_api.dart';
import 'package:dama_mobile/features/chat/chat_emoji_picker.dart';
import 'package:dama_mobile/features/chat/chat_image_upload.dart';
import 'package:dama_mobile/features/chat/chat_message_bubble.dart';
import 'package:dama_mobile/features/chat/chat_outbox.dart';
import 'package:dama_mobile/features/chat/dm_api.dart';
import 'package:dama_mobile/features/chat/dm_thread_sheet.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:dama_mobile/features/game/matchmaking_realtime.dart';
import 'package:dama_mobile/widgets/dama_user_avatar.dart';
import 'package:dama_mobile/widgets/host_trust_badge.dart';
import 'package:flutter/material.dart';

/// Telegram compose: sheet pops immediately; [opened] resolves when POST finishes.
class ComposeMessageResult {
  const ComposeMessageResult({
    required this.peerName,
    required this.clientId,
    required this.opened,
    this.body,
    this.imageUrl,
  });

  final String peerName;
  final String clientId;
  final String? body;
  final String? imageUrl;
  final Future<SendDmRequestResult?> opened;
}

/// Opening shell while compose POST resolves: peer header + pending/failed outbox bubble (web parity).
Future<void> showComposeOpeningShell(
  BuildContext context, {
  required PlayRailChrome chrome,
  required ComposeMessageResult draft,
  String receipt = 'pending',
  VoidCallback? onRetry,
}) {
  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) {
      final tokens = damaColorsOf(ctx);
      final status = receipt.trim().isEmpty ? 'pending' : receipt.trim();
      return PopScope(
        canPop: false,
        child: Dialog(
          backgroundColor: tokens.card,
          insetPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
          child: SizedBox(
            width: 420,
            height: 360,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
                  child: Text(
                    draft.peerName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(ctx).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ),
                Expanded(
                  child: Align(
                    alignment: Alignment.bottomCenter,
                    child: ChatMessageBubble(
                      messageId: draft.clientId,
                      username: chrome.chatYouLabel,
                      mine: true,
                      replyActionLabel: chrome.dmReplyAction,
                      body: draft.body,
                      imageUrl: draft.imageUrl,
                      showReceipt: true,
                      youLabel: chrome.chatYouLabel,
                      replyPreviewLabel: chrome.chatReplyLabel,
                      receiptSentAria: chrome.chatReceiptSentAria,
                      receiptSeenAria: chrome.chatReceiptSeenAria,
                      receiptDeliveredAria: chrome.chatReceiptDeliveredAria,
                      receiptSentGlyph: chrome.chatReceiptSentGlyph,
                      receiptReadGlyph: chrome.chatReceiptReadGlyph,
                      receiptDeliveredGlyph: chrome.chatReceiptDeliveredGlyph,
                      receiptPendingAria: chrome.chatReceiptPendingAria,
                      receiptPendingGlyph: chrome.chatReceiptPendingGlyph,
                      receiptFailedAria: chrome.chatReceiptFailedAria,
                      receiptFailedGlyph: chrome.chatReceiptFailedGlyph,
                      receiptRetryAction: chrome.chatReceiptRetryAction,
                      receipt: status,
                      onRetry: status == 'failed' ? onRetry : null,
                      mediaLightboxTitle: chrome.chatMediaLightboxTitle,
                      mediaLightboxCloseAria: chrome.chatMediaLightboxCloseAria,
                      createdAt: DateTime.now().toUtc().toIso8601String(),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
                  child: Text(
                    chrome.dmChatLoading,
                    textAlign: TextAlign.center,
                    style:
                        TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
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

/// Shared post-compose path: opening shell → thread (or fail+retry) → next durable draft.
Future<void> followComposeMessageResult(
  BuildContext context, {
  required PlayRailChrome chrome,
  required String accessToken,
  required String userId,
  required ComposeMessageResult composed,
  ScaffoldMessengerState? messenger,
}) async {
  final token = accessToken.trim();
  final uid = userId.trim();
  if (token.isEmpty || !context.mounted) return;

  unawaited(showComposeOpeningShell(
    context,
    chrome: chrome,
    draft: composed,
  ));
  final opened = await composed.opened;
  if (context.mounted) {
    Navigator.of(context, rootNavigator: true).pop();
  }
  if (!context.mounted) return;

  if (opened == null) {
    messenger?.showSnackBar(
      SnackBar(content: Text(chrome.dmToastFailed)),
    );
    if (uid.isNotEmpty) {
      await resumeComposeOutboxIfNeeded(
        context,
        chrome: chrome,
        accessToken: token,
        userId: uid,
      );
    }
    return;
  }

  final tid = opened.threadId.trim();
  if (tid.isEmpty) return;
  await showDmThreadSheet(
    context,
    chrome: chrome,
    accessToken: token,
    threadId: tid,
    peerName: composed.peerName,
    canCompose: opened.canCompose,
  );
  if (uid.isNotEmpty && context.mounted) {
    await resumeComposeOutboxIfNeeded(
      context,
      chrome: chrome,
      accessToken: token,
      userId: uid,
    );
  }
}

/// Resume durable compose-new outbox after refresh/kill (web PlayersPanel parity).
Future<void> resumeComposeOutboxIfNeeded(
  BuildContext context, {
  required PlayRailChrome chrome,
  required String accessToken,
  required String userId,
}) async {
  final uid = userId.trim();
  final token = accessToken.trim();
  if (uid.isEmpty || token.isEmpty || !context.mounted) return;
  final items = await loadChatOutbox(uid);
  final drafts = items
      .where(
        (i) =>
            i.kind == ChatOutboxKind.dm &&
            (i.threadId ?? '').trim().isEmpty &&
            (i.toUserId ?? '').trim().isNotEmpty &&
            (i.status == ChatOutboxStatus.pending ||
                i.status == ChatOutboxStatus.failed ||
                i.status == ChatOutboxStatus.sending),
      )
      .toList();
  if (drafts.isEmpty || !context.mounted) return;
  for (final d in drafts) {
    if (d.status == ChatOutboxStatus.sending) {
      await updateChatOutboxItem(uid, d.clientId,
          status: ChatOutboxStatus.pending);
    }
  }
  drafts.sort((a, b) => a.createdAt.compareTo(b.createdAt));
  final draft = drafts.first;
  final peerName = (draft.peerName ?? '').trim();
  final toUserId = (draft.toUserId ?? '').trim();
  if (peerName.isEmpty || toUserId.isEmpty || !context.mounted) return;

  final completer = Completer<SendDmRequestResult?>();
  final result = ComposeMessageResult(
    peerName: peerName,
    clientId: draft.clientId,
    body: draft.body,
    imageUrl: draft.imageUrl,
    opened: completer.future,
  );
  final failed = draft.status == ChatOutboxStatus.failed;
  unawaited(showComposeOpeningShell(
    context,
    chrome: chrome,
    draft: result,
    receipt: failed ? 'failed' : 'pending',
    onRetry: failed
        ? () {
            unawaited(() async {
              await updateChatOutboxItem(
                uid,
                draft.clientId,
                status: ChatOutboxStatus.pending,
              );
              final retry = await sendDmRequest(
                token: token,
                toUserId: toUserId,
                body: draft.body,
                imageUrl: draft.imageUrl,
                clientId: draft.clientId,
              );
              if (retry != null) {
                await dropChatOutboxMatchingServer(uid, [draft.clientId]);
              } else {
                await updateChatOutboxItem(
                  uid,
                  draft.clientId,
                  status: ChatOutboxStatus.failed,
                );
              }
              if (!completer.isCompleted) completer.complete(retry);
            }());
          }
        : null,
  ));
  if (!failed) {
    unawaited(() async {
      final opened = await sendDmRequest(
        token: token,
        toUserId: toUserId,
        body: draft.body,
        imageUrl: draft.imageUrl,
        clientId: draft.clientId,
      );
      if (opened != null) {
        await dropChatOutboxMatchingServer(uid, [draft.clientId]);
      } else {
        await updateChatOutboxItem(uid, draft.clientId,
            status: ChatOutboxStatus.failed);
      }
      if (!completer.isCompleted) completer.complete(opened);
    }());
  }
  final opened = await result.opened;
  if (context.mounted) {
    Navigator.of(context, rootNavigator: true).pop();
  }
  if (!context.mounted) return;
  if (opened == null) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(chrome.dmToastFailed)),
    );
    return;
  }
  final tid = opened.threadId.trim();
  if (tid.isEmpty) return;
  await showDmThreadSheet(
    context,
    chrome: chrome,
    accessToken: token,
    threadId: tid,
    peerName: peerName,
    canCompose: opened.canCompose,
  );
  // Drain next durable compose-new draft (ordered offline queue).
  if (context.mounted) {
    await resumeComposeOutboxIfNeeded(
      context,
      chrome: chrome,
      accessToken: token,
      userId: uid,
    );
  }
}

Future<ComposeMessageResult?> showComposeMessageSheet(
  BuildContext context, {
  required PlayRailChrome chrome,
  required String accessToken,
  required String toUserId,
  required String username,
  String? avatarThumbUrl,
  String? hostTrustBadge,
  String? hostTrustTier,
}) {
  return showModalBottomSheet<ComposeMessageResult>(
    context: context,
    isScrollControlled: true,
    backgroundColor: damaColorsOf(context).card,
    builder: (_) => _ComposeBody(
      chrome: chrome,
      accessToken: accessToken,
      toUserId: toUserId,
      username: username,
      avatarThumbUrl: avatarThumbUrl,
      hostTrustBadge: hostTrustBadge,
      hostTrustTier: hostTrustTier,
    ),
  );
}

class _ComposeBody extends StatefulWidget {
  const _ComposeBody({
    required this.chrome,
    required this.accessToken,
    required this.toUserId,
    required this.username,
    this.avatarThumbUrl,
    this.hostTrustBadge,
    this.hostTrustTier,
  });

  final PlayRailChrome chrome;
  final String accessToken;
  final String toUserId;
  final String username;
  final String? avatarThumbUrl;
  final String? hostTrustBadge;
  final String? hostTrustTier;

  @override
  State<_ComposeBody> createState() => _ComposeBodyState();
}

class _ComposeBodyState extends State<_ComposeBody> {
  final _ctrl = TextEditingController();
  final _focus = FocusNode();
  MatchmakingRealtimeController? _avatarRt;
  int _seenAvatarSeq = 0;
  String? _liveThumb;
  String? _imageUrl;
  bool _uploading = false;
  ChatEmojiCatalog? _emojiCatalog;
  int _clientSeq = 0;

  @override
  void initState() {
    super.initState();
    _liveThumb = widget.avatarThumbUrl;
    fetchChatEmojiCatalog().then((catalog) {
      if (!mounted) return;
      setState(() => _emojiCatalog = catalog);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _bindAvatarRt());
    // Telegram compose: caret ready when the sheet opens.
    requestChatComposerFocus(
      _focus,
      enabled: true,
      mounted: () => mounted,
    );
  }

  void _bindAvatarRt() {
    if (!mounted) return;
    final rt = MatchmakingRealtimeScope.maybeOf(context);
    if (identical(rt, _avatarRt)) return;
    _avatarRt?.removeListener(_onAvatarRt);
    _avatarRt = rt;
    _avatarRt?.addListener(_onAvatarRt);
    _seenAvatarSeq = rt?.avatarEventSeq ?? 0;
  }

  void _onAvatarRt() {
    final rt = _avatarRt;
    if (rt == null || !mounted) return;
    if (rt.avatarEventSeq == _seenAvatarSeq) return;
    _seenAvatarSeq = rt.avatarEventSeq;
    final uid = (rt.lastAvatarUserId ?? '').trim();
    if (uid.isEmpty || uid != widget.toUserId.trim()) return;
    final thumb = (rt.lastAvatarThumbUrl ?? '').trim();
    final full = (rt.lastAvatarFullUrl ?? '').trim();
    final clear = thumb.isEmpty && full.isEmpty;
    setState(() {
      _liveThumb = clear ? null : (thumb.isNotEmpty ? thumb : full);
    });
  }

  @override
  void dispose() {
    _avatarRt?.removeListener(_onAvatarRt);
    _avatarRt = null;
    _ctrl.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    if (_uploading) return;
    setState(() => _uploading = true);
    final result = await pickAndUploadChatImage(
      token: widget.accessToken,
      uploadPath: '/dms/image',
    );
    if (!mounted) return;
    setState(() {
      _uploading = false;
      if (result.kind == ChatImagePickKind.ok) _imageUrl = result.url;
    });
    if (result.kind == ChatImagePickKind.cancelled) return;
    if (result.kind == ChatImagePickKind.notImage) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(widget.chrome.chatImageOnlyHint)),
      );
      return;
    }
    if (result.kind == ChatImagePickKind.failed) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(widget.chrome.dmToastFailed)),
      );
    }
  }

  void _send() {
    final body = _ctrl.text.trim();
    final image = (_imageUrl ?? '').trim();
    if (_uploading) return;
    if (body.isEmpty && image.isEmpty) return;
    final clientId =
        'local-${DateTime.now().microsecondsSinceEpoch}-${_clientSeq++}';
    final uid = (context.read<AuthCubit>().state.userId ?? '').trim();
    // Telegram: durable outbox + clear/close; POST resolves via [ComposeMessageResult.opened].
    _ctrl.clear();
    setState(() => _imageUrl = null);
    final completer = Completer<SendDmRequestResult?>();
    Navigator.of(context).pop(
      ComposeMessageResult(
        peerName: widget.username,
        clientId: clientId,
        body: body.isEmpty ? null : body,
        imageUrl: image.isEmpty ? null : image,
        opened: completer.future,
      ),
    );
    unawaited(() async {
      if (uid.isNotEmpty) {
        await enqueueChatOutbox(
          uid,
          ChatOutboxItem(
            clientId: clientId,
            kind: ChatOutboxKind.dm,
            toUserId: widget.toUserId,
            body: body.isEmpty ? null : body,
            imageUrl: image.isEmpty ? null : image,
            peerName: widget.username,
            status: ChatOutboxStatus.pending,
            createdAt: DateTime.now().toUtc().toIso8601String(),
          ),
        );
      }
      final result = await sendDmRequest(
        token: widget.accessToken,
        toUserId: widget.toUserId,
        body: body.isEmpty ? null : body,
        imageUrl: image.isEmpty ? null : image,
        clientId: clientId,
      );
      if (uid.isNotEmpty) {
        if (result != null) {
          await dropChatOutboxMatchingServer(uid, [clientId]);
        } else {
          await updateChatOutboxItem(
            uid,
            clientId,
            status: ChatOutboxStatus.failed,
          );
        }
      }
      if (!completer.isCompleted) completer.complete(result);
    }());
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final c = widget.chrome;
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    final thumb = (_liveThumb ?? widget.avatarThumbUrl ?? '').trim();
    final wordCount = () {
      final t = _ctrl.text.trim();
      if (t.isEmpty) return 0;
      return t.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).length;
    }();
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(c.dmModalTitle,
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                Row(
                  children: [
                    DamaUserAvatar(
                      imageUrl: thumb.isNotEmpty ? thumb : null,
                      radius: 20,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.username,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          HostTrustBadge(
                            label: widget.hostTrustBadge,
                            tier: widget.hostTrustTier,
                            fontSize: 10,
                            dense: true,
                          ),
                        ],
                      ),
                    ),
                    Icon(Icons.mail_outline,
                        color: tokens.onSurfaceMuted, size: 18),
                  ],
                ),
              ],
            ),
          ),
          ChatComposerBar(
            controller: _ctrl,
            focusNode: _focus,
            autofocus: true,
            enabled: true,
            busy: _uploading,
            uploading: _uploading,
            placeholder: c.dmInputPlaceholder,
            sendLabel: c.dmSendAction,
            sendingLabel: c.dmSending,
            wordsLabel: c.dmWordsLabel,
            wordCount: wordCount,
            attachAria: c.dmAttachImageAria,
            emojiAria: c.dmEmojiAria,
            removeImageAria: c.removeImageAria,
            replyCancelAria: c.dmReplyCancel,
            imageUrl: _imageUrl,
            onClearImage: () => setState(() => _imageUrl = null),
            onChanged: (_) => setState(() {}),
            imageFallbackLabel: c.chatImageFallbackLabel,
            emojiEnabled: _emojiCatalog != null,
            onAttach: () => unawaited(_pickImage()),
            onEmoji: () {
              final catalog = _emojiCatalog;
              if (catalog == null) return;
              unawaited(showChatEmojiPicker(
                context,
                catalog: catalog,
                searchPlaceholder: c.chatEmojiSearchPlaceholder,
                searchEmptyLabel: c.chatEmojiSearchEmpty,
                resultsPrefix: c.chatEmojiResultsPrefix,
                ariaLabel: c.dmEmojiAria,
                onPick: (e) => setState(() => _ctrl.text = '${_ctrl.text}$e'),
              ));
            },
            onSend: _send,
          ),
        ],
      ),
    );
  }
}
