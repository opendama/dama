package middleware

import (
	"context"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"dama/apps/api/internal/redisx"
)

// RateLimitDeniedBody builds the JSON body for a denied or unavailable rate-limit response.
// unavailable=true means the limiter itself failed (503); false means budget exceeded (429).
type RateLimitDeniedBody func(r *http.Request, unavailable bool) (status int, jsonBody string)

// RateLimit is a leaky-bucket limiter (Redis Lua when available; in-memory only with DAMA_ALLOW_MEMORY=1).
type RateLimit struct {
	Redis     *redisx.Client
	PerMinute int
	mu        sync.Mutex
	buckets   map[string]*memBucket
}

type memBucket struct {
	tokens float64
	last   time.Time
}

const leakyBucketLua = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
if tokens == nil then
  tokens = capacity
  ts = now
end
local elapsed = now - ts
if elapsed < 0 then elapsed = 0 end
tokens = math.min(capacity, tokens + elapsed * rate)
local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end
redis.call('HMSET', key, 'tokens', tokens, 'ts', now)
redis.call('EXPIRE', key, 120)
return allowed
`

func NewRateLimit(redisClient *redisx.Client, perMinute int) *RateLimit {
	if perMinute <= 0 {
		perMinute = 120
	}
	return &RateLimit{
		Redis:     redisClient,
		PerMinute: perMinute,
		buckets:   map[string]*memBucket{},
	}
}

func allowMemoryMode() bool {
	return os.Getenv("DAMA_ALLOW_MEMORY") == "1"
}

func (rl *RateLimit) Handler(next http.Handler) http.Handler {
	return rl.HandlerScoped("")(next)
}

// HandlerScoped isolates a route-family budget (e.g. official pause) from the global IP bucket.
func (rl *RateLimit) HandlerScoped(scope string) func(http.Handler) http.Handler {
	return rl.HandlerScopedBody(scope, nil)
}

// HandlerScopedBody is HandlerScoped with optional DB-backed denied bodies (fail closed empty).
func (rl *RateLimit) HandlerScopedBody(scope string, body RateLimitDeniedBody) func(http.Handler) http.Handler {
	scope = strings.TrimSpace(scope)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			path := r.URL.Path
			// Liveness/readiness must never compete with the global IP budget.
			if path == "/healthz" || path == "/readyz" {
				next.ServeHTTP(w, r)
				return
			}
			key := clientKey(r)
			// Isolate OAuth mint so a login UI bug cannot exhaust the global IP budget
			// (and Strict Mode double-mount does not starve every other API route).
			if strings.HasSuffix(path, "/auth/oauth/supabase") {
				key = key + ":oauth"
			}
			if scope != "" {
				key = key + ":" + scope
			}
			allowed, err := rl.allow(r.Context(), key)
			if err != nil {
				if body != nil {
					status, jsonBody := body(r, true)
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(status)
					_, _ = w.Write([]byte(jsonBody))
					return
				}
				http.Error(w, `{"error":"rate limiter unavailable"}`, http.StatusServiceUnavailable)
				return
			}
			if !allowed {
				if body != nil {
					status, jsonBody := body(r, false)
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(status)
					_, _ = w.Write([]byte(jsonBody))
					return
				}
				http.Error(w, `{"error":"rate limit exceeded"}`, http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func clientKey(r *http.Request) string {
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		ip = r.RemoteAddr
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		ip = xff
	}
	uid := r.Header.Get("X-User-ID")
	device := r.Header.Get("X-Device-ID")
	return "ip:" + ip + ":u:" + uid + ":d:" + device
}

func (rl *RateLimit) allow(ctx context.Context, key string) (bool, error) {
	if rl.Redis != nil && rl.Redis.Ready() {
		rctx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
		defer cancel()
		pipeKey := "dama:rl:lb:" + key
		capacity := float64(rl.PerMinute)
		rate := capacity / 60.0
		now := float64(time.Now().UnixMilli()) / 1000.0
		res, err := rl.Redis.RDB.Eval(rctx, leakyBucketLua, []string{pipeKey}, capacity, rate, now).Result()
		if err != nil {
			if allowMemoryMode() {
				return rl.allowMemory(key), nil
			}
			return false, err
		}
		switch v := res.(type) {
		case int64:
			return v == 1, nil
		case int:
			return v == 1, nil
		default:
			return false, nil
		}
	}
	if allowMemoryMode() {
		return rl.allowMemory(key), nil
	}
	return false, context.DeadlineExceeded
}

func (rl *RateLimit) allowMemory(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	b, ok := rl.buckets[key]
	if !ok {
		rl.buckets[key] = &memBucket{tokens: float64(rl.PerMinute - 1), last: now}
		return true
	}
	elapsed := now.Sub(b.last).Seconds()
	b.tokens += elapsed * (float64(rl.PerMinute) / 60.0)
	if b.tokens > float64(rl.PerMinute) {
		b.tokens = float64(rl.PerMinute)
	}
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}
