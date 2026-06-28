package servermanager

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"mace/backend/pkg/downloader"
	"mace/backend/pkg/launcher"
)

// ProvisionGeyser installs or removes Geyser and Floodgate binaries based on config toggle.
func ProvisionGeyser(inst *ServerInstance) error {
	if !inst.GeyserEnabled {
		removeGeyserJars(inst.Path)
		return nil
	}

	// Determine directories
	var destDir string
	var platform string
	serverTypeLower := strings.ToLower(string(inst.Type))
	switch serverTypeLower {
	case "spigot", "paper":
		destDir = filepath.Join(inst.Path, "plugins")
		platform = "spigot"
	case "fabric", "quilt":
		destDir = filepath.Join(inst.Path, "mods")
		platform = "fabric"
	case "forge", "neoforge":
		destDir = filepath.Join(inst.Path, "mods")
		platform = "forge"
	default:
		return fmt.Errorf("server type %q does not support Geyser plugins/mods", inst.Type)
	}

	geyserJarName := fmt.Sprintf("Geyser-%s.jar", strings.Title(platform))
	floodgateJarName := fmt.Sprintf("floodgate-%s.jar", platform)

	geyserPath := filepath.Join(destDir, geyserJarName)
	floodgatePath := filepath.Join(destDir, floodgateJarName)

	if err := os.MkdirAll(destDir, 0755); err != nil {
		return err
	}

	// Download Geyser if missing
	if _, err := os.Stat(geyserPath); os.IsNotExist(err) {
		geyserURL := fmt.Sprintf("https://download.geysermc.org/v2/projects/geyser/versions/latest/builds/latest/downloads/%s", platform)
		launcher.WriteLog(inst.ID, fmt.Sprintf("[MACE] Downloading Geyser for %s...", inst.Type))
		if err := downloader.DownloadJar(inst.ID, geyserURL, geyserPath); err != nil {
			return fmt.Errorf("failed to download Geyser: %w", err)
		}
	}

	// Download Floodgate if missing (only for platform supported)
	if _, err := os.Stat(floodgatePath); os.IsNotExist(err) {
		floodgateURL := fmt.Sprintf("https://download.geysermc.org/v2/projects/floodgate/versions/latest/builds/latest/downloads/%s", platform)
		launcher.WriteLog(inst.ID, fmt.Sprintf("[MACE] Downloading Floodgate for %s...", inst.Type))
		if err := downloader.DownloadJar(inst.ID, floodgateURL, floodgatePath); err != nil {
			launcher.WriteLog(inst.ID, fmt.Sprintf("[MACE] Warning: Failed to download Floodgate: %v", err))
		}
	}

	PatchGeyserConfigPort(inst)

	return nil
}

func removeGeyserJars(serverPath string) {
	dirs := []string{filepath.Join(serverPath, "plugins"), filepath.Join(serverPath, "mods")}
	for _, dir := range dirs {
		if files, err := os.ReadDir(dir); err == nil {
			for _, f := range files {
				name := strings.ToLower(f.Name())
				if (strings.Contains(name, "geyser") || strings.Contains(name, "floodgate")) && strings.HasSuffix(name, ".jar") {
					os.Remove(filepath.Join(dir, f.Name()))
				}
			}
		}
	}
}

// PatchGeyserConfigPort scans known directories for Geyser config.yml and updates the Bedrock listener port.
func PatchGeyserConfigPort(inst *ServerInstance) {
	possiblePaths := []string{
		filepath.Join(inst.Path, "plugins", "Geyser-Spigot", "config.yml"),
		filepath.Join(inst.Path, "config", "Geyser-Fabric", "config.yml"),
		filepath.Join(inst.Path, "config", "Geyser-Forge", "config.yml"),
		filepath.Join(inst.Path, "config", "Geyser-Standalone", "config.yml"),
	}

	targetPort := inst.GeyserPort
	if targetPort == 0 {
		targetPort = 19132
	}

	for _, path := range possiblePaths {
		if _, err := os.Stat(path); err == nil {
			content, err := os.ReadFile(path)
			if err != nil {
				continue
			}

			lines := strings.Split(string(content), "\n")
			inBedrockSection := false
			modified := false

			for i, line := range lines {
				trimmed := strings.TrimSpace(line)
				if trimmed == "bedrock:" {
					inBedrockSection = true
					continue
				}

				if inBedrockSection && len(line) > 0 && !strings.HasPrefix(line, " ") && !strings.HasPrefix(line, "\t") {
					inBedrockSection = false
				}

				if inBedrockSection && strings.HasPrefix(trimmed, "port:") {
					idx := strings.Index(line, "port:")
					if idx != -1 {
						indent := line[:idx]
						lines[i] = fmt.Sprintf("%sport: %d", indent, targetPort)
						modified = true
						break
					}
				}
			}

			if modified {
				os.WriteFile(path, []byte(strings.Join(lines, "\n")), 0644)
			}
		}
	}
}
