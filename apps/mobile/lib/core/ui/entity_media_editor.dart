import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/media_upload_chrome.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

/// Smart-menu item-modal parity: large thumbnail hero + 80px gallery tiles with multi-select +.
class EntityMediaEditor extends StatefulWidget {
  const EntityMediaEditor({
    super.key,
    required this.thumbnailLabel,
    required this.galleryLabel,
    required this.galleryEmpty,
    required this.galleryAddAction,
    required this.galleryMaxSlots,
    required this.gallerySlotsFmt,
    required this.thumbnailMainBadge,
    required this.thumbnailEmptyHint,
    required this.thumbnailHint,
    required this.dropzoneChrome,
    required this.onThumbnail,
    required this.onGalleryFiles,
    this.thumbnailUrl,
    this.galleryUrls = const [],
    this.busyThumbnail = false,
    this.busyGallery = false,
    this.enabled = true,
    this.onClearThumbnail,
    this.onRemoveGallery,
  });

  final String thumbnailLabel;
  final String galleryLabel;
  final String galleryEmpty;
  final String galleryAddAction;
  final String galleryMaxSlots;
  final String gallerySlotsFmt;
  final String thumbnailMainBadge;
  final String thumbnailEmptyHint;
  final String thumbnailHint;
  final MediaUploadChrome dropzoneChrome;
  final String? thumbnailUrl;
  final List<String> galleryUrls;
  final bool busyThumbnail;
  final bool busyGallery;
  final bool enabled;
  final Future<void> Function(XFile file) onThumbnail;
  final Future<void> Function(List<XFile> files) onGalleryFiles;
  final Future<void> Function()? onClearThumbnail;
  final Future<void> Function(int index)? onRemoveGallery;

  @override
  State<EntityMediaEditor> createState() => _EntityMediaEditorState();
}

class _EntityMediaEditorState extends State<EntityMediaEditor> {
  bool _localBusy = false;

  bool get _locked =>
      !widget.enabled ||
      widget.busyThumbnail ||
      widget.busyGallery ||
      _localBusy;

  int get _maxSlots {
    final n = int.tryParse(widget.galleryMaxSlots.trim());
    return (n != null && n > 0) ? n : 0;
  }

  String get _slotsText {
    final max = _maxSlots;
    if (max <= 0) return '';
    final fmt = widget.gallerySlotsFmt.trim();
    if (!fmt.contains('{count}') || !fmt.contains('{max}')) return '';
    return fmt
        .replaceAll('{count}', '${widget.galleryUrls.length}')
        .replaceAll('{max}', '$max');
  }

  Future<void> _pickThumbnail() async {
    if (_locked) return;
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1600,
      maxHeight: 1600,
      imageQuality: 90,
    );
    if (file == null || !mounted) return;
    setState(() => _localBusy = true);
    try {
      await widget.onThumbnail(file);
    } finally {
      if (mounted) setState(() => _localBusy = false);
    }
  }

  Future<void> _pickGallery() async {
    if (_locked || _maxSlots <= 0) return;
    final remaining = _maxSlots - widget.galleryUrls.length;
    if (remaining <= 0) return;
    final picker = ImagePicker();
    final files = await picker.pickMultiImage(
      maxWidth: 1600,
      maxHeight: 1600,
      imageQuality: 90,
      limit: remaining,
    );
    if (files.isEmpty || !mounted) return;
    final capped = files.take(remaining).toList();
    setState(() => _localBusy = true);
    try {
      await widget.onGalleryFiles(capped);
    } finally {
      if (mounted) setState(() => _localBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final scheme = Theme.of(context).colorScheme;
    final thumb = (widget.thumbnailUrl ?? '').trim();
    final gallery = widget.galleryUrls
        .map((u) => u.trim())
        .where((u) => u.isNotEmpty)
        .toList();
    final canAdd = _maxSlots > 0 &&
        gallery.length < _maxSlots &&
        !_locked &&
        !widget.busyGallery;
    final slots = _slotsText;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: tokens.brand.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(Icons.photo_camera_outlined,
                  size: 14, color: tokens.brand),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                widget.thumbnailLabel,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: scheme.onSurface,
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(
                  color: const Color(0xFF10B981).withValues(alpha: 0.25),
                ),
              ),
              child: Text(
                widget.thumbnailMainBadge,
                style: const TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.2,
                  color: Color(0xFF059669),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: CustomPaint(
            painter: _DashedRRectPainter(color: tokens.border, radius: 16),
            child: SizedBox(
              height: 176,
              width: double.infinity,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (thumb.isNotEmpty)
                    Image.network(
                      thumb,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => ColoredBox(
                        color: tokens.surfaceMuted,
                        child: Icon(Icons.broken_image_outlined,
                            color: tokens.onSurfaceMuted),
                      ),
                    )
                  else
                    ColoredBox(
                      color: tokens.surfaceMuted,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.upload_outlined,
                              size: 28,
                              color:
                                  tokens.onSurfaceMuted.withValues(alpha: 0.5)),
                          const SizedBox(height: 8),
                          Text(
                            widget.thumbnailEmptyHint,
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.2,
                              color:
                                  tokens.onSurfaceMuted.withValues(alpha: 0.5),
                            ),
                          ),
                        ],
                      ),
                    ),
                  Positioned.fill(
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: _locked ? null : _pickThumbnail,
                        child: (widget.busyThumbnail || _localBusy)
                            ? ColoredBox(
                                color: Colors.black.withValues(alpha: 0.55),
                                child: const Center(
                                  child: SizedBox(
                                    width: 28,
                                    height: 28,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                              )
                            : Align(
                                alignment: Alignment.bottomCenter,
                                child: Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: DecoratedBox(
                                    decoration: BoxDecoration(
                                      color:
                                          Colors.black.withValues(alpha: 0.45),
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: const Padding(
                                      padding: EdgeInsets.all(8),
                                      child: Icon(
                                        Icons.photo_camera,
                                        color: Colors.white,
                                        size: 18,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                      ),
                    ),
                  ),
                  if (thumb.isNotEmpty &&
                      widget.onClearThumbnail != null &&
                      !widget.busyThumbnail)
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Material(
                        color: const Color(0xFFDC2626),
                        shape: const CircleBorder(),
                        child: InkWell(
                          customBorder: const CircleBorder(),
                          onTap: _locked
                              ? null
                              : () async {
                                  await widget.onClearThumbnail?.call();
                                },
                          child: const SizedBox(
                            width: 28,
                            height: 28,
                            child: Icon(Icons.close,
                                size: 14, color: Colors.white),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          widget.thumbnailHint,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: scheme.onSurface,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFF3B82F6).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.upload_outlined,
                  size: 14, color: Color(0xFF3B82F6)),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                widget.galleryLabel,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: scheme.onSurface,
                ),
              ),
            ),
            if (slots.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: tokens.surfaceMuted,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: tokens.border),
                ),
                child: Text(
                  slots,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.1,
                    color: tokens.onSurfaceMuted,
                  ),
                ),
              ),
          ],
        ),
        if (gallery.isEmpty && !widget.busyGallery) ...[
          const SizedBox(height: 8),
          Text(
            widget.galleryEmpty,
            style: TextStyle(fontSize: 12, color: tokens.onSurfaceMuted),
          ),
        ],
        const SizedBox(height: 10),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            for (var i = 0; i < gallery.length; i++)
              SizedBox(
                width: 80,
                height: 80,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image.network(
                        gallery[i],
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => ColoredBox(
                          color: tokens.surfaceMuted,
                        ),
                      ),
                    ),
                    if (widget.onRemoveGallery != null)
                      Positioned(
                        top: 4,
                        right: 4,
                        child: Material(
                          color: const Color(0xFFDC2626),
                          shape: const CircleBorder(),
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: _locked
                                ? null
                                : () async {
                                    await widget.onRemoveGallery?.call(i);
                                  },
                            child: const SizedBox(
                              width: 20,
                              height: 20,
                              child: Icon(Icons.close,
                                  size: 10, color: Colors.white),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            if (widget.busyGallery)
              SizedBox(
                width: 80,
                height: 80,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: tokens.border),
                    color: tokens.surfaceMuted,
                  ),
                  child: const Center(
                    child: SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                ),
              ),
            if (canAdd)
              SizedBox(
                width: 80,
                height: 80,
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: _pickGallery,
                    borderRadius: BorderRadius.circular(16),
                    child: CustomPaint(
                      painter:
                          _DashedRRectPainter(color: tokens.border, radius: 16),
                      child: Center(
                        child:
                            Icon(Icons.add, size: 22, color: scheme.onSurface),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _DashedRRectPainter extends CustomPainter {
  _DashedRRectPainter({required this.color, required this.radius});

  final Color color;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    final rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(1, 1, size.width - 2, size.height - 2),
      Radius.circular(radius),
    );
    final path = Path()..addRRect(rrect);
    const dash = 6.0;
    const gap = 4.0;
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        final next = distance + dash;
        canvas.drawPath(
          metric.extractPath(distance, next.clamp(0, metric.length)),
          paint,
        );
        distance = next + gap;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedRRectPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.radius != radius;
}
