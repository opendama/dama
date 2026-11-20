package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"dama/apps/api/internal/db"

	"github.com/jackc/pgx/v5"
)

var (
	ErrHostedEventNotFound     = errors.New("hosted event not found")
	ErrHostedEventConflict     = errors.New("hosted event conflict")
	ErrHostedEntryNotFound     = errors.New("hosted event entry not found")
	ErrHostedBracketNotFound   = errors.New("hosted bracket match not found")
	ErrHostedEventInvalidInput = errors.New("hosted event invalid input")
	ErrHostedNotEnoughPlayers  = errors.New("hosted event not enough players")
	ErrHostedAlreadyHasBracket = errors.New("hosted event already has bracket")
	ErrHostedReportNotFound    = errors.New("hosted event report not found")
	ErrHostedReportConflict    = errors.New("hosted event report conflict")
)

type HostedEvent struct {
	ID                         string          `json:"id"`
	OrganizerID                string          `json:"organizer_id"`
	Title                      string          `json:"title"`
	Description                string          `json:"description,omitempty"`
	FormatID                   string          `json:"format_id"`
	SizeID                     string          `json:"size_id"`
	MaxPlayers                 *int            `json:"max_players"`
	HostFeeAmount              float64         `json:"host_fee_amount"`
	HostFeeCurrency            string          `json:"host_fee_currency"`
	HostPaidAt                 time.Time       `json:"host_paid_at"`
	EntryFeeAmount             float64         `json:"entry_fee_amount"`
	EntryFeeCurrency           string          `json:"entry_fee_currency"`
	EntryFeeCommissionPercent  float64         `json:"entry_fee_commission_percent"`
	IsFreeEntry                bool            `json:"is_free_entry"`
	AutoApprove                bool            `json:"auto_approve"`
	Visibility                 string          `json:"visibility"`
	JoinCode                   string          `json:"join_code"`
	Status                     string          `json:"status"`
	PrizePoolDisplayEnabled    bool            `json:"prize_pool_display_enabled"`
	PrizePoolGuaranteeEnabled  bool            `json:"prize_pool_guarantee_enabled"`
	PrizePoolGuaranteeAmount   float64         `json:"prize_pool_guarantee_amount"`
	PrizePoolGuaranteeHeld     bool            `json:"prize_pool_guarantee_held"`
	PrizePoolGuaranteeCaptured bool            `json:"prize_pool_guarantee_captured"`
	PrizePoolGuaranteeCycle    int             `json:"prize_pool_guarantee_cycle"`
	PrizePoolFrozenAmount      *float64        `json:"prize_pool_frozen_amount,omitempty"`
	PrizePoolFrozenAt          *time.Time      `json:"prize_pool_frozen_at,omitempty"`
	LogoURL                    *string         `json:"logo_url,omitempty"`
	BrandColor                 *string         `json:"brand_color,omitempty"`
	SponsorLogoURL             *string         `json:"sponsor_logo_url,omitempty"`
	SponsorName                *string         `json:"sponsor_name,omitempty"`
	PrizeImageURL              string          `json:"prize_image_url,omitempty"`
	Gallery                    []string        `json:"gallery,omitempty"`
	WinnerID                   *string         `json:"winner_id,omitempty"`
	CheckInOpensAt             *time.Time      `json:"check_in_opens_at,omitempty"`
	CheckInClosesAt            *time.Time      `json:"check_in_closes_at,omitempty"`
	PrizeSettledAt             *time.Time      `json:"prize_settled_at,omitempty"`
	DisputeWindowEndsAt        *time.Time      `json:"dispute_window_ends_at,omitempty"`
	StartedAt                  *time.Time      `json:"started_at,omitempty"`
	FinishedAt                 *time.Time      `json:"finished_at,omitempty"`
	ArenaEndsAt                *time.Time      `json:"arena_ends_at,omitempty"`
	ArenaDurationMinutes       *int            `json:"arena_duration_minutes,omitempty"`
	PrizePayoutMode            string          `json:"prize_payout_mode,omitempty"`
	PrizePlacePercents         map[string]any  `json:"prize_place_percents,omitempty"`
	CancelledAt                *time.Time      `json:"cancelled_at,omitempty"`
	Meta                       json.RawMessage `json:"meta,omitempty"`
	CreatedAt                  time.Time       `json:"created_at"`
	UpdatedAt                  time.Time       `json:"updated_at"`
	ApprovedCount              int             `json:"approved_count,omitempty"`
	PendingCount               int             `json:"pending_count,omitempty"`
}

type HostedEventReport struct {
	ID               string     `json:"id"`
	EventID          string     `json:"event_id"`
	ReporterID       string     `json:"reporter_id"`
	ReasonCode       string     `json:"reason_code"`
	ReasonLabel      string     `json:"reason_label,omitempty"` // DB catalog label; not a column
	Note             string     `json:"note"`
	Status           string     `json:"status"`
	ReviewedBy       *string    `json:"reviewed_by,omitempty"`
	ReviewedAt       *time.Time `json:"reviewed_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	EventTitle       string     `json:"event_title,omitempty"`
	EventJoinCode    string     `json:"event_join_code,omitempty"`
	ReporterUsername string     `json:"reporter_username,omitempty"`
}

type HostedEventEntry struct {
	ID                 string     `json:"id"`
	EventID            string     `json:"event_id"`
	UserID             string     `json:"user_id"`
	Status             string     `json:"status"`
	Seed               *int       `json:"seed,omitempty"`
	Eliminated         bool       `json:"eliminated"`
	Placement          *int       `json:"placement,omitempty"`
	FeePaid            float64    `json:"fee_paid"`
	PlatformCommission float64    `json:"platform_commission"`
	OrganizerNet       float64    `json:"organizer_net"`
	FeeCurrency        string     `json:"fee_currency"`
	JoinedAt           time.Time  `json:"joined_at"`
	CheckedInAt        *time.Time `json:"checked_in_at,omitempty"`
	DecidedAt          *time.Time `json:"decided_at,omitempty"`
	Username           string     `json:"username,omitempty"`
	Rating             int        `json:"rating,omitempty"`
	StatusLabel        string     `json:"status_label,omitempty"` // DB label; not a column
}

type HostedBracketMatch struct {
	ID              string     `json:"id"`
	EventID         string     `json:"event_id"`
	Phase           string     `json:"phase"`
	GroupIndex      int        `json:"group_index"`
	RoundIndex      int        `json:"round_index"`
	MatchIndex      int        `json:"match_index"`
	PlayerAID       *string    `json:"player_a_id,omitempty"`
	PlayerBID       *string    `json:"player_b_id,omitempty"`
	WinnerID        *string    `json:"winner_id,omitempty"`
	PlayerAUsername string     `json:"player_a_username,omitempty"`
	PlayerBUsername string     `json:"player_b_username,omitempty"`
	WinnerUsername  string     `json:"winner_username,omitempty"`
	NextMatchID     *string    `json:"next_match_id,omitempty"`
	NextSlot        *string    `json:"next_slot,omitempty"`
	GameID          *string    `json:"game_id,omitempty"`
	Status          string     `json:"status"`
	StatusLabel     string     `json:"status_label,omitempty"` // DB label; not a column
	IsBye           bool       `json:"is_bye"`
	PlayerAReadyAt  *time.Time `json:"player_a_ready_at,omitempty"`
	PlayerBReadyAt  *time.Time `json:"player_b_ready_at,omitempty"`
	StartedAt       *time.Time `json:"started_at,omitempty"`
	FinishedAt      *time.Time `json:"finished_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// HostedStandingRow is computed standings for RR / Swiss / group stage (not a table row).
type HostedStandingRow struct {
	UserID     string `json:"user_id"`
	Username   string `json:"username,omitempty"`
	Played     int    `json:"played"`
	Wins       int    `json:"wins"`
	Losses     int    `json:"losses"`
	Points     int    `json:"points"`
	GroupIndex int    `json:"group_index,omitempty"`
	Placement  *int   `json:"placement,omitempty"`
}

// HostedBracketStatuses are DB enum values passed from client_enums (no Go invent).
type HostedBracketStatuses struct {
	Pending string
	Ready   string
	Live    string
	Done    string
	Bye     string
}

type HostedEventStatuses struct {
	Open      string
	Full      string
	Live      string
	Finished  string
	Cancelled string
}

type HostedEntryStatuses struct {
	Pending  string
	Approved string
	Rejected string
	Kicked   string
}

type CreateHostedEventInput struct {
	OrganizerID               string
	Title                     string
	Description               string
	FormatID                  string
	SizeID                    string
	MaxPlayers                *int
	HostFeeAmount             float64
	HostFeeCurrency           string
	EntryFeeAmount            float64
	EntryFeeCurrency          string
	EntryFeeCommissionPercent float64
	IsFreeEntry               bool
	AutoApprove               bool
	Visibility                string
	JoinCode                  string
	Status                    string
	BrandColor                *string
	PrizePoolDisplayEnabled   bool
	PrizePoolGuaranteeEnabled bool
	PrizePoolGuaranteeAmount  float64
	ArenaDurationMinutes      *int
	PrizePayoutMode           string
	PrizePlacePercents        map[string]any
}

type PatchHostedEventInput struct {
	Title              *string
	Description        *string
	Visibility         *string
	BrandColor         *string
	SponsorName        *string
	PrizePayoutMode    *string
	PrizePlacePercents map[string]any // nil = leave unchanged; empty map clears places when mode set
	SetPrizePayout     bool           // when true, apply PrizePayoutMode + PrizePlacePercents
}

type HostedOrganizerDashboard struct {
	ActiveCount           int
	UpcomingCount         int
	PlayersJoinedThisWeek int
	OfficiallyPausedCount int // live unfinished boards under official pause (engine)
	HostFeeRevenueSum     float64
	HostFeeCurrency       string  // single currency only; empty when mixed/absent
	EntryFeeRevenueSum    float64 // organizer net (backward compatible)
	EntryFeeGrossSum      float64
	EntryFeeCommissionSum float64
	EntryFeeCurrency      string // single currency only; empty when mixed/absent
	LastEventID           string
	LastEventJoinCode     string
}

type HostedEventAnalyticsRow struct {
	EventID            string
	Title              string
	Status             string
	JoinCode           string
	PlayersJoined      int
	Started            bool
	Finished           bool
	HostFee            float64
	HostFeeCurrency    string
	EntryFeesSum       float64 // gross
	EntryCommissionSum float64
	EntryNetSum        float64
	EntryFeeCurrency   string
}

type HostedOrganizerAnalytics struct {
	Events               []HostedEventAnalyticsRow
	TotalPlayersJoined   int
	TotalStarted         int
	TotalFinished        int
	TotalHostFeeSum      float64
	TotalEntryFeesSum    float64 // gross
	TotalEntryCommission float64
	TotalEntryNetSum     float64
	HostFeeCurrency      string // single currency only; empty when mixed/absent
	EntryFeeCurrency     string // single currency only; empty when mixed/absent
}

type HostedEventStore struct {
	db *db.Handle
}

func NewHostedEventStore(handle *db.Handle) *HostedEventStore {
	return &HostedEventStore{db: handle}
}

func (s *HostedEventStore) ready() bool {
	return s != nil && s.db != nil && s.db.Ready()
}

func scanHostedEvent(row pgx.Row) (*HostedEvent, error) {
	var e HostedEvent
	var logo, brand, sponsorLogo, sponsorName, winner *string
	var checkInOpens, checkInCloses, prizeSettled, disputeEnds, started, finished, cancelled, frozenAt, arenaEnds *time.Time
	var frozenAmount *float64
	var arenaDuration *int
	var meta, placePercentsRaw, galleryRaw []byte
	err := row.Scan(
		&e.ID, &e.OrganizerID, &e.Title, &e.Description, &e.FormatID, &e.SizeID, &e.MaxPlayers,
		&e.HostFeeAmount, &e.HostFeeCurrency, &e.HostPaidAt,
		&e.EntryFeeAmount, &e.EntryFeeCurrency, &e.EntryFeeCommissionPercent,
		&e.IsFreeEntry, &e.AutoApprove, &e.Visibility,
		&e.JoinCode, &e.Status,
		&e.PrizePoolDisplayEnabled, &e.PrizePoolGuaranteeEnabled, &e.PrizePoolGuaranteeAmount,
		&e.PrizePoolGuaranteeHeld, &e.PrizePoolGuaranteeCaptured, &e.PrizePoolGuaranteeCycle,
		&frozenAmount, &frozenAt,
		&logo, &brand, &sponsorLogo, &sponsorName, &e.PrizeImageURL, &galleryRaw, &winner,
		&checkInOpens, &checkInCloses, &prizeSettled, &disputeEnds,
		&started, &finished, &cancelled, &meta,
		&arenaEnds, &arenaDuration,
		&e.PrizePayoutMode, &placePercentsRaw,
		&e.CreatedAt, &e.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if e.PrizePoolGuaranteeCycle < 1 {
		e.PrizePoolGuaranteeCycle = 1
	}
	e.PrizePoolFrozenAmount, e.PrizePoolFrozenAt = frozenAmount, frozenAt
	e.LogoURL, e.BrandColor, e.SponsorLogoURL, e.SponsorName, e.WinnerID = logo, brand, sponsorLogo, sponsorName, winner
	e.CheckInOpensAt, e.CheckInClosesAt = checkInOpens, checkInCloses
	e.PrizeSettledAt, e.DisputeWindowEndsAt = prizeSettled, disputeEnds
	e.StartedAt, e.FinishedAt, e.CancelledAt = started, finished, cancelled
	e.ArenaEndsAt, e.ArenaDurationMinutes = arenaEnds, arenaDuration
	e.Gallery = []string{}
	_ = json.Unmarshal(galleryRaw, &e.Gallery)
	e.PrizePlacePercents = map[string]any{}
	_ = json.Unmarshal(placePercentsRaw, &e.PrizePlacePercents)
	if len(meta) > 0 {
		e.Meta = meta
	}
	return &e, nil
}

const hostedEventCols = `
	id, organizer_id, title, COALESCE(description,''), format_id, size_id, max_players,
	host_fee_amount, host_fee_currency, host_paid_at,
	entry_fee_amount, entry_fee_currency, entry_fee_commission_percent,
	is_free_entry, auto_approve, visibility,
	join_code, status,
	prize_pool_display_enabled, prize_pool_guarantee_enabled, prize_pool_guarantee_amount,
	prize_pool_guarantee_held, prize_pool_guarantee_captured, prize_pool_guarantee_cycle,
	prize_pool_frozen_amount, prize_pool_frozen_at,
	logo_url, brand_color, sponsor_logo_url, sponsor_name,
	COALESCE(prize_image_url,''), COALESCE(gallery,'[]'::jsonb), winner_id,
	check_in_opens_at, check_in_closes_at, prize_settled_at, dispute_window_ends_at,
	started_at, finished_at, cancelled_at, meta,
	arena_ends_at, arena_duration_minutes,
	COALESCE(prize_payout_mode,''), COALESCE(prize_place_percents,'{}'::jsonb),
	created_at, updated_at`

func hostedEventColsAliased(alias string) string {
	alias = strings.TrimSpace(alias)
	if alias == "" {
		return hostedEventCols
	}
	// Keep SELECT expression order identical to hostedEventCols / scanHostedEvent.
	out := make([]string, 0, 48)
	out = append(out,
		alias+".id",
		alias+".organizer_id",
		alias+".title",
		"COALESCE("+alias+".description,'')",
		alias+".format_id",
		alias+".size_id",
		alias+".max_players",
		alias+".host_fee_amount",
		alias+".host_fee_currency",
		alias+".host_paid_at",
		alias+".entry_fee_amount",
		alias+".entry_fee_currency",
		alias+".entry_fee_commission_percent",
		alias+".is_free_entry",
		alias+".auto_approve",
		alias+".visibility",
		alias+".join_code",
		alias+".status",
		alias+".prize_pool_display_enabled",
		alias+".prize_pool_guarantee_enabled",
		alias+".prize_pool_guarantee_amount",
		alias+".prize_pool_guarantee_held",
		alias+".prize_pool_guarantee_captured",
		alias+".prize_pool_guarantee_cycle",
		alias+".prize_pool_frozen_amount",
		alias+".prize_pool_frozen_at",
		alias+".logo_url",
		alias+".brand_color",
		alias+".sponsor_logo_url",
		alias+".sponsor_name",
		"COALESCE("+alias+".prize_image_url,'')",
		"COALESCE("+alias+".gallery,'[]'::jsonb)",
		alias+".winner_id",
		alias+".check_in_opens_at",
		alias+".check_in_closes_at",
		alias+".prize_settled_at",
		alias+".dispute_window_ends_at",
		alias+".started_at",
		alias+".finished_at",
		alias+".cancelled_at",
		alias+".meta",
		alias+".arena_ends_at",
		alias+".arena_duration_minutes",
		"COALESCE("+alias+".prize_payout_mode,'')",
		"COALESCE("+alias+".prize_place_percents,'{}'::jsonb)",
		alias+".created_at",
		alias+".updated_at",
	)
	return strings.Join(out, ", ")
}

type hostedEventQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func (s *HostedEventStore) Create(ctx context.Context, in CreateHostedEventInput) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	return s.createOn(ctx, s.db.Pool, in)
}

// CreateTx inserts a hosted event on an open transaction (create escrow atomic path).
func (s *HostedEventStore) CreateTx(ctx context.Context, tx hostedEventQuerier, in CreateHostedEventInput) (*HostedEvent, error) {
	if !s.ready() || tx == nil {
		return nil, errors.New("database unavailable")
	}
	return s.createOn(ctx, tx, in)
}

func (s *HostedEventStore) createOn(ctx context.Context, q hostedEventQuerier, in CreateHostedEventInput) (*HostedEvent, error) {
	if strings.TrimSpace(in.Title) == "" || strings.TrimSpace(in.JoinCode) == "" {
		return nil, ErrHostedEventInvalidInput
	}
	vis := strings.TrimSpace(in.Visibility)
	if vis == "" {
		return nil, ErrHostedEventInvalidInput
	}
	percents := in.PrizePlacePercents
	if percents == nil {
		percents = map[string]any{}
	}
	percentsJSON, err := json.Marshal(percents)
	if err != nil {
		return nil, ErrHostedEventInvalidInput
	}
	row := q.QueryRow(ctx, `
		INSERT INTO hosted_events (
			organizer_id, title, description, format_id, size_id, max_players,
			host_fee_amount, host_fee_currency, host_paid_at,
			entry_fee_amount, entry_fee_currency, entry_fee_commission_percent,
			is_free_entry, auto_approve, visibility,
			join_code, status, brand_color,
			prize_pool_display_enabled, prize_pool_guarantee_enabled, prize_pool_guarantee_amount,
			arena_duration_minutes, prize_payout_mode, prize_place_percents
		) VALUES (
			$1,$2,$3,$4,$5,$6,
			$7,$8,NOW(),
			$9,$10,$11,
			$12,$13,$14,
			$15,$16,$17,
			$18,$19,$20,
			$21,$22,$23::jsonb
		)
		RETURNING `+hostedEventCols, in.OrganizerID, strings.TrimSpace(in.Title), strings.TrimSpace(in.Description),
		in.FormatID, in.SizeID, in.MaxPlayers,
		in.HostFeeAmount, in.HostFeeCurrency,
		in.EntryFeeAmount, in.EntryFeeCurrency, in.EntryFeeCommissionPercent,
		in.IsFreeEntry, in.AutoApprove, vis,
		strings.ToUpper(strings.TrimSpace(in.JoinCode)), in.Status, in.BrandColor,
		in.PrizePoolDisplayEnabled, in.PrizePoolGuaranteeEnabled, in.PrizePoolGuaranteeAmount,
		in.ArenaDurationMinutes, strings.TrimSpace(in.PrizePayoutMode), string(percentsJSON),
	)
	return scanHostedEvent(row)
}

func (s *HostedEventStore) Get(ctx context.Context, id string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	e, err := scanHostedEvent(s.db.Pool.QueryRow(ctx, `SELECT `+hostedEventCols+` FROM hosted_events WHERE id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEventNotFound
	}
	if err != nil {
		return nil, err
	}
	return e, nil
}

func (s *HostedEventStore) GetByJoinCode(ctx context.Context, code string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	code = strings.ToUpper(strings.TrimSpace(code))
	e, err := scanHostedEvent(s.db.Pool.QueryRow(ctx, `
		SELECT `+hostedEventCols+` FROM hosted_events WHERE upper(trim(join_code)) = $1`, code))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEventNotFound
	}
	if err != nil {
		return nil, err
	}
	return e, nil
}

func (s *HostedEventStore) JoinCodeExists(ctx context.Context, code string) (bool, error) {
	if !s.ready() {
		return false, errors.New("database unavailable")
	}
	var n int
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(1) FROM hosted_events WHERE upper(trim(join_code)) = $1`,
		strings.ToUpper(strings.TrimSpace(code))).Scan(&n)
	return n > 0, err
}

func (s *HostedEventStore) AttachEntryCounts(ctx context.Context, e *HostedEvent, approvedStatus, pendingStatus string) error {
	if e == nil || !s.ready() {
		return nil
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT status, COUNT(*)::int FROM hosted_event_entries WHERE event_id = $1 GROUP BY status`, e.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var st string
		var n int
		if err := rows.Scan(&st, &n); err != nil {
			return err
		}
		if approvedStatus != "" && st == approvedStatus {
			e.ApprovedCount = n
		}
		if pendingStatus != "" && st == pendingStatus {
			e.PendingCount = n
		}
	}
	return rows.Err()
}

func (s *HostedEventStore) CountByStatus(ctx context.Context, eventID, status string) (int, error) {
	if !s.ready() {
		return 0, errors.New("database unavailable")
	}
	var n int
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM hosted_event_entries WHERE event_id = $1 AND status = $2`,
		eventID, status).Scan(&n)
	return n, err
}

// CountOpenPaidByOrganizer counts unpaid-entry=false cups that are not finished/cancelled.
// finishedStatus and cancelledStatus must come from client_enums (fail closed if empty).
func (s *HostedEventStore) CountOpenPaidByOrganizer(ctx context.Context, organizerID, finishedStatus, cancelledStatus string) (int, error) {
	if !s.ready() {
		return 0, errors.New("database unavailable")
	}
	organizerID = strings.TrimSpace(organizerID)
	finishedStatus = strings.TrimSpace(finishedStatus)
	cancelledStatus = strings.TrimSpace(cancelledStatus)
	if organizerID == "" || finishedStatus == "" || cancelledStatus == "" {
		return 0, errors.New("open paid count requires organizer and terminal statuses")
	}
	var n int
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM hosted_events
		WHERE organizer_id = $1
		  AND is_free_entry = false
		  AND status <> $2
		  AND status <> $3`,
		organizerID, finishedStatus, cancelledStatus).Scan(&n)
	return n, err
}

// CountSettledPaidByOrganizer counts finished paid cups for first-time host progression.
func (s *HostedEventStore) CountSettledPaidByOrganizer(ctx context.Context, organizerID, finishedStatus string) (int, error) {
	if !s.ready() {
		return 0, errors.New("database unavailable")
	}
	organizerID = strings.TrimSpace(organizerID)
	finishedStatus = strings.TrimSpace(finishedStatus)
	if organizerID == "" || finishedStatus == "" {
		return 0, errors.New("settled paid count requires organizer and finished status")
	}
	var n int
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM hosted_events
		WHERE organizer_id = $1
		  AND is_free_entry = false
		  AND status = $2`,
		organizerID, finishedStatus).Scan(&n)
	return n, err
}

// HostedEventConsoleRow is a platform-wide cup row for the admin events Ops table.
type HostedEventConsoleRow struct {
	HostedEvent
	OrganizerUsername string `json:"organizer_username"`
}

type hostedEventScanner interface {
	Scan(dest ...any) error
}

func scanHostedEventConsole(row hostedEventScanner) (*HostedEventConsoleRow, error) {
	var e HostedEvent
	var logo, brand, sponsorLogo, sponsorName, winner *string
	var checkInOpens, checkInCloses, prizeSettled, disputeEnds, started, finished, cancelled, frozenAt, arenaEnds *time.Time
	var frozenAmount *float64
	var arenaDuration *int
	var meta, placePercentsRaw, galleryRaw []byte
	var orgName string
	// Column order must match hostedEventColsAliased + organizer username.
	err := row.Scan(
		&e.ID, &e.OrganizerID, &e.Title, &e.Description, &e.FormatID, &e.SizeID, &e.MaxPlayers,
		&e.HostFeeAmount, &e.HostFeeCurrency, &e.HostPaidAt,
		&e.EntryFeeAmount, &e.EntryFeeCurrency, &e.EntryFeeCommissionPercent,
		&e.IsFreeEntry, &e.AutoApprove, &e.Visibility,
		&e.JoinCode, &e.Status,
		&e.PrizePoolDisplayEnabled, &e.PrizePoolGuaranteeEnabled, &e.PrizePoolGuaranteeAmount,
		&e.PrizePoolGuaranteeHeld, &e.PrizePoolGuaranteeCaptured, &e.PrizePoolGuaranteeCycle,
		&frozenAmount, &frozenAt,
		&logo, &brand, &sponsorLogo, &sponsorName, &e.PrizeImageURL, &galleryRaw, &winner,
		&checkInOpens, &checkInCloses, &prizeSettled, &disputeEnds,
		&started, &finished, &cancelled, &meta,
		&arenaEnds, &arenaDuration,
		&e.PrizePayoutMode, &placePercentsRaw,
		&e.CreatedAt, &e.UpdatedAt,
		&orgName,
	)
	if err != nil {
		return nil, err
	}
	if e.PrizePoolGuaranteeCycle < 1 {
		e.PrizePoolGuaranteeCycle = 1
	}
	e.PrizePoolFrozenAmount, e.PrizePoolFrozenAt = frozenAmount, frozenAt
	e.LogoURL, e.BrandColor, e.SponsorLogoURL, e.SponsorName, e.WinnerID = logo, brand, sponsorLogo, sponsorName, winner
	e.CheckInOpensAt, e.CheckInClosesAt = checkInOpens, checkInCloses
	e.PrizeSettledAt, e.DisputeWindowEndsAt = prizeSettled, disputeEnds
	e.StartedAt, e.FinishedAt, e.CancelledAt = started, finished, cancelled
	e.ArenaEndsAt, e.ArenaDurationMinutes = arenaEnds, arenaDuration
	e.Gallery = []string{}
	_ = json.Unmarshal(galleryRaw, &e.Gallery)
	e.PrizePlacePercents = map[string]any{}
	_ = json.Unmarshal(placePercentsRaw, &e.PrizePlacePercents)
	if len(meta) > 0 {
		e.Meta = meta
	}
	return &HostedEventConsoleRow{HostedEvent: e, OrganizerUsername: orgName}, nil
}

// GetConsole returns one hosted event with organizer username for admin deep-links.
func (s *HostedEventStore) GetConsole(ctx context.Context, id string) (*HostedEventConsoleRow, error) {
	id = strings.TrimSpace(id)
	if id == "" || !s.ready() {
		return nil, ErrHostedEventNotFound
	}
	row, err := scanHostedEventConsole(s.db.Pool.QueryRow(ctx, `
		SELECT `+hostedEventColsAliased("e")+`,
			COALESCE(u.username, '')
		FROM hosted_events e
		LEFT JOIN users u ON u.id = e.organizer_id
		WHERE e.id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEventNotFound
	}
	return row, err
}

// ListConsole returns all hosted events newest-first (admin ops / lifecycle deep-links).
func (s *HostedEventStore) ListConsole(ctx context.Context, skip, limit int, filter HostedEventListFilter) ([]HostedEventConsoleRow, int, error) {
	if !s.ready() {
		return nil, 0, errors.New("database unavailable")
	}
	where := make([]string, 0, 3)
	args := make([]any, 0, 5)
	argN := 1
	if filter.IsFreeEntry != nil {
		where = append(where, fmt.Sprintf("e.is_free_entry = $%d", argN))
		args = append(args, *filter.IsFreeEntry)
		argN++
	}
	q := strings.TrimSpace(filter.Q)
	if q != "" {
		where = append(where, fmt.Sprintf("(e.title ILIKE $%d OR e.join_code ILIKE $%d)", argN, argN))
		args = append(args, "%"+q+"%")
		argN++
	}
	status := strings.TrimSpace(filter.Status)
	if status != "" {
		where = append(where, fmt.Sprintf("e.status = $%d", argN))
		args = append(args, status)
		argN++
	}
	whereSQL := ""
	if len(where) > 0 {
		whereSQL = " WHERE " + strings.Join(where, " AND ")
	}
	var total int
	if err := s.db.Pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM hosted_events e`+whereSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	listArgs := append(append([]any{}, args...), skip, limit)
	rows, err := s.db.Pool.Query(ctx, `
		SELECT `+hostedEventColsAliased("e")+`,
			COALESCE(u.username, '')
		FROM hosted_events e
		LEFT JOIN users u ON u.id = e.organizer_id`+whereSQL+`
		ORDER BY e.created_at DESC
		OFFSET $`+fmt.Sprintf("%d", argN)+` LIMIT $`+fmt.Sprintf("%d", argN+1), listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := make([]HostedEventConsoleRow, 0)
	for rows.Next() {
		row, err := scanHostedEventConsole(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, *row)
	}
	return out, total, rows.Err()
}

func (s *HostedEventStore) ListByOrganizer(ctx context.Context, organizerID string, skip, limit int, filter HostedEventListFilter) ([]HostedEvent, int, error) {
	if !s.ready() {
		return nil, 0, errors.New("database unavailable")
	}
	where := []string{"organizer_id = $1"}
	args := []any{organizerID}
	argN := 2
	if filter.IsFreeEntry != nil {
		where = append(where, fmt.Sprintf("is_free_entry = $%d", argN))
		args = append(args, *filter.IsFreeEntry)
		argN++
	}
	q := strings.TrimSpace(filter.Q)
	if q != "" {
		where = append(where, fmt.Sprintf("(title ILIKE $%d OR join_code ILIKE $%d)", argN, argN))
		args = append(args, "%"+q+"%")
		argN++
	}
	status := strings.TrimSpace(filter.Status)
	if status != "" {
		where = append(where, fmt.Sprintf("status = $%d", argN))
		args = append(args, status)
		argN++
	}
	whereSQL := strings.Join(where, " AND ")
	var total int
	if err := s.db.Pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM hosted_events WHERE `+whereSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	listArgs := append(append([]any{}, args...), skip, limit)
	rows, err := s.db.Pool.Query(ctx, `
		SELECT `+hostedEventCols+` FROM hosted_events
		WHERE `+whereSQL+`
		ORDER BY created_at DESC
		OFFSET $`+fmt.Sprintf("%d", argN)+` LIMIT $`+fmt.Sprintf("%d", argN+1), listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := make([]HostedEvent, 0)
	for rows.Next() {
		e, err := scanHostedEvent(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, *e)
	}
	return out, total, rows.Err()
}

func (s *HostedEventStore) ListJoinedByUser(ctx context.Context, userID string, skip, limit int) ([]HostedEvent, int, error) {
	if !s.ready() {
		return nil, 0, errors.New("database unavailable")
	}
	var total int
	if err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM hosted_event_entries WHERE user_id = $1`, userID).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT `+hostedEventColsAliased("e")+`
		FROM hosted_events e
		INNER JOIN hosted_event_entries en ON en.event_id = e.id
		WHERE en.user_id = $1
		ORDER BY en.joined_at DESC
		OFFSET $2 LIMIT $3`, userID, skip, limit)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := make([]HostedEvent, 0)
	for rows.Next() {
		ev, err := scanHostedEvent(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, *ev)
	}
	return out, total, rows.Err()
}

func (s *HostedEventStore) SetStatus(ctx context.Context, id, status string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	row := s.db.Pool.QueryRow(ctx, `
		UPDATE hosted_events SET status = $2, updated_at = NOW()
		WHERE id = $1
		RETURNING `+hostedEventCols, id, status)
	e, err := scanHostedEvent(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEventNotFound
	}
	return e, err
}

func (s *HostedEventStore) Patch(ctx context.Context, id string, in PatchHostedEventInput) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	cur, err := s.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	title := cur.Title
	if in.Title != nil {
		title = strings.TrimSpace(*in.Title)
		if title == "" {
			return nil, ErrHostedEventInvalidInput
		}
	}
	description := cur.Description
	if in.Description != nil {
		description = strings.TrimSpace(*in.Description)
	}
	visibility := cur.Visibility
	if in.Visibility != nil {
		visibility = strings.TrimSpace(*in.Visibility)
		if visibility == "" {
			return nil, ErrHostedEventInvalidInput
		}
	}
	brand := cur.BrandColor
	if in.BrandColor != nil {
		v := strings.TrimSpace(*in.BrandColor)
		if v == "" {
			brand = nil
		} else {
			brand = &v
		}
	}
	sponsor := cur.SponsorName
	if in.SponsorName != nil {
		v := strings.TrimSpace(*in.SponsorName)
		if v == "" {
			sponsor = nil
		} else {
			sponsor = &v
		}
	}
	payoutMode := cur.PrizePayoutMode
	percents := cur.PrizePlacePercents
	if percents == nil {
		percents = map[string]any{}
	}
	if in.SetPrizePayout {
		if in.PrizePayoutMode != nil {
			payoutMode = strings.TrimSpace(*in.PrizePayoutMode)
		} else {
			payoutMode = ""
		}
		if in.PrizePlacePercents != nil {
			percents = in.PrizePlacePercents
		} else {
			percents = map[string]any{}
		}
	}
	percentsJSON, err := json.Marshal(percents)
	if err != nil {
		return nil, err
	}
	// Product: auto_approve is always true (client cannot disable).
	row := s.db.Pool.QueryRow(ctx, `
		UPDATE hosted_events
		SET title = $2, description = $3, auto_approve = TRUE, visibility = $4, brand_color = $5, sponsor_name = $6,
		    prize_payout_mode = $7, prize_place_percents = $8::jsonb, updated_at = NOW()
		WHERE id = $1
		RETURNING `+hostedEventCols, id, title, description, visibility, brand, sponsor, payoutMode, string(percentsJSON))
	e, err := scanHostedEvent(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEventNotFound
	}
	return e, err
}

// OrganizerPublicCard is fail-closed host presence for public browse/detail cards.
type OrganizerPublicCard struct {
	Username            string `json:"username"`
	AvatarThumbURL      string `json:"avatar_thumb_url,omitempty"`
	Rating              int    `json:"rating"`
	PhoneKycVerified    bool   `json:"phone_kyc_verified"`
	DocumentKycVerified bool   `json:"document_kyc_verified"`
	FinishedPaidCups    int    `json:"finished_paid_cups"`
	CancelledPaidCups   int    `json:"cancelled_paid_cups"`
	OpenReports         int    `json:"open_reports"`
}

// HostReputation is DB-derived host ops stats for lobby visibility and create gates.
type HostReputation struct {
	FinishedPaidCups  int
	CancelledPaidCups int
	OpenReports       int
}

// MapOrganizerPublicCards loads username/avatar/rating/KYC stamps for organizer ids (one query).
func (s *HostedEventStore) MapOrganizerPublicCards(ctx context.Context, organizerIDs []string) (map[string]OrganizerPublicCard, error) {
	out := map[string]OrganizerPublicCard{}
	if !s.ready() || len(organizerIDs) == 0 {
		return out, nil
	}
	seen := map[string]bool{}
	ids := make([]string, 0, len(organizerIDs))
	for _, id := range organizerIDs {
		id = strings.TrimSpace(id)
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, COALESCE(username, ''), COALESCE(avatar_thumb_url, ''), COALESCE(rating, 0),
		       (phone_kyc_verified_at IS NOT NULL), (document_kyc_verified_at IS NOT NULL)
		FROM users WHERE id = ANY($1::uuid[])`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id, username, avatar string
		var rating int
		var phoneOK, docOK bool
		if err := rows.Scan(&id, &username, &avatar, &rating, &phoneOK, &docOK); err != nil {
			return nil, err
		}
		out[id] = OrganizerPublicCard{
			Username:            username,
			AvatarThumbURL:      avatar,
			Rating:              rating,
			PhoneKycVerified:    phoneOK,
			DocumentKycVerified: docOK,
		}
	}
	return out, rows.Err()
}

// MapHostReputation loads finished/cancelled paid cup counts and open report counts per organizer.
// Status strings must come from client_enums (fail closed if empty).
func (s *HostedEventStore) MapHostReputation(
	ctx context.Context,
	organizerIDs []string,
	finishedStatus, cancelledStatus, openReportStatus string,
) (map[string]HostReputation, error) {
	out := map[string]HostReputation{}
	if !s.ready() || len(organizerIDs) == 0 {
		return out, nil
	}
	finishedStatus = strings.TrimSpace(finishedStatus)
	cancelledStatus = strings.TrimSpace(cancelledStatus)
	openReportStatus = strings.TrimSpace(openReportStatus)
	if finishedStatus == "" || cancelledStatus == "" || openReportStatus == "" {
		return nil, errors.New("host reputation requires finished, cancelled, and open report statuses")
	}
	seen := map[string]bool{}
	ids := make([]string, 0, len(organizerIDs))
	for _, id := range organizerIDs {
		id = strings.TrimSpace(id)
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return out, nil
	}
	for _, id := range ids {
		out[id] = HostReputation{}
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT organizer_id::text,
		       COUNT(*) FILTER (WHERE is_free_entry = false AND status = $2)::int,
		       COUNT(*) FILTER (WHERE is_free_entry = false AND status = $3)::int
		FROM hosted_events
		WHERE organizer_id = ANY($1::uuid[])
		GROUP BY organizer_id`, ids, finishedStatus, cancelledStatus)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var finished, cancelled int
		if err := rows.Scan(&id, &finished, &cancelled); err != nil {
			return nil, err
		}
		r := out[id]
		r.FinishedPaidCups = finished
		r.CancelledPaidCups = cancelled
		out[id] = r
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	repRows, err := s.db.Pool.Query(ctx, `
		SELECT e.organizer_id::text, COUNT(*)::int
		FROM hosted_event_reports r
		INNER JOIN hosted_events e ON e.id = r.event_id
		WHERE e.organizer_id = ANY($1::uuid[])
		  AND r.status = $2
		GROUP BY e.organizer_id`, ids, openReportStatus)
	if err != nil {
		return nil, err
	}
	defer repRows.Close()
	for repRows.Next() {
		var id string
		var openN int
		if err := repRows.Scan(&id, &openN); err != nil {
			return nil, err
		}
		r := out[id]
		r.OpenReports = openN
		out[id] = r
	}
	return out, repRows.Err()
}

// MergeHostReputation stamps reputation fields onto organizer public cards (in place).
func MergeHostReputation(cards map[string]OrganizerPublicCard, reps map[string]HostReputation) {
	if cards == nil || reps == nil {
		return
	}
	for id, rep := range reps {
		c, ok := cards[id]
		if !ok {
			continue
		}
		c.FinishedPaidCups = rep.FinishedPaidCups
		c.CancelledPaidCups = rep.CancelledPaidCups
		c.OpenReports = rep.OpenReports
		cards[id] = c
	}
}

// ListPublic returns public-visibility events in the given statuses (paginated).
// publicVisibility must come from client_enums (HostedEventPublicVisibility); never invent.
// HostedEventListFilter is server-side public/organizer/console list filtering.
type HostedEventListFilter struct {
	IsFreeEntry *bool
	Q           string
	// Status empty = all; otherwise exact status match.
	Status string
	// Lifecycle: open | live | finished (timestamp-based; empty = no lifecycle clause).
	Lifecycle string
	// MineUserID: when set, only cups this user has a hosted_event_entries row for.
	MineUserID string
}

func (s *HostedEventStore) ListPublic(ctx context.Context, skip, limit int, statuses []string, publicVisibility string, filter HostedEventListFilter) ([]HostedEvent, int, error) {
	if !s.ready() {
		return nil, 0, errors.New("database unavailable")
	}
	publicVisibility = strings.TrimSpace(publicVisibility)
	if len(statuses) == 0 || publicVisibility == "" {
		return []HostedEvent{}, 0, nil
	}
	mineUID := strings.TrimSpace(filter.MineUserID)
	where := []string{"e.visibility = $2", "e.status = ANY($1::text[])"}
	args := []any{statuses, publicVisibility}
	argN := 3
	fromSQL := `hosted_events e`
	if mineUID != "" {
		fromSQL = `hosted_events e INNER JOIN hosted_event_entries en ON en.event_id = e.id AND en.user_id = $` + fmt.Sprintf("%d", argN) + `::uuid`
		args = append(args, mineUID)
		argN++
	}
	st := strings.TrimSpace(filter.Status)
	if st != "" {
		where = append(where, fmt.Sprintf("e.status = $%d", argN))
		args = append(args, st)
		argN++
	}
	switch strings.ToLower(strings.TrimSpace(filter.Lifecycle)) {
	case "open":
		where = append(where, "e.started_at IS NULL AND e.finished_at IS NULL")
	case "live":
		where = append(where, "e.started_at IS NOT NULL AND e.finished_at IS NULL")
	case "finished":
		where = append(where, "e.finished_at IS NOT NULL")
	}
	if filter.IsFreeEntry != nil {
		where = append(where, fmt.Sprintf("e.is_free_entry = $%d", argN))
		args = append(args, *filter.IsFreeEntry)
		argN++
	}
	q := strings.TrimSpace(filter.Q)
	if q != "" {
		where = append(where, fmt.Sprintf("e.title ILIKE $%d", argN))
		args = append(args, "%"+q+"%")
		argN++
	}
	whereSQL := strings.Join(where, " AND ")
	var total int
	if err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM `+fromSQL+` WHERE `+whereSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	listArgs := append(append([]any{}, args...), skip, limit)
	rows, err := s.db.Pool.Query(ctx, `
		SELECT `+hostedEventColsAliased("e")+` FROM `+fromSQL+`
		WHERE `+whereSQL+`
		ORDER BY e.created_at DESC
		OFFSET $`+fmt.Sprintf("%d", argN)+` LIMIT $`+fmt.Sprintf("%d", argN+1), listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := make([]HostedEvent, 0)
	for rows.Next() {
		e, err := scanHostedEvent(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, *e)
	}
	return out, total, rows.Err()
}

// CountNonOrganizerEntries counts entries whose user_id is not the organizer.
func (s *HostedEventStore) CountNonOrganizerEntries(ctx context.Context, eventID, organizerID string) (int, error) {
	if !s.ready() {
		return 0, errors.New("database unavailable")
	}
	var n int
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM hosted_event_entries
		WHERE event_id = $1 AND user_id <> $2`, eventID, organizerID).Scan(&n)
	return n, err
}

func (s *HostedEventStore) ListEntryUserIDs(ctx context.Context, eventID string) ([]string, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT user_id FROM hosted_event_entries WHERE event_id = $1 ORDER BY joined_at ASC`, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]string, 0)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func (s *HostedEventStore) SetLogoURL(ctx context.Context, id, url string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	row := s.db.Pool.QueryRow(ctx, `
		UPDATE hosted_events SET logo_url = $2, updated_at = NOW()
		WHERE id = $1
		RETURNING `+hostedEventCols, id, strings.TrimSpace(url))
	e, err := scanHostedEvent(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEventNotFound
	}
	return e, err
}

func (s *HostedEventStore) SetSponsorLogoURL(ctx context.Context, id, url string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	row := s.db.Pool.QueryRow(ctx, `
		UPDATE hosted_events SET sponsor_logo_url = $2, updated_at = NOW()
		WHERE id = $1
		RETURNING `+hostedEventCols, id, strings.TrimSpace(url))
	e, err := scanHostedEvent(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEventNotFound
	}
	return e, err
}

// SetPrizeImage sets hosted_events.prize_image_url from an uploaded media URL.
func (s *HostedEventStore) SetPrizeImage(ctx context.Context, id, prizeImageURL string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	prizeImageURL = strings.TrimSpace(prizeImageURL)
	if prizeImageURL == "" {
		return nil, ErrHostedEventInvalidInput
	}
	row := s.db.Pool.QueryRow(ctx, `
		UPDATE hosted_events SET prize_image_url = $2, updated_at = NOW()
		WHERE id = $1
		RETURNING `+hostedEventCols, id, prizeImageURL)
	e, err := scanHostedEvent(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEventNotFound
	}
	return e, err
}

// ClearPrizeImage clears hosted_events.prize_image_url.
func (s *HostedEventStore) ClearPrizeImage(ctx context.Context, id string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	row := s.db.Pool.QueryRow(ctx, `
		UPDATE hosted_events SET prize_image_url = NULL, updated_at = NOW()
		WHERE id = $1
		RETURNING `+hostedEventCols, id)
	e, err := scanHostedEvent(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEventNotFound
	}
	return e, err
}

// AppendGallery appends one media URL to hosted_events.gallery.
func (s *HostedEventStore) AppendGallery(ctx context.Context, id, imageURL string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	imageURL = strings.TrimSpace(imageURL)
	if imageURL == "" {
		return nil, ErrHostedEventInvalidInput
	}
	cur, err := s.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	n := 0
	for _, u := range cur.Gallery {
		if strings.TrimSpace(u) != "" {
			n++
		}
	}
	if n >= MaxEntityGalleryImages {
		return nil, ErrGalleryFull
	}
	tag, err := s.db.Pool.Exec(ctx, `
		UPDATE hosted_events
		SET gallery = COALESCE(gallery, '[]'::jsonb) || to_jsonb($2::text), updated_at = NOW()
		WHERE id = $1
		  AND jsonb_array_length(COALESCE(gallery, '[]'::jsonb)) < $3
	`, id, imageURL, MaxEntityGalleryImages)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		again, gerr := s.Get(ctx, id)
		if gerr != nil {
			return nil, ErrHostedEventNotFound
		}
		filled := 0
		for _, u := range again.Gallery {
			if strings.TrimSpace(u) != "" {
				filled++
			}
		}
		if filled >= MaxEntityGalleryImages {
			return nil, ErrGalleryFull
		}
		return nil, ErrHostedEventNotFound
	}
	return s.Get(ctx, id)
}

// UpdateGallery replaces hosted_events.gallery (used to remove a slot).
func (s *HostedEventStore) UpdateGallery(ctx context.Context, id string, gallery []string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	if gallery == nil {
		gallery = []string{}
	}
	clean := make([]string, 0, len(gallery))
	for _, u := range gallery {
		u = strings.TrimSpace(u)
		if u != "" {
			clean = append(clean, u)
		}
	}
	if len(clean) > MaxEntityGalleryImages {
		return nil, ErrGalleryFull
	}
	raw, err := json.Marshal(clean)
	if err != nil {
		return nil, fmt.Errorf("gallery invalid")
	}
	row := s.db.Pool.QueryRow(ctx, `
		UPDATE hosted_events
		SET gallery = $2::jsonb, updated_at = NOW()
		WHERE id = $1
		RETURNING `+hostedEventCols, id, string(raw))
	e, err := scanHostedEvent(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEventNotFound
	}
	return e, err
}

// RemoveGalleryAt removes the gallery image at index (0-based among non-empty URLs).
func (s *HostedEventStore) RemoveGalleryAt(ctx context.Context, id string, index int) (*HostedEvent, error) {
	cur, err := s.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	urls := make([]string, 0, len(cur.Gallery))
	for _, u := range cur.Gallery {
		u = strings.TrimSpace(u)
		if u != "" {
			urls = append(urls, u)
		}
	}
	if index < 0 || index >= len(urls) {
		return nil, ErrGalleryIndex
	}
	next := append(append([]string{}, urls[:index]...), urls[index+1:]...)
	return s.UpdateGallery(ctx, id, next)
}

// OrganizerDashboard returns KPI numbers for an organizer (labels live in chrome).
func (s *HostedEventStore) OrganizerDashboard(
	ctx context.Context,
	organizerID string,
	liveStatus, openStatus, fullStatus, cancelledStatus string,
) (*HostedOrganizerDashboard, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	out := &HostedOrganizerDashboard{}
	if err := s.db.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE status = $2)::int,
			COUNT(*) FILTER (WHERE status = $3 OR status = $4)::int,
			COALESCE(SUM(host_fee_amount), 0)::float8,
			CASE
				WHEN COUNT(DISTINCT NULLIF(TRIM(host_fee_currency), '')) = 1
				THEN MIN(NULLIF(TRIM(host_fee_currency), ''))
				ELSE ''
			END
		FROM hosted_events
		WHERE organizer_id = $1 AND status <> $5`,
		organizerID, liveStatus, openStatus, fullStatus, cancelledStatus,
	).Scan(&out.ActiveCount, &out.UpcomingCount, &out.HostFeeRevenueSum, &out.HostFeeCurrency); err != nil {
		return nil, err
	}
	if err := s.db.Pool.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(en.fee_paid), 0)::float8,
			COALESCE(SUM(en.platform_commission), 0)::float8,
			COALESCE(SUM(en.organizer_net), 0)::float8,
			CASE
				WHEN COUNT(DISTINCT NULLIF(TRIM(e.entry_fee_currency), '')) = 1
				THEN MIN(NULLIF(TRIM(e.entry_fee_currency), ''))
				ELSE ''
			END
		FROM hosted_event_entries en
		INNER JOIN hosted_events e ON e.id = en.event_id
		WHERE e.organizer_id = $1
		  AND e.status <> $2
		  AND en.fee_paid > 0`,
		organizerID, cancelledStatus,
	).Scan(
		&out.EntryFeeGrossSum,
		&out.EntryFeeCommissionSum,
		&out.EntryFeeRevenueSum,
		&out.EntryFeeCurrency,
	); err != nil {
		return nil, err
	}
	if err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int
		FROM hosted_event_entries en
		INNER JOIN hosted_events e ON e.id = en.event_id
		WHERE e.organizer_id = $1
		  AND en.joined_at >= NOW() - INTERVAL '7 days'`,
		organizerID,
	).Scan(&out.PlayersJoinedThisWeek); err != nil {
		return nil, err
	}
	var lastID, lastCode *string
	err := s.db.Pool.QueryRow(ctx, `
		SELECT id::text, join_code FROM hosted_events
		WHERE organizer_id = $1
		ORDER BY created_at DESC
		LIMIT 1`, organizerID).Scan(&lastID, &lastCode)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if lastID != nil {
		out.LastEventID = *lastID
	}
	if lastCode != nil {
		out.LastEventJoinCode = *lastCode
	}
	return out, nil
}

// OrganizerAnalytics returns per-event join/completion/money metrics (no share-click tracking).
func (s *HostedEventStore) OrganizerAnalytics(
	ctx context.Context,
	organizerID string,
	liveStatus, finishedStatus string,
) (*HostedOrganizerAnalytics, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT e.id::text, e.title, e.status, e.join_code,
			COALESCE((SELECT COUNT(*)::int FROM hosted_event_entries en WHERE en.event_id = e.id), 0),
			(e.started_at IS NOT NULL OR e.status = $2 OR e.status = $3) AS started,
			(e.status = $3) AS finished,
			e.host_fee_amount::float8, e.host_fee_currency,
			COALESCE((SELECT SUM(en.fee_paid)::float8 FROM hosted_event_entries en WHERE en.event_id = e.id AND en.fee_paid > 0), 0),
			COALESCE((SELECT SUM(en.platform_commission)::float8 FROM hosted_event_entries en WHERE en.event_id = e.id AND en.fee_paid > 0), 0),
			COALESCE((SELECT SUM(en.organizer_net)::float8 FROM hosted_event_entries en WHERE en.event_id = e.id AND en.fee_paid > 0), 0),
			e.entry_fee_currency
		FROM hosted_events e
		WHERE e.organizer_id = $1
		ORDER BY e.created_at DESC`, organizerID, liveStatus, finishedStatus)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := &HostedOrganizerAnalytics{Events: make([]HostedEventAnalyticsRow, 0)}
	hostCurSeen := map[string]struct{}{}
	entryCurSeen := map[string]struct{}{}
	for rows.Next() {
		var row HostedEventAnalyticsRow
		if err := rows.Scan(
			&row.EventID, &row.Title, &row.Status, &row.JoinCode,
			&row.PlayersJoined, &row.Started, &row.Finished,
			&row.HostFee, &row.HostFeeCurrency, &row.EntryFeesSum,
			&row.EntryCommissionSum, &row.EntryNetSum, &row.EntryFeeCurrency,
		); err != nil {
			return nil, err
		}
		out.Events = append(out.Events, row)
		out.TotalPlayersJoined += row.PlayersJoined
		out.TotalHostFeeSum += row.HostFee
		out.TotalEntryFeesSum += row.EntryFeesSum
		out.TotalEntryCommission += row.EntryCommissionSum
		out.TotalEntryNetSum += row.EntryNetSum
		if hc := strings.TrimSpace(row.HostFeeCurrency); hc != "" {
			hostCurSeen[hc] = struct{}{}
		}
		if ec := strings.TrimSpace(row.EntryFeeCurrency); ec != "" {
			entryCurSeen[ec] = struct{}{}
		}
		if row.Started {
			out.TotalStarted++
		}
		if row.Finished {
			out.TotalFinished++
		}
	}
	if len(hostCurSeen) == 1 {
		for c := range hostCurSeen {
			out.HostFeeCurrency = c
		}
	}
	if len(entryCurSeen) == 1 {
		for c := range entryCurSeen {
			out.EntryFeeCurrency = c
		}
	}
	return out, rows.Err()
}

func (s *HostedEventStore) Cancel(ctx context.Context, id, cancelledStatus string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	row := s.db.Pool.QueryRow(ctx, `
		UPDATE hosted_events
		SET status = $2, cancelled_at = NOW(), updated_at = NOW()
		WHERE id = $1
		RETURNING `+hostedEventCols, id, cancelledStatus)
	e, err := scanHostedEvent(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEventNotFound
	}
	return e, err
}

func (s *HostedEventStore) MarkLive(ctx context.Context, id, liveStatus string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	row := s.db.Pool.QueryRow(ctx, `
		UPDATE hosted_events
		SET status = $2, started_at = COALESCE(started_at, NOW()), updated_at = NOW()
		WHERE id = $1
		RETURNING `+hostedEventCols, id, liveStatus)
	e, err := scanHostedEvent(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEventNotFound
	}
	return e, err
}

// SumEntryOrganizerNets returns SUM(organizer_net) for seats with fee_paid > 0 (honest current pot).
func (s *HostedEventStore) SumEntryOrganizerNets(ctx context.Context, eventID string) (float64, error) {
	if !s.ready() {
		return 0, errors.New("database unavailable")
	}
	var sum float64
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(organizer_net), 0)::float8
		FROM hosted_event_entries
		WHERE event_id = $1 AND fee_paid > 0`, eventID).Scan(&sum)
	return sum, err
}

// FreezePrizePool locks the displayed pot at Start (idempotent if already frozen).
func (s *HostedEventStore) FreezePrizePool(ctx context.Context, id string, amount float64) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	row := s.db.Pool.QueryRow(ctx, `
		UPDATE hosted_events
		SET prize_pool_frozen_amount = COALESCE(prize_pool_frozen_amount, $2),
		    prize_pool_frozen_at = COALESCE(prize_pool_frozen_at, NOW()),
		    updated_at = NOW()
		WHERE id = $1
		RETURNING `+hostedEventCols, id, amount)
	e, err := scanHostedEvent(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEventNotFound
	}
	return e, err
}

// ClearPrizePoolFreeze unlocks a sticky freeze when Start fails after freeze (before live).
func (s *HostedEventStore) ClearPrizePoolFreeze(ctx context.Context, id string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	row := s.db.Pool.QueryRow(ctx, `
		UPDATE hosted_events
		SET prize_pool_frozen_amount = NULL,
		    prize_pool_frozen_at = NULL,
		    updated_at = NOW()
		WHERE id = $1
		RETURNING `+hostedEventCols, id)
	e, err := scanHostedEvent(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEventNotFound
	}
	return e, err
}

// ClearUnstartedBracket deletes classic bracket rows that never launched a board.
// Safe for Start compensation: dual-ready has not attached game_id / started_at yet.
func (s *HostedEventStore) ClearUnstartedBracket(ctx context.Context, eventID string) error {
	if !s.ready() {
		return errors.New("database unavailable")
	}
	eventID = strings.TrimSpace(eventID)
	if eventID == "" {
		return ErrHostedEventInvalidInput
	}
	var blocked int
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM hosted_event_bracket_matches
		WHERE event_id = $1 AND (game_id IS NOT NULL OR started_at IS NOT NULL)`, eventID).Scan(&blocked)
	if err != nil {
		return err
	}
	if blocked > 0 {
		return errors.New("cannot clear bracket: match already started")
	}
	_, err = s.db.Pool.Exec(ctx, `
		DELETE FROM hosted_event_bracket_matches WHERE event_id = $1`, eventID)
	return err
}

// RevertLiveAfterFailedStart restores pre-Start status, clears freeze/started_at, and
// removes the unstarted classic bracket so a later Start can regenerate (capture fail path).
func (s *HostedEventStore) RevertLiveAfterFailedStart(ctx context.Context, id, priorStatus string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	priorStatus = strings.TrimSpace(priorStatus)
	if priorStatus == "" {
		return nil, errors.New("prior status required")
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var blocked int
	if err := tx.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM hosted_event_bracket_matches
		WHERE event_id = $1 AND (game_id IS NOT NULL OR started_at IS NOT NULL)`, id).Scan(&blocked); err != nil {
		return nil, err
	}
	if blocked > 0 {
		return nil, errors.New("cannot revert start: match already started")
	}
	if _, err := tx.Exec(ctx, `
		DELETE FROM hosted_event_bracket_matches WHERE event_id = $1`, id); err != nil {
		return nil, err
	}
	row := tx.QueryRow(ctx, `
		UPDATE hosted_events
		SET status = $2,
		    started_at = NULL,
		    prize_pool_frozen_amount = NULL,
		    prize_pool_frozen_at = NULL,
		    updated_at = NOW()
		WHERE id = $1
		RETURNING `+hostedEventCols, id, priorStatus)
	e, err := scanHostedEvent(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEventNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return e, nil
}

// MarkPrizePoolGuaranteeHeld stamps that the organizer guarantee debit succeeded.
func (s *HostedEventStore) MarkPrizePoolGuaranteeHeld(ctx context.Context, id string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	return s.markPrizePoolGuaranteeHeldOn(ctx, s.db.Pool, id)
}

// MarkPrizePoolGuaranteeHeldTx stamps held on an open transaction (create escrow atomic path).
func (s *HostedEventStore) MarkPrizePoolGuaranteeHeldTx(ctx context.Context, tx hostedEventQuerier, id string) (*HostedEvent, error) {
	if !s.ready() || tx == nil {
		return nil, errors.New("database unavailable")
	}
	return s.markPrizePoolGuaranteeHeldOn(ctx, tx, id)
}

func (s *HostedEventStore) markPrizePoolGuaranteeHeldOn(ctx context.Context, q hostedEventQuerier, id string) (*HostedEvent, error) {
	row := q.QueryRow(ctx, `
		UPDATE hosted_events
		SET prize_pool_guarantee_held = TRUE,
		    prize_pool_guarantee_captured = FALSE,
		    updated_at = NOW()
		WHERE id = $1
		RETURNING `+hostedEventCols, id)
	e, err := scanHostedEvent(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEventNotFound
	}
	return e, err
}

// ClearPrizePoolGuaranteeHeld clears the held flag after release (cancel before start).
func (s *HostedEventStore) ClearPrizePoolGuaranteeHeld(ctx context.Context, id string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	return s.clearPrizePoolGuaranteeHeldOn(ctx, s.db.Pool, id)
}

// ClearPrizePoolGuaranteeHeldTx clears held on an open transaction (cancel escrow atomic path).
func (s *HostedEventStore) ClearPrizePoolGuaranteeHeldTx(ctx context.Context, tx hostedEventQuerier, id string) (*HostedEvent, error) {
	if !s.ready() || tx == nil {
		return nil, errors.New("database unavailable")
	}
	return s.clearPrizePoolGuaranteeHeldOn(ctx, tx, id)
}

func (s *HostedEventStore) clearPrizePoolGuaranteeHeldOn(ctx context.Context, q hostedEventQuerier, id string) (*HostedEvent, error) {
	row := q.QueryRow(ctx, `
		UPDATE hosted_events
		SET prize_pool_guarantee_held = FALSE, updated_at = NOW()
		WHERE id = $1
		RETURNING `+hostedEventCols, id)
	e, err := scanHostedEvent(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEventNotFound
	}
	return e, err
}

// MarkPrizePoolGuaranteeCaptured stamps capture into the pot and clears the active hold flag.
func (s *HostedEventStore) MarkPrizePoolGuaranteeCaptured(ctx context.Context, id string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	return s.markPrizePoolGuaranteeCapturedOn(ctx, s.db.Pool, id)
}

// MarkPrizePoolGuaranteeCapturedTx stamps capture on an open transaction (start/finish escrow atomic path).
func (s *HostedEventStore) MarkPrizePoolGuaranteeCapturedTx(ctx context.Context, tx hostedEventQuerier, id string) (*HostedEvent, error) {
	if !s.ready() || tx == nil {
		return nil, errors.New("database unavailable")
	}
	return s.markPrizePoolGuaranteeCapturedOn(ctx, tx, id)
}

func (s *HostedEventStore) markPrizePoolGuaranteeCapturedOn(ctx context.Context, q hostedEventQuerier, id string) (*HostedEvent, error) {
	row := q.QueryRow(ctx, `
		UPDATE hosted_events
		SET prize_pool_guarantee_captured = TRUE,
		    prize_pool_guarantee_held = FALSE,
		    updated_at = NOW()
		WHERE id = $1
		RETURNING `+hostedEventCols, id)
	e, err := scanHostedEvent(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEventNotFound
	}
	return e, err
}

// BumpPrizePoolGuaranteeCycle increments the hold cycle for reopen re-hold (new ledger refs).
func (s *HostedEventStore) BumpPrizePoolGuaranteeCycle(ctx context.Context, id string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	return s.bumpPrizePoolGuaranteeCycleOn(ctx, s.db.Pool, id)
}

// BumpPrizePoolGuaranteeCycleTx bumps the hold cycle on an open transaction (reopen escrow atomic path).
func (s *HostedEventStore) BumpPrizePoolGuaranteeCycleTx(ctx context.Context, tx hostedEventQuerier, id string) (*HostedEvent, error) {
	if !s.ready() || tx == nil {
		return nil, errors.New("database unavailable")
	}
	return s.bumpPrizePoolGuaranteeCycleOn(ctx, tx, id)
}

func (s *HostedEventStore) bumpPrizePoolGuaranteeCycleOn(ctx context.Context, q hostedEventQuerier, id string) (*HostedEvent, error) {
	row := q.QueryRow(ctx, `
		UPDATE hosted_events
		SET prize_pool_guarantee_cycle = GREATEST(prize_pool_guarantee_cycle, 1) + 1,
		    updated_at = NOW()
		WHERE id = $1
		  AND prize_pool_guarantee_enabled = TRUE
		  AND prize_pool_guarantee_captured = FALSE
		  AND prize_pool_guarantee_held = FALSE
		RETURNING `+hostedEventCols, id)
	e, err := scanHostedEvent(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEventNotFound
	}
	return e, err
}

func (s *HostedEventStore) MarkFinished(ctx context.Context, id, finishedStatus, winnerID string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	row := s.db.Pool.QueryRow(ctx, `
		UPDATE hosted_events
		SET status = $2, winner_id = $3, finished_at = NOW(), updated_at = NOW()
		WHERE id = $1
		RETURNING `+hostedEventCols, id, finishedStatus, winnerID)
	e, err := scanHostedEvent(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEventNotFound
	}
	return e, err
}

func (s *HostedEventStore) RefreshOpenOrFull(ctx context.Context, id string, approvedStatus, openStatus, fullStatus string) (*HostedEvent, error) {
	e, err := s.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if e.Status != openStatus && e.Status != fullStatus {
		return e, nil
	}
	n, err := s.CountByStatus(ctx, id, approvedStatus)
	if err != nil {
		return nil, err
	}
	next := openStatus
	// PlayerCapOrZero: nil Unlimited stays open; valid >=2 and lt2 orphan mark full.
	if seatCap := PlayerCapOrZero(e.MaxPlayers); seatCap > 0 && n >= seatCap {
		next = fullStatus
	}
	if next == e.Status {
		e.ApprovedCount = n
		return e, nil
	}
	return s.SetStatus(ctx, id, next)
}

const hostedEntryCols = `
	id, event_id, user_id, status, seed, eliminated, placement,
	fee_paid, platform_commission, organizer_net, fee_currency, joined_at, checked_in_at, decided_at`

func scanEntry(row pgx.Row) (*HostedEventEntry, error) {
	var en HostedEventEntry
	var seed, placement *int
	var checkedIn, decided *time.Time
	err := row.Scan(
		&en.ID, &en.EventID, &en.UserID, &en.Status, &seed, &en.Eliminated, &placement,
		&en.FeePaid, &en.PlatformCommission, &en.OrganizerNet, &en.FeeCurrency, &en.JoinedAt, &checkedIn, &decided,
	)
	if err != nil {
		return nil, err
	}
	en.Seed, en.Placement, en.CheckedInAt, en.DecidedAt = seed, placement, checkedIn, decided
	return &en, nil
}

const hostedBracketMatchReturningCols = `
	id, event_id, phase, group_index, round_index, match_index, player_a_id, player_b_id, winner_id,
	next_match_id, next_slot, game_id, status, is_bye,
	player_a_ready_at, player_b_ready_at, started_at, finished_at, created_at, updated_at`

func (s *HostedEventStore) GetEntry(ctx context.Context, eventID, userID string) (*HostedEventEntry, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	en, err := scanEntry(s.db.Pool.QueryRow(ctx, `
		SELECT `+hostedEntryCols+`
		FROM hosted_event_entries WHERE event_id = $1 AND user_id = $2`, eventID, userID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEntryNotFound
	}
	return en, err
}

func (s *HostedEventStore) Join(
	ctx context.Context,
	eventID, userID, status string,
	fee, platformCommission, organizerNet float64,
	currency string,
) (*HostedEventEntry, error) {
	return s.JoinWithCapacity(ctx, eventID, userID, status, fee, platformCommission, organizerNet, currency, 0, "")
}

// JoinWithCapacity inserts an entry only when approved count is below maxPlayers (when maxPlayers > 0).
func (s *HostedEventStore) JoinWithCapacity(
	ctx context.Context,
	eventID, userID, status string,
	fee, platformCommission, organizerNet float64,
	currency string,
	maxPlayers int,
	approvedStatus string,
) (*HostedEventEntry, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `SELECT id FROM hosted_events WHERE id = $1 FOR UPDATE`, eventID); err != nil {
		return nil, err
	}
	if maxPlayers > 0 && strings.TrimSpace(approvedStatus) != "" {
		var n int
		if err := tx.QueryRow(ctx, `
			SELECT COUNT(*) FROM hosted_event_entries
			WHERE event_id = $1 AND status = $2`, eventID, approvedStatus).Scan(&n); err != nil {
			return nil, err
		}
		if n >= maxPlayers {
			return nil, ErrHostedEventConflict
		}
	}
	en, err := scanEntry(tx.QueryRow(ctx, `
		INSERT INTO hosted_event_entries (
			event_id, user_id, status, fee_paid, platform_commission, organizer_net, fee_currency
		) VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING `+hostedEntryCols,
		eventID, userID, status, fee, platformCommission, organizerNet, currency))
	if err != nil {
		if strings.Contains(err.Error(), "hosted_event_entries_event_id_user_id_key") ||
			strings.Contains(err.Error(), "duplicate key") {
			return nil, ErrHostedEventConflict
		}
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return en, nil
}

// DeleteEntry hard-removes an entry (used when wallet settle fails after insert).
func (s *HostedEventStore) DeleteEntry(ctx context.Context, eventID, userID string) error {
	if !s.ready() {
		return errors.New("database unavailable")
	}
	_, err := s.db.Pool.Exec(ctx, `
		DELETE FROM hosted_event_entries WHERE event_id = $1 AND user_id = $2`, eventID, userID)
	return err
}

func (s *HostedEventStore) SetEntryStatus(ctx context.Context, eventID, userID, status string) (*HostedEventEntry, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	en, err := scanEntry(s.db.Pool.QueryRow(ctx, `
		UPDATE hosted_event_entries
		SET status = $3, decided_at = NOW()
		WHERE event_id = $1 AND user_id = $2
		RETURNING `+hostedEntryCols,
		eventID, userID, status))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEntryNotFound
	}
	return en, err
}

// ClearEntryFeeColumns zeros money on a vacated seat so KPIs ignore refunded rows.
func (s *HostedEventStore) ClearEntryFeeColumns(ctx context.Context, eventID, userID string) error {
	if !s.ready() {
		return errors.New("database unavailable")
	}
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE hosted_event_entries
		SET fee_paid = 0, platform_commission = 0, organizer_net = 0
		WHERE event_id = $1 AND user_id = $2`, eventID, userID)
	return err
}

// SetEntryFeeMoney writes fee split after wallet settle succeeds (join inserts zeros first).
func (s *HostedEventStore) SetEntryFeeMoney(
	ctx context.Context,
	eventID, userID string,
	fee, platformCommission, organizerNet float64,
	currency string,
) (*HostedEventEntry, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	en, err := scanEntry(s.db.Pool.QueryRow(ctx, `
		UPDATE hosted_event_entries
		SET fee_paid = $3, platform_commission = $4, organizer_net = $5, fee_currency = $6
		WHERE event_id = $1 AND user_id = $2
		RETURNING `+hostedEntryCols,
		eventID, userID, fee, platformCommission, organizerNet, currency))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEntryNotFound
	}
	return en, err
}

func scanHostedEventEntry(row pgx.Row) (*HostedEventEntry, error) {
	var en HostedEventEntry
	var seed, placement *int
	var checkedIn, decided *time.Time
	if err := row.Scan(
		&en.ID, &en.EventID, &en.UserID, &en.Status, &seed, &en.Eliminated, &placement,
		&en.FeePaid, &en.PlatformCommission, &en.OrganizerNet, &en.FeeCurrency, &en.JoinedAt, &checkedIn, &decided,
		&en.Username, &en.Rating,
	); err != nil {
		return nil, err
	}
	en.Seed, en.Placement, en.CheckedInAt, en.DecidedAt = seed, placement, checkedIn, decided
	return &en, nil
}

const hostedEventEntrySelect = `
		SELECT en.id, en.event_id, en.user_id, en.status, en.seed, en.eliminated, en.placement,
			en.fee_paid, en.platform_commission, en.organizer_net, en.fee_currency, en.joined_at, en.checked_in_at, en.decided_at,
			COALESCE(u.username, ''), COALESCE(u.rating, 0)
		FROM hosted_event_entries en
		LEFT JOIN users u ON u.id = en.user_id`

func (s *HostedEventStore) ListEntries(ctx context.Context, eventID string) ([]HostedEventEntry, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	rows, err := s.db.Pool.Query(ctx, hostedEventEntrySelect+`
		WHERE en.event_id = $1
		ORDER BY en.joined_at ASC`, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]HostedEventEntry, 0)
	for rows.Next() {
		en, err := scanHostedEventEntry(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *en)
	}
	return out, rows.Err()
}

// ListEntriesPage returns a skip/limit page of entries (joined_at ASC) plus total matching rows.
// statusFilter empty = all statuses; otherwise exact status match (e.g. approved-only roster).
func (s *HostedEventStore) ListEntriesPage(
	ctx context.Context, eventID string, skip, limit int, statusFilter string,
) ([]HostedEventEntry, int, error) {
	if !s.ready() {
		return nil, 0, errors.New("database unavailable")
	}
	if skip < 0 || limit < 1 {
		return nil, 0, errors.New("invalid pagination")
	}
	where := []string{"en.event_id = $1"}
	args := []any{eventID}
	argN := 2
	statusFilter = strings.TrimSpace(statusFilter)
	if statusFilter != "" {
		where = append(where, fmt.Sprintf("en.status = $%d", argN))
		args = append(args, statusFilter)
		argN++
	}
	whereSQL := strings.Join(where, " AND ")
	var total int
	if err := s.db.Pool.QueryRow(ctx,
		`SELECT COUNT(*)::int FROM hosted_event_entries en WHERE `+whereSQL, args...,
	).Scan(&total); err != nil {
		return nil, 0, err
	}
	listArgs := append(append([]any{}, args...), skip, limit)
	rows, err := s.db.Pool.Query(ctx, hostedEventEntrySelect+`
		WHERE `+whereSQL+`
		ORDER BY en.joined_at ASC
		OFFSET $`+fmt.Sprintf("%d", argN)+` LIMIT $`+fmt.Sprintf("%d", argN+1), listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := make([]HostedEventEntry, 0)
	for rows.Next() {
		en, err := scanHostedEventEntry(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, *en)
	}
	return out, total, rows.Err()
}

// HostedEntryFeeTotals is the honest full-roster fee rollup for one cup (not page-scoped).
type HostedEntryFeeTotals struct {
	Gross        float64 `json:"gross"`
	Commission   float64 `json:"commission"`
	OrganizerNet float64 `json:"organizer_net"`
	Currency     string  `json:"currency"`
	PaidCount    int     `json:"paid_count"`
}

// EntryFeeTotals sums fee_paid > 0 seats for an event (payments summary independent of roster page).
func (s *HostedEventStore) EntryFeeTotals(ctx context.Context, eventID string) (*HostedEntryFeeTotals, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	out := &HostedEntryFeeTotals{}
	err := s.db.Pool.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(fee_paid), 0)::float8,
			COALESCE(SUM(platform_commission), 0)::float8,
			COALESCE(SUM(organizer_net), 0)::float8,
			COUNT(*)::int,
			CASE
				WHEN COUNT(DISTINCT NULLIF(TRIM(fee_currency), '')) = 1
				THEN MIN(NULLIF(TRIM(fee_currency), ''))
				ELSE ''
			END
		FROM hosted_event_entries
		WHERE event_id = $1 AND fee_paid > 0`, eventID).Scan(
		&out.Gross, &out.Commission, &out.OrganizerNet, &out.PaidCount, &out.Currency,
	)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// ListLiveBracketMatches returns unfinished non-bye matches that have a live game_id.
func (s *HostedEventStore) ListLiveBracketMatches(ctx context.Context, eventID string) ([]HostedBracketMatch, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT m.id, m.event_id, m.phase, m.group_index, m.round_index, m.match_index, m.player_a_id, m.player_b_id, m.winner_id,
			COALESCE(ua.username, ''), COALESCE(ub.username, ''), COALESCE(uw.username, ''),
			m.next_match_id, m.next_slot, m.game_id, m.status, m.is_bye,
			m.player_a_ready_at, m.player_b_ready_at, m.started_at, m.finished_at, m.created_at, m.updated_at
		FROM hosted_event_bracket_matches m
		LEFT JOIN users ua ON ua.id = m.player_a_id
		LEFT JOIN users ub ON ub.id = m.player_b_id
		LEFT JOIN users uw ON uw.id = m.winner_id
		WHERE m.event_id = $1
		  AND m.game_id IS NOT NULL
		  AND m.is_bye = false
		  AND m.finished_at IS NULL
		ORDER BY m.phase ASC, m.group_index ASC, m.round_index ASC, m.match_index ASC`, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]HostedBracketMatch, 0)
	for rows.Next() {
		m, err := scanBracketMatchNamed(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *m)
	}
	return out, rows.Err()
}

func (s *HostedEventStore) ListApprovedUserIDs(ctx context.Context, eventID, approvedStatus string, checkedInOnly bool) ([]string, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	q := `
		SELECT user_id FROM hosted_event_entries
		WHERE event_id = $1 AND status = $2`
	if checkedInOnly {
		q += ` AND checked_in_at IS NOT NULL`
	}
	q += ` ORDER BY joined_at ASC`
	rows, err := s.db.Pool.Query(ctx, q, eventID, approvedStatus)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]string, 0)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func (s *HostedEventStore) HasBracket(ctx context.Context, eventID string) (bool, error) {
	if !s.ready() {
		return false, errors.New("database unavailable")
	}
	var n int
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM hosted_event_bracket_matches WHERE event_id = $1`, eventID).Scan(&n)
	return n > 0, err
}

func (s *HostedEventStore) ListBracket(ctx context.Context, eventID string) ([]HostedBracketMatch, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT m.id, m.event_id, m.phase, m.group_index, m.round_index, m.match_index, m.player_a_id, m.player_b_id, m.winner_id,
			COALESCE(ua.username, ''), COALESCE(ub.username, ''), COALESCE(uw.username, ''),
			m.next_match_id, m.next_slot, m.game_id, m.status, m.is_bye,
			m.player_a_ready_at, m.player_b_ready_at, m.started_at, m.finished_at, m.created_at, m.updated_at
		FROM hosted_event_bracket_matches m
		LEFT JOIN users ua ON ua.id = m.player_a_id
		LEFT JOIN users ub ON ub.id = m.player_b_id
		LEFT JOIN users uw ON uw.id = m.winner_id
		WHERE m.event_id = $1
		ORDER BY m.phase ASC, m.group_index ASC, m.round_index ASC, m.match_index ASC`, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]HostedBracketMatch, 0)
	for rows.Next() {
		m, err := scanBracketMatchNamed(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *m)
	}
	return out, rows.Err()
}

func scanBracketMatch(row pgx.Row) (*HostedBracketMatch, error) {
	var m HostedBracketMatch
	err := row.Scan(
		&m.ID, &m.EventID, &m.Phase, &m.GroupIndex, &m.RoundIndex, &m.MatchIndex,
		&m.PlayerAID, &m.PlayerBID, &m.WinnerID,
		&m.NextMatchID, &m.NextSlot, &m.GameID,
		&m.Status, &m.IsBye, &m.PlayerAReadyAt, &m.PlayerBReadyAt, &m.StartedAt, &m.FinishedAt, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func scanBracketMatchNamed(row pgx.Row) (*HostedBracketMatch, error) {
	var m HostedBracketMatch
	err := row.Scan(
		&m.ID, &m.EventID, &m.Phase, &m.GroupIndex, &m.RoundIndex, &m.MatchIndex,
		&m.PlayerAID, &m.PlayerBID, &m.WinnerID,
		&m.PlayerAUsername, &m.PlayerBUsername, &m.WinnerUsername,
		&m.NextMatchID, &m.NextSlot, &m.GameID,
		&m.Status, &m.IsBye, &m.PlayerAReadyAt, &m.PlayerBReadyAt, &m.StartedAt, &m.FinishedAt, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (s *HostedEventStore) GetBracketMatch(ctx context.Context, eventID, matchID string) (*HostedBracketMatch, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	m, err := scanBracketMatch(s.db.Pool.QueryRow(ctx, `
		SELECT `+hostedBracketMatchReturningCols+`
		FROM hosted_event_bracket_matches WHERE event_id = $1 AND id = $2`, eventID, matchID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedBracketNotFound
	}
	return m, err
}

func (s *HostedEventStore) GetBracketMatchByGameID(ctx context.Context, gameID string) (*HostedBracketMatch, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	m, err := scanBracketMatch(s.db.Pool.QueryRow(ctx, `
		SELECT `+hostedBracketMatchReturningCols+`
		FROM hosted_event_bracket_matches WHERE game_id = $1`, gameID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedBracketNotFound
	}
	return m, err
}

// GetByBracketGameID returns the hosted event owning a live/finished bracket game.
func (s *HostedEventStore) GetByBracketGameID(ctx context.Context, gameID string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	gameID = strings.TrimSpace(gameID)
	if gameID == "" {
		return nil, ErrHostedBracketNotFound
	}
	row := s.db.Pool.QueryRow(ctx, `
		SELECT `+hostedEventColsAliased("e")+`
		FROM hosted_events e
		INNER JOIN hosted_event_bracket_matches m ON m.event_id = e.id
		WHERE m.game_id = $1`, gameID)
	e, err := scanHostedEvent(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedBracketNotFound
	}
	return e, err
}

// Reopen restores a manually cancelled event to open when it never started and never finished.
// Auto-finished (finished_at set) and live/started cups cannot be reopened.
func (s *HostedEventStore) Reopen(ctx context.Context, id, cancelledStatus, openStatus string) (*HostedEvent, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	return s.reopenOn(ctx, s.db.Pool, id, cancelledStatus, openStatus)
}

// ReopenTx restores open status on an open transaction (reopen escrow atomic path).
func (s *HostedEventStore) ReopenTx(ctx context.Context, tx hostedEventQuerier, id, cancelledStatus, openStatus string) (*HostedEvent, error) {
	if !s.ready() || tx == nil {
		return nil, errors.New("database unavailable")
	}
	return s.reopenOn(ctx, tx, id, cancelledStatus, openStatus)
}

func (s *HostedEventStore) reopenOn(ctx context.Context, q hostedEventQuerier, id, cancelledStatus, openStatus string) (*HostedEvent, error) {
	row := q.QueryRow(ctx, `
		UPDATE hosted_events
		SET status = $3, cancelled_at = NULL, updated_at = NOW()
		WHERE id = $1
		  AND status = $2
		  AND started_at IS NULL
		  AND finished_at IS NULL
		RETURNING `+hostedEventCols, id, cancelledStatus, openStatus)
	e, err := scanHostedEvent(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedEventInvalidInput
	}
	return e, err
}

func nextPowerOfTwo(n int) int {
	if n < 2 {
		return 2
	}
	p := 1
	for p < n {
		p <<= 1
	}
	return p
}

// GenerateKnockoutBracket builds a single-elim bracket with byes, auto-advances byes.
// phase must be the DB phase code (typically hosted_event_phase_knockout).
func (s *HostedEventStore) GenerateKnockoutBracket(
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
	if phase == "" {
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
	if st.Pending == "" || st.Ready == "" || st.Done == "" || st.Bye == "" {
		return nil, ErrHostedEventInvalidInput
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if err := generateKnockoutBracketTx(ctx, tx, BracketTableHostedEvent, eventID, playerIDs, st, phase, -1, 0); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.ListBracket(ctx, eventID)
}

func placeWinnerTx(ctx context.Context, tx pgx.Tx, tbl bracketMatchTable, nextMatchID, nextSlot, winnerID string, st HostedBracketStatuses) error {
	if err := tbl.validate(); err != nil {
		return err
	}
	var a, b *string
	var status string
	sel := fmt.Sprintf(`SELECT player_a_id, player_b_id, status FROM %s WHERE id = $1 FOR UPDATE`, tbl.name)
	err := tx.QueryRow(ctx, sel, nextMatchID).Scan(&a, &b, &status)
	if err != nil {
		return err
	}
	wid := winnerID
	if nextSlot == "a" {
		a = &wid
	} else {
		b = &wid
	}
	nextStatus := st.Pending
	switch {
	case a != nil && b != nil:
		nextStatus = st.Ready
	case a != nil || b != nil:
		nextStatus = st.Pending
	}
	upd := fmt.Sprintf(`
		UPDATE %s
		SET player_a_id = $2, player_b_id = $3, status = $4, updated_at = NOW()
		WHERE id = $1`, tbl.name)
	_, err = tx.Exec(ctx, upd, nextMatchID, a, b, nextStatus)
	return err
}

// ListUnfinishedLiveGameIDsForOrganizer returns every unfinished live board id for an organizer.
func (s *HostedEventStore) ListUnfinishedLiveGameIDsForOrganizer(
	ctx context.Context, organizerID, liveStatus, liveMatchStatus string,
) ([]string, error) {
	organizerID = strings.TrimSpace(organizerID)
	liveStatus = strings.TrimSpace(liveStatus)
	liveMatchStatus = strings.TrimSpace(liveMatchStatus)
	if !s.ready() || organizerID == "" || liveStatus == "" || liveMatchStatus == "" {
		return nil, nil
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT DISTINCT m.game_id::text
		FROM hosted_event_bracket_matches m
		INNER JOIN hosted_events e ON e.id = m.event_id
		WHERE e.organizer_id = $1::uuid
		  AND e.status = $2
		  AND m.game_id IS NOT NULL
		  AND m.status = $3
		  AND m.finished_at IS NULL`,
		organizerID, liveStatus, liveMatchStatus,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]string, 0)
	seen := map[string]struct{}{}
	for rows.Next() {
		var gid string
		if err := rows.Scan(&gid); err != nil {
			return nil, err
		}
		gid = strings.TrimSpace(gid)
		if gid == "" {
			continue
		}
		if _, ok := seen[gid]; ok {
			continue
		}
		seen[gid] = struct{}{}
		out = append(out, gid)
	}
	return out, rows.Err()
}

// MapLiveGameIDsByEventIDs returns one unfinished live board id per cup (newest first).
// Batched for discovery Watch CTAs - never N+1 ListBracket.
func (s *HostedEventStore) MapLiveGameIDsByEventIDs(ctx context.Context, eventIDs []string, liveStatus string) (map[string]string, error) {
	out := map[string]string{}
	liveStatus = strings.TrimSpace(liveStatus)
	if !s.ready() || liveStatus == "" || len(eventIDs) == 0 {
		return out, nil
	}
	ids := make([]string, 0, len(eventIDs))
	seen := map[string]struct{}{}
	for _, id := range eventIDs {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT DISTINCT ON (event_id) event_id::text, game_id::text
		FROM hosted_event_bracket_matches
		WHERE event_id = ANY($1::uuid[])
		  AND game_id IS NOT NULL
		  AND status = $2
		  AND finished_at IS NULL
		ORDER BY event_id, updated_at DESC NULLS LAST, started_at DESC NULLS LAST`,
		ids, liveStatus)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var eid, gid string
		if err := rows.Scan(&eid, &gid); err != nil {
			return nil, err
		}
		eid = strings.TrimSpace(eid)
		gid = strings.TrimSpace(gid)
		if eid != "" && gid != "" {
			out[eid] = gid
		}
	}
	return out, rows.Err()
}

func (s *HostedEventStore) AttachGame(ctx context.Context, matchID, gameID, liveStatus string) (*HostedBracketMatch, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	m, err := scanBracketMatch(s.db.Pool.QueryRow(ctx, `
		UPDATE hosted_event_bracket_matches
		SET game_id = $2, status = $3, started_at = COALESCE(started_at, NOW()), updated_at = NOW()
		WHERE id = $1
		RETURNING `+hostedBracketMatchReturningCols,
		matchID, gameID, liveStatus))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedBracketNotFound
	}
	return m, err
}

func (s *HostedEventStore) ResetMatchForRematch(ctx context.Context, matchID, readyStatus string) (*HostedBracketMatch, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	m, err := scanBracketMatch(s.db.Pool.QueryRow(ctx, `
		UPDATE hosted_event_bracket_matches
		SET game_id = NULL, winner_id = NULL, status = $2, started_at = NULL, finished_at = NULL,
		    player_a_ready_at = NULL, player_b_ready_at = NULL, updated_at = NOW()
		WHERE id = $1
		RETURNING `+hostedBracketMatchReturningCols,
		matchID, readyStatus))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedBracketNotFound
	}
	return m, err
}

// RematchHostedBracketMatch clears readiness/game for a ready or live match that has not finished.
func (s *HostedEventStore) RematchHostedBracketMatch(
	ctx context.Context,
	eventID, matchID string,
	bst HostedBracketStatuses,
) (*HostedBracketMatch, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	ready := strings.TrimSpace(bst.Ready)
	live := strings.TrimSpace(bst.Live)
	if ready == "" {
		return nil, ErrHostedMatchRematch
	}
	m, err := s.GetBracketMatch(ctx, eventID, matchID)
	if err != nil {
		return nil, err
	}
	if m.IsBye || m.FinishedAt != nil || (m.WinnerID != nil && strings.TrimSpace(*m.WinnerID) != "") {
		return nil, ErrHostedMatchRematch
	}
	if m.PlayerAID == nil || m.PlayerBID == nil || strings.TrimSpace(*m.PlayerAID) == "" || strings.TrimSpace(*m.PlayerBID) == "" {
		return nil, ErrHostedMatchRematch
	}
	st := strings.TrimSpace(m.Status)
	if st != ready && (live == "" || st != live) {
		return nil, ErrHostedMatchRematch
	}
	return s.ResetMatchForRematch(ctx, m.ID, ready)
}

func scanHostedEventReport(row pgx.Row) (*HostedEventReport, error) {
	var r HostedEventReport
	var reviewedBy *string
	var reviewedAt *time.Time
	err := row.Scan(
		&r.ID, &r.EventID, &r.ReporterID, &r.ReasonCode, &r.Note, &r.Status,
		&reviewedBy, &reviewedAt, &r.CreatedAt,
		&r.EventTitle, &r.EventJoinCode, &r.ReporterUsername,
	)
	if err != nil {
		return nil, err
	}
	r.ReviewedBy, r.ReviewedAt = reviewedBy, reviewedAt
	return &r, nil
}

const hostedEventReportSelect = `
	r.id, r.event_id, r.reporter_id, r.reason_code, r.note, r.status,
	r.reviewed_by::text, r.reviewed_at, r.created_at,
	COALESCE(e.title, ''), COALESCE(e.join_code, ''), COALESCE(u.username, '')`

func (s *HostedEventStore) CreateReport(ctx context.Context, eventID, reporterID, reasonCode, note, openStatus string) (*HostedEventReport, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	reasonCode = strings.TrimSpace(reasonCode)
	if eventID == "" || reporterID == "" || reasonCode == "" || openStatus == "" {
		return nil, ErrHostedEventInvalidInput
	}
	var id string
	err := s.db.Pool.QueryRow(ctx, `
		INSERT INTO hosted_event_reports (event_id, reporter_id, reason_code, note, status)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id::text`,
		eventID, reporterID, reasonCode, strings.TrimSpace(note), openStatus).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "idx_hosted_event_reports_open_unique") ||
			strings.Contains(err.Error(), "duplicate key") {
			return nil, ErrHostedReportConflict
		}
		return nil, err
	}
	return s.GetReport(ctx, id)
}

func (s *HostedEventStore) GetReport(ctx context.Context, id string) (*HostedEventReport, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	row := s.db.Pool.QueryRow(ctx, `
		SELECT `+hostedEventReportSelect+`
		FROM hosted_event_reports r
		LEFT JOIN hosted_events e ON e.id = r.event_id
		LEFT JOIN users u ON u.id = r.reporter_id
		WHERE r.id = $1`, id)
	rep, err := scanHostedEventReport(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrHostedReportNotFound
	}
	return rep, err
}

func (s *HostedEventStore) ListReports(ctx context.Context, status string, skip, limit int) ([]HostedEventReport, int, error) {
	if !s.ready() {
		return nil, 0, errors.New("database unavailable")
	}
	var total int
	var err error
	if strings.TrimSpace(status) == "" {
		err = s.db.Pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM hosted_event_reports`).Scan(&total)
	} else {
		err = s.db.Pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM hosted_event_reports WHERE status = $1`, status).Scan(&total)
	}
	if err != nil {
		return nil, 0, err
	}
	var rows pgx.Rows
	if strings.TrimSpace(status) == "" {
		rows, err = s.db.Pool.Query(ctx, `
			SELECT `+hostedEventReportSelect+`
			FROM hosted_event_reports r
			LEFT JOIN hosted_events e ON e.id = r.event_id
			LEFT JOIN users u ON u.id = r.reporter_id
			ORDER BY r.created_at DESC
			OFFSET $1 LIMIT $2`, skip, limit)
	} else {
		rows, err = s.db.Pool.Query(ctx, `
			SELECT `+hostedEventReportSelect+`
			FROM hosted_event_reports r
			LEFT JOIN hosted_events e ON e.id = r.event_id
			LEFT JOIN users u ON u.id = r.reporter_id
			WHERE r.status = $1
			ORDER BY r.created_at DESC
			OFFSET $2 LIMIT $3`, status, skip, limit)
	}
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := make([]HostedEventReport, 0)
	for rows.Next() {
		rep, err := scanHostedEventReport(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, *rep)
	}
	return out, total, rows.Err()
}

func (s *HostedEventStore) SetReportStatus(ctx context.Context, id, status, reviewerID string) (*HostedEventReport, error) {
	if !s.ready() {
		return nil, errors.New("database unavailable")
	}
	status = strings.TrimSpace(status)
	if status == "" {
		return nil, ErrHostedEventInvalidInput
	}
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE hosted_event_reports
		SET status = $2, reviewed_by = $3::uuid, reviewed_at = NOW()
		WHERE id = $1`, id, status, reviewerID)
	if err != nil {
		return nil, err
	}
	return s.GetReport(ctx, id)
}
