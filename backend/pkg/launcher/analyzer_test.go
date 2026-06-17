package launcher

import (
	"os"
	"path/filepath"
	"testing"
)

func TestAnalyzeCrash(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "mace-test-crash-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	instanceID := "test-instance"

	WriteLog(instanceID, "Exception in thread \"main\" java.lang.UnsupportedClassVersionError: net/minecraft/bundler/Main has been compiled by a more recent version of the Java Runtime")

	reason, _ := AnalyzeCrash(instanceID, tempDir)
	if reason != "Java Version Mismatch" {
		t.Errorf("Expected reason 'Java Version Mismatch', got '%s'", reason)
	}

	ClearLogs(instanceID)

	crashReportsDir := filepath.Join(tempDir, "crash-reports")
	if err := os.Mkdir(crashReportsDir, 0755); err != nil {
		t.Fatalf("Failed to create crash-reports dir: %v", err)
	}

	crashReportPath := filepath.Join(crashReportsDir, "crash-2026-06-10-server.txt")
	crashContent := `
---- Minecraft Crash Report ----
// Whoops.

Time: 6/10/26 12:00 AM
Description: Exception in server tick loop

java.lang.OutOfMemoryError: Java heap space
	at net.minecraft.world.level.chunk.ChunkAccess.<init>(ChunkAccess.java:42)
`
	if err := os.WriteFile(crashReportPath, []byte(crashContent), 0644); err != nil {
		t.Fatalf("Failed to write mock crash report: %v", err)
	}

	reason, _ = AnalyzeCrash(instanceID, tempDir)
	if reason != "Out of Memory" {
		t.Errorf("Expected reason 'Out of Memory', got '%s'", reason)
	}
}
