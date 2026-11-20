import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/features/chat/chat_emoji_catalog.dart';
import 'package:dama_mobile/features/chat/chat_emoji_style.dart';
import 'package:flutter/material.dart';

Future<void> showChatEmojiPicker(
  BuildContext context, {
  required ChatEmojiCatalog catalog,
  required String searchPlaceholder,
  required String searchEmptyLabel,
  required String resultsPrefix,
  required String ariaLabel,
  required ValueChanged<String> onPick,
}) async {
  final tokens = damaColorsOf(context);
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    isDismissible: true,
    enableDrag: true,
    backgroundColor: tokens.card,
    builder: (ctx) {
      return _EmojiPickerSheet(
        catalog: catalog,
        ariaLabel: ariaLabel,
        searchPlaceholder: searchPlaceholder,
        searchEmptyLabel: searchEmptyLabel,
        resultsPrefix: resultsPrefix,
        onPick: (e) {
          onPick(e);
          Navigator.of(ctx).pop();
        },
      );
    },
  );
}

class _EmojiPickerSheet extends StatefulWidget {
  const _EmojiPickerSheet({
    required this.catalog,
    required this.ariaLabel,
    required this.searchPlaceholder,
    required this.searchEmptyLabel,
    required this.resultsPrefix,
    required this.onPick,
  });

  final ChatEmojiCatalog catalog;
  final String ariaLabel;
  final String searchPlaceholder;
  final String searchEmptyLabel;
  final String resultsPrefix;
  final ValueChanged<String> onPick;

  @override
  State<_EmojiPickerSheet> createState() => _EmojiPickerSheetState();
}

class _EmojiPickerSheetState extends State<_EmojiPickerSheet> {
  final _search = TextEditingController();
  int _catIndex = 0;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  String _resultsLabel(int count) {
    final prefix = widget.resultsPrefix.trim();
    if (prefix.isEmpty) return '$count';
    return '$prefix ($count)';
  }

  @override
  Widget build(BuildContext context) {
    final tokens = damaColorsOf(context);
    final q = _search.text.trim();
    final categories = widget.catalog.categories;
    final cat = categories[_catIndex.clamp(0, categories.length - 1)];
    final glyphs = q.isNotEmpty
        ? searchChatEmojis(q, widget.catalog).map((e) => e.glyph).toList()
        : cat.emojis.map((e) => e.glyph).toList();

    return SafeArea(
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.55,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
              child: TextField(
                controller: _search,
                decoration: InputDecoration(
                  hintText: widget.searchPlaceholder,
                  prefixIcon: const Icon(Icons.search, size: 20),
                  isDense: true,
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                onChanged: (_) => setState(() {}),
              ),
            ),
            if (q.isEmpty)
              SizedBox(
                height: 40,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  itemCount: categories.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 4),
                  itemBuilder: (_, i) {
                    final c = categories[i];
                    final selected = i == _catIndex;
                    return InkWell(
                      onTap: () => setState(() => _catIndex = i),
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        width: 36,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: selected
                              ? tokens.brand.withValues(alpha: 0.15)
                              : null,
                          borderRadius: BorderRadius.circular(8),
                          border: selected
                              ? Border.all(
                                  color: tokens.brand.withValues(alpha: 0.4))
                              : null,
                        ),
                        child: Text(c.icon,
                            style: chatEmojiTextStyle(fontSize: 18)),
                      ),
                    );
                  },
                ),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 4),
              child: Text(
                q.isNotEmpty ? _resultsLabel(glyphs.length) : cat.label,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.4,
                  color: tokens.onSurfaceMuted,
                ),
              ),
            ),
            Expanded(
              child: glyphs.isEmpty
                  ? Center(
                      child: Text(
                        widget.searchEmptyLabel,
                        style: TextStyle(color: tokens.onSurfaceMuted),
                      ),
                    )
                  : GridView.builder(
                      padding: const EdgeInsets.fromLTRB(10, 0, 10, 16),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 8,
                        mainAxisSpacing: 2,
                        crossAxisSpacing: 2,
                      ),
                      itemCount: glyphs.length,
                      itemBuilder: (_, i) {
                        final e = glyphs[i];
                        return InkWell(
                          onTap: () => widget.onPick(e),
                          borderRadius: BorderRadius.circular(8),
                          child: Center(
                              child: Text(e, style: chatEmojiTextStyle())),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
