import type { ServerInstance, JavaInstall, ServerType, ContentItem, ModSearchResult, AppSettings, BackupItem } from "./types";

// Type for the Wails Go App bindings and runtime helper
declare global {
  interface Window {
    go: {
      main: {
        App: {
          ListServers(): Promise<ServerInstance[]>;
          CreateServer(payload: {
            name: string;
            version: string;
            type: ServerType;
            memoryMB: number;
            backupPath?: string;
            agreeEula: boolean;
          }): Promise<ServerInstance>;
          BrowseForServerDir(): Promise<string>;
          ImportServer(payload: { path: string; name: string }): Promise<ServerInstance>;
          StartServer(id: string): Promise<string>;
          StopServer(id: string): Promise<string>;
          KillServer(id: string): Promise<string>;
          RestartServer(id: string): Promise<void>;
          DeleteServer(id: string): Promise<void>;
          GetConsoleLogs(id: string): Promise<string[]>;
          SendCommand(id: string, command: string): Promise<void>;
          GetServerProperties(id: string): Promise<string>;
          UpdateServerConfig(payload: {
            id: string;
            name: string;
            javaPath: string;
            memoryMB: number;
            port: number;
            watchdog: boolean;
            rawProps: string;
            version: string;
            type: string;
            backupPath: string;
            playitEnabled: boolean;
            jvmArgs: string;
            backupSchedule?: string;
            backupRetention?: number;
            backupIncludeWorld?: boolean;
            backupIncludePlugins?: boolean;
            backupIncludeConfigs?: boolean;
          }): Promise<void>;
          GetPlayitStatus(id: string): Promise<{
            playitEnabled: boolean;
            isRunning: boolean;
            claimUrl: string;
            address: string;
          }>;
          DetectJava(): Promise<JavaInstall[]>;
          GetAvailableVersions(): Promise<Record<string, string[]>>;
          GetServerResources(id: string): Promise<{ cpuPercent: number; memoryMB: number; uptime: number }>;
          SubscribeConsole(id: string): Promise<void>;
          UnsubscribeConsole(id: string): Promise<void>;
          // Content management
          ListContent(id: string, contentType: string): Promise<ContentItem[]>;
          AddContent(id: string, srcPath: string, contentType: string): Promise<ContentItem>;
          RemoveContent(id: string, fileName: string, contentType: string): Promise<void>;
          ToggleContent(id: string, fileName: string, contentType: string, enabled: boolean): Promise<void>;
          ApplyModpack(id: string, zipPath: string): Promise<{ name: string; version: string; source: string }>;
          BrowseForJar(): Promise<string>;
          BrowseForModpackZip(): Promise<string>;
          // Remote mod search
          SearchModrinth(query: string, projectType: string, loader: string, gameVersion: string): Promise<ModSearchResult[]>;
          BrowseModrinth(projectType: string, loader: string, gameVersion: string): Promise<ModSearchResult[]>;
          InstallModrinthMod(serverID: string, projectID: string, loader: string, gameVersion: string, contentType: string): Promise<ContentItem>;
          SearchCurseForge(query: string, classID: number, loader: string, gameVersion: string): Promise<ModSearchResult[]>;
          BrowseCurseForge(classID: number, loader: string, gameVersion: string): Promise<ModSearchResult[]>;
          InstallCurseForgeFile(serverID: string, modID: number, loader: string, gameVersion: string, contentType: string): Promise<ContentItem>;
          SearchHangar(query: string): Promise<ModSearchResult[]>;
          BrowseHangar(): Promise<ModSearchResult[]>;
          InstallHangarPlugin(serverID: string, slug: string, mcVersion: string): Promise<ContentItem>;
          SearchSpiget(query: string): Promise<ModSearchResult[]>;
          BrowseSpiget(): Promise<ModSearchResult[]>;
          InstallSpigetPlugin(serverID: string, resourceID: number): Promise<ContentItem>;
          // App settings
          GetAppSettings(): Promise<AppSettings>;
          SaveAppSettings(settings: AppSettings): Promise<void>;
          ValidateCurseForgeKey(apiKey: string): Promise<void>;
          PickServersDirectory(): Promise<string>;
          ChangeServersDirectory(newDir: string): Promise<void>;
          // Backups
          ListBackups(id: string): Promise<BackupItem[]>;
          CreateBackup(id: string): Promise<BackupItem>;
          CreateBackupWithOptions(id: string, includeWorld: boolean, includePlugins: boolean, includeConfigs: boolean): Promise<BackupItem>;
          RestoreBackup(id: string, backupName: string): Promise<void>;
          DeleteBackup(id: string, backupName: string): Promise<void>;
          BrowseForBackupDir(): Promise<string>;
          // Player Management
          GetActivePlayers(id: string): Promise<string[]>;
          GetPlayerRoles(id: string): Promise<{ ops: string[]; whitelisted: string[] }>;
          // First-Run Setup
          IsFirstRun(): Promise<boolean>;
          SelectServersDir(): Promise<string>;
          GetDefaultServersDir(): Promise<string>;
          CompleteSetup(serversDir: string, createShortcut: boolean): Promise<void>;
        };
      };
    };
    runtime: {
      EventsOn(eventName: string, callback: (...data: any[]) => void): () => void;
      EventsOff(eventName: string): void;
    };
  }
}

export async function listServers(): Promise<ServerInstance[]> {
  return window.go.main.App.ListServers();
}

export async function createServer(payload: {
  name: string;
  version: string;
  type: ServerType;
  memoryMB: number;
  backupPath?: string;
  agreeEula: boolean;
}): Promise<ServerInstance> {
  return window.go.main.App.CreateServer(payload);
}

export async function browseForServerDir(): Promise<string> {
  return window.go.main.App.BrowseForServerDir();
}

export async function importServer(payload: { path: string; name: string }): Promise<ServerInstance> {
  return window.go.main.App.ImportServer(payload);
}

export async function startServer(id: string): Promise<{ status: string }> {
  const status = await window.go.main.App.StartServer(id);
  return { status };
}

export async function stopServer(id: string): Promise<{ status: string }> {
  const status = await window.go.main.App.StopServer(id);
  return { status };
}

export async function killServer(id: string): Promise<{ status: string }> {
  const status = await window.go.main.App.KillServer(id);
  return { status };
}

export async function restartServer(id: string): Promise<void> {
  return window.go.main.App.RestartServer(id);
}

export async function getConsole(id: string): Promise<string[]> {
  return window.go.main.App.GetConsoleLogs(id);
}

export async function sendCommand(id: string, command: string): Promise<{ result: string }> {
  await window.go.main.App.SendCommand(id, command);
  return { result: "sent" };
}

export async function getServerProperties(id: string): Promise<{ properties: string }> {
  const properties = await window.go.main.App.GetServerProperties(id);
  return { properties };
}

export async function updateServerConfig(payload: {
  id: string;
  name: string;
  javaPath: string;
  memoryMB: number;
  port: number;
  watchdog: boolean;
  rawProps: string;
  version: string;
  type: string;
  backupPath: string;
  playitEnabled: boolean;
  jvmArgs: string;
  backupSchedule?: string;
  backupRetention?: number;
  backupIncludeWorld?: boolean;
  backupIncludePlugins?: boolean;
  backupIncludeConfigs?: boolean;
}): Promise<{ result: string }> {
  await window.go.main.App.UpdateServerConfig(payload);
  return { result: "updated" };
}

export async function getPlayitStatus(id: string): Promise<{
  playitEnabled: boolean;
  isRunning: boolean;
  claimUrl: string;
  address: string;
}> {
  return window.go.main.App.GetPlayitStatus(id);
}

export function onPlayitAddressUpdated(id: string, callback: (address: string) => void): () => void {
  if (window.runtime && window.runtime.EventsOn) {
    return window.runtime.EventsOn(`playit-address-updated-${id}`, callback);
  }
  return () => {};
}

export async function deleteServer(id: string): Promise<{ result: string }> {
  await window.go.main.App.DeleteServer(id);
  return { result: "deleted" };
}

export async function detectJava(): Promise<JavaInstall[]> {
  return window.go.main.App.DetectJava();
}

export async function getAvailableVersions(): Promise<Record<string, string[]>> {
  return window.go.main.App.GetAvailableVersions();
}

export async function getServerResources(id: string): Promise<{ cpuPercent: number; memoryMB: number; uptime: number }> {
  return window.go.main.App.GetServerResources(id);
}

// Console subscription helpers using Wails events
export async function subscribeConsole(id: string): Promise<void> {
  return window.go.main.App.SubscribeConsole(id);
}

export async function unsubscribeConsole(id: string): Promise<void> {
  return window.go.main.App.UnsubscribeConsole(id);
}

// Register callback for live log events from Wails runtime
export function onConsoleLog(id: string, callback: (line: string) => void): () => void {
  if (window.runtime && window.runtime.EventsOn) {
    return window.runtime.EventsOn(`console-log-${id}`, callback);
  }
  return () => {};
}

// Clean up log event subscription
export function offConsoleLog(id: string): void {
  if (window.runtime && window.runtime.EventsOff) {
    window.runtime.EventsOff(`console-log-${id}`);
  }
}

// ---- Content Management ----

export async function listContent(id: string, contentType: string): Promise<ContentItem[]> {
  return window.go.main.App.ListContent(id, contentType);
}

export async function addContent(id: string, srcPath: string, contentType: string): Promise<ContentItem> {
  return window.go.main.App.AddContent(id, srcPath, contentType);
}

export async function removeContent(id: string, fileName: string, contentType: string): Promise<void> {
  return window.go.main.App.RemoveContent(id, fileName, contentType);
}

export async function toggleContent(id: string, fileName: string, contentType: string, enabled: boolean): Promise<void> {
  return window.go.main.App.ToggleContent(id, fileName, contentType, enabled);
}

export async function applyModpack(id: string, zipPath: string): Promise<{ name: string; version: string; source: string }> {
  return window.go.main.App.ApplyModpack(id, zipPath);
}

export async function browseForJar(): Promise<string> {
  return window.go.main.App.BrowseForJar();
}

export async function browseForModpackZip(): Promise<string> {
  return window.go.main.App.BrowseForModpackZip();
}

// ---- Remote Mod Search ----

export async function searchModrinth(query: string, projectType: string, loader: string, gameVersion: string): Promise<ModSearchResult[]> {
  return window.go.main.App.SearchModrinth(query, projectType, loader, gameVersion);
}

export async function browseModrinth(projectType: string, loader: string, gameVersion: string): Promise<ModSearchResult[]> {
  return window.go.main.App.BrowseModrinth(projectType, loader, gameVersion);
}

export async function installModrinthMod(serverID: string, projectID: string, loader: string, gameVersion: string, contentType: string): Promise<ContentItem> {
  return window.go.main.App.InstallModrinthMod(serverID, projectID, loader, gameVersion, contentType);
}

export async function searchCurseForge(query: string, classID: number, loader: string, gameVersion: string): Promise<ModSearchResult[]> {
  return window.go.main.App.SearchCurseForge(query, classID, loader, gameVersion);
}

export async function browseCurseForge(classID: number, loader: string, gameVersion: string): Promise<ModSearchResult[]> {
  return window.go.main.App.BrowseCurseForge(classID, loader, gameVersion);
}

export async function installCurseForgeFile(serverID: string, modID: number, loader: string, gameVersion: string, contentType: string): Promise<ContentItem> {
  return window.go.main.App.InstallCurseForgeFile(serverID, modID, loader, gameVersion, contentType);
}

export async function searchHangar(query: string): Promise<ModSearchResult[]> {
  return window.go.main.App.SearchHangar(query);
}

export async function browseHangar(): Promise<ModSearchResult[]> {
  return window.go.main.App.BrowseHangar();
}

export async function installHangarPlugin(serverID: string, slug: string, mcVersion: string): Promise<ContentItem> {
  return window.go.main.App.InstallHangarPlugin(serverID, slug, mcVersion);
}

export async function searchSpiget(query: string): Promise<ModSearchResult[]> {
  return window.go.main.App.SearchSpiget(query);
}

export async function browseSpiget(): Promise<ModSearchResult[]> {
  return window.go.main.App.BrowseSpiget();
}

export async function installSpigetPlugin(serverID: string, resourceID: number): Promise<ContentItem> {
  return window.go.main.App.InstallSpigetPlugin(serverID, resourceID);
}

// ---- App Settings ----

export async function getAppSettings(): Promise<AppSettings> {
  return window.go.main.App.GetAppSettings();
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  return window.go.main.App.SaveAppSettings(settings);
}

export async function validateCurseForgeKey(apiKey: string): Promise<void> {
  return window.go.main.App.ValidateCurseForgeKey(apiKey);
}

export async function pickServersDirectory(): Promise<string> {
  return window.go.main.App.PickServersDirectory();
}

export async function changeServersDirectory(newDir: string): Promise<void> {
  return window.go.main.App.ChangeServersDirectory(newDir);
}

// ---- Backups ----

export async function listBackups(id: string): Promise<BackupItem[]> {
  return window.go.main.App.ListBackups(id);
}

export async function createBackup(id: string): Promise<BackupItem> {
  return window.go.main.App.CreateBackup(id);
}

export async function createBackupWithOptions(id: string, includeWorld: boolean, includePlugins: boolean, includeConfigs: boolean): Promise<BackupItem> {
  return window.go.main.App.CreateBackupWithOptions(id, includeWorld, includePlugins, includeConfigs);
}

export async function restoreBackup(id: string, backupName: string): Promise<void> {
  return window.go.main.App.RestoreBackup(id, backupName);
}

export async function deleteBackup(id: string, backupName: string): Promise<void> {
  return window.go.main.App.DeleteBackup(id, backupName);
}

export async function browseForBackupDir(): Promise<string> {
  return window.go.main.App.BrowseForBackupDir();
}

export function onServerCrashed(callback: (data: { instanceId: string; reason: string; resolution: string }) => void): () => void {
  if (window.runtime && window.runtime.EventsOn) {
    return window.runtime.EventsOn("server-crashed", callback);
  }
  return () => {};
}

export async function getActivePlayers(id: string): Promise<string[]> {
  return window.go.main.App.GetActivePlayers(id);
}

export async function getPlayerRoles(id: string): Promise<{ ops: string[]; whitelisted: string[] }> {
  return window.go.main.App.GetPlayerRoles(id);
}

export function onPlayersUpdated(id: string, callback: (players: string[]) => void): () => void {
  if (window.runtime && window.runtime.EventsOn) {
    return window.runtime.EventsOn(`players-updated-${id}`, callback);
  }
  return () => {};
}

export function offPlayersUpdated(id: string): void {
  if (window.runtime && window.runtime.EventsOff) {
    window.runtime.EventsOff(`players-updated-${id}`);
  }
}

// ---- First-Run Setup ----

export async function isFirstRun(): Promise<boolean> {
  return window.go.main.App.IsFirstRun();
}

export async function selectServersDir(): Promise<string> {
  return window.go.main.App.SelectServersDir();
}

export async function getDefaultServersDir(): Promise<string> {
  return window.go.main.App.GetDefaultServersDir();
}

export async function completeSetup(serversDir: string, createShortcut: boolean): Promise<void> {
  return window.go.main.App.CompleteSetup(serversDir, createShortcut);
}
