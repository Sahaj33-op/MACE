import { useState, useEffect } from "react";
import { onServerCrashed } from "../ipc/serverAPI";
import { AlertTriangle, X, MessageSquare, RefreshCw } from "lucide-react";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";
import { useDialog } from "../context/DialogContext";

interface CrashInfo {
  instanceId: string;
  reason: string;
  resolution: string;
}

export default function CrashDialog() {
  const { alert } = useDialog();
  const [crash, setCrash] = useState<CrashInfo | null>(null);

  useEffect(() => {
    // Register the crash listener from Wails
    const unsubscribe = onServerCrashed((data) => {
      setCrash(data);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (!crash) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(10, 11, 13, 0.85)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "2rem",
        animation: "fadeIn 0.25s ease-out",
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "var(--secondary-color)",
          border: "4px solid var(--btn-normal-border-color)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.7), 0 10px 10px -5px rgba(0, 0, 0, 0.7)",
          position: "relative",
          animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Header Block */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "1.25rem 1.5rem",
            borderBottom: "4px solid var(--hr-top-color)",
            backgroundColor: "var(--primary-color)",
          }}
        >
          <div
            style={{
              background: "#e94a4a",
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "inset 2px 2px 0 #ff7878, inset -2px -2px 0 #ad2323",
            }}
          >
            <AlertTriangle size={20} color="white" />
          </div>
          <div>
            <h3
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "#ff7878",
                textShadow: "1px 1px 0 rgba(0,0,0,0.5)",
                margin: 0,
              }}
            >
              SERVER CRASH DETECTED
            </h3>
            <span style={{ fontSize: "0.75rem", color: "var(--accent-color)" }}>
              Instance ID: <span style={{ fontFamily: "monospace", color: "#fff" }}>{crash.instanceId}</span>
            </span>
          </div>
          <button
            onClick={() => setCrash(null)}
            style={{
              marginLeft: "auto",
              color: "var(--accent-color)",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--accent-color)")}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Block */}
        <div style={{ padding: "1.5rem" }}>
          {/* Reason Section */}
          <div style={{ marginBottom: "1.25rem" }}>
            <h4
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "#ffaa44",
                marginBottom: "0.4rem",
              }}
            >
              Reason:
            </h4>
            <p
              style={{
                fontSize: "0.9rem",
                color: "var(--text-color)",
                background: "rgba(0, 0, 0, 0.25)",
                padding: "0.75rem",
                border: "2px solid var(--hr-top-color)",
                lineHeight: "1.4",
              }}
            >
              {crash.reason}
            </p>
          </div>

          {/* Resolution Section */}
          <div style={{ marginBottom: "1.5rem" }}>
            <h4
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "#55aaff",
                marginBottom: "0.4rem",
              }}
            >
              Resolution:
            </h4>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-color)",
                lineHeight: "1.5",
              }}
            >
              {crash.resolution}
            </p>
          </div>

          {/* Buttons Row */}
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "flex-end",
            }}
          >
            <button
              onClick={async () => {
                // Trigger restart call using window.go if available
                if (window.go?.main?.App?.RestartServer) {
                  try {
                    await window.go.main.App.RestartServer(crash.instanceId);
                    setCrash(null);
                  } catch (err) {
                    await alert("Failed to restart: " + err, "Restart Error");
                  }
                } else {
                  setCrash(null);
                }
              }}
              className="button-primary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.8rem",
                margin: 0,
              }}
            >
              <RefreshCw size={14} />
              Restart Server
            </button>

            <button
              onClick={() => BrowserOpenURL("https://discord.com/invite/zrrHQC4QKF")}
              className="button-secondary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.8rem",
                margin: 0,
                backgroundColor: "#5865F2",
                boxShadow: "inset 2px 2px 0 #7289da, inset -2px -2px 0 #4e5d94",
                border: "2px solid #2c2f33",
              }}
            >
              <MessageSquare size={14} />
              Join Discord
            </button>

            <button
              onClick={() => setCrash(null)}
              className="button-normal"
              style={{
                fontSize: "0.8rem",
                margin: 0,
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
