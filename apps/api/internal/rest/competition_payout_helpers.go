package rest

import (
	"strconv"
	"strings"

	"dama/apps/api/internal/store"
)

type competitionPayoutRequest struct {
	Mode     string
	Percents map[string]float64
	Engage   bool
}

type competitionPayoutResolved struct {
	Mode     string
	Percents map[string]any
}

func placePercentsToAny(m map[int]float64) map[string]any {
	out := map[string]any{}
	for place, pct := range m {
		if pct <= 0 {
			continue
		}
		out[strconv.Itoa(place)] = pct
	}
	if out == nil {
		return map[string]any{}
	}
	return out
}

// resolveCompetitionPayout fail-closes invalid modes/percents when Engage is true.
// Empty mode with Engage false preserves legacy fixed prize_pool place amounts.
func resolveCompetitionPayout(
	enums store.ClientEnumsConfig,
	formatID string,
	prizeDisplay bool,
	isFree bool,
	paidEntryAmount float64,
	req competitionPayoutRequest,
	preserve *competitionPayoutResolved,
) (competitionPayoutResolved, string) {
	empty := competitionPayoutResolved{Mode: "", Percents: map[string]any{}}
	if !prizeDisplay || isFree || paidEntryAmount <= 0 {
		return empty, ""
	}
	if !req.Engage {
		if preserve != nil {
			if preserve.Percents == nil {
				preserve.Percents = map[string]any{}
			}
			return *preserve, ""
		}
		return empty, ""
	}
	mode := strings.TrimSpace(req.Mode)
	if mode == "" {
		mode = store.DefaultPayoutModeForFormat(enums, formatID)
	}
	if err := store.ValidatePayoutModeForFormat(enums, formatID, mode); err != nil {
		return empty, "err_payout_mode_invalid"
	}
	placesMode := strings.TrimSpace(enums.CompetitionPayoutModePlacesPercent)
	dualMode := strings.TrimSpace(enums.CompetitionPayoutModeDualPurse)
	percents := map[string]any{}
	if mode == placesMode || mode == dualMode {
		var parsed map[int]float64
		var err error
		if len(req.Percents) > 0 {
			parsed, err = store.ParsePlacePercentsMap(req.Percents)
		} else {
			parsed, err = store.PlacePercentsFromEnums(enums)
		}
		if err != nil {
			return empty, "err_prize_place_percents_sum"
		}
		percents = placePercentsToAny(parsed)
	}
	if mode == dualMode {
		if _, err := store.DualPursePlacePercent(enums); err != nil {
			return empty, "err_payout_mode_invalid"
		}
	}
	return competitionPayoutResolved{Mode: mode, Percents: percents}, ""
}

func attachPrizePayoutFields(out map[string]any, mode string, percents map[string]any) {
	if out == nil {
		return
	}
	mode = strings.TrimSpace(mode)
	if mode != "" {
		out["prize_payout_mode"] = mode
	}
	if len(percents) > 0 {
		out["prize_place_percents"] = percents
	} else if mode != "" {
		out["prize_place_percents"] = map[string]any{}
	}
}
