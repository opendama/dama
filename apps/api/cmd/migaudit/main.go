package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var (
	reCreateTable = regexp.MustCompile(`(?i)CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z0-9_]+)`)
	reAddColumn   = regexp.MustCompile(`(?i)ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z0-9_]+)`)
	// Multi-column ADD: ADD COLUMN IF NOT EXISTS a ..., ADD COLUMN IF NOT EXISTS b ...
	reAddColumnMulti = regexp.MustCompile(`(?i)ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z0-9_]+)`)
	reAlterTableHdr  = regexp.MustCompile(`(?i)ALTER\s+TABLE\s+([a-zA-Z0-9_]+)`)
)

func main() {
	url := strings.TrimSpace(os.Getenv("DAMA_DATABASE_URL"))
	if url == "" {
		url = strings.TrimSpace(os.Getenv("DATABASE_URL"))
	}
	if url == "" {
		fmt.Fprintln(os.Stderr, "FAIL: set DAMA_DATABASE_URL")
		os.Exit(1)
	}

	migDir := findMigrationsDir()
	if migDir == "" {
		fmt.Fprintln(os.Stderr, "FAIL: migrations directory not found")
		os.Exit(1)
	}
	files, err := listSQL(migDir)
	if err != nil {
		panic(err)
	}
	fmt.Println("LOCAL_MIGRATION_COUNT", len(files))
	fmt.Println("LOCAL_FIRST", files[0])
	fmt.Println("LOCAL_LAST", files[len(files)-1])

	tables := map[string]string{}  // table -> first migration
	columns := map[string]string{} // table.col -> first migration
	for _, name := range files {
		raw, err := os.ReadFile(filepath.Join(migDir, name))
		if err != nil {
			panic(err)
		}
		sql := string(raw)
		for _, m := range reCreateTable.FindAllStringSubmatch(sql, -1) {
			t := strings.ToLower(m[1])
			if _, ok := tables[t]; !ok {
				tables[t] = name
			}
		}
		// Per ALTER TABLE block: capture table then ADD COLUMN IF NOT EXISTS names
		parts := reAlterTableHdr.Split(sql, -1)
		headers := reAlterTableHdr.FindAllStringSubmatch(sql, -1)
		for i, h := range headers {
			table := strings.ToLower(h[1])
			body := ""
			if i+1 < len(parts) {
				body = parts[i+1]
			}
			// Stop body at next statement-ish boundary for safety: next ALTER/CREATE
			if idx := strings.Index(strings.ToUpper(body), "CREATE "); idx > 0 {
				body = body[:idx]
			}
			if idx := strings.Index(strings.ToUpper(body), "ALTER TABLE"); idx > 0 {
				body = body[:idx]
			}
			for _, cm := range reAddColumnMulti.FindAllStringSubmatch(body, -1) {
				col := strings.ToLower(cm[1])
				key := table + "." + col
				if _, ok := columns[key]; !ok {
					columns[key] = name
				}
			}
		}
		// Also catch single-line ALTER ... ADD COLUMN IF NOT EXISTS
		for _, m := range reAddColumn.FindAllStringSubmatch(sql, -1) {
			key := strings.ToLower(m[1]) + "." + strings.ToLower(m[2])
			if _, ok := columns[key]; !ok {
				columns[key] = name
			}
		}
	}

	tableNames := make([]string, 0, len(tables))
	for t := range tables {
		tableNames = append(tableNames, t)
	}
	sort.Strings(tableNames)
	colNames := make([]string, 0, len(columns))
	for c := range columns {
		colNames = append(colNames, c)
	}
	sort.Strings(colNames)
	fmt.Println("PARSED_CREATE_TABLES", len(tableNames))
	fmt.Println("PARSED_ADD_COLUMNS", len(colNames))

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		panic(err)
	}
	defer conn.Close(ctx)

	var trackCount int
	_ = conn.QueryRow(ctx, `
		SELECT COUNT(*) FROM information_schema.tables
		WHERE table_schema = 'public' AND table_name IN ('schema_migrations','goose_db_version','flyway_schema_history')
	`).Scan(&trackCount)
	fmt.Println("VERSION_TRACKING_TABLES", trackCount)

	missingTables := []string{}
	for _, t := range tableNames {
		var n int
		_ = conn.QueryRow(ctx, `
			SELECT COUNT(*) FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = $1
		`, t).Scan(&n)
		if n != 1 {
			missingTables = append(missingTables, fmt.Sprintf("%s (from %s)", t, tables[t]))
		}
	}

	missingCols := []string{}
	for _, key := range colNames {
		parts := strings.SplitN(key, ".", 2)
		table, col := parts[0], parts[1]
		var n int
		_ = conn.QueryRow(ctx, `
			SELECT COUNT(*) FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
		`, table, col).Scan(&n)
		if n != 1 {
			missingCols = append(missingCols, fmt.Sprintf("%s (from %s)", key, columns[key]))
		}
	}

	// Notification kinds + chrome (content effects)
	expectedKinds := []string{
		"admin.avatar_pending", "admin.kyc_pending", "admin.payout_pending", "admin.receipt_pending",
		"player.account_status", "player.avatar_reviewed", "player.campaign_status",
		"player.friend_added", "player.friend_removed", "player.game_finished",
		"player.invite_accepted", "player.invite_cancelled", "player.invite_declined",
		"player.invite_expired", "player.invite_received", "player.kyc_reviewed",
		"player.match_found", "player.payout_updated", "player.receipt_reviewed",
		"player.tournament_created", "player.tournament_status", "player.wallet_credited",
	}
	missingKinds := []string{}
	for _, code := range expectedKinds {
		var n int
		_ = conn.QueryRow(ctx, `SELECT COUNT(*) FROM notification_kinds WHERE code = $1`, code).Scan(&n)
		if n != 1 {
			missingKinds = append(missingKinds, code)
		}
	}
	var chromeN int
	_ = conn.QueryRow(ctx, `SELECT COUNT(*) FROM platform_settings WHERE key = 'notification_chrome'`).Scan(&chromeN)

	fmt.Println("MISSING_TABLES", len(missingTables))
	for _, m := range missingTables {
		fmt.Println("  -", m)
	}
	fmt.Println("MISSING_COLUMNS", len(missingCols))
	for _, m := range missingCols {
		fmt.Println("  -", m)
	}
	fmt.Println("MISSING_NOTIF_KINDS", len(missingKinds))
	for _, m := range missingKinds {
		fmt.Println("  -", m)
	}
	if chromeN != 1 {
		fmt.Println("MISSING platform_settings.notification_chrome")
	}

	if len(missingTables) > 0 || len(missingCols) > 0 || len(missingKinds) > 0 || chromeN != 1 {
		fmt.Println("MIGRATION_AUDIT_GAPS")
		os.Exit(1)
	}
	fmt.Println("MIGRATION_AUDIT_OK")
}

func listSQL(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	var out []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if strings.HasSuffix(e.Name(), ".sql") {
			out = append(out, e.Name())
		}
	}
	sort.Strings(out)
	return out, nil
}

func findMigrationsDir() string {
	candidates := []string{
		"migrations",
		filepath.Join("apps", "api", "migrations"),
	}
	if wd, err := os.Getwd(); err == nil {
		candidates = append(candidates,
			filepath.Join(wd, "migrations"),
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
