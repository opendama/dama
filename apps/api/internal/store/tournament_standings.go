package store

import (
	"context"
	"strings"
)

// ListStandings computes standings for a tournament from finished bracket matches.
// phaseFilter scopes rows (e.g. group stage only for groups→knockout). Empty = all phases.
func (s *TournamentStore) ListStandings(
	ctx context.Context,
	tournamentID string,
	st HostedBracketStatuses,
	phaseFilter string,
	pointsPerWin, pointsPerDraw int,
) ([]HostedStandingRow, error) {
	if pointsPerWin < 0 || pointsPerDraw < 0 {
		return nil, ErrHostedEventInvalidInput
	}
	matches, err := s.ListBracket(ctx, tournamentID)
	if err != nil {
		return nil, err
	}
	phaseFilter = strings.TrimSpace(phaseFilter)
	finished := make([]HostedBracketMatch, 0)
	usernames := map[string]string{}
	for _, m := range matches {
		if phaseFilter != "" && strings.TrimSpace(m.Phase) != phaseFilter {
			continue
		}
		if m.PlayerAID != nil {
			usernames[*m.PlayerAID] = m.PlayerAUsername
		}
		if m.PlayerBID != nil {
			usernames[*m.PlayerBID] = m.PlayerBUsername
		}
		hm := HostedBracketMatch{
			Phase:      m.Phase,
			GroupIndex: m.GroupIndex,
			PlayerAID:  m.PlayerAID,
			PlayerBID:  m.PlayerBID,
			WinnerID:   m.WinnerID,
			IsBye:      m.IsBye,
			Status:     m.Status,
		}
		if matchTerminal(hm, st) {
			finished = append(finished, hm)
		}
	}
	return computeStandingsFromMatches(finished, usernames, pointsPerWin, pointsPerDraw), nil
}
