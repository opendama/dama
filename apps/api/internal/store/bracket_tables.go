package store

import "errors"

// bracketMatchTable whitelists bracket INSERT/UPDATE targets (never from user input).
type bracketMatchTable struct {
	name      string
	entityCol string
}

var (
	BracketTableHostedEvent = bracketMatchTable{name: "hosted_event_bracket_matches", entityCol: "event_id"}
	BracketTableTournament  = bracketMatchTable{name: "tournament_bracket_matches", entityCol: "tournament_id"}
)

func (t bracketMatchTable) validate() error {
	switch t {
	case BracketTableHostedEvent, BracketTableTournament:
		return nil
	default:
		return errors.New("invalid bracket match table")
	}
}
