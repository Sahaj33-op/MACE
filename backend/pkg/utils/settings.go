package utils

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// AppSettings holds all persistent application-level configuration.
type AppSettings struct {
	CurseForgeAPIKey string `json:"curseForgeApiKey"`
}

var (
	settingsMu   sync.RWMutex
	cachedSettings *AppSettings
)

// settingsPath returns the path to the MACE settings file.
func settingsPath() string {
	return filepath.Join("settings.json")
}

// LoadSettings reads the settings file from disk, returning defaults if absent.
func LoadSettings() (*AppSettings, error) {
	settingsMu.RLock()
	if cachedSettings != nil {
		defer settingsMu.RUnlock()
		cp := *cachedSettings
		return &cp, nil
	}
	settingsMu.RUnlock()

	settingsMu.Lock()
	defer settingsMu.Unlock()

	data, err := os.ReadFile(settingsPath())
	if err != nil {
		cachedSettings = &AppSettings{}
		return &AppSettings{}, nil
	}

	var s AppSettings
	if err := json.Unmarshal(data, &s); err != nil {
		return nil, err
	}
	cachedSettings = &s
	cp := *cachedSettings
	return &cp, nil
}

// SaveSettings writes the settings to disk and updates the in-memory cache.
func SaveSettings(s *AppSettings) error {
	settingsMu.Lock()
	defer settingsMu.Unlock()

	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(settingsPath(), data, 0644); err != nil {
		return err
	}
	cp := *s
	cachedSettings = &cp
	return nil
}
