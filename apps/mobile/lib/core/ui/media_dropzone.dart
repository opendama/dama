import 'dart:io';

import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/media_upload_chrome.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

/// Worldwide media dropzone (web MediaDropzone parity): tap to browse, preview, replace/remove.
class MediaDropzone extends StatefulWidget {
  const MediaDropzone({
    super.key,
    required this.label,
    required this.chrome,
    required this.onPicked,
    this.previewUrl,
    this.localPath,
    this.busy = false,
    this.enabled = true,
    this.invalid = false,
    this.errorText,
    this.onClear,
    this.preferFrontCamera = false,
  });

  final String label;
  final MediaUploadChrome chrome;
  final Future<void> Function(XFile file) onPicked;
  final String? previewUrl;
  final String? localPath;
  final bool busy;
  final bool enabled;

  /// Highlight empty/required after a submit attempt.
  final bool invalid;

  /// Chrome-owned validation copy under the dropzone.
  final String? errorText;
  final VoidCallback? onClear;
  final bool preferFrontCamera;

  @override
  State<MediaDropzone> createState() => _MediaDropzoneState();
}

class _MediaDropzoneState extends State<MediaDropzone> {
  /// Per-instance only - never share across sibling dropzones.
  bool _localBusy = false;

  bool get _hasPreview =>
      (widget.previewUrl ?? '').trim().isNotEmpty ||
      (widget.localPath ?? '').trim().isNotEmpty;

  bool get _showBusy => widget.busy || _localBusy;

  bool get _locked => !widget.enabled || _showBusy;

  bool get _showInvalid =>
      widget.invalid || (widget.errorText ?? '').trim().isNotEmpty;

  Future<void> _browse() async {
    if (_locked) return;
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1600,
      maxHeight: 1600,
      imageQuality: 90,
      preferredCameraDevice:
          widget.preferFrontCamera ? CameraDevice.front : CameraDevice.rear,
    );
    if (file == null) return;
    if (!mounted) return;
    setState(() => _localBusy = true);
    try {
      await widget.onPicked(file);
    } finally {
      if (mounted) setState(() => _localBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final scheme = Theme.of(context).colorScheme;
    final locked = _locked;
    final showBusy = _showBusy;
    final showInvalid = _showInvalid;
    final err = (widget.errorText ?? '').trim();
    final borderColor = showInvalid ? tokens.danger : tokens.border;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          widget.label,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: showInvalid ? tokens.danger : scheme.onSurface,
          ),
        ),
        const SizedBox(height: 8),
        Material(
          color: showInvalid
              ? tokens.danger.withValues(alpha: 0.05)
              : tokens.surfaceMuted,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: locked ? null : _browse,
            child: CustomPaint(
              painter: _DashedBorderPainter(
                color: borderColor,
                radius: 12,
              ),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 152),
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                  child: showBusy
                      ? Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            SizedBox(
                              width: 28,
                              height: 28,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: tokens.onSurfaceMuted,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              widget.chrome.uploadingLabel,
                              style: TextStyle(
                                fontSize: 13,
                                color: tokens.onSurfaceMuted,
                              ),
                            ),
                          ],
                        )
                      : _hasPreview
                          ? Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: SizedBox(
                                    height: 96,
                                    width: 144,
                                    child: (widget.localPath ?? '')
                                            .trim()
                                            .isNotEmpty
                                        ? Image.file(
                                            File(widget.localPath!.trim()),
                                            fit: BoxFit.cover,
                                          )
                                        : Image.network(
                                            widget.previewUrl!.trim(),
                                            fit: BoxFit.cover,
                                            errorBuilder: (_, __, ___) => Icon(
                                              Icons.broken_image_outlined,
                                              color: tokens.onSurfaceMuted,
                                            ),
                                          ),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  widget.chrome.selectedLabel,
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: tokens.onSurfaceMuted,
                                  ),
                                ),
                              ],
                            )
                          : Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  width: 44,
                                  height: 44,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(color: tokens.border),
                                    color: tokens.card,
                                  ),
                                  child: Icon(
                                    Icons.upload_outlined,
                                    size: 20,
                                    color: tokens.onSurfaceMuted,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  widget.chrome.dropTitle,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: scheme.onSurface,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  widget.chrome.dropHint,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: tokens.onSurfaceMuted,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 6,
                                  ),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: tokens.border),
                                    color: tokens.card,
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        Icons.add_photo_alternate_outlined,
                                        size: 14,
                                        color: scheme.onSurface,
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        widget.chrome.browseAction,
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w500,
                                          color: scheme.onSurface,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                ),
              ),
            ),
          ),
        ),
        if (_hasPreview && !showBusy) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              OutlinedButton(
                onPressed: locked ? null : _browse,
                child: Text(widget.chrome.replaceAction),
              ),
              if (widget.onClear != null) ...[
                const SizedBox(width: 8),
                TextButton(
                  onPressed: locked ? null : widget.onClear,
                  child: Text(widget.chrome.removeAction),
                ),
              ],
            ],
          ),
        ],
        if (err.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(
            err,
            style: TextStyle(fontSize: 12, color: tokens.danger),
          ),
        ],
      ],
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  _DashedBorderPainter({required this.color, required this.radius});

  final Color color;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    final rrect = RRect.fromRectAndRadius(
      Offset.zero & size,
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
  bool shouldRepaint(covariant _DashedBorderPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.radius != radius;
}
