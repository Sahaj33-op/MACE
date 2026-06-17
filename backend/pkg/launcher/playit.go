package launcher

import (
	"bufio"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"

	"mace/backend/pkg/utils"
)

var (
	playitCmds      = make(map[string]*exec.Cmd)
	playitCmdsMu    sync.Mutex

	playitClaimURLs   = make(map[string]string)
	playitClaimURLsMu sync.Mutex

	playitAddresses   = make(map[string]string)
	playitAddressesMu sync.Mutex

	PlayitAddressCallback func(id string, address string)
)

var PlayitBinaryName = func() string {
	if runtime.GOOS == "windows" {
		return "playit.exe"
	}
	return "playit"
}()

// PlayitDownloadURL selects the appropriate playit binary to download based on platform.
var PlayitDownloadURL = func() string {
	switch runtime.GOOS {
	case "windows":
		return "https://github.com/playit-cloud/playit-agent/releases/latest/download/playit-windows-x86_64-signed.exe"
	case "linux":
		if runtime.GOARCH == "arm64" {
			return "https://github.com/playit-cloud/playit-agent/releases/latest/download/playit-linux-arm64"
		}
		return "https://github.com/playit-cloud/playit-agent/releases/latest/download/playit-linux-amd64"
	case "darwin":
		if runtime.GOARCH == "arm64" {
			return "https://github.com/playit-cloud/playit-agent/releases/latest/download/playit-macos-aarch64"
		}
		return "https://github.com/playit-cloud/playit-agent/releases/latest/download/playit-macos-amd64"
	default:
		return ""
	}
}()

// GetPlayitStatusInfo returns the in-memory playit daemon status.
func GetPlayitStatusInfo(id string) (isRunning bool, claimURL string, address string) {
	playitCmdsMu.Lock()
	_, isRunning = playitCmds[id]
	playitCmdsMu.Unlock()

	playitClaimURLsMu.Lock()
	claimURL = playitClaimURLs[id]
	playitClaimURLsMu.Unlock()

	playitAddressesMu.Lock()
	address = playitAddresses[id]
	playitAddressesMu.Unlock()

	return isRunning, claimURL, address
}

// DownloadPlayitBinary downloads the playit binary to the shared bin folder.
func DownloadPlayitBinary(id string, destPath string) error {
	url := PlayitDownloadURL
	if url == "" {
		return fmt.Errorf("unsupported platform: %s %s", runtime.GOOS, runtime.GOARCH)
	}

	if err := utils.EnsureDir(filepath.Dir(destPath)); err != nil {
		return err
	}

	WriteLog(id, fmt.Sprintf("[MACE] [PLAYIT] Shared playit binary not found. Downloading from %s...", url))

	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to download playit binary: HTTP %s", resp.Status)
	}

	tempFile := destPath + ".tmp"
	f, err := os.Create(tempFile)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = io.Copy(f, resp.Body)
	if err != nil {
		os.Remove(tempFile)
		return err
	}

	f.Close()
	if err := os.Rename(tempFile, destPath); err != nil {
		os.Remove(tempFile)
		return err
	}

	// Make executable on unix
	if runtime.GOOS != "windows" {
		os.Chmod(destPath, 0755)
	}

	WriteLog(id, "[MACE] [PLAYIT] Download completed successfully.")
	return nil
}

// StartPlayit launches the playit agent process for a server instance.
func StartPlayit(id string, dir string) error {
	playitCmdsMu.Lock()
	if _, running := playitCmds[id]; running {
		playitCmdsMu.Unlock()
		return nil
	}
	playitCmdsMu.Unlock()

	// Clear dynamic state
	playitClaimURLsMu.Lock()
	playitClaimURLs[id] = ""
	playitClaimURLsMu.Unlock()

	// 1. Ensure shared binary exists
	sharedBinDir := filepath.Join(utils.GetServerRoot(), "bin")
	sharedBinPath := filepath.Join(sharedBinDir, PlayitBinaryName)
	if !utils.FileExists(sharedBinPath) {
		if err := DownloadPlayitBinary(id, sharedBinPath); err != nil {
			WriteLog(id, fmt.Sprintf("[MACE] [PLAYIT] Failed to download playit binary: %v", err))
			return err
		}
	}

	// 2. Ensure server-specific local copy exists
	localBinPath := filepath.Join(dir, PlayitBinaryName)
	if !utils.FileExists(localBinPath) {
		WriteLog(id, "[MACE] [PLAYIT] Copying playit binary to server instance folder...")
		if err := utils.CopyFile(sharedBinPath, localBinPath); err != nil {
			WriteLog(id, fmt.Sprintf("[MACE] [PLAYIT] Failed to copy playit binary: %v", err))
			return err
		}
		if runtime.GOOS != "windows" {
			os.Chmod(localBinPath, 0755)
		}
	}

	// 3. Spawning the process
	WriteLog(id, "[MACE] [PLAYIT] Launching playit tunnel agent...")
	cmd := exec.Command(localBinPath)
	cmd.Dir = dir
	utils.HideWindow(cmd)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start playit: %w", err)
	}

	playitCmdsMu.Lock()
	playitCmds[id] = cmd
	playitCmdsMu.Unlock()

	// Regex for claim URL and allocated address
	reClaim := regexp.MustCompile(`https?://(?:www\.)?playit\.gg/claim/[a-zA-Z0-9-_]+`)
	reAddress := regexp.MustCompile(`[a-zA-Z0-9-.]+\.(?:joinmc\.link|ply\.gg|playit\.gg)(?::\d+)?`)

	captureOutput := func(rc io.ReadCloser) {
		defer rc.Close()
		scanner := bufio.NewScanner(rc)
		for scanner.Scan() {
			line := scanner.Text()
			WriteLog(id, "[PLAYIT] "+line)

			// Scan for claim URL
			if match := reClaim.FindString(line); match != "" {
				playitClaimURLsMu.Lock()
				playitClaimURLs[id] = match
				playitClaimURLsMu.Unlock()
				WriteLog(id, fmt.Sprintf("[MACE] [PLAYIT] ACTION REQUIRED: Claim your tunnel by visiting: %s", match))
			}

			// Scan for allocated tunnel domain
			if match := reAddress.FindString(line); match != "" {
				// Avoid matching official playit.gg control/api hosts
				matchLower := strings.ToLower(match)
				if !strings.Contains(matchLower, "api.playit.gg") && !strings.Contains(matchLower, "control.playit.gg") && matchLower != "playit.gg" {
					playitAddressesMu.Lock()
					playitAddresses[id] = match
					playitAddressesMu.Unlock()
					WriteLog(id, fmt.Sprintf("[MACE] [PLAYIT] Public server address allocated: %s", match))

					if PlayitAddressCallback != nil {
						PlayitAddressCallback(id, match)
					}
				}
			}
		}
	}

	go captureOutput(stdout)
	go captureOutput(stderr)

	// Monitor process termination in background
	go func() {
		cmd.Wait()
		playitCmdsMu.Lock()
		delete(playitCmds, id)
		playitCmdsMu.Unlock()

		playitClaimURLsMu.Lock()
		delete(playitClaimURLs, id)
		playitClaimURLsMu.Unlock()

		WriteLog(id, "[MACE] [PLAYIT] Playit tunnel agent stopped.")
	}()

	return nil
}

// StopPlayit stops the playit agent process for a server instance.
func StopPlayit(id string) {
	playitCmdsMu.Lock()
	cmd, ok := playitCmds[id]
	playitCmdsMu.Unlock()

	if !ok || cmd == nil || cmd.Process == nil {
		return
	}

	WriteLog(id, "[MACE] [PLAYIT] Stopping playit tunnel agent...")
	cmd.Process.Kill()
}
