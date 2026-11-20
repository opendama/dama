import 'dart:io';
import 'dart:typed_data';

import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

/// Persist [bytes] to a temp file and open the platform share sheet (web blob-download parity).
Future<void> shareBytesAsFile({
  required Uint8List bytes,
  required String filename,
  required String mimeType,
}) async {
  final dir = await getTemporaryDirectory();
  final safe = filename.trim().isEmpty ? 'download.bin' : filename.trim();
  final file = File('${dir.path}/$safe');
  await file.writeAsBytes(bytes, flush: true);
  await Share.shareXFiles(
    [XFile(file.path, mimeType: mimeType, name: safe)],
  );
}
