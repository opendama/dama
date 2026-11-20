package presence

import (
	"context"
	"fmt"
	"os"
	"sync"
	"time"

	"dama/apps/api/internal/redisx"
)

func allowMemoryMode() bool {
	return os.Getenv("DAMA_ALLOW_MEMORY") == "1"
}

type Service struct {
	Redis *redisx.Client
	TTL   time.Duration
	mu    sync.Mutex
	mem   map[string]time.Time
}

func New(redisClient *redisx.Client) *Service {
	return &Service{
		Redis: redisClient,
		TTL:   90 * time.Second,
		mem:   map[string]time.Time{},
	}
}

func (s *Service) redisReady() bool {
	return s.Redis != nil && s.Redis.Ready()
}

func (s *Service) Touch(ctx context.Context, userID string) error {
	if userID == "" {
		return fmt.Errorf("user required")
	}
	if s.redisReady() {
		return s.Redis.RDB.Set(ctx, "dama:presence:"+userID, "1", s.TTL).Err()
	}
	if !allowMemoryMode() {
		return fmt.Errorf("service temporarily unavailable")
	}
	s.mu.Lock()
	s.mem[userID] = time.Now().Add(s.TTL)
	s.mu.Unlock()
	return nil
}

func (s *Service) Online(ctx context.Context, userID string) bool {
	if userID == "" {
		return false
	}
	if s.redisReady() {
		n, err := s.Redis.RDB.Exists(ctx, "dama:presence:"+userID).Result()
		if err == nil {
			return n > 0
		}
		return false
	}
	if !allowMemoryMode() {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	until, ok := s.mem[userID]
	if !ok {
		return false
	}
	if time.Now().After(until) {
		delete(s.mem, userID)
		return false
	}
	return true
}

// CountOnline returns how many presence keys are currently live (SCAN; no invent).
func (s *Service) CountOnline(ctx context.Context) (int64, error) {
	if s.redisReady() {
		return countRedisKeys(ctx, s.Redis, "dama:presence:*")
	}
	if !allowMemoryMode() {
		return 0, fmt.Errorf("presence unavailable")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	var n int64
	for id, until := range s.mem {
		if now.After(until) {
			delete(s.mem, id)
			continue
		}
		n++
	}
	return n, nil
}

func countRedisKeys(ctx context.Context, redisClient *redisx.Client, pattern string) (int64, error) {
	if redisClient == nil || !redisClient.Ready() {
		return 0, fmt.Errorf("redis unavailable")
	}
	var cursor uint64
	var total int64
	for {
		keys, next, err := redisClient.RDB.Scan(ctx, cursor, pattern, 500).Result()
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
