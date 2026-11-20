package db

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Handle wraps a PostgreSQL pool. Production requires a live database.
type Handle struct {
	Pool *pgxpool.Pool
	URL  string
}

func (h *Handle) Ready() bool {
	return h != nil && h.Pool != nil
}

// Connect opens a pgx pool.
// Empty DATABASE_URL is rejected unless DAMA_ALLOW_MEMORY=1 (local smoke only).
func Connect(databaseURL string) (*Handle, error) {
	if strings.TrimSpace(databaseURL) == "" {
		if os.Getenv("DAMA_ALLOW_MEMORY") == "1" {
			log.Println("db: DAMA_ALLOW_MEMORY=1; in-memory mode (not for production)")
			return &Handle{}, nil
		}
		return nil, fmt.Errorf("DATABASE_URL / DAMA_DATABASE_URL is required (set DAMA_ALLOW_MEMORY=1 only for local smoke without Postgres)")
	}

	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}
	// PgBouncer transaction pooling cannot reuse server-side prepared statements across
	// checkouts; disable the pgx statement cache (simple protocol) to avoid SQLSTATE 42P05.
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	cfg.MaxConns = 20
	cfg.MinConns = 2
	cfg.MaxConnLifetime = time.Hour
	cfg.HealthCheckPeriod = 30 * time.Second

	connCtx, connCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer connCancel()

	pool, err := pgxpool.NewWithConfig(connCtx, cfg)
	if err != nil {
		return nil, fmt.Errorf("connect postgres: %w", err)
	}
	if err := pool.Ping(connCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	h := &Handle{Pool: pool, URL: databaseURL}
	// Remote / pooler migrations need a longer budget than connect+ping.
	if strings.TrimSpace(os.Getenv("DAMA_SKIP_MIGRATE")) == "1" {
		log.Println("db: skipping migrate (DAMA_SKIP_MIGRATE=1)")
	} else {
		migCtx, migCancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer migCancel()
		if err := h.Migrate(migCtx); err != nil {
			pool.Close()
			return nil, fmt.Errorf("migrate: %w", err)
		}
	}
	log.Println("db: postgres pool ready")
	return h, nil
}

func (h *Handle) Close() {
	if h != nil && h.Pool != nil {
		h.Pool.Close()
	}
}

// Migrate applies every numbered *.sql in migrations/ in lexical order (idempotent).
func (h *Handle) Migrate(ctx context.Context) error {
	if !h.Ready() {
		return nil
	}
	dir := findMigrationsDir()
	if dir == "" {
		return fmt.Errorf("migrations directory not found")
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	var files []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if strings.HasSuffix(name, ".sql") {
			files = append(files, name)
		}
	}
	sort.Strings(files)
	if len(files) == 0 {
		return fmt.Errorf("no migration sql files in %s", dir)
	}
	for _, name := range files {
		path := filepath.Join(dir, name)
		sqlBytes, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		if _, err := h.Pool.Exec(ctx, string(sqlBytes)); err != nil {
			return fmt.Errorf("%s: %w", name, err)
		}
		log.Printf("db: applied %s", name)
	}
	return nil
}

func findMigrationsDir() string {
	candidates := []string{
		"migrations",
		filepath.Join("apps", "api", "migrations"),
	}
	if wd, err := os.Getwd(); err == nil {
		candidates = append(candidates,
			filepath.Join(wd, "migrations"),
			filepath.Join(wd, "..", "migrations"),
			filepath.Join(wd, "apps", "api", "migrations"),
		)
	}
	for _, c := range candidates {
		if st, err := os.Stat(c); err == nil && st.IsDir() {
			return c
		}
	}
	return ""
}
