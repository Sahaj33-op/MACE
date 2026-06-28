import { useState, useEffect } from "react";
import { Cpu, RotateCw, Database, Terminal, Shield, Key, CheckCircle, AlertCircle, FolderOpen } from "lucide-react";
import { detectJava, getAppSettings, saveAppSettings, validateCurseForgeKey, pickServersDirectory, changeServersDirectory } from "../ipc/serverAPI";
import type { JavaInstall } from "../ipc/types";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";

interface SettingsProps {
  refreshServers?: () => void;
}

export default function Settings({ refreshServers }: SettingsProps) {
  const [javas, setJavas] = useState<JavaInstall[]>([]);
  const [loading, setLoading] = useState(false);

  // CurseForge key state
  const [cfKey, setCfKey] = useState("");
  const [cfSaving, setCfSaving] = useState(false);
  const [cfValidating, setCfValidating] = useState(false);
  const [cfStatus, setCfStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [cfMessage, setCfMessage] = useState("");

  // Servers directory state
  const [serversDir, setServersDir] = useState("");
  const [migrationLoading, setMigrationLoading] = useState(false);

  const runDetection = () => {
    setLoading(true);
    detectJava()
      .then((data) => { setJavas(data); setLoading(false); })
      .catch((err) => { console.error("Failed to detect java environments", err); setLoading(false); });
  };

  useEffect(() => {
    runDetection();
    getAppSettings().then((s) => {
      if (s?.curseForgeApiKey) {
        setCfKey(s.curseForgeApiKey);
        setCfStatus("valid");
      }
      if (s?.serversDir) {
        setServersDir(s.serversDir);
      }
    }).catch(() => {});
  }, []);

  const handleSaveCfKey = async () => {
    setCfSaving(true);
    setCfMessage("");
    try {
      await saveAppSettings({ curseForgeApiKey: cfKey });
      setCfStatus("idle");
      setCfMessage("API key saved.");
    } catch (e: any) {
      setCfMessage("Failed to save: " + (e.message || e));
    } finally {
      setCfSaving(false);
    }
  };

  const handleValidateCfKey = async () => {
    if (!cfKey.trim()) return;
    setCfValidating(true);
    setCfMessage("");
    try {
      await validateCurseForgeKey(cfKey);
      setCfStatus("valid");
      setCfMessage("API key is valid! ✓");
      // Also save on successful validation
      await saveAppSettings({ curseForgeApiKey: cfKey });
    } catch (e: any) {
      setCfStatus("invalid");
      setCfMessage(e.message || "Invalid API key");
    } finally {
      setCfValidating(false);
    }
  };

  const handleChangeDirectory = async () => {
    try {
      const chosen = await pickServersDirectory();
      if (!chosen) return;

      const confirmMessage = `Would you like to migrate all existing Minecraft servers to the new directory: "${chosen}"?\n\nThis will move all server files. It might take a moment if you have large servers.`;
      if (!window.confirm(confirmMessage)) return;

      setMigrationLoading(true);
      await changeServersDirectory(chosen);
      setServersDir(chosen);
      if (refreshServers) refreshServers();
      alert("Servers migrated successfully!");
    } catch (e: any) {
      alert("Migration failed: " + (e.message || e));
    } finally {
      setMigrationLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "2.5rem" }}>
      {/* Title */}
      <div>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>Global Settings</h1>
        <p style={{ color: "var(--accent-color)", margin: 0 }}>Manage global server configurations and system dependencies.</p>
      </div>

      {/* CurseForge API Key Card */}
      <div className="card" style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Key size={18} style={{ color: "#f16436" }} />
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>CurseForge API Key</h2>
          {cfStatus === "valid" && <CheckCircle size={16} color="var(--success-color)" />}
          {cfStatus === "invalid" && <AlertCircle size={16} color="var(--error-color)" />}
        </div>

        <p style={{ fontSize: "0.85rem", color: "var(--accent-color)", lineHeight: "1.5", margin: 0 }}>
          Required to search and install mods from CurseForge. Modrinth works without a key.{" "}
          <span onClick={() => BrowserOpenURL("https://console.curseforge.com/")} style={{ color: "var(--btn-primary-inner-color)", cursor: "pointer", textDecoration: "underline" }}>
            Get a free key at console.curseforge.com →
          </span>
        </p>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            className="form-input"
            type="password"
            placeholder="$2a$10$..."
            value={cfKey}
            onChange={(e) => { setCfKey(e.target.value); setCfStatus("idle"); }}
            style={{ flex: 1, height: "40px", fontFamily: "monospace", fontSize: "0.85rem" }}
          />
          <button
            className="button-normal"
            onClick={handleValidateCfKey}
            disabled={cfValidating || !cfKey.trim()}
            style={{ whiteSpace: "nowrap" }}
          >
            {cfValidating ? "Testing…" : "Test & Save"}
          </button>
          <button
            className="button-primary"
            onClick={handleSaveCfKey}
            disabled={cfSaving || !cfKey.trim()}
            style={{ whiteSpace: "nowrap" }}
          >
            {cfSaving ? "Saving…" : "Save"}
          </button>
        </div>

        {cfMessage && (
          <div style={{ fontSize: "0.82rem", color: cfStatus === "valid" ? "var(--success-color)" : cfStatus === "invalid" ? "var(--error-color)" : "var(--accent-color)" }}>
            {cfMessage}
          </div>
        )}
      </div>

      {/* Server Save Directory Card */}
      <div className="card" style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <FolderOpen size={18} style={{ color: "var(--btn-primary-inner-color)" }} />
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Server Save Directory</h2>
        </div>

        <p style={{ fontSize: "0.85rem", color: "var(--accent-color)", lineHeight: "1.5", margin: 0 }}>
          Specify where MACE server files and instances are stored on your disk.
        </p>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            className="form-input"
            type="text"
            readOnly
            value={serversDir || "Default (./servers)"}
            style={{ flex: 1, height: "40px", fontSize: "0.85rem", background: "rgba(255,255,255,0.02)", cursor: "default" }}
          />
          <button
            className="button-primary"
            onClick={handleChangeDirectory}
            disabled={migrationLoading}
            style={{ whiteSpace: "nowrap" }}
          >
            {migrationLoading ? "Migrating..." : "Change & Migrate"}
          </button>
        </div>
      </div>

      {/* Java Runtimes Card */}
      <div className="card" style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Database size={18} style={{ color: "var(--btn-primary-inner-color)" }} />
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Java Runtimes</h2>
          </div>
          <button
            onClick={runDetection}
            disabled={loading}
            className="button-normal"
          >
            <RotateCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Scan System
          </button>
        </div>

        <p style={{ fontSize: "0.85rem", color: "var(--accent-color)", lineHeight: "1.5", margin: 0 }}>
          MACE searches registry keys and standard folders (Program Files) to find Java JDKs and JREs.
          Use these exact paths inside your server instance configurations.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {javas.length === 0 ? (
            <p style={{ color: "var(--accent-color)", fontSize: "0.85rem", fontStyle: "italic", margin: 0 }}>
              No Java installations detected.
            </p>
          ) : (
            javas.map((j, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.75rem 1rem",
                  background: "var(--primary-color)",
                  border: "2px solid var(--hr-top-color)",
                  fontSize: "0.85rem",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{j.version}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--accent-color)", fontFamily: "monospace", marginTop: "2px" }}>
                    {j.path}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Diagnostics Card */}
      <div className="card" style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Cpu size={18} style={{ color: "var(--success-color)" }} />
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Engine Diagnostic Information</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", fontSize: "0.85rem" }}>
          <div style={{ padding: "0.75rem 1rem", background: "var(--primary-color)", border: "2px solid var(--hr-top-color)" }}>
            <div style={{ color: "var(--accent-color)", fontSize: "0.75rem", marginBottom: "4px" }}>Launcher Version</div>
            <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
              <Shield size={14} color="var(--success-color)" /> v0.1.0 (Alpha Build)
            </div>
          </div>

          <div style={{ padding: "0.75rem 1rem", background: "var(--primary-color)", border: "2px solid var(--hr-top-color)" }}>
            <div style={{ color: "var(--accent-color)", fontSize: "0.75rem", marginBottom: "4px" }}>Backend Engine</div>
            <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
              <Terminal size={14} color="var(--btn-primary-inner-color)" /> Go + Wails v2
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
