package launcher

import (
	"os"
	"path/filepath"
	"strings"
)

// AnalyzeCrash inspects the console logs and crash reports to find why a server stopped unexpectedly.
func AnalyzeCrash(id string, dir string) (reason string, resolution string) {
	var combinedContent strings.Builder

	logs := GetLogs(id)
	for _, line := range logs {
		combinedContent.WriteString(line)
		combinedContent.WriteString("\n")
	}

	crashReportsDir := filepath.Join(dir, "crash-reports")
	if entries, err := os.ReadDir(crashReportsDir); err == nil {
		var latestFile os.DirEntry
		var latestTime int64

		for _, entry := range entries {
			if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".txt") {
				info, err := entry.Info()
				if err == nil {
					if info.ModTime().UnixNano() > latestTime {
						latestTime = info.ModTime().UnixNano()
						latestFile = entry
					}
				}
			}
		}

		if latestFile != nil {
			crashReportPath := filepath.Join(crashReportsDir, latestFile.Name())
			if crashData, err := os.ReadFile(crashReportPath); err == nil {
				combinedContent.WriteString("\n--- CRASH REPORT (" + latestFile.Name() + ") ---\n")
				combinedContent.Write(crashData)
			}
		}
	}

	content := combinedContent.String()
	if content == "" {
		return "", ""
	}

	if strings.Contains(content, "UnsupportedClassVersionError") ||
		strings.Contains(content, "has been compiled by a more recent version of the Java Runtime") {
		return "Java Version Mismatch",
			"This server is running a Minecraft or mod version that requires a newer version of Java. Please update the Java executable path in server settings to a newer JDK version."
	}

	if strings.Contains(content, "OutOfMemoryError") ||
		strings.Contains(content, "Java heap space") ||
		strings.Contains(content, "GC overhead limit exceeded") {
		return "Out of Memory",
			"The server ran out of allocated RAM. Please edit the server settings to allocate more memory."
	}

	if strings.Contains(content, "Address already in use") ||
		strings.Contains(content, "Failed to bind to port") ||
		strings.Contains(content, "AddressAlreadyInUseException") {
		return "Port Conflict",
			"The port is already in use by another process. Please stop any other running servers, or change the port in server.properties."
	}

	if strings.Contains(content, "Missing or unsupported mandatory dependencies") ||
		strings.Contains(content, "ModResolutionException") ||
		strings.Contains(content, "MissingRequiredModException") {
		return "Missing Mod Dependencies",
			"One or more installed mods are missing their required dependencies. Please inspect the log files to see which dependency is missing, or join our Discord (https://discord.com/invite/zrrHQC4QKF) for support."
	}

	if strings.Contains(content, "NoSuchMethodError") ||
		strings.Contains(content, "ClassNotFoundException") ||
		strings.Contains(content, "Ticking entity") ||
		strings.Contains(content, "Ticking block entity") ||
		strings.Contains(content, "org.spongepowered.asm.mixin") {
		return "Mod Incompatibility",
			"There is a conflict or mismatch between some of the installed mods. Try disabling recently added mods, or join our Discord (https://discord.com/invite/zrrHQC4QKF) with your crash report for help."
	}

	if strings.Contains(content, "AccessDeniedException") ||
		strings.Contains(content, "Permission denied") {
		return "File Permission Error",
			"The server process was unable to read or write to its files. Check file and directory permissions in the server folder."
	}

	if strings.Contains(content, "You need to agree to the EULA") ||
		strings.Contains(content, "eula=false") {
		return "EULA Agreement Required",
			"You must accept the Minecraft End User License Agreement (EULA). Set 'eula=true' in the eula.txt file in the server directory."
	}

	return "Unexpected Server Stop",
		"The server stopped unexpectedly. If this issue persists, please review the console logs or join our Discord (https://discord.com/invite/zrrHQC4QKF) for help."
}
