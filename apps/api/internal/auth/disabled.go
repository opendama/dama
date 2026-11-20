package auth

import (
	"context"
	"strings"

	"dama/apps/api/internal/redisx"
)

// DisabledStore tracks soft-disabled accounts in Redis so existing JWTs stop working instantly.
type DisabledStore struct {
	Redis *redisx.Client
}

func NewDisabledStore(redisClient *redisx.Client) *DisabledStore {
	return &DisabledStore{Redis: redisClient}
}

func disabledKey(userID string) string {
	return "dama:auth:disabled:" + strings.TrimSpace(userID)
}

func (d *DisabledStore) SetDisabled(ctx context.Context, userID string, disabled bool) error {
	if d == nil || d.Redis == nil || !d.Redis.Ready() || strings.TrimSpace(userID) == "" {
		return nil
	}
	key := disabledKey(userID)
	if disabled {
		return d.Redis.RDB.Set(ctx, key, "1", 0).Err()
	}
	return d.Redis.RDB.Del(ctx, key).Err()
}

func (d *DisabledStore) IsDisabled(ctx context.Context, userID string) bool {
	if d == nil || d.Redis == nil || !d.Redis.Ready() || strings.TrimSpace(userID) == "" {
		return false
	}
	n, err := d.Redis.RDB.Exists(ctx, disabledKey(userID)).Result()
	if err != nil {
		// Fail closed: Redis error while checking disable gate treats user as disabled.
		return true
	}
	return n > 0
}
