package downloader

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

const spigetAPIBase = "https://api.spiget.org/v2"


type spigetResource struct {
	ID         int64          `json:"id"`
	Name       string         `json:"name"`
	Tag        string         `json:"tag"`
	Downloads  int64          `json:"downloads"`
	Icon       spigetIcon     `json:"icon"`
	Author     spigetAuthor   `json:"author"`
	Premium    bool           `json:"premium"`
	External   bool           `json:"external"`
	File       spigetFile     `json:"file"`
}

type spigetIcon struct {
	URL string `json:"url"`
}

type spigetAuthor struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type spigetFile struct {
	Type     string `json:"type"`
	Size     float64 `json:"size"`
	SizeUnit string `json:"sizeUnit"`
	URL      string `json:"url"`
}


type SpigetSearchResult struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Author      string `json:"author"`
	IconURL     string `json:"iconUrl"`
	Downloads   int64  `json:"downloads"`
	Premium     bool   `json:"premium"`
	External    bool   `json:"external"`
	Source      string `json:"source"` // always "spiget"
}

// SearchSpiget searches the Spiget API for SpigotMC resources (plugins).
func SearchSpiget(query string, limit int) ([]SpigetSearchResult, error) {
	if limit <= 0 {
		limit = 20
	}

	params := url.Values{}
	params.Set("size", fmt.Sprintf("%d", limit))
	params.Set("sort", "-downloads")

	var reqURL string
	if query != "" {
		reqURL = fmt.Sprintf("%s/search/resources/%s?%s", spigetAPIBase, url.PathEscape(query), params.Encode())
	} else {
		reqURL = fmt.Sprintf("%s/resources?%s", spigetAPIBase, params.Encode())
	}

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "MACE/1.0 (mace-app)")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("spiget search failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("spiget search: HTTP %s", resp.Status)
	}

	var resources []spigetResource
	if err := json.NewDecoder(resp.Body).Decode(&resources); err != nil {
		return nil, err
	}

	results := make([]SpigetSearchResult, 0, len(resources))
	for _, r := range resources {
		iconURL := ""
		if r.Icon.URL != "" {
		iconURL = "https://www.spigotmc.org/" + r.Icon.URL
		}

		results = append(results, SpigetSearchResult{
			ID:          r.ID,
			Name:        r.Name,
			Description: r.Tag,
			Author:      r.Author.Name,
			IconURL:     iconURL,
			Downloads:   r.Downloads,
			Premium:     r.Premium,
			External:    r.External,
			Source:      "spiget",
		})
	}
	return results, nil
}

// BrowseSpiget returns popular SpigotMC resources (no search query, sorted by downloads).
func BrowseSpiget(limit int) ([]SpigetSearchResult, error) {
	return SearchSpiget("", limit)
}

// ResolveSpigetDownloadURL returns the download URL for a Spiget resource.
// Returns an error if the resource is premium or external (can't be downloaded directly).
func ResolveSpigetDownloadURL(resourceID int64) (string, string, error) {
	detailURL := fmt.Sprintf("%s/resources/%d", spigetAPIBase, resourceID)

	req, err := http.NewRequest("GET", detailURL, nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("User-Agent", "MACE/1.0 (mace-app)")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("spiget resource fetch: HTTP %s", resp.Status)
	}

	var resource spigetResource
	if err := json.NewDecoder(resp.Body).Decode(&resource); err != nil {
		return "", "", err
	}

	if resource.Premium {
		return "", "", fmt.Errorf("this is a premium resource — purchase it on SpigotMC.org to download")
	}

	if resource.External {
		return "", "", fmt.Errorf("this resource uses an external download — visit SpigotMC.org to download manually")
	}

	downloadURL := fmt.Sprintf("%s/resources/%d/download", spigetAPIBase, resourceID)
	fileName := fmt.Sprintf("%s.jar", sanitizeFileName(resource.Name))

	return downloadURL, fileName, nil
}

// sanitizeFileName removes characters that are not safe for filenames.
func sanitizeFileName(name string) string {
	result := make([]byte, 0, len(name))
	for _, c := range name {
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.' {
			result = append(result, byte(c))
		} else if c == ' ' {
			result = append(result, '-')
		}
	}
	if len(result) == 0 {
		return "plugin"
	}
	return string(result)
}
