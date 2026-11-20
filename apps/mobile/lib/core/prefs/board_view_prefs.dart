import 'package:shared_preferences/shared_preferences.dart';

/// Chess.com-style board view: flat 2D default, optional 3D.
enum BoardViewMode { flat2d, scene3d }

const _kBoardView = 'dama_board_view';

Future<BoardViewMode> readBoardViewMode() async {
  final prefs = await SharedPreferences.getInstance();
  final raw = prefs.getString(_kBoardView);
  return raw == '3d' ? BoardViewMode.scene3d : BoardViewMode.flat2d;
}

Future<void> writeBoardViewMode(BoardViewMode mode) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(
      _kBoardView, mode == BoardViewMode.scene3d ? '3d' : '2d');
}
