package auth

// ConsoleRoleGate checks JWT roles against platform_settings.client_enums.console_roles.
type ConsoleRoleGate struct {
	Allowed func(role string) bool
}

func (g ConsoleRoleGate) IsAllowed(role string) bool {
	if g.Allowed == nil {
		return false
	}
	return g.Allowed(role)
}

// MediaUploadRoleGate allows console or publisher roles from client_enums.
type MediaUploadRoleGate struct {
	IsConsole   func(role string) bool
	IsPublisher func(role string) bool
}

func (g MediaUploadRoleGate) IsAllowed(role string) bool {
	if g.IsConsole != nil && g.IsConsole(role) {
		return true
	}
	if g.IsPublisher != nil && g.IsPublisher(role) {
		return true
	}
	return false
}
