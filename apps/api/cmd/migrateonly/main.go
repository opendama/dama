package main

import (
	"log"
	"os"

	"dama/apps/api/internal/db"
)

// Applies all migrations then exits (used for remote DB apply without serving).
func main() {
	url := os.Getenv("DAMA_DATABASE_URL")
	if url == "" {
		url = os.Getenv("DATABASE_URL")
	}
	h, err := db.Connect(url)
	if err != nil {
		log.Fatal(err)
	}
	h.Close()
	log.Println("migrateonly: ok")
}
