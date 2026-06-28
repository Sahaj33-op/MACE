package servermanager

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"mace/backend/pkg/launcher"
	"mace/backend/pkg/utils"
)

// configFiles lists server configuration files that should be included in backups.
var configFiles = []string{
	"server.properties",
	"banned-players.json",
	"banned-ips.json",
	"ops.json",
	"whitelist.json",
}

// GetBackupDir returns the resolved backup directory for a server instance.
// If the user has configured a custom backup path, it is used; otherwise
// it falls back to <ServerPath>/backups.
func GetBackupDir(inst *ServerInstance) string {
	if inst.BackupPath != "" {
		return inst.BackupPath
	}
	return filepath.Join(inst.Path, "backups")
}

// CreateBackup compresses the world folder and configuration files into a
// timestamped zip archive inside the backup directory.
func CreateBackup(id string) (*BackupItem, error) {
	return CreateBackupWithOptions(id, true, false, true)
}

// CreateBackupWithOptions compresses selected components (world, plugins, configs) of a server.
func CreateBackupWithOptions(id string, includeWorld, includePlugins, includeConfigs bool) (*BackupItem, error) {
	inst, err := LoadServer(id)
	if err != nil {
		return nil, err
	}

	backupDir := GetBackupDir(inst)
	if err := utils.EnsureDir(backupDir); err != nil {
		return nil, fmt.Errorf("failed to create backup directory: %w", err)
	}

	timestamp := time.Now().Format("2006-01-02_15-04-05")
	zipName := fmt.Sprintf("backup_%s_%s.zip", inst.World, timestamp)
	zipPath := filepath.Join(backupDir, zipName)

	zipFile, err := os.Create(zipPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create backup file: %w", err)
	}
	defer zipFile.Close()

	w := zip.NewWriter(zipFile)
	defer w.Close()

	addDirToZip := func(srcDir string) error {
		if _, err := os.Stat(srcDir); os.IsNotExist(err) {
			return nil
		}
		return filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			relPath, err := filepath.Rel(inst.Path, path)
			if err != nil {
				return err
			}
			relPath = filepath.ToSlash(relPath)
			if info.IsDir() {
				_, err := w.Create(relPath + "/")
				return err
			}
			header, err := zip.FileInfoHeader(info)
			if err != nil {
				return err
			}
			header.Name = relPath
			header.Method = zip.Deflate

			writer, err := w.CreateHeader(header)
			if err != nil {
				return err
			}
			file, err := os.Open(path)
			if err != nil {
				return err
			}
			_, err = io.Copy(writer, file)
			closeErr := file.Close()
			if err != nil {
				return err
			}
			return closeErr
		})
	}

	if includeWorld {
		worldDir := filepath.Join(inst.Path, inst.World)
		if err := addDirToZip(worldDir); err != nil {
			os.Remove(zipPath)
			return nil, fmt.Errorf("failed to archive world: %w", err)
		}
	}

	if includePlugins {
		pluginsDir := filepath.Join(inst.Path, "plugins")
		if err := addDirToZip(pluginsDir); err != nil {
			os.Remove(zipPath)
			return nil, fmt.Errorf("failed to archive plugins: %w", err)
		}
		modsDir := filepath.Join(inst.Path, "mods")
		if err := addDirToZip(modsDir); err != nil {
			os.Remove(zipPath)
			return nil, fmt.Errorf("failed to archive mods: %w", err)
		}
	}

	if includeConfigs {
		for _, cfgName := range configFiles {
			cfgPath := filepath.Join(inst.Path, cfgName)
			if !utils.FileExists(cfgPath) {
				continue
			}
			info, err := os.Stat(cfgPath)
			if err != nil {
				continue
			}
			header, err := zip.FileInfoHeader(info)
			if err != nil {
				continue
			}
			header.Name = cfgName
			header.Method = zip.Deflate

			writer, err := w.CreateHeader(header)
			if err != nil {
				continue
			}
			file, err := os.Open(cfgPath)
			if err != nil {
				continue
			}
			if _, err := io.Copy(writer, file); err != nil {
				launcher.WriteLog(id, fmt.Sprintf("[MACE] Warning: Failed to archive config file %s: %v", cfgName, err))
			}
			file.Close()
		}
	}

	w.Close()
	zipFile.Close()

	stat, err := os.Stat(zipPath)
	if err != nil {
		return nil, err
	}

	launcher.WriteLog(id, fmt.Sprintf("[MACE] Backup created: %s (%.1f MB)", zipName, float64(stat.Size())/(1024*1024)))

	return &BackupItem{
		FileName:  zipName,
		SizeKB:    stat.Size() / 1024,
		CreatedAt: time.Now().Format(time.RFC3339),
	}, nil
}

// EnforceBackupRetention prunes backups in the server's backup directory until the count is <= limit.
func EnforceBackupRetention(id string, limit int) error {
	if limit <= 0 {
		return nil
	}

	backups, err := ListBackups(id)
	if err != nil {
		return err
	}

	if len(backups) <= limit {
		return nil
	}

	inst, err := LoadServer(id)
	if err != nil {
		return err
	}
	backupDir := GetBackupDir(inst)

	for i := limit; i < len(backups); i++ {
		fileToDelete := filepath.Join(backupDir, backups[i].FileName)
		if err := os.Remove(fileToDelete); err != nil {
			launcher.WriteLog(id, fmt.Sprintf("[MACE] Warning: Failed to delete old backup %s: %v", backups[i].FileName, err))
		} else {
			launcher.WriteLog(id, fmt.Sprintf("[MACE] Retention Policy: Deleted old backup %s", backups[i].FileName))
		}
	}

	return nil
}

// StartBackupScheduler starts a background daemon that periodically checks and executes scheduled backups.
func StartBackupScheduler() {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			servers, err := ListServers()
			if err != nil {
				continue
			}

			for _, inst := range servers {
				if inst.BackupSchedule == "" || inst.BackupSchedule == "off" {
					continue
				}

				due := false
				var lastTime time.Time
				if inst.LastBackup != "" {
					lastTime, err = time.Parse(time.RFC3339, inst.LastBackup)
					if err != nil {
						due = true
					}
				} else {
					due = true
				}

				if !due {
					var duration time.Duration
					switch inst.BackupSchedule {
					case "hourly":
						duration = 1 * time.Hour
					case "daily":
						duration = 24 * time.Hour
					case "weekly":
						duration = 7 * 24 * time.Hour
					default:
						continue
					}

					if time.Since(lastTime) >= duration {
						due = true
					}
				}

				if due {
					launcher.WriteLog(inst.ID, "[MACE] Starting scheduled backup...")
					
					includeWorld := inst.BackupIncludeWorld
					includePlugins := inst.BackupIncludePlugins
					includeConfigs := inst.BackupIncludeConfigs
					
					if !includeWorld && !includePlugins && !includeConfigs {
						includeWorld = true
						includeConfigs = true
					}

					retention := inst.BackupRetention
					if retention <= 0 {
						retention = 5
					}

					_, backupErr := CreateBackupWithOptions(inst.ID, includeWorld, includePlugins, includeConfigs)
					if backupErr != nil {
						launcher.WriteLog(inst.ID, fmt.Sprintf("[MACE] Scheduled backup failed: %v", backupErr))
					} else {
						inst.LastBackup = time.Now().Format(time.RFC3339)
						SaveServer(&inst)

						if err := EnforceBackupRetention(inst.ID, retention); err != nil {
							launcher.WriteLog(inst.ID, fmt.Sprintf("[MACE] Retention enforcement failed: %v", err))
						}
					}
				}
			}
		}
	}()
}

// ListBackups scans the backup directory and returns all backup archives,
// sorted newest first.
func ListBackups(id string) ([]BackupItem, error) {
	inst, err := LoadServer(id)
	if err != nil {
		return nil, err
	}

	backupDir := GetBackupDir(inst)
	if _, err := os.Stat(backupDir); os.IsNotExist(err) {
		return []BackupItem{}, nil
	}

	entries, err := os.ReadDir(backupDir)
	if err != nil {
		return nil, err
	}

	var items []BackupItem
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".zip") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		items = append(items, BackupItem{
			FileName:  entry.Name(),
			SizeKB:    info.Size() / 1024,
			CreatedAt: info.ModTime().Format(time.RFC3339),
		})
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].CreatedAt > items[j].CreatedAt
	})

	if items == nil {
		items = []BackupItem{}
	}

	return items, nil
}

// RestoreBackup stops the server if running, safely archives the current
// world/configs, then extracts the selected backup.
func RestoreBackup(id string, backupName string) error {
	inst, err := LoadServer(id)
	if err != nil {
		return err
	}

	if launcher.IsRunning(id) {
		launcher.WriteLog(id, "[MACE] Stopping server for backup restore...")
		StopServer(id)
		for i := 0; i < 30; i++ {
			if !launcher.IsRunning(id) {
				break
			}
			time.Sleep(500 * time.Millisecond)
		}
		if launcher.IsRunning(id) {
			return fmt.Errorf("server did not stop in time, cannot restore backup safely")
		}
	}

	backupDir := GetBackupDir(inst)
	zipPath := filepath.Join(backupDir, backupName)
	if !utils.FileExists(zipPath) {
		return fmt.Errorf("backup file not found: %s", backupName)
	}

	timestamp := time.Now().Format("2006-01-02_15-04-05")
	worldDir := filepath.Join(inst.Path, inst.World)
	oldWorldDir := filepath.Join(inst.Path, fmt.Sprintf("%s_pre_restore_%s", inst.World, timestamp))

	if _, err := os.Stat(worldDir); err == nil {
		if err := robustRename(worldDir, oldWorldDir); err != nil {
			return fmt.Errorf("failed to archive current world before restore: %w", err)
		}
	} else {
		if err := os.MkdirAll(oldWorldDir, 0755); err != nil {
			return fmt.Errorf("failed to create pre-restore directory: %w", err)
		}
	}

	// Also backup existing config files to the pre-restore directory
	for _, cfgName := range configFiles {
		cfgPath := filepath.Join(inst.Path, cfgName)
		if utils.FileExists(cfgPath) {
			robustRename(cfgPath, filepath.Join(oldWorldDir, cfgName))
		}
	}

	r, err := zip.OpenReader(zipPath)
	if err != nil {
		// Rollback immediately if we can't open the zip
		for _, cfgName := range configFiles {
			backupCfg := filepath.Join(oldWorldDir, cfgName)
			if utils.FileExists(backupCfg) {
				robustRename(backupCfg, filepath.Join(inst.Path, cfgName))
			}
		}
		robustRename(oldWorldDir, worldDir)
		return fmt.Errorf("failed to open backup archive: %w", err)
	}
	defer r.Close()

	var restoreErr error
	for _, f := range r.File {
		destPath := filepath.Join(inst.Path, f.Name)

		if !strings.HasPrefix(filepath.Clean(destPath), filepath.Clean(inst.Path)+string(os.PathSeparator)) {
			continue
		}

		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(destPath, 0755); err != nil {
				restoreErr = fmt.Errorf("failed to create directory %s: %w", destPath, err)
				break
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			restoreErr = fmt.Errorf("failed to create parent directory for %s: %w", destPath, err)
			break
		}

		rc, err := f.Open()
		if err != nil {
			restoreErr = fmt.Errorf("failed to open zip file entry %s: %w", f.Name, err)
			break
		}

		outFile, err := os.Create(destPath)
		if err != nil {
			rc.Close()
			restoreErr = fmt.Errorf("failed to create file %s: %w", destPath, err)
			break
		}

		_, err = io.Copy(outFile, rc)
		outFile.Close()
		rc.Close()
		if err != nil {
			restoreErr = fmt.Errorf("failed to write file %s: %w", destPath, err)
			break
		}
	}

	if restoreErr != nil {
		// Clean up partially extracted files
		os.RemoveAll(worldDir)
		for _, cfgName := range configFiles {
			os.Remove(filepath.Join(inst.Path, cfgName))
		}

		// Roll back to the pre-restore backup
		for _, cfgName := range configFiles {
			backupCfg := filepath.Join(oldWorldDir, cfgName)
			if utils.FileExists(backupCfg) {
				robustRename(backupCfg, filepath.Join(inst.Path, cfgName))
			}
		}
		robustRename(oldWorldDir, worldDir)

		return restoreErr
	}

	os.RemoveAll(oldWorldDir)
	launcher.WriteLog(id, fmt.Sprintf("[MACE] Backup restored successfully: %s", backupName))
	return nil
}

// DeleteBackup removes a backup zip file from disk.
func DeleteBackup(id string, backupName string) error {
	inst, err := LoadServer(id)
	if err != nil {
		return err
	}

	backupDir := GetBackupDir(inst)
	zipPath := filepath.Join(backupDir, backupName)

	rel, err := filepath.Rel(backupDir, zipPath)
	if err != nil || strings.HasPrefix(rel, "..") || rel == ".." {
		return fmt.Errorf("invalid backup path")
	}

	if !utils.FileExists(zipPath) {
		return fmt.Errorf("backup file not found: %s", backupName)
	}

	return os.Remove(zipPath)
}

func robustRename(src, dst string) error {
	var err error
	for i := 0; i < 15; i++ {
		err = os.Rename(src, dst)
		if err == nil {
			return nil
		}
		time.Sleep(50 * time.Millisecond)
	}
	return err
}
