package rest

import (
	"context"
	"log"
	"strings"
	"time"

	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/store"
)

// CompetitionArenaAPI runs arena pairing and finish passes.
type CompetitionArenaAPI struct {
	Settings    *store.SettingsStore
	Tournaments *store.TournamentStore
	Events      *store.HostedEventStore
	TourAPI     *TournamentAPI
	EventsAPI   *HostedEventsAPI
}

func (a *CompetitionArenaAPI) pairTournamentArenas(ctx context.Context, enums store.ClientEnumsConfig) {
	if a == nil || a.Tournaments == nil || a.TourAPI == nil {
		return
	}
	score, err := store.ParseArenaScoreConfig(enums)
	if err != nil {
		return
	}
	_ = score
	ids, err := a.Tournaments.ListLiveArenasNeedingPair(ctx)
	if err != nil {
		log.Printf("arena-pair: list tournaments: %v", err)
		return
	}
	bst := a.TourAPI.tournamentBracketStatuses(enums)
	phase := strings.TrimSpace(enums.HostedEventPhaseArena)
	mode, modeErr := competitionArenaPairingMode(enums)
	if modeErr != nil {
		log.Printf("arena-pair: tournaments: %v", modeErr)
		return
	}
	autoStart := competitionArenaAutoStartEnabled(enums)
	for _, tid := range ids {
		t, gerr := a.Tournaments.Get(ctx, tid)
		if gerr != nil || t == nil || t.FinishedAt != nil {
			continue
		}
		if strings.TrimSpace(t.FormatID) != strings.TrimSpace(enums.HostedEventArenaFormat) {
			continue
		}
		queue, qerr := a.Tournaments.ListArenaQueuedPlayers(ctx, tid, mode, bst, phase)
		if qerr != nil || len(queue) < 2 {
			continue
		}
		for i := 0; i+1 < len(queue); i += 2 {
			m, perr := a.Tournaments.PairArenaPlayers(ctx, tid, queue[i].UserID, queue[i+1].UserID, bst, phase)
			if perr != nil {
				continue
			}
			if a.TourAPI.DB != nil && a.TourAPI.DB.Ready() {
				notifications.EmitPlayer(ctx, a.TourAPI.DB.Pool, queue[i].UserID, notifications.KindPlayerArenaMatched,
					"arena_matched:"+m.ID+":"+queue[i].UserID, tid, t.Title)
				notifications.EmitPlayer(ctx, a.TourAPI.DB.Pool, queue[i+1].UserID, notifications.KindPlayerArenaMatched,
					"arena_matched:"+m.ID+":"+queue[i+1].UserID, tid, t.Title)
			}
			if autoStart {
				mp, gerr := a.Tournaments.GetBracketMatch(ctx, tid, m.ID)
				if gerr != nil || mp == nil {
					continue
				}
				_, _ = a.TourAPI.startTournamentMatchGame(ctx, t, mp, bst, enums, true)
			}
		}
	}
}

func (a *CompetitionArenaAPI) pairEventArenas(ctx context.Context, enums store.ClientEnumsConfig) {
	if a == nil || a.Events == nil || a.EventsAPI == nil {
		return
	}
	ids, err := a.Events.ListLiveArenasNeedingPair(ctx)
	if err != nil {
		log.Printf("arena-pair: list events: %v", err)
		return
	}
	bst := a.EventsAPI.eventBracketStatuses(enums)
	phase := strings.TrimSpace(enums.HostedEventPhaseArena)
	mode, modeErr := competitionArenaPairingMode(enums)
	if modeErr != nil {
		log.Printf("arena-pair: events: %v", modeErr)
		return
	}
	autoStart := competitionArenaAutoStartEnabled(enums)
	for _, eid := range ids {
		ev, gerr := a.Events.Get(ctx, eid)
		if gerr != nil || ev == nil || ev.FinishedAt != nil {
			continue
		}
		if strings.TrimSpace(ev.FormatID) != strings.TrimSpace(enums.HostedEventArenaFormat) {
			continue
		}
		queue, qerr := a.Events.ListArenaQueuedPlayers(ctx, eid, mode, bst, phase, enums.HostedEventEntryApproved)
		if qerr != nil || len(queue) < 2 {
			continue
		}
		for i := 0; i+1 < len(queue); i += 2 {
			m, perr := a.Events.PairArenaPlayers(ctx, eid, queue[i].UserID, queue[i+1].UserID, bst, phase)
			if perr != nil {
				continue
			}
			if a.EventsAPI.DB != nil && a.EventsAPI.DB.Ready() {
				notifications.EmitPlayer(ctx, a.EventsAPI.DB.Pool, queue[i].UserID, notifications.KindPlayerArenaMatched,
					"arena_matched:"+m.ID+":"+queue[i].UserID, eid, ev.Title)
				notifications.EmitPlayer(ctx, a.EventsAPI.DB.Pool, queue[i+1].UserID, notifications.KindPlayerArenaMatched,
					"arena_matched:"+m.ID+":"+queue[i+1].UserID, eid, ev.Title)
			}
			if autoStart {
				mp, gerr := a.Events.GetBracketMatch(ctx, eid, m.ID)
				if gerr != nil || mp == nil {
					continue
				}
				_, _ = a.EventsAPI.startEventMatchGame(ctx, ev, mp, bst, enums, true)
			}
		}
	}
}

func (a *CompetitionArenaAPI) finishExpiredArenas(ctx context.Context, enums store.ClientEnumsConfig) {
	if a == nil {
		return
	}
	bstTour := store.HostedBracketStatuses{}
	bstEvent := store.HostedBracketStatuses{}
	if a.TourAPI != nil {
		bstTour = a.TourAPI.tournamentBracketStatuses(enums)
	}
	if a.EventsAPI != nil {
		bstEvent = a.EventsAPI.eventBracketStatuses(enums)
	}
	phase := strings.TrimSpace(enums.HostedEventPhaseArena)
	est := store.HostedEventStatuses{
		Open:      enums.HostedEventDefaultStatus,
		Full:      enums.HostedEventFullStatus,
		Live:      enums.HostedEventLiveStatus,
		Finished:  enums.HostedEventFinishedStatus,
		Cancelled: enums.HostedEventCancelledStatus,
	}

	if a.Tournaments != nil && a.TourAPI != nil {
		ids, err := a.Tournaments.ListExpiredArenas(ctx)
		if err != nil {
			log.Printf("arena-finish: list tournaments: %v", err)
		} else {
			for _, tid := range ids {
				finishedBefore := false
				t, gerr := a.Tournaments.Get(ctx, tid)
				if gerr != nil || t == nil {
					continue
				}
				if t.FinishedAt != nil {
					finishedBefore = true
				} else if _, freezeErr := a.TourAPI.freezeTournamentPrizePoolAtFinishIfNeeded(ctx, t); freezeErr != nil {
					log.Printf("arena-finish: tournament freeze %s: %v", tid, freezeErr)
					continue
				}
				tour, ferr := a.Tournaments.FinishArena(ctx, tid, bstTour, phase)
				if ferr != nil || tour == nil {
					log.Printf("arena-finish: tournament FinishArena %s: %v", tid, ferr)
					continue
				}
				a.TourAPI.tournamentFinishAfterBracket(ctx, tid, finishedBefore, enums)
				if a.TourAPI.DB != nil && a.TourAPI.DB.Ready() {
					ids, _ := tournamentEntrantIDs(ctx, a.TourAPI.DB, tid)
					for _, uid := range ids {
						notifications.EmitPlayer(ctx, a.TourAPI.DB.Pool, uid, notifications.KindPlayerArenaFinished,
							"arena_finished:"+tid+":"+uid, tid, tour.Title)
					}
				}
			}
		}
	}

	if a.Events != nil && a.EventsAPI != nil {
		ids, err := a.Events.ListExpiredArenas(ctx)
		if err != nil {
			log.Printf("arena-finish: list events: %v", err)
		} else {
			for _, eid := range ids {
				finishedBefore := false
				cur, gerr := a.Events.Get(ctx, eid)
				if gerr != nil || cur == nil {
					continue
				}
				if cur.FinishedAt != nil {
					finishedBefore = true
				} else if _, freezeErr := a.EventsAPI.freezeEventPrizePoolAtFinishIfNeeded(ctx, cur); freezeErr != nil {
					log.Printf("arena-finish: event freeze %s: %v", eid, freezeErr)
					continue
				}
				ev, ferr := a.Events.FinishArena(ctx, eid, bstEvent, est, enums.HostedEventEntryApproved, phase)
				if ferr != nil || ev == nil {
					log.Printf("arena-finish: event FinishArena %s: %v", eid, ferr)
					continue
				}
				a.EventsAPI.eventFinishAfterBracket(ctx, eid, finishedBefore, enums)
				if a.EventsAPI.DB != nil && a.EventsAPI.DB.Ready() {
					players, _ := a.Events.ListApprovedUserIDs(ctx, eid, enums.HostedEventEntryApproved, false)
					for _, uid := range players {
						notifications.EmitPlayer(ctx, a.EventsAPI.DB.Pool, uid, notifications.KindPlayerArenaFinished,
							"arena_finished:"+eid+":"+uid, eid, ev.Title)
					}
				}
			}
		}
	}
}

func (a *CompetitionArenaAPI) RunArenaPass(ctx context.Context) {
	if a == nil || a.Settings == nil {
		return
	}
	enums := a.Settings.ClientEnums()
	if enums.Source != "database" {
		log.Printf("arena-worker: client_enums unavailable; skip pass")
		return
	}
	// Finish first so expired clocks close even when pairing config is broken.
	a.finishExpiredArenas(ctx, enums)
	a.pairTournamentArenas(ctx, enums)
	a.pairEventArenas(ctx, enums)
}

// competitionArenaWorkerTickSeconds: prefer configured pair interval; otherwise keep
// a finish-capable tick so expired arenas still close when pairing settings are empty.
func competitionArenaWorkerTickSeconds(settings *store.SettingsStore) int {
	if sec, ok := competitionArenaPairInterval(settings); ok {
		return sec
	}
	return 15
}

// RunCompetitionArenaWorker pairs arena queues and finishes expired arenas.
func RunCompetitionArenaWorker(ctx context.Context, a *CompetitionArenaAPI) {
	if a == nil {
		return
	}
	var ticker *time.Ticker
	defer func() {
		if ticker != nil {
			ticker.Stop()
		}
	}()
	for {
		if a.Settings != nil {
			if err := a.Settings.ReloadClientEnums(ctx); err != nil {
				log.Printf("arena-worker: ReloadClientEnums: %v", err)
			}
		}
		sec := competitionArenaWorkerTickSeconds(a.Settings)
		if ticker != nil {
			ticker.Stop()
		}
		ticker = time.NewTicker(time.Duration(sec) * time.Second)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			a.RunArenaPass(ctx)
		}
	}
}
