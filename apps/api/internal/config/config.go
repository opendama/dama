package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Host                string
	Port                string
	DatabaseURL         string
	RedisURL            string
	JWTSecret           string
	CORSOrigins         []string
	CloudinaryCloudName string
	CloudinaryAPIKey    string
	CloudinaryAPISecret string
	UploadDir           string
	ChapaSecretKey      string
	ChapaPublicKey      string
	ChapaEncryptionKey  string
	ChapaWebhookSecret  string
	ChapaBaseURL        string
	PaddleAPIKey        string
	PaddleWebhookSecret string
	PaddleClientToken   string
	PaddleEnv           string // live | sandbox
	PaddleAPIBase       string // https://api.paddle.com | https://sandbox-api.paddle.com
	PublicAPIBase       string
	RateLimitPerMinute  int
	SecretsKey          string
	AllowLocalMedia     bool
	AllowYouTubeStub    bool
	// MediaPublicBase is the client-facing media origin (custom CDN/CNAME).
	// When set, avatar URLs never embed the upstream CDN vendor hostname.
	MediaPublicBase string
	// Supabase Auth (Google social sign-in). URL required for JWKS; JWT secret for legacy HS256.
	SupabaseURL            string
	SupabaseJWTSecret      string
	SupabaseAnonKey        string // legacy anon JWT (server-side calls if needed)
	SupabaseServiceRoleKey string // server-only; never expose to clients
	SupabasePublishableKey string // new publishable key
	SupabaseSecretKey      string // new secret key; server-only
	SupabaseProjectRef     string
	// ReadyzTimeoutSec is the CLI/Docker -readyz and GET /readyz probe budget.
	ReadyzTimeoutSec int
}

func Load() Config {
	origins := firstNonEmpty(
		os.Getenv("CORS_ORIGINS"),
		os.Getenv("DAMA_CORS_ORIGINS"),
		// Local Next: 3000 default; 3200/3201 when Hyper-V excludes the 2918–3117 range.
		"http://localhost:3000,http://127.0.0.1:3000,http://localhost:3200,http://127.0.0.1:3200,http://localhost:3201,http://127.0.0.1:3201",
	)
	parts := strings.Split(origins, ",")
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}

	return Config{
		Host: getenv("DAMA_API_HOST", "0.0.0.0"),
		Port: firstNonEmpty(os.Getenv("PORT"), os.Getenv("DAMA_API_PORT"), "8080"),
		DatabaseURL: firstNonEmpty(
			os.Getenv("DATABASE_URL"),
			os.Getenv("DAMA_DATABASE_URL"),
			"",
		),
		RedisURL: firstNonEmpty(
			os.Getenv("REDIS_URL"),
			os.Getenv("DAMA_REDIS_URL"),
		),
		JWTSecret: firstNonEmpty(
			os.Getenv("JWT_SECRET"),
			os.Getenv("DAMA_JWT_SECRET"),
		),
		CORSOrigins:         parts,
		CloudinaryCloudName: firstNonEmpty(os.Getenv("CLOUDINARY_CLOUD_NAME"), os.Getenv("DAMA_CLOUDINARY_CLOUD_NAME"), ""),
		CloudinaryAPIKey:    firstNonEmpty(os.Getenv("CLOUDINARY_API_KEY"), os.Getenv("DAMA_CLOUDINARY_API_KEY"), ""),
		CloudinaryAPISecret: firstNonEmpty(os.Getenv("CLOUDINARY_API_SECRET"), os.Getenv("DAMA_CLOUDINARY_API_SECRET"), ""),
		UploadDir:           getenv("DAMA_UPLOAD_DIR", "./uploads"),
		ChapaSecretKey:      firstNonEmpty(os.Getenv("CHAPA_SECRET_KEY"), os.Getenv("DAMA_CHAPA_SECRET_KEY"), ""),
		ChapaPublicKey:      firstNonEmpty(os.Getenv("CHAPA_PUBLIC_KEY"), os.Getenv("DAMA_CHAPA_PUBLIC_KEY"), ""),
		ChapaEncryptionKey:  firstNonEmpty(os.Getenv("CHAPA_ENCRYPTION_KEY"), os.Getenv("DAMA_CHAPA_ENCRYPTION_KEY"), ""),
		ChapaWebhookSecret:  firstNonEmpty(os.Getenv("CHAPA_WEBHOOK_SECRET"), os.Getenv("DAMA_CHAPA_WEBHOOK_SECRET"), ""),
		ChapaBaseURL: strings.TrimRight(firstNonEmpty(
			os.Getenv("CHAPA_BASE_URL"),
			os.Getenv("DAMA_CHAPA_BASE_URL"),
			"https://api.chapa.co/v1",
		), "/"),
		PaddleAPIKey:        firstNonEmpty(os.Getenv("PADDLE_API_KEY"), os.Getenv("DAMA_PADDLE_API_KEY"), ""),
		PaddleWebhookSecret: firstNonEmpty(os.Getenv("PADDLE_WEBHOOK_SECRET"), os.Getenv("DAMA_PADDLE_WEBHOOK_SECRET"), ""),
		PaddleClientToken:   firstNonEmpty(os.Getenv("PADDLE_CLIENT_TOKEN"), os.Getenv("DAMA_PADDLE_CLIENT_TOKEN"), ""),
		PaddleEnv:           paddleEnv(),
		PaddleAPIBase:       paddleAPIBase(),
		PublicAPIBase:       getenv("DAMA_PUBLIC_API_BASE", "http://localhost:8080"),
		RateLimitPerMinute:  getenvInt("DAMA_RATE_LIMIT_PER_MINUTE", 120),
		SecretsKey: firstNonEmpty(
			os.Getenv("DAMA_SECRETS_KEY"),
			os.Getenv("SECRETS_ENCRYPTION_KEY"),
			os.Getenv("JWT_SECRET"),
			os.Getenv("DAMA_JWT_SECRET"),
		),
		AllowLocalMedia:  getenv("DAMA_ALLOW_LOCAL_MEDIA", "false") == "true",
		AllowYouTubeStub: getenv("DAMA_ALLOW_YT_STUB", "false") == "true",
		MediaPublicBase: strings.TrimRight(firstNonEmpty(
			os.Getenv("DAMA_MEDIA_PUBLIC_BASE"),
			os.Getenv("MEDIA_PUBLIC_BASE"),
		), "/"),
		SupabaseURL: strings.TrimRight(firstNonEmpty(
			os.Getenv("SUPABASE_URL"),
			os.Getenv("DAMA_SUPABASE_URL"),
			os.Getenv("NEXT_PUBLIC_SUPABASE_URL"),
		), "/"),
		SupabaseJWTSecret: firstNonEmpty(
			os.Getenv("SUPABASE_JWT_SECRET"),
			os.Getenv("DAMA_SUPABASE_JWT_SECRET"),
		),
		SupabaseAnonKey: firstNonEmpty(
			os.Getenv("SUPABASE_ANON_KEY"),
			os.Getenv("DAMA_SUPABASE_ANON_KEY"),
		),
		SupabaseServiceRoleKey: firstNonEmpty(
			os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
			os.Getenv("DAMA_SUPABASE_SERVICE_ROLE_KEY"),
		),
		SupabasePublishableKey: firstNonEmpty(
			os.Getenv("SUPABASE_PUBLISHABLE_KEY"),
			os.Getenv("DAMA_SUPABASE_PUBLISHABLE_KEY"),
		),
		SupabaseSecretKey: firstNonEmpty(
			os.Getenv("SUPABASE_SECRET_KEY"),
			os.Getenv("DAMA_SUPABASE_SECRET_KEY"),
		),
		SupabaseProjectRef: firstNonEmpty(
			os.Getenv("SUPABASE_PROJECT_REF"),
			os.Getenv("DAMA_SUPABASE_PROJECT_REF"),
		),
		ReadyzTimeoutSec: readyzTimeoutSec(),
	}
}

// readyzTimeoutSec returns DAMA_READYZ_TIMEOUT_SEC clamped to 1..60 (default 5).
func readyzTimeoutSec() int {
	n := getenvInt("DAMA_READYZ_TIMEOUT_SEC", 5)
	if n < 1 {
		return 5
	}
	if n > 60 {
		return 60
	}
	return n
}

// AllowDevSecrets is local smoke only. Never enable in production.
func AllowDevSecrets() bool {
	return os.Getenv("DAMA_ALLOW_DEV_SECRETS") == "1"
}

func (c Config) Addr() string {
	return c.Host + ":" + c.Port
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func getenvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

// paddleEnv returns live|sandbox from PADDLE_ENV / DAMA_PADDLE_ENV (default live).
func paddleEnv() string {
	env := strings.ToLower(strings.TrimSpace(firstNonEmpty(
		os.Getenv("PADDLE_ENV"),
		os.Getenv("DAMA_PADDLE_ENV"),
		"live",
	)))
	switch env {
	case "sandbox", "sdbx", "test":
		return "sandbox"
	default:
		return "live"
	}
}

// paddleAPIBase picks the official Paddle Billing host for the configured env.
// Docs: live https://api.paddle.com | sandbox https://sandbox-api.paddle.com
func paddleAPIBase() string {
	if override := strings.TrimRight(firstNonEmpty(
		os.Getenv("PADDLE_API_BASE"),
		os.Getenv("DAMA_PADDLE_API_BASE"),
	), "/"); override != "" {
		return override
	}
	if paddleEnv() == "sandbox" {
		return "https://sandbox-api.paddle.com"
	}
	return "https://api.paddle.com"
}
