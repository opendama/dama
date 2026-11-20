package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"dama/apps/api/internal/db"

	"github.com/jackc/pgx/v5"
)

const (
	CompetitionEntityTournament = "tournament"
	CompetitionEntityEvent      = "event"
)

// CompetitionPrizePayout is one escrow row before wallet credit.
type CompetitionPrizePayout struct {
	ID          string     `json:"id"`
	EntityKind  string     `json:"entity_kind"`
	EntityID    string     `json:"entity_id"`
	UserID      string     `json:"user_id"`
	Placement   int        `json:"placement"`
	Amount      float64    `json:"amount"`
	Currency    string     `json:"currency"`
	Status      string     `json:"status"`
	LedgerTxID  *string    `json:"ledger_tx_id,omitempty"`
	SettledAt   *time.Time `json:"settled_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	EntityTitle string     `json:"entity_title,omitempty"`
}

// PendingPayoutInput is one placement payout to insert at cup finish.
type PendingPayoutInput struct {
	UserID    string
	Placement int
	Amount    float64
}

type CompetitionPrizeStore struct {
	db       *db.Handle
	settings *SettingsStore
}

func NewCompetitionPrizeStore(handle *db.Handle, settings *SettingsStore) *CompetitionPrizeStore {
	return &CompetitionPrizeStore{db: handle, settings: settings}
}

func (s *CompetitionPrizeStore) ready() bool {
	return s != nil && s.db != nil && s.db.Ready()
}

func (s *CompetitionPrizeStore) payoutEnums() (ClientEnumsConfig, error) {
	if s.settings == nil {
		return ClientEnumsConfig{}, errors.New("settings unavailable")
	}
	enums := s.settings.ClientEnums()
	if enums.Source != "database" ||
		len(enums.CompetitionPrizePayoutStatuses) == 0 ||
		enums.CompetitionPrizePayoutPending == "" ||
		enums.CompetitionPrizePayoutSettled == "" ||
		enums.CompetitionPrizePayoutFailed == "" ||
		enums.CompetitionPrizePayoutCancelled == "" ||
		strings.TrimSpace(enums.CompetitionDisputeWindowHours) == "" {
		return ClientEnumsConfig{}, errors.New("client_enums competition prize payout incomplete")
	}
	return enums, nil
}

func disputeWindowDuration(enums ClientEnumsConfig) (time.Duration, error) {
	h, err := strconv.Atoi(strings.TrimSpace(enums.CompetitionDisputeWindowHours))
	if err != nil || h < 0 {
		return 0, fmt.Errorf("invalid competition_dispute_window_hours")
	}
	return time.Duration(h) * time.Hour, nil
}

func roundMoney2(v float64) float64 {
	return math.Round(v*100) / 100
}

func jsonAmount(v any) (float64, bool) {
	switch t := v.(type) {
	case float64:
		return roundMoney2(t), t > 0
	case json.Number:
		f, err := t.Float64()
		if err != nil {
			return 0, false
		}
		return roundMoney2(f), f > 0
	case int:
		return roundMoney2(float64(t)), t > 0
	case int64:
		return roundMoney2(float64(t)), t > 0
	default:
		return 0, false
	}
}

// PrizeAmountsByPlace reads numeric place keys from a prize_pool map (excludes total/currency).
func PrizeAmountsByPlace(pool map[string]any) map[int]float64 {
	out := map[int]float64{}
	if pool == nil {
		return out
	}
	for k, v := range pool {
		k = strings.TrimSpace(k)
		if k == "" || k == "total" || k == "currency" {
			continue
		}
		place, err := strconv.Atoi(k)
		if err != nil || place < 1 {
			continue
		}
		if amt, ok := jsonAmount(v); ok {
			out[place] = amt
		}
	}
	return out
}

// CreatePendingPayouts inserts escrow rows and sets dispute_window_ends_at on the entity (idempotent).
func (s *CompetitionPrizeStore) CreatePendingPayouts(
	ctx context.Context,
	entityKind, entityID, currency string,
	rows []PendingPayoutInput,
) error {
	if !s.ready() {
		return errors.New("database unavailable")
	}
	entityKind = strings.TrimSpace(entityKind)
	entityID = strings.TrimSpace(entityID)
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if entityKind != CompetitionEntityTournament && entityKind != CompetitionEntityEvent {
		return fmt.Errorf("invalid entity kind")
	}
	if entityID == "" || currency == "" {
		return fmt.Errorf("entity and currency required")
	}
	enums, err := s.payoutEnums()
	if err != nil {
		return err
	}
	pending := enums.CompetitionPrizePayoutPending
	window, err := disputeWindowDuration(enums)
	if err != nil {
		return err
	}

	filtered := make([]PendingPayoutInput, 0, len(rows))
	for _, row := range rows {
		row.UserID = strings.TrimSpace(row.UserID)
		if row.UserID == "" || row.Placement < 1 {
			continue
		}
		row.Amount = roundMoney2(row.Amount)
		if row.Amount <= 0 {
			continue
		}
		filtered = append(filtered, row)
	}
	if len(filtered) == 0 {
		return nil
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var existing int
	if err := tx.QueryRow(ctx, `
		SELECT COUNT(*) FROM competition_prize_payouts
		WHERE entity_kind = $1 AND entity_id = $2`, entityKind, entityID).Scan(&existing); err != nil {
		return err
	}
	if existing > 0 {
		return tx.Commit(ctx)
	}

	disputeEnds := time.Now().UTC().Add(window)
	for _, row := range filtered {
		_, err := tx.Exec(ctx, `
			INSERT INTO competition_prize_payouts (
				entity_kind, entity_id, user_id, placement, amount, currency, status
			) VALUES ($1,$2,$3,$4,$5,$6,$7)
			ON CONFLICT (entity_kind, entity_id, user_id, placement) DO NOTHING`,
			entityKind, entityID, row.UserID, row.Placement, row.Amount, currency, pending)
		if err != nil {
			return err
		}
	}

	switch entityKind {
	case CompetitionEntityTournament:
		_, err = tx.Exec(ctx, `
			UPDATE tournaments
			SET dispute_window_ends_at = COALESCE(dispute_window_ends_at, $2), updated_at = NOW()
			WHERE id = $1`, entityID, disputeEnds)
	case CompetitionEntityEvent:
		_, err = tx.Exec(ctx, `
			UPDATE hosted_events
			SET dispute_window_ends_at = COALESCE(dispute_window_ends_at, $2), updated_at = NOW()
			WHERE id = $1`, entityID, disputeEnds)
	}
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// EscrowTournamentFinish builds payout rows from prize pool + entry placements.
func (s *CompetitionPrizeStore) EscrowTournamentFinish(ctx context.Context, tour *Tournament) error {
	if tour == nil || tour.FinishedAt == nil {
		return nil
	}
	if tour.IsFree {
		return nil
	}
	if !tourHasPrizePool(tour) {
		return nil
	}
	placements, err := s.listTournamentPlacements(ctx, tour.ID)
	if err != nil {
		return err
	}
	frozen := 0.0
	if tour.PrizePoolFrozenAmount != nil {
		frozen = roundMoney2(*tour.PrizePoolFrozenAmount)
	}
	rows, err := s.buildTournamentPayoutRows(ctx, tour, frozen, placements)
	if err != nil {
		return err
	}
	if len(rows) == 0 {
		// Fail closed: frozen pot with no recipients must surface for ops/repair logs.
		if frozen > 0 && tour.PrizePoolDisplayEnabled {
			return fmt.Errorf("prize escrow: no payout rows for frozen pot tournament_id=%s amount=%.2f", tour.ID, frozen)
		}
		return nil
	}
	cur := strings.ToUpper(strings.TrimSpace(tour.EntryFeeCurrency))
	if cur == "" && tour.PrizePool != nil {
		if c, ok := tour.PrizePool["currency"].(string); ok {
			cur = strings.ToUpper(strings.TrimSpace(c))
		}
	}
	return s.CreatePendingPayouts(ctx, CompetitionEntityTournament, tour.ID, cur, rows)
}

func (s *CompetitionPrizeStore) buildTournamentPayoutRows(
	ctx context.Context, tour *Tournament, frozen float64, placements map[int]string,
) ([]PendingPayoutInput, error) {
	mode := strings.TrimSpace(tour.PrizePayoutMode)
	enums, err := s.payoutEnums()
	if err != nil {
		return nil, err
	}
	placesMode := strings.TrimSpace(enums.CompetitionPayoutModePlacesPercent)
	scoreMode := strings.TrimSpace(enums.CompetitionPayoutModeScoreShare)
	dualMode := strings.TrimSpace(enums.CompetitionPayoutModeDualPurse)
	switch mode {
	case placesMode:
		percents, perr := PlacePercentsFromJSONBany(tour.PrizePlacePercents)
		if perr != nil {
			return nil, perr
		}
		return BuildPayoutRowsPlacesPercent(frozen, percents, placements), nil
	case scoreMode:
		scores, serr := s.tournamentScoreShareRows(ctx, tour, enums)
		if serr != nil {
			return nil, serr
		}
		return BuildPayoutRowsScoreShare(frozen, scores), nil
	case dualMode:
		percents, perr := PlacePercentsFromJSONBany(tour.PrizePlacePercents)
		if perr != nil {
			return nil, perr
		}
		placePct, derr := DualPursePlacePercent(enums)
		if derr != nil {
			return nil, derr
		}
		scores, serr := s.tournamentScoreShareRows(ctx, tour, enums)
		if serr != nil {
			return nil, serr
		}
		return BuildPayoutRowsDualPurse(frozen, placePct, percents, placements, scores), nil
	default:
		// Legacy fixed place $ on prize_pool only - never invent whole-pot→1st for displayed pots.
		if tour.PrizePoolDisplayEnabled {
			if len(PrizeAmountsByPlace(tour.PrizePool)) == 0 {
				return nil, fmt.Errorf("prize_payout_mode required for displayed prize pot")
			}
		}
		return buildPayoutRowsFromPool(tour.PrizePool, tour.PrizePoolFrozenAmount, placements), nil
	}
}

func (s *CompetitionPrizeStore) tournamentScoreShareRows(
	ctx context.Context, tour *Tournament, enums ClientEnumsConfig,
) ([]ScoreShareRow, error) {
	if tour == nil {
		return nil, nil
	}
	formatID := strings.TrimSpace(tour.FormatID)
	if formatID == strings.TrimSpace(enums.HostedEventArenaFormat) {
		standings, err := NewTournamentStore(s.db).ListArenaStandings(ctx, tour.ID)
		if err != nil {
			return nil, err
		}
		out := make([]ScoreShareRow, 0, len(standings))
		for _, r := range standings {
			out = append(out, ScoreShareRow{UserID: r.UserID, Points: r.Points})
		}
		return out, nil
	}
	bst := HostedBracketStatuses{
		Pending: enums.TournamentBracketPending,
		Ready:   enums.TournamentBracketReady,
		Live:    enums.TournamentBracketLive,
		Done:    enums.TournamentBracketDone,
		Bye:     enums.TournamentBracketBye,
	}
	ppw, err := StandingsPointsPerWin(enums)
	if err != nil {
		return nil, err
	}
	ppd, err := StandingsPointsPerDraw(enums)
	if err != nil {
		return nil, err
	}
	phaseFilter := StandingsPhaseFilterForFormat(enums, formatID)
	rows, err := NewTournamentStore(s.db).ListStandings(ctx, tour.ID, bst, phaseFilter, ppw, ppd)
	if err != nil {
		return nil, err
	}
	out := make([]ScoreShareRow, 0, len(rows))
	for _, r := range rows {
		out = append(out, ScoreShareRow{UserID: r.UserID, Points: float64(r.Points)})
	}
	return out, nil
}

func tourHasPrizePool(t *Tournament) bool {
	if t == nil {
		return false
	}
	if t.PrizePoolDisplayEnabled {
		return true
	}
	if len(PrizeAmountsByPlace(t.PrizePool)) > 0 {
		return true
	}
	if t.PrizePoolFrozenAmount != nil && *t.PrizePoolFrozenAmount > 0 {
		return true
	}
	if t.PrizePool != nil {
		if amt, ok := jsonAmount(t.PrizePool["total"]); ok && amt > 0 {
			return true
		}
	}
	return false
}

func (s *CompetitionPrizeStore) listTournamentPlacements(ctx context.Context, tournamentID string) (map[int]string, error) {
	rows, err := s.db.Pool.Query(ctx, `
		SELECT user_id::text, placement FROM tournament_entries
		WHERE tournament_id = $1 AND placement IS NOT NULL`, tournamentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int]string{}
	for rows.Next() {
		var uid string
		var place int
		if err := rows.Scan(&uid, &place); err != nil {
			return nil, err
		}
		out[place] = uid
	}
	return out, rows.Err()
}

// EscrowEventFinish builds payout rows from frozen pot + placements.
func (s *CompetitionPrizeStore) EscrowEventFinish(ctx context.Context, ev *HostedEvent, entryApproved string) error {
	if ev == nil || ev.FinishedAt == nil || ev.IsFreeEntry {
		return nil
	}
	if !ev.PrizePoolDisplayEnabled {
		return nil
	}
	if ev.PrizePoolFrozenAmount == nil || *ev.PrizePoolFrozenAmount <= 0 {
		return nil
	}
	placements, err := s.listEventPlacements(ctx, ev.ID, entryApproved)
	if err != nil {
		return err
	}
	frozen := roundMoney2(*ev.PrizePoolFrozenAmount)
	rows, err := s.buildEventPayoutRows(ctx, ev, frozen, placements, entryApproved)
	if err != nil {
		return err
	}
	// Legacy only: whole frozen pot to declared winner when display is off and no mode/rows.
	if len(rows) == 0 && ev.WinnerID != nil && !ev.PrizePoolDisplayEnabled && strings.TrimSpace(ev.PrizePayoutMode) == "" {
		rows = []PendingPayoutInput{{
			UserID:    *ev.WinnerID,
			Placement: 1,
			Amount:    frozen,
		}}
	}
	if len(rows) == 0 {
		// Fail closed: a frozen pot with zero payout rows must not look like success
		// (repair would spin forever with no dispute window).
		if frozen > 0 && ev.PrizePoolDisplayEnabled {
			return fmt.Errorf("prize escrow: no payout rows for frozen pot event_id=%s amount=%.2f", ev.ID, frozen)
		}
		return nil
	}
	cur := strings.ToUpper(strings.TrimSpace(ev.EntryFeeCurrency))
	return s.CreatePendingPayouts(ctx, CompetitionEntityEvent, ev.ID, cur, rows)
}

func (s *CompetitionPrizeStore) buildEventPayoutRows(
	ctx context.Context, ev *HostedEvent, frozen float64, placements map[int]string, entryApproved string,
) ([]PendingPayoutInput, error) {
	mode := strings.TrimSpace(ev.PrizePayoutMode)
	enums, err := s.payoutEnums()
	if err != nil {
		return nil, err
	}
	placesMode := strings.TrimSpace(enums.CompetitionPayoutModePlacesPercent)
	scoreMode := strings.TrimSpace(enums.CompetitionPayoutModeScoreShare)
	dualMode := strings.TrimSpace(enums.CompetitionPayoutModeDualPurse)
	switch mode {
	case placesMode:
		percents, perr := PlacePercentsFromJSONBany(ev.PrizePlacePercents)
		if perr != nil {
			return nil, perr
		}
		return BuildPayoutRowsPlacesPercent(frozen, percents, placements), nil
	case scoreMode:
		scores, serr := s.eventScoreShareRows(ctx, ev, enums)
		if serr != nil {
			return nil, serr
		}
		return BuildPayoutRowsScoreShare(frozen, scores), nil
	case dualMode:
		percents, perr := PlacePercentsFromJSONBany(ev.PrizePlacePercents)
		if perr != nil {
			return nil, perr
		}
		placePct, derr := DualPursePlacePercent(enums)
		if derr != nil {
			return nil, derr
		}
		scores, serr := s.eventScoreShareRows(ctx, ev, enums)
		if serr != nil {
			return nil, serr
		}
		return BuildPayoutRowsDualPurse(frozen, placePct, percents, placements, scores), nil
	default:
		if ev.PrizePoolDisplayEnabled {
			return nil, fmt.Errorf("prize_payout_mode required for displayed prize pot")
		}
		pool := map[string]any{}
		if len(ev.Meta) > 0 {
			var meta map[string]any
			if json.Unmarshal(ev.Meta, &meta) == nil && meta != nil {
				if pp, ok := meta["prize_pool"].(map[string]any); ok {
					pool = pp
				}
			}
		}
		return buildPayoutRowsFromPool(pool, ev.PrizePoolFrozenAmount, placements), nil
	}
}

func (s *CompetitionPrizeStore) eventScoreShareRows(
	ctx context.Context, ev *HostedEvent, enums ClientEnumsConfig,
) ([]ScoreShareRow, error) {
	if ev == nil {
		return nil, nil
	}
	formatID := strings.TrimSpace(ev.FormatID)
	if formatID == strings.TrimSpace(enums.HostedEventArenaFormat) {
		standings, err := NewHostedEventStore(s.db).ListArenaStandings(ctx, ev.ID)
		if err != nil {
			return nil, err
		}
		out := make([]ScoreShareRow, 0, len(standings))
		for _, r := range standings {
			out = append(out, ScoreShareRow{UserID: r.UserID, Points: r.Points})
		}
		return out, nil
	}
	bst := HostedBracketStatuses{
		Pending: enums.HostedEventBracketPending,
		Ready:   enums.HostedEventBracketReady,
		Live:    enums.HostedEventBracketLive,
		Done:    enums.HostedEventBracketDone,
		Bye:     enums.HostedEventBracketBye,
	}
	ppw, err := StandingsPointsPerWin(enums)
	if err != nil {
		return nil, err
	}
	ppd, err := StandingsPointsPerDraw(enums)
	if err != nil {
		return nil, err
	}
	phaseFilter := StandingsPhaseFilterForFormat(enums, formatID)
	rows, err := NewHostedEventStore(s.db).ListStandings(ctx, ev.ID, bst, phaseFilter, ppw, ppd)
	if err != nil {
		return nil, err
	}
	out := make([]ScoreShareRow, 0, len(rows))
	for _, r := range rows {
		out = append(out, ScoreShareRow{UserID: r.UserID, Points: float64(r.Points)})
	}
	return out, nil
}

func (s *CompetitionPrizeStore) listEventPlacements(ctx context.Context, eventID, approved string) (map[int]string, error) {
	approved = strings.TrimSpace(approved)
	q := `
		SELECT user_id::text, placement FROM hosted_event_entries
		WHERE event_id = $1 AND placement IS NOT NULL`
	args := []any{eventID}
	if approved != "" {
		q += ` AND status = $2`
		args = append(args, approved)
	}
	rows, err := s.db.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int]string{}
	for rows.Next() {
		var uid string
		var place int
		if err := rows.Scan(&uid, &place); err != nil {
			return nil, err
		}
		out[place] = uid
	}
	return out, rows.Err()
}

func buildPayoutRowsFromPool(
	pool map[string]any,
	frozen *float64,
	placements map[int]string,
) []PendingPayoutInput {
	byPlace := PrizeAmountsByPlace(pool)
	if len(byPlace) == 0 {
		total := 0.0
		if frozen != nil {
			total = roundMoney2(*frozen)
		} else if pool != nil {
			if amt, ok := jsonAmount(pool["total"]); ok {
				total = amt
			}
		}
		if total > 0 {
			byPlace[1] = total
		}
	}
	if len(byPlace) == 0 || len(placements) == 0 {
		return nil
	}
	places := make([]int, 0, len(byPlace))
	for p := range byPlace {
		places = append(places, p)
	}
	sort.Ints(places)
	out := make([]PendingPayoutInput, 0, len(places))
	for _, place := range places {
		uid, ok := placements[place]
		if !ok || strings.TrimSpace(uid) == "" {
			continue
		}
		out = append(out, PendingPayoutInput{
			UserID:    uid,
			Placement: place,
			Amount:    byPlace[place],
		})
	}
	return out
}

// ViewerPrizeAmount is the viewer's escrowed/settled prize for one cup (My tournaments memory).
type ViewerPrizeAmount struct {
	Amount   float64
	Currency string
}

// ViewerPrizesAmong sums prize payout rows for the user across tournament entity ids.
func (s *CompetitionPrizeStore) ViewerPrizesAmong(ctx context.Context, userID string, tournamentIDs []string) (map[string]ViewerPrizeAmount, error) {
	out := map[string]ViewerPrizeAmount{}
	userID = strings.TrimSpace(userID)
	if !s.ready() || userID == "" || len(tournamentIDs) == 0 {
		return out, nil
	}
	ids := make([]string, 0, len(tournamentIDs))
	for _, id := range tournamentIDs {
		id = strings.TrimSpace(id)
		if id != "" {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT entity_id::text, COALESCE(SUM(amount), 0)::float8, COALESCE(MAX(currency), '')
		FROM competition_prize_payouts
		WHERE entity_kind = $1 AND user_id = $2::uuid AND entity_id = ANY($3::uuid[])
		GROUP BY entity_id
	`, CompetitionEntityTournament, userID, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var tid, currency string
		var amount float64
		if err := rows.Scan(&tid, &amount, &currency); err != nil {
			return nil, err
		}
		tid = strings.TrimSpace(tid)
		if tid == "" || amount <= 0 {
			continue
		}
		out[tid] = ViewerPrizeAmount{Amount: amount, Currency: strings.TrimSpace(currency)}
	}
	return out, rows.Err()
}

// CompetitionEntityRef is a finished cup that may still need prize escrow.
type CompetitionEntityRef struct {
	EntityKind string
	EntityID   string
}

// ListFinishedMissingEscrow returns paid finished cups with no payout rows and no dispute window.
// Includes Arena cups that finished before freeze (frozen amount still null) so callers can retry
// freeze+escrow. Idempotent CreatePendingPayouts / finishAfterBracket make retries safe.
func (s *CompetitionPrizeStore) ListFinishedMissingEscrow(ctx context.Context, arenaFormatID string) ([]CompetitionEntityRef, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	arenaFormatID = strings.TrimSpace(arenaFormatID)
	rows, err := s.db.Pool.Query(ctx, `
		SELECT 'tournament'::text AS entity_kind, t.id::text AS entity_id
		FROM tournaments t
		WHERE t.finished_at IS NOT NULL
		  AND t.is_free = false
		  AND t.prize_settled_at IS NULL
		  AND t.dispute_window_ends_at IS NULL
		  AND NOT EXISTS (
		    SELECT 1 FROM competition_prize_payouts p
		    WHERE p.entity_kind = 'tournament' AND p.entity_id = t.id
		  )
		  AND (
		    (t.prize_pool_frozen_amount IS NOT NULL AND t.prize_pool_frozen_amount > 0)
		    OR ($1 <> '' AND trim(t.format_id) = $1)
		  )
		UNION ALL
		SELECT 'event'::text, he.id::text
		FROM hosted_events he
		WHERE he.finished_at IS NOT NULL
		  AND he.is_free_entry = false
		  AND he.prize_settled_at IS NULL
		  AND he.dispute_window_ends_at IS NULL
		  AND NOT EXISTS (
		    SELECT 1 FROM competition_prize_payouts p
		    WHERE p.entity_kind = 'event' AND p.entity_id = he.id
		  )
		  AND (
		    (he.prize_pool_frozen_amount IS NOT NULL AND he.prize_pool_frozen_amount > 0)
		    OR ($1 <> '' AND trim(he.format_id) = $1)
		  )
		ORDER BY 1, 2
		LIMIT 50`, arenaFormatID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]CompetitionEntityRef, 0)
	for rows.Next() {
		var ref CompetitionEntityRef
		if err := rows.Scan(&ref.EntityKind, &ref.EntityID); err != nil {
			return nil, err
		}
		ref.EntityKind = strings.TrimSpace(ref.EntityKind)
		ref.EntityID = strings.TrimSpace(ref.EntityID)
		if ref.EntityKind == "" || ref.EntityID == "" {
			continue
		}
		out = append(out, ref)
	}
	return out, rows.Err()
}

// ListPendingDue returns pending payouts whose entity dispute window has elapsed.
func (s *CompetitionPrizeStore) ListPendingDue(ctx context.Context, now time.Time) ([]CompetitionPrizePayout, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	enums, err := s.payoutEnums()
	if err != nil {
		return nil, err
	}
	pending := enums.CompetitionPrizePayoutPending
	openReport := strings.TrimSpace(enums.HostedEventReportOpenStatus)
	rows, err := s.db.Pool.Query(ctx, `
		SELECT p.id::text, p.entity_kind, p.entity_id::text, p.user_id::text, p.placement,
		       p.amount, p.currency, p.status, p.ledger_tx_id::text, p.settled_at, p.created_at, p.updated_at,
		       COALESCE(t.title, he.title, '')
		FROM competition_prize_payouts p
		LEFT JOIN tournaments t ON p.entity_kind = 'tournament' AND p.entity_id = t.id
		LEFT JOIN hosted_events he ON p.entity_kind = 'event' AND p.entity_id = he.id
		WHERE p.status = $1
		  AND (
		    (p.entity_kind = 'tournament' AND t.dispute_window_ends_at IS NOT NULL AND t.dispute_window_ends_at <= $2)
		    OR
		    (p.entity_kind = 'event' AND he.dispute_window_ends_at IS NOT NULL AND he.dispute_window_ends_at <= $2)
		  )
		  AND NOT (
		    $3 <> ''
		    AND (
		      (p.entity_kind = 'tournament' AND EXISTS (
		        SELECT 1 FROM tournament_reports tr
		        WHERE tr.tournament_id = p.entity_id AND tr.status = $3
		      ))
		      OR
		      (p.entity_kind = 'event' AND EXISTS (
		        SELECT 1 FROM hosted_event_reports her
		        WHERE her.event_id = p.entity_id AND her.status = $3
		      ))
		    )
		  )
		ORDER BY p.created_at ASC`, pending, now.UTC(), openReport)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanPayoutRows(rows)
}

func scanPayoutRows(rows pgx.Rows) ([]CompetitionPrizePayout, error) {
	out := make([]CompetitionPrizePayout, 0)
	for rows.Next() {
		var p CompetitionPrizePayout
		var ledger *string
		var settled *time.Time
		if err := rows.Scan(
			&p.ID, &p.EntityKind, &p.EntityID, &p.UserID, &p.Placement,
			&p.Amount, &p.Currency, &p.Status, &ledger, &settled, &p.CreatedAt, &p.UpdatedAt,
			&p.EntityTitle,
		); err != nil {
			return nil, err
		}
		p.LedgerTxID, p.SettledAt = ledger, settled
		out = append(out, p)
	}
	return out, rows.Err()
}

// MarkPayoutFailed sets status failed (wallet credit did not complete).
func (s *CompetitionPrizeStore) MarkPayoutFailed(ctx context.Context, payoutID, failedStatus string) error {
	if !s.ready() {
		return errors.New("database unavailable")
	}
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE competition_prize_payouts SET status = $2, updated_at = NOW()
		WHERE id = $1 AND status <> $3`, payoutID, failedStatus, failedStatus)
	return err
}

// MarkPayoutSettled records ledger id and settled timestamp; marks entity prize_settled_at when all rows done.
func (s *CompetitionPrizeStore) MarkPayoutSettled(
	ctx context.Context,
	payoutID, settledStatus, pendingStatus, ledgerID string,
) error {
	if !s.ready() {
		return errors.New("database unavailable")
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var kind, entityID string
	if err := tx.QueryRow(ctx, `
		UPDATE competition_prize_payouts
		SET status = $2, ledger_tx_id = $3::uuid, settled_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND status = $4
		RETURNING entity_kind, entity_id::text`,
		payoutID, settledStatus, ledgerID, pendingStatus).Scan(&kind, &entityID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return tx.Commit(ctx)
		}
		return err
	}

	var remaining int
	if err := tx.QueryRow(ctx, `
		SELECT COUNT(*) FROM competition_prize_payouts
		WHERE entity_kind = $1 AND entity_id = $2 AND status = $3`,
		kind, entityID, pendingStatus).Scan(&remaining); err != nil {
		return err
	}
	if remaining == 0 {
		switch kind {
		case CompetitionEntityTournament:
			_, err = tx.Exec(ctx, `
				UPDATE tournaments SET prize_settled_at = NOW(), updated_at = NOW()
				WHERE id = $1 AND prize_settled_at IS NULL`, entityID)
		case CompetitionEntityEvent:
			_, err = tx.Exec(ctx, `
				UPDATE hosted_events SET prize_settled_at = NOW(), updated_at = NOW()
				WHERE id = $1 AND prize_settled_at IS NULL`, entityID)
		}
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
