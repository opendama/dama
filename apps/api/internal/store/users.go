package store

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"dama/apps/api/internal/db"
	"dama/apps/api/internal/domain"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type UserStore struct {
	db         *db.Handle
	mu         sync.RWMutex
	mem        map[string]*domain.User
	byUsername map[string]string
}

func NewUserStore(handle *db.Handle) *UserStore {
	return &UserStore{
		db:         handle,
		mem:        map[string]*domain.User{},
		byUsername: map[string]string{},
	}
}

// SeedMemUser creates an in-memory social-style user for unit tests (no password).
func (s *UserStore) SeedMemUser(username, role string) (*domain.User, error) {
	if role == "" {
		return nil, fmt.Errorf("role required")
	}
	now := time.Now().UTC()
	id := uuid.NewString()
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.byUsername[username]; exists {
		return nil, fmt.Errorf("username taken")
	}
	u := &domain.User{
		ID:        id,
		Username:  username,
		Role:      role,
		Rating:    1200, // test seed only; live OAuth uses match_rewards.starting_rating
		IsActive:  true,
		CreatedAt: now,
		UpdatedAt: now,
	}
	s.mem[id] = u
	s.byUsername[username] = id
	cp := *u
	return &cp, nil
}

func (s *UserStore) GetByID(ctx context.Context, id string) (*domain.User, error) {
	if s.db != nil && s.db.Ready() {
		row := s.db.Pool.QueryRow(ctx, `
			SELECT id, email, username, role, rating, xp, wins, losses,
			       COALESCE(draws, 0), avatar_thumb_url, avatar_full_url, country_code, region,
			       is_active, created_at, updated_at, primary_phone, date_of_birth, age_verified_at, phone_kyc_verified_at,
			       document_kyc_verified_at
			FROM users WHERE id = $1
		`, id)
		return scanUser(row)
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, ok := s.mem[id]
	if !ok {
		return nil, fmt.Errorf("user not found")
	}
	cp := *u
	return &cp, nil
}

// GetBySupabaseID returns a user linked to a Supabase Auth subject.
func (s *UserStore) GetBySupabaseID(ctx context.Context, supabaseUserID string) (*domain.User, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	row := s.db.Pool.QueryRow(ctx, `
		SELECT id, email, username, role, rating, xp, wins, losses,
		       COALESCE(draws, 0), avatar_thumb_url, avatar_full_url, country_code, region,
		       is_active, created_at, updated_at, primary_phone, date_of_birth, age_verified_at, phone_kyc_verified_at,
		       document_kyc_verified_at
		FROM users WHERE supabase_user_id = $1
	`, supabaseUserID)
	return scanUser(row)
}

// GetByEmail returns a user by email (OAuth link / merge).
func (s *UserStore) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	row := s.db.Pool.QueryRow(ctx, `
		SELECT id, email, username, role, rating, xp, wins, losses,
		       COALESCE(draws, 0), avatar_thumb_url, avatar_full_url, country_code, region,
		       is_active, created_at, updated_at, primary_phone, date_of_birth, age_verified_at, phone_kyc_verified_at,
		       document_kyc_verified_at
		FROM users WHERE lower(email) = lower($1)
	`, email)
	return scanUser(row)
}

// UpsertOAuthGoogle creates or links a Google/Supabase identity to a dama user.
// startingRating is applied only when inserting a brand-new row (existing accounts keep their rating).
// Pass match_rewards.starting_rating (must be >= match_rewards.rating_floor, enforced by callers/settings).
func (s *UserStore) UpsertOAuthGoogle(ctx context.Context, supabaseUserID, email, username, role, avatarURL string, startingRating int) (*domain.User, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	if supabaseUserID == "" || email == "" || username == "" || role == "" {
		return nil, fmt.Errorf("oauth identity incomplete")
	}
	if startingRating < 0 {
		return nil, fmt.Errorf("starting_rating must be >= 0")
	}
	if existing, err := s.GetBySupabaseID(ctx, supabaseUserID); err == nil {
		// Fill empty avatars from Google only - never clobber an uploaded game avatar.
		if avatarURL != "" {
			_, _ = s.db.Pool.Exec(ctx, `
				UPDATE users
				SET avatar_thumb_url = CASE
				      WHEN NULLIF(avatar_thumb_url, '') IS NOT NULL THEN avatar_thumb_url
				      ELSE NULLIF($2, '')
				    END,
				    avatar_full_url = CASE
				      WHEN NULLIF(avatar_full_url, '') IS NOT NULL THEN avatar_full_url
				      ELSE NULLIF($2, '')
				    END,
				    updated_at = NOW()
				WHERE id = $1
			`, existing.ID, avatarURL)
		}
		return s.GetByID(ctx, existing.ID)
	}
	if byEmail, err := s.GetByEmail(ctx, email); err == nil {
		_, err := s.db.Pool.Exec(ctx, `
			UPDATE users
			SET supabase_user_id = $2, auth_provider = 'google',
			    avatar_thumb_url = CASE
			      WHEN NULLIF(avatar_thumb_url, '') IS NOT NULL THEN avatar_thumb_url
			      ELSE NULLIF($3, '')
			    END,
			    avatar_full_url = CASE
			      WHEN NULLIF(avatar_full_url, '') IS NOT NULL THEN avatar_full_url
			      ELSE NULLIF($3, '')
			    END,
			    updated_at = NOW()
			WHERE id = $1
		`, byEmail.ID, supabaseUserID, avatarURL)
		if err != nil {
			return nil, err
		}
		return s.GetByID(ctx, byEmail.ID)
	}

	now := time.Now().UTC()
	id := uuid.NewString()
	var emailPtr *string
	emailPtr = &email
	var thumb *string
	var full *string
	if avatarURL != "" {
		thumb = &avatarURL
		full = &avatarURL
	}
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO users (
			id, email, username, role, rating, auth_provider, supabase_user_id,
			avatar_thumb_url, avatar_full_url, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,'google',$6,$7,$8,$9,$9)
	`, id, emailPtr, username, role, startingRating, supabaseUserID, thumb, full, now)
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

// UpdateLocation sets ISO-3166 alpha-2 country_code (+ optional region) from verified GeoIP.
// Never invents a country: rejects empty/invalid codes.
func (s *UserStore) UpdateLocation(ctx context.Context, userID, countryCode, region string) error {
	cc := strings.ToUpper(strings.TrimSpace(countryCode))
	if userID == "" || len(cc) != 2 {
		return fmt.Errorf("invalid country_code")
	}
	for _, r := range cc {
		if r < 'A' || r > 'Z' {
			return fmt.Errorf("invalid country_code")
		}
	}
	region = strings.TrimSpace(region)
	if s.db != nil && s.db.Ready() {
		_, err := s.db.Pool.Exec(ctx, `
			UPDATE users
			SET country_code = $2,
			    region = NULLIF($3, ''),
			    updated_at = NOW()
			WHERE id = $1
		`, userID, cc, region)
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.mem[userID]
	if !ok {
		return fmt.Errorf("user not found")
	}
	u.CountryCode = &cc
	if region != "" {
		u.Region = &region
	}
	u.UpdatedAt = time.Now().UTC()
	return nil
}

func (s *UserStore) GetByUsername(ctx context.Context, username string) (*domain.User, error) {
	if s.db != nil && s.db.Ready() {
		row := s.db.Pool.QueryRow(ctx, `
			SELECT id, email, username, role, rating, xp, wins, losses,
			       COALESCE(draws, 0), avatar_thumb_url, avatar_full_url, country_code, region,
			       is_active, created_at, updated_at, primary_phone, date_of_birth, age_verified_at, phone_kyc_verified_at,
			       document_kyc_verified_at
			FROM users WHERE username = $1
		`, username)
		return scanUser(row)
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	id, ok := s.byUsername[username]
	if !ok {
		return nil, fmt.Errorf("user not found")
	}
	u := s.mem[id]
	cp := *u
	return &cp, nil
}

type LeaderboardEntry struct {
	ID             string  `json:"id"`
	Username       string  `json:"username"`
	Rating         int     `json:"rating"`
	XP             int     `json:"xp"`
	Wins           int     `json:"wins"`
	Losses         int     `json:"losses"`
	Draws          int     `json:"draws"`
	Region         *string `json:"region,omitempty"`
	CountryCode    *string `json:"country_code,omitempty"`
	AvatarThumbURL *string `json:"avatar_thumb_url,omitempty"`
	AvatarFullURL  *string `json:"avatar_full_url,omitempty"`
}

// HostKycFlags is phone/document KYC presence for host-trust stamping on list rows.
type HostKycFlags struct {
	PhoneVerified    bool
	DocumentVerified bool
}

// MapHostKycFlags loads phone/document KYC stamps for the given user IDs (one query).
func (s *UserStore) MapHostKycFlags(ctx context.Context, userIDs []string) (map[string]HostKycFlags, error) {
	out := map[string]HostKycFlags{}
	if len(userIDs) == 0 {
		return out, nil
	}
	if s.db == nil || !s.db.Ready() {
		return nil, errors.New("database unavailable")
	}
	seen := map[string]struct{}{}
	ids := make([]string, 0, len(userIDs))
	for _, id := range userIDs {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id::text,
		       (phone_kyc_verified_at IS NOT NULL),
		       (document_kyc_verified_at IS NOT NULL)
		FROM users
		WHERE id = ANY($1::uuid[])
	`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var phone, doc bool
		if err := rows.Scan(&id, &phone, &doc); err != nil {
			return nil, err
		}
		out[id] = HostKycFlags{PhoneVerified: phone, DocumentVerified: doc}
	}
	return out, rows.Err()
}

func (s *UserStore) Leaderboard(ctx context.Context, limit int, playerRole string) ([]LeaderboardEntry, error) {
	list, _, err := s.LeaderboardPaged(ctx, 0, limit, playerRole)
	return list, err
}

// SearchPlayersPaged returns active players by username substring (case-insensitive).
// Empty q: rating desc (browse). Non-empty q: relevance first (exact → prefix → contains), then rating.
func (s *UserStore) SearchPlayersPaged(ctx context.Context, q string, skip, limit int, playerRole string) ([]LeaderboardEntry, int, error) {
	if limit <= 0 {
		return nil, 0, fmt.Errorf("limit required")
	}
	if skip < 0 {
		skip = 0
	}
	if playerRole == "" {
		return nil, 0, fmt.Errorf("player role required")
	}
	needle := strings.TrimSpace(q)
	if s.db != nil && s.db.Ready() {
		var total int
		if err := s.db.Pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM users
			WHERE is_active = TRUE AND role = $1
			  AND ($2 = '' OR lower(username) LIKE '%' || lower($2) || '%')
		`, playerRole, needle).Scan(&total); err != nil {
			return nil, 0, err
		}
		// Final `id` tiebreak keeps OFFSET pages disjoint when many rows share rating/xp.
		orderSQL := `ORDER BY rating DESC, xp DESC, id ASC`
		if needle != "" {
			orderSQL = `ORDER BY
				CASE
					WHEN lower(username) = lower($4) THEN 0
					WHEN lower(username) LIKE lower($4) || '%' THEN 1
					ELSE 2
				END,
				rating DESC, xp DESC, id ASC`
		}
		rows, err := s.db.Pool.Query(ctx, `
			SELECT id, username, rating, xp, wins, losses, COALESCE(draws,0), region, country_code,
			       avatar_thumb_url, avatar_full_url
			FROM users
			WHERE is_active = TRUE AND role = $3
			  AND ($4 = '' OR lower(username) LIKE '%' || lower($4) || '%')
			`+orderSQL+`
			LIMIT $1 OFFSET $2
		`, limit, skip, playerRole, needle)
		if err != nil {
			return nil, 0, err
		}
		defer rows.Close()
		out := []LeaderboardEntry{}
		for rows.Next() {
			var e LeaderboardEntry
			if err := rows.Scan(&e.ID, &e.Username, &e.Rating, &e.XP, &e.Wins, &e.Losses, &e.Draws, &e.Region, &e.CountryCode, &e.AvatarThumbURL, &e.AvatarFullURL); err != nil {
				return nil, 0, err
			}
			out = append(out, e)
		}
		return out, total, nil
	}
	list, total, err := s.LeaderboardPaged(ctx, 0, 500, playerRole)
	if err != nil {
		return nil, 0, err
	}
	if needle == "" {
		end := skip + limit
		if skip >= total {
			return []LeaderboardEntry{}, total, nil
		}
		if end > total {
			end = total
		}
		return list[skip:end], total, nil
	}
	lower := strings.ToLower(needle)
	filtered := make([]LeaderboardEntry, 0, len(list))
	for _, e := range list {
		if strings.Contains(strings.ToLower(e.Username), lower) {
			filtered = append(filtered, e)
		}
	}
	sort.SliceStable(filtered, func(i, j int) bool {
		ui, uj := strings.ToLower(filtered[i].Username), strings.ToLower(filtered[j].Username)
		ri, rj := usernameSearchRank(ui, lower), usernameSearchRank(uj, lower)
		if ri != rj {
			return ri < rj
		}
		if filtered[i].Rating != filtered[j].Rating {
			return filtered[i].Rating > filtered[j].Rating
		}
		return filtered[i].XP > filtered[j].XP
	})
	total = len(filtered)
	if skip >= total {
		return []LeaderboardEntry{}, total, nil
	}
	end := skip + limit
	if end > total {
		end = total
	}
	return filtered[skip:end], total, nil
}

func usernameSearchRank(usernameLower, needleLower string) int {
	if usernameLower == needleLower {
		return 0
	}
	if strings.HasPrefix(usernameLower, needleLower) {
		return 1
	}
	return 2
}

// LeaderboardRank returns 1-based all-time rating rank for userID (0 if unranked).
func (s *UserStore) LeaderboardRank(ctx context.Context, userID, playerRole string) (rank int, rating int, err error) {
	userID = strings.TrimSpace(userID)
	if userID == "" || playerRole == "" {
		return 0, 0, nil
	}
	if s.db == nil || !s.db.Ready() {
		return 0, 0, fmt.Errorf("leaderboard unavailable")
	}
	err = s.db.Pool.QueryRow(ctx, `
		WITH ranked AS (
			SELECT id, rating,
			       RANK() OVER (ORDER BY rating DESC, xp DESC) AS rnk
			FROM users
			WHERE is_active = TRUE AND role = $1
		)
		SELECT rnk::int, rating FROM ranked WHERE id = $2::uuid
	`, playerRole, userID).Scan(&rank, &rating)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, 0, nil
		}
		return 0, 0, err
	}
	return rank, rating, nil
}

// LeaderboardPaged returns skip/limit rows plus total active players for Trim BuildMeta.
func (s *UserStore) LeaderboardPaged(ctx context.Context, skip, limit int, playerRole string) ([]LeaderboardEntry, int, error) {
	if limit <= 0 {
		limit = 50
	}
	if skip < 0 {
		skip = 0
	}
	if playerRole == "" {
		return nil, 0, fmt.Errorf("player role required")
	}
	if s.db == nil || !s.db.Ready() {
		return nil, 0, fmt.Errorf("leaderboard unavailable")
	}
	var total int
	if err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM users WHERE is_active = TRUE AND role = $1
	`, playerRole).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, username, rating, xp, wins, losses, COALESCE(draws,0), region, country_code,
		       avatar_thumb_url, avatar_full_url
		FROM users
		WHERE is_active = TRUE AND role = $3
		ORDER BY rating DESC, xp DESC, id ASC
		LIMIT $1 OFFSET $2
	`, limit, skip, playerRole)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []LeaderboardEntry{}
	for rows.Next() {
		var e LeaderboardEntry
		if err := rows.Scan(&e.ID, &e.Username, &e.Rating, &e.XP, &e.Wins, &e.Losses, &e.Draws, &e.Region, &e.CountryCode, &e.AvatarThumbURL, &e.AvatarFullURL); err != nil {
			return nil, 0, err
		}
		out = append(out, e)
	}
	return out, total, nil
}

// RegionalRank returns 1-based rank within country+region (e.g. Top N Addis Ababa).
func (s *UserStore) RegionalRank(ctx context.Context, userID string) (int, string, error) {
	u, err := s.GetByID(ctx, userID)
	if err != nil {
		return 0, "", err
	}
	regionLabel := ""
	if u.Region != nil && *u.Region != "" {
		regionLabel = *u.Region
	} else if u.CountryCode != nil {
		regionLabel = *u.CountryCode
	}
	if s.db != nil && s.db.Ready() {
		var rank int
		err := s.db.Pool.QueryRow(ctx, `
			WITH ranked AS (
				SELECT id, RANK() OVER (ORDER BY rating DESC, xp DESC) AS r
				FROM users
				WHERE is_active = TRUE
				  AND (
					($2::text IS NOT NULL AND region = $2)
					OR ($2::text IS NULL AND country_code = $3)
				  )
			)
			SELECT COALESCE(r, 0) FROM ranked WHERE id = $1
		`, userID, u.Region, u.CountryCode).Scan(&rank)
		if err != nil {
			return 0, regionLabel, err
		}
		return rank, regionLabel, nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	peers := []domain.User{}
	for _, p := range s.mem {
		if !p.IsActive {
			continue
		}
		sameRegion := u.Region != nil && p.Region != nil && *u.Region != "" && *u.Region == *p.Region
		sameCountry := !sameRegion && u.CountryCode != nil && p.CountryCode != nil && *u.CountryCode == *p.CountryCode
		if sameRegion || sameCountry {
			peers = append(peers, *p)
		}
	}
	for i := 1; i < len(peers); i++ {
		j := i
		for j > 0 && peers[j-1].Rating < peers[j].Rating {
			peers[j-1], peers[j] = peers[j], peers[j-1]
			j--
		}
	}
	for i, p := range peers {
		if p.ID == userID {
			return i + 1, regionLabel, nil
		}
	}
	return 0, regionLabel, nil
}

func (s *UserStore) ResetAvatar(ctx context.Context, userID string) (*domain.User, error) {
	now := time.Now().UTC()
	if s.db != nil && s.db.Ready() {
		_, err := s.db.Pool.Exec(ctx, `
			UPDATE users
			SET avatar_thumb_url = NULL, avatar_full_url = NULL, avatar_public_id = NULL,
			    avatar_moderation_status = 'reset', updated_at = $2
			WHERE id = $1
		`, userID, now)
		if err != nil {
			return nil, err
		}
		return s.GetByID(ctx, userID)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.mem[userID]
	if !ok {
		return nil, fmt.Errorf("user not found")
	}
	u.AvatarThumbURL = nil
	u.AvatarFullURL = nil
	u.AvatarPublicID = nil
	u.UpdatedAt = now
	cp := *u
	return &cp, nil
}

func (s *UserStore) SetAvatarModeration(ctx context.Context, userID, status string) (*domain.User, error) {
	now := time.Now().UTC()
	if s.db != nil && s.db.Ready() {
		_, err := s.db.Pool.Exec(ctx, `
			UPDATE users SET avatar_moderation_status = $2, updated_at = $3 WHERE id = $1
		`, userID, status, now)
		if err != nil {
			return nil, err
		}
		return s.GetByID(ctx, userID)
	}
	return s.GetByID(ctx, userID)
}

func (s *UserStore) ListPendingAvatars(ctx context.Context, limit int) ([]LeaderboardEntry, error) {
	list, _, err := s.ListPendingAvatarsPaged(ctx, 0, limit, "")
	return list, err
}

// ListPendingAvatarsPaged returns a skip/limit page plus total (Trim BuildMeta).
// Optional q matches user id or username (deep-link focus).
func (s *UserStore) ListPendingAvatarsPaged(ctx context.Context, skip, limit int, q string) ([]LeaderboardEntry, int, error) {
	if skip < 0 {
		skip = 0
	}
	if limit <= 0 {
		limit = 50
	}
	q = strings.TrimSpace(q)
	if s.db != nil && s.db.Ready() {
		var total int
		where := `
			avatar_thumb_url IS NOT NULL
			AND COALESCE(avatar_moderation_status, 'pending') IN ('pending', 'flagged')`
		args := []any{}
		if q != "" {
			where += ` AND (id::text ILIKE $1 OR username ILIKE $1)`
			args = append(args, "%"+q+"%")
		}
		countSQL := `SELECT COUNT(*) FROM users WHERE ` + where
		if err := s.db.Pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
			return nil, 0, err
		}
		listSQL := `
			SELECT id, username, rating, xp, wins, losses, COALESCE(draws,0), region, country_code,
			       avatar_thumb_url, avatar_full_url
			FROM users
			WHERE ` + where + `
			ORDER BY updated_at DESC
			LIMIT $` + fmt.Sprintf("%d", len(args)+1) + ` OFFSET $` + fmt.Sprintf("%d", len(args)+2)
		args = append(args, limit, skip)
		rows, err := s.db.Pool.Query(ctx, listSQL, args...)
		if err != nil {
			return nil, 0, err
		}
		defer rows.Close()
		out := []LeaderboardEntry{}
		for rows.Next() {
			var e LeaderboardEntry
			if err := rows.Scan(&e.ID, &e.Username, &e.Rating, &e.XP, &e.Wins, &e.Losses, &e.Draws, &e.Region, &e.CountryCode, &e.AvatarThumbURL, &e.AvatarFullURL); err != nil {
				return nil, 0, err
			}
			out = append(out, e)
		}
		return out, total, rows.Err()
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	ql := strings.ToLower(q)
	all := []LeaderboardEntry{}
	for _, u := range s.mem {
		if u.AvatarThumbURL == nil {
			continue
		}
		if ql != "" &&
			!strings.Contains(strings.ToLower(u.ID), ql) &&
			!strings.Contains(strings.ToLower(u.Username), ql) {
			continue
		}
		all = append(all, LeaderboardEntry{
			ID: u.ID, Username: u.Username, Rating: u.Rating, XP: u.XP,
			Wins: u.Wins, Losses: u.Losses, Draws: u.Draws,
			Region: u.Region, CountryCode: u.CountryCode,
			AvatarThumbURL: u.AvatarThumbURL, AvatarFullURL: u.AvatarFullURL,
		})
	}
	total := len(all)
	if skip >= total {
		return []LeaderboardEntry{}, total, nil
	}
	end := skip + limit
	if end > total {
		end = total
	}
	return all[skip:end], total, nil
}

// UserListFilter optional Trim-style list filters (empty = no constraint).
type UserListFilter struct {
	Q           string
	Active      *bool
	CreatedFrom *time.Time
	CreatedTo   *time.Time
}

func (s *UserStore) ListUsers(ctx context.Context, limit int) ([]map[string]any, error) {
	if limit <= 0 {
		limit = 100
	}
	list, _, err := s.ListUsersPaged(ctx, 0, limit, UserListFilter{})
	return list, err
}

// ListUsersPaged returns a skip/limit page plus total count (Trim BuildMeta).
func (s *UserStore) ListUsersPaged(ctx context.Context, skip, limit int, filter UserListFilter) ([]map[string]any, int, error) {
	if skip < 0 {
		skip = 0
	}
	if limit <= 0 {
		limit = 100
	}
	out := []map[string]any{}
	q := strings.TrimSpace(filter.Q)
	if s.db != nil && s.db.Ready() {
		where := []string{"TRUE"}
		args := []any{}
		argN := 1
		if q != "" {
			where = append(where, fmt.Sprintf(
				"(username ILIKE $%d OR COALESCE(email,'') ILIKE $%d OR COALESCE(primary_phone,'') ILIKE $%d OR id::text ILIKE $%d)",
				argN, argN, argN, argN,
			))
			args = append(args, "%"+q+"%")
			argN++
		}
		if filter.Active != nil {
			where = append(where, fmt.Sprintf("is_active = $%d", argN))
			args = append(args, *filter.Active)
			argN++
		}
		if filter.CreatedFrom != nil {
			where = append(where, fmt.Sprintf("created_at >= $%d", argN))
			args = append(args, *filter.CreatedFrom)
			argN++
		}
		if filter.CreatedTo != nil {
			where = append(where, fmt.Sprintf("created_at < $%d", argN))
			args = append(args, *filter.CreatedTo)
			argN++
		}
		whereSQL := strings.Join(where, " AND ")
		var total int
		if err := s.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE `+whereSQL, args...).Scan(&total); err != nil {
			return nil, 0, err
		}
		limitArg := argN
		offsetArg := argN + 1
		listArgs := append(append([]any{}, args...), limit, skip)
		rows, err := s.db.Pool.Query(ctx, fmt.Sprintf(`
			SELECT id, username, role, rating, xp, wins, losses, COALESCE(draws,0), is_active, created_at, country_code,
			       email, avatar_thumb_url, primary_phone,
			       (phone_kyc_verified_at IS NOT NULL), (document_kyc_verified_at IS NOT NULL)
			FROM users WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d
		`, whereSQL, limitArg, offsetArg), listArgs...)
		if err != nil {
			return nil, 0, err
		}
		defer rows.Close()
		for rows.Next() {
			var id, username, role string
			var rating, xp, wins, losses, draws int
			var active bool
			var created time.Time
			var countryCode, email, avatarThumb, primaryPhone *string
			var phoneKyc, docKyc bool
			if err := rows.Scan(&id, &username, &role, &rating, &xp, &wins, &losses, &draws, &active, &created, &countryCode, &email, &avatarThumb, &primaryPhone, &phoneKyc, &docKyc); err != nil {
				return nil, 0, err
			}
			row := map[string]any{
				"id": id, "username": username, "role": role, "rating": rating, "xp": xp,
				"wins": wins, "losses": losses, "draws": draws, "is_active": active, "created_at": created,
				"phone_kyc_verified": phoneKyc, "document_kyc_verified": docKyc,
			}
			if countryCode != nil && strings.TrimSpace(*countryCode) != "" {
				row["country_code"] = strings.ToUpper(strings.TrimSpace(*countryCode))
			}
			if email != nil && strings.TrimSpace(*email) != "" {
				row["email"] = strings.TrimSpace(*email)
			}
			if avatarThumb != nil && strings.TrimSpace(*avatarThumb) != "" {
				row["avatar_thumb_url"] = strings.TrimSpace(*avatarThumb)
			}
			if primaryPhone != nil && strings.TrimSpace(*primaryPhone) != "" {
				row["primary_phone"] = strings.TrimSpace(*primaryPhone)
			}
			out = append(out, row)
		}
		return out, total, rows.Err()
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	all := make([]map[string]any, 0, len(s.mem))
	for _, u := range s.mem {
		if q != "" {
			ql := strings.ToLower(q)
			hay := strings.ToLower(u.Username)
			if u.Email != nil {
				hay += " " + strings.ToLower(*u.Email)
			}
			if u.PrimaryPhone != nil {
				hay += " " + strings.ToLower(*u.PrimaryPhone)
			}
			hay += " " + strings.ToLower(u.ID)
			if !strings.Contains(hay, ql) {
				continue
			}
		}
		if filter.Active != nil && u.IsActive != *filter.Active {
			continue
		}
		if filter.CreatedFrom != nil && u.CreatedAt.Before(*filter.CreatedFrom) {
			continue
		}
		if filter.CreatedTo != nil && !u.CreatedAt.Before(*filter.CreatedTo) {
			continue
		}
		row := map[string]any{
			"id": u.ID, "username": u.Username, "role": u.Role, "rating": u.Rating, "xp": u.XP,
			"wins": u.Wins, "losses": u.Losses, "draws": u.Draws, "is_active": u.IsActive, "created_at": u.CreatedAt,
			"phone_kyc_verified": u.PhoneKycVerifiedAt != nil, "document_kyc_verified": u.DocumentKycVerifiedAt != nil,
		}
		if u.CountryCode != nil && strings.TrimSpace(*u.CountryCode) != "" {
			row["country_code"] = strings.ToUpper(strings.TrimSpace(*u.CountryCode))
		}
		if u.Email != nil && strings.TrimSpace(*u.Email) != "" {
			row["email"] = strings.TrimSpace(*u.Email)
		}
		if u.AvatarThumbURL != nil && strings.TrimSpace(*u.AvatarThumbURL) != "" {
			row["avatar_thumb_url"] = strings.TrimSpace(*u.AvatarThumbURL)
		}
		if u.PrimaryPhone != nil && strings.TrimSpace(*u.PrimaryPhone) != "" {
			row["primary_phone"] = strings.TrimSpace(*u.PrimaryPhone)
		}
		all = append(all, row)
	}
	total := len(all)
	if skip >= total {
		return []map[string]any{}, total, nil
	}
	end := skip + limit
	if end > total {
		end = total
	}
	return all[skip:end], total, nil
}

func (s *UserStore) CountUsersByRole(ctx context.Context, role string) (int64, error) {
	role = strings.TrimSpace(role)
	if role == "" {
		return 0, fmt.Errorf("role required")
	}
	if s.db == nil || !s.db.Ready() {
		return 0, fmt.Errorf("service temporarily unavailable")
	}
	var n int64
	err := s.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE role=$1`, role).Scan(&n)
	return n, err
}

func (s *UserStore) SetRole(ctx context.Context, userID, role string) (*domain.User, error) {
	if role == "" {
		return nil, fmt.Errorf("invalid role")
	}
	if s.db != nil && s.db.Ready() {
		_, err := s.db.Pool.Exec(ctx, `UPDATE users SET role=$2, updated_at=NOW() WHERE id=$1`, userID, role)
		if err != nil {
			return nil, err
		}
		return s.GetByID(ctx, userID)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.mem[userID]
	if !ok {
		return nil, fmt.Errorf("user not found")
	}
	u.Role = role
	u.UpdatedAt = time.Now().UTC()
	cp := *u
	return &cp, nil
}

// ApplyCareerResult updates wins/losses/draws, XP, and rating for one PvP seat.
// VS-AI must never call this (zero career rewards for practice mode).
func (s *UserStore) ApplyCareerResult(ctx context.Context, userID, result string, rewards MatchRewardsConfig) error {
	if userID == "" {
		return nil
	}
	if rewards.Source != "database" {
		return fmt.Errorf("match rewards unavailable")
	}
	if rewards.RatingFloor < 0 {
		return fmt.Errorf("match_rewards.rating_floor must be >= 0")
	}
	var xpDelta, ratingDelta int
	var winInc, lossInc, drawInc int
	switch result {
	case "win":
		xpDelta, ratingDelta, winInc = rewards.WinXP, rewards.WinRating, 1
	case "loss":
		xpDelta, ratingDelta, lossInc = rewards.LossXP, rewards.LossRating, 1
	case "draw":
		xpDelta, ratingDelta, drawInc = rewards.DrawXP, rewards.DrawRating, 1
	default:
		return fmt.Errorf("invalid match result")
	}
	floor := rewards.RatingFloor
	if s.db != nil && s.db.Ready() {
		tag, err := s.db.Pool.Exec(ctx, `
			UPDATE users SET
				wins = wins + $2,
				losses = losses + $3,
				draws = COALESCE(draws,0) + $4,
				xp = xp + $5,
				rating = GREATEST($7, rating + $6),
				updated_at = NOW()
			WHERE id = $1 AND is_active = TRUE
		`, userID, winInc, lossInc, drawInc, xpDelta, ratingDelta, floor)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return fmt.Errorf("user not found")
		}
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.mem[userID]
	if !ok || !u.IsActive {
		return fmt.Errorf("user not found")
	}
	u.Wins += winInc
	u.Losses += lossInc
	u.Draws += drawInc
	u.XP += xpDelta
	u.Rating += ratingDelta
	if u.Rating < floor {
		u.Rating = floor
	}
	u.UpdatedAt = time.Now().UTC()
	return nil
}

// HardDelete permanently removes the user and owned rows that would block FK delete.
// CASCADE covers tournament_entries, device_fingerprints, otp_challenges, payout_methods/requests.
// Match/history player links and optional reviewer refs are nulled (anonymized retention).
func (s *UserStore) HardDelete(ctx context.Context, userID string) error {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return fmt.Errorf("user id required")
	}
	if s.db != nil && s.db.Ready() {
		tx, err := s.db.Pool.Begin(ctx)
		if err != nil {
			return err
		}
		defer tx.Rollback(ctx)

		prepares := []string{
			`UPDATE feature_flags SET updated_by = NULL WHERE updated_by = $1`,
			`UPDATE tournaments SET created_by = NULL WHERE created_by = $1`,
			`UPDATE matches SET player1_id = NULL WHERE player1_id = $1`,
			`UPDATE matches SET player2_id = NULL WHERE player2_id = $1`,
			`UPDATE matches SET winner_id = NULL WHERE winner_id = $1`,
			`UPDATE match_history SET player1_id = NULL WHERE player1_id = $1`,
			`UPDATE match_history SET player2_id = NULL WHERE player2_id = $1`,
			`UPDATE match_history SET winner_id = NULL WHERE winner_id = $1`,
			`UPDATE geo_ip_records SET user_id = NULL WHERE user_id = $1`,
			`UPDATE payment_receipts SET reviewed_by = NULL WHERE reviewed_by = $1`,
			`UPDATE payout_requests SET reviewed_by = NULL WHERE reviewed_by = $1`,
			// Clear telegram ops reviewer so Ready cannot stay true after hard-delete (reviewed_by FK).
			`UPDATE platform_settings
			 SET value = jsonb_set(COALESCE(value, '{}'::jsonb), '{reviewer_user_id}', '""'::jsonb),
			     updated_at = NOW()
			 WHERE key = 'telegram_ops_bot'
			   AND NULLIF(trim(value->>'reviewer_user_id'), '') = $1`,
			`DELETE FROM payment_receipts WHERE user_id = $1`,
			`DELETE FROM payment_intents WHERE user_id = $1`,
			`DELETE FROM wallets WHERE user_id = $1`,
			`DELETE FROM ad_campaigns WHERE publisher_id = $1`,
		}
		for _, sql := range prepares {
			if _, err := tx.Exec(ctx, sql, userID); err != nil {
				return err
			}
		}
		tag, err := tx.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return fmt.Errorf("user not found")
		}
		return tx.Commit(ctx)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.mem[userID]
	if !ok {
		return fmt.Errorf("user not found")
	}
	delete(s.byUsername, u.Username)
	delete(s.mem, userID)
	return nil
}

// DataExport returns public-safe account fields for store-compliance download.
func (s *UserStore) DataExport(ctx context.Context, userID string) (map[string]any, error) {
	u, err := s.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	var email any
	if u.Email != nil {
		email = *u.Email
	} else {
		email = nil
	}
	return map[string]any{
		"id":         u.ID,
		"username":   u.Username,
		"email":      email,
		"rating":     u.Rating,
		"xp":         u.XP,
		"created_at": u.CreatedAt,
		"role":       u.Role,
	}, nil
}

// SetActive soft-deactivates or reactivates a user (no hard DELETE).
func (s *UserStore) SetActive(ctx context.Context, userID string, active bool) (*domain.User, error) {
	if s.db != nil && s.db.Ready() {
		tag, err := s.db.Pool.Exec(ctx, `UPDATE users SET is_active=$2, updated_at=NOW() WHERE id=$1`, userID, active)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, fmt.Errorf("user not found")
		}
		return s.GetByID(ctx, userID)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.mem[userID]
	if !ok {
		return nil, fmt.Errorf("user not found")
	}
	u.IsActive = active
	u.UpdatedAt = time.Now().UTC()
	cp := *u
	return &cp, nil
}

func (s *UserStore) UpdateAvatar(ctx context.Context, userID, thumbURL, fullURL, publicID string) (*domain.User, error) {
	now := time.Now().UTC()
	if s.db != nil && s.db.Ready() {
		_, err := s.db.Pool.Exec(ctx, `
			UPDATE users
			SET avatar_thumb_url = $2, avatar_full_url = $3, avatar_public_id = $4,
			    avatar_moderation_status = 'pending', updated_at = $5
			WHERE id = $1
		`, userID, thumbURL, fullURL, publicID, now)
		if err != nil {
			return nil, err
		}
		return s.GetByID(ctx, userID)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.mem[userID]
	if !ok {
		return nil, fmt.Errorf("user not found")
	}
	u.AvatarThumbURL = &thumbURL
	u.AvatarFullURL = &fullURL
	u.AvatarPublicID = &publicID
	u.UpdatedAt = now
	cp := *u
	return &cp, nil
}

type scannable interface {
	Scan(dest ...any) error
}

func scanUser(row scannable) (*domain.User, error) {
	var u domain.User
	var draws int
	err := row.Scan(
		&u.ID, &u.Email, &u.Username, &u.Role, &u.Rating, &u.XP, &u.Wins, &u.Losses,
		&draws, &u.AvatarThumbURL, &u.AvatarFullURL, &u.CountryCode, &u.Region,
		&u.IsActive, &u.CreatedAt, &u.UpdatedAt, &u.PrimaryPhone,
		&u.DateOfBirth, &u.AgeVerifiedAt, &u.PhoneKycVerifiedAt, &u.DocumentKycVerifiedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, err
	}
	u.Draws = draws
	return &u, nil
}

// SetDateOfBirthAgeGate stores DOB and sets age_verified_at only when age >= minAgeYears.
func (s *UserStore) SetDateOfBirthAgeGate(ctx context.Context, userID string, dob time.Time, minAgeYears int) (*domain.User, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	if minAgeYears < 1 {
		return nil, fmt.Errorf("min age unavailable")
	}
	now := time.Now().UTC()
	age := ageYears(dob, now)
	if age < minAgeYears {
		_, err := s.db.Pool.Exec(ctx, `
			UPDATE users
			SET date_of_birth = $2, age_verified_at = NULL, updated_at = NOW()
			WHERE id = $1
		`, userID, dob.UTC().Truncate(24*time.Hour))
		if err != nil {
			return nil, err
		}
		return nil, fmt.Errorf("too_young")
	}
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE users
		SET date_of_birth = $2, age_verified_at = $3, updated_at = NOW()
		WHERE id = $1
	`, userID, dob.UTC().Truncate(24*time.Hour), now)
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, userID)
}

// MarkPhoneKycVerified stamps phone KYC after phone-channel OTP success.
func (s *UserStore) MarkPhoneKycVerified(ctx context.Context, userID string) error {
	if s.db == nil || !s.db.Ready() {
		return fmt.Errorf("service temporarily unavailable")
	}
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE users SET phone_kyc_verified_at = NOW(), updated_at = NOW() WHERE id = $1
	`, userID)
	return err
}

// SetPrimaryPhone updates users.primary_phone and clears phone KYC until re-verified.
func (s *UserStore) SetPrimaryPhone(ctx context.Context, userID, phone string) (*domain.User, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	phone = strings.TrimSpace(phone)
	if len(phone) < 8 {
		return nil, fmt.Errorf("phone required")
	}
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE users
		SET primary_phone = $2, phone_kyc_verified_at = NULL, updated_at = NOW()
		WHERE id = $1
	`, userID, phone)
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, userID)
}

func ageYears(dob, now time.Time) int {
	years := now.Year() - dob.Year()
	if now.YearDay() < dob.YearDay() {
		years--
	}
	return years
}
