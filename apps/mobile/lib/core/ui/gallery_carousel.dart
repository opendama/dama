import 'dart:async';

import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:flutter/material.dart';

/// Auto-advancing image carousel with prev/next + swipe (web GalleryCarousel / DishCard parity).
class GalleryCarousel extends StatefulWidget {
  const GalleryCarousel({
    super.key,
    required this.images,
    required this.semanticsLabel,
    this.interval = const Duration(seconds: 3),
    this.aspectRatio = 4 / 3,
  });

  final List<String> images;
  final String semanticsLabel;
  final Duration interval;
  final double aspectRatio;

  @override
  State<GalleryCarousel> createState() => _GalleryCarouselState();
}

class _GalleryCarouselState extends State<GalleryCarousel> {
  final _controller = PageController();
  int _index = 0;
  Timer? _timer;
  DateTime _pauseUntil = DateTime.fromMillisecondsSinceEpoch(0);

  List<String> get _slides => widget.images
      .map((u) => u.trim())
      .where((u) => u.isNotEmpty)
      .toList(growable: false);

  @override
  void initState() {
    super.initState();
    _restartTimer();
  }

  @override
  void didUpdateWidget(covariant GalleryCarousel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.images.join('\0') != widget.images.join('\0')) {
      _index = 0;
      if (_controller.hasClients) {
        _controller.jumpToPage(0);
      }
      _restartTimer();
    }
  }

  void _pauseAutoplay() {
    _pauseUntil = DateTime.now().add(widget.interval * 2);
  }

  void _restartTimer() {
    _timer?.cancel();
    final slides = _slides;
    if (slides.length <= 1) return;
    _timer = Timer.periodic(widget.interval, (_) {
      if (!mounted || !_controller.hasClients) return;
      if (DateTime.now().isBefore(_pauseUntil)) return;
      final next = (_index + 1) % slides.length;
      _controller.animateToPage(
        next,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
    });
  }

  void _go(int dir) {
    final slides = _slides;
    if (slides.length <= 1 || !_controller.hasClients) return;
    _pauseAutoplay();
    final next = (_index + dir + slides.length) % slides.length;
    _controller.animateToPage(
      next,
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOut,
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final slides = _slides;
    if (slides.isEmpty) {
      return AspectRatio(
        aspectRatio: widget.aspectRatio,
        child: ColoredBox(color: tokens.surfaceMuted),
      );
    }
    return Semantics(
      label: widget.semanticsLabel,
      child: AspectRatio(
        aspectRatio: widget.aspectRatio,
        // ClipRRect keeps prev/next chips inside the media well (never paint over sticky filters).
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Stack(
            fit: StackFit.expand,
            clipBehavior: Clip.hardEdge,
            children: [
              PageView.builder(
                controller: _controller,
                itemCount: slides.length,
                padEnds: false,
                onPageChanged: (i) {
                  setState(() => _index = i);
                  _pauseAutoplay();
                },
                itemBuilder: (_, i) => SizedBox.expand(
                  child: Image.network(
                    slides[i],
                    fit: BoxFit.cover,
                    alignment: Alignment.center,
                    errorBuilder: (_, __, ___) =>
                        ColoredBox(color: tokens.surfaceMuted),
                  ),
                ),
              ),
              if (slides.length > 1) ...[
                Positioned(
                  left: 6,
                  top: 0,
                  bottom: 0,
                  child: Center(
                    child: _NavChip(
                      icon: Icons.chevron_left,
                      onTap: () => _go(-1),
                    ),
                  ),
                ),
                Positioned(
                  right: 6,
                  top: 0,
                  bottom: 0,
                  child: Center(
                    child: _NavChip(
                      icon: Icons.chevron_right,
                      onTap: () => _go(1),
                    ),
                  ),
                ),
                Positioned(
                  bottom: 8,
                  left: 0,
                  right: 0,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      for (var i = 0; i < slides.length; i++)
                        Container(
                          width: 6,
                          height: 6,
                          margin: const EdgeInsets.symmetric(horizontal: 3),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color:
                                i == _index ? tokens.gold : tokens.borderSubtle,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _NavChip extends StatelessWidget {
  const _NavChip({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // Dark translucent disc + white chevron (DishCard) - readable on any photo/theme.
    return Material(
      color: Colors.black.withValues(alpha: 0.55),
      // No elevation: avoids Material ink painting above sticky filter chrome.
      elevation: 0,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(5),
          child: Icon(icon, size: 18, color: Colors.white),
        ),
      ),
    );
  }
}
