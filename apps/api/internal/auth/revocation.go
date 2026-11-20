package auth

import (
	"context"
	"fmt"
	"os"
	"sync"
	"time"

	"dama/apps/api/internal/redisx"
)

// RevocationList stores revoked JWT IDs (jti) until expiry in Redis (Layer 5).
type RevocationList struct {
	Redis *redisx.Client
	mu    sync.Mutex
	mem   map[string]time.Time
}

func NewRevocationList(redisClient *redisx.Client) *RevocationList {
	return &RevocationList{
		Redis: redisClient,
		mem:   map[string]time.Time{},
	}
}

func allowMemoryMode() bool {
	return os.Getenv("DAMA_ALLOW_MEMORY") == "1"
}

func (r *RevocationList) Revoke(ctx context.Context, jti string, until time.Time) error {
	if jti == "" {
		return nil
	}
	ttl := time.Until(until)
	if ttl <= 0 {
		ttl = time.Hour
	}
	if r.Redis != nil && r.Redis.Ready() {
		key := "dama:jwt:revoked:" + jti
		return r.Redis.RDB.Set(ctx, key, "1", ttl).Err()
	}
	if allowMemoryMode() {
		r.mu.Lock()
		r.mem[jti] = until
		r.mu.Unlock()
		return nil
	}
	return fmt.Errorf("service temporarily unavailable")
}

func (r *RevocationList) IsRevoked(ctx context.Context, jti string) bool {
	if jti == "" {
		return false
	}
	if r.Redis != nil && r.Redis.Ready() {
		n, err := r.Redis.RDB.Exists(ctx, "dama:jwt:revoked:"+jti).Result()
		if err == nil {
			return n > 0
		}
		if !allowMemoryMode() {
			// Redis error while required: treat as revoked (fail closed).
			return true
		}
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	until, ok := r.mem[jti]
	if !ok {
		return false
	}
	if time.Now().After(until) {
		delete(r.mem, jti)
		return false
	}
	return true
}
