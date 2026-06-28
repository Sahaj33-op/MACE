import { useState, useEffect } from "react";
import { Cpu, RotateCw, Database, Terminal, Shield, Key, CheckCircle, AlertCircle, FolderOpen, Calendar, Plus, Trash2, Edit2 } from "lucide-react";
import { detectJava, getAppSettings, saveAppSettings, validateCurseForgeKey, pickServersDirectory, changeServersDirectory, listScheduledTasks, createScheduledTask, updateScheduledTask, deleteScheduledTask, listServers } from "../ipc/serverAPI";
import type { JavaInstall, ScheduledTask, ServerInstance, AppSettings } from "../ipc/types";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";
import { useDialog } from "../context/DialogContext";

interface SettingsProps {
  refreshServers?: () => void;
}

export default function Settings({ refreshServers }: SettingsProps) {
  const { alert, confirm, dangerConfirm } = useDialog();
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

  // Scheduled Tasks state
  const [servers, setServers] = useState<ServerInstance[]>([]);
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);

  // Form state
  const [taskServerId, setTaskServerId] = useState("all");
  const [taskAction, setTaskAction] = useState("backup");
  const [taskCustomCommand, setTaskCustomCommand] = useState("");
  const [taskCron, setTaskCron] = useState("0 4 * * *");
  const [taskSubmitting, setTaskSubmitting] = useState(false);

  const runDetection = () => {
    setLoading(true);
    detectJava()
      .then((data) => { setJavas(data); setLoading(false); })
      .catch((err) => { console.error("Failed to detect java environments", err); setLoading(false); });
  };

  const loadTasks = () => {
    listScheduledTasks().then(setTasks).catch(() => { });
  };

  useEffect(() => {
    runDetection();
    getAppSettings().then((s: AppSettings) => {
      if (s?.curseForgeApiKey) {
        setCfKey(s.curseForgeApiKey);
        setCfStatus("valid");
      }
      if (s?.serversDir) {
        setServersDir(s.serversDir);
      }
    }).catch(() => { });
    listServers().then(setServers).catch(() => { });
    loadTasks();
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
      const confirmed = await confirm(confirmMessage, "Migrate Servers");
      if (!confirmed) return;

      setMigrationLoading(true);
      await changeServersDirectory(chosen);
      setServersDir(chosen);
      if (refreshServers) refreshServers();
      await alert("Servers migrated successfully!", "Migration Success");
    } catch (e: any) {
      await alert("Migration failed: " + (e.message || e), "Migration Error");
    } finally {
      setMigrationLoading(false);
    }
  };

  const describeCron = (expr: string): string => {
    if (!expr) return "";
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) return "Invalid expression";
    const [min, hour, day, month, dow] = parts;

    if (min === "*" && hour === "*" && day === "*" && month === "*" && dow === "*") {
      return "Every minute";
    }
    if (min.startsWith("*/") && hour === "*" && day === "*" && month === "*" && dow === "*") {
      const m = min.split("/")[1];
      return `Every ${m} minutes`;
    }
    if (min === "0" && hour.startsWith("*/") && day === "*" && month === "*" && dow === "*") {
      const h = hour.split("/")[1];
      return `Every ${h} hours`;
    }
    if (min === "0" && !isNaN(Number(hour)) && day === "*" && month === "*" && dow === "*") {
      return `Every day at ${hour.padStart(2, '0')}:00`;
    }
    if (min === "0" && !isNaN(Number(hour)) && day === "*" && month === "*" && dow !== "*") {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const dStr = dow.split(",").map(d => days[Number(d)] || d).join(", ");
      return `Every ${dStr} at ${hour.padStart(2, '0')}:00`;
    }
    return "Custom schedule";
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (taskSubmitting) return; // prevent double submission
    const actionVal = taskAction === "custom" ? taskCustomCommand : taskAction;
    if (!actionVal.trim()) {
      await alert("Please specify a command or action", "Invalid Input");
      return;
    }
    const serverName = taskServerId === "all" ? "All Servers" : (servers.find((s: ServerInstance) => s.id === taskServerId)?.name || "Unknown Server");
    const payload: ScheduledTask = {
      id: editingTask?.id || "",
      serverId: taskServerId,
      serverName,
      cronExpression: taskCron,
      action: actionVal,
      lastRun: editingTask?.lastRun || "",
    };

    setTaskSubmitting(true);
    try {
      if (editingTask) {
        await updateScheduledTask(payload);
      } else {
        await createScheduledTask(payload);
      }
      loadTasks();
      setShowModal(false);
      setEditingTask(null);
    } catch (err: any) {
      await alert("Failed to save scheduled task: " + err, "Save Task Error");
    } finally {
      setTaskSubmitting(false);
    }
  };

  const handleDeleteTask = async (id: string) => {
    const confirmed = await dangerConfirm("Are you sure you want to delete this scheduled task?", "Delete Scheduled Task");
    if (!confirmed) return;
    try {
      await deleteScheduledTask(id);
      loadTasks();
    } catch (err: any) {
      await alert("Failed to delete task: " + err, "Delete Task Error");
    }
  };

  const openCreateModal = () => {
    setEditingTask(null);
    setTaskServerId("all");
    setTaskAction("backup");
    setTaskCustomCommand("");
    setTaskCron("0 4 * * *");
    setShowModal(true);
  };

  const openEditModal = (task: ScheduledTask) => {
    setEditingTask(task);
    setTaskServerId(task.serverId);
    if (["start", "stop", "restart", "backup"].includes(task.action)) {
      setTaskAction(task.action);
      setTaskCustomCommand("");
    } else {
      setTaskAction("custom");
      setTaskCustomCommand(task.action);
    }
    setTaskCron(task.cronExpression);
    setShowModal(true);
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
          <button type="button" onClick={() => BrowserOpenURL("https://console.curseforge.com/")} style={{ background: "none", border: "none", padding: 0, color: "var(--btn-primary-inner-color)", cursor: "pointer", textDecoration: "underline", fontSize: "inherit", fontFamily: "inherit" }}>
            Get a free key at console.curseforge.com →
          </button>
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
            javas.map((j: JavaInstall, idx: number) => (
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

      {/* Scheduler Card */}
      <div className="card" style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Calendar size={18} style={{ color: "var(--btn-primary-inner-color)" }} />
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Scheduled Tasks</h2>
          </div>
          <button
            type="button"
            className="button-primary"
            onClick={openCreateModal}
            style={{
              margin: 0,
              padding: "0.4rem 0.8rem",
              fontSize: "0.8rem",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem"
            }}
          >
            <Plus size={14} /> Add Task
          </button>
        </div>

        <p style={{ fontSize: "0.85rem", color: "var(--accent-color)", lineHeight: "1.5", margin: 0 }}>
          Configure automated tasks using standard cron expressions to automatically start, stop, restart, backup, or execute custom commands on Minecraft servers.
        </p>

        <div style={{ overflowX: "auto" }}>
          {tasks.length === 0 ? (
            <p style={{ color: "var(--accent-color)", fontSize: "0.85rem", fontStyle: "italic", margin: "1rem 0 0 0" }}>
              No scheduled tasks configured.
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", marginTop: "0.5rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--hr-top-color)", color: "var(--accent-color)" }}>
                  <th style={{ textAlign: "left", padding: "0.6rem 0.4rem" }}>Target Server</th>
                  <th style={{ textAlign: "left", padding: "0.6rem 0.4rem" }}>Cron Expression</th>
                  <th style={{ textAlign: "left", padding: "0.6rem 0.4rem" }}>Action</th>
                  <th style={{ textAlign: "left", padding: "0.6rem 0.4rem" }}>Last Run</th>
                  <th style={{ textAlign: "right", padding: "0.6rem 0.4rem" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task: ScheduledTask) => (
                  <tr key={task.id} style={{ borderBottom: "1px solid var(--hr-bottom-color)" }}>
                    <td style={{ padding: "0.75rem 0.4rem", fontWeight: 600 }}>{task.serverName}</td>
                    <td style={{ padding: "0.75rem 0.4rem" }}>
                      <code style={{ background: "rgba(255,255,255,0.06)", padding: "0.2rem 0.4rem", borderRadius: "4px" }}>
                        {task.cronExpression}
                      </code>
                      <div style={{ fontSize: "0.72rem", color: "var(--accent-color)", marginTop: "2px" }}>
                        {describeCron(task.cronExpression)}
                      </div>
                    </td>
                    <td style={{ padding: "0.75rem 0.4rem" }}>
                      <span
                        style={{
                          textTransform: "capitalize",
                          padding: "0.15rem 0.4rem",
                          background: ["start", "stop", "restart", "backup"].includes(task.action) ? "rgba(0,180,0,0.1)" : "rgba(241,100,54,0.1)",
                          border: ["start", "stop", "restart", "backup"].includes(task.action) ? "1px solid rgba(0,180,0,0.2)" : "1px solid rgba(241,100,54,0.2)",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          color: ["start", "stop", "restart", "backup"].includes(task.action) ? "#86efac" : "#ffedd5",
                        }}
                      >
                        {task.action}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 0.4rem", color: "var(--accent-color)" }}>
                      {task.lastRun ? new Date(task.lastRun).toLocaleString() : "Never"}
                    </td>
                    <td style={{ padding: "0.75rem 0.4rem", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                        <button
                          type="button"
                          onClick={() => openEditModal(task)}
                          className="button-normal"
                          style={{ padding: "0.3rem", margin: 0 }}
                          title="Edit Task"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task.id)}
                          className="button-danger"
                          style={{ padding: "0.3rem", margin: 0 }}
                          title="Delete Task"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {/* Task Edit Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999,
          }}
        >
          <form
            onSubmit={handleSaveTask}
            className="card"
            style={{
              width: "480px",
              padding: "1.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              background: "#0d0e0d",
              border: "3px solid var(--hr-top-color)"
            }}
          >
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
              {editingTask ? "Edit Scheduled Task" : "Add Scheduled Task"}
            </h3>

            {/* Target Server */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Target Server</label>
              <select
                className="form-input"
                value={taskServerId}
                onChange={(e) => setTaskServerId(e.target.value)}
                style={{ height: "40px" }}
              >
                <option value="all">All Servers</option>
                {servers.map((s: ServerInstance) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                ))}
              </select>
            </div>

            {/* Action */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Action</label>
              <select
                className="form-input"
                value={taskAction}
                onChange={(e) => setTaskAction(e.target.value)}
                style={{ height: "40px" }}
              >
                <option value="start">Start Server</option>
                <option value="stop">Stop Server</option>
                <option value="restart">Restart Server</option>
                <option value="backup">Full Backup</option>
                <option value="custom">Custom Console Command</option>
              </select>
            </div>

            {/* Custom Command Input */}
            {taskAction === "custom" && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Console Command</label>
                <input
                  type="text"
                  className="form-input"
                  value={taskCustomCommand}
                  onChange={(e) => setTaskCustomCommand(e.target.value)}
                  placeholder="e.g. /say Hello World"
                  required
                />
              </div>
            )}

            {/* Cron Expression */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Cron Expression (5-field)</label>
              <input
                type="text"
                className="form-input"
                value={taskCron}
                onChange={(e) => setTaskCron(e.target.value)}
                placeholder="e.g. 0 4 * * *"
                required
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", marginTop: "4px" }}>
                <span style={{ color: "var(--accent-color)" }}>Format: Min Hour Day Month DayOfWeek</span>
                <span style={{ color: "var(--btn-primary-inner-color)", fontWeight: 600 }}>{describeCron(taskCron)}</span>
              </div>
            </div>

            {/* Presets */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--accent-color)" }}>Expression Presets:</span>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {[
                  { label: "Every 5 Min", expr: "*/5 * * * *" },
                  { label: "Hourly", expr: "0 * * * *" },
                  { label: "Daily at 4 AM", expr: "0 4 * * *" },
                  { label: "Weekly (Sunday)", expr: "0 4 * * 0" },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="button-normal"
                    onClick={() => setTaskCron(preset.expr)}
                    style={{ margin: 0, padding: "0.25rem 0.5rem", fontSize: "0.7rem" }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cancel / Save */}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <button
                type="button"
                className="button-normal"
                onClick={() => { setShowModal(false); setEditingTask(null); }}
                style={{ margin: 0, padding: "0.5rem 1rem", fontSize: "0.85rem" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button-primary"
                disabled={taskSubmitting}
                style={{ margin: 0, padding: "0.5rem 1rem", fontSize: "0.85rem" }}
              >
                {editingTask ? "Save Changes" : "Create Task"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
