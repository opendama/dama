package store

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
)

func hostedShapeFromTournamentMatches(matches []TournamentBracketMatch) []HostedBracketMatch {
	out := make([]HostedBracketMatch, len(matches))
	for i, m := range matches {
		out[i] = HostedBracketMatch{
			ID:              m.ID,
			EventID:         m.TournamentID,
			Phase:           m.Phase,
			GroupIndex:      m.GroupIndex,
			RoundIndex:      m.RoundIndex,
			MatchIndex:      m.MatchIndex,
			PlayerAID:       m.PlayerAID,
			PlayerBID:       m.PlayerBID,
			WinnerID:        m.WinnerID,
			PlayerAUsername: m.PlayerAUsername,
			PlayerBUsername: m.PlayerBUsername,
			WinnerUsername:  m.WinnerUsername,
			NextMatchID:     m.NextMatchID,
			NextSlot:        m.NextSlot,
			GameID:          m.GameID,
			Status:          m.Status,
			IsBye:           m.IsBye,
			StartedAt:       m.StartedAt,
			FinishedAt:      m.FinishedAt,
			CreatedAt:       m.CreatedAt,
			UpdatedAt:       m.UpdatedAt,
		}
	}
	return out
}

func (s *TournamentStore) finishTournamentByStandingsTx(
	ctx context.Context,
	tx pgx.Tx,
	tournamentID string,
	standings []HostedStandingRow,
) error {
	if len(standings) == 0 {
		return ErrHostedEventInvalidInput
	}
	winner := standings[0].UserID
	_, err := tx.Exec(ctx, `
		UPDATE tournaments
		SET winner_id = $2, finished_at = NOW(), updated_at = NOW()
		WHERE id = $1`, tournamentID, winner)
	if err != nil {
		return err
	}
	for i, row := range standings {
		place := i + 1
		_, err := tx.Exec(ctx, `
			UPDATE tournament_entries SET placement = $3
			WHERE tournament_id = $1 AND user_id = $2`,
			tournamentID, row.UserID, place)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *TournamentStore) allPhaseMatchesDone(matches []TournamentBracketMatch, phase string, st HostedBracketStatuses) bool {
	n := 0
	for _, m := range matches {
		if m.Phase != phase {
			continue
		}
		n++
		if !matchTerminal(HostedBracketMatch{Status: m.Status}, st) {
			return false
		}
	}
	return n > 0
}

func (s *TournamentStore) maxSwissRound(matches []TournamentBracketMatch, phase string) int {
	max := -1
	for _, m := range matches {
		if m.Phase == phase && m.RoundIndex > max {
			max = m.RoundIndex
		}
	}
	return max
}

// AdvanceOnGameFinish advances tournament brackets when a cup game ends.
func (s *TournamentStore) AdvanceOnGameFinish(
	ctx context.Context,
	gameID, winnerID string,
	isDraw bool,
	bst HostedBracketStatuses,
	formatIDs HostedFormatIDs,
	phases HostedFormatPhases,
	swissRoundsByMax map[string]int,
	groupsAdvance int,
	arenaScore ArenaScoreConfig,
	standingsPointsWin, standingsPointsDraw int,
) ([]CompetitionPointsAward, error) {
	if !s.bracketReady() || strings.TrimSpace(gameID) == "" {
		return nil, nil
	}
	m, err := s.GetBracketMatchByGameID(ctx, gameID)
	if err != nil {
		if errors.Is(err, ErrTournamentBracketNotFound) {
			return nil, nil
		}
		return nil, err
	}
	if m.Status == bst.Done || m.Status == bst.Bye {
		return nil, nil
	}
	tour, err := s.Get(ctx, m.TournamentID)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(tour.FormatID) == formatIDs.Arena && m.Phase == phases.Arena {
		w := strings.TrimSpace(winnerID)
		if isDraw {
			w = ""
		}
		if !isDraw && w == "" {
			return nil, nil
		}
		if !isDraw && m.PlayerAID != nil && m.PlayerBID != nil && w != *m.PlayerAID && w != *m.PlayerBID {
			return nil, fmt.Errorf("winner not in match")
		}
		return s.ApplyArenaGameResult(ctx, m.TournamentID, gameID, w, arenaScore, bst, phases.Arena)
	}
	if isDraw || strings.TrimSpace(winnerID) == "" {
		_, err := s.ResetMatchForRematch(ctx, m.ID, bst.Ready)
		return nil, err
	}
	if m.PlayerAID != nil && m.PlayerBID != nil {
		if winnerID != *m.PlayerAID && winnerID != *m.PlayerBID {
			return nil, fmt.Errorf("winner not in match")
		}
	}

	if err := s.completeTournamentMatchWin(ctx, m, winnerID, bst, formatIDs, phases, swissRoundsByMax, groupsAdvance, standingsPointsWin, standingsPointsDraw); err != nil {
		if errors.Is(err, ErrBracketMatchAlreadyFinalized) {
			return nil, nil
		}
		return nil, err
	}
	return ClassicCupEngagementAwards(tour.FormatID, formatIDs, winnerID, standingsPointsWin), nil
}

// completeTournamentMatchWin marks a match done with winner and advances the bracket (no game required).
func (s *TournamentStore) completeTournamentMatchWin(
	ctx context.Context,
	m *TournamentBracketMatch,
	winnerID string,
	bst HostedBracketStatuses,
	formatIDs HostedFormatIDs,
	phases HostedFormatPhases,
	swissRoundsByMax map[string]int,
	groupsAdvance int,
	standingsPointsWin, standingsPointsDraw int,
) error {
	if m == nil || strings.TrimSpace(winnerID) == "" {
		return ErrHostedEventInvalidInput
	}
	tour, err := s.Get(ctx, m.TournamentID)
	if err != nil {
		return err
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		UPDATE tournament_bracket_matches
		SET winner_id = $2, status = $3, finished_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND status <> $3`, m.ID, winnerID, bst.Done)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrBracketMatchAlreadyFinalized
	}

	formatID := strings.TrimSpace(tour.FormatID)

	switch formatID {
	case formatIDs.Knockout:
		if m.NextMatchID != nil && m.NextSlot != nil {
			if err := placeWinnerTx(ctx, tx, BracketTableTournament, *m.NextMatchID, *m.NextSlot, winnerID, bst); err != nil {
				return err
			}
		} else {
			_, err = tx.Exec(ctx, `
				UPDATE tournaments
				SET winner_id = $2, finished_at = NOW(), updated_at = NOW()
				WHERE id = $1`, m.TournamentID, winnerID)
			if err != nil {
				return err
			}
			if err := assignKnockoutFinalPlacementsTx(
				ctx, tx, BracketTableTournament, entryTableTournament,
				m.TournamentID, m.ID, winnerID, m.PlayerAID, m.PlayerBID, "",
			); err != nil {
				return err
			}
		}

	case formatIDs.RoundRobin:
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		return s.maybeFinishTournamentRoundRobin(ctx, m.TournamentID, bst, phases.RoundRobin, standingsPointsWin, standingsPointsDraw)

	case formatIDs.Swiss:
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		return s.maybeAdvanceTournamentSwiss(ctx, tour, bst, phases.Swiss, swissRoundsByMax, standingsPointsWin, standingsPointsDraw)

	case formatIDs.GroupsKnockout:
		if m.Phase == phases.Knockout {
			if m.NextMatchID != nil && m.NextSlot != nil {
				if err := placeWinnerTx(ctx, tx, BracketTableTournament, *m.NextMatchID, *m.NextSlot, winnerID, bst); err != nil {
					return err
				}
			} else {
				_, err = tx.Exec(ctx, `
					UPDATE tournaments
					SET winner_id = $2, finished_at = NOW(), updated_at = NOW()
					WHERE id = $1`, m.TournamentID, winnerID)
				if err != nil {
					return err
				}
				if err := assignKnockoutFinalPlacementsTx(
					ctx, tx, BracketTableTournament, entryTableTournament,
					m.TournamentID, m.ID, winnerID, m.PlayerAID, m.PlayerBID, "",
				); err != nil {
					return err
				}
			}
			return tx.Commit(ctx)
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		return s.maybePromoteTournamentGroupsToKnockout(ctx, tour, bst, phases, groupsAdvance, standingsPointsWin, standingsPointsDraw)

	default:
		return fmt.Errorf("unsupported tournament format")
	}

	return tx.Commit(ctx)
}

func (s *TournamentStore) maybeFinishTournamentRoundRobin(
	ctx context.Context,
	tournamentID string,
	bst HostedBracketStatuses,
	phase string,
	standingsPointsWin, standingsPointsDraw int,
) error {
	matches, err := s.ListBracket(ctx, tournamentID)
	if err != nil {
		return err
	}
	if !s.allPhaseMatchesDone(matches, phase, bst) {
		return nil
	}
	usernames := map[string]string{}
	finished := make([]HostedBracketMatch, 0)
	for _, m := range matches {
		if m.Phase != phase {
			continue
		}
		if m.PlayerAID != nil {
			usernames[*m.PlayerAID] = m.PlayerAUsername
		}
		if m.PlayerBID != nil {
			usernames[*m.PlayerBID] = m.PlayerBUsername
		}
		finished = append(finished, HostedBracketMatch{
			Phase: m.Phase, GroupIndex: m.GroupIndex, PlayerAID: m.PlayerAID, PlayerBID: m.PlayerBID,
			WinnerID: m.WinnerID, IsBye: m.IsBye, Status: m.Status, FinishedAt: m.FinishedAt,
		})
	}
	standings := computeStandingsFromMatches(finished, usernames, standingsPointsWin, standingsPointsDraw)
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := s.finishTournamentByStandingsTx(ctx, tx, tournamentID, standings); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *TournamentStore) maybeAdvanceTournamentSwiss(
	ctx context.Context,
	tour *Tournament,
	bst HostedBracketStatuses,
	phase string,
	swissRoundsByMax map[string]int,
	standingsPointsWin, standingsPointsDraw int,
) error {
	matches, err := s.ListBracket(ctx, tour.ID)
	if err != nil {
		return err
	}
	cur := s.maxSwissRound(matches, phase)
	if cur < 0 {
		return nil
	}
	for _, m := range matches {
		if m.Phase == phase && m.RoundIndex == cur && !matchTerminal(HostedBracketMatch{Status: m.Status}, bst) {
			return nil
		}
	}
	maxPlayers := 0
	if HasPlayerCap(tour.MaxPlayers) {
		maxPlayers = *tour.MaxPlayers
	}
	if maxPlayers < 2 {
		maxPlayers = len(matches)
	}
	totalRounds, err := swissRoundsForMaxPlayers(swissRoundsByMax, maxPlayers)
	if err != nil {
		return err
	}
	usernames := map[string]string{}
	finished := make([]HostedBracketMatch, 0)
	for _, m := range matches {
		if m.Phase != phase {
			continue
		}
		if m.PlayerAID != nil {
			usernames[*m.PlayerAID] = m.PlayerAUsername
		}
		if m.PlayerBID != nil {
			usernames[*m.PlayerBID] = m.PlayerBUsername
		}
		if matchTerminal(HostedBracketMatch{Status: m.Status}, bst) {
			finished = append(finished, HostedBracketMatch{
				Phase: m.Phase, GroupIndex: m.GroupIndex, PlayerAID: m.PlayerAID, PlayerBID: m.PlayerBID,
				WinnerID: m.WinnerID, IsBye: m.IsBye, Status: m.Status, FinishedAt: m.FinishedAt,
			})
		}
	}
	standings := computeStandingsFromMatches(finished, usernames, standingsPointsWin, standingsPointsDraw)
	if cur+1 >= totalRounds {
		tx, err := s.db.Pool.Begin(ctx)
		if err != nil {
			return err
		}
		defer tx.Rollback(ctx)
		if err := s.finishTournamentByStandingsTx(ctx, tx, tour.ID, standings); err != nil {
			return err
		}
		return tx.Commit(ctx)
	}
	ordered := make([]string, 0, len(standings))
	for _, row := range standings {
		ordered = append(ordered, row.UserID)
	}
	opponents := buildOpponentMap(hostedShapeFromTournamentMatches(matches), phase)
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := insertSwissRoundTx(ctx, tx, BracketTableTournament, tour.ID, ordered, bst, phase, cur+1, opponents); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *TournamentStore) maybePromoteTournamentGroupsToKnockout(
	ctx context.Context,
	tour *Tournament,
	bst HostedBracketStatuses,
	phases HostedFormatPhases,
	advancePerGroup int,
	standingsPointsWin, standingsPointsDraw int,
) error {
	if advancePerGroup < 1 {
		return ErrHostedEventInvalidInput
	}
	matches, err := s.ListBracket(ctx, tour.ID)
	if err != nil {
		return err
	}
	if !s.allPhaseMatchesDone(matches, phases.Group, bst) {
		return nil
	}
	for _, m := range matches {
		if m.Phase == phases.Knockout {
			return nil
		}
	}
	usernames := map[string]string{}
	groupMatches := make([]HostedBracketMatch, 0)
	for _, m := range matches {
		if m.Phase != phases.Group {
			continue
		}
		if m.PlayerAID != nil {
			usernames[*m.PlayerAID] = m.PlayerAUsername
		}
		if m.PlayerBID != nil {
			usernames[*m.PlayerBID] = m.PlayerBUsername
		}
		groupMatches = append(groupMatches, HostedBracketMatch{
			Phase: m.Phase, GroupIndex: m.GroupIndex, PlayerAID: m.PlayerAID, PlayerBID: m.PlayerBID,
			WinnerID: m.WinnerID, IsBye: m.IsBye, Status: m.Status, FinishedAt: m.FinishedAt,
		})
	}
	standings := computeStandingsFromMatches(groupMatches, usernames, standingsPointsWin, standingsPointsDraw)
	byGroup := map[int][]HostedStandingRow{}
	for _, row := range standings {
		byGroup[row.GroupIndex] = append(byGroup[row.GroupIndex], row)
	}
	advancers := make([]string, 0)
	groupKeys := make([]int, 0, len(byGroup))
	for g := range byGroup {
		groupKeys = append(groupKeys, g)
	}
	sort.Ints(groupKeys)
	for _, g := range groupKeys {
		rows := byGroup[g]
		n := advancePerGroup
		if n > len(rows) {
			n = len(rows)
		}
		for i := 0; i < n; i++ {
			advancers = append(advancers, rows[i].UserID)
		}
	}
	if len(advancers) < 2 {
		tx, err := s.db.Pool.Begin(ctx)
		if err != nil {
			return err
		}
		defer tx.Rollback(ctx)
		if err := s.finishTournamentByStandingsTx(ctx, tx, tour.ID, standings); err != nil {
			return err
		}
		return tx.Commit(ctx)
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := generateKnockoutBracketTx(ctx, tx, BracketTableTournament, tour.ID, advancers, bst, phases.Knockout, -1, 0); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
