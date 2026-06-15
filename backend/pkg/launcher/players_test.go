package launcher

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestParseLogLineForPlayers(t *testing.T) {
	serverID := "test-server-1"
	ClearActivePlayers(serverID)

	ParseLogLineForPlayers(serverID, "[22:52:29] [Server thread/INFO]: temitope joined the game")
	players := GetActivePlayers(serverID)
	expected := []string{"temitope"}
	if !reflect.DeepEqual(players, expected) {
		t.Errorf("expected players %v, got %v", expected, players)
	}

	ParseLogLineForPlayers(serverID, "[22:52:30] [Server thread/INFO]: .bedrock_player joined the game")
	players = GetActivePlayers(serverID)

	if len(players) != 2 {
		t.Errorf("expected 2 players, got %d: %v", len(players), players)
	}

	ParseLogLineForPlayers(serverID, "[22:53:00] [Server thread/INFO]: temitope left the game")
	players = GetActivePlayers(serverID)
	expected = []string{".bedrock_player"}
	if !reflect.DeepEqual(players, expected) {
		t.Errorf("expected players %v after leave, got %v", expected, players)
	}

	ParseLogLineForPlayers(serverID, "[22:53:01] [Server thread/INFO]: .bedrock_player left the game")
	players = GetActivePlayers(serverID)
	if len(players) != 0 {
		t.Errorf("expected 0 players after all left, got %d: %v", len(players), players)
	}
}

func TestSeedActivePlayersFromLogs(t *testing.T) {
	serverID := "test-server-2"
	logs := []string{
		"[22:00:00] [Server thread/INFO]: player1 joined the game",
		"[22:01:00] [Server thread/INFO]: player2 joined the game",
		"[22:02:00] [Server thread/INFO]: player1 left the game",
	}

	SeedActivePlayersFromLogs(serverID, logs)
	players := GetActivePlayers(serverID)
	expected := []string{"player2"}
	if !reflect.DeepEqual(players, expected) {
		t.Errorf("expected seeded players %v, got %v", expected, players)
	}
	ClearActivePlayers(serverID)
}

func TestGetPlayerRoles(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "mace-player-test")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	opsData := []OpPlayer{
		{Name: "op1", Level: 4},
		{Name: "op2", Level: 2},
	}
	opsBytes, _ := json.Marshal(opsData)
	os.WriteFile(filepath.Join(tempDir, "ops.json"), opsBytes, 0644)

	wlData := []WhitelistPlayer{
		{Name: "wl1"},
		{Name: "wl2"},
	}
	wlBytes, _ := json.Marshal(wlData)
	os.WriteFile(filepath.Join(tempDir, "whitelist.json"), wlBytes, 0644)

	roles, err := GetPlayerRoles(tempDir)
	if err != nil {
		t.Fatalf("unexpected error reading player roles: %v", err)
	}

	expectedOps := []string{"op1", "op2"}
	expectedWl := []string{"wl1", "wl2"}

	if !reflect.DeepEqual(roles.Ops, expectedOps) {
		t.Errorf("expected ops %v, got %v", expectedOps, roles.Ops)
	}
	if !reflect.DeepEqual(roles.Whitelisted, expectedWl) {
		t.Errorf("expected whitelisted %v, got %v", expectedWl, roles.Whitelisted)
	}
}
