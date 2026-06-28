package downloader

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

type MojangManifest struct {
	Latest struct {
		Release  string `json:"release"`
		Snapshot string `json:"snapshot"`
	} `json:"latest"`
	Versions []struct {
		ID   string `json:"id"`
		Type string `json:"type"`
		URL  string `json:"url"`
	} `json:"versions"`
}

type MojangVersionDetail struct {
	Downloads struct {
		Server struct {
			URL string `json:"url"`
		} `json:"downloads"`
	} `json:"downloads"`
}

type PaperVersionsResponse struct {
	Builds []int `json:"builds"`
}

type FabricInstallerVersion struct {
	Version string `json:"version"`
	Stable  bool   `json:"stable"`
}

type QuiltInstallerVersion struct {
	Version string `json:"version"`
}

var httpClient = &http.Client{Timeout: 10 * time.Second}

// CompareVersions compares two version strings. Returns 1 if v1 > v2, -1 if v1 < v2, and 0 if v1 == v2.
func CompareVersions(v1, v2 string) int {
	parts1 := strings.Split(v1, ".")
	parts2 := strings.Split(v2, ".")

	maxLen := len(parts1)
	if len(parts2) > maxLen {
		maxLen = len(parts2)
	}

	for i := 0; i < maxLen; i++ {
		var p1, p2 int
		if i < len(parts1) {
			p1, _ = strconv.Atoi(parts1[i])
		}
		if i < len(parts2) {
			p2, _ = strconv.Atoi(parts2[i])
		}

		if p1 != p2 {
			if p1 < p2 {
				return -1
			}
			return 1
		}
	}
	return 0
}

// isMinecraftRelease checks whether a version string looks like a valid
// Minecraft release version (classic "1.x" or year-based "26.x"+).
func isMinecraftRelease(id string) bool {
	parts := strings.Split(id, ".")
	if len(parts) == 0 {
		return false
	}
	if parts[0] == "1" {
		return true
	}
	major, err := strconv.Atoi(parts[0])
	return err == nil && major >= 26
}

// isStableVersion checks if the version string is a stable release (does not contain -pre, -rc, etc.)
func isStableVersion(v string) bool {
	return !strings.Contains(v, "-pre") && !strings.Contains(v, "-rc") && !strings.Contains(v, "-beta") && !strings.Contains(v, "w")
}

// FetchVanillaVersions fetches release versions from Mojang manifest.
func FetchVanillaVersions() ([]string, error) {
	resp, err := httpClient.Get("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var manifest MojangManifest
	if err := json.NewDecoder(resp.Body).Decode(&manifest); err != nil {
		return nil, err
	}

	var list []string
	for _, v := range manifest.Versions {
		if v.Type == "release" && isMinecraftRelease(v.ID) {
			list = append(list, v.ID)
		}
	}
	return list, nil
}

// FetchVanillaSnapshots fetches snapshot versions from Mojang manifest.
func FetchVanillaSnapshots() ([]string, error) {
	resp, err := httpClient.Get("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var manifest MojangManifest
	if err := json.NewDecoder(resp.Body).Decode(&manifest); err != nil {
		return nil, err
	}

	var list []string
	for _, v := range manifest.Versions {
		if v.Type == "snapshot" {
			list = append(list, v.ID)
		}
	}
	return list, nil
}

// FetchPaperVersions fetches all available Paper release versions.
func FetchPaperVersions() ([]string, error) {
	resp, err := httpClient.Get("https://api.papermc.io/v2/projects/paper")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data struct {
		Versions []string `json:"versions"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	var list []string
	for _, v := range data.Versions {
		if isMinecraftRelease(v) && isStableVersion(v) {
			list = append(list, v)
		}
	}

	for i, j := 0, len(list)-1; i < j; i, j = i+1, j-1 {
		list[i], list[j] = list[j], list[i]
	}

	return list, nil
}

// FetchPaperSnapshots fetches Paper pre-release and release candidate versions.
func FetchPaperSnapshots() ([]string, error) {
	resp, err := httpClient.Get("https://api.papermc.io/v2/projects/paper")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data struct {
		Versions []string `json:"versions"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	var list []string
	for _, v := range data.Versions {
		if isMinecraftRelease(v) && !isStableVersion(v) {
			list = append(list, v)
		}
	}

	for i, j := 0, len(list)-1; i < j; i, j = i+1, j-1 {
		list[i], list[j] = list[j], list[i]
	}

	return list, nil
}

// FetchFabricVersions fetches stable Fabric game versions.
func FetchFabricVersions() ([]string, error) {
	resp, err := httpClient.Get("https://meta.fabricmc.net/v2/versions/game")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var versions []struct {
		Version string `json:"version"`
		Stable  bool   `json:"stable"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&versions); err != nil {
		return nil, err
	}

	var list []string
	for _, v := range versions {
		if v.Stable {
			list = append(list, v.Version)
		}
	}
	return list, nil
}

// FetchFabricSnapshots fetches unstable/snapshot Fabric game versions.
func FetchFabricSnapshots() ([]string, error) {
	resp, err := httpClient.Get("https://meta.fabricmc.net/v2/versions/game")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var versions []struct {
		Version string `json:"version"`
		Stable  bool   `json:"stable"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&versions); err != nil {
		return nil, err
	}

	var list []string
	for _, v := range versions {
		if !v.Stable {
			list = append(list, v.Version)
		}
	}
	return list, nil
}

// FetchQuiltVersions fetches stable Quilt game versions.
func FetchQuiltVersions() ([]string, error) {
	resp, err := httpClient.Get("https://meta.quiltmc.org/v3/versions/game")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var versions []struct {
		Version string `json:"version"`
		Stable  bool   `json:"stable"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&versions); err != nil {
		return nil, err
	}

	var list []string
	for _, v := range versions {
		if v.Stable {
			list = append(list, v.Version)
		}
	}
	return list, nil
}

// FetchQuiltSnapshots fetches unstable/snapshot Quilt game versions.
func FetchQuiltSnapshots() ([]string, error) {
	resp, err := httpClient.Get("https://meta.quiltmc.org/v3/versions/game")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var versions []struct {
		Version string `json:"version"`
		Stable  bool   `json:"stable"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&versions); err != nil {
		return nil, err
	}

	var list []string
	for _, v := range versions {
		if !v.Stable {
			list = append(list, v.Version)
		}
	}
	return list, nil
}

// FetchForgeVersions fetches unique Minecraft versions from Forge promotions_slim.json.
func FetchForgeVersions() ([]string, error) {
	resp, err := httpClient.Get("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data struct {
		Promos map[string]string `json:"promos"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	versionMap := make(map[string]bool)
	for key := range data.Promos {
		idx := strings.Index(key, "-")
		if idx != -1 {
			mcVer := key[:idx]
			if isMinecraftRelease(mcVer) {
				versionMap[mcVer] = true
			}
		}
	}

	var list []string
	for v := range versionMap {
		list = append(list, v)
	}

	sort.Slice(list, func(i, j int) bool {
		return CompareVersions(list[i], list[j]) > 0
	})

	return list, nil
}

// FetchVanillaURL fetches the Mojang server jar URL for a specific version.
func FetchVanillaURL(version string) (string, error) {
	resp, err := httpClient.Get("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var manifest MojangManifest
	if err := json.NewDecoder(resp.Body).Decode(&manifest); err != nil {
		return "", err
	}

	var detailURL string
	for _, v := range manifest.Versions {
		if v.ID == version {
			detailURL = v.URL
			break
		}
	}

	if detailURL == "" {
		return "", fmt.Errorf("version %s not found in Mojang manifest", version)
	}

	respDetail, err := httpClient.Get(detailURL)
	if err != nil {
		return "", err
	}
	defer respDetail.Body.Close()

	var detail MojangVersionDetail
	if err := json.NewDecoder(respDetail.Body).Decode(&detail); err != nil {
		return "", err
	}

	if detail.Downloads.Server.URL == "" {
		return "", fmt.Errorf("server jar download URL not found for version %s", version)
	}

	return detail.Downloads.Server.URL, nil
}

// FetchPaperURL fetches the latest build download URL for PaperMC for a specific version.
func FetchPaperURL(version string) (string, error) {
	url := fmt.Sprintf("https://api.papermc.io/v2/projects/paper/versions/%s", version)
	resp, err := httpClient.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return "", fmt.Errorf("paper version %s not supported or not found", version)
	}

	var paperRes PaperVersionsResponse
	if err := json.NewDecoder(resp.Body).Decode(&paperRes); err != nil {
		return "", err
	}

	if len(paperRes.Builds) == 0 {
		return "", fmt.Errorf("no builds found for Paper version %s", version)
	}

	latestBuild := paperRes.Builds[len(paperRes.Builds)-1]
	downloadName := fmt.Sprintf("paper-%s-%d.jar", version, latestBuild)
	downloadURL := fmt.Sprintf("https://api.papermc.io/v2/projects/paper/versions/%s/builds/%d/downloads/%s", version, latestBuild, downloadName)

	return downloadURL, nil
}

// FetchLatestFabricInstaller fetches the latest stable Fabric installer version.
func FetchLatestFabricInstaller() (string, error) {
	resp, err := httpClient.Get("https://meta.fabricmc.net/v2/versions/installer")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var installers []FabricInstallerVersion
	if err := json.NewDecoder(resp.Body).Decode(&installers); err != nil {
		return "", err
	}

	for _, inst := range installers {
		if inst.Stable {
			return inst.Version, nil
		}
	}

	if len(installers) > 0 {
		return installers[0].Version, nil
	}

	return "1.0.1", nil // Fallback
}

// FetchLatestQuiltInstaller fetches the latest Quilt installer version.
func FetchLatestQuiltInstaller() (string, error) {
	resp, err := httpClient.Get("https://meta.quiltmc.org/v3/versions/installer")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var installers []QuiltInstallerVersion
	if err := json.NewDecoder(resp.Body).Decode(&installers); err != nil {
		return "", err
	}

	if len(installers) > 0 {
		return installers[0].Version, nil
	}

	return "0.9.2", nil // Fallback
}

// MapNeoForgeToMC converts a NeoForge version string to its corresponding Minecraft version.
func MapNeoForgeToMC(neoforgeVer string) string {
	idx := strings.Index(neoforgeVer, "-")
	if idx != -1 {
		neoforgeVer = neoforgeVer[:idx]
	}
	idxPlus := strings.Index(neoforgeVer, "+")
	if idxPlus != -1 {
		neoforgeVer = neoforgeVer[:idxPlus]
	}

	parts := strings.Split(neoforgeVer, ".")
	if len(parts) < 2 {
		return ""
	}

	major, err := strconv.Atoi(parts[0])
	if err != nil {
		return ""
	}

	if major >= 26 {
		if len(parts) >= 3 {
			if parts[2] == "0" {
				return parts[0] + "." + parts[1]
			}
			return parts[0] + "." + parts[1] + "." + parts[2]
		}
		return parts[0] + "." + parts[1]
	} else if major >= 20 {
		if parts[1] == "0" {
			return "1." + parts[0]
		}
		return "1." + parts[0] + "." + parts[1]
	}

	return ""
}

// CompareNeoForgeVersions compares two NeoForge versions. Returns 1 if v1 > v2, -1 if v1 < v2, and 0 if v1 == v2.
func CompareNeoForgeVersions(v1, v2 string) int {
	isBeta1 := strings.Contains(v1, "-") || strings.Contains(v1, "+")
	isBeta2 := strings.Contains(v2, "-") || strings.Contains(v2, "+")

	cleanV1 := v1
	if idx := strings.Index(cleanV1, "-"); idx != -1 {
		cleanV1 = cleanV1[:idx]
	}
	if idx := strings.Index(cleanV1, "+"); idx != -1 {
		cleanV1 = cleanV1[:idx]
	}

	cleanV2 := v2
	if idx := strings.Index(cleanV2, "-"); idx != -1 {
		cleanV2 = cleanV2[:idx]
	}
	if idx := strings.Index(cleanV2, "+"); idx != -1 {
		cleanV2 = cleanV2[:idx]
	}

	parts1 := strings.Split(cleanV1, ".")
	parts2 := strings.Split(cleanV2, ".")

	maxLen := len(parts1)
	if len(parts2) > maxLen {
		maxLen = len(parts2)
	}

	for i := 0; i < maxLen; i++ {
		var p1, p2 int
		if i < len(parts1) {
			p1, _ = strconv.Atoi(parts1[i])
		}
		if i < len(parts2) {
			p2, _ = strconv.Atoi(parts2[i])
		}

		if p1 != p2 {
			if p1 < p2 {
				return -1
			}
			return 1
		}
	}

	if isBeta1 && !isBeta2 {
		return -1
	}
	if !isBeta1 && isBeta2 {
		return 1
	}

	return strings.Compare(v1, v2)
}

type neoForgeMavenMetadata struct {
	Versioning struct {
		Versions []string `xml:"versions>version"`
	} `xml:"versioning"`
}

var (
	neoForgeMetadataCache     neoForgeMavenMetadata
	neoForgeMetadataCacheTime time.Time
	neoForgeMetadataMu        sync.Mutex
)

func fetchNeoForgeMetadataCached() (neoForgeMavenMetadata, error) {
	neoForgeMetadataMu.Lock()
	defer neoForgeMetadataMu.Unlock()

	if !neoForgeMetadataCacheTime.IsZero() && time.Since(neoForgeMetadataCacheTime) < 1*time.Hour {
		return neoForgeMetadataCache, nil
	}

	var metadata neoForgeMavenMetadata
	resp, err := httpClient.Get("https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml")
	if err != nil {
		return metadata, err
	}
	defer resp.Body.Close()

	if err := xml.NewDecoder(resp.Body).Decode(&metadata); err != nil {
		return metadata, err
	}

	neoForgeMetadataCache = metadata
	neoForgeMetadataCacheTime = time.Now()

	return metadata, nil
}

// FetchNeoForgeVersions fetches unique Minecraft versions from official NeoForge Maven repository XML.
func FetchNeoForgeVersions() ([]string, error) {
	metadata, err := fetchNeoForgeMetadataCached()
	if err != nil {
		return nil, err
	}

	mcVerMap := make(map[string]bool)
	for _, v := range metadata.Versioning.Versions {
		mcVer := MapNeoForgeToMC(v)
		if mcVer != "" {
			mcVerMap[mcVer] = true
		}
	}

	var list []string
	for mcVer := range mcVerMap {
		list = append(list, mcVer)
	}

	sort.Slice(list, func(i, j int) bool {
		return CompareVersions(list[i], list[j]) > 0
	})

	return list, nil
}

// GetNeoForgeVersionForMC returns the best NeoForge version for a given Minecraft version.
func GetNeoForgeVersionForMC(mcVersion string) (string, error) {
	metadata, err := fetchNeoForgeMetadataCached()
	if err != nil {
		return "", err
	}

	var candidates []string
	for _, v := range metadata.Versioning.Versions {
		if MapNeoForgeToMC(v) == mcVersion {
			candidates = append(candidates, v)
		}
	}

	if len(candidates) == 0 {
		return "", fmt.Errorf("no NeoForge version found for Minecraft %s", mcVersion)
	}

	sort.Slice(candidates, func(i, j int) bool {
		return CompareNeoForgeVersions(candidates[i], candidates[j]) > 0
	})

	return candidates[0], nil
}
