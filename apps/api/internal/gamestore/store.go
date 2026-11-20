package gamestore

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"

	"dama/apps/api/internal/game/engine"
	"dama/apps/api/internal/redisx"

	"github.com/redis/go-redis/v9"
)

const gameKeyPrefix = "dama:game:"
const liveSetKey = "dama:games:live"
const clockActiveSetKey = "dama:games:clock_active"
const playingKeyPrefix = "dama:playing:"
const gameTTL = 24 * time.Hour

func allowMemoryMode() bool {
	return os.Getenv("DAMA_ALLOW_MEMORY") == "1"
}

type GameRecord struct {
	ID    string
	State *engine.State
}

type Store struct {
	mu    sync.RWMutex
	games map[string]*GameRecord
	rdb   *redisx.Client
}

func New(rdb *redisx.Client) *Store {
	return &Store{games: make(map[string]*GameRecord), rdb: rdb}
}

func (s *Store) redisReady() bool {
	return s.rdb != nil && s.rdb.Ready()
}

func (s *Store) Create(id string, state *engine.State) (*GameRecord, error) {
	rec := &GameRecord{ID: id, State: state}
	if s.redisReady() {
		if err := s.persistErr(id, state); err != nil {
			return nil, err
		}
		s.indexLive(id, state)
		s.indexClockActive(id, state)
		s.mu.Lock()
		s.games[id] = rec
		s.mu.Unlock()
		return rec, nil
	}
	if !allowMemoryMode() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	s.mu.Lock()
	s.games[id] = rec
	s.mu.Unlock()
	return rec, nil
}

func (s *Store) Get(id string) (*GameRecord, bool) {
	s.mu.RLock()
	rec, ok := s.games[id]
	s.mu.RUnlock()
	if ok {
		return rec, true
	}
	return s.loadRedis(id)
}

// GetAuthoritative prefers Redis so a concurrent pause on another replica
// is visible before an in-flight move/AI Update can wipe it.
func (s *Store) GetAuthoritative(id string) (*GameRecord, bool) {
	if s.redisReady() {
		if rec, ok := s.loadRedis(id); ok {
			return rec, true
		}
	}
	return s.Get(id)
}

func (s *Store) loadRedis(id string) (*GameRecord, bool) {
	if !s.redisReady() {
		return nil, false
	}
	raw, err := s.rdb.RDB.Get(context.Background(), gameKeyPrefix+id).Bytes()
	if err != nil || len(raw) == 0 {
		return nil, false
	}
	var st engine.State
	if err := json.Unmarshal(raw, &st); err != nil {
		return nil, false
	}
	rec := &GameRecord{ID: id, State: &st}
	s.mu.Lock()
	s.games[id] = rec
	s.mu.Unlock()
	return rec, true
}

func (s *Store) Update(id string, state *engine.State) error {
	if s.redisReady() {
		if err := s.persistErr(id, state); err != nil {
			return err
		}
		s.indexLive(id, state)
		s.indexClockActive(id, state)
		s.mu.Lock()
		s.games[id] = &GameRecord{ID: id, State: state}
		s.mu.Unlock()
		return nil
	}
	if !allowMemoryMode() {
		return fmt.Errorf("service temporarily unavailable")
	}
	s.mu.Lock()
	s.games[id] = &GameRecord{ID: id, State: state}
	s.mu.Unlock()
	return nil
}

// LiveGameSummary is a compact row for the Watch rail.
type LiveGameSummary struct {
	ID            string `json:"id"`
	Mode          string `json:"mode"`
	MoveCount     int    `json:"move_count"`
	Player1ID     string `json:"player1_id,omitempty"`
	Player2ID     string `json:"player2_id,omitempty"`
	Player1Name   string `json:"player1_username,omitempty"`
	Player2Name   string `json:"player2_username,omitempty"`
	Player1Rating int    `json:"player1_rating,omitempty"`
	Player2Rating int    `json:"player2_rating,omitempty"`
}

// ListLiveIDs returns unfinished public PvP game ids (newest first, capped).
func (s *Store) ListLiveIDs(limit int) []string {
	ids, _ := s.ListLiveIDsPaged(0, limit)
	return ids
}

func liveListable(rec *GameRecord) bool {
	if rec == nil || rec.State == nil {
		return false
	}
	if engine.GameOutcome(rec.State) != nil {
		return false
	}
	if rec.State.Mode == "ai" || rec.State.Mode == "practice" {
		return false
	}
	return true
}

// AllListableLiveIDsNewestFirst returns Watch-rail ids only (no AI/practice/finished).
// Redis ZSET may still hold stale members - always filter via Get before paging.
func (s *Store) AllListableLiveIDsNewestFirst() []string {
	return s.allListableLiveIDsNewestFirst()
}

func (s *Store) allListableLiveIDsNewestFirst() []string {
	if s.redisReady() {
		got, err := s.rdb.RDB.ZRevRange(context.Background(), liveSetKey, 0, -1).Result()
		if err == nil {
			out := make([]string, 0, len(got))
			for _, id := range got {
				rec, ok := s.Get(id)
				if !ok || !liveListable(rec) {
					continue
				}
				out = append(out, id)
			}
			return out
		}
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]string, 0, len(s.games))
	for id, rec := range s.games {
		if !liveListable(rec) {
			continue
		}
		out = append(out, id)
	}
	return out
}

// ListLiveIDsPaged returns a skip/limit window of listable live PvP ids plus total.
// limit <= 0 fails closed (no invented default page size).
func (s *Store) ListLiveIDsPaged(skip, limit int) (ids []string, total int) {
	if skip < 0 {
		skip = 0
	}
	if limit <= 0 {
		return []string{}, 0
	}
	all := s.allListableLiveIDsNewestFirst()
	total = len(all)
	if skip >= total {
		return []string{}, total
	}
	end := skip + limit
	if end > total {
		end = total
	}
	return all[skip:end], total
}

// CountPlaying returns how many users currently have a playing key (SCAN).
func (s *Store) CountPlaying(ctx context.Context) (int64, error) {
	if s.redisReady() {
		var cursor uint64
		var total int64
		for {
			keys, next, err := s.rdb.RDB.Scan(ctx, cursor, playingKeyPrefix+"*", 500).Result()
			if err != nil {
				return 0, err
			}
			total += int64(len(keys))
			cursor = next
			if cursor == 0 {
				break
			}
		}
		return total, nil
	}
	if !allowMemoryMode() {
		return 0, fmt.Errorf("game store unavailable")
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	seen := map[string]struct{}{}
	for _, rec := range s.games {
		if rec == nil || rec.State == nil || engine.GameOutcome(rec.State) != nil {
			continue
		}
		if rec.State.Mode == "ai" || rec.State.Mode == "practice" {
			continue
		}
		if rec.State.Player1ID != nil && *rec.State.Player1ID != "" {
			seen[*rec.State.Player1ID] = struct{}{}
		}
		if rec.State.Player2ID != nil && *rec.State.Player2ID != "" {
			seen[*rec.State.Player2ID] = struct{}{}
		}
	}
	return int64(len(seen)), nil
}

// PlayingGameID returns the active game id for a user, if any.
func (s *Store) PlayingGameID(userID string) (string, bool) {
	if userID == "" {
		return "", false
	}
	if s.redisReady() {
		gid, err := s.rdb.RDB.Get(context.Background(), playingKeyPrefix+userID).Result()
		if err == nil && gid != "" {
			return gid, true
		}
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	for id, rec := range s.games {
		if rec == nil || rec.State == nil || engine.GameOutcome(rec.State) != nil {
			continue
		}
		if rec.State.Player1ID != nil && *rec.State.Player1ID == userID {
			return id, true
		}
		if rec.State.Player2ID != nil && *rec.State.Player2ID == userID {
			return id, true
		}
	}
	return "", false
}

func (s *Store) persistErr(id string, state *engine.State) error {
	if state == nil {
		return fmt.Errorf("nil game state")
	}
	raw, err := json.Marshal(state)
	if err != nil {
		return err
	}
	return s.rdb.RDB.Set(context.Background(), gameKeyPrefix+id, raw, gameTTL).Err()
}

func (s *Store) indexLive(id string, state *engine.State) {
	if !s.redisReady() || state == nil {
		return
	}
	ctx := context.Background()
	finished := engine.GameOutcome(state) != nil
	isAI := state.Mode == "ai" || state.Mode == "practice"
	pipe := s.rdb.RDB.Pipeline()
	if finished || isAI {
		pipe.ZRem(ctx, liveSetKey, id)
		if state.Player1ID != nil {
			pipe.Del(ctx, playingKeyPrefix+*state.Player1ID)
		}
		if state.Player2ID != nil {
			pipe.Del(ctx, playingKeyPrefix+*state.Player2ID)
		}
	} else {
		pipe.ZAdd(ctx, liveSetKey, redis.Z{Score: float64(time.Now().Unix()), Member: id})
		pipe.Expire(ctx, liveSetKey, gameTTL)
		if state.Player1ID != nil && *state.Player1ID != "" {
			pipe.Set(ctx, playingKeyPrefix+*state.Player1ID, id, gameTTL)
		}
		if state.Player2ID != nil && *state.Player2ID != "" {
			pipe.Set(ctx, playingKeyPrefix+*state.Player2ID, id, gameTTL)
		}
	}
	_, _ = pipe.Exec(ctx)
}

// indexClockActive tracks unfinished games with an armed match clock (incl. VS-AI)
// so the AFK sweeper can flag-fall without a client claim/GET.
func (s *Store) indexClockActive(id string, state *engine.State) {
	if !s.redisReady() || state == nil {
		return
	}
	ctx := context.Background()
	finished := engine.GameOutcome(state) != nil
	// Paused games stay indexed even if the match clock is off, so the sweeper can auto-resume.
	armed := !finished && (state.ClockActive || state.Paused)
	if armed {
		_ = s.rdb.RDB.ZAdd(ctx, clockActiveSetKey, redis.Z{Score: float64(time.Now().Unix()), Member: id}).Err()
		_ = s.rdb.RDB.Expire(ctx, clockActiveSetKey, gameTTL).Err()
		return
	}
	_ = s.rdb.RDB.ZRem(ctx, clockActiveSetKey, id).Err()
}

func clockActiveListable(rec *GameRecord) bool {
	if rec == nil || rec.State == nil {
		return false
	}
	if engine.GameOutcome(rec.State) != nil {
		return false
	}
	return rec.State.ClockActive || rec.State.Paused
}

// AllClockActiveIDsNewestFirst returns unfinished games with armed clocks or an active pause (PvP + AI).
func (s *Store) AllClockActiveIDsNewestFirst() []string {
	if s.redisReady() {
		got, err := s.rdb.RDB.ZRevRange(context.Background(), clockActiveSetKey, 0, -1).Result()
		if err == nil {
			out := make([]string, 0, len(got))
			for _, id := range got {
				rec, ok := s.Get(id)
				if !ok || !clockActiveListable(rec) {
					continue
				}
				out = append(out, id)
			}
			return out
		}
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]string, 0, len(s.games))
	for id, rec := range s.games {
		if !clockActiveListable(rec) {
			continue
		}
		out = append(out, id)
	}
	return out
}
