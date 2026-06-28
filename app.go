package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"mace/backend/pkg/downloader"
	"mace/backend/pkg/launcher"
	"mace/backend/pkg/servermanager"
	"mace/backend/pkg/utils"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx          context.Context
	doneChannels map[string]chan struct{}
	mu           sync.Mutex
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		doneChannels: make(map[string]chan struct{}),
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	launcher.SetupTray(a.ctx)
	servermanager.CrashCallback = func(instanceID, reason, resolution string) {
		runtime.EventsEmit(a.ctx, "server-crashed", map[string]string{
			"instanceId": instanceID,
			"reason":     reason,
			"resolution": resolution,
		})
	}
	launcher.PlayerUpdateCallback = func(id string, players []string) {
		runtime.EventsEmit(a.ctx, "players-updated-"+id, players)
	}
	launcher.PlayitAddressCallback = func(id string, address string) {
		inst, err := servermanager.LoadServer(id)
		if err == nil {
			inst.PlayitAddress = address
			servermanager.SaveServer(inst)
			runtime.EventsEmit(a.ctx, "playit-address-updated-"+id, address)
		}
	}
	servermanager.StartBackupScheduler()
	servermanager.StartCronScheduler()
}

// domReady is called when the DOM is fully loaded
func (a *App) domReady(ctx context.Context) {
}

// shutdown is called at application termination
func (a *App) shutdown(ctx context.Context) {
	launcher.RemoveTray()
	a.mu.Lock()
	defer a.mu.Unlock()
	for id, done := range a.doneChannels {
		close(done)
		delete(a.doneChannels, id)
	}
	launcher.StopAll()
}

// ListServers returns a list of all Minecraft servers.
func (a *App) ListServers() ([]servermanager.ServerInstance, error) {
	return servermanager.ListServers()
}

// CreateServer creates a new isolated server directory and downloads the JAR.
func (a *App) CreateServer(payload servermanager.CreateServerPayload) (*servermanager.ServerInstance, error) {
	if payload.Name == "" || payload.Version == "" || payload.Type == "" {
		return nil, fmt.Errorf("missing required fields (name, version, type)")
	}
	if payload.MemoryMB <= 0 {
		payload.MemoryMB = 2048
	}
	return servermanager.CreateServer(payload)
}

// BrowseForServerDir opens a native folder selection dialog.
func (a *App) BrowseForServerDir() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Existing Server Directory",
	})
}

// ImportServer registers an external server directory as a managed instance.
func (a *App) ImportServer(payload servermanager.ImportServerPayload) (*servermanager.ServerInstance, error) {
	if payload.Path == "" {
		return nil, fmt.Errorf("missing path")
	}
	return servermanager.ImportServer(payload)
}

// StartServer starts a server instance process.
func (a *App) StartServer(id string) (string, error) {
	return servermanager.StartServer(id)
}

// StopServer stops a server instance process.
func (a *App) StopServer(id string) (string, error) {
	return servermanager.StopServer(id)
}

// KillServer forcefully terminates a server instance process.
func (a *App) KillServer(id string) (string, error) {
	return servermanager.KillServer(id)
}

// RestartServer restarts a server instance process by stopping, waiting, and starting again.
func (a *App) RestartServer(id string) error {
	_, err := servermanager.StopServer(id)
	if err != nil {
		return err
	}

	for i := 0; i < 20; i++ {
		if !launcher.IsRunning(id) {
			break
		}
		time.Sleep(500 * time.Millisecond)
	}

	_, err = servermanager.StartServer(id)
	return err
}

// DeleteServer deletes a server instance's folder and processes.
func (a *App) DeleteServer(id string) error {
	return servermanager.DeleteServer(id)
}

// GetConsoleLogs retrieves buffered logs for a server instance.
func (a *App) GetConsoleLogs(id string) ([]string, error) {
	return servermanager.GetConsoleLogs(id)
}

// SendCommand writes a command to the Minecraft server stdin.
func (a *App) SendCommand(id string, command string) error {
	return servermanager.SendCommand(id, command)
}

// GetServerProperties reads raw server.properties contents.
func (a *App) GetServerProperties(id string) (string, error) {
	return servermanager.GetServerProperties(id)
}

// UpdateServerConfig saves updated configuration.
func (a *App) UpdateServerConfig(payload servermanager.UpdateConfigPayload) error {
	return servermanager.UpdateServerConfig(payload)
}

// DetectJava searches for system java paths.
func (a *App) DetectJava() ([]utils.JavaInstall, error) {
	return servermanager.DetectJava()
}

// GetAvailableVersions aggregates available versions for all loaders.
func (a *App) GetAvailableVersions() (map[string][]string, error) {
	return servermanager.GetAvailableVersions()
}

// GetServerResources returns live CPU/memory/uptime for a running server process.
func (a *App) GetServerResources(id string) (map[string]interface{}, error) {
	usage, err := servermanager.GetServerResources(id)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"cpuPercent": usage.CPUPercent,
		"memoryMB":   usage.MemoryMB,
		"uptime":     usage.Uptime,
	}, nil
}

// SubscribeConsole starts streaming logs for a server instance.
func (a *App) SubscribeConsole(id string) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if _, ok := a.doneChannels[id]; ok {
		return
	}

	done := make(chan struct{})
	a.doneChannels[id] = done

	logs, _ := servermanager.GetConsoleLogs(id)
	for _, line := range logs {
		runtime.EventsEmit(a.ctx, "console-log-"+id, line)
	}

	ch := servermanager.SubscribeLogs(id)

	go func() {
		defer servermanager.UnsubscribeLogs(id, ch)
		for {
			select {
			case logLine, ok := <-ch:
				if !ok {
					return
				}
				runtime.EventsEmit(a.ctx, "console-log-"+id, logLine)
			case <-done:
				return
			}
		}
	}()
}

// UnsubscribeConsole stops streaming logs for a server instance.
func (a *App) UnsubscribeConsole(id string) {
	a.mu.Lock()
	if done, ok := a.doneChannels[id]; ok {
		close(done)
		delete(a.doneChannels, id)
	}
	a.mu.Unlock()
}

// GetActivePlayers returns the active player names for a server instance.
func (a *App) GetActivePlayers(id string) ([]string, error) {
	if !launcher.IsRunning(id) {
		launcher.ClearActivePlayers(id)
		return []string{}, nil
	}
	players := launcher.GetActivePlayers(id)
	if len(players) == 0 {
		logs, _ := servermanager.GetConsoleLogs(id)
		launcher.SeedActivePlayersFromLogs(id, logs)
		players = launcher.GetActivePlayers(id)
	}
	return players, nil
}

// GetPlayerRoles returns the OP and Whitelist status lists.
func (a *App) GetPlayerRoles(id string) (map[string]interface{}, error) {
	inst, err := servermanager.LoadServer(id)
	if err != nil {
		return nil, err
	}
	roles, err := launcher.GetPlayerRoles(inst.Path)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"ops":         roles.Ops,
		"whitelisted": roles.Whitelisted,
	}, nil
}

// --- Content Management (Mods / Plugins / Modpacks) ---

// ListContent lists mod or plugin JARs for a server instance.
// contentType is "mod" or "plugin".
func (a *App) ListContent(id, contentType string) ([]servermanager.ContentItem, error) {
	return servermanager.ListContent(id, contentType)
}

// AddContent copies a local JAR into the server's content directory.
func (a *App) AddContent(id, srcPath, contentType string) (*servermanager.ContentItem, error) {
	return servermanager.AddContent(id, srcPath, contentType)
}

// RemoveContent deletes a mod or plugin by filename.
func (a *App) RemoveContent(id, fileName, contentType string) error {
	return servermanager.RemoveContent(id, fileName, contentType)
}

// ToggleContent enables or disables a mod/plugin by renaming its file.
func (a *App) ToggleContent(id, fileName, contentType string, enabled bool) error {
	return servermanager.ToggleContent(id, fileName, contentType, enabled)
}

// ApplyModpack extracts a local modpack zip/mrpack and records the pack metadata.
func (a *App) ApplyModpack(id, zipPath string) (*servermanager.ModpackMeta, error) {
	return servermanager.ApplyModpack(id, zipPath)
}

// BrowseForJar opens a native file dialog filtered to .jar files.
func (a *App) BrowseForJar() (string, error) {
	return runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Mod / Plugin JAR",
		Filters: []runtime.FileFilter{
			{DisplayName: "JAR Files (*.jar)", Pattern: "*.jar"},
		},
	})
}

// BrowseForModpackZip opens a native file dialog filtered to modpack archives.
func (a *App) BrowseForModpackZip() (string, error) {
	return runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Modpack Archive",
		Filters: []runtime.FileFilter{
			{DisplayName: "Modpack Files (*.mrpack, *.zip)", Pattern: "*.mrpack;*.zip"},
		},
	})
}

// --- Remote Mod / Plugin Search ---

// SearchModrinth searches Modrinth for mods, plugins, or modpacks.
// projectType is "mod", "plugin", or "modpack". Filters are auto-applied from loader+gameVersion.
func (a *App) SearchModrinth(query, projectType, loader, gameVersion string) ([]downloader.ModrinthSearchResult, error) {
	return downloader.SearchModrinth(query, projectType, loader, gameVersion, 20)
}

// BrowseModrinth returns popular content from Modrinth (no search query, sorted by downloads).
func (a *App) BrowseModrinth(projectType, loader, gameVersion string) ([]downloader.ModrinthSearchResult, error) {
	return downloader.BrowseModrinth(projectType, loader, gameVersion, 20)
}

// InstallModrinthMod resolves and downloads the best compatible version of a Modrinth project.
func (a *App) InstallModrinthMod(serverID, projectID, loader, gameVersion, contentType string) (*servermanager.ContentItem, error) {
	version, err := downloader.ResolveModrinthVersion(projectID, loader, gameVersion)
	if err != nil {
		return nil, err
	}

	var downloadURL, fileName string
	for _, f := range version.Files {
		if f.Primary {
			downloadURL = f.URL
			fileName = f.Filename
			break
		}
	}
	if downloadURL == "" && len(version.Files) > 0 {
		downloadURL = version.Files[0].URL
		fileName = version.Files[0].Filename
	}
	if downloadURL == "" {
		return nil, fmt.Errorf("no downloadable file found for this version")
	}

	return servermanager.DownloadAndInstallMod(serverID, downloadURL, fileName, contentType)
}

// SearchCurseForge searches CurseForge for mods, plugins, or modpacks.
// classID: 6 = Mods, 5 = Bukkit Plugins, 4471 = Modpacks.
func (a *App) SearchCurseForge(query string, classID int, loader, gameVersion string) ([]downloader.CurseForgeSearchResult, error) {
	settings, err := utils.LoadSettings()
	if err != nil {
		return nil, err
	}
	return downloader.SearchCurseForge(settings.CurseForgeAPIKey, query, classID, loader, gameVersion, 20)
}

// BrowseCurseForge returns popular content from CurseForge (no search query, sorted by popularity).
func (a *App) BrowseCurseForge(classID int, loader, gameVersion string) ([]downloader.CurseForgeSearchResult, error) {
	settings, err := utils.LoadSettings()
	if err != nil {
		return nil, err
	}
	return downloader.BrowseCurseForge(settings.CurseForgeAPIKey, classID, loader, gameVersion, 20)
}

// InstallCurseForgeFile resolves and downloads the best file for a CurseForge mod.
func (a *App) InstallCurseForgeFile(serverID string, modID int64, loader, gameVersion, contentType string) (*servermanager.ContentItem, error) {
	settings, err := utils.LoadSettings()
	if err != nil {
		return nil, err
	}

	file, err := downloader.ResolveCurseForgeFile(settings.CurseForgeAPIKey, modID, loader, gameVersion)
	if err != nil {
		return nil, err
	}

	downloadURL := file.DownloadURL
	fileName := file.FileName

	if downloadURL == "" {
		downloadURL, fileName, err = downloader.GetCurseForgeDownloadURL(settings.CurseForgeAPIKey, modID, file.ID)
		if err != nil {
			return nil, err
		}
	}

	return servermanager.DownloadAndInstallMod(serverID, downloadURL, fileName, contentType)
}

// --- Hangar (PaperMC Plugin Repository) ---

// SearchHangar searches the Hangar API for Paper plugins.
func (a *App) SearchHangar(query string) ([]downloader.HangarSearchResult, error) {
	return downloader.SearchHangar(query, 20)
}

// BrowseHangar returns popular Paper plugins from Hangar.
func (a *App) BrowseHangar() ([]downloader.HangarSearchResult, error) {
	return downloader.BrowseHangar(20)
}

// InstallHangarPlugin resolves and downloads the best compatible version of a Hangar plugin.
func (a *App) InstallHangarPlugin(serverID, slug, mcVersion string) (*servermanager.ContentItem, error) {
	versionInfo, err := downloader.ResolveHangarVersion(slug, mcVersion)
	if err != nil {
		return nil, err
	}

	return servermanager.DownloadAndInstallMod(serverID, versionInfo.DownloadURL, versionInfo.FileName, "plugin")
}

// --- Spiget (SpigotMC Plugin Repository) ---

// SearchSpiget searches the Spiget API for SpigotMC plugins.
func (a *App) SearchSpiget(query string) ([]downloader.SpigetSearchResult, error) {
	return downloader.SearchSpiget(query, 20)
}

// BrowseSpiget returns popular SpigotMC plugins from Spiget.
func (a *App) BrowseSpiget() ([]downloader.SpigetSearchResult, error) {
	return downloader.BrowseSpiget(20)
}

// InstallSpigetPlugin resolves and downloads a Spiget plugin.
func (a *App) InstallSpigetPlugin(serverID string, resourceID int64) (*servermanager.ContentItem, error) {
	downloadURL, fileName, err := downloader.ResolveSpigetDownloadURL(resourceID)
	if err != nil {
		return nil, err
	}

	return servermanager.DownloadAndInstallMod(serverID, downloadURL, fileName, "plugin")
}

// GetPlayitStatus retrieves the running state, claim URL, and assigned address of the playit tunnel.
func (a *App) GetPlayitStatus(id string) (map[string]interface{}, error) {
	inst, err := servermanager.LoadServer(id)
	if err != nil {
		return nil, err
	}

	isRunning, claimURL, address := launcher.GetPlayitStatusInfo(id)
	if address == "" && inst.PlayitAddress != "" {
		address = inst.PlayitAddress
	}

	return map[string]interface{}{
		"playitEnabled": inst.PlayitEnabled,
		"isRunning":     isRunning,
		"claimUrl":      claimURL,
		"address":       address,
	}, nil
}

// --- App Settings ---

// GetAppSettings returns the current application settings.
func (a *App) GetAppSettings() (*utils.AppSettings, error) {
	return utils.LoadSettings()
}

// SaveAppSettings persists application settings to disk.
func (a *App) SaveAppSettings(settings utils.AppSettings) error {
	return utils.SaveSettings(&settings)
}

// PickServersDirectory opens a dialog to select a folder and returns it.
func (a *App) PickServersDirectory() (string, error) {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Server Save Directory",
	})
	if err != nil {
		return "", err
	}
	return dir, nil
}

// ChangeServersDirectory migrates servers to the new directory, updates settings, and metadata paths.
func (a *App) ChangeServersDirectory(newDir string) error {
	if newDir == "" {
		return fmt.Errorf("directory path cannot be empty")
	}

	newDirAbs, err := filepath.Abs(newDir)
	if err != nil {
		return fmt.Errorf("invalid path: %w", err)
	}

	oldDirAbs := utils.GetServerRoot()
	if oldDirAbs == newDirAbs {
		return nil // Same directory, no changes
	}

	// 1. List all servers from old directory
	servers, err := servermanager.ListServers()
	if err != nil {
		return fmt.Errorf("failed to list servers: %w", err)
	}

	// Ensure the new destination directory exists
	if err := utils.EnsureDir(newDirAbs); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// 2. Migrate each server folder
	type migrationStep struct {
		oldPath      string
		newPath      string
		originalMeta []byte
	}
	var migrated []migrationStep
	var migrationErr error

	defer func() {
		if migrationErr != nil {
			// Rollback migrated directories in reverse order
			for i := len(migrated) - 1; i >= 0; i-- {
				step := migrated[i]
				// Use os.Stat so directories are detected (unlike utils.FileExists which skips dirs)
				if _, statErr := os.Stat(step.newPath); statErr == nil {
					// Try rename back first
					if rollbackRenameErr := os.Rename(step.newPath, step.oldPath); rollbackRenameErr != nil {
						// If rename back fails, copy back
						if copyBackErr := utils.CopyDir(step.newPath, step.oldPath); copyBackErr == nil {
							os.RemoveAll(step.newPath)
						}
					}
					// Restore original metadata bytes if we saved them
					if step.originalMeta != nil {
						metaFile := filepath.Join(step.oldPath, "metadata.json")
						_ = os.WriteFile(metaFile, step.originalMeta, 0644)
					}
				}
			}
		}
	}()

	for _, inst := range servers {
		oldServerDir := filepath.Join(oldDirAbs, inst.ID)
		newServerDir := filepath.Join(newDirAbs, inst.ID)

		if !utils.FileExists(filepath.Join(oldServerDir, "metadata.json")) {
			continue
		}

		// Reject destinations that are inside or equal to oldServerDir to prevent recursive copy/move
		rel, relErr := filepath.Rel(oldServerDir, newServerDir)
		if relErr == nil && (rel == "." || !strings.HasPrefix(rel, ".."+string(os.PathSeparator))) {
			migrationErr = fmt.Errorf("invalid destination: %s is inside or equal to %s", newServerDir, oldServerDir)
			return migrationErr
		}

		// Reject move if destination already exists
		if _, statErr := os.Stat(newServerDir); statErr == nil || !os.IsNotExist(statErr) {
			migrationErr = fmt.Errorf("destination directory already exists: %s", newServerDir)
			return migrationErr
		}

		// Try to Rename. If it fails (like across partitions), copy and remove.
		moved := false
		if renameErr := os.Rename(oldServerDir, newServerDir); renameErr == nil {
			moved = true
		} else {
			if copyErr := utils.CopyDir(oldServerDir, newServerDir); copyErr != nil {
				// Clean up any partially copied files in newServerDir
				os.RemoveAll(newServerDir)
				migrationErr = fmt.Errorf("failed to copy server %s: %w", inst.ID, copyErr)
				return migrationErr
			}
			moved = true
			if removeErr := os.RemoveAll(oldServerDir); removeErr != nil {
				fmt.Printf("Warning: failed to remove old directory %s: %v\n", oldServerDir, removeErr)
			}
		}

		// 3. Read original metadata before rewriting (preserve for rollback)
		metaFile := filepath.Join(newServerDir, "metadata.json")
		data, readErr := os.ReadFile(metaFile)
		if readErr != nil {
			migrationErr = fmt.Errorf("failed to read metadata of migrated server %s: %w", inst.ID, readErr)
			return migrationErr
		}

		if moved {
			migrated = append(migrated, migrationStep{
				oldPath:      oldServerDir,
				newPath:      newServerDir,
				originalMeta: data,
			})
		}

		var updatedInst servermanager.ServerInstance
		if unmarshalErr := json.Unmarshal(data, &updatedInst); unmarshalErr != nil {
			migrationErr = fmt.Errorf("failed to parse metadata of migrated server %s: %w", inst.ID, unmarshalErr)
			return migrationErr
		}

		updatedInst.Path = newServerDir

		// If BackupPath was inside the old server directory, update it to the new path
		if updatedInst.BackupPath != "" {
			rel, relErr := filepath.Rel(oldServerDir, updatedInst.BackupPath)
			if relErr == nil && (rel == "." || !strings.HasPrefix(rel, ".."+string(os.PathSeparator))) {
				updatedInst.BackupPath = filepath.Join(newServerDir, rel)
			}
		}

		updatedData, marshalErr := json.MarshalIndent(updatedInst, "", "  ")
		if marshalErr != nil {
			migrationErr = fmt.Errorf("failed to serialize metadata of migrated server %s: %w", inst.ID, marshalErr)
			return migrationErr
		}

		if writeErr := os.WriteFile(metaFile, updatedData, 0644); writeErr != nil {
			migrationErr = fmt.Errorf("failed to write updated metadata of migrated server %s: %w", inst.ID, writeErr)
			return migrationErr
		}
	}

	// 4. Update the cached AppSettings and write to settings.json
	settings, loadErr := utils.LoadSettings()
	if loadErr != nil {
		migrationErr = fmt.Errorf("failed to load settings: %w", loadErr)
		return migrationErr
	}

	settings.ServersDir = newDirAbs
	if saveErr := utils.SaveSettings(settings); saveErr != nil {
		migrationErr = fmt.Errorf("failed to save new servers directory: %w", saveErr)
		return migrationErr
	}

	return nil
}

// ValidateCurseForgeKey tests whether the given API key is accepted by CurseForge.
func (a *App) ValidateCurseForgeKey(apiKey string) error {
	return downloader.ValidateCurseForgeKey(apiKey)
}

// --- Backups ---

// ListBackups returns all backup archives for a server instance.
func (a *App) ListBackups(id string) ([]servermanager.BackupItem, error) {
	return servermanager.ListBackups(id)
}

// CreateBackup compresses the world folder and configs into a timestamped zip.
func (a *App) CreateBackup(id string) (*servermanager.BackupItem, error) {
	return servermanager.CreateBackup(id)
}

// CreateBackupWithOptions compresses selected components into a timestamped zip.
func (a *App) CreateBackupWithOptions(id string, includeWorld, includePlugins, includeConfigs bool) (*servermanager.BackupItem, error) {
	return servermanager.CreateBackupWithOptions(id, includeWorld, includePlugins, includeConfigs)
}

// RestoreBackup restores a server from a backup archive.
func (a *App) RestoreBackup(id string, backupName string) error {
	return servermanager.RestoreBackup(id, backupName)
}

// DeleteBackup removes a backup archive from disk.
func (a *App) DeleteBackup(id string, backupName string) error {
	return servermanager.DeleteBackup(id, backupName)
}

// BrowseForBackupDir opens a native folder selection dialog for choosing a backup directory.
func (a *App) BrowseForBackupDir() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Backup Directory",
	})
}

// --- First-Run Setup ---

// IsFirstRun returns true if the initial setup has not yet been completed.
func (a *App) IsFirstRun() (bool, error) {
	s, err := utils.LoadSettings()
	if err != nil {
		return true, nil
	}
	return !s.SetupComplete, nil
}

// SelectServersDir opens a native folder picker for the servers root directory.
func (a *App) SelectServersDir() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Choose where MACE stores your servers",
	})
}

// GetDefaultServersDir returns the default servers directory path so the frontend can display it.
func (a *App) GetDefaultServersDir() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return filepath.Join(".", "servers"), nil
	}
	dir := filepath.Join(filepath.Dir(exe), "servers")
	abs, _ := filepath.Abs(dir)
	return abs, nil
}

// CompleteSetup persists the chosen servers directory, marks setup as done,
// and optionally creates a Desktop shortcut to the MACE executable.
func (a *App) CompleteSetup(serversDir string, createShortcut bool) error {
	s, err := utils.LoadSettings()
	if err != nil {
		s = &utils.AppSettings{}
	}

	s.ServersDir = serversDir
	s.SetupComplete = true

	if err := utils.SaveSettings(s); err != nil {
		return fmt.Errorf("failed to save settings: %w", err)
	}

	// Ensure the servers directory exists
	if serversDir != "" {
		if err := os.MkdirAll(serversDir, 0755); err != nil {
			return fmt.Errorf("failed to create servers directory: %w", err)
		}
	}

	if createShortcut {
		exe, err := os.Executable()
		if err != nil {
			return fmt.Errorf("could not locate executable: %w", err)
		}
		exePath, _ := filepath.Abs(exe)

		// Use PowerShell + WScript.Shell COM to create the .lnk shortcut
		ps := fmt.Sprintf(`
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut("$env:USERPROFILE\Desktop\MACE.lnk")
$s.TargetPath = %q
$s.WorkingDirectory = %q
$s.Description = "MACE - Minecraft Server Manager"
$s.Save()
`, exePath, filepath.Dir(exePath))

		cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", ps)
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("shortcut creation failed: %w\n%s", err, string(out))
		}
	}

	return nil
}

// ListScheduledTasks returns all scheduled tasks.
func (a *App) ListScheduledTasks() ([]servermanager.ScheduledTask, error) {
	return servermanager.ListScheduledTasks()
}

// CreateScheduledTask adds a new scheduled task.
func (a *App) CreateScheduledTask(task servermanager.ScheduledTask) (servermanager.ScheduledTask, error) {
	return servermanager.CreateScheduledTask(task)
}

// UpdateScheduledTask updates an existing scheduled task.
func (a *App) UpdateScheduledTask(task servermanager.ScheduledTask) error {
	return servermanager.UpdateScheduledTask(task)
}

// DeleteScheduledTask removes a scheduled task.
func (a *App) DeleteScheduledTask(id string) error {
	return servermanager.DeleteScheduledTask(id)
}

// ShowConfirmDialog shows a native OS question dialog and returns true if the user confirmed.
func (a *App) ShowConfirmDialog(title, message string) (bool, error) {
	selection, err := runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
		Type:          runtime.QuestionDialog,
		Title:         title,
		Message:       message,
		DefaultButton: "No",
		Buttons:       []string{"Yes", "No"},
	})
	if err != nil {
		return false, err
	}
	return selection == "Yes", nil
}
