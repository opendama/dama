import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Board square themes (web `board-palette.ts` parity).
enum BoardPaletteId { forest, classic, blackWhite, burgundy, slate }

/// Piece pairs - both sides clearly different (web parity).
enum PiecePaletteId {
  whiteHalf,
  whiteBlack,
  whiteGreen,
  ivoryBurgundy,
  pearlOnyx,
  honeyWalnut,
  mistOcean,
  blushEspresso,
}

class BoardPalette {
  const BoardPalette({
    required this.id,
    required this.label,
    required this.boardLight,
    required this.boardDark,
    required this.highlight,
  });

  final BoardPaletteId id;
  final String label;
  final Color boardLight;
  final Color boardDark;
  final Color highlight;
}

class PiecePalette {
  const PiecePalette({
    required this.id,
    required this.label,
    required this.lightName,
    required this.darkName,
    required this.pieceLight,
    required this.pieceDark,
    this.darkSplit = false,
  });

  final PiecePaletteId id;
  final String label;

  /// Guest seat title for light pieces.
  final String lightName;

  /// Guest seat title for dark pieces.
  final String darkName;
  final Color pieceLight;
  final Color pieceDark;

  /// When true, dark-side Neo bodies paint 50/50 light|dark (web White & half).
  final bool darkSplit;
}

const kBoardPalettes = <BoardPalette>[
  BoardPalette(
    id: BoardPaletteId.forest,
    label: 'Forest',
    boardLight: Color(0xFFEEEED2),
    boardDark: Color(0xFF769656),
    highlight: Color(0xFFBACA44),
  ),
  BoardPalette(
    id: BoardPaletteId.classic,
    label: 'Classic wood',
    boardLight: Color(0xFFE8DCC8),
    boardDark: Color(0xFF7C4A23),
    highlight: Color(0xFF22C55E),
  ),
  BoardPalette(
    id: BoardPaletteId.blackWhite,
    label: 'Black & white',
    boardLight: Color(0xFFF5F5F5),
    boardDark: Color(0xFF2C2C2C),
    highlight: Color(0xFF6B7280),
  ),
  BoardPalette(
    id: BoardPaletteId.burgundy,
    label: 'Burgundy',
    boardLight: Color(0xFFF7EEF1),
    boardDark: Color(0xFF9B1B3A),
    highlight: Color(0xFFC0264A),
  ),
  BoardPalette(
    id: BoardPaletteId.slate,
    label: 'Slate',
    boardLight: Color(0xFFD8DCE3),
    boardDark: Color(0xFF4A5568),
    highlight: Color(0xFFA31D38),
  ),
];

const kPiecePalettes = <PiecePalette>[
  PiecePalette(
    id: PiecePaletteId.whiteHalf,
    label: 'White & half',
    lightName: 'White',
    darkName: 'Half',
    pieceLight: Color(0xFFFFFFFF),
    pieceDark: Color(0xFF141414),
    darkSplit: true,
  ),
  PiecePalette(
    id: PiecePaletteId.whiteBlack,
    label: 'White & black',
    lightName: 'White',
    darkName: 'Black',
    pieceLight: Color(0xFFFFFFFF),
    pieceDark: Color(0xFF141414),
  ),
  PiecePalette(
    id: PiecePaletteId.whiteGreen,
    label: 'White & green',
    lightName: 'White',
    darkName: 'Green',
    pieceLight: Color(0xFFFFFFFF),
    pieceDark: Color(0xFF22C55E),
  ),
  PiecePalette(
    id: PiecePaletteId.ivoryBurgundy,
    label: 'Ivory & burgundy',
    lightName: 'Ivory',
    darkName: 'Burgundy',
    pieceLight: Color(0xFFFFF6E8),
    pieceDark: Color(0xFF7A001F),
  ),
  PiecePalette(
    id: PiecePaletteId.pearlOnyx,
    label: 'Pearl & onyx',
    lightName: 'Pearl',
    darkName: 'Onyx',
    pieceLight: Color(0xFFF4F4F5),
    pieceDark: Color(0xFF18181B),
  ),
  PiecePalette(
    id: PiecePaletteId.honeyWalnut,
    label: 'Honey & walnut',
    lightName: 'Honey',
    darkName: 'Walnut',
    pieceLight: Color(0xFFF6C453),
    pieceDark: Color(0xFF3E2723),
  ),
  PiecePalette(
    id: PiecePaletteId.mistOcean,
    label: 'Mist & ocean',
    lightName: 'Mist',
    darkName: 'Ocean',
    pieceLight: Color(0xFFBFDBFE),
    pieceDark: Color(0xFF1E3A5F),
  ),
  PiecePalette(
    id: PiecePaletteId.blushEspresso,
    label: 'Blush & espresso',
    lightName: 'Blush',
    darkName: 'Espresso',
    pieceLight: Color(0xFFFECACA),
    pieceDark: Color(0xFF3F2A1D),
  ),
];

const _kBoardPalette = 'dama_board_palette';
const _kPiecePalette = 'dama_piece_palette';

/// One-time: force Black & white board for users stuck on legacy Classic/Ivory prefs.
const _kBwDefaultMigration = 'dama_palette_bw_v1';

/// One-time: default dark pieces to green (visible on black squares).
const _kWgDefaultMigration = 'dama_palette_white_green_v1';

/// One-time: product default → Classic wood board + White & black pieces.
const _kClassicWbMigration = 'dama_palette_classic_wb_v1';

/// One-time: product default → Forest board + White & black pieces (Neo era).
const _kForestWbMigration = 'dama_palette_forest_wb_v2';

/// One-time: Forest + White & half (50/50 dark pieces) as Neo default.
const _kForestWhMigration = 'dama_palette_forest_wh_v3';

const kDefaultBoardPaletteId = BoardPaletteId.forest;
const kDefaultPiecePaletteId = PiecePaletteId.whiteHalf;

BoardPalette boardPaletteById(BoardPaletteId id) {
  for (final p in kBoardPalettes) {
    if (p.id == id) return p;
  }
  return kBoardPalettes.firstWhere((p) => p.id == kDefaultBoardPaletteId);
}

PiecePalette piecePaletteById(PiecePaletteId id) {
  for (final p in kPiecePalettes) {
    if (p.id == id) return p;
  }
  return kPiecePalettes.firstWhere((p) => p.id == kDefaultPiecePaletteId);
}

/// Guest seat titles: palette color names (web parity - same Neo shapes both seats).
({String light, String dark}) pieceSeatNames(PiecePalette palette) {
  return (light: palette.lightName, dark: palette.darkName);
}

BoardPaletteId parseBoardPaletteId(String? raw) {
  for (final p in kBoardPalettes) {
    if (p.id.name == raw) return p.id;
  }
  // Legacy web id with underscore.
  if (raw == 'black_white') return BoardPaletteId.blackWhite;
  if (raw == 'classic') return BoardPaletteId.classic;
  if (raw == 'forest') return BoardPaletteId.forest;
  return kDefaultBoardPaletteId;
}

PiecePaletteId parsePiecePaletteId(String? raw) {
  for (final p in kPiecePalettes) {
    if (p.id.name == raw) return p.id;
  }
  // Legacy web ids with underscore.
  if (raw == 'white_half') return PiecePaletteId.whiteHalf;
  if (raw == 'white_green') return PiecePaletteId.whiteGreen;
  if (raw == 'white_black') return PiecePaletteId.whiteBlack;
  return kDefaultPiecePaletteId;
}

/// Force product defaults once so SharedPreferences classic/ivory do not stick.
Future<void> migratePalettesToBlackWhiteDefault() async {
  final prefs = await SharedPreferences.getInstance();
  if (prefs.getBool(_kBwDefaultMigration) == true) return;
  await prefs.setString(_kBoardPalette, BoardPaletteId.blackWhite.name);
  await prefs.setString(_kPiecePalette, PiecePaletteId.whiteGreen.name);
  await prefs.setBool(_kBwDefaultMigration, true);
}

/// One-time: switch previous White & black default pieces → White & green.
Future<void> migratePalettesToWhiteGreenDefault() async {
  final prefs = await SharedPreferences.getInstance();
  if (prefs.getBool(_kWgDefaultMigration) == true) return;
  final cur = prefs.getString(_kPiecePalette);
  if (cur == null ||
      cur == PiecePaletteId.whiteBlack.name ||
      cur == 'white_black') {
    await prefs.setString(_kPiecePalette, PiecePaletteId.whiteGreen.name);
  }
  await prefs.setBool(_kWgDefaultMigration, true);
}

/// One-time: Classic wood + White & black (overrides prior B&W / green defaults).
Future<void> migratePalettesToClassicWoodWhiteBlackDefault() async {
  final prefs = await SharedPreferences.getInstance();
  if (prefs.getBool(_kClassicWbMigration) == true) return;
  await prefs.setString(_kBoardPalette, BoardPaletteId.classic.name);
  await prefs.setString(_kPiecePalette, PiecePaletteId.whiteBlack.name);
  await prefs.setBool(_kClassicWbMigration, true);
}

/// One-time: Forest + White & black (Neo default; overrides prior classic wood).
Future<void> migratePalettesToForestWhiteBlackDefault() async {
  final prefs = await SharedPreferences.getInstance();
  if (prefs.getBool(_kForestWbMigration) == true) return;
  await prefs.setString(_kBoardPalette, kDefaultBoardPaletteId.name);
  await prefs.setString(_kPiecePalette, PiecePaletteId.whiteBlack.name);
  await prefs.setBool(_kForestWbMigration, true);
}

/// One-time: Forest + White & half (50/50 dark pieces; solid B/W stays selectable).
Future<void> migratePalettesToForestWhiteHalfDefault() async {
  final prefs = await SharedPreferences.getInstance();
  if (prefs.getBool(_kForestWhMigration) == true) return;
  await prefs.setString(_kBoardPalette, kDefaultBoardPaletteId.name);
  await prefs.setString(_kPiecePalette, kDefaultPiecePaletteId.name);
  await prefs.setBool(_kForestWhMigration, true);
}

Future<BoardPaletteId> readBoardPaletteId() async {
  await migratePalettesToBlackWhiteDefault();
  await migratePalettesToWhiteGreenDefault();
  await migratePalettesToClassicWoodWhiteBlackDefault();
  await migratePalettesToForestWhiteBlackDefault();
  await migratePalettesToForestWhiteHalfDefault();
  final prefs = await SharedPreferences.getInstance();
  return parseBoardPaletteId(prefs.getString(_kBoardPalette));
}

Future<PiecePaletteId> readPiecePaletteId() async {
  await migratePalettesToBlackWhiteDefault();
  await migratePalettesToWhiteGreenDefault();
  await migratePalettesToClassicWoodWhiteBlackDefault();
  await migratePalettesToForestWhiteBlackDefault();
  await migratePalettesToForestWhiteHalfDefault();
  final prefs = await SharedPreferences.getInstance();
  return parsePiecePaletteId(prefs.getString(_kPiecePalette));
}

Future<void> writeBoardPaletteId(BoardPaletteId id) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(_kBoardPalette, id.name);
}

Future<void> writePiecePaletteId(PiecePaletteId id) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(_kPiecePalette, id.name);
}

/// Overrides board + piece tokens for descendants (2D + 3D boards).
class BoardPaletteScope extends StatelessWidget {
  const BoardPaletteScope({
    super.key,
    required this.board,
    required this.piece,
    required this.child,
  });

  final BoardPalette board;
  final PiecePalette piece;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final base = damaColorsOf(context);
    final next = base.copyWith(
      boardDark: board.boardDark,
      boardLight: board.boardLight,
      boardSelected: board.highlight,
      pieceLight: piece.pieceLight,
      pieceDark: piece.pieceDark,
      pieceDarkSplit: piece.darkSplit,
    );
    final extensions =
        Map<Object, ThemeExtension<dynamic>>.from(theme.extensions);
    extensions[DamaColors] = next;
    return Theme(
      data: theme.copyWith(extensions: extensions.values),
      child: child,
    );
  }
}
