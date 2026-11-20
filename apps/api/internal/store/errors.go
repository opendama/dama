package store

import "errors"

var ErrNotFound = errors.New("not found")

// ErrGalleryFull is returned when entity gallery already has MaxEntityGalleryImages entries.
var ErrGalleryFull = errors.New("gallery full")

// ErrGalleryIndex is returned when a gallery remove index is out of range.
var ErrGalleryIndex = errors.New("gallery index invalid")

// MaxEntityGalleryImages matches smart-menu additional-gallery capacity (thumbnail separate).
const MaxEntityGalleryImages = 9
