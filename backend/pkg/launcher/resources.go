package launcher

import (
	"fmt"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	"mace/backend/pkg/utils"
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

// hiddenCmd creates an exec.Cmd that won't show a console window on Windows.
func hiddenCmd(name string, args ...string) *exec.Cmd {
	cmd := exec.Command(name, args...)
	utils.HideWindow(cmd)
	return cmd
}

// getChildPids returns a list of child process IDs of a given parent process ID.
func getChildPids(parentPid int, visited map[int]bool) []int {
	if visited[parentPid] {
		return nil
	}
	visited[parentPid] = true

	var pids []int
	if runtime.GOOS == "windows" {
		cmd := hiddenCmd("wmic", "process", "where", fmt.Sprintf("ParentProcessId=%d", parentPid), "get", "ProcessId")
		out, err := cmd.Output()
		if err == nil {
			lines := strings.Split(string(out), "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line == "" || strings.HasPrefix(strings.ToLower(line), "processid") {
					continue
				}
				if childPid, err := strconv.Atoi(line); err == nil {
					pids = append(pids, childPid)
					pids = append(pids, getChildPids(childPid, visited)...)
				}
			}
		}
	} else {
		cmd := exec.Command("pgrep", "-P", fmt.Sprintf("%d", parentPid))
		out, err := cmd.Output()
		if err == nil {
			lines := strings.Split(string(out), "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line == "" {
					continue
				}
				if childPid, err := strconv.Atoi(line); err == nil {
					pids = append(pids, childPid)
					pids = append(pids, getChildPids(childPid, visited)...)
				}
			}
		}
	}
	return pids
}

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

	if runtime.GOOS == "windows" {
		var conditions []string
		for _, p := range pids {
			conditions = append(conditions, fmt.Sprintf("ProcessId=%d", p))
		}
		whereClause := strings.Join(conditions, " or ")

		memCmd := hiddenCmd("wmic", "process", "where", whereClause, "get", "WorkingSetSize", "/format:value")
		memOut, err := memCmd.Output()
		if err == nil || len(memOut) > 0 {
			lines := strings.Split(string(memOut), "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if strings.HasPrefix(line, "WorkingSetSize=") {
					valStr := strings.TrimPrefix(line, "WorkingSetSize=")
					valStr = strings.TrimSpace(valStr)
					if val, err := strconv.ParseFloat(valStr, 64); err == nil {
						usage.MemoryMB += val / (1024 * 1024)
					}
				}
			}
		}

		var cpuConditions []string
		for _, p := range pids {
			cpuConditions = append(cpuConditions, fmt.Sprintf("IDProcess=%d", p))
		}
		cpuWhereClause := strings.Join(cpuConditions, " or ")

		cpuCmd := hiddenCmd("wmic", "path", "Win32_PerfFormattedData_PerfProc_Process", "where", cpuWhereClause, "get", "PercentProcessorTime", "/format:value")
		cpuOut, err := cpuCmd.Output()
		if err == nil || len(cpuOut) > 0 {
			lines := strings.Split(string(cpuOut), "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if strings.HasPrefix(line, "PercentProcessorTime=") {
					valStr := strings.TrimPrefix(line, "PercentProcessorTime=")
					valStr = strings.TrimSpace(valStr)
					if val, err := strconv.ParseFloat(valStr, 64); err == nil {
						// Normalize by number of CPU cores
						numCPU := float64(runtime.NumCPU())
						if numCPU > 0 {
							usage.CPUPercent += val / numCPU
						} else {
							usage.CPUPercent += val
						}
					}
				}
			}
		}
	} else {
		var pidStrings []string
		for _, p := range pids {
			pidStrings = append(pidStrings, fmt.Sprintf("%d", p))
		}
		psCmd := exec.Command("ps", "-p", strings.Join(pidStrings, ","), "-o", "pcpu=,rss=")
		psOut, err := psCmd.Output()
		if err == nil || len(psOut) > 0 {
			lines := strings.Split(string(psOut), "\n")
			for _, line := range lines {
				fields := strings.Fields(strings.TrimSpace(line))
				if len(fields) >= 2 {
					if cpu, err := strconv.ParseFloat(fields[0], 64); err == nil {
						usage.CPUPercent += cpu
					}
					if rss, err := strconv.ParseFloat(fields[1], 64); err == nil {
						usage.MemoryMB += rss / 1024
					}
				}
			}
		}
	}

	return usage, nil
}
