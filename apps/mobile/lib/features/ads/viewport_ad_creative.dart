import 'package:dama_mobile/core/ads/resolve_viewport_creative.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/ads.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Player-facing creative: viewport pick, YouTube embed, or image with contain.
class ViewportAdCreative extends StatelessWidget {
  const ViewportAdCreative({
    super.key,
    required this.source,
    this.breakpoints,
    this.scheduleChrome,
    this.maxWidth = 420,
  });

  final ViewportCreativeSource source;
  final ViewportBreakpoints? breakpoints;
  final Map<String, String>? scheduleChrome;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    final bp = breakpoints;
    if (bp == null) {
      return const SizedBox.shrink();
    }
    final width = MediaQuery.sizeOf(context).width;
    final requested = resolveViewportSlot(width, bp);
    final picked = pickCampaignCreative(source, requested);
    final slot = displayViewportSlot(picked.usedSlot, picked.requestedSlot);
    final aspect = viewportAspectRatioFromLabel(
      viewportRatioLabelForSlot(scheduleChrome, slot),
    );
    if (aspect == null) {
      return const SizedBox.shrink();
    }
    final imageSrc = resolvePublicMediaUrl(picked.imageUrl).isNotEmpty
        ? resolvePublicMediaUrl(picked.imageUrl)
        : picked.imageUrl;
    var videoId = picked.videoId.trim();
    if (isStubVideoId(videoId)) videoId = '';
    final tokens = damaColorsOf(context);

    if (videoId.isEmpty && imageSrc.trim().isEmpty) {
      return const SizedBox.shrink();
    }

    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: maxWidth),
      child: AspectRatio(
        aspectRatio: aspect,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: ColoredBox(
            color: tokens.card.withValues(alpha: 0.4),
            child: videoId.isNotEmpty
                ? _YouTubeEmbed(videoId: videoId)
                : imageSrc.isNotEmpty
                    ? Image.network(
                        imageSrc,
                        fit: BoxFit.contain,
                        width: double.infinity,
                        height: double.infinity,
                      )
                    : const SizedBox.shrink(),
          ),
        ),
      ),
    );
  }
}

class _YouTubeEmbed extends StatefulWidget {
  const _YouTubeEmbed({required this.videoId});

  final String videoId;

  @override
  State<_YouTubeEmbed> createState() => _YouTubeEmbedState();
}

class _YouTubeEmbedState extends State<_YouTubeEmbed> {
  late final WebViewController _controller;

  @override
  void initState() {
    super.initState();
    final id = Uri.encodeComponent(widget.videoId.trim());
    final src =
        'https://www.youtube-nocookie.com/embed/$id?rel=0&modestbranding=1&playsinline=1';
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..loadRequest(Uri.parse(src));
  }

  @override
  void didUpdateWidget(covariant _YouTubeEmbed oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.videoId != widget.videoId) {
      final id = Uri.encodeComponent(widget.videoId.trim());
      final src =
          'https://www.youtube-nocookie.com/embed/$id?rel=0&modestbranding=1&playsinline=1';
      _controller.loadRequest(Uri.parse(src));
    }
  }

  @override
  Widget build(BuildContext context) {
    return WebViewWidget(controller: _controller);
  }
}
