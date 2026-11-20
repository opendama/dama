package store

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
)

// entryPlacementTable whitelists entry UPDATE targets for KO place writes.
type entryPlacementTable struct {
	name      string
	entityCol string
}

var (
	entryTableTournament = entryPlacementTable{name: "tournament_entries", entityCol: "tournament_id"}
	entryTableHosted     = entryPlacementTable{name: "hosted_event_entries", entityCol: "event_id"}
)

func (t entryPlacementTable) validate() error {
	switch t {
	case entryTableTournament, entryTableHosted:
		return nil
	default:
		return fmt.Errorf("invalid entry placement table")
	}
}

// assignKnockoutFinalPlacementsTx writes places for a completed KO final:
//
//	1 = final winner, 2 = final loser, then 3+ = losers of matches that feed the final
//
// (semis), sorted by user_id for a stable order. Missing lower places are skipped by
// places_percent escrow (remainder folds to first allocated place).
func assignKnockoutFinalPlacementsTx(
	ctx context.Context,
	tx pgx.Tx,
	matchTbl bracketMatchTable,
	entryTbl entryPlacementTable,
	entityID, finalMatchID, winnerID string,
	playerA, playerB *string,
	entryApproved string,
) error {
	if err := matchTbl.validate(); err != nil {
		return err
	}
	if err := entryTbl.validate(); err != nil {
		return err
	}
	entityID = strings.TrimSpace(entityID)
	finalMatchID = strings.TrimSpace(finalMatchID)
	winnerID = strings.TrimSpace(winnerID)
	if entityID == "" || finalMatchID == "" || winnerID == "" {
		return fmt.Errorf("knockout final placements: missing ids")
	}

	ordered := make([]string, 0, 8)
	ordered = append(ordered, winnerID)
	if playerA != nil && playerB != nil {
		loser := strings.TrimSpace(*playerA)
		if winnerID == strings.TrimSpace(*playerA) {
			loser = strings.TrimSpace(*playerB)
		}
		if loser != "" && loser != winnerID {
			ordered = append(ordered, loser)
		}
	}

	rows, err := tx.Query(ctx, fmt.Sprintf(`
		SELECT player_a_id::text, player_b_id::text, winner_id::text
		FROM %s
		WHERE %s = $1 AND next_match_id = $2::uuid
		  AND player_a_id IS NOT NULL AND player_b_id IS NOT NULL
		  AND winner_id IS NOT NULL`, matchTbl.name, matchTbl.entityCol),
		entityID, finalMatchID)
	if err != nil {
		return err
	}
	defer rows.Close()
	semiLosers := make([]string, 0, 4)
	seen := map[string]struct{}{winnerID: {}, ordered[len(ordered)-1]: {}}
	for rows.Next() {
		var a, b, w string
		if err := rows.Scan(&a, &b, &w); err != nil {
			return err
		}
		a, b, w = strings.TrimSpace(a), strings.TrimSpace(b), strings.TrimSpace(w)
		loser := a
		if w == a {
			loser = b
		}
		if loser == "" || loser == w {
			continue
		}
		if _, ok := seen[loser]; ok {
			continue
		}
		seen[loser] = struct{}{}
		semiLosers = append(semiLosers, loser)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	sort.Strings(semiLosers)
	ordered = append(ordered, semiLosers...)

	for i, uid := range ordered {
		place := i + 1
		var err error
		if entryApproved != "" {
			_, err = tx.Exec(ctx, fmt.Sprintf(`
				UPDATE %s SET placement = $3
				WHERE %s = $1 AND user_id = $2::uuid AND status = $4`,
				entryTbl.name, entryTbl.entityCol),
				entityID, uid, place, entryApproved)
		} else {
			_, err = tx.Exec(ctx, fmt.Sprintf(`
				UPDATE %s SET placement = $3
				WHERE %s = $1 AND user_id = $2::uuid`,
				entryTbl.name, entryTbl.entityCol),
				entityID, uid, place)
		}
		if err != nil {
			return err
		}
	}
	return nil
}
