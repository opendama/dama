import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Palace court roles - Chess.com Neo physical-object language.
enum PalacePieceRole { servant, son, daughter, king, queen }

/// Same Neo silhouette both seats (pawn / king); color comes from the palette.
PalacePieceRole palacePieceRole(int _, bool isKing) {
  return isKing ? PalacePieceRole.king : PalacePieceRole.servant;
}

String palaceRoleLabel(PalacePieceRole role) {
  switch (role) {
    case PalacePieceRole.servant:
      return 'Servant';
    case PalacePieceRole.son:
      return 'Son';
    case PalacePieceRole.daughter:
      return 'Daughter';
    case PalacePieceRole.king:
      return 'King';
    case PalacePieceRole.queen:
      return 'Queen';
  }
}

const kPalaceRoleOrder = <PalacePieceRole>[
  PalacePieceRole.servant,
  PalacePieceRole.son,
  PalacePieceRole.daughter,
  PalacePieceRole.king,
  PalacePieceRole.queen,
];

class PalaceAccents {
  const PalaceAccents({
    required this.mark,
    required this.king,
    required this.queen,
    required this.heir,
  });

  final Color mark;
  final Color king;
  final Color queen;
  final Color heir;
}

const kDamaBrandMark = Color(0xFFA31D38);
const kNeoOutline = Color(0xFF2B2B2B);

Color _mix(Color a, Color b, double t) {
  return Color.lerp(a, b, t.clamp(0.0, 1.0)) ?? a;
}

PalaceAccents palaceAccentsFromPair(Color pieceLight, Color pieceDark) {
  const gold = Color(0xFFC9A227);
  const rose = Color(0xFFB76E79);
  return PalaceAccents(
    mark: _mix(kDamaBrandMark, pieceDark, 0.2),
    king: _mix(_mix(kDamaBrandMark, gold, 0.35), pieceDark, 0.15),
    queen: _mix(_mix(kDamaBrandMark, rose, 0.4), pieceLight, 0.12),
    heir: _mix(_mix(kDamaBrandMark, pieceLight, 0.35), gold, 0.2),
  );
}

String _neoKind(PalacePieceRole role) {
  switch (role) {
    case PalacePieceRole.servant:
    case PalacePieceRole.son:
      return 'pawn';
    case PalacePieceRole.daughter:
    case PalacePieceRole.queen:
      return 'queen';
    case PalacePieceRole.king:
      return 'king';
  }
}

/// Prefetch Neo mask bitmaps so [PalacePiecePainter] can draw synchronously.
class NeoPieceImages {
  NeoPieceImages._();

  static final Map<String, ui.Image> _cache = {};
  static Future<void>? _loading;

  static Future<void> ensureLoaded() {
    return _loading ??= _loadAll();
  }

  static Future<void> _loadAll() async {
    const kinds = ['pawn', 'king', 'queen'];
    const layers = ['body', 'shade', 'highlight', 'outline'];
    await Future.wait([
      for (final kind in kinds)
        for (final layer in layers) _load('assets/pieces/neo/$kind-$layer.png'),
    ]);
  }

  static Future<void> _load(String asset) async {
    if (_cache.containsKey(asset)) return;
    final data = await rootBundle.load(asset);
    final codec = await ui.instantiateImageCodec(data.buffer.asUint8List());
    final frame = await codec.getNextFrame();
    _cache[asset] = frame.image;
  }

  static ui.Image? get(String asset) => _cache[asset];
}

/// Neo court piece widget - layered tinted masks.
class PalacePieceMark extends StatelessWidget {
  const PalacePieceMark({
    super.key,
    required this.role,
    required this.pieceLight,
    required this.pieceDark,
    required this.player,
    this.darkSplit = false,
  });

  final PalacePieceRole role;
  final Color pieceLight;
  final Color pieceDark;
  final int player;

  /// Dark seat: 50/50 light|dark body fill (web White & half).
  final bool darkSplit;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<void>(
      future: NeoPieceImages.ensureLoaded(),
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const SizedBox.expand();
        }
        return CustomPaint(
          painter: PalacePiecePainter(
            role: role,
            accents: palaceAccentsFromPair(pieceLight, pieceDark),
            pieceLight: pieceLight,
            pieceDark: pieceDark,
            player: player,
            darkSplit: darkSplit,
          ),
        );
      },
    );
  }
}

/// Neo court piece - body/shade/highlight/outline masks (Chess.com Neo).
class PalacePiecePainter extends CustomPainter {
  PalacePiecePainter({
    required this.role,
    required this.accents,
    required this.pieceLight,
    required this.pieceDark,
    required this.player,
    this.darkSplit = false,
  });

  final PalacePieceRole role;
  final PalaceAccents accents;
  final Color pieceLight;
  final Color pieceDark;
  final int player;
  final bool darkSplit;

  @override
  void paint(Canvas canvas, Size size) {
    final isLight = player == 1;
    final split = !isLight && darkSplit;
    final base = isLight ? pieceLight : pieceDark;
    final shade = isLight
        ? _mix(pieceLight, const Color(0xFF8A8A8A), 0.58)
        : _mix(pieceDark, const Color(0xFF0A0A0A), 0.45);
    final highlight = isLight
        ? _mix(pieceLight, Colors.white, 0.3)
        : _mix(pieceDark, const Color(0xFF9A9A9A), 0.45);

    final kind = _neoKind(role);
    final scale = role == PalacePieceRole.daughter ? 0.92 : 1.0;

    canvas.save();
    if (scale != 1.0) {
      final dx = size.width * (1 - scale) / 2;
      final dy = size.height * (1 - scale);
      canvas.translate(dx, dy);
      canvas.scale(scale);
    }

    if (split) {
      _drawSplitBody(canvas, size, 'assets/pieces/neo/$kind-body.png');
    } else {
      _drawTinted(canvas, size, 'assets/pieces/neo/$kind-body.png', base);
    }
    _drawTinted(canvas, size, 'assets/pieces/neo/$kind-shade.png', shade);
    _drawTinted(
        canvas, size, 'assets/pieces/neo/$kind-highlight.png', highlight);
    _drawTinted(
        canvas, size, 'assets/pieces/neo/$kind-outline.png', kNeoOutline);

    if (role == PalacePieceRole.son) {
      _drawSonCrown(canvas, size, split ? pieceLight : base, shade);
    }
    canvas.restore();
  }

  void _drawTinted(Canvas canvas, Size size, String asset, Color color) {
    final img = NeoPieceImages.get(asset);
    if (img == null) return;
    paintImage(
      canvas: canvas,
      rect: Offset.zero & size,
      image: img,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
      colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
    );
  }

  /// 135° Chess.com half: light | dark under the Neo body mask.
  void _drawSplitBody(Canvas canvas, Size size, String asset) {
    final img = NeoPieceImages.get(asset);
    if (img == null) return;
    final bounds = Offset.zero & size;
    canvas.saveLayer(bounds, Paint());
    canvas.drawRect(
      bounds,
      Paint()
        ..shader = ui.Gradient.linear(
          Offset.zero,
          Offset(size.width, size.height),
          [pieceLight, pieceLight, pieceDark, pieceDark],
          const [0.0, 0.5, 0.5, 1.0],
        ),
    );
    paintImage(
      canvas: canvas,
      rect: bounds,
      image: img,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
      colorFilter: const ColorFilter.mode(Colors.white, BlendMode.dstIn),
    );
    canvas.restore();
  }

  void _drawSonCrown(Canvas canvas, Size size, Color base, Color shade) {
    final sx = size.width / 45;
    final sy = size.height / 45;
    canvas.save();
    canvas.scale(sx, sy);
    final path = Path()
      ..moveTo(14.2, 11.2)
      ..lineTo(16.6, 4.8)
      ..lineTo(19.0, 10.4)
      ..lineTo(22.5, 2.6)
      ..lineTo(26.0, 10.4)
      ..lineTo(28.4, 4.8)
      ..lineTo(30.8, 11.2)
      ..close();
    canvas.drawPath(path, Paint()..color = base);
    canvas.save();
    canvas.clipRect(const Rect.fromLTWH(22.5, 0, 22.5, 14));
    canvas.drawPath(path, Paint()..color = shade);
    canvas.restore();
    canvas.drawPath(
      path,
      Paint()
        ..color = kNeoOutline
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.7
        ..strokeJoin = StrokeJoin.round,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant PalacePiecePainter oldDelegate) {
    return oldDelegate.role != role ||
        oldDelegate.player != player ||
        oldDelegate.pieceLight != pieceLight ||
        oldDelegate.pieceDark != pieceDark ||
        oldDelegate.darkSplit != darkSplit;
  }
}

class PalaceLogoPreviewDisc extends StatelessWidget {
  const PalaceLogoPreviewDisc({
    super.key,
    required this.role,
    required this.pieceLight,
    required this.pieceDark,
    this.darkSplit = false,
    this.size = 18,
  });

  final PalacePieceRole role;
  final Color pieceLight;
  final Color pieceDark;
  final bool darkSplit;
  final double size;

  @override
  Widget build(BuildContext context) {
    final player =
        role == PalacePieceRole.son || role == PalacePieceRole.king ? 1 : 2;
    return SizedBox(
      width: size * 0.85,
      height: size,
      child: PalacePieceMark(
        role: role,
        pieceLight: pieceLight,
        pieceDark: pieceDark,
        player: player,
        darkSplit: darkSplit,
      ),
    );
  }
}
