import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/features/chat/chat_media_url.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';

enum ChatImagePickKind { cancelled, notImage, failed, ok }

class ChatImagePickResult {
  const ChatImagePickResult._(this.kind, [this.url]);

  final ChatImagePickKind kind;
  final String? url;

  static const cancelled = ChatImagePickResult._(ChatImagePickKind.cancelled);
  static const notImage = ChatImagePickResult._(ChatImagePickKind.notImage);
  static const failed = ChatImagePickResult._(ChatImagePickKind.failed);
  static ChatImagePickResult ok(String url) =>
      ChatImagePickResult._(ChatImagePickKind.ok, url);
}

/// Picks a gallery image and uploads via Cloudinary-backed chat/DM endpoint.
Future<ChatImagePickResult> pickAndUploadChatImage({
  required String token,
  required String uploadPath,
}) async {
  final t = token.trim();
  final path = uploadPath.trim();
  if (t.isEmpty || path.isEmpty) return ChatImagePickResult.failed;

  final picker = ImagePicker();
  final file = await picker.pickImage(
    source: ImageSource.gallery,
    maxWidth: 1600,
    maxHeight: 1600,
    imageQuality: 88,
  );
  if (file == null) return ChatImagePickResult.cancelled;

  final name = file.name.toLowerCase();
  final mime = (file.mimeType ?? '').toLowerCase();
  final looksImage = mime.startsWith('image/') ||
      name.endsWith('.png') ||
      name.endsWith('.jpg') ||
      name.endsWith('.jpeg') ||
      name.endsWith('.gif') ||
      name.endsWith('.webp');
  if (!looksImage ||
      name.endsWith('.mp4') ||
      name.endsWith('.mov') ||
      name.endsWith('.webm') ||
      name.endsWith('.avi')) {
    return ChatImagePickResult.notImage;
  }

  final uri = Uri.parse('${ApiConfig.defaults.restUrl}$path');
  final req = http.MultipartRequest('POST', uri);
  req.headers['Authorization'] = 'Bearer $t';

  String? mimeSubtype;
  if (name.endsWith('.png') || mime == 'image/png') {
    mimeSubtype = 'png';
  } else if (name.endsWith('.gif') || mime == 'image/gif') {
    mimeSubtype = 'gif';
  } else if (name.endsWith('.webp') || mime == 'image/webp') {
    mimeSubtype = 'webp';
  } else {
    mimeSubtype = 'jpeg';
  }

  req.files.add(
    await http.MultipartFile.fromPath(
      'file',
      file.path,
      contentType: MediaType('image', mimeSubtype),
    ),
  );

  final streamed = await req.send();
  final res = await http.Response.fromStream(streamed);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    return ChatImagePickResult.failed;
  }
  try {
    final map = jsonDecode(res.body) as Map<String, dynamic>;
    final url = (map['image_url'] as String?)?.trim() ?? '';
    if (url.isEmpty) return ChatImagePickResult.failed;
    return ChatImagePickResult.ok(resolveChatMediaUrl(url));
  } catch (_) {
    return ChatImagePickResult.failed;
  }
}
