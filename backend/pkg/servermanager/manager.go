package servermanager

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"mace/backend/pkg/downloader"
	"mace/backend/pkg/launcher"
	"mace/backend/pkg/utils"
)

var (
	statuses   = make(map[string]string)
	statusesMu sync.RWMutex

	CrashCallback func(id string, reason string, resolution string)
)


func getStatus(id string) string {
	statusesMu.RLock()
	defer statusesMu.RUnlock()
	if status, ok := statuses[id]; ok {
		return status
	}
	return "offline"
}

func setStatus(id string, status string) {
	statusesMu.Lock()
	statuses[id] = status
	statusesMu.Unlock()
}

// LoadServer loads instance metadata from disk.
func LoadServer(id string) (*ServerInstance, error) {
	metaFile := filepath.Join(utils.GetServerRoot(), id, "metadata.json")
	if !utils.FileExists(metaFile) {
		return nil, fmt.Errorf("server %s metadata not found", id)
	}

	data, err := os.ReadFile(metaFile)
	if err != nil {
		return nil, err
	}

	var inst ServerInstance
	if err := json.Unmarshal(data, &inst); err != nil {
		return nil, err
	}

	if launcher.IsRunning(id) {
		inst.Status = getStatus(id)
		if inst.Status == "offline" {
			inst.Status = "online"
		}
	} else {
		inst.Status = "offline"
	}

	return &inst, nil
}

// SaveServer saves instance metadata to disk.
func SaveServer(inst *ServerInstance) error {
	dir := filepath.Join(utils.GetServerRoot(), inst.ID)
	if err := utils.EnsureDir(dir); err != nil {
		return err
	}

	metaFile := filepath.Join(dir, "metadata.json")
	data, err := json.MarshalIndent(inst, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(metaFile, data, 0644)
}

// ListServers scans the servers directory and loads all metadata.
func ListServers() ([]ServerInstance, error) {
	root := utils.GetServerRoot()
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, err
	}

	var list []ServerInstance
	for _, entry := range entries {
		if entry.IsDir() {
			inst, err := LoadServer(entry.Name())
			if err == nil && inst != nil {
				list = append(list, *inst)
			}
		}
	}

	if list == nil {
		list = []ServerInstance{}
	}

	return list, nil
}

// CreateServer creates a new isolated server directory and downloads the JAR.
func CreateServer(payload CreateServerPayload) (*ServerInstance, error) {
	if !payload.AgreeEula {
		return nil, fmt.Errorf("you must agree to the Minecraft EULA to create a server")
	}

	safeName := strings.ToLower(payload.Name)
	safeName = strings.ReplaceAll(safeName, " ", "-")
	
	var sb strings.Builder
	for _, r := range safeName {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			sb.WriteRune(r)
		}
	}
	id := fmt.Sprintf("%s-%d", sb.String(), time.Now().Unix()%100000)

	serverDir := filepath.Join(utils.GetServerRoot(), id)
	if err := utils.EnsureDir(serverDir); err != nil {
		return nil, err
	}

	reqJava := utils.GetRequiredJavaVersion(payload.Version)
	javaPath := "java"
	if jPath, found := utils.FindJavaVersion(reqJava); found {
		javaPath = jPath
	} else {
		javas := utils.FindJavaInstallations()
		if len(javas) > 0 {
			javaPath = javas[0].Path
		}
	}

	setStatus(id, "installing")

	port := 25565
	servers, _ := ListServers()
	usedPorts := make(map[int]bool)
	for _, s := range servers {
		usedPorts[s.Port] = true
	}
	for usedPorts[port] {
		port++
	}

	inst := &ServerInstance{
		ID:         id,
		Name:       payload.Name,
		Version:    payload.Version,
		Type:       ServerType(payload.Type),
		Path:       serverDir,
		Status:     "installing",
		JavaPath:   javaPath,
		MemoryMB:   payload.MemoryMB,
		World:      "world",
		IPAddress:  "127.0.0.1",
		Port:       port,
		Watchdog:   false,
		BackupPath: payload.BackupPath,
	}

	if err := SaveServer(inst); err != nil {
		os.RemoveAll(serverDir)
		setStatus(id, "offline")
		return nil, err
	}

	go func() {
		launcher.WriteLog(id, "[MACE] Starting server installation...")
		err := downloader.InstallServer(id, payload.Type, payload.Version, serverDir, javaPath)
		if err != nil {
			launcher.WriteLog(id, "[MACE] Installation failed: " + err.Error())
			setStatus(id, "offline")
			return
		}

		props := fmt.Sprintf("server-port=%d\nquery.port=%d\nmotd=MACE Server: %s\ndifficulty=easy\npvp=true\nmax-players=20\nonline-mode=true\n", port, port, payload.Name)
		os.WriteFile(filepath.Join(serverDir, "server.properties"), []byte(props), 0644)

		os.WriteFile(filepath.Join(serverDir, "eula.txt"), []byte("eula=true\n"), 0644)

		EnsureContentDirs(serverDir)

		launcher.WriteLog(id, "[MACE] Installation complete!")
		setStatus(id, "offline")
	}()

	return inst, nil
}

// ImportServer registers an external server directory as a managed instance.
func ImportServer(payload ImportServerPayload) (*ServerInstance, error) {
	absPath, err := filepath.Abs(payload.Path)
	if err != nil {
		return nil, fmt.Errorf("invalid path: %v", err)
	}

	info, err := os.Stat(absPath)
	if err != nil || !info.IsDir() {
		return nil, fmt.Errorf("invalid directory: %s", absPath)
	}

	files, err := os.ReadDir(absPath)
	if err != nil {
		return nil, err
	}

	var isValidJar bool
	var hasRunScript bool
	var detectedType ServerType = Vanilla
	var matchedJarName string

	for _, f := range files {
		name := strings.ToLower(f.Name())

		if name == "run.bat" || name == "run.sh" || name == "start.bat" || name == "start.sh" {
			hasRunScript = true
			content, _ := os.ReadFile(filepath.Join(absPath, f.Name()))
			if strings.Contains(strings.ToLower(string(content)), "neoforge") {
				detectedType = NeoForge
			} else if strings.Contains(strings.ToLower(string(content)), "forge") {
				detectedType = Forge
			}
		} else if strings.HasPrefix(name, "quilt-server") {
			detectedType = Quilt
			if strings.HasSuffix(name, ".jar") && isMinecraftJar(filepath.Join(absPath, f.Name())) {
				isValidJar = true
				matchedJarName = f.Name()
			}
		} else if strings.HasPrefix(name, "fabric-server") || name == ".fabric" {
			detectedType = Fabric
			if strings.HasSuffix(name, ".jar") && isMinecraftJar(filepath.Join(absPath, f.Name())) {
				isValidJar = true
				matchedJarName = f.Name()
			}
		} else if strings.HasPrefix(name, "paper") || strings.HasPrefix(name, "patched") {
			detectedType = Paper
			if strings.HasSuffix(name, ".jar") && isMinecraftJar(filepath.Join(absPath, f.Name())) {
				isValidJar = true
				matchedJarName = f.Name()
			}
		} else if strings.HasPrefix(name, "spigot") {
			detectedType = Spigot
			if strings.HasSuffix(name, ".jar") && isMinecraftJar(filepath.Join(absPath, f.Name())) {
				isValidJar = true
				matchedJarName = f.Name()
			}
		} else if name == "server.jar" || strings.HasSuffix(name, ".jar") {
			if isMinecraftJar(filepath.Join(absPath, f.Name())) {
				isValidJar = true
				matchedJarName = f.Name()
				if detectedType == Vanilla && strings.Contains(name, "forge") {
					detectedType = Forge
				}
			}
		}
	}

	if !isValidJar && !hasRunScript {
		return nil, fmt.Errorf("no valid minecraft server jars or run scripts found in directory")
	}

	if matchedJarName == "" {
		for _, f := range files {
			if strings.HasSuffix(strings.ToLower(f.Name()), ".jar") {
				path := filepath.Join(absPath, f.Name())
				if isMinecraftJar(path) {
					matchedJarName = f.Name()
					break
				}
			}
		}
	}

	detectedVersion := "1.20.4"
	if matchedJarName != "" {
		if ver := detectMinecraftVersion(filepath.Join(absPath, matchedJarName)); ver != "" {
			detectedVersion = ver
		}
	}

	if !utils.FileExists(filepath.Join(absPath, "eula.txt")) {
		os.WriteFile(filepath.Join(absPath, "eula.txt"), []byte("eula=true\n"), 0644)
	}

	EnsureContentDirs(absPath)

	name := payload.Name
	if name == "" {
		name = filepath.Base(absPath)
	}

	safeName := strings.ToLower(name)
	safeName = strings.ReplaceAll(safeName, " ", "-")
	var sb strings.Builder
	for _, r := range safeName {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			sb.WriteRune(r)
		}
	}
	id := fmt.Sprintf("%s-import-%d", sb.String(), time.Now().Unix()%100000)

	reqJava := utils.GetRequiredJavaVersion(detectedVersion)
	javaPath := "java"
	if jPath, found := utils.FindJavaVersion(reqJava); found {
		javaPath = jPath
	} else {
		javas := utils.FindJavaInstallations()
		if len(javas) > 0 {
			javaPath = javas[0].Path
		}
	}

	port := 25565
	propsFile := filepath.Join(absPath, "server.properties")
	if utils.FileExists(propsFile) {
		if content, err := os.ReadFile(propsFile); err == nil {
			lines := strings.Split(string(content), "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if strings.HasPrefix(line, "server-port=") {
					fmt.Sscanf(line, "server-port=%d", &port)
				}
				if strings.HasPrefix(line, "motd=") && payload.Name == "" {
					name = strings.TrimPrefix(line, "motd=")
				}
			}
		}
	}

	inst := &ServerInstance{
		ID:        id,
		Name:      name,
		Version:   detectedVersion,
		Type:      detectedType,
		Path:      absPath,
		Status:    "offline",
		JavaPath:  javaPath,
		MemoryMB:  2048,
		World:     "world",
		IPAddress: "127.0.0.1",
		Port:      port,
		Watchdog:  false,
	}

	if err := SaveServer(inst); err != nil {
		return nil, err
	}

	return inst, nil
}

// StartServer handles starting a server instance process.
func StartServer(id string) (string, error) {
	inst, err := LoadServer(id)
	if err != nil {
		return "", err
	}

	reqJava := utils.GetRequiredJavaVersion(inst.Version)

	javaExists := false
	if _, err := os.Stat(inst.JavaPath); err == nil {
		javaExists = true
	} else if inst.JavaPath == "java" {
		if _, err := exec.LookPath("java"); err == nil {
			javaExists = true
		}
	}

	currentVerStr := utils.GetJavaVersion(inst.JavaPath)
	currentVer := utils.ParseMajorJavaVersion(currentVerStr)

	if !javaExists || currentVer < reqJava {
		if alignedPath, found := utils.FindJavaVersion(reqJava); found {
			inst.JavaPath = alignedPath
			SaveServer(inst)
			launcher.WriteLog(id, fmt.Sprintf("[MACE] Auto-aligned server Java runtime to Java %d: %s", reqJava, alignedPath))
		} else {
			if !javaExists {
				javas := utils.FindJavaInstallations()
				if len(javas) > 0 && javas[0].Path != "java" {
					inst.JavaPath = javas[0].Path
					SaveServer(inst)
					launcher.WriteLog(id, fmt.Sprintf("[MACE] Configured Java path not found. Fell back to highest available Java: %s", inst.JavaPath))
				} else {
					return "", fmt.Errorf("configured Java path %q does not exist and no Java installation was found on the system", inst.JavaPath)
				}
			} else if currentVer == 0 {
				launcher.WriteLog(id, fmt.Sprintf("[MACE] Warning: Could not verify Java version for path %q. Proceeding...", inst.JavaPath))
			} else {
				return "", fmt.Errorf("this server requires Java %d+, but is configured to use Java %d (%s) and no compatible Java was found on the system", reqJava, currentVer, currentVerStr)
			}
		}
	}

	statusCallback := func(instanceID string, status string) {
		setStatus(instanceID, status)
	}

	setStatus(id, "starting")
	state, err := launcher.StartServer(inst.ID, inst.Path, inst.JavaPath, inst.MemoryMB, inst.Watchdog, inst.PlayitEnabled, inst.JvmArgs, statusCallback, CrashCallback)
	if err != nil {
		setStatus(id, "offline")
		return "", err
	}

	setStatus(id, "online")
	return state, nil
}

// StopServer requests the server process to exit.
func StopServer(id string) (string, error) {
	setStatus(id, "stopping")
	state, err := launcher.StopServer(id)
	if err != nil {
		return "", err
	}
	return state, nil
}

// KillServer forcefully terminates the server process.
func KillServer(id string) (string, error) {
	setStatus(id, "stopping")
	state, err := launcher.KillServer(id)
	if err != nil {
		return "", err
	}
	return state, nil
}

// GetConsoleLogs retrieves buffered logs.
func GetConsoleLogs(id string) ([]string, error) {
	return launcher.GetLogs(id), nil
}

// SendCommand writes a command to the server stdin.
func SendCommand(id string, cmd string) error {
	return launcher.WriteCommand(id, cmd)
}

// GetServerProperties reads raw server.properties contents.
func GetServerProperties(id string) (string, error) {
	inst, err := LoadServer(id)
	if err != nil {
		return "", err
	}

	propsFile := filepath.Join(inst.Path, "server.properties")
	if !utils.FileExists(propsFile) {
		return "", nil
	}

	data, err := os.ReadFile(propsFile)
	return string(data), err
}

// UpdateServerConfig saves updated configuration.
func UpdateServerConfig(payload UpdateConfigPayload) error {
	inst, err := LoadServer(payload.ID)
	if err != nil {
		return err
	}

	inst.Name = payload.Name
	inst.JavaPath = payload.JavaPath
	inst.MemoryMB = payload.MemoryMB
	inst.Port = payload.Port
	inst.Watchdog = payload.Watchdog
	inst.BackupPath = payload.BackupPath
	inst.PlayitEnabled = payload.PlayitEnabled
	inst.JvmArgs = payload.JvmArgs
	inst.BackupSchedule = payload.BackupSchedule
	inst.BackupRetention = payload.BackupRetention
	inst.BackupIncludeWorld = payload.BackupIncludeWorld
	inst.BackupIncludePlugins = payload.BackupIncludePlugins
	inst.BackupIncludeConfigs = payload.BackupIncludeConfigs
	if payload.Version != "" {
		inst.Version = payload.Version
	}
	if payload.Type != "" {
		inst.Type = ServerType(payload.Type)
	}

	propsFile := filepath.Join(inst.Path, "server.properties")
	if payload.RawProps != "" {
		if err := os.WriteFile(propsFile, []byte(payload.RawProps), 0644); err != nil {
			return err
		}
	}

	return SaveServer(inst)
}

// DeleteServer kills the process and deletes the server directory.
func DeleteServer(id string) error {
	inst, err := LoadServer(id)
	if err != nil {
		return err
	}

	if launcher.IsRunning(id) {
		launcher.KillServer(id)
		time.Sleep(500 * time.Millisecond)
	}

	managedPath := filepath.Clean(filepath.Join(utils.GetServerRoot(), id))
	if filepath.Clean(inst.Path) == managedPath {
		return os.RemoveAll(inst.Path)
	}
	
	return os.RemoveAll(managedPath)
}

// DetectJava searches for system java paths.
func DetectJava() ([]utils.JavaInstall, error) {
	return utils.FindJavaInstallations(), nil
}

func SubscribeLogs(id string) chan string {
	return launcher.SubscribeLogs(id)
}

func UnsubscribeLogs(id string, ch chan string) {
	launcher.UnsubscribeLogs(id, ch)
}

var (
	versionsCache     map[string][]string
	versionsCacheMu   sync.Mutex
	versionsCacheTime time.Time
)

// GetAvailableVersions aggregates available versions for all loaders in parallel, with in-memory caching and resilient error handling.
func GetAvailableVersions() (map[string][]string, error) {
	versionsCacheMu.Lock()
	defer versionsCacheMu.Unlock()

	if versionsCache != nil && time.Since(versionsCacheTime) < 1*time.Hour {
		return versionsCache, nil
	}

	type res struct {
		loader string
		vers   []string
		err    error
	}

	ch := make(chan res, 6)

	go func() {
		v, err := downloader.FetchVanillaVersions()
		ch <- res{"vanilla", v, err}
	}()
	go func() {
		v, err := downloader.FetchPaperVersions()
		ch <- res{"paper", v, err}
	}()
	go func() {
		v, err := downloader.FetchFabricVersions()
		ch <- res{"fabric", v, err}
	}()
	go func() {
		v, err := downloader.FetchQuiltVersions()
		ch <- res{"quilt", v, err}
	}()
	go func() {
		v, err := downloader.FetchForgeVersions()
		ch <- res{"forge", v, err}
	}()
	go func() {
		v, err := downloader.FetchNeoForgeVersions()
		ch <- res{"neoforge", v, err}
	}()

	results := make(map[string][]string)
	var firstErr error

	for i := 0; i < 6; i++ {
		r := <-ch
		if r.err != nil {
			if firstErr == nil {
				firstErr = r.err
			}
			results[r.loader] = []string{}
		} else {
			results[r.loader] = r.vers
		}
	}

	if firstErr != nil {
		if versionsCache != nil {
			versionsCacheTime = time.Now()
			return versionsCache, nil
		}
		if len(results["vanilla"]) == 0 {
			return nil, fmt.Errorf("failed to fetch versions: %w", firstErr)
		}
	}

	versionsCache = results
	versionsCacheTime = time.Now()

	return results, nil
}

// GetServerResources returns live resource usage for a running server.
func GetServerResources(id string) (*launcher.ResourceUsage, error) {
	return launcher.GetResourceUsage(id)
}


// isMinecraftJar performs a lightweight scan of a JAR file to confirm it's a Minecraft server JAR.
func isMinecraftJar(jarPath string) bool {
	r, err := zip.OpenReader(jarPath)
	if err != nil {
		return false
	}
	defer r.Close()

	for _, f := range r.File {
		if f.Name == "META-INF/MANIFEST.MF" {
			rc, err := f.Open()
			if err == nil {
				content, _ := io.ReadAll(rc)
				rc.Close()
				s := string(content)
				if strings.Contains(s, "net.minecraft.server.Main") ||
					strings.Contains(s, "org.bukkit.craftbukkit.Main") ||
					strings.Contains(s, "io.papermc.paperclip.Main") ||
					strings.Contains(s, "net.fabricmc.loader.impl.launch.server.FabricServerLauncher") ||
					strings.Contains(s, "org.quiltmc.loader.impl.launch.server.QuiltServerLauncher") ||
					strings.Contains(s, "cpw.mods.bootstraplauncher.BootstrapLauncher") {
					return true
				}
			}
		}
		if strings.HasPrefix(f.Name, "net/minecraft/server/") {
			return true
		}
	}
	return false
}

// detectMinecraftVersion tries to extract the Minecraft version from a JAR file name or its internal version files.
func detectMinecraftVersion(jarPath string) string {
	baseName := filepath.Base(jarPath)
	re := regexp.MustCompile(`1\.\d{1,2}(?:\.\d{1,2})?`)
	if match := re.FindString(baseName); match != "" {
		return match
	}

	r, err := zip.OpenReader(jarPath)
	if err != nil {
		return ""
	}
	defer r.Close()

	for _, f := range r.File {
		if f.Name == "version.json" {
			rc, err := f.Open()
			if err == nil {
				defer rc.Close()
				var vData struct {
					ID   string `json:"id"`
					Name string `json:"name"`
				}
				if err := json.NewDecoder(rc).Decode(&vData); err == nil {
					if vData.ID != "" {
						return vData.ID
					}
					if vData.Name != "" {
						return vData.Name
					}
				}
			}
		}
		if strings.HasSuffix(f.Name, "patch.properties") {
			rc, err := f.Open()
			if err == nil {
				defer rc.Close()
				content, _ := io.ReadAll(rc)
				for _, line := range strings.Split(string(content), "\n") {
					line = strings.TrimSpace(line)
					if strings.HasPrefix(line, "version=") {
						return strings.TrimSpace(strings.TrimPrefix(line, "version="))
					}
				}
			}
		}
	}
	return ""
}
