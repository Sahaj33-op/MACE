package launcher

import (
	"fmt"
	"os/exec"
	"time"
)

// RunWatchdog monitors a running Minecraft server process and auto-restarts on crash.
func RunWatchdog(
	id string, 
	cmd *exec.Cmd, 
	dir string, 
	javaPath string, 
	memoryMB int, 
	watchdogEnabled bool, 
	playitEnabled bool, 
	jvmArgs string,
	statusCallback func(string, string),
	crashCallback func(string, string, string),
) {
	err := cmd.Wait()

	// Wait for any orphan/child processes (like java.exe) to also exit
	if cmd.Process != nil {
		for {
			hasChildren := false
			pids := getAllPids(cmd.Process.Pid)
			for i := 1; i < len(pids); i++ {
				if isProcessRunning(pids[i]) {
					hasChildren = true
					break
				}
			}
			if !hasChildren {
				break
			}
			time.Sleep(500 * time.Millisecond)
		}
	}
	
	userStop := IsUserStopped(id)

	DeregisterProcess(id)
	
	exitCode := -1
	if cmd.ProcessState != nil {
		exitCode = cmd.ProcessState.ExitCode()
	}

	WriteLog(id, fmt.Sprintf("[MACE] Server process terminated with exit code %d (err: %v)", exitCode, err))

	if userStop {
		statusCallback(id, "offline")
		WriteLog(id, "[MACE] Server stopped by user.")
		SetUserStopped(id, false)
		return
	}

	if exitCode == 0 || exitCode == 130 {
		statusCallback(id, "offline")
		WriteLog(id, "[MACE] Server stopped cleanly.")
		return
	}

	reason, resolution := AnalyzeCrash(id, dir)
	if reason != "" && crashCallback != nil {
		go crashCallback(id, reason, resolution)
	}

	if watchdogEnabled {
		statusCallback(id, "restarting")
		WriteLog(id, "[MACE] Watchdog: Crash detected! Auto-restarting server in 5 seconds...")
		time.Sleep(5 * time.Second)

		_, err := StartServer(id, dir, javaPath, memoryMB, watchdogEnabled, playitEnabled, jvmArgs, statusCallback, crashCallback)
		if err != nil {
			WriteLog(id, fmt.Sprintf("[MACE] Watchdog: Auto-restart failed: %v", err))
			statusCallback(id, "offline")
		} else {
			statusCallback(id, "online")
			WriteLog(id, "[MACE] Watchdog: Server restarted successfully.")
		}
	} else {
		statusCallback(id, "offline")
		WriteLog(id, "[MACE] Server crashed/stopped unexpectedly. Auto-restart is disabled.")
	}
}
