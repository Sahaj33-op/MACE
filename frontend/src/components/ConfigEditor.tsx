import { useState, useEffect, type FormEvent } from "react";
import type { ServerInstance } from "../ipc/types";
import { Save, AlertCircle, FileText, Settings, FolderOpen } from "lucide-react";
import { getServerProperties, updateServerConfig, detectJava, browseForBackupDir } from "../ipc/serverAPI";

interface ConfigEditorProps {
  server: ServerInstance;
  refreshServers: () => void;
}

// Parses a server.properties text blob into a key-value map.
const parseProperties = (text: string): Record<string, string> => {
  const props: Record<string, string> = {};
  text.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      props[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1);
    }
  });
  return props;
};

// Serialises key-value map back into the original text, preserving comments and ordering.
const rebuildProperties = (original: string, updated: Record<string, string>): string => {
  const handled = new Set<string>();
  const lines = original.split("\n").map((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.substring(0, idx).trim();
      if (updated[key] !== undefined) {
        handled.add(key);
        return `${key}=${updated[key]}`;
      }
    }
    return line;
  });
  Object.keys(updated).forEach((key) => {
    if (!handled.has(key)) lines.push(`${key}=${updated[key]}`);
  });
  return lines.join("\n");
};

// Known boolean keys in server.properties
const BOOLEAN_KEYS = new Set([
  "online-mode", "pvp", "enable-command-block", "allow-flight", "allow-nether",
  "spawn-monsters", "spawn-animals", "spawn-npcs", "force-gamemode", "white-list",
  "enforce-whitelist", "hardcore", "generate-structures", "require-resource-pack",
  "enable-rcon", "enable-query", "broadcast-console-to-ops", "broadcast-rcon-to-ops",
  "sync-chunk-writes", "prevent-proxy-connections", "use-native-transport",
  "accepts-transfers", "enable-jmx-monitoring", "log-ips",
]);

// Known enum keys and their options
const ENUM_KEYS: Record<string, { label: string; value: string }[]> = {
  "difficulty": [
    { label: "Peaceful", value: "peaceful" },
    { label: "Easy", value: "easy" },
    { label: "Normal", value: "normal" },
    { label: "Hard", value: "hard" },
  ],
  "gamemode": [
    { label: "Survival", value: "survival" },
    { label: "Creative", value: "creative" },
    { label: "Adventure", value: "adventure" },
    { label: "Spectator", value: "spectator" },
  ],
  "level-type": [
    { label: "Default", value: "minecraft:normal" },
    { label: "Flat", value: "minecraft:flat" },
    { label: "Large Biomes", value: "minecraft:large_biomes" },
    { label: "Amplified", value: "minecraft:amplified" },
    { label: "Single Biome", value: "minecraft:single_biome_surface" },
  ],
};

// Human-readable labels for common keys
const PROP_LABELS: Record<string, string> = {
  "difficulty": "Difficulty",
  "gamemode": "Default Gamemode",
  "level-type": "World Type",
  "online-mode": "Online Mode (Auth)",
  "pvp": "PvP Combat",
  "allow-flight": "Allow Flight",
  "allow-nether": "Allow Nether",
  "enable-command-block": "Command Blocks",
  "spawn-monsters": "Spawn Monsters",
  "spawn-animals": "Spawn Animals",
  "spawn-npcs": "Spawn NPCs (Villagers)",
  "force-gamemode": "Force Gamemode on Join",
  "white-list": "Enable Whitelist",
  "enforce-whitelist": "Enforce Whitelist",
  "hardcore": "Hardcore Mode",
  "generate-structures": "Generate Structures",
  "broadcast-console-to-ops": "Broadcast Console to Ops",
  "max-players": "Max Players",
  "view-distance": "View Distance (Chunks)",
  "simulation-distance": "Simulation Distance",
  "max-world-size": "Max World Size",
  "server-port": "Server Port",
  "motd": "Server MOTD",
  "level-name": "World Folder Name",
  "level-seed": "World Seed",
  "spawn-protection": "Spawn Protection Radius",
  "player-idle-timeout": "Player Idle Timeout (min)",
  "max-tick-time": "Max Tick Time (ms)",
  "network-compression-threshold": "Network Compression Threshold",
  "entity-broadcast-range-percentage": "Entity Broadcast Range (%)",
  "op-permission-level": "OP Permission Level",
  "function-permission-level": "Function Permission Level",
  "rcon.port": "RCON Port",
  "rcon.password": "RCON Password",
  "query.port": "Query Port",
  "resource-pack": "Resource Pack URL",
  "resource-pack-sha1": "Resource Pack SHA1",
  "require-resource-pack": "Require Resource Pack",
};

// Keys to show in the UI (ordered)
const ORDERED_KEYS = [
  "difficulty", "gamemode", "level-type", "level-name", "level-seed",
  "max-players", "view-distance", "simulation-distance",
  "online-mode", "pvp", "allow-flight", "allow-nether", "hardcore",
  "spawn-monsters", "spawn-animals", "spawn-npcs",
  "enable-command-block", "force-gamemode",
  "white-list", "enforce-whitelist", "generate-structures",
  "spawn-protection", "player-idle-timeout",
  "motd", "server-port",
  "broadcast-console-to-ops",
];

const labelStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "rgba(255,255,255,0.55)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: "0.4rem",
  display: "block",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
};

// A custom pill-toggle component
function TogglePill({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: "52px",
        height: "27px",
        borderRadius: "34px",
        border: "1px solid " + (checked ? "rgba(0,200,120,0.5)" : "rgba(255,255,255,0.15)"),
        background: checked
          ? "linear-gradient(135deg, #00b868, #00e676)"
          : "rgba(255,255,255,0.06)",
        position: "relative",
        cursor: "pointer",
        transition: "all 0.25s ease",
        boxShadow: checked ? "0 0 12px rgba(0,230,118,0.3)" : "none",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          width: "19px",
          height: "19px",
          borderRadius: "50%",
          background: "white",
          top: "3px",
          left: checked ? "28px" : "4px",
          transition: "left 0.25s ease",
          boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
        }}
      />
    </button>
  );
}

export default function ConfigEditor({ server, refreshServers }: ConfigEditorProps) {
  const [activeSubTab, setActiveSubTab] = useState<"general" | "properties">("general");

  // General Config State
  const [name, setName] = useState(server.name);
  const [memoryMB, setMemoryMB] = useState(server.memoryMB);
  const [port, setPort] = useState(server.port);
  const [watchdog, setWatchdog] = useState(server.watchdog);
  const [javaPath, setJavaPath] = useState(server.javaPath);
  const [version, setVersion] = useState(server.version);
  const [type, setType] = useState(server.type);
  const [backupPath, setBackupPath] = useState(server.backupPath || "");

  // Java Autocomplete List
  const [javas, setJavas] = useState<{ path: string; version: string }[]>([]);

  // Server.properties State
  const [rawProperties, setRawProperties] = useState("");
  const [parsedProps, setParsedProps] = useState<Record<string, string>>({});
  const [propsLoading, setPropsLoading] = useState(false);

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setName(server.name);
    setMemoryMB(server.memoryMB);
    setPort(server.port);
    setWatchdog(server.watchdog);
    setJavaPath(server.javaPath);
    setVersion(server.version);
    setType(server.type);
    setBackupPath(server.backupPath || "");

    detectJava().then(setJavas).catch(console.error);

    setPropsLoading(true);
    getServerProperties(server.id)
      .then((data) => {
        setRawProperties(data.properties);
        setParsedProps(parseProperties(data.properties));
        setPropsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load server.properties", err);
        setPropsLoading(false);
      });
  }, [server.id]);

  const handlePropChange = (key: string, value: string) => {
    const updated = { ...parsedProps, [key]: value };
    setParsedProps(updated);
    setRawProperties(rebuildProperties(rawProperties, updated));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveSuccess(false);
    try {
      await updateServerConfig({
        id: server.id,
        name,
        javaPath,
        memoryMB: Number(memoryMB),
        port: Number(port),
        watchdog,
        rawProps: activeSubTab === "properties" ? rawProperties : "",
        version,
        type,
        backupPath,
        playitEnabled: false,
      });
      setSaveSuccess(true);
      refreshServers();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert("Failed to save configuration: " + err);
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: "1.5rem" }}>
      {/* Settings Navigation Sub Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          borderBottom: "1px solid var(--border-glass)",
          paddingBottom: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        {([
          { key: "general", icon: <Settings size={15} />, label: "General Config" },
          { key: "properties", icon: <FileText size={15} />, label: "Server Properties" },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveSubTab(tab.key)}
            style={{
              background: activeSubTab === tab.key ? "rgba(255,255,255,0.07)" : "transparent",
              border: activeSubTab === tab.key ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
              borderRadius: "8px",
              color: activeSubTab === tab.key ? "#fff" : "rgba(255,255,255,0.4)",
              fontWeight: 600,
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              cursor: "pointer",
              padding: "0.45rem 0.85rem",
              transition: "all 0.2s",
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave}>
        {activeSubTab === "general" ? (
          /* ── General Settings ── */
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
              <div style={rowStyle}>
                <label style={labelStyle}>Instance Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div style={rowStyle}>
                <label style={labelStyle}>Server Port</label>
                <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} required />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
              <div style={rowStyle}>
                <label style={labelStyle}>RAM Limit (MB)</label>
                <input
                  type="number"
                  value={memoryMB}
                  onChange={(e) => setMemoryMB(Number(e.target.value))}
                  required
                />
              </div>
              <div style={rowStyle}>
                <label style={labelStyle}>Java Path</label>
                <select value={javaPath} onChange={(e) => setJavaPath(e.target.value)}>
                  {javas.map((j) => (
                    <option key={j.path} value={j.path}>
                      {j.version} ({j.path})
                    </option>
                  ))}
                  <option value="java">Default System (java)</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
              <div style={rowStyle}>
                <label style={labelStyle}>Minecraft Version</label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="e.g. 1.20.4"
                  required
                />
              </div>
              <div style={rowStyle}>
                <label style={labelStyle}>Server Loader / Type</label>
                <select value={type} onChange={(e) => setType(e.target.value as any)}>
                  <option value="vanilla">Vanilla (Official)</option>
                  <option value="spigot">Spigot (Plugins)</option>
                  <option value="paper">Paper (Optimized Plugins)</option>
                  <option value="fabric">Fabric (Mods)</option>
                  <option value="quilt">Quilt (Mods)</option>
                  <option value="forge">Forge (Mods)</option>
                  <option value="neoforge">NeoForge (Mods)</option>
                </select>
              </div>
            </div>

            {/* Backup Directory */}
            <div style={rowStyle}>
              <label style={labelStyle}>Backup Directory</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
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
                    } catch {
                      alert("Failed to open directory picker.");
                    }
                  }}
                  style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.4rem", whiteSpace: "nowrap" }}
                >
                  <FolderOpen size={14} /> Browse
                </button>
              </div>
              <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", margin: 0 }}>
                Tip: Use a separate drive or dedicated folder to protect backups.
              </p>
            </div>

            {/* Watchdog Toggle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "1rem 1.25rem",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div>
                <span style={{ fontWeight: 600, fontSize: "0.95rem", display: "block" }}>
                  Watchdog (Crash Auto-Restart)
                </span>
                <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.4)" }}>
                  Automatically restarts the server process if it crashes unexpectedly.
                </span>
              </div>
              <TogglePill checked={watchdog} onChange={setWatchdog} />
            </div>
          </div>
        ) : (
          /* ── Server Properties Editor ── */
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                background: "rgba(255,170,0,0.07)",
                border: "1px solid rgba(255,170,0,0.2)",
                color: "#ffb700",
                fontSize: "0.82rem",
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>Changes here directly affect gameplay. Incorrect values can prevent the server from starting.</span>
            </div>

            {propsLoading ? (
              <p style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "2rem 0" }}>
                Loading server.properties…
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                {ORDERED_KEYS.map((key, i) => {
                  const value = parsedProps[key];
                  if (value === undefined) return null;
                  const label = PROP_LABELS[key] || key;
                  const isBoolean = BOOLEAN_KEYS.has(key);
                  const enumOptions = ENUM_KEYS[key];
                  const isLast = i === ORDERED_KEYS.length - 1;

                  return (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.85rem 1rem",
                        borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.05)",
                        gap: "1rem",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "0.88rem",
                            color: "rgba(255,255,255,0.85)",
                            display: "block",
                          }}
                        >
                          {label}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.7rem",
                            color: "rgba(255,255,255,0.25)",
                          }}
                        >
                          {key}
                        </span>
                      </div>

                      {isBoolean ? (
                        <TogglePill
                          checked={value === "true"}
                          onChange={(v) => handlePropChange(key, v ? "true" : "false")}
                        />
                      ) : enumOptions ? (
                        <select
                          value={value}
                          onChange={(e) => handlePropChange(key, e.target.value)}
                          style={{ width: "auto", minWidth: "160px", margin: 0 }}
                        >
                          {enumOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={["max-players","view-distance","simulation-distance","spawn-protection","player-idle-timeout","max-world-size","server-port","op-permission-level","function-permission-level","rcon.port","query.port","entity-broadcast-range-percentage","network-compression-threshold","max-tick-time"].includes(key) ? "number" : "text"}
                          value={value}
                          onChange={(e) => handlePropChange(key, e.target.value)}
                          style={{
                            width: "auto",
                            minWidth: "140px",
                            maxWidth: "260px",
                            margin: 0,
                            textAlign: ["motd","level-name","level-seed","resource-pack","rcon.password","resource-pack-sha1"].includes(key) ? "left" : "right",
                          }}
                        />
                      )}
                    </div>
                  );
                })}

                {/* Raw textarea fallback for remaining unknown keys */}
                {Object.keys(parsedProps).some(
                  (k) => !ORDERED_KEYS.includes(k)
                ) && (
                  <div style={{ marginTop: "1rem" }}>
                    <label style={{ ...labelStyle, marginBottom: "0.6rem" }}>
                      Other / Advanced Properties (raw)
                    </label>
                    <textarea
                      value={Object.entries(parsedProps)
                        .filter(([k]) => !ORDERED_KEYS.includes(k))
                        .map(([k, v]) => `${k}=${v}`)
                        .join("\n")}
                      onChange={(e) => {
                        const extra = parseProperties(e.target.value);
                        const merged = { ...parsedProps };
                        // Remove old unknown keys
                        Object.keys(parsedProps).forEach((k) => {
                          if (!ORDERED_KEYS.includes(k)) delete merged[k];
                        });
                        // Add new ones
                        Object.assign(merged, extra);
                        setParsedProps(merged);
                        setRawProperties(rebuildProperties(rawProperties, merged));
                      }}
                      style={{
                        width: "100%",
                        height: "160px",
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.82rem",
                        background: "rgba(255,255,255,0.04)",
                        color: "rgba(255,255,255,0.85)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        padding: "0.85rem 1rem",
                        borderRadius: "8px",
                        resize: "vertical",
                        lineHeight: "1.7",
                      }}
                      placeholder="key=value&#10;key2=value2"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Save button */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "1.75rem" }}>
          <button
            type="submit"
            disabled={saveLoading}
            className="btn-primary"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <Save size={16} /> {saveLoading ? "Saving…" : "Save Configuration"}
          </button>

          {saveSuccess && (
            <span
              style={{
                color: "#00e676",
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              ✓ Configuration saved!
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
