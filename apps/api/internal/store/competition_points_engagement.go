package store

import "strings"

// ClassicCupEngagementAwards returns mid-match competition points for toast/notif.
// Uses admin standings win points (competition_standings_points_win). Bracket advance is
// independent. Cup-end money uses prize_payout_mode: places_percent (rank %), score_share
// (standings Pts → pot×points/total), or dual_purse (place purse + performance purse from
// the same win points). Arena uses ApplyArena*.
func ClassicCupEngagementAwards(
	formatID string,
	ids HostedFormatIDs,
	winnerID string,
	standingsPointsWin int,
) []CompetitionPointsAward {
	if standingsPointsWin <= 0 {
		return nil
	}
	winnerID = strings.TrimSpace(winnerID)
	if winnerID == "" {
		return nil
	}
	switch strings.TrimSpace(formatID) {
	case ids.Knockout, ids.RoundRobin, ids.Swiss, ids.GroupsKnockout:
		return []CompetitionPointsAward{{
			UserID: winnerID,
			Points: float64(standingsPointsWin),
		}}
	default:
		return nil
	}
}
