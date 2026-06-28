//go:build !windows
// +build !windows

package launcher

import (
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
)

func getChildPids(parentPid int, visited map[int]bool) []int {
	if visited[parentPid] {
		return nil
	}
	visited[parentPid] = true

	var pids []int
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
	return pids
}

func getProcessResources(rootPid int, pids []int) (float64, float64, error) {
	var totalCPU float64
	var totalMem float64

	var pidStrings []string
	for _, p := range pids {
		pidStrings = append(pidStrings, fmt.Sprintf("%d", p))
	}

	psCmd := exec.Command("ps", "-p", strings.Join(pidStrings, ","), "-o", "pcpu=,rss=")
	psOut, err := psCmd.Output()
	if err != nil {
		return 0, 0, nil
	}

	lines := strings.Split(string(psOut), "\n")
	for _, line := range lines {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) >= 2 {
			if cpu, err := strconv.ParseFloat(fields[0], 64); err == nil {
				totalCPU += cpu
			}
			if rss, err := strconv.ParseFloat(fields[1], 64); err == nil {
				totalMem += rss / 1024 // rss is in KB, convert to MB
			}
		}
	}

	return totalCPU, totalMem, nil
}

// isProcessRunning checks if a process is still active on Unix.
func isProcessRunning(pid int) bool {
	proc, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	err = proc.Signal(syscall.Signal(0))
	return err == nil
}

