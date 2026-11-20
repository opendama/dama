import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dama_mobile/core/cache/query_cache.dart';
import 'package:dama_mobile/core/cache/skip_store.dart';
import 'package:dama_mobile/core/io/share_bytes.dart';
import 'package:dama_mobile/core/network/api_config.dart';
import 'package:dama_mobile/core/network/graphql_client.dart';
import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/core/ui/country_flag.dart';
import 'package:dama_mobile/core/ui/shimmer_skeletons.dart';
import 'package:dama_mobile/core/ui/skip_pagination_bar.dart';
import 'package:dama_mobile/features/auth/auth_cubit.dart';
import 'package:dama_mobile/features/compliance/cash_compliance_panel.dart';
import 'package:dama_mobile/features/compliance/document_kyc_panel.dart';
import 'package:dama_mobile/features/leaderboard/leaderboard_cubit.dart'
    show SkipMeta;
import 'package:dama_mobile/features/legal/legal_page.dart';
import 'package:dama_mobile/features/notifications/notification_app_bar_actions.dart';
import 'package:dama_mobile/features/player/player_inspect_sheet.dart';
import 'package:dama_mobile/features/profile/my_tournaments_panel.dart';
import 'package:dama_mobile/widgets/dama_user_avatar.dart';
import 'package:dama_mobile/widgets/host_trust_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';

/// Player profile hydrated from the live API + DB profile inspect chrome.
class ProfilePage extends StatefulWidget {
  ProfilePage({
    super.key,
    required this.accessToken,
    ApiConfig? config,
  }) : config = config ?? ApiConfig.defaults;

  final String accessToken;
  final ApiConfig config;

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  GPlayer? _me;
  String? _error;
  bool _loading = true;
  ProfileInspectChrome? _chrome;
  AvatarChrome? _avatarChrome;
  bool _chromeLoading = true;
  StoreComplianceChrome? _compliance;
  String _complianceUnavailable = '';
  bool _complianceLoading = true;
  final _confirmController = TextEditingController();
  final _picker = ImagePicker();
  bool _deleting = false;
  bool _exporting = false;
  bool _uploadingAvatar = false;
  List<RestMatchSummary> _matches = const [];
  SkipMeta? _matchesMeta;
  bool _matchesLoading = false;
  final _myTournamentsKey = GlobalKey<MyTournamentsPanelState>();

  @override
  void initState() {
    super.initState();
    unawaited(_loadChrome());
    unawaited(_loadCompliance());
    final cached = QueryCache.read<GPlayer>(
      CacheKeys.me(widget.accessToken),
      maxAge: QueryCache.sessionTtl,
      allowStale: true,
    );
    if (cached != null) {
      _me = cached;
      _loading = false;
    }
    _load(force: cached == null);
  }

  @override
  void dispose() {
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _loadChrome() async {
    try {
      final results = await Future.wait([
        http.get(Uri.parse(
            '${widget.config.restUrl}/public/profile-inspect-chrome')),
        http.get(Uri.parse('${widget.config.restUrl}/public/avatar-chrome')),
      ]);
      Map<String, dynamic>? map;
      Map<String, dynamic>? avatarMap;
      try {
        final decoded = jsonDecode(results[0].body);
        if (decoded is Map<String, dynamic>) map = decoded;
      } catch (_) {}
      try {
        final decoded = jsonDecode(results[1].body);
        if (decoded is Map<String, dynamic>) avatarMap = decoded;
      } catch (_) {}
      final chrome = ProfileInspectChrome.fromJson(map);
      final avatarChrome = AvatarChrome.fromJson(avatarMap);
      if (!mounted) return;
      setState(() {
        _chrome = chrome;
        _avatarChrome = avatarChrome;
        _chromeLoading = false;
        if (chrome == null) {
          _error =
              (map?['profile_inspect_chrome_unavailable'] as String?)?.trim() ??
                  '';
        }
      });
      if (chrome != null && chrome.listPageSizeInt > 0) {
        unawaited(_loadMatches(SkipStore.read('profile_matches')));
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _chromeLoading = false;
        _error = '';
      });
    }
  }

  Future<void> _loadMatches(int skip) async {
    final limit = _chrome?.listPageSizeInt ?? 0;
    if (limit < 1) return;
    if (mounted) setState(() => _matchesLoading = true);
    try {
      final uri = Uri.parse('${widget.config.restUrl}/matches/me').replace(
        queryParameters: {'skip': '$skip', 'limit': '$limit'},
      );
      final res = await http.get(
        uri,
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      if (res.statusCode >= 300) {
        if (mounted) setState(() => _matchesLoading = false);
        return;
      }
      final json = jsonDecode(res.body) as Map<String, dynamic>;
      final list = (json['matches'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(RestMatchSummary.fromJson)
          .toList();
      final metaMap = json['meta'];
      final meta =
          metaMap is Map<String, dynamic> ? SkipMeta.fromJson(metaMap) : null;
      if (!mounted) return;
      setState(() {
        _matches = list;
        _matchesMeta = meta;
        _matchesLoading = false;
      });
      unawaited(SkipStore.write('profile_matches', skip));
    } catch (_) {
      if (mounted) setState(() => _matchesLoading = false);
    }
  }

  Future<void> _pickAndUploadAvatar() async {
    final chrome = _avatarChrome;
    if (chrome == null || _uploadingAvatar) return;
    setState(() => _uploadingAvatar = true);
    try {
      final file = await _picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 92,
      );
      if (file == null) {
        if (mounted) setState(() => _uploadingAvatar = false);
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
      if (!mounted) return;
      if (streamed.statusCode >= 300) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(chrome.uploadFailed)),
        );
        setState(() => _uploadingAvatar = false);
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
            (user?['avatar_thumb_url'] as String?);
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
      await _load(force: true);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(chrome.toastUpdated)),
      );
      setState(() => _uploadingAvatar = false);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(chrome.uploadFailed)),
      );
      setState(() => _uploadingAvatar = false);
    }
  }

  Future<void> _loadCompliance() async {
    try {
      final res = await http.get(
        Uri.parse('${widget.config.restUrl}/public/store-compliance-chrome'),
      );
      Map<String, dynamic>? map;
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) map = decoded;
      } catch (_) {}
      final chrome = map == null ? null : StoreComplianceChrome.fromJson(map);
      if (!mounted) return;
      setState(() {
        _compliance = chrome;
        _complianceUnavailable =
            (map?['store_compliance_unavailable'] as String?)?.trim() ?? '';
        _complianceLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _complianceLoading = false);
    }
  }

  Future<void> _load({bool force = false}) async {
    if (!force && _me != null) {
      unawaited(_fetch(showSkeleton: false));
      return;
    }
    await _fetch(showSkeleton: _me == null);
  }

  Future<void> _fetch({required bool showSkeleton}) async {
    if (showSkeleton && mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final gql = GraphqlClient(
        config: widget.config,
        accessToken: widget.accessToken,
      );
      final me = await gql.fetchMe();
      if (me == null) {
        if (!mounted) return;
        setState(() {
          _error = _chrome?.loadFailed ?? '';
          _loading = false;
        });
        return;
      }
      QueryCache.write(CacheKeys.me(widget.accessToken), me);
      if (!mounted) return;
      setState(() {
        _me = me;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = _chrome?.loadFailed ?? '';
        _loading = false;
      });
    }
  }

  Future<void> _exportData(StoreComplianceChrome chrome) async {
    setState(() => _exporting = true);
    try {
      final res = await http.get(
        Uri.parse('${widget.config.restUrl}/me/data-export'),
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(chrome.exportDataFailed)),
        );
        return;
      }
      final filename = chrome.exportFilename.trim();
      if (filename.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(chrome.exportDataFailed)),
        );
        return;
      }
      await shareBytesAsFile(
        bytes: Uint8List.fromList(res.bodyBytes),
        filename: filename,
        mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(chrome.exportDataFailed)),
      );
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _deleteAccount(StoreComplianceChrome chrome) async {
    setState(() => _deleting = true);
    try {
      final res = await http.delete(
        Uri.parse('${widget.config.restUrl}/me/account'),
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      );
      if (!mounted) return;
      if (res.statusCode >= 300) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(chrome.deleteAccountFailed)),
        );
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(chrome.deleteAccountSuccess)),
      );
      await context.read<AuthCubit>().logout();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(chrome.deleteAccountFailed)),
      );
    } finally {
      if (mounted) setState(() => _deleting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final chrome = _chrome;
    final avatarChrome = _avatarChrome;
    final me = _me;
    final auth = context.watch<AuthCubit>().state;
    // Prefer live AuthCubit (WS/upload write-through); then me query; then OAuth.
    final liveAuth = (auth.avatarUrl ?? '').trim();
    final gameAvatar = (me?.avatarThumbUrl ?? '').trim();
    final avatarUrl = liveAuth.isNotEmpty ? liveAuth : gameAvatar;
    final displayName = (auth.displayName ?? '').trim();
    final compliance = _compliance;

    if (_chromeLoading || chrome == null) {
      return Scaffold(
        appBar: AppBar(actions: const [NotificationAppBarActions()]),
        body: const Padding(
          padding: EdgeInsets.all(16),
          child: ProfileSkeleton(),
        ),
      );
    }

    final confirmMatches = compliance != null &&
        _confirmController.text.trim() == compliance.deleteAccountConfirmToken;

    return Scaffold(
      appBar: AppBar(
        title: Text(chrome.pageTitle),
        actions: const [NotificationAppBarActions()],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          QueryCache.invalidate(CacheKeys.me(widget.accessToken));
          await Future.wait([
            _fetch(showSkeleton: false),
            _loadCompliance(),
            _myTournamentsKey.currentState?.reload() ?? Future.value(),
          ]);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_loading) const ProfileSkeleton(),
            if (_error != null && _error!.isNotEmpty)
              Text(_error!,
                  style: TextStyle(color: damaColorsOf(context).danger)),
            if (!_loading && me != null) ...[
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Tooltip(
                    message: avatarChrome?.changePhotoAria ?? '',
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        customBorder: const CircleBorder(),
                        onTap: _uploadingAvatar ? null : _pickAndUploadAvatar,
                        child: SizedBox(
                          width: 64,
                          height: 64,
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              DamaUserAvatar(
                                imageUrl:
                                    avatarUrl.isNotEmpty ? avatarUrl : null,
                                radius: 32,
                              ),
                              DecoratedBox(
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Colors.black.withValues(
                                    alpha: _uploadingAvatar ? 0.55 : 0.28,
                                  ),
                                ),
                                child: Center(
                                  child: _uploadingAvatar
                                      ? const SizedBox(
                                          width: 22,
                                          height: 22,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white,
                                          ),
                                        )
                                      : const Icon(
                                          Icons.photo_camera_outlined,
                                          color: Colors.white,
                                          size: 22,
                                        ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: InkWell(
                      onTap: me.id.isEmpty
                          ? null
                          : () => showPlayerInspectSheet(context, me.id),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  displayName.isNotEmpty
                                      ? displayName
                                      : me.username,
                                  style: const TextStyle(fontSize: 20),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 6),
                              CountryFlag(code: me.countryCode, height: 14),
                              const SizedBox(width: 6),
                              HostTrustBadge(
                                label: me.hostTrustBadge,
                                tier: me.hostTrustTier,
                                fontSize: 10,
                                dense: true,
                              ),
                            ],
                          ),
                          if (() {
                            final sep = chrome.hostRepMetaSeparator;
                            return sep.isNotEmpty &&
                                chrome.hostRepFinishedLabel.trim().isNotEmpty &&
                                chrome.hostRepCancelledLabel
                                    .trim()
                                    .isNotEmpty &&
                                chrome.hostRepReportsLabel.trim().isNotEmpty &&
                                me.hostFinishedPaidCups != null &&
                                me.hostCancelledPaidCups != null &&
                                me.hostOpenReports != null;
                          }())
                            Text(
                              [
                                '${chrome.hostRepFinishedLabel.trim()} ${me.hostFinishedPaidCups}',
                                '${chrome.hostRepCancelledLabel.trim()} ${me.hostCancelledPaidCups}',
                                '${chrome.hostRepReportsLabel.trim()} ${me.hostOpenReports}',
                              ].join(chrome.hostRepMetaSeparator),
                              style: TextStyle(
                                color: tokens.onSurfaceMuted,
                                fontSize: 11,
                              ),
                            ),
                          Text(
                            '${chrome.labelRating} ${me.rating}${chrome.seatMetaSeparator}${chrome.labelXp} ${me.xp}${chrome.seatMetaSeparator}${chrome.wldLabel} ${me.wins}${chrome.statsSeparator}${me.losses}${chrome.statsSeparator}${me.draws}',
                            style: TextStyle(color: tokens.onSurfaceMuted),
                          ),
                          if (avatarChrome != null)
                            Text(
                              avatarChrome.tapInspectHint,
                              style: TextStyle(
                                color: tokens.gold,
                                fontSize: 12,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Text(chrome.recentMatchesTitle,
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              if (_matches.isEmpty && !_matchesLoading)
                Text(chrome.noMatches,
                    style: TextStyle(color: tokens.onSurfaceMuted))
              else
                SizedBox(
                  height: 220,
                  child: ListView.separated(
                    itemCount: _matches.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final m = _matches[i];
                      final outcome = m.isDraw
                          ? chrome.outcomeDraw
                          : m.isFree
                              ? '${m.moveCount ?? 0} ${chrome.movesSuffix}${chrome.freeSuffix}'
                              : '${m.moveCount ?? 0} ${chrome.movesSuffix}';
                      return ListTile(
                        dense: true,
                        title: Text(
                            (m.mode ?? '').isNotEmpty ? m.mode! : (m.id ?? '')),
                        subtitle: Text(
                          outcome,
                          style: TextStyle(
                              color: tokens.onSurfaceMuted, fontSize: 12),
                        ),
                      );
                    },
                  ),
                ),
              if (_matchesMeta != null && _matchesMeta!.totalPages > 1)
                SkipPaginationBar(
                  meta: _matchesMeta!,
                  busy: _matchesLoading,
                  padding: const EdgeInsets.only(top: 8),
                  onSkip: (skip) => unawaited(_loadMatches(skip)),
                ),
            ],
            const SizedBox(height: 16),
            MyTournamentsPanel(
              key: _myTournamentsKey,
              accessToken: widget.accessToken,
              config: widget.config,
            ),
            if (!_complianceLoading &&
                compliance == null &&
                _complianceUnavailable.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 24),
                child: Text(
                  _complianceUnavailable,
                  style: TextStyle(color: tokens.danger),
                ),
              ),
            if (compliance != null) ...[
              CashCompliancePanel(accessToken: widget.accessToken),
              const SizedBox(height: 16),
              DocumentKycPanel(accessToken: widget.accessToken),
              const SizedBox(height: 28),
              Text(
                compliance.accountSectionTitle,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: tokens.gold,
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 12,
                children: [
                  TextButton(
                    onPressed: () =>
                        openLegalPage(context, LegalDocKind.privacy),
                    child: Text(compliance.privacyLinkLabel),
                  ),
                  TextButton(
                    onPressed: () => openLegalPage(context, LegalDocKind.terms),
                    child: Text(compliance.termsLinkLabel),
                  ),
                  TextButton(
                    onPressed: () =>
                        openLegalPage(context, LegalDocKind.refunds),
                    child: Text(compliance.refundsLinkLabel),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Text(
                compliance.exportDataTitle,
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: 4),
              Text(
                compliance.exportDataBlurb,
                style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: _exporting ? null : () => _exportData(compliance),
                child: Text(compliance.exportDataAction),
              ),
              const SizedBox(height: 20),
              Text(
                compliance.deleteAccountTitle,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: tokens.danger,
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                compliance.deleteAccountBlurb,
                style: TextStyle(color: tokens.onSurfaceMuted, fontSize: 12),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _confirmController,
                decoration: InputDecoration(
                  labelText: compliance.deleteAccountConfirm,
                ),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: (!confirmMatches || _deleting)
                    ? null
                    : () => _deleteAccount(compliance),
                style: OutlinedButton.styleFrom(
                  foregroundColor: tokens.danger,
                ),
                child: Text(
                  _deleting
                      ? compliance.deleteAccountPending
                      : compliance.deleteAccountAction,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
