package servermanager

type ServerType string

const (
	Vanilla ServerType = "vanilla"
	Spigot  ServerType = "spigot"
	Paper   ServerType = "paper"
	Fabric  ServerType = "fabric"
	Quilt   ServerType = "quilt"
	Forge   ServerType = "forge"
	NeoForge ServerType = "neoforge"
)

type ServerInstance struct {
	ID            string       `json:"id"`
	Name          string       `json:"name"`
	Version       string       `json:"version"`
	Type          ServerType   `json:"type"`
	Path          string       `json:"path"`
	Status        string       `json:"status"`
	JavaPath      string       `json:"javaPath"`
	MemoryMB      int          `json:"memoryMB"`
	World         string       `json:"world"`
	IPAddress     string       `json:"ipAddress"`
	Port          int          `json:"port"`
	Watchdog      bool         `json:"watchdog"`
	BackupPath    string       `json:"backupPath"`
	PlayitEnabled bool         `json:"playitEnabled"`
	PlayitAddress string       `json:"playitAddress"`
	JvmArgs       string       `json:"jvmArgs"`
	Modpack       *ModpackMeta `json:"modpack,omitempty"`
}

// ContentItem represents a single mod or plugin JAR inside a server directory.
type ContentItem struct {
	Name     string `json:"name"`
	FileName string `json:"fileName"`
	Enabled  bool   `json:"enabled"`
	SizeKB   int64  `json:"sizeKB"`
	Type     string `json:"type"`
}

// ModpackMeta stores information about an applied modpack.
type ModpackMeta struct {
	Name    string `json:"name"`
	Version string `json:"version"`
	Source  string `json:"source"`
}

// ModSearchResult is a unified search result from Modrinth or CurseForge.
type ModSearchResult struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Author      string `json:"author"`
	IconURL     string `json:"iconUrl"`
	Downloads   int64  `json:"downloads"`
	Source      string `json:"source"`
	VersionID   string `json:"versionId"`
	DownloadURL string `json:"downloadUrl"`
	FileName    string `json:"fileName"`
}

type CreateServerPayload struct {
	Name       string `json:"name"`
	Version    string `json:"version"`
	Type       string `json:"type"`
	MemoryMB   int    `json:"memoryMB"`
	BackupPath string `json:"backupPath"`
	AgreeEula  bool   `json:"agreeEula"`
}

type ImportServerPayload struct {
	Path string `json:"path"`
	Name string `json:"name"`
}


type UpdateConfigPayload struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	JavaPath      string `json:"javaPath"`
	MemoryMB      int    `json:"memoryMB"`
	Port          int    `json:"port"`
	Watchdog      bool   `json:"watchdog"`
	RawProps      string `json:"rawProps"`
	Version       string `json:"version"`
	Type          string `json:"type"`
	BackupPath    string `json:"backupPath"`
	PlayitEnabled bool   `json:"playitEnabled"`
	JvmArgs       string `json:"jvmArgs"`
}

// BackupItem represents a single backup archive.
type BackupItem struct {
	FileName  string `json:"fileName"`
	SizeKB    int64  `json:"sizeKB"`
	CreatedAt string `json:"createdAt"`
}
