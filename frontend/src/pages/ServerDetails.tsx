import { useState } from "react";
import type { ServerInstance } from "../ipc/types";
import { Terminal, Settings, FolderClosed, Puzzle, Archive, Users, ArrowLeft } from "lucide-react";
import Console from "../components/Console";
import ConfigEditor from "../components/ConfigEditor";
import ResourceMonitor from "../components/ResourceMonitor";
import InstanceContentManager from "../components/ContentManager";
import BackupManager from "../components/BackupManager";
import PlayerManager from "../components/PlayerManager";
import { startServer, stopServer, restartServer, killServer } from "../ipc/serverAPI";
import { useDialog } from "../context/DialogContext";

interface ServerDetailsProps {
  server: ServerInstance;
  refreshServers: () => void;
  onBack: () => void;
  onServerDeleted: () => void;
}

export default function ServerDetails({ server, refreshServers, onBack, onServerDeleted }: ServerDetailsProps) {
  const { alert, dangerConfirm } = useDialog();
  const [activeTab, setActiveTab] = useState<"terminal" | "players" | "config" | "mods" | "backups">("terminal");
  const [serverActionLoading, setServerActionLoading] = useState(false);

  const handleStart = async () => {
    setServerActionLoading(true);
    try { await startServer(server.id); refreshServers(); }
    catch (err: any) { await alert("Failed to start server: " + err.message, "Start Server Error"); }
    finally { setServerActionLoading(false); }
  };

  const handleStop = async () => {
    setServerActionLoading(true);
    try { await stopServer(server.id); refreshServers(); }
    catch (err: any) { await alert("Failed to stop server: " + err.message, "Stop Server Error"); }
    finally { setServerActionLoading(false); }
  };

  const handleRestart = async () => {
    setServerActionLoading(true);
    try { await restartServer(server.id); refreshServers(); }
    catch (err: any) { await alert("Failed to restart server: " + err.message, "Restart Server Error"); }
    finally { setServerActionLoading(false); }
  };

  const handleKill = async () => {
    const confirmed = await dangerConfirm(
      "Are you sure you want to forcefully kill this server process? Any unsaved world progress will be lost.",
      "Force Kill Server"
    );
    if (!confirmed) {
      return;
    }
    setServerActionLoading(true);
    try { await killServer(server.id); refreshServers(); }
    catch (err: any) { await alert("Failed to kill server: " + err.message, "Kill Server Error"); }
    finally { setServerActionLoading(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Top Navigation Row */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <button onClick={onBack} className="button-normal" style={{ padding: "0.5rem" }}>
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Back to Dashboard</h2>
      </div>

      {/* Header Panel */}
      <div
        className="card"
        style={{ padding: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}
      >
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.25rem" }}>
            {server.name}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.85rem", color: "var(--accent-color)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <FolderClosed size={14} /> {server.id}
            </span>
            <span>•</span>
            <span>Port: {server.port}</span>
          </div>
        </div>

        {/* Action Row */}
        <div className="mc-action-row" style={{ flexWrap: "wrap", alignItems: "center" }}>
          {/* Server control buttons */}
          <div className="mc-action-row" style={{ paddingRight: "0.75rem", borderRight: "3px solid var(--hr-top-color)", alignItems: "center" }}>
            <button
              onClick={handleStart}
              disabled={serverActionLoading || server.status !== "offline"}
              className="button-primary"
              style={{ opacity: server.status !== "offline" ? 0.5 : 1 }}
            >
              Start
            </button>
            <button
              onClick={handleRestart}
              disabled={serverActionLoading || server.status === "offline" || server.status === "installing"}
              className="button-secondary"
              style={{ opacity: (server.status === "offline" || server.status === "installing") ? 0.5 : 1 }}
            >
              Restart
            </button>
            <button
              onClick={handleStop}
              disabled={serverActionLoading || server.status === "offline" || server.status === "installing"}
              className="button-danger"
              style={{ opacity: (server.status === "offline" || server.status === "installing") ? 0.5 : 1 }}
            >
              Stop
            </button>
            <button
              onClick={handleKill}
              disabled={serverActionLoading || server.status === "offline" || server.status === "installing"}
              className="button-danger"
              style={{
                opacity: (server.status === "offline" || server.status === "installing") ? 0.5 : 1,
                backgroundColor: "#b91c1c",
                boxShadow: "inset 2px 2px 0 #ef4444, inset -2px -2px 0 #7f1d1d",
              }}
            >
              Kill
            </button>
          </div>

          {/* View tabs */}
          <button
            onClick={() => setActiveTab("terminal")}
            className={activeTab === "terminal" ? "button-primary" : "button-normal"}
          >
            <Terminal size={16} /> Console
          </button>
          <button
            onClick={() => setActiveTab("players")}
            className={activeTab === "players" ? "button-primary" : "button-normal"}
          >
            <Users size={16} /> Players
          </button>
          <button
            onClick={() => setActiveTab("config")}
            className={activeTab === "config" ? "button-primary" : "button-normal"}
          >
            <Settings size={16} /> Settings
          </button>
          <button
            onClick={() => setActiveTab("mods")}
            className={activeTab === "mods" ? "button-primary" : "button-normal"}
          >
            <Puzzle size={16} /> Mods & Plugins
          </button>
          <button
            onClick={() => setActiveTab("backups")}
            className={activeTab === "backups" ? "button-primary" : "button-normal"}
          >
            <Archive size={16} /> Backups
          </button>

        </div>
      </div>

      {/* Resource Monitor - only visible when server is running */}
      <ResourceMonitor
        serverId={server.id}
        serverStatus={server.status}
        allocatedMemoryMB={server.memoryMB}
      />

      {/* Tab Content */}
      <div style={{ paddingBottom: "2rem" }}>
        {activeTab === "terminal" ? (
          <Console key={server.id} serverId={server.id} serverName={server.name} />
        ) : activeTab === "players" ? (
          <PlayerManager key={server.id} serverId={server.id} serverStatus={server.status} />
        ) : activeTab === "mods" ? (
          <InstanceContentManager key={server.id} server={server} />
        ) : activeTab === "backups" ? (
          <BackupManager key={server.id} server={server} refreshServers={refreshServers} />
        ) : (
          <ConfigEditor key={server.id} server={server} refreshServers={refreshServers} onServerDeleted={onServerDeleted} />
        )}
      </div>
    </div>
  );
}
