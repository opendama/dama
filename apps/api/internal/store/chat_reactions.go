package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
)

// ChatReactionAgg is one emoji bucket on a message (Telegram-style).
type ChatReactionAgg struct {
	Emoji   string `json:"emoji"`
	Count   int    `json:"count"`
	Reacted bool   `json:"reacted"`
}

func normalizeReactionEmoji(raw string) (string, error) {
	e := strings.TrimSpace(raw)
	if e == "" {
		return "", fmt.Errorf("emoji required")
	}
	if utf8.RuneCountInString(e) > 8 || len(e) > 16 {
		return "", fmt.Errorf("emoji too long")
	}
	return e, nil
}

// ToggleReaction sets exactly one reaction per user:
// same emoji → delete; different / none → upsert (replace).
func (s *GameChatStore) ToggleReaction(ctx context.Context, messageID, gameID, userID, emoji string) ([]ChatReactionAgg, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	e, err := normalizeReactionEmoji(emoji)
	if err != nil {
		return nil, err
	}
	var ok bool
	if err := s.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM game_chat_messages
			WHERE id = $1::uuid AND game_id = $2::uuid
		)
	`, messageID, gameID).Scan(&ok); err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("message not found")
	}
	var current string
	scanErr := s.db.Pool.QueryRow(ctx, `
		SELECT emoji FROM game_chat_reactions
		WHERE message_id = $1::uuid AND user_id = $2::uuid
	`, messageID, userID).Scan(&current)
	if scanErr != nil && !errors.Is(scanErr, pgx.ErrNoRows) {
		return nil, scanErr
	}
	hasCurrent := scanErr == nil && strings.TrimSpace(current) != ""
	if hasCurrent && strings.TrimSpace(current) == e {
		_, err = s.db.Pool.Exec(ctx, `
			DELETE FROM game_chat_reactions
			WHERE message_id = $1::uuid AND user_id = $2::uuid
		`, messageID, userID)
	} else {
		_, err = s.db.Pool.Exec(ctx, `
			INSERT INTO game_chat_reactions (message_id, user_id, emoji, created_at)
			VALUES ($1::uuid, $2::uuid, $3, NOW())
			ON CONFLICT (message_id, user_id) DO UPDATE
			SET emoji = EXCLUDED.emoji, created_at = NOW()
		`, messageID, userID, e)
	}
	if err != nil {
		return nil, err
	}
	agg := s.ListReactionsForMessages(ctx, []string{messageID}, userID)[messageID]
	if agg == nil {
		agg = []ChatReactionAgg{}
	}
	return agg, nil
}

func (s *GameChatStore) ListReactionsForMessages(ctx context.Context, messageIDs []string, viewerID string) map[string][]ChatReactionAgg {
	out := map[string][]ChatReactionAgg{}
	if err := s.requireDB(); err != nil || len(messageIDs) == 0 {
		return out
	}
	viewer := strings.TrimSpace(viewerID)
	rows, err := s.db.Pool.Query(ctx, `
		SELECT message_id::text, emoji, COUNT(*)::int,
		       BOOL_OR($2 <> '' AND user_id::text = $2) AS reacted
		FROM game_chat_reactions
		WHERE message_id = ANY($1::uuid[])
		GROUP BY message_id, emoji
		ORDER BY MIN(created_at) ASC
	`, messageIDs, viewer)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var mid, emoji string
		var count int
		var reacted bool
		if rows.Scan(&mid, &emoji, &count, &reacted) != nil {
			continue
		}
		out[mid] = append(out[mid], ChatReactionAgg{Emoji: emoji, Count: count, Reacted: reacted})
	}
	return out
}

func (s *GameChatStore) AttachReactions(ctx context.Context, msgs []GameChatMessage, viewerID string) {
	if len(msgs) == 0 {
		return
	}
	ids := make([]string, len(msgs))
	for i, m := range msgs {
		ids[i] = m.ID
	}
	by := s.ListReactionsForMessages(ctx, ids, viewerID)
	for i := range msgs {
		if r, ok := by[msgs[i].ID]; ok {
			msgs[i].Reactions = r
		} else {
			msgs[i].Reactions = []ChatReactionAgg{}
		}
	}
}

// ToggleReaction sets exactly one reaction per user on a DM message.
func (s *DMStore) ToggleReaction(ctx context.Context, messageID, threadID, userID, emoji string) ([]ChatReactionAgg, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	e, err := normalizeReactionEmoji(emoji)
	if err != nil {
		return nil, err
	}
	var ok bool
	if err := s.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM dm_messages
			WHERE id = $1::uuid AND thread_id = $2::uuid
		)
	`, messageID, threadID).Scan(&ok); err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("message not found")
	}
	var current string
	scanErr := s.db.Pool.QueryRow(ctx, `
		SELECT emoji FROM dm_message_reactions
		WHERE message_id = $1::uuid AND user_id = $2::uuid
	`, messageID, userID).Scan(&current)
	if scanErr != nil && !errors.Is(scanErr, pgx.ErrNoRows) {
		return nil, scanErr
	}
	hasCurrent := scanErr == nil && strings.TrimSpace(current) != ""
	if hasCurrent && strings.TrimSpace(current) == e {
		_, err = s.db.Pool.Exec(ctx, `
			DELETE FROM dm_message_reactions
			WHERE message_id = $1::uuid AND user_id = $2::uuid
		`, messageID, userID)
	} else {
		_, err = s.db.Pool.Exec(ctx, `
			INSERT INTO dm_message_reactions (message_id, user_id, emoji, created_at)
			VALUES ($1::uuid, $2::uuid, $3, NOW())
			ON CONFLICT (message_id, user_id) DO UPDATE
			SET emoji = EXCLUDED.emoji, created_at = NOW()
		`, messageID, userID, e)
	}
	if err != nil {
		return nil, err
	}
	agg := s.ListReactionsForMessages(ctx, []string{messageID}, userID)[messageID]
	if agg == nil {
		agg = []ChatReactionAgg{}
	}
	return agg, nil
}

func (s *DMStore) ListReactionsForMessages(ctx context.Context, messageIDs []string, viewerID string) map[string][]ChatReactionAgg {
	out := map[string][]ChatReactionAgg{}
	if err := s.requireDB(); err != nil || len(messageIDs) == 0 {
		return out
	}
	viewer := strings.TrimSpace(viewerID)
	rows, err := s.db.Pool.Query(ctx, `
		SELECT message_id::text, emoji, COUNT(*)::int,
		       BOOL_OR($2 <> '' AND user_id::text = $2) AS reacted
		FROM dm_message_reactions
		WHERE message_id = ANY($1::uuid[])
		GROUP BY message_id, emoji
		ORDER BY MIN(created_at) ASC
	`, messageIDs, viewer)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var mid, emoji string
		var count int
		var reacted bool
		if rows.Scan(&mid, &emoji, &count, &reacted) != nil {
			continue
		}
		out[mid] = append(out[mid], ChatReactionAgg{Emoji: emoji, Count: count, Reacted: reacted})
	}
	return out
}

func (s *DMStore) AttachReactions(ctx context.Context, msgs []DMMessage, viewerID string) {
	if len(msgs) == 0 {
		return
	}
	ids := make([]string, len(msgs))
	for i, m := range msgs {
		ids[i] = m.ID
	}
	by := s.ListReactionsForMessages(ctx, ids, viewerID)
	for i := range msgs {
		if r, ok := by[msgs[i].ID]; ok {
			msgs[i].Reactions = r
		} else {
			msgs[i].Reactions = []ChatReactionAgg{}
		}
	}
}
