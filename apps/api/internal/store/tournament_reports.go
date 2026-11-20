package store

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var (
	ErrTournamentReportNotFound = errors.New("tournament report not found")
	ErrTournamentReportConflict = errors.New("tournament report conflict")
)

type TournamentReport struct {
	ID               string     `json:"id"`
	TournamentID     string     `json:"tournament_id"`
	ReporterID       string     `json:"reporter_id"`
	ReasonCode       string     `json:"reason_code"`
	ReasonLabel      string     `json:"reason_label,omitempty"`
	Note             string     `json:"note"`
	Status           string     `json:"status"`
	ReviewedBy       *string    `json:"reviewed_by,omitempty"`
	ReviewedAt       *time.Time `json:"reviewed_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	TournamentTitle  string     `json:"tournament_title,omitempty"`
	ReporterUsername string     `json:"reporter_username,omitempty"`
}

const tournamentReportSelect = `
	r.id, r.tournament_id, r.reporter_id, r.reason_code, r.note, r.status,
	r.reviewed_by::text, r.reviewed_at, r.created_at,
	COALESCE(t.title, ''), COALESCE(u.username, '')`

func scanTournamentReport(row pgx.Row) (*TournamentReport, error) {
	var r TournamentReport
	var reviewedBy *string
	var reviewedAt *time.Time
	err := row.Scan(
		&r.ID, &r.TournamentID, &r.ReporterID, &r.ReasonCode, &r.Note, &r.Status,
		&reviewedBy, &reviewedAt, &r.CreatedAt,
		&r.TournamentTitle, &r.ReporterUsername,
	)
	if err != nil {
		return nil, err
	}
	r.ReviewedBy, r.ReviewedAt = reviewedBy, reviewedAt
	return &r, nil
}

func (s *TournamentStore) CreateReport(ctx context.Context, tournamentID, reporterID, reasonCode, note, openStatus string) (*TournamentReport, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	reasonCode = strings.TrimSpace(reasonCode)
	if tournamentID == "" || reporterID == "" || reasonCode == "" || openStatus == "" {
		return nil, errors.New("invalid input")
	}
	var id string
	err := s.db.Pool.QueryRow(ctx, `
		INSERT INTO tournament_reports (tournament_id, reporter_id, reason_code, note, status)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id::text`,
		tournamentID, reporterID, reasonCode, strings.TrimSpace(note), openStatus).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "idx_tournament_reports_open_unique") ||
			strings.Contains(err.Error(), "duplicate key") {
			return nil, ErrTournamentReportConflict
		}
		return nil, err
	}
	return s.GetReport(ctx, id)
}

func (s *TournamentStore) GetReport(ctx context.Context, id string) (*TournamentReport, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	row := s.db.Pool.QueryRow(ctx, `
		SELECT `+tournamentReportSelect+`
		FROM tournament_reports r
		LEFT JOIN tournaments t ON t.id = r.tournament_id
		LEFT JOIN users u ON u.id = r.reporter_id
		WHERE r.id = $1`, id)
	rep, err := scanTournamentReport(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrTournamentReportNotFound
	}
	return rep, err
}

func (s *TournamentStore) ListReports(ctx context.Context, status string, skip, limit int) ([]TournamentReport, int, error) {
	if err := s.requireDB(); err != nil {
		return nil, 0, err
	}
	var total int
	var err error
	if strings.TrimSpace(status) == "" {
		err = s.db.Pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM tournament_reports`).Scan(&total)
	} else {
		err = s.db.Pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM tournament_reports WHERE status = $1`, status).Scan(&total)
	}
	if err != nil {
		return nil, 0, err
	}
	var rows pgx.Rows
	if strings.TrimSpace(status) == "" {
		rows, err = s.db.Pool.Query(ctx, `
			SELECT `+tournamentReportSelect+`
			FROM tournament_reports r
			LEFT JOIN tournaments t ON t.id = r.tournament_id
			LEFT JOIN users u ON u.id = r.reporter_id
			ORDER BY r.created_at DESC
			OFFSET $1 LIMIT $2`, skip, limit)
	} else {
		rows, err = s.db.Pool.Query(ctx, `
			SELECT `+tournamentReportSelect+`
			FROM tournament_reports r
			LEFT JOIN tournaments t ON t.id = r.tournament_id
			LEFT JOIN users u ON u.id = r.reporter_id
			WHERE r.status = $1
			ORDER BY r.created_at DESC
			OFFSET $2 LIMIT $3`, status, skip, limit)
	}
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := make([]TournamentReport, 0)
	for rows.Next() {
		rep, err := scanTournamentReport(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, *rep)
	}
	return out, total, rows.Err()
}

func (s *TournamentStore) SetReportStatus(ctx context.Context, id, status, reviewerID string) (*TournamentReport, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	status = strings.TrimSpace(status)
	if status == "" {
		return nil, errors.New("invalid input")
	}
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE tournament_reports
		SET status = $2, reviewed_by = $3::uuid, reviewed_at = NOW()
		WHERE id = $1`, id, status, reviewerID)
	if err != nil {
		return nil, err
	}
	return s.GetReport(ctx, id)
}

// TournamentHasOpenReport is true when the cup has at least one open player report.
func (s *TournamentStore) TournamentHasOpenReport(ctx context.Context, tournamentID, openStatus string) (bool, error) {
	if err := s.requireDB(); err != nil {
		return false, err
	}
	tournamentID = strings.TrimSpace(tournamentID)
	openStatus = strings.TrimSpace(openStatus)
	if tournamentID == "" || openStatus == "" {
		return false, nil
	}
	var n int
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM tournament_reports
		WHERE tournament_id = $1 AND status = $2`, tournamentID, openStatus).Scan(&n)
	return n > 0, err
}
