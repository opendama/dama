package invites

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"dama/apps/api/internal/db"
	"dama/apps/api/internal/matchmaking"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/redisx"
	"dama/apps/api/internal/store"
	"dama/apps/api/internal/ws"

	"github.com/google/uuid"
)

// ErrCannotInviteYourself is returned when from_user == to_user (username or id).
var ErrCannotInviteYourself = errors.New("cannot invite yourself")

type Invite struct {
	ID                 string    `json:"id"`
	FromUserID         string    `json:"from_user_id"`
	ToUserID           string    `json:"to_user_id,omitempty"` // empty for open challenge links
	Status             string    `json:"status"`               // pending | accepted | declined | expired
	GameID             string    `json:"game_id,omitempty"`
	ShareToken         string    `json:"share_token,omitempty"`
	Rated              bool      `json:"rated"`
	PreferredColor     string    `json:"preferred_color,omitempty"` // white | black | random
	TimeControlSeconds int       `json:"time_control_seconds,omitempty"`
	CreatedAt          time.Time `json:"created_at"`
	ExpiresAt          time.Time `json:"expires_at"`
}

// CreateOptions optional challenge settings (DB/API-driven; no client invent).
type CreateOptions struct {
	Rated              bool
	PreferredColor     string // white | black | random
	TimeControlSeconds int
	OpenLink           bool // create shareable open challenge (no to_user yet)
}

type Service struct {
	rdb      *redisx.Client
	hub      *ws.Hub
	queue    *matchmaking.Queue
	users    *store.UserStore
	settings *store.SettingsStore
	db       *db.Handle
	Cash     *store.CashRmgStore
	mu       sync.Mutex
	mem      map[string]*Invite
}

func New(rdb *redisx.Client, hub *ws.Hub, queue *matchmaking.Queue, users *store.UserStore, settings *store.SettingsStore, database *db.Handle) *Service {
	return &Service{
		rdb:      rdb,
		hub:      hub,
		queue:    queue,
		users:    users,
		settings: settings,
		db:       database,
		mem:      map[string]*Invite{},
	}
}

func (s *Service) notifyPool() bool {
	return s.db != nil && s.db.Ready()
}

// inviteTTL returns match_clock.invite_ttl_seconds from platform_settings (fail-closed).
func (s *Service) inviteTTL() (time.Duration, error) {
	if s.settings == nil {
		return 0, fmt.Errorf("invite settings unavailable")
	}
	sec := s.settings.MatchClock().InviteTTLSeconds
	if sec <= 0 {
		return 0, fmt.Errorf("match_clock.invite_ttl_seconds required")
	}
	return time.Duration(sec) * time.Second, nil
}

func allowMemory() bool { return os.Getenv("DAMA_ALLOW_MEMORY") == "1" }

func (s *Service) redisReady() bool {
	return s.rdb != nil && s.rdb.Ready()
}

func inviteKey(id string) string { return "dama:invite:" + id }

func userInvitesKey(uid string) string { return "dama:invites:user:" + uid }

func normalizeColor(c string) (string, error) {
	switch c {
	case "white", "black", "random":
		return c, nil
	default:
		return "", fmt.Errorf("preferred_color must be white, black, or random")
	}
}

func (s *Service) Create(ctx context.Context, fromUserID, toUsernameOrID string, opt CreateOptions) (*Invite, error) {
	if fromUserID == "" {
		return nil, fmt.Errorf("from required")
	}
	from, err := s.users.GetByID(ctx, fromUserID)
	if err != nil {
		return nil, fmt.Errorf("user not found")
	}
	ttl, err := s.inviteTTL()
	if err != nil {
		return nil, err
	}
	color, err := normalizeColor(opt.PreferredColor)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	inv := &Invite{
		ID:                 uuid.NewString(),
		FromUserID:         from.ID,
		Status:             "pending",
		ShareToken:         uuid.NewString(),
		Rated:              opt.Rated,
		PreferredColor:     color,
		TimeControlSeconds: opt.TimeControlSeconds,
		CreatedAt:          now,
		ExpiresAt:          now.Add(ttl),
	}

	if !opt.OpenLink {
		if toUsernameOrID == "" {
			return nil, fmt.Errorf("from and to required")
		}
		to, err := s.users.GetByID(ctx, toUsernameOrID)
		if err != nil {
			to, err = s.users.GetByUsername(ctx, toUsernameOrID)
			if err != nil {
				return nil, fmt.Errorf("opponent not found")
			}
		}
		if to.ID == fromUserID {
			return nil, ErrCannotInviteYourself
		}
		inv.ToUserID = to.ID
	}

	if err := s.save(ctx, inv); err != nil {
		return nil, err
	}
	// Always arm the creator (targeted + open challenge links) with invite_sent so
	// clients show the outgoing wait dialog and can cancel / navigate on accept.
	if s.hub != nil {
		toName := ""
		if inv.ToUserID != "" {
			if to, err := s.users.GetByID(ctx, inv.ToUserID); err == nil && to != nil {
				toName = to.Username
			}
			invitePayload := map[string]any{
				"id":                   inv.ID,
				"from_user_id":         from.ID,
				"from_username":        from.Username,
				"from_rating":          from.Rating,
				"from_avatar":          from.AvatarThumbURL,
				"expires_at":           inv.ExpiresAt,
				"rated":                inv.Rated,
				"preferred_color":      inv.PreferredColor,
				"time_control_seconds": inv.TimeControlSeconds,
			}
			if from.CountryCode != nil && *from.CountryCode != "" {
				invitePayload["from_country_code"] = *from.CountryCode
			}
			if s.Cash != nil && s.Cash.Ready() {
				if tier, badge := s.Cash.HostTrust(from.PhoneKycVerifiedAt != nil, from.DocumentKycVerifiedAt != nil); tier != "" && badge != "" {
					invitePayload["from_host_trust_tier"] = tier
					invitePayload["from_host_trust_badge"] = badge
				}
			}
			s.hub.BroadcastToUsers([]string{inv.ToUserID}, map[string]any{
				"type":   "invite_received",
				"invite": invitePayload,
			})
			if s.notifyPool() {
				notifications.EmitPlayer(ctx, s.db.Pool, inv.ToUserID, notifications.KindPlayerInviteReceived,
					"invite_received:"+inv.ID, inv.ID, from.Username)
			}
		}
		sentPayload := map[string]any{
			"type":        "invite_sent",
			"invite_id":   inv.ID,
			"share_token": inv.ShareToken,
			"open_link":   inv.ToUserID == "",
		}
		if inv.ToUserID != "" {
			sentPayload["to_user_id"] = inv.ToUserID
			sentPayload["to_username"] = toName
		}
		s.hub.BroadcastToUsers([]string{from.ID}, sentPayload)
	}
	return inv, nil
}

// GetForParticipant returns an invite if the actor is the sender or recipient.
func (s *Service) GetForParticipant(ctx context.Context, inviteID, actorUserID string) (*Invite, error) {
	inviteID = strings.TrimSpace(inviteID)
	actorUserID = strings.TrimSpace(actorUserID)
	if inviteID == "" || actorUserID == "" {
		return nil, fmt.Errorf("ids required")
	}
	inv, err := s.get(ctx, inviteID)
	if err != nil {
		return nil, err
	}
	if inv.FromUserID != actorUserID && inv.ToUserID != actorUserID {
		return nil, fmt.Errorf("invite not found")
	}
	return inv, nil
}

func (s *Service) GetByShareToken(ctx context.Context, token string) (*Invite, error) {
	if token == "" {
		return nil, fmt.Errorf("token required")
	}
	// Scan mem + redis by token via known invite id prefix is expensive;
	// store reverse index dama:invite:token:{token} -> id
	if s.redisReady() {
		id, err := s.rdb.RDB.Get(ctx, "dama:invite:token:"+token).Result()
		if err == nil && id != "" {
			return s.get(ctx, id)
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, inv := range s.mem {
		if inv != nil && inv.ShareToken == token {
			cp := *inv
			return &cp, nil
		}
	}
	return nil, fmt.Errorf("invite not found")
}

func inviteClaimKey(id string) string { return "dama:invite:claim:" + id }

func (s *Service) claimHeld(ctx context.Context, inviteID string) bool {
	if !s.redisReady() {
		return false
	}
	n, err := s.rdb.RDB.Exists(ctx, inviteClaimKey(inviteID)).Result()
	return err == nil && n > 0
}

func (s *Service) Accept(ctx context.Context, inviteID, actorUserID string) (*Invite, *matchmaking.MatchReady, error) {
	// Atomic claim: Redis SETNX (multi-instance) or process mutex (memory).
	useRedis := s.redisReady()
	releaseClaim := false
	if useRedis {
		ok, err := s.rdb.RDB.SetNX(ctx, inviteClaimKey(inviteID), actorUserID, 45*time.Second).Result()
		if err != nil {
			return nil, nil, fmt.Errorf("invite claim unavailable")
		}
		if !ok {
			return nil, nil, fmt.Errorf("invite not pending")
		}
		releaseClaim = true
		defer func() {
			if releaseClaim {
				_ = s.rdb.RDB.Del(ctx, inviteClaimKey(inviteID))
			}
		}()
	} else {
		s.mu.Lock()
		defer s.mu.Unlock()
	}

	inv, err := s.getInvite(ctx, inviteID, !useRedis)
	if err != nil {
		return nil, nil, err
	}
	// Targeted invite: only recipient. Open link: anyone except sender may claim.
	if inv.ToUserID != "" {
		if inv.ToUserID != actorUserID {
			return nil, nil, fmt.Errorf("not invite recipient")
		}
	} else if actorUserID == inv.FromUserID {
		return nil, nil, fmt.Errorf("cannot accept own challenge link")
	} else {
		inv.ToUserID = actorUserID
	}
	if inv.Status != "pending" {
		return nil, nil, fmt.Errorf("invite not pending")
	}
	if time.Now().UTC().After(inv.ExpiresAt) {
		inv.Status = "expired"
		_ = s.saveInvite(ctx, inv, !useRedis)
		if s.notifyPool() {
			toName := inv.ToUserID
			if inv.ToUserID != "" {
				if toU, err := s.users.GetByID(ctx, inv.ToUserID); err == nil && toU != nil {
					toName = toU.Username
				}
			} else {
				toName = "an opponent"
			}
			notifications.EmitPlayer(ctx, s.db.Pool, inv.FromUserID, notifications.KindPlayerInviteExpired,
				"invite_expired:"+inv.ID, inv.ID, toName)
		}
		return nil, nil, fmt.Errorf("invite expired")
	}
	from, err := s.users.GetByID(ctx, inv.FromUserID)
	if err != nil {
		return nil, nil, fmt.Errorf("inviter unavailable")
	}
	to, err := s.users.GetByID(ctx, inv.ToUserID)
	if err != nil {
		return nil, nil, fmt.Errorf("invitee unavailable")
	}
	pFrom := matchmaking.WaitingPlayer{
		UserID: from.ID, Username: from.Username, Rating: from.Rating,
		AvatarThumbURL: from.AvatarThumbURL, CountryCode: from.CountryCode,
	}
	pTo := matchmaking.WaitingPlayer{
		UserID: to.ID, Username: to.Username, Rating: to.Rating,
		AvatarThumbURL: to.AvatarThumbURL, CountryCode: to.CountryCode,
	}
	// Preferred color is from the inviter's perspective (white = seat 1).
	var p1, p2 matchmaking.WaitingPlayer
	switch inv.PreferredColor {
	case "black":
		p1, p2 = pTo, pFrom
	case "random":
		if time.Now().UnixNano()%2 == 0 {
			p1, p2 = pFrom, pTo
		} else {
			p1, p2 = pTo, pFrom
		}
	default: // white
		p1, p2 = pFrom, pTo
	}
	// No match_found broadcast - invite_accepted is the sole client navigate signal.
	ready, err := s.queue.CreateDirectMatch(p1, p2, inv.TimeControlSeconds, inv.Rated, false)
	if err != nil {
		return nil, nil, err
	}
	inv.Status = "accepted"
	inv.GameID = ready.GameID
	if err := s.saveInvite(ctx, inv, !useRedis); err != nil {
		if err2 := s.saveInvite(ctx, inv, !useRedis); err2 != nil {
			// Keep SETNX claim so a retry cannot create a second game until TTL.
			releaseClaim = false
			return nil, nil, fmt.Errorf("invite save failed")
		}
	}
	// Inviter only via broadcast; acceptor gets hub WriteJSON (avoid double navigate).
	if s.hub != nil {
		s.hub.BroadcastToUsers([]string{inv.FromUserID}, map[string]any{
			"type":      "invite_accepted",
			"invite_id": inv.ID,
			"game_id":   ready.GameID,
		})
	}
	if s.notifyPool() {
		notifications.EmitPlayer(ctx, s.db.Pool, inv.FromUserID, notifications.KindPlayerInviteAccepted,
			"invite_accepted:"+inv.ID, ready.GameID, to.Username)
	}
	return inv, ready, nil
}

// AcceptByToken accepts an open or targeted invite via share_token.
func (s *Service) AcceptByToken(ctx context.Context, token, actorUserID string) (*Invite, *matchmaking.MatchReady, error) {
	inv, err := s.GetByShareToken(ctx, token)
	if err != nil {
		return nil, nil, err
	}
	return s.Accept(ctx, inv.ID, actorUserID)
}

func (s *Service) Decline(ctx context.Context, inviteID, actorUserID string) (*Invite, error) {
	if s.claimHeld(ctx, inviteID) {
		return nil, fmt.Errorf("invite not pending")
	}
	inv, err := s.get(ctx, inviteID)
	if err != nil {
		return nil, err
	}
	if inv.ToUserID != actorUserID {
		return nil, fmt.Errorf("not invite recipient")
	}
	if inv.Status != "pending" {
		return nil, fmt.Errorf("invite not pending")
	}
	inv.Status = "declined"
	if err := s.save(ctx, inv); err != nil {
		return nil, err
	}
	if s.hub != nil {
		s.hub.BroadcastToUsers([]string{inv.FromUserID}, map[string]any{
			"type":      "invite_declined",
			"invite_id": inv.ID,
		})
	}
	if s.notifyPool() {
		name := actorUserID
		if to, err := s.users.GetByID(ctx, actorUserID); err == nil && to != nil {
			name = to.Username
		}
		notifications.EmitPlayer(ctx, s.db.Pool, inv.FromUserID, notifications.KindPlayerInviteDeclined,
			"invite_declined:"+inv.ID, inv.ID, name)
	}
	return inv, nil
}

// Cancel lets the inviter withdraw a still-pending invite (smart-menu outgoing wait).
func (s *Service) Cancel(ctx context.Context, inviteID, actorUserID string) (*Invite, error) {
	if s.claimHeld(ctx, inviteID) {
		return nil, fmt.Errorf("invite not pending")
	}
	inv, err := s.get(ctx, inviteID)
	if err != nil {
		return nil, err
	}
	if inv.FromUserID != actorUserID {
		return nil, fmt.Errorf("not invite sender")
	}
	if inv.Status != "pending" {
		return nil, fmt.Errorf("invite not pending")
	}
	inv.Status = "cancelled"
	if err := s.save(ctx, inv); err != nil {
		return nil, err
	}
	if s.hub != nil && inv.ToUserID != "" {
		s.hub.BroadcastToUsers([]string{inv.ToUserID}, map[string]any{
			"type":      "invite_cancelled",
			"invite_id": inv.ID,
		})
	}
	if s.notifyPool() && inv.ToUserID != "" {
		notifications.EmitPlayer(ctx, s.db.Pool, inv.ToUserID, notifications.KindPlayerInviteCancelled,
			"invite_cancelled:"+inv.ID, inv.ID)
	}
	return inv, nil
}

func (s *Service) ListPendingFor(ctx context.Context, userID string) ([]Invite, error) {
	ids, err := s.listIDs(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]Invite, 0, len(ids))
	now := time.Now().UTC()
	for _, id := range ids {
		inv, err := s.get(ctx, id)
		if err != nil {
			continue
		}
		if inv.ToUserID != userID && inv.FromUserID != userID {
			continue
		}
		if inv.Status == "pending" && now.After(inv.ExpiresAt) {
			inv.Status = "expired"
			_ = s.save(ctx, inv)
			if s.notifyPool() {
				toName := inv.ToUserID
				if inv.ToUserID != "" {
					if toU, err := s.users.GetByID(ctx, inv.ToUserID); err == nil && toU != nil {
						toName = toU.Username
					}
				} else {
					toName = "an opponent"
				}
				notifications.EmitPlayer(ctx, s.db.Pool, inv.FromUserID, notifications.KindPlayerInviteExpired,
					"invite_expired:"+inv.ID, inv.ID, toName)
			}
		}
		if inv.Status == "pending" {
			out = append(out, *inv)
		}
	}
	return out, nil
}

func (s *Service) save(ctx context.Context, inv *Invite) error {
	return s.saveInvite(ctx, inv, false)
}

// saveInvite persists invite. memLocked=true when caller already holds s.mu (Accept memory path).
func (s *Service) saveInvite(ctx context.Context, inv *Invite, memLocked bool) error {
	raw, err := json.Marshal(inv)
	if err != nil {
		return err
	}
	if s.redisReady() {
		ttl := time.Until(inv.ExpiresAt)
		if ttl <= 0 {
			ttl, err = s.inviteTTL()
			if err != nil {
				return err
			}
		}
		pipe := s.rdb.RDB.Pipeline()
		pipe.Set(ctx, inviteKey(inv.ID), raw, ttl)
		pipe.SAdd(ctx, userInvitesKey(inv.FromUserID), inv.ID)
		pipe.Expire(ctx, userInvitesKey(inv.FromUserID), ttl)
		if inv.ToUserID != "" {
			pipe.SAdd(ctx, userInvitesKey(inv.ToUserID), inv.ID)
			pipe.Expire(ctx, userInvitesKey(inv.ToUserID), ttl)
		}
		if inv.ShareToken != "" {
			pipe.Set(ctx, "dama:invite:token:"+inv.ShareToken, inv.ID, ttl)
		}
		_, err = pipe.Exec(ctx)
		return err
	}
	if !allowMemory() {
		return fmt.Errorf("invite store unavailable")
	}
	if !memLocked {
		s.mu.Lock()
		defer s.mu.Unlock()
	}
	cp := *inv
	s.mem[inv.ID] = &cp
	return nil
}

func (s *Service) get(ctx context.Context, id string) (*Invite, error) {
	return s.getInvite(ctx, id, false)
}

// getInvite loads invite. memLocked=true when caller already holds s.mu (Accept memory path).
func (s *Service) getInvite(ctx context.Context, id string, memLocked bool) (*Invite, error) {
	if s.redisReady() {
		raw, err := s.rdb.RDB.Get(ctx, inviteKey(id)).Bytes()
		if err != nil {
			return nil, fmt.Errorf("invite not found")
		}
		var inv Invite
		if err := json.Unmarshal(raw, &inv); err != nil {
			return nil, err
		}
		return &inv, nil
	}
	if !allowMemory() {
		return nil, fmt.Errorf("invite store unavailable")
	}
	if !memLocked {
		s.mu.Lock()
		defer s.mu.Unlock()
	}
	inv, ok := s.mem[id]
	if !ok {
		return nil, fmt.Errorf("invite not found")
	}
	cp := *inv
	return &cp, nil
}

func (s *Service) listIDs(ctx context.Context, userID string) ([]string, error) {
	if s.redisReady() {
		return s.rdb.RDB.SMembers(ctx, userInvitesKey(userID)).Result()
	}
	if !allowMemory() {
		return nil, fmt.Errorf("invite store unavailable")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	out := []string{}
	for id, inv := range s.mem {
		if inv.FromUserID == userID || inv.ToUserID == userID {
			out = append(out, id)
		}
	}
	return out, nil
}
