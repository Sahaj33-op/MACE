import { useState, useEffect, useCallback } from "react";
import type { ServerInstance, ContentItem, ModSearchResult } from "../ipc/types";
import {
  listContent, addContent, removeContent, toggleContent,
  browseForJar, browseForModpackZip, applyModpack,
  searchModrinth, searchCurseForge, installModrinthMod, installCurseForgeFile,
  browseModrinth, browseCurseForge, searchHangar, browseHangar, installHangarPlugin,
  searchSpiget, browseSpiget, installSpigetPlugin
} from "../ipc/serverAPI";
import { Package, Puzzle, Archive, Search, Plus, Trash2, ToggleLeft, ToggleRight, Download, AlertCircle, CheckCircle, Loader, ExternalLink } from "lucide-react";
import { useDialog } from "../context/DialogContext";

// Which loaders support mods vs plugins
const MOD_LOADERS = ["fabric", "quilt", "forge", "neoforge"];
const PLUGIN_LOADERS = ["spigot", "paper"];
const MODPACK_LOADERS = ["fabric", "quilt", "forge", "neoforge"];

type InnerTab = "installed" | "search" | "modpack";
type SearchSource = "modrinth" | "curseforge" | "hangar" | "spiget";

interface ContentManagerProps {
  server: ServerInstance;
  contentType: "mod" | "plugin";
}

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function ContentManager({ server, contentType }: ContentManagerProps) {
  const { dangerConfirm } = useDialog();
  const [innerTab, setInnerTab] = useState<InnerTab>("installed");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  // Default to modrinth for mods, hangar for plugins
  const [searchSource, setSearchSource] = useState<SearchSource>(contentType === "plugin" ? "hangar" : "modrinth");
  const [searchResults, setSearchResults] = useState<ModSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [installingId, setInstallingId] = useState<string | null>(null);

  // Modpack state
  const [modpackStatus, setModpackStatus] = useState("");
  const [applyingPack, setApplyingPack] = useState(false);

  const isMod = contentType === "mod";
  const label = isMod ? "Mod" : "Plugin";
  const pluralLabel = isMod ? "Mods" : "Plugins";

  const loadItems = useCallback(async () => {
    setLoadingList(true);
    setError("");
    try {
      const data = await listContent(server.id, contentType);
      setItems(data || []);
    } catch (e: any) {
      setError(e.message || "Failed to load content");
    } finally {
      setLoadingList(false);
    }
  }, [server.id, contentType]);

  useEffect(() => {
    if (innerTab === "installed") loadItems();
  }, [innerTab, loadItems]);

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  };

  // --- Installed tab actions ---
  const handleAddLocal = async () => {
    setError("");
    const path = await browseForJar();
    if (!path) return;
    setActionLoading("add");
    try {
      await addContent(server.id, path, contentType);
      flash(`${label} installed!`);
      loadItems();
    } catch (e: any) {
      setError(e.message || `Failed to add ${label}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggle = async (item: ContentItem) => {
    setActionLoading(item.fileName);
    setError("");
    try {
      await toggleContent(server.id, item.fileName, contentType, !item.enabled);
      loadItems();
    } catch (e: any) {
      setError(e.message || "Toggle failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (item: ContentItem) => {
    const confirmed = await dangerConfirm(`Delete "${item.name}"? This cannot be undone.`, "Delete Content");
    if (!confirmed) return;
    setActionLoading(item.fileName);
    setError("");
    try {
      await removeContent(server.id, item.fileName, contentType);
      loadItems();
    } catch (e: any) {
      setError(e.message || "Remove failed");
    } finally {
      setActionLoading(null);
    }
  };

  // --- Search tab actions ---
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError("");
    setSearchResults([]);
    try {
      let results: ModSearchResult[];
      if (searchSource === "modrinth") {
        results = await searchModrinth(searchQuery, isMod ? "mod" : "plugin", server.type, server.version);
      } else if (searchSource === "curseforge") {
        results = await searchCurseForge(searchQuery, isMod ? 6 : 5, server.type, server.version);
      } else if (searchSource === "hangar") {
        results = await searchHangar(searchQuery);
      } else {
        results = await searchSpiget(searchQuery);
      }
      setSearchResults(results || []);
    } catch (e: any) {
      setSearchError(e.message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleInstallRemote = async (result: ModSearchResult) => {
    setInstallingId(result.id);
    setSearchError("");
    try {
      if (result.source === "modrinth") {
        await installModrinthMod(server.id, result.id, server.type, server.version, contentType);
      } else if (result.source === "curseforge") {
        await installCurseForgeFile(server.id, Number(result.id), server.type, server.version, contentType);
      } else if (result.source === "hangar") {
        await installHangarPlugin(server.id, result.slug || result.id, server.version);
      } else if (result.source === "spiget") {
        await installSpigetPlugin(server.id, Number(result.id));
      }
      flash(`"${result.name}" installed!`);
      if (innerTab === "search") loadItems();
    } catch (e: any) {
      setSearchError(e.message || "Install failed");
    } finally {
      setInstallingId(null);
    }
  };

  // Auto-browse when opening the search tab or changing source
  useEffect(() => {
    if (innerTab !== "search") return;
    if (searchQuery.trim() !== "") return; // Don't auto-browse if there's a typed query

    const browse = async () => {
      setSearching(true);
      setSearchError("");
      try {
        let results: ModSearchResult[];
        if (searchSource === "modrinth") {
          results = await browseModrinth(isMod ? "mod" : "plugin", server.type, server.version);
        } else if (searchSource === "curseforge") {
          results = await browseCurseForge(isMod ? 6 : 5, server.type, server.version);
        } else if (searchSource === "hangar") {
          results = await browseHangar();
        } else {
          results = await browseSpiget();
        }
        setSearchResults(results || []);
      } catch (e: any) {
        setSearchError(e.message || "Browse failed");
      } finally {
        setSearching(false);
      }
    };
    browse();
  }, [innerTab, searchSource, isMod, server.type, server.version, searchQuery]);

  // --- Modpack tab actions ---
  const handleApplyModpack = async () => {
    const path = await browseForModpackZip();
    if (!path) return;
    setApplyingPack(true);
    setModpackStatus("");
    setError("");
    try {
      const meta = await applyModpack(server.id, path);
      setModpackStatus(`Applied: ${meta.name} ${meta.version}`);
      flash(`Modpack "${meta.name}" applied!`);
      loadItems();
    } catch (e: any) {
      setError(e.message || "Failed to apply modpack");
    } finally {
      setApplyingPack(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--secondary-color)",
    border: "2px solid var(--hr-top-color)",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  };

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "0.5rem 1rem",
    fontSize: "0.8rem",
    fontWeight: 600,
    border: "2px solid",
    borderColor: active ? "var(--btn-primary-border-color)" : "var(--hr-top-color)",
    background: active ? "var(--btn-primary-inner-color)" : "transparent",
    color: active ? "white" : "var(--accent-color)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    transition: "all 0.15s",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Tab switcher */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button style={tabBtnStyle(innerTab === "installed")} onClick={() => setInnerTab("installed")}>
          <Package size={14} /> Installed {pluralLabel}
        </button>
        <button style={tabBtnStyle(innerTab === "search")} onClick={() => setInnerTab("search")}>
          <Search size={14} /> Browse & Download
        </button>
        {isMod && (
          <button style={tabBtnStyle(innerTab === "modpack")} onClick={() => setInnerTab("modpack")}>
            <Archive size={14} /> Modpack
          </button>
        )}
      </div>

      {/* Status messages */}
      {error && (
        <div style={{ padding: "0.75rem 1rem", background: "rgba(220,53,69,0.12)", border: "2px solid var(--error-color)", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-color)" }}>
          <AlertCircle size={16} color="var(--error-color)" /> {error}
        </div>
      )}
      {success && (
        <div style={{ padding: "0.75rem 1rem", background: "rgba(40,167,69,0.12)", border: "2px solid var(--success-color)", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-color)" }}>
          <CheckCircle size={16} color="var(--success-color)" /> {success}
        </div>
      )}

      {/* ── INSTALLED TAB ── */}
      {innerTab === "installed" && (
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>
              {items.length} {label}{items.length !== 1 ? "s" : ""} installed
            </span>
            <button
              onClick={handleAddLocal}
              disabled={actionLoading === "add"}
              className="button-primary"
              style={{ margin: 0, padding: "0.5rem 1rem", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              {actionLoading === "add" ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />}
              Add Local .jar
            </button>
          </div>

          {loadingList ? (
            <div style={{ textAlign: "center", color: "var(--accent-color)", padding: "2rem", fontSize: "0.85rem" }}>Loading…</div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--accent-color)", padding: "2rem", fontSize: "0.85rem" }}>
              No {pluralLabel.toLowerCase()} installed yet.<br />
              Add a local .jar or browse to download one.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "340px", overflowY: "auto" }}>
              {items.map((item) => (
                <div
                  key={item.fileName}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.6rem 0.75rem",
                    border: "2px solid var(--hr-top-color)",
                    background: item.enabled ? "rgba(40,167,69,0.05)" : "rgba(100,100,100,0.05)",
                    opacity: item.enabled ? 1 : 0.6,
                  }}
                >
                  {/* Status dot */}
                  <span style={{ width: "8px", height: "8px", flexShrink: 0, borderRadius: "50%", background: item.enabled ? "var(--success-color)" : "var(--accent-color)", display: "inline-block" }} />

                  {/* Name + size */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--accent-color)" }}>{item.sizeKB} KB</div>
                  </div>

                  {/* Toggle */}
                  <button
                    title={item.enabled ? "Disable" : "Enable"}
                    onClick={() => handleToggle(item)}
                    disabled={actionLoading === item.fileName}
                    style={{ background: "none", border: "none", cursor: "pointer", color: item.enabled ? "var(--success-color)" : "var(--accent-color)", padding: "4px", display: "flex" }}
                  >
                    {actionLoading === item.fileName
                      ? <Loader size={16} style={{ animation: "spin 1s linear infinite" }} />
                      : item.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  </button>

                  {/* Remove */}
                  <button
                    title="Remove"
                    onClick={() => handleRemove(item)}
                    disabled={!!actionLoading}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error-color)", padding: "4px", display: "flex" }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SEARCH TAB ── */}
      {innerTab === "search" && (
        <div style={cardStyle}>
          {/* Source selector */}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--accent-color)", fontWeight: 600 }}>Source:</span>
            {(["modrinth", "curseforge", ...(isMod ? [] : ["hangar", "spiget"])] as SearchSource[]).map((src) => (
              <button
                key={src}
                onClick={() => { setSearchSource(src); setSearchResults([]); setSearchQuery(""); }}
                style={{
                  ...tabBtnStyle(searchSource === src),
                  padding: "0.3rem 0.75rem",
                  fontSize: "0.75rem",
                  textTransform: "capitalize",
                }}
              >
                {src === "modrinth" ? "🟢" : src === "curseforge" ? "🟠" : src === "hangar" ? "✈️" : "🚰"} {src.charAt(0).toUpperCase() + src.slice(1)}
              </button>
            ))}
            <span style={{ fontSize: "0.72rem", color: "var(--accent-color)", marginLeft: "auto" }}>
              Auto-filtering: <strong>{server.type}</strong> · <strong>{server.version}</strong>
            </span>
          </div>

          {/* Search bar */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              className="form-input"
              style={{ flex: 1, height: "38px" }}
              placeholder={`Search ${searchSource} for ${pluralLabel.toLowerCase()}…`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
              className="button-primary"
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              style={{ margin: 0, padding: "0 1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              {searching ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={14} />}
              Search
            </button>
          </div>

          {searchError && (
            <div style={{ fontSize: "0.82rem", color: "var(--error-color)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <AlertCircle size={14} /> {searchError}
            </div>
          )}

          {/* Results */}
          {searchResults.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "400px", overflowY: "auto" }}>
              {searchResults.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.75rem",
                    border: "2px solid var(--hr-top-color)",
                    background: "var(--primary-color)",
                  }}
                >
                  {r.iconUrl && (
                    <img
                      src={r.iconUrl}
                      alt=""
                      style={{ width: "40px", height: "40px", objectFit: "cover", flexShrink: 0, border: "2px solid var(--hr-top-color)" }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  {!r.iconUrl && (
                    <div style={{ width: "40px", height: "40px", background: "var(--hr-top-color)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Puzzle size={18} color="var(--accent-color)" />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{r.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--accent-color)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      by {r.author} · ⬇ {formatDownloads(r.downloads)}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--accent-color)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.description}
                    </div>
                  </div>
                  {r.premium || r.external ? (
                    <button
                      className="button-primary"
                      onClick={() => {
                        if (r.source === "spiget") {
                          // SpigotMC URLs are a bit weird, usually it's resource ID
                          window.open(`https://www.spigotmc.org/resources/${r.id}/`, "_blank");
                        }
                      }}
                      style={{ margin: 0, padding: "0.4rem 0.75rem", fontSize: "0.78rem", flexShrink: 0, display: "flex", alignItems: "center", gap: "0.3rem", background: "var(--accent-color)", borderColor: "var(--accent-color)" }}
                    >
                      <ExternalLink size={13} />
                      View on {r.source === "spiget" ? "SpigotMC" : "Site"}
                    </button>
                  ) : (
                    <button
                      className="button-primary"
                      onClick={() => handleInstallRemote(r)}
                      disabled={installingId === r.id}
                      style={{ margin: 0, padding: "0.4rem 0.75rem", fontSize: "0.78rem", flexShrink: 0, display: "flex", alignItems: "center", gap: "0.3rem" }}
                    >
                      {installingId === r.id
                        ? <Loader size={13} style={{ animation: "spin 1s linear infinite" }} />
                        : <Download size={13} />}
                      Install
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {!searching && searchResults.length === 0 && searchQuery && !searchError && (
            <div style={{ textAlign: "center", color: "var(--accent-color)", padding: "1.5rem", fontSize: "0.85rem" }}>
              No results found. Try a different search term.
            </div>
          )}

          {!searching && searchResults.length === 0 && !searchQuery && (
            <div style={{ textAlign: "center", color: "var(--accent-color)", padding: "1.5rem", fontSize: "0.82rem" }}>
              Search is auto-filtered to <strong>{server.type}</strong> mods for Minecraft <strong>{server.version}</strong>.
            </div>
          )}
        </div>
      )}

      {/* ── MODPACK TAB ── */}
      {innerTab === "modpack" && isMod && (
        <div style={cardStyle}>
          {server.modpack && (
            <div style={{ padding: "0.75rem 1rem", border: "2px solid var(--success-color)", background: "rgba(40,167,69,0.08)", fontSize: "0.85rem" }}>
              <strong>Applied Pack:</strong> {server.modpack.name} {server.modpack.version}
              <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: "var(--accent-color)" }}>({server.modpack.source})</span>
            </div>
          )}

          <div style={{ fontSize: "0.85rem", color: "var(--accent-color)", lineHeight: 1.6 }}>
            Import a modpack and MACE will automatically extract all mods and config files into this server directory.
            <br />
            Supports <strong>Modrinth .mrpack</strong> files and generic <strong>.zip</strong> overrides from CurseForge exports.
          </div>

          {modpackStatus && (
            <div style={{ fontSize: "0.85rem", color: "var(--success-color)", fontWeight: 600 }}>{modpackStatus}</div>
          )}

          <button
            className="button-primary"
            onClick={handleApplyModpack}
            disabled={applyingPack}
            style={{ margin: 0, padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "0.5rem", alignSelf: "flex-start" }}
          >
            {applyingPack ? <Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Archive size={16} />}
            {applyingPack ? "Applying Modpack…" : "Import Local .zip / .mrpack"}
          </button>

          <p style={{ fontSize: "0.75rem", color: "var(--accent-color)", margin: 0 }}>
            To install a Modrinth modpack: download the <code>.mrpack</code> from modrinth.com, then click the button above.
          </p>
        </div>
      )}

      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

// ── Wrapper exported to Instances.tsx ─────────────────────────────────────────

interface InstanceContentManagerProps {
  server: ServerInstance;
}

export default function InstanceContentManager({ server }: InstanceContentManagerProps) {
  const isMod = MOD_LOADERS.includes(server.type);
  const isPlugin = PLUGIN_LOADERS.includes(server.type);
  const supportsModpack = MODPACK_LOADERS.includes(server.type);

  if (!isMod && !isPlugin) {
    return (
      <div style={{ padding: "1.5rem", color: "var(--accent-color)", fontSize: "0.85rem", textAlign: "center", border: "2px solid var(--hr-top-color)", background: "var(--secondary-color)" }}>
        <Package size={32} style={{ opacity: 0.3, marginBottom: "0.5rem" }} />
        <p>Vanilla servers do not support mods or plugins.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {isMod && (
        <div>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Puzzle size={16} /> Mods {supportsModpack && <span style={{ fontSize: "0.75rem", color: "var(--accent-color)", fontWeight: 400 }}>· Modpack import available</span>}
          </h3>
          <ContentManager server={server} contentType="mod" />
        </div>
      )}

      {isPlugin && (
        <div>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Package size={16} /> Plugins
          </h3>
          <ContentManager server={server} contentType="plugin" />
        </div>
      )}
    </div>
  );
}
