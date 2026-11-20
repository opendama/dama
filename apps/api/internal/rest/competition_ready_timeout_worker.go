package rest

import (
	"context"
	"log"
	"strconv"
	"strings"
	"time"

	"dama/apps/api/internal/store"
)

func competitionMatchReadyTimeout(settings *store.SettingsStore) (time.Duration, bool) {
	if settings == nil {
		return 0, false
	}
	enums := settings.ClientEnums()
	if enums.Source != "database" {
		return 0, false
	}
	raw := strings.TrimSpace(enums.CompetitionMatchReadyTimeoutSeconds)
	if raw == "" {
		return 0, false
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return 0, false
	}
	return time.Duration(n) * time.Second, true
}

func competitionMatchReadyAutoForfeitEnabled(settings *store.SettingsStore) bool {
	if settings == nil {
		return false
	}
	enums := settings.ClientEnums()
	if enums.Source != "database" {
		return false
	}
	v := strings.ToLower(strings.TrimSpace(enums.CompetitionMatchReadyAutoForfeit))
	return v == "true" || v == "1" || v == "yes" || v == "on"
}

// CompetitionReadyTimeoutAPI applies ready-check no-show forfeits for tournaments and events.
type CompetitionReadyTimeoutAPI struct {
	Settings    *store.SettingsStore
	Tournaments *store.TournamentStore
	Events      *store.HostedEventStore
	TourAPI     *TournamentAPI
	EventsAPI   *HostedEventsAPI
}

// RunReadyTimeoutPass forfeits opponents who never marked ready after the DB timeout.
func (a *CompetitionReadyTimeoutAPI) RunReadyTimeoutPass(ctx context.Context) (applied int) {
	if a == nil || a.Settings == nil {
		return 0
	}
	if !competitionMatchReadyAutoForfeitEnabled(a.Settings) {
		return 0
	}
	timeout, ok := competitionMatchReadyTimeout(a.Settings)
	if !ok {
		return 0
	}
	enums := a.Settings.ClientEnums()
	now := time.Now().UTC()

	if a.Tournaments != nil && a.TourAPI != nil {
		ready := strings.TrimSpace(enums.TournamentBracketReady)
		if ready == "" {
			ready = strings.TrimSpace(enums.HostedEventBracketReady)
		}
		cands, err := a.Tournaments.ListTournamentReadyTimeoutCandidates(ctx, ready, timeout, now)
		if err != nil {
			log.Printf("ready-timeout: list tournament candidates: %v", err)
		} else {
			cat := a.Settings.EventsCatalog()
			bst := a.TourAPI.tournamentBracketStatuses(enums)
			formatIDs, phases, swissRounds, groupsAdvance := a.TourAPI.tournamentFormatAdvanceParams(enums, cat)
			arenaScore, arenaScoreErr := store.ParseArenaScoreConfig(enums)
			ppw, ppwErr := store.StandingsPointsPerWin(enums)
			ppd, ppdErr := store.StandingsPointsPerDraw(enums)
			if arenaScoreErr != nil {
				log.Printf("ready-timeout: arena score config: %v", arenaScoreErr)
			} else if ppwErr != nil {
				log.Printf("ready-timeout: standings points per win: %v", ppwErr)
			} else if ppdErr != nil {
				log.Printf("ready-timeout: standings points per draw: %v", ppdErr)
			} else {
				for _, c := range cands {
					t, gerr := a.Tournaments.Get(ctx, c.EntityID)
					if gerr != nil || t == nil || t.StartedAt == nil {
						continue
					}
					finishedBefore := t.FinishedAt != nil
					updated, awards, ferr := a.Tournaments.ForfeitTournamentMatch(
						ctx, c.EntityID, c.MatchID, c.LoserID, bst, formatIDs, phases, swissRounds, groupsAdvance, arenaScore, ppw, ppd,
					)
					if ferr != nil {
						continue
					}
					if updated != nil {
						gid := ""
						if updated.GameID != nil {
							gid = strings.TrimSpace(*updated.GameID)
						}
						if gid == "" {
							gid = "match:" + strings.TrimSpace(updated.ID)
						}
						preferArena := strings.TrimSpace(t.FormatID) == strings.TrimSpace(enums.HostedEventArenaFormat)
						emitCompetitionPointsAwarded(ctx, a.TourAPI.DB, gid, t.Title, c.EntityID, awards, preferArena)
					}
					a.TourAPI.tournamentFinishAfterBracket(ctx, c.EntityID, finishedBefore, enums)
					applied++
				}
			}
		}
	}

	if a.Events != nil && a.EventsAPI != nil {
		ready := strings.TrimSpace(enums.HostedEventBracketReady)
		cands, err := a.Events.ListEventReadyTimeoutCandidates(ctx, ready, timeout, now)
		if err != nil {
			log.Printf("ready-timeout: list event candidates: %v", err)
		} else {
			cat := a.Settings.EventsCatalog()
			bst := a.EventsAPI.eventBracketStatuses(enums)
			est := store.HostedEventStatuses{
				Open:      enums.HostedEventDefaultStatus,
				Full:      enums.HostedEventFullStatus,
				Live:      enums.HostedEventLiveStatus,
				Finished:  enums.HostedEventFinishedStatus,
				Cancelled: enums.HostedEventCancelledStatus,
			}
			formatIDs := store.HostedFormatIDs{
				Knockout:       enums.HostedEventKnockoutFormat,
				RoundRobin:     enums.HostedEventRoundRobinFormat,
				Swiss:          enums.HostedEventSwissFormat,
				GroupsKnockout: enums.HostedEventGroupsKnockoutFormat,
				Arena:          enums.HostedEventArenaFormat,
			}
			phases := store.HostedFormatPhases{
				Knockout:   enums.HostedEventPhaseKnockout,
				RoundRobin: enums.HostedEventPhaseRoundRobin,
				Swiss:      enums.HostedEventPhaseSwiss,
				Group:      enums.HostedEventPhaseGroup,
				Arena:      enums.HostedEventPhaseArena,
			}
			arenaScore, arenaScoreErr := store.ParseArenaScoreConfig(enums)
			ppw, ppwErr := store.StandingsPointsPerWin(enums)
			ppd, ppdErr := store.StandingsPointsPerDraw(enums)
			if arenaScoreErr != nil {
				log.Printf("ready-timeout: arena score config: %v", arenaScoreErr)
			} else if ppwErr != nil {
				log.Printf("ready-timeout: standings points per win: %v", ppwErr)
			} else if ppdErr != nil {
				log.Printf("ready-timeout: standings points per draw: %v", ppdErr)
			} else {
				for _, c := range cands {
					ev, gerr := a.Events.Get(ctx, c.EntityID)
					if gerr != nil || ev == nil {
						continue
					}
					finishedBefore := ev.FinishedAt != nil
					updated, awards, ferr := a.Events.ForfeitHostedBracketMatch(
						ctx, c.EntityID, c.MatchID, c.LoserID, bst, est, enums.HostedEventEntryApproved,
						formatIDs, phases, cat.SwissRoundsByMaxPlayers, cat.GroupsKnockoutAdvancePerGroup, arenaScore, ppw, ppd,
					)
					if ferr != nil {
						continue
					}
					if updated != nil {
						gid := ""
						if updated.GameID != nil {
							gid = strings.TrimSpace(*updated.GameID)
						}
						if gid == "" {
							gid = "match:" + strings.TrimSpace(updated.ID)
						}
						preferArena := strings.TrimSpace(ev.FormatID) == strings.TrimSpace(enums.HostedEventArenaFormat)
						emitCompetitionPointsAwarded(ctx, a.EventsAPI.DB, gid, ev.Title, c.EntityID, awards, preferArena)
					}
					a.EventsAPI.eventFinishAfterBracket(ctx, c.EntityID, finishedBefore, enums)
					applied++
				}
			}
		}
	}
	return applied
}

// RunCompetitionReadyTimeoutWorker periodically applies ready-check no-show forfeits.
func RunCompetitionReadyTimeoutWorker(ctx context.Context, a *CompetitionReadyTimeoutAPI) {
	if a == nil {
		return
	}
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if a.Settings != nil {
				_ = a.Settings.ReloadClientEnums(ctx)
			}
			n := a.RunReadyTimeoutPass(ctx)
			if n > 0 {
				log.Printf("ready-timeout: auto-forfeit applied n=%d", n)
			}
		}
	}
}
