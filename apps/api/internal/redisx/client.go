package redisx

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type Client struct {
	RDB *redis.Client
}

// Connect opens Redis. Empty URL or ping failure is rejected unless DAMA_ALLOW_MEMORY=1.
func Connect(redisURL string) (*Client, error) {
	allowMemory := os.Getenv("DAMA_ALLOW_MEMORY") == "1"
	if strings.TrimSpace(redisURL) == "" {
		if allowMemory {
			log.Println("redis: URL empty; DAMA_ALLOW_MEMORY=1 in-process mode (not for production)")
			return &Client{}, nil
		}
		return nil, fmt.Errorf("DAMA_REDIS_URL is required (set DAMA_ALLOW_MEMORY=1 only for local smoke without Redis)")
	}
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		if allowMemory {
			log.Printf("redis: parse url failed: %v; DAMA_ALLOW_MEMORY=1 in-process mode", err)
			return &Client{}, nil
		}
		return nil, fmt.Errorf("parse redis url: %w", err)
	}
	rdb := redis.NewClient(opt)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		_ = rdb.Close()
		if allowMemory {
			log.Printf("redis: ping failed: %v; DAMA_ALLOW_MEMORY=1 in-process mode", err)
			return &Client{}, nil
		}
		return nil, fmt.Errorf("redis ping: %w", err)
	}
	log.Println("redis: connected")
	return &Client{RDB: rdb}, nil
}

func (c *Client) Ready() bool {
	return c != nil && c.RDB != nil
}

func (c *Client) Close() {
	if c != nil && c.RDB != nil {
		_ = c.RDB.Close()
	}
}
