// Package brandassets embeds Dama brand marks required at runtime (QR badges, etc.).
// Docker images ship a single binary without a separate assets/ tree; embed keeps
// QR generation fail-open for logo presence regardless of process cwd.
package brandassets

import _ "embed"

// DamaMarkPNG is the transparent burgundy mark (assets/brand/dama-mark.png).
//
//go:embed dama-mark.png
var DamaMarkPNG []byte
