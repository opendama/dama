package store

import "testing"

func TestLooksSealedBankSecret(t *testing.T) {
	cipher := "e+SleilRb9qPklC3P8r5w9iyu5tU9cKCSnJMN6SFcoubTTkFkE3XueA="
	if !looksSealedBankSecret(cipher) {
		t.Fatalf("expected sealed ciphertext heuristic true")
	}
	if looksSealedBankSecret("0911254814") {
		t.Fatalf("plaintext mobile must not look sealed")
	}
	if looksSealedBankSecret("") {
		t.Fatalf("empty must not look sealed")
	}
}

func TestBankStoreOpenFailClosedOnBadCipher(t *testing.T) {
	s := &BankStore{vault: nil}
	cipher := "e+SleilRb9qPklC3P8r5w9iyu5tU9cKCSnJMN6SFcoubTTkFkE3XueA="
	if got := s.open(cipher); got != "" {
		t.Fatalf("nil vault + sealed value must return empty, got %q", got)
	}
	if got := s.open("0911254814"); got != "0911254814" {
		t.Fatalf("nil vault plaintext passthrough, got %q", got)
	}
}
