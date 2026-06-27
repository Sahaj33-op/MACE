import type { ServerInstance } from "../ipc/types";
import { Server, Activity, PowerOff, Zap, Plus } from "lucide-react";
import ServerCard from "./ServerCard";

interface DashboardProps {
  servers: ServerInstance[];
  setActiveTab: (tab: "dashboard" | "server-details" | "create" | "settings" | "import") => void;
  refreshServers: () => void;
  onManageInstance: (id: string) => void;
}

export default function Dashboard({ servers, setActiveTab, refreshServers, onManageInstance }: DashboardProps) {
  const activeCount = servers.filter((s) => s.status === "online" || s.status === "starting").length;
  const offlineCount = servers.filter((s) => s.status === "offline").length;
  const totalRAM = servers
    .filter((s) => s.status === "online" || s.status === "starting" || s.status === "stopping")
    .reduce((sum, s) => sum + s.memoryMB, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
      {/* Title */}
      <div>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>System Overview</h1>
        <p style={{ color: "var(--accent-color)", margin: 0 }}>Monitor system load and active Minecraft server instances.</p>
      </div>

      {/* Stats Counter Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem" }}>
        <div className="card" style={{ padding: "1.5rem", display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <div style={{ padding: "0.75rem", background: "var(--primary-color)", border: "2px solid var(--btn-primary-border-color)", color: "var(--btn-primary-inner-color)" }}>
            <Server size={24} />
          </div>
          <div>
            <span style={{ fontSize: "0.85rem", color: "var(--accent-color)" }}>Total Instances</span>
            <h3 style={{ fontSize: "1.75rem", fontWeight: 700 }}>{servers.length}</h3>
          </div>
        </div>

        <div className="card" style={{ padding: "1.5rem", display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <div style={{ padding: "0.75rem", background: "var(--primary-color)", border: "2px solid var(--btn-primary-border-color)", color: "var(--success-color)" }}>
            <Activity size={24} />
          </div>
          <div>
            <span style={{ fontSize: "0.85rem", color: "var(--accent-color)" }}>Running</span>
            <h3 style={{ fontSize: "1.75rem", fontWeight: 700 }}>{activeCount}</h3>
          </div>
        </div>

        <div className="card" style={{ padding: "1.5rem", display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <div style={{ padding: "0.75rem", background: "var(--primary-color)", border: "2px solid var(--btn-primary-border-color)", color: "var(--error-color)" }}>
            <PowerOff size={24} />
          </div>
          <div>
            <span style={{ fontSize: "0.85rem", color: "var(--accent-color)" }}>Offline</span>
            <h3 style={{ fontSize: "1.75rem", fontWeight: 700 }}>{offlineCount}</h3>
          </div>
        </div>

        <div className="card" style={{ padding: "1.5rem", display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <div style={{ padding: "0.75rem", background: "var(--primary-color)", border: "2px solid var(--btn-primary-border-color)", color: "var(--warning-color)" }}>
            <Zap size={24} />
          </div>
          <div>
            <span style={{ fontSize: "0.85rem", color: "var(--accent-color)" }}>Allocated RAM</span>
            <h3 style={{ fontSize: "1.75rem", fontWeight: 700 }}>
              {(totalRAM / 1024).toFixed(1)} <span style={{ fontSize: "1rem", color: "var(--accent-color)" }}>GB</span>
            </h3>
          </div>
        </div>
      </div>

      {/* Main Server Grid / Call-to-action */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Active Instances</h2>
          {servers.length > 0 && (
            <button
              onClick={() => setActiveTab("create")}
              className="button-primary"
            >
              <Plus size={16} /> Add Server
            </button>
          )}
        </div>

        {servers.length === 0 ? (
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
                width: "80px",
                height: "80px",
                background: "var(--primary-color)",
                border: "4px solid var(--btn-primary-inner-color)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--btn-primary-inner-color)",
              }}
            >
              <Server size={36} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>No server instances found</h3>
              <p style={{ color: "var(--accent-color)", maxWidth: "400px", margin: "0 auto" }}>
                Create a new Minecraft server with auto-downloading JARs, customizable RAM, and live console output.
              </p>
            </div>
            <button
              onClick={() => setActiveTab("create")}
              className="button-primary"
            >
              <Plus size={16} /> Create Your First Server
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
            {servers.map((server) => (
              <ServerCard key={server.id} server={server} refreshServers={refreshServers} onManage={() => onManageInstance(server.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
