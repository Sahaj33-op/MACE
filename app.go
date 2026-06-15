package main

import (
	"context"
	"fmt"
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
}

// domReady is called when the DOM is fully loaded
func (a *App) domReady(ctx context.Context) {
}

// shutdown is called at application termination
func (a *App) shutdown(ctx context.Context) {
	a.mu.Lock()
	defer a.mu.Unlock()
	for id, done := range a.doneChannels {
		close(done)
		delete(a.doneChannels, id)
	}
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

// --- App Settings ---

// GetAppSettings returns the current application settings.
func (a *App) GetAppSettings() (*utils.AppSettings, error) {
	return utils.LoadSettings()
}

// SaveAppSettings persists application settings to disk.
func (a *App) SaveAppSettings(settings utils.AppSettings) error {
	return utils.SaveSettings(&settings)
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
