package servermanager

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"mace/backend/pkg/utils"
)

func TestBackups(t *testing.T) {
	tempRoot, err := os.MkdirTemp("", "mace-test-servers-*")
	if err != nil {
		t.Fatalf("failed to create temp root: %v", err)
	}
	defer os.RemoveAll(tempRoot)

	// Save tempRoot to settings to isolate GetServerRoot
	originalSettings, _ := utils.LoadSettings()
	defer utils.SaveSettings(originalSettings)

	err = utils.SaveSettings(&utils.AppSettings{
		ServersDir:    tempRoot,
		SetupComplete: true,
	})
	if err != nil {
		t.Fatalf("failed to save test settings: %v", err)
	}

	serverId := "test-server-123"
	serverPath := filepath.Join(tempRoot, serverId)

	err = os.MkdirAll(serverPath, 0755)
	if err != nil {
		t.Fatalf("failed to create server path: %v", err)
	}

	worldDir := filepath.Join(serverPath, "world")
	err = os.MkdirAll(filepath.Join(worldDir, "region"), 0755)
	if err != nil {
		t.Fatalf("failed to create world dir: %v", err)
	}
	err = os.WriteFile(filepath.Join(worldDir, "level.dat"), []byte("mock-level-data"), 0644)
	if err != nil {
		t.Fatalf("failed to write level.dat: %v", err)
	}
	err = os.WriteFile(filepath.Join(worldDir, "region", "r.0.0.mca"), []byte("mock-region-data"), 0644)
	if err != nil {
		t.Fatalf("failed to write region file: %v", err)
	}

	err = os.WriteFile(filepath.Join(serverPath, "server.properties"), []byte("motd=Test Server"), 0644)
	if err != nil {
		t.Fatalf("failed to write server.properties: %v", err)
	}
	err = os.WriteFile(filepath.Join(serverPath, "whitelist.json"), []byte("[]"), 0644)
	if err != nil {
		t.Fatalf("failed to write whitelist.json: %v", err)
	}

	inst := ServerInstance{
		ID:       serverId,
		Name:     "Test Server",
		Version:  "1.20.4",
		Type:     Vanilla,
		Path:     serverPath,
		Status:   "offline",
		World:    "world",
		MemoryMB: 2048,
	}
	metaBytes, err := json.Marshal(inst)
	if err != nil {
		t.Fatalf("failed to marshal server metadata: %v", err)
	}
	err = os.WriteFile(filepath.Join(serverPath, "metadata.json"), metaBytes, 0644)
	if err != nil {
		t.Fatalf("failed to write metadata.json: %v", err)
	}

	backupItem, err := CreateBackup(serverId)
	if err != nil {
		t.Fatalf("CreateBackup failed: %v", err)
	}

	if backupItem.FileName == "" {
		t.Errorf("expected backup file name to be set, got empty")
	}

	backups, err := ListBackups(serverId)
	if err != nil {
		t.Fatalf("ListBackups failed: %v", err)
	}
	if len(backups) != 1 {
		t.Errorf("expected 1 backup, got %d", len(backups))
	} else if backups[0].FileName != backupItem.FileName {
		t.Errorf("expected backup file name %q, got %q", backupItem.FileName, backups[0].FileName)
	}

	err = os.WriteFile(filepath.Join(serverPath, "server.properties"), []byte("motd=Modified Motd"), 0644)
	if err != nil {
		t.Fatalf("failed to write modified server.properties: %v", err)
	}
	err = os.WriteFile(filepath.Join(worldDir, "level.dat"), []byte("modified-level-data"), 0644)
	if err != nil {
		t.Fatalf("failed to write modified level.dat: %v", err)
	}

	err = RestoreBackup(serverId, backupItem.FileName)
	if err != nil {
		t.Fatalf("RestoreBackup failed: %v", err)
	}

	propContent, err := os.ReadFile(filepath.Join(serverPath, "server.properties"))
	if err != nil {
		t.Fatalf("failed to read server.properties after restore: %v", err)
	}
	if string(propContent) != "motd=Test Server" {
		t.Errorf("expected motd=Test Server, got %q", string(propContent))
	}

	levelContent, err := os.ReadFile(filepath.Join(worldDir, "level.dat"))
	if err != nil {
		t.Fatalf("failed to read level.dat after restore: %v", err)
	}
	if string(levelContent) != "mock-level-data" {
		t.Errorf("expected mock-level-data, got %q", string(levelContent))
	}

	customBackupDir, err := filepath.Abs("custom_backups")
	if err != nil {
		t.Fatalf("failed to get absolute path for custom backups: %v", err)
	}
	err = os.MkdirAll(customBackupDir, 0755)
	if err != nil {
		t.Fatalf("failed to create custom backups dir: %v", err)
	}
	defer os.RemoveAll(customBackupDir)

	inst.BackupPath = customBackupDir
	metaBytes, err = json.Marshal(inst)
	if err != nil {
		t.Fatalf("failed to marshal server metadata with custom path: %v", err)
	}
	err = os.WriteFile(filepath.Join(serverPath, "metadata.json"), metaBytes, 0644)
	if err != nil {
		t.Fatalf("failed to write metadata.json with custom path: %v", err)
	}

	customBackupItem, err := CreateBackup(serverId)
	if err != nil {
		t.Fatalf("CreateBackup with custom path failed: %v", err)
	}

	customBackups, err := ListBackups(serverId)
	if err != nil {
		t.Fatalf("ListBackups with custom path failed: %v", err)
	}
	if len(customBackups) != 1 {
		t.Errorf("expected 1 custom backup, got %d", len(customBackups))
	}

	customZipPath := filepath.Join(customBackupDir, customBackupItem.FileName)
	if _, err := os.Stat(customZipPath); os.IsNotExist(err) {
		t.Errorf("expected backup zip file to exist at %s, but it does not", customZipPath)
	}

	err = DeleteBackup(serverId, customBackupItem.FileName)
	if err != nil {
		t.Fatalf("DeleteBackup failed: %v", err)
	}

	customBackupsPostDelete, err := ListBackups(serverId)
	if err != nil {
		t.Fatalf("ListBackups after delete failed: %v", err)
	}
	if len(customBackupsPostDelete) != 0 {
		t.Errorf("expected 0 custom backups, got %d", len(customBackupsPostDelete))
	}
}
