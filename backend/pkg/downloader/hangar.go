package downloader

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

const hangarAPIBase = "https://hangar.papermc.io/api/v1"



type hangarProjectsResponse struct {
	Result []hangarProject `json:"result"`
}

type hangarProject struct {
	Name        string            `json:"name"`
	Namespace   hangarNamespace   `json:"namespace"`
	Stats       hangarStats       `json:"stats"`
	Description string            `json:"description"`
	AvatarURL   string            `json:"avatarUrl"`
	Settings    hangarSettings    `json:"settings"`
}

type hangarNamespace struct {
	Owner string `json:"owner"`
	Slug  string `json:"slug"`
}

type hangarStats struct {
	Downloads int64 `json:"downloads"`
	Stars     int64 `json:"stars"`
}

type hangarSettings struct {
	Tags []string `json:"tags"`
}



type hangarVersionsResponse struct {
	Result []hangarVersion `json:"result"`
}

type hangarVersion struct {
	Name       string                       `json:"name"`
	Downloads  map[string]hangarDownloadInfo `json:"downloads"`
}

type hangarDownloadInfo struct {
	FileInfo    hangarFileInfo    `json:"fileInfo"`
	DownloadURL string           `json:"downloadUrl,omitempty"`
}

type hangarFileInfo struct {
	Name     string `json:"name"`
	SizeBytes int64 `json:"sizeBytes"`
}



// HangarSearchResult is the exported format returned to the IPC layer.
type HangarSearchResult struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Owner       string `json:"owner"`
	Description string `json:"description"`
	IconURL     string `json:"iconUrl"`
	Downloads   int64  `json:"downloads"`
	Source      string `json:"source"` // always "hangar"
}

// HangarVersionInfo holds the resolved download information for a Hangar plugin.
type HangarVersionInfo struct {
	VersionName string `json:"versionName"`
	FileName    string `json:"fileName"`
	DownloadURL string `json:"downloadUrl"`
}

// SearchHangar searches the Hangar API for Paper plugins.
func SearchHangar(query string, limit int) ([]HangarSearchResult, error) {
	if limit <= 0 {
		limit = 20
	}

	params := url.Values{}
	params.Set("limit", fmt.Sprintf("%d", limit))
	params.Set("sort", "-downloads")
	params.Set("platform", "PAPER")
	if query != "" {
		params.Set("q", query)
	}

	reqURL := fmt.Sprintf("%s/projects?%s", hangarAPIBase, params.Encode())

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "MACE/1.0 (mace-app)")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("hangar search failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("hangar search: HTTP %s", resp.Status)
	}

	var searchResp hangarProjectsResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
		return nil, err
	}

	results := make([]HangarSearchResult, 0, len(searchResp.Result))
	for _, p := range searchResp.Result {
		results = append(results, HangarSearchResult{
			Name:        p.Name,
			Slug:        p.Namespace.Slug,
			Owner:       p.Namespace.Owner,
			Description: p.Description,
			IconURL:     p.AvatarURL,
			Downloads:   p.Stats.Downloads,
			Source:      "hangar",
		})
	}
	return results, nil
}

// BrowseHangar returns popular Hangar plugins (no search query, sorted by downloads).
func BrowseHangar(limit int) ([]HangarSearchResult, error) {
	return SearchHangar("", limit)
}

// ResolveHangarVersion finds the latest compatible PAPER version for a Hangar project.
func ResolveHangarVersion(slug, mcVersion string) (*HangarVersionInfo, error) {
	params := url.Values{}
	params.Set("limit", "10")
	params.Set("platform", "PAPER")
	if mcVersion != "" {
		params.Set("platformVersion", mcVersion)
	}

	reqURL := fmt.Sprintf("%s/projects/%s/versions?%s", hangarAPIBase, slug, params.Encode())

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "MACE/1.0 (mace-app)")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("hangar version resolve: HTTP %s", resp.Status)
	}

	var versionsResp hangarVersionsResponse
	if err := json.NewDecoder(resp.Body).Decode(&versionsResp); err != nil {
		return nil, err
	}

	if len(versionsResp.Result) == 0 {
		return nil, fmt.Errorf("no compatible Hangar version found for %s (MC %s)", slug, mcVersion)
	}

	ver := versionsResp.Result[0]

	if dl, ok := ver.Downloads["PAPER"]; ok {
		downloadURL := dl.DownloadURL
		if downloadURL == "" {
			downloadURL = fmt.Sprintf("%s/projects/%s/versions/%s/PAPER/download", hangarAPIBase, slug, ver.Name)
		}
		return &HangarVersionInfo{
			VersionName: ver.Name,
			FileName:    dl.FileInfo.Name,
			DownloadURL: downloadURL,
		}, nil
	}

	downloadURL := fmt.Sprintf("%s/projects/%s/versions/%s/PAPER/download", hangarAPIBase, slug, ver.Name)
	return &HangarVersionInfo{
		VersionName: ver.Name,
		FileName:    fmt.Sprintf("%s-%s.jar", slug, ver.Name),
		DownloadURL: downloadURL,
	}, nil
}
