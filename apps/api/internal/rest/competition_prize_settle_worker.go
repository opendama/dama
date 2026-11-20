package rest

import (
	"context"
	"log"
	"strconv"
	"strings"
	"time"

	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/store"
)

// SettleDuePrizesResult is the outcome of one settle pass.
type SettleDuePrizesResult struct {
	Due            int
	Settled        int
	Failed         int
	EscrowRepaired int
	ListErr        error
	Skipped        bool
}

// SettleDuePrizes credits wallets for pending competition prizes past the dispute window.
// Also retries freeze+escrow for finished paid Official/organizer cups that never opened a dispute window
// (crash/error between finish commit and escrow). CreatePendingPayouts is idempotent.
func (a *CompetitionPrizesAPI) SettleDuePrizes(ctx context.Context) SettleDuePrizesResult {
	out := SettleDuePrizesResult{}
	if a == nil || a.Prizes == nil || a.Payments == nil || a.Settings == nil {
		out.Skipped = true
		return out
	}
	enums := a.Settings.ClientEnums()
	if enums.Source != "database" {
		out.Skipped = true
		return out
	}
	out.EscrowRepaired = a.repairMissingEscrow(ctx, enums)
	due, err := a.Prizes.ListPendingDue(ctx, time.Now())
	if err != nil {
		out.ListErr = err
		return out
	}
	out.Due = len(due)
	for _, p := range due {
		ledgerID, creditErr := a.Payments.CreditCompetitionPrizePayout(ctx, p.UserID, p.Amount, p.Currency, p.ID)
		if creditErr != nil {
			_ = a.Prizes.MarkPayoutFailed(ctx, p.ID, enums.CompetitionPrizePayoutFailed)
			out.Failed++
			continue
		}
		if err := a.Prizes.MarkPayoutSettled(ctx, p.ID, enums.CompetitionPrizePayoutSettled, enums.CompetitionPrizePayoutPending, ledgerID); err != nil {
			out.Failed++
			continue
		}
		out.Settled++
		// href_path=/transactions + href_query_key=id → /transactions?id=<ledger> (wallet_credited parity).
		// Cup title is bodyArgs for "%s"; ledger id is hrefEntityID.
		ledger := strings.TrimSpace(ledgerID)
		if a.DB != nil && a.DB.Ready() && ledger != "" {
			title := strings.TrimSpace(p.EntityTitle)
			notifications.EmitPlayer(ctx, a.DB.Pool, p.UserID, notifications.KindPlayerCompetitionPrizeSettled,
				"competition_prize_settled:"+p.ID, ledger, title)
		}
	}
	return out
}

// RunCompetitionPrizeSettleWorker periodically settles competition prizes past the dispute window.
func RunCompetitionPrizeSettleWorker(ctx context.Context, a *CompetitionPrizesAPI) {
	if a == nil {
		return
	}
	const pollEvery = 30 * time.Second
	ticker := time.NewTicker(pollEvery)
	defer ticker.Stop()

	var lastRun time.Time

	run := func() {
		if a.Settings != nil {
			_ = a.Settings.ReloadClientEnums(ctx)
		}
		interval, intervalOK := competitionPrizeSettleInterval(a.Settings)
		if !intervalOK || interval <= 0 {
			return
		}
		if !lastRun.IsZero() && time.Since(lastRun) < interval {
			return
		}
		lastRun = time.Now()
		// Escrow repair is independent of auto-settle credits: finished paid cups missing
		// payouts must still be repaired when only the settle interval is configured.
		if a.Settings != nil {
			enums := a.Settings.ClientEnums()
			if enums.Source == "database" {
				if n := a.repairMissingEscrow(ctx, enums); n > 0 {
					log.Printf("competition prize escrow repair: repaired=%d", n)
				}
			}
		}
		if !competitionPrizeAutoSettleEnabled(a.Settings) {
			return
		}
		res := a.SettleDuePrizes(ctx)
		if res.Skipped {
			return
		}
		if res.ListErr != nil {
			log.Printf("competition prize auto-settle: list pending: %v", res.ListErr)
			return
		}
		if res.Due > 0 || res.Settled > 0 || res.Failed > 0 || res.EscrowRepaired > 0 {
			log.Printf("competition prize auto-settle: due=%d settled=%d failed=%d escrow_repaired=%d",
				res.Due, res.Settled, res.Failed, res.EscrowRepaired)
		}
	}

	run()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			run()
		}
	}
}

// repairMissingEscrow re-runs finishAfterBracket for paid finished cups missing escrow.
// Shared for platform tournaments and organizer hosted events. Safe to call every settle pass.
func (a *CompetitionPrizesAPI) repairMissingEscrow(ctx context.Context, enums store.ClientEnumsConfig) int {
	if a == nil || a.Prizes == nil {
		return 0
	}
	missing, err := a.Prizes.ListFinishedMissingEscrow(ctx, enums.HostedEventArenaFormat)
	if err != nil {
		log.Printf("competition prize escrow repair: list failed: %v", err)
		return 0
	}
	repaired := 0
	for _, ref := range missing {
		switch ref.EntityKind {
		case store.CompetitionEntityTournament:
			if a.TourAPI == nil {
				continue
			}
			a.TourAPI.tournamentFinishAfterBracket(ctx, ref.EntityID, false, enums)
		case store.CompetitionEntityEvent:
			if a.EventsAPI == nil {
				continue
			}
			a.EventsAPI.eventFinishAfterBracket(ctx, ref.EntityID, false, enums)
		default:
			continue
		}
		repaired++
	}
	return repaired
}

func competitionPrizeSettleInterval(settings *store.SettingsStore) (time.Duration, bool) {
	if settings == nil {
		return 0, false
	}
	raw := strings.TrimSpace(settings.ClientEnums().CompetitionPrizeSettleIntervalMinutes)
	if raw == "" {
		return 0, false
	}
	mins, err := strconv.Atoi(raw)
	if err != nil || mins <= 0 {
		return 0, false
	}
	return time.Duration(mins) * time.Minute, true
}

func competitionPrizeAutoSettleEnabled(settings *store.SettingsStore) bool {
	if settings == nil {
		return false
	}
	// DB + PUT /console/competition/prize-settle-settings only allow true|false.
	return strings.EqualFold(strings.TrimSpace(settings.ClientEnums().CompetitionPrizeAutoSettle), "true")
}
