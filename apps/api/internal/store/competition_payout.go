package store

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
)

// ScoreShareRow is one player's score for score-share pot math.
type ScoreShareRow struct {
	UserID string
	Points float64
}

// PlacePercentsFromEnums reads default 1/2/3 place percents from client_enums.
func PlacePercentsFromEnums(enums ClientEnumsConfig) (map[int]float64, error) {
	out := map[int]float64{}
	pairs := []struct {
		place int
		raw   string
	}{
		{1, enums.CompetitionDefaultPlacePercent1},
		{2, enums.CompetitionDefaultPlacePercent2},
		{3, enums.CompetitionDefaultPlacePercent3},
	}
	sum := 0.0
	for _, p := range pairs {
		raw := strings.TrimSpace(p.raw)
		if raw == "" {
			return nil, fmt.Errorf("competition_default_place_percent_%d required", p.place)
		}
		v, err := strconv.ParseFloat(raw, 64)
		if err != nil || v < 0 {
			return nil, fmt.Errorf("competition_default_place_percent_%d invalid", p.place)
		}
		if v == 0 {
			continue
		}
		out[p.place] = v
		sum = roundMoney2(sum + v)
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("competition_default_place_percents empty")
	}
	if sum < 99.999 || sum > 100.001 {
		return nil, fmt.Errorf("competition_default_place_percents must sum to 100")
	}
	return out, nil
}

// ParsePlacePercentsMap validates a place→percent map (must sum to 100).
func ParsePlacePercentsMap(raw map[string]float64) (map[int]float64, error) {
	out := map[int]float64{}
	if len(raw) == 0 {
		return nil, fmt.Errorf("place percents required")
	}
	sum := 0.0
	for k, v := range raw {
		place, err := strconv.Atoi(strings.TrimSpace(k))
		if err != nil || place < 1 {
			continue
		}
		pct := roundMoney2(v)
		if pct <= 0 {
			continue
		}
		out[place] = pct
		sum = roundMoney2(sum + pct)
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("place percents required")
	}
	if sum < 99.999 || sum > 100.001 {
		return nil, fmt.Errorf("place percents must sum to 100")
	}
	return out, nil
}

// PlacePercentsFromJSONBany parses prize_place_percents jsonb (keys "1","2",...).
func PlacePercentsFromJSONBany(raw map[string]any) (map[int]float64, error) {
	asFloat := map[string]float64{}
	for k, v := range raw {
		if amt, ok := jsonAmount(v); ok {
			asFloat[k] = amt
		} else {
			switch t := v.(type) {
			case float64:
				if t > 0 {
					asFloat[k] = t
				}
			case int:
				if t > 0 {
					asFloat[k] = float64(t)
				}
			case string:
				f, err := strconv.ParseFloat(strings.TrimSpace(t), 64)
				if err == nil && f > 0 {
					asFloat[k] = f
				}
			}
		}
	}
	return ParsePlacePercentsMap(asFloat)
}

// DefaultPayoutModeForFormat returns the platform default mode for a format id.
func DefaultPayoutModeForFormat(enums ClientEnumsConfig, formatID string) string {
	formatID = strings.TrimSpace(formatID)
	switch formatID {
	case strings.TrimSpace(enums.HostedEventArenaFormat):
		return strings.TrimSpace(enums.CompetitionDefaultPayoutModeArena)
	case strings.TrimSpace(enums.HostedEventSwissFormat):
		return strings.TrimSpace(enums.CompetitionDefaultPayoutModeSwiss)
	case strings.TrimSpace(enums.HostedEventRoundRobinFormat):
		return strings.TrimSpace(enums.CompetitionDefaultPayoutModeRoundRobin)
	case strings.TrimSpace(enums.HostedEventGroupsKnockoutFormat):
		return strings.TrimSpace(enums.CompetitionDefaultPayoutModeGroupsKnockout)
	case strings.TrimSpace(enums.HostedEventKnockoutFormat):
		return strings.TrimSpace(enums.CompetitionDefaultPayoutModeKnockout)
	default:
		return strings.TrimSpace(enums.CompetitionPayoutModePlacesPercent)
	}
}

// DualPursePlacePercentFromRaw parses competition_dual_purse_place_percent (1..99 exclusive of 0/100).
func DualPursePlacePercentFromRaw(raw string) (float64, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, fmt.Errorf("competition_dual_purse_place_percent required")
	}
	v, err := strconv.ParseFloat(raw, 64)
	if err != nil || v <= 0 || v >= 100 {
		return 0, fmt.Errorf("competition_dual_purse_place_percent invalid")
	}
	return roundMoney2(v), nil
}

// DualPursePlacePercent reads the place-purse share of the frozen pot from client_enums.
func DualPursePlacePercent(enums ClientEnumsConfig) (float64, error) {
	return DualPursePlacePercentFromRaw(enums.CompetitionDualPursePlacePercent)
}

// ValidatePayoutModeForFormat fail-closes modes not in client_enums.competition_payout_modes.
// All formats may use places_percent, score_share, or dual_purse. Score-share / dual performance
// purse split by standings/arena points (KO = knockout-phase win points). Dual purse is
// end-of-cup only (place purse + performance purse).
func ValidatePayoutModeForFormat(enums ClientEnumsConfig, formatID, mode string) error {
	_ = formatID // reserved for future format-specific mode sets from DB
	mode = strings.TrimSpace(mode)
	if mode == "" {
		return fmt.Errorf("payout mode required")
	}
	allowed := false
	for _, m := range enums.CompetitionPayoutModes {
		if strings.TrimSpace(m) == mode {
			allowed = true
			break
		}
	}
	if !allowed {
		return fmt.Errorf("payout mode invalid")
	}
	return nil
}

// StandingsPhaseFilterForFormat matches GET standings phase filters (group stage only for groups_knockout).
func StandingsPhaseFilterForFormat(enums ClientEnumsConfig, formatID string) string {
	switch strings.TrimSpace(formatID) {
	case strings.TrimSpace(enums.HostedEventGroupsKnockoutFormat):
		return strings.TrimSpace(enums.HostedEventPhaseGroup)
	case strings.TrimSpace(enums.HostedEventSwissFormat):
		return strings.TrimSpace(enums.HostedEventPhaseSwiss)
	case strings.TrimSpace(enums.HostedEventRoundRobinFormat):
		return strings.TrimSpace(enums.HostedEventPhaseRoundRobin)
	case strings.TrimSpace(enums.HostedEventKnockoutFormat):
		return strings.TrimSpace(enums.HostedEventPhaseKnockout)
	default:
		return ""
	}
}

// StandingsPointsPerWin parses competition_standings_points_win (fail closed).
func StandingsPointsPerWin(enums ClientEnumsConfig) (int, error) {
	raw := strings.TrimSpace(enums.CompetitionStandingsPointsWin)
	if raw == "" {
		return 0, fmt.Errorf("competition_standings_points_win required")
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 0 {
		return 0, fmt.Errorf("competition_standings_points_win invalid")
	}
	return n, nil
}

// StandingsPointsPerDraw parses competition_standings_points_draw (fail closed).
func StandingsPointsPerDraw(enums ClientEnumsConfig) (int, error) {
	raw := strings.TrimSpace(enums.CompetitionStandingsPointsDraw)
	if raw == "" {
		return 0, fmt.Errorf("competition_standings_points_draw required")
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 0 {
		return 0, fmt.Errorf("competition_standings_points_draw invalid")
	}
	return n, nil
}

// BuildPayoutRowsPlacesPercent splits frozen pot by place percentages.
func BuildPayoutRowsPlacesPercent(
	frozen float64,
	percents map[int]float64,
	placements map[int]string,
) []PendingPayoutInput {
	frozen = roundMoney2(frozen)
	if frozen <= 0 || len(percents) == 0 || len(placements) == 0 {
		return nil
	}
	places := make([]int, 0, len(percents))
	for p := range percents {
		places = append(places, p)
	}
	sort.Ints(places)

	type alloc struct {
		place  int
		userID string
		amount float64
	}
	allocated := make([]alloc, 0, len(places))
	sumPaid := 0.0
	for _, place := range places {
		uid, ok := placements[place]
		if !ok || strings.TrimSpace(uid) == "" {
			continue
		}
		pct := percents[place]
		amt := roundMoney2(frozen * pct / 100.0)
		if amt <= 0 {
			continue
		}
		allocated = append(allocated, alloc{place: place, userID: uid, amount: amt})
		sumPaid = roundMoney2(sumPaid + amt)
	}
	if len(allocated) == 0 {
		return nil
	}
	// Penny remainder to the first allocated place (usually 1st).
	diff := roundMoney2(frozen - sumPaid)
	if diff != 0 {
		allocated[0].amount = roundMoney2(allocated[0].amount + diff)
	}
	out := make([]PendingPayoutInput, 0, len(allocated))
	for _, a := range allocated {
		if a.amount <= 0 {
			continue
		}
		out = append(out, PendingPayoutInput{
			UserID:    a.userID,
			Placement: a.place,
			Amount:    a.amount,
		})
	}
	return out
}

// BuildPayoutRowsScoreShare splits frozen pot by points / total points.
func BuildPayoutRowsScoreShare(frozen float64, scores []ScoreShareRow) []PendingPayoutInput {
	frozen = roundMoney2(frozen)
	if frozen <= 0 || len(scores) == 0 {
		return nil
	}
	total := 0.0
	filtered := make([]ScoreShareRow, 0, len(scores))
	for _, s := range scores {
		uid := strings.TrimSpace(s.UserID)
		if uid == "" || s.Points <= 0 {
			continue
		}
		filtered = append(filtered, ScoreShareRow{UserID: uid, Points: s.Points})
		total += s.Points
	}
	if total <= 0 || len(filtered) == 0 {
		return nil
	}
	sort.SliceStable(filtered, func(i, j int) bool {
		if filtered[i].Points == filtered[j].Points {
			return filtered[i].UserID < filtered[j].UserID
		}
		return filtered[i].Points > filtered[j].Points
	})
	out := make([]PendingPayoutInput, 0, len(filtered))
	sumPaid := 0.0
	for i, s := range filtered {
		amt := roundMoney2(frozen * s.Points / total)
		if amt <= 0 {
			continue
		}
		out = append(out, PendingPayoutInput{
			UserID:    s.UserID,
			Placement: i + 1,
			Amount:    amt,
		})
		sumPaid = roundMoney2(sumPaid + amt)
	}
	if len(out) == 0 {
		return nil
	}
	diff := roundMoney2(frozen - sumPaid)
	if diff != 0 {
		out[0].Amount = roundMoney2(out[0].Amount + diff)
	}
	return out
}

// BuildPayoutRowsDualPurse splits frozen pot into place purse (finish %) + performance purse (points).
// Same user who places and scores gets one merged escrow row (unique user+placement).
func BuildPayoutRowsDualPurse(
	frozen float64,
	placePursePct float64,
	percents map[int]float64,
	placements map[int]string,
	scores []ScoreShareRow,
) []PendingPayoutInput {
	frozen = roundMoney2(frozen)
	if frozen <= 0 || placePursePct <= 0 || placePursePct >= 100 {
		return nil
	}
	placePurse := roundMoney2(frozen * placePursePct / 100.0)
	perfPurse := roundMoney2(frozen - placePurse)
	placeRows := BuildPayoutRowsPlacesPercent(placePurse, percents, placements)
	scoreRows := BuildPayoutRowsScoreShare(perfPurse, scores)
	if len(placeRows) == 0 && len(scoreRows) == 0 {
		return nil
	}
	if len(placeRows) == 0 {
		return BuildPayoutRowsScoreShare(frozen, scores)
	}
	if len(scoreRows) == 0 {
		return BuildPayoutRowsPlacesPercent(frozen, percents, placements)
	}

	type merged struct {
		amount   float64
		place    int
		hasPlace bool
	}
	byUser := map[string]*merged{}
	order := make([]string, 0, len(placeRows)+len(scoreRows))
	for _, r := range placeRows {
		uid := strings.TrimSpace(r.UserID)
		if uid == "" {
			continue
		}
		m := byUser[uid]
		if m == nil {
			m = &merged{}
			byUser[uid] = m
			order = append(order, uid)
		}
		m.amount = roundMoney2(m.amount + r.Amount)
		m.place = r.Placement
		m.hasPlace = true
	}
	for _, r := range scoreRows {
		uid := strings.TrimSpace(r.UserID)
		if uid == "" {
			continue
		}
		m := byUser[uid]
		if m == nil {
			m = &merged{}
			byUser[uid] = m
			order = append(order, uid)
		}
		m.amount = roundMoney2(m.amount + r.Amount)
		if !m.hasPlace {
			m.place = r.Placement
		}
	}
	if len(order) == 0 {
		return nil
	}
	sort.SliceStable(order, func(i, j int) bool {
		a, b := byUser[order[i]], byUser[order[j]]
		if a.place != b.place {
			return a.place < b.place
		}
		if a.amount != b.amount {
			return a.amount > b.amount
		}
		return order[i] < order[j]
	})
	out := make([]PendingPayoutInput, 0, len(order))
	sumPaid := 0.0
	for _, uid := range order {
		m := byUser[uid]
		if m == nil || m.amount <= 0 || m.place < 1 {
			continue
		}
		out = append(out, PendingPayoutInput{
			UserID:    uid,
			Placement: m.place,
			Amount:    m.amount,
		})
		sumPaid = roundMoney2(sumPaid + m.amount)
	}
	if len(out) == 0 {
		return nil
	}
	diff := roundMoney2(frozen - sumPaid)
	if diff != 0 {
		out[0].Amount = roundMoney2(out[0].Amount + diff)
	}
	return out
}
