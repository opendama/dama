package store

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// Receipt status for 1:1 outbound messages (Telegram-style ticks).
const (
	ReceiptSent      = "sent"      // chrome: chat_receipt_sent_*
	ReceiptDelivered = "delivered" // chrome retained; AttachDMReceipts no longer emits (no device-delivery ack)
	ReceiptRead      = "read"      // chrome: chat_receipt_read_* / chat_receipt_seen_*
)

func (s *DMStore) MarkThreadRead(ctx context.Context, threadID, userID, messageID string) error {
	if err := s.requireDB(); err != nil {
		return err
	}
	threadID = strings.TrimSpace(threadID)
	userID = strings.TrimSpace(userID)
	messageID = strings.TrimSpace(messageID)
	if threadID == "" || userID == "" {
		return fmt.Errorf("ids required")
	}
	msgStr := ""
	if messageID != "" {
		var ok bool
		if err := s.db.Pool.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1 FROM dm_messages
				WHERE id = $1::uuid AND thread_id = $2::uuid
			)
		`, messageID, threadID).Scan(&ok); err != nil {
			return err
		}
		if !ok {
			return fmt.Errorf("message not found")
		}
		msgStr = messageID
	}
	// Monotonic watermark (Telegram): only advance last_read_message_id forward in time.
	// Always refresh last_read_at so peer reactions after open also clear from unread.
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO dm_thread_reads (thread_id, user_id, last_read_message_id, last_read_at)
		VALUES ($1::uuid, $2::uuid, NULLIF($3::text, '')::uuid, NOW())
		ON CONFLICT (thread_id, user_id) DO UPDATE
		SET last_read_message_id = CASE
				WHEN NULLIF($3::text, '')::uuid IS NULL THEN dm_thread_reads.last_read_message_id
				WHEN dm_thread_reads.last_read_message_id IS NULL THEN NULLIF($3::text, '')::uuid
				WHEN (
					SELECT created_at FROM dm_messages WHERE id = NULLIF($3::text, '')::uuid
				) >= (
					SELECT created_at FROM dm_messages WHERE id = dm_thread_reads.last_read_message_id
				) THEN NULLIF($3::text, '')::uuid
				ELSE dm_thread_reads.last_read_message_id
			END,
			last_read_at = NOW()
	`, threadID, userID, msgStr)
	return err
}

// AttachDMReceipts sets receipt on messages authored by viewer vs peer read watermark.
// 1:1 industry ticks without device-delivery acks: ✓ sent until peer has read this
// message; ✓✓ brand when peer watermark covers it. Do not emit "delivered" (✓✓ muted)
// merely because the peer once opened an older part of the thread - that looked like
// premature "seen" double-checks on unread outbound.
func (s *DMStore) AttachDMReceipts(ctx context.Context, msgs []DMMessage, threadID, viewerID string) {
	if len(msgs) == 0 {
		return
	}
	for i := range msgs {
		if msgs[i].UserID == viewerID {
			msgs[i].Receipt = ReceiptSent
		}
	}
	peer, err := s.OtherUserInThread(ctx, threadID, viewerID)
	if err != nil || peer == "" {
		return
	}
	var lastReadID *string
	var lastReadAt *time.Time
	err = s.db.Pool.QueryRow(ctx, `
		SELECT last_read_message_id::text, last_read_at
		FROM dm_thread_reads
		WHERE thread_id = $1::uuid AND user_id = $2::uuid
	`, threadID, peer).Scan(&lastReadID, &lastReadAt)
	if err != nil || lastReadAt == nil {
		return
	}
	var peerReadCutoff time.Time
	if lastReadID != nil && strings.TrimSpace(*lastReadID) != "" {
		_ = s.db.Pool.QueryRow(ctx, `
			SELECT created_at FROM dm_messages WHERE id = $1::uuid
		`, strings.TrimSpace(*lastReadID)).Scan(&peerReadCutoff)
	}
	if peerReadCutoff.IsZero() {
		peerReadCutoff = *lastReadAt
	}
	for i := range msgs {
		if msgs[i].UserID != viewerID {
			continue
		}
		if !msgs[i].CreatedAt.After(peerReadCutoff) {
			msgs[i].Receipt = ReceiptRead
		}
		// else keep ReceiptSent (single check) until peer actually reads past this message
	}
}

func (s *GameChatStore) MarkGameRead(ctx context.Context, gameID, userID, upToMessageID string) (int, error) {
	if err := s.requireDB(); err != nil {
		return 0, err
	}
	gameID = strings.TrimSpace(gameID)
	userID = strings.TrimSpace(userID)
	upToMessageID = strings.TrimSpace(upToMessageID)
	if gameID == "" || userID == "" {
		return 0, fmt.Errorf("ids required")
	}

	var cutoff time.Time
	msgStr := ""
	if upToMessageID != "" {
		err := s.db.Pool.QueryRow(ctx, `
			SELECT created_at FROM game_chat_messages
			WHERE id = $1::uuid AND game_id = $2::uuid
		`, upToMessageID, gameID).Scan(&cutoff)
		if err != nil {
			_ = s.db.Pool.QueryRow(ctx, `
				SELECT COALESCE(MAX(created_at), NOW()) FROM game_chat_messages WHERE game_id = $1::uuid
			`, gameID).Scan(&cutoff)
		} else {
			msgStr = upToMessageID
		}
	} else {
		_ = s.db.Pool.QueryRow(ctx, `
			SELECT COALESCE(MAX(created_at), NOW()) FROM game_chat_messages WHERE game_id = $1::uuid
		`, gameID).Scan(&cutoff)
	}

	tag, err := s.db.Pool.Exec(ctx, `
		INSERT INTO game_chat_reads (message_id, user_id, read_at)
		SELECT m.id, $2::uuid, NOW()
		FROM game_chat_messages m
		WHERE m.game_id = $1::uuid
		  AND m.user_id <> $2::uuid
		  AND m.created_at <= $3
		ON CONFLICT DO NOTHING
	`, gameID, userID, cutoff)
	if err != nil {
		return 0, err
	}

	_, _ = s.db.Pool.Exec(ctx, `
		INSERT INTO game_chat_user_reads (game_id, user_id, last_read_message_id, last_read_at)
		VALUES ($1::uuid, $2::uuid, NULLIF($3::text, '')::uuid, NOW())
		ON CONFLICT (game_id, user_id) DO UPDATE
		SET last_read_message_id = CASE
				WHEN NULLIF($3::text, '')::uuid IS NULL THEN game_chat_user_reads.last_read_message_id
				WHEN game_chat_user_reads.last_read_message_id IS NULL THEN NULLIF($3::text, '')::uuid
				WHEN (
					SELECT created_at FROM game_chat_messages WHERE id = NULLIF($3::text, '')::uuid
				) >= (
					SELECT created_at FROM game_chat_messages WHERE id = game_chat_user_reads.last_read_message_id
				) THEN NULLIF($3::text, '')::uuid
				ELSE game_chat_user_reads.last_read_message_id
			END,
			last_read_at = NOW()
	`, gameID, userID, msgStr)

	return int(tag.RowsAffected()), nil
}

// AttachSeenCounts fills SeenCount (unique readers excluding author) on each message.
func (s *GameChatStore) AttachSeenCounts(ctx context.Context, msgs []GameChatMessage, seenTotal int) {
	if len(msgs) == 0 {
		return
	}
	ids := make([]string, len(msgs))
	for i, m := range msgs {
		ids[i] = m.ID
		msgs[i].SeenTotal = seenTotal
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT r.message_id::text, COUNT(*)::int
		FROM game_chat_reads r
		JOIN game_chat_messages m ON m.id = r.message_id
		WHERE r.message_id = ANY($1::uuid[])
		  AND r.user_id <> m.user_id
		GROUP BY r.message_id
	`, ids)
	if err != nil {
		return
	}
	defer rows.Close()
	counts := map[string]int{}
	for rows.Next() {
		var mid string
		var n int
		if rows.Scan(&mid, &n) != nil {
			continue
		}
		counts[mid] = n
	}
	for i := range msgs {
		msgs[i].SeenCount = counts[msgs[i].ID]
		if seenTotal > 0 && msgs[i].SeenCount > seenTotal {
			msgs[i].SeenTotal = msgs[i].SeenCount
		}
	}
}

// DistinctReadersForGame returns how many distinct users have any read row for this game.
func (s *GameChatStore) DistinctReadersForGame(ctx context.Context, gameID string) int {
	if err := s.requireDB(); err != nil {
		return 0
	}
	var n int
	_ = s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(DISTINCT user_id)::int FROM game_chat_user_reads WHERE game_id = $1::uuid
	`, gameID).Scan(&n)
	return n
}
