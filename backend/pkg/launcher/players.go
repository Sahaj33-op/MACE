package launcher

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"sync"
)

var (
	activePlayers   = make(map[string]map[string]bool)
	activePlayersMu sync.RWMutex

	joinRegex  = regexp.MustCompile(`(?:\s|^)([.*a-zA-Z0-9_]{3,20})\s+joined\s+the\s+game(?:\s|$)`)
	leaveRegex = regexp.MustCompile(`(?:\s|^)([.*a-zA-Z0-9_]{3,20})\s+left\s+the\s+game(?:\s|$)`)

	// PlayerUpdateCallback is triggered when active players change.
	PlayerUpdateCallback func(id string, players []string)
)

// ParseLogLineForPlayers checks if the log line is a join/leave message and updates tracking.
func ParseLogLineForPlayers(id string, line string) {
	if match := joinRegex.FindStringSubmatch(line); len(match) > 1 {
		playerName := match[1]
		addActivePlayer(id, playerName)
	} else if match := leaveRegex.FindStringSubmatch(line); len(match) > 1 {
		playerName := match[1]
		removeActivePlayer(id, playerName)
	}
}

func addActivePlayer(id string, player string) {
	activePlayersMu.Lock()
	if activePlayers[id] == nil {
		activePlayers[id] = make(map[string]bool)
	}
	activePlayers[id][player] = true
	players := getActivePlayersListLocked(id)
	activePlayersMu.Unlock()

	if PlayerUpdateCallback != nil {
		PlayerUpdateCallback(id, players)
	}
}

func removeActivePlayer(id string, player string) {
	activePlayersMu.Lock()
	if activePlayers[id] != nil {
		delete(activePlayers[id], player)
	}
	players := getActivePlayersListLocked(id)
	activePlayersMu.Unlock()

	if PlayerUpdateCallback != nil {
		PlayerUpdateCallback(id, players)
	}
}

// GetActivePlayers returns the slice of active player names for a server ID.
func GetActivePlayers(id string) []string {
	activePlayersMu.RLock()
	defer activePlayersMu.RUnlock()
	return getActivePlayersListLocked(id)
}

func getActivePlayersListLocked(id string) []string {
	set := activePlayers[id]
	if len(set) == 0 {
		return []string{}
	}
	list := make([]string, 0, len(set))
	for player := range set {
		list = append(list, player)
	}
	return list
}

// ClearActivePlayers resets the list of active players for a server.
func ClearActivePlayers(id string) {
	activePlayersMu.Lock()
	delete(activePlayers, id)
	activePlayersMu.Unlock()

	if PlayerUpdateCallback != nil {
		PlayerUpdateCallback(id, []string{})
	}
}

// SeedActivePlayersFromLogs parses a slice of logs to reconstruct active player status.
func SeedActivePlayersFromLogs(id string, logLines []string) {
	activePlayersMu.Lock()
	activePlayers[id] = make(map[string]bool)
	activePlayersMu.Unlock()

	for _, line := range logLines {
		if match := joinRegex.FindStringSubmatch(line); len(match) > 1 {
			playerName := match[1]
			activePlayersMu.Lock()
			if activePlayers[id] == nil {
				activePlayers[id] = make(map[string]bool)
			}
			activePlayers[id][playerName] = true
			activePlayersMu.Unlock()
		} else if match := leaveRegex.FindStringSubmatch(line); len(match) > 1 {
			playerName := match[1]
			activePlayersMu.Lock()
			if activePlayers[id] != nil {
				delete(activePlayers[id], playerName)
			}
			activePlayersMu.Unlock()
		}
	}

	players := GetActivePlayers(id)
	if PlayerUpdateCallback != nil {
		PlayerUpdateCallback(id, players)
	}
}

// OpPlayer represents the structure of entries in ops.json.
type OpPlayer struct {
	UUID                string `json:"uuid"`
	Name                string `json:"name"`
	Level               int    `json:"level"`
	BypassesPlayerLimit bool   `json:"bypassesPlayerLimit"`
}

// WhitelistPlayer represents the structure of entries in whitelist.json.
type WhitelistPlayer struct {
	UUID string `json:"uuid"`
	Name string `json:"name"`
}

// PlayerRoles holds arrays of OP and whitelisted player names.
type PlayerRoles struct {
	Ops         []string `json:"ops"`
	Whitelisted []string `json:"whitelisted"`
}

// GetPlayerRoles reads the ops.json and whitelist.json files from the server's directory.
func GetPlayerRoles(serverDir string) (*PlayerRoles, error) {
	roles := &PlayerRoles{
		Ops:         []string{},
		Whitelisted: []string{},
	}

	opsPath := filepath.Join(serverDir, "ops.json")
	if _, err := os.Stat(opsPath); err == nil {
		data, err := os.ReadFile(opsPath)
		if err == nil {
			var opsList []OpPlayer
			if err := json.Unmarshal(data, &opsList); err == nil {
				for _, op := range opsList {
					if op.Name != "" {
						roles.Ops = append(roles.Ops, op.Name)
					}
				}
			}
		}
	}

	whitelistPath := filepath.Join(serverDir, "whitelist.json")
	if _, err := os.Stat(whitelistPath); err == nil {
		data, err := os.ReadFile(whitelistPath)
		if err == nil {
			var wlList []WhitelistPlayer
			if err := json.Unmarshal(data, &wlList); err == nil {
				for _, wl := range wlList {
					if wl.Name != "" {
						roles.Whitelisted = append(roles.Whitelisted, wl.Name)
					}
				}
			}
		}
	}

	return roles, nil
}
