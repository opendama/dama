package store

// ReplaceTelegramOpsBotMemory sets cached telegram_ops_bot for unit tests without a DB.
// Source is forced to "database" so opsCfg()/requireBotKey can exercise auth and chrome paths.
func (s *SettingsStore) ReplaceTelegramOpsBotMemory(cfg TelegramOpsBotConfig) {
	if s == nil {
		return
	}
	cfg.Source = "database"
	s.mu.Lock()
	s.telegramOps = cfg
	s.mu.Unlock()
}
