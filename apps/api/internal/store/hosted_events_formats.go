package store

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// HostedFormatPhases carries DB phase codes (from client_enums).
type HostedFormatPhases struct {
	Knockout   string
	RoundRobin string
	Swiss      string
	Group      string
	Arena      string
}

// HostedFormatIDs carries DB format id codes (from client_enums).
type HostedFormatIDs struct {
	Knockout       string
	RoundRobin     string
	Swiss          string
	GroupsKnockout string
	Arena          string
}

type draftMatch struct {
	id        string
	phase     string
	group     int
	round     int
	index     int
	playerA   *string
	playerB   *string
	nextMatch *string
	nextSlot  *string
	status    string
	isBye     bool
	winnerID  *string
}

func insertDraftMatch(ctx context.Context, tx pgx.Tx, tbl bracketMatchTable, entityID string, d *draftMatch) error {
	if err := tbl.validate(); err != nil {
		return err
	}
	q := fmt.Sprintf(`
		INSERT INTO %s (
			id, %s, phase, group_index, round_index, match_index,
			player_a_id, player_b_id, winner_id,
			next_match_id, next_slot, status, is_bye,
			finished_at
		) VALUES (
			$1,$2,$3,$4,$5,$6,
			$7,$8,$9,
			$10,$11,$12,$13,
			CASE WHEN $13 THEN NOW() ELSE NULL END
		)`, tbl.name, tbl.entityCol)
	_, err := tx.Exec(ctx, q,
		d.id, entityID, d.phase, d.group, d.round, d.index,
		d.playerA, d.playerB, d.winnerID,
		d.nextMatch, d.nextSlot, d.status, d.isBye,
	)
	return err
}

// generateKnockoutBracketTx inserts a knockout tree. roundOffset shifts round_index (for groups→KO).
func generateKnockoutBracketTx(
	ctx context.Context,
	tx pgx.Tx,
	tbl bracketMatchTable,
	entityID string,
	playerIDs []string,
	st HostedBracketStatuses,
	phase string,
	groupIndex int,
	roundOffset int,
) error {
	if err := tbl.validate(); err != nil {
		return err
	}
	if len(playerIDs) < 2 {
		return ErrHostedNotEnoughPlayers
	}
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	shuffled := append([]string{}, playerIDs...)
	rng.Shuffle(len(shuffled), func(i, j int) { shuffled[i], shuffled[j] = shuffled[j], shuffled[i] })

	bracketSize := nextPowerOfTwo(len(shuffled))
	slots := make([]*string, bracketSize)
	for i := 0; i < bracketSize; i++ {
		if i < len(shuffled) {
			id := shuffled[i]
			slots[i] = &id
		}
	}

	rounds := 0
	for size := bracketSize; size > 1; size /= 2 {
		rounds++
	}
	drafts := make([][]*draftMatch, rounds)
	for r := 0; r < rounds; r++ {
		matchesInRound := bracketSize / (2 << r)
		drafts[r] = make([]*draftMatch, matchesInRound)
		for m := 0; m < matchesInRound; m++ {
			d := &draftMatch{
				id:     uuid.NewString(),
				phase:  phase,
				group:  groupIndex,
				round:  r + roundOffset,
				index:  m,
				status: st.Pending,
			}
			if r == 0 {
				a := slots[m*2]
				b := slots[m*2+1]
				d.playerA, d.playerB = a, b
				switch {
				case a != nil && b != nil:
					d.status = st.Ready
				case a != nil && b == nil:
					d.isBye = true
					d.status = st.Bye
					d.winnerID = a
				case a == nil && b != nil:
					d.isBye = true
					d.status = st.Bye
					d.winnerID = b
				default:
					d.status = st.Pending
				}
			}
			drafts[r][m] = d
		}
	}
	for r := 0; r < rounds-1; r++ {
		for m := 0; m < len(drafts[r]); m++ {
			parent := drafts[r+1][m/2]
			slot := "a"
			if m%2 == 1 {
				slot = "b"
			}
			pid := parent.id
			drafts[r][m].nextMatch = &pid
			drafts[r][m].nextSlot = &slot
		}
	}
	for r := rounds - 1; r >= 0; r-- {
		for _, d := range drafts[r] {
			if err := insertDraftMatch(ctx, tx, tbl, entityID, d); err != nil {
				return err
			}
		}
	}
	for r := 0; r < rounds-1; r++ {
		for _, d := range drafts[r] {
			if !d.isBye || d.winnerID == nil || d.nextMatch == nil || d.nextSlot == nil {
				continue
			}
			if err := placeWinnerTx(ctx, tx, tbl, *d.nextMatch, *d.nextSlot, *d.winnerID, st); err != nil {
				return err
			}
		}
	}
	return nil
}

// GenerateRoundRobinBracket creates everyone-plays-everyone matches (single round_index 0).
func (s *HostedEventStore) GenerateRoundRobinBracket(
	ctx context.Context,
	eventID string,
	playerIDs []string,
	st HostedBracketStatuses,
	phase string,
) ([]HostedBracketMatch, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	phase = strings.TrimSpace(phase)
	if phase == "" || st.Ready == "" {
		return nil, ErrHostedEventInvalidInput
	}
	if len(playerIDs) < 2 {
		return nil, ErrHostedNotEnoughPlayers
	}
	has, err := s.HasBracket(ctx, eventID)
	if err != nil {
		return nil, err
	}
	if has {
		return nil, ErrHostedAlreadyHasBracket
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err := insertRoundRobinTx(ctx, tx, BracketTableHostedEvent, eventID, playerIDs, st, phase, -1, 0); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.ListBracket(ctx, eventID)
}

func insertRoundRobinTx(
	ctx context.Context,
	tx pgx.Tx,
	tbl bracketMatchTable,
	entityID string,
	playerIDs []string,
	st HostedBracketStatuses,
	phase string,
	groupIndex int,
	roundIndex int,
) error {
	if err := tbl.validate(); err != nil {
		return err
	}
	idx := 0
	for i := 0; i < len(playerIDs); i++ {
		for j := i + 1; j < len(playerIDs); j++ {
			a, b := playerIDs[i], playerIDs[j]
			d := &draftMatch{
				id:      uuid.NewString(),
				phase:   phase,
				group:   groupIndex,
				round:   roundIndex,
				index:   idx,
				playerA: &a,
				playerB: &b,
				status:  st.Ready,
			}
			if err := insertDraftMatch(ctx, tx, tbl, entityID, d); err != nil {
				return err
			}
			idx++
		}
	}
	return nil
}

// GenerateSwissBracket creates round 0 pairings; later rounds via Advance.
func (s *HostedEventStore) GenerateSwissBracket(
	ctx context.Context,
	eventID string,
	playerIDs []string,
	st HostedBracketStatuses,
	phase string,
) ([]HostedBracketMatch, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	phase = strings.TrimSpace(phase)
	if phase == "" || st.Ready == "" || st.Bye == "" {
		return nil, ErrHostedEventInvalidInput
	}
	if len(playerIDs) < 2 {
		return nil, ErrHostedNotEnoughPlayers
	}
	has, err := s.HasBracket(ctx, eventID)
	if err != nil {
		return nil, err
	}
	if has {
		return nil, ErrHostedAlreadyHasBracket
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err := insertSwissRoundTx(ctx, tx, BracketTableHostedEvent, eventID, playerIDs, st, phase, 0, nil); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.ListBracket(ctx, eventID)
}

func insertSwissRoundTx(
	ctx context.Context,
	tx pgx.Tx,
	tbl bracketMatchTable,
	entityID string,
	orderedPlayers []string,
	st HostedBracketStatuses,
	phase string,
	roundIndex int,
	priorOpponents map[string]map[string]bool,
) error {
	if err := tbl.validate(); err != nil {
		return err
	}
	players := append([]string{}, orderedPlayers...)
	used := map[string]bool{}
	idx := 0
	for i := 0; i < len(players); i++ {
		if used[players[i]] {
			continue
		}
		a := players[i]
		used[a] = true
		partner := ""
		for j := i + 1; j < len(players); j++ {
			b := players[j]
			if used[b] {
				continue
			}
			if priorOpponents != nil && priorOpponents[a][b] {
				continue
			}
			partner = b
			break
		}
		if partner == "" {
			// Bye when odd count or no unpaired opponent left.
			d := &draftMatch{
				id:       uuid.NewString(),
				phase:    phase,
				group:    -1,
				round:    roundIndex,
				index:    idx,
				playerA:  &a,
				status:   st.Bye,
				isBye:    true,
				winnerID: &a,
			}
			if err := insertDraftMatch(ctx, tx, tbl, entityID, d); err != nil {
				return err
			}
			idx++
			continue
		}
		used[partner] = true
		b := partner
		d := &draftMatch{
			id:      uuid.NewString(),
			phase:   phase,
			group:   -1,
			round:   roundIndex,
			index:   idx,
			playerA: &a,
			playerB: &b,
			status:  st.Ready,
		}
		if err := insertDraftMatch(ctx, tx, tbl, entityID, d); err != nil {
			return err
		}
		idx++
	}
	return nil
}

// GenerateGroupsKnockoutBracket: RR inside groups, then knockout from top N.
func (s *HostedEventStore) GenerateGroupsKnockoutBracket(
	ctx context.Context,
	eventID string,
	playerIDs []string,
	st HostedBracketStatuses,
	phases HostedFormatPhases,
	targetGroupSize, advancePerGroup int,
) ([]HostedBracketMatch, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	if strings.TrimSpace(phases.Group) == "" || targetGroupSize < 2 || advancePerGroup < 1 {
		return nil, ErrHostedEventInvalidInput
	}
	if len(playerIDs) < targetGroupSize {
		return nil, ErrHostedNotEnoughPlayers
	}
	has, err := s.HasBracket(ctx, eventID)
	if err != nil {
		return nil, err
	}
	if has {
		return nil, ErrHostedAlreadyHasBracket
	}
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	shuffled := append([]string{}, playerIDs...)
	rng.Shuffle(len(shuffled), func(i, j int) { shuffled[i], shuffled[j] = shuffled[j], shuffled[i] })

	nGroups := (len(shuffled) + targetGroupSize - 1) / targetGroupSize
	if nGroups < 1 {
		nGroups = 1
	}
	groups := make([][]string, nGroups)
	for i, id := range shuffled {
		g := i % nGroups
		groups[g] = append(groups[g], id)
	}
	for _, g := range groups {
		if len(g) < 2 {
			return nil, ErrHostedNotEnoughPlayers
		}
		if advancePerGroup > len(g) {
			return nil, ErrHostedEventInvalidInput
		}
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	for gi, g := range groups {
		if err := insertRoundRobinTx(ctx, tx, BracketTableHostedEvent, eventID, g, st, phases.Group, gi, 0); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.ListBracket(ctx, eventID)
}

func (s *HostedEventStore) listMatchesPhase(ctx context.Context, eventID, phase string) ([]HostedBracketMatch, error) {
	all, err := s.ListBracket(ctx, eventID)
	if err != nil {
		return nil, err
	}
	out := make([]HostedBracketMatch, 0)
	for _, m := range all {
		if m.Phase == phase {
			out = append(out, m)
		}
	}
	return out, nil
}

func matchTerminal(m HostedBracketMatch, st HostedBracketStatuses) bool {
	return m.Status == st.Done || m.Status == st.Bye
}

func computeStandingsFromMatches(matches []HostedBracketMatch, usernames map[string]string, pointsPerWin, pointsPerDraw int) []HostedStandingRow {
	type agg struct {
		played, wins, losses, points int
		group                        int
	}
	by := map[string]*agg{}
	touch := func(uid string, group int) *agg {
		a := by[uid]
		if a == nil {
			a = &agg{group: group}
			by[uid] = a
		}
		return a
	}
	for _, m := range matches {
		if m.PlayerAID == nil {
			continue
		}
		if m.IsBye {
			if m.WinnerID == nil {
				continue
			}
			a := touch(*m.WinnerID, m.GroupIndex)
			a.played++
			a.wins++
			a.points += pointsPerWin
			continue
		}
		if m.PlayerBID == nil {
			continue
		}
		aID, bID := *m.PlayerAID, *m.PlayerBID
		if m.WinnerID == nil {
			if m.FinishedAt == nil {
				continue
			}
			wa, wb := touch(aID, m.GroupIndex), touch(bID, m.GroupIndex)
			wa.played++
			wb.played++
			wa.points += pointsPerDraw
			wb.points += pointsPerDraw
			continue
		}
		wa, wb := touch(aID, m.GroupIndex), touch(bID, m.GroupIndex)
		wa.played++
		wb.played++
		if *m.WinnerID == aID {
			wa.wins++
			wa.points += pointsPerWin
			wb.losses++
		} else if *m.WinnerID == bID {
			wb.wins++
			wb.points += pointsPerWin
			wa.losses++
		}
	}
	out := make([]HostedStandingRow, 0, len(by))
	for uid, a := range by {
		out = append(out, HostedStandingRow{
			UserID:     uid,
			Username:   usernames[uid],
			Played:     a.played,
			Wins:       a.wins,
			Losses:     a.losses,
			Points:     a.points,
			GroupIndex: a.group,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].GroupIndex != out[j].GroupIndex {
			return out[i].GroupIndex < out[j].GroupIndex
		}
		if out[i].Points != out[j].Points {
			return out[i].Points > out[j].Points
		}
		if out[i].Wins != out[j].Wins {
			return out[i].Wins > out[j].Wins
		}
		return out[i].UserID < out[j].UserID
	})
	// Rank within each group (or overall when group_index is uniform).
	placeInGroup := map[int]int{}
	for i := range out {
		g := out[i].GroupIndex
		placeInGroup[g]++
		p := placeInGroup[g]
		placement := p
		out[i].Placement = &placement
	}
	return out
}

// ListStandings computes standings for an event from finished matches.
// phaseFilter scopes rows (e.g. group stage only for groups→knockout). Empty = all phases.
func (s *HostedEventStore) ListStandings(
	ctx context.Context,
	eventID string,
	st HostedBracketStatuses,
	phaseFilter string,
	pointsPerWin, pointsPerDraw int,
) ([]HostedStandingRow, error) {
	if pointsPerWin < 0 || pointsPerDraw < 0 {
		return nil, ErrHostedEventInvalidInput
	}
	matches, err := s.ListBracket(ctx, eventID)
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
		if matchTerminal(m, st) {
			finished = append(finished, m)
		}
	}
	return computeStandingsFromMatches(finished, usernames, pointsPerWin, pointsPerDraw), nil
}

func swissRoundsForMaxPlayers(by map[string]int, maxPlayers int) (int, error) {
	if by == nil {
		return 0, ErrHostedEventInvalidInput
	}
	key := strconv.Itoa(maxPlayers)
	if n, ok := by[key]; ok && n > 0 {
		return n, nil
	}
	// Nearest configured max >= maxPlayers, else largest key.
	best := 0
	bestKey := 0
	for k, v := range by {
		n, err := strconv.Atoi(strings.TrimSpace(k))
		if err != nil || v < 1 {
			continue
		}
		if n >= maxPlayers && (bestKey == 0 || n < bestKey) {
			bestKey = n
			best = v
		}
	}
	if best > 0 {
		return best, nil
	}
	for k, v := range by {
		n, err := strconv.Atoi(strings.TrimSpace(k))
		if err != nil || v < 1 {
			continue
		}
		if n > bestKey {
			bestKey = n
			best = v
		}
	}
	if best < 1 {
		return 0, ErrHostedEventInvalidInput
	}
	return best, nil
}

func (s *HostedEventStore) finishEventByStandingsTx(
	ctx context.Context,
	tx pgx.Tx,
	eventID string,
	standings []HostedStandingRow,
	est HostedEventStatuses,
	entryApproved string,
) error {
	if len(standings) == 0 {
		return ErrHostedEventInvalidInput
	}
	winner := standings[0].UserID
	_, err := tx.Exec(ctx, `
		UPDATE hosted_events
		SET status = $2, winner_id = $3, finished_at = NOW(), updated_at = NOW()
		WHERE id = $1`, eventID, est.Finished, winner)
	if err != nil {
		return err
	}
	if entryApproved == "" {
		return nil
	}
	for i, row := range standings {
		place := i + 1
		_, err := tx.Exec(ctx, `
			UPDATE hosted_event_entries SET placement = $3
			WHERE event_id = $1 AND user_id = $2 AND status = $4`,
			eventID, row.UserID, place, entryApproved)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *HostedEventStore) allPhaseMatchesDone(matches []HostedBracketMatch, phase string, st HostedBracketStatuses) bool {
	n := 0
	for _, m := range matches {
		if m.Phase != phase {
			continue
		}
		n++
		if !matchTerminal(m, st) {
			return false
		}
	}
	return n > 0
}

func (s *HostedEventStore) maxSwissRound(matches []HostedBracketMatch, phase string) int {
	max := -1
	for _, m := range matches {
		if m.Phase == phase && m.RoundIndex > max {
			max = m.RoundIndex
		}
	}
	return max
}

func buildOpponentMap(matches []HostedBracketMatch, phase string) map[string]map[string]bool {
	out := map[string]map[string]bool{}
	add := func(a, b string) {
		if out[a] == nil {
			out[a] = map[string]bool{}
		}
		out[a][b] = true
	}
	for _, m := range matches {
		if m.Phase != phase || m.PlayerAID == nil || m.PlayerBID == nil {
			continue
		}
		add(*m.PlayerAID, *m.PlayerBID)
		add(*m.PlayerBID, *m.PlayerAID)
	}
	return out
}

// AdvanceOnGameFinish advances any format after a PvP game ends. Draws reset for rematch.
func (s *HostedEventStore) AdvanceOnGameFinish(
	ctx context.Context,
	gameID, winnerID string,
	isDraw bool,
	bst HostedBracketStatuses,
	est HostedEventStatuses,
	entryApproved string,
	formatIDs HostedFormatIDs,
	phases HostedFormatPhases,
	swissRoundsByMax map[string]int,
	groupsAdvance int,
	arenaScore ArenaScoreConfig,
	standingsPointsWin, standingsPointsDraw int,
) ([]CompetitionPointsAward, error) {
	if !s.ready() || strings.TrimSpace(gameID) == "" {
		return nil, nil
	}
	m, err := s.GetBracketMatchByGameID(ctx, gameID)
	if err != nil {
		if errors.Is(err, ErrHostedBracketNotFound) {
			return nil, nil
		}
		return nil, err
	}
	if m.Status == bst.Done || m.Status == bst.Bye {
		return nil, nil
	}
	ev, err := s.Get(ctx, m.EventID)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(ev.FormatID) == formatIDs.Arena && m.Phase == phases.Arena {
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
		return s.ApplyArenaGameResult(ctx, m.EventID, gameID, w, arenaScore, bst, phases.Arena)
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

	if err := s.completeHostedMatchWin(ctx, m, winnerID, bst, est, entryApproved, formatIDs, phases, swissRoundsByMax, groupsAdvance, standingsPointsWin, standingsPointsDraw); err != nil {
		if errors.Is(err, ErrBracketMatchAlreadyFinalized) {
			return nil, nil
		}
		return nil, err
	}
	return ClassicCupEngagementAwards(ev.FormatID, formatIDs, winnerID, standingsPointsWin), nil
}

func (s *HostedEventStore) completeHostedMatchWin(
	ctx context.Context,
	m *HostedBracketMatch,
	winnerID string,
	bst HostedBracketStatuses,
	est HostedEventStatuses,
	entryApproved string,
	formatIDs HostedFormatIDs,
	phases HostedFormatPhases,
	swissRoundsByMax map[string]int,
	groupsAdvance int,
	standingsPointsWin, standingsPointsDraw int,
) error {
	if m == nil || strings.TrimSpace(winnerID) == "" {
		return ErrHostedEventInvalidInput
	}
	ev, err := s.Get(ctx, m.EventID)
	if err != nil {
		return err
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		UPDATE hosted_event_bracket_matches
		SET winner_id = $2, status = $3, finished_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND status <> $3`, m.ID, winnerID, bst.Done)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrBracketMatchAlreadyFinalized
	}

	if m.PlayerAID != nil && m.PlayerBID != nil && m.Phase == phases.Knockout {
		loser := *m.PlayerAID
		if winnerID == *m.PlayerAID {
			loser = *m.PlayerBID
		}
		_, _ = tx.Exec(ctx, `
			UPDATE hosted_event_entries SET eliminated = TRUE
			WHERE event_id = $1 AND user_id = $2 AND status = $3`,
			m.EventID, loser, entryApproved)
	}

	formatID := strings.TrimSpace(ev.FormatID)

	switch formatID {
	case formatIDs.Knockout:
		if m.NextMatchID != nil && m.NextSlot != nil {
			if err := placeWinnerTx(ctx, tx, BracketTableHostedEvent, *m.NextMatchID, *m.NextSlot, winnerID, bst); err != nil {
				return err
			}
		} else {
			_, err = tx.Exec(ctx, `
				UPDATE hosted_events
				SET status = $2, winner_id = $3, finished_at = NOW(), updated_at = NOW()
				WHERE id = $1`, m.EventID, est.Finished, winnerID)
			if err != nil {
				return err
			}
			if err := assignKnockoutFinalPlacementsTx(
				ctx, tx, BracketTableHostedEvent, entryTableHosted,
				m.EventID, m.ID, winnerID, m.PlayerAID, m.PlayerBID, entryApproved,
			); err != nil {
				return err
			}
		}

	case formatIDs.RoundRobin:
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		return s.maybeFinishRoundRobin(ctx, ev.ID, bst, est, entryApproved, phases.RoundRobin, standingsPointsWin, standingsPointsDraw)

	case formatIDs.Swiss:
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		return s.maybeAdvanceSwiss(ctx, ev, bst, est, entryApproved, phases.Swiss, swissRoundsByMax, standingsPointsWin, standingsPointsDraw)

	case formatIDs.GroupsKnockout:
		if m.Phase == phases.Knockout {
			if m.NextMatchID != nil && m.NextSlot != nil {
				if err := placeWinnerTx(ctx, tx, BracketTableHostedEvent, *m.NextMatchID, *m.NextSlot, winnerID, bst); err != nil {
					return err
				}
			} else {
				_, err = tx.Exec(ctx, `
					UPDATE hosted_events
					SET status = $2, winner_id = $3, finished_at = NOW(), updated_at = NOW()
					WHERE id = $1`, m.EventID, est.Finished, winnerID)
				if err != nil {
					return err
				}
				if err := assignKnockoutFinalPlacementsTx(
					ctx, tx, BracketTableHostedEvent, entryTableHosted,
					m.EventID, m.ID, winnerID, m.PlayerAID, m.PlayerBID, entryApproved,
				); err != nil {
					return err
				}
			}
			return tx.Commit(ctx)
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		return s.maybePromoteGroupsToKnockout(ctx, ev, bst, est, entryApproved, phases, groupsAdvance, standingsPointsWin, standingsPointsDraw)

	default:
		return fmt.Errorf("unsupported hosted event format")
	}

	return tx.Commit(ctx)
}

func (s *HostedEventStore) maybeFinishRoundRobin(
	ctx context.Context,
	eventID string,
	bst HostedBracketStatuses,
	est HostedEventStatuses,
	entryApproved, phase string,
	standingsPointsWin, standingsPointsDraw int,
) error {
	matches, err := s.ListBracket(ctx, eventID)
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
		finished = append(finished, m)
	}
	standings := computeStandingsFromMatches(finished, usernames, standingsPointsWin, standingsPointsDraw)
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := s.finishEventByStandingsTx(ctx, tx, eventID, standings, est, entryApproved); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *HostedEventStore) maybeAdvanceSwiss(
	ctx context.Context,
	ev *HostedEvent,
	bst HostedBracketStatuses,
	est HostedEventStatuses,
	entryApproved, phase string,
	swissRoundsByMax map[string]int,
	standingsPointsWin, standingsPointsDraw int,
) error {
	matches, err := s.ListBracket(ctx, ev.ID)
	if err != nil {
		return err
	}
	cur := s.maxSwissRound(matches, phase)
	if cur < 0 {
		return nil
	}
	// Current round complete?
	for _, m := range matches {
		if m.Phase == phase && m.RoundIndex == cur && !matchTerminal(m, bst) {
			return nil
		}
	}
	maxPlayers := 0
	if HasPlayerCap(ev.MaxPlayers) {
		maxPlayers = *ev.MaxPlayers
	} else {
		// Uncapped should not use Swiss; fall back to field size for safety.
		maxPlayers = len(matches)
		if maxPlayers < 2 {
			maxPlayers = 2
		}
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
		if matchTerminal(m, bst) {
			finished = append(finished, m)
		}
	}
	standings := computeStandingsFromMatches(finished, usernames, standingsPointsWin, standingsPointsDraw)
	if cur+1 >= totalRounds {
		tx, err := s.db.Pool.Begin(ctx)
		if err != nil {
			return err
		}
		defer tx.Rollback(ctx)
		if err := s.finishEventByStandingsTx(ctx, tx, ev.ID, standings, est, entryApproved); err != nil {
			return err
		}
		return tx.Commit(ctx)
	}
	ordered := make([]string, 0, len(standings))
	for _, row := range standings {
		ordered = append(ordered, row.UserID)
	}
	opponents := buildOpponentMap(matches, phase)
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := insertSwissRoundTx(ctx, tx, BracketTableHostedEvent, ev.ID, ordered, bst, phase, cur+1, opponents); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *HostedEventStore) maybePromoteGroupsToKnockout(
	ctx context.Context,
	ev *HostedEvent,
	bst HostedBracketStatuses,
	est HostedEventStatuses,
	entryApproved string,
	phases HostedFormatPhases,
	advancePerGroup int,
	standingsPointsWin, standingsPointsDraw int,
) error {
	if advancePerGroup < 1 {
		return ErrHostedEventInvalidInput
	}
	matches, err := s.ListBracket(ctx, ev.ID)
	if err != nil {
		return err
	}
	if !s.allPhaseMatchesDone(matches, phases.Group, bst) {
		return nil
	}
	// Already has knockout?
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
		groupMatches = append(groupMatches, m)
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
		// Degenerate: finish on group standings overall.
		tx, err := s.db.Pool.Begin(ctx)
		if err != nil {
			return err
		}
		defer tx.Rollback(ctx)
		if err := s.finishEventByStandingsTx(ctx, tx, ev.ID, standings, est, entryApproved); err != nil {
			return err
		}
		return tx.Commit(ctx)
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := generateKnockoutBracketTx(ctx, tx, BracketTableHostedEvent, ev.ID, advancers, bst, phases.Knockout, -1, 0); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
