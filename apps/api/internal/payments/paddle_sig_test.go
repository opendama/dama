package payments

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"

	"dama/apps/api/internal/config"
)

func TestVerifyPaddleSignature(t *testing.T) {
	secret := "test-paddle-webhook-secret"
	body := []byte(`{"event_type":"transaction.completed"}`)
	ts := "1700000000"
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(ts + ":"))
	mac.Write(body)
	h1 := hex.EncodeToString(mac.Sum(nil))
	svc := &Service{cfg: config.Config{PaddleWebhookSecret: secret}}
	hdr := "ts=" + ts + ";h1=" + h1
	if !svc.VerifyPaddleSignature(body, hdr) {
		t.Fatal("expected valid paddle signature")
	}
	if svc.VerifyPaddleSignature(body, "ts="+ts+";h1=deadbeef") {
		t.Fatal("expected invalid signature rejection")
	}
	if svc.VerifyPaddleSignature(body, "") {
		t.Fatal("empty signature must fail closed")
	}
}
