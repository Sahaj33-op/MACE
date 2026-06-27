package servermanager

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// contentDir returns the folder path for a given content type within a server directory.
// contentType must be "mod" or "plugin".
func contentDir(serverPath, contentType string) string {
	switch contentType {
	case "plugin":
		return filepath.Join(serverPath, "plugins")
	default:
		return filepath.Join(serverPath, "mods")
	}
}

// EnsureContentDirs creates mods/ and plugins/ inside a server directory if absent.
func EnsureContentDirs(serverPath string) {
	os.MkdirAll(filepath.Join(serverPath, "mods"), 0755)
	os.MkdirAll(filepath.Join(serverPath, "plugins"), 0755)
}

// ListContent lists all mod or plugin JARs in a server's content directory.
func ListContent(id, contentType string) ([]ContentItem, error) {
	inst, err := LoadServer(id)
	if err != nil {
		return nil, err
	}

	dir := contentDir(inst.Path, contentType)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var items []ContentItem
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		lower := strings.ToLower(name)

		var enabled bool
		var displayName string
		if strings.HasSuffix(lower, ".jar") {
			enabled = true
			displayName = name
		} else if strings.HasSuffix(lower, ".jar.disabled") {
			enabled = false
			displayName = name[:len(name)-len(".disabled")]
		} else {
			continue
		}

		info, _ := e.Info()
		sizeKB := int64(0)
		if info != nil {
			sizeKB = info.Size() / 1024
		}

		items = append(items, ContentItem{
			Name:     displayName,
			FileName: name,
			Enabled:  enabled,
			SizeKB:   sizeKB,
			Type:     contentType,
		})
	}

	if items == nil {
		items = []ContentItem{}
	}
	return items, nil
}

// AddContent copies a JAR from srcPath into the server's content directory after validation.
func AddContent(id, srcPath, contentType string) (*ContentItem, error) {
	inst, err := LoadServer(id)
	if err != nil {
		return nil, err
	}

	if !strings.HasSuffix(strings.ToLower(srcPath), ".jar") {
		return nil, fmt.Errorf("only .jar files are supported")
	}

	if err := validateContentJar(srcPath, inst, contentType); err != nil {
		return nil, err
	}

	dir := contentDir(inst.Path, contentType)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}

	baseName := filepath.Base(srcPath)
	destPath := filepath.Join(dir, baseName)

	if err := copyFile(srcPath, destPath); err != nil {
		return nil, err
	}

	info, _ := os.Stat(destPath)
	sizeKB := int64(0)
	if info != nil {
		sizeKB = info.Size() / 1024
	}

	return &ContentItem{
		Name:     baseName,
		FileName: baseName,
		Enabled:  true,
		SizeKB:   sizeKB,
		Type:     contentType,
	}, nil
}

// RemoveContent deletes a mod/plugin by its stored filename (may be .jar or .jar.disabled).
func RemoveContent(id, fileName, contentType string) error {
	inst, err := LoadServer(id)
	if err != nil {
		return err
	}

	dir := contentDir(inst.Path, contentType)
	target := filepath.Join(dir, fileName)

	if !strings.HasPrefix(filepath.Clean(target), filepath.Clean(dir)) {
		return fmt.Errorf("invalid file path")
	}

	if err := os.Remove(target); err != nil {
		alt := target + ".disabled"
		if strings.HasSuffix(target, ".disabled") {
			alt = target[:len(target)-len(".disabled")]
		}
		if err2 := os.Remove(alt); err2 != nil {
			return err // return original error
		}
	}
	return nil
}

// ToggleContent enables or disables a content item by renaming between .jar and .jar.disabled.
func ToggleContent(id, fileName, contentType string, enabled bool) error {
	inst, err := LoadServer(id)
	if err != nil {
		return err
	}

	dir := contentDir(inst.Path, contentType)

	if enabled {
		src := filepath.Join(dir, fileName)
		if !strings.HasSuffix(src, ".disabled") {
			src = src + ".disabled"
		}
		dst := strings.TrimSuffix(src, ".disabled")
		return os.Rename(src, dst)
	}

	src := filepath.Join(dir, fileName)
	if strings.HasSuffix(src, ".disabled") {
		src = strings.TrimSuffix(src, ".disabled")
	}
	dst := src + ".disabled"
	return os.Rename(src, dst)
}

// DownloadAndInstallMod downloads a mod from a direct URL and installs it into the server.
func DownloadAndInstallMod(id, downloadURL, fileName, contentType string) (*ContentItem, error) {
	inst, err := LoadServer(id)
	if err != nil {
		return nil, err
	}

	dir := contentDir(inst.Path, contentType)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}

	destPath := filepath.Join(dir, fileName)

	resp, err := http.Get(downloadURL)
	if err != nil {
		return nil, fmt.Errorf("download failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download failed: HTTP %s", resp.Status)
	}

	f, err := os.Create(destPath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	if _, err := io.Copy(f, resp.Body); err != nil {
		os.Remove(destPath)
		return nil, err
	}

	info, _ := os.Stat(destPath)
	sizeKB := int64(0)
	if info != nil {
		sizeKB = info.Size() / 1024
	}

	return &ContentItem{
		Name:     fileName,
		FileName: fileName,
		Enabled:  true,
		SizeKB:   sizeKB,
		Type:     contentType,
	}, nil
}

// ApplyModpack extracts a modpack zip/mrpack and records the pack metadata.
// Supports Modrinth format (modrinth.index.json) and generic zip overrides.
func ApplyModpack(id, zipPath string) (*ModpackMeta, error) {
	inst, err := LoadServer(id)
	if err != nil {
		return nil, err
	}

	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, fmt.Errorf("cannot open modpack: %v", err)
	}
	defer r.Close()

	meta := &ModpackMeta{
		Name:    strings.TrimSuffix(filepath.Base(zipPath), filepath.Ext(zipPath)),
		Version: "unknown",
		Source:  "local",
	}

	if isModrinthPack(r) {
		m, err := applyModrinthPack(r, inst.Path, inst)
		if err != nil {
			return nil, err
		}
		meta = m
	} else {
		if err := extractGenericPack(r, inst.Path); err != nil {
			return nil, err
		}
	}

	inst.Modpack = meta
	if err := SaveServer(inst); err != nil {
		return nil, err
	}

	return meta, nil
}



func isModrinthPack(r *zip.ReadCloser) bool {
	for _, f := range r.File {
		if f.Name == "modrinth.index.json" {
			return true
		}
	}
	return false
}

type modrinthIndex struct {
	Name         string `json:"name"`
	VersionID    string `json:"versionId"`
	Dependencies map[string]string `json:"dependencies"`
	Files        []struct {
		Path      string            `json:"path"`
		Downloads []string          `json:"downloads"`
		Env       map[string]string `json:"env,omitempty"`
	} `json:"files"`
}

func applyModrinthPack(r *zip.ReadCloser, serverPath string, inst *ServerInstance) (*ModpackMeta, error) {
	var index modrinthIndex
	for _, f := range r.File {
		if f.Name == "modrinth.index.json" {
			rc, err := f.Open()
			if err != nil {
				return nil, err
			}
			err = json.NewDecoder(rc).Decode(&index)
			rc.Close()
			if err != nil {
				return nil, fmt.Errorf("invalid modrinth.index.json: %v", err)
			}
			break
		}
	}

	modsDir := filepath.Join(serverPath, "mods")
	os.MkdirAll(modsDir, 0755)

	for _, file := range index.Files {
		if env, ok := file.Env["server"]; ok && env == "unsupported" {
			continue
		}
		if len(file.Downloads) == 0 {
			continue
		}
		destPath := filepath.Join(serverPath, filepath.FromSlash(file.Path))
		if !strings.HasPrefix(filepath.Clean(destPath), filepath.Clean(serverPath)+string(os.PathSeparator)) {
			return nil, fmt.Errorf("zip-slip attempt detected in file path: %s", file.Path)
		}
		os.MkdirAll(filepath.Dir(destPath), 0755)

		if err := downloadFile(file.Downloads[0], destPath); err != nil {
			continue
		}
	}

	for _, f := range r.File {
		if !strings.HasPrefix(f.Name, "overrides/") || f.FileInfo().IsDir() {
			continue
		}
		rel := strings.TrimPrefix(f.Name, "overrides/")
		dest := filepath.Join(serverPath, filepath.FromSlash(rel))
		if !strings.HasPrefix(filepath.Clean(dest), filepath.Clean(serverPath)+string(os.PathSeparator)) {
			return nil, fmt.Errorf("zip-slip attempt detected in overrides: %s", f.Name)
		}
		os.MkdirAll(filepath.Dir(dest), 0755)

		rc, err := f.Open()
		if err != nil {
			continue
		}
		out, err := os.Create(dest)
		if err != nil {
			rc.Close()
			continue
		}
		io.Copy(out, rc)
		out.Close()
		rc.Close()
	}

	return &ModpackMeta{
		Name:    index.Name,
		Version: index.VersionID,
		Source:  "modrinth",
	}, nil
}

func extractGenericPack(r *zip.ReadCloser, serverPath string) error {
	for _, f := range r.File {
		if f.FileInfo().IsDir() {
			continue
		}
		dest := filepath.Join(serverPath, filepath.FromSlash(f.Name))
		if !strings.HasPrefix(filepath.Clean(dest), filepath.Clean(serverPath)+string(os.PathSeparator)) {
			continue
		}
		os.MkdirAll(filepath.Dir(dest), 0755)
		rc, err := f.Open()
		if err != nil {
			continue
		}
		out, err := os.Create(dest)
		if err != nil {
			rc.Close()
			continue
		}
		io.Copy(out, rc)
		out.Close()
		rc.Close()
	}
	return nil
}

func downloadFile(url, destPath string) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	f, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, resp.Body)
	return err
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

// validateContentJar confirms the JAR is appropriate for the server's loader type.
func validateContentJar(jarPath string, inst *ServerInstance, contentType string) error {
	r, err := zip.OpenReader(jarPath)
	if err != nil {
		return fmt.Errorf("cannot read jar: %v", err)
	}
	defer r.Close()

	fileSet := make(map[string]bool)
	for _, f := range r.File {
		fileSet[f.Name] = true
	}

	switch contentType {
	case "plugin":
		if fileSet["plugin.yml"] || fileSet["bungee.yml"] || fileSet["paper-plugin.yml"] {
			return nil
		}
		return fmt.Errorf("not a valid plugin jar (missing plugin.yml)")

	case "mod":
		switch inst.Type {
		case Fabric, Quilt:
			if fileSet["fabric.mod.json"] || fileSet["quilt.mod.json"] {
				return nil
			}
			return fmt.Errorf("not a valid %s mod jar (missing fabric.mod.json)", inst.Type)
		case Forge, NeoForge:
			if fileSet["META-INF/mods.toml"] || fileSet["mcmod.info"] || fileSet["META-INF/neoforge.mods.toml"] {
				return nil
			}
			return fmt.Errorf("not a valid %s mod jar (missing META-INF/mods.toml)", inst.Type)
		default:
			return fmt.Errorf("server type %s does not support mods", inst.Type)
		}
	}

	return fmt.Errorf("unknown content type: %s", contentType)
}
