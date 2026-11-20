import 'package:freezed_annotation/freezed_annotation.dart';

part 'player_profile.freezed.dart';

/// Freezed immutable player profile (run `dart run build_runner build` to regenerate).
@freezed
abstract class PlayerProfile with _$PlayerProfile {
  const factory PlayerProfile({
    required String id,
    required String username,
    @Default(0) int rating,
    @Default(0) int xp,
    @Default(0) int wins,
    @Default(0) int losses,
    @Default(0) int draws,
    String? avatarThumbUrl,
    String? avatarFullUrl,
    String? region,
    String? countryCode,
    @Default(false) bool online,
    int? regionalRank,
    String? regionLabel,
  }) = _PlayerProfile;

  factory PlayerProfile.fromJson(Map<String, dynamic> json) {
    return PlayerProfile(
      id: json['id'] as String? ?? '',
      username: json['username'] as String? ?? '',
      rating: (json['rating'] as num?)?.toInt() ?? 0,
      xp: (json['xp'] as num?)?.toInt() ?? 0,
      wins: (json['wins'] as num?)?.toInt() ?? 0,
      losses: (json['losses'] as num?)?.toInt() ?? 0,
      draws: (json['draws'] as num?)?.toInt() ?? 0,
      avatarThumbUrl: json['avatar_thumb_url'] as String? ??
          json['avatarThumbUrl'] as String?,
      avatarFullUrl: json['avatar_full_url'] as String? ??
          json['avatarFullUrl'] as String?,
      region: json['region'] as String?,
      countryCode:
          json['country_code'] as String? ?? json['countryCode'] as String?,
      online: json['online'] as bool? ?? false,
      regionalRank: (json['regional_rank'] as num?)?.toInt() ??
          (json['regionalRank'] as num?)?.toInt(),
      regionLabel:
          json['region_label'] as String? ?? json['regionLabel'] as String?,
    );
  }
}
