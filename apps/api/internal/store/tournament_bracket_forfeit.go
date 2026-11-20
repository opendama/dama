package store

import (
	"context"
	"errors"
	"strings"
)

// ForfeitTournamentMatch awards the win to the opponent when a player no-shows or is DQ'd.
func (s *TournamentStore) ForfeitTournamentMatch(
	ctx context.Context,
	tournamentID, matchID, loserUserID string,
	bst HostedBracketStatuses,
	formatIDs HostedFormatIDs,
	phases HostedFormatPhases,
	swissRoundsByMax map[string]int,
	groupsAdvance int,
	arenaScore ArenaScoreConfig,
	standingsPointsWin, standingsPointsDraw int,
) (*TournamentBracketMatch, []CompetitionPointsAward, error) {
	if !s.bracketReady() {
		return nil, nil, errors.New("database unavailable")
	}
	loserUserID = strings.TrimSpace(loserUserID)
	if loserUserID == "" {
		return nil, nil, ErrTournamentMatchForfeit
	}
	m, err := s.GetBracketMatch(ctx, tournamentID, matchID)
	if err != nil {
		return nil, nil, err
	}
	if m.Status == bst.Done || m.Status == bst.Bye || m.IsBye {
		return nil, nil, ErrTournamentMatchForfeit
	}
	if m.Status != bst.Ready && m.Status != bst.Live {
		return nil, nil, ErrTournamentMatchForfeit
	}
	if m.PlayerAID == nil || m.PlayerBID == nil || *m.PlayerAID == "" || *m.PlayerBID == "" {
		return nil, nil, ErrTournamentMatchForfeit
	}
	var winnerID string
	switch loserUserID {
	case *m.PlayerAID:
		winnerID = *m.PlayerBID
	case *m.PlayerBID:
		winnerID = *m.PlayerAID
	default:
		return nil, nil, ErrTournamentMatchForfeit
	}
	tour, err := s.Get(ctx, tournamentID)
	if err != nil {
		return nil, nil, err
	}
	var awards []CompetitionPointsAward
	if strings.TrimSpace(tour.FormatID) == formatIDs.Arena && m.Phase == phases.Arena {
		// Prefer game_id path when board exists; otherwise score the ready/live seat match directly.
		gid := ""
		if m.GameID != nil {
			gid = strings.TrimSpace(*m.GameID)
		}
		if gid != "" {
			awards, err = s.ApplyArenaGameResult(ctx, tournamentID, gid, winnerID, arenaScore, bst, phases.Arena)
		} else {
			awards, err = s.ApplyArenaMatchResult(ctx, tournamentID, m, winnerID, arenaScore, bst, phases.Arena)
		}
		if err != nil {
			return nil, nil, err
		}
	} else if err := s.completeTournamentMatchWin(ctx, m, winnerID, bst, formatIDs, phases, swissRoundsByMax, groupsAdvance, standingsPointsWin, standingsPointsDraw); err != nil {
		if !errors.Is(err, ErrBracketMatchAlreadyFinalized) {
			return nil, nil, err
		}
	} else {
		awards = ClassicCupEngagementAwards(tour.FormatID, formatIDs, winnerID, standingsPointsWin)
	}
	updated, err := s.GetBracketMatch(ctx, tournamentID, matchID)
	if err != nil {
		return nil, awards, err
	}
	return updated, awards, nil
}
