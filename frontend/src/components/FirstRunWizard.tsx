import { useState, useEffect } from "react";
import { FolderOpen, Monitor, CheckCircle, ChevronRight, Cpu } from "lucide-react";
import { selectServersDir, getDefaultServersDir, completeSetup } from "../ipc/serverAPI";

interface Props {
  onComplete: () => void;
}

type Step = "welcome" | "directory" | "shortcut" | "finishing";

export default function FirstRunWizard({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("welcome");
  const [serversDir, setServersDir] = useState("");
  const [createShortcut, setCreateShortcut] = useState(true);
  const [error, setError] = useState("");
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    getDefaultServersDir()
      .then((dir) => setServersDir(dir))
      .catch(() => setServersDir("./servers"));
  }, []);

  const handleBrowse = async () => {
    try {
      const chosen = await selectServersDir();
      if (chosen) setServersDir(chosen);
    } catch {
      setError("Could not open folder picker.");
    }
  };

  const handleFinish = async () => {
    setError("");
    setFinishing(true);
    setStep("finishing");
    try {
      await completeSetup(serversDir, createShortcut);
      // Brief delay for the "finishing" animation before entering the app
      setTimeout(() => onComplete(), 1200);
    } catch (e: any) {
      setError(e?.message ?? "Setup failed.");
      setStep("shortcut");
      setFinishing(false);
    }
  };

  const stepIndex = { welcome: 0, directory: 1, shortcut: 2, finishing: 3 };
  const currentIndex = stepIndex[step];

  return (
    <>
      {/* Dark semi-transparent backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          backdropFilter: "blur(3px)",
        }}
      >
        {/* Modal card */}
        <div
          style={{
            background: "var(--secondary-color)",
            border: "2px solid var(--hr-top-color)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)",
            width: "480px",
            maxWidth: "calc(100vw - 2rem)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "wizardIn 0.2s ease-out",
          }}
        >
          {/* Header bar */}
          <div
            style={{
              background: "var(--primary-color)",
              borderBottom: "2px solid var(--hr-top-color)",
              padding: "1.1rem 1.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                background: "var(--btn-primary-inner-color)",
                width: "32px",
                height: "32px",
                border: "2px solid var(--btn-primary-border-color)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "inset 2px 2px 0 var(--btn-primary-inner-border-lt-color), inset -2px -2px 0 var(--btn-primary-inner-border-br-color)",
                flexShrink: 0,
              }}
            >
              <Cpu size={17} color="white" />
            </div>
            <div>
              <h2 style={{ fontSize: "0.95rem", fontWeight: 700, letterSpacing: "0.5px", margin: 0 }}>
                MACE Setup
              </h2>
              <span style={{ fontSize: "0.68rem", color: "var(--accent-color)" }}>
                First-time configuration
              </span>
            </div>

            {/* Step dots */}
            <div style={{ marginLeft: "auto", display: "flex", gap: "6px", alignItems: "center" }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: i === currentIndex ? "20px" : "8px",
                    height: "8px",
                    background: i <= currentIndex ? "var(--btn-primary-inner-color)" : "var(--hr-bottom-color)",
                    transition: "all 0.25s ease",
                    border: "1px solid var(--btn-primary-border-color)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: "1.75rem 1.5rem", flex: 1 }}>

            {/* ── Step: Welcome ── */}
            {step === "welcome" && (
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    margin: "0 auto 1.25rem",
                    width: "56px",
                    height: "56px",
                    background: "var(--btn-primary-inner-color)",
                    border: "3px solid var(--btn-primary-border-color)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 24px rgba(60,133,39,0.35), inset 2px 2px 0 rgba(255,255,255,0.15)",
                    animation: "pulseGlow 2s ease-in-out infinite",
                  }}
                >
                  <Cpu size={28} color="white" />
                </div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                  Welcome to MACE
                </h3>
                <p style={{ color: "var(--accent-color)", fontSize: "0.82rem", lineHeight: 1.7, maxWidth: "340px", margin: "0 auto 1.5rem" }}>
                  Minecraft Advanced Control Engine — your all-in-one server manager.
                  Let's get you set up in just a few steps.
                </p>
                <button
                  className="button-primary"
                  onClick={() => setStep("directory")}
                  style={{ margin: "0 auto", display: "flex", alignItems: "center", gap: "0.5rem" }}
                >
                  Get Started <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* ── Step: Directory ── */}
            {step === "directory" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.75rem" }}>
                  <div
                    style={{
                      background: "var(--btn-primary-inner-color)",
                      width: "28px",
                      height: "28px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "2px solid var(--btn-primary-border-color)",
                      flexShrink: 0,
                    }}
                  >
                    <FolderOpen size={14} color="white" />
                  </div>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>
                    Servers Directory
                  </h3>
                </div>

                <p style={{ color: "var(--accent-color)", fontSize: "0.78rem", lineHeight: 1.6, marginBottom: "1.1rem" }}>
                  Choose the folder where MACE will create and manage all your server instances.
                  You can use the default location or pick any folder on your system.
                </p>

                {/* Path display + browse */}
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "stretch", marginBottom: "0.5rem" }}>
                  <div
                    style={{
                      flex: 1,
                      background: "var(--background-color)",
                      border: "2px solid var(--hr-top-color)",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.72rem",
                      color: "var(--text-color)",
                      wordBreak: "break-all",
                      boxShadow: "inset 0 2px 0 rgba(0,0,0,0.3)",
                      display: "flex",
                      alignItems: "center",
                      minHeight: "40px",
                    }}
                  >
                    {serversDir || "No directory selected"}
                  </div>
                  <button
                    className="button-normal"
                    onClick={handleBrowse}
                    style={{ padding: "0.5rem 0.75rem", margin: 0, display: "flex", alignItems: "center", gap: "0.4rem", whiteSpace: "nowrap" }}
                  >
                    <FolderOpen size={14} /> Browse
                  </button>
                </div>

                <p style={{ fontSize: "0.7rem", color: "var(--hr-bottom-color)", marginBottom: "1.5rem" }}>
                  The folder will be created automatically if it doesn't exist.
                </p>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                  <button className="button-normal" onClick={() => setStep("welcome")} style={{ margin: 0 }}>
                    Back
                  </button>
                  <button
                    className="button-primary"
                    onClick={() => setStep("shortcut")}
                    disabled={!serversDir}
                    style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem", opacity: serversDir ? 1 : 0.5 }}
                  >
                    Continue <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── Step: Shortcut ── */}
            {step === "shortcut" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.75rem" }}>
                  <div
                    style={{
                      background: "var(--btn-primary-inner-color)",
                      width: "28px",
                      height: "28px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "2px solid var(--btn-primary-border-color)",
                      flexShrink: 0,
                    }}
                  >
                    <Monitor size={14} color="white" />
                  </div>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>
                    Desktop Shortcut
                  </h3>
                </div>

                <p style={{ color: "var(--accent-color)", fontSize: "0.78rem", lineHeight: 1.6, marginBottom: "1.25rem" }}>
                  Add a shortcut to your Desktop so you can launch MACE quickly without
                  navigating to its install folder.
                </p>

                {/* Toggle option */}
                <button
                  onClick={() => setCreateShortcut(!createShortcut)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.85rem",
                    width: "100%",
                    padding: "0.85rem 1rem",
                    background: createShortcut ? "rgba(60,133,39,0.12)" : "var(--primary-color)",
                    border: `2px solid ${createShortcut ? "var(--btn-primary-inner-color)" : "var(--hr-top-color)"}`,
                    cursor: "pointer",
                    marginBottom: "1.5rem",
                    transition: "all 0.15s ease",
                    textAlign: "left",
                  }}
                >
                  {/* Custom checkbox */}
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      border: `2px solid ${createShortcut ? "var(--btn-primary-inner-color)" : "var(--hr-bottom-color)"}`,
                      background: createShortcut ? "var(--btn-primary-inner-color)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "all 0.15s",
                    }}
                  >
                    {createShortcut && (
                      <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                        <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="2" strokeLinecap="square" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-color)" }}>
                      Create Desktop shortcut
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--accent-color)", marginTop: "2px" }}>
                      Adds MACE.lnk to your Desktop
                    </div>
                  </div>
                </button>

                {error && (
                  <div
                    style={{
                      background: "rgba(180,40,40,0.15)",
                      border: "2px solid #b42828",
                      padding: "0.6rem 0.75rem",
                      fontSize: "0.75rem",
                      color: "#e08080",
                      marginBottom: "1rem",
                    }}
                  >
                    {error}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                  <button className="button-normal" onClick={() => setStep("directory")} style={{ margin: 0 }}>
                    Back
                  </button>
                  <button
                    className="button-primary"
                    onClick={handleFinish}
                    disabled={finishing}
                    style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}
                  >
                    Finish Setup <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── Step: Finishing ── */}
            {step === "finishing" && (
              <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
                <div
                  style={{
                    margin: "0 auto 1.25rem",
                    width: "48px",
                    height: "48px",
                    border: "3px solid var(--hr-top-color)",
                    borderTop: "3px solid var(--btn-primary-inner-color)",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <CheckCircle size={16} color="var(--btn-primary-inner-color)" />
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>Setting up MACE…</h3>
                </div>
                <p style={{ color: "var(--accent-color)", fontSize: "0.78rem" }}>
                  Creating your servers directory{createShortcut ? " and Desktop shortcut" : ""}…
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes wizardIn {
          from { opacity: 0; transform: scale(0.96) translateY(-8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 18px rgba(60,133,39,0.35), inset 2px 2px 0 rgba(255,255,255,0.15); }
          50%       { box-shadow: 0 0 32px rgba(60,133,39,0.65), inset 2px 2px 0 rgba(255,255,255,0.15); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
