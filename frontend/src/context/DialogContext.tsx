import React, { createContext, useContext, useState } from "react";
import { AlertTriangle, Info, X } from "lucide-react";

interface DialogConfig {
  type: "alert" | "confirm" | "danger";
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (value: boolean) => void;
}

interface DialogContextType {
  alert: (message: string, title?: string) => Promise<void>;
  confirm: (message: string, title?: string) => Promise<boolean>;
  dangerConfirm: (message: string, title?: string) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType | null>(null);

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<DialogConfig | null>(null);

  const alert = (message: string, title: string = "Notice") => {
    return new Promise<void>((resolve) => {
      setConfig({
        type: "alert",
        title,
        message,
        confirmLabel: "OK",
        resolve: () => {
          setConfig(null);
          resolve();
        },
      });
    });
  };

  const confirm = (message: string, title: string = "Confirm") => {
    return new Promise<boolean>((resolve) => {
      setConfig({
        type: "confirm",
        title,
        message,
        confirmLabel: "Yes",
        cancelLabel: "No",
        resolve: (value: boolean) => {
          setConfig(null);
          resolve(value);
        },
      });
    });
  };

  const dangerConfirm = (message: string, title: string = "Warning") => {
    return new Promise<boolean>((resolve) => {
      setConfig({
        type: "danger",
        title,
        message,
        confirmLabel: "Delete / Proceed",
        cancelLabel: "Cancel",
        resolve: (value: boolean) => {
          setConfig(null);
          resolve(value);
        },
      });
    });
  };

  return (
    <DialogContext.Provider value={{ alert, confirm, dangerConfirm }}>
      {children}
      {config && (
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
            zIndex: 10000,
            padding: "2rem",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "460px",
              background: "var(--secondary-color)",
              border: "4px solid var(--btn-normal-border-color)",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.7), 0 10px 10px -5px rgba(0, 0, 0, 0.7)",
              position: "relative",
              animation: "slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
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
                  background: config.type === "danger" ? "#e94a4a" : "#2a82e6",
                  padding: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: config.type === "danger" 
                    ? "inset 2px 2px 0 #ff7878, inset -2px -2px 0 #ad2323"
                    : "inset 2px 2px 0 #73b3ff, inset -2px -2px 0 #1b5bb5",
                }}
              >
                {config.type === "danger" ? (
                  <AlertTriangle size={20} color="white" />
                ) : (
                  <Info size={20} color="white" />
                )}
              </div>
              <h3
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: config.type === "danger" ? "#ff7878" : "#73b3ff",
                  textShadow: "1px 1px 0 rgba(0,0,0,0.5)",
                  margin: 0,
                }}
              >
                {config.title.toUpperCase()}
              </h3>
              <button
                onClick={() => config.resolve(false)}
                style={{
                  marginLeft: "auto",
                  color: "var(--accent-color)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "4px",
                  border: "2px solid transparent",
                  transition: "color 0.15s, border-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#ff7878";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--accent-color)";
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Block */}
            <div style={{ padding: "1.5rem" }}>
              <p
                style={{
                  fontSize: "0.9rem",
                  lineHeight: "1.6",
                  color: "var(--text-color)",
                  margin: 0,
                  whiteSpace: "pre-wrap",
                }}
              >
                {config.message}
              </p>
            </div>

            {/* Actions Block */}
            <div
              style={{
                padding: "1rem 1.5rem",
                borderTop: "4px solid var(--hr-bottom-color)",
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
                backgroundColor: "var(--primary-color)",
              }}
            >
              {config.type !== "alert" && (
                <button
                  onClick={() => config.resolve(false)}
                  className="button-normal"
                  style={{ minWidth: "100px", padding: "0.5rem 1rem" }}
                >
                  {config.cancelLabel}
                </button>
              )}
              <button
                onClick={() => config.resolve(true)}
                className={config.type === "danger" ? "button-danger" : "button-primary"}
                style={{ minWidth: "100px", padding: "0.5rem 1rem" }}
              >
                {config.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
