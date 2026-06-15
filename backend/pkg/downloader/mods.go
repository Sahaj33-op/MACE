package downloader

import (
	"fmt"
	"strings"
)


type ModrinthVersion struct {
	ID            string   `json:"id"`
	ProjectID     string   `json:"project_id"`
	AuthorID      string   `json:"author_id"`
	Name          string   `json:"name"`
	VersionNumber string   `json:"version_number"`
	GameVersions  []string `json:"game_versions"`
	Loaders       []string `json:"loaders"`
	Files         []struct {
		URL      string `json:"url"`
		Filename string `json:"filename"`
		Primary  bool   `json:"primary"`
		Size     int64  `json:"size"`
	} `json:"files"`
}

// FilterModrinthVersion verifies that the loaders array contains the target loader
// (e.g. "neoforge") and the game_versions array contains the target Minecraft subversion.
func FilterModrinthVersion(version ModrinthVersion, targetLoader string, targetGameVersion string) bool {
	loaderMatch := false
	for _, l := range version.Loaders {
		if strings.ToLower(l) == strings.ToLower(targetLoader) {
			loaderMatch = true
			break
		}
	}
	if !loaderMatch {
		return false
	}

	for _, gv := range version.GameVersions {
		if gv == targetGameVersion {
			return true
		}
	}

	return false
}


type CurseForgeModLoaderType int

const (
	CFModLoaderForge    CurseForgeModLoaderType = 1
	CFModLoaderFabric   CurseForgeModLoaderType = 4
	CFModLoaderQuilt    CurseForgeModLoaderType = 5
	CFModLoaderNeoForge CurseForgeModLoaderType = 6
	CFModLoaderUnknown  CurseForgeModLoaderType = 0
)

// CurseForgeSearchParameters holds query parameters for CurseForge API search requests.
type CurseForgeSearchParameters struct {
	GameId         int                     `json:"gameId"`
	ClassId        int                     `json:"classId"`
	SearchFilter   string                  `json:"searchFilter"`
	GameVersion    string                  `json:"gameVersion"`
	ModLoaderType  CurseForgeModLoaderType `json:"modLoaderType"`
	PageSize       int                     `json:"pageSize"`
	Index          int                     `json:"index"`
}

// GetCurseForgeLoaderType maps a loader name to CurseForge's specific integer loader type.
// Isolates NeoForge (CFModLoaderNeoForge = 6) from legacy Forge (CFModLoaderForge = 1).
func GetCurseForgeLoaderType(loader string) (CurseForgeModLoaderType, error) {
	switch strings.ToLower(loader) {
	case "neoforge":
		return CFModLoaderNeoForge, nil
	case "fabric":
		return CFModLoaderFabric, nil
	case "quilt":
		return CFModLoaderQuilt, nil
	case "forge":
		return CFModLoaderForge, nil
	default:
		return CFModLoaderUnknown, fmt.Errorf("unsupported loader type: %s", loader)
	}
}

