import 'package:flutter/material.dart';

/// IBM Plex (app default) has no color-emoji glyphs → shows as ???? without fallbacks.
const List<String> kChatEmojiFontFallback = <String>[
  'Segoe UI Emoji',
  'Apple Color Emoji',
  'Noto Color Emoji',
  'Android Emoji',
];

TextStyle chatEmojiTextStyle({double fontSize = 22, TextStyle? base}) {
  return (base ?? const TextStyle()).copyWith(
    fontSize: fontSize,
    height: 1,
    fontFamilyFallback: kChatEmojiFontFallback,
  );
}
