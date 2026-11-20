package rest

import (
	"context"
	"log"
	"strings"

	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/store"
)

func (a *API) escrowTournamentFinish(ctx context.Context, tour *store.Tournament, _ store.ClientEnumsConfig) {
	if a == nil || a.CompetitionPrizes == nil || tour == nil || tour.FinishedAt == nil {
		return
	}
	if err := a.CompetitionPrizes.EscrowTournamentFinish(ctx, tour); err != nil {
		log.Printf("escrowTournamentFinish: escrow failed tournament_id=%s: %v", tour.ID, err)
		return
	}
	if a.DB == nil || !a.DB.Ready() {
		return
	}
	tour, err := a.Tournaments.Get(ctx, tour.ID)
	if err != nil || tour == nil || tour.DisputeWindowEndsAt == nil {
		return
	}
	ids, _ := tournamentEntrantIDs(ctx, a.DB, tour.ID)
	for _, uid := range ids {
		uid = strings.TrimSpace(uid)
		if uid == "" {
			continue
		}
		notifications.EmitPlayer(ctx, a.DB.Pool, uid, notifications.KindPlayerTournamentDisputeOpen,
			"tournament_dispute_open:"+tour.ID+":"+uid, tour.ID, tour.Title)
	}
}

func (a *API) escrowEventFinish(ctx context.Context, ev *store.HostedEvent, enums store.ClientEnumsConfig) {
	if a == nil || a.CompetitionPrizes == nil || ev == nil || ev.FinishedAt == nil {
		return
	}
	if err := a.CompetitionPrizes.EscrowEventFinish(ctx, ev, enums.HostedEventEntryApproved); err != nil {
		log.Printf("escrowEventFinish: escrow failed event_id=%s: %v", ev.ID, err)
		return
	}
	if a.DB == nil || !a.DB.Ready() || a.HostedEvents == nil {
		return
	}
	ev, err := a.HostedEvents.Get(ctx, ev.ID)
	if err != nil || ev == nil || ev.DisputeWindowEndsAt == nil {
		return
	}
	ids, _ := a.HostedEvents.ListApprovedUserIDs(ctx, ev.ID, enums.HostedEventEntryApproved, false)
	for _, uid := range ids {
		uid = strings.TrimSpace(uid)
		if uid == "" {
			continue
		}
		notifications.EmitPlayer(ctx, a.DB.Pool, uid, notifications.KindPlayerCompetitionDisputeOpen,
			"competition_dispute:event:"+ev.ID+":"+uid, ev.ID, ev.Title)
	}
}
