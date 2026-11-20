package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"dama/apps/api/internal/db"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type DMRequest struct {
	ID            string     `json:"id"`
	FromUserID    string     `json:"from_user_id"`
	ToUserID      string     `json:"to_user_id"`
	ThreadID      *string    `json:"thread_id,omitempty"`
	Body          *string    `json:"body,omitempty"`
	ImageURL      *string    `json:"image_url,omitempty"`
	Status        string     `json:"status"`
	CreatedAt     time.Time  `json:"created_at"`
	Preview       string     `json:"preview"`
	Side          string     `json:"side,omitempty"` // in | out
	UnreadCount   int        `json:"unread_count"`
	LastMessageAt *time.Time `json:"last_message_at,omitempty"`
}

type DMMessage struct {
	ID           string            `json:"id"`
	ThreadID     string            `json:"thread_id"`
	UserID       string            `json:"user_id"`
	Username     string            `json:"username"`
	AvatarThumb  *string           `json:"avatar_thumb_url,omitempty"`
	CountryCode  *string           `json:"country_code,omitempty"`
	Body         *string           `json:"body,omitempty"`
	ImageURL     *string           `json:"image_url,omitempty"`
	ReplyToID    *string           `json:"reply_to_id,omitempty"`
	ReplyPreview *string           `json:"reply_preview,omitempty"`
	RequestID    *string           `json:"request_id,omitempty"`
	ClientID     *string           `json:"client_id,omitempty"` // Telegram outbox idempotency key
	Reactions    []ChatReactionAgg `json:"reactions"`
	Receipt      string            `json:"receipt,omitempty"` // sent | read (outbound only; delivered chrome retained unused)
	CreatedAt    time.Time         `json:"created_at"`
}

func isPgUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

type DMStore struct {
	db *db.Handle
}

func NewDMStore(handle *db.Handle) *DMStore {
	return &DMStore{db: handle}
}

func (s *DMStore) requireDB() error {
	if s == nil || s.db == nil || !s.db.Ready() {
		return fmt.Errorf("database unavailable")
	}
	return nil
}

func orderedPair(a, b string) (low, high string) {
	if a < b {
		return a, b
	}
	return b, a
}

func dmPreview(body, imageURL *string, maxChars int, suffix, imageLabel string) string {
	text := ""
	if body != nil {
		text = strings.TrimSpace(*body)
	}
	if text == "" && imageURL != nil && strings.TrimSpace(*imageURL) != "" {
		// Image-only: label must come from DB chrome (no invented glyph).
		return strings.TrimSpace(imageLabel)
	}
	// Fail closed: truncate only when chrome supplies max + suffix (no invented 20 / "...").
	if maxChars <= 0 || strings.TrimSpace(suffix) == "" {
		return text
	}
	runes := []rune(text)
	if len(runes) <= maxChars {
		return text
	}
	return string(runes[:maxChars]) + suffix
}

func (s *DMStore) EnsureThread(ctx context.Context, userA, userB string) (string, error) {
	if err := s.requireDB(); err != nil {
		return "", err
	}
	low, high := orderedPair(userA, userB)
	var id string
	err := s.db.Pool.QueryRow(ctx, `
		INSERT INTO dm_threads (user_low, user_high)
		VALUES ($1::uuid, $2::uuid)
		ON CONFLICT (user_low, user_high) DO UPDATE SET user_low = EXCLUDED.user_low
		RETURNING id::text
	`, low, high).Scan(&id)
	return id, err
}

type DMPreviewOpts struct {
	MaxChars   int
	Suffix     string
	ImageLabel string
}

func (s *DMStore) CreateRequest(
	ctx context.Context,
	fromID, toID string,
	body, imageURL *string,
	clientID string,
	preview DMPreviewOpts,
) (req *DMRequest, created bool, err error) {
	if err := s.requireDB(); err != nil {
		return nil, false, err
	}
	b := ""
	if body != nil {
		b = strings.TrimSpace(*body)
	}
	img := ""
	if imageURL != nil {
		img = strings.TrimSpace(*imageURL)
	}
	if b == "" && img == "" {
		return nil, false, fmt.Errorf("message required")
	}
	clientID = strings.TrimSpace(clientID)
	// Telegram outbox: same client_id retry returns the existing request (no duplicate).
	if clientID != "" {
		if existing, e := s.MessageByUserClientID(ctx, fromID, clientID, preview); e != nil {
			return nil, false, e
		} else if existing != nil && existing.RequestID != nil && strings.TrimSpace(*existing.RequestID) != "" {
			r, e2 := s.GetRequest(ctx, strings.TrimSpace(*existing.RequestID), preview)
			return r, false, e2
		}
	}
	// Friend-request parity: at most one pending DM between a pair.
	var pending bool
	if err := s.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM dm_requests
			WHERE status = 'pending'
			  AND (
				(from_user_id = $1::uuid AND to_user_id = $2::uuid)
				OR (from_user_id = $2::uuid AND to_user_id = $1::uuid)
			  )
		)
	`, fromID, toID).Scan(&pending); err != nil {
		return nil, false, err
	}
	if pending {
		return nil, false, fmt.Errorf("dm request already pending")
	}
	threadID, err := s.EnsureThread(ctx, fromID, toID)
	if err != nil {
		return nil, false, err
	}
	id := uuid.NewString()
	var bodyArg, imgArg, clientArg any
	if b != "" {
		bodyArg = b
	}
	if img != "" {
		imgArg = img
	}
	if clientID != "" {
		clientArg = clientID
	}
	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO dm_requests (id, from_user_id, to_user_id, thread_id, body, image_url, status)
		VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, 'pending')
	`, id, fromID, toID, threadID, bodyArg, imgArg)
	if err != nil {
		return nil, false, err
	}
	msgID := uuid.NewString()
	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO dm_messages (id, thread_id, user_id, body, image_url, request_id, client_id)
		VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::uuid, $7)
	`, msgID, threadID, fromID, bodyArg, imgArg, id, clientArg)
	if err != nil {
		if isPgUniqueViolation(err) && clientID != "" {
			if existing, e2 := s.MessageByUserClientID(ctx, fromID, clientID, preview); e2 != nil {
				return nil, false, e2
			} else if existing != nil && existing.RequestID != nil && strings.TrimSpace(*existing.RequestID) != "" {
				r, e3 := s.GetRequest(ctx, strings.TrimSpace(*existing.RequestID), preview)
				return r, false, e3
			}
		}
		return nil, false, err
	}
	r, e4 := s.GetRequest(ctx, id, preview)
	return r, true, e4
}

func (s *DMStore) GetRequest(ctx context.Context, id string, preview DMPreviewOpts) (*DMRequest, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	var r DMRequest
	var threadID *string
	err := s.db.Pool.QueryRow(ctx, `
		SELECT id::text, from_user_id::text, to_user_id::text, thread_id::text,
		       body, image_url, status, created_at
		FROM dm_requests WHERE id = $1::uuid
	`, id).Scan(
		&r.ID, &r.FromUserID, &r.ToUserID, &threadID,
		&r.Body, &r.ImageURL, &r.Status, &r.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	r.ThreadID = threadID
	r.Preview = dmPreview(r.Body, r.ImageURL, preview.MaxChars, preview.Suffix, preview.ImageLabel)
	return &r, nil
}

func (s *DMStore) CountPendingIncoming(ctx context.Context, userID string) (int, error) {
	if err := s.requireDB(); err != nil {
		return 0, err
	}
	var n int
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM dm_requests
		WHERE to_user_id = $1::uuid AND status = 'pending'
	`, userID).Scan(&n)
	return n, err
}

func (s *DMStore) ListRequests(ctx context.Context, userID string, preview DMPreviewOpts) (incoming, outgoing []DMRequest, err error) {
	if err := s.requireDB(); err != nil {
		return nil, nil, err
	}
	scan := func(side string, q string, arg string) ([]DMRequest, error) {
		rows, err := s.db.Pool.Query(ctx, q, arg)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		out := []DMRequest{}
		for rows.Next() {
			var r DMRequest
			var threadID *string
			if err := rows.Scan(
				&r.ID, &r.FromUserID, &r.ToUserID, &threadID,
				&r.Body, &r.ImageURL, &r.Status, &r.CreatedAt,
			); err != nil {
				return nil, err
			}
			r.ThreadID = threadID
			r.Side = side
			r.Preview = dmPreview(r.Body, r.ImageURL, preview.MaxChars, preview.Suffix, preview.ImageLabel)
			out = append(out, r)
		}
		return out, rows.Err()
	}
	incoming, err = scan("in", `
		SELECT id::text, from_user_id::text, to_user_id::text, thread_id::text,
		       body, image_url, status, created_at
		FROM dm_requests
		WHERE to_user_id = $1::uuid AND status <> 'cancelled'
		ORDER BY created_at DESC LIMIT 100
	`, userID)
	if err != nil {
		return nil, nil, err
	}
	outgoing, err = scan("out", `
		SELECT id::text, from_user_id::text, to_user_id::text, thread_id::text,
		       body, image_url, status, created_at
		FROM dm_requests
		WHERE from_user_id = $1::uuid AND status <> 'cancelled'
		ORDER BY created_at DESC LIMIT 100
	`, userID)
	if err != nil {
		return nil, nil, err
	}
	if err := s.EnrichDMRequestActivity(ctx, userID, incoming, preview); err != nil {
		return nil, nil, err
	}
	if err := s.EnrichDMRequestActivity(ctx, userID, outgoing, preview); err != nil {
		return nil, nil, err
	}
	return incoming, outgoing, nil
}

// ListRequestsPaged returns a Trim skip/limit page of DM requests (in+out) plus total.
// Optional q filters by peer username (case-insensitive substring) with relevance ranking.
func (s *DMStore) ListRequestsPaged(ctx context.Context, userID string, skip, limit int, preview DMPreviewOpts, q string) ([]DMRequest, int, error) {
	if err := s.requireDB(); err != nil {
		return nil, 0, err
	}
	if skip < 0 {
		skip = 0
	}
	if limit <= 0 {
		return nil, 0, fmt.Errorf("limit required")
	}
	needle := strings.TrimSpace(q)
	var total int
	if err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM dm_requests dr
		WHERE (dr.to_user_id = $1::uuid OR dr.from_user_id = $1::uuid)
		  AND dr.status <> 'cancelled'
		  AND (
		    $2 = '' OR EXISTS (
		      SELECT 1 FROM users u
		      WHERE u.id = CASE
		        WHEN dr.to_user_id = $1::uuid THEN dr.from_user_id
		        ELSE dr.to_user_id
		      END
		      AND lower(u.username) LIKE '%' || lower($2) || '%'
		    )
		  )
	`, userID, needle).Scan(&total); err != nil {
		return nil, 0, err
	}
	orderSQL := `ORDER BY dr.created_at DESC, dr.id ASC`
	if needle != "" {
		orderSQL = `ORDER BY
			CASE
				WHEN lower(u.username) = lower($2) THEN 0
				WHEN lower(u.username) LIKE lower($2) || '%' THEN 1
				ELSE 2
			END,
			dr.created_at DESC, dr.id ASC`
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT dr.id::text, dr.from_user_id::text, dr.to_user_id::text, dr.thread_id::text,
		       dr.body, dr.image_url, dr.status, dr.created_at
		FROM dm_requests dr
		LEFT JOIN users u ON u.id = CASE
		  WHEN dr.to_user_id = $1::uuid THEN dr.from_user_id
		  ELSE dr.to_user_id
		END
		WHERE (dr.to_user_id = $1::uuid OR dr.from_user_id = $1::uuid)
		  AND dr.status <> 'cancelled'
		  AND ($2 = '' OR (u.username IS NOT NULL AND lower(u.username) LIKE '%' || lower($2) || '%'))
		`+orderSQL+`
		LIMIT $3 OFFSET $4
	`, userID, needle, limit, skip)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := make([]DMRequest, 0, limit)
	for rows.Next() {
		var r DMRequest
		var threadID *string
		if err := rows.Scan(
			&r.ID, &r.FromUserID, &r.ToUserID, &threadID,
			&r.Body, &r.ImageURL, &r.Status, &r.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		r.ThreadID = threadID
		if r.ToUserID == userID {
			r.Side = "in"
		} else {
			r.Side = "out"
		}
		r.Preview = dmPreview(r.Body, r.ImageURL, preview.MaxChars, preview.Suffix, preview.ImageLabel)
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	if err := s.EnrichDMRequestActivity(ctx, userID, out, preview); err != nil {
		return nil, 0, err
	}
	return out, total, nil
}

// EnrichDMRequestActivity overlays Telegram-style list fields: latest-message preview
// and unread_count (peer messages after the viewer's dm_thread_reads watermark).
func (s *DMStore) EnrichDMRequestActivity(ctx context.Context, viewerID string, rows []DMRequest, preview DMPreviewOpts) error {
	if err := s.requireDB(); err != nil {
		return err
	}
	if len(rows) == 0 {
		return nil
	}
	viewerID = strings.TrimSpace(viewerID)
	ids := make([]string, 0, len(rows))
	seen := map[string]struct{}{}
	for i := range rows {
		if rows[i].ThreadID == nil {
			continue
		}
		tid := strings.TrimSpace(*rows[i].ThreadID)
		if tid == "" {
			continue
		}
		if _, ok := seen[tid]; ok {
			continue
		}
		seen[tid] = struct{}{}
		ids = append(ids, tid)
	}
	if len(ids) == 0 {
		return nil
	}

	type lastMsg struct {
		body, image *string
		at          time.Time
	}
	lastByThread := map[string]lastMsg{}
	lastRows, err := s.db.Pool.Query(ctx, `
		SELECT DISTINCT ON (thread_id)
		       thread_id::text, body, image_url, created_at
		FROM dm_messages
		WHERE thread_id = ANY($1::uuid[])
		ORDER BY thread_id, created_at DESC
	`, ids)
	if err != nil {
		return err
	}
	defer lastRows.Close()
	for lastRows.Next() {
		var tid string
		var body, image *string
		var at time.Time
		if err := lastRows.Scan(&tid, &body, &image, &at); err != nil {
			return err
		}
		lastByThread[tid] = lastMsg{body: body, image: image, at: at}
	}
	if err := lastRows.Err(); err != nil {
		return err
	}

	// Messages + peer reactions after watermark (Telegram: a reaction bumps unread).
	unreadByThread := map[string]int{}
	unreadRows, err := s.db.Pool.Query(ctx, `
		SELECT tid, SUM(n)::int FROM (
			SELECT m.thread_id::text AS tid, COUNT(*)::int AS n
			FROM dm_messages m
			LEFT JOIN dm_thread_reads r
			  ON r.thread_id = m.thread_id AND r.user_id = $2::uuid
			LEFT JOIN dm_messages lm
			  ON lm.id = r.last_read_message_id
			WHERE m.thread_id = ANY($1::uuid[])
			  AND m.user_id <> $2::uuid
			  AND m.created_at > COALESCE(lm.created_at, r.last_read_at, TIMESTAMPTZ '-infinity')
			GROUP BY m.thread_id
			UNION ALL
			SELECT m.thread_id::text AS tid, COUNT(*)::int AS n
			FROM dm_message_reactions rx
			INNER JOIN dm_messages m ON m.id = rx.message_id
			LEFT JOIN dm_thread_reads r
			  ON r.thread_id = m.thread_id AND r.user_id = $2::uuid
			LEFT JOIN dm_messages lm
			  ON lm.id = r.last_read_message_id
			WHERE m.thread_id = ANY($1::uuid[])
			  AND rx.user_id <> $2::uuid
			  AND rx.created_at > COALESCE(lm.created_at, r.last_read_at, TIMESTAMPTZ '-infinity')
			GROUP BY m.thread_id
		) u
		GROUP BY tid
	`, ids, viewerID)
	if err != nil {
		return err
	}
	defer unreadRows.Close()
	for unreadRows.Next() {
		var tid string
		var n int
		if err := unreadRows.Scan(&tid, &n); err != nil {
			return err
		}
		unreadByThread[tid] = n
	}
	if err := unreadRows.Err(); err != nil {
		return err
	}

	for i := range rows {
		if rows[i].ThreadID == nil {
			continue
		}
		tid := strings.TrimSpace(*rows[i].ThreadID)
		if tid == "" {
			continue
		}
		if last, ok := lastByThread[tid]; ok {
			rows[i].Preview = dmPreview(last.body, last.image, preview.MaxChars, preview.Suffix, preview.ImageLabel)
			at := last.at
			rows[i].LastMessageAt = &at
			rows[i].Body = last.body
			rows[i].ImageURL = last.image
		}
		rows[i].UnreadCount = unreadByThread[tid]
	}
	return nil
}

// CountUnreadMessages totals peer messages after the viewer's read watermark across all threads.
func (s *DMStore) CountUnreadMessages(ctx context.Context, viewerID string) (int, error) {
	if err := s.requireDB(); err != nil {
		return 0, err
	}
	viewerID = strings.TrimSpace(viewerID)
	if viewerID == "" {
		return 0, nil
	}
	var n int
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(n), 0)::int FROM (
			SELECT COUNT(*)::int AS n
			FROM dm_messages m
			INNER JOIN dm_threads t ON t.id = m.thread_id
			LEFT JOIN dm_thread_reads r
			  ON r.thread_id = m.thread_id AND r.user_id = $1::uuid
			LEFT JOIN dm_messages lm
			  ON lm.id = r.last_read_message_id
			WHERE (t.user_low = $1::uuid OR t.user_high = $1::uuid)
			  AND m.user_id <> $1::uuid
			  AND m.created_at > COALESCE(lm.created_at, r.last_read_at, TIMESTAMPTZ '-infinity')
			UNION ALL
			SELECT COUNT(*)::int AS n
			FROM dm_message_reactions rx
			INNER JOIN dm_messages m ON m.id = rx.message_id
			INNER JOIN dm_threads t ON t.id = m.thread_id
			LEFT JOIN dm_thread_reads r
			  ON r.thread_id = m.thread_id AND r.user_id = $1::uuid
			LEFT JOIN dm_messages lm
			  ON lm.id = r.last_read_message_id
			WHERE (t.user_low = $1::uuid OR t.user_high = $1::uuid)
			  AND rx.user_id <> $1::uuid
			  AND rx.created_at > COALESCE(lm.created_at, r.last_read_at, TIMESTAMPTZ '-infinity')
		) u
	`, viewerID).Scan(&n)
	return n, err
}

func (s *DMStore) Accept(ctx context.Context, requestID, userID string) (*DMRequest, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	tag, err := s.db.Pool.Exec(ctx, `
		UPDATE dm_requests
		SET status = 'accepted', updated_at = NOW()
		WHERE id = $1::uuid AND to_user_id = $2::uuid AND status = 'pending'
	`, requestID, userID)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, fmt.Errorf("request not found")
	}
	return s.GetRequest(ctx, requestID, DMPreviewOpts{})
}

func (s *DMStore) Deny(ctx context.Context, requestID, userID string) (*DMRequest, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	tag, err := s.db.Pool.Exec(ctx, `
		UPDATE dm_requests
		SET status = 'denied', updated_at = NOW()
		WHERE id = $1::uuid AND to_user_id = $2::uuid AND status = 'pending'
	`, requestID, userID)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, fmt.Errorf("request not found")
	}
	return s.GetRequest(ctx, requestID, DMPreviewOpts{})
}

func (s *DMStore) Cancel(ctx context.Context, requestID, userID string) (*DMRequest, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx, `
		UPDATE dm_requests
		SET status = 'cancelled', updated_at = NOW()
		WHERE id = $1::uuid AND from_user_id = $2::uuid AND status = 'pending'
	`, requestID, userID)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, fmt.Errorf("request not found")
	}
	// Sender cancel removes the provisional message (request-created insert).
	if _, err := tx.Exec(ctx, `
		DELETE FROM dm_messages WHERE request_id = $1::uuid
	`, requestID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetRequest(ctx, requestID, DMPreviewOpts{})
}

func (s *DMStore) ThreadForUsers(ctx context.Context, userA, userB string) (string, error) {
	if err := s.requireDB(); err != nil {
		return "", err
	}
	low, high := orderedPair(userA, userB)
	var id string
	err := s.db.Pool.QueryRow(ctx, `
		SELECT id::text FROM dm_threads WHERE user_low = $1::uuid AND user_high = $2::uuid
	`, low, high).Scan(&id)
	if err == pgx.ErrNoRows {
		return "", fmt.Errorf("thread not found")
	}
	return id, err
}

// ThreadIsAccepted reports whether the thread has at least one accepted DM request.
func (s *DMStore) ThreadIsAccepted(ctx context.Context, threadID string) (bool, error) {
	if err := s.requireDB(); err != nil {
		return false, err
	}
	var ok bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM dm_requests
			WHERE thread_id = $1::uuid AND status = 'accepted'
		)
	`, threadID).Scan(&ok)
	return ok, err
}

// AcceptedThreadForUsers returns a thread id only when the pair has an accepted DM request.
func (s *DMStore) AcceptedThreadForUsers(ctx context.Context, userA, userB string) (string, error) {
	if err := s.requireDB(); err != nil {
		return "", err
	}
	low, high := orderedPair(userA, userB)
	var id string
	err := s.db.Pool.QueryRow(ctx, `
		SELECT t.id::text
		FROM dm_threads t
		WHERE t.user_low = $1::uuid AND t.user_high = $2::uuid
		  AND EXISTS (
			SELECT 1 FROM dm_requests r
			WHERE r.thread_id = t.id AND r.status = 'accepted'
		  )
	`, low, high).Scan(&id)
	if err == pgx.ErrNoRows {
		return "", nil
	}
	return id, err
}

func (s *DMStore) UserInThread(ctx context.Context, threadID, userID string) (bool, error) {
	if err := s.requireDB(); err != nil {
		return false, err
	}
	threadID = strings.TrimSpace(threadID)
	userID = strings.TrimSpace(userID)
	// Fail closed without hitting Postgres (empty / non-UUID → not a member, not 503).
	if threadID == "" || userID == "" {
		return false, nil
	}
	if _, err := uuid.Parse(threadID); err != nil {
		return false, nil
	}
	if _, err := uuid.Parse(userID); err != nil {
		return false, nil
	}
	var ok bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM dm_threads
			WHERE id = $1::uuid AND (user_low = $2::uuid OR user_high = $2::uuid)
		)
	`, threadID, userID).Scan(&ok)
	return ok, err
}

func (s *DMStore) OtherUserInThread(ctx context.Context, threadID, userID string) (string, error) {
	if err := s.requireDB(); err != nil {
		return "", err
	}
	var other string
	err := s.db.Pool.QueryRow(ctx, `
		SELECT CASE
			WHEN user_low = $2::uuid THEN user_high::text
			WHEN user_high = $2::uuid THEN user_low::text
			ELSE ''
		END
		FROM dm_threads WHERE id = $1::uuid
	`, threadID, userID).Scan(&other)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(other), nil
}

func scanDMMessageRow(rows pgx.Rows, preview DMPreviewOpts) (DMMessage, error) {
	var m DMMessage
	var replyTo, reqID, clientID *string
	var replyBody, replyImg *string
	if err := rows.Scan(
		&m.ID, &m.ThreadID, &m.UserID, &m.Username,
		&m.AvatarThumb, &m.CountryCode,
		&m.Body, &m.ImageURL, &replyTo, &replyBody, &replyImg, &reqID, &clientID, &m.CreatedAt,
	); err != nil {
		return m, err
	}
	if replyTo != nil && strings.TrimSpace(*replyTo) != "" {
		m.ReplyToID = replyTo
		prev := dmPreview(replyBody, replyImg, preview.MaxChars, preview.Suffix, preview.ImageLabel)
		if strings.TrimSpace(prev) != "" {
			m.ReplyPreview = &prev
		}
	}
	if reqID != nil && strings.TrimSpace(*reqID) != "" {
		m.RequestID = reqID
	}
	if clientID != nil && strings.TrimSpace(*clientID) != "" {
		cid := strings.TrimSpace(*clientID)
		m.ClientID = &cid
	}
	return m, nil
}

func (s *DMStore) ListMessages(ctx context.Context, threadID string, limit int, preview DMPreviewOpts) ([]DMMessage, error) {
	msgs, _, err := s.ListMessagesPaged(ctx, threadID, 0, limit, preview)
	return msgs, err
}

// ListMessagesPaged returns newest-first pages (skip into older messages) as chronological ASC.
func (s *DMStore) ListMessagesPaged(ctx context.Context, threadID string, skip, limit int, preview DMPreviewOpts) ([]DMMessage, int, error) {
	if err := s.requireDB(); err != nil {
		return nil, 0, err
	}
	if skip < 0 {
		skip = 0
	}
	if limit <= 0 {
		return nil, 0, fmt.Errorf("limit required")
	}
	var total int
	if err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM dm_messages WHERE thread_id = $1::uuid
	`, threadID).Scan(&total); err != nil {
		return nil, 0, err
	}
	// Newest page (DESC limit/offset) then chronological ASC for clients.
	rows, err := s.db.Pool.Query(ctx, `
		SELECT m.id::text, m.thread_id::text, m.user_id::text, u.username,
		       u.avatar_thumb_url, u.country_code,
		       m.body, m.image_url, m.reply_to_id::text,
		       r.body, r.image_url,
		       m.request_id::text, m.client_id, m.created_at
		FROM (
			SELECT id, thread_id, user_id, body, image_url, reply_to_id, request_id, client_id, created_at
			FROM dm_messages
			WHERE thread_id = $1::uuid
			ORDER BY created_at DESC
			LIMIT $2 OFFSET $3
		) m
		JOIN users u ON u.id = m.user_id
		LEFT JOIN dm_messages r ON r.id = m.reply_to_id AND r.thread_id = m.thread_id
		ORDER BY m.created_at ASC
	`, threadID, limit, skip)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []DMMessage{}
	for rows.Next() {
		m, err := scanDMMessageRow(rows, preview)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, m)
	}
	return out, total, rows.Err()
}

func (s *DMStore) MessageByClientID(
	ctx context.Context,
	threadID, userID, clientID string,
	preview DMPreviewOpts,
) (*DMMessage, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	clientID = strings.TrimSpace(clientID)
	if clientID == "" {
		return nil, nil
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT m.id::text, m.thread_id::text, m.user_id::text, u.username,
		       u.avatar_thumb_url, u.country_code,
		       m.body, m.image_url, m.reply_to_id::text,
		       r.body, r.image_url,
		       m.request_id::text, m.client_id, m.created_at
		FROM dm_messages m
		JOIN users u ON u.id = m.user_id
		LEFT JOIN dm_messages r ON r.id = m.reply_to_id AND r.thread_id = m.thread_id
		WHERE m.thread_id = $1::uuid AND m.user_id = $2::uuid AND m.client_id = $3
		LIMIT 1
	`, threadID, userID, clientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, nil
	}
	m, err := scanDMMessageRow(rows, preview)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// MessageByUserClientID resolves an outbox retry before a thread_id is known (compose-new DM).
func (s *DMStore) MessageByUserClientID(
	ctx context.Context,
	userID, clientID string,
	preview DMPreviewOpts,
) (*DMMessage, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	clientID = strings.TrimSpace(clientID)
	if clientID == "" {
		return nil, nil
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT m.id::text, m.thread_id::text, m.user_id::text, u.username,
		       u.avatar_thumb_url, u.country_code,
		       m.body, m.image_url, m.reply_to_id::text,
		       r.body, r.image_url,
		       m.request_id::text, m.client_id, m.created_at
		FROM dm_messages m
		JOIN users u ON u.id = m.user_id
		LEFT JOIN dm_messages r ON r.id = m.reply_to_id AND r.thread_id = m.thread_id
		WHERE m.user_id = $1::uuid AND m.client_id = $2
		ORDER BY m.created_at ASC
		LIMIT 1
	`, userID, clientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, nil
	}
	m, err := scanDMMessageRow(rows, preview)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (s *DMStore) InsertMessage(
	ctx context.Context,
	threadID, userID string,
	body, imageURL, replyToID *string,
	clientID string,
	preview DMPreviewOpts,
) (*DMMessage, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	b := ""
	if body != nil {
		b = strings.TrimSpace(*body)
	}
	img := ""
	if imageURL != nil {
		img = strings.TrimSpace(*imageURL)
	}
	if b == "" && img == "" {
		return nil, fmt.Errorf("message required")
	}
	clientID = strings.TrimSpace(clientID)
	if clientID != "" {
		if existing, err := s.MessageByClientID(ctx, threadID, userID, clientID, preview); err != nil {
			return nil, err
		} else if existing != nil {
			return existing, nil
		}
	}
	id := uuid.NewString()
	var bodyArg, imgArg, replyArg, clientArg any
	if b != "" {
		bodyArg = b
	}
	if img != "" {
		imgArg = img
	}
	if clientID != "" {
		clientArg = clientID
	}
	if replyToID != nil && strings.TrimSpace(*replyToID) != "" {
		rid := strings.TrimSpace(*replyToID)
		var ok bool
		if err := s.db.Pool.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1 FROM dm_messages
				WHERE id = $1::uuid AND thread_id = $2::uuid
			)
		`, rid, threadID).Scan(&ok); err != nil {
			return nil, err
		}
		if !ok {
			return nil, fmt.Errorf("invalid reply_to_id")
		}
		replyArg = rid
	}
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO dm_messages (id, thread_id, user_id, body, image_url, reply_to_id, client_id)
		VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, NULLIF($6::text, '')::uuid, $7)
	`, id, threadID, userID, bodyArg, imgArg, replyArg, clientArg)
	if err != nil {
		if isPgUniqueViolation(err) && clientID != "" {
			existing, e2 := s.MessageByClientID(ctx, threadID, userID, clientID, preview)
			if e2 != nil {
				return nil, e2
			}
			if existing != nil {
				return existing, nil
			}
		}
		return nil, err
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT m.id::text, m.thread_id::text, m.user_id::text, u.username,
		       u.avatar_thumb_url, u.country_code,
		       m.body, m.image_url, m.reply_to_id::text,
		       r.body, r.image_url,
		       m.request_id::text, m.client_id, m.created_at
		FROM dm_messages m
		JOIN users u ON u.id = m.user_id
		LEFT JOIN dm_messages r ON r.id = m.reply_to_id AND r.thread_id = m.thread_id
		WHERE m.id = $1::uuid
	`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, fmt.Errorf("message missing")
	}
	m, err := scanDMMessageRow(rows, preview)
	if err != nil {
		return nil, err
	}
	return &m, nil
}
