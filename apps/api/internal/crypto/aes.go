package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
)

// Vault wraps AES-256-GCM for at-rest secrets (Layer 8).
type Vault struct {
	key []byte
}

// NewVault derives an AES-256 key from a passphrase. Fail-closed below 32 characters.
func NewVault(passphrase string) (*Vault, error) {
	if len(passphrase) < 32 {
		return nil, fmt.Errorf("secrets key must be at least 32 characters")
	}
	sum := sha256.Sum256([]byte(passphrase))
	return &Vault{key: sum[:]}, nil
}

func (v *Vault) Encrypt(plaintext string) ([]byte, error) {
	if plaintext == "" {
		return nil, nil
	}
	block, err := aes.NewCipher(v.key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, []byte(plaintext), nil), nil
}

func (v *Vault) Decrypt(ciphertext []byte) (string, error) {
	if len(ciphertext) == 0 {
		return "", nil
	}
	block, err := aes.NewCipher(v.key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	ns := gcm.NonceSize()
	if len(ciphertext) < ns {
		return "", fmt.Errorf("ciphertext too short")
	}
	plain, err := gcm.Open(nil, ciphertext[:ns], ciphertext[ns:], nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func (v *Vault) EncryptToBase64(plaintext string) (string, error) {
	raw, err := v.Encrypt(plaintext)
	if err != nil {
		return "", err
	}
	if raw == nil {
		return "", nil
	}
	return base64.StdEncoding.EncodeToString(raw), nil
}

func (v *Vault) DecryptFromBase64(encoded string) (string, error) {
	if encoded == "" {
		return "", nil
	}
	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	return v.Decrypt(raw)
}
