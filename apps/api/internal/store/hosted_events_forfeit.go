package store

import (
	"context"
	"errors"
	"strings"
)

var (
	ErrHostedMatchForfeit = errors.New("hosted bracket match cannot be forfeited")
	ErrHostedMatchRematch = errors.New("hosted bracket match cannot be reset for rematch")
)

// ForfeitHostedBracketMatch awards the win to the opponent when a player no-shows or is DQ'd.
func (s *HostedEventStore) ForfeitHostedBracketMatch(
	ctx context.Context,
	eventID, matchID, loserUserID string,
	bst HostedBracketStatuses,
	est HostedEventStatuses,
	entryApproved string,
	formatIDs HostedFormatIDs,
	phases HostedFormatPhases,
	swissRoundsByMax map[string]int,
	groupsAdvance int,
	arenaScore ArenaScoreConfig,
	standingsPointsWin, standingsPointsDraw int,
) (*HostedBracketMatch, []CompetitionPointsAward, error) {
	if !s.ready() {
		return nil, nil, errors.New("database unavailable")
	}
	loserUserID = strings.TrimSpace(loserUserID)
	if loserUserID == "" {
		return nil, nil, ErrHostedMatchForfeit
	}
	m, err := s.GetBracketMatch(ctx, eventID, matchID)
	if err != nil {
		return nil, nil, err
	}
	if m.Status == bst.Done || m.Status == bst.Bye || m.IsBye {
		return nil, nil, ErrHostedMatchForfeit
	}
	if m.Status != bst.Ready && m.Status != bst.Live {
		return nil, nil, ErrHostedMatchForfeit
	}
	if m.PlayerAID == nil || m.PlayerBID == nil || *m.PlayerAID == "" || *m.PlayerBID == "" {
		return nil, nil, ErrHostedMatchForfeit
	}
	var winnerID string
	switch loserUserID {
	case *m.PlayerAID:
		winnerID = *m.PlayerBID
	case *m.PlayerBID:
		winnerID = *m.PlayerAID
	default:
		return nil, nil, ErrHostedMatchForfeit
	}
	ev, err := s.Get(ctx, eventID)
	if err != nil {
		return nil, nil, err
	}
	var awards []CompetitionPointsAward
	if strings.TrimSpace(ev.FormatID) == formatIDs.Arena && m.Phase == phases.Arena {
		gid := ""
		if m.GameID != nil {
			gid = strings.TrimSpace(*m.GameID)
		}
		if gid != "" {
			awards, err = s.ApplyArenaGameResult(ctx, eventID, gid, winnerID, arenaScore, bst, phases.Arena)
		} else {
			awards, err = s.ApplyArenaMatchResult(ctx, eventID, m, winnerID, arenaScore, bst, phases.Arena)
		}
		if err != nil {
			return nil, nil, err
		}
	} else if err := s.completeHostedMatchWin(ctx, m, winnerID, bst, est, entryApproved, formatIDs, phases, swissRoundsByMax, groupsAdvance, standingsPointsWin, standingsPointsDraw); err != nil {
		if !errors.Is(err, ErrBracketMatchAlreadyFinalized) {
			return nil, nil, err
		}
	} else {
		awards = ClassicCupEngagementAwards(ev.FormatID, formatIDs, winnerID, standingsPointsWin)
	}
	updated, err := s.GetBracketMatch(ctx, eventID, matchID)
	if err != nil {
		return nil, awards, err
	}
	return updated, awards, nil
}
