import 'dart:async';
import 'dart:convert';

import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/features/events/community_player_chrome_soft.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';

/// Locale-driven timestamps (web `formatNotificationWhen` / Intl parity).
/// No invented English "ago"/"now" strings: use intl DateFormat only.
String _formatNotificationWhen(String raw, [String? locale]) {
  final parsed = DateTime.tryParse(raw.trim());
  if (parsed == null) return '';
  final when = parsed.isUtc ? parsed.toLocal() : parsed;
  final abs = when.difference(DateTime.now()).abs();
  try {
    if (abs.inDays > 7) {
      return DateFormat.yMMMd(locale).add_jm().format(when);
    }
    return DateFormat.MMMd(locale).add_jm().format(when);
  } catch (_) {
    return '';
  }
}

class _NotifChrome {
  const _NotifChrome({
    required this.bellAria,
    required this.panelTitle,
    required this.emptyMessage,
    required this.markAllRead,
    required this.markAllPending,
    required this.markRead,
    required this.markReadPending,
    required this.loadingMore,
    required this.listFailed,
    required this.pollMs,
    required this.pageSize,
    required this.toastPointsAwardedFmt,
  });

  final String bellAria;
  final String panelTitle;
  final String emptyMessage;
  final String markAllRead;
  final String markAllPending;
  final String markRead;
  final String markReadPending;
  final String loadingMore;
  final String listFailed;
  final int pollMs;
  final int pageSize;
  final String toastPointsAwardedFmt;

  /// Fail closed: require aria, title, poll interval, page size, toast fmt from DB chrome.
  static _NotifChrome? fromJson(Map<String, dynamic>? m) {
    if (m == null) return null;
    final aria = (m['bell_aria'] as String? ?? '').trim();
    final title = (m['panel_title'] as String? ?? '').trim();
    final toastFmt = (m['toast_points_awarded_fmt'] as String? ?? '').trim();
    if (aria.isEmpty || title.isEmpty) return null;
    if (toastFmt.isEmpty ||
        !toastFmt.contains('{points}') ||
        !toastFmt.contains('{label}')) {
      return null;
    }
    final poll = int.tryParse('${m['poll_interval_ms']}') ?? 0;
    final page = int.tryParse('${m['list_page_size']}') ?? 0;
    if (poll <= 0 || page <= 0) return null;
    return _NotifChrome(
      bellAria: aria,
      panelTitle: title,
      emptyMessage: (m['empty_message'] as String? ?? '').trim(),
      markAllRead: (m['mark_all_read'] as String? ?? '').trim(),
      markAllPending: (m['mark_all_pending'] as String? ?? '').trim(),
      markRead: (m['mark_read'] as String? ?? '').trim(),
      markReadPending: (m['mark_read_pending'] as String? ?? '').trim(),
      loadingMore: (m['loading_more'] as String? ?? '').trim(),
      listFailed: (m['list_failed'] as String? ?? '').trim(),
      pollMs: poll,
      pageSize: page,
      toastPointsAwardedFmt: toastFmt,
    );
  }
}

class _NotifItem {
  const _NotifItem({
    required this.id,
    required this.kindCode,
    required this.title,
    required this.body,
    required this.bodyArgs,
    required this.href,
    required this.read,
    required this.createdAt,
  });

  final String id;
  final String kindCode;
  final String title;
  final String body;
  final List<String> bodyArgs;
  final String href;
  final bool read;
  final String createdAt;

  static _NotifItem? fromJson(Map<String, dynamic>? m) {
    if (m == null) return null;
    final id = (m['id'] as String? ?? '').trim();
    final title = (m['title'] as String? ?? '').trim();
    final body = (m['body'] as String? ?? '').trim();
    if (id.isEmpty || title.isEmpty || body.isEmpty) return null;
    final rawArgs = m['body_args'];
    final args = <String>[];
    if (rawArgs is List) {
      for (final a in rawArgs) {
        args.add('$a'.trim());
      }
    }
    return _NotifItem(
      id: id,
      kindCode: (m['kind_code'] as String? ?? '').trim(),
      title: title,
      body: body,
      bodyArgs: args,
      href: (m['href'] as String? ?? '').trim(),
      read: m['read'] == true,
      createdAt: (m['created_at'] as String? ?? '').trim(),
    );
  }

  String? pointsToastText(String fmt) {
    if (bodyArgs.length < 2) return null;
    final points = bodyArgs[0].trim();
    final label = softCompetitionPointsLabel(bodyArgs[1]);
    if (points.isEmpty || label.isEmpty) return null;
    if (!fmt.contains('{points}') || !fmt.contains('{label}')) return null;
    return fmt
        .replaceAll('{points}', points)
        .replaceAll('{label}', label)
        .trim();
  }
}

/// Trim-parity notification bell: poll unread, sheet list, scroll load-more.
class NotificationBellButton extends StatefulWidget {
  const NotificationBellButton({
    super.key,
    required this.accessToken,
    this.onNavigateHref,
  });

  final String accessToken;
  final void Function(String href)? onNavigateHref;

  @override
  State<NotificationBellButton> createState() => _NotificationBellButtonState();
}

class _NotificationBellButtonState extends State<NotificationBellButton> {
  _NotifChrome? _chrome;
  String _badge = '';
  int _unreadCount = 0;
  Timer? _poll;
  bool _loadingUnread = true;
  final Set<String> _toastedPointsIds = <String>{};

  String get _rest => ApiConfig.defaults.restUrl;

  Map<String, String> get _headers => {
        'Authorization': 'Bearer ${widget.accessToken}',
        'Content-Type': 'application/json',
      };

  @override
  void initState() {
    super.initState();
    unawaited(_loadUnread());
  }

  @override
  void didUpdateWidget(covariant NotificationBellButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.accessToken != widget.accessToken) {
      unawaited(_loadUnread());
    }
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _loadUnread() async {
    try {
      final res = await http.get(
        Uri.parse('$_rest/me/notifications/unread-count'),
        headers: _headers,
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        setState(() {
          _loadingUnread = false;
          _chrome = null;
        });
        return;
      }
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      final chrome =
          _NotifChrome.fromJson(map['chrome'] as Map<String, dynamic>?);
      final countRaw = map['count'];
      final count =
          countRaw is int ? countRaw : int.tryParse('${countRaw ?? ''}') ?? 0;
      final prevUnread = _unreadCount;
      setState(() {
        _chrome = chrome;
        _badge = (map['badge_label'] as String? ?? '').trim();
        _unreadCount = count > 0 ? count : 0;
        _loadingUnread = false;
      });
      if (_unreadCount > prevUnread) {
        unawaited(_toastCompetitionPointsIfAny());
      }
      _poll?.cancel();
      if (chrome != null) {
        _poll = Timer.periodic(Duration(milliseconds: chrome.pollMs), (_) {
          unawaited(_loadUnread());
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _loadingUnread = false;
          _chrome = null;
        });
      }
    }
  }

  Future<void> _toastCompetitionPointsIfAny() async {
    try {
      final uri = Uri.parse('$_rest/me/notifications').replace(
        queryParameters: {'skip': '0', 'limit': '20'},
      );
      final res = await http.get(uri, headers: _headers);
      if (!mounted || res.statusCode >= 300) return;
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      final chrome =
          _NotifChrome.fromJson(map['chrome'] as Map<String, dynamic>?) ??
              _chrome;
      if (chrome == null) return;
      final rawItems = (map['items'] as List<dynamic>? ?? const []);
      for (final raw in rawItems) {
        final item = _NotifItem.fromJson(raw as Map<String, dynamic>?);
        if (item == null || item.read) continue;
        if (item.kindCode != 'player.competition_points_awarded') continue;
        if (_toastedPointsIds.contains(item.id)) continue;
        _toastedPointsIds.add(item.id);
        final text = item.pointsToastText(chrome.toastPointsAwardedFmt);
        if (text == null || text.isEmpty) continue;
        // Floating near top so the toast stays visible above bottom sheets / modals.
        final h = MediaQuery.sizeOf(context).height;
        final topPad = MediaQuery.viewPaddingOf(context).top;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(text),
            behavior: SnackBarBehavior.floating,
            margin: EdgeInsets.only(
              left: 16,
              right: 16,
              bottom: (h - topPad - 96).clamp(80.0, h),
            ),
          ),
        );
        unawaited(http.post(
          Uri.parse('$_rest/me/notifications/${item.id}/read'),
          headers: _headers,
        ));
      }
    } catch (_) {}
  }

  Future<void> _openPanel() async {
    final chrome = _chrome;
    if (chrome == null) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: damaColorsOf(context).card,
      builder: (ctx) => _NotificationSheet(
        accessToken: widget.accessToken,
        chrome: chrome,
        restUrl: _rest,
        unreadCount: _unreadCount,
        onMarked: () => unawaited(_loadUnread()),
        onNavigateHref: widget.onNavigateHref,
      ),
    );
    if (mounted) unawaited(_loadUnread());
  }

  @override
  Widget build(BuildContext context) {
    final chrome = _chrome;
    if (_loadingUnread && chrome == null) {
      return const SizedBox(
        width: 40,
        height: 40,
        child: Center(
          child: SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }
    if (chrome == null) return const SizedBox.shrink();
    return IconButton(
      tooltip: chrome.bellAria,
      onPressed: _openPanel,
      icon: Badge(
        isLabelVisible: _badge.isNotEmpty,
        label: Text(_badge, style: const TextStyle(fontSize: 10)),
        child: const Icon(Icons.notifications_outlined),
      ),
    );
  }
}

class _NotificationSheet extends StatefulWidget {
  const _NotificationSheet({
    required this.accessToken,
    required this.chrome,
    required this.restUrl,
    required this.unreadCount,
    required this.onMarked,
    this.onNavigateHref,
  });

  final String accessToken;
  final _NotifChrome chrome;
  final String restUrl;

  /// From `/me/notifications/unread-count` (never invent from local list).
  final int unreadCount;
  final VoidCallback onMarked;
  final void Function(String href)? onNavigateHref;

  @override
  State<_NotificationSheet> createState() => _NotificationSheetState();
}

class _NotificationSheetState extends State<_NotificationSheet> {
  final _items = <_NotifItem>[];
  final _seen = <String>{};
  final _scroll = ScrollController();
  bool _loading = true;
  String? _markingOneId;
  bool _loadingMore = false;
  bool _hasMore = false;
  int _nextSkip = 0;
  bool _failed = false;
  bool _markingAll = false;
  bool _wasNearBottom = false;

  Map<String, String> get _headers => {
        'Authorization': 'Bearer ${widget.accessToken}',
        'Content-Type': 'application/json',
      };

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    unawaited(_load(reset: true));
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_hasMore || _loadingMore || _loading || _failed) return;
    if (!_scroll.hasClients) return;
    final pos = _scroll.position;
    // Short list (maxScrollExtent == 0) is not "at end" - avoids cascade glitching.
    final near =
        pos.maxScrollExtent > 8 && pos.pixels >= pos.maxScrollExtent - 80;
    if (near && !_wasNearBottom) {
      unawaited(_load(reset: false));
    }
    _wasNearBottom = near;
  }

  Future<void> _load({required bool reset}) async {
    if (reset) {
      setState(() {
        _loading = true;
        _failed = false;
        _items.clear();
        _seen.clear();
        _nextSkip = 0;
      });
    } else {
      if (_loadingMore) return;
      setState(() => _loadingMore = true);
    }
    try {
      final uri = Uri.parse('${widget.restUrl}/me/notifications').replace(
        queryParameters: {
          'skip': '$_nextSkip',
          'limit': '${widget.chrome.pageSize}',
        },
      );
      final res = await http.get(uri, headers: _headers);
      if (!mounted) return;
      if (res.statusCode >= 300) {
        setState(() {
          _failed = true;
          _loading = false;
          _loadingMore = false;
        });
        return;
      }
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      final rawItems = (map['items'] as List<dynamic>? ?? const []);
      final meta = map['meta'] as Map<String, dynamic>? ?? const {};
      for (final raw in rawItems) {
        final item = _NotifItem.fromJson(raw as Map<String, dynamic>?);
        if (item == null || _seen.contains(item.id)) continue;
        _seen.add(item.id);
        _items.add(item);
      }
      final hasMore = meta['has_more'] == true;
      final next = (meta['next_skip'] as num?)?.toInt();
      final pageLen = rawItems.length;
      setState(() {
        // Empty page → stop (never invent further pages from length heuristics).
        _hasMore = hasMore && next != null && pageLen > 0;
        _nextSkip = next ?? _nextSkip;
        _loading = false;
        _loadingMore = false;
        _failed = false;
      });
      if (_hasMore) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted || !_scroll.hasClients) return;
          if (_scroll.position.maxScrollExtent > 8) return;
          unawaited(_load(reset: false));
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _failed = true;
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  Future<void> _markOne(String id) async {
    if (_markingOneId != null) return;
    setState(() => _markingOneId = id);
    try {
      final res = await http.post(
        Uri.parse('${widget.restUrl}/me/notifications/$id/read'),
        headers: _headers,
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        setState(() => _markingOneId = null);
        return;
      }
      setState(() {
        _markingOneId = null;
        final i = _items.indexWhere((e) => e.id == id);
        if (i >= 0) {
          _items[i] = _NotifItem(
            id: _items[i].id,
            kindCode: _items[i].kindCode,
            title: _items[i].title,
            body: _items[i].body,
            bodyArgs: _items[i].bodyArgs,
            href: _items[i].href,
            read: true,
            createdAt: _items[i].createdAt,
          );
        }
      });
      widget.onMarked();
    } catch (_) {
      if (mounted) setState(() => _markingOneId = null);
    }
  }

  Future<void> _markAll() async {
    setState(() => _markingAll = true);
    try {
      final res = await http.post(
        Uri.parse('${widget.restUrl}/me/notifications/read-all'),
        headers: _headers,
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        setState(() => _markingAll = false);
        return;
      }
      setState(() {
        for (var i = 0; i < _items.length; i++) {
          final e = _items[i];
          _items[i] = _NotifItem(
            id: e.id,
            kindCode: e.kindCode,
            title: e.title,
            body: e.body,
            bodyArgs: e.bodyArgs,
            href: e.href,
            read: true,
            createdAt: e.createdAt,
          );
        }
        _markingAll = false;
      });
      widget.onMarked();
    } catch (_) {
      if (mounted) setState(() => _markingAll = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final height = MediaQuery.sizeOf(context).height * 0.7;
    return SizedBox(
      height: height,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    widget.chrome.panelTitle,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                if (widget.chrome.markAllRead.isNotEmpty &&
                    widget.unreadCount > 0)
                  TextButton(
                    onPressed: _markingAll ? null : _markAll,
                    child: Text(
                      _markingAll && widget.chrome.markAllPending.isNotEmpty
                          ? widget.chrome.markAllPending
                          : widget.chrome.markAllRead,
                    ),
                  ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: _failed
                ? (widget.chrome.listFailed.isEmpty
                    ? const SizedBox.shrink()
                    : Center(child: Text(widget.chrome.listFailed)))
                : _loading && _items.isEmpty
                    ? const Center(child: CircularProgressIndicator())
                    : _items.isEmpty
                        ? Center(
                            child: Text(
                              widget.chrome.emptyMessage,
                              style: TextStyle(color: tokens.onSurfaceMuted),
                            ),
                          )
                        : ListView.builder(
                            controller: _scroll,
                            // Reserve end slot while more pages exist (stable height; label only in-flight).
                            itemCount: _items.length +
                                ((_loadingMore || _hasMore) ? 1 : 0),
                            itemBuilder: (context, index) {
                              if (index >= _items.length) {
                                return Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: Center(
                                    child: _loadingMore
                                        ? Text(
                                            widget.chrome.loadingMore,
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: tokens.onSurfaceMuted,
                                            ),
                                          )
                                        : const SizedBox(height: 14),
                                  ),
                                );
                              }
                              final item = _items[index];
                              final clickable = item.href.startsWith('/') &&
                                  !item.href.startsWith('//');
                              return Material(
                                color: item.read
                                    ? Colors.transparent
                                    : tokens.surfaceMuted
                                        .withValues(alpha: 0.5),
                                child: InkWell(
                                  onTap: clickable
                                      ? () {
                                          final href = item.href;
                                          unawaited(() async {
                                            // Await mark-read so DM deep-link opens with list settled.
                                            if (!item.read) {
                                              await _markOne(item.id);
                                            }
                                            if (!context.mounted) return;
                                            Navigator.of(context).pop();
                                            widget.onNavigateHref?.call(href);
                                          }());
                                        }
                                      : null,
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 16,
                                      vertical: 12,
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          item.title,
                                          style: Theme.of(context)
                                              .textTheme
                                              .titleSmall,
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          item.body,
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: tokens.onSurfaceMuted,
                                          ),
                                        ),
                                        if (item.createdAt.isNotEmpty) ...[
                                          const SizedBox(height: 4),
                                          Text(
                                            _formatNotificationWhen(
                                              item.createdAt,
                                              Localizations.localeOf(context)
                                                  .toLanguageTag(),
                                            ),
                                            style: TextStyle(
                                              fontSize: 10,
                                              color: tokens.onSurfaceMuted,
                                            ),
                                          ),
                                        ],
                                        if (!item.read &&
                                            widget.chrome.markRead.isNotEmpty)
                                          TextButton(
                                            onPressed: _markingOneId != null
                                                ? null
                                                : () => unawaited(
                                                      _markOne(item.id),
                                                    ),
                                            child: Text(
                                              _markingOneId == item.id &&
                                                      widget
                                                          .chrome
                                                          .markReadPending
                                                          .isNotEmpty
                                                  ? widget
                                                      .chrome.markReadPending
                                                  : widget.chrome.markRead,
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}
