package launcher

import (
	"fmt"
	"time"
)

// ResourceUsage holds live resource metrics for a running server process.
type ResourceUsage struct {
	CPUPercent float64 `json:"cpuPercent"`
	MemoryMB   float64 `json:"memoryMB"`
	Uptime     int64   `json:"uptime"` // seconds
}

var (
	startTimes = make(map[string]time.Time)
)

// getAllPids returns the process ID and all its recursive child process IDs.
func getAllPids(parentPid int) []int {
	visited := make(map[int]bool)
	pids := []int{parentPid}
	pids = append(pids, getChildPids(parentPid, visited)...)
	return pids
}

// GetResourceUsage queries live CPU and memory usage for a running server process.
func GetResourceUsage(id string) (*ResourceUsage, error) {
	processesMu.Lock()
	cmd, ok := processes[id]
	startTime := startTimes[id]
	processesMu.Unlock()

	if !ok || cmd == nil || cmd.Process == nil {
		return nil, fmt.Errorf("server %s is not running", id)
	}

	pid := cmd.Process.Pid

	usage := &ResourceUsage{}

	if !startTime.IsZero() {
		usage.Uptime = int64(time.Since(startTime).Seconds())
	}

	pids := getAllPids(pid)

	cpu, mem, err := getProcessResources(pid, pids)
	if err != nil {
		return nil, err
	}

	usage.CPUPercent = cpu
	usage.MemoryMB = mem

	return usage, nil
}
