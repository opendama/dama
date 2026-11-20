#!/usr/bin/env bash
# Generate a local private CA + server/client certs for container mTLS labs.
# Production should use your org CA or cert-manager. Do not commit private keys.
set -euo pipefail
OUT="${1:-infrastructure/certs}"
mkdir -p "$OUT"
openssl req -x509 -newkey rsa:4096 -nodes -keyout "$OUT/ca.key" -out "$OUT/ca.crt" \
  -days 825 -subj "/CN=dama-local-ca"
openssl req -newkey rsa:2048 -nodes -keyout "$OUT/server.key" -out "$OUT/server.csr" \
  -subj "/CN=backend-api"
openssl x509 -req -in "$OUT/server.csr" -CA "$OUT/ca.crt" -CAkey "$OUT/ca.key" -CAcreateserial \
  -out "$OUT/server.crt" -days 825
openssl req -newkey rsa:2048 -nodes -keyout "$OUT/client.key" -out "$OUT/client.csr" \
  -subj "/CN=dama-client"
openssl x509 -req -in "$OUT/client.csr" -CA "$OUT/ca.crt" -CAkey "$OUT/ca.key" -CAcreateserial \
  -out "$OUT/client.crt" -days 825
echo "Wrote mTLS materials under $OUT"
