import { useState, type MouseEvent } from "react";
import type { ServerInstance } from "../ipc/types";
import { Play, Square, Terminal, Cpu, HardDrive, RefreshCw } from "lucide-react";
import { startServer, stopServer } from "../ipc/serverAPI";
import { useDialog } from "../context/DialogContext";

interface ServerCardProps {
  server: ServerInstance;
  refreshServers: () => void;
  onManage: () => void;
}

export default function ServerCard({ server, refreshServers, onManage }: ServerCardProps) {
  const { alert } = useDialog();
  const [actionLoading, setActionLoading] = useState(false);

  const handleStart = async (e: MouseEvent) => {
    e.stopPropagation();
    setActionLoading(true);
    try {
      await startServer(server.id);
      refreshServers();
    } catch (err) {
      await alert("Failed to start server: " + err, "Start Server Error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async (e: MouseEvent) => {
    e.stopPropagation();
    setActionLoading(true);
    try {
      await stopServer(server.id);
      refreshServers();
    } catch (err) {
      await alert("Failed to stop server: " + err, "Stop Server Error");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = () => {
    switch (server.status) {
      case "online":      return "var(--success-color)";
      case "starting":
      case "restarting":  return "var(--warning-color)";
      case "stopping":    return "var(--error-color)";
      case "installing":  return "var(--btn-primary-inner-color)";
      default:            return "var(--accent-color)";
    }
  };

  const getStatusLabel = () => server.status.charAt(0).toUpperCase() + server.status.slice(1);

  return (
    <div
      className="card"
      style={{
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Status side stripe */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "4px",
          height: "100%",
          background: getStatusColor(),
        }}
      />

      {/* Header Info */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.25rem" }}>{server.name}</h3>
          <span
            style={{
              fontSize: "0.75rem",
              background: "var(--primary-color)",
              padding: "2px 8px",
              color: "var(--accent-color)",
              textTransform: "capitalize",
              border: "1px solid var(--hr-top-color)",
            }}
          >
            {server.type} • {server.version}
          </span>
        </div>

        {/* Status Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              background: getStatusColor(),
            }}
          />
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: getStatusColor() }}>
            {getStatusLabel()}
          </span>
        </div>
      </div>

      {/* Server Specs & Port */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          padding: "0.75rem",
          background: "var(--primary-color)",
          border: "1px solid var(--hr-top-color)",
          fontSize: "0.85rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Cpu size={14} style={{ color: "var(--accent-color)" }} />
          <div>
            <div style={{ fontSize: "0.7rem", color: "var(--accent-color)" }}>Memory</div>
            <div style={{ fontWeight: 600 }}>{server.memoryMB} MB</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <HardDrive size={14} style={{ color: "var(--accent-color)" }} />
          <div>
            <div style={{ fontSize: "0.7rem", color: "var(--accent-color)" }}>Connection</div>
            <div style={{ fontWeight: 600 }}>Port {server.port}</div>
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "auto" }}>
        {server.status === "offline" ? (
          <button
            onClick={handleStart}
            disabled={actionLoading}
            className="button-primary"
            style={{
              flex: 1,
              opacity: actionLoading ? 0.6 : 1,
            }}
          >
            <Play size={16} /> Start
          </button>
        ) : (
          <button
            onClick={handleStop}
            disabled={actionLoading || server.status === "stopping" || server.status === "installing"}
            className="button-danger"
            style={{
              flex: 1,
              opacity: actionLoading || server.status === "stopping" ? 0.6 : 1,
            }}
          >
            {actionLoading || server.status === "stopping" ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Square size={16} />
            )}
            {server.status === "stopping" ? "Stopping..." : "Stop"}
          </button>
        )}

        {/* Manage / Console button */}
        <button
          onClick={onManage}
          className="button-normal"
          title="Open Console & Settings"
        >
          <Terminal size={18} />
        </button>
      </div>
    </div>
  );
}
