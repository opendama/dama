package auth

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Supabase Auth JWTs: legacy HS256 with JWT secret; current ES256 via JWKS.
// Google social sign-in.

type supabaseJWKS struct {
	Keys []supabaseJWK `json:"keys"`
}

type supabaseJWK struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Alg string `json:"alg"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
	Use string `json:"use"`
}

var (
	supabaseJWKSMu    sync.Mutex
	supabaseJWKSCache *supabaseJWKS
	supabaseJWKSAt    time.Time
	supabaseJWKSURL   string
)

type supabaseClaims struct {
	Sub         string `json:"sub"`
	Email       string `json:"email"`
	Exp         int64  `json:"exp"`
	Iss         string `json:"iss"`
	Aud         any    `json:"aud"`
	AppMetadata struct {
		Provider  string   `json:"provider"`
		Providers []string `json:"providers"`
	} `json:"app_metadata"`
	UserMetadata map[string]any `json:"user_metadata"`
}

// SupabaseIdentity is the verified identity used to upsert a dama user.
type SupabaseIdentity struct {
	Sub       string
	Provider  string   // primary app_metadata.provider
	Providers []string // all app_metadata.providers (fail-closed allow-list)
	Email     string
	Name      string
	Avatar    string
}

// VerifySupabaseAccessToken validates a Supabase user access token (HS256 or ES256).
func VerifySupabaseAccessToken(token, hsSecret, supabaseURL string) (*SupabaseIdentity, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("malformed jwt")
	}
	headerJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, err
	}
	var header struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
	}
	if err := json.Unmarshal(headerJSON, &header); err != nil {
		return nil, err
	}
	alg := strings.ToUpper(strings.TrimSpace(header.Alg))
	switch alg {
	case "ES256":
		if err := verifyES256JWT(parts, strings.TrimSpace(header.Kid), supabaseURL); err != nil {
			return nil, err
		}
	case "HS256":
		if err := verifyHS256Sig(parts, hsSecret); err != nil {
			return nil, err
		}
	default:
		return nil, fmt.Errorf("unsupported alg %s", alg)
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, err
	}
	var claims supabaseClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, err
	}
	if claims.Sub == "" {
		return nil, fmt.Errorf("missing sub")
	}
	if claims.Exp > 0 && time.Now().Unix() > claims.Exp {
		return nil, fmt.Errorf("expired")
	}
	if err := validateSupabaseIssuerAudience(claims, supabaseURL); err != nil {
		return nil, err
	}
	provider := strings.ToLower(strings.TrimSpace(claims.AppMetadata.Provider))
	providers := make([]string, 0, len(claims.AppMetadata.Providers)+1)
	seen := map[string]struct{}{}
	addProvider := func(p string) {
		p = strings.ToLower(strings.TrimSpace(p))
		if p == "" {
			return
		}
		if _, ok := seen[p]; ok {
			return
		}
		seen[p] = struct{}{}
		providers = append(providers, p)
	}
	addProvider(provider)
	for _, p := range claims.AppMetadata.Providers {
		addProvider(p)
	}
	if provider == "" && len(providers) > 0 {
		provider = providers[0]
	}
	email := strings.TrimSpace(strings.ToLower(claims.Email))
	name := metaString(claims.UserMetadata, "full_name", "name", "user_name")
	avatar := metaString(claims.UserMetadata, "avatar_url", "picture")
	return &SupabaseIdentity{
		Sub:       claims.Sub,
		Provider:  provider,
		Providers: providers,
		Email:     email,
		Name:      name,
		Avatar:    avatar,
	}, nil
}

func metaString(m map[string]any, keys ...string) string {
	if m == nil {
		return ""
	}
	for _, k := range keys {
		if v, ok := m[k]; ok {
			if s, ok := v.(string); ok {
				s = strings.TrimSpace(s)
				if s != "" {
					return s
				}
			}
		}
	}
	return ""
}

func validateSupabaseIssuerAudience(claims supabaseClaims, supabaseURL string) error {
	base := strings.TrimRight(strings.TrimSpace(supabaseURL), "/")
	if base == "" {
		return nil
	}
	wantIss := base + "/auth/v1"
	if !strings.EqualFold(strings.TrimSpace(claims.Iss), wantIss) {
		return fmt.Errorf("iss mismatch")
	}
	if !audContains(claims.Aud, "authenticated") {
		return fmt.Errorf("aud mismatch")
	}
	return nil
}

func audContains(raw any, want string) bool {
	want = strings.TrimSpace(want)
	switch v := raw.(type) {
	case string:
		return strings.TrimSpace(v) == want
	case []any:
		for _, item := range v {
			if s, ok := item.(string); ok && strings.TrimSpace(s) == want {
				return true
			}
		}
	}
	return false
}

func verifyHS256Sig(parts []string, secret string) error {
	secret = strings.TrimSpace(secret)
	if secret == "" {
		return errors.New("jwt secret missing")
	}
	signingInput := parts[0] + "." + parts[1]
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(signingInput))
	expected := mac.Sum(nil)
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return err
	}
	if !hmac.Equal(sig, expected) {
		return errors.New("bad signature")
	}
	return nil
}

func verifyES256JWT(parts []string, kid, supabaseURL string) error {
	if kid == "" {
		return errors.New("missing kid")
	}
	jwks, err := fetchSupabaseJWKS(supabaseURL)
	if err != nil {
		return err
	}
	var pub *ecdsa.PublicKey
	for _, k := range jwks.Keys {
		if k.Kid != kid {
			continue
		}
		if !strings.EqualFold(k.Kty, "EC") {
			continue
		}
		if k.Alg != "" && !strings.EqualFold(k.Alg, "ES256") {
			continue
		}
		p, err := jwkToECDSA(k)
		if err != nil {
			return err
		}
		pub = p
		break
	}
	if pub == nil {
		invalidateSupabaseJWKS()
		jwks, err = fetchSupabaseJWKS(supabaseURL)
		if err != nil {
			return err
		}
		for _, k := range jwks.Keys {
			if k.Kid != kid || !strings.EqualFold(k.Kty, "EC") {
				continue
			}
			p, err := jwkToECDSA(k)
			if err != nil {
				return err
			}
			pub = p
			break
		}
	}
	if pub == nil {
		return errors.New("kid not found")
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return err
	}
	if len(sig) != 64 {
		return errors.New("bad es256 sig length")
	}
	r := new(big.Int).SetBytes(sig[:32])
	s := new(big.Int).SetBytes(sig[32:])
	sum := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if !ecdsa.Verify(pub, sum[:], r, s) {
		return errors.New("bad signature")
	}
	return nil
}

func jwkToECDSA(k supabaseJWK) (*ecdsa.PublicKey, error) {
	if k.Crv != "" && !strings.EqualFold(k.Crv, "P-256") {
		return nil, fmt.Errorf("unsupported curve %s", k.Crv)
	}
	xb, err := base64.RawURLEncoding.DecodeString(k.X)
	if err != nil {
		return nil, err
	}
	yb, err := base64.RawURLEncoding.DecodeString(k.Y)
	if err != nil {
		return nil, err
	}
	return &ecdsa.PublicKey{
		Curve: elliptic.P256(),
		X:     new(big.Int).SetBytes(xb),
		Y:     new(big.Int).SetBytes(yb),
	}, nil
}

func fetchSupabaseJWKS(supabaseURL string) (*supabaseJWKS, error) {
	base := strings.TrimRight(strings.TrimSpace(supabaseURL), "/")
	if base == "" {
		return nil, errors.New("supabase url missing for jwks")
	}
	url := base + "/auth/v1/.well-known/jwks.json"

	supabaseJWKSMu.Lock()
	if supabaseJWKSCache != nil && supabaseJWKSURL == url && time.Since(supabaseJWKSAt) < 10*time.Minute {
		cached := supabaseJWKSCache
		supabaseJWKSMu.Unlock()
		return cached, nil
	}
	supabaseJWKSMu.Unlock()

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("jwks status %d", resp.StatusCode)
	}
	var jwks supabaseJWKS
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return nil, err
	}
	if len(jwks.Keys) == 0 {
		return nil, errors.New("empty jwks")
	}

	supabaseJWKSMu.Lock()
	supabaseJWKSCache = &jwks
	supabaseJWKSAt = time.Now()
	supabaseJWKSURL = url
	cached := supabaseJWKSCache
	supabaseJWKSMu.Unlock()
	return cached, nil
}

func invalidateSupabaseJWKS() {
	supabaseJWKSMu.Lock()
	defer supabaseJWKSMu.Unlock()
	supabaseJWKSCache = nil
	supabaseJWKSURL = ""
	supabaseJWKSAt = time.Time{}
}
