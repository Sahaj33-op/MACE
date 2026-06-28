import { useState, useEffect, useCallback } from "react";
import type { BackupItem } from "../ipc/types";
import { listBackups, restoreBackup, deleteBackup, createBackupWithOptions } from "../ipc/serverAPI";
import { Archive, RotateCcw, Trash2, Plus, Loader2, AlertTriangle } from "lucide-react";

interface BackupManagerProps {
  serverId: string;
  serverName: string;
  backupPath: string;
}

export default function BackupManager({ serverId, backupPath }: BackupManagerProps) {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoringName, setRestoringName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Custom backup options
  const [incWorld, setIncWorld] = useState(true);
  const [incPlugins, setIncPlugins] = useState(false);
  const [incConfigs, setIncConfigs] = useState(true);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listBackups(serverId);
      setBackups(items || []);
    } catch (err: any) {
      setError("Failed to load backups: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleCreate = async () => {
    if (!incWorld && !incPlugins && !incConfigs) {
      setError("Please select at least one component to include in the backup.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createBackupWithOptions(serverId, incWorld, incPlugins, incConfigs);
      await fetchBackups();
    } catch (err: any) {
      setError("Failed to create backup: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (fileName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to restore "${fileName}"?\n\nThis will stop the server (if running), archive the current world, and replace it with this backup.`
    );
    if (!confirmed) return;

    setRestoringName(fileName);
    setError(null);
    try {
      await restoreBackup(serverId, fileName);
      alert("Backup restored successfully!");
      await fetchBackups();
    } catch (err: any) {
      setError("Failed to restore backup: " + err.message);
    } finally {
      setRestoringName(null);
    }
  };

  const handleDelete = async (fileName: string) => {
    const confirmed = window.confirm(`Delete backup "${fileName}"? This cannot be undone.`);
    if (!confirmed) return;

    setError(null);
    try {
      await deleteBackup(serverId, fileName);
      await fetchBackups();
    } catch (err: any) {
      setError("Failed to delete backup: " + err.message);
    }
  };

  const formatDate = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const formatSize = (sizeKB: number): string => {
    if (sizeKB >= 1024) {
      return `${(sizeKB / 1024).toFixed(1)} MB`;
    }
    return `${sizeKB} KB`;
  };

  return (
    <div className="card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Archive size={20} />
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Backups</h2>
          <span
            style={{
              fontSize: "0.75rem",
              padding: "2px 8px",
              borderRadius: "4px",
              background: "rgba(255,255,255,0.06)",
              color: "var(--accent-color)",
            }}
          >
            {backups.length} backup{backups.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="button-primary"
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}
        >
          {creating ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
          {creating ? "Creating..." : "Create Backup"}
        </button>
      </div>

      {/* Backup components selection */}
      <div style={{ display: "flex", gap: "1.5rem", padding: "0.75rem 1rem", borderRadius: "6px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--accent-color)" }}>Include:</span>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer", margin: 0 }}>
          <input
            type="checkbox"
            checked={incWorld}
            onChange={(e) => setIncWorld(e.target.checked)}
          />
          World
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer", margin: 0 }}>
          <input
            type="checkbox"
            checked={incPlugins}
            onChange={(e) => setIncPlugins(e.target.checked)}
          />
          Plugins / Mods
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer", margin: 0 }}>
          <input
            type="checkbox"
            checked={incConfigs}
            onChange={(e) => setIncConfigs(e.target.checked)}
          />
          Configs
        </label>
      </div>

      {/* Backup path info */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.5rem",
          padding: "0.75rem 1rem",
          borderRadius: "6px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          fontSize: "0.8rem",
          color: "var(--accent-color)",
        }}
      >
        <AlertTriangle size={14} style={{ marginTop: "2px", flexShrink: 0, color: "var(--warning-color)" }} />
        <div>
          <span style={{ fontWeight: 600 }}>Backup location: </span>
          <span style={{ wordBreak: "break-all" }}>{backupPath || "Default (server/backups/)"}</span>
          <div style={{ marginTop: "4px", opacity: 0.7 }}>
            Tip: Place backups on a separate drive or dedicated folder to prevent accidental deletion.
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "6px",
            background: "rgba(255,80,80,0.1)",
            border: "1px solid rgba(255,80,80,0.3)",
            color: "var(--error-color)",
            fontSize: "0.85rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Backup list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "var(--accent-color)" }}>
          <Loader2 size={24} className="spin" />
          <p style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>Loading backups...</p>
        </div>
      ) : backups.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "var(--accent-color)" }}>
          <Archive size={36} style={{ opacity: 0.2, marginBottom: "0.75rem" }} />
          <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>No backups yet</p>
          <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>
            Click "Create Backup" to save a snapshot of your world and configuration files.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {backups.map((backup) => (
            <div
              key={backup.fileName}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.75rem 1rem",
                borderRadius: "6px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{backup.fileName}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--accent-color)" }}>
                  {formatDate(backup.createdAt)} • {formatSize(backup.sizeKB)}
                </span>
              </div>
              <div className="mc-action-row" style={{ gap: "0.5rem" }}>
                <button
                  onClick={() => handleRestore(backup.fileName)}
                  disabled={restoringName !== null}
                  className="button-secondary"
                  title="Restore this backup"
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem", margin: 0, padding: "0.4rem 0.75rem" }}
                >
                  {restoringName === backup.fileName ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <RotateCcw size={14} />
                  )}
                  Restore
                </button>
                <button
                  onClick={() => handleDelete(backup.fileName)}
                  disabled={restoringName !== null}
                  className="button-tertiary"
                  title="Delete this backup"
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem", margin: 0, padding: "0.4rem 0.75rem" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
