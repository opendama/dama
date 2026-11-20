package rest

import (
	"net/http"

	"dama/apps/api/internal/db"
	"dama/apps/api/internal/payments"
	"dama/apps/api/internal/store"
)

type CompetitionPrizesAPI struct {
	Prizes   *store.CompetitionPrizeStore
	Payments *payments.Service
	Settings *store.SettingsStore
	DB       *db.Handle
	// Optional: used to retry freeze+escrow when finish committed before escrow.
	TourAPI   *TournamentAPI
	EventsAPI *HostedEventsAPI
}

// ConsoleSettleDue credits wallets for all pending competition prizes past the dispute window.
func (a *CompetitionPrizesAPI) ConsoleSettleDue(w http.ResponseWriter, r *http.Request) {
	if a == nil || a.Prizes == nil || a.Payments == nil || a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "service unavailable"})
		return
	}
	enums := a.Settings.ClientEnums()
	if enums.Source != "database" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "client enums unavailable"})
		return
	}
	res := a.SettleDuePrizes(r.Context())
	if res.Skipped {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "service unavailable"})
		return
	}
	if res.ListErr != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "unable to list pending prizes"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"settled":         res.Settled,
		"failed":          res.Failed,
		"due":             res.Due,
		"escrow_repaired": res.EscrowRepaired,
	})
}
