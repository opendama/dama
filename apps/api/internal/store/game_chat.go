package store

import (
	"context"
	"fmt"
	"strings"
	"time"

	"dama/apps/api/internal/db"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type GameChatMessage struct {
	ID           string            `json:"id"`
	GameID       string            `json:"game_id"`
	UserID       string            `json:"user_id"`
	Username     string            `json:"username"`
	AvatarThumb  *string           `json:"avatar_thumb_url,omitempty"`
	CountryCode  *string           `json:"country_code,omitempty"`
	Body         *string           `json:"body,omitempty"`
	ImageURL     *string           `json:"image_url,omitempty"`
	ReplyToID    *string           `json:"reply_to_id,omitempty"`
	ReplyPreview *string           `json:"reply_preview,omitempty"`
	ClientID     *string           `json:"client_id,omitempty"` // Telegram outbox idempotency key
	Reactions    []ChatReactionAgg `json:"reactions"`
	SeenCount    int               `json:"seen_count"`
	SeenTotal    int               `json:"seen_total"`
	CreatedAt    time.Time         `json:"created_at"`
}

type GameChatStore struct {
	db *db.Handle
}

func NewGameChatStore(handle *db.Handle) *GameChatStore {
	return &GameChatStore{db: handle}
}

func (s *GameChatStore) requireDB() error {
	if s == nil || s.db == nil || !s.db.Ready() {
		return fmt.Errorf("database unavailable")
	}
	return nil
}

// CountUnreadForViewer counts peer messages + peer reactions after the viewer's watermark.
func (s *GameChatStore) CountUnreadForViewer(ctx context.Context, gameID, viewerID string) (int, error) {
	if err := s.requireDB(); err != nil {
		return 0, err
	}
	gameID = strings.TrimSpace(gameID)
	viewerID = strings.TrimSpace(viewerID)
	if gameID == "" || viewerID == "" {
		return 0, nil
	}
	var n int
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(n), 0)::int FROM (
			SELECT COUNT(*)::int AS n
			FROM game_chat_messages m
			LEFT JOIN game_chat_user_reads r
			  ON r.game_id = m.game_id AND r.user_id = $2::uuid
			LEFT JOIN game_chat_messages lm
			  ON lm.id = r.last_read_message_id
			WHERE m.game_id = $1::uuid
			  AND m.user_id <> $2::uuid
			  AND m.created_at > COALESCE(lm.created_at, r.last_read_at, TIMESTAMPTZ '-infinity')
			UNION ALL
			SELECT COUNT(*)::int AS n
			FROM game_chat_reactions rx
			INNER JOIN game_chat_messages m ON m.id = rx.message_id
			LEFT JOIN game_chat_user_reads r
			  ON r.game_id = m.game_id AND r.user_id = $2::uuid
			LEFT JOIN game_chat_messages lm
			  ON lm.id = r.last_read_message_id
			WHERE m.game_id = $1::uuid
			  AND rx.user_id <> $2::uuid
			  AND rx.created_at > COALESCE(lm.created_at, r.last_read_at, TIMESTAMPTZ '-infinity')
		) u
	`, gameID, viewerID).Scan(&n)
	return n, err
}

func (s *GameChatStore) IsEnabled(ctx context.Context, gameID string) (bool, error) {
	if err := s.requireDB(); err != nil {
		return false, err
	}
	gameID = strings.TrimSpace(gameID)
	if gameID == "" {
		return false, fmt.Errorf("game_id required")
	}
	var enabled bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT enabled FROM game_chat_settings WHERE game_id = $1::uuid
	`, gameID).Scan(&enabled)
	if err != nil {
		if err == pgx.ErrNoRows {
			return true, nil
		}
		return false, err
	}
	return enabled, nil
}

func (s *GameChatStore) SetEnabled(ctx context.Context, gameID, userID string, enabled bool) error {
	if err := s.requireDB(); err != nil {
		return err
	}
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO game_chat_settings (game_id, enabled, updated_by, updated_at)
		VALUES ($1::uuid, $2, $3::uuid, NOW())
		ON CONFLICT (game_id) DO UPDATE
		SET enabled = EXCLUDED.enabled,
		    updated_by = EXCLUDED.updated_by,
		    updated_at = NOW()
	`, gameID, enabled, userID)
	return err
}

func scanGameChatRow(rows pgx.Rows, preview DMPreviewOpts) (GameChatMessage, error) {
	var m GameChatMessage
	var replyTo, clientID *string
	var replyBody, replyImg *string
	if err := rows.Scan(
		&m.ID, &m.GameID, &m.UserID, &m.Username,
		&m.AvatarThumb, &m.CountryCode,
		&m.Body, &m.ImageURL, &replyTo, &replyBody, &replyImg, &clientID, &m.CreatedAt,
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
	if clientID != nil && strings.TrimSpace(*clientID) != "" {
		cid := strings.TrimSpace(*clientID)
		m.ClientID = &cid
	}
	return m, nil
}

func (s *GameChatStore) List(ctx context.Context, gameID string, limit int, preview DMPreviewOpts) ([]GameChatMessage, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	// Newest page (DESC limit) then chronological ASC for clients.
	rows, err := s.db.Pool.Query(ctx, `
		SELECT m.id::text, m.game_id::text, m.user_id::text, u.username,
		       u.avatar_thumb_url, u.country_code,
		       m.body, m.image_url, m.reply_to_id::text,
		       r.body, r.image_url,
		       m.client_id, m.created_at
		FROM (
			SELECT id, game_id, user_id, body, image_url, reply_to_id, client_id, created_at
			FROM game_chat_messages
			WHERE game_id = $1::uuid
			ORDER BY created_at DESC
			LIMIT $2
		) m
		JOIN users u ON u.id = m.user_id
		LEFT JOIN game_chat_messages r ON r.id = m.reply_to_id AND r.game_id = m.game_id
		ORDER BY m.created_at ASC
	`, gameID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []GameChatMessage{}
	for rows.Next() {
		m, err := scanGameChatRow(rows, preview)
		if err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *GameChatStore) MessageByClientID(
	ctx context.Context,
	gameID, userID, clientID string,
	preview DMPreviewOpts,
) (*GameChatMessage, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	clientID = strings.TrimSpace(clientID)
	if clientID == "" {
		return nil, nil
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT m.id::text, m.game_id::text, m.user_id::text, u.username,
		       u.avatar_thumb_url, u.country_code,
		       m.body, m.image_url, m.reply_to_id::text,
		       r.body, r.image_url,
		       m.client_id, m.created_at
		FROM game_chat_messages m
		JOIN users u ON u.id = m.user_id
		LEFT JOIN game_chat_messages r ON r.id = m.reply_to_id AND r.game_id = m.game_id
		WHERE m.game_id = $1::uuid AND m.user_id = $2::uuid AND m.client_id = $3
		LIMIT 1
	`, gameID, userID, clientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, nil
	}
	m, err := scanGameChatRow(rows, preview)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (s *GameChatStore) Insert(
	ctx context.Context,
	gameID, userID string,
	body, imageURL, replyToID *string,
	clientID string,
	preview DMPreviewOpts,
) (*GameChatMessage, error) {
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
		if existing, err := s.MessageByClientID(ctx, gameID, userID, clientID, preview); err != nil {
			return nil, err
		} else if existing != nil {
			return existing, nil
		}
	}
	id := uuid.NewString()
	var replyArg any
	if replyToID != nil && strings.TrimSpace(*replyToID) != "" {
		rid := strings.TrimSpace(*replyToID)
		var ok bool
		if err := s.db.Pool.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1 FROM game_chat_messages
				WHERE id = $1::uuid AND game_id = $2::uuid
			)
		`, rid, gameID).Scan(&ok); err != nil {
			return nil, err
		}
		if !ok {
			return nil, fmt.Errorf("invalid reply_to_id")
		}
		replyArg = rid
	}
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
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO game_chat_messages (id, game_id, user_id, body, image_url, reply_to_id, client_id, created_at)
		VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, NULLIF($6::text, '')::uuid, $7, NOW())
	`, id, gameID, userID, bodyArg, imgArg, replyArg, clientArg)
	if err != nil {
		if isPgUniqueViolation(err) && clientID != "" {
			existing, e2 := s.MessageByClientID(ctx, gameID, userID, clientID, preview)
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
		SELECT m.id::text, m.game_id::text, m.user_id::text, u.username,
		       u.avatar_thumb_url, u.country_code,
		       m.body, m.image_url, m.reply_to_id::text,
		       r.body, r.image_url,
		       m.client_id, m.created_at
		FROM game_chat_messages m
		JOIN users u ON u.id = m.user_id
		LEFT JOIN game_chat_messages r ON r.id = m.reply_to_id AND r.game_id = m.game_id
		WHERE m.id = $1::uuid
	`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, fmt.Errorf("message missing")
	}
	m, err := scanGameChatRow(rows, preview)
	if err != nil {
		return nil, err
	}
	return &m, nil
}
