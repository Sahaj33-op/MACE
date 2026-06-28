export type ServerType = 'vanilla' | 'spigot' | 'paper' | 'fabric' | 'quilt' | 'forge' | 'neoforge';

export interface ModpackMeta {
  name: string;
  version: string;
  source: 'local' | 'modrinth' | 'curseforge';
}

export interface ServerInstance {
  id: string;
  name: string;
  version: string;
  type: ServerType;
  path: string;
  status: 'offline' | 'starting' | 'online' | 'stopping' | 'restarting' | 'installing';
  javaPath: string;
  memoryMB: number;
  world: string;
  ipAddress: string;
  port: number;
  watchdog: boolean;
  backupPath: string;
  playitEnabled: boolean;
  playitAddress: string;
  jvmArgs: string;
  modpack?: ModpackMeta;
  backupSchedule?: string;
  backupRetention?: number;
  backupIncludeWorld?: boolean;
  backupIncludePlugins?: boolean;
  backupIncludeConfigs?: boolean;
  lastBackup?: string;
}

export interface JavaInstall {
  path: string;
  version: string;
}

export interface ContentItem {
  name: string;
  fileName: string;
  enabled: boolean;
  sizeKB: number;
  type: 'mod' | 'plugin';
}

export interface ModSearchResult {
  id: string;
  slug?: string;
  name: string;
  description: string;
  author: string;
  iconUrl: string;
  downloads: number;
  source: 'modrinth' | 'curseforge' | 'hangar' | 'spiget';
  premium?: boolean;
  external?: boolean;
}

export interface AppSettings {
  curseForgeApiKey: string;
  serversDir?: string;
}

export interface BackupItem {
  fileName: string;
  sizeKB: number;
  createdAt: string;
}
