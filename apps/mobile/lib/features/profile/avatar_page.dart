import 'dart:convert';
import 'dart:io';

import 'package:dama_mobile/core/cache/query_cache.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/notifications/notification_app_bar_actions.dart';
import 'package:dama_mobile/widgets/dama_user_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';

class AvatarPage extends StatefulWidget {
  const AvatarPage({super.key, required this.accessToken});

  final String accessToken;

  @override
  State<AvatarPage> createState() => _AvatarPageState();
}

class _AvatarPageState extends State<AvatarPage> {
  final _picker = ImagePicker();
  String? _thumbUrl;
  String? _error;
  bool _busy = false;
  AvatarChrome? _chrome;
  String? _chromeError;
  bool _chromeLoading = true;

  @override
  void initState() {
    super.initState();
    _loadChrome();
  }

  Future<void> _loadChrome() async {
    try {
      final res = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/v1/public/avatar-chrome'),
      );
      Map<String, dynamic>? map;
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) map = decoded;
      } catch (_) {}
      final fromBody =
          (map?['avatar_chrome_unavailable'] as String?)?.trim() ?? '';
      if (res.statusCode != 200) {
        if (!mounted) return;
        setState(() {
          _chromeLoading = false;
          _chromeError = fromBody.isNotEmpty
              ? fromBody
              : ((map?['error'] as String?)?.trim() ?? '');
        });
        return;
      }
      final chrome = AvatarChrome.fromJson(map);
      if (!mounted) return;
      setState(() {
        _chrome = chrome;
        _chromeLoading = false;
        _chromeError = chrome == null ? fromBody : null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _chromeLoading = false;
        _chromeError = '';
      });
    }
  }

  Future<void> _pickAndUpload() async {
    final chrome = _chrome;
    if (chrome == null || _busy) return;
    setState(() {
      _error = null;
      _busy = true;
    });
    try {
      final file = await _picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 92,
      );
      if (file == null) {
        setState(() => _busy = false);
        return;
      }
      final uri = Uri.parse('${ApiConfig.baseUrl}/api/v1/avatars/upload');
      final req = http.MultipartRequest('POST', uri);
      req.headers['Authorization'] = 'Bearer ${widget.accessToken}';
      req.files.add(await http.MultipartFile.fromPath(
        'file',
        file.path,
        contentType: MediaType('image', 'jpeg'),
        filename: File(file.path).uri.pathSegments.last,
      ));
      final streamed = await req.send();
      final body = await streamed.stream.bytesToString();
      if (streamed.statusCode >= 300) {
        setState(() {
          _error = chrome.uploadFailed;
          _busy = false;
        });
        return;
      }
      String? thumb;
      String? full;
      String? userId;
      try {
        final map = jsonDecode(body) as Map<String, dynamic>;
        final avatar = map['avatar'] as Map<String, dynamic>?;
        final user = map['user'] as Map<String, dynamic>?;
        thumb = avatar?['thumb_url'] as String? ??
            (user?['avatar_thumb_url'] as String?) ??
            map['avatar_thumb_url'] as String?;
        full = avatar?['full_url'] as String? ??
            (user?['avatar_full_url'] as String?);
        userId = user?['id'] as String?;
      } catch (_) {}
      QueryCache.invalidate(CacheKeys.me(widget.accessToken));
      QueryCache.invalidatePrefix('session:leaderboard');
      QueryCache.invalidatePrefix('session:player');
      QueryCache.invalidatePrefix('live:matchmaking');
      final uid = (userId ?? '').trim();
      if (uid.isNotEmpty) {
        QueryCache.invalidate(CacheKeys.player(uid));
      }
      if (!mounted) return;
      context.read<AuthCubit>().applyGameAvatar(thumb, fullUrl: full);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(chrome.toastUpdated)),
      );
      setState(() {
        _thumbUrl = thumb;
        _busy = false;
      });
    } catch (_) {
      setState(() {
        _error = chrome.uploadFailed;
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_chromeLoading) {
      return Scaffold(
        appBar: AppBar(actions: const [NotificationAppBarActions()]),
        body: const Padding(
          padding: EdgeInsets.all(24),
          child: AvatarUploadSkeleton(),
        ),
      );
    }
    final chrome = _chrome;
    if (chrome == null) {
      return Scaffold(
        appBar: AppBar(actions: const [NotificationAppBarActions()]),
        body: Center(
          child: Text(
            (_chromeError ?? '').isNotEmpty ? _chromeError! : '',
            style: TextStyle(color: damaColorsOf(context).danger),
          ),
        ),
      );
    }
    final tokens = damaColorsOf(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(chrome.pageTitle),
        actions: const [NotificationAppBarActions()],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(chrome.pageBlurb),
            const SizedBox(height: 28),
            Center(
              child: Tooltip(
                message: chrome.changePhotoAria,
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: _busy ? null : _pickAndUpload,
                    child: Ink(
                      width: 112,
                      height: 112,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: tokens.surface,
                        border: Border.all(color: tokens.border),
                      ),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          DamaUserAvatar(
                            imageUrl: _thumbUrl,
                            radius: 56,
                          ),
                          DecoratedBox(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.black
                                  .withValues(alpha: _busy ? 0.55 : 0.35),
                            ),
                            child: Center(
                              child: _busy
                                  ? const SizedBox(
                                      width: 28,
                                      height: 28,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2),
                                    )
                                  : const Icon(
                                      Icons.photo_camera_outlined,
                                      color: Colors.white,
                                      size: 28,
                                    ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              chrome.changePhotoAria,
              textAlign: TextAlign.center,
              style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 13),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: TextStyle(color: tokens.danger),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
