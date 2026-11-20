package store

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
	"os"
	"time"

	"dama/apps/api/internal/db"

	"github.com/google/uuid"
)

func hashOTP(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}

type OTPChallenge struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Channel   string    `json:"channel"`
	ExpiresAt time.Time `json:"expires_at"`
	Verified  bool      `json:"verified"`
}

type OTPStore struct {
	db *db.Handle
}

func NewOTPStore(handle *db.Handle) *OTPStore {
	return &OTPStore{db: handle}
}

func allowMemoryMode() bool {
	return os.Getenv("DAMA_ALLOW_MEMORY") == "1"
}

func (s *OTPStore) requireDB() error {
	if s.db != nil && s.db.Ready() {
		return nil
	}
	if allowMemoryMode() {
		return fmt.Errorf("service temporarily unavailable")
	}
	return fmt.Errorf("service temporarily unavailable")
}

func (s *OTPStore) Issue(ctx context.Context, userID, channel string) (code string, challengeID string, err error) {
	if err := s.requireDB(); err != nil {
		return "", "", err
	}
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", "", err
	}
	code = fmt.Sprintf("%06d", n.Int64())
	id := uuid.NewString()
	exp := time.Now().UTC().Add(10 * time.Minute)
	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO otp_challenges (id, user_id, channel, code_hash, expires_at, verified, created_at)
		VALUES ($1,$2,$3,$4,$5,FALSE,NOW())
	`, id, userID, channel, hashOTP(code), exp)
	if err != nil {
		return "", "", err
	}
	return code, id, nil
}

func (s *OTPStore) Verify(ctx context.Context, challengeID, userID, code string) error {
	return s.VerifyChannel(ctx, challengeID, userID, code, "")
}

// VerifyChannel verifies an OTP and optionally requires the challenge channel to match.
func (s *OTPStore) VerifyChannel(ctx context.Context, challengeID, userID, code, requireChannel string) error {
	if err := s.requireDB(); err != nil {
		return err
	}
	var storedUser, storedHash, storedChannel string
	var exp time.Time
	var verified bool
	err := s.db.Pool.QueryRow(ctx, `
		SELECT user_id, code_hash, expires_at, verified, channel
		FROM otp_challenges WHERE id=$1
	`, challengeID).Scan(&storedUser, &storedHash, &exp, &verified, &storedChannel)
	if err != nil {
		return fmt.Errorf("challenge not found")
	}
	if storedUser != userID {
		return fmt.Errorf("challenge not found")
	}
	if requireChannel != "" && storedChannel != requireChannel {
		return fmt.Errorf("invalid otp channel")
	}
	if verified {
		return nil
	}
	if time.Now().After(exp) {
		return fmt.Errorf("otp expired")
	}
	if storedHash != hashOTP(code) {
		return fmt.Errorf("invalid otp")
	}
	_, err = s.db.Pool.Exec(ctx, `UPDATE otp_challenges SET verified=TRUE WHERE id=$1 AND user_id=$2`, challengeID, userID)
	return err
}
