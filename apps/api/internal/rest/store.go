package rest

import (
	"dama/apps/api/internal/gamestore"
	"dama/apps/api/internal/redisx"
)

// Aliases keep existing handler signatures stable.
type GameRecord = gamestore.GameRecord
type GameStore = gamestore.Store

func NewGameStore(rdb *redisx.Client) *GameStore {
	return gamestore.New(rdb)
}
