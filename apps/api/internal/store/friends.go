package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"dama/apps/api/internal/db"

	"github.com/jackc/pgx/v5"
)

type FriendEdge struct {
	UserID    string    `json:"user_id"`
	FriendID  string    `json:"friend_id"`
	CreatedAt time.Time `json:"created_at"`
}

type FriendsStore struct {
	db  *db.Handle
	mu  sync.RWMutex
	mem map[string]map[string]time.Time // user -> friend -> created
}

func NewFriendsStore(handle *db.Handle) *FriendsStore {
	return &FriendsStore{db: handle, mem: map[string]map[string]time.Time{}}
}

func (s *FriendsStore) Add(ctx context.Context, userID, friendID string) error {
	if userID == "" || friendID == "" || userID == friendID {
		return fmt.Errorf("invalid friend pair")
	}
	if s.db != nil && s.db.Ready() {
		_, err := s.db.Pool.Exec(ctx, `
			INSERT INTO player_friends (user_id, friend_id) VALUES ($1::uuid, $2::uuid)
			ON CONFLICT DO NOTHING
		`, userID, friendID)
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.mem[userID] == nil {
		s.mem[userID] = map[string]time.Time{}
	}
	s.mem[userID][friendID] = time.Now().UTC()
	return nil
}

// AreFriends reports whether a directed friendship edge exists (user -> friend).
func (s *FriendsStore) AreFriends(ctx context.Context, userID, friendID string) (bool, error) {
	if userID == "" || friendID == "" {
		return false, fmt.Errorf("invalid friend pair")
	}
	if s.db != nil && s.db.Ready() {
		var n int
		err := s.db.Pool.QueryRow(ctx, `
			SELECT COUNT(*)::int FROM player_friends
			WHERE user_id = $1::uuid AND friend_id = $2::uuid
		`, userID, friendID).Scan(&n)
		return n > 0, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, ok := s.mem[userID][friendID]
	return ok, nil
}

type FriendRequest struct {
	ID         string    `json:"id"`
	FromUserID string    `json:"from_user_id"`
	ToUserID   string    `json:"to_user_id"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// CreateRequest inserts a pending friend request (fail if already friends or pending).
func (s *FriendsStore) CreateRequest(ctx context.Context, fromID, toID string) (*FriendRequest, error) {
	if fromID == "" || toID == "" || fromID == toID {
		return nil, fmt.Errorf("invalid friend request")
	}
	if s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("friend requests require database")
	}
	ok, err := s.AreFriends(ctx, fromID, toID)
	if err != nil {
		return nil, err
	}
	if ok {
		return nil, fmt.Errorf("already friends")
	}
	rev, err := s.AreFriends(ctx, toID, fromID)
	if err != nil {
		return nil, err
	}
	if rev {
		return nil, fmt.Errorf("already friends")
	}
	var existing FriendRequest
	err = s.db.Pool.QueryRow(ctx, `
		SELECT id::text, from_user_id::text, to_user_id::text, status, created_at, updated_at
		FROM friend_requests
		WHERE from_user_id = $1::uuid AND to_user_id = $2::uuid
	`, fromID, toID).Scan(
		&existing.ID, &existing.FromUserID, &existing.ToUserID, &existing.Status, &existing.CreatedAt, &existing.UpdatedAt,
	)
	if err == nil {
		switch existing.Status {
		case "pending":
			return &existing, nil
		case "accepted":
			return nil, fmt.Errorf("already friends")
		case "denied":
			err = s.db.Pool.QueryRow(ctx, `
				UPDATE friend_requests SET status = 'pending', updated_at = NOW()
				WHERE id = $1::uuid
				RETURNING id::text, from_user_id::text, to_user_id::text, status, created_at, updated_at
			`, existing.ID).Scan(
				&existing.ID, &existing.FromUserID, &existing.ToUserID, &existing.Status, &existing.CreatedAt, &existing.UpdatedAt,
			)
			if err != nil {
				return nil, err
			}
			return &existing, nil
		default:
			return nil, fmt.Errorf("invalid request status")
		}
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	var fr FriendRequest
	err = s.db.Pool.QueryRow(ctx, `
		INSERT INTO friend_requests (from_user_id, to_user_id, status)
		VALUES ($1::uuid, $2::uuid, 'pending')
		RETURNING id::text, from_user_id::text, to_user_id::text, status, created_at, updated_at
	`, fromID, toID).Scan(&fr.ID, &fr.FromUserID, &fr.ToUserID, &fr.Status, &fr.CreatedAt, &fr.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &fr, nil
}

func (s *FriendsStore) ListRequestsForUser(ctx context.Context, userID string) (incoming, outgoing []FriendRequest, err error) {
	if userID == "" {
		return nil, nil, fmt.Errorf("user required")
	}
	if s.db == nil || !s.db.Ready() {
		return nil, nil, fmt.Errorf("friend requests require database")
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id::text, from_user_id::text, to_user_id::text, status, created_at, updated_at
		FROM friend_requests
		WHERE (to_user_id = $1::uuid OR from_user_id = $1::uuid)
		  AND status IN ('pending', 'denied')
		ORDER BY updated_at DESC
	`, userID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var fr FriendRequest
		if err := rows.Scan(&fr.ID, &fr.FromUserID, &fr.ToUserID, &fr.Status, &fr.CreatedAt, &fr.UpdatedAt); err != nil {
			return nil, nil, err
		}
		if fr.ToUserID == userID {
			incoming = append(incoming, fr)
		} else {
			outgoing = append(outgoing, fr)
		}
	}
	return incoming, outgoing, nil
}

// ListRequestsPaged returns a Trim skip/limit page of friend requests (in+out) plus total.
// Optional q filters by the peer username (case-insensitive substring).
func (s *FriendsStore) ListRequestsPaged(ctx context.Context, userID string, skip, limit int, q string) ([]FriendRequest, int, error) {
	if userID == "" {
		return nil, 0, fmt.Errorf("user required")
	}
	if s.db == nil || !s.db.Ready() {
		return nil, 0, fmt.Errorf("friend requests require database")
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
		SELECT COUNT(*)::int FROM friend_requests fr
		WHERE (fr.to_user_id = $1::uuid OR fr.from_user_id = $1::uuid)
		  AND fr.status IN ('pending', 'denied')
		  AND (
		    $2 = '' OR EXISTS (
		      SELECT 1 FROM users u
		      WHERE u.id = CASE
		        WHEN fr.to_user_id = $1::uuid THEN fr.from_user_id
		        ELSE fr.to_user_id
		      END
		      AND lower(u.username) LIKE '%' || lower($2) || '%'
		    )
		  )
	`, userID, needle).Scan(&total); err != nil {
		return nil, 0, err
	}
	orderSQL := `ORDER BY fr.updated_at DESC, fr.id ASC`
	if needle != "" {
		orderSQL = `ORDER BY
			CASE
				WHEN lower(u.username) = lower($2) THEN 0
				WHEN lower(u.username) LIKE lower($2) || '%' THEN 1
				ELSE 2
			END,
			fr.updated_at DESC, fr.id ASC`
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT fr.id::text, fr.from_user_id::text, fr.to_user_id::text, fr.status, fr.created_at, fr.updated_at
		FROM friend_requests fr
		LEFT JOIN users u ON u.id = CASE
		  WHEN fr.to_user_id = $1::uuid THEN fr.from_user_id
		  ELSE fr.to_user_id
		END
		WHERE (fr.to_user_id = $1::uuid OR fr.from_user_id = $1::uuid)
		  AND fr.status IN ('pending', 'denied')
		  AND ($2 = '' OR (u.username IS NOT NULL AND lower(u.username) LIKE '%' || lower($2) || '%'))
		`+orderSQL+`
		LIMIT $3 OFFSET $4
	`, userID, needle, limit, skip)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := make([]FriendRequest, 0, limit)
	for rows.Next() {
		var fr FriendRequest
		if err := rows.Scan(&fr.ID, &fr.FromUserID, &fr.ToUserID, &fr.Status, &fr.CreatedAt, &fr.UpdatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, fr)
	}
	return out, total, rows.Err()
}

func (s *FriendsStore) GetRequest(ctx context.Context, requestID string) (*FriendRequest, error) {
	if s.db == nil || !s.db.Ready() || requestID == "" {
		return nil, fmt.Errorf("request unavailable")
	}
	var fr FriendRequest
	err := s.db.Pool.QueryRow(ctx, `
		SELECT id::text, from_user_id::text, to_user_id::text, status, created_at, updated_at
		FROM friend_requests WHERE id = $1::uuid
	`, requestID).Scan(&fr.ID, &fr.FromUserID, &fr.ToUserID, &fr.Status, &fr.CreatedAt, &fr.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &fr, nil
}

// AcceptRequest marks request accepted and creates both friendship edges.
func (s *FriendsStore) AcceptRequest(ctx context.Context, requestID, actorID string) error {
	fr, err := s.GetRequest(ctx, requestID)
	if err != nil {
		return err
	}
	if fr.ToUserID != actorID || fr.Status != "pending" {
		return fmt.Errorf("cannot accept")
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `
		UPDATE friend_requests SET status = 'accepted', updated_at = NOW()
		WHERE id = $1::uuid AND status = 'pending'
	`, requestID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO player_friends (user_id, friend_id) VALUES ($1::uuid, $2::uuid)
		ON CONFLICT DO NOTHING
	`, fr.FromUserID, fr.ToUserID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO player_friends (user_id, friend_id) VALUES ($1::uuid, $2::uuid)
		ON CONFLICT DO NOTHING
	`, fr.ToUserID, fr.FromUserID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *FriendsStore) DenyRequest(ctx context.Context, requestID, actorID string) error {
	fr, err := s.GetRequest(ctx, requestID)
	if err != nil {
		return err
	}
	if fr.ToUserID != actorID || fr.Status != "pending" {
		return fmt.Errorf("cannot deny")
	}
	_, err = s.db.Pool.Exec(ctx, `
		UPDATE friend_requests SET status = 'denied', updated_at = NOW()
		WHERE id = $1::uuid AND status = 'pending'
	`, requestID)
	return err
}

func (s *FriendsStore) CancelRequest(ctx context.Context, requestID, actorID string) error {
	fr, err := s.GetRequest(ctx, requestID)
	if err != nil {
		return err
	}
	if fr.FromUserID != actorID || fr.Status != "pending" {
		return fmt.Errorf("cannot cancel")
	}
	_, err = s.db.Pool.Exec(ctx, `DELETE FROM friend_requests WHERE id = $1::uuid AND status = 'pending'`, requestID)
	return err
}

func (s *FriendsStore) Remove(ctx context.Context, userID, friendID string) error {
	if userID == "" || friendID == "" {
		return fmt.Errorf("invalid friend pair")
	}
	if s.db != nil && s.db.Ready() {
		_, err := s.db.Pool.Exec(ctx, `
			DELETE FROM player_friends WHERE user_id = $1::uuid AND friend_id = $2::uuid
		`, userID, friendID)
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.mem[userID], friendID)
	return nil
}

// ListFriendIDs returns friend user ids for the given user.
func (s *FriendsStore) ListFriendIDs(ctx context.Context, userID string) ([]string, error) {
	ids, _, err := s.ListFriendIDsPaged(ctx, userID, 0, 10_000, "")
	return ids, err
}

// ListFriendIDsPaged returns a skip/limit page of friend ids plus total count.
// Optional q filters by friend username (case-insensitive substring) with relevance ranking.
func (s *FriendsStore) ListFriendIDsPaged(ctx context.Context, userID string, skip, limit int, q string) ([]string, int, error) {
	if userID == "" {
		return nil, 0, fmt.Errorf("user required")
	}
	if skip < 0 {
		skip = 0
	}
	if limit <= 0 {
		return nil, 0, fmt.Errorf("limit required")
	}
	needle := strings.TrimSpace(q)
	if s.db != nil && s.db.Ready() {
		var total int
		if err := s.db.Pool.QueryRow(ctx, `
			SELECT COUNT(*)::int FROM player_friends pf
			JOIN users u ON u.id = pf.friend_id
			WHERE pf.user_id = $1::uuid
			  AND ($2 = '' OR lower(u.username) LIKE '%' || lower($2) || '%')
		`, userID, needle).Scan(&total); err != nil {
			return nil, 0, err
		}
		orderSQL := `ORDER BY pf.created_at DESC, pf.friend_id ASC`
		if needle != "" {
			orderSQL = `ORDER BY
				CASE
					WHEN lower(u.username) = lower($2) THEN 0
					WHEN lower(u.username) LIKE lower($2) || '%' THEN 1
					ELSE 2
				END,
				pf.created_at DESC, pf.friend_id ASC`
		}
		rows, err := s.db.Pool.Query(ctx, `
			SELECT pf.friend_id::text FROM player_friends pf
			JOIN users u ON u.id = pf.friend_id
			WHERE pf.user_id = $1::uuid
			  AND ($2 = '' OR lower(u.username) LIKE '%' || lower($2) || '%')
			`+orderSQL+`
			LIMIT $3 OFFSET $4
		`, userID, needle, limit, skip)
		if err != nil {
			return nil, 0, err
		}
		defer rows.Close()
		out := []string{}
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				return nil, 0, err
			}
			out = append(out, id)
		}
		return out, total, nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	all := make([]string, 0, len(s.mem[userID]))
	for id := range s.mem[userID] {
		all = append(all, id)
	}
	total := len(all)
	if skip >= total {
		return []string{}, total, nil
	}
	end := skip + limit
	if end > total {
		end = total
	}
	return all[skip:end], total, nil
}
