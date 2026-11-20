import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:dama_mobile/core/io/share_bytes.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:share_plus/share_plus.dart';

class ResultCardPlacement {
  const ResultCardPlacement({required this.placement, required this.username});
  final int placement;
  final String username;
}

/// Build PNG result card (logo + sponsor + placements) and share/download via share sheet.
Future<void> shareResultCardImage({
  required String title,
  required String winnersTitle,
  required String sponsorPrefix,
  required String emptyValue,
  required String imageFailed,
  required String filename,
  required String bgColor,
  required String fgColor,
  required String mutedColor,
  required String rowWashColor,
  required String titleFont,
  required String winnersFont,
  required String sponsorFont,
  required String placementFont,
  required String nameFont,
  required String headerWashAlpha,
  required String widthRaw,
  required String rowHeightRaw,
  required String headerHeightRaw,
  required String sponsorHeightRaw,
  required String placementsMaxRaw,
  required String rowRadiusRaw,
  required String padRaw,
  required String logoSizeRaw,
  required String titleYRaw,
  required String winnersYRaw,
  required String bodyGapRaw,
  required String rowsTopGapRaw,
  required String bottomPadRaw,
  required String rowInsetRaw,
  required String rowInnerGapRaw,
  required String placementXRaw,
  required String nameXRaw,
  required String rowTextYRaw,
  required String sponsorLogoWRaw,
  required String sponsorLogoHRaw,
  required String sponsorLogoGapRaw,
  required String logoTextGapRaw,
  required List<ResultCardPlacement> placements,
  String? logoUrl,
  String? sponsorName,
  String? sponsorLogoUrl,
  String? brandColor,
  required bool preferShare,
}) async {
  final name = filename.trim();
  if (name.isEmpty) {
    throw StateError(imageFailed);
  }
  final blob = await _buildPng(
    title: title,
    winnersTitle: winnersTitle,
    sponsorPrefix: sponsorPrefix,
    emptyValue: emptyValue,
    bgColor: bgColor,
    fgColor: fgColor,
    mutedColor: mutedColor,
    rowWashColor: rowWashColor,
    titleFont: titleFont,
    winnersFont: winnersFont,
    sponsorFont: sponsorFont,
    placementFont: placementFont,
    nameFont: nameFont,
    headerWashAlpha: headerWashAlpha,
    widthRaw: widthRaw,
    rowHeightRaw: rowHeightRaw,
    headerHeightRaw: headerHeightRaw,
    sponsorHeightRaw: sponsorHeightRaw,
    placementsMaxRaw: placementsMaxRaw,
    rowRadiusRaw: rowRadiusRaw,
    padRaw: padRaw,
    logoSizeRaw: logoSizeRaw,
    titleYRaw: titleYRaw,
    winnersYRaw: winnersYRaw,
    bodyGapRaw: bodyGapRaw,
    rowsTopGapRaw: rowsTopGapRaw,
    bottomPadRaw: bottomPadRaw,
    rowInsetRaw: rowInsetRaw,
    rowInnerGapRaw: rowInnerGapRaw,
    placementXRaw: placementXRaw,
    nameXRaw: nameXRaw,
    rowTextYRaw: rowTextYRaw,
    sponsorLogoWRaw: sponsorLogoWRaw,
    sponsorLogoHRaw: sponsorLogoHRaw,
    sponsorLogoGapRaw: sponsorLogoGapRaw,
    logoTextGapRaw: logoTextGapRaw,
    placements: placements,
    logoUrl: logoUrl,
    sponsorName: sponsorName,
    sponsorLogoUrl: sponsorLogoUrl,
    brandColor: brandColor,
  );
  if (blob == null || blob.isEmpty) {
    throw StateError(imageFailed);
  }
  await shareBytesAsFile(
    bytes: blob,
    filename: name,
    mimeType: 'image/png',
  );
  // preferShare is reserved for future download-vs-share split; share_plus uses the sheet.
  if (!preferShare) {
    // Same path: platform share sheet can save/download.
  }
}

Future<void> shareResultCardText(String text) async {
  await Share.share(text);
}

Future<ui.Image?> _decodeNetworkImage(String? url) async {
  final u = (url ?? '').trim();
  if (u.isEmpty) return null;
  try {
    final res = await http.get(Uri.parse(u));
    if (res.statusCode >= 300 || res.bodyBytes.isEmpty) return null;
    final codec = await ui.instantiateImageCodec(res.bodyBytes);
    final frame = await codec.getNextFrame();
    return frame.image;
  } catch (_) {
    return null;
  }
}

double? _parsePositive(String raw) {
  final n = double.tryParse(raw.trim());
  if (n == null || n <= 0) return null;
  return n;
}

double? _parseNonNeg(String raw) {
  final n = double.tryParse(raw.trim());
  if (n == null || n < 0) return null;
  return n;
}

Future<Uint8List?> _buildPng({
  required String title,
  required String winnersTitle,
  required String sponsorPrefix,
  required String emptyValue,
  required String bgColor,
  required String fgColor,
  required String mutedColor,
  required String rowWashColor,
  required String titleFont,
  required String winnersFont,
  required String sponsorFont,
  required String placementFont,
  required String nameFont,
  required String headerWashAlpha,
  required String widthRaw,
  required String rowHeightRaw,
  required String headerHeightRaw,
  required String sponsorHeightRaw,
  required String placementsMaxRaw,
  required String rowRadiusRaw,
  required String padRaw,
  required String logoSizeRaw,
  required String titleYRaw,
  required String winnersYRaw,
  required String bodyGapRaw,
  required String rowsTopGapRaw,
  required String bottomPadRaw,
  required String rowInsetRaw,
  required String rowInnerGapRaw,
  required String placementXRaw,
  required String nameXRaw,
  required String rowTextYRaw,
  required String sponsorLogoWRaw,
  required String sponsorLogoHRaw,
  required String sponsorLogoGapRaw,
  required String logoTextGapRaw,
  required List<ResultCardPlacement> placements,
  String? logoUrl,
  String? sponsorName,
  String? sponsorLogoUrl,
  String? brandColor,
}) async {
  final bg = _parseColor(bgColor);
  final fg = _parseColor(fgColor);
  final muted = _parseColor(mutedColor);
  final rowWash = _parseColor(rowWashColor);
  final titleStyle = _parseCssFont(titleFont, fg);
  final winnersStyle = _parseCssFont(winnersFont, null);
  final sponsorStyle = _parseCssFont(sponsorFont, muted);
  final placementStyle = _parseCssFont(placementFont, null);
  final nameStyle = _parseCssFont(nameFont, fg);
  final washAlpha = double.tryParse(headerWashAlpha.trim());
  final width = _parsePositive(widthRaw);
  final rowH = _parsePositive(rowHeightRaw);
  final headerH = _parsePositive(headerHeightRaw);
  final sponsorHCfg = _parsePositive(sponsorHeightRaw);
  final placementsMax = _parsePositive(placementsMaxRaw);
  final rowRadius = _parseNonNeg(rowRadiusRaw);
  final pad = _parsePositive(padRaw);
  final logoSize = _parsePositive(logoSizeRaw);
  final titleY = _parsePositive(titleYRaw);
  final winnersY = _parsePositive(winnersYRaw);
  final bodyGap = _parsePositive(bodyGapRaw);
  final rowsTopGap = _parsePositive(rowsTopGapRaw);
  final bottomPad = _parsePositive(bottomPadRaw);
  final rowInset = _parsePositive(rowInsetRaw);
  final rowInnerGap = _parseNonNeg(rowInnerGapRaw);
  final placementX = _parsePositive(placementXRaw);
  final nameX = _parsePositive(nameXRaw);
  final rowTextY = _parsePositive(rowTextYRaw);
  final sponsorLogoW = _parsePositive(sponsorLogoWRaw);
  final sponsorLogoH = _parsePositive(sponsorLogoHRaw);
  final sponsorLogoGap = _parsePositive(sponsorLogoGapRaw);
  final logoTextGap = _parsePositive(logoTextGapRaw);
  if (bg == null ||
      fg == null ||
      muted == null ||
      rowWash == null ||
      titleStyle == null ||
      winnersStyle == null ||
      sponsorStyle == null ||
      placementStyle == null ||
      nameStyle == null ||
      washAlpha == null ||
      washAlpha < 0 ||
      washAlpha > 1 ||
      width == null ||
      rowH == null ||
      headerH == null ||
      sponsorHCfg == null ||
      placementsMax == null ||
      rowRadius == null ||
      pad == null ||
      logoSize == null ||
      titleY == null ||
      winnersY == null ||
      bodyGap == null ||
      rowsTopGap == null ||
      bottomPad == null ||
      rowInset == null ||
      rowInnerGap == null ||
      placementX == null ||
      nameX == null ||
      rowTextY == null ||
      sponsorLogoW == null ||
      sponsorLogoH == null ||
      sponsorLogoGap == null ||
      logoTextGap == null) {
    return null;
  }

  final maxN = placementsMax.floor();
  final rows = placements.take(maxN).toList();
  if (rows.isEmpty) return null;

  final hasSponsor = (sponsorName ?? '').trim().isNotEmpty ||
      (sponsorLogoUrl ?? '').trim().isNotEmpty;
  final sponsorH =
      hasSponsor && sponsorPrefix.trim().isNotEmpty ? sponsorHCfg : 0.0;
  final height = headerH + sponsorH + bodyGap + rows.length * rowH + bottomPad;

  final logo = await _decodeNetworkImage(logoUrl);
  final sponsorLogo = await _decodeNetworkImage(sponsorLogoUrl);

  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  final accent = _parseColor(brandColor) ?? bg;

  canvas.drawRect(Rect.fromLTWH(0, 0, width, height), Paint()..color = bg);
  final grad = Paint()
    ..shader = ui.Gradient.linear(
      Offset.zero,
      Offset(width, headerH),
      [accent.withValues(alpha: washAlpha), bg],
    );
  canvas.drawRect(Rect.fromLTWH(0, 0, width, headerH), grad);

  var textX = pad;
  if (logo != null) {
    _drawCover(canvas, logo, Rect.fromLTWH(pad, pad, logoSize, logoSize));
    textX = pad + logoSize + logoTextGap;
  }

  final titlePainter = TextPainter(
    text: TextSpan(
      text: title.trim().isNotEmpty ? title.trim() : emptyValue,
      style: titleStyle.copyWith(color: fg),
    ),
    textDirection: TextDirection.ltr,
    maxLines: 2,
    ellipsis: '...',
  )..layout(maxWidth: width - textX - pad);
  titlePainter.paint(canvas, Offset(textX, titleY - titlePainter.height));

  final winnersPainter = TextPainter(
    text: TextSpan(
      text: winnersTitle.trim(),
      style: winnersStyle.copyWith(color: accent),
    ),
    textDirection: TextDirection.ltr,
  )..layout(maxWidth: width - textX - pad);
  winnersPainter.paint(canvas, Offset(textX, winnersY - winnersPainter.height));

  var y = headerH;
  if (sponsorH > 0) {
    var sx = pad;
    if (sponsorLogo != null) {
      _drawContain(
        canvas,
        sponsorLogo,
        Rect.fromLTWH(pad, y + rowInnerGap, sponsorLogoW, sponsorLogoH),
      );
      sx = pad + sponsorLogoW + sponsorLogoGap;
    }
    final name = (sponsorName ?? '').trim();
    final label = name.isNotEmpty
        ? '${sponsorPrefix.trim()} $name'
        : sponsorPrefix.trim();
    final sp = TextPainter(
      text: TextSpan(
        text: label,
        style: sponsorStyle.copyWith(color: muted),
      ),
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: width - sx - pad);
    sp.paint(
        canvas, Offset(sx, y + (sponsorLogoH - sp.height) / 2 + rowInnerGap));
    y += sponsorH;
  }

  y += rowsTopGap;
  for (final row in rows) {
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(rowInset, y, width - rowInset * 2, rowH - rowInnerGap),
        Radius.circular(rowRadius),
      ),
      Paint()..color = rowWash,
    );
    final place = TextPainter(
      text: TextSpan(
        text: '${row.placement}',
        style: placementStyle.copyWith(color: accent),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    place.paint(canvas, Offset(placementX, y + rowTextY - place.height));
    final uname =
        row.username.trim().isNotEmpty ? row.username.trim() : emptyValue;
    final np = TextPainter(
      text: TextSpan(
        text: uname,
        style: nameStyle.copyWith(color: fg),
      ),
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: width - nameX - pad);
    np.paint(canvas, Offset(nameX, y + rowTextY - np.height));
    y += rowH;
  }

  final picture = recorder.endRecording();
  final image = await picture.toImage(width.toInt(), height.toInt());
  final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
  return bytes?.buffer.asUint8List();
}

Color? _parseColor(String? raw) {
  final s = (raw ?? '').trim();
  if (s.isEmpty) return null;
  var hex = s.startsWith('#') ? s.substring(1) : s;
  if (hex.length == 3) {
    hex = hex.split('').map((c) => '$c$c').join();
  }
  // DB chrome may seed RRGGBB or AARRGGBB / RRGGBBAA (8-char).
  if (hex.length == 8) {
    final v = int.tryParse(hex, radix: 16);
    if (v == null) return null;
    // Prefer RRGGBBAA (web-style RRGGBBAA) over AARRGGBB.
    final rgb = (v >> 8) & 0xFFFFFF;
    final a = v & 0xFF;
    return Color((a << 24) | rgb);
  }
  if (hex.length != 6) return null;
  final v = int.tryParse(hex, radix: 16);
  if (v == null) return null;
  return Color(0xFF000000 | v);
}

/// Parse DB CSS font string (e.g. "bold 28px Georgia, serif") into TextStyle.
/// Fail closed when size cannot be read. Family comes from the DB string only.
TextStyle? _parseCssFont(String raw, Color? color) {
  final s = raw.trim();
  if (s.isEmpty) return null;
  final sizeMatch =
      RegExp(r'(\d+(?:\.\d+)?)\s*px', caseSensitive: false).firstMatch(s);
  if (sizeMatch == null) return null;
  final size = double.tryParse(sizeMatch.group(1) ?? '');
  if (size == null || size <= 0) return null;
  FontWeight weight = FontWeight.w400;
  final lower = s.toLowerCase();
  if (lower.contains('bold') || RegExp(r'\b700\b').hasMatch(lower)) {
    weight = FontWeight.w700;
  } else if (RegExp(r'\b600\b').hasMatch(lower)) {
    weight = FontWeight.w600;
  } else if (RegExp(r'\b500\b').hasMatch(lower)) {
    weight = FontWeight.w500;
  } else if (lower.contains('light') || RegExp(r'\b300\b').hasMatch(lower)) {
    weight = FontWeight.w300;
  }
  String? family;
  final afterSize = s.substring(sizeMatch.end).trim();
  if (afterSize.isNotEmpty) {
    var token = afterSize.split(',').first.trim();
    if (token.startsWith("'") || token.startsWith('"')) {
      final q = token[0];
      final end = token.indexOf(q, 1);
      token = end > 0 ? token.substring(1, end) : token.substring(1);
    }
    token = token.trim();
    final tl = token.toLowerCase();
    if (token.isNotEmpty &&
        tl != 'system-ui' &&
        tl != 'ui-sans-serif' &&
        tl != 'ui-serif' &&
        tl != 'ui-monospace') {
      family = token;
    }
  }
  return TextStyle(
    color: color,
    fontSize: size,
    fontWeight: weight,
    fontFamily: family,
  );
}

void _drawCover(Canvas canvas, ui.Image img, Rect dst) {
  final scale =
      (dst.width / img.width).clamp(0.0, 100.0) > (dst.height / img.height)
          ? dst.width / img.width
          : dst.height / img.height;
  final w = img.width * scale;
  final h = img.height * scale;
  final src = Rect.fromLTWH(0, 0, img.width.toDouble(), img.height.toDouble());
  final paintDst = Rect.fromCenter(
    center: dst.center,
    width: w,
    height: h,
  );
  canvas.save();
  canvas.clipRect(dst);
  canvas.drawImageRect(img, src, paintDst, Paint());
  canvas.restore();
}

void _drawContain(Canvas canvas, ui.Image img, Rect dst) {
  final scale = (dst.width / img.width < dst.height / img.height)
      ? dst.width / img.width
      : dst.height / img.height;
  final w = img.width * scale;
  final h = img.height * scale;
  final paintDst = Rect.fromLTWH(
    dst.left,
    dst.top + (dst.height - h) / 2,
    w,
    h,
  );
  canvas.drawImageRect(
    img,
    Rect.fromLTWH(0, 0, img.width.toDouble(), img.height.toDouble()),
    paintDst,
    Paint(),
  );
}

/// Shared text builder for result card share (organizer + player).
String buildResultCardShareText({
  required String title,
  required String winnersTitle,
  required List<HostedEventEntry> entries,
  required String emptyValue,
  required String metaSeparator,
  String? logoUrl,
  String? sponsorName,
  String? sponsorLogoUrl,
  String? sponsorNameLabel,
}) {
  final placed = entries.where((e) => e.placement != null).toList()
    ..sort((a, b) => (a.placement ?? 999).compareTo(b.placement ?? 999));
  final sep = metaSeparator;
  final lines = placed
      .map(
        (e) =>
            '${e.placement}$sep${e.username.isNotEmpty ? e.username : emptyValue}',
      )
      .toList();
  final header = <String>[
    if (title.trim().isNotEmpty) title.trim(),
    winnersTitle,
  ];
  final extras = <String>[];
  final logo = (logoUrl ?? '').trim();
  if (logo.isNotEmpty) extras.add(logo);
  final sponsor = (sponsorName ?? '').trim();
  if (sponsor.isNotEmpty) {
    final label = (sponsorNameLabel ?? '').trim();
    extras.add(label.isNotEmpty ? '$label$sep$sponsor' : sponsor);
  }
  final sponsorLogo = (sponsorLogoUrl ?? '').trim();
  if (sponsorLogo.isNotEmpty) extras.add(sponsorLogo);
  return [...header, ...extras, ...lines].join('\n');
}
