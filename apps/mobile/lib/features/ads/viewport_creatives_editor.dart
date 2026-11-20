import 'package:dama_mobile/core/ads/resolve_viewport_creative.dart';
import 'package:dama_mobile/core/lib/chrome_string.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/ads.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';

typedef ViewportCampaignRefresh = Future<void> Function();

/// Publisher per-viewport image/video upload (web ViewportCreativesEditor parity).
/// Mobile uses gallery pickers below; OS file drag-drop is not wired (no extra deps).
class ViewportCreativesEditor extends StatefulWidget {
  const ViewportCreativesEditor({
    super.key,
    required this.accessToken,
    required this.campaign,
    required this.chrome,
    required this.onSaved,
    this.disabled = false,
  });

  final String accessToken;
  final Map<String, dynamic> campaign;
  final Map<String, String> chrome;
  final ViewportCampaignRefresh onSaved;
  final bool disabled;

  @override
  State<ViewportCreativesEditor> createState() =>
      _ViewportCreativesEditorState();
}

class _ViewportCreativesEditorState extends State<ViewportCreativesEditor> {
  final _picker = ImagePicker();
  ViewportCreativeSlot? _busySlot;

  String _c(String key) => chromeMapString(widget.chrome, key);

  String get _campaignId => widget.campaign['id']?.toString() ?? '';

  String get _campaignTitle =>
      (widget.campaign['title']?.toString() ?? '').trim();

  bool get _locked => widget.disabled || _busySlot != null;

  Map<String, String> get _authHeaders => {
        'Authorization': 'Bearer ${widget.accessToken}',
      };

  Future<void> _uploadImage(ViewportCreativeSlot slot, XFile file) async {
    if (_campaignId.isEmpty) return;
    setState(() => _busySlot = slot);
    try {
      final uri = Uri.parse(
        '${ApiConfig.baseUrl}/api/v1/ads/campaigns/$_campaignId/creatives/${slot.name}',
      );
      final req = http.MultipartRequest('POST', uri);
      req.headers.addAll(_authHeaders);
      req.files.add(await http.MultipartFile.fromPath(
        'file',
        file.path,
        contentType: MediaType('image', 'jpeg'),
        filename: file.name,
      ));
      final streamed = await req.send();
      if (!mounted) return;
      if (streamed.statusCode < 300) {
        final toast = _c('toast_viewport_creative_saved');
        if (toast.isNotEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(toast)));
        }
        await widget.onSaved();
      } else {
        _showUploadFailed();
      }
    } catch (_) {
      if (mounted) _showUploadFailed();
    } finally {
      if (mounted) {
        setState(() => _busySlot = null);
      }
    }
  }

  Future<void> _clearImage(ViewportCreativeSlot slot) async {
    if (_campaignId.isEmpty) return;
    setState(() => _busySlot = slot);
    try {
      final res = await http.delete(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/ads/campaigns/$_campaignId/creatives/${slot.name}',
        ),
        headers: _authHeaders,
      );
      if (!mounted) return;
      if (res.statusCode < 300) {
        final toast = _c('toast_viewport_creative_cleared');
        if (toast.isNotEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(toast)));
        }
        await widget.onSaved();
      } else {
        _showUploadFailed();
      }
    } catch (_) {
      if (mounted) _showUploadFailed();
    } finally {
      if (mounted) {
        setState(() => _busySlot = null);
      }
    }
  }

  Future<void> _uploadVideo(ViewportCreativeSlot slot, XFile file) async {
    if (_campaignId.isEmpty || _campaignTitle.isEmpty) return;
    setState(() => _busySlot = slot);
    try {
      final uri = Uri.parse(
        '${ApiConfig.baseUrl}/api/v1/ads/campaigns/$_campaignId/creatives/${slot.name}/video',
      );
      final req = http.MultipartRequest('POST', uri);
      req.headers.addAll(_authHeaders);
      req.fields['title'] = _campaignTitle;
      req.fields['async'] = 'true';
      req.files.add(await http.MultipartFile.fromPath(
        'file',
        file.path,
        contentType: MediaType('video', 'mp4'),
        filename: file.name,
      ));
      final streamed = await req.send();
      if (!mounted) return;
      if (streamed.statusCode < 300) {
        final toast = _c('toast_viewport_video_queued');
        if (toast.isNotEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(toast)));
        }
        await widget.onSaved();
      } else {
        _showUploadFailed();
      }
    } catch (_) {
      if (mounted) _showUploadFailed();
    } finally {
      if (mounted) {
        setState(() => _busySlot = null);
      }
    }
  }

  Future<void> _clearVideo(ViewportCreativeSlot slot) async {
    if (_campaignId.isEmpty) return;
    setState(() => _busySlot = slot);
    try {
      final res = await http.delete(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/v1/ads/campaigns/$_campaignId/creatives/${slot.name}/video',
        ),
        headers: _authHeaders,
      );
      if (!mounted) return;
      if (res.statusCode < 300) {
        final toast = _c('toast_viewport_creative_cleared');
        if (toast.isNotEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(toast)));
        }
        await widget.onSaved();
      } else {
        _showUploadFailed();
      }
    } catch (_) {
      if (mounted) _showUploadFailed();
    } finally {
      if (mounted) {
        setState(() => _busySlot = null);
      }
    }
  }

  void _showUploadFailed() {
    final msg = _c('media_upload_failed');
    if (msg.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  Future<void> _pickImage(ViewportCreativeSlot slot) async {
    if (_locked) return;
    final file = await _picker.pickImage(source: ImageSource.gallery);
    if (file == null) return;
    await _uploadImage(slot, file);
  }

  Future<void> _pickVideo(ViewportCreativeSlot slot) async {
    if (_locked || _campaignTitle.isEmpty) return;
    final file = await _picker.pickVideo(source: ImageSource.gallery);
    if (file == null) return;
    await _uploadVideo(slot, file);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final source = viewportSourceFromCampaignJson(widget.campaign);

    final slots = <({
      ViewportCreativeSlot slot,
      String label,
      String ratioLabel,
      String hint,
      IconData icon,
    })>[
      (
        slot: ViewportCreativeSlot.desktop,
        label: _c('viewport_desktop_label'),
        ratioLabel: _c('viewport_desktop_ratio_label'),
        hint: _c('viewport_desktop_hint'),
        icon: Icons.desktop_windows_outlined,
      ),
      (
        slot: ViewportCreativeSlot.tablet,
        label: _c('viewport_tablet_label'),
        ratioLabel: _c('viewport_tablet_ratio_label'),
        hint: _c('viewport_tablet_hint'),
        icon: Icons.tablet_outlined,
      ),
      (
        slot: ViewportCreativeSlot.mobile,
        label: _c('viewport_mobile_label'),
        ratioLabel: _c('viewport_mobile_ratio_label'),
        hint: _c('viewport_mobile_hint'),
        icon: Icons.smartphone_outlined,
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          _c('viewport_creatives_title'),
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 4),
        Text(
          _c('viewport_creatives_blurb'),
          style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
        ),
        const SizedBox(height: 16),
        for (final s in slots)
          _ViewportSlotSection(
            slot: s.slot,
            label: s.label,
            ratioLabel: s.ratioLabel,
            hint: s.hint,
            icon: s.icon,
            source: source,
            chrome: widget.chrome,
            busy: _busySlot == s.slot,
            locked: _locked,
            onPickImage: () => _pickImage(s.slot),
            onPickVideo: () => _pickVideo(s.slot),
            onClearImage: () => _clearImage(s.slot),
            onClearVideo: () => _clearVideo(s.slot),
          ),
      ],
    );
  }
}

class _ViewportSlotSection extends StatelessWidget {
  const _ViewportSlotSection({
    required this.slot,
    required this.label,
    required this.ratioLabel,
    required this.hint,
    required this.icon,
    required this.source,
    required this.chrome,
    required this.busy,
    required this.locked,
    required this.onPickImage,
    required this.onPickVideo,
    required this.onClearImage,
    required this.onClearVideo,
  });

  final ViewportCreativeSlot slot;
  final String label;
  final String ratioLabel;
  final String hint;
  final IconData icon;
  final ViewportCreativeSource source;
  final Map<String, String> chrome;
  final bool busy;
  final bool locked;
  final VoidCallback onPickImage;
  final VoidCallback onPickVideo;
  final VoidCallback onClearImage;
  final VoidCallback onClearVideo;

  String _c(String key) => chromeMapString(chrome, key);

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final pair = _slotPair(source, slot);
    final aspect = viewportAspectRatioFromLabel(ratioLabel);
    final imgSrc = resolvePublicMediaUrl(pair.imageUrl);
    var videoId = pair.videoId.trim();
    if (isStubVideoId(videoId)) videoId = '';
    final hasImage = imgSrc.isNotEmpty;
    final hasVideo = videoId.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: tokens.gold),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              Text(
                ratioLabel,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1,
                  color: tokens.onSurfaceMuted,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                _c('viewport_optional_badge'),
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1,
                  color: tokens.onSurfaceMuted,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (aspect != null)
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 360),
                child: AspectRatio(
                  aspectRatio: aspect,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      DecoratedBox(
                        decoration: BoxDecoration(
                          color: tokens.card,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: tokens.borderSubtle,
                            width: 2,
                          ),
                        ),
                        child: hasVideo
                            ? Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.play_circle_outline,
                                      size: 36, color: tokens.danger),
                                  const SizedBox(height: 8),
                                  Text(
                                    _c('viewport_video_badge'),
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      color: tokens.onSurfaceMuted,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    videoId,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontFamily: 'monospace',
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              )
                            : hasImage
                                ? ClipRRect(
                                    borderRadius: BorderRadius.circular(10),
                                    child: Image.network(
                                      imgSrc,
                                      fit: BoxFit.contain,
                                    ),
                                  )
                                : Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(Icons.upload_outlined,
                                          size: 28,
                                          color: tokens.onSurfaceMuted),
                                      const SizedBox(height: 8),
                                      Text(
                                        _c('viewport_preview_empty'),
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                          fontSize: 9,
                                          fontWeight: FontWeight.bold,
                                          letterSpacing: 1,
                                          color: tokens.onSurfaceMuted,
                                        ),
                                      ),
                                    ],
                                  ),
                      ),
                      if (busy)
                        DecoratedBox(
                          decoration: BoxDecoration(
                            color: Colors.black54,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Center(
                            child: CircularProgressIndicator(),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          const SizedBox(height: 8),
          Text(hint, style: TextStyle(fontSize: 12, color: tokens.onSurface)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton(
                onPressed: locked || hasVideo ? null : onPickImage,
                child: Text(
                  hasImage
                      ? _c('viewport_replace_image_action')
                      : _c('viewport_upload_image_action'),
                ),
              ),
              OutlinedButton(
                onPressed: locked ? null : onPickVideo,
                child: Text(_c('viewport_upload_video_action')),
              ),
              if (hasImage)
                TextButton(
                  onPressed: locked ? null : onClearImage,
                  child: Text(_c('viewport_clear_action')),
                ),
              if (hasVideo)
                TextButton(
                  onPressed: locked ? null : onClearVideo,
                  child: Text(_c('viewport_clear_action')),
                ),
            ],
          ),
          if (hasImage && !hasVideo)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                _c('viewport_image_badge'),
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1,
                  color: tokens.onSurfaceMuted,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

({String imageUrl, String videoId}) _slotPair(
  ViewportCreativeSource source,
  ViewportCreativeSlot slot,
) {
  switch (slot) {
    case ViewportCreativeSlot.desktop:
      return (
        imageUrl: (source.creativeDesktopUrl ?? '').trim(),
        videoId: (source.videoIdDesktop ?? '').trim(),
      );
    case ViewportCreativeSlot.tablet:
      return (
        imageUrl: (source.creativeTabletUrl ?? '').trim(),
        videoId: (source.videoIdTablet ?? '').trim(),
      );
    case ViewportCreativeSlot.mobile:
      return (
        imageUrl: (source.creativeMobileUrl ?? '').trim(),
        videoId: (source.videoIdMobile ?? '').trim(),
      );
  }
}
