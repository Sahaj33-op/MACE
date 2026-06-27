import { useState } from "react";
import { FolderOpen } from "lucide-react";
import { importServer, browseForServerDir } from "../ipc/serverAPI";

export default function ImportServer({ 
  refreshServers, 
  setActiveTab 
}: { 
  refreshServers: () => void;
  setActiveTab: (tab: "dashboard" | "server-details" | "create" | "settings" | "import") => void;
}) {
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleBrowse = async () => {
    try {
      const selectedPath = await browseForServerDir();
      if (selectedPath) {
        setPath(selectedPath);
        // Extract a default name from the directory path if no name exists
        if (!name) {
          const parts = selectedPath.split(/[/\\]/);
          const dirName = parts[parts.length - 1];
          if (dirName) {
            // Capitalize first letter
            setName(dirName.charAt(0).toUpperCase() + dirName.slice(1));
          }
        }
      }
    } catch (err: any) {
      console.error("Browse failed:", err);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!path.trim()) {
      setError("Please select a server directory path.");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      await importServer({ path, name });
      refreshServers();
      setActiveTab("dashboard");
    } catch (err: any) {
      console.error("Failed to import server:", err);
      const msg = typeof err === "string" ? err : err.message;
      setError(msg || "Failed to import server. Ensure the directory contains a server jar or run script.");
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", animation: "fadeIn 0.3s ease-out" }}>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
        <FolderOpen size={32} color="var(--btn-primary-inner-color)" />
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: 0, letterSpacing: "1px" }}>Import Server</h1>
          <p style={{ color: "var(--accent-color)", margin: "0.25rem 0 0 0" }}>Hook into an existing Minecraft server directory</p>
        </div>
      </div>

      <form onSubmit={handleImport} className="card" style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
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
            <div style={{ width: "20px", height: "20px", background: "var(--error-color)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>!</div>
            {error}
          </div>
        )}

        <div style={{ background: "rgba(0,0,0,0.2)", padding: "1.5rem", border: "2px dashed var(--hr-top-color)", borderRadius: "8px" }}>
          <p style={{ color: "var(--accent-color)", marginBottom: "1rem", fontSize: "0.9rem" }}>
            MACE can take over management of an existing server without moving your files. Select a folder that contains your `server.jar` or `run.bat`/`run.sh` script.
          </p>
          
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--accent-color)" }}>Server Directory</label>
          <div style={{ display: "flex", gap: "1rem" }}>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="form-input"
              placeholder="C:\Path\To\Your\Server"
              style={{ flex: 1, padding: "0.75rem", fontSize: "1rem" }}
              required
            />
            <button 
              type="button" 
              onClick={handleBrowse}
              className="button-normal" 
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <FolderOpen size={18} /> Browse
            </button>
          </div>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "var(--accent-color)" }}>Display Name (Optional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-input"
            placeholder="e.g. My Survival Server"
            style={{ width: "100%", padding: "0.75rem", fontSize: "1rem" }}
          />
          <span style={{ display: "block", marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--accent-color)" }}>
            Leave blank to auto-detect from the server.properties motd or folder name.
          </span>
        </div>

        <div style={{ marginTop: "1rem", display: "flex", gap: "1rem", justifyContent: "flex-end", borderTop: "2px solid var(--hr-top-color)", paddingTop: "1.5rem" }}>
          <button type="button" onClick={() => setActiveTab("dashboard")} className="button-normal" disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="button-primary" disabled={loading} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {loading ? "Scanning..." : "Import Server"}
          </button>
        </div>
      </form>
    </div>
  );
}
