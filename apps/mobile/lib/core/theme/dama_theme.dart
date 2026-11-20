import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Brand + surface tokens for light and dark (zinc neutrals + burgundy brand).
/// Prefer ThemeExtension over raw hex in widgets. Board/piece colors stay game-specific.
/// `gold` / `onGold` are legacy names - values are burgundy brand (#A31D38).
@immutable
class DamaColors extends ThemeExtension<DamaColors> {
  const DamaColors({
    required this.gold,
    required this.goldMuted,
    required this.onGold,
    required this.card,
    required this.surfaceMuted,
    required this.bone,
    required this.boneBright,
    required this.onSurfaceMuted,
    required this.borderSubtle,
    required this.online,
    required this.success,
    required this.verified,
    required this.verifiedBg,
    required this.verifiedBorder,
    required this.playing,
    required this.lastMove,
    required this.offline,
    required this.overlayScrim,
    required this.boardDark,
    required this.boardLight,
    required this.boardSelected,
    required this.pieceLight,
    required this.pieceDark,
    this.pieceDarkSplit = true,
    required this.danger,
  });

  /// Brand burgundy CTA (#A31D38). Legacy name `gold`.
  final Color gold;
  final Color goldMuted;
  final Color onGold;

  /// Prefer these aliases in new code.
  Color get brand => gold;
  Color get brandMuted => goldMuted;
  Color get onBrand => onGold;

  final Color card;
  final Color surfaceMuted;
  final Color bone;
  final Color boneBright;
  final Color onSurfaceMuted;
  final Color borderSubtle;

  /// Compatibility aliases used across older screens.
  Color get surface => card;
  Color get border => borderSubtle;
  Color get onSurface => onSurfaceMuted;
  final Color online;

  /// Transaction / form success green (#27A644). Distinct from presence [online].
  final Color success;

  /// Host KYC / Verified badge green (fintech - matches web `--dama-verified`).
  final Color verified;
  final Color verifiedBg;
  final Color verifiedBorder;

  /// Chess.com-style red "Playing" avatar badge (#e03c31).
  final Color playing;

  /// Chess.com-style yellow last-move squares (#f0d060).
  final Color lastMove;
  final Color offline;
  final Color overlayScrim;
  final Color boardDark;
  final Color boardLight;
  final Color boardSelected;
  final Color pieceLight;
  final Color pieceDark;

  /// When true, dark-side Neo bodies paint 50/50 light|dark (web White & half).
  final bool pieceDarkSplit;
  final Color danger;

  /// Light: zinc neutrals + brand burgundy #800020.
  static const light = DamaColors(
    gold: Color(0xFFA31D38),
    goldMuted: Color(0x24A31D38),
    onGold: Color(0xFFFFFFFF),
    card: Color(0xFFFFFFFF),
    surfaceMuted: Color(0xFFF4F4F5),
    bone: Color(0xFFF4F4F5),
    boneBright: Color(0xFFE4E4E7),
    onSurfaceMuted: Color(0xFF71717A),
    borderSubtle: Color(0xFFE4E4E7),
    online: Color(0xFF81B64C),
    success: Color(0xFF27A644),
    verified: Color(0xFF27A644),
    verifiedBg: Color(0x1F27A644),
    verifiedBorder: Color(0x5927A644),
    playing: Color(0xFFE03C31),
    lastMove: Color(0xFFF0D060),
    offline: Color(0xFF71717A),
    overlayScrim: Color(0x6618181B),
    // Forest board + White & half pieces (product defaults / Neo).
    boardDark: Color(0xFF769656),
    boardLight: Color(0xFFEEEED2),
    boardSelected: Color(0xFFBACA44),
    pieceLight: Color(0xFFFFFFFF),
    pieceDark: Color(0xFF141414),
    pieceDarkSplit: true,
    danger: Color(0xFFDC2626),
  );

  /// Dark: zinc shell + burgundy brand accents.
  static const dark = DamaColors(
    gold: Color(0xFFA31D38),
    goldMuted: Color(0x33A31D38),
    onGold: Color(0xFFFFFFFF),
    card: Color(0xFF09090B),
    surfaceMuted: Color(0xFF27272A),
    bone: Color(0xFF27272A),
    boneBright: Color(0xFF3F3F46),
    onSurfaceMuted: Color(0xFFA1A1AA),
    borderSubtle: Color(0xFF27272A),
    online: Color(0xFF81B64C),
    success: Color(0xFF27A644),
    verified: Color(0xFF27A644),
    verifiedBg: Color(0x2927A644),
    verifiedBorder: Color(0x6627A644),
    playing: Color(0xFFE03C31),
    lastMove: Color(0xFFF0D060),
    offline: Color(0xFF71717A),
    overlayScrim: Color(0xB8000000),
    boardDark: Color(0xFF769656),
    boardLight: Color(0xFFEEEED2),
    boardSelected: Color(0xFFBACA44),
    pieceLight: Color(0xFFFFFFFF),
    pieceDark: Color(0xFF141414),
    pieceDarkSplit: true,
    danger: Color(0xFFF87171),
  );

  @override
  DamaColors copyWith({
    Color? gold,
    Color? goldMuted,
    Color? onGold,
    Color? card,
    Color? surfaceMuted,
    Color? bone,
    Color? boneBright,
    Color? onSurfaceMuted,
    Color? borderSubtle,
    Color? online,
    Color? success,
    Color? verified,
    Color? verifiedBg,
    Color? verifiedBorder,
    Color? playing,
    Color? lastMove,
    Color? offline,
    Color? overlayScrim,
    Color? boardDark,
    Color? boardLight,
    Color? boardSelected,
    Color? pieceLight,
    Color? pieceDark,
    bool? pieceDarkSplit,
    Color? danger,
  }) {
    return DamaColors(
      gold: gold ?? this.gold,
      goldMuted: goldMuted ?? this.goldMuted,
      onGold: onGold ?? this.onGold,
      card: card ?? this.card,
      surfaceMuted: surfaceMuted ?? this.surfaceMuted,
      bone: bone ?? this.bone,
      boneBright: boneBright ?? this.boneBright,
      onSurfaceMuted: onSurfaceMuted ?? this.onSurfaceMuted,
      borderSubtle: borderSubtle ?? this.borderSubtle,
      online: online ?? this.online,
      success: success ?? this.success,
      verified: verified ?? this.verified,
      verifiedBg: verifiedBg ?? this.verifiedBg,
      verifiedBorder: verifiedBorder ?? this.verifiedBorder,
      playing: playing ?? this.playing,
      lastMove: lastMove ?? this.lastMove,
      offline: offline ?? this.offline,
      overlayScrim: overlayScrim ?? this.overlayScrim,
      boardDark: boardDark ?? this.boardDark,
      boardLight: boardLight ?? this.boardLight,
      boardSelected: boardSelected ?? this.boardSelected,
      pieceLight: pieceLight ?? this.pieceLight,
      pieceDark: pieceDark ?? this.pieceDark,
      pieceDarkSplit: pieceDarkSplit ?? this.pieceDarkSplit,
      danger: danger ?? this.danger,
    );
  }

  @override
  DamaColors lerp(ThemeExtension<DamaColors>? other, double t) {
    if (other is! DamaColors) return this;
    return DamaColors(
      gold: Color.lerp(gold, other.gold, t)!,
      goldMuted: Color.lerp(goldMuted, other.goldMuted, t)!,
      onGold: Color.lerp(onGold, other.onGold, t)!,
      card: Color.lerp(card, other.card, t)!,
      surfaceMuted: Color.lerp(surfaceMuted, other.surfaceMuted, t)!,
      bone: Color.lerp(bone, other.bone, t)!,
      boneBright: Color.lerp(boneBright, other.boneBright, t)!,
      onSurfaceMuted: Color.lerp(onSurfaceMuted, other.onSurfaceMuted, t)!,
      borderSubtle: Color.lerp(borderSubtle, other.borderSubtle, t)!,
      online: Color.lerp(online, other.online, t)!,
      success: Color.lerp(success, other.success, t)!,
      verified: Color.lerp(verified, other.verified, t)!,
      verifiedBg: Color.lerp(verifiedBg, other.verifiedBg, t)!,
      verifiedBorder: Color.lerp(verifiedBorder, other.verifiedBorder, t)!,
      playing: Color.lerp(playing, other.playing, t)!,
      lastMove: Color.lerp(lastMove, other.lastMove, t)!,
      offline: Color.lerp(offline, other.offline, t)!,
      overlayScrim: Color.lerp(overlayScrim, other.overlayScrim, t)!,
      boardDark: Color.lerp(boardDark, other.boardDark, t)!,
      boardLight: Color.lerp(boardLight, other.boardLight, t)!,
      boardSelected: Color.lerp(boardSelected, other.boardSelected, t)!,
      pieceLight: Color.lerp(pieceLight, other.pieceLight, t)!,
      pieceDark: Color.lerp(pieceDark, other.pieceDark, t)!,
      pieceDarkSplit: t < 0.5 ? pieceDarkSplit : other.pieceDarkSplit,
      danger: Color.lerp(danger, other.danger, t)!,
    );
  }
}

DamaColors damaColorsOf(BuildContext context) {
  final ext = Theme.of(context).extension<DamaColors>();
  if (ext != null) return ext;
  final brightness = Theme.of(context).brightness;
  return brightness == Brightness.light ? DamaColors.light : DamaColors.dark;
}

ThemeData buildDamaTheme(Brightness brightness) {
  final dama =
      brightness == Brightness.dark ? DamaColors.dark : DamaColors.light;
  final seed = dama.gold;
  final surface = brightness == Brightness.dark
      ? const Color(0xFF08090A)
      : const Color(0xFFFAFAFA);
  final scheme = ColorScheme.fromSeed(
    seedColor: seed,
    brightness: brightness,
    surface: surface,
  ).copyWith(
    error: dama.danger,
    primary: dama.gold,
    onPrimary: dama.onGold,
    // fromSeed can leave blue-tinted outline/secondary; pin to brand neutrals.
    secondary: dama.gold,
    onSecondary: dama.onGold,
    outline: dama.borderSubtle,
    outlineVariant: dama.borderSubtle,
    surfaceTint: Colors.transparent,
  );
  final textTheme = GoogleFonts.ibmPlexSansTextTheme(
    ThemeData(brightness: brightness, colorScheme: scheme).textTheme,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    textTheme: textTheme,
    fontFamily: GoogleFonts.ibmPlexSans().fontFamily,
    // Color emoji must fall back; IBM Plex has no emoji glyphs (shows as ????).
    fontFamilyFallback: const [
      'Segoe UI Emoji',
      'Apple Color Emoji',
      'Noto Color Emoji',
      'Android Emoji',
    ],
    scaffoldBackgroundColor: surface,
    appBarTheme: AppBarTheme(
      backgroundColor: surface,
      foregroundColor: scheme.onSurface,
      elevation: 0,
    ),
    cardTheme: CardThemeData(
      color: dama.card,
      elevation: brightness == Brightness.dark ? 0 : 1,
      shadowColor: const Color(0x0A18181B),
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: dama.borderSubtle),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: dama.brand,
        foregroundColor: dama.onBrand,
      ),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: dama.brand,
      foregroundColor: dama.onBrand,
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: dama.brand),
    datePickerTheme: DatePickerThemeData(
      headerBackgroundColor: dama.brand,
      headerForegroundColor: dama.onBrand,
      todayForegroundColor: WidgetStateProperty.all(dama.brand),
      todayBorder: BorderSide(color: dama.brand),
      dayOverlayColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return dama.brand.withValues(alpha: 0.16);
        }
        if (states.contains(WidgetState.pressed) ||
            states.contains(WidgetState.hovered) ||
            states.contains(WidgetState.focused)) {
          return dama.brand.withValues(alpha: 0.1);
        }
        return null;
      }),
      dayBackgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return dama.brand;
        return null;
      }),
      dayForegroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return dama.onBrand;
        return null;
      }),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    timePickerTheme: TimePickerThemeData(
      backgroundColor: dama.card,
      dialHandColor: dama.brand,
      dialBackgroundColor: dama.surfaceMuted,
      dialTextColor: WidgetStateColor.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return dama.onBrand;
        return scheme.onSurface;
      }),
      hourMinuteColor: WidgetStateColor.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return dama.brand;
        return dama.brandMuted;
      }),
      hourMinuteTextColor: WidgetStateColor.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return dama.onBrand;
        return dama.brand;
      }),
      dayPeriodColor: WidgetStateColor.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return dama.brand;
        return dama.surfaceMuted;
      }),
      dayPeriodTextColor: WidgetStateColor.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return dama.onBrand;
        return dama.brand;
      }),
      dayPeriodBorderSide: BorderSide(color: dama.brand),
      entryModeIconColor: dama.brand,
      helpTextStyle: TextStyle(color: dama.onSurfaceMuted),
      cancelButtonStyle:
          TextButton.styleFrom(foregroundColor: dama.onSurfaceMuted),
      confirmButtonStyle: TextButton.styleFrom(foregroundColor: dama.brand),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: MaterialStateProperty.resolveWith((states) {
        if (states.contains(MaterialState.selected)) return dama.onBrand;
        return null;
      }),
      trackColor: MaterialStateProperty.resolveWith((states) {
        if (states.contains(MaterialState.selected)) return dama.brand;
        return null;
      }),
    ),
    extensions: [dama],
  );
}
