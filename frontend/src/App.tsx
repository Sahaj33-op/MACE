import { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import ServerDetails from "./pages/ServerDetails";
import CreateServer from "./pages/CreateServer";
import ImportServer from "./pages/ImportServer";
import Settings from "./pages/Settings";
import CrashDialog from "./components/CrashDialog";
import FirstRunWizard from "./components/FirstRunWizard";
import { PlusCircle, FolderOpen, Settings as SettingsIcon, LayoutDashboard, Database } from "lucide-react";
import { listServers, detectJava, isFirstRun } from "./ipc/serverAPI";
import type { ServerInstance } from "./ipc/types";
import { BrowserOpenURL } from "../wailsjs/runtime/runtime";

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "server-details" | "create" | "import" | "settings">("dashboard");
  const [servers, setServers] = useState<ServerInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [javaDetected, setJavaDetected] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  // Poll server configurations every 3 seconds to keep UI synced
  const refreshServers = () => {
    listServers()
      .then((data) => {
        setServers(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch servers", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    // Check if this is the first run before loading servers
    isFirstRun()
      .then((firstRun) => {
        if (firstRun) {
          setShowWizard(true);
        }
      })
      .catch(() => {
        // If we can't reach the backend yet, assume not first run
      });

    refreshServers();
    const interval = setInterval(refreshServers, 3000);

    // Check Java installation
    detectJava().then((javas) => {
      setJavaDetected(javas.length > 0 && javas[0].version !== "Default System (java)");
    }).catch(console.error);

    return () => clearInterval(interval);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard servers={servers} setActiveTab={setActiveTab} refreshServers={refreshServers} onManageInstance={(id) => { setSelectedInstanceId(id); setActiveTab("server-details"); }} />;
      case "server-details":
        const selectedServer = servers.find(s => s.id === selectedInstanceId) || servers[0];
        if (!selectedServer) {
          setActiveTab("dashboard");
          return null;
        }
        return <ServerDetails server={selectedServer} refreshServers={refreshServers} onBack={() => setActiveTab("dashboard")} onServerDeleted={() => setActiveTab("dashboard")} />;
      case "create":
        return <CreateServer refreshServers={refreshServers} setActiveTab={setActiveTab} />;
      case "import":
        return <ImportServer refreshServers={refreshServers} setActiveTab={setActiveTab} />;
      case "settings":
        return <Settings refreshServers={refreshServers} />;
      default:
        return <Dashboard servers={servers} setActiveTab={setActiveTab} refreshServers={refreshServers} onManageInstance={(id) => { setSelectedInstanceId(id); setActiveTab("server-details"); }} />;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside
        style={{
          background: "var(--secondary-color)",
          borderRight: "4px solid var(--hr-top-color)",
          display: "flex",
          flexDirection: "column",
          padding: "2rem 1.5rem",
          justifyContent: "space-between",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
          {/* Logo Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img src="/appicon.png" alt="MACE Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "0.5px" }}>
                MACE
              </h2>
              <span style={{ fontSize: "0.7rem", color: "var(--success-color)", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ display: "inline-block", width: "6px", height: "6px", background: "var(--success-color)" }}></span>
                Engine Ready
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <button
              onClick={() => setActiveTab("dashboard")}
              className={activeTab === "dashboard" || activeTab === "server-details" ? "button-primary" : "button-normal"}
              style={{ width: "100%", justifyContent: "flex-start", gap: "1rem", padding: "0.75rem 1rem", margin: 0 }}
            >
              <LayoutDashboard size={18} />
              Dashboard
              {servers.length > 0 && (
                <span
                  style={{
                    marginLeft: "auto",
                    background: "var(--primary-color)",
                    fontSize: "0.75rem",
                    padding: "2px 8px",
                    color: "white",
                  }}
                >
                  {servers.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("create")}
              className={activeTab === "create" ? "button-primary" : "button-normal"}
              style={{ width: "100%", justifyContent: "flex-start", gap: "1rem", padding: "0.75rem 1rem", margin: 0 }}
            >
              <PlusCircle size={18} />
              New Instance
            </button>

            <button
              onClick={() => setActiveTab("import")}
              className={activeTab === "import" ? "button-primary" : "button-normal"}
              style={{ width: "100%", justifyContent: "flex-start", gap: "1rem", padding: "0.75rem 1rem", margin: 0 }}
            >
              <FolderOpen size={18} />
              Import Server
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={activeTab === "settings" ? "button-primary" : "button-normal"}
              style={{ width: "100%", justifyContent: "flex-start", gap: "1rem", padding: "0.75rem 1rem", margin: 0 }}
            >
              <SettingsIcon size={18} />
              Settings
            </button>
          </nav>
        </div>

        {/* Java Status Footer */}
        <div
          className="card"
          style={{
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            fontSize: "0.8rem",
            background: "var(--primary-color)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Database size={14} color={javaDetected ? "var(--success-color)" : "var(--error-color)"} />
            <span style={{ fontWeight: 700 }}>Java Status</span>
          </div>
          <p style={{ color: "var(--accent-color)", fontSize: "0.75rem", margin: 0 }}>
            {javaDetected ? "Auto-detected JDK on PATH" : "No JDK found! Set path in Settings."}
          </p>
        </div>

        {/* Social Links */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            paddingTop: "0.75rem",
          }}
        >
          <button
            onClick={() => BrowserOpenURL("https://github.com/wayback09/MACE")}
            title="Source Code on GitHub"
            style={{
              color: "var(--accent-color)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              background: "var(--primary-color)",
              border: "2px solid var(--hr-top-color)",
              transition: "color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-color)";
              e.currentTarget.style.borderColor = "var(--btn-primary-inner-color)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--accent-color)";
              e.currentTarget.style.borderColor = "var(--hr-top-color)";
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </button>
          <button
            onClick={() => BrowserOpenURL("https://discord.com/invite/zrrHQC4QKF")}
            title="Join our Discord"
            style={{
              color: "var(--accent-color)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              background: "var(--primary-color)",
              border: "2px solid var(--hr-top-color)",
              transition: "color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#5865F2";
              e.currentTarget.style.borderColor = "#5865F2";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--accent-color)";
              e.currentTarget.style.borderColor = "var(--hr-top-color)";
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
          </button>
          <button
            onClick={() => BrowserOpenURL("https://github.com/wayback09/MACE/issues")}
            title="Report an Issue"
            style={{
              color: "var(--accent-color)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              background: "var(--primary-color)",
              border: "2px solid var(--hr-top-color)",
              transition: "color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-color)";
              e.currentTarget.style.borderColor = "var(--btn-primary-inner-color)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--accent-color)";
              e.currentTarget.style.borderColor = "var(--hr-top-color)";
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Main Page Area */}
      {showWizard && (
        <FirstRunWizard onComplete={() => setShowWizard(false)} />
      )}

      <main style={{ padding: "2.5rem", overflowY: "auto", maxHeight: "100vh" }}>
        {loading ? (
          <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  border: "4px solid var(--hr-bottom-color)",
                  borderTop: "4px solid var(--btn-primary-inner-color)",
                  width: "40px",
                  height: "40px",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto 1rem",
                }}
              />
              <p style={{ color: "var(--accent-color)" }}>Connecting to control engine...</p>
            </div>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : (
          renderContent()
        )}
      </main>
      <CrashDialog />
    </div>
  );
}
