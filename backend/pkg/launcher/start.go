package launcher

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"mace/backend/pkg/utils"
)

var (
	processes   = make(map[string]*exec.Cmd)
	processesMu sync.Mutex
)

// IsRunning checks if a server instance is currently active.
func IsRunning(id string) bool {
	processesMu.Lock()
	defer processesMu.Unlock()
	cmd, ok := processes[id]
	if !ok || cmd == nil {
		return false
	}
	if cmd.ProcessState != nil && cmd.ProcessState.Exited() {
		return false
	}
	if cmd.Process != nil {
		return true
	}
	return false
}

// StartServer launches the Minecraft server jar/scripts.
func StartServer(id string, dir string, javaPath string, memoryMB int, watchdogEnabled bool, statusCallback func(string, string), crashCallback func(string, string, string)) (string, error) {
	if IsRunning(id) {
		return "running", nil
	}

	processesMu.Lock()
	defer processesMu.Unlock()

	ClearLogs(id)

	var cmd *exec.Cmd

	eulaFile := filepath.Join(dir, "eula.txt")
	if _, err := os.Stat(eulaFile); os.IsNotExist(err) {
		os.WriteFile(eulaFile, []byte("eula=true\n"), 0644)
	}

	var useScript bool
	var scriptPath string
	if runtime.GOOS == "windows" {
		scriptPath = filepath.Join(dir, "run.bat")
		if _, err := os.Stat(scriptPath); err == nil {
			useScript = true
		}
	} else {
		scriptPath = filepath.Join(dir, "run.sh")
		if _, err := os.Stat(scriptPath); err == nil {
			useScript = true
		}
	}

	if useScript {
		jvmArgsFile := filepath.Join(dir, "user_jvm_args.txt")
		jvmArgsContent := fmt.Sprintf("-Xmx%dM\n-Xms%dM\n", memoryMB, memoryMB)
		os.WriteFile(jvmArgsFile, []byte(jvmArgsContent), 0644)

		if runtime.GOOS == "windows" {
			batData, err := os.ReadFile(scriptPath)
			if err == nil {
				lines := strings.Split(string(batData), "\n")
				var args []string
				for _, line := range lines {
					line = strings.TrimSpace(line)
					if strings.HasPrefix(line, "java ") || strings.HasPrefix(line, "%JAVA% ") {
						parts := strings.Split(line, " ")[1:]
						for _, p := range parts {
							p = strings.TrimSpace(p)
							if p != "" && p != "%*" {
								args = append(args, p)
							}
						}
						break
					}
				}
				if len(args) > 0 {
					args = append(args, "nogui")
					cmd = exec.Command(javaPath, args...)
				} else {
					cmd = exec.Command("cmd.exe", "/c", "run.bat")
				}
			} else {
				cmd = exec.Command("cmd.exe", "/c", "run.bat")
			}
		} else {
			cmd = exec.Command("sh", "run.sh")
		}
	} else {
		args := []string{
			fmt.Sprintf("-Xmx%dM", memoryMB),
			fmt.Sprintf("-Xms%dM", memoryMB),
			"-jar", "server.jar", "nogui",
		}
		cmd = exec.Command(javaPath, args...)
	}

	cmd.Dir = dir

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return "", fmt.Errorf("failed to create stdin pipe: %w", err)
	}
	RegisterStdin(id, stdin)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		UnregisterStdin(id)
		return "", fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		UnregisterStdin(id)
		return "", fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	go CaptureConsole(id, stdout)
	go CaptureConsole(id, stderr)

	utils.HideWindow(cmd)

	if err := cmd.Start(); err != nil {
		UnregisterStdin(id)
		return "", fmt.Errorf("failed to start process: %w", err)
	}

	processes[id] = cmd
	startTimes[id] = time.Now()

	go RunWatchdog(id, cmd, dir, javaPath, memoryMB, watchdogEnabled, statusCallback, crashCallback)

	return "started", nil
}

// StopServer stops a running Minecraft server.
func StopServer(id string) (string, error) {
	if !IsRunning(id) {
		return "stopped", nil
	}

	WriteLog(id, "[MACE] Sending stop command to server...")
	err := WriteCommand(id, "stop")
	if err != nil {
		WriteLog(id, "[MACE] Stdin stop failed, forcing process termination...")
		return KillServer(id)
	}

	return "stopping", nil
}

// KillServer forcefully terminates the process.
func KillServer(id string) (string, error) {
	processesMu.Lock()
	cmd, ok := processes[id]
	processesMu.Unlock()

	if !ok || cmd == nil || cmd.Process == nil {
		return "stopped", nil
	}

	err := cmd.Process.Kill()
	if err != nil {
		return "", fmt.Errorf("failed to kill process: %w", err)
	}

	return "killed", nil
}

// DeregisterProcess removes a process from the tracked map.
func DeregisterProcess(id string) {
	processesMu.Lock()
	delete(processes, id)
	delete(startTimes, id)
	processesMu.Unlock()
	UnregisterStdin(id)
}
