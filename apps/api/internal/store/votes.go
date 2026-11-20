package store

import (
	"context"
	"fmt"
	"strings"

	"dama/apps/api/internal/db"

	"github.com/google/uuid"
)

type MatchVote struct {
	ID            string `json:"id"`
	GameID        string `json:"game_id"`
	VoterID       string `json:"voter_id"`
	VotedPlayerID string `json:"voted_player_id"`
}

type VoteTally struct {
	PlayerID string `json:"player_id"`
	Count    int    `json:"count"`
}

// VoteStore is DB-only (fail-closed). No in-memory vote path.
type VoteStore struct {
	db *db.Handle
}

func NewVoteStore(handle *db.Handle) *VoteStore {
	return &VoteStore{db: handle}
}

func (s *VoteStore) requireDB() error {
	if s == nil || s.db == nil || !s.db.Ready() {
		return fmt.Errorf("votes unavailable")
	}
	return nil
}

// Cast inserts or replaces the voter's pick for a game. One vote per voter per game.
func (s *VoteStore) Cast(ctx context.Context, gameID, voterID, votedPlayerID string) (*MatchVote, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	gameID = trimID(gameID)
	voterID = trimID(voterID)
	votedPlayerID = trimID(votedPlayerID)
	if gameID == "" || voterID == "" || votedPlayerID == "" {
		return nil, fmt.Errorf("game, voter, and pick required")
	}
	v := MatchVote{
		ID:            uuid.NewString(),
		GameID:        gameID,
		VoterID:       voterID,
		VotedPlayerID: votedPlayerID,
	}
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO match_votes (id, game_id, voter_id, voted_player_id, created_at)
		VALUES ($1, $2::uuid, $3::uuid, $4::uuid, NOW())
		ON CONFLICT (game_id, voter_id) DO UPDATE
		  SET voted_player_id = EXCLUDED.voted_player_id,
		      created_at = NOW()
	`, v.ID, gameID, voterID, votedPlayerID)
	if err != nil {
		return nil, err
	}
	// Reload id if conflict updated an existing row.
	_ = s.db.Pool.QueryRow(ctx, `
		SELECT id::text FROM match_votes WHERE game_id = $1::uuid AND voter_id = $2::uuid
	`, gameID, voterID).Scan(&v.ID)
	cp := v
	return &cp, nil
}

func (s *VoteStore) Tallies(ctx context.Context, gameID string) ([]VoteTally, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	gameID = trimID(gameID)
	if gameID == "" {
		return nil, fmt.Errorf("game id required")
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT voted_player_id::text, COUNT(*)::int
		FROM match_votes
		WHERE game_id = $1::uuid
		GROUP BY voted_player_id
		ORDER BY COUNT(*) DESC
	`, gameID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []VoteTally{}
	for rows.Next() {
		var t VoteTally
		if err := rows.Scan(&t.PlayerID, &t.Count); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, nil
}

func (s *VoteStore) MyVote(ctx context.Context, gameID, voterID string) (string, bool, error) {
	if err := s.requireDB(); err != nil {
		return "", false, err
	}
	gameID = trimID(gameID)
	voterID = trimID(voterID)
	if gameID == "" || voterID == "" {
		return "", false, nil
	}
	var picked string
	err := s.db.Pool.QueryRow(ctx, `
		SELECT voted_player_id::text FROM match_votes
		WHERE game_id = $1::uuid AND voter_id = $2::uuid
	`, gameID, voterID).Scan(&picked)
	if err != nil {
		return "", false, nil
	}
	return picked, true, nil
}

// CorrectVotersRandom returns up to limit distinct voters who picked winnerID, order randomized in SQL.
func (s *VoteStore) CorrectVotersRandom(ctx context.Context, gameID, winnerID string, limit int) ([]string, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	gameID = trimID(gameID)
	winnerID = trimID(winnerID)
	if gameID == "" || winnerID == "" {
		return nil, fmt.Errorf("game and winner required")
	}
	if limit <= 0 {
		limit = 10
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT voter_id::text
		FROM match_votes
		WHERE game_id = $1::uuid AND voted_player_id = $2::uuid
		ORDER BY random()
		LIMIT $3
	`, gameID, winnerID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, nil
}

func trimID(s string) string {
	return strings.TrimSpace(s)
}
