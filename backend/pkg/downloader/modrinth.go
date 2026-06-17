package downloader

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

const modrinthAPIBase = "https://api.modrinth.com/v2"

// modrinthSearchHit is a single result from the Modrinth search API.
type modrinthSearchHit struct {
	ProjectID   string `json:"project_id"`
	Slug        string `json:"slug"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Author      string `json:"author"`
	IconURL     string `json:"icon_url"`
	Downloads   int64  `json:"downloads"`
}

// modrinthSearchResponse wraps the top-level search result.
type modrinthSearchResponse struct {
	Hits []modrinthSearchHit `json:"hits"`
}

// ModrinthSearchResult is the exported, unified format returned to the IPC layer.
type ModrinthSearchResult struct {
	ID          string `json:"id"`
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Author      string `json:"author"`
	IconURL     string `json:"iconUrl"`
	Downloads   int64  `json:"downloads"`
	Source      string `json:"source"` // always "modrinth"
}

// ModrinthVersionFile is a single downloadable file within a Modrinth version.
type ModrinthVersionFile struct {
	URL      string `json:"url"`
	Filename string `json:"filename"`
	Primary  bool   `json:"primary"`
	Size     int64  `json:"size"`
}

// ModrinthVersionInfo holds the resolved version metadata including download URLs.
type ModrinthVersionInfo struct {
	ID            string                `json:"id"`
	ProjectID     string                `json:"project_id"`
	Name          string                `json:"name"`
	VersionNumber string                `json:"version_number"`
	GameVersions  []string              `json:"game_versions"`
	Loaders       []string              `json:"loaders"`
	Files         []ModrinthVersionFile `json:"files"`
}

// mapLoaderForModrinth maps a server type to the Modrinth loader/category name.
// For plugin servers (paper, spigot), the Modrinth API uses these as category facets.
func mapLoaderForModrinth(serverType string) string {
	switch strings.ToLower(serverType) {
	case "paper":
		return "paper"
	case "spigot":
		return "spigot"
	case "bukkit":
		return "bukkit"
	default:
		return strings.ToLower(serverType)
	}
}

// isPluginProjectType returns true if the project type is for plugins.
func isPluginProjectType(projectType string) bool {
	return projectType == "plugin"
}

// SearchModrinth searches the Modrinth API for mods, plugins, or modpacks.
// projectType should be "mod", "plugin", or "modpack".
// loader and gameVersion are used to auto-filter results.
func SearchModrinth(query, projectType, loader, gameVersion string, limit int) ([]ModrinthSearchResult, error) {
	if limit <= 0 {
		limit = 20
	}

	facets := buildModrinthFacets(projectType, loader, gameVersion)

	params := url.Values{}
	if query != "" {
		params.Set("query", query)
	}
	params.Set("facets", facets)
	params.Set("limit", fmt.Sprintf("%d", limit))
	if query == "" {
		params.Set("index", "downloads")
	}

	reqURL := fmt.Sprintf("%s/search?%s", modrinthAPIBase, params.Encode())

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "MACE/1.0 (mace-app)")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("modrinth search failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("modrinth search: HTTP %s", resp.Status)
	}

	var searchResp modrinthSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
		return nil, err
	}

	results := make([]ModrinthSearchResult, 0, len(searchResp.Hits))
	for _, h := range searchResp.Hits {
		results = append(results, ModrinthSearchResult{
			ID:          h.ProjectID,
			Slug:        h.Slug,
			Name:        h.Title,
			Description: h.Description,
			Author:      h.Author,
			IconURL:     h.IconURL,
			Downloads:   h.Downloads,
			Source:      "modrinth",
		})
	}
	return results, nil
}

// BrowseModrinth returns popular content from Modrinth (no search query, sorted by downloads).
func BrowseModrinth(projectType, loader, gameVersion string, limit int) ([]ModrinthSearchResult, error) {
	return SearchModrinth("", projectType, loader, gameVersion, limit)
}

// ResolveModrinthVersion finds the best compatible version for a project given loader+gameVersion.
// For plugin servers (paper, spigot), the loader is mapped to the correct Modrinth category.
func ResolveModrinthVersion(projectID, loader, gameVersion string) (*ModrinthVersionInfo, error) {
	modrinthLoader := mapLoaderForModrinth(loader)

	params := url.Values{}
	params.Set("loaders", fmt.Sprintf(`["%s"]`, modrinthLoader))
	params.Set("game_versions", fmt.Sprintf(`["%s"]`, gameVersion))

	reqURL := fmt.Sprintf("%s/project/%s/version?%s", modrinthAPIBase, projectID, params.Encode())

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "MACE/1.0 (mace-app)")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("modrinth version resolve: HTTP %s", resp.Status)
	}

	var versions []ModrinthVersionInfo
	if err := json.NewDecoder(resp.Body).Decode(&versions); err != nil {
		return nil, err
	}

	if len(versions) == 0 {
		if modrinthLoader == "paper" || modrinthLoader == "spigot" {
			params.Set("loaders", `["bukkit"]`)
			reqURL = fmt.Sprintf("%s/project/%s/version?%s", modrinthAPIBase, projectID, params.Encode())
			req2, _ := http.NewRequest("GET", reqURL, nil)
			req2.Header.Set("User-Agent", "MACE/1.0 (mace-app)")
			resp2, err := http.DefaultClient.Do(req2)
			if err == nil {
				defer resp2.Body.Close()
				if resp2.StatusCode == http.StatusOK {
					var fallbackVersions []ModrinthVersionInfo
					if json.NewDecoder(resp2.Body).Decode(&fallbackVersions) == nil && len(fallbackVersions) > 0 {
						return &fallbackVersions[0], nil
					}
				}
			}
		}
		return nil, fmt.Errorf("no compatible version found for %s %s on Modrinth", loader, gameVersion)
	}

	return &versions[0], nil
}

// buildModrinthFacets constructs the JSON facets filter string for Modrinth search.
func buildModrinthFacets(projectType, loader, gameVersion string) string {
	var groups []string

	if projectType != "" {
		groups = append(groups, fmt.Sprintf(`["project_type:%s"]`, projectType))
	}

	if loader != "" && loader != "vanilla" {
		modrinthLoader := mapLoaderForModrinth(loader)
		if isPluginProjectType(projectType) {
			if modrinthLoader == "paper" {
				groups = append(groups, `["categories:paper","categories:bukkit","categories:spigot"]`)
			} else if modrinthLoader == "spigot" {
				groups = append(groups, `["categories:spigot","categories:bukkit","categories:paper"]`)
			} else {
				groups = append(groups, fmt.Sprintf(`["categories:%s"]`, modrinthLoader))
			}
		} else {
			groups = append(groups, fmt.Sprintf(`["categories:%s"]`, modrinthLoader))
		}
	}

	if gameVersion != "" {
		groups = append(groups, fmt.Sprintf(`["versions:%s"]`, gameVersion))
	}

	if len(groups) == 0 {
		return "[]"
	}
	return "[" + strings.Join(groups, ",") + "]"
}
