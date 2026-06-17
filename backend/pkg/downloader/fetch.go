package downloader

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"mace/backend/pkg/launcher"
	"mace/backend/pkg/utils"
)

// progressWriter tracks download progress and logs it.
type progressWriter struct {
	id       string
	fileName string
	total    int64
	written  int64
	lastLog  time.Time
}

func (pw *progressWriter) Write(p []byte) (int, error) {
	n := len(p)
	pw.written += int64(n)
	if pw.total > 0 && time.Since(pw.lastLog) > 500*time.Millisecond {
		percent := float64(pw.written) / float64(pw.total) * 100
		launcher.WriteLog(pw.id, fmt.Sprintf("[MACE] Downloading %s: %.1f%% (%d / %d bytes)", pw.fileName, percent, pw.written, pw.total))
		pw.lastLog = time.Now()
	}
	return n, nil
}

// logWriter pipes command output to the launcher console.
type logWriter struct {
	id string
}

func (lw *logWriter) Write(p []byte) (int, error) {
	launcher.WriteLog(lw.id, string(p))
	return len(p), nil
}

// DownloadJar downloads a URL and writes it to the output file path.
func DownloadJar(id string, url string, output string) error {
	if err := utils.EnsureDir(filepath.Dir(output)); err != nil {
		return err
	}

	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bad status: %s", resp.Status)
	}

	f, err := os.Create(output)
	if err != nil {
		return err
	}
	defer f.Close()

	pw := &progressWriter{
		id:       id,
		fileName: filepath.Base(output),
		total:    resp.ContentLength,
		lastLog:  time.Now(),
	}

	launcher.WriteLog(id, fmt.Sprintf("[MACE] Starting download of %s...", pw.fileName))

	_, err = io.Copy(f, io.TeeReader(resp.Body, pw))
	if err == nil {
		launcher.WriteLog(id, fmt.Sprintf("[MACE] Download of %s finished.", pw.fileName))
	}
	return err
}

// InstallServer downloads and sets up the server JAR based on type.
func InstallServer(id string, serverType string, version string, installDir string, javaPath string) error {
	if err := utils.EnsureDir(installDir); err != nil {
		return err
	}

	tempDir := filepath.Join(installDir, "..", "..", "temp")
	if err := utils.EnsureDir(tempDir); err != nil {
		return err
	}

	switch serverType {
	case "vanilla":
		url, err := FetchVanillaURL(version)
		if err != nil {
			return err
		}
		jarPath := filepath.Join(installDir, "server.jar")
		return DownloadJar(id, url, jarPath)

	case "paper":
		url, err := FetchPaperURL(version)
		if err != nil {
			return err
		}
		jarPath := filepath.Join(installDir, "server.jar")
		return DownloadJar(id, url, jarPath)

	case "fabric":
		instVer, err := FetchLatestFabricInstaller()
		if err != nil {
			return err
		}
		instURL := fmt.Sprintf("https://maven.fabricmc.net/net/fabricmc/fabric-installer/%s/fabric-installer-%s.jar", instVer, instVer)
		installerJar := filepath.Join(tempDir, fmt.Sprintf("fabric-installer-%s.jar", instVer))
		
		if !utils.FileExists(installerJar) {
			if err := DownloadJar(id, instURL, installerJar); err != nil {
				return err
			}
		}

		cmd := exec.Command(javaPath, "-jar", installerJar, "server", "-mcversion", version, "-downloadMinecraft")
		utils.HideWindow(cmd)
		cmd.Dir = installDir
		lw := &logWriter{id: id}
		cmd.Stdout = lw
		cmd.Stderr = lw
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("fabric installer failed: %v", err)
		}

		propertiesContent := "serverJar=vanilla-server.jar\n"
		propPath := filepath.Join(installDir, "fabric-server-launcher.properties")
		if err := os.WriteFile(propPath, []byte(propertiesContent), 0644); err != nil {
			return err
		}

		oldServerJar := filepath.Join(installDir, "server.jar")
		newServerJar := filepath.Join(installDir, "vanilla-server.jar")
		if err := os.Rename(oldServerJar, newServerJar); err != nil {
			return err
		}

		fabricLaunchJar := filepath.Join(installDir, "fabric-server-launch.jar")
		return os.Rename(fabricLaunchJar, oldServerJar)

	case "quilt":
		instVer, err := FetchLatestQuiltInstaller()
		if err != nil {
			return err
		}
		instURL := fmt.Sprintf("https://maven.quiltmc.org/repository/release/org/quiltmc/quilt-installer/%s/quilt-installer-%s.jar", instVer, instVer)
		installerJar := filepath.Join(tempDir, fmt.Sprintf("quilt-installer-%s.jar", instVer))

		if !utils.FileExists(installerJar) {
			if err := DownloadJar(id, instURL, installerJar); err != nil {
				return err
			}
		}

		cmd := exec.Command(javaPath, "-jar", installerJar, "install", "server", version, "--download-server")
		utils.HideWindow(cmd)
		cmd.Dir = installDir
		lw := &logWriter{id: id}
		cmd.Stdout = lw
		cmd.Stderr = lw
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("quilt installer failed: %v", err)
		}

		propertiesContent := "serverJar=vanilla-server.jar\n"
		propPath := filepath.Join(installDir, "quilt-server-launcher.properties")
		if err := os.WriteFile(propPath, []byte(propertiesContent), 0644); err != nil {
			return err
		}

		oldServerJar := filepath.Join(installDir, "server.jar")
		newServerJar := filepath.Join(installDir, "vanilla-server.jar")
		if err := os.Rename(oldServerJar, newServerJar); err != nil {
			return err
		}

		quiltLaunchJar := filepath.Join(installDir, "quilt-server-launch.jar")
		return os.Rename(quiltLaunchJar, oldServerJar)

	case "forge":
		forgeVersion := getForgeVersionForMC(version)
		if forgeVersion == "" {
			return fmt.Errorf("unsupported forge version for minecraft %s", version)
		}

		instURL := fmt.Sprintf("https://maven.minecraftforge.net/net/minecraftforge/forge/%s-%s/forge-%s-%s-installer.jar", version, forgeVersion, version, forgeVersion)
		installerJar := filepath.Join(tempDir, fmt.Sprintf("forge-%s-%s-installer.jar", version, forgeVersion))

		if !utils.FileExists(installerJar) {
			if err := DownloadJar(id, instURL, installerJar); err != nil {
				return err
			}
		}

		cmd := exec.Command(javaPath, "-jar", installerJar, "--installServer")
		utils.HideWindow(cmd)
		cmd.Dir = installDir
		lw := &logWriter{id: id}
		cmd.Stdout = lw
		cmd.Stderr = lw
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("forge installer failed: %v", err)
		}

		files, _ := os.ReadDir(installDir)
		for _, f := range files {
			if !f.IsDir() && filepath.Ext(f.Name()) == ".jar" && filepath.Base(f.Name()) != "server.jar" {
				if filepath.HasPrefix(f.Name(), "forge-") {
					return os.Rename(filepath.Join(installDir, f.Name()), filepath.Join(installDir, "server.jar"))
				}
			}
		}
		return nil

	case "neoforge":
		neoforgeVersion, err := GetNeoForgeVersionForMC(version)
		if err != nil {
			return err
		}

		instURL := fmt.Sprintf("https://maven.neoforged.net/releases/net/neoforged/neoforge/%s/neoforge-%s-installer.jar", neoforgeVersion, neoforgeVersion)
		installerJar := filepath.Join(tempDir, fmt.Sprintf("neoforge-%s-installer.jar", neoforgeVersion))

		if !utils.FileExists(installerJar) {
			if err := DownloadJar(id, instURL, installerJar); err != nil {
				return err
			}
		}

		cmd := exec.Command(javaPath, "-jar", installerJar, "--installServer")
		utils.HideWindow(cmd)
		cmd.Dir = installDir
		lw := &logWriter{id: id}
		cmd.Stdout = lw
		cmd.Stderr = lw
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("neoforge installer failed: %v", err)
		}
		return nil

	default:
		return fmt.Errorf("unsupported server type: %s", serverType)
	}
}

// Helper to match Forge versions with MC versions.
func getForgeVersionForMC(mcVersion string) string {
	resp, err := httpClient.Get("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json")
	if err == nil {
		defer resp.Body.Close()
		var data struct {
			Promos map[string]string `json:"promos"`
		}
		if json.NewDecoder(resp.Body).Decode(&data) == nil {
			if ver, ok := data.Promos[mcVersion+"-recommended"]; ok {
				return ver
			}
			if ver, ok := data.Promos[mcVersion+"-latest"]; ok {
				return ver
			}
		}
	}

	mapping := map[string]string{
		"1.20.4": "49.0.22",
		"1.20.2": "48.0.30",
		"1.20.1": "47.2.0",
		"1.19.4": "45.1.0",
		"1.19.2": "43.2.0",
		"1.18.2": "40.2.0",
		"1.17.1": "37.1.1",
		"1.16.5": "36.2.39",
		"1.12.2": "14.23.5.2860",
	}
	if ver, ok := mapping[mcVersion]; ok {
		return ver
	}
	return "47.2.0" 
}
