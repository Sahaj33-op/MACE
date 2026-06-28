import { useState, useEffect } from "react";
import { createServer, getAvailableVersions, browseForBackupDir } from "../ipc/serverAPI";
import { Download, ShieldAlert, Cpu, FolderOpen } from "lucide-react";
import type { ServerType } from "../ipc/types";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";

interface CreateServerProps {
  refreshServers: () => void;
  setActiveTab: (tab: "dashboard" | "server-details" | "create" | "settings" | "import") => void;
}

export default function CreateServer({ refreshServers, setActiveTab }: CreateServerProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState("vanilla");
  const [version, setVersion] = useState("");
  const [memoryMB, setMemoryMB] = useState(2048);
  const [backupPath, setBackupPath] = useState("");
  const [agreeEula, setAgreeEula] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingVersions, setFetchingVersions] = useState(true);
  const [error, setError] = useState("");
  const [versionsMap, setVersionsMap] = useState<Record<string, string[]>>({});
  const [showSnapshots, setShowSnapshots] = useState(false);

  useEffect(() => {
    async function loadVersions() {
      try {
        const data = await getAvailableVersions();
        setVersionsMap(data);
        if (data.vanilla && data.vanilla.length > 0) setVersion(data.vanilla[0]);
      } catch {
        setError("Failed to fetch server versions. Using offline fallback.");
        const fallback = {
          vanilla:  ["26.1.2","26.1.1","26.1.0","1.21.4","1.21.3","1.21.2","1.21.1","1.21","1.20.6","1.20.4","1.20.2","1.20.1","1.19.4","1.18.2","1.16.5","1.12.2"],
          vanilla_snapshots: ["24w12a", "24w11a", "24w10a", "24w09a"],
          paper:    ["26.1.2","26.1.1","26.1.0","1.21.4","1.21.3","1.21.1","1.20.6","1.20.4","1.20.2","1.20.1","1.19.4","1.18.2","1.16.5","1.12.2"],
          paper_snapshots: ["1.21.11-pre5", "1.21.11-pre4", "1.21.9-pre4", "1.21.9-pre3"],
          fabric:   ["26.1.2","26.1.1","26.1.0","1.21.4","1.21.3","1.21.2","1.21.1","1.21","1.20.6","1.20.4","1.20.2","1.20.1","1.19.4","1.18.2","1.16.5"],
          fabric_snapshots: ["24w12a", "1.21-pre1"],
          quilt:    ["26.1.2","26.1.1","26.1.0","1.21.4","1.21.3","1.21.1","1.20.6","1.20.4","1.20.2","1.20.1","1.19.4","1.18.2"],
          quilt_snapshots: ["24w12a", "1.21-pre1"],
          forge:    ["26.1.2","26.1.1","26.1.0","1.21.4","1.21.3","1.21.1","1.20.6","1.20.4","1.20.2","1.20.1","1.19.4","1.18.2","1.16.5","1.12.2"],
          neoforge: ["26.1.2","26.1.1","26.1.0","1.21.4","1.21.3","1.21.1","1.21","1.20.6","1.20.4","1.20.2"],
        };
        setVersionsMap(fallback);
        setVersion(fallback.vanilla[0] || "26.1.2");
      } finally {
        setFetchingVersions(false);
      }
    }
    loadVersions();
  }, []);

  const handleTypeChange = (newType: string) => {
    setType(newType);
    const hasSnapshots = ["vanilla", "paper", "fabric", "quilt"].includes(newType);
    const listKey = (hasSnapshots && showSnapshots) ? `${newType}_snapshots` : newType;
    const available = versionsMap[listKey];
    if (available && available.length > 0) setVersion(available[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!agreeEula) {
      setError("You must agree to the Minecraft EULA to create a server.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await createServer({ name, type: type as ServerType, version, memoryMB: Number(memoryMB), backupPath, agreeEula });
      refreshServers();
      setActiveTab("dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to create server. Check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "2.5rem" }}>
      {/* Title */}
      <div>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>New Server Instance</h1>
        <p style={{ color: "var(--accent-color)", margin: 0 }}>Download and set up a Minecraft server in a single click.</p>
      </div>

      {loading ? (
        /* Installing state */
        <div
          className="card"
          style={{
            padding: "4rem 2rem",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.5rem",
          }}
        >
          <div
            style={{
              border: "4px solid var(--hr-bottom-color)",
              borderTop: "4px solid var(--btn-primary-inner-color)",
              width: "60px",
              height: "60px",
              animation: "spin 1s linear infinite",
            }}
          />
          <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
          <div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>Downloading Server Jars</h3>
            <p style={{ color: "var(--accent-color)", maxWidth: "420px", margin: "0 auto", fontSize: "0.9rem" }}>
              Downloading the Minecraft server engine, setting up config files, and preparing folders. This can take up to a minute.
            </p>
          </div>
        </div>
      ) : (
        /* Form */
        <form onSubmit={handleSubmit} className="card" style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {error && (
            <div
              style={{
                background: "rgba(220, 53, 69, 0.15)",
                border: "3px solid var(--error-color)",
                padding: "1rem",
                color: "var(--text-color)",
                fontSize: "0.9rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <ShieldAlert size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Server Name */}
          <div className="form-group">
            <label className="form-label">Server Name</label>
            <input
              className="form-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Survival Server"
              required
              maxLength={30}
            />
          </div>

          {/* Engine Type */}
          <div className="form-group">
            <label className="form-label">Server Engine Type</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "0.75rem" }}>
              {["vanilla", "paper", "fabric", "quilt", "forge", "neoforge"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className={type === t ? "button-primary" : "button-normal"}
                  style={{
                    margin: 0,
                    padding: "0.75rem",
                    fontWeight: 700,
                    textTransform: "capitalize",
                    fontSize: "0.85rem",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Version and RAM */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="form-label">Minecraft Version</label>
                {["vanilla", "paper", "fabric", "quilt"].includes(type) && (
                  <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "var(--accent-color)", cursor: "pointer", marginBottom: "0.25rem" }}>
                    <input
                      type="checkbox"
                      checked={showSnapshots}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setShowSnapshots(checked);
                        const listKey = checked ? `${type}_snapshots` : type;
                        const list = versionsMap[listKey] || [];
                        if (list.length > 0) {
                          setVersion(list[0]);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    />
                    Show Snapshots
                  </label>
                )}
              </div>
              <select
                className="form-input"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                disabled={fetchingVersions}
                style={{ height: "40px" }}
              >
                {fetchingVersions ? (
                  <option>Loading versions...</option>
                ) : (
                  ((["vanilla", "paper", "fabric", "quilt"].includes(type) && showSnapshots ? versionsMap[`${type}_snapshots`] : versionsMap[type]) || []).map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))
                )}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Memory Limit (MB)</label>
              <input
                className="form-input"
                type="number"
                value={memoryMB}
                onChange={(e) => setMemoryMB(Number(e.target.value))}
                min={512}
                max={16384}
                required
              />
            </div>
          </div>

          {/* RAM Hint */}
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "var(--primary-color)",
              border: "2px solid var(--hr-top-color)",
              fontSize: "0.8rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "var(--accent-color)",
            }}
          >
            <Cpu size={14} />
            <span>Recommended RAM: 2048 MB for Vanilla, 4096 MB for Forge/Fabric with mods.</span>
          </div>

          {/* Backup Directory */}
          <div className="form-group">
            <label className="form-label">Backup Directory (Optional)</label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                className="form-input"
                type="text"
                value={backupPath}
                onChange={(e) => setBackupPath(e.target.value)}
                placeholder="Default: server/backups/"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="button-normal"
                onClick={async () => {
                  try {
                    const dir = await browseForBackupDir();
                    if (dir) setBackupPath(dir);
                  } catch (err) {
                    console.error("Failed to select backup directory:", err);
                    setError("Failed to open directory picker.");
                  }
                }}
                style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.4rem", whiteSpace: "nowrap" }}
              >
                <FolderOpen size={14} /> Browse
              </button>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--accent-color)", marginTop: "0.4rem", opacity: 0.7 }}>
              Tip: Placing backups on a separate drive or dedicated folder helps prevent accidental deletion.
            </p>
          </div>

          <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "0.4rem", padding: "0.25rem 0" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
              <input
                id="agreeEula"
                type="checkbox"
                checked={agreeEula}
                onChange={(e) => setAgreeEula(e.target.checked)}
                style={{
                  marginTop: "0.25rem",
                  width: "18px",
                  height: "18px",
                  cursor: "pointer",
                  accentColor: "var(--btn-primary-inner-color)",
                }}
              />
              <label htmlFor="agreeEula" style={{ fontSize: "0.9rem", color: "var(--text-color)", cursor: "pointer", lineHeight: "1.4" }}>
                I agree to the Minecraft End User License Agreement (EULA) to create this server.
              </label>
            </div>
            <div style={{ marginLeft: "1.9rem" }}>
              <button
                type="button"
                onClick={() => BrowserOpenURL("https://www.minecraft.net/eula")}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "var(--btn-primary-inner-color)",
                  textDecoration: "underline",
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Read Minecraft EULA
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="button-primary"
            disabled={!agreeEula}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "0.75rem",
              margin: 0,
              opacity: agreeEula ? 1 : 0.5,
              cursor: agreeEula ? "pointer" : "not-allowed",
            }}
          >
            <Download size={16} /> Download and Create Server
          </button>
        </form>
      )}
    </div>
  );
}
