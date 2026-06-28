package launcher

import (
	"os"
	"testing"
	"time"
)

func TestGetChildPids(t *testing.T) {
	// The current process typically has no children under normal test runs,
	// but we can at least call the function to ensure it doesn't crash.
	visited := make(map[int]bool)
	pids := getChildPids(os.Getpid(), visited)

	// Ensure visited has at least current process marked
	if !visited[os.Getpid()] {
		t.Errorf("Expected current PID %d to be marked as visited", os.Getpid())
	}

	t.Logf("Found %d child PIDs for current process", len(pids))
}

func TestGetProcessResources(t *testing.T) {
	// Query resources of the current test runner process
	pid := os.Getpid()
	cpu1, mem1, err := getProcessResources(pid, []int{pid})
	if err != nil {
		t.Fatalf("Failed to query current process resources: %v", err)
	}

	t.Logf("First process CPU: %f%%, Memory: %f MB", cpu1, mem1)

	// Memory should definitely be > 0 (even a tiny Go program takes at least 1MB)
	if mem1 <= 0 {
		t.Errorf("Expected memory usage to be > 0, got %f MB", mem1)
	}

	// Sleep 100ms to allow CPU time accumulation
	time.Sleep(100 * time.Millisecond)

	// Consume some CPU in a quick loop to ensure CPU usage registers
	start := time.Now()
	for time.Since(start) < 20*time.Millisecond {
		// Burn CPU
	}

	cpu2, mem2, err := getProcessResources(pid, []int{pid})
	if err != nil {
		t.Fatalf("Failed to query current process resources second time: %v", err)
	}

	t.Logf("Second process CPU: %f%%, Memory: %f MB", cpu2, mem2)
}

func TestIsProcessRunning(t *testing.T) {
	// Current process should be running
	if !isProcessRunning(os.Getpid()) {
		t.Errorf("Expected current PID %d to be running", os.Getpid())
	}

	// An extremely large PID should not be running
	// (we assume 999999 is not a valid running PID on this test system)
	if isProcessRunning(999999) {
		t.Logf("Warning: PID 999999 appears to be running, this is unexpected but possible if PIDs wrap around.")
	}
}

