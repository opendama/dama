import 'package:dama_mobile/core/theme/dama_theme.dart';
import 'package:dama_mobile/core/types/types.dart';
import 'package:dama_mobile/features/events/community_player_chrome_soft.dart';
import 'package:flutter/material.dart';

/// Fail closed: hide when standings title or column labels missing.
class EventStandingsView extends StatelessWidget {
  const EventStandingsView({
    super.key,
    required this.standings,
    required this.standingsTitle,
    required this.playedLabel,
    required this.winsLabel,
    required this.lossesLabel,
    required this.pointsLabel,
    required this.emptyValue,
    this.groupLabelTemplate = '',
  });

  final List<HostedStandingRow> standings;
  final String standingsTitle;
  final String playedLabel;
  final String winsLabel;
  final String lossesLabel;
  final String pointsLabel;
  final String emptyValue;
  final String groupLabelTemplate;

  String _groupLabel(int groupIndex) {
    final t = groupLabelTemplate.trim();
    if (t.isEmpty || groupIndex < 0) return '';
    return t.replaceAll('{n}', '${groupIndex + 1}');
  }

  @override
  Widget build(BuildContext context) {
    final title = standingsTitle.trim();
    final p = playedLabel.trim();
    final w = winsLabel.trim();
    final l = lossesLabel.trim();
    final pts = softCompetitionPointsLabel(pointsLabel);
    if (title.isEmpty || p.isEmpty || w.isEmpty || l.isEmpty || pts.isEmpty) {
      return const SizedBox.shrink();
    }
    final tokens = damaColorsOf(context);
    final groups = standings.map((r) => r.groupIndex).toSet().toList()..sort();
    final multiGroup = groups.where((g) => g >= 0).length > 1;

    Widget tableFor(List<HostedStandingRow> rows) {
      return Table(
        columnWidths: const {
          0: IntrinsicColumnWidth(),
          1: FlexColumnWidth(),
          2: IntrinsicColumnWidth(),
          3: IntrinsicColumnWidth(),
          4: IntrinsicColumnWidth(),
          5: IntrinsicColumnWidth(),
        },
        children: [
          TableRow(
            children: [
              const Padding(padding: EdgeInsets.all(4), child: Text('')),
              const Padding(padding: EdgeInsets.all(4), child: Text('')),
              Padding(
                padding: const EdgeInsets.all(4),
                child: Text(p, style: TextStyle(color: tokens.onSurfaceMuted)),
              ),
              Padding(
                padding: const EdgeInsets.all(4),
                child: Text(w, style: TextStyle(color: tokens.onSurfaceMuted)),
              ),
              Padding(
                padding: const EdgeInsets.all(4),
                child: Text(l, style: TextStyle(color: tokens.onSurfaceMuted)),
              ),
              Padding(
                padding: const EdgeInsets.all(4),
                child:
                    Text(pts, style: TextStyle(color: tokens.onSurfaceMuted)),
              ),
            ],
          ),
          for (var i = 0; i < rows.length; i++)
            TableRow(
              children: [
                Padding(
                  padding: const EdgeInsets.all(4),
                  child: Text(
                    '${rows[i].placement ?? (i + 1)}',
                    style: TextStyle(
                      color: tokens.gold,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(4),
                  child: Text(
                    rows[i].username.isNotEmpty ? rows[i].username : emptyValue,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(4),
                  child: Text('${rows[i].played}'),
                ),
                Padding(
                  padding: const EdgeInsets.all(4),
                  child: Text('${rows[i].wins}'),
                ),
                Padding(
                  padding: const EdgeInsets.all(4),
                  child: Text('${rows[i].losses}'),
                ),
                Padding(
                  padding: const EdgeInsets.all(4),
                  child: Text(
                    '${rows[i].points}',
                    style: TextStyle(
                      color: tokens.gold,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          title,
          style: TextStyle(color: tokens.gold, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        if (standings.isEmpty)
          Text(emptyValue, style: TextStyle(color: tokens.onSurfaceMuted))
        else if (multiGroup)
          for (final gi in groups.where((g) => g >= 0)) ...[
            if (_groupLabel(gi).isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 4, top: 8),
                child: Text(
                  _groupLabel(gi),
                  style: TextStyle(
                    color: tokens.onSurfaceMuted,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            tableFor(standings.where((r) => r.groupIndex == gi).toList()),
          ]
        else
          tableFor(standings),
      ],
    );
  }
}
