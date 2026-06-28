//go:build windows
// +build windows

package launcher

import (
	"math"
	"runtime"
	"sync"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

// PROCESS_MEMORY_COUNTERS is a struct containing memory metrics for a process.
type PROCESS_MEMORY_COUNTERS struct {
	CB                         uint32
	PageFaultCount             uint32
	PeakWorkingSetSize         uintptr
	WorkingSetSize             uintptr
	QuotaPeakPagedPoolUsage    uintptr
	QuotaPagedPoolUsage        uintptr
	QuotaPeakNonPagedPoolUsage uintptr
	QuotaNonPagedPoolUsage     uintptr
	PagefileUsage              uintptr
	PeakPagefileUsage          uintptr
}

var (
	modpsapi             = windows.NewLazySystemDLL("psapi.dll")
	procGetProcessMemory = modpsapi.NewProc("GetProcessMemoryInfo")

	lastCPUMeasurements   = make(map[int]processCPUMeasurement)
	lastCPUMeasurementsMu sync.Mutex
)

type processCPUMeasurement struct {
	totalDuration time.Duration
	measuredAt    time.Time
}

func getChildPids(parentPid int, visited map[int]bool) []int {
	if visited[parentPid] {
		return nil
	}
	visited[parentPid] = true

	snapshot, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return nil
	}
	defer windows.CloseHandle(snapshot)

	var pe windows.ProcessEntry32
	pe.Size = uint32(unsafe.Sizeof(pe))

	err = windows.Process32First(snapshot, &pe)
	if err != nil {
		return nil
	}

	// Map parent PID -> list of child PIDs
	parentToChildren := make(map[int][]int)
	for {
		pID := int(pe.ProcessID)
		ppID := int(pe.ParentProcessID)
		parentToChildren[ppID] = append(parentToChildren[ppID], pID)

		err = windows.Process32Next(snapshot, &pe)
		if err != nil {
			break
		}
	}

	var getDescendants func(pid int) []int
	getDescendants = func(pid int) []int {
		var children []int
		for _, child := range parentToChildren[pid] {
			if !visited[child] {
				visited[child] = true
				children = append(children, child)
				children = append(children, getDescendants(child)...)
			}
		}
		return children
	}

	return getDescendants(parentPid)
}

func getProcessResources(rootPid int, pids []int) (float64, float64, error) {
	var totalCPU float64
	var totalMem float64

	now := time.Now()

	lastCPUMeasurementsMu.Lock()
	// Clean up old cached measurements (e.g. older than 30s)
	for p, meas := range lastCPUMeasurements {
		if now.Sub(meas.measuredAt) > 30*time.Second {
			delete(lastCPUMeasurements, p)
		}
	}
	lastCPUMeasurementsMu.Unlock()

	for _, pid := range pids {
		h, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, uint32(pid))
		if err != nil {
			h, err = windows.OpenProcess(windows.PROCESS_QUERY_INFORMATION, false, uint32(pid))
			if err != nil {
				continue
			}
		}
		defer windows.CloseHandle(h)

		// Memory
		var counters PROCESS_MEMORY_COUNTERS
		counters.CB = uint32(unsafe.Sizeof(counters))
		r1, _, _ := procGetProcessMemory.Call(
			uintptr(h),
			uintptr(unsafe.Pointer(&counters)),
			uintptr(counters.CB),
		)
		if r1 != 0 {
			totalMem += float64(counters.WorkingSetSize) / (1024 * 1024)
		}

		// CPU
		var creation, exit, kernel, user windows.Filetime
		err = windows.GetProcessTimes(h, &creation, &exit, &kernel, &user)
		if err != nil {
			continue
		}

		// Filetime is in 100-nanosecond intervals.
		// Convert to time.Duration.
		kernelDuration := time.Duration(kernel.Nanoseconds())
		userDuration := time.Duration(user.Nanoseconds())
		totalProcessCpuTime := kernelDuration + userDuration

		lastCPUMeasurementsMu.Lock()
		prev, exists := lastCPUMeasurements[pid]
		lastCPUMeasurements[pid] = processCPUMeasurement{
			totalDuration: totalProcessCpuTime,
			measuredAt:    now,
		}
		lastCPUMeasurementsMu.Unlock()

		var cpuPct float64
		if exists {
			deltaCpu := totalProcessCpuTime - prev.totalDuration
			deltaWall := now.Sub(prev.measuredAt)
			if deltaWall > 0 {
				cpuPct = (float64(deltaCpu) / float64(deltaWall)) * 100.0
			}
		} else {
			// First sample: just set to 0. Subsequent samples (every 2s) will compute the correct delta.
			cpuPct = 0
		}

		// Normalize by number of CPU cores
		numCPU := float64(runtime.NumCPU())
		if numCPU > 0 {
			cpuPct /= numCPU
		}
		// Bound to a reasonable value
		if cpuPct < 0 {
			cpuPct = 0
		}
		totalCPU += cpuPct
	}

	// Format totalCPU to two decimal places
	totalCPU = math.Round(totalCPU*100) / 100
	totalMem = math.Round(totalMem*100) / 100

	return totalCPU, totalMem, nil
}

// isProcessRunning checks if a process is still active on Windows.
func isProcessRunning(pid int) bool {
	snapshot, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return false
	}
	defer windows.CloseHandle(snapshot)

	var pe windows.ProcessEntry32
	pe.Size = uint32(unsafe.Sizeof(pe))

	err = windows.Process32First(snapshot, &pe)
	if err != nil {
		return false
	}

	for {
		if int(pe.ProcessID) == pid {
			return true
		}
		err = windows.Process32Next(snapshot, &pe)
		if err != nil {
			break
		}
	}
	return false
}

