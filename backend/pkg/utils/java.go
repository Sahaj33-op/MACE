package utils

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

type JavaInstall struct {
	Path    string `json:"path"`
	Version string `json:"version"`
}

// FindJavaInstallations searches for java.exe in standard paths and the system PATH.
func FindJavaInstallations() []JavaInstall {
	paths := make(map[string]bool)

	if p, err := exec.LookPath("java"); err == nil {
		if abs, err := filepath.Abs(p); err == nil {
			paths[abs] = true
		}
	}

	roots := []string{
		`C:\Program Files\Java`,
		`C:\Program Files (x86)\Java`,
		`C:\Program Files\Eclipse Foundation`,
		`C:\Program Files\Eclipse Adoptium`,
		`C:\Program Files\AdoptOpenJDK`,
		`C:\Program Files\Microsoft`,
		`C:\Program Files\Amazon Corretto`,
		`C:\Program Files\Zulu`,
		`C:\Program Files\Semeru`,
	}

	for _, root := range roots {
		filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil
			}
			if !info.IsDir() && (info.Name() == "java.exe" || info.Name() == "java") {
				if abs, err := filepath.Abs(path); err == nil {
					// We only want paths that contain bin/java.exe to avoid duplicate sub-bin/DLL paths
					if strings.Contains(strings.ToLower(abs), "bin") {
						paths[abs] = true
					}
				}
			}
			return nil
		})
	}

	var installs []JavaInstall
	for path := range paths {
		ver := GetJavaVersion(path)
		if ver != "" {
			installs = append(installs, JavaInstall{
				Path:    path,
				Version: ver,
			})
		}
	}

	sort.Slice(installs, func(i, j int) bool {
		return ParseMajorJavaVersion(installs[i].Version) > ParseMajorJavaVersion(installs[j].Version)
	})

	if len(installs) == 0 {
		installs = append(installs, JavaInstall{
			Path:    "java",
			Version: "Default System (java)",
		})
	}

	return installs
}

// GetJavaVersion executes java -version and extracts the version string.
func GetJavaVersion(javaPath string) string {
	cmd := exec.Command(javaPath, "-version")
	HideWindow(cmd)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return ""
	}

	output := stderr.String()
	re := regexp.MustCompile(`version "([^"]+)"`)
	matches := re.FindStringSubmatch(output)
	if len(matches) > 1 {
		return matches[1]
	}

	lines := strings.Split(output, "\n")
	if len(lines) > 0 {
		return strings.TrimSpace(lines[0])
	}

	return "Unknown"
}

// ParseMajorJavaVersion parses Java version string (e.g. "1.8.0_391" -> 8, "17.0.2" -> 17).
func ParseMajorJavaVersion(versionStr string) int {
	if strings.HasPrefix(versionStr, "1.8") {
		return 8
	}
	if strings.HasPrefix(versionStr, "1.") && len(versionStr) > 3 {
		if major, err := strconv.Atoi(string(versionStr[2])); err == nil {
			return major
		}
	}
	parts := strings.Split(versionStr, ".")
	if len(parts) > 0 {
		subParts := strings.Split(parts[0], "-")
		if major, err := strconv.Atoi(subParts[0]); err == nil {
			return major
		}
	}
	return 0
}

// GetRequiredJavaVersion returns the major Java version required for a given Minecraft version.
func GetRequiredJavaVersion(mcVersion string) int {
	parts := strings.Split(mcVersion, ".")
	if len(parts) < 2 {
		return 8
	}
	minor, err := strconv.Atoi(parts[1])
	if err != nil {
		return 8
	}
	if minor >= 25 {
		return 25
	}
	if minor >= 21 {
		return 21
	}
	if minor == 20 {
		if len(parts) >= 3 {
			patchStr := parts[2]
			var sb strings.Builder
			for _, r := range patchStr {
				if r >= '0' && r <= '9' {
					sb.WriteRune(r)
				} else {
					break
				}
			}
			patch, err := strconv.Atoi(sb.String())
			if err == nil && patch >= 5 {
				return 21
			}
		}
		return 17
	}
	if minor >= 18 {
		return 17
	}
	if minor == 17 {
		return 16
	}
	return 8
}

// FindJavaVersion searches detected Java installations for a specific major Java version.
func FindJavaVersion(major int) (string, bool) {
	installs := FindJavaInstallations()
	for _, inst := range installs {
		if ParseMajorJavaVersion(inst.Version) == major {
			return inst.Path, true
		}
	}
	return "", false
}

