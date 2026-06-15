package downloader

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

const curseForgeAPIBase = "https://api.curseforge.com/v1"
const curseForgeMinecraftGameID = 432

// CurseForgeSearchResult is the exported, unified format returned to the IPC layer.
type CurseForgeSearchResult struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Summary     string `json:"description"`
	Author      string `json:"author"`
	IconURL     string `json:"iconUrl"`
	Downloads   int64  `json:"downloads"`
	Source      string `json:"source"` // always "curseforge"
	// CurseForge-specific
	ClassID     int    `json:"classId"`
}

// CurseForgeFileInfo holds a single downloadable file for a CurseForge mod.
type CurseForgeFileInfo struct {
	ID          int64  `json:"id"`
	DisplayName string `json:"displayName"`
	FileName    string `json:"fileName"`
	DownloadURL string `json:"downloadUrl"`
	FileLength  int64  `json:"fileLength"`
}

type cfSearchResponse struct {
	Data []cfMod `json:"data"`
}

type cfMod struct {
	ID          int64      `json:"id"`
	Name        string     `json:"name"`
	Summary     string     `json:"summary"`
	ClassID     int        `json:"classId"`
	Logo        *cfLogo    `json:"logo"`
	Authors     []cfAuthor `json:"authors"`
	DownloadCount float64  `json:"downloadCount"`
}

type cfLogo struct {
	URL string `json:"url"`
}

type cfAuthor struct {
	Name string `json:"name"`
}

type cfFilesResponse struct {
	Data []CurseForgeFileInfo `json:"data"`
}

// SearchCurseForge searches the CurseForge API for mods, plugins, or modpacks.
// classID: 6 = Mods, 5 = Bukkit Plugins, 4471 = Modpacks.
// loader and gameVersion are used for automatic filtering.
func SearchCurseForge(apiKey, query string, classID int, loader, gameVersion string, limit int) ([]CurseForgeSearchResult, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("CurseForge API key not configured — add it in Settings")
	}
	if limit <= 0 {
		limit = 20
	}

	params := url.Values{}
	params.Set("gameId", fmt.Sprintf("%d", curseForgeMinecraftGameID))
	params.Set("classId", fmt.Sprintf("%d", classID))
	params.Set("pageSize", fmt.Sprintf("%d", limit))

	if query != "" {
		params.Set("searchFilter", query)
	} else {
		params.Set("sortField", "2")
		params.Set("sortOrder", "desc")
	}

	if gameVersion != "" {
		params.Set("gameVersion", gameVersion)
	}

	// Only pass modLoaderType for mods (classID 6) and modpacks (classID 4471),
	// NOT for Bukkit Plugins (classID 5) which don't use Forge/Fabric loader types.
	if classID != 5 {
		loaderType, _ := GetCurseForgeLoaderType(loader)
		if loaderType != CFModLoaderUnknown {
			params.Set("modLoaderType", fmt.Sprintf("%d", loaderType))
		}
	}

	reqURL := fmt.Sprintf("%s/mods/search?%s", curseForgeAPIBase, params.Encode())

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("curseforge search failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusForbidden {
		return nil, fmt.Errorf("invalid CurseForge API key — check Settings")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("curseforge search: HTTP %s", resp.Status)
	}

	var searchResp cfSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
		return nil, err
	}

	results := make([]CurseForgeSearchResult, 0, len(searchResp.Data))
	for _, m := range searchResp.Data {
		iconURL := ""
		if m.Logo != nil {
			iconURL = m.Logo.URL
		}
		author := ""
		if len(m.Authors) > 0 {
			author = m.Authors[0].Name
		}
		results = append(results, CurseForgeSearchResult{
			ID:        m.ID,
			Name:      m.Name,
			Summary:   m.Summary,
			Author:    author,
			IconURL:   iconURL,
			Downloads: int64(m.DownloadCount),
			Source:    "curseforge",
			ClassID:   m.ClassID,
		})
	}
	return results, nil
}

// BrowseCurseForge returns popular content from CurseForge (no search query, sorted by popularity).
func BrowseCurseForge(apiKey string, classID int, loader, gameVersion string, limit int) ([]CurseForgeSearchResult, error) {
	return SearchCurseForge(apiKey, "", classID, loader, gameVersion, limit)
}

// ResolveCurseForgeFile fetches the best compatible file for a given mod ID, loader, and MC version.
func ResolveCurseForgeFile(apiKey string, modID int64, loader, gameVersion string) (*CurseForgeFileInfo, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("CurseForge API key not configured")
	}

	loaderType, _ := GetCurseForgeLoaderType(loader)

	params := url.Values{}
	if gameVersion != "" {
		params.Set("gameVersion", gameVersion)
	}
	if loaderType != CFModLoaderUnknown {
		params.Set("modLoaderType", fmt.Sprintf("%d", loaderType))
	}
	params.Set("pageSize", "10")

	reqURL := fmt.Sprintf("%s/mods/%d/files?%s", curseForgeAPIBase, modID, params.Encode())

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("curseforge files: HTTP %s", resp.Status)
	}

	var filesResp cfFilesResponse
	if err := json.NewDecoder(resp.Body).Decode(&filesResp); err != nil {
		return nil, err
	}

	if len(filesResp.Data) == 0 {
		return nil, fmt.Errorf("no compatible file found for mod %d (%s %s)", modID, loader, gameVersion)
	}

	return &filesResp.Data[0], nil
}

// GetCurseForgeDownloadURL fetches the download URL for a specific file ID.
// CurseForge sometimes leaves downloadUrl null; this endpoint returns it directly.
func GetCurseForgeDownloadURL(apiKey string, modID, fileID int64) (string, string, error) {
	if apiKey == "" {
		return "", "", fmt.Errorf("CurseForge API key not configured")
	}

	reqURL := fmt.Sprintf("%s/mods/%d/files/%d/download-url", curseForgeAPIBase, modID, fileID)

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	var result struct {
		Data string `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", "", err
	}

	parts := strings.Split(result.Data, "/")
	fileName := parts[len(parts)-1]

	return result.Data, fileName, nil
}

// ValidateCurseForgeKey pings the CurseForge API with the given key and returns nil if valid.
func ValidateCurseForgeKey(apiKey string) error {
	if apiKey == "" {
		return fmt.Errorf("API key is empty")
	}

	reqURL := fmt.Sprintf("%s/games/%d", curseForgeAPIBase, curseForgeMinecraftGameID)
	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("x-api-key", apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()

	if resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("invalid API key")
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("CurseForge returned HTTP %s", resp.Status)
	}
	return nil
}

